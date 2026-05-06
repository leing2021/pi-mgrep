# pi-search

> Ripgrep + mgrep 双引擎路由搜索扩展，专为 Pi Coding Agent 设计。
> v0.5.0 — 证据卡片、CLI 能力检测、断路器、词法回退、SearXNG、GitHub 搜索、PDF 提取。

[Pi Coding Agent](https://github.com/badlogic/pi-mono) 的统一搜索扩展。

## 快速开始

作为 Pi package 安装：

```bash
pi install npm:@leing2021/pi-search
# 重启 pi 或执行 /reload — 工具即可使用。
```

本包通过 Pi package manifest 暴露 `extensions/pi-search.ts`。

如从 `pi-mgrep` 升级：先移除旧包或旧扩展，再安装 `pi-search`。工具名保持不变：`search`、`web_search`、`web_fetch`。

## 项目解决的问题

AI Coding Agent 需要稳定的搜索基础设施，而不是临时拼接的 shell 命令。`pi-search` 解决四个日常问题：

1. **快速精确代码查找** — 符号、文件名、语法片段、路径应当近乎即时且离线可用。
2. **本地语义搜索** — 自然语言问题即使没有命中精确词，也应该能找到相关代码。
3. **当前网页证据** — Agent 需要新鲜 URL 和清理后的网页正文，并明确标记不可信内容边界。
4. **安全默认值** — 命令执行、本地路径、网页抓取、可选 LLM 验证都应显式、有边界、可审计。

它刻意保持职责小而清晰：`pi-search` 是轻量搜索/证据扩展，不是多 Agent 框架。

## 提供的工具

四个 LLM 可调用的工具，内置进程级最小权限沙箱。

### `search` — 双引擎路由

根据查询类型自动选择引擎：

| 查询 | 引擎 | 速度 |
|:---|:---|:---|
| `registerTool` (驼峰) | **ripgrep** | 0.02s |
| `calculate_total` (下划线) | **ripgrep** | 0.02s |
| `app.tsx` (路径/扩展名) | **ripgrep** | 0.02s |
| `{ status: 200 }` (语法) | **ripgrep** | 0.02s |
| `error handling logic` (自然语言) | **mgrep** | 3-8s |
| `错误处理逻辑` (自然语言) | **mgrep** | 3-8s |

ripgrep 不可用时，mgrep 接管本地查询。mgrep 不可用或失败时，网页搜索会尽可能回退到 DuckDuckGo。

```typescript
search({ query: "registerTool" })
// → ripgrep 0.02s，返回文件 + 行号

search({ query: "error handling logic", answer: true })
// → mgrep 语义搜索，AI 生成摘要
```

### `web_search` — 网页搜索

mgrep web + DuckDuckGo 自动回退。

```typescript
web_search({ query: "React 19 新特性" })
// → 5 个带评分的 URL

web_search({ query: "React 19 新特性", count: 10 })
// → 10 个带评分的 URL（可自定义上限）

web_search({ query: "React 19 新特性", answer: true })
// → AI 生成的带引用答案
```

### `web_fetch` — 网页抓取

抓取 URL、剥离 HTML，返回带不可信边界标记的 Agent 友好文本。

```typescript
web_fetch({ url: "https://react.dev/blog/2024/12/05/react-19" })
// → compact 模式（默认），不可信边界，风险标记，上下文预算

web_fetch({ url: "https://react.dev/blog/2024/12/05/react-19", mode: "full" })
// → 完整清理文本，带边界标记

web_fetch({ url: "https://react.dev/blog/2024/12/05/react-19", mode: "quotes" })
// → 相关引用/摘要，带来源元数据
```

### `research_search` — 网络研究验证工具（v0.4.1，默认关闭）

仅限网页的研究工具：发现来源、获取证据、可选 LLM 验证。

**默认关闭**：LLM 验证需设置 `PI_SEARCH_LLM_ENABLED=always`。

```typescript
// 默认：返回证据，状态为 [VERIFICATION DISABLED]
research_search({ query: "React Server Components 是什么" })

// 启用 LLM 后：返回 [VERIFICATION ENABLED] + 带引用的答案
research_search({ query: "React Server Components 是什么", maxSources: 3 })

// 显式控制验证
research_search({ query: "React Server Components 是什么", verify: false })
// → [VERIFICATION DISABLED]，仅返回证据
```

输出始终包含明确状态：
- `[VERIFICATION ENABLED]` — LLM 验证答案（带引用）
- `[VERIFICATION DISABLED]` — 仅证据，未使用 LLM
- `[VERIFICATION FAILED: 原因]` — LLM 尝试但失败

不读取本地文件。不进行查询重写。

## v0.5.0 新特性

| 特性 | 说明 |
|---|---|
| **证据卡片** | Lexical fallback 使用结构化卡片格式，budget-aware 截断 (compact ≤ 6k chars)。其他 provider（ripgrep、mgrep、DDG、PDF）保持 backward-compatible plain-text 输出。证据卡片模块可后续渐进迁移其他 engine。 |
| **CLI 能力检测** | 启动时自动检测 `gh`、`htmlq`、`pdftotext`；区分本地与网络 CLI 工具，独立启用开关。 |
| **mgrep 断路器** | mgrep 遇到配额（`429`）或认证错误时会话级快速失败 — 避免重复慢速失败；TTL 可配置。 |
| **词法回退** | mgrep 不可用或断路器开启时，分词 + 多轮 ripgrep 回退 — 无语义引擎也能获得近似语义结果。 |
| **SearXNG 网页搜索** | 可配置自托管 SearXNG 实例作为 `web_search` 后端（通过 `PI_SEARCH_WEB_PROVIDER` 启用）。 |
| **GitHub 搜索** | 可启用 `gh` CLI 集成，在 `web_search` 中搜索仓库/Issue/代码。 |
| **DDG HTML 解析器** | 有 `htmlq` 时改进 DuckDuckGo 结果提取。 |
| **PDF 提取** | `web_fetch` 在有 `pdftotext` 时自动提取 PDF 内容。 |

新增源码模块：`evidence-cards.ts`、`cli-capabilities.ts`、`mgrep-circuit-breaker.ts`、`lexical-fallback.ts`、`htmlq-parser.ts`、`searxng-provider.ts`、`pdf-extractor.ts`、`github-search.ts`。

## 功能特点

| 特性 | 含义 |
|---|---|
| 自动路由 | 代码类查询走 `ripgrep`；自然语言查询走 `mgrep`。 |
| 证据卡片 (v0.5) | 所有工具返回统一卡片格式 — 标题、来源、摘要、相关性、元数据。 |
| CLI 能力检测 (v0.5) | 启动时检测 `gh`、`htmlq`、`pdftotext`；本地/网络分离。 |
| 断路器 (v0.5) | mgrep 429/认证失败触发会话级断路器；避免重复慢速重试。 |
| 词法回退 (v0.5) | mgrep 不可用时多轮 ripgrep 回退 — 比无结果好。 |
| 网页证据 | `web_search` 发现 URL；`web_fetch` 安全读取网页并标记不可信边界。 |
| SearXNG 支持 (v0.5) | 自托管搜索引擎作为 `web_search` 后端。 |
| GitHub 搜索 (v0.5) | `gh` CLI 集成，搜索仓库/Issue/代码。 |
| PDF 提取 (v0.5) | `web_fetch` 在有 `pdftotext` 时自动提取 PDF 内容。 |
| 可选研究验证 | `research_search` 构建仅网页证据包；LLM 验证默认关闭。 |
| 显式安全策略 | 命令、路径、网络、临时目录、审计策略会出现在工具 details 中。 |
| 优雅降级 | mgrep 网页搜索缺失/失败时，可回退到 DuckDuckGo URL 发现。 |
| 低隐藏成本 | 默认安装不触发额外 LLM 验证，也不自动联网安装依赖。 |

## 按搜索场景的效率对比

基于项目测试报告与手工基线。具体耗时受机器和网络影响，但搜索路径差异稳定。

| 场景 | 不安装 `pi-search` | 安装 `pi-search` 后 | 实际收益 |
|---|---|---|---|
| 精确符号/函数查找 | Agent 可能反复尝试 shell 搜索，或需要你提示文件位置 | `search({ query: "registerTool" })` → ripgrep，约 0.007-0.02s | 离线即时定位，返回文件+行号证据 |
| 文件名/扩展名/路径查询 | 手动 `find`/`grep` 式探索 | 自动路由到 ripgrep，约 0.02s | 减少 prompt 往返和工具尝试 |
| 本地自然语言问题 | 精确 grep 容易漏掉语义相关代码 | mgrep 语义搜索，通常 3-13s | 不必猜精确关键词也能找代码 |
| 中文自然语言本地查询 | 往往要先猜英文标识符 | mgrep 语义搜索，实测约 4.5s | 更适合中英混合代码库探索 |
| 网页 URL 发现 | Agent 使用普通网页搜索，输出格式不稳定 | `web_search` 返回数量受控的结构化 URL，mgrep 约 5s 或 DDG 回退约 1.3s | 更适合后续 `web_fetch` 精读 |
| 网页正文读取 | 原始 HTML 或过大的粘贴内容 | `web_fetch` compact/quotes/full，网络后通常 <1s | 上下文更干净，带风险标记和不可信边界 |
| 带引用网页研究 | Agent 手工组合搜索、抓取、回答 | `research_search` 收集有界证据；验证显式且默认关闭 | 更安全的日常研究流，无静默 LLM 成本 |

## 与 Super Pi 配合，以及是否可单独使用

`pi-search` 与 Super Pi 搭配最佳：Super Pi 的 brainstorm → plan → work → review 工作流会自然调用 `search`、`web_search`、`web_fetch`、`research_search` 作为证据工具。

你**不需要安装 Super Pi** 也能使用本包。`pi-search` 是标准 Pi Coding Agent package：

- 必需：**Pi Coding Agent** runtime。
- 可选：**Super Pi** skills/workflows。
- 不适合：脱离 Pi runtime 当作普通 Unix CLI 使用。本包暴露的是 Pi extension tools；底层 helper 虽然是普通源码模块，但面向用户的产品形态是 Pi 扩展。

典型使用方式：

| 组合 | 支持情况 | 说明 |
|---|---:|---|
| Pi Coding Agent + `pi-search` | ✅ | 完全支持，作为独立 Pi 扩展使用。 |
| Super Pi + `pi-search` | ✅ 推荐 | 最佳 Agent 工作流：CE 技能 + 搜索/证据工具。 |
| 没有 Pi runtime，只想 shell 使用 | ❌ | 请直接使用 `rg`、`mgrep` 或自己的脚本。 |

## mgrep 免费额度/认证失败后的 fallback

`mgrep` 可能因为未安装、未认证、网络错误、免费额度/速率限制（例如 HTTP `429`）而失败。`pi-search` 按工具路径分别处理：

| 工具路径 | mgrep 可用时 | mgrep 缺失/失败/额度用完时 |
|---|---|---|
| `search` 精确/代码类 | 优先用 ripgrep | 仍用 ripgrep；不消耗 mgrep 额度 |
| `search` 自然语言 | 用 mgrep 本地语义搜索 | 返回明确安装/认证/错误信息；不会伪造语义结果 |
| `web_search` URL | 用 mgrep web search | 通过 `safeFetchText()` 回退到 DuckDuckGo HTML 搜索 |
| `web_search({ answer: true })` | 用 mgrep answer 模式 | 回退为 DuckDuckGo URL 列表；不会伪造 AI 答案 |
| `/web` 命令 | mgrep 可用时使用 answer 模式 | 回退为 DuckDuckGo 结果 |
| `research_search` | DuckDuckGo 发现 + safe fetch 证据 | 不依赖 mgrep answer 模式；LLM verifier 仍默认关闭 |

fallback 的原则是诚实：AI 摘要/语义排序不可用时，工具返回证据或 URL，不伪装成已验证答案。

## 自定义返回数量

默认返回 **5** 条结果。

### 单次查询（通过提示词）

用自然语言告诉 Agent，无需改代码：

> *"搜索 React 19 新特性，返回 10 条结果"*
> *"Search the web for React 19 new features, return 10 results"*

Agent 会自动传递 `count: 10` 给 `web_search`。中英文提示词均支持。

### 永久修改默认值

直接告诉 Agent：

> *"请将 web_search 的默认返回数量从 5 改为 10"*
> *"Change the default result count of web_search from 5 to 10"*

Agent 会帮你编辑 `extensions/pi-search.ts`，改完两处数字后重启 pi 即可。

## 交互命令

| 命令 | 用途 |
|:---|:---|
| `/search <query> [path]` | 本地搜索（自动路由 rg/mgrep） |
| `/web <query>` | 网页搜索 |
| `/fetch <url>` | 抓取 URL |

## 环境变量

所有变量均为可选。默认值可零配置直接使用。

| 变量 | 取值 | 默认 | 用途 |
|---|---|---|---|
| `PI_SEARCH_AUTO_INSTALL` | `never` \| `always` | `never` | 自动安装缺失引擎（ripgrep/mgrep）。 |
| `PI_SEARCH_ALLOW_OUTSIDE_CWD` | `never` \| `always` | `never` | 允许 `search` 查询项目目录外的路径。 |
| `MXBAI_API_KEY` | `mxb_...` | — | mgrep API 密钥。mgrep 语义/网页搜索必需。 |
| `PI_SEARCH_LLM_ENABLED` | `never` \| `ask` \| `always` | `never` | 启用 `research_search` 的 LLM 验证。 |
| `PI_SEARCH_LLM_PROVIDER` | `openai` \| `anthropic` \| `local-openai` | — | LLM 提供商。 |
| `PI_SEARCH_LLM_MODEL` | 模型名称 | — | 模型标识（如 `gpt-4o-mini`）。 |
| `PI_SEARCH_LLM_BASE_URL` | URL | — | 自定义 API 端点（用于本地/自托管 LLM）。 |
| `PI_SEARCH_LLM_API_KEY_ENV` | 环境变量名 | — | 存储 LLM API 密钥的环境变量名（如 `OPENAI_API_KEY`）。密钥值不会被暴露。 |
| `PI_SEARCH_LOCAL_CLI_ENHANCEMENTS` | `auto` \| `never` | `auto` | 自动检测并使用 `htmlq`、`pdftotext` 增强输出。 |
| `PI_SEARCH_NETWORK_CLI_ENHANCEMENTS` | `always` \| `never` | `never` | 启用 `gh` CLI 进行 GitHub 搜索（依赖网络，默认关闭）。 |
| `PI_SEARCH_WEB_PROVIDER` | `auto` \| `searxng` \| `duckduckgo` | `auto` | 网页搜索后端。`auto` 优先尝试 SearXNG（如已配置），再回退 DuckDuckGo。 |
| `PI_SEARCH_SEARXNG_URL` | URL | — | SearXNG 实例地址（如 `http://localhost:8080`）。`PI_SEARCH_WEB_PROVIDER=searxng` 时必需。 |
| `PI_SEARCH_SEARXNG_FORMAT` | `json` \| `html` | `json` | SearXNG 响应格式。 |
| `PI_SEARCH_MGREP_BREAKER_TTL_MS` | 数字 | `600000` | 断路器 TTL（毫秒，默认 10 分钟）。mgrep 429/认证失败后，后续调用直接跳过直到 TTL 过期。 |

### 快速示例

**默认使用 — 无需配置：**

ripgrep 精确代码搜索和 mgrep/DuckDuckGo 网页 URL 发现开箱即用。

**启用 mgrep 语义搜索：**

```bash
export MXBAI_API_KEY="mxb_your_key_here"
```

**启用 research_search LLM 验证（可选）：**

```bash
export PI_SEARCH_LLM_ENABLED=always
export PI_SEARCH_LLM_PROVIDER=openai
export PI_SEARCH_LLM_API_KEY_ENV=OPENAI_API_KEY
export OPENAI_API_KEY="sk-your-key"
```

配置后 `research_search` 返回 `[VERIFICATION ENABLED]` 带引用答案。不配置则返回 `[VERIFICATION DISABLED]` 仅证据——无隐藏 LLM 成本。

**使用本地/自托管 LLM：**

```bash
export PI_SEARCH_LLM_ENABLED=always
export PI_SEARCH_LLM_PROVIDER=local-openai
export PI_SEARCH_LLM_BASE_URL=http://localhost:11434/v1
export PI_SEARCH_LLM_MODEL=llama3
export PI_SEARCH_LLM_API_KEY_ENV=OLLAMA_KEY
export OLLAMA_KEY=unused
```

**首次使用时自动安装引擎：**

```bash
export PI_SEARCH_AUTO_INSTALL=always
```

**允许搜索项目目录外路径：**

```bash
export PI_SEARCH_ALLOW_OUTSIDE_CWD=always
```

**启用 GitHub 搜索（通过 `gh` CLI）：**

```bash
export PI_SEARCH_NETWORK_CLI_ENHANCEMENTS=always
# 需先执行 gh auth login
```

**使用 SearXNG 进行网页搜索：**

```bash
export PI_SEARCH_WEB_PROVIDER=searxng
export PI_SEARCH_SEARXNG_URL=http://localhost:8080
export PI_SEARCH_SEARXNG_FORMAT=json
```

## 工作原理

```
┌─ resolveBin() ────────────────────────────────────────────┐
│  PATH 查找 → 已知路径 → 安装指引                           │
│  （自动安装需设置 PI_SEARCH_AUTO_INSTALL=always）           │
├───────────────────────────────────────────────────────────┤
│  cliCapabilities() — CLI 工具检测 (v0.5)                   │
│    本地: htmlq, pdftotext（默认 auto）                      │
│    网络: gh（需通过环境变量显式启用）                        │
├───────────────────────────────────────────────────────────┤
│  mgrepCircuitBreaker() — 会话级快速失败 (v0.5)              │
│    429 / 认证错误 → 触发断路器，TTL 可配置                   │
├───────────────────────────────────────────────────────────┤
│  runCommand() — 最小权限运行器                              │
│    仅 execFile · 最小 env · timeout · maxBuffer             │
├───────────────────────────────────────────────────────────┤
│  safeFetchText() — 安全网页抓取                             │
│    SSRF 防护 · DNS/IP 校验 · 重定向控制                     │
│    Content-Type 检查 · 大小限制 · 超时                      │
│    PDF 自动提取（通过 pdftotext，v0.5）                     │
├───────────────────────────────────────────────────────────┤
│  Tool: search                                               │
│    代码特征? → rg (有则 0.02s)                              │
│          否 → mgrep (3-8s, 语义)                           │
│          mgrep 断路器开启? → 词法回退 (v0.5)                │
│     answer=true? → -a (AI 摘要)                             │
│    所有结果 → 证据卡片 (v0.5)                               │
├───────────────────────────────────────────────────────────┤
│  Tool: web_search                                           │
│    后端: SearXNG (v0.5) → gh (v0.5) → mgrep → DDG          │
│    DDG 提取在有 htmlq 时增强 (v0.5)                         │
│    所有结果 → 证据卡片 (v0.5)                               │
├───────────────────────────────────────────────────────────┤
│  Tool: web_fetch                                            │
│    safeFetchText() → 清理 → mode (compact/quotes/full)     │
│    PDF? → pdftotext 提取 (v0.5)                             │
│    不可信边界 · 风险标记 · 上下文预算                        │
│    所有结果 → 证据卡片 (v0.5)                               │
├───────────────────────────────────────────────────────────┤
│  Tool: research_search                                      │
│    DuckDuckGo 发现 → safeFetchText 证据包                   │
│    可选 verifier → 显式验证状态                              │
│    所有结果 → 证据卡片 (v0.5)                               │
└───────────────────────────────────────────────────────────┘
```

## 安全

- **最小权限运行器**：子进程仅获得最小 env 白名单，不含敏感 token。
- **显式安全策略**（v0.4.0）：命令配置、路径边界、网络策略、项目级临时目录。
- **安全网页抓取**：所有 fetch 路径通过 `safeFetchText()`，内置 SSRF 防护。
- **自动安装 opt-in**：默认 `never`。设置 `PI_SEARCH_AUTO_INSTALL=always` 启用。
- **不可信边界**：所有网页内容明确标记为不可信证据。
- **风险标记**：检测 prompt 注入短语并标记。
- **CLI 能力隔离**：本地工具（htmlq、pdftotext）和网络工具（gh）有独立启用开关。
- **断路器**：mgrep 失败触发会话级断路器；避免重复慢速重试。

这些安全控制保持轻量：`pi-search` 是搜索扩展，不是浏览器 Agent 或爬虫。

详见 [安全策略文档](docs/security-policy.md)。

## 环境要求

- **Pi Coding Agent** ≥ 0.73.0
- **ripgrep** — 手动安装或设置 `PI_SEARCH_AUTO_INSTALL=always`
- **mgrep** — 手动安装：`npm install -g @mixedbread/mgrep`

## 认证配置

### 设备登录（7 天过期）

```bash
mgrep login
```

### API Key（推荐，永久有效）

1. [Mixedbread Platform](https://www.platform.mixedbread.com) 注册
2. 创建 API Key → 导出：

```bash
export MXBAI_API_KEY="mxb_your_key_here"
```

## 设计原则

- **证据卡片** (v0.5.0) — Lexical fallback 结构化卡片格式；其他 engine 保持 backward-compatible legacy output
- **CLI 能力检测** (v0.5.0) — 自动检测 gh、htmlq、pdftotext
- **断路器** (v0.5.0) — mgrep 配额/认证错误时会话级快速失败
- **词法回退** (v0.5.0) — mgrep 不可用时多轮 ripgrep 回退
- **SearXNG 启用** (v0.5.0) — 自托管网页搜索后端
- **GitHub 搜索** (v0.5.0) — `gh` CLI 集成
- **PDF 提取** (v0.5.0) — `web_fetch` 自动提取 PDF
- **双引擎** — ripgrep 0.02s 处理代码，mgrep 3-8s 处理自然语言
- **最小权限沙箱** — 进程级 env/cwd/timeout 隔离，无需 Docker
- **优雅降级** — rg 缺失 → mgrep 接管。mgrep 缺失 → DDG 接管网页搜索
- **Token 感知输出** — compact/quotes/full 模式，带不可信边界和风险标记
- **输出精控** — 所有工具 6000 字符硬上限

## 测评报告

| 类别 | 场景 | 引擎 | 耗时 |
|---|---|---|---|
| 本地 | 代码符号 `registerTool` | ripgrep | 0.007s |
| 本地 | 自然语言 `web search fallback logic` | mgrep | 12.9s |
| 本地 | 中文 `错误处理策略` | mgrep | 4.5s |
| 本地 | 自然语言 + AI 摘要 | mgrep | 13.7s |
| 网页 | 默认 `count: 5` | mgrep | 5.1s |
| 网页 | `answer: true` + 9 条引用 | mgrep | 9.9s |
| 网页 | `count: 3` / `count: 7` 截断 | filterWeb | — |
| 抓取 | HTML 抓取 + 剥离 | Node.js | <1s |
| 降级 | DuckDuckGo 回退 | DDG | 1.3s |
| 边界 | 6000 字符截断 | — | — |

**305 项自动化测试全通过。** 详情：[docs/test-report.md](docs/test-report.md)。

## License

MIT
