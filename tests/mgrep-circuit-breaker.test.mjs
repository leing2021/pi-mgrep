import { describe, test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Unit under test — will be implemented in src/mgrep-circuit-breaker.ts
// We import the .ts directly since pi uses --experimental-strip-types
const {
  isMgrepAvailable,
  getMgrepFailureReason,
  recordMgrepFailure,
  resetBreaker,
  classifyMgrepError,
  getBreakerStatus,
} = await import('../src/mgrep-circuit-breaker.ts');

describe('mgrep circuit breaker', () => {
  afterEach(() => {
    resetBreaker();
  });

  describe('initial state', () => {
    test('isMgrepAvailable() returns true initially', () => {
      assert.equal(isMgrepAvailable(), true);
    });

    test('getMgrepFailureReason() returns empty string when available', () => {
      assert.equal(getMgrepFailureReason(), '');
    });

    test('getBreakerStatus() returns available status', () => {
      const status = getBreakerStatus();
      assert.equal(status.available, true);
      assert.equal(status.reason, '');
      assert.equal(status.unavailableUntil, 0);
    });
  });

  describe('recordMgrepFailure', () => {
    test('marks mgrep unavailable after recording failure', () => {
      recordMgrepFailure('429 quota exceeded');
      assert.equal(isMgrepAvailable(), false);
    });

    test('stores meaningful failure reason', () => {
      recordMgrepFailure('429 quota exceeded');
      const reason = getMgrepFailureReason();
      assert.ok(reason.length > 0, 'reason should not be empty');
      assert.ok(reason.includes('quota'), 'reason should mention quota');
    });

    test('getBreakerStatus returns unavailable after failure', () => {
      recordMgrepFailure('ETIMEDOUT connection failed');
      const status = getBreakerStatus();
      assert.equal(status.available, false);
      assert.ok(status.reason.length > 0);
      assert.ok(status.unavailableUntil > 0);
      assert.ok(status.unavailableUntil > Date.now());
    });
  });

  describe('TTL expiry', () => {
    test('isMgrepAvailable() returns true after TTL expires', () => {
      // Set a very short TTL via env
      const originalEnv = process.env.PI_SEARCH_MGREP_BREAKER_TTL_MS;
      process.env.PI_SEARCH_MGREP_BREAKER_TTL_MS = '50'; // 50ms TTL

      recordMgrepFailure('429 rate limit');

      // Should be unavailable immediately
      assert.equal(isMgrepAvailable(), false);

      // Wait for TTL to expire
      return new Promise((resolve) => {
        setTimeout(() => {
          assert.equal(isMgrepAvailable(), true);
          // Restore env
          if (originalEnv === undefined) {
            delete process.env.PI_SEARCH_MGREP_BREAKER_TTL_MS;
          } else {
            process.env.PI_SEARCH_MGREP_BREAKER_TTL_MS = originalEnv;
          }
          resolve();
        }, 80);
      });
    });
  });

  describe('resetBreaker', () => {
    test('resetBreaker() makes mgrep available again', () => {
      recordMgrepFailure('401 unauthorized');
      assert.equal(isMgrepAvailable(), false);

      resetBreaker();

      assert.equal(isMgrepAvailable(), true);
      assert.equal(getMgrepFailureReason(), '');
    });

    test('resetBreaker() resets breaker status', () => {
      recordMgrepFailure('ETIMEDOUT');
      resetBreaker();
      const status = getBreakerStatus();
      assert.equal(status.available, true);
      assert.equal(status.reason, '');
      assert.equal(status.unavailableUntil, 0);
    });
  });

  describe('classifyMgrepError', () => {
    test('classifies 429 as quota', () => {
      const result = classifyMgrepError('429');
      assert.equal(result.type, 'quota');
      assert.ok(result.reason.length > 0);
    });

    test('classifies rate limit as quota', () => {
      const result = classifyMgrepError('rate limit exceeded');
      assert.equal(result.type, 'quota');
    });

    test('classifies quota as quota', () => {
      const result = classifyMgrepError('quota exceeded for the month');
      assert.equal(result.type, 'quota');
    });

    test('classifies 401 as auth', () => {
      const result = classifyMgrepError('401 unauthorized');
      assert.equal(result.type, 'auth');
      assert.ok(result.reason.length > 0);
    });

    test('classifies 403 as auth', () => {
      const result = classifyMgrepError('403 forbidden');
      assert.equal(result.type, 'auth');
    });

    test('classifies auth as auth', () => {
      const result = classifyMgrepError('authentication failed');
      assert.equal(result.type, 'auth');
    });

    test('classifies api key as auth', () => {
      const result = classifyMgrepError('invalid api key');
      assert.equal(result.type, 'auth');
    });

    test('classifies ETIMEDOUT as network', () => {
      const result = classifyMgrepError('ETIMEDOUT');
      assert.equal(result.type, 'network');
      assert.ok(result.reason.length > 0);
    });

    test('classifies ENOTFOUND as network', () => {
      const result = classifyMgrepError('ENOTFOUND dns resolution failed');
      assert.equal(result.type, 'network');
    });

    test('classifies ECONNREFUSED as network', () => {
      const result = classifyMgrepError('ECONNREFUSED');
      assert.equal(result.type, 'network');
    });

    test('classifies timeout as network', () => {
      const result = classifyMgrepError('request timeout after 30s');
      assert.equal(result.type, 'network');
    });

    test('classifies network as network', () => {
      const result = classifyMgrepError('network error');
      assert.equal(result.type, 'network');
    });

    test('classifies unknown error as other', () => {
      const result = classifyMgrepError('unknown error');
      assert.equal(result.type, 'other');
      assert.ok(result.reason.length > 0);
    });

    test('classifies empty string as other', () => {
      const result = classifyMgrepError('');
      assert.equal(result.type, 'other');
    });
  });
});
