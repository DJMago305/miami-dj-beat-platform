/** Legal in-memory projections — TICKET-V2-LEGAL-IN-MEMORY-SERVICE-001 */

import type {
  AcceptanceRecord,
  AuditEvent,
  ComplianceProfile,
  IntroductionRecord,
  LegalDocument,
  LegalNotification,
  LegalProfile,
  SignaturePackage,
  SignatureRecord,
} from '../contracts/legal-entities';
import type { LegalProfileId, SignaturePackageId } from '../contracts/legal-ids';
import type {
  AuditTimelineView,
  ComplianceCenterView,
  ComplianceMatrixView,
  DocumentsLibraryRow,
  DocumentsLibraryView,
  IntroductionRegistryCard,
  IntroductionRegistryView,
  LegalCapabilities,
  LegalStatusSnapshot,
  PackageProgressView,
  SignatureHistoryEntry,
  SignatureHistoryView,
  StaffLegalOverview,
  TaxCenterView,
} from '../contracts/legal-projections';
import {
  assertAuditPayloadSafe,
  isPublicLegalLibraryDocument,
} from '../contracts/legal-projections';
import type { LegalRestriction } from '../contracts/legal-enums';
import type { InMemoryLegalStoreState } from './in-memory-legal-store';

const TEMPLATE_OFFICIAL_NAMES: Readonly<Record<string, string>> = Object.freeze({
  'LGL-001': 'Platform Terms of Service',
  'LGL-002': 'Privacy Policy',
  'LGL-003': 'Anti-Bypass Policy',
  'CTR-001': 'DJ Partner Agreement',
  'CTR-002': 'Independent Contractor Agreement',
  'SPC-001': 'W-9 Request for Taxpayer Identification',
  'SPC-002': 'Certificate of Insurance',
});

export function deriveCapabilities(restrictions: readonly LegalRestriction[]): LegalCapabilities {
  return Object.freeze({
    matching: !restrictions.includes('no_matching'),
    payout: !restrictions.includes('no_payout'),
    bookingAccept: !restrictions.includes('no_booking_accept'),
    corporateEvents: !restrictions.includes('no_corporate'),
  });
}

function resolveOfficialName(templateCode: string): string {
  return TEMPLATE_OFFICIAL_NAMES[templateCode] ?? templateCode;
}

function documentBelongsToProfile(document: LegalDocument, profileId: LegalProfileId): boolean {
  return (
    document.ownerProfileId === profileId ||
    document.signerProfileIds.includes(profileId)
  );
}

function toLibraryRow(document: LegalDocument): DocumentsLibraryRow {
  return Object.freeze({
    documentId: document.documentId,
    officialName: resolveOfficialName(document.templateCode),
    templateCode: document.templateCode,
    category: document.category,
    versionLabel: document.versionLabel,
    signedOrAcceptedAt: document.signedAt,
    lifecycleStatus: document.lifecycleStatus,
    expiresAt: document.expiresAt,
    finalArtifactId: document.finalArtifactId,
    orderId: document.orderId,
  });
}

export function buildStatusSnapshot(profile: LegalProfile): LegalStatusSnapshot {
  return Object.freeze({
    legalProfileId: profile.legalProfileId,
    aggregateStatus: profile.aggregateStatus,
    statusItems: profile.statusItems,
    restrictions: profile.restrictions,
    capabilities: deriveCapabilities(profile.restrictions),
    computedAt: profile.statusComputedAt,
  });
}

export function buildDocumentsLibraryView(
  state: InMemoryLegalStoreState,
  profileId: LegalProfileId,
): DocumentsLibraryView {
  const rows = [...state.documents.values()]
    .filter((document) => documentBelongsToProfile(document, profileId))
    .map(toLibraryRow)
    .filter(isPublicLegalLibraryDocument);

  return Object.freeze({
    legalProfileId: profileId,
    rows: Object.freeze(rows),
    taxCenterSeparateNotice: true as const,
  });
}

function resolveSignerLegalName(
  state: InMemoryLegalStoreState,
  profileId: LegalProfileId,
): string {
  return state.profiles.get(profileId)?.legalName ?? profileId;
}

export function buildSignatureHistoryView(
  state: InMemoryLegalStoreState,
  profileId: LegalProfileId,
): SignatureHistoryView {
  const profileDocumentIds = new Set(
    [...state.documents.values()]
      .filter((document) => documentBelongsToProfile(document, profileId))
      .map((document) => document.documentId),
  );

  const signatureEntries: SignatureHistoryEntry[] = [...state.signatureRecords.values()]
    .filter((record) => record.signerProfileId === profileId)
    .filter((record) => profileDocumentIds.has(record.documentId))
    .map((record) => toSignatureHistoryEntry(state, record));

  const acceptanceEntries: SignatureHistoryEntry[] = [...state.acceptanceRecords.values()]
    .filter((record) => record.acceptorProfileId === profileId)
    .filter((record) => profileDocumentIds.has(record.documentId))
    .map((record) => toAcceptanceHistoryEntry(state, record));

  const entries = Object.freeze(
    [...signatureEntries, ...acceptanceEntries].sort((left, right) =>
      right.recordedAt.localeCompare(left.recordedAt),
    ),
  );

  return Object.freeze({
    legalProfileId: profileId,
    entries,
  });
}

function toSignatureHistoryEntry(
  state: InMemoryLegalStoreState,
  record: SignatureRecord,
): SignatureHistoryEntry {
  const document = state.documents.get(record.documentId);
  return Object.freeze({
    entryId: record.signatureId,
    entryKind: 'signature' as const,
    documentId: record.documentId,
    templateCode: document?.templateCode ?? 'unknown',
    versionLabel: document?.versionLabel ?? '0.0',
    recordedAt: record.recordedAt,
    signatureType: record.signatureType,
    locale: record.locale,
    signerLegalName: resolveSignerLegalName(state, record.signerProfileId),
  });
}

function toAcceptanceHistoryEntry(
  state: InMemoryLegalStoreState,
  record: AcceptanceRecord,
): SignatureHistoryEntry {
  const document = state.documents.get(record.documentId);
  return Object.freeze({
    entryId: record.acceptanceId,
    entryKind: 'acceptance' as const,
    documentId: record.documentId,
    templateCode: record.templateCode,
    versionLabel: document?.versionLabel ?? '0.0',
    recordedAt: record.acceptedAt,
    acceptanceMethod: record.acceptanceMethod,
    locale: document?.locale ?? 'en',
    signerLegalName: resolveSignerLegalName(state, record.acceptorProfileId),
  });
}

export function buildTaxCenterView(
  state: InMemoryLegalStoreState,
  profileId: LegalProfileId,
): TaxCenterView | null {
  const profile = state.profiles.get(profileId);
  if (!profile?.taxProfileId) {
    return null;
  }

  const taxProfile = state.taxProfiles.get(profile.taxProfileId);
  if (!taxProfile) {
    return null;
  }

  return Object.freeze({
    taxProfileId: taxProfile.taxProfileId,
    legalProfileId: profileId,
    w9Status: taxProfile.w9Status,
    tinLast4: taxProfile.tinLast4,
    approvedAt: taxProfile.approvedAt,
    w9DocumentId: taxProfile.w9DocumentId,
    w9ArtifactId: taxProfile.w9ArtifactId,
    rejectionReasonCode: taxProfile.rejectionReasonCode,
  });
}

export function buildComplianceCenterView(
  state: InMemoryLegalStoreState,
  profileId: LegalProfileId,
): ComplianceCenterView | null {
  const profile = state.profiles.get(profileId);
  if (!profile?.complianceProfileId) {
    return null;
  }

  const complianceProfile = state.complianceProfiles.get(profile.complianceProfileId);
  if (!complianceProfile) {
    return null;
  }

  return Object.freeze({
    legalProfileId: profileId,
    aggregateCompliance: complianceProfile.aggregateCompliance,
    matrices: buildComplianceMatrices(complianceProfile),
    evaluatedAt: complianceProfile.evaluatedAt,
  });
}

function buildComplianceMatrices(
  complianceProfile: ComplianceProfile,
): readonly ComplianceMatrixView[] {
  return Object.freeze(
    (Object.keys(complianceProfile.matrices) as Array<keyof ComplianceProfile['matrices']>)
      .filter((eventType) => complianceProfile.matrices[eventType] !== undefined)
      .map((eventType) =>
        Object.freeze({
          eventType,
          aggregateState: complianceProfile.aggregateCompliance,
          cells: complianceProfile.matrices[eventType] ?? [],
        }),
      ),
  );
}

export function buildIntroductionRegistryView(
  state: InMemoryLegalStoreState,
  viewerProfileId: LegalProfileId,
): IntroductionRegistryView {
  const cards: IntroductionRegistryCard[] = [...state.introductions.values()]
    .filter(
      (record) =>
        record.performerProfileId === viewerProfileId ||
        record.counterpartyProfileId === viewerProfileId,
    )
    .map((record) => toIntroductionCard(record));

  return Object.freeze({
    viewerProfileId,
    cards: Object.freeze(cards),
  });
}

function toIntroductionCard(record: IntroductionRecord): IntroductionRegistryCard {
  return Object.freeze({
    introductionId: record.introductionId,
    platformParty: record.platformParty,
    performerDisplayName: record.performerDisplayName,
    counterpartyName: record.counterpartyName,
    counterpartyType: record.counterpartyType,
    introductionDate: record.introductionDate,
    introductionSource: record.introductionSource,
    introductionEvidence: record.introductionEvidence,
    protectionStatus: record.protectionStatus,
    protectionExpiresAt: record.protectionExpiresAt,
  });
}

export function buildPackageProgressView(
  state: InMemoryLegalStoreState,
  packageId: SignaturePackageId,
): PackageProgressView | null {
  const pkg = state.packages.get(packageId);
  if (!pkg) {
    return null;
  }

  return Object.freeze({
    packageId: pkg.packageId,
    packageCode: pkg.packageCode,
    signingStatus: pkg.signingStatus,
    documentCount: pkg.documentCount,
    completedCount: pkg.completedCount,
    progressRatio: pkg.progressRatio,
    expiresAt: pkg.expiresAt,
    items: pkg.items,
  });
}

function sanitizeAuditEvent(event: AuditEvent): AuditEvent {
  assertAuditPayloadSafe(event.payload);
  return event;
}

export function buildAuditTimelineForProfile(
  state: InMemoryLegalStoreState,
  profileId: LegalProfileId,
): AuditTimelineView {
  const events = state.auditEvents
    .filter((event) => event.legalProfileId === profileId)
    .map(sanitizeAuditEvent);

  return Object.freeze({
    legalProfileId: profileId,
    events: Object.freeze(events),
  });
}

export function buildAuditTimelineForPackage(
  state: InMemoryLegalStoreState,
  packageId: SignaturePackageId,
): AuditTimelineView {
  const events = state.auditEvents
    .filter((event) => event.packageId === packageId)
    .map(sanitizeAuditEvent);

  return Object.freeze({
    packageId,
    events: Object.freeze(events),
  });
}

function isPendingPackageStatus(status: SignaturePackage['signingStatus']): boolean {
  return (
    status === 'DELIVERED' ||
    status === 'OPENED' ||
    status === 'STARTED' ||
    status === 'IN_PROGRESS' ||
    status === 'WAITING_SIGNATURE'
  );
}

export function buildPendingPackages(
  state: InMemoryLegalStoreState,
  profile: LegalProfile,
): readonly PackageProgressView[] {
  const packageIds = profile.activePackageIds ?? [];
  return Object.freeze(
    packageIds
      .map((packageId) => state.packages.get(packageId))
      .filter((pkg): pkg is SignaturePackage => pkg !== undefined)
      .filter((pkg) => isPendingPackageStatus(pkg.signingStatus))
      .map((pkg) => buildPackageProgressView(state, pkg.packageId))
      .filter((view): view is PackageProgressView => view !== null),
  );
}

export function buildNotificationsForProfile(
  state: InMemoryLegalStoreState,
  profileId: LegalProfileId,
): readonly LegalNotification[] {
  return Object.freeze(
    [...state.notifications.values()]
      .filter((notification) => notification.recipientProfileId === profileId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  );
}

function isExpiringWithinHours(isoDate: string, hours: number, now: Date): boolean {
  const expiresAt = Date.parse(isoDate);
  if (Number.isNaN(expiresAt)) {
    return false;
  }
  const windowMs = hours * 60 * 60 * 1000;
  return expiresAt > now.getTime() && expiresAt <= now.getTime() + windowMs;
}

export function buildStaffLegalOverview(state: InMemoryLegalStoreState, now = new Date()): StaffLegalOverview {
  let pendingSignatures = 0;
  let missingW9 = 0;
  let expiredInsurance = 0;
  let corporateBlocked = 0;
  let complianceAlerts = 0;
  let packagesExpiring48h = 0;

  for (const pkg of state.packages.values()) {
    if (isPendingPackageStatus(pkg.signingStatus)) {
      pendingSignatures += 1;
    }
    if (isExpiringWithinHours(pkg.expiresAt, 48, now)) {
      packagesExpiring48h += 1;
    }
  }

  for (const taxProfile of state.taxProfiles.values()) {
    if (taxProfile.w9Status === 'missing' || taxProfile.w9Status === 'rejected') {
      missingW9 += 1;
    }
  }

  for (const profile of state.profiles.values()) {
    if (profile.restrictions.includes('no_corporate')) {
      corporateBlocked += 1;
    }
    if (profile.aggregateStatus !== 'GREEN') {
      complianceAlerts += 1;
    }
    if (profile.statusItems.some((item) => item.itemCode === 'insurance' && item.itemState === 'red')) {
      expiredInsurance += 1;
    }
  }

  return Object.freeze({
    pendingSignatures,
    missingW9,
    expiredInsurance,
    corporateBlocked,
    complianceAlerts,
    packagesExpiring48h,
  });
}
