/**
 * Tests for DDG HTML parsing module (htmlq-parser)
 *
 * Tests cover:
 *   - parseDDGResultsHtml extracts results from valid DDG HTML
 *   - extractDDGResultBlocks splits HTML into individual blocks
 *   - parseResultBlock extracts title/url/snippet from a single block
 *   - Empty HTML returns empty array
 *   - Malformed HTML returns empty/null gracefully
 *   - buildHtmlqArgs builds correct command arguments
 *   - isHtmlqAvailable delegates to cli-capabilities
 */

import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// ── Helpers ──────────────────────────────────────────────

function withEnv(vars, fn) {
	const saved = {};
	for (const [k, v] of Object.entries(vars)) {
		saved[k] = process.env[k];
		if (v === undefined) delete process.env[k];
		else process.env[k] = v;
	}
	try {
		return fn();
	} finally {
		for (const [k, v] of Object.entries(saved)) {
			if (v === undefined) delete process.env[k];
			else process.env[k] = v;
		}
	}
}

async function loadModule() {
	return await import("../src/htmlq-parser.ts");
}

// ── Sample DDG HTML fixtures ────────────────────────────

const SAMPLE_RESULT_BLOCK = `<div class="result__body">
	<h2 class="result__title">
		<a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage&amp;rut=abc123">Example Page Title</a>
	</h2>
	<a class="result__url" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage">example.com</a>
	<a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage">This is the snippet text for the result.</a>
</div>`;

const SAMPLE_DDHTML = `<div class="links_main">
	${SAMPLE_RESULT_BLOCK}
	<div class="result__body">
		<h2 class="result__title">
			<a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Ffoo.com%2Fbar&amp;rut=def456">Foo Bar Result</a>
		</h2>
		<a class="result__url" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Ffoo.com%2Fbar">foo.com</a>
		<a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Ffoo.com%2Fbar">Second snippet here.</a>
	</div>
</div>`;

// ── Tests ────────────────────────────────────────────────

describe("parseDDGResultsHtml", () => {
	test("extracts results from valid DDG HTML", async () => {
		const { parseDDGResultsHtml } = await loadModule();
		const results = parseDDGResultsHtml(SAMPLE_DDHTML);
		assert.ok(Array.isArray(results));
		assert.ok(results.length >= 1, "should find at least 1 result");
		// First result should have title, url, snippet
		const first = results[0];
		assert.ok(first.title, "result should have a title");
		assert.ok(first.url, "result should have a url");
		// url should be a real URL, not a DDG redirect
		assert.ok(
			!first.url.includes("duckduckgo.com/l/"),
			"url should be the actual target URL, not DDG redirect"
		);
	});

	test("returns empty array for empty HTML", async () => {
		const { parseDDGResultsHtml } = await loadModule();
		const results = parseDDGResultsHtml("");
		assert.deepEqual(results, []);
	});

	test("returns empty array for HTML with no results", async () => {
		const { parseDDGResultsHtml } = await loadModule();
		const results = parseDDGResultsHtml("<html><body><p>No results</p></body></html>");
		assert.deepEqual(results, []);
	});
});

describe("extractDDGResultBlocks", () => {
	test("splits HTML into individual result blocks", async () => {
		const { extractDDGResultBlocks } = await loadModule();
		const blocks = extractDDGResultBlocks(SAMPLE_DDHTML);
		assert.ok(Array.isArray(blocks));
		assert.ok(blocks.length >= 1, "should extract at least 1 block");
		// Each block should contain a result title link
		for (const block of blocks) {
			assert.ok(block.includes("result__a") || block.includes("result"), "block should contain result markers");
		}
	});

	test("returns empty array for empty HTML", async () => {
		const { extractDDGResultBlocks } = await loadModule();
		const blocks = extractDDGResultBlocks("");
		assert.deepEqual(blocks, []);
	});

	test("returns empty array for HTML with no result blocks", async () => {
		const { extractDDGResultBlocks } = await loadModule();
		const blocks = extractDDGResultBlocks("<html><body><div>nothing</div></body></html>");
		assert.deepEqual(blocks, []);
	});
});

describe("parseResultBlock", () => {
	test("extracts title, url, snippet from a single result block", async () => {
		const { parseResultBlock } = await loadModule();
		const result = parseResultBlock(SAMPLE_RESULT_BLOCK);
		assert.ok(result, "should return a parsed result");
		assert.ok(result.title, "should have a title");
		assert.ok(result.url, "should have a url");
		assert.match(result.url, /^https?:\/\//, "url should be absolute");
	});

	test("returns null for block with no valid link", async () => {
		const { parseResultBlock } = await loadModule();
		const result = parseResultBlock("<div><p>No link here</p></div>");
		assert.equal(result, null);
	});

	test("returns null for empty block", async () => {
		const { parseResultBlock } = await loadModule();
		const result = parseResultBlock("");
		assert.equal(result, null);
	});
});

describe("buildHtmlqArgs", () => {
	test("builds args for a CSS selector", async () => {
		const { buildHtmlqArgs } = await loadModule();
		const args = buildHtmlqArgs(".result__title a");
		assert.ok(Array.isArray(args));
		assert.ok(args.length >= 1);
		// Should contain the selector
		assert.ok(args.some(a => a.includes("result__title")), "args should reference the selector");
	});
});

describe("isHtmlqAvailable", () => {
	test("returns boolean", async () => {
		const { isHtmlqAvailable } = await loadModule();
		const result = isHtmlqAvailable();
		assert.equal(typeof result, "boolean");
	});
});
