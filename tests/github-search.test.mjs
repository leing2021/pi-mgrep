/**
 * Unit 5: RED — Tests for GitHub search via gh CLI.
 *
 * Tests define the contract for:
 *   - isGitHubQuery(query) → boolean
 *   - buildGhSearchArgs(query, type) → string[]
 *   - parseGhSearchOutput(jsonString) → evidence card array
 *   - formatGitHubResults(results, maxChars?) → string
 *   - GITHUB_SEARCH_MAX_CHARS → number
 *   - GITHUB_QUERY_PATTERNS → RegExp[]
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// These exports do not exist yet — all tests should FAIL (RED phase).
import {
	isGitHubQuery,
	buildGhSearchArgs,
	parseGhSearchOutput,
	formatGitHubResults,
	GITHUB_SEARCH_MAX_CHARS,
	GITHUB_QUERY_PATTERNS,
} from "../src/github-search.ts";

// ── GITHUB_QUERY_PATTERNS ─────────────────────────────────

describe("GITHUB_QUERY_PATTERNS", () => {
	test("is an array of RegExp", () => {
		assert.ok(Array.isArray(GITHUB_QUERY_PATTERNS), "should be an array");
		for (const p of GITHUB_QUERY_PATTERNS) {
			assert.ok(p instanceof RegExp, `each item should be a RegExp, got ${typeof p}`);
		}
	});

	test("has at least one pattern", () => {
		assert.ok(GITHUB_QUERY_PATTERNS.length >= 1, "should have at least one pattern");
	});
});

// ── isGitHubQuery ─────────────────────────────────────────

describe("isGitHubQuery: detect GitHub-related queries", () => {
	test("matches 'github' keyword", () => {
		assert.equal(isGitHubQuery("react server components github"), true);
	});

	test("matches 'repository' keyword", () => {
		assert.equal(isGitHubQuery("react repository stars"), true);
	});

	test("matches 'repo' keyword", () => {
		assert.equal(isGitHubQuery("find best react repo"), true);
	});

	test("matches 'issue' keyword", () => {
		assert.equal(isGitHubQuery("find open issues in rust-lang/rust"), true);
	});

	test("matches 'PR' keyword", () => {
		assert.equal(isGitHubQuery("show recent PR in vite"), true);
	});

	test("matches 'pull request' keyword", () => {
		assert.equal(isGitHubQuery("vite pull request status"), true);
	});

	test("matches 'site:github.com' pattern", () => {
		assert.equal(isGitHubQuery("site:github.com/torvalds/linux"), true);
	});

	test("matches 'gh:' prefix", () => {
		assert.equal(isGitHubQuery("gh: issue tracking"), true);
	});

	test("matches GitHub URL pattern", () => {
		assert.equal(isGitHubQuery("https://github.com/torvalds/linux/issues"), true);
	});

	test("does NOT match unrelated query", () => {
		assert.equal(isGitHubQuery("how to use react hooks"), false);
	});

	test("does NOT match weather query", () => {
		assert.equal(isGitHubQuery("weather today"), false);
	});

	test("is case insensitive for 'GitHub'", () => {
		assert.equal(isGitHubQuery("GITHUB release notes"), true);
	});

	test("is case insensitive for 'PR'", () => {
		assert.equal(isGitHubQuery("pr review needed"), true);
	});
});

// ── buildGhSearchArgs ─────────────────────────────────────

describe("buildGhSearchArgs: build gh search command args", () => {
	test("builds repos search args", () => {
		const args = buildGhSearchArgs("react", "repos");
		assert.deepEqual(args, [
			"search", "repos", "react",
			"--json", "title,url,state,updatedAt,description",
			"--limit", "5",
		]);
	});

	test("builds code search args", () => {
		const args = buildGhSearchArgs("useEffect", "code");
		assert.deepEqual(args, [
			"search", "code", "useEffect",
			"--json", "title,url,state,updatedAt,description",
			"--limit", "5",
		]);
	});

	test("builds issues search args", () => {
		const args = buildGhSearchArgs("memory leak", "issues");
		assert.deepEqual(args, [
			"search", "issues", "memory leak",
			"--json", "title,url,state,updatedAt,description",
			"--limit", "5",
		]);
	});
});

// ── parseGhSearchOutput ───────────────────────────────────

describe("parseGhSearchOutput: parse gh JSON output into evidence cards", () => {
	test("parses valid JSON with results", () => {
		const input = JSON.stringify([
			{
				title: "React",
				url: "https://github.com/facebook/react",
				state: "OPEN",
				updatedAt: "2026-01-01T00:00:00Z",
				description: "A JavaScript library for building UIs",
			},
		]);
		const results = parseGhSearchOutput(input);
		assert.equal(results.length, 1);
		assert.equal(results[0].title, "React");
		assert.equal(results[0].url, "https://github.com/facebook/react");
		assert.equal(results[0].state, "OPEN");
		assert.equal(results[0].updatedAt, "2026-01-01T00:00:00Z");
		assert.equal(results[0].snippet, "A JavaScript library for building UIs");
	});

	test("returns empty array for empty JSON array", () => {
		const results = parseGhSearchOutput("[]");
		assert.deepEqual(results, []);
	});

	test("returns empty array for invalid JSON", () => {
		const results = parseGhSearchOutput("not json at all");
		assert.deepEqual(results, []);
	});

	test("provides graceful defaults for missing fields", () => {
		const input = JSON.stringify([
			{ title: "Partial" },
		]);
		const results = parseGhSearchOutput(input);
		assert.equal(results.length, 1);
		assert.equal(results[0].title, "Partial");
		assert.equal(results[0].url, "");
		assert.equal(results[0].snippet, "");
		// state and updatedAt are optional
		assert.equal(results[0].state, undefined);
		assert.equal(results[0].updatedAt, undefined);
	});

	test("parses multiple results", () => {
		const input = JSON.stringify([
			{ title: "A", url: "https://a.com", description: "Desc A" },
			{ title: "B", url: "https://b.com", description: "Desc B" },
		]);
		const results = parseGhSearchOutput(input);
		assert.equal(results.length, 2);
		assert.equal(results[0].title, "A");
		assert.equal(results[1].title, "B");
	});
});

// ── formatGitHubResults ───────────────────────────────────

describe("formatGitHubResults: format as evidence-card output", () => {
	test("produces evidence-card-style output", () => {
		const results = [
			{
				title: "React",
				url: "https://github.com/facebook/react",
				state: "OPEN",
				updatedAt: "2026-01-01T00:00:00Z",
				snippet: "A JavaScript library",
			},
		];
		const output = formatGitHubResults(results);
		assert.ok(output.includes("React"), "should include title");
		assert.ok(output.includes("https://github.com/facebook/react"), "should include url");
		assert.ok(output.includes("A JavaScript library"), "should include snippet");
	});

	test("truncates to maxChars", () => {
		const results = Array.from({ length: 50 }, (_, i) => ({
			title: `Repo ${i}`,
			url: `https://github.com/org/repo-${i}`,
			snippet: "A".repeat(200),
		}));
		const output = formatGitHubResults(results, 500);
		assert.ok(output.length <= 500, `output should be truncated to maxChars, got ${output.length}`);
	});

	test("handles empty results", () => {
		const output = formatGitHubResults([]);
		assert.equal(output, "");
	});
});

// ── GITHUB_SEARCH_MAX_CHARS ───────────────────────────────

describe("GITHUB_SEARCH_MAX_CHARS", () => {
	test("default is 4000", () => {
		assert.equal(GITHUB_SEARCH_MAX_CHARS, 4000);
	});
});
