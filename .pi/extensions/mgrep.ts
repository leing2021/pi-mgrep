/**
 * Unified Search Extension for Pi
 *
 * Three tools, one design principle: right engine for the right job.
 *
 *   search       → local: ripgrep (exact) or mgrep (semantic) + optional answer summary
 *   web_search   → mgrep web (primary) → DuckDuckGo fallback (automatic on failure)
 *   web_fetch    → fetch URL + strip HTML → clean text
 *
 * Fallback chain: mgrep fails → DuckDuckGo HTML scraping → error message
 *
 * Commands: /search, /web, /fetch
 *
 * mgref docs: https://github.com/mixedbread-ai/mgrep
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// ── Config ───────────────────────────────────────────────

const MGREP = "/Users/jasonle/.nvm/versions/node/v22.20.0/bin/mgrep";
const RG = "/opt/homebrew/bin/rg";
const EMPTY_DIR = "/tmp/mgrep-empty";
const MAX = 6000;

// ── Helpers ──────────────────────────────────────────────

function trunc(text: string, max = MAX): string {
	return text.length <= max ? text : text.slice(0, max) + `\n... (truncated, ${text.length} total chars)`;
}

function run(cmd: string, args: string[], timeout = 15000): Promise<string> {
	return execFileAsync(cmd, args, { timeout, maxBuffer: 1024 * 1024 })
		.then(({ stdout }) => stdout)
		.catch((err) => `Error: ${err.message}`);
}

/** Heuristic: code-like queries → ripgrep; natural language → mgrep */
function looksLikeCode(q: string): boolean {
	const hasSpace = q.includes(" ");
	if (hasSpace) {
		return /[{}()\[\]=<>:;%@#]/.test(q);
	}
	return /[A-Z][a-z]+[A-Z]|_\w{2,}|\w+\.\w{2,}|\/\w+|[{}()\[\]=<>:;${}%@#]/.test(q)
		|| (q.length <= 20);
}

/** Keep only http(s) URLs from mgrep mixed output */
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

/** Check if mgrep output indicates a failure */
function isMgrepError(raw: string): boolean {
	return raw.startsWith("Error:") || raw.includes("ETIMEDOUT") || raw.includes("ENOTFOUND")
		|| raw.includes("401") || raw.includes("403") || raw.includes("rate limit");
}

/** DuckDuckGo fallback — scrape HTML search results */
async function ddgFallback(query: string, n: number): Promise<string> {
	const raw = await run("/usr/bin/curl", [
		"-s", "-L", "--max-time", "8",
		`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
		"-H", "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
	], 10000);

	if (raw.startsWith("Error:") || !raw.trim()) {
		return "All search engines unavailable. Check network connection.";
	}

	// Parse DDG HTML results
	const results: string[] = [];
	const titleRe = /class="result__a"[^>]*>(.*?)<\/a>/g;
	const snippetRe = /class="result__snippet"[^>]*>(.*?)<\/[at]/g;
	const urlRe = /uddg=(.*?)&/g;

	let match;
	const titles: string[] = [];
	const snippets: string[] = [];
	const urls: string[] = [];

	while ((match = titleRe.exec(raw)) !== null) {
		titles.push(match[1].replace(/<[^>]+>/g, "").trim());
	}
	while ((match = snippetRe.exec(raw)) !== null) {
		snippets.push(match[1].replace(/<[^>]+>/g, "").trim());
	}
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

// ── Extension ────────────────────────────────────────────

export default function unifiedSearchExtension(pi: ExtensionAPI) {

	// ── Tool 1: search (local — auto-selects ripgrep vs mgrep) ──
	pi.registerTool({
		name: "search",
		label: "Search",
		description:
			"Search local files. Auto-selects engine: ripgrep for exact patterns/code/symbols " +
			"(fast, offline), mgrep for natural language questions (semantic, cloud-based, " +
			"with optional AI-generated answer summary). " +
			"Defaults to current working directory. Use web_search for internet searches.",
		promptSnippet: "Search local codebase for files, patterns, or concepts",
		promptGuidelines: [
			"Use 'search' for local file content. Use 'web_search' for internet information.",
			"For exact symbol/variable/regex: auto-picks ripgrep (instant).",
			"For conceptual questions like 'error handling logic': auto-picks mgrep (semantic).",
			"Set answer=true for mgrep queries to get a concise summary instead of raw snippets.",
		],
		parameters: Type.Object({
			query: Type.String({ description: "Search query: pattern, symbol, or natural language question" }),
			path: Type.Optional(Type.String({ description: "Directory to search (default: cwd)" })),
			engine: Type.Optional(
				Type.Union([
					Type.Literal("auto"),
					Type.Literal("ripgrep"),
					Type.Literal("mgrep"),
				], { description: "Force engine: 'auto' (default), 'ripgrep' (exact), 'mgrep' (semantic)" }),
			),
			answer: Type.Optional(Type.Boolean({
				description: "Generate an AI answer summary from search results (mgrep only, default false)",
			})),
		}),
		async execute(_id, params) {
			const path = params.path || process.cwd();
			const forced = params.engine ?? "auto";
			const useRg = forced === "ripgrep" || (forced === "auto" && looksLikeCode(params.query));

			let raw: string;
			let engine: string;

			if (useRg) {
				engine = "ripgrep";
				raw = await run(RG, [
					"--max-count", "20",
					"--max-filesize", "1M",
					"--no-heading",
					"--line-number",
					"--color", "never",
					params.query,
					path,
				], 10000);
			} else {
				engine = "mgrep";
				const mgrepArgs = ["search", "-s", "-c", "-m", "5", params.query, path];
				if (params.answer) mgrepArgs.push("-a");
				raw = await run(MGREP, mgrepArgs, 30000);

				// Fallback: if mgrep fails, try ripgrep as last resort
				if (isMgrepError(raw) || !raw.trim()) {
					engine = "mgrep→ripgrep fallback";
					raw = await run(RG, [
						"--max-count", "10",
						"--max-filesize", "1M",
						"--no-heading",
						"--line-number",
						"--color", "never",
						params.query, path,
					], 10000);
				}
			}

			if (!raw.trim()) raw = `No results found with ${engine}.`;

			return {
				content: [{ type: "text", text: trunc(raw) }],
				details: { query: params.query, engine, path },
			};
		},
	});

	// ── Tool 2: web_search (mgrep → DDG fallback) ────────
	pi.registerTool({
		name: "web_search",
		label: "Web Search",
		description:
			"Search the internet using semantic search. Returns ranked URLs with relevance scores, " +
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
			const n = params.count ?? 3;
			const mgrepArgs = ["search", "-w", "-c", "-m", String(n * 3), params.query, EMPTY_DIR];

			if (params.answer) mgrepArgs.push("-a");

			const raw = await run(MGREP, mgrepArgs, 30000);

			// Primary: mgrep succeeded
			if (!isMgrepError(raw) && raw.trim()) {
				if (params.answer) {
					return {
						content: [{ type: "text", text: trunc(raw) }],
						details: { query: params.query, engine: "mgrep-web-answer" },
					};
				}
				return {
					content: [{ type: "text", text: filterWeb(raw, n) }],
					details: { query: params.query, engine: "mgrep-web" },
				};
			}

			// Fallback: DuckDuckGo
			const fallbackResult = await ddgFallback(params.query, n);
			return {
				content: [{ type: "text", text: fallbackResult }],
				details: { query: params.query, engine: "ddg-fallback", reason: "mgrep unavailable" },
			};
		},
	});

	// ── Tool 3: web_fetch (curl + HTML→text) ──────────────
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

	// ── Command: /search ──────────────────────────────────
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
			const useRg = looksLikeCode(query);

			let raw: string;
			if (useRg) {
				raw = await run(RG, ["--max-count", "10", "--no-heading", "--line-number", "--color", "never", query, path], 10000);
			} else {
				raw = await run(MGREP, ["search", "-s", "-c", "-a", "-m", "3", query, path], 30000);
			}
			ctx.ui.notify(trunc(raw, 3000), "info");
		},
	});

	// ── Command: /web ─────────────────────────────────────
	pi.registerCommand("web", {
		description: "Search the web: /web <query>",
		handler: async (args, ctx) => {
			if (!args.trim()) { ctx.ui.notify("Usage: /web <query>", "warning"); return; }
			let raw = await run(MGREP, ["search", "-w", "-a", "-m", "5", args, EMPTY_DIR], 30000);

			// Fallback to DDG if mgrep fails
			if (isMgrepError(raw) || !raw.trim()) {
				raw = await ddgFallback(args, 3);
			}

			ctx.ui.notify(trunc(raw, 3000), "info");
		},
	});

	// ── Command: /fetch ───────────────────────────────────
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
