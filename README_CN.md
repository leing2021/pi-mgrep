# pi-search

> Ripgrep + mgrep 双引擎路由搜索扩展，专为 Pi Coding Agent 设计。

[Pi Coding Agent](https://github.com/badlogic/pi-mono) 的统一搜索扩展。

## 快速开始

作为 Pi package 安装：

```bash
pi install npm:pi-search
# 重启 pi 或执行 /reload — 工具即可使用。
```

发布前本地开发可用：

```bash
pi install /Users/jasonle/code/pi-search
# 或单次测试：
pi -e /Users/jasonle/code/pi-search
```

本包暴露 `extensions/pi-search.ts`，不需要手动复制文件到 `~/.pi/agent/extensions/`。

如从 `pi-mgrep` 升级：先移除旧包或旧本地扩展，再安装 `pi-search`。工具名保持不变：`search`、`web_search`、`web_fetch`。

## 提供的工具

三个 LLM 可调用的工具，内置进程级最小权限沙箱。

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

ripgrep 不可用时，mgrep 自动接管所有查询。

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

## 工作原理

```
┌─ resolveBin() ────────────────────────────────────────────┐
│  PATH 查找 → 已知路径 → 安装指引                           │
│  （自动安装需设置 PI_SEARCH_AUTO_INSTALL=always）           │
├───────────────────────────────────────────────────────────┤
│  runCommand() — 最小权限运行器                              │
│    仅 execFile · 最小 env · timeout · maxBuffer             │
├───────────────────────────────────────────────────────────┤
│  safeFetchText() — 安全网页抓取                             │
│    SSRF 防护 · DNS/IP 校验 · 重定向控制                     │
│    Content-Type 检查 · 大小限制 · 超时                      │
├───────────────────────────────────────────────────────────┤
│  Tool: search                                               │
│    代码特征? → rg (有则 0.02s)                              │
│          否 → mgrep (3-8s, 语义)                           │
│     answer=true? → -a (AI 摘要)                             │
├───────────────────────────────────────────────────────────┤
│  Tool: web_search                                           │
│    mgrep -w /tmp/mgrep-empty（count 限制 1-10）             │
│    失效? → DuckDuckGo via safeFetchText()                   │
├───────────────────────────────────────────────────────────┤
│  Tool: web_fetch                                            │
│    safeFetchText() → 清理 → mode (compact/quotes/full)     │
│    不可信边界 · 风险标记 · 上下文预算                        │
└───────────────────────────────────────────────────────────┘
```

## 安全

- **最小权限运行器**：子进程仅获得最小 env 白名单，不含敏感 token。
- **安全网页抓取**：所有 fetch 路径通过 `safeFetchText()`，内置 SSRF 防护。
- **自动安装 opt-in**：默认 `never`。设置 `PI_SEARCH_AUTO_INSTALL=always` 启用。
- **不可信边界**：所有网页内容明确标记为不可信证据。
- **风险标记**：检测 prompt 注入短语并标记。

这些安全控制保持轻量：`pi-search` 是搜索扩展，不是浏览器 Agent 或爬虫。

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
# ~/.zshrc
export MXBAI_API_KEY="mxb_your_key_here"
```

## 设计原则

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

**49 项自动化测试全通过。** 详情：[docs/test-report.md](docs/test-report.md)。

## License

MIT
