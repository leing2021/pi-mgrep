# pi-mgrep

> Ripgrep + mgrep 双引擎路由。全部自动安装。零配置。

[Pi Coding Agent](https://github.com/badlogic/pi-mono) 的统一搜索扩展。

## 快速开始

```bash
npm install -g pi-mgrep
# 重启 pi — ripgrep 和 mgrep 首次使用时自动安装。
```

## 提供的工具

三个 LLM 可调用的工具。

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

```typescript
web_fetch({ url: "https://react.dev/blog/2024/12/05/react-19" })
// → 纯文本，最大 6000 字符
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

Agent 会帮你编辑 `.pi/extensions/mgrep.ts`，改完两处数字后重启 pi 即可。

## 交互命令

| 命令 | 用途 |
|:---|:---|
| `/search <query> [path]` | 本地搜索（自动路由 rg/mgrep） |
| `/web <query>` | 网页搜索 |
| `/fetch <url>` | 抓取 URL |

## 工作原理

```
┌─ resolveRg() ──────────────────────────────────────────────┐
│  which rg → 已知路径 → brew install ripgrep                │
├─ resolveMgrep() ───────────────────────────────────────────┤
│  which mgrep → 已知路径 → npm install -g @mixedbread/mgrep │
├────────────────────────────────────────────────────────────┤
│  Tool: search                                               │
│    代码特征? → rg (有则 0.02s)                              │
│          否 → mgrep (3-8s, 语义)                           │
│     answer=true? → -a (AI 摘要)                             │
├────────────────────────────────────────────────────────────┤
│  Tool: web_search                                           │
│    mgrep -w /tmp/mgrep-empty                                │
│    失效? → DuckDuckGo HTML（零依赖回退）                    │
├────────────────────────────────────────────────────────────┤
│  Tool: web_fetch                                            │
│    Node.js http.get → HTML 剥离 → 纯文本                    │
└────────────────────────────────────────────────────────────┘
```

## 环境要求

- **Pi Coding Agent** ≥ 0.73.0
- 其余全部自动安装（ripgrep + mgrep）

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
- **自动安装** — 两个引擎均通过系统包管理器自动安装
- **优雅降级** — rg 缺失 → mgrep 接管。mgrep 缺失 → DDG 接管网页搜索
- **输出精控** — 所有工具 6000 字符硬上限

## 测评报告

15 项全通过，详见 [docs/test-report.md](docs/test-report.md)。

## License

MIT
