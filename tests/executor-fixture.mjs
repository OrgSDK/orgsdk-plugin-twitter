import assert from "node:assert/strict";

export default async function createFixture() {
	return {
		configuration: {},
		provider: "twitter-oauth",
		secret: {
			source: "byo",
			secret_accessToken: "synthetic-access",
		},
		async fetch(request) {
			const url = new URL(request.url);
			assert.equal(url.origin, "https://api.twitter.com");
			assert.equal(
				request.headers.get("authorization"),
				"Bearer synthetic-access",
			);
			if (url.pathname === "/2/users/me")
				return Response.json({
					data: { id: "user", name: "Synthetic user", username: "example" },
				});
			if (url.pathname === "/2/tweets") {
				assert.equal(request.method, "POST");
				return Response.json({ data: { id: "81" } });
			}
			if (url.pathname === "/2/tweets/81")
				return Response.json({
					data:
						request.method === "DELETE"
							? { deleted: true }
							: {
									public_metrics: {
										impression_count: 100,
										like_count: 5,
										reply_count: 1,
										retweet_count: 2,
										quote_count: 0,
										bookmark_count: 1,
									},
								},
				});
			assert.fail(url.pathname);
		},
		async run(call) {
			assert.equal((await call("getUser")).id, "user");
			assert.equal(
				(await call("createTweet", { text: "Synthetic only" })).id,
				"81",
			);
			assert.equal(
				(await call("createThread", { tweets: ["One", "Two"] })).length,
				2,
			);
			assert.equal(
				(await call("getTweetAnalytics", { tweetId: "81" })).impressions,
				100,
			);
			assert.equal(
				(await call("deleteTweet", { tweetId: "81" })).success,
				true,
			);
		},
	};
}
