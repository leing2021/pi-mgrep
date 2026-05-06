/**
 * pi-search — SearXNG web search provider
 *
 * Provides SearXNG as an optional web search backend.
 * Reads configuration from environment variables and builds/parses
 * SearXNG search requests.
 *
 * Environment variables:
 *   PI_SEARCH_WEB_PROVIDER   — auto|searxng|duckduckgo (default: auto)
 *   PI_SEARCH_SEARXNG_URL    — Base URL, e.g. http://localhost:8080
 *   PI_SEARCH_SEARXNG_FORMAT — json|html (default: json)
 *
 * Exports:
 *   - resolveWebProvider()           — Determine active web search provider
 *   - getSearXNGUrl()                — Get configured SearXNG base URL
 *   - isSearXNGConfigured()          — Check if SearXNG is configured
 *   - buildSearXNGSearchUrl(query, opts) — Build full search URL
 *   - parseSearXNGResponse(json)     — Parse SearXNG JSON response
 */

/**
 * Get the configured SearXNG base URL from environment.
 * @returns {string|null} — Base URL or null if not configured
 */
export function getSearXNGUrl(): string | null {
	return process.env.PI_SEARCH_SEARXNG_URL ?? null;
}

/**
 * Check if SearXNG is configured (URL is set).
 * @returns {boolean}
 */
export function isSearXNGConfigured(): boolean {
	const url = getSearXNGUrl();
	return typeof url === "string" && url.length > 0;
}

/**
 * Determine which web search provider to use.
 *
 * Logic:
 *   - duckduckgo → always duckduckgo
 *   - searxng + URL configured → searxng
 *   - searxng + no URL → duckduckgo (silent fallback)
 *   - auto + SearXNG URL configured → searxng
 *   - auto + no URL → duckduckgo
 *
 * @returns {'searxng' | 'duckduckgo'}
 */
export function resolveWebProvider(): "searxng" | "duckduckgo" {
	const provider = process.env.PI_SEARCH_WEB_PROVIDER ?? "auto";

	if (provider === "duckduckgo") {
		return "duckduckgo";
	}

	if (provider === "searxng") {
		// Explicit searxng but no URL → silent fallback to duckduckgo
		return isSearXNGConfigured() ? "searxng" : "duckduckgo";
	}

	// auto (or any unknown value): use searxng if configured, else duckduckgo
	return isSearXNGConfigured() ? "searxng" : "duckduckgo";
}

/**
 * Build a full SearXNG search URL.
 * @param {string} query — Search query string
 * @param {{ format: string, count: number }} opts — Search options
 * @returns {string} — Full search URL
 */
export function buildSearXNGSearchUrl(
	query: string,
	opts: { format: string; count: number }
): string {
	const baseUrl = getSearXNGUrl() ?? "http://localhost:8080";
	const format = opts.format || process.env.PI_SEARCH_SEARXNG_FORMAT || "json";
	const encoded = encodeURIComponent(query);
	return `${baseUrl}/search?q=${encoded}&format=${format}&pageno=1`;
}

/**
 * Parse a SearXNG JSON response into structured results.
 * SearXNG JSON format: { results: [{ title, url, content, engine }] }
 *
 * @param {any} json — Parsed JSON response from SearXNG
 * @returns {{ title: string, url: string, snippet: string }[]}
 */
export function parseSearXNGResponse(
	json: any
): { title: string; url: string; snippet: string }[] {
	if (!json || !Array.isArray(json.results)) {
		return [];
	}

	return json.results
		.filter((r: any) => r && typeof r.url === "string" && r.url.length > 0)
		.map((r: any) => ({
			title: typeof r.title === "string" ? r.title : "",
			url: r.url,
			snippet: typeof r.content === "string" ? r.content : "",
		}));
}
