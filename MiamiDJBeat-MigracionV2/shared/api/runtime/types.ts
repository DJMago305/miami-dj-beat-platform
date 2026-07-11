/** MOD-005 API Client — types — TICKET-V2-PHASE-4-MOD-005-FOUNDATION-001 */

import type { PortalId } from '@mdj/shared/config';

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ActorType = 'guest' | 'authenticated' | 'staff' | 'system';

export type RequestContext = {
  readonly portal?: PortalId;
  readonly requestId: string;
  readonly sessionId?: string | null;
  readonly actorType?: ActorType | string;
  readonly correlationId: string;
};

export type ApiMetadata = {
  readonly requestId: string;
  readonly correlationId: string;
  readonly durationMs: number;
  readonly attempt: number;
  readonly context: RequestContext;
};

export type ApiErrorCode =
  | 'API_NETWORK'
  | 'API_HTTP_ERROR'
  | 'API_PARSE_ERROR'
  | 'API_TIMEOUT'
  | 'API_EDGE_REJECTED'
  | 'API_CANCELLED'
  | 'API_CONFIG_ERROR'
  | 'API_INVALID_PAYLOAD'
  | 'API_RATE_LIMITED'
  | 'API_UNKNOWN';

export type NormalizeApiErrorInput =
  | {
      readonly kind: 'cancelled';
      readonly cause?: unknown;
      readonly message?: string;
    }
  | {
      readonly kind: 'timeout';
      readonly status?: number;
      readonly cause?: unknown;
      readonly message?: string;
    }
  | {
      readonly kind: 'network';
      readonly cause?: unknown;
      readonly message?: string;
    }
  | {
      readonly kind: 'http';
      readonly status: number;
      readonly bodyText?: string;
      readonly parsedBody?: unknown;
      readonly cause?: unknown;
      readonly message?: string;
    }
  | {
      readonly kind: 'bad-response';
      readonly status?: number;
      readonly bodyText?: string;
      readonly parsedBody?: unknown;
      readonly cause?: unknown;
      readonly message?: string;
    }
  | {
      readonly kind: 'unknown';
      readonly cause?: unknown;
      readonly message?: string;
    };

export type ApiError = {
  readonly code: ApiErrorCode;
  readonly message: string;
  readonly details: string | Record<string, unknown> | null;
  readonly status: number;
};

export type RetryPolicy = {
  readonly maxAttempts: number;
  readonly backoffMs: readonly number[];
  readonly retryOn: readonly ApiErrorCode[];
  readonly jitter: boolean;
};

export type ApiRequestOptions = {
  readonly path: string;
  readonly method?: ApiMethod;
  readonly query?: Readonly<Record<string, string | number | boolean>>;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
  readonly retryPolicy?: RetryPolicy;
  readonly retrySafe?: boolean;
  readonly signal?: AbortSignal;
  readonly context?: Partial<RequestContext>;
};

export type SupabaseInvokeAuthMode = 'session' | 'anon';

export type InvokeEdgeOptions = Omit<ApiRequestOptions, 'path' | 'method' | 'body'> & {
  /** Default `session`. Use `anon` only for explicit guest/public checkout flows. */
  readonly authMode?: SupabaseInvokeAuthMode;
};

export type ApiRequest = ApiRequestOptions & {
  readonly method: ApiMethod;
  readonly requestId: string;
  readonly correlationId: string;
};

export type ApiSuccess<T = unknown> = {
  readonly ok: true;
  readonly status: number;
  readonly data: T;
  readonly metadata: ApiMetadata;
};

export type ApiFailure = {
  readonly ok: false;
  readonly status: number;
  readonly error: ApiError;
  readonly metadata: ApiMetadata;
};

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiFailure;

export type ApiClientPublicApi = {
  readonly request: <T = unknown>(options: ApiRequestOptions) => Promise<ApiResponse<T>>;
  readonly get: <T = unknown>(path: string, options?: Omit<ApiRequestOptions, 'path' | 'method'>) => Promise<ApiResponse<T>>;
  readonly post: <T = unknown>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'path' | 'method' | 'body'>) => Promise<ApiResponse<T>>;
  readonly put: <T = unknown>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'path' | 'method' | 'body'>) => Promise<ApiResponse<T>>;
  readonly delete: <T = unknown>(path: string, options?: Omit<ApiRequestOptions, 'path' | 'method'>) => Promise<ApiResponse<T>>;
  readonly invokeEdge: <T = unknown>(functionName: string, body?: unknown, options?: InvokeEdgeOptions) => Promise<ApiResponse<T>>;
  readonly cancel: (requestId: string) => void;
  readonly cancelAll: () => void;
};

export type ApiClientConfig = {
  readonly baseUrl: string;
  readonly anonKey?: string;
  readonly defaultTimeoutMs?: number;
  readonly readTimeoutMs?: number;
  readonly writeTimeoutMs?: number;
  readonly defaultRetryPolicy?: RetryPolicy;
  readonly defaultPortal?: PortalId;
};
