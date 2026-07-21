/** LC-9 — Legal audit public projection */

import { legalAuditActionLabel } from './legal-audit-action';
import type { LegalAuditEvent } from './legal-audit-event-types';
import type { LegalAuditActorRole } from './legal-audit-event-types';

export type LegalAuditEventPublicView = {
  readonly label: string;
  readonly occurredAt: string;
  readonly outcomeLabel: string;
  readonly actorLabel: string;
  readonly statusLabel?: string;
};

export type StaffLegalAuditPortalRole = 'staff_owner' | 'staff_manager';

function mapOutcomeLabel(outcome: LegalAuditEvent['outcome']): string {
  switch (outcome) {
    case 'success':
      return 'Completed';
    case 'denied':
      return 'Denied';
    case 'failed':
      return 'Failed';
    default:
      return outcome;
  }
}

function mapStaffActorLabel(event: LegalAuditEvent): string {
  if (event.actor.actorType === 'system') {
    return 'System';
  }
  if (event.actor.displayName) {
    return event.actor.displayName;
  }
  return `${event.actor.role} · ${event.actor.portal}`;
}

function mapArtistActorLabel(event: LegalAuditEvent): string {
  if (event.actor.portal === 'artist') {
    return 'You';
  }
  if (event.actor.actorType === 'system') {
    return 'Platform';
  }
  return 'Staff reviewer';
}

export function toStaffLegalAuditPublicView(event: LegalAuditEvent): LegalAuditEventPublicView {
  return Object.freeze({
    label: legalAuditActionLabel(event.action),
    occurredAt: event.occurredAt,
    outcomeLabel: mapOutcomeLabel(event.outcome),
    actorLabel: mapStaffActorLabel(event),
    ...(event.nextState?.status
      ? { statusLabel: String(event.nextState.status) }
      : event.previousState?.status
        ? { statusLabel: String(event.previousState.status) }
        : {}),
  });
}

export function toArtistLegalAuditPublicView(event: LegalAuditEvent): LegalAuditEventPublicView {
  return Object.freeze({
    label: legalAuditActionLabel(event.action),
    occurredAt: event.occurredAt,
    outcomeLabel: mapOutcomeLabel(event.outcome),
    actorLabel: mapArtistActorLabel(event),
    ...(event.nextState?.status ? { statusLabel: String(event.nextState.status) } : {}),
  });
}

export function canStaffRoleViewAuditTrail(role: StaffLegalAuditPortalRole): boolean {
  return role === 'staff_owner' || role === 'staff_manager';
}

export function canArtistViewAuditEvent(
  event: LegalAuditEvent,
  artistActorId: string,
): boolean {
  if (event.actor.portal === 'artist' && event.actor.actorId === artistActorId) {
    return true;
  }
  const relatedRecipient = event.relatedEntityIds.recipientId;
  if (relatedRecipient === artistActorId) {
    return true;
  }
  if (event.entityType === 'w9_request' && event.metadata.recipientId === artistActorId) {
    return true;
  }
  return false;
}

export function isSensitiveAuditAction(action: LegalAuditEvent['action']): boolean {
  return (
    action === 'legal_sensitive_record_viewed' ||
    action === 'submission_viewed' ||
    action === 'submission_uploaded' ||
    action === 'submission_review_started' ||
    action === 'submission_accepted' ||
    action === 'submission_rejected'
  );
}

export function mapStaffRoleToAuditActorRole(role: StaffLegalAuditPortalRole): LegalAuditActorRole {
  return role === 'staff_owner' ? 'owner' : 'manager';
}
