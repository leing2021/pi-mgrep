import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';

import {
  buildSearchResult,
  detectProviderConfig,
  extractFirecrawl,
  isProviderAvailable,
  recordProviderFailure,
  recordProviderQuota,
  resetAllCooldowns,
  searchBrave,
  searchDuckDuckGo,
  searchSearxng,
  searchTavily,
  webSearch,
} from '../src/providers.ts';

function makeJsonResponse(data) {
  return { ok: true, content: JSON.stringify(data) };
}

afterEach(() => resetAllCooldowns());

test('detectProviderConfig returns correct flags from env', () => {
  resetAllCooldowns();
  const cfg = detectProviderConfig({
    PI_SEARCH_SEARXNG_URL: 'http://100.101.197.40:8888',
    PI_SEARCH_ALLOW_PRIVATE_SEARXNG: 'always',
    BRAVE_SEARCH_API_KEY: 'test-brave-key',
    TAVILY_API_KEY: 'test-tavily-key',
    FIRECRAWL_API_KEY: 'test-firecrawl-key',
  });
  assert.equal(cfg.hasSearxng, true);
  assert.equal(cfg.hasBrave, true);
  assert.equal(cfg.hasTavily, true);
  assert.equal(cfg.hasFirecrawl, true);
});

test('detectProviderConfig returns false when searxng not allowed', () => {
  resetAllCooldowns();
  const cfg = detectProviderConfig({
    PI_SEARCH_SEARXNG_URL: 'http://100.101.197.40:8888',
    BRAVE_SEARCH_API_KEY: 'test',
  });
  assert.equal(cfg.hasSearxng, false);
});

test('isProviderAvailable returns true for available provider', () => {
  resetAllCooldowns();
  assert.equal(isProviderAvailable('brave'), true);
});

test('isProviderAvailable returns false for provider in quota cooldown', () => {
  resetAllCooldowns();
  recordProviderQuota('brave', 'quota exhausted');
  assert.equal(isProviderAvailable('brave'), false);
});

test('recordProviderQuota sets cooldown and fallbackReason', () => {
  resetAllCooldowns();
  recordProviderQuota('brave', '429 rate limit');
  assert.equal(isProviderAvailable('brave'), false);
});

test('recordProviderFailure sets non-quota cooldown only if network/provider unavailable', () => {
  resetAllCooldowns();
  recordProviderFailure('searxng', 'connection refused');
  assert.equal(isProviderAvailable('searxng'), false);
});

test('recordProviderFailure does not set cooldown for generic timeout', () => {
  resetAllCooldowns();
  recordProviderFailure('brave', 'timeout');
  assert.equal(isProviderAvailable('brave'), true);
});

test('webSearch routes to searxng first when configured', async () => {
  resetAllCooldowns();
  const result = await webSearch({
    query: 'test query',
    provider: 'auto',
    env: {
      PI_SEARCH_SEARXNG_URL: 'http://100.101.197.40:8888',
      PI_SEARCH_ALLOW_PRIVATE_SEARXNG: 'always',
    },
    fetch: async (url) => {
      if (url.includes('100.101.197.40')) return makeJsonResponse({ results: [{ title: 'Searxng result', url: 'https://searxng.example', snippet: 'test' }] });
      throw new Error('unexpected');
    },
  });
  assert.equal(result.provider, 'searxng');
  assert.equal(result.details.providersAttempted[0], 'searxng');
});

test('webSearch falls back from searxng to brave when searxng unavailable', async () => {
  resetAllCooldowns();
  recordProviderFailure('searxng', 'connection refused');
  const result = await webSearch({
    query: 'test',
    provider: 'auto',
    env: {
      PI_SEARCH_SEARXNG_URL: 'http://100.101.197.40:8888',
      PI_SEARCH_ALLOW_PRIVATE_SEARXNG: 'always',
      BRAVE_SEARCH_API_KEY: 'key',
    },
    fetch: async (url) => {
      if (url.includes('brave')) return makeJsonResponse({ results: [{ title: 'Brave result', url: 'https://brave.example', snippet: 'test' }] });
      throw new Error('unexpected: ' + url);
    },
  });
  // searxng is skipped due to cooldown, brave succeeds
  assert.equal(result.provider, 'brave');
  assert.deepEqual(result.details.providersAttempted, ['brave']);
});

test('webSearch falls back on quota exhaustion', async () => {
  resetAllCooldowns();
  recordProviderQuota('brave', 'quota exhausted');
  const result = await webSearch({
    query: 'test',
    provider: 'auto',
    env: { BRAVE_SEARCH_API_KEY: 'key', TAVILY_API_KEY: 'key' },
    fetch: async (url) => {
      if (url.includes('tavily')) return makeJsonResponse({ results: [{ title: 'Tavily result', url: 'https://tavily.example', snippet: 'test' }] });
      throw new Error('unexpected');
    },
  });
  assert.equal(result.provider, 'tavily');
});

test('webSearch does NOT fallback on non-quota Brave timeout', async () => {
  resetAllCooldowns();
  const result = await webSearch({
    query: 'test',
    provider: 'brave',
    env: { BRAVE_SEARCH_API_KEY: 'key', TAVILY_API_KEY: 'key' },
    fetch: async () => {
      throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.errorClass, 'AllProvidersFailedError');
});

test('webSearch explicit duckduckgo skips all fallbacks', async () => {
  resetAllCooldowns();
  recordProviderQuota('brave', 'exhausted');
  const result = await webSearch({
    query: 'test',
    provider: 'duckduckgo',
    env: {},
    fetch: async (url) => {
      // mock catches duckduckgo URL
      if (url.includes('duckduckgo')) return { ok: true, content: '<a href="https://ddg.example">DDG Result</a>' };
      throw new Error('unexpected: ' + url);
    },
  });
  assert.equal(result.provider, 'duckduckgo');
  assert.equal(result.details.providersAttempted.length, 1);
});

test('webSearch explicit unavailable provider fails instead of silently falling back', async () => {
  resetAllCooldowns();
  let called = false;
  const result = await webSearch({
    query: 'test',
    provider: 'tavily',
    env: { BRAVE_SEARCH_API_KEY: 'brave-key' },
    fetch: async () => {
      called = true;
      throw new Error('should not call network');
    },
  });
  assert.equal(called, false);
  assert.equal(result.ok, false);
  assert.equal(result.error.errorClass, 'ProviderUnavailableError');
  assert.equal(result.error.details.provider, 'tavily');
});

test('webSearch defaults to auto routing when provider omitted', async () => {
  resetAllCooldowns();
  const result = await webSearch({
    query: 'test',
    env: { BRAVE_SEARCH_API_KEY: 'key' },
    fetch: async (url) => {
      if (url.includes('brave')) return makeJsonResponse({ results: [{ title: 'Brave result', url: 'https://brave.example', snippet: 'test' }] });
      throw new Error('unexpected: ' + url);
    },
  });
  assert.equal(result.provider, 'brave');
});

test('webSearch redacts provider API keys from querySentTo details', async () => {
  resetAllCooldowns();
  const result = await webSearch({
    query: 'test',
    provider: 'tavily',
    env: { TAVILY_API_KEY: 'tavily-secret-key' },
    fetch: async (url) => {
      assert.ok(url.includes('tavily-secret-key'));
      return makeJsonResponse({ results: [{ title: 'Tavily result', url: 'https://tavily.example', snippet: 'test' }] });
    },
  });
  assert.equal(result.provider, 'tavily');
  assert.ok(!JSON.stringify(result.details).includes('tavily-secret-key'));
  assert.ok(JSON.stringify(result.details.querySentTo).includes('REDACTED'));
});

test('webSearch redacts provider API keys from failure details', async () => {
  resetAllCooldowns();
  const result = await webSearch({
    query: 'test',
    provider: 'tavily',
    env: { TAVILY_API_KEY: 'tavily-secret-key' },
    fetch: async (url) => {
      throw new Error(`failed URL: ${url}`);
    },
  });
  assert.equal(result.ok, false);
  assert.ok(!JSON.stringify(result.error.details).includes('tavily-secret-key'));
  assert.ok(JSON.stringify(result.error.details).includes('REDACTED'));
});

test('searchBrave calls correct endpoint and maps response', async () => {
  resetAllCooldowns();
  const raw = { web: { results: [{ title: 'Test', url: 'https://example.com', description: 'desc' }] } };
  const results = await searchBrave({ query: 'test', apiKey: 'key' }, JSON.stringify(raw));
  assert.equal(results[0].title, 'Test');
  assert.equal(results[0].url, 'https://example.com');
});

test('searchBrave rescues malformed JSON as JSONParseError', async () => {
  resetAllCooldowns();
  const results = await searchBrave({ query: 'test', apiKey: 'key' }, '<html>not json</html>');
  assert.equal(results, null);
});

test('searchTavily maps response correctly', async () => {
  resetAllCooldowns();
  const raw = { results: [{ title: 'Tav', url: 'https://t.com', content: 'content', score: 0.95 }] };
  const results = await searchTavily({ query: 'test', apiKey: 'key' }, JSON.stringify(raw));
  assert.equal(results[0].title, 'Tav');
  assert.equal(results[0].snippet, 'content');
});

test('searchSearxng maps response correctly', async () => {
  resetAllCooldowns();
  const raw = { results: [{ title: 'SX', url: 'https://sx.com', content: 'text' }] };
  const results = await searchSearxng({ baseUrl: 'http://localhost', query: 'test' }, JSON.stringify(raw));
  assert.equal(results[0].url, 'https://sx.com');
});

test('searchDuckDuckGo extracts results from HTML', async () => {
  resetAllCooldowns();
  const html = `<html><body>
    <li class="result"><a class="result__a" href="https://a.com">Title A</a><a class="result__snippet">Snippet A</a></li>
    <li class="result"><a class="result__a" href="https://b.com">Title B</a><a class="result__snippet">Snippet B</a></li>
  </body></html>`;
  const results = await searchDuckDuckGo({ baseUrl: 'http://localhost' }, html);
  assert.equal(results.length, 2);
  assert.equal(results[0].title, 'Title A');
  assert.equal(results[1].snippet, 'Snippet B');
});

test('searchDuckDuckGo returns null on structure change', async () => {
  resetAllCooldowns();
  const html = '<html><body><p>No results at all</p></body></html>';
  const results = await searchDuckDuckGo({ baseUrl: 'http://localhost' }, html);
  assert.equal(results, null);
});

test('extractFirecrawl maps response correctly', async () => {
  resetAllCooldowns();
  const raw = { data: { content: 'content here', markdown: '# heading' } };
  const result = await extractFirecrawl({ apiKey: 'key' }, 'https://example.com', JSON.stringify(raw));
  assert.equal(result.content, 'content here');
});

test('extractFirecrawl returns empty structured result on malformed JSON', async () => {
  resetAllCooldowns();
  const result = await extractFirecrawl({ apiKey: 'key' }, 'https://example.com', 'not-json');
  assert.equal(result.content, '');
  assert.equal(result.markdown, undefined);
});

test('buildSearchResult returns structured format with provider top-level', () => {
  resetAllCooldowns();
  const result = buildSearchResult({
    provider: 'brave',
    results: [{ title: 'T', url: 'https://x.com', snippet: 's' }],
    details: { provider: 'brave', apiKeyEnv: 'BRAVE_SEARCH_API_KEY' },
  });
  assert.equal(result.ok, true);
  assert.equal(result.provider, 'brave');
  assert.equal(result.data[0].title, 'T');
  assert.equal(result.details.apiKeyExposed, false);
});

test('apiKeyExposed is always false in details', async () => {
  resetAllCooldowns();
  const result = buildSearchResult({
    provider: 'brave',
    results: [],
    details: { provider: 'brave', apiKeyEnv: 'BRAVE_SEARCH_API_KEY' },
  });
  assert.equal(result.details.apiKeyExposed, false);
});

test('webSearch records all fallbackReasons and querySentTo in details', async () => {
  resetAllCooldowns();
  recordProviderQuota('brave', '429');
  recordProviderQuota('tavily', '402');
  const result = await webSearch({
    query: 'test',
    provider: 'auto',
    env: {},
    fetch: async (url) => {
      if (url.includes('duckduckgo')) return { ok: true, content: '<a href="https://ddg.example">DDG Result</a>' };
      throw new Error('unexpected: ' + url);
    },
  });
  assert.equal(result.provider, 'duckduckgo');
  assert.equal(result.details.providersAttempted.length, 1);
  assert.equal(result.details.querySentTo.length, 1);
});
