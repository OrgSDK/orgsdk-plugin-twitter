# @orgsdk/plugin-twitter

Official OrgSDK plugin for [X (Twitter)](https://x.com) — manage tweets and
threads from agent workflows: post tweets (with replies/quotes), post threads,
read the authenticated profile, pull engagement analytics, and delete tweets.
OAuth2 with PKCE (BYO client).

[![CI](https://github.com/OrgSDK/orgsdk-plugin-twitter/actions/workflows/ci.yml/badge.svg)](https://github.com/OrgSDK/orgsdk-plugin-twitter/actions/workflows/ci.yml)

## Repository layout

```
orgsdk-plugin-twitter/
├── .github/workflows/
│   ├── ci.yml                 # calls the shared reusable CI workflow (OrgSDK/plugins)
│   └── publish-catalog.yml    # calls the shared reusable publish workflow (opt-in; manual dry-run)
├── plugin/                    # the publishable plugin folder
│   ├── .plugin.json           # manifest (slug, version, auth, marketplace)
│   ├── index.ts               # entry — factory(ctx) → PluginModule
│   ├── auth-provider.ts       # OAuth2 + PKCE auth provider (dashboard credential flow + callback)
│   ├── twitter-functions.ts   # safe functions
│   ├── oauth.ts               # token refresh helpers
│   └── docs/overview.md       # plugin-local docs
├── tests/                     # bun:test — manifest, source purity, plugin shape, packaging
├── docs/                      # contract migration, release/promotion contract
├── package.json
├── tsconfig.json
├── biome.json
└── README.md
```

The `plugin/` folder is the canonical source for the Twitter plugin; it is
published to the OrgSDK catalog on merge to `main` when opted in via the
`ORGSDK_ENABLE_CATALOG_PUBLISH` repo variable (see [docs/release.md](docs/release.md)).

## Local development

Requires [Bun](https://bun.sh) ≥ 1.3.x.

```bash
# Install (frozen lockfile in CI; dev: generates one)
bun install

# Lint + format check
bun run check

# Typecheck (no emit)
bun run typecheck

# Run tests
bun run test

# Validate manifest + source purity (orgsdk-plugin validate)
bun run validate

# Stage distributable artifact into dist/ (orgsdk-plugin package)
bun run package

# Full build pipeline (typecheck → validate → package)
bun run build
```

The `validate`, `package`, `version-guard`, and `publish` npm scripts delegate to
the [`orgsdk-plugin`](https://www.npmjs.com/package/@orgsdk/plugins) CLI shipped
by the `@orgsdk/plugins` dev dependency. There are no local management scripts.

## Functions

| Function | Purpose | Mode |
|---|---|---|
| `getUser` | Get the authenticated user's profile. | readonly |
| `createTweet` | Post a tweet (optionally a reply or quote). | write |
| `createThread` | Post a thread (array of tweets chained as replies). | write |
| `getTweetAnalytics` | Pull engagement metrics for a tweet. | readonly |
| `deleteTweet` | Delete a tweet (irreversible). | write/destructive |

All functions require the `twitter-oauth` credential.

## Manifest & version rules

- The manifest lives at `plugin/.plugin.json`.
- `version` is the **source of truth** for the catalog — bump it on every
  publishable content change (the CI version guard enforces this).
- `package.json` → `version` is kept in sync with the manifest (enforced by
  the version guard).
- Versions are **write-once** in the catalog: re-publishing the same
  `(slug, version)` with identical content is idempotent; differing content is
  rejected (HTTP 409). Treat every publish as forward-only.
- See [docs/release.md](docs/release.md) for the automatic publish model and
  required repository settings.

## CI/CD

CI and catalog publishing delegate to centrally maintained **reusable
workflows** in [OrgSDK/plugins](https://github.com/OrgSDK/plugins), pinned to an
immutable commit. The caller workflows (`.github/workflows/`) only wire up
triggers, the opt-in gate, artifact names, and secrets — no plugin mechanics are
duplicated. See the
[reusable-workflows docs](https://github.com/OrgSDK/plugins/blob/main/docs/reusable-workflows.md)
for the full contract.

## Security constraints

- Twitter OAuth tokens are injected at call time via `requiredCredentials:
  ["twitter-oauth"]` — they are **never** hardcoded, logged, or persisted in
  plugin source. The bundle flows through the daemon's `CredentialStore`.
- The OAuth client (`client_id` / `client_secret`) is stored under the
  `twitter-oauth-client` provider; the granted access + refresh tokens under
  `twitter-oauth`. Plugin handlers receive credentials as a parameter; they
  must not return, log, or store them.
- The OAuth flow uses PKCE (`code_challenge` / `code_verifier`, S256) end to
  end; the access token is refreshed from the stored refresh token before each
  call (Twitter access tokens expire after 2 hours).
- Source purity is enforced: no imports from private `@orgsdk/*` packages, no
  cross-plugin imports, no runtime value imports from the authoring SDK. The
  `validate` script and `tests/purity.test.ts` guard this.
- Publish credentials (`ORGSDK_PUBLISH_TOKEN`) live as a GitHub secret
  (repository-level or `catalog-publish` environment); they are never committed
  to the repo. See [docs/release.md](docs/release.md).

## Authoring contract

The plugin authoring types come from the public
[`@orgsdk/plugins`](https://www.npmjs.com/package/@orgsdk/plugins) npm package,
imported type-only (`import type { … } from "@orgsdk/plugins"`). The SDK is a
dev-only dependency; the runtime artifact carries **no dependencies** — Twitter
uses only platform globals (`fetch`, `URLSearchParams`, `crypto`, `crypto.subtle`).
See [docs/contract-migration.md](docs/contract-migration.md).

## Source attribution

Extracted from the OrgSDK monorepo at:

- **Source path:** `packages/plugins/src/twitter/`
- **Twitter source first added (monorepo commit):** `a3cbecf123be62e99b1a9c3b2eef06a5a137977b`
- **Monorepo HEAD at extraction:** `d7b53516c08f58e72d55305a5fa6513cfe152f40`

No plugin behavior changed in this extraction — only the type-only import
specifiers (`orgsdk/plugins` → `@orgsdk/plugins`), the manifest `$schema`,
`version`, and `marketplace.links.sourceRepo` were added.

## License

Proprietary — All rights reserved. This source is the confidential property
of OrgSDK. No part of this repository may be reproduced, distributed, or
transmitted in any form without the prior written permission of OrgSDK.
Unauthorized use, modification, or redistribution is strictly prohibited.
