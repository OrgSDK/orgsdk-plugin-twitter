import type { SafeFunction } from "@orgsdk/plugins";
import { getTwitterAccessToken } from "./oauth";

export const moduleDescription =
	"Post tweets, threads, and read analytics for Twitter/X";

// ─── Types ──────────────────────────────────────────────────────────────

interface TwitterUser {
	id: string;
	name: string;
	username: string;
	profileImageUrl?: string;
}

interface TwitterTweet {
	id: string;
	text: string;
	createdAt: string;
	authorId: string;
	publicMetrics: {
		impressions: number;
		likes: number;
		replies: number;
		retweets: number;
		quotes: number;
		bookmarks: number;
	};
	url: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────

async function twFetch(
	accessToken: string,
	path: string,
	options?: { method?: string; body?: unknown },
) {
	const url = path.startsWith("http")
		? path
		: `https://api.twitter.com/2${path}`;

	const headers: Record<string, string> = {
		Authorization: `Bearer ${accessToken}`,
		"Content-Type": "application/json",
	};

	const resp = await fetch(url, {
		method: options?.method ?? "GET",
		headers,
		body: options?.body ? JSON.stringify(options.body) : undefined,
	});

	if (!resp.ok) {
		const errText = await resp.text();
		throw new Error(`Twitter API error ${resp.status}: ${errText}`);
	}

	if (resp.status === 204) return null;
	return resp.json();
}

// ─── Safe Functions ─────────────────────────────────────────────────────

export const safeFunctions: SafeFunction[] = [
	// ─── Get User ─────────────────────────────────────────────────────
	{
		name: "getUser",
		requiredCredentials: ["twitter-oauth"],
		handler: async (
			credentials: Record<string, unknown>,
		): Promise<TwitterUser> => {
			const accessToken = await getTwitterAccessToken(credentials);
			const data = await twFetch(
				accessToken,
				"/users/me?user.fields=name,username,profile_image_url",
			);

			return {
				id: data.data.id,
				name: data.data.name,
				username: data.data.username,
				profileImageUrl: data.data.profile_image_url ?? undefined,
			};
		},
		description:
			"Get the authenticated user's Twitter/X profile including ID, name, and username.",
		returnType:
			"Promise<{ id: string; name: string; username: string; profileImageUrl?: string }>",
		parameters: [],
		metadata: {
			category: "twitter",
			tags: ["readonly", "auth", "discovery"],
			readonly: true,
			discovery: true,
			version: "1.0.0",
		},
		docs: {
			summary:
				"Retrieve the authenticated Twitter/X user's profile. Returns ID, name, username, and profile image URL.",
			parameters: [],
			returns: {
				type: "Promise<TwitterUser>",
				description: "The authenticated user's Twitter profile.",
			},
			examples: [
				{
					title: "Get current user",
					code: "const user = await twitter.getUser();\nconsole.log(`Posting as @${user.username}`);",
				},
			],
		},
	},

	// ─── Create Tweet ─────────────────────────────────────────────────
	{
		name: "createTweet",
		requiredCredentials: ["twitter-oauth"],
		handler: async (
			credentials: Record<string, unknown>,
			{
				text,
				replyToId,
				quoteTweetId,
			}: {
				text: string;
				replyToId?: string;
				quoteTweetId?: string;
			},
		): Promise<{ id: string; url: string }> => {
			const accessToken = await getTwitterAccessToken(credentials);

			const body: Record<string, unknown> = {
				text,
			};

			if (replyToId) {
				body.reply = { in_reply_to_tweet_id: replyToId };
			}

			if (quoteTweetId) {
				body.quote_tweet_id = quoteTweetId;
			}

			const result = await twFetch(accessToken, "/tweets", {
				method: "POST",
				body,
			});

			const tweetId = result?.data?.id ?? "unknown";
			const username = result?.data?.username ?? "i";

			return {
				id: tweetId,
				url: `https://x.com/${username}/status/${tweetId}`,
			};
		},
		description:
			"Post a tweet. Supports replies and quote tweets. For threads, chain multiple tweets using replyToId.",
		returnType: "Promise<{ id: string; url: string }>",
		parameters: [
			{ name: "text", type: "string" },
			{ name: "replyToId", type: "string", optional: true },
			{ name: "quoteTweetId", type: "string", optional: true },
		],
		metadata: {
			category: "twitter",
			tags: ["write", "social"],
			readonly: false,
			version: "1.0.0",
		},
		docs: {
			summary:
				"Post a tweet on Twitter/X. Supports replies and quote tweets. To create a thread, use the returned ID as replyToId for the next tweet.",
			parameters: [
				{
					name: "text",
					type: "string",
					description:
						"The tweet text. Max 280 characters for standard accounts, 4000 for premium.",
					example: '"Check out our new blog post on AI research!"',
				},
				{
					name: "replyToId",
					type: "string",
					description:
						"Tweet ID to reply to. Use this to create threads by chaining tweets.",
					optional: true,
				},
				{
					name: "quoteTweetId",
					type: "string",
					description: "Tweet ID to quote tweet.",
					optional: true,
				},
			],
			returns: {
				type: "Promise<{ id: string; url: string }>",
				description: "The created tweet ID and URL.",
			},
			examples: [
				{
					title: "Post a simple tweet",
					code: 'const tweet = await twitter.createTweet({ text: "Hello from Quokly!" });',
				},
				{
					title: "Create a thread",
					code: `const t1 = await twitter.createTweet({ text: "🧵 Thread: Why source transparency matters in AI research" });
const t2 = await twitter.createTweet({ text: "1/ Most AI tools give you answers without showing their work. That's a problem.", replyToId: t1.id });
const t3 = await twitter.createTweet({ text: "2/ Quokly shows you every source, classifies trust, and gives confidence scores.", replyToId: t2.id });`,
				},
			],
		},
	},

	// ─── Create Thread ────────────────────────────────────────────────
	{
		name: "createThread",
		requiredCredentials: ["twitter-oauth"],
		handler: async (
			credentials: Record<string, unknown>,
			{
				tweets,
			}: {
				tweets: string[];
			},
		): Promise<Array<{ id: string; url: string }>> => {
			const accessToken = await getTwitterAccessToken(credentials);
			const results: Array<{ id: string; url: string }> = [];

			let previousId: string | undefined;

			for (const text of tweets) {
				const body: Record<string, unknown> = { text };
				if (previousId) {
					body.reply = { in_reply_to_tweet_id: previousId };
				}

				const result = await twFetch(accessToken, "/tweets", {
					method: "POST",
					body,
				});

				const tweetId = result?.data?.id ?? "unknown";
				previousId = tweetId;

				results.push({
					id: tweetId,
					url: `https://x.com/i/status/${tweetId}`,
				});
			}

			return results;
		},
		description:
			"Post a Twitter/X thread (chain of tweets). Each tweet is posted as a reply to the previous one.",
		returnType: "Promise<Array<{ id: string; url: string }>>",
		parameters: [{ name: "tweets", type: "string[]" }],
		metadata: {
			category: "twitter",
			tags: ["write", "social"],
			readonly: false,
			version: "1.0.0",
		},
		docs: {
			summary:
				"Post a complete Twitter/X thread in one call. Pass an array of tweet texts; they are automatically chained as replies.",
			parameters: [
				{
					name: "tweets",
					type: "string[]",
					description: "Array of tweet texts to post as a thread.",
					example:
						'["Thread intro 🧵", "Point 1...", "Point 2...", "Conclusion + link"]',
				},
			],
			returns: {
				type: "Promise<Array<{ id: string; url: string }>>",
				description: "Array of created tweet IDs and URLs.",
			},
			examples: [
				{
					title: "Post a research insight thread",
					code: `const thread = await twitter.createThread({
  tweets: [
    "🧵 3 things I learned building an AI research tool for Australian startups",
    "1/ Most founders don't verify AI sources. They trust the output blindly.",
    "2/ Confidence scoring changes how you use AI. When the model says '45% confident', you double-check.",
    "3/ Source classification (peer-reviewed vs blog vs social) is table stakes.",
    "We built Quokly to solve all three → https://quokly.com.au"
  ]
});`,
				},
			],
		},
	},

	// ─── Get Tweet Analytics ──────────────────────────────────────────
	{
		name: "getTweetAnalytics",
		requiredCredentials: ["twitter-oauth"],
		handler: async (
			credentials: Record<string, unknown>,
			{ tweetId }: { tweetId: string },
		): Promise<{
			impressions: number;
			likes: number;
			replies: number;
			retweets: number;
			quotes: number;
			bookmarks: number;
			engagementRate: number;
		}> => {
			const accessToken = await getTwitterAccessToken(credentials);
			const data = await twFetch(
				accessToken,
				`/tweets/${tweetId}?tweet.fields=public_metrics`,
			);

			const metrics = data?.data?.public_metrics ?? {};
			const totalEngagements =
				(metrics.like_count ?? 0) +
				(metrics.reply_count ?? 0) +
				(metrics.retweet_count ?? 0) +
				(metrics.quote_count ?? 0) +
				(metrics.bookmark_count ?? 0);
			const impressions = metrics.impression_count ?? 0;
			const engagementRate =
				impressions > 0
					? Math.round((totalEngagements / impressions) * 10000) / 100
					: 0;

			return {
				impressions,
				likes: metrics.like_count ?? 0,
				replies: metrics.reply_count ?? 0,
				retweets: metrics.retweet_count ?? 0,
				quotes: metrics.quote_count ?? 0,
				bookmarks: metrics.bookmark_count ?? 0,
				engagementRate,
			};
		},
		description:
			"Get analytics for a single tweet including impressions, likes, replies, retweets, quotes, bookmarks, and engagement rate.",
		returnType:
			"Promise<{ impressions: number; likes: number; replies: number; retweets: number; quotes: number; bookmarks: number; engagementRate: number }>",
		parameters: [{ name: "tweetId", type: "string" }],
		metadata: {
			category: "twitter",
			tags: ["readonly", "analytics"],
			readonly: true,
			version: "1.0.0",
		},
		docs: {
			summary:
				"Retrieve engagement analytics for a single tweet by ID. Returns impressions, likes, replies, retweets, quotes, bookmarks, and calculated engagement rate.",
			parameters: [
				{
					name: "tweetId",
					type: "string",
					description: "The ID of the tweet to analyze.",
				},
			],
			returns: {
				type: "Promise<TwitterTweetAnalytics>",
				description: "Engagement metrics for the tweet.",
			},
		},
	},

	// ─── Delete Tweet ─────────────────────────────────────────────────
	{
		name: "deleteTweet",
		requiredCredentials: ["twitter-oauth"],
		handler: async (
			credentials: Record<string, unknown>,
			{ tweetId }: { tweetId: string },
		): Promise<{ success: boolean }> => {
			const accessToken = await getTwitterAccessToken(credentials);
			await twFetch(accessToken, `/tweets/${tweetId}`, {
				method: "DELETE",
			});
			return { success: true };
		},
		description: "Delete a tweet by ID. This action is irreversible.",
		returnType: "Promise<{ success: boolean }>",
		parameters: [{ name: "tweetId", type: "string" }],
		metadata: {
			category: "twitter",
			tags: ["write", "destructive"],
			readonly: false,
			version: "1.0.0",
		},
		docs: {
			summary: "Delete a tweet. This action is irreversible.",
			parameters: [
				{
					name: "tweetId",
					type: "string",
					description: "The ID of the tweet to delete.",
				},
			],
			returns: {
				type: "Promise<{ success: boolean }>",
				description: "Confirmation of deletion.",
			},
		},
	},
];
