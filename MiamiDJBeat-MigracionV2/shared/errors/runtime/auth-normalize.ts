/** MOD-014 Error Handler — auth normalization — TICKET-V2-PHASE-5-MOD-014-AUTH-ERROR-NORMALIZATION-001 */

import { isAuthError, type AuthErrorCode } from '../../auth/runtime';
import { lookupCatalogEntry } from './catalog';
import { redactErrorMessage } from './redact';
import type { NormalizeContext, NormalizedError } from './types';

export type AuthProviderHint = 'mock' | 'supabase' | 'unknown';

export type AuthNormalizeOperation =
  | 'signIn'
  | 'signOut'
  | 'refresh'
  | 'restore'
  | 'initialize'
  | 'handoff'
  | 'unknown';

export type NormalizeAuthContext = NormalizeContext & {
  readonly operation?: AuthNormalizeOperation;
  readonly provider?: AuthProviderHint;
};

export type AuthFailureShape = {
  readonly ok: false;
  readonly code: AuthErrorCode;
  readonly message: string;
};

export const AUTH_TO_GLOBAL_MAP: Readonly<Record<AuthErrorCode, string>> = {
  'ERR-AUTH-001': 'ERR-0109',
  'ERR-AUTH-002': 'ERR-0100',
  'ERR-AUTH-003': 'ERR-0108',
  'ERR-AUTH-004': 'ERR-0104',
  'ERR-AUTH-005': 'ERR-0105',
  'ERR-AUTH-006': 'ERR-0102',
  'ERR-AUTH-007': 'ERR-0101',
  'ERR-AUTH-008': 'ERR-0106',
  'ERR-AUTH-009': 'ERR-0107',
  'ERR-AUTH-010': 'ERR-0103',
};

const AUTH_ERROR_CODES = new Set<AuthErrorCode>(Object.keys(AUTH_TO_GLOBAL_MAP) as AuthErrorCode[]);

const NETWORK_ERROR_PATTERN =
  /fetch failed|failed to fetch|network error|networkrequestfailed|econnrefused|etimedout|enotfound|socket hang up|offline/i;

function isAuthErrorCode(value: string): value is AuthErrorCode {
  return AUTH_ERROR_CODES.has(value as AuthErrorCode);
}

export function isAuthFailureShape(value: unknown): value is AuthFailureShape {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<AuthFailureShape>;
  return (
    candidate.ok === false
    && typeof candidate.code === 'string'
    && isAuthErrorCode(candidate.code)
    && typeof candidate.message === 'string'
  );
}

function isNormalizedAuthError(value: unknown): value is NormalizedError {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<NormalizedError>;
  return (
    candidate.category === 'C-02'
    && typeof candidate.code === 'string'
    && typeof candidate.severity === 'string'
    && typeof candidate.recovery === 'string'
    && typeof candidate.userMessageKey === 'string'
    && typeof candidate.logMessage === 'string'
    && typeof candidate.moduleId === 'string'
    && typeof candidate.timestamp === 'string'
  );
}

function idempotentAuthNormalized(error: NormalizedError): NormalizedError {
  if (Object.isFrozen(error)) {
    return error;
  }

  return Object.freeze({ ...error });
}

function isNetworkErrorMessage(message: string): boolean {
  return NETWORK_ERROR_PATTERN.test(message) || /\btimeout\b/i.test(message);
}

function safeObjectLogMessage(value: Record<string, unknown>): string {
  try {
    return JSON.stringify(value);
  } catch {
    return 'Unknown error input could not be normalized.';
  }
}

function buildAuthNormalizedError(
  globalCode: string,
  rawLogMessage: string,
  context: NormalizeContext,
  authCause?: string,
): NormalizedError {
  const catalog = lookupCatalogEntry(globalCode);
  const category = catalog?.category ?? 'C-02';
  const severity = catalog?.severity ?? 'CRITICAL';
  const recovery = catalog?.recovery ?? 'recoverable';
  const userMessageKey = catalog?.userMessageKey ?? 'error.unexpected.generic';

  return Object.freeze({
    code: globalCode,
    category,
    severity,
    recovery,
    userMessageKey,
    logMessage: redactErrorMessage(rawLogMessage),
    moduleId: context.moduleId ?? 'MOD-001',
    timestamp: new Date().toISOString(),
    ...(context.correlationId ? { correlationId: context.correlationId } : {}),
    ...(authCause ? { cause: authCause } : {}),
  });
}

function mapAuthCodeToNormalized(
  authCode: AuthErrorCode,
  message: string,
  context: NormalizeContext,
): NormalizedError {
  const globalCode = AUTH_TO_GLOBAL_MAP[authCode];
  return buildAuthNormalizedError(globalCode, message, context, authCode);
}

export function resolveAuthNormalization(
  input: unknown,
  context: NormalizeContext = {},
): NormalizedError {
  if (isNormalizedAuthError(input)) {
    return idempotentAuthNormalized(input);
  }

  if (isAuthError(input)) {
    return mapAuthCodeToNormalized(input.code, input.message, context);
  }

  if (isAuthFailureShape(input)) {
    return mapAuthCodeToNormalized(input.code, input.message, context);
  }

  if (input instanceof Error) {
    if (isNetworkErrorMessage(input.message)) {
      return buildAuthNormalizedError('ERR-0102', input.message, context);
    }

    return buildAuthNormalizedError('ERR-0950', input.message, {
      ...context,
      moduleId: context.moduleId ?? 'MOD-014',
    });
  }

  if (typeof input === 'string') {
    return buildAuthNormalizedError('ERR-0950', input, {
      ...context,
      moduleId: context.moduleId ?? 'MOD-014',
    });
  }

  if (input === null || input === undefined) {
    return buildAuthNormalizedError(
      'ERR-0999',
      'Unknown error input could not be normalized.',
      {
        moduleId: context.moduleId ?? 'MOD-014',
        correlationId: context.correlationId,
      },
    );
  }

  if (typeof input === 'object') {
    const candidate = input as Record<string, unknown>;

    if (
      typeof candidate.code === 'string'
      && isAuthErrorCode(candidate.code)
      && typeof candidate.message === 'string'
    ) {
      return mapAuthCodeToNormalized(candidate.code, candidate.message, context);
    }

    return buildAuthNormalizedError(
      'ERR-0999',
      safeObjectLogMessage(candidate),
      {
        moduleId: context.moduleId ?? 'MOD-014',
        correlationId: context.correlationId,
      },
    );
  }

  return buildAuthNormalizedError(
    'ERR-0999',
    'Unknown error input could not be normalized.',
    {
      moduleId: context.moduleId ?? 'MOD-014',
      correlationId: context.correlationId,
    },
  );
}
