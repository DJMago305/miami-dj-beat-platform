/**
 * Client Mutations adapter — lab writers (Writers Phase · Slice 1 · Paso 2).
 * Session gate · validation · idempotency · in-memory lab records.
 * NO productive database writers · NO Edge · NO V1 web/.
 */

import type { SessionContextDTO } from '../../types/session.types';
import type {
  ClientMutationIdempotencyConflictResult,
  ClientMutationResult,
  ClientMutationUnauthorizedResult,
  CreateBookingRequestDTO,
  SubmitOfflinePaymentProofDTO,
} from '../../types/client.mutations.types';
import {
  assertClientMutationAuthorized,
  toClientMutationSuccessResult,
  validateCreateBookingRequest,
  validateSubmitOfflinePaymentProof,
} from '../../types/client.mutations.types';
import {
  fingerprintCreateBookingRequest,
  fingerprintSubmitOfflinePaymentProof,
  mapCreateBookingRequestToLabRecord,
  mapSubmitOfflinePaymentProofToLabRecord,
  nextLabRecordId,
  type LabMutationRecord,
} from './client-mutations.map-rows';
import {
  createLabIdempotencyStore,
  type LabIdempotencyStore,
} from './lab-idempotency.store';

export type ClientMutationSessionInput = {
  readonly context: SessionContextDTO;
};

export type SubmitBookingRequestInput = {
  readonly payload: unknown;
  readonly session: ClientMutationSessionInput;
  /** When set, must equal session.context.userId (scope lock). */
  readonly enforceClientUserId?: string | null;
};

export type SubmitOfflinePaymentProofInput = {
  readonly payload: unknown;
  readonly session: ClientMutationSessionInput;
  readonly enforceClientUserId?: string | null;
};

export type ClientMutationsAdapter = {
  readonly submitBookingRequest: (
    input: SubmitBookingRequestInput,
  ) => ClientMutationResult;
  readonly submitOfflinePaymentProof: (
    input: SubmitOfflinePaymentProofInput,
  ) => ClientMutationResult;
  readonly getLabRecord: (labRecordId: string) => LabMutationRecord | null;
  readonly listLabRecords: () => readonly LabMutationRecord[];
  readonly getIdempotencyStore: () => LabIdempotencyStore;
  readonly clearLabState: () => void;
};

export type CreateClientMutationsAdapterInput = {
  readonly idempotencyStore?: LabIdempotencyStore;
  readonly nowIso?: () => string;
};

function resolveSessionAuth(
  session: ClientMutationSessionInput,
  mutationKind: CreateBookingRequestDTO['mutationKind'] | SubmitOfflinePaymentProofDTO['mutationKind'],
  idempotencyKey: string | null,
): ClientMutationUnauthorizedResult | { readonly ok: true; readonly clientUserId: string } {
  const { context } = session;
  const auth = assertClientMutationAuthorized({
    sessionRole: context.sessionRole,
    clientUserId: context.userId,
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
      reason: 'missing_client_scope' as const,
    });
  }
  return Object.freeze({ ok: true as const, clientUserId: context.userId });
}

function scopeMismatch(
  mutationKind: CreateBookingRequestDTO['mutationKind'] | SubmitOfflinePaymentProofDTO['mutationKind'],
  idempotencyKey: string,
): ClientMutationResult {
  return Object.freeze({
    ok: false as const,
    status: 'VALIDATION_ERROR' as const,
    mutationKind,
    idempotencyKey,
    issues: Object.freeze([
      Object.freeze({
        field: 'clientUserId',
        code: 'scope_mismatch' as const,
        message: 'clientUserId must match session client scope',
      }),
    ]),
  });
}

function idempotencyConflict(
  mutationKind: CreateBookingRequestDTO['mutationKind'] | SubmitOfflinePaymentProofDTO['mutationKind'],
  idempotencyKey: string,
  existingLabRecordId: string,
): ClientMutationIdempotencyConflictResult {
  return Object.freeze({
    status: 'IDEMPOTENCY_CONFLICT' as const,
    mutationKind,
    idempotencyKey,
    existingLabRecordId,
    message: 'idempotencyKey already used with a different payload',
  });
}

/**
 * Create lab client mutations adapter (in-memory persistence only).
 */
export function createClientMutationsAdapter(
  options: CreateClientMutationsAdapterInput = {},
): ClientMutationsAdapter {
  const idempotency = options.idempotencyStore ?? createLabIdempotencyStore();
  const records = new Map<string, LabMutationRecord>();
  const nowIso = options.nowIso ?? (() => new Date().toISOString());

  const adapter: ClientMutationsAdapter = {
    submitBookingRequest(input): ClientMutationResult {
      const validated = validateCreateBookingRequest(input.payload);
      if (!validated.ok) {
        return validated;
      }
      const dto = validated.dto;

      const auth = resolveSessionAuth(input.session, dto.mutationKind, dto.idempotencyKey);
      if (!('ok' in auth)) {
        return auth;
      }

      if (dto.clientUserId !== auth.clientUserId) {
        return scopeMismatch(dto.mutationKind, dto.idempotencyKey);
      }
      if (
        input.enforceClientUserId &&
        input.enforceClientUserId !== dto.clientUserId
      ) {
        return scopeMismatch(dto.mutationKind, dto.idempotencyKey);
      }

      const fingerprint = fingerprintCreateBookingRequest(dto);
      const lookup = idempotency.lookup({
        actorUserId: dto.clientUserId,
        mutationKind: dto.mutationKind,
        idempotencyKey: dto.idempotencyKey,
        payloadFingerprint: fingerprint,
      });

      if (lookup.hit) {
        if (lookup.samePayload) {
          return toClientMutationSuccessResult({
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
      const labRecordId = nextLabRecordId('booking');
      const record = mapCreateBookingRequestToLabRecord(dto, { labRecordId, acceptedAt });
      records.set(labRecordId, record);
      idempotency.put({
        scopeKey: idempotency.buildScopeKey({
          actorUserId: dto.clientUserId,
          mutationKind: dto.mutationKind,
          idempotencyKey: dto.idempotencyKey,
        }),
        actorUserId: dto.clientUserId,
        mutationKind: dto.mutationKind,
        idempotencyKey: dto.idempotencyKey,
        payloadFingerprint: fingerprint,
        labRecordId,
        acceptedAt,
      });

      return toClientMutationSuccessResult({
        mutationKind: dto.mutationKind,
        idempotencyKey: dto.idempotencyKey,
        acceptedAt,
        replayed: false,
        labRecordId,
      });
    },

    submitOfflinePaymentProof(input): ClientMutationResult {
      const validated = validateSubmitOfflinePaymentProof(input.payload);
      if (!validated.ok) {
        return validated;
      }
      const dto = validated.dto;

      const auth = resolveSessionAuth(input.session, dto.mutationKind, dto.idempotencyKey);
      if (!('ok' in auth)) {
        return auth;
      }

      if (dto.clientUserId !== auth.clientUserId) {
        return scopeMismatch(dto.mutationKind, dto.idempotencyKey);
      }
      if (
        input.enforceClientUserId &&
        input.enforceClientUserId !== dto.clientUserId
      ) {
        return scopeMismatch(dto.mutationKind, dto.idempotencyKey);
      }

      const fingerprint = fingerprintSubmitOfflinePaymentProof(dto);
      const lookup = idempotency.lookup({
        actorUserId: dto.clientUserId,
        mutationKind: dto.mutationKind,
        idempotencyKey: dto.idempotencyKey,
        payloadFingerprint: fingerprint,
      });

      if (lookup.hit) {
        if (lookup.samePayload) {
          return toClientMutationSuccessResult({
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
      const labRecordId = nextLabRecordId('payment');
      const record = mapSubmitOfflinePaymentProofToLabRecord(dto, {
        labRecordId,
        acceptedAt,
      });
      records.set(labRecordId, record);
      idempotency.put({
        scopeKey: idempotency.buildScopeKey({
          actorUserId: dto.clientUserId,
          mutationKind: dto.mutationKind,
          idempotencyKey: dto.idempotencyKey,
        }),
        actorUserId: dto.clientUserId,
        mutationKind: dto.mutationKind,
        idempotencyKey: dto.idempotencyKey,
        payloadFingerprint: fingerprint,
        labRecordId,
        acceptedAt,
      });

      return toClientMutationSuccessResult({
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

export function listClientMutationsAdapterWriteMethods(): readonly string[] {
  return Object.freeze([
    'submitBookingRequest',
    'submitOfflinePaymentProof',
    'getLabRecord',
    'listLabRecords',
    'getIdempotencyStore',
    'clearLabState',
  ]);
}
