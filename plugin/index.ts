import type {
	PluginContext,
	PluginFactory,
	PluginModule,
} from "@orgsdk/plugins";
import { TwitterAuthProvider } from "./auth-provider";
import { safeFunctions } from "./twitter-functions";

// Twitter/X OAuth 2.0 scopes
const DEFAULT_SCOPES = [
	"tweet.read",
	"tweet.write",
	"users.read",
	"offline.access",
];

const createPlugin: PluginFactory = (ctx: PluginContext): PluginModule => {
	const authProvider = new TwitterAuthProvider(ctx, DEFAULT_SCOPES);
	return {
		safeFunctions,
		httpEndpoints: authProvider.getHttpEndpoints(),
		authProvider,
		async onLoad() {
			const cred = await ctx.stores.credential.get("twitter-oauth", "default");
			if (!cred) {
				ctx.logger.warn(
					"[twitter] No twitter-oauth credential found. Connect it in the dashboard (Credentials tab).",
				);
			}
		},
	};
};

export default createPlugin;
