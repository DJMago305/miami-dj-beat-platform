/**
 * Artist mutations mappers — pure (Writers Phase · Slice 2 · Paso 2).
 * Transform validated DTOs → lab mutation records. NO Supabase.
 */

import type {
  AcknowledgePayoutDTO,
  RespondGigAssignmentDTO,
} from '../../types/artist.mutations.types';
import {
  redactAcknowledgePayout,
  redactRespondGigAssignment,
} from '../../types/artist.mutations.types';

export type LabGigAssignmentRecord = {
  readonly labRecordId: string;
  readonly kind: 'respond_gig_assignment';
  readonly artistUserId: string;
  readonly assignedDjId: string;
  readonly idempotencyKey: string;
  readonly bookingId: string;
  readonly decision: RespondGigAssignmentDTO['decision'];
  readonly rejectionNotes: string | null;
  readonly responseNotes: string | null;
  readonly acceptedAt: string;
  readonly status: 'accepted_lab' | 'declined_lab';
};

export type LabPayoutAckRecord = {
  readonly labRecordId: string;
  readonly kind: 'acknowledge_payout';
  readonly artistUserId: string;
  readonly assignedDjId: string | null;
  readonly idempotencyKey: string;
  readonly payoutId: string;
  readonly acknowledged: true;
  readonly feedback: string | null;
  readonly acceptedAt: string;
  readonly status: 'acknowledged_lab';
};

export type LabArtistMutationRecord = LabGigAssignmentRecord | LabPayoutAckRecord;

/** Stable fingerprint for idempotency compare. */
export function fingerprintRespondGigAssignment(dto: RespondGigAssignmentDTO): string {
  const redacted = redactRespondGigAssignment(dto);
  return stableStringify({
    mutationKind: redacted.mutationKind,
    artistUserId: dto.artistUserId,
    assignedDjId: dto.assignedDjId,
    bookingId: dto.bookingId,
    decision: dto.decision,
    rejectionNotes: dto.rejectionNotes,
    responseNotes: dto.responseNotes,
  });
}

export function fingerprintAcknowledgePayout(dto: AcknowledgePayoutDTO): string {
  return stableStringify({
    mutationKind: dto.mutationKind,
    artistUserId: dto.artistUserId,
    assignedDjId: dto.assignedDjId,
    payoutId: dto.payoutId,
    acknowledged: dto.acknowledged,
    feedback: dto.feedback,
  });
}

export function mapRespondGigAssignmentToLabRecord(
  dto: RespondGigAssignmentDTO,
  input: { readonly labRecordId: string; readonly acceptedAt: string },
): LabGigAssignmentRecord {
  return Object.freeze({
    labRecordId: input.labRecordId,
    kind: 'respond_gig_assignment',
    artistUserId: dto.artistUserId,
    assignedDjId: dto.assignedDjId,
    idempotencyKey: dto.idempotencyKey,
    bookingId: dto.bookingId,
    decision: dto.decision,
    rejectionNotes: dto.rejectionNotes,
    responseNotes: dto.responseNotes,
    acceptedAt: input.acceptedAt,
    status: dto.decision === 'ACCEPT' ? 'accepted_lab' : 'declined_lab',
  });
}

export function mapAcknowledgePayoutToLabRecord(
  dto: AcknowledgePayoutDTO,
  input: { readonly labRecordId: string; readonly acceptedAt: string },
): LabPayoutAckRecord {
  return Object.freeze({
    labRecordId: input.labRecordId,
    kind: 'acknowledge_payout',
    artistUserId: dto.artistUserId,
    assignedDjId: dto.assignedDjId,
    idempotencyKey: dto.idempotencyKey,
    payoutId: dto.payoutId,
    acknowledged: true as const,
    feedback: dto.feedback,
    acceptedAt: input.acceptedAt,
    status: 'acknowledged_lab',
  });
}

/** Export redactors for adapter logging surfaces. */
export { redactAcknowledgePayout, redactRespondGigAssignment };

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
export function nextArtistLabRecordId(prefix: string): string {
  labSeq += 1;
  return `lab_${prefix}_${String(labSeq).padStart(6, '0')}`;
}

export function resetArtistLabRecordIdSequence(): void {
  labSeq = 0;
}
