/**
 * pi-search — CLI capability detection
 *
 * Detects if CLI tools exist on the system and whether they are enabled
 * via environment variables. Results are cached at module level.
 *
 * Tools:
 *   - local:  htmlq, pdftotext  (PI_SEARCH_LOCAL_CLI_ENHANCEMENTS=auto|never)
 *   - network: gh               (PI_SEARCH_NETWORK_CLI_ENHANCEMENTS=always|never)
 *
 * Exports:
 *   - detectCliCapabilities()
 *   - hasCapability(name)
 *   - isLocalCliEnabled()
 *   - isNetworkCliEnabled()
 *   - isToolEnabled(name)
 *   - resetCapabilities()
 */

import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

// ── Tool classification ──────────────────────────────────

const LOCAL_TOOLS = ["htmlq", "pdftotext"];
const NETWORK_TOOLS = ["gh"];
const ALL_TOOLS = [...LOCAL_TOOLS, ...NETWORK_TOOLS];

const TOOL_CATEGORY = Object.fromEntries([
	...LOCAL_TOOLS.map((t) => [t, "local"]),
	...NETWORK_TOOLS.map((t) => [t, "network"]),
]);

// ── findInPath (mirrors security.ts pattern) ─────────────

function findInPath(cmd) {
	const pathEnv = process.env.PATH ?? "";
	const dirs = pathEnv.split(process.platform === "win32" ? ";" : ":");
	for (const dir of dirs) {
		try {
			const full = join(dir, cmd);
			if (existsSync(full)) {
				const stat = statSync(full);
				if (stat.isFile() && (stat.mode & 0o111) !== 0) {
					return true;
				}
			}
		} catch {}
	}
	return false;
}

// ── Cached capabilities (singleton promise + sync mirror) ─

let cachedPromise = null;
let syncCache = null;

function buildCapabilities() {
	const result = {};
	for (const tool of ALL_TOOLS) {
		result[tool] = findInPath(tool);
	}
	return result;
}

/**
 * Detect which CLI tools are available on the system.
 * Results are cached — call resetCapabilities() to force re-detection.
 * @returns {Promise<{gh: boolean, htmlq: boolean, pdftotext: boolean}>}
 */
export async function detectCliCapabilities() {
	if (!cachedPromise) {
		const result = buildCapabilities();
		syncCache = result;
		cachedPromise = Promise.resolve(result);
	}
	return cachedPromise;
}

/**
 * Check if a specific tool was detected as available.
 * Must call detectCliCapabilities() first to populate cache.
 * @param {string} name — tool name (e.g. "gh", "htmlq", "pdftotext")
 * @returns {boolean}
 */
export function hasCapability(name) {
	return syncCache?.[name] ?? false;
}

/**
 * Whether local CLI enhancements (htmlq, pdftotext) are enabled.
 * Reads PI_SEARCH_LOCAL_CLI_ENHANCEMENTS (auto|never, default: auto).
 */
export function isLocalCliEnabled() {
	const val = process.env.PI_SEARCH_LOCAL_CLI_ENHANCEMENTS ?? "auto";
	return val === "auto";
}

/**
 * Whether network CLI enhancements (gh) are enabled.
 * Reads PI_SEARCH_NETWORK_CLI_ENHANCEMENTS (always|never, default: never).
 */
export function isNetworkCliEnabled() {
	const val = process.env.PI_SEARCH_NETWORK_CLI_ENHANCEMENTS ?? "never";
	return val === "always";
}

/**
 * Check if a tool is both detected AND enabled via its category env var.
 * @param {string} name — tool name
 * @returns {boolean}
 */
export function isToolEnabled(name) {
	if (!(name in TOOL_CATEGORY)) return false;

	const category = TOOL_CATEGORY[name];
	const categoryEnabled =
		category === "local" ? isLocalCliEnabled() : isNetworkCliEnabled();

	if (!categoryEnabled) return false;
	return syncCache?.[name] ?? false;
}

/**
 * Reset cached capability results (for testing).
 */
export function resetCapabilities() {
	cachedPromise = null;
	syncCache = null;
}
