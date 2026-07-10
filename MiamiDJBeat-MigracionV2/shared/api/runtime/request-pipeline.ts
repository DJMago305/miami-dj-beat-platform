/** MOD-005 API Client — request pipeline helpers — TICKET-V2-PHASE-4-MOD-005-FOUNDATION-001 */

import type { ApiMethod, ApiRequestOptions } from './types';
import { normalizeInvalidPayload } from './errors';

let requestCounter = 0;

export function resetApiRequestCounterForTests(): void {
  requestCounter = 0;
}

export function nextRequestId(): string {
  requestCounter += 1;
  return `req_${String(requestCounter).padStart(8, '0')}`;
}

export function nextCorrelationId(existing?: string): string {
  if (existing && existing.trim().length > 0) {
    return existing;
  }
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  requestCounter += 1;
  return `corr_${String(requestCounter).padStart(8, '0')}`;
}

export function resolveTimeoutMs(
  method: ApiMethod,
  override?: number,
  readTimeoutMs = 15_000,
  writeTimeoutMs = 30_000,
): number {
  if (typeof override === 'number' && override > 0) {
    return override;
  }

  const isRead = method === 'GET' || method === 'DELETE';
  return isRead ? readTimeoutMs : writeTimeoutMs;
}

export function buildUrl(baseUrl: string, path: string, query?: ApiRequestOptions['query']): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${normalizedBase}${normalizedPath}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

export function serializeBody(body: unknown): { ok: true; bodyText: string | null } | { ok: false; error: ReturnType<typeof normalizeInvalidPayload> } {
  if (body === undefined || body === null) {
    return { ok: true, bodyText: null };
  }

  if (typeof body === 'string') {
    return { ok: true, bodyText: body };
  }

  try {
    return { ok: true, bodyText: JSON.stringify(body) };
  } catch {
    return { ok: false, error: normalizeInvalidPayload() };
  }
}

export function parseJsonBody(bodyText: string): { ok: true; data: unknown } | { ok: false } {
  if (bodyText.trim().length === 0) {
    return { ok: true, data: null };
  }

  try {
    return { ok: true, data: JSON.parse(bodyText) as unknown };
  } catch {
    return { ok: false };
  }
}
