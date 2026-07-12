/** MOD-014 Error Handler — public API — TICKET-V2-RUNTIME-ERROR-HANDLER-001 */

export {
  clearErrorHistory,
  classifyErrorSeverity,
  createAppError,
  getErrorHandler,
  getErrorState,
  initializeErrorHandler,
  normalizeApiClientError,
  normalizeAuthError,
  normalizeDomainError,
  normalizeError,
  resetErrorHandlerForTests,
} from './error-handler-service';
export {
  API_TO_GLOBAL_MAP,
  AUTHORIZED_API_BRIDGE_CODES,
  isApiErrorShape,
  isApiFailureShape,
} from './api-normalize';
export type { ApiFailureShape, AuthorizedApiBridgeErrorCode } from './api-normalize';
export { AUTH_TO_GLOBAL_MAP, isAuthFailureShape } from './auth-normalize';
export {
  DOMAIN_ACCESS_SNAPSHOT_CODES,
  DOMAIN_ACCESS_SNAPSHOT_STATIC_GLOBAL_MAP,
  isDomainFailureShape,
} from './domain-normalize';
export type { DomainAccessSnapshotCode, DomainFailureShape } from './domain-normalize';
export type {
  AuthFailureShape,
  AuthNormalizeOperation,
  AuthProviderHint,
  NormalizeAuthContext,
} from './auth-normalize';
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
