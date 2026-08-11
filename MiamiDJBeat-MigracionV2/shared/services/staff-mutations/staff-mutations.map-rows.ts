/**
 * Staff mutations mappers — pure (Writers Phase · Slice 3 · Paso 2).
 * Transform validated DTOs → lab mutation records. NO Supabase.
 */

import type {
  AssignArtistToBookingDTO,
  ReviewOfflinePaymentDTO,
} from '../../types/staff.mutations.types';
import {
  redactAssignArtistToBooking,
  redactReviewOfflinePayment,
} from '../../types/staff.mutations.types';

export type LabOfflinePaymentReviewRecord = {
  readonly labRecordId: string;
  readonly kind: 'review_offline_payment';
  readonly staffUserId: string;
  readonly idempotencyKey: string;
  readonly paymentId: string;
  readonly decision: ReviewOfflinePaymentDTO['decision'];
  readonly rejectionReason: string | null;
  readonly reviewNotes: string | null;
  readonly acceptedAt: string;
  readonly status: 'approved_lab' | 'rejected_lab';
};

export type LabArtistAssignmentRecord = {
  readonly labRecordId: string;
  readonly kind: 'assign_artist_to_booking';
  readonly staffUserId: string;
  readonly idempotencyKey: string;
  readonly bookingId: string;
  readonly artistUserId: string;
  readonly notes: string | null;
  readonly replaceExisting: boolean;
  readonly acceptedAt: string;
  readonly status: 'assigned_lab';
};

export type LabStaffMutationRecord =
  | LabOfflinePaymentReviewRecord
  | LabArtistAssignmentRecord;

/** Stable fingerprint for idempotency compare. */
export function fingerprintReviewOfflinePayment(dto: ReviewOfflinePaymentDTO): string {
  const redacted = redactReviewOfflinePayment(dto);
  return stableStringify({
    mutationKind: redacted.mutationKind,
    staffUserId: dto.staffUserId,
    paymentId: dto.paymentId,
    decision: dto.decision,
    rejectionReason: dto.rejectionReason,
    reviewNotes: dto.reviewNotes,
  });
}

export function fingerprintAssignArtistToBooking(dto: AssignArtistToBookingDTO): string {
  return stableStringify({
    mutationKind: dto.mutationKind,
    staffUserId: dto.staffUserId,
    bookingId: dto.bookingId,
    artistUserId: dto.artistUserId,
    notes: dto.notes,
    replaceExisting: dto.replaceExisting,
  });
}

export function mapReviewOfflinePaymentToLabRecord(
  dto: ReviewOfflinePaymentDTO,
  input: { readonly labRecordId: string; readonly acceptedAt: string },
): LabOfflinePaymentReviewRecord {
  return Object.freeze({
    labRecordId: input.labRecordId,
    kind: 'review_offline_payment',
    staffUserId: dto.staffUserId,
    idempotencyKey: dto.idempotencyKey,
    paymentId: dto.paymentId,
    decision: dto.decision,
    rejectionReason: dto.rejectionReason,
    reviewNotes: dto.reviewNotes,
    acceptedAt: input.acceptedAt,
    status: dto.decision === 'APPROVE' ? 'approved_lab' : 'rejected_lab',
  });
}

export function mapAssignArtistToBookingToLabRecord(
  dto: AssignArtistToBookingDTO,
  input: { readonly labRecordId: string; readonly acceptedAt: string },
): LabArtistAssignmentRecord {
  return Object.freeze({
    labRecordId: input.labRecordId,
    kind: 'assign_artist_to_booking',
    staffUserId: dto.staffUserId,
    idempotencyKey: dto.idempotencyKey,
    bookingId: dto.bookingId,
    artistUserId: dto.artistUserId,
    notes: dto.notes,
    replaceExisting: dto.replaceExisting,
    acceptedAt: input.acceptedAt,
    status: 'assigned_lab',
  });
}

/** Export redactors for adapter logging surfaces. */
export { redactAssignArtistToBooking, redactReviewOfflinePayment };

function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const out: Record<string, unknown> = {};
    for (const [key, nested] of entries) {
      out[key] = sortKeys(nested);
    }
    return out;
  }
  return value;
}

let labSeq = 0;

/** Deterministic-ish lab ids for tests (prefix + counter). */
export function nextStaffLabRecordId(prefix: string): string {
  labSeq += 1;
  return `lab_${prefix}_${String(labSeq).padStart(6, '0')}`;
}

export function resetStaffLabRecordIdSequence(): void {
  labSeq = 0;
}
