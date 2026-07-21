/** LC-6 — Legal document instance lifecycle statuses */

export const LEGAL_DOCUMENT_INSTANCE_STATUSES = [
  'draft',
  'pending',
  'sent',
  'viewed',
  'signed',
  'rejected',
  'expired',
  'cancelled',
] as const;

export type LegalDocumentInstanceStatus = (typeof LEGAL_DOCUMENT_INSTANCE_STATUSES)[number];

export const TERMINAL_LEGAL_DOCUMENT_INSTANCE_STATUSES = [
  'signed',
  'rejected',
  'expired',
  'cancelled',
] as const satisfies readonly LegalDocumentInstanceStatus[];

export type TerminalLegalDocumentInstanceStatus =
  (typeof TERMINAL_LEGAL_DOCUMENT_INSTANCE_STATUSES)[number];

export function isLegalDocumentInstanceStatus(
  value: string,
): value is LegalDocumentInstanceStatus {
  return (LEGAL_DOCUMENT_INSTANCE_STATUSES as readonly string[]).includes(value);
}

export function isTerminalLegalDocumentInstanceStatus(
  status: LegalDocumentInstanceStatus,
): status is TerminalLegalDocumentInstanceStatus {
  return (TERMINAL_LEGAL_DOCUMENT_INSTANCE_STATUSES as readonly string[]).includes(status);
}
