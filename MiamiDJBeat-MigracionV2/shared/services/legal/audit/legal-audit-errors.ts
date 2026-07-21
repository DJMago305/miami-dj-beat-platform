/** LC-9 — Legal audit trail errors */

import type { LegalAuditAction } from './legal-audit-action';
import { isLegalAuditAction } from './legal-audit-action';
import type { LegalAuditEntityType } from './legal-audit-event-types';

export type LegalAuditErrorCode =
  | 'audit_event_not_found'
  | 'duplicate_audit_event_id'
  | 'invalid_audit_actor'
  | 'invalid_audit_action'
  | 'invalid_audit_entity'
  | 'invalid_audit_outcome'
  | 'audit_reason_required'
  | 'audit_append_failed'
  | 'audit_access_forbidden'
  | 'invalid_audit_time_range';

export type LegalAuditError = {
  readonly ok: false;
  readonly code: LegalAuditErrorCode;
  readonly message: string;
  readonly context?: Readonly<Record<string, string | number | boolean | null>>;
};

export type LegalAuditResult<T> = { readonly ok: true; readonly value: T } | LegalAuditError;

export function legalAuditError(
  code: LegalAuditErrorCode,
  message: string,
  context?: Readonly<Record<string, string | number | boolean | null>>,
): LegalAuditError {
  return Object.freeze({
    ok: false,
    code,
    message,
    ...(context ? { context: Object.freeze({ ...context }) } : {}),
  });
}

export function legalAuditSuccess<T>(value: T): LegalAuditResult<T> {
  return Object.freeze({ ok: true, value });
}

export function mapDomainReasonCode(code: string): string {
  const normalized = code.trim();
  if (normalized.includes('not_authorized') || normalized.includes('forbidden')) {
    return 'actor_not_authorized';
  }
  if (normalized.includes('invalid_status_transition') || normalized.includes('invalid_transition')) {
    return 'invalid_transition';
  }
  if (normalized.includes('not_found')) {
    if (normalized.includes('submission')) {
      return 'submission_not_found';
    }
    if (normalized.includes('request') || normalized.includes('w9')) {
      return 'request_not_found';
    }
    if (normalized.includes('instance')) {
      return 'instance_not_found';
    }
  }
  if (normalized.includes('active_request_exists') || normalized.includes('duplicate')) {
    return 'duplicate_active_request';
  }
  if (normalized.includes('asset') || normalized.includes('template')) {
    return 'asset_access_forbidden';
  }
  if (normalized.includes('recipient')) {
    return 'recipient_mismatch';
  }
  return normalized.length > 0 ? normalized : 'invalid_transition';
}

export function validateAuditAction(action: string): LegalAuditResult<LegalAuditAction> {
  if (!action.trim()) {
    return legalAuditError('invalid_audit_action', 'Audit action is required.');
  }
  if (!isLegalAuditAction(action)) {
    return legalAuditError('invalid_audit_action', `Unknown audit action: ${action}`, {
      action,
    });
  }
  return legalAuditSuccess(action);
}

export function validateAuditEntityType(entityType: string): LegalAuditResult<LegalAuditEntityType> {
  const allowed = [
    'legal_document_instance',
    'w9_request',
    'legal_document_submission',
    'legal_template',
    'legal_template_asset',
  ] as const;
  if (!(allowed as readonly string[]).includes(entityType)) {
    return legalAuditError('invalid_audit_entity', `Unknown audit entity type: ${entityType}`, {
      entityType,
    });
  }
  return legalAuditSuccess(entityType as LegalAuditEntityType);
}
