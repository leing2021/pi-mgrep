/**
 * U0/U4: RED → GREEN — Project-scoped temp dir tests
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
	getProjectScopedTempDir,
	ensureProjectScopedEmptyDir,
} from "../src/security.mjs";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

describe("temp-dir: getProjectScopedTempDir", () => {
	test("same cwd returns consistent temp dir", () => {
		const dir1 = getProjectScopedTempDir(process.cwd());
		const dir2 = getProjectScopedTempDir(process.cwd());
		assert.equal(dir1, dir2, "same cwd should return same temp dir");
		assert.ok(dir1.includes("pi-search-empty-"), "should contain pi-search-empty prefix");
	});

	test("different cwd returns different temp dir", () => {
		const dir1 = getProjectScopedTempDir("/tmp/project-a");
		const dir2 = getProjectScopedTempDir("/tmp/project-b");
		assert.notEqual(dir1, dir2, "different cwd should return different temp dirs");
	});

	test("temp dir path follows /tmp/pi-search-empty-* pattern", () => {
		const dir = getProjectScopedTempDir(process.cwd());
		assert.match(dir, /\/tmp\/pi-search-empty-[a-f0-9]+/, "should match expected pattern");
	});
});

describe("temp-dir: ensureProjectScopedEmptyDir", () => {
	test("creates empty dir if missing", () => {
		const dir = ensureProjectScopedEmptyDir(process.cwd());
		assert.ok(existsSync(dir), "dir should exist");
		// Cleanup
		try { rmSync(dir, { recursive: true }); } catch {}
	});

	test("dir is empty after ensure", () => {
		const dir = ensureProjectScopedEmptyDir(process.cwd());
		const contents = readdirSync(dir);
		assert.equal(contents.length, 0, "dir should be empty");
		try { rmSync(dir, { recursive: true }); } catch {}
	});
});
