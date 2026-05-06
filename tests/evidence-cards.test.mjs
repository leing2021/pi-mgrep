/**
 * U7: RED — Tests for evidence card formatting and details standardization.
 *
 * Tests define the contract for:
 *   - buildEvidenceCards(cards, details) → formatted text string
 *   - buildDetails(opts) → details metadata object
 *   - formatCard(card) → single card formatter
 *
 * Evidence card shape: { source, locator, snippet, engine, score? }
 * Details shape: { provider, fallbackUsed, mode, rawBytes?, returnedChars?, truncated?, capabilitiesUsed? }
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// These exports do not exist yet — all tests should FAIL (RED phase).
import {
	buildEvidenceCards,
	buildDetails,
	formatCard,
} from "../src/evidence-cards.ts";

// ── formatCard ────────────────────────────────────────────

describe("formatCard: single card formatter", () => {
	test("formats a card with all fields", () => {
		const card = {
			source: "https://example.com/docs",
			locator: "line 42",
			snippet: "const x = 42;",
			engine: "ripgrep",
			score: 0.95,
		};
		const result = formatCard(card);
		assert.ok(result.includes("https://example.com/docs"), "should contain source");
		assert.ok(result.includes("line 42"), "should contain locator");
		assert.ok(result.includes("const x = 42;"), "should contain snippet");
		assert.ok(result.includes("ripgrep"), "should contain engine");
		assert.ok(result.includes("0.95"), "should contain score");
	});

	test("formats a card without optional score", () => {
		const card = {
			source: "https://example.com/page",
			locator: "section 3.1",
			snippet: "Some content here.",
			engine: "mgrep",
		};
		const result = formatCard(card);
		assert.ok(result.includes("https://example.com/page"));
		assert.ok(result.includes("section 3.1"));
		assert.ok(result.includes("Some content here."));
		assert.ok(result.includes("mgrep"));
		assert.ok(!result.includes("score"), "should not mention score when absent");
	});

	test("formats a card with duckduckgo engine", () => {
		const card = {
			source: "https://duckduckgo.com/?q=test",
			locator: "result 1",
			snippet: "Search result text",
			engine: "duckduckgo",
		};
		const result = formatCard(card);
		assert.ok(result.includes("duckduckgo"));
	});
});

// ── buildDetails ──────────────────────────────────────────

describe("buildDetails: details metadata builder", () => {
	test("returns object with all required fields", () => {
		const details = buildDetails({
			provider: "openai",
			fallbackUsed: false,
			mode: "compact",
		});
		assert.equal(details.provider, "openai");
		assert.equal(details.fallbackUsed, false);
		assert.equal(details.mode, "compact");
	});

	test("includes optional fields when provided", () => {
		const details = buildDetails({
			provider: "anthropic",
			fallbackUsed: true,
			mode: "quotes",
			rawBytes: 2048,
			returnedChars: 1500,
			truncated: true,
			capabilitiesUsed: ["ripgrep", "mgrep"],
		});
		assert.equal(details.provider, "anthropic");
		assert.equal(details.fallbackUsed, true);
		assert.equal(details.mode, "quotes");
		assert.equal(details.rawBytes, 2048);
		assert.equal(details.returnedChars, 1500);
		assert.equal(details.truncated, true);
		assert.deepEqual(details.capabilitiesUsed, ["ripgrep", "mgrep"]);
	});

	test("omits optional fields when not provided", () => {
		const details = buildDetails({
			provider: "duckduckgo",
			fallbackUsed: false,
			mode: "compact",
		});
		assert.equal(details.rawBytes, undefined, "rawBytes should be undefined when not provided");
		assert.equal(details.returnedChars, undefined);
		assert.equal(details.truncated, undefined);
		assert.equal(details.capabilitiesUsed, undefined);
	});

	test("defaults mode to compact when not specified", () => {
		const details = buildDetails({
			provider: "openai",
			fallbackUsed: false,
		});
		assert.equal(details.mode, "compact");
	});
});

// ── buildEvidenceCards ────────────────────────────────────

describe("buildEvidenceCards: formatted output", () => {
	test("returns formatted text with valid cards", () => {
		const cards = [
			{
				source: "https://example.com/a",
				locator: "line 10",
				snippet: "Result A",
				engine: "ripgrep",
			},
			{
				source: "https://example.com/b",
				locator: "line 20",
				snippet: "Result B",
				engine: "mgrep",
				score: 0.88,
			},
		];
		const details = buildDetails({
			provider: "mgrep",
			fallbackUsed: false,
			mode: "compact",
			returnedChars: 42,
		});
		const result = buildEvidenceCards(cards, details);
		assert.ok(typeof result === "string", "should return string");
		assert.ok(result.includes("Result A"), "should contain first card snippet");
		assert.ok(result.includes("Result B"), "should contain second card snippet");
		assert.ok(result.includes("example.com/a"), "should contain first card source");
		assert.ok(result.includes("example.com/b"), "should contain second card source");
		assert.ok(result.includes("compact"), "should contain mode from details");
	});

	test("returns 'No results found' for empty cards array", () => {
		const details = buildDetails({
			provider: "ripgrep",
			fallbackUsed: false,
			mode: "compact",
		});
		const result = buildEvidenceCards([], details);
		assert.ok(
			result.toLowerCase().includes("no results found"),
			"should contain 'No results found' message",
		);
	});

	test("includes details metadata in output", () => {
		const cards = [
			{
				source: "https://example.com/c",
				locator: "section 2",
				snippet: "Content C",
				engine: "duckduckgo",
			},
		];
		const details = buildDetails({
			provider: "duckduckgo",
			fallbackUsed: true,
			mode: "full",
			rawBytes: 5000,
			returnedChars: 3000,
			truncated: false,
			capabilitiesUsed: ["duckduckgo"],
		});
		const result = buildEvidenceCards(cards, details);
		assert.ok(result.includes("duckduckgo"), "should show provider");
		assert.ok(result.includes("full"), "should show mode");
	});

	test("respects compact budget (≤ 6000 chars)", () => {
		const bigSnippet = "A".repeat(5000);
		const cards = [
			{
				source: "https://example.com/big",
				locator: "line 1",
				snippet: bigSnippet,
				engine: "ripgrep",
			},
		];
		const details = buildDetails({
			provider: "ripgrep",
			fallbackUsed: false,
			mode: "compact",
		});
		const result = buildEvidenceCards(cards, details);
		assert.ok(result.length <= 6000, `compact mode output should be ≤ 6000 chars, got ${result.length}`);
	});

	test("truncation marker appears when content exceeds budget", () => {
		const bigSnippet = "B".repeat(8000);
		const cards = [
			{
				source: "https://example.com/huge",
				locator: "line 1",
				snippet: bigSnippet,
				engine: "ripgrep",
			},
		];
		const details = buildDetails({
			provider: "ripgrep",
			fallbackUsed: false,
			mode: "compact",
		});
		const result = buildEvidenceCards(cards, details);
		assert.ok(
			result.includes("[truncated]"),
			"should contain [truncated] marker when content exceeds budget",
		);
	});

	test("quotes mode budget is ≤ 10000 chars", () => {
		const bigSnippet = "Q".repeat(9000);
		const cards = [
			{
				source: "https://example.com/quotes",
				locator: "para 1",
				snippet: bigSnippet,
				engine: "mgrep",
			},
		];
		const details = buildDetails({
			provider: "mgrep",
			fallbackUsed: false,
			mode: "quotes",
		});
		const result = buildEvidenceCards(cards, details);
		assert.ok(result.length <= 10000, `quotes mode output should be ≤ 10000 chars, got ${result.length}`);
	});

	test("full mode budget is ≤ 30000 chars", () => {
		const bigSnippet = "F".repeat(29000);
		const cards = [
			{
				source: "https://example.com/full",
				locator: "page 1",
				snippet: bigSnippet,
				engine: "mgrep",
			},
		];
		const details = buildDetails({
			provider: "mgrep",
			fallbackUsed: false,
			mode: "full",
		});
		const result = buildEvidenceCards(cards, details);
		assert.ok(result.length <= 30000, `full mode output should be ≤ 30000 chars, got ${result.length}`);
	});
});

// ── Backward compatibility ────────────────────────────────

describe("evidence-cards: backward compatibility", () => {
	test("buildEvidenceCards works without details (details optional)", () => {
		const cards = [
			{
				source: "https://example.com/compat",
				locator: "line 5",
				snippet: "Backward compat content",
				engine: "ripgrep",
			},
		];
		// Calling without details — should not throw
		const result = buildEvidenceCards(cards);
		assert.ok(typeof result === "string");
		assert.ok(result.includes("Backward compat content"));
	});

	test("buildDetails sets fallbackUsed=false by default", () => {
		const details = buildDetails({
			provider: "mgrep",
		});
		assert.equal(details.fallbackUsed, false);
	});

	test("formatCard handles card with minimal fields", () => {
		const card = {
			source: "file.ts",
			locator: "line 1",
			snippet: "x",
			engine: "ripgrep",
		};
		const result = formatCard(card);
		assert.ok(result.includes("file.ts"));
		assert.ok(result.includes("x"));
	});
});
