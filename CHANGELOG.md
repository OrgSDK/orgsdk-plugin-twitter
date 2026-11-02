# Changelog

## 1.0.3 (unreleased)

- Pin the authoring/execution packages to 0.2.2/0.1.0, with the tracked executor packaging fixes.
- Build a restricted npm distribution and verify every exported function from the packed artifact through the headless executor.
- Add versioned npm release CI that publishes the exact tested tarball after explicit repository activation.

All notable releases of `@orgsdk/plugin-twitter` are documented here.

The catalog treats versions as **write-once**: a given `(slug, version)` may be
re-published only with identical artifact content; differing content is
rejected with HTTP 409. Every entry below is therefore forward-only.

## [1.0.2] — standalone repository + artifact-format release

A forward-only patch release that migrates the Twitter plugin from the
OrgSDK monorepo (`packages/plugins/src/twitter/`) into this standalone
repository. **No plugin source behavior changed** — the five safe functions
(`getUser`, `createTweet`, `createThread`, `getTweetAnalytics`, `deleteTweet`),
the OAuth2 + PKCE auth provider (`twitter-oauth`), the token-refresh helpers,
the callback shape, the manifest auth shape, and the runtime surface (no
dependencies — platform globals only) are identical to the monorepo `1.0.1`.

### Why a bump at all?

The repository/package/schema additions alter the **immutable publishable
content** of the staged artifact, even though no plugin *behavior* changed:

- The manifest gains the canonical `$schema` and
  `marketplace.links.sourceRepo` provenance fields.
- The type-only import specifiers changed from `orgsdk/plugins` (monorepo
  workspace) to `@orgsdk/plugins` (public npm SDK). These imports are erased
  at compile time, so they do not affect runtime behavior — but the manifest
  and the generated artifact `package.json` do change.
- The generated artifact `package.json` is now produced by the deterministic
  `orgsdk-plugin package` step (`name: @orgsdk/plugin-twitter`, `version:
  1.0.2`, no runtime dependencies).

Because catalog versions are write-once, the existing `1.0.1` artifact on
record cannot be re-published with this changed content — it would differ and
be rejected with HTTP 409. Rather than mutate the published history of
`1.0.1`, the new artifact lands as a fresh `1.0.2` entry.

### Changed

- Bump `plugin/.plugin.json` version `1.0.1` → `1.0.2` (catalog source of
  truth).
- Bump `package.json` version `1.0.1` → `1.0.2` (kept in sync; enforced by
  the CI version guard).
- Add `plugin/.plugin.json` `$schema` and `marketplace.links.sourceRepo`.
- Adopt `@orgsdk/plugins@0.2.1` authoring contract (CLI + reusable workflows).
- Convert type-only imports `orgsdk/plugins` → `@orgsdk/plugins`.

### Frozen (unchanged from monorepo 1.0.1)

- All five safe functions — names, parameters, return types, metadata,
  `requiredCredentials: ["twitter-oauth"]`.
- OAuth2 + PKCE auth provider — `type: oauth2`, `twitter-oauth` provider key,
  callback path `/callback`, scopes (`tweet.read`, `tweet.write`, `users.read`,
  `offline.access`), client-config resolution order.
- Token helpers in `oauth.ts` (refresh-token flow; byte-identical to the
  monorepo).
- `docs/overview.md` (verbatim).

## [1.0.1]

- Monorepo release (`packages/plugins/src/twitter/`). Behavior identical to
  `1.0.2` above; superseded in the catalog by this standalone-repository
  release.
