/**
 * Packaging tests — determinism, stale-output removal, and generated
 * package.json in the staged artifact.
 *
 * Twitter uses only platform globals (fetch, URLSearchParams, crypto,
 * crypto.subtle) — it has NO runtime dependencies. The generated artifact
 * package.json therefore carries no `dependencies` key at all, and must never
 * carry the dev-only authoring SDK (@orgsdk/plugins).
 */
import { describe, expect, it } from "bun:test";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { $ } from "bun";

const ROOT = resolve(import.meta.dir, "..");
const DIST_DIR = join(ROOT, "dist");

async function readManifestSlug(): Promise<string> {
	const raw = await readFile(join(ROOT, "plugin", ".plugin.json"), "utf-8");
	return (JSON.parse(raw) as { name: string }).name;
}

async function manifestPath(): Promise<string> {
	const slug = await readManifestSlug();
	const raw = await readFile(join(ROOT, "plugin", ".plugin.json"), "utf-8");
	const version = (JSON.parse(raw) as { version: string }).version;
	return join(DIST_DIR, `${slug}-${version}.manifest.json`);
}

describe("packaging", () => {
	it("removes stale files from dist/ before staging", async () => {
		// Ensure dist exists with a stale sentinel file.
		await rm(DIST_DIR, { recursive: true, force: true });
		await mkdir(DIST_DIR, { recursive: true });
		const sentinel = join(DIST_DIR, "STALE_SENTINEL.txt");
		await writeFile(sentinel, "this should not survive packaging");

		// Run packaging.
		await $`bun run package`.cwd(ROOT).quiet();

		// The sentinel must be gone.
		await expect(stat(sentinel)).rejects.toThrow();
	});

	it("produces deterministic output across runs", async () => {
		await $`bun run package`.cwd(ROOT).quiet();
		const first = await readFile(await manifestPath(), "utf-8");

		await $`bun run package`.cwd(ROOT).quiet();
		const second = await readFile(await manifestPath(), "utf-8");

		expect(second).toBe(first);
	});

	it("manifest entries are sorted by path", async () => {
		await $`bun run package`.cwd(ROOT).quiet();
		const raw = await readFile(await manifestPath(), "utf-8");
		const parsed = JSON.parse(raw) as {
			files: Array<{ path: string }>;
		};
		const paths = parsed.files.map((f) => f.path);
		const sorted = [...paths].sort((a, b) => a.localeCompare(b));
		expect(paths).toEqual(sorted);
	});

	it("generated package.json in artifact carries NO runtime deps and no authoring SDK", async () => {
		const slug = await readManifestSlug();
		await $`bun run package`.cwd(ROOT).quiet();
		const pkgPath = join(DIST_DIR, slug, "package.json");
		const pkg = JSON.parse(await readFile(pkgPath, "utf-8")) as Record<
			string,
			unknown
		>;

		expect(pkg.name).toBe("@orgsdk/plugin-twitter");
		expect(pkg.version).toBe("1.0.2");
		expect(pkg.type).toBe("module");
		// Twitter has no runtime dependencies (globals only).
		expect(pkg.dependencies).toBeUndefined();
		// The authoring SDK must NOT be a runtime dependency.
		expect(pkg["@orgsdk/plugins"]).toBeUndefined();
		expect(pkg.devDependencies).toBeUndefined();
		expect(pkg.scripts).toBeUndefined();
		expect(pkg.private).toBeUndefined();
	});

	it("manifest includes the generated package.json entry", async () => {
		await $`bun run package`.cwd(ROOT).quiet();
		const raw = await readFile(await manifestPath(), "utf-8");
		const parsed = JSON.parse(raw) as {
			files: Array<{ path: string }>;
		};
		const paths = parsed.files.map((f) => f.path);
		expect(paths).toContain("package.json");
	});
});
