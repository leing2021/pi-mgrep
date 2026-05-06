/**
 * U4: RED — Runtime tests for env allowlist + auto-install policy
 *
 * Tests import getMinimalEnv, getAutoInstallPolicy, runCommand from src/security.mjs.
 * These verify runtime policy behavior, not just static patterns.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getMinimalEnv, getAutoInstallPolicy, runCommand } from "../src/security.mjs";

// ── 4.1–4.3: getMinimalEnv ────────────────────────────────

describe("policy: getMinimalEnv strips sensitive keys", () => {
	test("4.1 getMinimalEnv('rg') strips GITHUB_TOKEN", () => {
		// Temporarily set a sensitive env var
		const orig = process.env.GITHUB_TOKEN;
		process.env.GITHUB_TOKEN = "ghp_test_secret_12345";
		try {
			const env = getMinimalEnv("rg");
			assert.equal(env.GITHUB_TOKEN, undefined, "GITHUB_TOKEN should be stripped");
		} finally {
			if (orig !== undefined) process.env.GITHUB_TOKEN = orig;
			else delete process.env.GITHUB_TOKEN;
		}
	});

	test("4.2 getMinimalEnv('mgrep-web') includes MXBAI_API_KEY", () => {
		const orig = process.env.MXBAI_API_KEY;
		process.env.MXBAI_API_KEY = "test_mgrep_key";
		try {
			const env = getMinimalEnv("mgrep-web");
			assert.equal(env.MXBAI_API_KEY, "test_mgrep_key", "MXBAI_API_KEY should be included for mgrep-web");
		} finally {
			if (orig !== undefined) process.env.MXBAI_API_KEY = orig;
			else delete process.env.MXBAI_API_KEY;
		}
	});

	test("4.3 getMinimalEnv('rg') excludes MXBAI_API_KEY", () => {
		const orig = process.env.MXBAI_API_KEY;
		process.env.MXBAI_API_KEY = "test_mgrep_key";
		try {
			const env = getMinimalEnv("rg");
			assert.equal(env.MXBAI_API_KEY, undefined, "MXBAI_API_KEY should NOT be in rg profile");
		} finally {
			if (orig !== undefined) process.env.MXBAI_API_KEY = orig;
			else delete process.env.MXBAI_API_KEY;
		}
	});
});

// ── 4.4: runCommand uses minimal env ──────────────────────

describe("policy: runCommand env isolation", () => {
	test("4.4 runCommand uses minimal env (no sensitive keys in child process)", async () => {
		// Set a sensitive env var
		const orig = process.env.GITHUB_TOKEN;
		process.env.GITHUB_TOKEN = "ghp_test_secret_12345";
		try {
			// Spawn `env` (or `printenv`) and check the output doesn't contain our secret
			const { stdout } = await runCommand("node", ["-e", "console.log(JSON.stringify(process.env))"], {
				timeout: 5000,
			});
			const childEnv = JSON.parse(stdout);
			assert.equal(childEnv.GITHUB_TOKEN, undefined, "GITHUB_TOKEN should NOT be in child env");
		} finally {
			if (orig !== undefined) process.env.GITHUB_TOKEN = orig;
			else delete process.env.GITHUB_TOKEN;
		}
	});
});

// ── 4.5–4.9: getAutoInstallPolicy ────────────────────────

describe("policy: getAutoInstallPolicy", () => {
	test("4.5 defaults to 'never' when no env set", () => {
		const origPrimary = process.env.PI_SEARCH_AUTO_INSTALL;
		const origDeprecated = process.env.PI_MGREP_AUTO_INSTALL;
		delete process.env.PI_SEARCH_AUTO_INSTALL;
		delete process.env.PI_MGREP_AUTO_INSTALL;
		try {
			assert.equal(getAutoInstallPolicy(), "never");
		} finally {
			if (origPrimary !== undefined) process.env.PI_SEARCH_AUTO_INSTALL = origPrimary;
			if (origDeprecated !== undefined) process.env.PI_MGREP_AUTO_INSTALL = origDeprecated;
		}
	});

	test("4.6 PI_SEARCH_AUTO_INSTALL=always returns 'always'", () => {
		const orig = process.env.PI_SEARCH_AUTO_INSTALL;
		process.env.PI_SEARCH_AUTO_INSTALL = "always";
		try {
			assert.equal(getAutoInstallPolicy(), "always");
		} finally {
			if (orig !== undefined) process.env.PI_SEARCH_AUTO_INSTALL = orig;
			else delete process.env.PI_SEARCH_AUTO_INSTALL;
		}
	});

	test("4.7 PI_SEARCH_AUTO_INSTALL overrides PI_MGREP_AUTO_INSTALL", () => {
		const origPrimary = process.env.PI_SEARCH_AUTO_INSTALL;
		const origDeprecated = process.env.PI_MGREP_AUTO_INSTALL;
		process.env.PI_SEARCH_AUTO_INSTALL = "never";
		process.env.PI_MGREP_AUTO_INSTALL = "always";
		try {
			assert.equal(getAutoInstallPolicy(), "never", "Primary should win over deprecated");
		} finally {
			if (origPrimary !== undefined) process.env.PI_SEARCH_AUTO_INSTALL = origPrimary;
			else delete process.env.PI_SEARCH_AUTO_INSTALL;
			if (origDeprecated !== undefined) process.env.PI_MGREP_AUTO_INSTALL = origDeprecated;
			else delete process.env.PI_MGREP_AUTO_INSTALL;
		}
	});

	test("4.8 PI_MGREP_AUTO_INSTALL=always (no primary) returns 'always'", () => {
		const origPrimary = process.env.PI_SEARCH_AUTO_INSTALL;
		const origDeprecated = process.env.PI_MGREP_AUTO_INSTALL;
		delete process.env.PI_SEARCH_AUTO_INSTALL;
		process.env.PI_MGREP_AUTO_INSTALL = "always";
		try {
			assert.equal(getAutoInstallPolicy(), "always", "Deprecated fallback should work");
		} finally {
			if (origPrimary !== undefined) process.env.PI_SEARCH_AUTO_INSTALL = origPrimary;
			if (origDeprecated !== undefined) process.env.PI_MGREP_AUTO_INSTALL = origDeprecated;
			else delete process.env.PI_MGREP_AUTO_INSTALL;
		}
	});

	test("4.9 PI_SEARCH_AUTO_INSTALL=ask returns 'ask'", () => {
		const orig = process.env.PI_SEARCH_AUTO_INSTALL;
		process.env.PI_SEARCH_AUTO_INSTALL = "ask";
		try {
			assert.equal(getAutoInstallPolicy(), "ask");
		} finally {
			if (orig !== undefined) process.env.PI_SEARCH_AUTO_INSTALL = orig;
			else delete process.env.PI_SEARCH_AUTO_INSTALL;
		}
	});
});
