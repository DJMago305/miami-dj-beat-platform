/**
 * Staff Mutations adapter — lab writers (Writers Phase · Slice 3 · Paso 2).
 * Session gate · existence checks · validation · idempotency · in-memory lab records.
 * NO productive database writers · NO Edge · NO V1 web/.
 */

import type { SessionContextDTO } from '../../types/session.types';
import type {
  AssignArtistToBookingDTO,
  ReviewOfflinePaymentDTO,
  StaffMutationIdempotencyConflictResult,
  StaffMutationResult,
  StaffMutationUnauthorizedResult,
} from '../../types/staff.mutations.types';
import {
  assertBookingFound,
  assertOfflinePaymentFound,
  assertStaffMutationAuthorized,
  toStaffMutationSuccessResult,
  validateAssignArtistToBooking,
  validateReviewOfflinePayment,
} from '../../types/staff.mutations.types';
import {
  fingerprintAssignArtistToBooking,
  fingerprintReviewOfflinePayment,
  mapAssignArtistToBookingToLabRecord,
  mapReviewOfflinePaymentToLabRecord,
  nextStaffLabRecordId,
  type LabStaffMutationRecord,
} from './staff-mutations.map-rows';
import {
  createLabIdempotencyStore,
  type LabIdempotencyStore,
} from '../client-mutations/lab-idempotency.store';

export type StaffMutationSessionInput = {
  readonly context: SessionContextDTO;
};

export type ReviewOfflinePaymentInput = {
  readonly payload: unknown;
  readonly session: StaffMutationSessionInput;
  /** When set, must equal session.context.userId (scope lock). */
  readonly enforceStaffUserId?: string | null;
  /**
   * Simulated payment existence. When omitted, uses adapter knownPaymentIds registry
   * (default: treat as found if registry not configured).
   */
  readonly paymentExists?: boolean;
};

export type AssignArtistToBookingInput = {
  readonly payload: unknown;
  readonly session: StaffMutationSessionInput;
  readonly enforceStaffUserId?: string | null;
  /** Simulated booking existence override. */
  readonly bookingExists?: boolean;
};

export type StaffMutationsAdapter = {
  readonly reviewOfflinePayment: (
    input: ReviewOfflinePaymentInput,
  ) => StaffMutationResult;
  readonly assignArtistToBooking: (
    input: AssignArtistToBookingInput,
  ) => StaffMutationResult;
  readonly seedLabPayment: (paymentId: string) => void;
  readonly seedLabBooking: (bookingId: string) => void;
  readonly getLabRecord: (labRecordId: string) => LabStaffMutationRecord | null;
  readonly listLabRecords: () => readonly LabStaffMutationRecord[];
  readonly getIdempotencyStore: () => LabIdempotencyStore;
  readonly clearLabState: () => void;
};

export type CreateStaffMutationsAdapterInput = {
  readonly idempotencyStore?: LabIdempotencyStore;
  readonly nowIso?: () => string;
  /**
   * When provided, payment ids not in the set → PAYMENT_NOT_FOUND.
   * When omitted, payments are treated as found unless `paymentExists: false` is passed.
   */
  readonly knownPaymentIds?: Iterable<string>;
  /**
   * When provided, booking ids not in the set → BOOKING_NOT_FOUND.
   * When omitted, bookings are treated as found unless `bookingExists: false` is passed.
   */
  readonly knownBookingIds?: Iterable<string>;
};

function resolveSessionAuth(
  session: StaffMutationSessionInput,
  mutationKind: ReviewOfflinePaymentDTO['mutationKind'] | AssignArtistToBookingDTO['mutationKind'],
  idempotencyKey: string | null,
): StaffMutationUnauthorizedResult | { readonly ok: true; readonly staffUserId: string } {
  const { context } = session;
  const auth = assertStaffMutationAuthorized({
    sessionRole: context.sessionRole,
    staffUserId: context.userId,
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
      reason: 'missing_staff_scope' as const,
    });
  }
  return Object.freeze({ ok: true as const, staffUserId: context.userId });
}

function scopeMismatch(
  mutationKind: ReviewOfflinePaymentDTO['mutationKind'] | AssignArtistToBookingDTO['mutationKind'],
  idempotencyKey: string,
): StaffMutationResult {
  return Object.freeze({
    ok: false as const,
    status: 'VALIDATION_ERROR' as const,
    mutationKind,
    idempotencyKey,
    issues: Object.freeze([
      Object.freeze({
        field: 'staffUserId',
        code: 'scope_mismatch' as const,
        message: 'staffUserId must match session staff scope',
      }),
    ]),
  });
}

function idempotencyConflict(
  mutationKind: ReviewOfflinePaymentDTO['mutationKind'] | AssignArtistToBookingDTO['mutationKind'],
  idempotencyKey: string,
  existingLabRecordId: string,
): StaffMutationIdempotencyConflictResult {
  return Object.freeze({
    status: 'IDEMPOTENCY_CONFLICT' as const,
    mutationKind,
    idempotencyKey,
    existingLabRecordId,
    message: 'idempotencyKey already used with a different payload',
  });
}

/**
 * Create lab staff mutations adapter (in-memory persistence only).
 */
export function createStaffMutationsAdapter(
  options: CreateStaffMutationsAdapterInput = {},
): StaffMutationsAdapter {
  const idempotency = options.idempotencyStore ?? createLabIdempotencyStore();
  const records = new Map<string, LabStaffMutationRecord>();
  const nowIso = options.nowIso ?? (() => new Date().toISOString());
  const knownPayments =
    options.knownPaymentIds != null ? new Set(options.knownPaymentIds) : null;
  const knownBookings =
    options.knownBookingIds != null ? new Set(options.knownBookingIds) : null;

  const resolvePaymentFound = (
    paymentId: string,
    override?: boolean,
  ): boolean => {
    if (typeof override === 'boolean') return override;
    if (knownPayments) return knownPayments.has(paymentId);
    return true;
  };

  const resolveBookingFound = (
    bookingId: string,
    override?: boolean,
  ): boolean => {
    if (typeof override === 'boolean') return override;
    if (knownBookings) return knownBookings.has(bookingId);
    return true;
  };

  const adapter: StaffMutationsAdapter = {
    reviewOfflinePayment(input): StaffMutationResult {
      const validated = validateReviewOfflinePayment(input.payload);
      if (!validated.ok) {
        return validated;
      }
      const dto = validated.dto;

      const auth = resolveSessionAuth(input.session, dto.mutationKind, dto.idempotencyKey);
      if (!('ok' in auth)) {
        return auth;
      }

      if (dto.staffUserId !== auth.staffUserId) {
        return scopeMismatch(dto.mutationKind, dto.idempotencyKey);
      }
      if (
        input.enforceStaffUserId &&
        input.enforceStaffUserId !== dto.staffUserId
      ) {
        return scopeMismatch(dto.mutationKind, dto.idempotencyKey);
      }

      const paymentGate = assertOfflinePaymentFound({
        paymentId: dto.paymentId,
        found: resolvePaymentFound(dto.paymentId, input.paymentExists),
        mutationKind: dto.mutationKind,
        idempotencyKey: dto.idempotencyKey,
      });
      if (!('ok' in paymentGate)) {
        return paymentGate;
      }

      const fingerprint = fingerprintReviewOfflinePayment(dto);
      const lookup = idempotency.lookup({
        actorUserId: dto.staffUserId,
        mutationKind: dto.mutationKind,
        idempotencyKey: dto.idempotencyKey,
        payloadFingerprint: fingerprint,
      });

      if (lookup.hit) {
        if (lookup.samePayload) {
          return toStaffMutationSuccessResult({
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
      const labRecordId = nextStaffLabRecordId('payment_review');
      const record = mapReviewOfflinePaymentToLabRecord(dto, { labRecordId, acceptedAt });
      records.set(labRecordId, record);
      idempotency.put({
        scopeKey: idempotency.buildScopeKey({
          actorUserId: dto.staffUserId,
          mutationKind: dto.mutationKind,
          idempotencyKey: dto.idempotencyKey,
        }),
        actorUserId: dto.staffUserId,
        mutationKind: dto.mutationKind,
        idempotencyKey: dto.idempotencyKey,
        payloadFingerprint: fingerprint,
        labRecordId,
        acceptedAt,
      });

      return toStaffMutationSuccessResult({
        mutationKind: dto.mutationKind,
        idempotencyKey: dto.idempotencyKey,
        acceptedAt,
        replayed: false,
        labRecordId,
      });
    },

    assignArtistToBooking(input): StaffMutationResult {
      const validated = validateAssignArtistToBooking(input.payload);
      if (!validated.ok) {
        return validated;
      }
      const dto = validated.dto;

      const auth = resolveSessionAuth(input.session, dto.mutationKind, dto.idempotencyKey);
      if (!('ok' in auth)) {
        return auth;
      }

      if (dto.staffUserId !== auth.staffUserId) {
        return scopeMismatch(dto.mutationKind, dto.idempotencyKey);
      }
      if (
        input.enforceStaffUserId &&
        input.enforceStaffUserId !== dto.staffUserId
      ) {
        return scopeMismatch(dto.mutationKind, dto.idempotencyKey);
      }

      const bookingGate = assertBookingFound({
        bookingId: dto.bookingId,
        found: resolveBookingFound(dto.bookingId, input.bookingExists),
        mutationKind: dto.mutationKind,
        idempotencyKey: dto.idempotencyKey,
      });
      if (!('ok' in bookingGate)) {
        return bookingGate;
      }

      const fingerprint = fingerprintAssignArtistToBooking(dto);
      const lookup = idempotency.lookup({
        actorUserId: dto.staffUserId,
        mutationKind: dto.mutationKind,
        idempotencyKey: dto.idempotencyKey,
        payloadFingerprint: fingerprint,
      });

      if (lookup.hit) {
        if (lookup.samePayload) {
          return toStaffMutationSuccessResult({
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
      const labRecordId = nextStaffLabRecordId('assign');
      const record = mapAssignArtistToBookingToLabRecord(dto, { labRecordId, acceptedAt });
      records.set(labRecordId, record);
      idempotency.put({
        scopeKey: idempotency.buildScopeKey({
          actorUserId: dto.staffUserId,
          mutationKind: dto.mutationKind,
          idempotencyKey: dto.idempotencyKey,
        }),
        actorUserId: dto.staffUserId,
        mutationKind: dto.mutationKind,
        idempotencyKey: dto.idempotencyKey,
        payloadFingerprint: fingerprint,
        labRecordId,
        acceptedAt,
      });

      return toStaffMutationSuccessResult({
        mutationKind: dto.mutationKind,
        idempotencyKey: dto.idempotencyKey,
        acceptedAt,
        replayed: false,
        labRecordId,
      });
    },

    seedLabPayment(paymentId) {
      if (!knownPayments) {
        throw new Error(
          'MOD-301-MUT: seedLabPayment requires knownPaymentIds at adapter create',
        );
      }
      knownPayments.add(paymentId);
    },

    seedLabBooking(bookingId) {
      if (!knownBookings) {
        throw new Error(
          'MOD-301-MUT: seedLabBooking requires knownBookingIds at adapter create',
        );
      }
      knownBookings.add(bookingId);
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
      knownPayments?.clear();
      knownBookings?.clear();
    },
  };

  return adapter;
}

export function listStaffMutationsAdapterWriteMethods(): readonly string[] {
  return Object.freeze([
    'reviewOfflinePayment',
    'assignArtistToBooking',
    'seedLabPayment',
    'seedLabBooking',
    'getLabRecord',
    'listLabRecords',
    'getIdempotencyStore',
    'clearLabState',
  ]);
}
