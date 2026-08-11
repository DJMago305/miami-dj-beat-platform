/**
 * Artist Mutations V2 — Write contracts (Writers Phase · Slice 2 · Paso 1).
 * Canonical matrix: docs/V2/ARTIST-MUTATIONS-MATRIX.md
 *
 * CONTRACTS ONLY: pure validators / DTO shapes.
 * NO supabase.from().insert|update · NO Edge deploy · NO V1 web/ · NO commit.
 * Lab only: http://localhost:5173
 *
 * Orthogonal to sealed Read Models · Client Slice 1 writers · session-wiring.
 */

/** Mutation outcome kinds for artist writers (lab + future adapters). */
export type ArtistMutationResultStatus =
  | 'SUCCESS'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED_ROLE'
  | 'GIG_NOT_ASSIGNED'
  | 'IDEMPOTENCY_CONFLICT';

/** Artist mutation family ids (matrix registry). */
export type ArtistMutationKind = 'respond_gig_assignment' | 'acknowledge_payout';

/** Gig response decision. */
export type GigAssignmentDecision = 'ACCEPT' | 'DECLINE';

/** Payload size / field limits — enforced by pure validators. */
export const ARTIST_MUTATION_PAYLOAD_LIMITS = Object.freeze({
  maxPayloadChars: 8_192,
  notesMax: 500,
  feedbackMax: 500,
  bookingIdMax: 120,
  payoutIdMax: 120,
  idempotencyKeyMax: 64,
  idempotencyKeyMin: 8,
  idempotencyKeyPattern: /^[A-Za-z0-9_-]+$/,
  decisions: Object.freeze(['ACCEPT', 'DECLINE'] as const),
} as const);

export type ArtistMutationPayloadLimits = typeof ARTIST_MUTATION_PAYLOAD_LIMITS;

/**
 * RespondGigAssignmentDTO — artist accepts or declines an assigned gig.
 * Scope: `assignedDjId` must equal session artist `userId` (assigned_dj_id isolation).
 */
export type RespondGigAssignmentDTO = {
  readonly mutationKind: 'respond_gig_assignment';
  /** Must match session artist scope when adapter runs. */
  readonly artistUserId: string;
  readonly idempotencyKey: string;
  /** Target booking / gig / lead id. */
  readonly bookingId: string;
  /** Assignment owner — must equal artistUserId. */
  readonly assignedDjId: string;
  readonly decision: GigAssignmentDecision;
  /** Required when decision === DECLINE. */
  readonly rejectionNotes: string | null;
  /** Optional notes on ACCEPT (or extra context). */
  readonly responseNotes: string | null;
};

/**
 * AcknowledgePayoutDTO — artist confirms receipt of payout / honorarios.
 */
export type AcknowledgePayoutDTO = {
  readonly mutationKind: 'acknowledge_payout';
  readonly artistUserId: string;
  readonly idempotencyKey: string;
  readonly payoutId: string;
  /** Must be true to confirm receipt. */
  readonly acknowledged: boolean;
  readonly feedback: string | null;
  /** Optional assignment scope echo; when set must == artistUserId. */
  readonly assignedDjId: string | null;
};

export type ArtistMutationRequestDTO = RespondGigAssignmentDTO | AcknowledgePayoutDTO;

export type ArtistMutationValidationIssue = {
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
    | 'decline_notes_required'
    | 'ack_must_be_true';
  readonly message: string;
};

export type ArtistMutationSuccessResult = {
  readonly status: 'SUCCESS';
  readonly mutationKind: ArtistMutationKind;
  readonly idempotencyKey: string;
  readonly acceptedAt: string;
  readonly replayed: boolean;
  /** Simulated lab record id (not a Supabase row). */
  readonly labRecordId: string;
};

export type ArtistMutationValidationErrorResult = {
  readonly ok: false;
  readonly status: 'VALIDATION_ERROR';
  readonly mutationKind: ArtistMutationKind | null;
  readonly idempotencyKey: string | null;
  readonly issues: readonly ArtistMutationValidationIssue[];
};

export type ArtistMutationUnauthorizedResult = {
  readonly status: 'UNAUTHORIZED_ROLE';
  readonly mutationKind: ArtistMutationKind | null;
  readonly idempotencyKey: string | null;
  readonly reason: 'role_not_artist' | 'missing_artist_scope' | 'anonymous' | 'expired';
};

export type ArtistMutationGigNotAssignedResult = {
  readonly status: 'GIG_NOT_ASSIGNED';
  readonly mutationKind: ArtistMutationKind | null;
  readonly idempotencyKey: string | null;
  readonly bookingId: string | null;
  readonly reason: 'assigned_dj_mismatch' | 'missing_assignment' | 'booking_not_found';
};

export type ArtistMutationIdempotencyConflictResult = {
  readonly status: 'IDEMPOTENCY_CONFLICT';
  readonly mutationKind: ArtistMutationKind;
  readonly idempotencyKey: string;
  readonly existingLabRecordId: string;
  readonly message: string;
};

export type ArtistMutationResult =
  | ArtistMutationSuccessResult
  | ArtistMutationValidationErrorResult
  | ArtistMutationUnauthorizedResult
  | ArtistMutationGigNotAssignedResult
  | ArtistMutationIdempotencyConflictResult;

/** Redacted projection safe for logs / UI diagnostics. */
export type RespondGigAssignmentRedactedDTO = {
  readonly mutationKind: 'respond_gig_assignment';
  readonly artistUserIdMasked: string;
  readonly assignedDjIdMasked: string;
  readonly idempotencyKey: string;
  readonly bookingId: string;
  readonly decision: GigAssignmentDecision;
  readonly hasRejectionNotes: boolean;
  readonly hasResponseNotes: boolean;
};

export type AcknowledgePayoutRedactedDTO = {
  readonly mutationKind: 'acknowledge_payout';
  readonly artistUserIdMasked: string;
  readonly assignedDjIdMasked: string | null;
  readonly idempotencyKey: string;
  readonly payoutId: string;
  readonly acknowledged: boolean;
  readonly hasFeedback: boolean;
};

// ─── Pure helpers (no I/O) ───────────────────────────────────────────────────

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function maskArtistMutationUserId(userId: string | null | undefined): string {
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
  issues: ArtistMutationValidationIssue[],
  field: string,
  code: ArtistMutationValidationIssue['code'],
  message: string,
): void {
  issues.push(Object.freeze({ field, code, message }));
}

/**
 * Sanitize free-text: trim, collapse whitespace, strip control chars.
 */
export function sanitizeArtistMutationText(
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

export function redactRespondGigAssignment(
  dto: RespondGigAssignmentDTO,
): RespondGigAssignmentRedactedDTO {
  return Object.freeze({
    mutationKind: 'respond_gig_assignment',
    artistUserIdMasked: maskArtistMutationUserId(dto.artistUserId),
    assignedDjIdMasked: maskArtistMutationUserId(dto.assignedDjId),
    idempotencyKey: dto.idempotencyKey,
    bookingId: dto.bookingId,
    decision: dto.decision,
    hasRejectionNotes: Boolean(dto.rejectionNotes),
    hasResponseNotes: Boolean(dto.responseNotes),
  });
}

export function redactAcknowledgePayout(dto: AcknowledgePayoutDTO): AcknowledgePayoutRedactedDTO {
  return Object.freeze({
    mutationKind: 'acknowledge_payout',
    artistUserIdMasked: maskArtistMutationUserId(dto.artistUserId),
    assignedDjIdMasked: dto.assignedDjId
      ? maskArtistMutationUserId(dto.assignedDjId)
      : null,
    idempotencyKey: dto.idempotencyKey,
    payoutId: dto.payoutId,
    acknowledged: dto.acknowledged,
    hasFeedback: Boolean(dto.feedback),
  });
}

function validateIdempotencyKey(
  key: string | null | undefined,
  issues: ArtistMutationValidationIssue[],
): string | null {
  const limits = ARTIST_MUTATION_PAYLOAD_LIMITS;
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
 * Pure validation for RespondGigAssignmentDTO.
 * Does not call Supabase / network. Role/assignment checks are separate gates.
 */
export function validateRespondGigAssignment(
  input: unknown,
):
  | ArtistMutationValidationErrorResult
  | { readonly ok: true; readonly dto: RespondGigAssignmentDTO } {
  const limits = ARTIST_MUTATION_PAYLOAD_LIMITS;
  const issues: ArtistMutationValidationIssue[] = [];

  if (estimatePayloadChars(input) > limits.maxPayloadChars) {
    pushIssue(issues, '$', 'payload_too_large', 'Payload exceeds max size');
    return Object.freeze({
      ok: false as const,
      status: 'VALIDATION_ERROR' as const,
      mutationKind: 'respond_gig_assignment',
      idempotencyKey: null,
      issues: Object.freeze(issues),
    });
  }

  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const idempotencyKey = validateIdempotencyKey(
    typeof raw.idempotencyKey === 'string' ? raw.idempotencyKey : null,
    issues,
  );

  const artistUserId = asTrimmedString(raw.artistUserId);
  if (!artistUserId) {
    pushIssue(issues, 'artistUserId', 'required', 'artistUserId is required');
  }

  const bookingId = asTrimmedString(raw.bookingId);
  if (!bookingId) {
    pushIssue(issues, 'bookingId', 'required', 'bookingId is required');
  } else if (bookingId.length > limits.bookingIdMax) {
    pushIssue(issues, 'bookingId', 'too_long', 'bookingId exceeds max length');
  }

  const assignedDjId = asTrimmedString(raw.assignedDjId);
  if (!assignedDjId) {
    pushIssue(issues, 'assignedDjId', 'required', 'assignedDjId is required');
  }

  if (artistUserId && assignedDjId && artistUserId !== assignedDjId) {
    pushIssue(
      issues,
      'assignedDjId',
      'scope_mismatch',
      'assignedDjId must equal artistUserId',
    );
  }

  const decisionRaw = asTrimmedString(raw.decision)?.toUpperCase() ?? null;
  let decision: GigAssignmentDecision | null = null;
  if (!decisionRaw) {
    pushIssue(issues, 'decision', 'required', 'decision is required');
  } else if (decisionRaw !== 'ACCEPT' && decisionRaw !== 'DECLINE') {
    pushIssue(
      issues,
      'decision',
      'invalid_decision',
      'decision must be ACCEPT or DECLINE',
    );
  } else {
    decision = decisionRaw;
  }

  const rejectionNotes = sanitizeArtistMutationText(
    typeof raw.rejectionNotes === 'string' ? raw.rejectionNotes : null,
    { allowNewlines: true },
  );
  if (decision === 'DECLINE' && !rejectionNotes) {
    pushIssue(
      issues,
      'rejectionNotes',
      'decline_notes_required',
      'rejectionNotes is required when declining',
    );
  }
  if (rejectionNotes && rejectionNotes.length > limits.notesMax) {
    pushIssue(issues, 'rejectionNotes', 'too_long', 'rejectionNotes exceeds max length');
  }

  const responseNotes = sanitizeArtistMutationText(
    typeof raw.responseNotes === 'string' ? raw.responseNotes : null,
    { allowNewlines: true },
  );
  if (responseNotes && responseNotes.length > limits.notesMax) {
    pushIssue(issues, 'responseNotes', 'too_long', 'responseNotes exceeds max length');
  }

  if (issues.length > 0) {
    return Object.freeze({
      ok: false as const,
      status: 'VALIDATION_ERROR' as const,
      mutationKind: 'respond_gig_assignment',
      idempotencyKey,
      issues: Object.freeze(issues),
    });
  }

  const dto: RespondGigAssignmentDTO = Object.freeze({
    mutationKind: 'respond_gig_assignment',
    artistUserId: artistUserId as string,
    idempotencyKey: idempotencyKey as string,
    bookingId: bookingId as string,
    assignedDjId: assignedDjId as string,
    decision: decision as GigAssignmentDecision,
    rejectionNotes: decision === 'DECLINE' ? rejectionNotes : null,
    responseNotes,
  });

  return Object.freeze({ ok: true as const, dto });
}

/**
 * Pure validation for AcknowledgePayoutDTO.
 */
export function validateAcknowledgePayout(
  input: unknown,
):
  | ArtistMutationValidationErrorResult
  | { readonly ok: true; readonly dto: AcknowledgePayoutDTO } {
  const limits = ARTIST_MUTATION_PAYLOAD_LIMITS;
  const issues: ArtistMutationValidationIssue[] = [];

  if (estimatePayloadChars(input) > limits.maxPayloadChars) {
    pushIssue(issues, '$', 'payload_too_large', 'Payload exceeds max size');
    return Object.freeze({
      ok: false as const,
      status: 'VALIDATION_ERROR' as const,
      mutationKind: 'acknowledge_payout',
      idempotencyKey: null,
      issues: Object.freeze(issues),
    });
  }

  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const idempotencyKey = validateIdempotencyKey(
    typeof raw.idempotencyKey === 'string' ? raw.idempotencyKey : null,
    issues,
  );

  const artistUserId = asTrimmedString(raw.artistUserId);
  if (!artistUserId) {
    pushIssue(issues, 'artistUserId', 'required', 'artistUserId is required');
  }

  const payoutId = asTrimmedString(raw.payoutId);
  if (!payoutId) {
    pushIssue(issues, 'payoutId', 'required', 'payoutId is required');
  } else if (payoutId.length > limits.payoutIdMax) {
    pushIssue(issues, 'payoutId', 'too_long', 'payoutId exceeds max length');
  }

  if (typeof raw.acknowledged !== 'boolean') {
    pushIssue(issues, 'acknowledged', 'required', 'acknowledged must be a boolean');
  } else if (raw.acknowledged !== true) {
    pushIssue(
      issues,
      'acknowledged',
      'ack_must_be_true',
      'acknowledged must be true to confirm receipt',
    );
  }

  const feedback = sanitizeArtistMutationText(
    typeof raw.feedback === 'string' ? raw.feedback : null,
    { allowNewlines: true },
  );
  if (feedback && feedback.length > limits.feedbackMax) {
    pushIssue(issues, 'feedback', 'too_long', 'feedback exceeds max length');
  }

  const assignedDjId = asTrimmedString(raw.assignedDjId);
  if (artistUserId && assignedDjId && artistUserId !== assignedDjId) {
    pushIssue(
      issues,
      'assignedDjId',
      'scope_mismatch',
      'assignedDjId must equal artistUserId when provided',
    );
  }

  if (issues.length > 0) {
    return Object.freeze({
      ok: false as const,
      status: 'VALIDATION_ERROR' as const,
      mutationKind: 'acknowledge_payout',
      idempotencyKey,
      issues: Object.freeze(issues),
    });
  }

  const dto: AcknowledgePayoutDTO = Object.freeze({
    mutationKind: 'acknowledge_payout',
    artistUserId: artistUserId as string,
    idempotencyKey: idempotencyKey as string,
    payoutId: payoutId as string,
    acknowledged: true,
    feedback,
    assignedDjId,
  });

  return Object.freeze({ ok: true as const, dto });
}

/**
 * Role gate for artist mutations (pure). Adapter will combine with SessionContextDTO.
 */
export function assertArtistMutationAuthorized(input: {
  readonly sessionRole: string | null | undefined;
  readonly artistUserId: string | null | undefined;
  readonly isAnonymous?: boolean;
  readonly isExpired?: boolean;
  readonly mutationKind?: ArtistMutationKind | null;
  readonly idempotencyKey?: string | null;
}): ArtistMutationUnauthorizedResult | { readonly ok: true } {
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
  if (!input.artistUserId) {
    return Object.freeze({
      status: 'UNAUTHORIZED_ROLE' as const,
      mutationKind: input.mutationKind ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      reason: 'missing_artist_scope' as const,
    });
  }
  if (input.sessionRole !== 'artist') {
    return Object.freeze({
      status: 'UNAUTHORIZED_ROLE' as const,
      mutationKind: input.mutationKind ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      reason: 'role_not_artist' as const,
    });
  }
  return Object.freeze({ ok: true as const });
}

/**
 * Assignment isolation: assigned_dj_id must equal session artist userId.
 */
export function assertGigAssignedToArtist(input: {
  readonly assignedDjId: string | null | undefined;
  readonly artistUserId: string | null | undefined;
  readonly bookingId?: string | null;
  readonly mutationKind?: ArtistMutationKind | null;
  readonly idempotencyKey?: string | null;
}): ArtistMutationGigNotAssignedResult | { readonly ok: true } {
  const assigned = asTrimmedString(input.assignedDjId);
  const artist = asTrimmedString(input.artistUserId);
  if (!assigned || !artist) {
    return Object.freeze({
      status: 'GIG_NOT_ASSIGNED' as const,
      mutationKind: input.mutationKind ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      bookingId: asTrimmedString(input.bookingId),
      reason: 'missing_assignment' as const,
    });
  }
  if (assigned !== artist) {
    return Object.freeze({
      status: 'GIG_NOT_ASSIGNED' as const,
      mutationKind: input.mutationKind ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      bookingId: asTrimmedString(input.bookingId),
      reason: 'assigned_dj_mismatch' as const,
    });
  }
  return Object.freeze({ ok: true as const });
}

/**
 * Build SUCCESS envelope (lab). `replayed=true` when idempotent replay detected by future store.
 */
export function toArtistMutationSuccessResult(input: {
  readonly mutationKind: ArtistMutationKind;
  readonly idempotencyKey: string;
  readonly acceptedAt?: string;
  readonly replayed?: boolean;
  readonly labRecordId: string;
}): ArtistMutationSuccessResult {
  return Object.freeze({
    status: 'SUCCESS' as const,
    mutationKind: input.mutationKind,
    idempotencyKey: input.idempotencyKey,
    acceptedAt: input.acceptedAt ?? new Date().toISOString(),
    replayed: input.replayed ?? false,
    labRecordId: input.labRecordId,
  });
}
