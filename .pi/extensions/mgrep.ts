/**
 * pi-mgrep — Unified Search Extension for Pi Coding Agent
 *
 * One dependency: mgrep CLI (npm i -g @mixedbread/mgrep)
 * Three tools, zero-config.
 *
 *   search       → mgrep local (exact patterns + semantic NL queries)
 *   web_search   → mgrep web → DuckDuckGo fallback
 *   web_fetch    → fetch URL, strip HTML, return plain text
 *
 * Commands: /search, /web, /fetch
 *
 * https://github.com/leing2021/pi-mgrep
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { execFile, execSync } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";

const execFileAsync = promisify(execFile);

// ── Auto-install mgrep ──────────────────────────────────

let MGREP_BIN: string | null = null;
let installPromise: Promise<string | null> | null = null;

function resolveMgrep(): Promise<string | null> {
	if (MGREP_BIN) return Promise.resolve(MGREP_BIN);
	if (installPromise) return installPromise;

	installPromise = (async () => {
		// 1. Try PATH
		try {
			const p = execSync("which mgrep 2>/dev/null", { encoding: "utf-8", timeout: 3000 }).trim();
			if (p) { MGREP_BIN = p; return p; }
		} catch {}

		// 2. Try known locations
		for (const d of [process.env.HOME + "/.nvm/versions/node/*/bin/mgrep", "/opt/homebrew/bin/mgrep", "/usr/local/bin/mgrep"]) {
			try {
				const globbed = execSync(`ls ${d} 2>/dev/null`, { encoding: "utf-8", timeout: 3000 }).trim().split("\n")[0];
				if (globbed && existsSync(globbed)) { MGREP_BIN = globbed; return globbed; }
			} catch {}
		}

		// 3. Auto-install globally
		try {
			execSync("npm install -g @mixedbread/mgrep", { stdio: "pipe", timeout: 60000 });
			const p = execSync("which mgrep 2>/dev/null", { encoding: "utf-8", timeout: 3000 }).trim();
			if (p) { MGREP_BIN = p; return p; }
		} catch (e: any) {
			// npm may need sudo on some systems — inform, don't crash
			if (e.stderr?.includes("EACCES") || e.stderr?.includes("permission denied")) {
				console.error("[pi-mgrep] Auto-install failed (permission). Run: npm install -g @mixedbread/mgrep");
			} else {
				console.error("[pi-mgrep] Auto-install failed:", e.message?.slice(0, 80));
			}
		} catch {}

		return null;
	})();

	return installPromise;
}

// ── Helpers ──────────────────────────────────────────────

const MAX = 6000;

function trunc(text: string, max = MAX): string {
	return text.length <= max ? text : text.slice(0, max) + `\n... (truncated, ${text.length} total chars)`;
}

function run(cmd: string, args: string[], timeout = 15000): Promise<string> {
	return execFileAsync(cmd, args, { timeout, maxBuffer: 1024 * 1024 })
		.then(({ stdout }) => stdout)
		.catch((err) => `Error: ${err.message}`);
}

function isMgrepError(raw: string): boolean {
	return raw.startsWith("Error:") || raw.includes("ETIMEDOUT") || raw.includes("ENOTFOUND")
		|| raw.includes("401") || raw.includes("403") || raw.includes("rate limit");
}

function filterWeb(raw: string, n: number): string {
	const urls: string[] = [];
	const seen = new Set<string>();
	for (const line of raw.split("\n")) {
		const t = line.trim();
		if (t.startsWith("http://") || t.startsWith("https://")) {
			const url = t.split(" (")[0];
			if (url && !seen.has(url)) { seen.add(url); urls.push(t); }
		}
	}
	return urls.slice(0, n).join("\n") || "No web results found.";
}

async function ddgFallback(query: string, n: number): Promise<string> {
	const raw = await run("/usr/bin/curl", [
		"-s", "-L", "--max-time", "8",
		`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
		"-H", "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
	], 10000);

	if (raw.startsWith("Error:") || !raw.trim()) {
		return "All search engines unavailable. Check network connection.";
	}

	const results: string[] = [];
	const titleRe = /class="result__a"[^>]*>(.*?)<\/a>/g;
	const snippetRe = /class="result__snippet"[^>]*>(.*?)<\/[at]/g;
	const urlRe = /uddg=(.*?)&/g;
	const titles: string[] = [], snippets: string[] = [], urls: string[] = [];
	let match;

	while ((match = titleRe.exec(raw)) !== null) titles.push(match[1].replace(/<[^>]+>/g, "").trim());
	while ((match = snippetRe.exec(raw)) !== null) snippets.push(match[1].replace(/<[^>]+>/g, "").trim());
	while ((match = urlRe.exec(raw)) !== null) {
		try { urls.push(decodeURIComponent(match[1])); } catch { urls.push(match[1]); }
	}

	for (let i = 0; i < Math.min(n, titles.length); i++) {
		const url = urls[i] ? `\n  ${urls[i]}` : "";
		const snippet = snippets[i] ? `\n  ${snippets[i].slice(0, 150)}` : "";
		results.push(`${i + 1}. ${titles[i]}${url}${snippet}`);
	}

	return results.length > 0
		? `[DuckDuckGo fallback]\n${results.join("\n\n")}`
		: "No results found from DuckDuckGo either.";
}

function ensureEmptyDir() {
	const fs = require("node:fs");
	const dir = "/tmp/mgrep-empty";
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── Extension ────────────────────────────────────────────

export default function searchExtension(pi: ExtensionAPI) {

	ensureEmptyDir();

	// ── Tool 1: search (local — mgrep handles everything) ──
	pi.registerTool({
		name: "search",
		label: "Search",
		description:
			"Search local files using mgrep semantic search. " +
			"Handles both exact patterns (variable names, symbols) and natural language questions. " +
			"Set answer=true for an AI-generated summary. " +
			"Defaults to current working directory. Use web_search for internet searches.",
		promptSnippet: "Search local codebase for files, patterns, or concepts",
		promptGuidelines: [
			"Use 'search' for local file content. Use 'web_search' for internet information.",
			"Works for exact symbols AND natural language queries.",
			"Set answer=true to get a concise AI summary instead of raw snippets.",
		],
		parameters: Type.Object({
			query: Type.String({ description: "Search query: symbol, pattern, or natural language question" }),
			path: Type.Optional(Type.String({ description: "Directory to search (default: current working directory)" })),
			answer: Type.Optional(Type.Boolean({
				description: "Generate an AI answer summary (default false)",
			})),
		}),
		async execute(_id, params) {
			const mgrep = await resolveMgrep();
			const path = params.path || process.cwd();
			const args = ["search", "-s", "-c", "-m", "5", params.query, path];
			if (params.answer) args.push("-a");

			if (!mgrep) {
				return { content: [{ type: "text", text: "mgrep not installed. Run: npm install -g @mixedbread/mgrep" }], details: { status: "missing-mgrep" } };
			}

			let raw = await run(mgrep, args, 30000);
			if (!raw.trim()) raw = `No results found in ${path}.`;

			return {
				content: [{ type: "text", text: trunc(raw) }],
				details: { query: params.query, path },
			};
		},
	});

	// ── Tool 2: web_search (mgrep web → DDG fallback) ────
	pi.registerTool({
		name: "web_search",
		label: "Web Search",
		description:
			"Search the internet. Returns ranked URLs with relevance scores, " +
			"or an AI-generated answer summary. Then use web_fetch to read specific pages. " +
			"For local files, use 'search' instead.",
		promptSnippet: "Search the internet for information",
		promptGuidelines: [
			"Use web_search for internet information, 'search' for local files.",
			"answer=true returns a concise summary instead of just URLs.",
			"After getting URLs, use web_fetch to read the best match in detail.",
		],
		parameters: Type.Object({
			query: Type.String({ description: "Search query in natural language" }),
			count: Type.Optional(Type.Number({ description: "Max results (default 3)", default: 3 })),
			answer: Type.Optional(Type.Boolean({
				description: "Return an AI-generated answer summary instead of just URLs (default false)",
			})),
		}),
		async execute(_id, params) {
			const mgrep = await resolveMgrep();
			const n = params.count ?? 3;
			const args = ["search", "-w", "-c", "-m", String(n * 3), params.query, "/tmp/mgrep-empty"];
			if (params.answer) args.push("-a");

			if (mgrep) {
				const raw = await run(mgrep, args, 30000);

				if (!isMgrepError(raw) && raw.trim()) {
					if (params.answer) {
						return { content: [{ type: "text", text: trunc(raw) }], details: { query: params.query, engine: "mgrep-web-answer" } };
					}
					return { content: [{ type: "text", text: filterWeb(raw, n) }], details: { query: params.query, engine: "mgrep-web" } };
				}
			}

			// Fallback: DuckDuckGo
			const fallbackResult = await ddgFallback(params.query, n);
			return {
				content: [{ type: "text", text: fallbackResult }],
				details: { query: params.query, engine: "ddg-fallback", reason: "mgrep unavailable" },
			};
		},
	});

	// ── Tool 3: web_fetch (HTTP → plain text) ─────────────
	pi.registerTool({
		name: "web_fetch",
		label: "Web Fetch",
		description:
			"Fetch a URL and return clean text content (HTML stripped). " +
			"Use after web_search to read specific pages in detail.",
		promptSnippet: "Fetch and read a web page",
		promptGuidelines: [
			"Use web_fetch to read URLs found via web_search.",
		],
		parameters: Type.Object({
			url: Type.String({ description: "URL to fetch" }),
		}),
		async execute(_id, params) {
			const script = `
				const https = require('https'), http = require('http');
				const url = process.argv[1];
				const c = url.startsWith('https') ? https : http;
				c.get(url, {headers:{'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'}}, res => {
					if (res.statusCode>=300 && res.statusCode<400 && res.headers.location) {
						const r=new URL(res.headers.location,url).toString();
						require(r.startsWith('https')?'https':'http').get(r,{headers:{'User-Agent':'Mozilla/5.0'}},handler);return;
					} handler(res);
				});
				function handler(res){
					let d='';res.on('data',c=>d+=c);res.on('end',()=>{
						let t=d.replace(/<style[^>]*>[\\s\\S]*?<\\/style>/gi,'');
						t=t.replace(/<script[^>]*>[\\s\\S]*?<\\/script>/gi,'');
						t=t.replace(/<[^>]+>/g,' ');
						t=t.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');
						t=t.replace(/\\s+/g,' ').trim();
						process.stdout.write(t);
					});
				}`;
			const raw = await run("node", ["-e", script, params.url], 15000);
			return {
				content: [{ type: "text", text: trunc(raw) }],
				details: { url: params.url },
			};
		},
	});

	// ── Commands ──────────────────────────────────────────
	pi.registerCommand("search", {
		description: "Search local files: /search <query> [path]",
		handler: async (args, ctx) => {
			if (!args.trim()) { ctx.ui.notify("Usage: /search <query> [path]", "warning"); return; }
			const trimmed = args.trim();
			const parts = trimmed.split(/\s+/);
			let query: string;
			let path: string;
			const last = parts[parts.length - 1];
			if (parts.length >= 2 && (last.startsWith("/") || last.startsWith("./") || last.startsWith("~/") || last.includes("/") || last === "." || last === "..")) {
				query = parts.slice(0, -1).join(" ");
				path = last.replace(/^~/, process.env.HOME || "/Users");
			} else {
				query = trimmed;
				path = process.cwd();
			}
			const mgrep = await resolveMgrep();
			if (!mgrep) { ctx.ui.notify("mgrep not installed. Run: npm install -g @mixedbread/mgrep", "warning"); return; }
			const raw = await run(mgrep, ["search", "-s", "-c", "-a", "-m", "3", query, path], 30000);
			ctx.ui.notify(trunc(raw, 3000), "info");
		},
	});

	pi.registerCommand("web", {
		description: "Search the web: /web <query>",
		handler: async (args, ctx) => {
			if (!args.trim()) { ctx.ui.notify("Usage: /web <query>", "warning"); return; }
			const mgrep = await resolveMgrep();
			let raw: string;
			if (mgrep) {
				raw = await run(mgrep, ["search", "-w", "-a", "-m", "5", args, "/tmp/mgrep-empty"], 30000);
			} else {
				raw = "Error: mgrep not found";
			}
			if (isMgrepError(raw) || !raw.trim() || raw === "Error: mgrep not found") raw = await ddgFallback(args, 3);
			ctx.ui.notify(trunc(raw, 3000), "info");
		},
	});

	pi.registerCommand("fetch", {
		description: "Fetch a URL: /fetch <url>",
		handler: async (args, ctx) => {
			const url = args.trim();
			if (!url) { ctx.ui.notify("Usage: /fetch <url>", "warning"); return; }
			const raw = await run("/usr/bin/curl", ["-s", "-L", "--max-time", "10", url], 15000);
			ctx.ui.notify(trunc(raw, 2000), "info");
		},
	});
}
