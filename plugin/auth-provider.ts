import type {
	AuthProvider,
	HttpEndpoint,
	PluginContext,
} from "@orgsdk/plugins";

const STATE_TTL_MS = 10 * 60 * 1000;

interface PendingState {
	credentialName: string;
	createdAt: number;
	codeVerifier: string;
}

type TwitterOAuthClientFile = {
	client_id?: string;
	client_secret?: string;
};

export class TwitterAuthProvider implements AuthProvider {
	readonly type = "oauth2" as const;
	readonly authMeta = {
		displayName: "Twitter/X",
		configField: {
			label: "Twitter App Credentials JSON",
			placeholder: '{"client_id": "...", "client_secret": "..."}',
		},
	};
	private readonly pendingStates = new Map<string, PendingState>();
	private readonly ctx: PluginContext;
	private readonly scopes: string[];

	constructor(ctx: PluginContext, scopes: string[]) {
		this.ctx = ctx;
		this.scopes = scopes;
	}

	async initiate(
		credentialName: string,
	): Promise<{ authUrl: string; state: string }> {
		const { clientId, clientSecret } =
			await this.resolveClientConfig(credentialName);
		if (!clientId) {
			throw new Error(
				`Twitter OAuth client credentials not configured. ` +
					`Checked twitter-oauth-client/default, twitter-oauth-client/${credentialName}, twitter-oauth/${credentialName}. ` +
					`Paste your app credentials JSON in the Credentials tab.`,
			);
		}

		const redirectUri = `${this.ctx.publicBaseUrl}/plugins/twitter/callback`;
		const state = crypto.randomUUID();

		// Generate PKCE code verifier and challenge
		const codeVerifier = generateCodeVerifier();
		const codeChallenge = await generateCodeChallenge(codeVerifier);

		this.cleanExpiredStates();
		this.pendingStates.set(state, {
			credentialName,
			createdAt: Date.now(),
			codeVerifier,
		});

		const params = new URLSearchParams({
			response_type: "code",
			client_id: clientId,
			redirect_uri: redirectUri,
			scope: this.scopes.join(" "),
			state,
			code_challenge: codeChallenge,
			code_challenge_method: "S256",
		});

		const authUrl = `https://twitter.com/i/oauth2/authorize?${params}`;
		return { authUrl, state };
	}

	async handleCallback(
		req: Request,
	): Promise<{ success: boolean; credentialName: string; error?: string }> {
		const url = new URL(req.url);
		const code = url.searchParams.get("code");
		const state = url.searchParams.get("state");

		if (!state || !code) {
			return {
				success: false,
				credentialName: "",
				error: "Missing code or state parameter",
			};
		}

		const pending = this.pendingStates.get(state);
		if (!pending) {
			return {
				success: false,
				credentialName: "",
				error: "Invalid or expired state",
			};
		}

		if (Date.now() - pending.createdAt > STATE_TTL_MS) {
			this.pendingStates.delete(state);
			return { success: false, credentialName: "", error: "State expired" };
		}

		this.pendingStates.delete(state);

		try {
			const { clientId, clientSecret } = await this.resolveClientConfig(
				pending.credentialName,
			);

			if (!clientId || !clientSecret) {
				return {
					success: false,
					credentialName: pending.credentialName,
					error:
						`Twitter OAuth client credentials not configured. ` +
						`Checked twitter-oauth-client/default, twitter-oauth-client/${pending.credentialName}, twitter-oauth/${pending.credentialName}.`,
				};
			}

			const redirectUri = `${this.ctx.publicBaseUrl}/plugins/twitter/callback`;

			// Exchange code for tokens using PKCE
			const tokenResp = await fetch("https://api.twitter.com/2/oauth2/token", {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
				},
				body: new URLSearchParams({
					grant_type: "authorization_code",
					code,
					redirect_uri: redirectUri,
					code_verifier: pending.codeVerifier,
				}),
			});

			if (!tokenResp.ok) {
				const errText = await tokenResp.text();
				return {
					success: false,
					credentialName: pending.credentialName,
					error: `Token exchange failed: ${tokenResp.status} ${errText}`,
				};
			}

			const tokens = await tokenResp.json();

			if (!tokens.refresh_token) {
				return {
					success: false,
					credentialName: pending.credentialName,
					error:
						"Twitter did not return a refresh_token. Ensure your app has the correct OAuth 2.0 settings.",
				};
			}

			await this.ctx.stores.credential.setSecrets(
				"twitter-oauth",
				pending.credentialName,
				{
					secret_clientId: clientId,
					secret_clientSecret: clientSecret,
					secret_refreshToken: tokens.refresh_token,
					secret_accessToken: tokens.access_token,
					createdAt: new Date().toISOString(),
				},
				{
					label: `Twitter OAuth (${pending.credentialName})`,
					valid: true,
				},
			);

			return { success: true, credentialName: pending.credentialName };
		} catch (err) {
			return {
				success: false,
				credentialName: pending.credentialName,
				error: err instanceof Error ? err.message : String(err),
			};
		}
	}

	getHttpEndpoints(): HttpEndpoint[] {
		return [
			{
				method: "GET",
				path: "/callback",
				handler: async (req) => {
					const result = await this.handleCallback(req);
					if (result.success) {
						return new Response(
							`<html><body><h2>Twitter OAuth success</h2><p>Credential '${result.credentialName}' saved. You can close this tab.</p></body></html>`,
							{
								headers: { "Content-Type": "text/html" },
							},
						);
					}
					return new Response(
						`<html><body><h2>Twitter OAuth failed</h2><p>${result.error ?? "Unknown error"}</p></body></html>`,
						{
							status: 400,
							headers: { "Content-Type": "text/html" },
						},
					);
				},
			},
		];
	}

	async configure(json: string, credentialName: string): Promise<void> {
		const parsed = JSON.parse(json) as TwitterOAuthClientFile;
		if (!parsed.client_id || !parsed.client_secret) {
			throw new Error(
				"JSON must contain 'client_id' and 'client_secret' fields",
			);
		}
		await this.ctx.stores.credential.setSecrets(
			"twitter-oauth-client",
			credentialName,
			{
				secret_clientId: parsed.client_id,
				secret_clientSecret: parsed.client_secret,
			},
			{
				label: `Twitter OAuth client (${credentialName})`,
				valid: true,
			},
		);
	}

	private async resolveClientConfig(credentialName: string): Promise<{
		clientId?: string;
		clientSecret?: string;
	}> {
		let secrets = await this.ctx.stores.credential.getSecrets(
			"twitter-oauth-client",
			"default",
		);
		let clientId = secrets?.secret_clientId as string | undefined;
		let clientSecret = secrets?.secret_clientSecret as string | undefined;
		if (clientId && clientSecret) return { clientId, clientSecret };

		secrets = await this.ctx.stores.credential.getSecrets(
			"twitter-oauth-client",
			credentialName,
		);
		clientId = secrets?.secret_clientId as string | undefined;
		clientSecret = secrets?.secret_clientSecret as string | undefined;
		if (clientId && clientSecret) return { clientId, clientSecret };

		secrets = await this.ctx.stores.credential.getSecrets(
			"twitter-oauth",
			credentialName,
		);
		clientId = secrets?.secret_clientId as string | undefined;
		clientSecret = secrets?.secret_clientSecret as string | undefined;
		if (clientId && clientSecret) return { clientId, clientSecret };

		return {};
	}

	private cleanExpiredStates() {
		const now = Date.now();
		for (const [k, v] of this.pendingStates) {
			if (now - v.createdAt > STATE_TTL_MS) this.pendingStates.delete(k);
		}
	}
}

// ─── PKCE Helpers ───────────────────────────────────────────────────

function generateCodeVerifier(): string {
	const array = new Uint8Array(32);
	crypto.getRandomValues(array);
	return Buffer.from(array).toString("base64url");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
	const hash = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(verifier),
	);
	return Buffer.from(hash).toString("base64url");
}
