export interface TwitterOAuthBundle {
	secret_clientId?: string;
	secret_clientSecret?: string;
	secret_refreshToken?: string;
	secret_accessToken?: string;
	[key: string]: unknown;
}

export function getTwitterCredentials(
	creds: Record<string, unknown>,
): TwitterOAuthBundle {
	return (creds["twitter-oauth"] as TwitterOAuthBundle | undefined) ?? {};
}

/**
 * Refresh the Twitter/X access token using the stored refresh token.
 * Twitter access tokens expire after 2 hours.
 */
export async function refreshTwitterAccessToken(
	bundle: TwitterOAuthBundle,
): Promise<{ accessToken: string; refreshToken?: string; expiresAt: number }> {
	if (!bundle.secret_clientId || !bundle.secret_clientSecret) {
		throw new Error("Missing Twitter OAuth client credentials");
	}
	if (!bundle.secret_refreshToken) {
		throw new Error(
			"Missing Twitter refresh token. Connect Twitter in the dashboard (Credentials tab).",
		);
	}

	const resp = await fetch("https://api.twitter.com/2/oauth2/token", {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Authorization: `Basic ${Buffer.from(`${bundle.secret_clientId}:${bundle.secret_clientSecret}`).toString("base64")}`,
		},
		body: new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: bundle.secret_refreshToken,
		}),
	});

	if (!resp.ok) {
		const errText = await resp.text();
		throw new Error(`Twitter token refresh failed: ${resp.status} ${errText}`);
	}

	const data = await resp.json();
	return {
		accessToken: data.access_token,
		refreshToken: data.refresh_token ?? undefined,
		expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
	};
}

/**
 * Get a valid access token, refreshing if needed.
 */
export async function getTwitterAccessToken(
	creds: Record<string, unknown>,
): Promise<string> {
	const bundle = getTwitterCredentials(creds);
	const result = await refreshTwitterAccessToken(bundle);
	return result.accessToken;
}
