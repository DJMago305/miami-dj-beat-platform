/** Legal service ports — read contracts only (DC-1) — TICKET-V2-LEGAL-DATA-CONTRACTS-SPEC-001 */

import type { LegalProfileId, SignaturePackageId } from './legal-ids';
import type {
  AuditTimelineView,
  ComplianceCenterView,
  DocumentsLibraryView,
  IntroductionRegistryView,
  LegalExpedienteSnapshotResult,
  LegalStatusSnapshot,
  PackageProgressView,
  SignatureHistoryView,
  StaffLegalOverview,
  TaxCenterView,
} from './legal-projections';

/** Read-only ports — implementations in DC-4 (mock) / DC-5 (Postgres). */
export type LegalProfilePort = {
  getExpedienteSnapshot(legalProfileId: LegalProfileId): Promise<LegalExpedienteSnapshotResult>;
  getStatusSnapshot(legalProfileId: LegalProfileId): Promise<LegalStatusSnapshot | null>;
};

export type LegalDocumentsPort = {
  getLibraryView(legalProfileId: LegalProfileId): Promise<DocumentsLibraryView | null>;
  getSignatureHistory(legalProfileId: LegalProfileId): Promise<SignatureHistoryView | null>;
};

export type LegalTaxPort = {
  getTaxCenterView(legalProfileId: LegalProfileId): Promise<TaxCenterView | null>;
};

export type LegalCompliancePort = {
  getComplianceCenterView(legalProfileId: LegalProfileId): Promise<ComplianceCenterView | null>;
};

export type LegalIntroductionPort = {
  getIntroductionRegistryView(viewerProfileId: LegalProfileId): Promise<IntroductionRegistryView | null>;
};

export type LegalPackagePort = {
  getPackageProgress(packageId: SignaturePackageId): Promise<PackageProgressView | null>;
};

export type LegalAuditPort = {
  getAuditTimelineForProfile(legalProfileId: LegalProfileId): Promise<AuditTimelineView | null>;
  getAuditTimelineForPackage(packageId: SignaturePackageId): Promise<AuditTimelineView | null>;
};

export type StaffLegalPort = {
  getOverview(): Promise<StaffLegalOverview>;
};

export type LegalServicePorts = {
  readonly profile: LegalProfilePort;
  readonly documents: LegalDocumentsPort;
  readonly tax: LegalTaxPort;
  readonly compliance: LegalCompliancePort;
  readonly introduction: LegalIntroductionPort;
  readonly packages: LegalPackagePort;
  readonly audit: LegalAuditPort;
  readonly staff: StaffLegalPort;
};
