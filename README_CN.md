# pi-mgrep

> 一个依赖。零配置。自动安装。

[Pi Coding Agent](https://github.com/badlogic/pi-mono) 的统一搜索扩展 — 语义搜索 + 网页搜索 + 页面阅读。mgrep 一肩挑。

## 快速开始

```bash
# 安装
npm install -g pi-mgrep

# 重启 pi — 完成。
# mgrep 首次使用时自动安装。
```

**无需 ripgrep。无需手动装 mgrep。无需 API key。**

## 提供的工具

自动注册三个 LLM 可调用的工具。

### `search` — 本地搜索

mgrep 语义搜索。精确匹配和自然语言都支持。

```typescript
search({ query: "registerTool" })
// → 精确匹配，返回文件 + 行号

search({ query: "error handling logic", answer: true })
// → AI 生成的结构化摘要
```

### `web_search` — 网页搜索

mgrep web + DuckDuckGo 自动回退。

```typescript
web_search({ query: "React 19 新特性" })
// → 3 个带匹配度评分的 URL

web_search({ query: "React 19 新特性", answer: true })
// → AI 生成的带引用答案
```

### `web_fetch` — 网页抓取

抓取 URL，剥离 HTML，返回纯文本。

```typescript
web_fetch({ url: "https://react.dev/blog/2024/12/05/react-19" })
// → 纯文本，最大 6000 字符
```

## 交互命令

| 命令 | 用途 |
|:---|:---|
| `/search <query> [path]` | 本地搜索 |
| `/web <query>` | 网页搜索，带 AI 摘要 |
| `/fetch <url>` | 抓取并显示 URL 内容 |

## 工作原理

```
┌───────────────────────────────────────────────────────────┐
│  扩展加载                                                  │
│  ├─ resolveMgrep() → PATH 上有? → 直接用                   │
│  ├─ 没找到? → npm install -g @mixedbread/mgrep             │
│  └─ 还是没? → 工具返回友好错误提示                           │
├───────────────────────────────────────────────────────────┤
│  Tool: search                                              │
│    查询 → mgrep search -s -c -m 5 <query> <path>          │
│    answer=true? → 追加 -a（AI 摘要）                       │
├───────────────────────────────────────────────────────────┤
│  Tool: web_search                                          │
│    主 → mgrep search -w -m <n*3> /tmp/mgrep-empty         │
│    失效→ DuckDuckGo HTML 抓取（零外部依赖）                 │
├───────────────────────────────────────────────────────────┤
│  Tool: web_fetch                                           │
│    URL → Node.js http.get → HTML 剥离 → 纯文本             │
│    完全自包含，无外部依赖                                    │
└───────────────────────────────────────────────────────────┘
```

## 认证配置

mgrep 需要认证才能调用 Mixedbread API，两种方式：

### 设备登录（7 天过期）

```bash
mgrep login
# 打开浏览器 → 授权 → token 保存
# 每 7 天重新登录一次
```

### API Key（推荐，永久有效）

1. 打开 [Mixedbread Platform](https://www.platform.mixedbread.com) 注册
2. 在控制台创建 API Key
3. 在 shell 配置中导出：

```bash
# ~/.zshrc
export MXBAI_API_KEY="mxb_your_key_here"
```

## 设计原则

- **mgrep 一把梭** — 不依赖 ripgrep，精确匹配和语义搜索全用 mgrep
- **自动安装** — mgrep 缺失时自动执行 `npm install -g @mixedbread/mgrep`
- **回退链路** — mgrep web → DuckDuckGo，API 宕机不影响网页搜索
- **隔离策略** — `/tmp/mgrep-empty` 确保网页搜索绝不混入本地文件
- **输出精控** — 所有工具 6000 字符硬上限，适配任意上下文窗口

## 文件结构

```
pi-mgrep/
├── .pi/
│   └── extensions/
│       └── mgrep.ts        ← 扩展核心（340+ 行）
├── package.json
├── README.md
└── README_CN.md
```

## 相关链接

- [mgrep](https://github.com/mixedbread-ai/mgrep) — 语义 grep CLI
- [Pi Extensions](https://pi.dev/docs/latest/extensions) — 官方文档
- [Mixedbread Platform](https://www.platform.mixedbread.com) — API key 管理

## License

MIT
