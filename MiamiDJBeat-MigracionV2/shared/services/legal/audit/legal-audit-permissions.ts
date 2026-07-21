/** LC-9 — Legal audit permissions */

import type { LegalAuditActor } from './legal-audit-event-types';
import type { LegalAuditEvent } from './legal-audit-event-types';
import type { StaffLegalAuditPortalRole } from './legal-audit-public-view';
import {
  canArtistViewAuditEvent,
  canStaffRoleViewAuditTrail,
} from './legal-audit-public-view';
import type { LegalWorkflowActor } from '../workflows/legal-w9-workflow-actor';

export function canActorQueryLegalAuditTrail(actor: LegalWorkflowActor | LegalAuditActor): boolean {
  if ('actorType' in actor) {
    if (actor.actorType === 'client') {
      return false;
    }
    if (actor.actorType === 'staff' && actor.role === 'seller') {
      return false;
    }
    return actor.actorType === 'staff' || actor.actorType === 'artist';
  }
  if (actor.portal === 'client') {
    return false;
  }
  if (actor.portal === 'staff' && actor.role === 'seller') {
    return false;
  }
  return actor.portal === 'staff' || actor.portal === 'artist';
}

export function filterAuditEventsForStaffRole(
  events: readonly LegalAuditEvent[],
  role: StaffLegalAuditPortalRole,
): readonly LegalAuditEvent[] {
  if (!canStaffRoleViewAuditTrail(role)) {
    return Object.freeze([]);
  }
  return Object.freeze([...events]);
}

export function filterAuditEventsForArtist(
  events: readonly LegalAuditEvent[],
  artistActorId: string,
): readonly LegalAuditEvent[] {
  return Object.freeze(events.filter((event) => canArtistViewAuditEvent(event, artistActorId)));
}

export function mapWorkflowActorToAuditActor(
  actor: LegalWorkflowActor,
  displayName?: string,
): LegalAuditActor {
  if (actor.portal === 'staff') {
    return Object.freeze({
      actorType: 'staff',
      actorId: actor.actorId,
      role: actor.role ?? 'manager',
      portal: 'staff',
      ...(displayName ? { displayName } : {}),
    });
  }
  if (actor.portal === 'artist') {
    return Object.freeze({
      actorType: 'artist',
      actorId: actor.actorId,
      role: 'artist',
      portal: 'artist',
      ...(displayName ? { displayName } : {}),
    });
  }
  return Object.freeze({
    actorType: 'client',
    actorId: actor.actorId,
    role: 'client',
    portal: 'client',
    ...(displayName ? { displayName } : {}),
  });
}

export function createSystemLegalAuditActor(): LegalAuditActor {
  return Object.freeze({
    actorType: 'system',
    actorId: 'MDJB-SYSTEM',
    role: 'system',
    portal: 'system',
    displayName: 'System',
  });
}
