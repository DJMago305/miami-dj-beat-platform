/** MOD-010 Logging — redaction — TICKET-V2-RUNTIME-LOGGING-001 */

const REDACTED = '[REDACTED]';
const CIRCULAR = '[CIRCULAR]';
const MAX_DEPTH = 4;
const MAX_KEYS = 32;
const MAX_STRING_LENGTH = 512;
const MAX_ARRAY_ITEMS = 10;

const SENSITIVE_KEY =
  /password|passwd|pwd|token|authorization|authheader|secret|apikey|servicerole|cookie|set-cookie|ssn|socialsecurity|cvv|cvc|cardnumber|pan|creditcard|bankaccount/i;

function truncateString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }
  return `${value.slice(0, MAX_STRING_LENGTH)}…`;
}

export function redactMeta(value: unknown, depth = 0, seen = new WeakSet()): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return truncateString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    return REDACTED;
  }

  if (depth >= MAX_DEPTH) {
    return '[TRUNCATED]';
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => redactMeta(item, depth + 1, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return CIRCULAR;
    }
    seen.add(value);

    const output: Record<string, unknown> = {};
    let keyCount = 0;

    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (keyCount >= MAX_KEYS) {
        break;
      }
      keyCount += 1;
      output[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactMeta(child, depth + 1, seen);
    }

    return output;
  }

  return REDACTED;
}
