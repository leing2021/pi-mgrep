/**
 * pi-search — Lexical fallback module.
 *
 * Provides lightweight lexical search utilities when mgrep is unavailable.
 * This module does NOT call ripgrep directly — it builds args, ranks output,
 * and formats results. The actual `runCommand` call happens in the caller.
 *
 * Exports:
 *   - STOP_WORDS: Set<string>
 *   - LEXICAL_FALLBACK_MAX_CHARS: number
 *   - tokenizeQuery(query) → string[]
 *   - isCJKQuery(query) → boolean
 *   - buildRgArgs(tokens, path, pass) → string[]
 *   - rankResults(rawOutput, tokens) → string
 *   - formatLexicalResults(rankedOutput, reason, maxChars?) → string
 */

// ── Constants ────────────────────────────────────────────

/** English stop words to filter from search queries */
export const STOP_WORDS: Set<string> = new Set([
	"the", "a", "an", "in", "of", "on", "is", "for", "with",
	"how", "what", "why", "where", "when", "to", "and", "or",
	"not", "this", "that", "it", "from", "by", "at", "be",
	"are", "was", "were", "been", "has", "have", "had", "do",
	"does", "did", "will", "would", "can", "could", "should",
	"may", "might",
]);

/** Default max characters for lexical fallback output */
export const LEXICAL_FALLBACK_MAX_CHARS: number = 6000;

// ── tokenizeQuery ────────────────────────────────────────

/**
 * Split a query into tokens: lowercase, filter stop words.
 * For CJK queries (no spaces), returns the query as a single token
 * for substring matching.
 */
export function tokenizeQuery(query: string): string[] {
	const trimmed = query.trim();
	if (!trimmed) return [];

	// If the query is primarily CJK, return as single token
	if (isCJKQuery(trimmed)) {
		return [trimmed];
	}

	// Split on whitespace, lowercase, filter stop words and empty strings
	const tokens = trimmed
		.split(/\s+/)
		.map((t) => t.toLowerCase())
		.filter((t) => t.length > 0 && !STOP_WORDS.has(t));

	return tokens;
}

// ── isCJKQuery ───────────────────────────────────────────

/**
 * Detect if a query is primarily CJK characters (Chinese, Japanese, Korean).
 * Uses Unicode script property escapes to detect Han, Hiragana, Katakana, and Hangul.
 * Returns true if > 50% of non-whitespace characters are CJK.
 */
export function isCJKQuery(query: string): boolean {
	const chars = query.replace(/\s/g, "");
	if (chars.length === 0) return false;

	const cjkRegex = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
	const cjkCount = (chars.match(cjkRegex) || []).length;

	return cjkCount / chars.length > 0.5;
}

// ── buildRgArgs ──────────────────────────────────────────

/**
 * Build ripgrep arguments for a given search pass.
 *
 * - phrase: exact phrase match (tokens joined with space, literal)
 * - and:    all tokens must appear (uses lookaheads)
 * - or:     any token can appear (alternation)
 */
export function buildRgArgs(
	tokens: string[],
	path: string,
	pass: "phrase" | "and" | "or",
): string[] {
	if (!["phrase", "and", "or"].includes(pass)) {
		throw new Error(`Invalid pass type: ${pass}. Must be 'phrase', 'and', or 'or'.`);
	}

	if (tokens.length === 0) {
		// No tokens → match nothing
		return ["--no-heading", "-n", "--regex", "--regexp", "(?!.*)", path];
	}

	// Escape regex special characters in tokens
	const escapeRegex = (s: string) =>
		s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

	const escaped = tokens.map(escapeRegex);

	switch (pass) {
		case "phrase": {
			// Match tokens as a contiguous phrase
			const pattern = escaped.join("\\s+");
			return ["--no-heading", "-n", "--regexp", pattern, path];
		}
		case "and": {
			// All tokens must appear on the same line — use lookaheads
			const pattern = escaped.map((t) => `(?=.*${t})`).join("");
			return ["--no-heading", "-n", "--regexp", pattern, path];
		}
		case "or": {
			// Any token — alternation
			const pattern = escaped.join("|");
			return ["--no-heading", "-n", "--regexp", pattern, path];
		}
	}
}

// ── rankResults ──────────────────────────────────────────

/**
 * Rank ripgrep output lines by token hit count (descending),
 * then by path alphabetically for ties.
 */
export function rankResults(rawOutput: string, tokens: string[]): string {
	if (!rawOutput) return "";

	const lines = rawOutput.split("\n").filter((l) => l.length > 0);
	if (lines.length === 0) return "";
	if (tokens.length === 0) {
		// No tokens → sort by path alpha as-is
		return lines.sort().join("\n");
	}

	// Score each line by counting how many tokens it contains
	const scored = lines.map((line) => {
		const lower = line.toLowerCase();
		let hits = 0;
		for (const token of tokens) {
			if (lower.includes(token.toLowerCase())) {
				hits++;
			}
		}
		return { line, hits };
	});

	// Sort by hit count desc, then by line alpha for ties
	scored.sort((a, b) => {
		if (b.hits !== a.hits) return b.hits - a.hits;
		return a.line.localeCompare(b.line);
	});

	return scored.map((s) => s.line).join("\n");
}

// ── formatLexicalResults ─────────────────────────────────

/**
 * Format ranked lexical results with a header indicating fallback mode.
 * Applies character budget truncation with [truncated] marker.
 */
export function formatLexicalResults(
	rankedOutput: string,
	reason: string,
	maxChars?: number,
): string {
	const budget = maxChars ?? LEXICAL_FALLBACK_MAX_CHARS;

	const header = `[Local lexical fallback] (${reason})`;

	if (!rankedOutput) {
		return header;
	}

	let body = rankedOutput;
	let output = `${header}\n${body}`;

	if (output.length > budget) {
		// Truncate body to fit within budget, leaving room for marker
		const marker = "\n[truncated]";
		const availableForBody = budget - header.length - 1 - marker.length;
		if (availableForBody > 0) {
			body = body.slice(0, availableForBody);
			output = `${header}\n${body}${marker}`;
		} else {
			// Even body can't fit — just return header + marker
			output = `${header}\n[truncated]`;
		}
	}

	return output;
}
