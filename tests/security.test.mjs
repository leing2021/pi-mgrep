/**
 * U0/U2/U3 RED: Security regression tests
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const EXT = readFileSync("extensions/pi-search.ts", "utf-8");
const SEC = readFileSync("src/security.mjs", "utf-8");

// Combined: function must exist in either extension or security module
const COMBINED = EXT + "\n" + SEC;

// ── U2: Least-privilege runner ───────────────────────────

describe("security: no shell-string execSync", () => {
	test("extension should not use execSync with shell strings", () => {
		const shellExecSyncPattern = /execSync\(["'`]/;
		assert.equal(
			shellExecSyncPattern.test(COMBINED),
			false,
			"Extension should not use execSync with string arguments (shell execution).",
		);
	});
});

describe("security: no node -e subprocess fetch", () => {
	test('extension should not spawn "node -e" for fetching', () => {
		assert.equal(
			COMBINED.includes('"-e"') && COMBINED.includes("node"),
			false,
			'Extension should not use node -e subprocess for fetch. Use safeFetchText() instead.',
		);
	});
});

describe("security: no curl -L fetch path", () => {
	test("extension should not use /usr/bin/curl or curl -L directly", () => {
		const hasCurl = COMBINED.includes("/usr/bin/curl") || /curl.*-L/.test(COMBINED);
		assert.equal(
			hasCurl,
			false,
			"Extension should not use curl directly for fetching. Use safeFetchText() instead.",
		);
	});
});

describe("security: auto-install is opt-in", () => {
	test("auto-install must be gated by getAutoInstallPolicy()", () => {
		const hasAutoInstall = /npm install -g|brew install/.test(COMBINED);
		const hasPolicyCheck = /getAutoInstallPolicy\(\)/.test(COMBINED);
		const hasOptInLogic = /policy === "never"|policy === "ask"/.test(COMBINED);
		if (hasAutoInstall) {
			assert.ok(
				hasPolicyCheck && hasOptInLogic,
				"Auto-install strings found but must be gated by getAutoInstallPolicy() check.",
			);
		}
	});
});

describe("security: runCommand exists", () => {
	test("extension or security module should define a runCommand function", () => {
		assert.match(
			COMBINED,
			/function\s+runCommand|const\s+runCommand|export\s+function\s+runCommand|export\s+async\s+function\s+runCommand/,
			"Should define a runCommand() least-privilege runner.",
		);
	});
});

describe("security: safeFetchText exists", () => {
	test("extension or security module should define a safeFetchText function", () => {
		assert.match(
			COMBINED,
			/function\s+safeFetchText|const\s+safeFetchText|async\s+function\s+safeFetchText|export\s+async\s+function\s+safeFetchText/,
			"Should define a safeFetchText() secure fetch function.",
		);
	});
});

describe("security: env allowlists", () => {
	test("codebase should not pass bare process.env to child processes", () => {
		const lines = COMBINED.split("\n");
		let foundBareEnvPass = false;
		for (const line of lines) {
			if (/env\s*:\s*process\.env\b(?!\.)/.test(line)) {
				foundBareEnvPass = true;
				break;
			}
		}
		assert.equal(
			foundBareEnvPass,
			false,
			"Should not pass full process.env to child processes.",
		);
	});
});

// ── U3: Safe fetch SSRF tests (static) ──────────────────

describe("security: fetch paths unified through safeFetchText", () => {
	test("safeFetchText should be used in extension", () => {
		assert.match(
			EXT,
			/safeFetchText/,
			"Extension should import and use safeFetchText().",
		);
	});

	test("web_fetch tool should not contain node -e", () => {
		const webFetchSection = EXT.substring(
			EXT.indexOf('name: "web_fetch"'),
			EXT.indexOf('name: "web_fetch"') + 3000,
		);
		assert.equal(
			webFetchSection.includes('"-e"'),
			false,
			"web_fetch should not use node -e subprocess.",
		);
	});
});
