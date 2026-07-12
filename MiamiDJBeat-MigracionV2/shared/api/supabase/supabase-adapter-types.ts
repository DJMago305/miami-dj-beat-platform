/** MOD-005 Supabase Adapter — types — TICKET-V2-PHASE-7-SUPABASE-ADAPTER-IMPLEMENTATION-001 */

import type { PortalId } from '@mdj/shared/config';
import type {
  ApiClientPublicApi,
  ApiResponse,
  RequestContext,
  SessionReaderPort,
  SupabaseInvokeAuthMode,
} from '../runtime';

export type SupabaseAuthActorType = 'guest' | 'authenticated';

export type SupabaseAuthContext = {
  readonly hasSession: boolean;
  readonly sessionId: string | null;
  readonly portal: PortalId | null;
  readonly actorType: SupabaseAuthActorType;
};

export type SupabaseRequestOptions = {
  readonly authMode?: SupabaseInvokeAuthMode;
  readonly timeoutMs?: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
  readonly retrySafe?: boolean;
  readonly context?: Partial<RequestContext>;
  readonly requireSession?: boolean;
};

export type SupabaseEdgeRequest<TBody = unknown> = {
  readonly functionName: string;
  readonly body?: TBody;
  readonly options?: SupabaseRequestOptions;
};

export type SupabaseRpcRequest<TParams = Record<string, unknown>> = {
  readonly functionName: string;
  readonly params?: TParams;
  readonly options?: SupabaseRequestOptions;
};

export type SupabaseAdapterResult<T> = ApiResponse<T>;

export type SupabaseAdapter = {
  invokeEdge<TResponse = unknown, TBody = unknown>(
    request: SupabaseEdgeRequest<TBody>,
  ): Promise<SupabaseAdapterResult<TResponse>>;

  invokeRpc<TResponse = unknown, TParams = Record<string, unknown>>(
    request: SupabaseRpcRequest<TParams>,
  ): Promise<SupabaseAdapterResult<TResponse>>;

  getAuthContext(): SupabaseAuthContext;
  cancel(requestId: string): void;
  cancelAll(): void;
};

export type CreateSupabaseAdapterInput = {
  readonly apiClient: ApiClientPublicApi;
  readonly sessionReader?: SessionReaderPort;
};
