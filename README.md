# pi-search

> Ripgrep + mgrep dual-routing search extension for Pi Coding Agent.
> v0.5.0 — evidence cards thin contract, CLI capability detection, circuit breaker, lexical fallback, SearXNG opt-in, GitHub search opt-in, PDF extraction opt-in.

Unified search extension for [Pi Coding Agent](https://github.com/badlogic/pi-mono).

## Quick Start

Install as a Pi package:

```bash
pi install npm:@leing2021/pi-search
# Restart pi or run /reload — tools are ready.
```

This package exposes `extensions/pi-search.ts` through the Pi package manifest.

If upgrading from `pi-mgrep`: remove the old package or extension first, then install `pi-search`. Tool names stay unchanged: `search`, `web_search`, `web_fetch`.

## Problems it solves

AI coding agents need search as infrastructure, not as a pile of ad-hoc shell commands. `pi-search` solves four daily problems:

1. **Fast exact code lookup** — symbols, filenames, syntax snippets, and paths should be near-instant and offline.
2. **Semantic local search** — natural-language questions should find relevant code even when the exact words do not match.
3. **Current web evidence** — agents need fresh URLs and fetched page text with clear untrusted-content boundaries.
4. **Safe defaults** — command execution, local paths, web fetching, and optional LLM verification should be explicit, bounded, and auditable.

It keeps these responsibilities small: `pi-search` is a lightweight search/evidence extension, not a multi-agent framework.

## What it gives you

Four LLM-callable tools with process-level least-privilege sandbox.

### `search` — Dual-Engine Router

Auto-routes based on query type:

| Query | Engine | Speed |
|:---|:---|:---|
| `registerTool` (camelCase) | **ripgrep** | 0.02s |
| `calculate_total` (snake_case) | **ripgrep** | 0.02s |
| `app.tsx` (path/ext) | **ripgrep** | 0.02s |
| `{ status: 200 }` (syntax) | **ripgrep** | 0.02s |
| `error handling logic` (NL) | **mgrep** | 3-8s |
| `how to handle errors` (NL) | **mgrep** | 3-8s |

If ripgrep is unavailable, mgrep handles local queries. If mgrep is unavailable or fails, web search falls back to DuckDuckGo where possible.

```typescript
search({ query: "registerTool" })
// → ripgrep 0.02s, file + line matches

search({ query: "error handling logic", answer: true })
// → mgrep semantic, AI-generated summary
```

### `web_search` — Internet Search

mgrep web with automatic DuckDuckGo fallback.

```typescript
web_search({ query: "React 19 new features" })
// → 5 ranked URLs

web_search({ query: "React 19 new features", count: 10 })
// → 10 ranked URLs (max customizable)

web_search({ query: "React 19 new features", answer: true })
// → AI-generated answer with citations
```

### `web_fetch` — Page Reader

Fetch URL, strip HTML, return agent-ready text with untrusted boundary markers.

```typescript
web_fetch({ url: "https://react.dev/blog/2024/12/05/react-19" })
// → compact mode (default), untrusted boundary, risk flags, context budget

web_fetch({ url: "https://react.dev/blog/2024/12/05/react-19", mode: "full" })
// → full sanitized text with boundary

web_fetch({ url: "https://react.dev/blog/2024/12/05/react-19", mode: "quotes" })
// → relevant quotes/snippets with source metadata
```

### `research_search` — Web Research with Verification (v0.4.1, default-off)

Web-only research tool that discovers sources, fetches evidence, and optionally verifies claims with an LLM.

**Default-off**: LLM verification requires `PI_SEARCH_LLM_ENABLED=always`.

```typescript
// Default: returns evidence with [VERIFICATION DISABLED]
research_search({ query: "what is React Server Components" })

// With LLM enabled: returns [VERIFICATION ENABLED] + cited answer
research_search({ query: "what is React Server Components", maxSources: 3 })

// Explicit verification control
research_search({ query: "what is React Server Components", verify: false })
// → [VERIFICATION DISABLED], evidence only
```

Output always includes explicit status:
- `[VERIFICATION ENABLED]` — LLM verified answer with citations
- `[VERIFICATION DISABLED]` — evidence only, no LLM used
- `[VERIFICATION FAILED: reason]` — LLM attempted but failed

Does not read local files. Does not perform query rewrite.

## What's new in v0.5.0

| Feature | What it means |
|---|---|
| **Evidence cards (v0.5)** | Lexical fallback uses a structured card format with budget-aware truncation (compact ≤ 6k chars). Other providers (ripgrep, mgrep, DDG, PDF) maintain backward-compatible legacy output. Evidence-cards module is available for future engine migration. |
| **CLI capability detection** | Auto-detects `gh`, `htmlq`, `pdftotext` at startup; separates local vs network CLI tools with distinct enable flags. |
| **mgrep circuit breaker** | Session-level fast-fail when mgrep hits quota (`429`) or auth errors — avoids repeated slow failures; configurable TTL. |
| **Lexical fallback** | Tokenize query + multi-pass ripgrep when mgrep is unavailable or circuit-broken — semantic-ish results without a semantic engine. |
| **SearXNG web search** | Configurable self-hosted SearXNG instance as `web_search` provider (opt-in via `PI_SEARCH_WEB_PROVIDER`). |
| **GitHub search** | Opt-in `gh` CLI integration for repository/issue/code search in `web_search`. |
| **DDG HTML parser** | Improved DuckDuckGo result extraction with `htmlq` when available. |
| **PDF extraction** | Auto-extract PDF content in `web_fetch` via `pdftotext` when available. |

New source modules: `evidence-cards.ts`, `cli-capabilities.ts`, `mgrep-circuit-breaker.ts`, `lexical-fallback.ts`, `htmlq-parser.ts`, `searxng-provider.ts`, `pdf-extractor.ts`, `github-search.ts`.

## Feature highlights

| Feature | What it means |
|---|---|
| Auto routing | Code-like queries use `ripgrep`; natural-language queries use `mgrep`. |
| Evidence cards (v0.5) | Lexical fallback returns structured card format. Other providers use backward-compatible plain-text output with budget-aware formatting. |
| CLI capabilities (v0.5) | `gh`, `htmlq`, `pdftotext` detected at startup; local vs network separation. |
| Circuit breaker (v0.5) | mgrep 429/auth failures trip a session-level breaker; stops repeated slow failures. |
| Lexical fallback (v0.5) | Multi-pass ripgrep fallback when mgrep is unavailable — better than nothing. |
| Web evidence | `web_search` discovers URLs; `web_fetch` reads pages safely with untrusted boundaries. |
| SearXNG support (v0.5) | Self-hosted search engine as `web_search` provider. |
| GitHub search (v0.5) | `gh` CLI integration for repo/issue/code search. |
| PDF extraction (v0.5) | `web_fetch` auto-extracts PDF content when `pdftotext` is available. |
| Optional verified research | `research_search` builds a web-only evidence pack; LLM verification is default-off. |
| Explicit security policy | Command, path, network, temp-dir, and audit policies are visible in tool details. |
| Graceful fallback | Missing/failing mgrep web search can fall back to DuckDuckGo URL discovery. |
| Low hidden cost | Default install uses no extra LLM verifier and no auto-install network calls. |

## Search efficiency by scenario

Measured from the project test report and manual baseline. Times vary by machine/network, but the search path changes are stable.

| Scenario | Without `pi-search` | With `pi-search` | Practical gain |
|---|---|---|---|
| Exact symbol / function lookup | Agent may run broad shell searches or ask you for file hints | `search({ query: "registerTool" })` → ripgrep, ~0.007-0.02s | Instant offline lookup with file+line evidence |
| Filename / extension / path query | Manual `find`/`grep` style exploration | Auto-routed to ripgrep, ~0.02s | Less prompt overhead; fewer tool attempts |
| Natural-language local question | Exact grep often misses semantic matches | mgrep semantic search, typically 3-13s | Finds conceptually related code without exact terms |
| Chinese natural-language local query | Usually requires guessing English identifiers first | mgrep semantic search, observed ~4.5s | Better bilingual codebase exploration |
| Web URL discovery | Agent may use general web search with inconsistent output | `web_search`, count-clamped structured URLs, observed ~5s via mgrep or ~1.3s DDG fallback | Predictable source list for follow-up fetches |
| Page reading | Raw HTML or oversized pasted pages | `web_fetch` compact/quotes/full, usually <1s after network | Cleaner context, risk flags, explicit untrusted markers |
| Cited web research | Agent composes web search + fetch + answer manually | `research_search` gathers bounded evidence; verifier is explicit/default-off | Safer daily research flow with no silent LLM cost |

## Super Pi integration and standalone use

`pi-search` works best with Super Pi because Super Pi's planning/review skills naturally call `search`, `web_search`, `web_fetch`, and `research_search` as evidence tools during brainstorm → plan → work → review workflows.

You **do not need Super Pi** to use this package. `pi-search` is a standard Pi Coding Agent package:

- Required: **Pi Coding Agent** runtime.
- Optional: **Super Pi** skills/workflows.
- Not intended as: a standalone Unix CLI outside Pi. The package exposes Pi extension tools; the underlying helpers are ordinary source modules, but the user-facing product is the Pi extension.

Typical choices:

| Setup | Supported? | Notes |
|---|---:|---|
| Pi Coding Agent + `pi-search` | ✅ | Fully supported standalone Pi extension usage. |
| Super Pi + `pi-search` | ✅ Recommended | Best Agent workflow: search/evidence tools pair with CE skills. |
| No Pi runtime, direct shell only | ❌ | Use `rg`, `mgrep`, or your own scripts directly instead. |

## mgrep quota/auth failure fallback

`mgrep` may fail because it is not installed, not authenticated, has network errors, or hits provider quota/rate limits (for example HTTP `429`). `pi-search` handles this differently by tool:

| Tool path | If mgrep works | If mgrep is missing/fails/quota exhausted |
|---|---|---|
| `search` exact/code-like | Uses ripgrep first | Still uses ripgrep when available; no mgrep quota needed |
| `search` natural-language | Uses mgrep semantic local search | Returns a clear install/auth/error message; no semantic fallback is fabricated |
| `web_search` URLs | Uses mgrep web search | Falls back to DuckDuckGo HTML search through `safeFetchText()` |
| `web_search({ answer: true })` | Uses mgrep answer mode | Falls back to DuckDuckGo URLs only; no AI answer is fabricated |
| `/web` command | Uses mgrep answer mode when available | Falls back to DuckDuckGo results |
| `research_search` | Uses DuckDuckGo discovery + safe fetch evidence | Does not depend on mgrep answer mode; LLM verifier remains default-off |

Fallbacks are intentionally honest: if AI summary/semantic ranking is unavailable, the tool returns evidence or URLs rather than pretending an answer was verified.

## Customizing Results Count

Default is **5** results per search.

### Per-query (via prompt)

Ask the Agent in natural language — no code changes needed:

> *"Search the web for React 19 new features, return 10 results"*
> *"请搜索 React 19 新特性，返回 10 条结果"*

The Agent will automatically pass `count: 10` to `web_search`. Works in English and Chinese.

### Change the default permanently

Ask the Agent directly:

> *"请将 web_search 的默认返回数量从 5 改为 10"*
> *"Change the default result count of web_search from 5 to 10"*

The Agent will edit `extensions/pi-search.ts` for you — change both occurrences of the number, then restart pi.

## Interactive Commands

| Command | Purpose |
|:---|:---|
| `/search <query> [path]` | Local search (auto routes rg/mgrep) |
| `/web <query>` | Web search |
| `/fetch <url>` | Fetch URL content |

## Environment Variables

All variables are optional. Defaults are safe for zero-config use.

| Variable | Values | Default | Purpose |
|---|---|---|---|
| `PI_SEARCH_AUTO_INSTALL` | `never` \| `always` | `never` | Auto-install missing engines (ripgrep/mgrep) via npm. |
| `PI_SEARCH_ALLOW_OUTSIDE_CWD` | `never` \| `always` | `never` | Allow `search` to query paths outside the project cwd. |
| `MXBAI_API_KEY` | `mxb_...` | — | mgrep API key. Required for mgrep semantic/web search. |
| `PI_SEARCH_LLM_ENABLED` | `never` \| `ask` \| `always` | `never` | Enable LLM verification in `research_search`. |
| `PI_SEARCH_LLM_PROVIDER` | `openai` \| `anthropic` \| `local-openai` | — | LLM provider for verification. |
| `PI_SEARCH_LLM_MODEL` | model name | — | Model identifier (e.g. `gpt-4o-mini`). |
| `PI_SEARCH_LLM_BASE_URL` | URL | — | Custom API endpoint (for local/self-hosted LLMs). |
| `PI_SEARCH_LLM_API_KEY_ENV` | env var name | — | Name of the env var holding your LLM API key (e.g. `OPENAI_API_KEY`). The key itself is never exposed. |
| `PI_SEARCH_LOCAL_CLI_ENHANCEMENTS` | `auto` \| `never` | `auto` | Auto-detect and use `htmlq`, `pdftotext` for enhanced output. |
| `PI_SEARCH_NETWORK_CLI_ENHANCEMENTS` | `always` \| `never` | `never` | Enable `gh` CLI for GitHub search in `web_search`. Network-dependent, default off. |
| `PI_SEARCH_WEB_PROVIDER` | `auto` \| `searxng` \| `duckduckgo` | `auto` | Web search backend. `auto` tries SearXNG (if configured) then DuckDuckGo. |
| `PI_SEARCH_SEARXNG_URL` | URL | — | SearXNG instance endpoint (e.g. `http://localhost:8080`). Required when `PI_SEARCH_WEB_PROVIDER=searxng`. |
| `PI_SEARCH_SEARXNG_FORMAT` | `json` \| `html` | `json` | SearXNG response format. |
| `PI_SEARCH_MGREP_BREAKER_TTL_MS` | number | `600000` | Circuit breaker TTL in ms (default 10 min). After mgrep 429/auth failure, subsequent mgrep calls skip immediately until TTL expires. |

### Quick examples

**Default use — no configuration needed:**

Exact code search via ripgrep and web URL discovery via mgrep/DuckDuckGo work out of the box.

**Enable mgrep semantic search:**

```bash
export MXBAI_API_KEY="mxb_your_key_here"
```

**Enable research_search LLM verification (optional):**

```bash
export PI_SEARCH_LLM_ENABLED=always
export PI_SEARCH_LLM_PROVIDER=openai
export PI_SEARCH_LLM_API_KEY_ENV=OPENAI_API_KEY
export OPENAI_API_KEY="sk-your-key"
```

With this configuration, `research_search` returns `[VERIFICATION ENABLED]` with a cited answer. Without it, `research_search` returns `[VERIFICATION DISABLED]` with evidence only — no hidden LLM cost.

**Use a local/self-hosted LLM:**

```bash
export PI_SEARCH_LLM_ENABLED=always
export PI_SEARCH_LLM_PROVIDER=local-openai
export PI_SEARCH_LLM_BASE_URL=http://localhost:11434/v1
export PI_SEARCH_LLM_MODEL=llama3
export PI_SEARCH_LLM_API_KEY_ENV=OLLAMA_KEY
export OLLAMA_KEY=unused
```

**Auto-install engines on first use:**

```bash
export PI_SEARCH_AUTO_INSTALL=always
```

**Allow searching outside project directory:**

```bash
export PI_SEARCH_ALLOW_OUTSIDE_CWD=always
```

**Enable GitHub search via `gh` CLI:**

```bash
export PI_SEARCH_NETWORK_CLI_ENHANCEMENTS=always
# Requires gh auth login first
```

**Use SearXNG for web search:**

```bash
export PI_SEARCH_WEB_PROVIDER=searxng
export PI_SEARCH_SEARXNG_URL=http://localhost:8080
export PI_SEARCH_SEARXNG_FORMAT=json
```

## How it works

```
┌─ resolveBin() ────────────────────────────────────────────┐
│  PATH lookup → known paths → install instructions         │
│  (auto-install requires PI_SEARCH_AUTO_INSTALL=always)    │
├───────────────────────────────────────────────────────────┤
│  cliCapabilities() — CLI tool detection (v0.5)            │
│    local: htmlq, pdftotext (auto by default)              │
│    network: gh (opt-in via env var)                       │
├───────────────────────────────────────────────────────────┤
│  mgrepCircuitBreaker() — session-level fast-fail (v0.5)   │
│    429 / auth error → breaker trips for configurable TTL   │
├───────────────────────────────────────────────────────────┤
│  runCommand() — least-privilege runner                     │
│    execFile only · minimal env · timeout · maxBuffer       │
├───────────────────────────────────────────────────────────┤
│  safeFetchText() — secure web retrieval                    │
│    SSRF protection · DNS/IP validation · redirect control  │
│    content-type check · size limit · timeout               │
│    PDF auto-extraction via pdftotext (v0.5)                │
├───────────────────────────────────────────────────────────┤
│  Tool: search                                               │
│    code-like? → rg (if available, 0.02s)                    │
│             els → mgrep (3-8s, semantic)                    │
│             mgrep breaker open? → lexical fallback (v0.5)   │
│             answer=true? → -a (AI summary)                  │
│    All results → evidence cards (v0.5)                      │
├───────────────────────────────────────────────────────────┤
│  Tool: web_search                                           │
│    provider: SearXNG (v0.5) → gh (v0.5) → mgrep → DDG     │
│    DDG extraction enhanced via htmlq when available (v0.5) │
│    All results → evidence cards (v0.5)                      │
├───────────────────────────────────────────────────────────┤
│  Tool: web_fetch                                            │
│    safeFetchText() → sanitize → mode (compact/quotes/full) │
│    PDF? → pdftotext extraction (v0.5)                       │
│    untrusted boundary · risk flags · context budget         │
│    All results → evidence cards (v0.5)                      │
├───────────────────────────────────────────────────────────┤
│  Tool: research_search                                      │
│    DuckDuckGo discovery → safeFetchText evidence pack       │
│    optional verifier → explicit verification status         │
│    All results → evidence cards (v0.5)                      │
└───────────────────────────────────────────────────────────┘
```

## Security

- **Least-privilege runner**: child processes get minimal env allowlists, no sensitive tokens.
- **Safe web retrieval**: all fetch paths go through `safeFetchText()` with SSRF protection.
- **Auto-install opt-in**: default `never`. Set `PI_SEARCH_AUTO_INSTALL=always` to enable.
- **Untrusted boundary**: all web content is explicitly marked as untrusted evidence.
- **Risk flags**: prompt injection phrases are detected and flagged.
- **CLI capability isolation**: local tools (htmlq, pdftotext) vs network tools (gh) have separate enable flags.
- **Circuit breaker**: mgrep failures trip a session-level breaker; avoids repeated slow retries.

These controls are intentionally lightweight: `pi-search` is a search extension, not a browser agent or crawler.

## Requirements

- **Pi Coding Agent** ≥ 0.73.0
- **ripgrep** — install manually or set `PI_SEARCH_AUTO_INSTALL=always`
- **mgrep** — install manually: `npm install -g @mixedbread/mgrep`

## Authentication

mgrep needs auth to Mixedbread's API.

### Device login (7-day expiry)

```bash
mgrep login
```

### API key (recommended, permanent)

1. [Mixedbread Platform](https://www.platform.mixedbread.com) → sign up
2. Create API key → export:

```bash
export MXBAI_API_KEY="mxb_your_key_here"
```

## Design choices

- **Evidence cards** (v0.5.0) — unified structured output for all tools
- **CLI capability detection** (v0.5.0) — auto-detect gh, htmlq, pdftotext
- **Circuit breaker** (v0.5.0) — session-level mgrep fast-fail on quota/auth errors
- **Lexical fallback** (v0.5.0) — multi-pass ripgrep when mgrep unavailable
- **SearXNG opt-in** (v0.5.0) — self-hosted web search provider
- **GitHub search** (v0.5.0) — `gh` CLI integration
- **PDF extraction** (v0.5.0) — auto-extract PDF in `web_fetch`
- **Dual-engine** — ripgrep 0.02s for code, mgrep 3-8s for natural language
- **Least-privilege sandbox** — process-level env/cwd/timeout isolation, no Docker required
- **Explicit security policies** (v0.4.0) — command profiles, path boundary, network policy, project-scoped temp dir
- **Graceful degradation** — rg missing → mgrep for all. mgrep missing → DDG for web
- **Token-aware output** — compact/quotes/full modes with untrusted boundaries and risk flags
- **Output limits** — 6000 char cap on every tool

See [Security Policy](docs/security-policy.md) for details.

## Test Report

| Category | Scenario | Engine | Time |
|---|---|---|---|
| Code symbol `registerTool` | Local | ripgrep | 0.007s |
| NL `web search fallback logic` | Local | mgrep | 12.9s |
| Chinese NL `错误处理策略` | Local | mgrep | 4.5s |
| NL + answer summary | Local | mgrep | 13.7s |
| Default `count: 5` | Web | mgrep | 5.1s |
| `answer: true` + 9 citations | Web | mgrep | 9.9s |
| `count: 3` / `count: 7` truncation | Web | filterWeb | — |
| HTML fetch & strip | Fetch | Node.js | <1s |
| DuckDuckGo fallback | Degrade | DDG | 1.3s |
| 6000-char truncation | Edge | — | — |

**305/305 automated tests passed.** Full details: [docs/test-report.md](docs/test-report.md).

## License

MIT
