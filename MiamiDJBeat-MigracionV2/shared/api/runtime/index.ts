/** MOD-005 API Client — public service exports — TICKET-V2-PHASE-4-MOD-005-FOUNDATION-001 */

export { ApiClient, createApiClient } from './api-client';
export {
  getApiClient,
  getApiClientState,
  initializeApiClient,
  resetApiClientForTests,
  type ApiClientLifecycleState,
  type InitializeApiClientDependencies,
} from './api-service';
export type { ApiClientDeps } from './api-client';
export {
  ApiClientError,
  createApiError,
  hasBusinessErrorFlag,
  isApiClientError,
  isRetryableError,
  normalizeCancellationFailure,
  normalizeApiError,
  normalizeHttpStatusError,
  normalizeInvalidPayload,
  normalizeNetworkFailure,
  normalizeParseFailure,
  normalizeTimeoutFailure,
  normalizeUnknownFailure,
} from './errors';
export { createFetchTransport, FetchTransport } from './fetch-transport';
export type { FetchTransportOptions } from './fetch-transport';
export { createMemoryTransport, MemoryTransport } from './memory-transport';
export type { MemoryTransportEntry } from './memory-transport';
export { createMockTransport, mockNetworkError, mockResponse, MockTransport } from './mock-transport';
export type { MockTransportHandler } from './mock-transport';
export {
  buildUrl,
  nextCorrelationId,
  nextRequestId,
  parseJsonBody,
  resetApiRequestCounterForTests,
  resolveTimeoutMs,
  sanitizeEdgeFunctionName,
  serializeBody,
} from './request-pipeline';
export {
  mergeSupabaseInvokeCallerHeaders,
  resolveSupabaseInvokeHeaders,
} from './supabase-invoke-headers';
export type { ResolveSupabaseInvokeHeadersInput } from './supabase-invoke-headers';
export { computeBackoffMs, DEFAULT_RETRY_POLICY, resolveRetryPolicy, sleep } from './retry-policy';
export { redactHeaders, redactRequestMeta } from './redact';
export {
  createSessionReaderFromSnapshot,
  createStaticSessionReader,
} from './session-reader-port';
export type { SessionReaderPort } from './session-reader-port';
export {
  TransportCancelledError,
  TransportNetworkError,
} from './transport-port';
export type { TransportInput, TransportPort, TransportResult } from './transport-port';
export type {
  ActorType,
  ApiClientConfig,
  ApiClientPublicApi,
  ApiError,
  ApiErrorCode,
  ApiFailure,
  ApiMetadata,
  ApiMethod,
  ApiRequest,
  ApiRequestOptions,
  ApiResponse,
  ApiSuccess,
  InvokeEdgeOptions,
  NormalizeApiErrorInput,
  RequestContext,
  RetryPolicy,
  SupabaseInvokeAuthMode,
} from './types';
