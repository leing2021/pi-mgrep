# pi-search Test Report

> Updated: 2026-05-06  
> Package shape: Pi npm package (`pi.extensions = ["extensions/pi-search.ts"]`)  
> Runtime: Node 22.20 / macOS  
> Dependencies: 0 runtime dependencies; Pi-provided peer deps only

## Summary

`pi-search` is verified as a lightweight Pi search extension package:

- Extension entry: `extensions/pi-search.ts`
- Shared runtime helpers: `src/security.mjs`
- Package manifest: `package.json` → `pi.extensions`
- Old project-local extension path removed: `.pi/extensions/mgrep.ts`
- Test directory is local-only and not intended for package publishing
- Docs are local-only except this report

Latest verification:

```bash
npm test
npm pack --dry-run
```

Results:

| Check | Result |
|---|---|
| Automated tests | ✅ 49/49 passed |
| npm dry-run package | ✅ 6 files, 15.6 kB package, 51.0 kB unpacked |
| Runtime dependencies | ✅ none |
| Extension load path | ✅ package manifest only |
| Local/project conflict prevention | ✅ old `.pi/extensions/mgrep.ts` removed |

---

## Package Verification

### `npm pack --dry-run`

Published package contents are intentionally small:

| File | Purpose |
|---|---|
| `extensions/pi-search.ts` | Pi extension entrypoint |
| `src/security.mjs` | Minimal command/fetch security helpers |
| `package.json` | npm + Pi package manifest |
| `README.md` | English usage docs |
| `README_CN.md` | Chinese usage docs |
| `docs/test-report.md` | Public verification report |

Dry-run result:

| Metric | Value |
|---|---:|
| Package size | 15.6 kB |
| Unpacked size | 51.0 kB |
| Total files | 6 |

### Package Manifest Checks

| Check | Result |
|---|---|
| `package.json.name === "pi-search"` | ✅ |
| `keywords` includes `pi-package` | ✅ |
| `pi.extensions` points to `extensions/pi-search.ts` | ✅ |
| `files` excludes local-only docs/tests | ✅ |
| `peerDependencies` lists Pi-provided packages | ✅ |

---

## Automated Test Result

Command:

```bash
npm test
```

Result:

| Metric | Value |
|---|---:|
| Test suites | 34 |
| Tests | 49 |
| Passed | 49 |
| Failed | 0 |
| Duration | ~69 ms |

---

## Test Coverage

### Rename / Package Identity

| Scenario | Result |
|---|---|
| Package name is `pi-search` | ✅ |
| Repository URL points to `pi-search` | ✅ |
| README title is `# pi-search` | ✅ |
| README_CN title is `# pi-search` | ✅ |
| README install command uses `pi install npm:pi-search` | ✅ |
| README_CN install command uses `pi install npm:pi-search` | ✅ |
| Extension top comment mentions `pi-search` | ✅ |
| Compatibility migration notes exist locally | ✅ |
| `PI_SEARCH_AUTO_INSTALL` documented | ✅ |

### Runtime Policy / Minimal Env

| Scenario | Result |
|---|---|
| `getMinimalEnv('rg')` strips `GITHUB_TOKEN` | ✅ |
| `getMinimalEnv('mgrep-web')` includes `MXBAI_API_KEY` | ✅ |
| `getMinimalEnv('rg')` excludes `MXBAI_API_KEY` | ✅ |
| `runCommand()` child process does not inherit sensitive keys | ✅ |
| `getAutoInstallPolicy()` defaults to `never` | ✅ |
| `PI_SEARCH_AUTO_INSTALL=always` is recognized | ✅ |
| `PI_SEARCH_AUTO_INSTALL` overrides deprecated env | ✅ |
| Deprecated `PI_MGREP_AUTO_INSTALL` fallback works | ✅ |
| `PI_SEARCH_AUTO_INSTALL=ask` is recognized | ✅ |

### Safe Fetch Runtime

| Scenario | Result |
|---|---|
| Rejects `http:` unless explicitly allowed | ✅ |
| Rejects URL credentials | ✅ |
| Rejects localhost hostname | ✅ |
| Rejects redirect to localhost | ✅ |
| Rejects DNS result pointing to private IP | ✅ |
| Rejects binary `Content-Type` | ✅ |
| Allows text/html with charset suffix | ✅ |
| Enforces streaming byte limit | ✅ |
| Handles circular redirects without infinite loop | ✅ |
| Removes script content from HTML | ✅ |
| Detects prompt-injection risk phrases | ✅ |
| Detects hidden CSS | ✅ |
| Supports compact mode | ✅ |
| Supports quotes mode | ✅ |
| Supports full mode | ✅ |

### Static Security Regression

| Scenario | Result |
|---|---|
| No shell-string `execSync` | ✅ |
| No `node -e` subprocess fetch path | ✅ |
| No direct `curl -L` fetch path | ✅ |
| Auto-install is gated by explicit policy | ✅ |
| `runCommand()` exists | ✅ |
| `safeFetchText()` exists | ✅ |
| No child process receives bare `process.env` | ✅ |
| Fetch paths are unified through `safeFetchText()` | ✅ |

### Token-Aware Output

| Scenario | Result |
|---|---|
| `web_fetch` accepts `mode` parameter | ✅ |
| `web_fetch` accepts `maxChars` parameter | ✅ |
| Untrusted boundary markers exist | ✅ |
| Prompt injection risk flags exist | ✅ |
| Context budget metadata exists | ✅ |
| Web content is marked `untrusted-web` | ✅ |
| `web_search.count` is clamped | ✅ |

---

## Manual Functional Baseline

Historical manual checks remain valid for the core search behavior:

| Category | Scenario | Engine | Result |
|---|---|---|---|
| Local Search | Code symbol `registerTool` | ripgrep | ✅ fast exact search |
| Local Search | Natural-language query | mgrep | ✅ semantic results |
| Local Search | Chinese natural-language query | mgrep | ✅ semantic results |
| Web Search | Default `count: 5` | mgrep web | ✅ capped results |
| Web Search | `count: 3` / `count: 7` | filterWeb | ✅ output count respected |
| Web Fetch | HTML page fetch and strip | safeFetchText | ✅ clean text output |
| Degradation | DuckDuckGo fallback | safeFetchText + DDG | ✅ fallback path available |
| Token Limit | Long output | truncation helper | ✅ capped output |

---

## Current Packaging Decision

The project is now maintained as a Pi package, not as a manually copied extension file.

Recommended install after publish:

```bash
pi install npm:pi-search
```

Local development install:

```bash
pi install /Users/jasonle/code/pi-search
```

One-off test:

```bash
pi -e /Users/jasonle/code/pi-search
```

Do **not** also keep an old copied extension at:

```text
~/.pi/agent/extensions/mgrep.ts
~/.pi/agent/extensions/pi-search.ts
<project>/.pi/extensions/mgrep.ts
```

Keeping both old local extension files and the package enabled can duplicate tool registration.

---

## Notes

- `docs/` is local-only except this report.
- `tests/` is local-only and excluded from commits/published package.
- The package remains intentionally small: search tools, safe single-page fetch, no browser agent, no crawler, no heavy sandbox dependency.
