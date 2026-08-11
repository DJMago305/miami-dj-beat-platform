/**
 * Artist Mutations adapter — lab writers (Writers Phase · Slice 2 · Paso 2).
 * Session gate · assignment isolation · validation · idempotency · in-memory lab records.
 * NO productive database writers · NO Edge · NO V1 web/.
 */

import type { SessionContextDTO } from '../../types/session.types';
import type {
  AcknowledgePayoutDTO,
  ArtistMutationIdempotencyConflictResult,
  ArtistMutationResult,
  ArtistMutationUnauthorizedResult,
  RespondGigAssignmentDTO,
} from '../../types/artist.mutations.types';
import {
  assertArtistMutationAuthorized,
  assertGigAssignedToArtist,
  toArtistMutationSuccessResult,
  validateAcknowledgePayout,
  validateRespondGigAssignment,
} from '../../types/artist.mutations.types';
import {
  fingerprintAcknowledgePayout,
  fingerprintRespondGigAssignment,
  mapAcknowledgePayoutToLabRecord,
  mapRespondGigAssignmentToLabRecord,
  nextArtistLabRecordId,
  type LabArtistMutationRecord,
} from './artist-mutations.map-rows';
import {
  createLabIdempotencyStore,
  type LabIdempotencyStore,
} from '../client-mutations/lab-idempotency.store';

export type ArtistMutationSessionInput = {
  readonly context: SessionContextDTO;
};

export type RespondGigAssignmentInput = {
  readonly payload: unknown;
  readonly session: ArtistMutationSessionInput;
  /** When set, must equal session.context.userId (scope lock). */
  readonly enforceArtistUserId?: string | null;
  /**
   * Simulated gig row `assigned_dj_id` from lab fixture (adapter assignment check).
   * When set and ≠ session artist → GIG_NOT_ASSIGNED.
   */
  readonly gigAssignedDjId?: string | null;
};

export type AcknowledgePayoutInput = {
  readonly payload: unknown;
  readonly session: ArtistMutationSessionInput;
  readonly enforceArtistUserId?: string | null;
};

export type ArtistMutationsAdapter = {
  readonly respondGigAssignment: (
    input: RespondGigAssignmentInput,
  ) => ArtistMutationResult;
  readonly acknowledgePayout: (input: AcknowledgePayoutInput) => ArtistMutationResult;
  readonly getLabRecord: (labRecordId: string) => LabArtistMutationRecord | null;
  readonly listLabRecords: () => readonly LabArtistMutationRecord[];
  readonly getIdempotencyStore: () => LabIdempotencyStore;
  readonly clearLabState: () => void;
};

export type CreateArtistMutationsAdapterInput = {
  readonly idempotencyStore?: LabIdempotencyStore;
  readonly nowIso?: () => string;
};

function resolveSessionAuth(
  session: ArtistMutationSessionInput,
  mutationKind: RespondGigAssignmentDTO['mutationKind'] | AcknowledgePayoutDTO['mutationKind'],
  idempotencyKey: string | null,
): ArtistMutationUnauthorizedResult | { readonly ok: true; readonly artistUserId: string } {
  const { context } = session;
  const auth = assertArtistMutationAuthorized({
    sessionRole: context.sessionRole,
    artistUserId: context.userId,
    isAnonymous: context.isAnonymous,
    isExpired: context.isExpired,
    mutationKind,
    idempotencyKey,
  });
  if (!('ok' in auth)) {
    return auth;
  }
  if (!context.userId) {
    return Object.freeze({
      status: 'UNAUTHORIZED_ROLE' as const,
      mutationKind,
      idempotencyKey,
      reason: 'missing_artist_scope' as const,
    });
  }
  return Object.freeze({ ok: true as const, artistUserId: context.userId });
}

function scopeMismatch(
  mutationKind: RespondGigAssignmentDTO['mutationKind'] | AcknowledgePayoutDTO['mutationKind'],
  idempotencyKey: string,
): ArtistMutationResult {
  return Object.freeze({
    ok: false as const,
    status: 'VALIDATION_ERROR' as const,
    mutationKind,
    idempotencyKey,
    issues: Object.freeze([
      Object.freeze({
        field: 'artistUserId',
        code: 'scope_mismatch' as const,
        message: 'artistUserId must match session artist scope',
      }),
    ]),
  });
}

function idempotencyConflict(
  mutationKind: RespondGigAssignmentDTO['mutationKind'] | AcknowledgePayoutDTO['mutationKind'],
  idempotencyKey: string,
  existingLabRecordId: string,
): ArtistMutationIdempotencyConflictResult {
  return Object.freeze({
    status: 'IDEMPOTENCY_CONFLICT' as const,
    mutationKind,
    idempotencyKey,
    existingLabRecordId,
    message: 'idempotencyKey already used with a different payload',
  });
}

/**
 * Create lab artist mutations adapter (in-memory persistence only).
 */
export function createArtistMutationsAdapter(
  options: CreateArtistMutationsAdapterInput = {},
): ArtistMutationsAdapter {
  const idempotency = options.idempotencyStore ?? createLabIdempotencyStore();
  const records = new Map<string, LabArtistMutationRecord>();
  const nowIso = options.nowIso ?? (() => new Date().toISOString());

  const adapter: ArtistMutationsAdapter = {
    respondGigAssignment(input): ArtistMutationResult {
      const validated = validateRespondGigAssignment(input.payload);
      if (!validated.ok) {
        return validated;
      }
      const dto = validated.dto;

      const auth = resolveSessionAuth(input.session, dto.mutationKind, dto.idempotencyKey);
      if (!('ok' in auth)) {
        return auth;
      }

      if (dto.artistUserId !== auth.artistUserId) {
        return scopeMismatch(dto.mutationKind, dto.idempotencyKey);
      }
      if (
        input.enforceArtistUserId &&
        input.enforceArtistUserId !== dto.artistUserId
      ) {
        return scopeMismatch(dto.mutationKind, dto.idempotencyKey);
      }

      const assignment = assertGigAssignedToArtist({
        assignedDjId: dto.assignedDjId,
        artistUserId: auth.artistUserId,
        bookingId: dto.bookingId,
        mutationKind: dto.mutationKind,
        idempotencyKey: dto.idempotencyKey,
      });
      if (!('ok' in assignment)) {
        return assignment;
      }

      if (input.gigAssignedDjId != null && input.gigAssignedDjId !== '') {
        const gigAssignment = assertGigAssignedToArtist({
          assignedDjId: input.gigAssignedDjId,
          artistUserId: auth.artistUserId,
          bookingId: dto.bookingId,
          mutationKind: dto.mutationKind,
          idempotencyKey: dto.idempotencyKey,
        });
        if (!('ok' in gigAssignment)) {
          return gigAssignment;
        }
      }

      const fingerprint = fingerprintRespondGigAssignment(dto);
      const lookup = idempotency.lookup({
        actorUserId: dto.artistUserId,
        mutationKind: dto.mutationKind,
        idempotencyKey: dto.idempotencyKey,
        payloadFingerprint: fingerprint,
      });

      if (lookup.hit) {
        if (lookup.samePayload) {
          return toArtistMutationSuccessResult({
            mutationKind: dto.mutationKind,
            idempotencyKey: dto.idempotencyKey,
            acceptedAt: lookup.record.acceptedAt,
            replayed: true,
            labRecordId: lookup.record.labRecordId,
          });
        }
        return idempotencyConflict(
          dto.mutationKind,
          dto.idempotencyKey,
          lookup.record.labRecordId,
        );
      }

      const acceptedAt = nowIso();
      const labRecordId = nextArtistLabRecordId('gig');
      const record = mapRespondGigAssignmentToLabRecord(dto, { labRecordId, acceptedAt });
      records.set(labRecordId, record);
      idempotency.put({
        scopeKey: idempotency.buildScopeKey({
          actorUserId: dto.artistUserId,
          mutationKind: dto.mutationKind,
          idempotencyKey: dto.idempotencyKey,
        }),
        actorUserId: dto.artistUserId,
        mutationKind: dto.mutationKind,
        idempotencyKey: dto.idempotencyKey,
        payloadFingerprint: fingerprint,
        labRecordId,
        acceptedAt,
      });

      return toArtistMutationSuccessResult({
        mutationKind: dto.mutationKind,
        idempotencyKey: dto.idempotencyKey,
        acceptedAt,
        replayed: false,
        labRecordId,
      });
    },

    acknowledgePayout(input): ArtistMutationResult {
      const validated = validateAcknowledgePayout(input.payload);
      if (!validated.ok) {
        return validated;
      }
      const dto = validated.dto;

      const auth = resolveSessionAuth(input.session, dto.mutationKind, dto.idempotencyKey);
      if (!('ok' in auth)) {
        return auth;
      }

      if (dto.artistUserId !== auth.artistUserId) {
        return scopeMismatch(dto.mutationKind, dto.idempotencyKey);
      }
      if (
        input.enforceArtistUserId &&
        input.enforceArtistUserId !== dto.artistUserId
      ) {
        return scopeMismatch(dto.mutationKind, dto.idempotencyKey);
      }

      if (dto.assignedDjId) {
        const assignment = assertGigAssignedToArtist({
          assignedDjId: dto.assignedDjId,
          artistUserId: auth.artistUserId,
          mutationKind: dto.mutationKind,
          idempotencyKey: dto.idempotencyKey,
        });
        if (!('ok' in assignment)) {
          return assignment;
        }
      }

      const fingerprint = fingerprintAcknowledgePayout(dto);
      const lookup = idempotency.lookup({
        actorUserId: dto.artistUserId,
        mutationKind: dto.mutationKind,
        idempotencyKey: dto.idempotencyKey,
        payloadFingerprint: fingerprint,
      });

      if (lookup.hit) {
        if (lookup.samePayload) {
          return toArtistMutationSuccessResult({
            mutationKind: dto.mutationKind,
            idempotencyKey: dto.idempotencyKey,
            acceptedAt: lookup.record.acceptedAt,
            replayed: true,
            labRecordId: lookup.record.labRecordId,
          });
        }
        return idempotencyConflict(
          dto.mutationKind,
          dto.idempotencyKey,
          lookup.record.labRecordId,
        );
      }

      const acceptedAt = nowIso();
      const labRecordId = nextArtistLabRecordId('payout');
      const record = mapAcknowledgePayoutToLabRecord(dto, { labRecordId, acceptedAt });
      records.set(labRecordId, record);
      idempotency.put({
        scopeKey: idempotency.buildScopeKey({
          actorUserId: dto.artistUserId,
          mutationKind: dto.mutationKind,
          idempotencyKey: dto.idempotencyKey,
        }),
        actorUserId: dto.artistUserId,
        mutationKind: dto.mutationKind,
        idempotencyKey: dto.idempotencyKey,
        payloadFingerprint: fingerprint,
        labRecordId,
        acceptedAt,
      });

      return toArtistMutationSuccessResult({
        mutationKind: dto.mutationKind,
        idempotencyKey: dto.idempotencyKey,
        acceptedAt,
        replayed: false,
        labRecordId,
      });
    },

    getLabRecord(labRecordId) {
      return records.get(labRecordId) ?? null;
    },

    listLabRecords() {
      return Object.freeze([...records.values()]);
    },

    getIdempotencyStore() {
      return idempotency;
    },

    clearLabState() {
      records.clear();
      idempotency.clear();
    },
  };

  return adapter;
}

export function listArtistMutationsAdapterWriteMethods(): readonly string[] {
  return Object.freeze([
    'respondGigAssignment',
    'acknowledgePayout',
    'getLabRecord',
    'listLabRecords',
    'getIdempotencyStore',
    'clearLabState',
  ]);
}
