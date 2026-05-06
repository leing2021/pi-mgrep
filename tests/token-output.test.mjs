/**
 * U0/U4 RED: Token-aware output tests
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const EXT = readFileSync("extensions/pi-search.ts", "utf-8");
const SEC = readFileSync("src/security.mjs", "utf-8");
const COMBINED = EXT + "\n" + SEC;

describe("token-output: web_fetch mode parameter", () => {
	test("web_fetch should accept mode parameter in schema", () => {
		const webFetchSection = EXT.substring(
			EXT.indexOf('name: "web_fetch"'),
			EXT.indexOf('name: "web_fetch"') + 3000,
		);
		assert.match(
			webFetchSection,
			/mode/,
			"web_fetch schema should include a 'mode' parameter.",
		);
	});

	test("web_fetch should accept maxChars parameter in schema", () => {
		const webFetchSection = EXT.substring(
			EXT.indexOf('name: "web_fetch"'),
			EXT.indexOf('name: "web_fetch"') + 3000,
		);
		assert.match(
			webFetchSection,
			/maxChars/,
			"web_fetch schema should include a 'maxChars' parameter.",
		);
	});
});

describe("token-output: untrusted boundary markers", () => {
	test("codebase should define untrusted content boundary markers", () => {
		assert.match(
			COMBINED,
			/\[UNTRUSTED WEB CONTENT START\]/,
			"Should include UNTRUSTED WEB CONTENT START marker.",
		);
		assert.match(
			COMBINED,
			/\[UNTRUSTED WEB CONTENT END\]/,
			"Should include UNTRUSTED WEB CONTENT END marker.",
		);
	});
});

describe("token-output: risk flag detection", () => {
	test("codebase should detect prompt injection risk phrases", () => {
		assert.match(
			COMBINED,
			/ignore previous instructions|riskFlags|risk.flag/i,
			"Should detect risk phrases like 'ignore previous instructions'.",
		);
	});
});

describe("token-output: context budget metadata", () => {
	test("codebase should include context budget in output metadata", () => {
		assert.match(
			COMBINED,
			/contextBudget|context.?budget/i,
			"Should include contextBudget metadata.",
		);
	});
});

describe("token-output: trust level in details", () => {
	test("codebase should mark web content trust as untrusted-web", () => {
		assert.match(
			COMBINED,
			/untrusted-web/,
			"Should set trust level to 'untrusted-web'.",
		);
	});
});

describe("token-output: web_search count clamp", () => {
	test("codebase should clamp web_search count to 1-10 range", () => {
		assert.match(
			COMBINED,
			/Math\.(min|max|clamp).*count|count.*clamp/i,
			"Should clamp web_search count parameter.",
		);
	});
});
