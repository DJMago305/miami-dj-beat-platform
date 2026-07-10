/** MOD-005 API Client — log redaction — TICKET-V2-PHASE-4-MOD-005-SECURITY-CORRECTION-001 */

const REDACTED = '[REDACTED]';

/** Maximum recursion depth for nested meta redaction. */
export const REDACT_MAX_DEPTH = 4;

const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
  'x-api-key',
  'api-key',
]);

const SENSITIVE_DATA_KEY_NAMES = new Set([
  'anonkey',
  'anonymouskey',
  'apikey',
  'accesstoken',
  'refreshtoken',
  'token',
  'password',
  'secret',
  'credential',
  'clientsecret',
  'servicerolekey',
  'authorization',
  'authheader',
]);

function normalizeKeyName(key: string): string {
  return key.toLowerCase().replace(/_/g, '');
}

export function isSensitiveHeaderName(headerName: string): boolean {
  return SENSITIVE_HEADER_NAMES.has(headerName.toLowerCase());
}

export function isSensitiveDataKey(key: string): boolean {
  return SENSITIVE_DATA_KEY_NAMES.has(normalizeKeyName(key));
}

export function redactHeaders(headers: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key] = isSensitiveHeaderName(key) ? REDACTED : value;
  }
  return Object.freeze(out);
}

function redactValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (depth >= REDACT_MAX_DEPTH) {
    return '[TRUNCATED]';
  }

  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => redactValue(item, depth + 1)));
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSensitiveDataKey(key) ? REDACTED : redactValue(nested, depth + 1);
    }
    return Object.freeze(out);
  }

  return REDACTED;
}

export function redactRequestMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (isSensitiveDataKey(key)) {
      out[key] = REDACTED;
      continue;
    }
    if (key === 'headers' && value && typeof value === 'object') {
      out[key] = redactHeaders(value as Record<string, string>);
      continue;
    }
    out[key] = redactValue(value, 0);
  }
  return Object.freeze(out);
}
