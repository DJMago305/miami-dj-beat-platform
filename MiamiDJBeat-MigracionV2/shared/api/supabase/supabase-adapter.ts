/** MOD-005 Supabase Adapter — thin wrapper — TICKET-V2-PHASE-7-SUPABASE-ADAPTER-IMPLEMENTATION-001 */

import { createApiError } from '../runtime/errors';
import type { InvokeEdgeOptions, RequestContext, RpcOptions } from '../runtime/types';
import type { SessionReaderPort } from '../runtime/session-reader-port';
import type {
  CreateSupabaseAdapterInput,
  SupabaseAdapter,
  SupabaseAdapterResult,
  SupabaseAuthContext,
  SupabaseEdgeRequest,
  SupabaseRequestOptions,
  SupabaseRpcRequest,
} from './supabase-adapter-types';

function toSupabaseAuthActorType(actorType: string): SupabaseAuthContext['actorType'] {
  return actorType === 'authenticated' ? 'authenticated' : 'guest';
}

function resolveAuthContext(sessionReader?: SessionReaderPort): SupabaseAuthContext {
  const authorizationHeader = sessionReader?.getAuthorizationHeader() ?? null;
  const actorType = toSupabaseAuthActorType(sessionReader?.getActorType() ?? 'guest');

  return Object.freeze({
    hasSession: authorizationHeader !== null,
    sessionId: sessionReader?.getSessionId() ?? null,
    portal: sessionReader?.getPortal() ?? null,
    actorType,
  });
}

function toClientOptions(options?: SupabaseRequestOptions): InvokeEdgeOptions | RpcOptions {
  if (!options) {
    return {};
  }

  const { requireSession: _requireSession, ...clientOptions } = options;
  return clientOptions;
}

function buildRequireSessionFailure(
  context?: Partial<RequestContext>,
): SupabaseAdapterResult<never> {
  const requestId = context?.requestId ?? 'precheck';
  const correlationId = context?.correlationId ?? 'precheck';
  const error = createApiError(
    'API_INVALID_PAYLOAD',
    'Supabase adapter request requires an active session.',
    0,
    null,
  );

  return {
    ok: false,
    status: 0,
    error,
    metadata: Object.freeze({
      requestId,
      correlationId,
      durationMs: 0,
      attempt: 1,
      context: Object.freeze({
        requestId,
        correlationId,
        portal: context?.portal,
        sessionId: context?.sessionId ?? null,
        actorType: context?.actorType ?? 'guest',
      }),
    }),
  };
}

function requiresActiveSession(
  options: SupabaseRequestOptions | undefined,
  sessionReader: SessionReaderPort | undefined,
): boolean {
  if (options?.requireSession !== true) {
    return false;
  }

  return (sessionReader?.getAuthorizationHeader() ?? null) === null;
}

export function createSupabaseAdapter(input: CreateSupabaseAdapterInput): SupabaseAdapter {
  const { apiClient, sessionReader } = input;

  const adapter: SupabaseAdapter = {
    async invokeEdge<TResponse = unknown, TBody = unknown>(
      request: SupabaseEdgeRequest<TBody>,
    ): Promise<SupabaseAdapterResult<TResponse>> {
      if (requiresActiveSession(request.options, sessionReader)) {
        return buildRequireSessionFailure(request.options?.context);
      }

      return apiClient.invokeEdge<TResponse>(
        request.functionName,
        request.body,
        toClientOptions(request.options),
      );
    },

    async invokeRpc<TResponse = unknown, TParams = Record<string, unknown>>(
      request: SupabaseRpcRequest<TParams>,
    ): Promise<SupabaseAdapterResult<TResponse>> {
      if (requiresActiveSession(request.options, sessionReader)) {
        return buildRequireSessionFailure(request.options?.context);
      }

      return apiClient.rpc<TResponse>(
        request.functionName,
        request.params,
        toClientOptions(request.options),
      );
    },

    getAuthContext(): SupabaseAuthContext {
      return resolveAuthContext(sessionReader);
    },

    cancel(requestId: string): void {
      apiClient.cancel(requestId);
    },

    cancelAll(): void {
      apiClient.cancelAll();
    },
  };

  return Object.freeze(adapter);
}
