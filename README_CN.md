# pi-mgrep

> [Pi Coding Agent](https://github.com/badlogic/pi-mono) 的统一搜索扩展 — 语义搜索 + 精确匹配 + 网页回退，一个文件搞定。

## 快速开始

```bash
# 1. 安装 mgrep CLI
npm install -g @mixedbread/mgrep
mgrep login   # 一次性设备认证

# 2. 安装本扩展
mkdir -p ~/.pi/agent/extensions
cp .pi/extensions/mgrep.ts ~/.pi/agent/extensions/mgrep.ts

# 3. 重启 pi 即可
```

## 提供的工具

自动注册三个 LLM 可调用的工具：

### `search` — 本地智能路由

根据查询特征自动选择引擎：

| 查询特征 | 引擎 | 速度 |
|:---|:---|:---|
| `registerTool` (驼峰) | **ripgrep** | 0.02s |
| `calculate_total` (下划线) | **ripgrep** | 0.02s |
| `app.tsx` (文件扩展名) | **ripgrep** | 0.02s |
| `错误处理逻辑怎么写` (自然语言) | **mgrep** | 3-8s |

```typescript
// LLM 会自动调用：
search({ query: "registerTool" })
// → ripgrep 0.02s 返回文件+行号匹配

search({ query: "error handling logic", answer: true })
// → mgrep 语义搜索，返回 AI 生成的摘要
```

### `web_search` — 网页搜索

通过 mgrep 进行语义网页搜索，mgrep 失效时自动回退到 DuckDuckGo。

```typescript
web_search({ query: "React 19 新特性" })
// → 3 个带匹配度评分的 URL

web_search({ query: "React 19 新特性", answer: true })
// → AI 生成的带引用来源的答案，而非 URL 列表
```

**回退链：** mgrep web（主）→ DuckDuckGo HTML 抓取（自动降级）

### `web_fetch` — 网页抓取

抓取 URL，剥离 HTML，返回纯文本。

```typescript
web_fetch({ url: "https://react.dev/blog/2024/12/05/react-19" })
// → 纯文本内容，最大 6000 字符
```

## 交互命令

| 命令 | 用途 |
|:---|:---|
| `/search <query> [path]` | 本地搜索，自动选引擎 |
| `/web <query>` | 网页搜索，带 AI 摘要 |
| `/fetch <url>` | 抓取并显示 URL 内容 |

## 架构

```
┌─ search (本地) ───────────────────────────────────────────┐
│  智能路由:                                                  │
│    代码特征   → ripgrep (0.02s, 离线)                     │
│    自然语言   → mgrep   (3-8s, 语义)                      │
│  回退: mgrep 失效 → ripgrep 兜底                           │
├─ web_search (互联网) ─────────────────────────────────────┤
│  主引擎:  mgrep web   (语义 + reranking)                  │
│  回退:   DuckDuckGo  (HTML 抓取, 无需 API key)            │
│  隔离:   指向 /tmp/mgrep-empty (避免混入本地结果)          │
├─ web_fetch (页面阅读) ────────────────────────────────────┤
│  curl + Node.js HTML→text 转换                             │
│  无外部依赖                                                │
└────────────────────────────────────────────────────────────┘
```

## 环境要求

- **Pi Coding Agent** ≥ 0.73.0
- **mgrep CLI** (`npm install -g @mixedbread/mgrep`)
- **mgrep login** 或 `MXBAI_API_KEY` 环境变量（CI/CD 推荐用 API key，永久有效）
- **ripgrep**（可选 — 本地语义搜索在无 ripgrep 时自动升级为 mgrep 全语义模式）

## Token 开销

system prompt 增加约 400 tokens（3 个工具定义 + 3 个命令注册）。在 128K+ 上下文窗口中可忽略不计。

## 文件结构

```
pi-mgrep/
├── .pi/
│   └── extensions/
│       └── mgrep.ts        ← 扩展核心（349 行）
├── package.json
├── README.md
└── README_CN.md
```

## 设计原则

1. **Agent 优先** — LLM 无需知道引擎选择逻辑，工具内部自动路由
2. **回退无感** — mgrep 失效时自动降级到 DuckDuckGo/ripgrep，LLM 无感知
3. **单文件部署** — 一个 `.ts` 文件，零配置即可工作
4. **输出精控** — 6000 字符硬上限，防止撑爆上下文窗口

## 相关链接

- [mgrep](https://github.com/mixedbread-ai/mgrep) — 语义 grep CLI
- [Pi Extensions](https://pi.dev/docs/latest/extensions) — 官方文档
- [Mixedbread Platform](https://www.platform.mixedbread.com) — API key 管理

## License

MIT
