/** MOD-005 API Client — retry policy — TICKET-V2-PHASE-4-MOD-005-FOUNDATION-001 */

import type { ApiErrorCode, RetryPolicy } from './types';

export const DEFAULT_RETRY_POLICY: RetryPolicy = Object.freeze({
  maxAttempts: 3,
  backoffMs: Object.freeze([100, 300, 900]),
  retryOn: Object.freeze<ApiErrorCode[]>(['API_NETWORK', 'API_TIMEOUT']),
  jitter: true,
});

export function resolveRetryPolicy(override?: RetryPolicy): RetryPolicy {
  if (!override) {
    return DEFAULT_RETRY_POLICY;
  }
  return Object.freeze({
    maxAttempts: override.maxAttempts,
    backoffMs: Object.freeze([...override.backoffMs]),
    retryOn: Object.freeze([...override.retryOn]),
    jitter: override.jitter,
  });
}

export function computeBackoffMs(policy: RetryPolicy, attemptIndex: number): number {
  const base = policy.backoffMs[Math.min(attemptIndex, policy.backoffMs.length - 1)] ?? 0;
  if (!policy.jitter || base <= 0) {
    return base;
  }
  const spread = base * 0.2;
  const delta = (Math.random() * 2 - 1) * spread;
  return Math.max(0, Math.round(base + delta));
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
