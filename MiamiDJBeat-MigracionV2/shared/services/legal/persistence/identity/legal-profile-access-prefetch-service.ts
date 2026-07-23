/** LC-13B — Async prefetch orchestrator for legal_resolve_profile_access (MemoryTransport lab) */

import type { ApiClientPublicApi } from '../../../../api/runtime/types';
import type { PermissionSnapshot } from '../../../../permissions/runtime';
import type { SessionSnapshot } from '../../../../session/runtime/types';
import {
  getDefaultLegalProfileResolutionCache,
  type LegalProfileResolutionCacheKeyInput,
  type LegalProfileResolutionCachePort,
} from './legal-profile-resolution-cache';
import {
  isTransientLegalProfileAccessPrefetchError,
  legalProfileAccessPrefetchFailure,
  legalProfileAccessPrefetchSuccess,
  mapRpcFailureCodeToPrefetchCode,
  type LegalProfileAccessPrefetchErrorCode,
  type LegalProfileAccessPrefetchResult,
} from './legal-profile-access-prefetch-errors';
import { mapProfileKindToLegalPortal, mapDocumentedRoleToLegalReadRole } from './legal-read-role-mapper';
import {
  LEGAL_RESOLVE_PROFILE_ACCESS_RPC,
  mapLegalResolveProfileAccessSuccessToCacheEntry,
  validateLegalResolveProfileAccessPayload,
  type LegalResolveProfileAccessSourcePortal,
  type LegalResolveProfileAccessSuccessPayload,
} from './legal-resolve-profile-access-types';

const DEFAULT_PREFETCH_TIMEOUT_MS = 3000;

export type LegalProfileAccessPrefetchInput = {
  readonly session: SessionSnapshot;
  readonly permissions: PermissionSnapshot;
  readonly apiClient: ApiClientPublicApi;
  readonly cache?: LegalProfileResolutionCachePort;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly correlationId?: string;
};

export type LegalProfileAccessPrefetchService = {
  readonly prefetch: (input: LegalProfileAccessPrefetchInput) => Promise<LegalProfileAccessPrefetchResult>;
};

function buildCacheKey(
  session: SessionSnapshot,
  permissions: PermissionSnapshot,
): LegalProfileResolutionCacheKeyInput | null {
  const authUserId = session.user?.userId?.trim();
  if (!authUserId) {
    return null;
  }

  const profileKind = permissions.profile.kind;
  if (profileKind === 'guest') {
    return null;
  }

  return Object.freeze({
    authUserId,
    profileKind,
    sourcePortal: session.portal,
    documentedRole: permissions.documentedRole,
  });
}

function mapApiErrorToPrefetchCode(errorCode: string): LegalProfileAccessPrefetchErrorCode {
  switch (errorCode) {
    case 'API_TIMEOUT':
      return 'timeout';
    case 'API_CANCELLED':
      return 'cancelled';
    case 'API_NETWORK':
    case 'API_HTTP_ERROR':
    case 'API_UNKNOWN':
      return 'rpc_unavailable';
    case 'API_PARSE_ERROR':
    case 'API_INVALID_PAYLOAD':
      return 'malformed_response';
    default:
      return 'rpc_unavailable';
  }
}

function validateResolvedActorAgainstPermissions(
  payload: LegalResolveProfileAccessSuccessPayload,
  permissions: PermissionSnapshot,
  effectivePortal: LegalResolveProfileAccessSourcePortal,
): LegalProfileAccessPrefetchErrorCode | null {
  const mapped = mapDocumentedRoleToLegalReadRole(permissions.documentedRole);
  if (!mapped) {
    return 'role_unsupported';
  }

  if (mapped.actorType !== payload.actor_type || mapped.role !== payload.actor_role) {
    return 'role_unsupported';
  }

  if (mapped.portal !== effectivePortal) {
    return 'portal_mismatch';
  }

  if (payload.actor_type === 'artist') {
    if (!payload.recipient_scope || payload.recipient_scope !== payload.business_entity_id) {
      return 'malformed_response';
    }
  }

  if (payload.actor_type === 'client' && payload.recipient_scope !== null) {
    return 'malformed_response';
  }

  return null;
}

function shouldDenyPrefetch(
  session: SessionSnapshot,
  permissions: PermissionSnapshot,
): LegalProfileAccessPrefetchErrorCode | null {
  if (session.state === 'SESSION_EXPIRED') {
    return 'unauthenticated';
  }

  if (!session.user?.userId?.trim()) {
    return 'unauthenticated';
  }

  if (permissions.documentedRole === 'guest') {
    return 'unauthenticated';
  }

  if (!mapDocumentedRoleToLegalReadRole(permissions.documentedRole)) {
    return 'role_unsupported';
  }

  const profileKind = permissions.profile.kind;
  if (profileKind === 'guest') {
    return 'role_unsupported';
  }

  const effectivePortal = mapProfileKindToLegalPortal(profileKind);
  if (!effectivePortal || session.portal !== effectivePortal) {
    return 'portal_mismatch';
  }

  return null;
}

function isStaleRevision(
  cache: LegalProfileResolutionCachePort,
  cacheKey: LegalProfileResolutionCacheKeyInput,
  session: SessionSnapshot,
): boolean {
  const existing = cache.get(cacheKey);
  if (!existing) {
    return false;
  }
  return existing.sessionSnapshotVersion !== session.snapshotVersion;
}

type RpcResolution =
  | { readonly ok: true; readonly payload: LegalResolveProfileAccessSuccessPayload }
  | { readonly ok: false; readonly code: LegalProfileAccessPrefetchErrorCode; readonly message: string };

async function invokeLegalResolveProfileAccessRpc(
  input: LegalProfileAccessPrefetchInput,
  sourcePortal: LegalResolveProfileAccessSourcePortal,
): Promise<RpcResolution> {
  const response = await input.apiClient.rpc<unknown>(
    LEGAL_RESOLVE_PROFILE_ACCESS_RPC,
    Object.freeze({
      source_portal: sourcePortal,
      ...(input.correlationId ? { correlation_id: input.correlationId } : {}),
    }),
    Object.freeze({
      timeoutMs: input.timeoutMs ?? DEFAULT_PREFETCH_TIMEOUT_MS,
      signal: input.signal,
    }),
  );

  if (!response.ok) {
    return Object.freeze({
      ok: false,
      code: mapApiErrorToPrefetchCode(response.error.code),
      message: response.error.message,
    });
  }

  const validated = validateLegalResolveProfileAccessPayload(response.data);
  if (!validated.ok) {
    return Object.freeze({
      ok: false,
      code: 'malformed_response',
      message: validated.reason,
    });
  }

  if (validated.payload.ok === false) {
    return Object.freeze({
      ok: false,
      code: mapRpcFailureCodeToPrefetchCode(validated.payload.code),
      message: validated.payload.reason,
    });
  }

  if (validated.payload.profile_status === 'inactive') {
    return Object.freeze({
      ok: false,
      code: 'profile_inactive',
      message: 'Legal profile is inactive.',
    });
  }

  const actorMismatch = validateResolvedActorAgainstPermissions(
    validated.payload,
    input.permissions,
    sourcePortal,
  );
  if (actorMismatch) {
    return Object.freeze({
      ok: false,
      code: actorMismatch,
      message: 'Resolved actor does not match permission snapshot.',
    });
  }

  return Object.freeze({ ok: true, payload: validated.payload });
}

export function createLegalProfileAccessPrefetchService(
  defaultCache: LegalProfileResolutionCachePort = getDefaultLegalProfileResolutionCache(),
): LegalProfileAccessPrefetchService {
  return Object.freeze({
    async prefetch(input: LegalProfileAccessPrefetchInput): Promise<LegalProfileAccessPrefetchResult> {
      const cache = input.cache ?? defaultCache;
      const denyReason = shouldDenyPrefetch(input.session, input.permissions);
      const cacheKey = buildCacheKey(input.session, input.permissions);

      if (denyReason || !cacheKey) {
        if (cacheKey) {
          cache.invalidateForAuthUser(cacheKey.authUserId);
        } else if (input.session.user?.userId) {
          cache.invalidateForAuthUser(input.session.user.userId);
        } else {
          cache.clear();
        }
        return legalProfileAccessPrefetchFailure(
          denyReason ?? 'unauthenticated',
          denyReason ? `Prefetch denied: ${denyReason}.` : 'Prefetch denied: identity unavailable.',
        );
      }

      const effectivePortal = mapProfileKindToLegalPortal(cacheKey.profileKind);
      if (!effectivePortal || effectivePortal === 'system') {
        cache.invalidateForAuthUser(cacheKey.authUserId);
        return legalProfileAccessPrefetchFailure('role_unsupported', 'Unable to derive effective portal.');
      }

      const sourcePortal = effectivePortal as LegalResolveProfileAccessSourcePortal;

      if (isStaleRevision(cache, cacheKey, input.session)) {
        cache.delete(cacheKey);
      }

      if (input.session.isRefreshing) {
        const existing = cache.get(cacheKey);
        if (!existing || existing.sessionSnapshotVersion !== input.session.snapshotVersion) {
          cache.delete(cacheKey);
          return legalProfileAccessPrefetchFailure(
            'unauthenticated',
            'Session refresh in progress without valid cached resolution.',
          );
        }
        return legalProfileAccessPrefetchSuccess(existing.revision);
      }

      let rpcResult = await invokeLegalResolveProfileAccessRpc(input, sourcePortal);
      let retried = false;

      if (
        !rpcResult.ok &&
        isTransientLegalProfileAccessPrefetchError(rpcResult.code)
      ) {
        retried = true;
        rpcResult = await invokeLegalResolveProfileAccessRpc(input, sourcePortal);
      }

      if (!rpcResult.ok) {
        cache.invalidateForAuthUser(cacheKey.authUserId);
        return legalProfileAccessPrefetchFailure(rpcResult.code, rpcResult.message, retried);
      }

      cache.set(
        cacheKey,
        mapLegalResolveProfileAccessSuccessToCacheEntry(rpcResult.payload, input.session.snapshotVersion),
      );

      return legalProfileAccessPrefetchSuccess(rpcResult.payload.revision);
    },
  });
}

export const DEFAULT_LEGAL_PROFILE_ACCESS_PREFETCH_SERVICE = createLegalProfileAccessPrefetchService();
