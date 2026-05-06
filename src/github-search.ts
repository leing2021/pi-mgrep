/**
 * pi-search — GitHub search via gh CLI (opt-in).
 *
 * Provides detection, arg building, output parsing, and formatting
 * for GitHub search using the `gh` CLI tool.
 *
 * Default: opt-in (PI_SEARCH_NETWORK_CLI_ENHANCEMENTS).
 * Uses evidence-card format for output.
 */

/** Maximum character budget for formatted GitHub results */
export const GITHUB_SEARCH_MAX_CHARS = 4000;

/** Patterns that indicate a GitHub-related query */
export const GITHUB_QUERY_PATTERNS: RegExp[] = [
	/\bgithub\b/i,
	/\brepo(?:sitory)?\b/i,
	/\bissues?\b/i,
	/\bPR\b/i,
	/\bpull\s+request\b/i,
	/\bsite:github\.com/i,
	/\bgh:/i,
	/github\.com\//i,
];

/**
 * Detect if a query is GitHub-related.
 * Matches: 'github', 'repo', 'repository', 'issue', 'PR',
 * 'pull request', 'site:github.com', 'gh:', or GitHub URL patterns.
 */
export function isGitHubQuery(query: string): boolean {
	return GITHUB_QUERY_PATTERNS.some((pattern) => pattern.test(query));
}

/**
 * Build gh search command args.
 * Returns the argument array for `gh search <type> <query> --json ... --limit 5`.
 */
export function buildGhSearchArgs(
	query: string,
	type: "repos" | "code" | "issues",
): string[] {
	return [
		"search",
		type,
		query,
		"--json",
		"title,url,state,updatedAt,description",
		"--limit",
		"5",
	];
}

/** Parsed GitHub search result as evidence card */
export interface GhSearchResult {
	title: string;
	url: string;
	state?: string;
	updatedAt?: string;
	snippet: string;
}

/**
 * Parse gh JSON output into evidence cards.
 * Returns empty array for invalid JSON or empty results.
 * Gracefully defaults missing fields.
 */
export function parseGhSearchOutput(jsonString: string): GhSearchResult[] {
	let parsed: unknown[];
	try {
		const raw = JSON.parse(jsonString);
		if (!Array.isArray(raw)) return [];
		parsed = raw;
	} catch {
		return [];
	}

	return parsed.map((item: unknown) => {
		const obj = item as Record<string, unknown>;
		return {
			title: typeof obj.title === "string" ? obj.title : "",
			url: typeof obj.url === "string" ? obj.url : "",
			state: typeof obj.state === "string" ? obj.state : undefined,
			updatedAt: typeof obj.updatedAt === "string" ? obj.updatedAt : undefined,
			snippet: typeof obj.description === "string" ? obj.description : "",
		};
	});
}

/**
 * Format GitHub search results as evidence-card output.
 * Truncates to maxChars budget, keeping complete cards.
 */
export function formatGitHubResults(
	results: GhSearchResult[],
	maxChars: number = GITHUB_SEARCH_MAX_CHARS,
): string {
	if (results.length === 0) return "";

	const lines: string[] = [];
	let totalLen = 0;

	for (const r of results) {
		let card = `### ${r.title}\n`;
		card += `- url: ${r.url}\n`;
		if (r.state) card += `- state: ${r.state}\n`;
		if (r.updatedAt) card += `- updated: ${r.updatedAt}\n`;
		card += `> ${r.snippet}\n`;

		if (totalLen + card.length > maxChars) break;
		lines.push(card);
		totalLen += card.length;
	}

	return lines.join("\n");
}
