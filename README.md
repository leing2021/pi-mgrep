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
// → 3 ranked URLs

web_search({ query: "React 19 new features", answer: true })
// → AI-generated answer with citations
```

### `web_fetch` — Page Reader

Fetch URL, strip HTML, return plain text.

```typescript
web_fetch({ url: "https://react.dev/blog/2024/12/05/react-19" })
// → Clean text, max 6000 chars
```

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

## License

MIT
