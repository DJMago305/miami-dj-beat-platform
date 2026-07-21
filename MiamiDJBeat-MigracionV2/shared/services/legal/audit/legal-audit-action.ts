/** LC-9 — Legal audit actions */

export const LEGAL_AUDIT_ACTIONS = [
  'instance_created',
  'instance_status_changed',
  'instance_cancelled',
  'instance_expired',
  'instance_viewed',
  'w9_requested',
  'w9_made_available',
  'w9_viewed',
  'w9_awaiting_upload',
  'w9_submitted',
  'w9_marked_under_review',
  'w9_accepted',
  'w9_rejected',
  'w9_cancelled',
  'w9_expired',
  'submission_created',
  'submission_uploaded',
  'submission_viewed',
  'submission_replaced',
  'submission_deleted',
  'submission_review_started',
  'submission_accepted',
  'submission_rejected',
  'template_asset_accessed',
  'template_asset_download_authorized',
  'template_asset_download_denied',
  'legal_access_denied',
  'legal_sensitive_record_viewed',
] as const;

export type LegalAuditAction = (typeof LEGAL_AUDIT_ACTIONS)[number];

export function isLegalAuditAction(value: string): value is LegalAuditAction {
  return (LEGAL_AUDIT_ACTIONS as readonly string[]).includes(value);
}

export function legalAuditActionLabel(action: LegalAuditAction): string {
  switch (action) {
    case 'w9_requested':
      return 'W-9 requested';
    case 'w9_made_available':
      return 'W-9 made available';
    case 'w9_viewed':
      return 'W-9 viewed';
    case 'w9_awaiting_upload':
      return 'Awaiting upload';
    case 'w9_submitted':
      return 'Submission received';
    case 'w9_marked_under_review':
      return 'Under review';
    case 'w9_accepted':
      return 'Accepted';
    case 'w9_rejected':
      return 'Rejected';
    case 'submission_uploaded':
      return 'Submission uploaded';
    case 'submission_review_started':
      return 'Review started';
    case 'submission_accepted':
      return 'Submission accepted';
    case 'submission_rejected':
      return 'Submission rejected';
    case 'instance_created':
      return 'Document instance created';
    case 'instance_status_changed':
      return 'Status changed';
    case 'legal_access_denied':
      return 'Access denied';
    case 'legal_sensitive_record_viewed':
      return 'Sensitive record viewed';
    default:
      return action.replace(/_/g, ' ');
  }
}
