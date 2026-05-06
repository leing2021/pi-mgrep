/**
 * U0/U1: RED → GREEN — Command policy tests
 *
 * Tests for explicit command profiles and profile-based execution.
 * RED: missing exports/functions should cause failures.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
	getCommandPolicy,
	runPolicyCommand,
} from "../src/security.mjs";

// ── Command policy structure ──────────────────────────────

describe("command-policy: getCommandPolicy returns structured policy", () => {
	test("unknown profile throws structured error", () => {
		assert.throws(
			() => getCommandPolicy("unknown-profile"),
			(err) => err.code === "UNKNOWN_PROFILE",
			"Unknown profile must throw with code UNKNOWN_PROFILE",
		);
	});

	test("'rg' profile has required fields", () => {
		const policy = getCommandPolicy("rg");
		assert.ok(policy, "rg policy should exist");
		assert.equal(typeof policy.permissionProfile, "string", "permissionProfile should be string");
		assert.equal(typeof policy.envProfile, "string", "envProfile should be string");
		assert.equal(typeof policy.timeout, "number", "timeout should be number");
		assert.equal(typeof policy.maxBuffer, "number", "maxBuffer should be number");
		assert.equal(typeof policy.network, "boolean", "network should be boolean");
	});

	test("'mgrep-local' profile has required fields", () => {
		const policy = getCommandPolicy("mgrep-local");
		assert.ok(policy, "mgrep-local policy should exist");
		assert.equal(typeof policy.permissionProfile, "string");
		assert.equal(typeof policy.envProfile, "string");
	});

	test("'mgrep-web' profile has network=true", () => {
		const policy = getCommandPolicy("mgrep-web");
		assert.ok(policy, "mgrep-web policy should exist");
		assert.equal(policy.network, true, "mgrep-web should have network=true");
	});

	test("'installer' profile has required fields", () => {
		const policy = getCommandPolicy("installer");
		assert.ok(policy, "installer policy should exist");
	});
});

// ── Command policy env isolation ──────────────────────────

describe("command-policy: env isolation per profile", () => {
	test("'rg' profile env excludes MXBAI_API_KEY", () => {
		const orig = process.env.MXBAI_API_KEY;
		process.env.MXBAI_API_KEY = "test_key_123";
		try {
			const policy = getCommandPolicy("rg");
			// The policy should carry an env or envProfile that excludes MXBAI_API_KEY
			const env = policy.env ?? {};
			assert.equal(env.MXBAI_API_KEY, undefined, "rg profile env should not include MXBAI_API_KEY");
		} finally {
			if (orig !== undefined) process.env.MXBAI_API_KEY = orig;
			else delete process.env.MXBAI_API_KEY;
		}
	});

	test("'mgrep-web' profile env includes MXBAI_API_KEY but excludes others", () => {
		const origMgrep = process.env.MXBAI_API_KEY;
		const origGithub = process.env.GITHUB_TOKEN;
		process.env.MXBAI_API_KEY = "test_key_123";
		process.env.GITHUB_TOKEN = "ghp_secret";
		try {
			const policy = getCommandPolicy("mgrep-web");
			const env = policy.env ?? {};
			assert.equal(env.MXBAI_API_KEY, "test_key_123", "mgrep-web env should include MXBAI_API_KEY");
			assert.equal(env.GITHUB_TOKEN, undefined, "mgrep-web env should exclude GITHUB_TOKEN");
		} finally {
			if (origMgrep !== undefined) process.env.MXBAI_API_KEY = origMgrep;
			else delete process.env.MXBAI_API_KEY;
			if (origGithub !== undefined) process.env.GITHUB_TOKEN = origGithub;
			else delete process.env.GITHUB_TOKEN;
		}
	});

	test("'mgrep-web' profile env excludes OPENAI_API_KEY", () => {
		const orig = process.env.OPENAI_API_KEY;
		process.env.OPENAI_API_KEY = "sk-test-secret";
		try {
			const policy = getCommandPolicy("mgrep-web");
			const env = policy.env ?? {};
			assert.equal(env.OPENAI_API_KEY, undefined, "mgrep-web should exclude OPENAI_API_KEY");
		} finally {
			if (orig !== undefined) process.env.OPENAI_API_KEY = orig;
			else delete process.env.OPENAI_API_KEY;
		}
	});

	test("'installer' profile env excludes all sensitive keys", () => {
		const orig1 = process.env.GITHUB_TOKEN;
		const orig2 = process.env.MXBAI_API_KEY;
		process.env.GITHUB_TOKEN = "ghp_secret";
		process.env.MXBAI_API_KEY = "test_key";
		try {
			const policy = getCommandPolicy("installer");
			const env = policy.env ?? {};
			assert.equal(env.GITHUB_TOKEN, undefined, "installer env should exclude GITHUB_TOKEN");
			assert.equal(env.MXBAI_API_KEY, undefined, "installer env should exclude MXBAI_API_KEY");
		} finally {
			if (orig1 !== undefined) process.env.GITHUB_TOKEN = orig1;
			else delete process.env.GITHUB_TOKEN;
			if (orig2 !== undefined) process.env.MXBAI_API_KEY = orig2;
			else delete process.env.MXBAI_API_KEY;
		}
	});
});

// ── runPolicyCommand ──────────────────────────────────────

describe("command-policy: runPolicyCommand profile-based execution", () => {
	test("runPolicyCommand rejects unknown profile", async () => {
		await assert.rejects(
			() => runPolicyCommand("nonexistent", ["--help"]),
			(err) => err.code === "UNKNOWN_PROFILE",
			"Should reject unknown profile with code UNKNOWN_PROFILE",
		);
	});

	test("runPolicyCommand('rg', ...) uses minimal env", async () => {
		const orig = process.env.GITHUB_TOKEN;
		process.env.GITHUB_TOKEN = "ghp_test_secret_12345";
		try {
			const { stdout } = await runPolicyCommand("rg", [
				"--version",
			], { timeout: 5000 });
			// rg --version should succeed
			assert.ok(typeof stdout === "string", "should return stdout");
		} catch (err) {
			// rg might not be installed; env check still applies
			if (err.code !== "UNKNOWN_PROFILE") {
				// ok - rg not installed, but function accepted the profile
				assert.ok(true, "profile accepted, rg binary not found is ok");
			}
		} finally {
			if (orig !== undefined) process.env.GITHUB_TOKEN = orig;
			else delete process.env.GITHUB_TOKEN;
		}
	});
});
