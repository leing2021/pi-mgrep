/**
 * U0/U2: RED → GREEN — Path policy tests
 *
 * Tests for cwd boundary enforcement and sensitive path rejection.
 * RED: missing exports/functions should cause failures.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
	getPathPolicy,
	validateSearchPath,
} from "../src/security.mjs";
import { resolve, join } from "node:path";

// ── Path policy structure ─────────────────────────────────

describe("path-policy: getPathPolicy returns structured policy", () => {
	test("default policy has root set to cwd", () => {
		const policy = getPathPolicy();
		assert.ok(policy, "path policy should exist");
		assert.equal(policy.root, process.cwd(), "default root should be cwd");
		assert.equal(policy.outsideCwdAllowed, false, "default should not allow outside cwd");
	});

	test("policy with custom root", () => {
		const customRoot = "/tmp/test-project";
		const policy = getPathPolicy({ root: customRoot });
		assert.equal(policy.root, customRoot);
	});

	test("policy with outside cwd opt-in via env", () => {
		const orig = process.env.PI_SEARCH_ALLOW_OUTSIDE_CWD;
		process.env.PI_SEARCH_ALLOW_OUTSIDE_CWD = "always";
		try {
			const policy = getPathPolicy();
			assert.equal(policy.outsideCwdAllowed, true, "env opt-in should allow outside cwd");
		} finally {
			if (orig !== undefined) process.env.PI_SEARCH_ALLOW_OUTSIDE_CWD = orig;
			else delete process.env.PI_SEARCH_ALLOW_OUTSIDE_CWD;
		}
	});
});

// ── validateSearchPath — cwd boundary ─────────────────────

describe("path-policy: validateSearchPath cwd boundary", () => {
	test("cwd itself is allowed", () => {
		const result = validateSearchPath(process.cwd());
		assert.equal(result.allowed, true, "cwd should be allowed");
		assert.equal(result.deniedReason, null, "no denial reason for cwd");
	});

	test("subdirectory of cwd is allowed", () => {
		const subDir = join(process.cwd(), "src");
		const result = validateSearchPath(subDir);
		assert.equal(result.allowed, true, "cwd subdirectory should be allowed");
	});

	test("relative '.' is allowed", () => {
		const result = validateSearchPath(".");
		assert.equal(result.allowed, true, "'.' should be allowed");
	});

	test("'./src' is allowed", () => {
		const result = validateSearchPath("./src");
		assert.equal(result.allowed, true, "'./src' should be allowed");
	});

	test("'../' traversal is rejected", () => {
		const parent = resolve(process.cwd(), "..");
		const result = validateSearchPath(parent);
		assert.equal(result.allowed, false, "parent directory should be rejected");
		assert.equal(result.deniedReason, "PATH_OUTSIDE_CWD", "should have PATH_OUTSIDE_CWD code");
	});

	test("absolute path outside cwd is rejected", () => {
		const result = validateSearchPath("/etc/passwd");
		assert.equal(result.allowed, false, "/etc/passwd should be rejected");
		assert.ok(
			result.deniedReason === "PATH_OUTSIDE_CWD" || result.deniedReason === "SENSITIVE_PATH",
			"should be either outside cwd or sensitive",
		);
	});

	test("/private is rejected", () => {
		const result = validateSearchPath("/private/tmp");
		assert.equal(result.allowed, false);
	});

	test("/var is rejected", () => {
		const result = validateSearchPath("/var/log");
		assert.equal(result.allowed, false);
	});
});

// ── validateSearchPath — sensitive path rejection ──────────

describe("path-policy: sensitive paths are rejected even inside cwd", () => {
	test(".env file is rejected", () => {
		const envPath = join(process.cwd(), ".env");
		const result = validateSearchPath(envPath);
		assert.equal(result.allowed, false, ".env should be rejected");
		assert.equal(result.deniedReason, "SENSITIVE_PATH", "should have SENSITIVE_PATH code");
	});

	test(".ssh directory is rejected", () => {
		const sshPath = join(process.cwd(), ".ssh");
		const result = validateSearchPath(sshPath);
		assert.equal(result.allowed, false, ".ssh should be rejected");
		assert.equal(result.deniedReason, "SENSITIVE_PATH");
	});

	test(".aws directory is rejected", () => {
		const awsPath = join(process.cwd(), ".aws");
		const result = validateSearchPath(awsPath);
		assert.equal(result.allowed, false);
		assert.equal(result.deniedReason, "SENSITIVE_PATH");
	});

	test(".kube directory is rejected", () => {
		const kubePath = join(process.cwd(), ".kube");
		const result = validateSearchPath(kubePath);
		assert.equal(result.allowed, false);
		assert.equal(result.deniedReason, "SENSITIVE_PATH");
	});

	test(".npmrc file is rejected", () => {
		const npmrcPath = join(process.cwd(), ".npmrc");
		const result = validateSearchPath(npmrcPath);
		assert.equal(result.allowed, false);
		assert.equal(result.deniedReason, "SENSITIVE_PATH");
	});

	test("id_rsa file is rejected", () => {
		const keyPath = join(process.cwd(), "id_rsa");
		const result = validateSearchPath(keyPath);
		assert.equal(result.allowed, false);
		assert.equal(result.deniedReason, "SENSITIVE_PATH");
	});

	test("id_ed25519 file is rejected", () => {
		const keyPath = join(process.cwd(), "id_ed25519");
		const result = validateSearchPath(keyPath);
		assert.equal(result.allowed, false);
		assert.equal(result.deniedReason, "SENSITIVE_PATH");
	});

	test(".pem file is rejected", () => {
		const pemPath = join(process.cwd(), "server.pem");
		const result = validateSearchPath(pemPath);
		assert.equal(result.allowed, false);
		assert.equal(result.deniedReason, "SENSITIVE_PATH");
	});

	test(".key file is rejected", () => {
		const keyPath = join(process.cwd(), "server.key");
		const result = validateSearchPath(keyPath);
		assert.equal(result.allowed, false);
		assert.equal(result.deniedReason, "SENSITIVE_PATH");
	});
});

// ── validateSearchPath — outside cwd opt-in ───────────────

describe("path-policy: outside cwd opt-in still rejects sensitive", () => {
	test("outside cwd non-sensitive path is allowed with opt-in", () => {
		const orig = process.env.PI_SEARCH_ALLOW_OUTSIDE_CWD;
		process.env.PI_SEARCH_ALLOW_OUTSIDE_CWD = "always";
		try {
			const otherDir = resolve(process.cwd(), "../other-project/src");
			const result = validateSearchPath(otherDir);
			assert.equal(result.allowed, true, "non-sensitive outside cwd should be allowed with opt-in");
		} finally {
			if (orig !== undefined) process.env.PI_SEARCH_ALLOW_OUTSIDE_CWD = orig;
			else delete process.env.PI_SEARCH_ALLOW_OUTSIDE_CWD;
		}
	});

	test("sensitive path remains rejected even with opt-in", () => {
		const orig = process.env.PI_SEARCH_ALLOW_OUTSIDE_CWD;
		process.env.PI_SEARCH_ALLOW_OUTSIDE_CWD = "always";
		try {
			const envPath = join(process.cwd(), ".env");
			const result = validateSearchPath(envPath);
			assert.equal(result.allowed, false, ".env must still be rejected with opt-in");
			assert.equal(result.deniedReason, "SENSITIVE_PATH");
		} finally {
			if (orig !== undefined) process.env.PI_SEARCH_ALLOW_OUTSIDE_CWD = orig;
			else delete process.env.PI_SEARCH_ALLOW_OUTSIDE_CWD;
		}
	});

	test("~/.ssh is rejected even with opt-in", () => {
		const orig = process.env.PI_SEARCH_ALLOW_OUTSIDE_CWD;
		process.env.PI_SEARCH_ALLOW_OUTSIDE_CWD = "always";
		try {
			const result = validateSearchPath("/home/user/.ssh/id_rsa");
			assert.equal(result.allowed, false);
			assert.equal(result.deniedReason, "SENSITIVE_PATH");
		} finally {
			if (orig !== undefined) process.env.PI_SEARCH_ALLOW_OUTSIDE_CWD = orig;
			else delete process.env.PI_SEARCH_ALLOW_OUTSIDE_CWD;
		}
	});
});

// ── validateSearchPath — return shape ─────────────────────

describe("path-policy: return shape", () => {
	test("allowed path returns correct fields", () => {
		const result = validateSearchPath(".");
		assert.equal(result.allowed, true);
		assert.ok(result.requestedPath, "should have requestedPath");
		assert.ok(result.resolvedPath, "should have resolvedPath");
		assert.ok(result.root, "should have root");
		assert.equal(result.deniedReason, null, "no denial reason");
	});
});
