/** MOD-005 API Client — error normalization — TICKET-V2-PHASE-4-MOD-005-FOUNDATION-001 */

import type { ApiError, ApiErrorCode } from './types';

export class ApiClientError extends Error {
  readonly apiError: ApiError;

  constructor(apiError: ApiError) {
    super(apiError.message);
    this.name = 'ApiClientError';
    this.apiError = Object.freeze({ ...apiError });
  }
}

export function isApiClientError(value: unknown): value is ApiClientError {
  return value instanceof ApiClientError;
}

function freezeApiError(error: ApiError): ApiError {
  return Object.freeze({ ...error });
}

export function createApiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  details: string | Record<string, unknown> | null = null,
): ApiError {
  return freezeApiError({ code, message, details, status });
}

export function normalizeHttpStatusError(
  status: number,
  bodyText: string,
  parsedBody: unknown,
): ApiError {
  const details = extractErrorDetails(parsedBody, bodyText);

  if (status === 422) {
    return createApiError('API_EDGE_REJECTED', 'Edge rejected the request.', status, details);
  }

  if (status === 400) {
    return createApiError('API_HTTP_ERROR', 'Bad request.', status, details);
  }

  if (status === 401) {
    return createApiError('API_HTTP_ERROR', 'Unauthorized.', status, details);
  }

  if (status === 403) {
    return createApiError('API_HTTP_ERROR', 'Forbidden.', status, details);
  }

  if (status === 404) {
    return createApiError('API_HTTP_ERROR', 'Resource not found.', status, details);
  }

  if (status === 409) {
    return createApiError('API_HTTP_ERROR', 'Conflict.', status, details);
  }

  if (status >= 500 && status <= 599) {
    return createApiError('API_HTTP_ERROR', 'Server error.', status, details);
  }

  if (status >= 400 && status <= 499) {
    return createApiError('API_HTTP_ERROR', 'HTTP request failed.', status, details);
  }

  return createApiError('API_UNKNOWN', 'Unknown HTTP error.', status, details);
}

export function normalizeNetworkFailure(message = 'Network request failed.'): ApiError {
  return createApiError('API_NETWORK', message, 0, null);
}

export function normalizeTimeoutFailure(): ApiError {
  return createApiError('API_TIMEOUT', 'Request timed out.', 0, null);
}

export function normalizeCancellationFailure(): ApiError {
  return createApiError('API_CANCELLED', 'Request was cancelled.', 0, null);
}

export function normalizeParseFailure(message = 'Response body could not be parsed.'): ApiError {
  return createApiError('API_PARSE_ERROR', message, 0, null);
}

export function normalizeInvalidPayload(message = 'Request payload is not JSON-serializable.'): ApiError {
  return createApiError('API_INVALID_PAYLOAD', message, 0, null);
}

export function normalizeUnknownFailure(message = 'Unknown API client error.'): ApiError {
  return createApiError('API_UNKNOWN', message, 0, null);
}

export function isRetryableError(
  error: ApiError,
  method: string,
  retrySafe: boolean,
  retryOn: readonly ApiErrorCode[],
): boolean {
  if (error.code === 'API_CANCELLED' || error.code === 'API_INVALID_PAYLOAD') {
    return false;
  }

  if (error.status === 401 || error.status === 403 || error.status === 404 || error.status === 409 || error.status === 422) {
    return false;
  }

  const isRead = method === 'GET' || method === 'DELETE' || method === 'HEAD';
  if (isRead && error.code === 'API_HTTP_ERROR' && error.status >= 500 && error.status <= 599) {
    return true;
  }

  if (!retryOn.includes(error.code)) {
    return false;
  }

  if (isRead) {
    return true;
  }

  return retrySafe === true;
}

function extractErrorDetails(
  parsedBody: unknown,
  bodyText: string,
): string | Record<string, unknown> | null {
  if (parsedBody && typeof parsedBody === 'object' && !Array.isArray(parsedBody)) {
    const record = parsedBody as Record<string, unknown>;
    const error = record.error;
    const detail = record.detail ?? record.details;
    if (typeof error === 'string' || typeof detail === 'string') {
      return {
        ...(typeof error === 'string' ? { error } : {}),
        ...(typeof detail === 'string' ? { detail } : {}),
      };
    }
    return record;
  }

  if (bodyText.trim().length > 0) {
    return bodyText.slice(0, 512);
  }

  return null;
}

export function hasBusinessErrorFlag(parsedBody: unknown): boolean {
  if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
    return false;
  }
  return typeof (parsedBody as Record<string, unknown>).error === 'string';
}
