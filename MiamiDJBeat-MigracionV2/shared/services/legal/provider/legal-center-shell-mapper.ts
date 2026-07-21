/** Legal Center shell mapper — provider → UI view model — LC-4 */

import type { LegalDocumentLifecycleStatus } from '../contracts/legal-enums';
import type { DocumentsLibraryRow } from '../contracts/legal-projections';
import type { LegalProfileId } from '../contracts/legal-ids';
import { LEGAL_FIXTURE_PROFILE_IDS } from '../in-memory/legal-fixtures';
import type {
  LegalCenterShellPortal,
  LegalCenterShellViewModel,
  LegalDocumentCardStatus,
  LegalDocumentCardViewModel,
  LegalDocumentCategory,
  LegalSectionViewModel,
} from '../ui/legal-shell-types';
import { LEGAL_DOWNLOAD_COMING_SOON_ACTION } from '../ui/legal-shell-types';
import {
  buildArtistLegalProfileViewModel,
  buildClientLegalDocumentsViewModel,
  buildStaffLegalCenterViewModel,
} from './legal-portal-adapters';
import { mapTemplateAssetToDownloadAction } from './legal-template-asset-download-mapper';
import type {
  ArtistLegalProfileViewModel,
  ClientLegalDocumentsViewModel,
  StaffLegalCenterViewModel,
  StaffLegalPortalRole,
} from './legal-portal-view-models';
import type { LegalProviderContext } from './legal-provider-factory';

const CATEGORY_TITLES: Record<LegalDocumentCategory, string> = {
  contracts: 'Contracts',
  agreements: 'Agreements',
  w9: 'W-9',
  tax_documents: 'Tax Documents',
  privacy_policies: 'Privacy Policies',
  releases: 'Releases',
  nda: 'NDA',
  vendor_documents: 'Vendor Documents',
  artist_documents: 'Artist Documents',
};

export function mapLifecycleToCardStatus(
  lifecycleStatus: LegalDocumentLifecycleStatus | DocumentsLibraryRow['lifecycleStatus'],
): LegalDocumentCardStatus {
  switch (lifecycleStatus) {
    case 'DRAFT':
      return 'draft';
    case 'READY_TO_SEND':
    case 'SENT':
      return 'sent';
    case 'VIEWED':
      return 'viewed';
    case 'IN_PROGRESS':
    case 'SIGNED_BY_RECIPIENT':
      return 'pending';
    case 'SIGNED_BY_MIAMI_DJ_BEAT':
    case 'COMPLETED':
      return 'signed';
    case 'EXPIRED':
    case 'SUPERSEDED':
      return 'expired';
    case 'VOIDED':
      return 'rejected';
    default:
      return 'pending';
  }
}

export function mapTemplateToCategory(
  templateCode: string,
  category: DocumentsLibraryRow['category'],
): LegalDocumentCategory {
  if (templateCode === 'SPC-001') {
    return 'w9';
  }
  if (templateCode === 'SPC-002') {
    return 'vendor_documents';
  }
  if (templateCode.startsWith('CTR-')) {
    return 'contracts';
  }
  if (templateCode === 'LGL-001' || templateCode === 'LGL-002') {
    return 'privacy_policies';
  }
  if (templateCode === 'LGL-003') {
    return 'agreements';
  }
  if (category === 'CTR') {
    return 'contracts';
  }
  if (category === 'LGL') {
    return 'agreements';
  }
  return 'artist_documents';
}

function mapW9StatusToCardStatus(w9Status: string): LegalDocumentCardStatus {
  if (w9Status === 'approved') {
    return 'signed';
  }
  if (w9Status === 'missing' || w9Status === 'rejected') {
    return 'rejected';
  }
  if (w9Status === 'expired') {
    return 'expired';
  }
  return 'pending';
}

function rowToDocumentCard(
  row: DocumentsLibraryRow,
  portal: LegalCenterShellPortal,
): LegalDocumentCardViewModel {
  const timestamp = row.signedOrAcceptedAt ?? '2026-01-01T00:00:00.000Z';
  return Object.freeze({
    id: row.documentId,
    title: row.officialName,
    type: mapTemplateToCategory(row.templateCode, row.category),
    status: mapLifecycleToCardStatus(row.lifecycleStatus),
    createdAt: timestamp,
    updatedAt: row.signedOrAcceptedAt ?? row.expiresAt ?? timestamp,
    requiresSignature: row.category === 'CTR' || row.templateCode.startsWith('CTR-'),
    downloadAction: mapTemplateAssetToDownloadAction({
      portal,
      templateCode: row.templateCode,
    }),
  });
}

function groupRowsIntoSections(
  rows: readonly DocumentsLibraryRow[],
  portal: LegalCenterShellPortal,
): LegalSectionViewModel[] {
  const buckets = new Map<LegalDocumentCategory, LegalDocumentCardViewModel[]>();

  for (const row of rows) {
    const card = rowToDocumentCard(row, portal);
    const existing = buckets.get(card.type) ?? [];
    buckets.set(card.type, [...existing, card]);
  }

  return [...buckets.entries()].map(([category, documents]) =>
    Object.freeze({
      sectionId: `section-${category}`,
      title: CATEGORY_TITLES[category],
      category,
      documents: Object.freeze(documents),
    }),
  );
}

async function buildSectionsForProfile(
  provider: LegalProviderContext,
  profileId: LegalProfileId,
  portal: LegalCenterShellPortal,
  options: { readonly includeTaxSection: boolean },
): Promise<readonly LegalSectionViewModel[]> {
  const library = await provider.ports.documents.getLibraryView(profileId);
  const sections = groupRowsIntoSections(library?.rows ?? [], portal);

  if (options.includeTaxSection) {
    const taxCenter = await provider.ports.tax.getTaxCenterView(profileId);
    if (taxCenter) {
      return Object.freeze([
        ...sections,
        Object.freeze({
          sectionId: 'section-w9-center',
          title: 'Tax & W-9 Center',
          category: 'w9' as const,
          documents: Object.freeze([
            Object.freeze({
              id: taxCenter.w9DocumentId ?? `tax-${profileId}`,
              title: 'W-9 Status',
              type: 'w9' as const,
              status: mapW9StatusToCardStatus(taxCenter.w9Status),
              createdAt: taxCenter.approvedAt ?? '2026-01-01T00:00:00.000Z',
              updatedAt: taxCenter.approvedAt ?? '2026-07-20T21:00:00.000Z',
              requiresSignature: taxCenter.w9Status !== 'approved',
              downloadAction: mapTemplateAssetToDownloadAction({
                portal,
                templateCode: 'SPC-001',
                templateVersionId: 'TV-SPC-001-1',
                label: 'Download W-9',
              }),
            }),
          ]),
        }),
      ]);
    }
  }

  return Object.freeze(sections);
}

function buildStaffShellFromViewModel(
  model: StaffLegalCenterViewModel,
  sections: readonly LegalSectionViewModel[],
): LegalCenterShellViewModel {
  if (model.state !== 'ready' || !model.summary) {
    return Object.freeze({
      portal: 'staff',
      state: model.state,
      title: 'Legal Center',
      subtitle: model.previewLabel,
      message: model.message ?? 'Legal center data unavailable.',
      sections: Object.freeze([]),
    });
  }

  return Object.freeze({
    portal: 'staff',
    state: 'ready',
    title: 'Legal Center',
    subtitle: `${model.previewLabel} · lab shell · read-only`,
    aggregateStatus: model.summary.redCount > 0 ? 'RED' : model.summary.yellowCount > 0 ? 'YELLOW' : 'GREEN',
    statusLabel: model.summary.redCount > 0 ? 'Attention required' : 'Operational',
    kpis: Object.freeze([
      Object.freeze({ label: 'Profiles', value: String(model.summary.profileCount) }),
      Object.freeze({ label: 'GREEN', value: String(model.summary.greenCount) }),
      Object.freeze({ label: 'YELLOW', value: String(model.summary.yellowCount) }),
      Object.freeze({ label: 'RED', value: String(model.summary.redCount) }),
      Object.freeze({ label: 'Pending signatures', value: String(model.summary.pendingSignatures) }),
      Object.freeze({ label: 'Missing W-9', value: String(model.summary.missingW9) }),
      Object.freeze({ label: 'Active introductions', value: String(model.summary.activeIntroductions) }),
    ]),
    sections,
  });
}

function buildArtistShellFromViewModel(
  model: ArtistLegalProfileViewModel,
  sections: readonly LegalSectionViewModel[],
): LegalCenterShellViewModel {
  if (model.state !== 'ready') {
    return Object.freeze({
      portal: 'artist',
      state: model.state,
      title: 'My Legal Profile',
      message: model.message,
      sections: Object.freeze([]),
    });
  }

  return Object.freeze({
    portal: 'artist',
    state: 'ready',
    title: 'My Legal Profile',
    subtitle: 'Lab shell · read-only · in-memory provider',
    aggregateStatus: model.legalStatus,
    statusLabel: model.legalStatus,
    kpis: Object.freeze([
      Object.freeze({ label: 'Signed documents', value: String(model.signedDocumentsCount ?? 0) }),
      Object.freeze({ label: 'W-9 status', value: model.w9Status ?? 'n/a' }),
      Object.freeze({ label: 'Compliance', value: model.complianceState ?? 'n/a' }),
      Object.freeze({ label: 'Introductions', value: String(model.activeIntroductions ?? 0) }),
      Object.freeze({ label: 'Pending', value: String(model.pendingDocuments ?? 0) }),
    ]),
    sections,
  });
}

function buildClientShellFromViewModel(
  model: ClientLegalDocumentsViewModel,
  sections: readonly LegalSectionViewModel[],
): LegalCenterShellViewModel {
  if (model.state !== 'ready') {
    return Object.freeze({
      portal: 'client',
      state: model.state,
      title: 'My Documents',
      message: model.message,
      sections: Object.freeze([]),
    });
  }

  return Object.freeze({
    portal: 'client',
    state: 'ready',
    title: 'My Documents',
    subtitle: 'Contracts and authorizations · lab shell',
    aggregateStatus: 'GREEN',
    statusLabel: 'GREEN',
    kpis: Object.freeze([
      Object.freeze({ label: 'Contracts', value: String(model.contractsCount ?? 0) }),
      Object.freeze({ label: 'Signed', value: String(model.signedCount ?? 0) }),
      Object.freeze({ label: 'Pending', value: String(model.pendingCount ?? 0) }),
      Object.freeze({ label: 'Downloads', value: String(model.downloadableArtifactsCount ?? 0) }),
    ]),
    sections,
  });
}

export async function buildStaffLegalCenterShellViewModel(
  provider: LegalProviderContext,
  input: { readonly role: StaffLegalPortalRole },
): Promise<LegalCenterShellViewModel> {
  const model = await buildStaffLegalCenterViewModel(provider, input);
  const includeTaxSection = input.role !== 'staff_seller';
  const sampleProfileId = LEGAL_FIXTURE_PROFILE_IDS.artistGreen;
  const sections =
    model.state === 'ready' && input.role !== 'staff_seller'
      ? await buildSectionsForProfile(provider, sampleProfileId, 'staff', { includeTaxSection })
      : model.state === 'ready'
        ? Object.freeze([
            Object.freeze({
              sectionId: 'section-operational-summary',
              title: 'Operational Summary',
              category: 'agreements' as const,
              documents: Object.freeze(
                (model.requiredDocumentsSummary ?? []).map((code, index) =>
                  Object.freeze({
                    id: `required-${index}`,
                    title: code.replace(/_/g, ' '),
                    type: 'agreements' as const,
                    status: 'pending' as const,
                    createdAt: '2026-07-20T21:00:00.000Z',
                    updatedAt: '2026-07-20T21:00:00.000Z',
                    requiresSignature: true,
                    downloadAction: LEGAL_DOWNLOAD_COMING_SOON_ACTION,
                  }),
                ),
              ),
            }),
          ])
        : Object.freeze([]);

  return buildStaffShellFromViewModel(model, sections);
}

export async function buildArtistLegalCenterShellViewModel(
  provider: LegalProviderContext,
  input: { readonly profileId?: LegalProfileId; readonly viewerProfileId?: LegalProfileId },
): Promise<LegalCenterShellViewModel> {
  const profileId = input.profileId ?? LEGAL_FIXTURE_PROFILE_IDS.artistGreen;
  const model = await buildArtistLegalProfileViewModel(provider, {
    profileId,
    viewerProfileId: input.viewerProfileId ?? profileId,
  });
  const sections =
    model.state === 'ready'
      ? await buildSectionsForProfile(provider, profileId, 'artist', { includeTaxSection: true })
      : Object.freeze([]);
  return buildArtistShellFromViewModel(model, sections);
}

export async function buildClientLegalCenterShellViewModel(
  provider: LegalProviderContext,
  input: { readonly profileId?: LegalProfileId; readonly viewerProfileId?: LegalProfileId },
): Promise<LegalCenterShellViewModel> {
  const profileId = input.profileId ?? LEGAL_FIXTURE_PROFILE_IDS.client;
  const model = await buildClientLegalDocumentsViewModel(provider, {
    profileId,
    viewerProfileId: input.viewerProfileId ?? profileId,
  });
  const sections =
    model.state === 'ready'
      ? await buildSectionsForProfile(provider, profileId, 'client', { includeTaxSection: false })
      : Object.freeze([]);
  return buildClientShellFromViewModel(model, sections);
}
