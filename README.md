# pi-mgrep

> Ripgrep + mgrep dual-routing. Both auto-install. Zero config.

Unified search extension for [Pi Coding Agent](https://github.com/badlogic/pi-mono).

## Quick Start

```bash
npm install -g pi-mgrep
# Restart pi — ripgrep and mgrep auto-install on first use.
```

## What it gives you

Three LLM-callable tools.

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

If ripgrep is unavailable, mgrep handles everything silently.

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

Fetch URL, strip HTML, return plain text.

```typescript
web_fetch({ url: "https://react.dev/blog/2024/12/05/react-19" })
// → Clean text, max 6000 chars
```

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

The Agent will edit `.pi/extensions/mgrep.ts` for you — change both occurrences of the number, then restart pi.

## Interactive Commands

| Command | Purpose |
|:---|:---|
| `/search <query> [path]` | Local search (auto routes rg/mgrep) |
| `/web <query>` | Web search |
| `/fetch <url>` | Fetch URL content |

## How it works

```
┌─ resolveRg() ──────────────────────────────────────────────┐
│  which rg → known paths → brew install ripgrep              │
├─ resolveMgrep() ───────────────────────────────────────────┤
│  which mgrep → known paths → npm install -g @mixedbread/mgrep │
├────────────────────────────────────────────────────────────┤
│  Tool: search                                               │
│    code-like? → rg (if available, 0.02s)                    │
│             els → mgrep (3-8s, semantic)                    │
│             answer=true? → -a (AI summary)                  │
├────────────────────────────────────────────────────────────┤
│  Tool: web_search                                           │
│    mgrep -w /tmp/mgrep-empty                                │
│    fail? → DuckDuckGo HTML (zero-dep fallback)              │
├────────────────────────────────────────────────────────────┤
│  Tool: web_fetch                                            │
│    Node.js http.get → strip HTML → plain text               │
└────────────────────────────────────────────────────────────┘
```

## Requirements

- **Pi Coding Agent** ≥ 0.73.0
- Everything else auto-installs (ripgrep + mgrep)

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
# ~/.zshrc
export MXBAI_API_KEY="mxb_your_key_here"
```

## Design choices

- **Dual-engine** — ripgrep 0.02s for code, mgrep 3-8s for natural language
- **Auto-install** — both engines install via system package managers
- **Graceful degradation** — rg missing → mgrep for all. mgrep missing → DDG for web
- **Output limits** — 6000 char cap on every tool

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

**15/15 passed.** Full details: [docs/test-report.md](docs/test-report.md).

## License

MIT
