# pi-mgrep

> One dependency. Zero config. Auto-installs itself.

Unified search extension for [Pi Coding Agent](https://github.com/badlogic/pi-mono) — semantic search + web search + page reading. mgrep handles everything.

## Quick Start

```bash
# Install
npm install -g pi-mgrep

# Restart pi — done.
# mgrep auto-installs on first use if missing.
```

**No ripgrep. No manual mgrep install. No API key required.**

## What it gives you

Three LLM-callable tools, automatically registered.

### `search` — Local Search

mgrep semantic search. Works for exact symbols AND natural language.

```typescript
search({ query: "registerTool" })
// → exact match with file + line context

search({ query: "error handling logic", answer: true })
// → AI-generated summary of relevant code
```

### `web_search` — Internet Search

mgrep web with automatic DuckDuckGo fallback.

```typescript
web_search({ query: "React 19 new features" })
// → 3 ranked URLs with match scores

web_search({ query: "React 19 new features", answer: true })
// → AI-generated answer with citations
```

### `web_fetch` — Page Reader

Fetch URL, strip HTML, return plain text.

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

## How it works

```
┌───────────────────────────────────────────────────────────┐
│  Extension loads                                          │
│  ├─ resolveMgrep() → found on PATH? → use it              │
│  ├─ not found? → npm install -g @mixedbread/mgrep         │
│  └─ still not found? → tools return helpful error         │
├───────────────────────────────────────────────────────────┤
│  Tool: search                                              │
│    query → mgrep search -s -c -m 5 <query> <path>         │
│    answer=true? → adds -a (AI summary)                    │
├───────────────────────────────────────────────────────────┤
│  Tool: web_search                                          │
│    primary → mgrep search -w -m <n*3> /tmp/mgrep-empty    │
│    fail?  → DuckDuckGo HTML scraping (zero-dependency)    │
├───────────────────────────────────────────────────────────┤
│  Tool: web_fetch                                           │
│    url → Node.js http.get → HTML strip → plain text       │
│    100% self-contained, no external deps                   │
└───────────────────────────────────────────────────────────┘
```

## Authentication

mgrep needs auth to Mixedbread's API. Two ways:

### Device login (7-day expiry)

```bash
mgrep login
# browser → authorize → token saved
# repeat every 7 days
```

### API key (recommended, permanent)

1. [Mixedbread Platform](https://www.platform.mixedbread.com) → sign up
2. Create API key from dashboard
3. Export in shell profile:

```bash
# ~/.zshrc
export MXBAI_API_KEY="mxb_your_key_here"
```

## Design choices

- **mgrep-only** — no ripgrep dependency. mgrep handles exact patterns and semantic search
- **Auto-install** — if mgrep is missing, extension runs `npm install -g @mixedbread/mgrep` on first use
- **Fallback chain** — mgrep web → DuckDuckGo. Web search survives API outages
- **Isolated web results** — `/tmp/mgrep-empty` ensures web search never mixes with local files
- **Output limits** — 6000 char hard cap on all tools, safe for any context window

## File Structure

```
pi-mgrep/
├── .pi/
│   └── extensions/
│       └── mgrep.ts        ← the extension (340+ lines)
├── package.json
├── README.md
└── README_CN.md
```

## Related

- [mgrep](https://github.com/mixedbread-ai/mgrep) — Semantic grep CLI
- [Pi Extensions](https://pi.dev/docs/latest/extensions) — Official docs
- [Mixedbread Platform](https://www.platform.mixedbread.com) — API keys

## License

MIT
