/**
 * Tests for lexical fallback module — lightweight lexical search when mgrep is unavailable.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import the module under test
// Using dynamic import with .ts extension for --experimental-strip-types
const mod = await import("../src/lexical-fallback.ts");

const {
	tokenizeQuery,
	isCJKQuery,
	buildRgArgs,
	rankResults,
	formatLexicalResults,
	LEXICAL_FALLBACK_MAX_CHARS,
	STOP_WORDS,
} = mod;

// ── STOP_WORDS ───────────────────────────────────────────

describe("STOP_WORDS", () => {
	test("is a Set of strings", () => {
		assert.ok(STOP_WORDS instanceof Set);
	});

	test("contains expected English stop words", () => {
		const expected = [
			"the", "a", "an", "in", "of", "on", "is", "for", "with",
			"how", "what", "why", "where", "when", "to", "and", "or",
			"not", "this", "that", "it", "from", "by", "at", "be",
			"are", "was", "were", "been", "has", "have", "had", "do",
			"does", "did", "will", "would", "can", "could", "should",
			"may", "might",
		];
		for (const word of expected) {
			assert.ok(STOP_WORDS.has(word), `Missing stop word: ${word}`);
		}
	});
});

// ── LEXICAL_FALLBACK_MAX_CHARS ───────────────────────────

describe("LEXICAL_FALLBACK_MAX_CHARS", () => {
	test("defaults to 6000", () => {
		assert.equal(LEXICAL_FALLBACK_MAX_CHARS, 6000);
	});

	test("is a number", () => {
		assert.equal(typeof LEXICAL_FALLBACK_MAX_CHARS, "number");
	});
});

// ── tokenizeQuery ────────────────────────────────────────

describe("tokenizeQuery", () => {
	test("splits by spaces, lowercases, filters stop words", () => {
		const result = tokenizeQuery("error handling logic in web fetch");
		assert.deepEqual(result, ["error", "handling", "logic", "web", "fetch"]);
	});

	test("collapses multiple spaces", () => {
		const result = tokenizeQuery("  multiple   spaces  ");
		assert.deepEqual(result, ["multiple", "spaces"]);
	});

	test("returns empty array when all tokens are stop words", () => {
		const result = tokenizeQuery("the a an is");
		assert.deepEqual(result, []);
	});

	test("returns single token for CJK (no spaces)", () => {
		const result = tokenizeQuery("错误处理逻辑");
		assert.deepEqual(result, ["错误处理逻辑"]);
	});

	test("handles empty string", () => {
		const result = tokenizeQuery("");
		assert.deepEqual(result, []);
	});

	test("handles single word", () => {
		const result = tokenizeQuery("typescript");
		assert.deepEqual(result, ["typescript"]);
	});

	test("lowercases tokens", () => {
		const result = tokenizeQuery("Error HANDLING Logic");
		assert.deepEqual(result, ["error", "handling", "logic"]);
	});
});

// ── isCJKQuery ───────────────────────────────────────────

describe("isCJKQuery", () => {
	test("returns true for Chinese", () => {
		assert.equal(isCJKQuery("错误处理逻辑"), true);
	});

	test("returns true for Japanese kanji", () => {
		assert.equal(isCJKQuery("検索機能"), true);
	});

	test("returns true for Korean", () => {
		assert.equal(isCJKQuery("검색 기능"), true);
	});

	test("returns false for English", () => {
		assert.equal(isCJKQuery("error handling"), false);
	});

	test("returns false for mixed with low CJK ratio", () => {
		// Mostly ASCII, tiny CJK
		assert.equal(isCJKQuery("test 字 test"), false);
	});

	test("returns true for mixed with high CJK ratio", () => {
		assert.equal(isCJKQuery("这是一个测试查询语句"), true);
	});
});

// ── buildRgArgs ──────────────────────────────────────────

describe("buildRgArgs", () => {
	test("phrase pass: builds regex with all tokens as literal phrase", () => {
		const args = buildRgArgs(["error", "handling"], "/src", "phrase");
		assert.ok(Array.isArray(args));
		// Should contain an argument that matches the phrase pattern
		const pattern = args.find((a) => typeof a === "string" && a.includes("error"));
		assert.ok(pattern, "phrase pass should include a pattern with 'error'");
		// Should include the path
		assert.ok(args.includes("/src"), "should include the search path");
		// Should include ripgrep flags
		const joined = args.join(" ");
		assert.ok(joined.includes("--no-heading") || joined.includes("-n") || joined.includes("--json"),
			"should include rg output flags");
	});

	test("and pass: builds regex with all tokens using alternation or multiple patterns", () => {
		const args = buildRgArgs(["error", "handling"], "/src", "and");
		assert.ok(Array.isArray(args));
		// AND pass should match all tokens — typically done with lookaheads or multiple -e flags
		const joined = args.join(" ");
		assert.ok(joined.includes("error"), "and pass should reference 'error'");
		assert.ok(joined.includes("handling"), "and pass should reference 'handling'");
	});

	test("or pass: builds regex matching any token", () => {
		const args = buildRgArgs(["error", "handling"], "/src", "or");
		assert.ok(Array.isArray(args));
		const joined = args.join(" ");
		assert.ok(joined.includes("error") || joined.includes("handling"),
			"or pass should reference tokens");
	});

	test("throws on invalid pass type", () => {
		assert.throws(() => buildRgArgs(["test"], "/src", "invalid"));
	});

	test("handles single token", () => {
		const args = buildRgArgs(["error"], "/src", "phrase");
		const pattern = args.find((a) => typeof a === "string" && a.includes("error"));
		assert.ok(pattern);
	});
});

// ── rankResults ──────────────────────────────────────────

describe("rankResults", () => {
	test("sorts lines by token hit count descending", () => {
		const rawOutput = [
			"src/a.ts:1:has error but not much else",
			"src/b.ts:1:error handling logic here",
			"src/c.ts:1:unrelated line",
		].join("\n");
		const tokens = ["error", "handling"];
		const result = rankResults(rawOutput, tokens);
		const lines = result.split("\n");

		// Line with both tokens should come first
		assert.ok(lines[0].includes("error handling logic"),
			"line with most token hits should rank first");
		// Unrelated line should come last
		assert.ok(lines[lines.length - 1].includes("unrelated"),
			"line with no token hits should rank last");
	});

	test("breaks ties by path alphabetically", () => {
		const rawOutput = [
			"src/z.ts:1:error here",
			"src/a.ts:1:error here",
		].join("\n");
		const tokens = ["error"];
		const result = rankResults(rawOutput, tokens);
		const lines = result.split("\n");

		// Same hit count, a.ts < z.ts alphabetically
		assert.ok(lines[0].includes("src/a.ts"),
			"ties should be broken by path alpha");
	});

	test("handles empty output", () => {
		const result = rankResults("", ["test"]);
		assert.equal(result, "");
	});

	test("handles empty tokens", () => {
		const rawOutput = "src/a.ts:1:hello world";
		const result = rankResults(rawOutput, []);
		// Should return lines as-is (all hits = 0, sorted by path)
		assert.ok(result.includes("hello world"));
	});
});

// ── formatLexicalResults ─────────────────────────────────

describe("formatLexicalResults", () => {
	test("includes [Local lexical fallback] prefix", () => {
		const result = formatLexicalResults("some output", "mgrep unavailable");
		assert.ok(result.startsWith("[Local lexical fallback]"),
			"should start with [Local lexical fallback]");
	});

	test("includes the reason", () => {
		const result = formatLexicalResults("some output", "mgrep unavailable");
		assert.ok(result.includes("mgrep unavailable"),
			"should include the fallback reason");
	});

	test("includes the ranked output", () => {
		const result = formatLexicalResults("file content here", "test reason");
		assert.ok(result.includes("file content here"),
			"should include the actual output");
	});

	test("truncates to maxChars when specified", () => {
		const longOutput = "x".repeat(10000);
		const result = formatLexicalResults(longOutput, "test", 100);
		assert.ok(result.length <= 120, // allow some overhead for header
			`result length ${result.length} should be close to 100`);
		assert.ok(result.includes("[truncated]"),
			"should include [truncated] marker");
	});

	test("uses default maxChars when not specified", () => {
		// Just verify it doesn't crash with default budget
		const shortOutput = "normal output";
		const result = formatLexicalResults(shortOutput, "test reason");
		assert.ok(result.includes("normal output"));
	});

	test("handles empty output", () => {
		const result = formatLexicalResults("", "no results");
		assert.ok(result.includes("[Local lexical fallback]"));
	});
});
