/**
 * pi-search — Runtime security helpers
 *
 * Extracted from extensions/pi-search.ts for testability.
 * Zero external dependencies. Pure ESM.
 *
 * Exports:
 *   - getMinimalEnv(profile)
 *   - runCommand(cmd, args, opts)
 *   - getAutoInstallPolicy()
 *   - attemptAutoInstall(name, args, env)
 *   - findInPath(cmd)
 *   - getKnownBinPaths(name)
 *   - resolveRg()
 *   - resolveMgrep()
 *   - validateUrl(urlStr, opts)
 *   - sanitizeHtml(html)
 *   - safeFetchText(url, opts)
 *   - isPrivateIP(ip)

 *   - SENSITIVE_ENV_KEYS
 *
 * Test seam: _dnsLookup option on safeFetchText/validateUrl.
 *   - Underscore prefix = internal, NOT public API.
 *   - Defaults to undefined = real DNS.
 *   - No bypass in production.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, readdirSync, statSync } from "node:fs";
import { platform, homedir } from "node:os";
import { join } from "node:path";
import https from "node:https";
import http from "node:http";
import { lookup as realDnsLookup } from "node:dns/promises";

import { URL as NodeURL } from "node:url";

const execFileAsync = promisify(execFile);

// ── Sensitive env keys that must NEVER be forwarded ──────

export const SENSITIVE_ENV_KEYS = new Set([
	"SSH_AUTH_SOCK",
	"GITHUB_TOKEN",
	"GITHUB_API_TOKEN",
	"GITHUB_PERSONAL_ACCESS_TOKEN",
	"AWS_ACCESS_KEY_ID",
	"AWS_SECRET_ACCESS_KEY",
	"AWS_SESSION_TOKEN",
	"AWS_REGION",
	"GOOGLE_APPLICATION_CREDENTIALS",
	"GOOGLE_CLOUD_PROJECT",
	"GOOGLE_API_KEY",
	"AZURE_SUBSCRIPTION_ID",
	"AZURE_CLIENT_ID",
	"AZURE_CLIENT_SECRET",
	"AZURE_TENANT_ID",
	"NPM_TOKEN",
	"OPENAI_API_KEY",
	"ANTHROPIC_API_KEY",
	"PI_SEARCH_API_KEY",
	"MXBAI_API_KEY",
]);

// ── Env allowlist ────────────────────────────────────────

export function getMinimalEnv(profile = "which") {
	const allowed = new Set(["PATH", "HOME", "USER", "LANG", "LC_ALL", "TZ"]);
	if (profile === "mgrep" || profile === "mgrep-web") {
		allowed.add("MXBAI_API_KEY");
	}

	const base = {};
	for (const key of allowed) {
		if (process.env[key]) base[key] = process.env[key];
	}
	for (const key of SENSITIVE_ENV_KEYS) {
		if (key !== "MXBAI_API_KEY" || (profile !== "mgrep" && profile !== "mgrep-web")) {
			delete base[key];
		}
	}
	return base;
}

// ── Least-privilege command runner ───────────────────────

export async function runCommand(
	cmd,
	args,
	options = {},
) {
	const env = options.env ?? getMinimalEnv("which");
	const timeout = options.timeout ?? 15000;
	const maxBuffer = options.maxBuffer ?? 1024 * 1024;
	try {
		const { stdout, stderr } = await execFileAsync(cmd, args, {
			timeout,
			maxBuffer,
			env,
			cwd: options.cwd,
		});
		return { stdout, stderr };
	} catch (err) {
		const code = err.code ?? "UNKNOWN";
		const msg = err.message ?? "";
		throw Object.assign(new Error(`runCommand(${cmd}) failed [${code}]: ${msg}`), {
			code,
			stdout: err.stdout ?? "",
			stderr: err.stderr ?? "",
		});
	}
}

// ── Auto-install policy ───────────────────────────────────

export function getAutoInstallPolicy() {
	const primary = process.env.PI_SEARCH_AUTO_INSTALL;
	const deprecated = process.env.PI_MGREP_AUTO_INSTALL;
	const raw = primary ?? deprecated ?? "never";
	switch (raw.toLowerCase()) {
		case "always": return "always";
		case "ask": return "ask";
		default: return "never";
	}
}

// ── Binary resolution ─────────────────────────────────────

export function findInPath(cmd) {
	const pathEnv = process.env.PATH ?? "";
	const dirs = pathEnv.split(process.platform === "win32" ? ";" : ":");
	for (const dir of dirs) {
		try {
			const full = join(dir, cmd);
			if (existsSync(full)) {
				const stat = statSync(full);
				if (stat.isFile() && (stat.mode & 0o111) !== 0) {
					return full;
				}
			}
		} catch {}
	}
	return null;
}

export function getKnownBinPaths(name) {
	const home = homedir();
	const nvmBase = `${home}/.nvm/versions/node`;
	const nvmPaths = [];
	try {
		if (existsSync(nvmBase)) {
			for (const ver of readdirSync(nvmBase)) {
				const candidate = join(nvmBase, ver, "bin", name);
				if (existsSync(candidate)) nvmPaths.push(candidate);
			}
		}
	} catch {}
	return [
		`/opt/homebrew/bin/${name}`,
		`/usr/local/bin/${name}`,
		`/usr/bin/${name}`,
		`${home}/.cargo/bin/${name}`,
		`${home}/.local/bin/${name}`,
		...nvmPaths,
	];
}

export async function attemptAutoInstall(name, installArgs, installEnv) {
	const policy = getAutoInstallPolicy();
	if (policy === "never" || policy === "ask") return null;
	try {
		await runCommand(installArgs[0], installArgs.slice(1), {
			timeout: 120000,
			maxBuffer: 64 * 1024,
			env: installEnv,
			sandboxMode: "process-env-cwd-timeout",
		});
		return findInPath(name);
	} catch {
		return null;
	}
}

let RG_BIN = null;
let MGREP_BIN = null;
let rgPromise = null;
let mgrepPromise = null;

export function resolveRg() {
	if (RG_BIN) return Promise.resolve(RG_BIN);
	if (rgPromise) return rgPromise;

	rgPromise = (async () => {
		const fromPath = findInPath("rg");
		if (fromPath) { RG_BIN = fromPath; return fromPath; }

		for (const d of getKnownBinPaths("rg")) {
			if (existsSync(d)) { RG_BIN = d; return d; }
		}

		const policy = getAutoInstallPolicy();
		if (policy === "never" || policy === "ask") return null;

		const os = platform();
		if (os === "darwin") {
			const installed = await attemptAutoInstall("rg", ["brew", "install", "ripgrep"], getMinimalEnv("installer"));
			if (installed) { RG_BIN = installed; return installed; }
		}
		return null;
	})();

	return rgPromise;
}

export function resolveMgrep() {
	if (MGREP_BIN) return Promise.resolve(MGREP_BIN);
	if (mgrepPromise) return mgrepPromise;

	mgrepPromise = (async () => {
		const fromPath = findInPath("mgrep");
		if (fromPath) { MGREP_BIN = fromPath; return fromPath; }

		for (const d of [
			"/opt/homebrew/bin/mgrep",
			"/usr/local/bin/mgrep",
			`${homedir()}/.cargo/bin/mgrep`,
		]) {
			if (existsSync(d)) { MGREP_BIN = d; return d; }
		}

		if (getAutoInstallPolicy() === "never" || getAutoInstallPolicy() === "ask") return null;

		const installed = await attemptAutoInstall(
			"mgrep",
			["npm", "install", "-g", "@mixedbread/mgrep"],
			getMinimalEnv("installer"),
		);
		if (installed) { MGREP_BIN = installed; return installed; }
		return null;
	})();

	return mgrepPromise;
}

// ── Safe Fetch ────────────────────────────────────────────

const PRIVATE_IP_PATTERNS = [
	{ pattern: /^127\./, name: "loopback-127" },
	{ pattern: /^10\./, name: "private-10" },
	{ pattern: /^172\.(1[6-9]|2[0-9]|3[0-1])\./, name: "private-172" },
	{ pattern: /^192\.168\./, name: "private-192" },
	{ pattern: /^169\.254\./, name: "link-local-169" },
	{ pattern: /^0\./, name: "reserved-0" },
];

const BLOCKED_HOSTS = new Set([
	"localhost",
	"localhost.localdomain",
	"ip6-localhost",
	"ip6-loopback",
	"metadata.google.internal",
	"metadata",
]);

const BLOCKED_IPS = new Set([
	"0.0.0.0",
	"0.0.0.1",
	"::",
	"::1",
	"fc00::",
	"fd00::",
	"fe80::",
	"ff00::",
]);

const METADATA_IPS = new Set([
	"169.254.169.254",
	"169.254.169.253",
	"169.254.169.251",
	"169.254.169.250",
	"fd00:0000:0000:0000:0000:0000:169.254.169.254",
]);

const CONTENT_TYPE_ALLOWLIST = [
	"text/html",
	"text/plain",
	"application/xhtml+xml",
];

const CONTENT_TYPE_TEXT_GUARD = /^text\//;

export function isPrivateIP(ip) {
	for (const { pattern } of PRIVATE_IP_PATTERNS) {
		if (pattern.test(ip)) return true;
	}
	return false;
}

export async function validateUrl(urlStr, options = {}) {
	const dnsLookup = options._dnsLookup ?? null;

	if (urlStr.length > 4096) {
		throw Object.assign(new Error(`URL too long (${urlStr.length} > 4096 chars)`), { code: "URL_TOO_LONG" });
	}

	let parsed;
	try {
		parsed = new NodeURL(urlStr);
	} catch {
		throw Object.assign(new Error(`Invalid URL: ${urlStr}`), { code: "INVALID_URL" });
	}

	const scheme = parsed.protocol.toLowerCase();
	if (scheme === "https:") {
		// HTTPS allowed
	} else if (scheme === "http:") {
		if (!options.allowHttp) {
			throw Object.assign(new Error("HTTP not allowed. Only HTTPS is permitted."), { code: "SCHEME_REJECTED" });
		}
	} else {
		throw Object.assign(new Error(`Scheme '${scheme}' not allowed. Only https: permitted.`), { code: "SCHEME_REJECTED" });
	}

	if (parsed.username || parsed.password) {
		throw Object.assign(new Error("URL credentials not permitted."), { code: "CREDS_REJECTED" });
	}

	const hostname = parsed.hostname.toLowerCase();

	if (BLOCKED_HOSTS.has(hostname)) {
		throw Object.assign(new Error(`Hostname '${hostname}' is blocked.`), { code: "HOST_BLOCKED" });
	}

	// DNS resolution — use seam if provided, otherwise real DNS
	if (dnsLookup) {
		const result = await dnsLookup(hostname);
		const ip = typeof result === "string" ? result : result.address;

		if (BLOCKED_IPS.has(ip)) {
			throw Object.assign(new Error(`IP '${ip}' is blocked.`), { code: "IP_BLOCKED" });
		}
		if (isPrivateIP(ip)) {
			throw Object.assign(new Error(`Private IP '${ip}' resolved from '${hostname}' is blocked.`), { code: "PRIVATE_IP" });
		}
		if (METADATA_IPS.has(ip)) {
			throw Object.assign(new Error(`Metadata IP '${ip}' is blocked.`), { code: "METADATA_IP" });
		}
	} else {
		// No seam — use real DNS
		const result = await realDnsLookup(hostname);
		const ip = result.address;

		if (BLOCKED_IPS.has(ip)) {
			throw Object.assign(new Error(`IP '${ip}' is blocked.`), { code: "IP_BLOCKED" });
		}
		if (isPrivateIP(ip)) {
			throw Object.assign(new Error(`Private IP '${ip}' resolved from '${hostname}' is blocked.`), { code: "PRIVATE_IP" });
		}
		if (METADATA_IPS.has(ip)) {
			throw Object.assign(new Error(`Metadata IP '${ip}' is blocked.`), { code: "METADATA_IP" });
		}
	}
}

export function sanitizeHtml(html) {
	const riskFlags = [];
	const lower = html.toLowerCase();

	const suspiciousPatterns = [
		"ignore previous instructions",
		"ignore all previous instructions",
		"system prompt",
		"developer message",
		"you are now",
		"do not tell the user",
		"do not inform the user",
		"exfiltrate",
		"send this data",
		"send this information",
		"ignore prior directives",
	];
	for (const phrase of suspiciousPatterns) {
		if (lower.includes(phrase)) {
			riskFlags.push(`prompt-injection-suspicion: "${phrase}"`);
		}
	}

	if (/display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0/.test(html)) {
		riskFlags.push("hidden-css-detected");
	}
	if (/<(input|textarea)\b[^>]*hidden/i.test(html)) {
		riskFlags.push("hidden-form-element-detected");
	}

	let text = html;
	// Remove dangerous tags
	text = text.replace(/<(script|style|noscript|iframe|object|embed|svg|math|head|noframes)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
	text = text.replace(/<(script|style|noscript|iframe|object|embed|svg|math|head|noframes)\b[^>]*\/\s*>/gi, " ");
	// Remove HTML comments
	text = text.replace(/<!--[\s\S]*?-->/g, " ");
	// Remove event handlers and dangerous URL schemes
	text = text.replace(/\son\w+\s*=/gi, " ");
	text = text.replace(/\bjavascript\s*:/gi, " ");
	text = text.replace(/\bdata\s*:\s*/gi, " ");
	// Strip all remaining HTML tags
	text = text.replace(/<[^>]+>/g, " ");
	// Decode entities
	text = text
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#x27;/g, "'");
	// Collapse whitespace
	text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

	return { text, riskFlags };
}

/**
 * @typedef {Object} SafeFetchResult
 * @property {string} text
 * @property {string} finalUrl
 * @property {string[]} redirects
 * @property {number} statusCode
 * @property {string} contentType
 * @property {number} bytesRead
 * @property {number} charsReturned
 * @property {boolean} truncated
 * @property {string[]} riskFlags
 * @property {"compact"|"quotes"|"full"} mode
 */

/**
 * SSRF-safe web fetch.
 *
 * @param {string} url
 * @param {object} [options]
 * @param {boolean} [options.allowHttp=false]
 * @param {number} [options.maxChars=6000]
 * @param {number} [options.maxBytes=5242880]
 * @param {number} [options.maxRedirects=3]
 * @param {number} [options.timeout=10000]
 * @param {string[]|null} [options.allowedHosts=null]
 * @param {"compact"|"quotes"|"full"} [options.mode="compact"]
 * @param {function} [options._dnsLookup] - Test seam: custom DNS lookup. NOT public API.
 * @returns {Promise<SafeFetchResult>}
 */
export async function safeFetchText(
	url,
	options = {},
) {
	const maxChars = options.maxChars ?? 6000;
	const maxBytes = options.maxBytes ?? 5 * 1024 * 1024;
	const maxRedirects = options.maxRedirects ?? 3;
	const timeoutMs = options.timeout ?? 10000;
	const allowedHosts = options.allowedHosts ?? null;
	const mode = options.mode ?? "compact";

	await validateUrl(url, { allowHttp: options.allowHttp, _dnsLookup: options._dnsLookup });

	const redirects = [];
	let currentUrl = url;
	let bytesRead = 0;
	let statusCode = 0;
	let contentType = "";
	let bodyText = "";

	for (let attempt = 0; attempt <= maxRedirects; attempt++) {
		let parsed;
		try {
			parsed = new NodeURL(currentUrl);
		} catch {
			throw Object.assign(new Error(`Invalid URL: ${currentUrl}`), { code: "INVALID_URL" });
		}

		if (allowedHosts !== null && !allowedHosts.includes(parsed.hostname.toLowerCase())) {
			throw Object.assign(
				new Error(`Host '${parsed.hostname}' not in allowed list.`),
				{ code: "HOST_REJECTED" },
			);
		}

		await validateUrl(currentUrl, { allowHttp: options.allowHttp, _dnsLookup: options._dnsLookup });

		const protocol = parsed.protocol === "https:" ? https : http;

		const result = await new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				reject(Object.assign(new Error("Fetch timeout"), { code: "TIMEOUT" }));
			}, timeoutMs);

			const req = protocol.get(currentUrl, {
				headers: {
					"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
					"Accept": "text/html,text/plain,application/xhtml+xml,*/*",
					"Accept-Language": "en-US,en;q=0.9",
				},
			}, (res) => {
				clearTimeout(timer);
				let body = "";
				let len = 0;
				res.on("data", (chunk) => {
					len += Buffer.byteLength(chunk);
					if (len > maxBytes) {
						res.destroy();
						reject(Object.assign(new Error(`Response too large (>${maxBytes} bytes)`), { code: "SIZE_LIMIT" }));
						return;
					}
					body += chunk.toString();
				});
				res.on("end", () => {
					resolve({ statusCode: res.statusCode ?? 0, headers: res.headers, body });
				});
				res.on("error", reject);
			});
			req.on("error", (err) => {
				clearTimeout(timer);
				reject(err);
			});
		});

		statusCode = result.statusCode;
		contentType = (result.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();

		if (statusCode >= 300 && statusCode < 400 && result.headers.location) {
			try {
				currentUrl = new NodeURL(result.headers.location, currentUrl).toString();
				redirects.push(currentUrl);
				bytesRead += Buffer.byteLength(result.body);
				continue;
			} catch {
				throw Object.assign(new Error("Invalid redirect URL"), { code: "INVALID_REDIRECT" });
			}
		}

		const contentLength = result.headers["content-length"];
		if (contentLength) {
			const cl = parseInt(contentLength, 10);
			if (!isNaN(cl) && cl > maxBytes) {
				throw Object.assign(new Error(`Content-Length ${cl} exceeds max.`), { code: "SIZE_LIMIT" });
			}
		}

		const isAllowed = CONTENT_TYPE_ALLOWLIST.includes(contentType) || CONTENT_TYPE_TEXT_GUARD.test(contentType);
		if (!isAllowed) {
			throw Object.assign(new Error(`Content-Type '${contentType}' not allowed.`), { code: "CONTENT_TYPE_REJECTED" });
		}

		bytesRead += Buffer.byteLength(result.body);
		bodyText = result.body;
		break;
	}

	const { text: rawText, riskFlags } = sanitizeHtml(bodyText);

	let outputText;
	let charsReturned;

	if (mode === "full") {
		outputText = rawText.slice(0, maxChars);
		charsReturned = outputText.length;
	} else if (mode === "quotes") {
		const sentences = rawText.split(/[.!?]+\s/).filter(s => s.trim().length > 30).slice(0, 6);
		outputText = sentences.map(s => `> ${s.trim()}`).join("\n");
		if (outputText.length > maxChars) outputText = outputText.slice(0, maxChars);
		charsReturned = outputText.length;
	} else {
		// compact: first paragraphs
		const paragraphs = rawText.split(/\n{2,}/).filter(p => p.trim().length > 20).slice(0, 4);
		outputText = paragraphs.join("\n\n");
		if (outputText.length > maxChars) outputText = outputText.slice(0, maxChars);
		charsReturned = outputText.length;
	}

	const truncated = rawText.length > maxChars;

	return {
		text: outputText,
		finalUrl: currentUrl,
		redirects,
		statusCode,
		contentType,
		bytesRead,
		charsReturned,
		truncated,
		riskFlags,
		mode,
	};
}
