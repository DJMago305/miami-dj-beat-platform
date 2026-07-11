/** MOD-005 API Client — core client — TICKET-V2-PHASE-4-MOD-005-FOUNDATION-001 */

import type { AppConfig } from '@mdj/shared/config';
import { getConfig } from '@mdj/shared/config';
import type { Logger } from '@mdj/shared/logging';
import { getLogger } from '@mdj/shared/logging';
import {
  hasBusinessErrorFlag,
  isRetryableError,
  normalizeApiError,
} from './errors';
import { redactRequestMeta } from './redact';
import {
  buildUrl,
  nextCorrelationId,
  nextRequestId,
  parseJsonBody,
  resolveTimeoutMs,
  sanitizeEdgeFunctionName,
  serializeBody,
} from './request-pipeline';
import {
  mergeSupabaseInvokeCallerHeaders,
  resolveSupabaseInvokeHeaders,
} from './supabase-invoke-headers';
import { computeBackoffMs, resolveRetryPolicy, sleep } from './retry-policy';
import type { SessionReaderPort } from './session-reader-port';
import { TransportCancelledError, TransportNetworkError, type TransportPort } from './transport-port';
import type {
  ApiClientConfig,
  ApiClientPublicApi,
  ApiFailure,
  ApiMetadata,
  ApiRequestOptions,
  ApiResponse,
  InvokeEdgeOptions,
  RequestContext,
} from './types';

export type ApiClientDeps = {
  readonly transport: TransportPort;
  readonly config?: AppConfig | ApiClientConfig;
  readonly sessionReader?: SessionReaderPort;
  readonly logger?: Logger;
  readonly moduleId?: string;
};

type InFlightEntry = {
  readonly controller: AbortController;
};

export class ApiClient implements ApiClientPublicApi {
  private readonly transport: TransportPort;
  private readonly config: ApiClientConfig;
  private readonly sessionReader?: SessionReaderPort;
  private readonly logger: Logger | null;
  private readonly moduleId: string;
  private readonly inFlight = new Map<string, InFlightEntry>();
  private readonly operationAbort = new Map<string, AbortController>();

  constructor(deps: ApiClientDeps) {
    this.transport = deps.transport;
    this.config = resolveClientConfig(deps.config);
    this.sessionReader = deps.sessionReader;
    this.logger = resolveLogger(deps.logger);
    this.moduleId = deps.moduleId ?? 'MOD-005';
  }

  async request<T = unknown>(options: ApiRequestOptions): Promise<ApiResponse<T>> {
    const requestId = options.context?.requestId ?? nextRequestId();
    const correlationId = nextCorrelationId(options.context?.correlationId);
    const method = options.method ?? 'GET';
    const retryPolicy = resolveRetryPolicy(options.retryPolicy ?? this.config.defaultRetryPolicy);
    const retrySafe = options.retrySafe === true;
    const timeoutMs = resolveTimeoutMs(method, options.timeoutMs);
    const startedAt = Date.now();

    const serialized = serializeBody(options.body);
    if (!serialized.ok) {
      return this.failureResponse(serialized.error, requestId, correlationId, options, 1, Date.now() - startedAt);
    }

    const context = this.buildRequestContext(requestId, correlationId, options.context);
    const headers = this.buildHeaders(options.headers, context);
    const operationController = new AbortController();
    this.operationAbort.set(requestId, operationController);
    const operationSignal = mergeAbortSignals(options.signal, operationController.signal);

    let lastFailure: ApiFailure | null = null;

    try {
      for (let attempt = 1; attempt <= retryPolicy.maxAttempts; attempt += 1) {
        if (operationSignal.aborted) {
          return this.failureResponse(
            normalizeApiError({ kind: 'cancelled' }),
            requestId,
            correlationId,
            options,
            attempt,
            Date.now() - startedAt,
            context,
          );
        }

        const attemptRequestId = attempt === 1 ? requestId : `${requestId}_a${attempt}`;
        const controller = new AbortController();
        const signals = mergeAbortSignals(operationSignal, controller.signal);
        this.inFlight.set(attemptRequestId, { controller });

        const timeoutHandle = setTimeout(() => controller.abort('timeout'), timeoutMs);

        try {
          const transportResult = await this.transport.execute({
            requestId: attemptRequestId,
            correlationId,
            method,
            url: buildUrl(this.config.baseUrl, options.path, options.query),
            headers,
            bodyText: serialized.bodyText,
            signal: signals,
          });

          clearTimeout(timeoutHandle);
          this.inFlight.delete(attemptRequestId);

          const metadata = this.buildMetadata(
            requestId,
            correlationId,
            context,
            transportResult.durationMs || Date.now() - startedAt,
            attempt,
          );

          if (transportResult.status < 200 || transportResult.status >= 300) {
            const parsed = parseJsonBody(transportResult.bodyText);
            const apiError = normalizeApiError({
              kind: 'http',
              status: transportResult.status,
              bodyText: transportResult.bodyText,
              parsedBody: parsed.ok ? parsed.data : null,
            });
            lastFailure = { ok: false, status: apiError.status, error: apiError, metadata };
            this.logResult('warn', options.path, method, lastFailure);

            if (
              attempt < retryPolicy.maxAttempts &&
              isRetryableError(apiError, method, retrySafe, retryPolicy.retryOn)
            ) {
              try {
                await sleep(computeBackoffMs(retryPolicy, attempt - 1), operationSignal);
              } catch {
                return this.failureResponse(
                  normalizeApiError({ kind: 'cancelled' }),
                  requestId,
                  correlationId,
                  options,
                  attempt,
                  Date.now() - startedAt,
                  context,
                );
              }
              continue;
            }

            return lastFailure;
          }

          const parsed = parseJsonBody(transportResult.bodyText);
          if (!parsed.ok) {
            const failure = this.failureResponse(
              normalizeApiError({
                kind: 'bad-response',
                bodyText: transportResult.bodyText,
              }),
              requestId,
              correlationId,
              options,
              attempt,
              Date.now() - startedAt,
              context,
            );
            this.logResult('error', options.path, method, failure);
            return failure;
          }

          if (hasBusinessErrorFlag(parsed.data)) {
            const apiError = normalizeApiError({
              kind: 'bad-response',
              status: 200,
              bodyText: transportResult.bodyText,
              parsedBody: parsed.data,
            });
            const failure: ApiFailure = {
              ok: false,
              status: apiError.status,
              error: apiError,
              metadata,
            };
            this.logResult('warn', options.path, method, failure);
            return failure;
          }

          const success: ApiResponse<T> = {
            ok: true,
            status: transportResult.status,
            data: parsed.data as T,
            metadata,
          };
          this.logResult('info', options.path, method, success);
          return success;
        } catch (error) {
          clearTimeout(timeoutHandle);
          this.inFlight.delete(attemptRequestId);

          const apiError = mapTransportException(error, signals);
          lastFailure = this.failureResponse(
            apiError,
            requestId,
            correlationId,
            options,
            attempt,
            Date.now() - startedAt,
            context,
          );
          this.logResult(apiError.code === 'API_CANCELLED' ? 'info' : 'warn', options.path, method, lastFailure);

          if (
            attempt < retryPolicy.maxAttempts &&
            isRetryableError(apiError, method, retrySafe, retryPolicy.retryOn)
          ) {
            try {
              await sleep(computeBackoffMs(retryPolicy, attempt - 1), operationSignal);
            } catch {
              return this.failureResponse(
                normalizeApiError({ kind: 'cancelled' }),
                requestId,
                correlationId,
                options,
                attempt,
                Date.now() - startedAt,
                context,
              );
            }
            continue;
          }

          return lastFailure;
        }
      }

      return (
        lastFailure ??
        this.failureResponse(
          normalizeApiError({ kind: 'network', message: 'Retry attempts exhausted without a response.' }),
          requestId,
          correlationId,
          options,
          retryPolicy.maxAttempts,
          Date.now() - startedAt,
          context,
        )
      );
    } finally {
      this.operationAbort.delete(requestId);
    }
  }

  get<T = unknown>(
    path: string,
    options: Omit<ApiRequestOptions, 'path' | 'method'> = {},
  ): Promise<ApiResponse<T>> {
    return this.request<T>({ ...options, path, method: 'GET' });
  }

  post<T = unknown>(
    path: string,
    body?: unknown,
    options: Omit<ApiRequestOptions, 'path' | 'method' | 'body'> = {},
  ): Promise<ApiResponse<T>> {
    return this.request<T>({ ...options, path, method: 'POST', body });
  }

  put<T = unknown>(
    path: string,
    body?: unknown,
    options: Omit<ApiRequestOptions, 'path' | 'method' | 'body'> = {},
  ): Promise<ApiResponse<T>> {
    return this.request<T>({ ...options, path, method: 'PUT', body });
  }

  delete<T = unknown>(
    path: string,
    options: Omit<ApiRequestOptions, 'path' | 'method'> = {},
  ): Promise<ApiResponse<T>> {
    return this.request<T>({ ...options, path, method: 'DELETE' });
  }

  async invokeEdge<T = unknown>(
    functionName: string,
    body?: unknown,
    options: InvokeEdgeOptions = {},
  ): Promise<ApiResponse<T>> {
    const sanitized = sanitizeEdgeFunctionName(functionName);
    if (!sanitized.ok) {
      const requestId = options.context?.requestId ?? nextRequestId();
      const correlationId = nextCorrelationId(options.context?.correlationId);
      return this.failureResponse(
        sanitized.error,
        requestId,
        correlationId,
        { ...options, path: '/functions/v1/invalid', method: 'POST', body },
        1,
        0,
      );
    }

    const { authMode = 'session', headers: callerHeaders, ...requestOptions } = options;
    const policyHeaders = resolveSupabaseInvokeHeaders({
      authMode,
      anonKey: this.resolveAnonKey(),
      sessionAuthorization: this.sessionReader?.getAuthorizationHeader() ?? null,
    });

    return this.request<T>({
      ...requestOptions,
      method: 'POST',
      path: `/functions/v1/${sanitized.name}`,
      body,
      headers: mergeSupabaseInvokeCallerHeaders(callerHeaders, policyHeaders),
    });
  }

  cancel(requestId: string): void {
    this.operationAbort.get(requestId)?.abort('cancel');
    for (const [id, entry] of this.inFlight.entries()) {
      if (id === requestId || id.startsWith(`${requestId}_a`)) {
        entry.controller.abort('cancel');
        this.inFlight.delete(id);
      }
    }
  }

  cancelAll(): void {
    for (const [, controller] of this.operationAbort.entries()) {
      controller.abort('cancel-all');
    }
    this.operationAbort.clear();
    for (const [id, entry] of this.inFlight.entries()) {
      entry.controller.abort('cancel-all');
      this.inFlight.delete(id);
    }
  }

  private buildRequestContext(
    requestId: string,
    correlationId: string,
    partial?: Partial<RequestContext>,
  ): RequestContext {
    const sessionPortal = this.sessionReader?.getPortal() ?? null;
    const sessionId = this.sessionReader?.getSessionId() ?? null;
    const actorType = this.sessionReader?.getActorType() ?? partial?.actorType ?? 'guest';

    return Object.freeze({
      portal: partial?.portal ?? sessionPortal ?? this.config.defaultPortal,
      requestId,
      sessionId: partial?.sessionId ?? sessionId,
      actorType: partial?.actorType ?? actorType,
      correlationId,
    });
  }

  private buildHeaders(
    callerHeaders: ApiRequestOptions['headers'],
    context: RequestContext,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(callerHeaders ?? {}),
    };

    if (!headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }

    const authorization = this.sessionReader?.getAuthorizationHeader();
    if (authorization && !headers.Authorization && !headers.authorization) {
      headers.Authorization = authorization;
    }

    headers['X-Correlation-Id'] = context.correlationId;
    headers['X-Request-Id'] = context.requestId;
    if (context.portal) {
      headers['X-Client-Portal'] = context.portal;
    }

    return headers;
  }

  private resolveAnonKey(): string | null {
    const configured = this.config.anonKey?.trim();
    if (configured) {
      return configured;
    }

    try {
      const loaded = getConfig().api.anonKey?.trim();
      return loaded || null;
    } catch {
      return null;
    }
  }

  private buildMetadata(
    requestId: string,
    correlationId: string,
    context: RequestContext,
    durationMs: number,
    attempt: number,
  ): ApiMetadata {
    return Object.freeze({
      requestId,
      correlationId,
      durationMs,
      attempt,
      context,
    });
  }

  private failureResponse(
    error: ApiFailure['error'],
    requestId: string,
    correlationId: string,
    options: ApiRequestOptions,
    attempt: number,
    durationMs: number,
    context?: RequestContext,
  ): ApiFailure {
    const resolvedContext = context ?? this.buildRequestContext(requestId, correlationId, options.context);
    return {
      ok: false,
      status: error.status,
      error,
      metadata: this.buildMetadata(requestId, correlationId, resolvedContext, durationMs, attempt),
    };
  }

  private logResult(
    level: 'info' | 'warn' | 'error',
    path: string,
    method: string,
    response: ApiResponse<unknown>,
  ): void {
    if (!this.logger) {
      return;
    }

    const meta = redactRequestMeta({
      path,
      method,
      status: response.ok ? response.status : response.error.status,
      code: response.ok ? 'API_SUCCESS' : response.error.code,
      requestId: response.metadata.requestId,
      correlationId: response.metadata.correlationId,
      attempt: response.metadata.attempt,
      durationMs: response.metadata.durationMs,
      portal: response.metadata.context.portal,
      sessionId: response.metadata.context.sessionId,
      actorType: response.metadata.context.actorType,
    });

    this.logger[level]('API request settled', {
      moduleId: this.moduleId,
      source: 'api-client',
      correlationId: response.metadata.correlationId,
      meta,
    });
  }
}

export function createApiClient(deps: ApiClientDeps): ApiClientPublicApi {
  const client = new ApiClient(deps);
  return Object.freeze({
    request: client.request.bind(client),
    get: client.get.bind(client),
    post: client.post.bind(client),
    put: client.put.bind(client),
    delete: client.delete.bind(client),
    invokeEdge: client.invokeEdge.bind(client),
    cancel: client.cancel.bind(client),
    cancelAll: client.cancelAll.bind(client),
  });
}

function resolveClientConfig(config?: AppConfig | ApiClientConfig): ApiClientConfig {
  if (config && 'api' in config) {
    return {
      baseUrl: config.api.publicUrl,
      anonKey: config.api.anonKey,
      defaultPortal: undefined,
      defaultRetryPolicy: undefined,
    };
  }

  if (config && 'baseUrl' in config) {
    return config;
  }

  const loaded = getConfig();
  return {
    baseUrl: loaded.api.publicUrl,
    anonKey: loaded.api.anonKey,
  };
}

function resolveLogger(logger?: Logger): Logger | null {
  if (logger) {
    return logger;
  }

  try {
    return getLogger();
  } catch {
    return null;
  }
}

function mergeAbortSignals(
  external: AbortSignal | undefined,
  internal: AbortSignal,
): AbortSignal {
  if (!external) {
    return internal;
  }

  if (external.aborted) {
    return external;
  }

  if (typeof AbortSignal !== 'undefined' && 'any' in AbortSignal && typeof AbortSignal.any === 'function') {
    return AbortSignal.any([external, internal]);
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  external.addEventListener('abort', abort, { once: true });
  internal.addEventListener('abort', abort, { once: true });
  return controller.signal;
}

function mapTransportException(error: unknown, signal?: AbortSignal) {
  if (error instanceof TransportCancelledError || signal?.aborted) {
    if (signal?.reason === 'timeout') {
      return normalizeApiError({ kind: 'timeout', cause: error });
    }
    return normalizeApiError({ kind: 'cancelled', cause: error });
  }

  if (error instanceof TransportNetworkError) {
    return normalizeApiError({ kind: 'network', message: error.message, cause: error });
  }

  return normalizeApiError({
    kind: 'network',
    message: error instanceof Error ? error.message : 'Unknown transport failure.',
    cause: error,
  });
}
