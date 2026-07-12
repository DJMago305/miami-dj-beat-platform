/** MOD-014 Error Handler — API client bridge — TICKET-V2-PHASE-8-MOD-014-ERROR-BRIDGE-CONTRACT-FIX-001 */

import type { ApiError, ApiFailure, ApiMetadata } from '../../api/runtime/types';
import { lookupCatalogEntry } from './catalog';
import { redactErrorMessage } from './redact';
import type { NormalizeContext, NormalizedError } from './types';

export const AUTHORIZED_API_BRIDGE_CODES = [
  'API_HTTP_ERROR',
  'API_PARSE_ERROR',
  'API_TIMEOUT',
  'API_CANCELLED',
  'API_INVALID_PAYLOAD',
] as const;

export type AuthorizedApiBridgeErrorCode = (typeof AUTHORIZED_API_BRIDGE_CODES)[number];

export type ApiFailureShape = {
  readonly ok: false;
  readonly status: number;
  readonly error: ApiError;
  readonly metadata: ApiMetadata;
};

export const API_TO_GLOBAL_MAP: Readonly<Record<AuthorizedApiBridgeErrorCode, string>> = {
  API_HTTP_ERROR: 'ERR-0500',
  API_PARSE_ERROR: 'ERR-0501',
  API_TIMEOUT: 'ERR-0502',
  API_CANCELLED: 'ERR-0504',
  API_INVALID_PAYLOAD: 'ERR-0800',
};

const AUTHORIZED_API_BRIDGE_CODE_SET = new Set<string>(AUTHORIZED_API_BRIDGE_CODES);
const API_GLOBAL_CODES = new Set<string>(Object.values(API_TO_GLOBAL_MAP));

function isAuthorizedApiBridgeCode(value: string): value is AuthorizedApiBridgeErrorCode {
  return AUTHORIZED_API_BRIDGE_CODE_SET.has(value);
}

export function isApiErrorShape(value: unknown): value is ApiError {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ApiError>;
  return (
    typeof candidate.code === 'string'
    && isAuthorizedApiBridgeCode(candidate.code)
    && typeof candidate.message === 'string'
    && typeof candidate.status === 'number'
    && (candidate.details === null
      || typeof candidate.details === 'string'
      || (typeof candidate.details === 'object' && candidate.details !== null))
  );
}

export function isApiFailureShape(value: unknown): value is ApiFailureShape {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ApiFailureShape>;
  return (
    candidate.ok === false
    && typeof candidate.status === 'number'
    && isApiErrorShape(candidate.error)
    && typeof candidate.metadata === 'object'
    && candidate.metadata !== null
    && typeof candidate.metadata.requestId === 'string'
    && typeof candidate.metadata.correlationId === 'string'
  );
}

function isApiSuccessShape(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return (value as { ok?: unknown }).ok === true;
}

function isNormalizedApiError(value: unknown): value is NormalizedError {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<NormalizedError>;
  return (
    typeof candidate.code === 'string'
    && API_GLOBAL_CODES.has(candidate.code)
    && typeof candidate.cause === 'string'
    && isAuthorizedApiBridgeCode(candidate.cause)
    && typeof candidate.severity === 'string'
    && typeof candidate.recovery === 'string'
    && typeof candidate.userMessageKey === 'string'
    && typeof candidate.logMessage === 'string'
    && typeof candidate.moduleId === 'string'
    && typeof candidate.timestamp === 'string'
  );
}

function idempotentApiNormalized(error: NormalizedError): NormalizedError {
  if (Object.isFrozen(error)) {
    return error;
  }

  return Object.freeze({ ...error });
}

function resolveHttpUserMessageKey(status: number): string {
  if (status >= 400 && status < 600) {
    return `error.api.http.${status}`;
  }
  return 'error.api.http';
}

function resolveApiBridgeUserMessageKey(
  apiCode: AuthorizedApiBridgeErrorCode,
  globalCode: string,
  httpStatus?: number,
): string | undefined {
  if (apiCode === 'API_INVALID_PAYLOAD') {
    return 'error.api.invalid_payload';
  }

  if (globalCode === 'ERR-0500' && httpStatus !== undefined) {
    return resolveHttpUserMessageKey(httpStatus);
  }

  return undefined;
}

function buildApiNormalizedError(
  globalCode: string,
  rawLogMessage: string,
  context: NormalizeContext,
  options?: {
    readonly apiCause?: string;
    readonly userMessageKey?: string;
  },
): NormalizedError {
  const catalog = lookupCatalogEntry(globalCode);
  const category = catalog?.category ?? 'C-06';
  const severity = catalog?.severity ?? 'ERROR';
  const recovery = catalog?.recovery ?? 'retryable';
  const userMessageKey = options?.userMessageKey ?? catalog?.userMessageKey ?? 'error.unexpected.generic';

  return Object.freeze({
    code: globalCode,
    category,
    severity,
    recovery,
    userMessageKey,
    logMessage: redactErrorMessage(rawLogMessage),
    moduleId: context.moduleId ?? 'MOD-005',
    timestamp: new Date().toISOString(),
    ...(context.correlationId ? { correlationId: context.correlationId } : {}),
    ...(options?.apiCause ? { cause: options.apiCause } : {}),
  });
}

function mapApiErrorToNormalized(
  apiError: ApiError,
  context: NormalizeContext,
): NormalizedError {
  if (!isAuthorizedApiBridgeCode(apiError.code)) {
    return buildApiNormalizedError(
      'ERR-0999',
      'Unauthorized API error code cannot be normalized by the v1 bridge.',
      {
        moduleId: context.moduleId ?? 'MOD-014',
        correlationId: context.correlationId,
      },
      { apiCause: apiError.code },
    );
  }

  const globalCode = API_TO_GLOBAL_MAP[apiError.code];
  return buildApiNormalizedError(globalCode, apiError.message, context, {
    apiCause: apiError.code,
    userMessageKey: resolveApiBridgeUserMessageKey(
      apiError.code,
      globalCode,
      apiError.code === 'API_HTTP_ERROR' ? apiError.status : undefined,
    ),
  });
}

function mergeContextFromApiFailure(
  failure: ApiFailureShape,
  context: NormalizeContext,
): NormalizeContext {
  return {
    moduleId: context.moduleId ?? 'MOD-005',
    correlationId: context.correlationId ?? failure.metadata.correlationId,
  };
}

export function resolveApiNormalization(
  input: unknown,
  context: NormalizeContext = {},
): NormalizedError {
  if (isNormalizedApiError(input)) {
    return idempotentApiNormalized(input);
  }

  if (isApiSuccessShape(input)) {
    return buildApiNormalizedError(
      'ERR-0999',
      'ApiSuccess cannot be normalized as an API error.',
      {
        moduleId: context.moduleId ?? 'MOD-014',
        correlationId: context.correlationId,
      },
    );
  }

  if (isApiFailureShape(input)) {
    return mapApiErrorToNormalized(input.error, mergeContextFromApiFailure(input, context));
  }

  if (isApiErrorShape(input)) {
    return mapApiErrorToNormalized(input, context);
  }

  if (input instanceof Error) {
    return buildApiNormalizedError('ERR-0999', input.message, {
      ...context,
      moduleId: context.moduleId ?? 'MOD-014',
    });
  }

  if (typeof input === 'string') {
    return buildApiNormalizedError('ERR-0999', input, {
      ...context,
      moduleId: context.moduleId ?? 'MOD-014',
    });
  }

  if (input === null || input === undefined) {
    return buildApiNormalizedError(
      'ERR-0999',
      'Unknown API error input could not be normalized.',
      {
        moduleId: context.moduleId ?? 'MOD-014',
        correlationId: context.correlationId,
      },
    );
  }

  if (typeof input === 'object') {
    const candidate = input as Record<string, unknown>;

    if (candidate.ok === true) {
      return buildApiNormalizedError(
        'ERR-0999',
        'ApiSuccess cannot be normalized as an API error.',
        {
          moduleId: context.moduleId ?? 'MOD-014',
          correlationId: context.correlationId,
        },
      );
    }

    if (
      typeof candidate.code === 'string'
      && typeof candidate.message === 'string'
      && typeof candidate.status === 'number'
      && (candidate.details === null
        || typeof candidate.details === 'string'
        || (typeof candidate.details === 'object' && candidate.details !== null))
    ) {
      return mapApiErrorToNormalized(candidate as ApiError, context);
    }

    if (isApiErrorShape(candidate.error) && candidate.ok === false) {
      return mapApiErrorToNormalized(
        candidate.error,
        {
          moduleId: context.moduleId ?? 'MOD-005',
          correlationId:
            context.correlationId
            ?? (typeof (candidate.metadata as ApiMetadata | undefined)?.correlationId === 'string'
              ? (candidate.metadata as ApiMetadata).correlationId
              : undefined),
        },
      );
    }
  }

  return buildApiNormalizedError(
    'ERR-0999',
    'Unknown API error input could not be normalized.',
    {
      moduleId: context.moduleId ?? 'MOD-014',
      correlationId: context.correlationId,
    },
  );
}
