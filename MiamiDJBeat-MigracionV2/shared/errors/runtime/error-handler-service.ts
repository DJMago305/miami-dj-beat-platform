/** MOD-014 Error Handler — service — TICKET-V2-RUNTIME-ERROR-HANDLER-001 */

import { ConfigError } from '@mdj/shared/config';
import { getEventBus } from '@mdj/shared/events';
import { getLogger, getLoggingState } from '@mdj/shared/logging';
import {
  inferCategoryFromCode,
  lookupCatalogEntry,
  mapConfigErrorCode,
} from './catalog';
import { redactErrorMessage } from './redact';
import {
  AppError,
  isAppError,
  type CreateAppErrorInput,
  type ErrorHandlerLifecycleState,
  type ErrorHandlerPublicApi,
  type ErrorSeverity,
  type NormalizeContext,
  type NormalizedError,
} from './types';

const MAX_HISTORY = 200;

const SEVERITY_RANK: Record<ErrorSeverity, number> = {
  INFO: 1,
  WARNING: 2,
  ERROR: 3,
  CRITICAL: 4,
  FATAL: 5,
};

let lifecycleState: ErrorHandlerLifecycleState = 'ERR_UNINITIALIZED';
const errorRegistry: NormalizedError[] = [];
let frozenApi: ErrorHandlerPublicApi | null = null;

function freezeNormalized(error: NormalizedError): NormalizedError {
  return Object.freeze({ ...error });
}

function pushHistory(error: NormalizedError): void {
  errorRegistry.push(error);
  if (errorRegistry.length > MAX_HISTORY) {
    errorRegistry.shift();
  }
}

export function classifyErrorSeverity(code: string): ErrorSeverity {
  return lookupCatalogEntry(code)?.severity ?? 'CRITICAL';
}

function severityToLogLevel(severity: ErrorSeverity): 'info' | 'warn' | 'error' | 'fatal' {
  switch (severity) {
    case 'INFO':
      return 'info';
    case 'WARNING':
      return 'warn';
    case 'ERROR':
    case 'CRITICAL':
      return 'error';
    case 'FATAL':
      return 'fatal';
  }
}

function shouldPublishSystemError(severity: ErrorSeverity): boolean {
  return SEVERITY_RANK[severity] >= SEVERITY_RANK.ERROR;
}

function buildNormalizedError(
  code: string,
  logMessage: string,
  context: NormalizeContext,
  overrides?: Partial<Pick<NormalizedError, 'category' | 'severity' | 'recovery' | 'userMessageKey' | 'cause'>>,
): NormalizedError {
  const catalog = lookupCatalogEntry(code);
  const category = overrides?.category ?? catalog?.category ?? inferCategoryFromCode(code);
  const severity = overrides?.severity ?? catalog?.severity ?? classifyErrorSeverity(code);
  const recovery = overrides?.recovery ?? catalog?.recovery ?? 'retryable';
  const userMessageKey = overrides?.userMessageKey ?? catalog?.userMessageKey ?? 'error.unexpected.generic';

  return freezeNormalized({
    code,
    category,
    severity,
    recovery,
    userMessageKey,
    logMessage: redactErrorMessage(logMessage),
    moduleId: context.moduleId ?? 'MOD-014',
    timestamp: new Date().toISOString(),
    ...(context.correlationId ? { correlationId: context.correlationId } : {}),
    ...(overrides?.cause ? { cause: overrides.cause } : {}),
  });
}

function recordNormalizedError(error: NormalizedError): NormalizedError {
  pushHistory(error);

  if (lifecycleState !== 'ERR_READY' || getLoggingState() !== 'LOG_READY') {
    return error;
  }

  const logger = getLogger();
  const logLevel = severityToLogLevel(error.severity);
  const meta = {
    code: error.code,
    category: error.category,
    severity: error.severity,
    recovery: error.recovery,
    moduleId: error.moduleId,
    ...(error.correlationId ? { correlationId: error.correlationId } : {}),
    ...(error.cause ? { cause: error.cause } : {}),
  };

  logger[logLevel](error.logMessage, meta);

  if (shouldPublishSystemError(error.severity) && getEventBus().getState() === 'BUS_READY') {
    getEventBus().publish({
      name: 'SYSTEM_ERROR',
      payload: {
        code: error.code,
        message: error.logMessage,
        ...(error.correlationId ? { correlationId: error.correlationId } : {}),
      },
      emitter: { moduleId: 'MOD-014', subsystem: 'error-handler' },
      scope: 'internal',
      ...(error.correlationId ? { correlationId: error.correlationId } : {}),
    });
  }

  return error;
}

function internalCreateAppError(input: CreateAppErrorInput): AppError {
  return new AppError(input);
}

function internalNormalizeError(input: unknown, context: NormalizeContext = {}): NormalizedError {
  if (isAppError(input)) {
    return recordNormalizedError(
      buildNormalizedError(input.code, input.message, {
        moduleId: input.moduleId,
        correlationId: input.correlationId ?? context.correlationId,
      }, {
        category: input.category,
        severity: input.severity,
        recovery: input.recovery,
        userMessageKey: input.userMessageKey,
        cause: input.causeCode,
      }),
    );
  }

  if (input instanceof ConfigError) {
    const mappedCode = input.errNumber ?? mapConfigErrorCode(input.code) ?? 'ERR-0950';
    return recordNormalizedError(
      buildNormalizedError(mappedCode, input.message, {
        moduleId: 'MOD-006',
        correlationId: context.correlationId,
      }),
    );
  }

  if (input instanceof Error) {
    return recordNormalizedError(
      buildNormalizedError('ERR-0950', input.message, {
        moduleId: context.moduleId ?? 'MOD-014',
        correlationId: context.correlationId,
      }),
    );
  }

  if (typeof input === 'string') {
    return recordNormalizedError(
      buildNormalizedError('ERR-0950', input, {
        moduleId: context.moduleId ?? 'MOD-014',
        correlationId: context.correlationId,
      }),
    );
  }

  return recordNormalizedError(
    buildNormalizedError('ERR-0999', 'Unknown error input could not be normalized.', {
      moduleId: context.moduleId ?? 'MOD-014',
      correlationId: context.correlationId,
    }),
  );
}

function internalClearErrorHistory(): void {
  errorRegistry.length = 0;
}

function buildPublicApi(): ErrorHandlerPublicApi {
  return Object.freeze({
    createAppError: internalCreateAppError,
    normalizeError: internalNormalizeError,
    classifyErrorSeverity,
    clearErrorHistory: internalClearErrorHistory,
    getState: () => lifecycleState,
    getHistory: () => Object.freeze([...errorRegistry]),
  });
}

/** Requires LOG_READY — boot order: Config → Bus → Logging → Error Handler */
export function initializeErrorHandler(): ErrorHandlerPublicApi {
  if (lifecycleState === 'ERR_READY' && frozenApi) {
    return frozenApi;
  }

  if (lifecycleState === 'ERR_SHUTDOWN') {
    throw new Error('Error Handler has been shut down.');
  }

  if (getLoggingState() !== 'LOG_READY') {
    throw new Error('Logging must be LOG_READY before Error Handler initialization.');
  }

  lifecycleState = 'ERR_READY';
  frozenApi = buildPublicApi();

  getLogger().info('Error Handler initialized', {
    moduleId: 'MOD-014',
    source: 'boot',
  });

  return frozenApi;
}

export function getErrorHandler(): ErrorHandlerPublicApi {
  if (!frozenApi || lifecycleState !== 'ERR_READY') {
    throw new Error('Error Handler is not initialized. Call initializeErrorHandler() during boot.');
  }
  return frozenApi;
}

export function getErrorState(): ErrorHandlerLifecycleState {
  return lifecycleState;
}

export function createAppError(input: CreateAppErrorInput): AppError {
  return getErrorHandler().createAppError(input);
}

export function normalizeError(input: unknown, context?: NormalizeContext): NormalizedError {
  return getErrorHandler().normalizeError(input, context);
}

export function clearErrorHistory(): void {
  getErrorHandler().clearErrorHistory();
}

/** Test-only reset — not for production portals. */
export function resetErrorHandlerForTests(): void {
  errorRegistry.length = 0;
  lifecycleState = 'ERR_UNINITIALIZED';
  frozenApi = null;
}
