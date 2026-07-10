/** MOD-014 Error Handler — public API — TICKET-V2-RUNTIME-ERROR-HANDLER-001 */

export {
  clearErrorHistory,
  classifyErrorSeverity,
  createAppError,
  getErrorHandler,
  getErrorState,
  initializeErrorHandler,
  normalizeError,
  resetErrorHandlerForTests,
} from './error-handler-service';
export { ERROR_CATALOG } from './catalog';
export { AppError, isAppError } from './types';
export type {
  CreateAppErrorInput,
  ErrorCategory,
  ErrorHandlerLifecycleState,
  ErrorHandlerPublicApi,
  ErrorRecovery,
  ErrorSeverity,
  NormalizeContext,
  NormalizedError,
} from './types';
