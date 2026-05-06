/**
 * pi-search — DDG HTML parsing module
 *
 * Provides structured parsing of DuckDuckGo SERP HTML into result objects.
 * Uses regex-based extraction that handles DDG's HTML structure variations.
 *
 * Exports:
 *   - parseDDGResultsHtml(html)      — Parse full DDG HTML page
 *   - extractDDGResultBlocks(html)   — Split into individual result blocks
 *   - parseResultBlock(block)        — Parse a single result block
 *   - buildHtmlqArgs(selector)       — Build htmlq CLI arguments
 *   - isHtmlqAvailable()             — Check htmlq CLI availability
 */

import { isToolEnabled } from "./cli-capabilities.ts";

/**
 * Check if htmlq is available as a CLI tool.
 * Delegates to cli-capabilities module.
 * @returns {boolean}
 */
export function isHtmlqAvailable(): boolean {
	return isToolEnabled("htmlq");
}

/**
 * Build htmlq command-line arguments for a CSS selector.
 * @param {string} selector — CSS selector string
 * @returns {string[]} — Array of args to pass to htmlq
 */
export function buildHtmlqArgs(selector: string): string[] {
	return [selector, "--text"];
}

/**
 * Decode common HTML entities in a string.
 * @param {string} str
 * @returns {string}
 */
function decodeHTMLEntities(str: string): string {
	return str
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#x27;/g, "'")
		.replace(/&nbsp;/g, " ");
}

/**
 * Strip HTML tags and decode entities.
 * @param {string} str
 * @returns {string}
 */
function cleanText(str: string): string {
	return decodeHTMLEntities(str.replace(/<[^>]+>/g, "")).trim();
}

/**
 * Extract the actual URL from a DDG redirect link.
 * DDG uses URLs like //duckduckgo.com/l/?uddg=<encoded-url>&rut=...
 * @param {string} href — The raw href attribute
 * @returns {string|null} — Decoded actual URL or null
 */
function extractUrlFromDDGHref(href: string): string | null {
	if (!href) return null;

	// Try to extract from DDG redirect URL
	const uddgMatch = href.match(/uddg=([^&]+)/);
	if (uddgMatch) {
		try {
			return decodeURIComponent(uddgMatch[1]);
		} catch {
			return uddgMatch[1];
		}
	}

	// Direct URL (starts with http)
	if (/^https?:\/\//.test(href)) {
		return href;
	}

	return null;
}

/**
 * Split DDG SERP HTML into individual result block strings.
 * Looks for common DDG result container patterns.
 * @param {string} html — Full DDG HTML page
 * @returns {string[]} — Array of HTML blocks, one per result
 */
export function extractDDGResultBlocks(html: string): string[] {
	if (!html || typeof html !== "string") return [];

	const blocks: string[] = [];

	// Pattern 1: result__body divs (classic DDG)
	// Match from <div class="result__body"> to the closing </div> at the same nesting level
	const resultBodyRegex = /<div[^>]*class="[^"]*result__body[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
	let match: RegExpExecArray | null;
	while ((match = resultBodyRegex.exec(html)) !== null) {
		blocks.push(match[0]);
	}

	// Pattern 2: result__body without double closing div (simpler structure)
	if (blocks.length === 0) {
		const simpleRegex = /<div[^>]*class="[^"]*result__body[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
		while ((match = simpleRegex.exec(html)) !== null) {
			blocks.push(match[0]);
		}
	}

	// Pattern 3: result with data-nir attributes (newer DDG)
	if (blocks.length === 0) {
		const nirRegex = /<article[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
		while ((match = nirRegex.exec(html)) !== null) {
			blocks.push(match[0]);
		}
	}

	// Pattern 4: generic result links with uddg parameter
	if (blocks.length === 0) {
		// Extract blocks around each uddg link
		const uddgRegex = /(<a[^>]*class="[^"]*result__a[^"]*"[^>]*>[\s\S]*?<\/a>)/gi;
		while ((match = uddgRegex.exec(html)) !== null) {
			// Expand block to include surrounding context (snippet, url)
			const start = Math.max(0, match.index - 500);
			const end = Math.min(html.length, match.index + match[0].length + 500);
			blocks.push(html.slice(start, end));
		}
	}

	return blocks;
}

/**
 * Parse a single DDG result block HTML into a structured result.
 * @param {string} block — HTML string of a single result
 * @returns {{ title: string, url: string, snippet: string } | null}
 */
export function parseResultBlock(block: string): { title: string; url: string; snippet: string } | null {
	if (!block || typeof block !== "string") return null;

	// Extract title
	const titleMatch = block.match(/class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
		|| block.match(/class="[^"]*result__title[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)
		|| block.match(/<h[23][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
	if (!titleMatch) return null;

	const title = cleanText(titleMatch[1]);

	if (!title) return null;

	// Extract URL from the title link's href
	const hrefMatch = block.match(/class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"/i)
		|| block.match(/href="(\/\/duckduckgo\.com\/l\/\?[^"]+)"/i)
		|| block.match(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>/i);
	if (!hrefMatch) return null;

	const url = extractUrlFromDDGHref(hrefMatch[1]);
	if (!url) return null;

	// Extract snippet
	const snippetMatch = block.match(/class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
		|| block.match(/class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/span>/i)
		|| block.match(/class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

	const snippet = snippetMatch ? cleanText(snippetMatch[1]) : "";

	return { title, url, snippet };
}

/**
 * Parse DDG SERP HTML into structured results.
 * Main entry point for DDG HTML parsing.
 * @param {string} rawHtml — Full DDG search results HTML
 * @returns {{ title: string, url: string, snippet: string }[]}
 */
export function parseDDGResultsHtml(rawHtml: string): { title: string; url: string; snippet: string }[] {
	if (!rawHtml || typeof rawHtml !== "string") return [];

	const blocks = extractDDGResultBlocks(rawHtml);
	const results: { title: string; url: string; snippet: string }[] = [];

	for (const block of blocks) {
		const parsed = parseResultBlock(block);
		if (parsed) {
			results.push(parsed);
		}
	}

	return results;
}
