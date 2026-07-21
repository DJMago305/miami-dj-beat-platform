/** LC-9 — Legal audit shell mapper */

import {
  filterAuditEventsForArtist,
  filterAuditEventsForStaffRole,
} from '../audit/legal-audit-permissions';
import {
  toArtistLegalAuditPublicView,
  toStaffLegalAuditPublicView,
} from '../audit/legal-audit-public-view';
import { getSharedLegalAuditTrail } from '../audit/legal-audit-lab-store';
import type { LegalAuditTrailPort } from '../audit/legal-audit-trail-port';
import type { LegalDocumentCardViewModel, LegalSectionViewModel } from '../ui/legal-shell-types';
import { LEGAL_DOWNLOAD_COMING_SOON_ACTION } from '../ui/legal-shell-types';
import type { StaffLegalPortalRole } from './legal-portal-view-models';
import { LEGAL_W9_DEMO_ARTIST_RECIPIENT_ID } from '../workflows';

function mapPublicViewToActivityCard(
  view: ReturnType<typeof toStaffLegalAuditPublicView>,
  index: number,
): LegalDocumentCardViewModel {
  return Object.freeze({
    id: `audit-activity-${index}`,
    title: `${view.label} · ${view.actorLabel}`,
    type: 'w9',
    status: view.outcomeLabel === 'Completed' ? 'signed' : 'pending',
    createdAt: view.occurredAt,
    updatedAt: view.occurredAt,
    requiresSignature: false,
    downloadAction: LEGAL_DOWNLOAD_COMING_SOON_ACTION,
  });
}

export function buildStaffLegalActivitySection(
  role: StaffLegalPortalRole,
  auditTrail: LegalAuditTrailPort = getSharedLegalAuditTrail(),
  limit = 4,
): LegalSectionViewModel | null {
  if (role === 'staff_seller') {
    return null;
  }

  const staffRole = role === 'staff_owner' ? 'staff_owner' : 'staff_manager';
  const events = filterAuditEventsForStaffRole(auditTrail.listEvents({ limit: 50 }), staffRole)
    .slice(-limit)
    .reverse()
    .map((event) => toStaffLegalAuditPublicView(event));

  if (events.length === 0) {
    return Object.freeze({
      sectionId: 'section-legal-activity',
      title: 'Legal Activity',
      category: 'w9',
      documents: Object.freeze([
        Object.freeze({
          id: 'audit-activity-placeholder',
          title: 'W-9 requested · Staff Owner',
          type: 'w9' as const,
          status: 'pending' as const,
          createdAt: '2026-07-20T21:00:00.000Z',
          updatedAt: '2026-07-20T21:00:00.000Z',
          requiresSignature: false,
          downloadAction: LEGAL_DOWNLOAD_COMING_SOON_ACTION,
        }),
      ]),
    });
  }

  return Object.freeze({
    sectionId: 'section-legal-activity',
    title: 'Legal Activity',
    category: 'w9',
    documents: Object.freeze(events.map((event, index) => mapPublicViewToActivityCard(event, index))),
  });
}

export function buildArtistDocumentActivitySection(
  artistActorId: string = LEGAL_W9_DEMO_ARTIST_RECIPIENT_ID,
  auditTrail: LegalAuditTrailPort = getSharedLegalAuditTrail(),
  limit = 3,
): LegalSectionViewModel | null {
  const events = filterAuditEventsForArtist(auditTrail.listEvents({ limit: 50 }), artistActorId)
    .slice(-limit)
    .reverse()
    .map((event) => toArtistLegalAuditPublicView(event));

  if (events.length === 0) {
    return null;
  }

  return Object.freeze({
    sectionId: 'section-artist-document-activity',
    title: 'Document Activity',
    category: 'w9',
    documents: Object.freeze(events.map((event, index) => mapPublicViewToActivityCard(event, index))),
  });
}

export function appendLegalAuditSections(
  sections: readonly LegalSectionViewModel[],
  input:
    | { readonly portal: 'staff'; readonly role: StaffLegalPortalRole }
    | { readonly portal: 'artist'; readonly artistActorId?: string }
    | { readonly portal: 'client' },
  auditTrail: LegalAuditTrailPort = getSharedLegalAuditTrail(),
): readonly LegalSectionViewModel[] {
  if (input.portal === 'client') {
    return sections;
  }
  if (input.portal === 'staff') {
    const activity = buildStaffLegalActivitySection(input.role, auditTrail);
    return activity ? Object.freeze([...sections, activity]) : sections;
  }
  const artistActivity = buildArtistDocumentActivitySection(input.artistActorId, auditTrail);
  return artistActivity ? Object.freeze([...sections, artistActivity]) : sections;
}
