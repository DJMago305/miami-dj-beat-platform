/** Domain service — access snapshot via Supabase adapter — TICKET-V2-PHASE-7-DOMAIN-SERVICE-WIRING-CORRECTION-001 */

import { createApiError } from '../../api/runtime/errors';
import type { ApiClientPublicApi, ApiFailure, ApiMetadata } from '../../api/runtime/types';
import type { SessionReaderPort } from '../../api/runtime/session-reader-port';
import { createSupabaseAdapter, type SupabaseAdapter } from '../../api/supabase';
import type { ArtistTier, ProfileResolveInput, SnapshotFlags } from '../../permissions/runtime/types';
import {
  MDJ_ACCESS_SNAPSHOT_PROFILE_KINDS,
  MDJ_ACCESS_SNAPSHOT_RPC,
  type AccessSnapshotFetchOptions,
  type AccessSnapshotMappingResult,
  type AccessSnapshotServiceResult,
  type MdjAccessSnapshotPayload,
  type MdjAccessSnapshotProfileKind,
  type ValidateMdjAccessSnapshotPayloadResult,
} from './access-snapshot-types';

export type AccessSnapshotService = {
  readonly fetchSnapshot: (
    options?: AccessSnapshotFetchOptions,
  ) => Promise<AccessSnapshotServiceResult<MdjAccessSnapshotPayload>>;
};

export type CreateAccessSnapshotServiceInput = {
  readonly supabaseAdapter: SupabaseAdapter;
};

export type CreateAccessSnapshotServiceFromApiClientInput = {
  readonly apiClient: ApiClientPublicApi;
  readonly sessionReader: SessionReaderPort;
};

const SEALED_FETCH_OPTIONS = Object.freeze({
  authMode: 'session' as const,
  requireSession: true as const,
});

const INVALID_SNAPSHOT_PAYLOAD_MESSAGE = 'Invalid mdj_access_snapshot response payload';

function buildSnapshotParseFailure(
  status: number,
  metadata: ApiMetadata,
  reason: string,
): ApiFailure {
  return Object.freeze({
    ok: false,
    status,
    error: createApiError('API_PARSE_ERROR', INVALID_SNAPSHOT_PAYLOAD_MESSAGE, status, reason),
    metadata,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOptionalBoolean(value: unknown): boolean | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return typeof value === 'boolean' ? value : undefined;
}

function readOptionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return typeof value === 'string' ? value : undefined;
}

function isAllowedProfileKind(value: string): value is MdjAccessSnapshotProfileKind {
  return (MDJ_ACCESS_SNAPSHOT_PROFILE_KINDS as readonly string[]).includes(value);
}

export function validateMdjAccessSnapshotPayload(value: unknown): ValidateMdjAccessSnapshotPayloadResult {
  if (!isRecord(value)) {
    return { ok: false, reason: 'Access snapshot payload must be an object.' };
  }

  if (typeof value.ok !== 'boolean') {
    return { ok: false, reason: 'Access snapshot payload requires boolean ok.' };
  }

  if (value.ok === false) {
    const reason = readOptionalString(value.reason);
    if (reason === undefined || reason === null || reason.trim() === '') {
      return { ok: false, reason: 'Access snapshot rejection requires a non-empty reason.' };
    }
    return Object.freeze({
      ok: true,
      payload: Object.freeze({ ok: false, reason }),
    });
  }

  const profileKind = readOptionalString(value.profile_kind);
  if (profileKind === undefined || profileKind === null || !isAllowedProfileKind(profileKind)) {
    return { ok: false, reason: 'Access snapshot success requires a supported profile_kind.' };
  }

  const artistTier = readOptionalNumber(value.artist_tier);
  if (value.artist_tier !== undefined && artistTier === undefined) {
    return { ok: false, reason: 'Access snapshot artist_tier must be a number or null.' };
  }

  const buyerVip = readOptionalBoolean(value.buyer_vip);
  if (value.buyer_vip !== undefined && buyerVip === undefined) {
    return { ok: false, reason: 'Access snapshot buyer_vip must be a boolean or null.' };
  }

  const role = readOptionalString(value.role);
  if (value.role !== undefined && role === undefined) {
    return { ok: false, reason: 'Access snapshot role must be a string or null.' };
  }

  const authUid = readOptionalString(value.auth_uid);
  if (value.auth_uid !== undefined && authUid === undefined) {
    return { ok: false, reason: 'Access snapshot auth_uid must be a string or null.' };
  }

  return Object.freeze({
    ok: true,
    payload: Object.freeze({
      ok: true,
      profile_kind: profileKind,
      artist_tier: artistTier ?? undefined,
      buyer_vip: buyerVip ?? undefined,
      role: role ?? undefined,
      auth_uid: authUid ?? undefined,
    }),
  }) as ValidateMdjAccessSnapshotPayloadResult;
}

function mapArtistTier(value: number | null | undefined): ArtistTier {
  if (value === 2) {
    return 'Elite';
  }
  if (value === 1) {
    return 'Pro';
  }
  return 'Lite';
}

function mappingFailure(
  code: AccessSnapshotMappingResult extends { ok: false; code: infer C } ? C : never,
  reason?: string,
): AccessSnapshotMappingResult {
  return Object.freeze({
    ok: false,
    code,
    reason,
  });
}

function mappingSuccess(
  profile: ProfileResolveInput,
  flags: SnapshotFlags,
): AccessSnapshotMappingResult {
  return Object.freeze({
    ok: true,
    profile: Object.freeze(profile),
    flags: Object.freeze({ ...flags }),
  });
}

export function mapAccessSnapshotToProfileResolveInput(
  value: unknown,
): AccessSnapshotMappingResult {
  const validated = validateMdjAccessSnapshotPayload(value);
  if (!validated.ok) {
    return mappingFailure('ACCESS_SNAPSHOT_INVALID_PAYLOAD', validated.reason);
  }

  const payload = validated.payload;
  if (!payload.ok) {
    return mappingFailure('ACCESS_SNAPSHOT_REJECTED', payload.reason);
  }

  switch (payload.profile_kind) {
    case 'buyer': {
      const isVip = payload.buyer_vip === true;
      return mappingSuccess(
        {
          kind: 'client',
          profileId: isVip ? 'client.vip' : 'client.regular',
        },
        { clientVip: isVip },
      );
    }
    case 'artist':
      return mappingSuccess(
        {
          kind: 'artist',
          profileId: 'artist.dj',
          tier: mapArtistTier(payload.artist_tier),
        },
        {},
      );
    case 'staff_seller':
      return mappingSuccess({ kind: 'staff', profileId: 'staff.seller' }, {});
    case 'staff_full': {
      const role = payload.role?.trim().toLowerCase() ?? '';
      if (role === 'owner') {
        return mappingSuccess({ kind: 'staff', profileId: 'staff.owner' }, {});
      }
      if (role === 'admin' || role === 'manager') {
        return mappingSuccess({ kind: 'staff', profileId: 'staff.manager' }, {});
      }
      return mappingFailure(
        'ACCESS_SNAPSHOT_UNRESOLVED_STAFF',
        role ? `Unsupported staff role: ${role}` : 'Missing staff role for staff_full profile.',
      );
    }
    case 'unknown':
      return mappingFailure(
        'ACCESS_SNAPSHOT_UNKNOWN_PROFILE',
        payload.auth_uid ? `Unknown profile for auth uid ${payload.auth_uid}` : 'Unknown authenticated profile.',
      );
    default:
      return mappingFailure('ACCESS_SNAPSHOT_INVALID_PAYLOAD', 'Unsupported profile_kind.');
  }
}

function toSealedInvokeOptions(options?: AccessSnapshotFetchOptions) {
  if (!options) {
    return SEALED_FETCH_OPTIONS;
  }

  return Object.freeze({
    ...SEALED_FETCH_OPTIONS,
    timeoutMs: options.timeoutMs,
    context: options.context,
    headers: options.headers,
    signal: options.signal,
    retrySafe: options.retrySafe,
  });
}

export function createAccessSnapshotService(
  input: CreateAccessSnapshotServiceInput,
): AccessSnapshotService {
  const { supabaseAdapter } = input;

  return Object.freeze({
    async fetchSnapshot(options?: AccessSnapshotFetchOptions) {
      const result = await supabaseAdapter.invokeRpc<MdjAccessSnapshotPayload>({
        functionName: MDJ_ACCESS_SNAPSHOT_RPC,
        params: {},
        options: toSealedInvokeOptions(options),
      });

      if (!result.ok) {
        return result;
      }

      const validated = validateMdjAccessSnapshotPayload(result.data);
      if (!validated.ok) {
        return buildSnapshotParseFailure(result.status, result.metadata, validated.reason);
      }

      return Object.freeze({
        ok: true,
        status: result.status,
        data: validated.payload,
        metadata: result.metadata,
      });
    },
  });
}

export function createAccessSnapshotServiceFromApiClient(
  input: CreateAccessSnapshotServiceFromApiClientInput,
): AccessSnapshotService {
  return createAccessSnapshotService({
    supabaseAdapter: createSupabaseAdapter({
      apiClient: input.apiClient,
      sessionReader: input.sessionReader,
    }),
  });
}
