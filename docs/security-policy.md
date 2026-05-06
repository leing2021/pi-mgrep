# Security Policy — pi-search v0.4.0

> **Scope**: Process-level least-privilege sandbox for a Pi Coding Agent search extension.
> This is NOT a Docker/VM/OS-level sandbox. It operates within the user's process and environment.

## Command Policy

All external commands run through `runCommand()` / `runPolicyCommand()`:

- `execFile` only — never shell-string execution (`execSync`).
- Bounded `timeout`, `maxBuffer`, controlled `cwd`.
- Env allowlist per profile:

| Profile | Use | API keys | Network |
|---|---|---|---|
| `rg` | Exact local search | None | `false` |
| `mgrep-local` | Semantic local search | `MXBAI_API_KEY` only | `true` |
| `mgrep-web` | Web result discovery | `MXBAI_API_KEY` only | `true` |
| `installer` | Opt-in install | None | `true` |

Unknown profiles are rejected.

Sensitive environment variables (`GITHUB_TOKEN`, `AWS_*`, `OPENAI_API_KEY`, `NPM_TOKEN`, SSH socket, etc.) are never forwarded to child processes.

## Path Policy

Local `search` validates all user-provided paths:

- **Default root**: `process.cwd()`.
- **Traversal**: `../` and absolute paths outside cwd are rejected by default.
- **Sensitive paths** (rejected even inside cwd):
  - `.env`, `.ssh`, `.aws`, `.gcloud`, `.kube`, `.npmrc`
  - `id_rsa`, `id_ed25519`, `.pem`, `.key`
- **System paths**: `/etc`, `/private`, `/var` are rejected.
- **Opt-in**: `PI_SEARCH_ALLOW_OUTSIDE_CWD=always` allows non-sensitive outside-cwd paths.

## Network Policy

All web fetch paths use `safeFetchText()`:

- **HTTPS-only** by default.
- **URL validation**: length clamp, scheme check, no credentials.
- **Hostname blocking**: `localhost`, `metadata.google.internal`, etc.
- **IP-as-hostname**: Direct IP addresses are checked for private/blocked ranges.
- **DNS pre-validation**: Resolved IPs are checked for private ranges, metadata IPs, blocked IPs.
- **IPv6 protection**: Loopback (`::1`), ULA (`fc00::`, `fd00::`), link-local (`fe80::`), multicast (`ff00::`), IPv4-mapped private (`::ffff:10.*`, `::ffff:127.*`).
- **Redirect revalidation**: Every redirect target is fully re-validated.
- **allowedHosts**: Optional host allowlist for specific fetch operations (e.g., DuckDuckGo fallback).
- **Content-Type allowlist**: `text/html`, `text/plain`, `application/xhtml+xml`, `text/*`.
- **Size/timeout limits**: Configurable, bounded defaults.

## Temp Directory

- Replaces fixed `/tmp/mgrep-empty` with project-scoped `/tmp/pi-search-empty-{hash}`.
- Deterministic per project cwd.
- Empty directory only; no user files copied in.

## Auto-Install Policy

- Default: `PI_SEARCH_AUTO_INSTALL=never`.
- `ask` is treated as `never` in non-interactive tool contexts.
- Opt-in: `PI_SEARCH_AUTO_INSTALL=always`.

## Untrusted Content

All fetched web content is marked as untrusted evidence:

```text
[UNTRUSTED WEB CONTENT START]
...
[UNTRUSTED WEB CONTENT END]
```

Risk flags are generated for:
- Suspicious prompt-injection phrases.
- Hidden CSS (`display:none`, `visibility:hidden`, `font-size:0`).
- Hidden form elements.

## Audit Metadata

Tool results include structured `details`:

- `sandboxMode`: `"process-env-cwd-timeout"`
- `pathPolicy`: path validation result (for local search)
- `network`: boolean
- `trust`: `"untrusted-web"` (for web content)
- `contextBudget`: `{ returned, max, truncated }`
- `riskFlags`: array of detected risks

## Research Search (v0.4.1, default-off)

The `research_search` tool adds optional LLM-verified web research:

- **Default-off**: `PI_SEARCH_LLM_ENABLED=never` (default). Zero LLM cost by default.
- **Web-only**: No local file search or path validation.
- **No query rewrite**: Query is used as-is for web search.
- **No `mgrep answer=true`**: Uses DuckDuckGo for URL discovery + `safeFetchText` for evidence.
- **Explicit status**: Always shows `[VERIFICATION ENABLED]`, `[VERIFICATION DISABLED]`, or `[VERIFICATION FAILED: reason]`.
- **Evidence isolation**: Only clipped, sanitized web evidence is sent to the LLM provider.
- **No system prompt leakage**: Environment variables, local files, and developer prompts are never sent to the verifier.
- **Config via env vars** (not hardcoded secrets):
  - `PI_SEARCH_LLM_ENABLED=never|ask|always`
  - `PI_SEARCH_LLM_PROVIDER=openai|anthropic|local-openai`
  - `PI_SEARCH_LLM_MODEL=...`
  - `PI_SEARCH_LLM_BASE_URL=...`
  - `PI_SEARCH_LLM_API_KEY_ENV=<env var name>` (name only, never the key value)

## What This Does NOT Provide

- Docker/Podman/VM/OS-level sandboxing.
- Protection against kernel-level exploits.
- Protection against compromised binary (rg/mgrep) behavior.
- Full browser sandboxing (JavaScript execution, CSP bypass).
- Enterprise RBAC or policy engine.
