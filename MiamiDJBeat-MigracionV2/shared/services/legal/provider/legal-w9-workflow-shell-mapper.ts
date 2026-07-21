/** LC-7 — Map W-9 workflow requests into Legal Center shell sections */

import { mapTemplateAssetToDownloadAction } from './legal-template-asset-download-mapper';
import type { StaffLegalPortalRole } from './legal-portal-view-models';
import {
  LEGAL_DOWNLOAD_COMING_SOON_ACTION,
  type LegalDocumentCardViewModel,
  type LegalDocumentDownloadAction,
  type LegalSectionViewModel,
} from '../ui/legal-shell-types';
import {
  getSharedLegalW9WorkflowService,
  LEGAL_W9_DEMO_ARTIST_RECIPIENT_ID,
  type LegalWorkflowActor,
  type LegalW9Request,
} from '../workflows';
import type { InMemoryLegalW9WorkflowService } from '../in-memory/in-memory-legal-w9-workflow-service';

function mapW9StatusToCardStatus(status: LegalW9Request['status']): LegalDocumentCardViewModel['status'] {
  switch (status) {
    case 'requested':
      return 'pending';
    case 'available':
      return 'sent';
    case 'viewed':
      return 'viewed';
    case 'awaiting_upload':
      return 'pending';
    case 'submitted':
      return 'pending';
    case 'accepted':
      return 'signed';
    case 'rejected':
      return 'rejected';
    case 'expired':
      return 'expired';
    case 'cancelled':
      return 'rejected';
    default:
      return 'pending';
  }
}

function resolveStaffSubmissionStatusPreview(
  request: LegalW9Request,
  actor: LegalWorkflowActor,
  service: InMemoryLegalW9WorkflowService,
): string {
  const preview = service.getW9SubmissionPublicView(actor, request.id);
  if (preview.ok && preview.value) {
    return `Submission status: ${preview.value.statusLabel}`;
  }
  if (request.status === 'awaiting_upload') {
    return 'Submission status: Awaiting upload';
  }
  return 'Submission status: Pending';
}

function resolveRecipientDownloadAction(
  request: LegalW9Request,
  portal: 'staff' | 'artist',
): LegalDocumentDownloadAction {
  if (request.status === 'requested') {
    return LEGAL_DOWNLOAD_COMING_SOON_ACTION;
  }

  return mapTemplateAssetToDownloadAction({
    portal,
    templateCode: request.templateId,
    templateVersionId: request.templateVersionId,
    label: 'Download W-9',
  });
}

function buildStaffRequestCard(
  request: LegalW9Request,
  actor: LegalWorkflowActor,
  service: InMemoryLegalW9WorkflowService,
): LegalDocumentCardViewModel {
  const submissionPreview = resolveStaffSubmissionStatusPreview(request, actor, service);
  return Object.freeze({
    id: request.id,
    title: `${request.recipient.displayName} · ${request.recipient.recipientType.toUpperCase()} · ${submissionPreview}`,
    type: 'w9',
    status: mapW9StatusToCardStatus(request.status),
    createdAt: request.requestedAt,
    updatedAt: request.updatedAt,
    requiresSignature: true,
    downloadAction: resolveRecipientDownloadAction(request, 'staff'),
  });
}

function buildArtistRequestCard(request: LegalW9Request): LegalDocumentCardViewModel {
  const downloadAction = resolveRecipientDownloadAction(request, 'artist');
  const isPreSubmission =
    request.status === 'available' ||
    request.status === 'viewed' ||
    request.status === 'awaiting_upload';
  const pipelineTitle = isPreSubmission
    ? 'Assigned W-9 Request · Submission pipeline ready'
    : request.status === 'submitted'
      ? 'Assigned W-9 Request · Submission received'
      : request.status === 'accepted'
        ? 'Assigned W-9 Request · Submission accepted'
        : request.status === 'rejected'
          ? 'Assigned W-9 Request · Submission rejected'
          : 'Assigned W-9 Request';

  return Object.freeze({
    id: request.id,
    title: pipelineTitle,
    type: 'w9',
    status: mapW9StatusToCardStatus(request.status),
    createdAt: request.requestedAt,
    updatedAt: request.updatedAt,
    requiresSignature: true,
    downloadAction,
  });
}

function buildStaffActor(role: StaffLegalPortalRole): LegalWorkflowActor {
  if (role === 'staff_seller') {
    return Object.freeze({ portal: 'staff', role: 'seller', actorId: 'STAFF-SELLER-001' });
  }
  if (role === 'staff_manager') {
    return Object.freeze({ portal: 'staff', role: 'manager', actorId: 'STAFF-MANAGER-001' });
  }
  return Object.freeze({ portal: 'staff', role: 'owner', actorId: 'STAFF-OWNER-001' });
}

export function buildStaffW9CollectionSection(
  role: StaffLegalPortalRole,
  service: InMemoryLegalW9WorkflowService = getSharedLegalW9WorkflowService(),
): LegalSectionViewModel | null {
  if (role === 'staff_seller') {
    return null;
  }

  const actor = buildStaffActor(role);
  const listed = service.listW9Requests(actor);
  const requestCards =
    listed.ok && listed.value.length > 0
      ? listed.value.map((request) => buildStaffRequestCard(request, actor, service))
      : [];

  const documents = Object.freeze([
    ...requestCards,
    Object.freeze({
      id: 'w9-request-placeholder',
      title: 'Request W-9',
      type: 'w9' as const,
      status: 'pending' as const,
      createdAt: '2026-07-20T21:00:00.000Z',
      updatedAt: '2026-07-20T21:00:00.000Z',
      requiresSignature: false,
      downloadAction: Object.freeze({
        availability: 'coming_soon' as const,
        label: 'Interactive request — demo pending',
      }),
    }),
  ]);

  return Object.freeze({
    sectionId: 'section-w9-collection',
    title: 'W-9 Collection Requests',
    category: 'w9',
    documents,
  });
}

export function buildArtistW9CollectionSection(
  artistActorId: string = LEGAL_W9_DEMO_ARTIST_RECIPIENT_ID,
  service: InMemoryLegalW9WorkflowService = getSharedLegalW9WorkflowService(),
): LegalSectionViewModel | null {
  const actor: LegalWorkflowActor = Object.freeze({
    portal: 'artist',
    actorId: artistActorId,
  });
  const listed = service.listW9Requests(actor);
  if (!listed.ok || listed.value.length === 0) {
    return null;
  }

  return Object.freeze({
    sectionId: 'section-artist-w9-assignment',
    title: 'Assigned W-9 Request',
    category: 'w9',
    documents: Object.freeze(listed.value.map((request) => buildArtistRequestCard(request))),
  });
}

export function appendW9CollectionSections(
  sections: readonly LegalSectionViewModel[],
  input:
    | { readonly portal: 'staff'; readonly role: StaffLegalPortalRole }
    | { readonly portal: 'artist'; readonly artistActorId?: string }
    | { readonly portal: 'client' },
): readonly LegalSectionViewModel[] {
  if (input.portal === 'client') {
    return sections;
  }

  if (input.portal === 'staff') {
    const w9Section = buildStaffW9CollectionSection(input.role);
    return w9Section ? Object.freeze([...sections, w9Section]) : sections;
  }

  const artistSection = buildArtistW9CollectionSection(input.artistActorId);
  return artistSection ? Object.freeze([...sections, artistSection]) : sections;
}
