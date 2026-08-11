/**
 * Client mutations mappers — pure (Writers Phase · Slice 1 · Paso 2).
 * Transform validated DTOs → lab mutation records. NO Supabase.
 */

import type {
  CreateBookingRequestDTO,
  SubmitOfflinePaymentProofDTO,
} from '../../types/client.mutations.types';
import {
  redactCreateBookingRequest,
  redactSubmitOfflinePaymentProof,
} from '../../types/client.mutations.types';

export type LabBookingRequestRecord = {
  readonly labRecordId: string;
  readonly kind: 'create_booking_request';
  readonly clientUserId: string;
  readonly idempotencyKey: string;
  readonly title: string;
  readonly eventDate: string;
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly locationLabel: string | null;
  readonly notes: string | null;
  readonly preferredArtistProfileId: string | null;
  readonly contactName: string | null;
  readonly contactEmail: string | null;
  readonly contactPhone: string | null;
  readonly acceptedAt: string;
  readonly status: 'accepted_lab';
};

export type LabOfflinePaymentProofRecord = {
  readonly labRecordId: string;
  readonly kind: 'submit_offline_payment_proof';
  readonly clientUserId: string;
  readonly idempotencyKey: string;
  readonly bookingId: string;
  readonly amountMinorUnits: number;
  readonly currencyCode: 'USD';
  readonly paymentMethod: SubmitOfflinePaymentProofDTO['paymentMethod'];
  readonly proofReference: string | null;
  readonly proofNotes: string | null;
  readonly paidAt: string | null;
  readonly acceptedAt: string;
  readonly status: 'accepted_lab';
};

export type LabMutationRecord = LabBookingRequestRecord | LabOfflinePaymentProofRecord;

/** Stable fingerprint for idempotency compare (order-independent field set). */
export function fingerprintCreateBookingRequest(dto: CreateBookingRequestDTO): string {
  const redacted = redactCreateBookingRequest(dto);
  return stableStringify({
    mutationKind: redacted.mutationKind,
    clientUserId: dto.clientUserId,
    title: dto.title,
    eventDate: dto.eventDate,
    startTime: dto.startTime,
    endTime: dto.endTime,
    locationLabel: dto.locationLabel,
    notes: dto.notes,
    preferredArtistProfileId: dto.preferredArtistProfileId,
    contactName: dto.contactName,
    contactEmail: dto.contactEmail,
    contactPhone: dto.contactPhone,
  });
}

export function fingerprintSubmitOfflinePaymentProof(
  dto: SubmitOfflinePaymentProofDTO,
): string {
  return stableStringify({
    mutationKind: dto.mutationKind,
    clientUserId: dto.clientUserId,
    bookingId: dto.bookingId,
    amountMinorUnits: dto.amountMinorUnits,
    currencyCode: dto.currencyCode,
    paymentMethod: dto.paymentMethod,
    proofReference: dto.proofReference,
    proofNotes: dto.proofNotes,
    paidAt: dto.paidAt,
  });
}

export function mapCreateBookingRequestToLabRecord(
  dto: CreateBookingRequestDTO,
  input: { readonly labRecordId: string; readonly acceptedAt: string },
): LabBookingRequestRecord {
  return Object.freeze({
    labRecordId: input.labRecordId,
    kind: 'create_booking_request',
    clientUserId: dto.clientUserId,
    idempotencyKey: dto.idempotencyKey,
    title: dto.title,
    eventDate: dto.eventDate,
    startTime: dto.startTime,
    endTime: dto.endTime,
    locationLabel: dto.locationLabel,
    notes: dto.notes,
    preferredArtistProfileId: dto.preferredArtistProfileId,
    contactName: dto.contactName,
    contactEmail: dto.contactEmail,
    contactPhone: dto.contactPhone,
    acceptedAt: input.acceptedAt,
    status: 'accepted_lab',
  });
}

export function mapSubmitOfflinePaymentProofToLabRecord(
  dto: SubmitOfflinePaymentProofDTO,
  input: { readonly labRecordId: string; readonly acceptedAt: string },
): LabOfflinePaymentProofRecord {
  return Object.freeze({
    labRecordId: input.labRecordId,
    kind: 'submit_offline_payment_proof',
    clientUserId: dto.clientUserId,
    idempotencyKey: dto.idempotencyKey,
    bookingId: dto.bookingId,
    amountMinorUnits: dto.amountMinorUnits,
    currencyCode: dto.currencyCode,
    paymentMethod: dto.paymentMethod,
    proofReference: dto.proofReference,
    proofNotes: dto.proofNotes,
    paidAt: dto.paidAt,
    acceptedAt: input.acceptedAt,
    status: 'accepted_lab',
  });
}

/** Export redactors for adapter logging surfaces. */
export { redactCreateBookingRequest, redactSubmitOfflinePaymentProof };

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

/** Deterministic-ish lab ids for tests (prefix + counter). Reset via resetLabRecordIdSequence. */
export function nextLabRecordId(prefix: string): string {
  labSeq += 1;
  return `lab_${prefix}_${String(labSeq).padStart(6, '0')}`;
}

export function resetLabRecordIdSequence(): void {
  labSeq = 0;
}
