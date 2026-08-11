/**
 * Staff Mutations V2 — Write contracts (Writers Phase · Slice 3 · Paso 1).
 * Canonical matrix: docs/V2/STAFF-MUTATIONS-MATRIX.md
 *
 * CONTRACTS ONLY: pure validators / DTO shapes.
 * NO supabase.from().insert|update · NO Edge deploy · NO V1 web/ · NO commit.
 * Lab only: http://localhost:5173
 *
 * Orthogonal to sealed Read Models · Client/Artist writers · session-wiring.
 */

/** Mutation outcome kinds for staff writers (lab + future adapters). */
export type StaffMutationResultStatus =
  | 'SUCCESS'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED_ROLE'
  | 'PAYMENT_NOT_FOUND'
  | 'BOOKING_NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT';

/** Staff mutation family ids (matrix registry). */
export type StaffMutationKind = 'review_offline_payment' | 'assign_artist_to_booking';

/** Offline payment review decision. */
export type OfflinePaymentReviewDecision = 'APPROVE' | 'REJECT';

/** Payload size / field limits — enforced by pure validators. */
export const STAFF_MUTATION_PAYLOAD_LIMITS = Object.freeze({
  maxPayloadChars: 8_192,
  notesMax: 500,
  rejectionReasonMax: 500,
  paymentIdMax: 120,
  bookingIdMax: 120,
  artistUserIdMax: 120,
  idempotencyKeyMax: 64,
  idempotencyKeyMin: 8,
  idempotencyKeyPattern: /^[A-Za-z0-9_-]+$/,
  decisions: Object.freeze(['APPROVE', 'REJECT'] as const),
} as const);

export type StaffMutationPayloadLimits = typeof STAFF_MUTATION_PAYLOAD_LIMITS;

/**
 * ReviewOfflinePaymentDTO — staff approves or rejects an offline payment proof.
 */
export type ReviewOfflinePaymentDTO = {
  readonly mutationKind: 'review_offline_payment';
  /** Must match session staff scope when adapter runs. */
  readonly staffUserId: string;
  readonly idempotencyKey: string;
  /** Target payment proof / receipt id. */
  readonly paymentId: string;
  readonly decision: OfflinePaymentReviewDecision;
  /** Required when decision === REJECT. */
  readonly rejectionReason: string | null;
  /** Optional reviewer notes (APPROVE or REJECT). */
  readonly reviewNotes: string | null;
};

/**
 * AssignArtistToBookingDTO — staff assigns / reassigns a DJ to a booking.
 */
export type AssignArtistToBookingDTO = {
  readonly mutationKind: 'assign_artist_to_booking';
  readonly staffUserId: string;
  readonly idempotencyKey: string;
  readonly bookingId: string;
  /** DJ user id to set as assigned_dj_id. */
  readonly artistUserId: string;
  readonly notes: string | null;
  /** When true (default), reassignment of an existing DJ is allowed in lab. */
  readonly replaceExisting: boolean;
};

export type StaffMutationRequestDTO = ReviewOfflinePaymentDTO | AssignArtistToBookingDTO;

export type StaffMutationValidationIssue = {
  readonly field: string;
  readonly code:
    | 'required'
    | 'too_long'
    | 'too_short'
    | 'invalid_format'
    | 'out_of_range'
    | 'payload_too_large'
    | 'forbidden_role'
    | 'scope_mismatch'
    | 'invalid_decision'
    | 'reject_reason_required';
  readonly message: string;
};

export type StaffMutationSuccessResult = {
  readonly status: 'SUCCESS';
  readonly mutationKind: StaffMutationKind;
  readonly idempotencyKey: string;
  readonly acceptedAt: string;
  readonly replayed: boolean;
  /** Simulated lab record id (not a Supabase row). */
  readonly labRecordId: string;
};

export type StaffMutationValidationErrorResult = {
  readonly ok: false;
  readonly status: 'VALIDATION_ERROR';
  readonly mutationKind: StaffMutationKind | null;
  readonly idempotencyKey: string | null;
  readonly issues: readonly StaffMutationValidationIssue[];
};

export type StaffMutationUnauthorizedResult = {
  readonly status: 'UNAUTHORIZED_ROLE';
  readonly mutationKind: StaffMutationKind | null;
  readonly idempotencyKey: string | null;
  readonly reason: 'role_not_staff' | 'missing_staff_scope' | 'anonymous' | 'expired';
};

export type StaffMutationPaymentNotFoundResult = {
  readonly status: 'PAYMENT_NOT_FOUND';
  readonly mutationKind: StaffMutationKind | null;
  readonly idempotencyKey: string | null;
  readonly paymentId: string | null;
  readonly reason: 'missing_payment_id' | 'payment_absent';
};

export type StaffMutationBookingNotFoundResult = {
  readonly status: 'BOOKING_NOT_FOUND';
  readonly mutationKind: StaffMutationKind | null;
  readonly idempotencyKey: string | null;
  readonly bookingId: string | null;
  readonly reason: 'missing_booking_id' | 'booking_absent';
};

export type StaffMutationIdempotencyConflictResult = {
  readonly status: 'IDEMPOTENCY_CONFLICT';
  readonly mutationKind: StaffMutationKind;
  readonly idempotencyKey: string;
  readonly existingLabRecordId: string;
  readonly message: string;
};

export type StaffMutationResult =
  | StaffMutationSuccessResult
  | StaffMutationValidationErrorResult
  | StaffMutationUnauthorizedResult
  | StaffMutationPaymentNotFoundResult
  | StaffMutationBookingNotFoundResult
  | StaffMutationIdempotencyConflictResult;

/** Redacted projection safe for logs / UI diagnostics. */
export type ReviewOfflinePaymentRedactedDTO = {
  readonly mutationKind: 'review_offline_payment';
  readonly staffUserIdMasked: string;
  readonly idempotencyKey: string;
  readonly paymentId: string;
  readonly decision: OfflinePaymentReviewDecision;
  readonly hasRejectionReason: boolean;
  readonly hasReviewNotes: boolean;
};

export type AssignArtistToBookingRedactedDTO = {
  readonly mutationKind: 'assign_artist_to_booking';
  readonly staffUserIdMasked: string;
  readonly artistUserIdMasked: string;
  readonly idempotencyKey: string;
  readonly bookingId: string;
  readonly hasNotes: boolean;
  readonly replaceExisting: boolean;
};

// ─── Pure helpers (no I/O) ───────────────────────────────────────────────────

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function maskStaffMutationUserId(userId: string | null | undefined): string {
  const id = userId?.trim() ?? '';
  if (!id) return '(none)';
  if (id.length <= 8) return `${id.slice(0, 2)}…`;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function estimatePayloadChars(payload: unknown): number {
  try {
    return JSON.stringify(payload)?.length ?? Number.MAX_SAFE_INTEGER;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function pushIssue(
  issues: StaffMutationValidationIssue[],
  field: string,
  code: StaffMutationValidationIssue['code'],
  message: string,
): void {
  issues.push(Object.freeze({ field, code, message }));
}

/**
 * Sanitize free-text: trim, collapse whitespace, strip control chars.
 */
export function sanitizeStaffMutationText(
  value: string | null | undefined,
  options?: { readonly allowNewlines?: boolean },
): string | null {
  if (value == null) return null;
  let text = String(value);
  if (options?.allowNewlines) {
    text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  } else {
    text = text.replace(/[\u0000-\u001F\u007F]/g, '');
  }
  text = text.replace(/\s+/g, ' ').trim();
  return text.length > 0 ? text : null;
}

export function redactReviewOfflinePayment(
  dto: ReviewOfflinePaymentDTO,
): ReviewOfflinePaymentRedactedDTO {
  return Object.freeze({
    mutationKind: 'review_offline_payment',
    staffUserIdMasked: maskStaffMutationUserId(dto.staffUserId),
    idempotencyKey: dto.idempotencyKey,
    paymentId: dto.paymentId,
    decision: dto.decision,
    hasRejectionReason: Boolean(dto.rejectionReason),
    hasReviewNotes: Boolean(dto.reviewNotes),
  });
}

export function redactAssignArtistToBooking(
  dto: AssignArtistToBookingDTO,
): AssignArtistToBookingRedactedDTO {
  return Object.freeze({
    mutationKind: 'assign_artist_to_booking',
    staffUserIdMasked: maskStaffMutationUserId(dto.staffUserId),
    artistUserIdMasked: maskStaffMutationUserId(dto.artistUserId),
    idempotencyKey: dto.idempotencyKey,
    bookingId: dto.bookingId,
    hasNotes: Boolean(dto.notes),
    replaceExisting: dto.replaceExisting,
  });
}

function validateIdempotencyKey(
  key: string | null | undefined,
  issues: StaffMutationValidationIssue[],
): string | null {
  const limits = STAFF_MUTATION_PAYLOAD_LIMITS;
  const value = asTrimmedString(key);
  if (!value) {
    pushIssue(issues, 'idempotencyKey', 'required', 'idempotencyKey is required');
    return null;
  }
  if (value.length < limits.idempotencyKeyMin) {
    pushIssue(issues, 'idempotencyKey', 'too_short', 'idempotencyKey is too short');
  }
  if (value.length > limits.idempotencyKeyMax) {
    pushIssue(issues, 'idempotencyKey', 'too_long', 'idempotencyKey exceeds max length');
  }
  if (!limits.idempotencyKeyPattern.test(value)) {
    pushIssue(
      issues,
      'idempotencyKey',
      'invalid_format',
      'idempotencyKey must be alphanumeric with _ or -',
    );
  }
  return value;
}

/**
 * Pure validation for ReviewOfflinePaymentDTO.
 */
export function validateReviewOfflinePayment(
  input: unknown,
):
  | StaffMutationValidationErrorResult
  | { readonly ok: true; readonly dto: ReviewOfflinePaymentDTO } {
  const limits = STAFF_MUTATION_PAYLOAD_LIMITS;
  const issues: StaffMutationValidationIssue[] = [];

  if (estimatePayloadChars(input) > limits.maxPayloadChars) {
    pushIssue(issues, '$', 'payload_too_large', 'Payload exceeds max size');
    return Object.freeze({
      ok: false as const,
      status: 'VALIDATION_ERROR' as const,
      mutationKind: 'review_offline_payment',
      idempotencyKey: null,
      issues: Object.freeze(issues),
    });
  }

  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const idempotencyKey = validateIdempotencyKey(
    typeof raw.idempotencyKey === 'string' ? raw.idempotencyKey : null,
    issues,
  );

  const staffUserId = asTrimmedString(raw.staffUserId);
  if (!staffUserId) {
    pushIssue(issues, 'staffUserId', 'required', 'staffUserId is required');
  }

  const paymentId = asTrimmedString(raw.paymentId);
  if (!paymentId) {
    pushIssue(issues, 'paymentId', 'required', 'paymentId is required');
  } else if (paymentId.length > limits.paymentIdMax) {
    pushIssue(issues, 'paymentId', 'too_long', 'paymentId exceeds max length');
  }

  const decisionRaw = asTrimmedString(raw.decision)?.toUpperCase() ?? null;
  let decision: OfflinePaymentReviewDecision | null = null;
  if (!decisionRaw) {
    pushIssue(issues, 'decision', 'required', 'decision is required');
  } else if (decisionRaw !== 'APPROVE' && decisionRaw !== 'REJECT') {
    pushIssue(
      issues,
      'decision',
      'invalid_decision',
      'decision must be APPROVE or REJECT',
    );
  } else {
    decision = decisionRaw;
  }

  const rejectionReason = sanitizeStaffMutationText(
    typeof raw.rejectionReason === 'string' ? raw.rejectionReason : null,
    { allowNewlines: true },
  );
  if (decision === 'REJECT' && !rejectionReason) {
    pushIssue(
      issues,
      'rejectionReason',
      'reject_reason_required',
      'rejectionReason is required when rejecting',
    );
  }
  if (rejectionReason && rejectionReason.length > limits.rejectionReasonMax) {
    pushIssue(issues, 'rejectionReason', 'too_long', 'rejectionReason exceeds max length');
  }

  const reviewNotes = sanitizeStaffMutationText(
    typeof raw.reviewNotes === 'string' ? raw.reviewNotes : null,
    { allowNewlines: true },
  );
  if (reviewNotes && reviewNotes.length > limits.notesMax) {
    pushIssue(issues, 'reviewNotes', 'too_long', 'reviewNotes exceeds max length');
  }

  if (issues.length > 0) {
    return Object.freeze({
      ok: false as const,
      status: 'VALIDATION_ERROR' as const,
      mutationKind: 'review_offline_payment',
      idempotencyKey,
      issues: Object.freeze(issues),
    });
  }

  const dto: ReviewOfflinePaymentDTO = Object.freeze({
    mutationKind: 'review_offline_payment',
    staffUserId: staffUserId as string,
    idempotencyKey: idempotencyKey as string,
    paymentId: paymentId as string,
    decision: decision as OfflinePaymentReviewDecision,
    rejectionReason: decision === 'REJECT' ? rejectionReason : null,
    reviewNotes,
  });

  return Object.freeze({ ok: true as const, dto });
}

/**
 * Pure validation for AssignArtistToBookingDTO.
 */
export function validateAssignArtistToBooking(
  input: unknown,
):
  | StaffMutationValidationErrorResult
  | { readonly ok: true; readonly dto: AssignArtistToBookingDTO } {
  const limits = STAFF_MUTATION_PAYLOAD_LIMITS;
  const issues: StaffMutationValidationIssue[] = [];

  if (estimatePayloadChars(input) > limits.maxPayloadChars) {
    pushIssue(issues, '$', 'payload_too_large', 'Payload exceeds max size');
    return Object.freeze({
      ok: false as const,
      status: 'VALIDATION_ERROR' as const,
      mutationKind: 'assign_artist_to_booking',
      idempotencyKey: null,
      issues: Object.freeze(issues),
    });
  }

  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const idempotencyKey = validateIdempotencyKey(
    typeof raw.idempotencyKey === 'string' ? raw.idempotencyKey : null,
    issues,
  );

  const staffUserId = asTrimmedString(raw.staffUserId);
  if (!staffUserId) {
    pushIssue(issues, 'staffUserId', 'required', 'staffUserId is required');
  }

  const bookingId = asTrimmedString(raw.bookingId);
  if (!bookingId) {
    pushIssue(issues, 'bookingId', 'required', 'bookingId is required');
  } else if (bookingId.length > limits.bookingIdMax) {
    pushIssue(issues, 'bookingId', 'too_long', 'bookingId exceeds max length');
  }

  const artistUserId = asTrimmedString(raw.artistUserId);
  if (!artistUserId) {
    pushIssue(issues, 'artistUserId', 'required', 'artistUserId is required');
  } else if (artistUserId.length > limits.artistUserIdMax) {
    pushIssue(issues, 'artistUserId', 'too_long', 'artistUserId exceeds max length');
  }

  const notes = sanitizeStaffMutationText(
    typeof raw.notes === 'string' ? raw.notes : null,
    { allowNewlines: true },
  );
  if (notes && notes.length > limits.notesMax) {
    pushIssue(issues, 'notes', 'too_long', 'notes exceeds max length');
  }

  let replaceExisting = true;
  if (raw.replaceExisting !== undefined && raw.replaceExisting !== null) {
    if (typeof raw.replaceExisting !== 'boolean') {
      pushIssue(
        issues,
        'replaceExisting',
        'invalid_format',
        'replaceExisting must be a boolean',
      );
    } else {
      replaceExisting = raw.replaceExisting;
    }
  }

  if (issues.length > 0) {
    return Object.freeze({
      ok: false as const,
      status: 'VALIDATION_ERROR' as const,
      mutationKind: 'assign_artist_to_booking',
      idempotencyKey,
      issues: Object.freeze(issues),
    });
  }

  const dto: AssignArtistToBookingDTO = Object.freeze({
    mutationKind: 'assign_artist_to_booking',
    staffUserId: staffUserId as string,
    idempotencyKey: idempotencyKey as string,
    bookingId: bookingId as string,
    artistUserId: artistUserId as string,
    notes,
    replaceExisting,
  });

  return Object.freeze({ ok: true as const, dto });
}

/**
 * Role gate for staff mutations (pure). Accepts `staff` and `staff_seller`.
 */
export function assertStaffMutationAuthorized(input: {
  readonly sessionRole: string | null | undefined;
  readonly staffUserId: string | null | undefined;
  readonly isAnonymous?: boolean;
  readonly isExpired?: boolean;
  readonly mutationKind?: StaffMutationKind | null;
  readonly idempotencyKey?: string | null;
}): StaffMutationUnauthorizedResult | { readonly ok: true } {
  if (input.isExpired) {
    return Object.freeze({
      status: 'UNAUTHORIZED_ROLE' as const,
      mutationKind: input.mutationKind ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      reason: 'expired' as const,
    });
  }
  if (input.isAnonymous) {
    return Object.freeze({
      status: 'UNAUTHORIZED_ROLE' as const,
      mutationKind: input.mutationKind ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      reason: 'anonymous' as const,
    });
  }
  if (!input.staffUserId) {
    return Object.freeze({
      status: 'UNAUTHORIZED_ROLE' as const,
      mutationKind: input.mutationKind ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      reason: 'missing_staff_scope' as const,
    });
  }
  if (input.sessionRole !== 'staff' && input.sessionRole !== 'staff_seller') {
    return Object.freeze({
      status: 'UNAUTHORIZED_ROLE' as const,
      mutationKind: input.mutationKind ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      reason: 'role_not_staff' as const,
    });
  }
  return Object.freeze({ ok: true as const });
}

/**
 * Payment existence gate — adapter supplies `found` from lab fixture lookup.
 */
export function assertOfflinePaymentFound(input: {
  readonly paymentId: string | null | undefined;
  readonly found: boolean;
  readonly mutationKind?: StaffMutationKind | null;
  readonly idempotencyKey?: string | null;
}): StaffMutationPaymentNotFoundResult | { readonly ok: true } {
  const paymentId = asTrimmedString(input.paymentId);
  if (!paymentId) {
    return Object.freeze({
      status: 'PAYMENT_NOT_FOUND' as const,
      mutationKind: input.mutationKind ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      paymentId: null,
      reason: 'missing_payment_id' as const,
    });
  }
  if (!input.found) {
    return Object.freeze({
      status: 'PAYMENT_NOT_FOUND' as const,
      mutationKind: input.mutationKind ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      paymentId,
      reason: 'payment_absent' as const,
    });
  }
  return Object.freeze({ ok: true as const });
}

/**
 * Booking existence gate — adapter supplies `found` from lab fixture lookup.
 */
export function assertBookingFound(input: {
  readonly bookingId: string | null | undefined;
  readonly found: boolean;
  readonly mutationKind?: StaffMutationKind | null;
  readonly idempotencyKey?: string | null;
}): StaffMutationBookingNotFoundResult | { readonly ok: true } {
  const bookingId = asTrimmedString(input.bookingId);
  if (!bookingId) {
    return Object.freeze({
      status: 'BOOKING_NOT_FOUND' as const,
      mutationKind: input.mutationKind ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      bookingId: null,
      reason: 'missing_booking_id' as const,
    });
  }
  if (!input.found) {
    return Object.freeze({
      status: 'BOOKING_NOT_FOUND' as const,
      mutationKind: input.mutationKind ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      bookingId,
      reason: 'booking_absent' as const,
    });
  }
  return Object.freeze({ ok: true as const });
}

/**
 * Build SUCCESS envelope (lab). `replayed=true` when idempotent replay detected by future store.
 */
export function toStaffMutationSuccessResult(input: {
  readonly mutationKind: StaffMutationKind;
  readonly idempotencyKey: string;
  readonly acceptedAt?: string;
  readonly replayed?: boolean;
  readonly labRecordId: string;
}): StaffMutationSuccessResult {
  return Object.freeze({
    status: 'SUCCESS' as const,
    mutationKind: input.mutationKind,
    idempotencyKey: input.idempotencyKey,
    acceptedAt: input.acceptedAt ?? new Date().toISOString(),
    replayed: input.replayed ?? false,
    labRecordId: input.labRecordId,
  });
}
