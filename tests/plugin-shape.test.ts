/**
 * Plugin shape / contract tests.
 *
 * Imports the real entry through Bun's module system (no daemon, no DB) and
 * exercises the factory with a no-op PluginContext — mirrors the monorepo's
 * tests/plugins/helpers/harness.ts approach. These are the implementation-
 * equivalence tests: they pin the exact function names/count, the provider
 * key, the OAuth callback shape, and the credential bundle written back.
 */
import { describe, expect, it } from "bun:test";
import type {
	AuthProvider,
	PluginContext,
	PluginModule,
} from "@orgsdk/plugins";

const EXPECTED_FUNCTIONS = [
	"createTweet",
	"createThread",
	"deleteTweet",
	"getTweetAnalytics",
	"getUser",
] as const;

const noopCtx: PluginContext = {
	stores: {
		credential: {
			get: async () => null,
			list: async () => [],
			upsert: async () => {},
			delete: async () => {},
			getSecrets: async () => null,
			setSecrets: async () => {},
		},
		config: {
			list: async () => [],
			get: async () => null,
			set: async () => ({ key: "", value: {}, updatedAt: null }),
			delete: async () => {},
		},
	},
	publicBaseUrl: "http://localhost:3000",
	logger: {
		trace() {},
		debug() {},
		info() {},
		warn() {},
		error() {},
		fatal() {},
		child() {
			return this;
		},
	},
};

async function loadPlugin(ctx: PluginContext = noopCtx): Promise<PluginModule> {
	const mod = await import("../plugin/index");
	const factory = mod.default as (ctx: PluginContext) => PluginModule;
	return factory(ctx);
}

describe("plugin shape", () => {
	it("factory returns a module with safeFunctions", async () => {
		const mod = await loadPlugin();
		expect(Array.isArray(mod.safeFunctions)).toBe(true);
		expect(mod.safeFunctions?.length).toBeGreaterThan(0);
	});

	it("exposes exactly the five expected safe functions (no more, no less)", async () => {
		const mod = await loadPlugin();
		const names = (mod.safeFunctions ?? []).map((f) => f.name).sort();
		expect(names).toEqual([...EXPECTED_FUNCTIONS].sort());
	});

	it('every function declares requiredCredentials: ["twitter-oauth"]', async () => {
		const mod = await loadPlugin();
		const fns = mod.safeFunctions ?? [];
		for (const fn of fns) {
			expect(fn.requiredCredentials).toEqual(["twitter-oauth"]);
		}
	});

	it("readonly functions are tagged readonly, write functions are not", async () => {
		const mod = await loadPlugin();
		const byName = new Map((mod.safeFunctions ?? []).map((f) => [f.name, f]));
		expect(byName.get("getUser")?.metadata?.readonly).toBe(true);
		expect(byName.get("getTweetAnalytics")?.metadata?.readonly).toBe(true);
		expect(byName.get("createTweet")?.metadata?.readonly).toBe(false);
		expect(byName.get("createThread")?.metadata?.readonly).toBe(false);
		expect(byName.get("deleteTweet")?.metadata?.readonly).toBe(false);
	});

	it("deleteTweet is tagged destructive", async () => {
		const mod = await loadPlugin();
		const byName = new Map((mod.safeFunctions ?? []).map((f) => [f.name, f]));
		expect(byName.get("deleteTweet")?.metadata?.tags).toContain("destructive");
	});

	it("every function is categorized under twitter", async () => {
		const mod = await loadPlugin();
		for (const fn of mod.safeFunctions ?? []) {
			expect(fn.metadata?.category).toBe("twitter");
		}
	});

	it("has an oauth2 authProvider", async () => {
		const mod = await loadPlugin();
		const auth = mod.authProvider as AuthProvider | undefined;
		expect(auth).toBeDefined();
		expect(auth?.type).toBe("oauth2");
		expect(auth?.authMeta?.displayName).toBe("Twitter/X");
	});

	it("exposes the GET /callback http endpoint", async () => {
		const mod = await loadPlugin();
		const endpoints = mod.httpEndpoints ?? [];
		expect(endpoints).toHaveLength(1);
		expect(endpoints[0].method).toBe("GET");
		expect(endpoints[0].path).toBe("/callback");
	});

	it("handleCallback rejects a request missing code/state", async () => {
		const mod = await loadPlugin();
		const auth = mod.authProvider as AuthProvider | undefined;
		const req = new Request("http://localhost/plugins/twitter/callback");
		const result = await auth?.handleCallback?.(req);
		expect(result?.success).toBe(false);
		expect(result?.credentialName).toBe("");
		expect(result?.error).toBeDefined();
	});

	it("handleCallback rejects an unknown state", async () => {
		const mod = await loadPlugin();
		const auth = mod.authProvider as AuthProvider | undefined;
		const url = new URL("http://localhost/plugins/twitter/callback");
		url.searchParams.set("code", "abc");
		url.searchParams.set("state", "never-issued");
		const result = await auth?.handleCallback?.(new Request(url.toString()));
		expect(result?.success).toBe(false);
		expect(result?.error).toMatch(/Invalid or expired state/i);
	});

	it("configure() writes the twitter-oauth-client app credentials", async () => {
		let captured: Record<string, unknown> | undefined;
		const ctx: PluginContext = {
			...noopCtx,
			stores: {
				...noopCtx.stores,
				credential: {
					...noopCtx.stores.credential,
					async setSecrets(provider, name, secrets) {
						captured = { provider, name, secrets };
					},
				},
			},
		};
		const mod = await loadPlugin(ctx);
		const auth = mod.authProvider as AuthProvider & {
			configure(json: string, name: string): Promise<void>;
		};
		expect(typeof auth.configure).toBe("function");
		await auth.configure(
			'{"client_id":"abc","client_secret":"shh"}',
			"default",
		);
		expect(captured?.provider).toBe("twitter-oauth-client");
		expect(captured?.name).toBe("default");
		const secrets = (captured?.secrets ?? {}) as Record<string, string>;
		expect(secrets.secret_clientId).toBe("abc");
		expect(secrets.secret_clientSecret).toBe("shh");
	});

	it("configure() rejects JSON missing client_id / client_secret", async () => {
		const mod = await loadPlugin();
		const auth = mod.authProvider as AuthProvider & {
			configure(json: string, name: string): Promise<void>;
		};
		await expect(
			auth.configure('{"client_id":"abc"}', "default"),
		).rejects.toThrow(/client_secret/);
	});
});
