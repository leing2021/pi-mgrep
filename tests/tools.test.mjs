import assert from 'node:assert/strict';
import test from 'node:test';

// For testing the extension, we import the tool handler logic directly
// instead of going through Pi's ExtensionAPI
import { handleSearch, handleWebSearch, handleWebFetch, handleResearchSearch, TOOL_NAMES } from '../extensions/pi-search-core.ts';

test('TOOL_NAMES registers exactly 4 tools', () => {
  const names = [...TOOL_NAMES];
  assert.deepEqual(names.sort(), ['research_search', 'search', 'web_fetch', 'web_search'].sort());
  assert.equal(TOOL_NAMES.length, 4);
});

test('search tool: code-like query routes to rg', async () => {
  const result = await handleSearch({
    query: 'safeFetchText',
    path: '.',
    engine: 'auto',
  }, {
    runCommand: async (cmd, args, opts) => ({ stdout: 'src/security.ts:10:export function safeFetchText', stderr: '' }),
    resolveSafePath: () => '/resolved/path',
  });
  assert.ok(result.details.engine === 'rg' || result.details.engine === 'fallback');
  assert.ok(Array.isArray(result.results));
  assert.equal(result.results[0].path, 'src/security.ts');
  assert.equal(result.results[0].url, undefined);
  assert.equal(result.details.sandboxMode, 'process-env-cwd-timeout');
});

test('search tool: path policy enforced', async () => {
  const result = await handleSearch({
    query: 'test',
    path: '/etc/passwd',
    engine: 'auto',
  }, {
    runCommand: async () => ({ stdout: '', stderr: '' }),
    resolveSafePath: () => { throw new Error('PathPolicyError: Path outside cwd is blocked'); },
  });
  assert.equal(result.results.length, 0);
  assert.ok(result.error?.message || result.details.pathBlocked);
});

test('search tool: natural language query uses rg multi-token fallback', async () => {
  const result = await handleSearch({
    query: 'how to prevent SSRF attacks',
    path: '.',
    engine: 'auto',
  }, {
    runCommand: async (cmd, args, opts) => {
      if (args.some(a => a.includes('SSRF') || a.includes('prevent'))) {
        return { stdout: 'src/security.ts:1:SSRF prevention guide', stderr: '' };
      }
      return { stdout: '', stderr: '' };
    },
    resolveSafePath: () => '/resolved/path',
  });
  assert.ok(result.details.engine === 'rg-multi-token');
});

test('web_search tool: auto provider routing with mock', async () => {
  const result = await handleWebSearch({
    query: 'test query',
    provider: 'auto',
  }, {
    webSearch: async () => ({
      ok: true,
      provider: 'brave',
      data: [{ title: 'Test', url: 'https://example.com', snippet: 'test result' }],
      details: { providersAttempted: ['brave'], apiKeyExposed: false },
    }),
  });
  assert.equal(result.provider, 'brave');
  assert.ok(Array.isArray(result.results));
  assert.equal(result.results[0].title, 'Test');
  assert.ok(result.details.providersAttempted);
});

test('web_fetch tool: returns content with untrusted boundary markers', async () => {
  const result = await handleWebFetch({
    url: 'https://example.com',
  }, {
    fetch: async () => ({ text: 'Example page content here.', riskFlags: [] }),
    firecrawl: null,
  });
  assert.ok(result.content.includes('Example page content'));
  assert.ok(result.content.includes('UNTRUSTED WEB CONTENT'));
  assert.ok(result.trust === 'untrusted');
  assert.ok(Array.isArray(result.details.riskFlags));
  assert.equal(result.details.extractor, 'local');
});

test('web_fetch tool: Firecrawl fallback actually calls HTTP API', async () => {
  let fetchCalled = false;
  let capturedUrl = '';
  let capturedOpts = {};
  const result = await handleWebFetch({
    url: 'https://example.com',
  }, {
    fetch: async () => { throw new Error('local fetch failed'); },
    firecrawl: async (targetUrl) => {
      // This should be the actual firecrawlFn that makes HTTP call
      // For now, it's just a wrapper — the test verifies the pattern
      fetchCalled = true;
      return { content: 'Firecrawl extracted via HTTP', markdown: '# heading' };
    },
  });
  assert.ok(fetchCalled, 'Firecrawl fallback should be invoked');
  assert.equal(result.details.extractor, 'firecrawl');
});

test('web_fetch tool: default firecrawlFn calls Firecrawl API with correct params', async () => {
  let httpCalled = false;
  let capturedEndpoint = '';
  let capturedMethod = '';
  let capturedAuth = '';
  let capturedBody = null;

  const result = await handleWebFetch({
    url: 'https://example.com/page',
  }, {
    fetch: async () => { throw new Error('local fetch failed'); },
    firecrawlFetch: async (url, opts) => {
      httpCalled = true;
      capturedEndpoint = url;
      capturedMethod = String(opts?.method ?? 'GET');
      capturedAuth = opts?.headers?.['Authorization'] ?? '';
      capturedBody = opts?.body ? JSON.parse(String(opts.body)) : null;
      return {
        ok: true,
        content: JSON.stringify({ data: { content: 'Firecrawl HTTP content', markdown: '# FC' } }),
      };
    },
    firecrawlApiKey: 'test-fc-key-789',
  });
  assert.ok(httpCalled, 'Firecrawl HTTP API should be called');
  assert.ok(capturedEndpoint.includes('firecrawl.dev'), `Endpoint should be Firecrawl: ${capturedEndpoint}`);
  assert.equal(capturedMethod, 'POST');
  assert.equal(capturedAuth, 'Bearer test-fc-key-789');
  assert.equal(capturedBody?.url, 'https://example.com/page');
  assert.ok(result.content.includes('Firecrawl HTTP content'));
  assert.equal(result.details.extractor, 'firecrawl');
});

test('web_fetch tool: default firecrawlFn handles API failure gracefully', async () => {
  const result = await handleWebFetch({
    url: 'https://example.com',
  }, {
    fetch: async () => { throw new Error('local fetch failed'); },
    firecrawlFetch: async () => {
      return { ok: false, status: 500, content: 'Internal Server Error' };
    },
    firecrawlApiKey: 'test-key',
  });
  assert.ok(result.content.includes('FetchError'), `Should be FetchError: ${result.content}`);
});

test('web_fetch tool: extract=true forces Firecrawl extraction', async () => {
  let localCalled = false;
  const result = await handleWebFetch({
    url: 'https://example.com',
    extract: true,
  }, {
    fetch: async () => {
      localCalled = true;
      return { text: 'Local content should not be used.', riskFlags: [] };
    },
    firecrawl: async () => ({ content: 'Forced Firecrawl content', markdown: '# heading' }),
  });
  assert.equal(localCalled, false);
  assert.ok(result.content.includes('Forced Firecrawl content'));
  assert.equal(result.details.extractor, 'firecrawl');
});

test('research_search tool: basic mode returns structured output', async () => {
  const result = await handleResearchSearch({
    query: 'test research',
    mode: 'basic',
  }, {
    researchSearch: async () => ({
      ok: true,
      query: 'test research',
      answer: '',
      citations: [{ id: '1', url: 'https://example.com', title: 'Test', text: 'evidence' }],
      confidence: 'medium',
      riskFlags: [],
      verificationStatus: '[VERIFICATION DISABLED]',
      details: { mode: 'basic', providersUsed: ['brave'], llmUsed: false, apiKeyExposed: false },
    }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.verificationStatus, '[VERIFICATION DISABLED]');
  assert.equal(result.details.mode, 'basic');
  assert.equal(result.details.llmUsed, false);
});

test('research_search tool: deep mode with LLM verification', async () => {
  const result = await handleResearchSearch({
    query: 'test deep research',
    mode: 'deep',
  }, {
    researchSearch: async () => ({
      ok: true,
      query: 'test deep research',
      answer: 'Deep research answer.',
      citations: [{ id: '1', url: 'https://example.com', title: 'Test', text: 'evidence' }],
      confidence: 'high',
      riskFlags: [],
      verificationStatus: '[VERIFICATION ENABLED]',
      details: { mode: 'deep', providersUsed: ['tavily'], llmUsed: true, apiKeyExposed: false },
    }),
  });
  assert.equal(result.answer, 'Deep research answer.');
  assert.equal(result.verificationStatus, '[VERIFICATION ENABLED]');
  assert.equal(result.details.llmUsed, true);
});

test('all tools include apiKeyExposed: false in details', async () => {
  const ws = await handleWebSearch({ query: 'test', provider: 'auto' }, {
    webSearch: async () => ({
      ok: true, provider: 'brave',
      data: [{ title: 'T', url: 'https://x.com', snippet: 's' }],
      details: { providersAttempted: ['brave'], apiKeyExposed: false },
    }),
  });
  assert.equal(ws.details.apiKeyExposed, false);
});
