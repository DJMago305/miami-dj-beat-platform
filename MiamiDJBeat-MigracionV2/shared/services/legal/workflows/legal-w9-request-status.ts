/** LC-7 — W-9 collection workflow statuses */

export const LEGAL_W9_OPERATIONAL_STATUSES = [
  'requested',
  'available',
  'viewed',
  'awaiting_upload',
  'expired',
  'cancelled',
] as const;

export type LegalW9OperationalStatus = (typeof LEGAL_W9_OPERATIONAL_STATUSES)[number];

/** Reserved for LC-8 — now operational via submission flow. */
export const LEGAL_W9_LC8_STATUSES = ['submitted', 'accepted', 'rejected'] as const;

export type LegalW9ReservedStatus = (typeof LEGAL_W9_LC8_STATUSES)[number];

export const LEGAL_W9_REQUEST_STATUSES = [
  ...LEGAL_W9_OPERATIONAL_STATUSES,
  ...LEGAL_W9_LC8_STATUSES,
] as const;

export type LegalW9RequestStatus = (typeof LEGAL_W9_REQUEST_STATUSES)[number];

export const TERMINAL_LEGAL_W9_REQUEST_STATUSES = [
  'expired',
  'cancelled',
  'accepted',
  'rejected',
] as const satisfies readonly LegalW9RequestStatus[];

export type TerminalLegalW9RequestStatus = (typeof TERMINAL_LEGAL_W9_REQUEST_STATUSES)[number];

export const ACTIVE_LEGAL_W9_REQUEST_STATUSES = [
  'requested',
  'available',
  'viewed',
  'awaiting_upload',
] as const satisfies readonly LegalW9RequestStatus[];

export function isLegalW9RequestStatus(value: string): value is LegalW9RequestStatus {
  return (LEGAL_W9_REQUEST_STATUSES as readonly string[]).includes(value);
}

export function isTerminalLegalW9RequestStatus(
  status: LegalW9RequestStatus,
): status is TerminalLegalW9RequestStatus {
  return (TERMINAL_LEGAL_W9_REQUEST_STATUSES as readonly string[]).includes(status);
}

export function isActiveLegalW9RequestStatus(status: LegalW9RequestStatus): boolean {
  return (ACTIVE_LEGAL_W9_REQUEST_STATUSES as readonly string[]).includes(status);
}

export const LEGAL_W9_REVIEW_STATUSES = ['not_started', 'pending_review', 'complete'] as const;

export type LegalW9ReviewStatus = (typeof LEGAL_W9_REVIEW_STATUSES)[number];
