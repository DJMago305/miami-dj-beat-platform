/** Legal portal adapters — TICKET-V2-LEGAL-PROVIDER-FACTORY-PORTAL-INJECTION-001 */

import type { LegalProfileId } from '../contracts/legal-ids';
import type { LegalAggregateStatus } from '../contracts/legal-enums';
import { FORBIDDEN_AUDIT_PAYLOAD_KEYS } from '../contracts/legal-projections';
import { LEGAL_FIXTURE_PROFILE_IDS } from '../in-memory/legal-fixtures';
import type { LegalProviderContext } from './legal-provider-factory';
import type {
  ArtistLegalProfileViewModel,
  ClientLegalDocumentsViewModel,
  StaffLegalCenterViewModel,
  StaffLegalPortalRole,
} from './legal-portal-view-models';

export type StaffLegalPortalAdapterInput = {
  readonly role: StaffLegalPortalRole;
};

export type ArtistLegalPortalAdapterInput = {
  readonly profileId?: LegalProfileId;
  readonly viewerProfileId?: LegalProfileId;
};

export type ClientLegalPortalAdapterInput = {
  readonly profileId?: LegalProfileId;
  readonly viewerProfileId?: LegalProfileId;
};

const STAFF_ROLE_LABELS: Record<StaffLegalPortalRole, string> = {
  staff_owner: 'Staff Owner',
  staff_manager: 'Staff Manager',
  staff_seller: 'Staff Seller',
};

function countByStatus(
  provider: LegalProviderContext,
  status: LegalAggregateStatus,
): number {
  return provider.listFixtureProfileIds().filter((profileId) => {
    const snapshot = provider.getExpedienteSnapshotSync(profileId);
    return snapshot.ok && snapshot.snapshot.profile.aggregateStatus === status;
  }).length;
}

async function countActiveIntroductions(provider: LegalProviderContext): Promise<number> {
  let total = 0;
  for (const profileId of provider.listFixtureProfileIds()) {
    const registry = await provider.ports.introduction.getIntroductionRegistryView(profileId);
    total += registry?.cards.filter((card) => card.protectionStatus === 'active').length ?? 0;
  }
  return total;
}

export async function buildStaffLegalCenterViewModel(
  provider: LegalProviderContext,
  input: StaffLegalPortalAdapterInput,
): Promise<StaffLegalCenterViewModel> {
  const overview = await provider.ports.staff.getOverview();
  const profileIds = provider.listFixtureProfileIds();
  const activeIntroductions = await countActiveIntroductions(provider);

  const base: StaffLegalCenterViewModel = Object.freeze({
    state: 'ready',
    role: input.role,
    previewLabel: STAFF_ROLE_LABELS[input.role],
    summary: Object.freeze({
      profileCount: profileIds.length,
      greenCount: countByStatus(provider, 'GREEN'),
      yellowCount: countByStatus(provider, 'YELLOW'),
      redCount: countByStatus(provider, 'RED'),
      pendingSignatures: overview.pendingSignatures,
      missingW9: overview.missingW9,
      activeIntroductions,
    }),
  });

  if (input.role === 'staff_seller') {
    return Object.freeze({
      ...base,
      restrictionsSummary: Object.freeze(['no_matching', 'no_payout', 'no_corporate']),
      requiredDocumentsSummary: Object.freeze(['partner_agreement', 'insurance']),
      complianceSummary: 'summary-only',
    });
  }

  const greenTax = await provider.ports.tax.getTaxCenterView(LEGAL_FIXTURE_PROFILE_IDS.artistGreen);
  const projected = provider.projectExpedienteForViewer(LEGAL_FIXTURE_PROFILE_IDS.artistGreen, {
    role: input.role,
    subjectProfileId: LEGAL_FIXTURE_PROFILE_IDS.artistGreen,
  });

  return Object.freeze({
    ...base,
    maskedW9Status: projected?.taxCenter?.w9Status ?? greenTax?.w9Status,
  });
}

export async function buildArtistLegalProfileViewModel(
  provider: LegalProviderContext,
  input: ArtistLegalPortalAdapterInput,
): Promise<ArtistLegalProfileViewModel> {
  const profileId = input.profileId ?? LEGAL_FIXTURE_PROFILE_IDS.artistGreen;
  const viewerProfileId = input.viewerProfileId ?? profileId;

  if (viewerProfileId !== profileId) {
    return Object.freeze({
      state: 'forbidden',
      message: 'Artist legal profile access is limited to the signed-in performer.',
    });
  }

  const snapshotResult = provider.getExpedienteSnapshotSync(profileId);
  if (!snapshotResult.ok) {
    return Object.freeze({
      state: 'not_found',
      message: 'No legal profile available for this artist fixture.',
    });
  }

  const projected = provider.projectExpedienteForViewer(profileId, {
    role: 'artist',
    viewerProfileId,
    subjectProfileId: profileId,
  });

  if (!projected) {
    return Object.freeze({
      state: 'forbidden',
      message: 'Artist legal profile projection denied.',
    });
  }

  const resolution = provider.resolveLegalStatusForProfile(profileId);
  const signedDocumentsCount = projected.documentsLibrary.rows.filter(
    (row) => row.lifecycleStatus === 'COMPLETED',
  ).length;

  return Object.freeze({
    state: 'ready',
    legalStatus: resolution?.status ?? projected.status.aggregateStatus,
    signedDocumentsCount,
    w9Status: projected.taxCenter?.w9Status,
    complianceState: projected.complianceCenter?.aggregateCompliance,
    activeIntroductions: (
      await provider.ports.introduction.getIntroductionRegistryView(profileId)
    )?.cards.filter((card) => card.protectionStatus === 'active').length ?? 0,
    pendingDocuments: projected.pendingPackages.length,
    expiringItems: projected.notifications.length,
  });
}

export async function buildClientLegalDocumentsViewModel(
  provider: LegalProviderContext,
  input: ClientLegalPortalAdapterInput,
): Promise<ClientLegalDocumentsViewModel> {
  const profileId = input.profileId ?? LEGAL_FIXTURE_PROFILE_IDS.client;
  const viewerProfileId = input.viewerProfileId ?? profileId;

  if (viewerProfileId !== profileId) {
    return Object.freeze({
      state: 'forbidden',
      message: 'Client documents are limited to the signed-in account.',
    });
  }

  const snapshotResult = provider.getExpedienteSnapshotSync(profileId);
  if (!snapshotResult.ok) {
    return Object.freeze({
      state: 'not_found',
      message: 'No legal documents available for this client fixture.',
    });
  }

  const projected = provider.projectExpedienteForViewer(profileId, {
    role: 'client',
    viewerProfileId,
    subjectProfileId: profileId,
  });

  if (!projected) {
    return Object.freeze({
      state: 'forbidden',
      message: 'Client legal documents projection denied.',
    });
  }

  const contractsCount = projected.documentsLibrary.rows.filter((row) => row.category === 'CTR').length;
  const signedCount = projected.documentsLibrary.rows.filter(
    (row) => row.lifecycleStatus === 'COMPLETED',
  ).length;
  const pendingCount = projected.pendingPackages.length;
  const downloadableArtifactsCount = projected.documentsLibrary.rows.filter(
    (row) => row.finalArtifactId !== undefined,
  ).length;

  return Object.freeze({
    state: 'ready',
    contractsCount,
    signedCount,
    pendingCount,
    downloadableArtifactsCount,
  });
}

export const FORBIDDEN_VIEW_MODEL_KEYS = [
  ...FORBIDDEN_AUDIT_PAYLOAD_KEYS,
  'tinFull',
  'tokenId',
  'signatureRaw',
  'signaturePayloadHash',
  'store',
] as const;

export function assertViewModelSafe(value: unknown, path = 'viewModel'): void {
  if (value === null || typeof value !== 'object') {
    return;
  }

  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      assertViewModelSafe(item, `${path}[${index}]`);
    }
    return;
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if ((FORBIDDEN_VIEW_MODEL_KEYS as readonly string[]).includes(key)) {
      throw new Error(`Forbidden view model key at ${path}.${key}`);
    }
    assertViewModelSafe(nested, `${path}.${key}`);
  }
}
