/**
 * U0/U5: RED → GREEN — Audit details tests
 *
 * Tests for structured audit metadata in tool results.
 * RED: missing exports/functions should cause failures.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const EXT = readFileSync("extensions/pi-search.ts", "utf-8");
const SEC = readFileSync("src/security.mjs", "utf-8");
const COMBINED = EXT + "\n" + SEC;

// ── Audit detail helpers ──────────────────────────────────

describe("audit: createAuditDetails helper exists", () => {
	test("src/security.mjs exports createAuditDetails", () => {
		assert.ok(
			COMBINED.includes("createAuditDetails"),
			"Should export a createAuditDetails function for structured audit",
		);
	});
});

describe("audit: tool results include policy fields", () => {
	test("search tool result includes sandboxMode", () => {
		assert.match(EXT, /sandboxMode/, "search tool result should include sandboxMode");
	});

	test("web_search tool result includes sandboxMode", () => {
		const wsSection = EXT.substring(
			EXT.indexOf('name: "web_search"'),
			EXT.indexOf('name: "web_fetch"'),
		);
		assert.match(wsSection, /sandboxMode/, "web_search should include sandboxMode");
	});

	test("web_fetch tool result includes sandboxMode", () => {
		const wfSection = EXT.substring(
			EXT.indexOf('name: "web_fetch"'),
			EXT.indexOf('name: "web_fetch"') + 5000,
		);
		assert.match(wfSection, /sandboxMode/, "web_fetch should include sandboxMode");
	});
});

describe("audit: tool results reference permission profile", () => {
	test("extension references permissionProfile or command policy in details", () => {
		assert.ok(
			COMBINED.includes("permissionProfile") || COMBINED.includes("commandPolicy"),
			"Details should reference permissionProfile or commandPolicy",
		);
	});
});

describe("audit: project-scoped temp dir", () => {
	test("extension no longer hardcodes /tmp/mgrep-empty", () => {
		assert.ok(
			!EXT.includes("/tmp/mgrep-empty"),
			"Extension should not hardcode /tmp/mgrep-empty (use project-scoped temp dir)",
		);
	});

	test("security module provides project-scoped temp dir helper", () => {
		assert.ok(
			SEC.includes("getProjectScopedTempDir") || SEC.includes("ensureProjectScopedEmptyDir"),
			"Security module should provide project-scoped temp dir helpers",
		);
	});
});
