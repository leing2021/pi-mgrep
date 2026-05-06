/**
 * Tests for CLI capability detection module
 *
 * Tests cover:
 *   - detectCliCapabilities() returns expected shape with boolean values
 *   - hasCapability() returns correct boolean for known/unknown tools
 *   - isLocalCliEnabled() defaults to true (auto)
 *   - isLocalCliEnabled() returns false when env=never
 *   - isNetworkCliEnabled() defaults to false (never)
 *   - isNetworkCliEnabled() returns true when env=always
 *   - isToolEnabled() combines capability + category enablement
 *   - resetCapabilities() clears cache
 *   - Unknown tool name returns false
 */

import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// ── Helpers ──────────────────────────────────────────────

/** Save and restore env vars around a callback */
function withEnv(vars, fn) {
	const saved = {};
	for (const [k, v] of Object.entries(vars)) {
		saved[k] = process.env[k];
		if (v === undefined) {
			delete process.env[k];
		} else {
			process.env[k] = v;
		}
	}
	try {
		return fn();
	} finally {
		for (const [k, v] of Object.entries(saved)) {
			if (v === undefined) {
				delete process.env[k];
			} else {
				process.env[k] = v;
			}
		}
	}
}

// Import module (dynamic so resetCapabilities is fresh each suite)
async function loadModule() {
	// Dynamic import to get a fresh module reference
	const mod = await import("../src/cli-capabilities.ts");
	return mod;
}

// ── Tests ────────────────────────────────────────────────

describe("cli-capabilities", () => {
	let mod;

	beforeEach(async () => {
		mod = await loadModule();
		// Always reset cache + env before each test
		mod.resetCapabilities();
		delete process.env.PI_SEARCH_LOCAL_CLI_ENHANCEMENTS;
		delete process.env.PI_SEARCH_NETWORK_CLI_ENHANCEMENTS;
	});

	afterEach(() => {
		mod.resetCapabilities();
		delete process.env.PI_SEARCH_LOCAL_CLI_ENHANCEMENTS;
		delete process.env.PI_SEARCH_NETWORK_CLI_ENHANCEMENTS;
	});

	test("detectCliCapabilities returns expected shape with boolean values", async () => {
		const caps = await mod.detectCliCapabilities();
		assert.ok(typeof caps.gh === "boolean", "gh should be boolean");
		assert.ok(typeof caps.htmlq === "boolean", "htmlq should be boolean");
		assert.ok(typeof caps.pdftotext === "boolean", "pdftotext should be boolean");
		// Should only have these three keys
		assert.deepEqual(Object.keys(caps).sort(), ["gh", "htmlq", "pdftotext"]);
	});

	test("detectCliCapabilities caches results (second call returns same object)", async () => {
		const first = await mod.detectCliCapabilities();
		const second = await mod.detectCliCapabilities();
		assert.strictEqual(first, second, "should return the same cached object");
	});

	test("hasCapability returns correct boolean for known tools", async () => {
		// Force detection first
		await mod.detectCliCapabilities();
		// hasCapability should return a boolean for known tools
		assert.ok(typeof mod.hasCapability("gh") === "boolean");
		assert.ok(typeof mod.hasCapability("htmlq") === "boolean");
		assert.ok(typeof mod.hasCapability("pdftotext") === "boolean");
	});

	test("hasCapability returns false for unknown tool", async () => {
		await mod.detectCliCapabilities();
		assert.equal(mod.hasCapability("nonexistent_tool_xyz"), false);
	});

	test("isLocalCliEnabled defaults to true (auto)", () => {
		delete process.env.PI_SEARCH_LOCAL_CLI_ENHANCEMENTS;
		assert.equal(mod.isLocalCliEnabled(), true);
	});

	test("isLocalCliEnabled returns false when env=never", () => {
		withEnv({ PI_SEARCH_LOCAL_CLI_ENHANCEMENTS: "never" }, () => {
			assert.equal(mod.isLocalCliEnabled(), false);
		});
	});

	test("isLocalCliEnabled returns true when env=auto", () => {
		withEnv({ PI_SEARCH_LOCAL_CLI_ENHANCEMENTS: "auto" }, () => {
			assert.equal(mod.isLocalCliEnabled(), true);
		});
	});

	test("isNetworkCliEnabled defaults to false (never)", () => {
		delete process.env.PI_SEARCH_NETWORK_CLI_ENHANCEMENTS;
		assert.equal(mod.isNetworkCliEnabled(), false);
	});

	test("isNetworkCliEnabled returns true when env=always", () => {
		withEnv({ PI_SEARCH_NETWORK_CLI_ENHANCEMENTS: "always" }, () => {
			assert.equal(mod.isNetworkCliEnabled(), true);
		});
	});

	test("isNetworkCliEnabled returns false when env=never", () => {
		withEnv({ PI_SEARCH_NETWORK_CLI_ENHANCEMENTS: "never" }, () => {
			assert.equal(mod.isNetworkCliEnabled(), false);
		});
	});

	test("isToolEnabled combines capability + category enablement", async () => {
		// Local tool (htmlq): enabled when local CLI is enabled (default)
		// We need to detect first
		await mod.detectCliCapabilities();

		// With local CLI enabled (default), isToolEnabled matches capability
		const htmlqPresent = mod.hasCapability("htmlq");
		assert.equal(mod.isToolEnabled("htmlq"), htmlqPresent);

		// With local CLI disabled, htmlq should be false regardless
		withEnv({ PI_SEARCH_LOCAL_CLI_ENHANCEMENTS: "never" }, () => {
			assert.equal(mod.isToolEnabled("htmlq"), false);
		});
	});

	test("isToolEnabled for network tools requires network CLI enabled", async () => {
		await mod.detectCliCapabilities();

		// gh is a network tool — default is network disabled
		assert.equal(mod.isToolEnabled("gh"), false);

		// When network CLI is enabled, it follows capability
		withEnv({ PI_SEARCH_NETWORK_CLI_ENHANCEMENTS: "always" }, () => {
			assert.equal(mod.isToolEnabled("gh"), mod.hasCapability("gh"));
		});
	});

	test("isToolEnabled returns false for unknown tool", async () => {
		await mod.detectCliCapabilities();
		assert.equal(mod.isToolEnabled("nonexistent_tool_xyz"), false);
	});

	test("resetCapabilities clears cache", async () => {
		const first = await mod.detectCliCapabilities();
		mod.resetCapabilities();
		const second = await mod.detectCliCapabilities();
		// After reset, it should be a new object (fresh detection)
		assert.notStrictEqual(first, second, "should be different objects after reset");
	});
});
