/** LC-7 — W-9 workflow ↔ LegalDocumentInstance status mapping */

import type { LegalDocumentInstanceStatus } from '../domain/legal-document-instance-status';
import type { LegalW9RequestStatus } from './legal-w9-request-status';

export const LEGAL_W9_TO_INSTANCE_STATUS: Readonly<
  Record<
    | 'requested'
    | 'available'
    | 'viewed'
    | 'awaiting_upload'
    | 'submitted'
    | 'accepted'
    | 'rejected'
    | 'expired'
    | 'cancelled',
    LegalDocumentInstanceStatus
  >
> = Object.freeze({
  requested: 'pending',
  available: 'sent',
  viewed: 'viewed',
  awaiting_upload: 'viewed',
  submitted: 'viewed',
  accepted: 'signed',
  rejected: 'rejected',
  expired: 'expired',
  cancelled: 'cancelled',
});

export function mapW9WorkflowStatusToInstanceStatus(
  status: LegalW9RequestStatus,
): LegalDocumentInstanceStatus | null {
  if (status in LEGAL_W9_TO_INSTANCE_STATUS) {
    return LEGAL_W9_TO_INSTANCE_STATUS[status as keyof typeof LEGAL_W9_TO_INSTANCE_STATUS];
  }
  return null;
}
