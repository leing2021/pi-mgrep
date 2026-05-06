/**
 * mgrep Circuit Breaker — session-level lightweight breaker.
 *
 * When mgrep calls fail (quota, auth, network), this module records the failure
 * and blocks further mgrep calls until a configurable TTL expires.
 *
 * Default TTL: 10 minutes. Override via PI_SEARCH_MGREP_BREAKER_TTL_MS.
 */

let mgrepUnavailableUntil = 0;
let mgrepFailureReason = '';

/** Default TTL in ms (10 minutes), overridable via env. */
function getTtlMs(): number {
  const env = process.env.PI_SEARCH_MGREP_BREAKER_TTL_MS;
  return env ? parseInt(env, 10) : 10 * 60 * 1000;
}

/**
 * Classify an mgrep error string into a typed category.
 *
 * Patterns (case-insensitive):
 * - quota: '429', 'rate limit', 'quota'
 * - auth: '401', '403', 'auth', 'api key'
 * - network: 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED', 'timeout', 'network'
 * - other: everything else
 */
export function classifyMgrepError(error: string): { type: 'quota' | 'auth' | 'network' | 'other'; reason: string } {
  const lower = error.toLowerCase();

  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('quota')) {
    return { type: 'quota', reason: `Quota/rate-limit error: ${error}` };
  }
  if (lower.includes('401') || lower.includes('403') || lower.includes('auth') || lower.includes('api key')) {
    return { type: 'auth', reason: `Authentication/authorization error: ${error}` };
  }
  if (
    lower.includes('etimedout') ||
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('timeout') ||
    lower.includes('network')
  ) {
    return { type: 'network', reason: `Network error: ${error}` };
  }
  return { type: 'other', reason: `Error: ${error}` };
}

/** Check whether mgrep is currently available (breaker not tripped or TTL expired). */
export function isMgrepAvailable(): boolean {
  return Date.now() >= mgrepUnavailableUntil;
}

/** Get the current failure reason (empty string if available). */
export function getMgrepFailureReason(): string {
  if (isMgrepAvailable()) return '';
  return mgrepFailureReason;
}

/**
 * Record an mgrep failure — trips the breaker for the configured TTL.
 * The error string is classified to produce a human-readable reason.
 */
export function recordMgrepFailure(errorInfo: string): void {
  const classified = classifyMgrepError(errorInfo);
  mgrepFailureReason = classified.reason;
  mgrepUnavailableUntil = Date.now() + getTtlMs();
}

/** Reset the breaker to available state (primarily for testing). */
export function resetBreaker(): void {
  mgrepUnavailableUntil = 0;
  mgrepFailureReason = '';
}

/** Get the full breaker status object. */
export function getBreakerStatus(): { available: boolean; reason: string; unavailableUntil: number } {
  return {
    available: isMgrepAvailable(),
    reason: getMgrepFailureReason(),
    unavailableUntil: mgrepUnavailableUntil,
  };
}
