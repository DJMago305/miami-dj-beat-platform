/**
 * Client Mutations V2 — Write contracts (Writers Phase · Slice 1 · Paso 1).
 * Canonical matrix: docs/V2/CLIENT-MUTATIONS-MATRIX.md
 *
 * CONTRACTS ONLY: pure validators / DTO shapes.
 * NO supabase.from().insert|update · NO Edge deploy · NO V1 web/ · NO commit.
 * Lab only: http://localhost:5173
 *
 * Orthogonal to sealed Read Models (bookings / financial / session-wiring).
 */

import type { PaymentMethodRead } from './financial.types';

/** Mutation outcome kinds for client writers (lab + future adapters). */
export type ClientMutationResultStatus =
  | 'SUCCESS'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED_ROLE'
  | 'IDEMPOTENCY_CONFLICT';

/** Client mutation family ids (matrix registry). */
export type ClientMutationKind = 'create_booking_request' | 'submit_offline_payment_proof';

/** Payload size / field limits (bytes / chars) — enforced by pure validators. */
export const CLIENT_MUTATION_PAYLOAD_LIMITS = Object.freeze({
  /** Max JSON-serialized body size (UTF-8 bytes estimate via string length). */
  maxPayloadChars: 8_192,
  titleMax: 120,
  locationLabelMax: 200,
  notesMax: 1_000,
  contactNameMax: 80,
  contactEmailMax: 120,
  contactPhoneMax: 32,
  proofReferenceMax: 120,
  proofNotesMax: 500,
  idempotencyKeyMax: 64,
  idempotencyKeyMin: 8,
  /** ISO date YYYY-MM-DD */
  eventDatePattern: /^\d{4}-\d{2}-\d{2}$/,
  /** HH:MM 24h optional seconds */
  timePattern: /^\d{2}:\d{2}(:\d{2})?$/,
  emailLoosePattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  /** Opaque idempotency — alphanumeric + _- */
  idempotencyKeyPattern: /^[A-Za-z0-9_-]+$/,
  amountMinorUnitsMin: 1,
  amountMinorUnitsMax: 50_000_00, // $50,000.00 in minor units
} as const);

export type ClientMutationPayloadLimits = typeof CLIENT_MUTATION_PAYLOAD_LIMITS;

/**
 * CreateBookingRequestDTO — client asks to create a booking request (not a confirmed lead).
 * Scoped to session `client_id` at adapter time (Paso 2+); contract carries explicit clientUserId for validation.
 */
export type CreateBookingRequestDTO = {
  readonly mutationKind: 'create_booking_request';
  /** Must match session client scope when adapter runs. */
  readonly clientUserId: string;
  /** Client-generated idempotency key (required). */
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
};

/**
 * SubmitOfflinePaymentProofDTO — client registers offline payment proof (Zelle/Cash/etc.).
 * Does not charge cards; no Stripe writers in this slice.
 */
export type SubmitOfflinePaymentProofDTO = {
  readonly mutationKind: 'submit_offline_payment_proof';
  readonly clientUserId: string;
  readonly idempotencyKey: string;
  /** Target booking / lead id the proof applies to. */
  readonly bookingId: string;
  /** Amount in minor currency units (e.g. cents). */
  readonly amountMinorUnits: number;
  readonly currencyCode: 'USD';
  readonly paymentMethod: Extract<
    PaymentMethodRead,
    'Zelle' | 'Cash' | 'BankTransfer' | 'Check' | 'Other'
  >;
  /** Bank / Zelle reference or memo (sanitized; may be redacted in logs). */
  readonly proofReference: string | null;
  readonly proofNotes: string | null;
  /** When the offline transfer happened (ISO-8601 or YYYY-MM-DD). */
  readonly paidAt: string | null;
};

export type ClientMutationRequestDTO = CreateBookingRequestDTO | SubmitOfflinePaymentProofDTO;

export type ClientMutationValidationIssue = {
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
    | 'unsupported_method';
  readonly message: string;
};

export type ClientMutationSuccessResult = {
  readonly status: 'SUCCESS';
  readonly mutationKind: ClientMutationKind;
  readonly idempotencyKey: string;
  /** Lab / future adapter correlation. */
  readonly acceptedAt: string;
  readonly replayed: boolean;
  /** Simulated lab record id (not a Supabase row). */
  readonly labRecordId: string;
};

export type ClientMutationValidationErrorResult = {
  readonly ok: false;
  readonly status: 'VALIDATION_ERROR';
  readonly mutationKind: ClientMutationKind | null;
  readonly idempotencyKey: string | null;
  readonly issues: readonly ClientMutationValidationIssue[];
};

export type ClientMutationUnauthorizedResult = {
  readonly status: 'UNAUTHORIZED_ROLE';
  readonly mutationKind: ClientMutationKind | null;
  readonly idempotencyKey: string | null;
  readonly reason: 'role_not_client' | 'missing_client_scope' | 'anonymous' | 'expired';
};

export type ClientMutationIdempotencyConflictResult = {
  readonly status: 'IDEMPOTENCY_CONFLICT';
  readonly mutationKind: ClientMutationKind;
  readonly idempotencyKey: string;
  readonly existingLabRecordId: string;
  readonly message: string;
};

export type ClientMutationResult =
  | ClientMutationSuccessResult
  | ClientMutationValidationErrorResult
  | ClientMutationUnauthorizedResult
  | ClientMutationIdempotencyConflictResult;

/** Redacted projection safe for logs / UI diagnostics (PII stripped). */
export type CreateBookingRequestRedactedDTO = {
  readonly mutationKind: 'create_booking_request';
  readonly clientUserIdMasked: string;
  readonly idempotencyKey: string;
  readonly title: string;
  readonly eventDate: string;
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly locationLabel: string | null;
  readonly hasNotes: boolean;
  readonly preferredArtistProfileId: string | null;
  readonly hasContactName: boolean;
  readonly contactEmailMasked: string | null;
  readonly contactPhoneMasked: string | null;
};

export type SubmitOfflinePaymentProofRedactedDTO = {
  readonly mutationKind: 'submit_offline_payment_proof';
  readonly clientUserIdMasked: string;
  readonly idempotencyKey: string;
  readonly bookingId: string;
  readonly amountMinorUnits: number;
  readonly currencyCode: 'USD';
  readonly paymentMethod: SubmitOfflinePaymentProofDTO['paymentMethod'];
  readonly hasProofReference: boolean;
  readonly hasProofNotes: boolean;
  readonly paidAt: string | null;
};

// ─── Pure helpers (no I/O) ───────────────────────────────────────────────────

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function maskClientMutationUserId(userId: string | null | undefined): string {
  const id = userId?.trim() ?? '';
  if (!id) return '(none)';
  if (id.length <= 8) return `${id.slice(0, 2)}…`;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export function maskEmailForLog(email: string | null | undefined): string | null {
  const value = asTrimmedString(email);
  if (!value) return null;
  const at = value.indexOf('@');
  if (at <= 0) return '***';
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const localMask = local.length <= 2 ? `${local[0] ?? '*'}*` : `${local.slice(0, 2)}***`;
  return `${localMask}@${domain}`;
}

export function maskPhoneForLog(phone: string | null | undefined): string | null {
  const value = asTrimmedString(phone);
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `***${digits.slice(-4)}`;
}

function estimatePayloadChars(payload: unknown): number {
  try {
    return JSON.stringify(payload)?.length ?? Number.MAX_SAFE_INTEGER;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function pushIssue(
  issues: ClientMutationValidationIssue[],
  field: string,
  code: ClientMutationValidationIssue['code'],
  message: string,
): void {
  issues.push(Object.freeze({ field, code, message }));
}

/**
 * Sanitize free-text: trim, collapse whitespace, strip control chars (except \n in notes).
 */
export function sanitizeClientMutationText(
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

export function redactCreateBookingRequest(
  dto: CreateBookingRequestDTO,
): CreateBookingRequestRedactedDTO {
  return Object.freeze({
    mutationKind: 'create_booking_request',
    clientUserIdMasked: maskClientMutationUserId(dto.clientUserId),
    idempotencyKey: dto.idempotencyKey,
    title: dto.title,
    eventDate: dto.eventDate,
    startTime: dto.startTime,
    endTime: dto.endTime,
    locationLabel: dto.locationLabel,
    hasNotes: Boolean(dto.notes),
    preferredArtistProfileId: dto.preferredArtistProfileId,
    hasContactName: Boolean(dto.contactName),
    contactEmailMasked: maskEmailForLog(dto.contactEmail),
    contactPhoneMasked: maskPhoneForLog(dto.contactPhone),
  });
}

export function redactSubmitOfflinePaymentProof(
  dto: SubmitOfflinePaymentProofDTO,
): SubmitOfflinePaymentProofRedactedDTO {
  return Object.freeze({
    mutationKind: 'submit_offline_payment_proof',
    clientUserIdMasked: maskClientMutationUserId(dto.clientUserId),
    idempotencyKey: dto.idempotencyKey,
    bookingId: dto.bookingId,
    amountMinorUnits: dto.amountMinorUnits,
    currencyCode: dto.currencyCode,
    paymentMethod: dto.paymentMethod,
    hasProofReference: Boolean(dto.proofReference),
    hasProofNotes: Boolean(dto.proofNotes),
    paidAt: dto.paidAt,
  });
}

function validateIdempotencyKey(
  key: string | null | undefined,
  issues: ClientMutationValidationIssue[],
): string | null {
  const limits = CLIENT_MUTATION_PAYLOAD_LIMITS;
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
 * Pure validation for CreateBookingRequestDTO.
 * Does not call Supabase / network. Role/scope checks are separate (`assertClientMutationAuthorized`).
 */
export function validateCreateBookingRequest(
  input: unknown,
): ClientMutationValidationErrorResult | { readonly ok: true; readonly dto: CreateBookingRequestDTO } {
  const limits = CLIENT_MUTATION_PAYLOAD_LIMITS;
  const issues: ClientMutationValidationIssue[] = [];

  if (estimatePayloadChars(input) > limits.maxPayloadChars) {
    pushIssue(issues, '$', 'payload_too_large', 'Payload exceeds max size');
    return Object.freeze({
      ok: false as const,
      status: 'VALIDATION_ERROR' as const,
      mutationKind: 'create_booking_request',
      idempotencyKey: null,
      issues: Object.freeze(issues),
    });
  }

  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const idempotencyKey = validateIdempotencyKey(
    typeof raw.idempotencyKey === 'string' ? raw.idempotencyKey : null,
    issues,
  );
  const clientUserId = asTrimmedString(raw.clientUserId);
  if (!clientUserId) {
    pushIssue(issues, 'clientUserId', 'required', 'clientUserId is required');
  }

  const title = sanitizeClientMutationText(
    typeof raw.title === 'string' ? raw.title : null,
  );
  if (!title) {
    pushIssue(issues, 'title', 'required', 'title is required');
  } else if (title.length > limits.titleMax) {
    pushIssue(issues, 'title', 'too_long', 'title exceeds max length');
  }

  const eventDate = asTrimmedString(raw.eventDate);
  if (!eventDate) {
    pushIssue(issues, 'eventDate', 'required', 'eventDate is required');
  } else if (!limits.eventDatePattern.test(eventDate)) {
    pushIssue(issues, 'eventDate', 'invalid_format', 'eventDate must be YYYY-MM-DD');
  }

  const startTime = sanitizeClientMutationText(
    typeof raw.startTime === 'string' ? raw.startTime : null,
  );
  if (startTime && !limits.timePattern.test(startTime)) {
    pushIssue(issues, 'startTime', 'invalid_format', 'startTime must be HH:MM');
  }
  const endTime = sanitizeClientMutationText(
    typeof raw.endTime === 'string' ? raw.endTime : null,
  );
  if (endTime && !limits.timePattern.test(endTime)) {
    pushIssue(issues, 'endTime', 'invalid_format', 'endTime must be HH:MM');
  }

  const locationLabel = sanitizeClientMutationText(
    typeof raw.locationLabel === 'string' ? raw.locationLabel : null,
  );
  if (locationLabel && locationLabel.length > limits.locationLabelMax) {
    pushIssue(issues, 'locationLabel', 'too_long', 'locationLabel exceeds max length');
  }

  const notes = sanitizeClientMutationText(
    typeof raw.notes === 'string' ? raw.notes : null,
    { allowNewlines: true },
  );
  if (notes && notes.length > limits.notesMax) {
    pushIssue(issues, 'notes', 'too_long', 'notes exceeds max length');
  }

  const contactName = sanitizeClientMutationText(
    typeof raw.contactName === 'string' ? raw.contactName : null,
  );
  if (contactName && contactName.length > limits.contactNameMax) {
    pushIssue(issues, 'contactName', 'too_long', 'contactName exceeds max length');
  }

  const contactEmail = sanitizeClientMutationText(
    typeof raw.contactEmail === 'string' ? raw.contactEmail : null,
  );
  if (contactEmail) {
    if (contactEmail.length > limits.contactEmailMax) {
      pushIssue(issues, 'contactEmail', 'too_long', 'contactEmail exceeds max length');
    } else if (!limits.emailLoosePattern.test(contactEmail)) {
      pushIssue(issues, 'contactEmail', 'invalid_format', 'contactEmail format invalid');
    }
  }

  const contactPhone = sanitizeClientMutationText(
    typeof raw.contactPhone === 'string' ? raw.contactPhone : null,
  );
  if (contactPhone && contactPhone.length > limits.contactPhoneMax) {
    pushIssue(issues, 'contactPhone', 'too_long', 'contactPhone exceeds max length');
  }

  const preferredArtistProfileId = asTrimmedString(raw.preferredArtistProfileId);

  if (issues.length > 0) {
    return Object.freeze({
      ok: false as const,
      status: 'VALIDATION_ERROR' as const,
      mutationKind: 'create_booking_request',
      idempotencyKey,
      issues: Object.freeze(issues),
    });
  }

  const dto: CreateBookingRequestDTO = Object.freeze({
    mutationKind: 'create_booking_request',
    clientUserId: clientUserId as string,
    idempotencyKey: idempotencyKey as string,
    title: title as string,
    eventDate: eventDate as string,
    startTime,
    endTime,
    locationLabel,
    notes,
    preferredArtistProfileId,
    contactName,
    contactEmail,
    contactPhone,
  });

  return Object.freeze({ ok: true as const, dto });
}

const OFFLINE_METHODS = new Set([
  'Zelle',
  'Cash',
  'BankTransfer',
  'Check',
  'Other',
]);

/**
 * Pure validation for SubmitOfflinePaymentProofDTO.
 */
export function validateSubmitOfflinePaymentProof(
  input: unknown,
):
  | ClientMutationValidationErrorResult
  | { readonly ok: true; readonly dto: SubmitOfflinePaymentProofDTO } {
  const limits = CLIENT_MUTATION_PAYLOAD_LIMITS;
  const issues: ClientMutationValidationIssue[] = [];

  if (estimatePayloadChars(input) > limits.maxPayloadChars) {
    pushIssue(issues, '$', 'payload_too_large', 'Payload exceeds max size');
    return Object.freeze({
      ok: false as const,
      status: 'VALIDATION_ERROR' as const,
      mutationKind: 'submit_offline_payment_proof',
      idempotencyKey: null,
      issues: Object.freeze(issues),
    });
  }

  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const idempotencyKey = validateIdempotencyKey(
    typeof raw.idempotencyKey === 'string' ? raw.idempotencyKey : null,
    issues,
  );
  const clientUserId = asTrimmedString(raw.clientUserId);
  if (!clientUserId) {
    pushIssue(issues, 'clientUserId', 'required', 'clientUserId is required');
  }

  const bookingId = asTrimmedString(raw.bookingId);
  if (!bookingId) {
    pushIssue(issues, 'bookingId', 'required', 'bookingId is required');
  }

  const amountRaw = raw.amountMinorUnits;
  const amountMinorUnits =
    typeof amountRaw === 'number' && Number.isFinite(amountRaw)
      ? Math.trunc(amountRaw)
      : NaN;
  if (!Number.isFinite(amountMinorUnits)) {
    pushIssue(issues, 'amountMinorUnits', 'required', 'amountMinorUnits is required');
  } else if (
    amountMinorUnits < limits.amountMinorUnitsMin ||
    amountMinorUnits > limits.amountMinorUnitsMax
  ) {
    pushIssue(issues, 'amountMinorUnits', 'out_of_range', 'amountMinorUnits out of range');
  }

  const currencyCode = asTrimmedString(raw.currencyCode) ?? 'USD';
  if (currencyCode !== 'USD') {
    pushIssue(issues, 'currencyCode', 'invalid_format', 'Only USD is supported in Slice 1');
  }

  const paymentMethod = asTrimmedString(raw.paymentMethod);
  if (!paymentMethod) {
    pushIssue(issues, 'paymentMethod', 'required', 'paymentMethod is required');
  } else if (!OFFLINE_METHODS.has(paymentMethod)) {
    pushIssue(
      issues,
      'paymentMethod',
      'unsupported_method',
      'paymentMethod must be an offline instrument (no StripeCard in this slice)',
    );
  }

  const proofReference = sanitizeClientMutationText(
    typeof raw.proofReference === 'string' ? raw.proofReference : null,
  );
  if (proofReference && proofReference.length > limits.proofReferenceMax) {
    pushIssue(issues, 'proofReference', 'too_long', 'proofReference exceeds max length');
  }

  const proofNotes = sanitizeClientMutationText(
    typeof raw.proofNotes === 'string' ? raw.proofNotes : null,
    { allowNewlines: true },
  );
  if (proofNotes && proofNotes.length > limits.proofNotesMax) {
    pushIssue(issues, 'proofNotes', 'too_long', 'proofNotes exceeds max length');
  }

  const paidAt = asTrimmedString(raw.paidAt);
  if (
    paidAt &&
    !limits.eventDatePattern.test(paidAt) &&
    Number.isNaN(Date.parse(paidAt))
  ) {
    pushIssue(issues, 'paidAt', 'invalid_format', 'paidAt must be ISO date or YYYY-MM-DD');
  }

  if (issues.length > 0) {
    return Object.freeze({
      ok: false as const,
      status: 'VALIDATION_ERROR' as const,
      mutationKind: 'submit_offline_payment_proof',
      idempotencyKey,
      issues: Object.freeze(issues),
    });
  }

  const dto: SubmitOfflinePaymentProofDTO = Object.freeze({
    mutationKind: 'submit_offline_payment_proof',
    clientUserId: clientUserId as string,
    idempotencyKey: idempotencyKey as string,
    bookingId: bookingId as string,
    amountMinorUnits: amountMinorUnits as number,
    currencyCode: 'USD',
    paymentMethod: paymentMethod as SubmitOfflinePaymentProofDTO['paymentMethod'],
    proofReference,
    proofNotes,
    paidAt,
  });

  return Object.freeze({ ok: true as const, dto });
}

/**
 * Role gate for client mutations (pure). Adapter will combine with SessionContextDTO.
 */
export function assertClientMutationAuthorized(input: {
  readonly sessionRole: string | null | undefined;
  readonly clientUserId: string | null | undefined;
  readonly isAnonymous?: boolean;
  readonly isExpired?: boolean;
  readonly mutationKind?: ClientMutationKind | null;
  readonly idempotencyKey?: string | null;
}): ClientMutationUnauthorizedResult | { readonly ok: true } {
  if (input.isExpired) {
    return Object.freeze({
      status: 'UNAUTHORIZED_ROLE' as const,
      mutationKind: input.mutationKind ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      reason: 'expired' as const,
    });
  }
  if (input.isAnonymous || !input.clientUserId) {
    return Object.freeze({
      status: 'UNAUTHORIZED_ROLE' as const,
      mutationKind: input.mutationKind ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      reason: input.isAnonymous || !input.clientUserId ? 'anonymous' : 'missing_client_scope',
    });
  }
  if (input.sessionRole !== 'client') {
    return Object.freeze({
      status: 'UNAUTHORIZED_ROLE' as const,
      mutationKind: input.mutationKind ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      reason: 'role_not_client' as const,
    });
  }
  return Object.freeze({ ok: true as const });
}

/**
 * Build SUCCESS envelope (lab). `replayed=true` when idempotent replay detected by future store.
 */
export function toClientMutationSuccessResult(input: {
  readonly mutationKind: ClientMutationKind;
  readonly idempotencyKey: string;
  readonly acceptedAt?: string;
  readonly replayed?: boolean;
  readonly labRecordId: string;
}): ClientMutationSuccessResult {
  return Object.freeze({
    status: 'SUCCESS' as const,
    mutationKind: input.mutationKind,
    idempotencyKey: input.idempotencyKey,
    acceptedAt: input.acceptedAt ?? new Date().toISOString(),
    replayed: input.replayed ?? false,
    labRecordId: input.labRecordId,
  });
}
