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
| Automated tests | ✅ 135/135 passed |
| npm dry-run package | ✅ 6 files, ~17 kB package, ~56 kB unpacked |
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
| Package name is `@leing2021/pi-search` | ✅ |
| Repository URL points to `pi-search` | ✅ |
| README title is `# pi-search` | ✅ |
| README_CN title is `# pi-search` | ✅ |
| README install command uses `pi install npm:@leing2021/pi-search` | ✅ |
| README_CN install command uses `pi install npm:@leing2021/pi-search` | ✅ |
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

### v0.4.0: Command Policy

| Scenario | Result |
|---|---|
| Unknown profile throws `UNKNOWN_PROFILE` | ✅ |
| `rg` profile has required fields | ✅ |
| `mgrep-local` profile has required fields | ✅ |
| `mgrep-web` has `network=true` | ✅ |
| `installer` profile has required fields | ✅ |
| `rg` profile excludes `MXBAI_API_KEY` | ✅ |
| `mgrep-web` includes `MXBAI_API_KEY` but excludes others | ✅ |
| `mgrep-web` excludes `OPENAI_API_KEY` | ✅ |
| `installer` excludes all sensitive keys | ✅ |
| `runPolicyCommand` rejects unknown profile | ✅ |
| `runPolicyCommand` uses minimal env | ✅ |

### v0.4.0: Path Policy

| Scenario | Result |
|---|---|
| Cwd is allowed | ✅ |
| Subdirectory of cwd is allowed | ✅ |
| Relative `.` is allowed | ✅ |
| `./src` is allowed | ✅ |
| `../` traversal is rejected | ✅ |
| Absolute outside-cwd paths are rejected | ✅ |
| `/private`, `/var`, `/etc` are rejected | ✅ |
| `.env` is rejected (even inside cwd) | ✅ |
| `.ssh`, `.aws`, `.kube`, `.npmrc` are rejected | ✅ |
| `id_rsa`, `id_ed25519`, `.pem`, `.key` are rejected | ✅ |
| Outside-cwd opt-in allows non-sensitive paths | ✅ |
| Sensitive paths remain rejected with opt-in | ✅ |

### v0.4.0: Network Policy

| Scenario | Result |
|---|---|
| `getNetworkPolicy` returns structured policy | ✅ |
| Default enforces HTTPS | ✅ |
| HTTP rejected by default | ✅ |
| `allowedHosts` enforced | ✅ |
| Redirect to localhost rejected | ✅ |
| Redirect to `127.0.0.1` rejected | ✅ |
| DNS private IP rejected | ✅ |
| DNS metadata IP rejected | ✅ |
| IPv6 loopback `::1` rejected | ✅ |
| IPv6 ULA `fc00::`, `fd00::` rejected | ✅ |
| IPv6 link-local `fe80::` rejected | ✅ |
| IPv4-mapped `::ffff:127.*`, `::ffff:10.*` rejected | ✅ |
| DDG fallback allowed hosts pass validation | ✅ |

### v0.4.0: Project-Scoped Temp Dir

| Scenario | Result |
|---|---|
| Same cwd returns consistent temp dir | ✅ |
| Different cwd returns different temp dir | ✅ |
| Path follows `/tmp/pi-search-empty-*` pattern | ✅ |
| Dir is created if missing | ✅ |
| Dir is empty after ensure | ✅ |

### v0.4.0: Audit Details

| Scenario | Result |
|---|---|
| `createAuditDetails` helper exists | ✅ |
| Tool results include `sandboxMode` | ✅ |
| Tool results reference `permissionProfile` | ✅ |
| Extension does not hardcode `/tmp/mgrep-empty` | ✅ |
| Security module provides temp dir helpers | ✅ |

### v0.4.1: LLM Config

| Scenario | Result |
|---|---|
| Default `enabled=never`, `llmUsed=false` | ✅ |
| `always` requires provider + API key env | ✅ |
| `ask` treated as disabled | ✅ |
| API key value never exposed in config | ✅ |
| Missing API key results in `llmUsed=false` | ✅ |

### v0.4.1: Verification Status

| Scenario | Result |
|---|---|
| Default returns `[VERIFICATION DISABLED]` | ✅ |
| Error returns `[VERIFICATION FAILED: reason]` | ✅ |
| LLM active returns `[VERIFICATION ENABLED]` | ✅ |

### v0.4.1: Evidence Pack

| Scenario | Result |
|---|---|
| `maxSources` clamps to 1-5 | ✅ |
| `maxChars` clamps to 1000-12000 | ✅ |
| Evidence pack has required structure | ✅ |
| `addSourceToPack` adds sources correctly | ✅ |
| Respects `maxSources` limit | ✅ |
| Records fetch failures | ✅ |
| `collectEvidence` returns pack and results | ✅ |
| Fetch failures handled gracefully | ✅ |

### v0.4.1: Verify Research Claim

| Scenario | Result |
|---|---|
| Mock provider returns structured result | ✅ |
| Timeout returns `[VERIFICATION FAILED: timeout]` | ✅ |

### v0.4.1: Extension Contract (research_search)

| Scenario | Result |
|---|---|
| Extension registers `research_search` tool | ✅ |
| Description says web-only | ✅ |
| Description says default-off | ✅ |
| Schema includes `query`, `maxSources`, `maxChars`, `verify` | ✅ |
| Does not use `mgrep -a` | ✅ |
| Does not call local search or `validateSearchPath` | ✅ |

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
pi install npm:@leing2021/pi-search
```

Local development install:

```bash
pi install /path/to/pi-search
```

One-off test:

```bash
pi -e /path/to/pi-search
```

Do **not** also keep an old copied extension at:

```text
<pi-config-dir>/agent/extensions/mgrep.ts
<pi-config-dir>/agent/extensions/pi-search.ts
<project>/.pi/extensions/mgrep.ts
```

Keeping both old local extension files and the package enabled can duplicate tool registration.

---

## Notes

- Public documentation included in the package: `README.md`, `README_CN.md`, `docs/security-policy.md`, `docs/test-report.md`.
- Regression tests are committed to keep the reported automated test count reproducible.
- The package remains intentionally small: search tools, safe single-page fetch, no browser agent, no crawler, no heavy sandbox dependency.
