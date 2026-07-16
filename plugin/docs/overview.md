# X (Twitter)

Post to X — tweets, threads, and engagement analytics — and read account info.
OAuth2 (BYO client).

## What it does

The `twitter` plugin publishes tweets and threads, deletes tweets, fetches
engagement analytics, and reads the authenticated user's profile. It targets
the X API v2 write/read scopes.

Typical uses:

- **Cross-posting** — publish a message across X, LinkedIn, and Facebook from
  one workflow (compose with the `linkedin` and `facebook` plugins).
- **Thread scheduling** — queue a multi-tweet thread for a launch.
- **Performance review** — pull per-tweet analytics into a sheet.

## Functions

| Function | Purpose |
|---|---|
| `getUser` | Get the authenticated user's profile. |
| `createTweet` | Post a single tweet (optionally a reply or quote). |
| `createThread` | Post a thread (array of tweets). |
| `deleteTweet` | Delete a tweet. |
| `getTweetAnalytics` | Pull engagement metrics for a tweet. |

The full function list (parameters, return types) is available via the
`plugins:info` command in the dashboard.

## Credentials

Every function declares `requiredCredentials: ["twitter-oauth"]`. An X OAuth
credential must be connected before any function is callable.

| Provider | Type | Connect method |
|---|---|---|
| `twitter-oauth` | oauth2 | BYO X (Twitter) OAuth 2.0 app. The granted scopes cover tweet read/write, users read, and offline access. |

Required scopes: `tweet.read`, `tweet.write`, `users.read`, `offline.access`.

## Using it in a workflow

```typescript
const me = await getUser();

const tweet = await createTweet({ text: "We just shipped agent goals 🎯" });

// A reply in the same thread
await createTweet({
  text: "Thread 🧵 1/3 — what's new…",
  replyToId: tweet.id,
});

// Or post a whole thread at once
await createThread({
  tweets: [
    "Three things we learned shipping agent iteration tracking:",
    "1. Agents need durable goals, not just prompts.",
    "2. Confidence scoring prevents noise from masking real wins.",
  ],
});
```

## Notes

- `createThread` posts sequentially and wires the reply chain for you.
- `createTweet` accepts `replyToId` (reply) and `quoteTweetId` (quote) to
  position the tweet in a conversation.
- No `guides/` reference yet; agent usage patterns can be added later.
