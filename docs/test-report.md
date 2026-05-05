# pi-mgrep Test Report

> 2026-05-05 | mgrep 0.1.12 / ripgrep 15.1.0 / Node 22.20 / macOS

## Local Search (`search`)

| # | Scenario | Engine | Time | Result |
|---|---|---|---|---|
| 1 | Code symbol `registerTool` (camelCase) | ripgrep | 0.007s | ✅ 4 hits |
| 2 | Snake_case pattern `ensureEmptyDir` | ripgrep | 0.015s | ✅ routed correctly |
| 3 | NL `web search fallback logic` | mgrep | 12.9s | ✅ 3 files, relevance scores |
| 4 | NL + answer `how does the extension handle...` | mgrep | 13.7s | ✅ AI summary + citations |
| 5 | Chinese NL `错误处理策略` | mgrep | 4.5s | ✅ 3 files |

## Web Search (`web_search`)

| # | Scenario | Engine | Time | Result |
|---|---|---|---|---|
| 6 | Default `count: 5` — `TypeScript 5.7 new features` | mgrep | 5.1s | ✅ multiple results, filterWeb caps at 5 |
| 7 | `answer: true` — `best practices TypeScript error handling 2025` | mgrep | 9.9s | ✅ structured answer + 9 citations |
| 8 | URL extraction — `nodejs best practices` | mgrep | — | ✅ 10 unique URLs, 0 duplicates |
| 9 | `count: 3` truncation — `docker compose best practices` | filterWeb | — | ✅ exactly 3 URLs |
| 10 | `count: 7` truncation — `python asyncio` | filterWeb | — | ✅ exactly 7 URLs |

## Web Fetch (`web_fetch`)

| # | Scenario | Time | Result |
|---|---|---|---|
| 11 | Fetch `example.com` + HTML strip | <1s | ✅ clean plain text |

## Degradation & Edge Cases

| # | Scenario | Time | Result |
|---|---|---|---|
| 12 | DuckDuckGo fallback — `TypeScript 5.7 decorators` | 1.3s | ✅ 10 titles / 40 URLs / 10 snippets parsed |
| 13 | DDG result formatting | — | ✅ `[DuckDuckGo fallback]\n1. Title\n  URL\n  Snippet` |
| 14 | 6000-char truncation (12,000 chars input) | — | ✅ output 6,035 chars (6,000 + 35 truncation notice) |
| 15 | 6000-char truncation (within limit) | — | ✅ 33 chars, identical, no truncation |

## Key Findings

- **Dual-engine routing**: ripgrep <0.02s for code patterns; mgrep 3–13s for natural language. Gap consistent with docs.
- **Default count 3→5**: confirmed in code and runtime. `filterWeb` truncates `n × 3` raw → exactly `n`.
- **AI summaries**: structured, cited answers for both local and web searches.
- **DuckDuckGo fallback**: HTML parsing correct; activates when mgrep unavailable.
- **6000-char cap**: applies only when exceeded, with clear truncation notice.
- **Chinese queries**: identical behavior to English for semantic search.

---

| Category | Total | Passed |
|---|---|---|
| Local Search | 5 | ✅ 5 |
| Web Search | 5 | ✅ 5 |
| Web Fetch | 1 | ✅ 1 |
| Degradation & Edges | 4 | ✅ 4 |
| **Total** | **15** | **✅ 15** |
