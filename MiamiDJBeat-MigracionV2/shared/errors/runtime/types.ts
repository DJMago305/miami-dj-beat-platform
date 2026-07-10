/** MOD-014 Error Handler — types — TICKET-V2-RUNTIME-ERROR-HANDLER-001 */

export type ErrorCategory =
  | 'C-01'
  | 'C-02'
  | 'C-03'
  | 'C-04'
  | 'C-05'
  | 'C-06'
  | 'C-07'
  | 'C-08'
  | 'C-09'
  | 'C-10';

export type ErrorSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL' | 'FATAL';

export type ErrorRecovery = 'recoverable' | 'retryable' | 'fatal' | 'ignorable';

export type ErrorHandlerLifecycleState = 'ERR_UNINITIALIZED' | 'ERR_READY' | 'ERR_SHUTDOWN';

export type NormalizedError = {
  readonly code: string;
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly recovery: ErrorRecovery;
  readonly userMessageKey: string;
  readonly logMessage: string;
  readonly moduleId: string;
  readonly timestamp: string;
  readonly correlationId?: string;
  readonly cause?: string;
};

export type CatalogEntry = {
  code: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  recovery: ErrorRecovery;
  userMessageKey: string;
};

export type CreateAppErrorInput = {
  code: string;
  message: string;
  moduleId?: string;
  correlationId?: string;
  cause?: string;
  category?: ErrorCategory;
  severity?: ErrorSeverity;
  recovery?: ErrorRecovery;
  userMessageKey?: string;
};

export type ErrorHandlerPublicApi = {
  readonly createAppError: (input: CreateAppErrorInput) => AppError;
  readonly normalizeError: (input: unknown, context?: NormalizeContext) => NormalizedError;
  readonly classifyErrorSeverity: (code: string) => ErrorSeverity;
  readonly clearErrorHistory: () => void;
  readonly getState: () => ErrorHandlerLifecycleState;
  readonly getHistory: () => readonly NormalizedError[];
};

export type NormalizeContext = {
  moduleId?: string;
  correlationId?: string;
};

export class AppError extends Error {
  readonly code: string;
  readonly moduleId: string;
  readonly correlationId?: string;
  readonly causeCode?: string;
  readonly category?: ErrorCategory;
  readonly severity?: ErrorSeverity;
  readonly recovery?: ErrorRecovery;
  readonly userMessageKey?: string;

  constructor(input: CreateAppErrorInput) {
    super(input.message);
    this.name = 'AppError';
    this.code = input.code;
    this.moduleId = input.moduleId ?? 'MOD-014';
    this.correlationId = input.correlationId;
    this.causeCode = input.cause;
    this.category = input.category;
    this.severity = input.severity;
    this.recovery = input.recovery;
    this.userMessageKey = input.userMessageKey;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
