/** In-memory legal service — read-only lab provider — TICKET-V2-LEGAL-IN-MEMORY-SERVICE-001 */

import type { LegalDocumentId, LegalProfileId, SignaturePackageId } from '../contracts/legal-ids';
import type { LegalDocument, LegalProfile } from '../contracts/legal-entities';
import type { LegalExpedienteSnapshot, LegalExpedienteSnapshotResult } from '../contracts/legal-projections';
import type { LegalServicePorts } from '../contracts/legal-service-ports';
import {
  canExternalSignerAccessPackage,
  projectExpedienteForViewer,
  type ExternalSignerPackageView,
  type LegalViewerContext,
  type SafeExpedienteView,
} from './legal-access-policy';
import { createLegalFixtureSeedState } from './legal-fixtures';
import { InMemoryLegalStore } from './in-memory-legal-store';
import {
  buildAuditTimelineForPackage,
  buildAuditTimelineForProfile,
  buildComplianceCenterView,
  buildDocumentsLibraryView,
  buildIntroductionRegistryView,
  buildNotificationsForProfile,
  buildPackageProgressView,
  buildPendingPackages,
  buildSignatureHistoryView,
  buildStaffLegalOverview,
  buildStatusSnapshot,
  buildTaxCenterView,
} from './legal-projection-builders';
import { resolveLegalStatus, type LegalStatusResolution } from './legal-status-resolver';

export type CreateInMemoryLegalServiceInput = {
  readonly store?: InMemoryLegalStore;
  readonly seedFixtures?: boolean;
};

export type InMemoryLegalService = LegalServicePorts & {
  readonly store: InMemoryLegalStore;
  getExpedienteSnapshotSync(legalProfileId: LegalProfileId): LegalExpedienteSnapshotResult;
  getProfileById(legalProfileId: LegalProfileId): LegalProfile | null;
  getDocumentById(documentId: LegalDocumentId): LegalDocument | null;
  listPackagesForProfile(legalProfileId: LegalProfileId): Promise<readonly ReturnType<typeof buildPackageProgressView>[]>;
  resolveLegalStatusForProfile(legalProfileId: LegalProfileId): LegalStatusResolution | null;
  projectExpedienteForViewer(
    legalProfileId: LegalProfileId,
    context: LegalViewerContext,
  ): SafeExpedienteView | null;
  getExternalSignerPackageView(
    viewerProfileId: LegalProfileId,
    packageId: SignaturePackageId,
  ): ExternalSignerPackageView | null;
  canExternalSignerAccessPackage(
    viewerProfileId: LegalProfileId,
    packageId: SignaturePackageId,
  ): boolean;
};

function buildExpedienteSnapshot(
  store: InMemoryLegalStore,
  legalProfileId: LegalProfileId,
): LegalExpedienteSnapshotResult {
  const state = store.getSnapshot();
  const profile = state.profiles.get(legalProfileId);
  if (!profile) {
    return Object.freeze({
      ok: false,
      code: 'LEGAL_PROFILE_NOT_FOUND',
      reason: `Legal profile not found: ${legalProfileId}`,
    });
  }

  const snapshot: LegalExpedienteSnapshot = Object.freeze({
    version: 1,
    profile,
    status: buildStatusSnapshot(profile),
    documentsLibrary: buildDocumentsLibraryView(state, legalProfileId),
    taxCenter: buildTaxCenterView(state, legalProfileId) ?? undefined,
    complianceCenter: buildComplianceCenterView(state, legalProfileId) ?? undefined,
    pendingPackages: buildPendingPackages(state, profile),
    notifications: buildNotificationsForProfile(state, legalProfileId),
  });

  return Object.freeze({ ok: true, snapshot });
}

function resolveStatusInput(store: InMemoryLegalStore, profileId: LegalProfileId) {
  const state = store.getSnapshot();
  const profile = state.profiles.get(profileId);
  if (!profile) {
    return null;
  }

  const documents = [...state.documents.values()].filter(
    (document) =>
      document.ownerProfileId === profileId || document.signerProfileIds.includes(profileId),
  );
  const taxProfile = profile.taxProfileId ? state.taxProfiles.get(profile.taxProfileId) ?? null : null;
  const complianceProfile = profile.complianceProfileId
    ? state.complianceProfiles.get(profile.complianceProfileId) ?? null
    : null;

  return resolveLegalStatus({
    profile,
    documents,
    taxProfile,
    complianceProfile,
    now: new Date('2026-07-20T21:00:00.000Z'),
  });
}

export function createInMemoryLegalService(
  input: CreateInMemoryLegalServiceInput = {},
): InMemoryLegalService {
  const store = input.store ?? new InMemoryLegalStore();
  if (input.seedFixtures !== false && !input.store) {
    store.seedFixtures();
  } else if (input.seedFixtures === true && input.store) {
    store.seedFixtures();
  }

  const getExpedienteSnapshotSync = (legalProfileId: LegalProfileId): LegalExpedienteSnapshotResult =>
    buildExpedienteSnapshot(store, legalProfileId);

  const ports: LegalServicePorts = {
    profile: {
      getExpedienteSnapshot: async (legalProfileId) => getExpedienteSnapshotSync(legalProfileId),
      getStatusSnapshot: async (legalProfileId) => {
        const profile = store.getProfile(legalProfileId);
        return profile ? buildStatusSnapshot(profile) : null;
      },
    },
    documents: {
      getLibraryView: async (legalProfileId) => {
        if (!store.getProfile(legalProfileId)) {
          return null;
        }
        return buildDocumentsLibraryView(store.getSnapshot(), legalProfileId);
      },
      getSignatureHistory: async (legalProfileId) => {
        if (!store.getProfile(legalProfileId)) {
          return null;
        }
        return buildSignatureHistoryView(store.getSnapshot(), legalProfileId);
      },
    },
    tax: {
      getTaxCenterView: async (legalProfileId) => {
        if (!store.getProfile(legalProfileId)) {
          return null;
        }
        return buildTaxCenterView(store.getSnapshot(), legalProfileId);
      },
    },
    compliance: {
      getComplianceCenterView: async (legalProfileId) => {
        if (!store.getProfile(legalProfileId)) {
          return null;
        }
        return buildComplianceCenterView(store.getSnapshot(), legalProfileId);
      },
    },
    introduction: {
      getIntroductionRegistryView: async (viewerProfileId) => {
        if (!store.getProfile(viewerProfileId)) {
          return null;
        }
        return buildIntroductionRegistryView(store.getSnapshot(), viewerProfileId);
      },
    },
    packages: {
      getPackageProgress: async (packageId) => buildPackageProgressView(store.getSnapshot(), packageId),
    },
    audit: {
      getAuditTimelineForProfile: async (legalProfileId) => {
        if (!store.getProfile(legalProfileId)) {
          return null;
        }
        return buildAuditTimelineForProfile(store.getSnapshot(), legalProfileId);
      },
      getAuditTimelineForPackage: async (packageId) => buildAuditTimelineForPackage(store.getSnapshot(), packageId),
    },
    staff: {
      getOverview: async () => buildStaffLegalOverview(store.getSnapshot()),
    },
  };

  return {
    ...ports,
    store,
    getExpedienteSnapshotSync,
    getProfileById: (legalProfileId) => store.getProfile(legalProfileId) ?? null,
    getDocumentById: (documentId) => store.getDocument(documentId) ?? null,
    listPackagesForProfile: async (legalProfileId) => {
      const packages = store.listPackagesForProfile(legalProfileId);
      return Object.freeze(
        packages
          .map((pkg) => buildPackageProgressView(store.getSnapshot(), pkg.packageId))
          .filter((view): view is NonNullable<typeof view> => view !== null),
      );
    },
    resolveLegalStatusForProfile: (legalProfileId) => resolveStatusInput(store, legalProfileId),
    projectExpedienteForViewer: (legalProfileId, context) => {
      const result = getExpedienteSnapshotSync(legalProfileId);
      if (!result.ok) {
        return null;
      }
      const signatureHistory = buildSignatureHistoryView(store.getSnapshot(), legalProfileId);
      const auditTimeline = buildAuditTimelineForProfile(store.getSnapshot(), legalProfileId);
      return projectExpedienteForViewer(result.snapshot, context, { signatureHistory, auditTimeline });
    },
    getExternalSignerPackageView: (viewerProfileId, packageId) => {
      const profile = store.getProfile(viewerProfileId);
      const assignedPackageId = profile?.activePackageIds?.[0];
      if (!canExternalSignerAccessPackage(viewerProfileId, assignedPackageId, packageId)) {
        return null;
      }
      const progress = buildPackageProgressView(store.getSnapshot(), packageId);
      if (!progress) {
        return null;
      }
      return Object.freeze({
        packageId: progress.packageId,
        packageCode: progress.packageCode,
        signingStatus: progress.signingStatus,
        progressRatio: progress.progressRatio,
        expiresAt: progress.expiresAt,
        documentCount: progress.documentCount,
        completedCount: progress.completedCount,
      });
    },
    canExternalSignerAccessPackage: (viewerProfileId, packageId) => {
      const profile = store.getProfile(viewerProfileId);
      return canExternalSignerAccessPackage(viewerProfileId, profile?.activePackageIds?.[0], packageId);
    },
  };
}

/** Back-compat alias for earlier DC-2 scaffold naming. */
export const createLegalInMemoryService = createInMemoryLegalService;

export type LegalInMemoryService = InMemoryLegalService;

export function createSeededInMemoryLegalStore(): InMemoryLegalStore {
  return new InMemoryLegalStore(createLegalFixtureSeedState());
}
