import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const MANIFEST_PATH = resolve(import.meta.dir, "..", "plugin", ".plugin.json");

async function readManifest() {
	const raw = await readFile(MANIFEST_PATH, "utf-8");
	return JSON.parse(raw) as Record<string, unknown>;
}

describe("manifest", () => {
	it("has the expected slug (name)", async () => {
		const m = await readManifest();
		expect(m.name).toBe("twitter");
	});

	it("has the bumped version 1.0.2", async () => {
		const m = await readManifest();
		expect(m.version).toBe("1.0.2");
	});

	it("declares the canonical $schema", async () => {
		const m = await readManifest();
		expect(m.$schema).toBe("https://orgsdk.ai/schemas/plugin-manifest.v1.json");
	});

	it("has a non-empty description", async () => {
		const m = await readManifest();
		expect(typeof m.description).toBe("string");
		expect((m.description as string).length).toBeGreaterThan(0);
	});

	it("declares entry as index.ts", async () => {
		const m = await readManifest();
		expect(m.entry).toBe("index.ts");
	});

	it("declares oauth2 auth with the twitter-oauth provider key", async () => {
		const m = await readManifest();
		const auth = m.auth as Record<string, unknown>;
		expect(auth.type).toBe("oauth2");
		expect(auth.provider).toBe("twitter-oauth");
		expect(auth.callbackPath).toBe("/callback");
	});

	it("declares the exact Twitter/X OAuth 2.0 scopes", async () => {
		const m = await readManifest();
		const auth = m.auth as { scopes: string[] };
		expect(auth.scopes).toEqual([
			"tweet.read",
			"tweet.write",
			"users.read",
			"offline.access",
		]);
	});

	it("declares marketplace metadata with the source-repo provenance link", async () => {
		const m = await readManifest();
		const mp = m.marketplace as Record<string, unknown>;
		expect(mp.displayName).toBe("X");
		expect(mp.category).toBe("Social");
		expect(Array.isArray(mp.tags)).toBe(true);
		const links = mp.links as Record<string, string>;
		expect(links.sourceRepo).toBe(
			"https://github.com/OrgSDK/orgsdk-plugin-twitter",
		);
		expect(links.homepage).toBe("https://x.com");
	});
});
