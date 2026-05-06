/**
 * U6: RED — Tests for research_search boundaries and LLM policy.
 *
 * These tests define the contract for research_search:
 * - web-only, default-off, explicit verification status
 * - no mgrep answer=true, no local search
 * - structured evidence pack with citations
 * - LLM provider abstraction with mock
 *
 * All should FAIL until U7/U8/U9 implement the helpers.
 */
import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
	getLlmConfig,
	verifyResearchClaim,
	buildEvidencePack,
	getResearchSearchStatus,
	addSourceToPack,
	collectEvidence,
} from "../src/research.ts";
import { readFileSync } from "node:fs";

const EXT = readFileSync("extensions/pi-search.ts", "utf-8");

// ── LLM config defaults ──────────────────────────────────

describe("llm-config: default behavior", () => {
	test("getLlmConfig defaults to enabled=never", () => {
		const config = getLlmConfig();
		assert.equal(config.enabled, "never", "default should be never");
	});

	test("getLlmConfig enabled=never means llmUsed=false", () => {
		const config = getLlmConfig();
		assert.equal(config.llmUsed, false, "llmUsed should be false when never");
	});

	test("getLlmConfig provider defaults to null", () => {
		const config = getLlmConfig();
		assert.equal(config.provider, null, "provider should be null by default");
	});

	test("getLlmConfig model defaults to null", () => {
		const config = getLlmConfig();
		assert.equal(config.model, null, "model should be null by default");
	});

	test("getLlmConfig does not expose API key value", () => {
		process.env.TEST_SECRET_KEY = "sk-test-secret-12345";
		const config = getLlmConfig({ apiKeyEnv: "TEST_SECRET_KEY" });
		assert.equal(config.apiKey, undefined, "config must not expose key value");
		delete process.env.TEST_SECRET_KEY;
	});
});

describe("llm-config: env overrides", () => {
	test("PI_SEARCH_LLM_ENABLED=always enables LLM", () => {
		process.env.PI_SEARCH_LLM_ENABLED = "always";
		try {
			const config = getLlmConfig();
			assert.equal(config.enabled, "always");
		} finally {
			delete process.env.PI_SEARCH_LLM_ENABLED;
		}
	});

	test("PI_SEARCH_LLM_ENABLED=ask is treated as disabled in tool context", () => {
		process.env.PI_SEARCH_LLM_ENABLED = "ask";
		try {
			const config = getLlmConfig();
			assert.equal(config.llmUsed, false, "ask should be treated as disabled");
		} finally {
			delete process.env.PI_SEARCH_LLM_ENABLED;
		}
	});

	test("always requires provider and apiKeyEnv", () => {
		process.env.PI_SEARCH_LLM_ENABLED = "always";
		process.env.PI_SEARCH_LLM_PROVIDER = "openai";
		process.env.MY_OPENAI_KEY = "sk-test-key";
		process.env.PI_SEARCH_LLM_API_KEY_ENV = "MY_OPENAI_KEY";
		try {
			const config = getLlmConfig();
			assert.equal(config.llmUsed, true);
			assert.equal(config.provider, "openai");
		} finally {
			delete process.env.PI_SEARCH_LLM_ENABLED;
			delete process.env.PI_SEARCH_LLM_PROVIDER;
			delete process.env.MY_OPENAI_KEY;
			delete process.env.PI_SEARCH_LLM_API_KEY_ENV;
		}
	});

	test("always without API key results in llmUsed=false", () => {
		process.env.PI_SEARCH_LLM_ENABLED = "always";
		process.env.PI_SEARCH_LLM_PROVIDER = "openai";
		// No API key env set
		try {
			const config = getLlmConfig();
			assert.equal(config.llmUsed, false, "missing API key should disable");
		} finally {
			delete process.env.PI_SEARCH_LLM_ENABLED;
			delete process.env.PI_SEARCH_LLM_PROVIDER;
		}
	});
});

// ── Verification status ──────────────────────────────────

describe("research-search: verification status", () => {
	test("getResearchSearchStatus returns DISABLED when LLM never", () => {
		const status = getResearchSearchStatus();
		assert.ok(status.text.includes("[VERIFICATION DISABLED]"), "should contain DISABLED marker");
		assert.equal(status.verificationStatus, "disabled");
	});

	test("getResearchSearchStatus returns FAILED on error", () => {
		const status = getResearchSearchStatus({ error: "timeout" });
		assert.ok(status.text.includes("[VERIFICATION FAILED: timeout]"), "should contain FAILED marker");
		assert.equal(status.verificationStatus, "failed");
	});

	test("getResearchSearchStatus returns ENABLED when LLM active", () => {
		process.env.PI_SEARCH_LLM_ENABLED = "always";
		process.env.PI_SEARCH_LLM_PROVIDER = "openai";
		process.env.TEST_LLM_KEY = "sk-test";
		process.env.PI_SEARCH_LLM_API_KEY_ENV = "TEST_LLM_KEY";
		try {
			const status = getResearchSearchStatus();
			assert.equal(status.verificationStatus, "enabled");
		} finally {
			delete process.env.PI_SEARCH_LLM_ENABLED;
			delete process.env.PI_SEARCH_LLM_PROVIDER;
			delete process.env.TEST_LLM_KEY;
			delete process.env.PI_SEARCH_LLM_API_KEY_ENV;
		}
	});
});

// ── Evidence pack ─────────────────────────────────────────

describe("research-search: evidence pack", () => {
	test("maxSources clamps to 1-5", () => {
		assert.equal(buildEvidencePack({ maxSources: 0 }).maxSources, 1);
		assert.equal(buildEvidencePack({ maxSources: 10 }).maxSources, 5);
		assert.equal(buildEvidencePack({ maxSources: 3 }).maxSources, 3);
	});

	test("maxChars clamps to safe range", () => {
		assert.equal(buildEvidencePack({ maxChars: 100 }).maxChars, 1000);
		assert.equal(buildEvidencePack({ maxChars: 50000 }).maxChars, 12000);
		assert.equal(buildEvidencePack({ maxChars: 6000 }).maxChars, 6000);
	});

	test("evidence pack has required structure", () => {
		const pack = buildEvidencePack();
		assert.ok(Array.isArray(pack.sources), "sources should be array");
		assert.equal(pack.sources.length, 0, "initially empty");
		assert.ok(typeof pack.totalChars === "number");
		assert.ok(typeof pack.maxSources === "number");
		assert.ok(typeof pack.maxChars === "number");
	});

	test("addSourceToPack adds source correctly", () => {
		const pack = buildEvidencePack({ maxSources: 3, maxChars: 6000 });
		addSourceToPack(pack, {
			id: "1",
			url: "https://example.com/page1",
			finalUrl: "https://example.com/page1",
			snippet: "Test content",
		});
		assert.equal(pack.sources.length, 1);
		assert.equal(pack.sources[0].id, "1");
		assert.equal(pack.sources[0].snippet, "Test content");
		assert.equal(pack.totalChars, 12);
	});

	test("addSourceToPack respects maxSources limit", () => {
		const pack = buildEvidencePack({ maxSources: 2 });
		addSourceToPack(pack, { url: "https://a.com", snippet: "a" });
		addSourceToPack(pack, { url: "https://b.com", snippet: "b" });
		addSourceToPack(pack, { url: "https://c.com", snippet: "c" });
		assert.equal(pack.sources.length, 2, "should not exceed maxSources");
	});

	test("addSourceToPack records fetch failures", () => {
		const pack = buildEvidencePack();
		addSourceToPack(pack, {
			url: "https://fail.example.com",
			snippet: "[Fetch failed: ECONNREFUSED]",
			fetched: false,
		});
		assert.equal(pack.sources[0].fetched, false);
	});
});

// ── Collect evidence (integration with safeFetchText) ──────

describe("research-search: collectEvidence", () => {
	test("collectEvidence returns pack and fetch results", async () => {
		const { pack, fetchResults } = await collectEvidence(
			["https://example.com/nonexistent"],
			{ maxSources: 1, maxChars: 2000, _dnsLookup: async () => ({ address: "93.184.216.34" }) },
		);
		assert.ok(pack, "should return pack");
		assert.ok(Array.isArray(fetchResults), "should return fetchResults");
	});

	test("collectEvidence records fetch failures gracefully", async () => {
		const { pack, fetchResults } = await collectEvidence(
			["https://192.0.2.1/timeout"], // RFC 5737 TEST-NET, will fail
			{ maxSources: 1, maxChars: 2000 },
		);
		assert.equal(pack.sources.length, 1, "should record attempt");
		assert.equal(pack.sources[0].fetched, false, "should mark as failed");
		assert.equal(fetchResults[0].success, false);
	});
});

// ── Verify research claim ────────────────────────────────

describe("research-search: verifyResearchClaim", () => {
	test("verifyResearchClaim returns structured result with mock provider", async () => {
		const result = await verifyResearchClaim("test claim", [], {
			provider: async () => ({ answer: "mock answer", citations: [] }),
		});
		assert.ok(result, "should return result");
		assert.equal(typeof result.answer, "string");
		assert.ok(Array.isArray(result.citations));
	});

	test("verifyResearchClaim timeout returns FAILED status", { timeout: 5000 }, async () => {
		const result = await verifyResearchClaim("test claim", [], {
			provider: async () => new Promise(() => {}), // never resolves
			timeout: 10,
		});
		assert.ok(result.text.includes("[VERIFICATION FAILED: timeout]"), "should contain FAILED marker");
		assert.equal(result.verificationStatus, "failed");
	});
});

// ── Web search fallback contract (static) ──────────────────

describe("web-search: fallback contract", () => {
	test("web_search documents answer fallback as URL-only when mgrep fails", () => {
		const section = EXT.substring(
			EXT.indexOf('name: "web_search"'),
			EXT.indexOf('name: "web_search"') + 2500,
		);
		assert.match(section, /fallback.*URL/i, "web_search should document URL-only fallback for answer mode failures");
	});

	test("web_search fallback reason covers unavailable or failed mgrep", () => {
		const section = EXT.substring(
			EXT.indexOf('name: "web_search"'),
			EXT.indexOf('name: "web_search"') + 3500,
		);
		assert.match(section, /mgrep unavailable or failed/i, "fallback reason should cover mgrep failures/quota, not only missing binary");
	});
});

// ── Extension contract (static) ────────────────────────────

describe("research-search: extension contract", () => {
	test("extension registers research_search tool", () => {
		assert.match(EXT, /name:\s*["']research_search["']/, "extension should register research_search tool");
	});

	test("research_search description says web-only", () => {
		const section = EXT.substring(
			EXT.indexOf('name: "research_search"'),
			EXT.indexOf('name: "research_search"') + 2000,
		);
		assert.match(section, /web.only/i, "description should say web-only");
	});

	test("research_search description says default-off", () => {
		const section = EXT.substring(
			EXT.indexOf('name: "research_search"'),
			EXT.indexOf('name: "research_search"') + 2000,
		);
		assert.match(section, /default.off/i, "description should say default-off");
	});

	test("research_search schema includes query parameter", () => {
		const section = EXT.substring(
			EXT.indexOf('name: "research_search"'),
			EXT.indexOf('name: "research_search"') + 3000,
		);
		assert.match(section, /query/, "schema should include query parameter");
	});

	test("research_search schema includes maxSources, maxChars, verify", () => {
		const section = EXT.substring(
			EXT.indexOf('name: "research_search"'),
			EXT.indexOf('name: "research_search"') + 3000,
		);
		assert.match(section, /maxSources/, "schema should include maxSources");
		assert.match(section, /maxChars/, "schema should include maxChars");
		assert.match(section, /verify/, "schema should include verify");
	});

	test("research_search does not use mgrep -a or answer=true", () => {
		const section = EXT.substring(
			EXT.indexOf('name: "research_search"'),
			EXT.indexOf('name: "research_search"') + 5000,
		);
		assert.doesNotMatch(section, /-a/, "research_search must not use mgrep -a flag");
	});

	test("research_search does not call local search or validateSearchPath", () => {
		const section = EXT.substring(
			EXT.indexOf('name: "research_search"'),
			EXT.indexOf('name: "research_search"') + 5000,
		);
		assert.doesNotMatch(section, /validateSearchPath/, "research_search must not validate local paths");
		assert.doesNotMatch(section, /resolveRg/, "research_search must not use ripgrep");
	});
});
