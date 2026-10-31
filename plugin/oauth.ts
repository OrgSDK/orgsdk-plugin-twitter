/** Native OrgSDK execution snapshots never expose OAuth client or refresh secrets. */
export async function getTwitterAccessToken(
	credentials: Record<string, unknown>,
): Promise<string> {
	const bundle = credentials["twitter-oauth"] as
		| { source?: unknown; secret_accessToken?: unknown }
		| undefined;
	if (
		bundle?.source !== "byo" ||
		typeof bundle.secret_accessToken !== "string" ||
		!bundle.secret_accessToken.trim()
	) {
		throw new Error(
			"Missing twitter-oauth access token. Reconnect Twitter in OrgSDK.",
		);
	}
	return bundle.secret_accessToken;
}
