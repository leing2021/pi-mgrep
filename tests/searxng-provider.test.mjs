/**
 * Tests for SearXNG web search provider
 *
 * Tests cover:
 *   - resolveWebProvider() without env → 'duckduckgo'
 *   - resolveWebProvider() with PI_SEARCH_SEARXNG_URL → 'searxng'
 *   - resolveWebProvider() with PI_SEARCH_WEB_PROVIDER=duckduckgo → 'duckduckgo'
 *   - resolveWebProvider() auto + no URL → duckduckgo
 *   - resolveWebProvider() searxng + no URL → duckduckgo (silent fallback)
 *   - isSearXNGConfigured() without env → false
 *   - isSearXNGConfigured() with env → true
 *   - buildSearXNGSearchUrl encodes query correctly
 *   - parseSearXNGResponse parses JSON correctly
 *   - parseSearXNGResponse with empty results → []
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
	return await import("../src/searxng-provider.ts");
}

// ── Tests ────────────────────────────────────────────────

describe("resolveWebProvider", () => {
	test("returns 'duckduckgo' when no env vars set", async () => {
		const { resolveWebProvider } = await loadModule();
		const provider = withEnv(
			{ PI_SEARCH_WEB_PROVIDER: undefined, PI_SEARCH_SEARXNG_URL: undefined },
			() => resolveWebProvider()
		);
		assert.equal(provider, "duckduckgo");
	});

	test("returns 'searxng' when auto + SearXNG URL configured", async () => {
		const { resolveWebProvider } = await loadModule();
		const provider = withEnv(
			{ PI_SEARCH_WEB_PROVIDER: undefined, PI_SEARCH_SEARXNG_URL: "http://localhost:8080" },
			() => resolveWebProvider()
		);
		assert.equal(provider, "searxng");
	});

	test("returns 'duckduckgo' when explicitly set to duckduckgo", async () => {
		const { resolveWebProvider } = await loadModule();
		const provider = withEnv(
			{ PI_SEARCH_WEB_PROVIDER: "duckduckgo", PI_SEARCH_SEARXNG_URL: "http://localhost:8080" },
			() => resolveWebProvider()
		);
		assert.equal(provider, "duckduckgo");
	});

	test("returns 'duckduckgo' when searxng requested but no URL", async () => {
		const { resolveWebProvider } = await loadModule();
		const provider = withEnv(
			{ PI_SEARCH_WEB_PROVIDER: "searxng", PI_SEARCH_SEARXNG_URL: undefined },
			() => resolveWebProvider()
		);
		assert.equal(provider, "duckduckgo");
	});

	test("returns 'searxng' when explicitly set and URL configured", async () => {
		const { resolveWebProvider } = await loadModule();
		const provider = withEnv(
			{ PI_SEARCH_WEB_PROVIDER: "searxng", PI_SEARCH_SEARXNG_URL: "http://localhost:8080" },
			() => resolveWebProvider()
		);
		assert.equal(provider, "searxng");
	});
});

describe("isSearXNGConfigured", () => {
	test("returns false when no env set", async () => {
		const { isSearXNGConfigured } = await loadModule();
		const result = withEnv(
			{ PI_SEARCH_SEARXNG_URL: undefined },
			() => isSearXNGConfigured()
		);
		assert.equal(result, false);
	});

	test("returns true when URL is set", async () => {
		const { isSearXNGConfigured } = await loadModule();
		const result = withEnv(
			{ PI_SEARCH_SEARXNG_URL: "http://localhost:8080" },
			() => isSearXNGConfigured()
		);
		assert.equal(result, true);
	});
});

describe("getSearXNGUrl", () => {
	test("returns null when not set", async () => {
		const { getSearXNGUrl } = await loadModule();
		const result = withEnv(
			{ PI_SEARCH_SEARXNG_URL: undefined },
			() => getSearXNGUrl()
		);
		assert.equal(result, null);
	});

	test("returns the URL when set", async () => {
		const { getSearXNGUrl } = await loadModule();
		const result = withEnv(
			{ PI_SEARCH_SEARXNG_URL: "http://localhost:8080" },
			() => getSearXNGUrl()
		);
		assert.equal(result, "http://localhost:8080");
	});
});

describe("buildSearXNGSearchUrl", () => {
	test("builds correct search URL with query encoding", async () => {
		const { buildSearXNGSearchUrl } = await loadModule();
		const url = buildSearXNGSearchUrl("hello world", { format: "json", count: 10 });
		assert.match(url, /\/search\?/);
		assert.match(url, /q=hello%20world/);
		assert.match(url, /format=json/);
	});

	test("includes pageno=1", async () => {
		const { buildSearXNGSearchUrl } = await loadModule();
		const url = buildSearXNGSearchUrl("test", { format: "json", count: 5 });
		assert.match(url, /pageno=1/);
	});

	test("encodes special characters in query", async () => {
		const { buildSearXNGSearchUrl } = await loadModule();
		const url = buildSearXNGSearchUrl("what is <html>?", { format: "json", count: 5 });
		assert.ok(!url.includes("<"), "should encode special chars");
		assert.match(url, /q=/);
	});
});

describe("parseSearXNGResponse", () => {
	test("parses JSON response correctly", async () => {
		const { parseSearXNGResponse } = await loadModule();
		const json = {
			results: [
				{ title: "Result 1", url: "https://example.com", content: "Snippet 1", engine: "google" },
				{ title: "Result 2", url: "https://foo.com", content: "Snippet 2", engine: "bing" },
			],
		};
		const results = parseSearXNGResponse(json);
		assert.equal(results.length, 2);
		assert.equal(results[0].title, "Result 1");
		assert.equal(results[0].url, "https://example.com");
		assert.equal(results[0].snippet, "Snippet 1");
		assert.equal(results[1].title, "Result 2");
	});

	test("returns empty array for empty results", async () => {
		const { parseSearXNGResponse } = await loadModule();
		const results = parseSearXNGResponse({ results: [] });
		assert.deepEqual(results, []);
	});

	test("returns empty array for null/undefined input", async () => {
		const { parseSearXNGResponse } = await loadModule();
		assert.deepEqual(parseSearXNGResponse(null), []);
		assert.deepEqual(parseSearXNGResponse(undefined), []);
	});

	test("returns empty array for missing results field", async () => {
		const { parseSearXNGResponse } = await loadModule();
		assert.deepEqual(parseSearXNGResponse({}), []);
	});

	test("skips results with missing url", async () => {
		const { parseSearXNGResponse } = await loadModule();
		const json = {
			results: [
				{ title: "Good", url: "https://example.com", content: "OK" },
				{ title: "No URL", content: "Missing URL" },
			],
		};
		const results = parseSearXNGResponse(json);
		assert.equal(results.length, 1);
		assert.equal(results[0].title, "Good");
	});
});
