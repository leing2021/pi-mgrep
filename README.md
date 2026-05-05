# pi-mgrep

> Unified search extension for [Pi Coding Agent](https://github.com/badlogic/pi-mono) — semantic search + exact grep + web fallback in one file.

## Quick Start

```bash
# 1. Install mgrep CLI
npm install -g @mixedbread/mgrep
mgrep login   # one-time device auth

# 2. Install this extension
mkdir -p ~/.pi/agent/extensions
cp .pi/extensions/mgrep.ts ~/.pi/agent/extensions/mgrep.ts

# 3. Restart pi — done
```

## What it gives you

Three LLM-callable tools, automatically registered:

### `search` — Local Intelligent Router

Auto-selects the right engine based on the query pattern:

| Query Pattern | Engine | Speed |
|:---|:---|:---|
| `registerTool` (camelCase) | **ripgrep** | 0.02s |
| `calculate_total` (snake_case) | **ripgrep** | 0.02s |
| `app.tsx` (file extension) | **ripgrep** | 0.02s |
| `how to handle errors` (NL) | **mgrep** | 3-8s |

```typescript
// LLM calls this automatically:
search({ query: "registerTool" })
// → ripgrep 0.02s, returns file + line matches

search({ query: "error handling logic", answer: true })
// → mgrep semantic search, returns AI-generated summary
```

### `web_search` — Internet Search

Semantic search the web via mgrep, with automatic DuckDuckGo fallback.

```typescript
web_search({ query: "React 19 new features" })
// → 3 ranked URLs with match scores

web_search({ query: "React 19 new features", answer: true })
// → AI-generated answer with citations instead of URL list
```

**Fallback chain:** mgrep web (primary) → DuckDuckGo HTML scraping (automatic on failure)

### `web_fetch` — Page Reader

Fetch a URL, strip HTML, return clean text.

```typescript
web_fetch({ url: "https://react.dev/blog/2024/12/05/react-19" })
// → Clean text content, max 6000 chars
```

## Interactive Commands

| Command | Purpose |
|:---|:---|
| `/search <query> [path]` | Local search with auto engine selection |
| `/web <query>` | Web search with AI summary |
| `/fetch <url>` | Fetch and display URL content |

## Architecture

```
┌─ search (local) ──────────────────────────────────────────┐
│  Intelligent routing:                                      │
│    code patterns → ripgrep (0.02s, offline)                │
│    natural lang  → mgrep   (3-8s, semantic)                │
│  Fallback: mgrep ↓ → ripgrep                               │
├─ web_search (internet) ───────────────────────────────────┤
│  Primary:  mgrep web   (semantic + reranking)              │
│  Fallback: DuckDuckGo  (HTML scraping, no API key needed)  │
│  Isolation: points to /tmp/mgrep-empty (no local mixing)   │
├─ web_fetch (page reader) ─────────────────────────────────┤
│  curl + Node.js HTML→text extraction                       │
│  No external dependencies                                   │
└────────────────────────────────────────────────────────────┘
```

## Requirements

- **Pi Coding Agent** ≥ 0.73.0
- **mgrep CLI** (`npm install -g @mixedbread/mgrep`)
- **ripgrep** (optional — local semantic search auto-upgrades to mgrep if unavailable)

## Authentication

mgrep requires authentication to Mixedbread's API. Two options:

### Option A: Device login (7-day expiry)

```bash
mgrep login
# opens browser → authorize → token saved to ~/.mgrep/token.json
# must re-login every 7 days
```

### Option B: API key (recommended, permanent)

1. Go to [Mixedbread Platform](https://www.platform.mixedbread.com)
2. Sign up / Sign in
3. Create an API key from the dashboard
4. Export it in your shell profile:

```bash
# ~/.zshrc (or ~/.bashrc)
export MXBAI_API_KEY="mxb_your_key_here"
```

API key takes priority over device login and never expires. Ideal for CI/CD and daily use.

## Tokens

Adds ~400 tokens to system prompt (3 tool definitions). Negligible on 128K+ context windows.

## File Structure

```
pi-mgrep/
├── .pi/
│   └── extensions/
│       └── mgrep.ts        ← the extension (349 lines)
├── package.json
├── README.md
└── README_CN.md
```

## Related

- [mgrep](https://github.com/mixedbread-ai/mgrep) — Semantic grep CLI
- [Pi Extensions](https://pi.dev/docs/latest/extensions) — Official docs
- [Mixedbread Platform](https://www.platform.mixedbread.com) — API key management

## License

MIT
