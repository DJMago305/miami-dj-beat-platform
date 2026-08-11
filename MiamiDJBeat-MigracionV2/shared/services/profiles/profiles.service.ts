/**
 * Profiles service — READ-ONLY fetching (Paso 3).
 * Uses lab ApiClient + mdj_access_snapshot RPC + PostgREST SELECT only.
 * No update/insert/upsert/delete.
 */

import { createApiError } from '../../api/runtime/errors';
import type {
  ApiClientPublicApi,
  ApiFailure,
  ApiMetadata,
  ApiResponse,
  RequestContext,
  SessionReaderPort,
} from '../../api/runtime';
import { createSupabaseAdapter, type SupabaseAdapter } from '../../api/supabase';
import { MDJ_ACCESS_SNAPSHOT_RPC } from '../access-snapshot';
import { mapAccessSnapshotRpcToDto } from './profiles.map-snapshot';
import {
  firstRestRow,
  mapArtistProfileRow,
  mapClientProfileRow,
  mapPublicArtistCardRow,
} from './profiles.map-rows';
import {
  classifyPlatformIdentity,
  type ProfilesIdentityClassification,
} from './profiles.identity-map';
import type {
  AccessSnapshotDTO,
  AccessSnapshotRpcPayload,
  ArtistProfileReadDTO,
  ClientProfileReadDTO,
  PublicArtistCardDTO,
} from './profiles.types';

export type ProfilesFetchOptions = {
  readonly timeoutMs?: number;
  readonly context?: Partial<RequestContext>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
  readonly retrySafe?: boolean;
};

export type ProfilesServiceErrorCode =
  | 'PROFILES_SESSION_REQUIRED'
  | 'PROFILES_NOT_FOUND'
  | 'PROFILES_INVALID_LOOKUP'
  | 'PROFILES_PARSE_ERROR'
  | 'PROFILES_IDENTITY_UNRESOLVED';

export type ProfilesService = {
  readonly fetchOwnAccessSnapshot: (
    options?: ProfilesFetchOptions,
  ) => Promise<ApiResponse<AccessSnapshotDTO>>;
  readonly fetchOwnArtistProfile: (
    options?: ProfilesFetchOptions,
  ) => Promise<ApiResponse<ArtistProfileReadDTO>>;
  readonly fetchOwnClientProfile: (
    options?: ProfilesFetchOptions,
  ) => Promise<ApiResponse<ClientProfileReadDTO>>;
  readonly fetchPublicArtistCard: (
    stageNameOrSlug: string,
    options?: ProfilesFetchOptions,
  ) => Promise<ApiResponse<PublicArtistCardDTO>>;
  /** Paso 4 — snapshot + enrichment → profile-matrix identity (read-only). */
  readonly fetchOwnIdentityClassification: (
    options?: ProfilesFetchOptions,
  ) => Promise<ApiResponse<ProfilesIdentityClassificationSuccessData>>;
};

export type ProfilesIdentityClassificationSuccessData = Extract<
  ProfilesIdentityClassification,
  { ok: true }
>;

/** Injectable read port — SELECT/RPC only (tests inject mocks). */
export type ProfilesDataPort = {
  readonly invokeAccessSnapshot: (
    options?: ProfilesFetchOptions,
  ) => Promise<ApiResponse<unknown>>;
  readonly selectOwnDjProfile: (options?: ProfilesFetchOptions) => Promise<ApiResponse<unknown>>;
  readonly selectOwnClientProfile: (options?: ProfilesFetchOptions) => Promise<ApiResponse<unknown>>;
  readonly selectPublicArtistByHandle: (
    stageNameOrSlug: string,
    options?: ProfilesFetchOptions,
  ) => Promise<ApiResponse<unknown>>;
};

export type CreateProfilesServiceInput = {
  readonly dataPort: ProfilesDataPort;
  readonly sessionReader?: SessionReaderPort;
};

export type CreateProfilesServiceFromApiClientInput = {
  readonly apiClient: ApiClientPublicApi;
  readonly sessionReader: SessionReaderPort;
};

const SEALED_RPC_OPTIONS = Object.freeze({
  authMode: 'session' as const,
  requireSession: true as const,
});

function buildFailure(
  code: ProfilesServiceErrorCode,
  message: string,
  status: number,
  metadata: ApiMetadata,
  details: string | null = null,
): ApiFailure {
  return Object.freeze({
    ok: false,
    status,
    error: createApiError(
      code === 'PROFILES_PARSE_ERROR' ? 'API_PARSE_ERROR' : 'API_INVALID_PAYLOAD',
      message,
      status,
      details ?? code,
    ),
    metadata,
  });
}

function emptyMetadata(context?: Partial<RequestContext>): ApiMetadata {
  const requestId = context?.requestId ?? 'profiles_precheck';
  const correlationId = context?.correlationId ?? 'profiles_precheck';
  return Object.freeze({
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
  });
}

function requireSession(
  sessionReader: SessionReaderPort | undefined,
  options?: ProfilesFetchOptions,
): ApiFailure | null {
  if ((sessionReader?.getAuthorizationHeader() ?? null) !== null) {
    return null;
  }
  return buildFailure(
    'PROFILES_SESSION_REQUIRED',
    'Profiles own-read requires an active session.',
    0,
    emptyMetadata(options?.context),
    'PROFILES_SESSION_REQUIRED',
  );
}

function postgrestEqOrFilter(stageNameOrSlug: string): string {
  const escaped = stageNameOrSlug.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const quoted = `"${escaped}"`;
  return `(dj_slug.eq.${quoted},username.eq.${quoted},stage_name.eq.${quoted})`;
}

function toRpcOptions(options?: ProfilesFetchOptions) {
  if (!options) return SEALED_RPC_OPTIONS;
  return Object.freeze({
    ...SEALED_RPC_OPTIONS,
    timeoutMs: options.timeoutMs,
    context: options.context,
    headers: options.headers,
    signal: options.signal,
    retrySafe: options.retrySafe,
  });
}

function toGetOptions(options?: ProfilesFetchOptions) {
  if (!options) return {};
  return {
    timeoutMs: options.timeoutMs,
    context: options.context,
    headers: options.headers,
    signal: options.signal,
    retrySafe: options.retrySafe === true,
  };
}

export function createApiProfilesDataPort(input: {
  readonly apiClient: ApiClientPublicApi;
  readonly supabaseAdapter: SupabaseAdapter;
}): ProfilesDataPort {
  const { apiClient, supabaseAdapter } = input;

  return Object.freeze({
    async invokeAccessSnapshot(options?: ProfilesFetchOptions) {
      return supabaseAdapter.invokeRpc<unknown>({
        functionName: MDJ_ACCESS_SNAPSHOT_RPC,
        params: {},
        options: toRpcOptions(options),
      });
    },

    async selectOwnDjProfile(options?: ProfilesFetchOptions) {
      return apiClient.get<unknown>('/rest/v1/dj_profiles', {
        ...toGetOptions(options),
        query: { select: '*', limit: 1 },
        headers: {
          ...(options?.headers ?? {}),
          Accept: 'application/json',
        },
      });
    },

    async selectOwnClientProfile(options?: ProfilesFetchOptions) {
      return apiClient.get<unknown>('/rest/v1/client_profiles', {
        ...toGetOptions(options),
        query: { select: '*', limit: 1 },
        headers: {
          ...(options?.headers ?? {}),
          Accept: 'application/json',
        },
      });
    },

    async selectPublicArtistByHandle(stageNameOrSlug: string, options?: ProfilesFetchOptions) {
      return apiClient.get<unknown>('/rest/v1/public_dj_profiles', {
        ...toGetOptions(options),
        query: {
          select: '*',
          or: postgrestEqOrFilter(stageNameOrSlug),
          limit: 1,
        },
        headers: {
          ...(options?.headers ?? {}),
          Accept: 'application/json',
        },
      });
    },
  });
}

export function createProfilesService(input: CreateProfilesServiceInput): ProfilesService {
  const { dataPort, sessionReader } = input;

  const service: ProfilesService = {
    async fetchOwnAccessSnapshot(options?: ProfilesFetchOptions) {
      const sessionFail = requireSession(sessionReader, options);
      if (sessionFail) return sessionFail;

      const result = await dataPort.invokeAccessSnapshot(options);
      if (!result.ok) return result;

      const dto = mapAccessSnapshotRpcToDto(result.data as AccessSnapshotRpcPayload);
      if (!dto.ok && dto.reason === 'invalid_payload') {
        return buildFailure(
          'PROFILES_PARSE_ERROR',
          'Invalid mdj_access_snapshot payload.',
          result.status,
          result.metadata,
        );
      }

      return Object.freeze({
        ok: true,
        status: result.status,
        data: dto,
        metadata: result.metadata,
      });
    },

    async fetchOwnArtistProfile(options?: ProfilesFetchOptions) {
      const sessionFail = requireSession(sessionReader, options);
      if (sessionFail) return sessionFail;

      const [rowResult, snapResult] = await Promise.all([
        dataPort.selectOwnDjProfile(options),
        dataPort.invokeAccessSnapshot(options),
      ]);
      if (!rowResult.ok) return rowResult;

      const row = firstRestRow(rowResult.data);
      if (!row) {
        return buildFailure(
          'PROFILES_NOT_FOUND',
          'No dj_profiles row for the current session.',
          rowResult.status,
          rowResult.metadata,
        );
      }

      let artistTier: number | null = null;
      let mdjbId: string | null = null;
      if (snapResult.ok) {
        const snap = mapAccessSnapshotRpcToDto(snapResult.data as AccessSnapshotRpcPayload);
        if (snap.ok) {
          artistTier = snap.artistTier;
          mdjbId = snap.mdjbId;
        }
      }

      return Object.freeze({
        ok: true,
        status: rowResult.status,
        data: mapArtistProfileRow(row, { artistTier, mdjbId }),
        metadata: rowResult.metadata,
      });
    },

    async fetchOwnClientProfile(options?: ProfilesFetchOptions) {
      const sessionFail = requireSession(sessionReader, options);
      if (sessionFail) return sessionFail;

      const [rowResult, snapResult] = await Promise.all([
        dataPort.selectOwnClientProfile(options),
        dataPort.invokeAccessSnapshot(options),
      ]);
      if (!rowResult.ok) return rowResult;

      const row = firstRestRow(rowResult.data);
      if (!row) {
        return buildFailure(
          'PROFILES_NOT_FOUND',
          'No client_profiles row for the current session.',
          rowResult.status,
          rowResult.metadata,
        );
      }

      const mapped = mapClientProfileRow(row);
      let mdjbId: string | null = mapped.mdjbId;
      if (snapResult.ok) {
        const snap = mapAccessSnapshotRpcToDto(snapResult.data as AccessSnapshotRpcPayload);
        if (snap.ok && snap.mdjbId) {
          mdjbId = snap.mdjbId;
        }
      }

      return Object.freeze({
        ok: true,
        status: rowResult.status,
        data: Object.freeze({ ...mapped, mdjbId }),
        metadata: rowResult.metadata,
      });
    },

    async fetchPublicArtistCard(stageNameOrSlug: string, options?: ProfilesFetchOptions) {
      const key = String(stageNameOrSlug || '').trim();
      if (!key) {
        return buildFailure(
          'PROFILES_INVALID_LOOKUP',
          'stageNameOrSlug is required.',
          0,
          emptyMetadata(options?.context),
        );
      }

      const result = await dataPort.selectPublicArtistByHandle(key, options);
      if (!result.ok) return result;

      const row = firstRestRow(result.data);
      if (!row) {
        return buildFailure(
          'PROFILES_NOT_FOUND',
          `No public artist card for handle: ${key}`,
          result.status,
          result.metadata,
        );
      }

      return Object.freeze({
        ok: true,
        status: result.status,
        data: mapPublicArtistCardRow(row),
        metadata: result.metadata,
      });
    },

    async fetchOwnIdentityClassification(options?: ProfilesFetchOptions) {
      const sessionFail = requireSession(sessionReader, options);
      if (sessionFail) return sessionFail;

      const snapResult = await service.fetchOwnAccessSnapshot(options);
      if (!snapResult.ok) return snapResult;

      const snapshot = snapResult.data;

      let clientProfile: ClientProfileReadDTO | null = null;
      let artistProfile: ArtistProfileReadDTO | null = null;

      if (snapshot.ok && snapshot.profileKind === 'buyer') {
        const clientResult = await service.fetchOwnClientProfile(options);
        if (clientResult.ok) {
          clientProfile = clientResult.data;
        }
      }

      if (snapshot.ok && snapshot.profileKind === 'artist') {
        const artistResult = await service.fetchOwnArtistProfile(options);
        if (artistResult.ok) {
          artistProfile = artistResult.data;
        }
      }

      const classified = classifyPlatformIdentity({
        snapshot,
        clientProfile,
        artistProfile,
      });

      if (!classified.ok) {
        return buildFailure(
          'PROFILES_IDENTITY_UNRESOLVED',
          classified.reason,
          snapResult.status,
          snapResult.metadata,
          classified.code,
        );
      }

      return Object.freeze({
        ok: true,
        status: snapResult.status,
        data: classified,
        metadata: snapResult.metadata,
      });
    },
  };

  return Object.freeze(service);
}

export function createProfilesServiceFromApiClient(
  input: CreateProfilesServiceFromApiClientInput,
): ProfilesService {
  const supabaseAdapter = createSupabaseAdapter({
    apiClient: input.apiClient,
    sessionReader: input.sessionReader,
  });
  return createProfilesService({
    dataPort: createApiProfilesDataPort({
      apiClient: input.apiClient,
      supabaseAdapter,
    }),
    sessionReader: input.sessionReader,
  });
}
