# Contract migration — completed

## Status: consuming `@orgsdk/plugins` from npm

This plugin imports its authoring types from the public
[`@orgsdk/plugins`](https://www.npmjs.com/package/@orgsdk/plugins) npm package.
The migration from the monorepo workspace specifier is complete.

## What changed (from the monorepo source)

1. **Import specifiers updated** — `from "orgsdk/plugins"` →
   `from "@orgsdk/plugins"`. All imports are **type-only**
   (`import type { … }`).
2. **devDependency** is the published npm package, pinned to an exact version
   (`@orgsdk/plugins@0.2.1`) for reproducibility.
3. **Purity guards** — type-only imports from `@orgsdk/plugins` are
   allowed; value imports and all other `@orgsdk/*` packages are blocked
   (enforced by `tests/purity.test.ts` and `orgsdk-plugin validate`).
4. **Artifact purity** — the runtime artifact's `package.json` carries **no
   dependencies** (Twitter uses only platform globals), and NOT
   `@orgsdk/plugins` (type-only imports are erased at compile time).
5. **Manifest `$schema`** — `plugin/.plugin.json` declares
   `$schema: https://orgsdk.ai/schemas/plugin-manifest.v1.json` for editor
   completion and schema validation.
6. **Provenance** — `marketplace.links.sourceRepo` points at this repository
   (canonical key supported by `plugin-manifest.v1`).
7. **No local management scripts** — `validate`, `package`, `version-guard`,
   and `publish` are npm scripts that delegate to the `orgsdk-plugin` CLI
   shipped by `@orgsdk/plugins`.
8. **Reusable CI/CD workflows** — `.github/workflows/ci.yml` and
   `publish-catalog.yml` call the centrally maintained reusable workflows in
   `OrgSDK/plugins` (pinned to an immutable commit) instead of duplicating
   CI/publish mechanics.

## What did NOT change (frozen behavior)

- The five safe functions, their parameters, return types, metadata, and
  `requiredCredentials`.
- The OAuth2 + PKCE auth provider: `type`, provider key `twitter-oauth`,
  scopes, `callbackPath`, callback result shape, client-config resolution
  order, and the credential bundle written back (`secret_clientId`,
  `secret_clientSecret`, `secret_refreshToken`, `secret_accessToken`).
- `oauth.ts` (refresh-token flow) — byte-identical.
- `docs/overview.md` — verbatim.

## Why `@orgsdk/plugins`?

The package provides the stable, minimal, structural TypeScript contract
between plugin authors and the OrgSDK daemon — with no private daemon,
platform, storage, or database internals. See
[OrgSDK/plugins](https://github.com/OrgSDK/plugins) for the full API surface.

## Type-only contract

All imports from `@orgsdk/plugins` are `import type { … }` — erased at
compile time. The runtime plugin artifact carries **no dependencies**. This
means:

- No runtime weight from the authoring SDK.
- Plugin source typechecks against the same contract the daemon enforces.

## Upgrading the contract version

The dependency is pinned exactly (`0.2.1`). When a new contract version is
released, update the version in `package.json`, regenerate the lockfile with
`bun install`, and confirm tests still pass. Prefer deliberate, reviewed
upgrades over floating ranges while the contract is still pre-1.0.
