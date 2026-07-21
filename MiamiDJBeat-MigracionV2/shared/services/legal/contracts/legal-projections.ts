/** Legal data contracts — read models & ACL — TICKET-V2-LEGAL-DATA-CONTRACTS-SPEC-001 */

import type {
  AcceptanceRecordId,
  LegalDocumentId,
  LegalProfileId,
  SignaturePackageId,
  SignatureRecordId,
  TaxProfileId,
} from './legal-ids';
import type {
  AcceptanceRecord,
  AuditEvent,
  ComplianceProfile,
  IntroductionRecord,
  LegalDocument,
  LegalNotification,
  LegalProfile,
  LegalStatusItem,
  SignaturePackage,
  SignatureRecord,
  TaxProfile,
} from './legal-entities';
import type {
  ComplianceAggregateState,
  ComplianceEventType,
  LegalAggregateStatus,
  LegalRestriction,
} from './legal-enums';

/** Projection — LGC-002 Legal Status snapshot for gates and UI. */
export type LegalStatusSnapshot = {
  readonly legalProfileId: LegalProfileId;
  readonly aggregateStatus: LegalAggregateStatus;
  readonly statusItems: readonly LegalStatusItem[];
  readonly restrictions: readonly LegalRestriction[];
  readonly capabilities: LegalCapabilities;
  readonly computedAt: string;
};

export type LegalCapabilities = {
  readonly matching: boolean;
  readonly payout: boolean;
  readonly bookingAccept: boolean;
  readonly corporateEvents: boolean;
};

/** Projection — LGC-003 Documents Library row (excludes SPC-001 W-9 from main list). */
export type DocumentsLibraryRow = {
  readonly documentId: LegalDocumentId;
  readonly officialName: string;
  readonly templateCode: string;
  readonly category: 'LGL' | 'CTR' | 'SPC';
  readonly versionLabel: string;
  readonly signedOrAcceptedAt?: string;
  readonly lifecycleStatus: LegalDocument['lifecycleStatus'];
  readonly expiresAt?: string;
  readonly finalArtifactId?: LegalDocument['finalArtifactId'];
  readonly orderId?: LegalDocument['orderId'];
};

export type DocumentsLibraryView = {
  readonly legalProfileId: LegalProfileId;
  readonly rows: readonly DocumentsLibraryRow[];
  readonly taxCenterSeparateNotice: true;
};

/** Projection — LGC-004 Signature History entry. */
export type SignatureHistoryEntry = {
  readonly entryId: SignatureRecordId | AcceptanceRecordId;
  readonly entryKind: 'signature' | 'acceptance';
  readonly documentId: LegalDocumentId;
  readonly templateCode: string;
  readonly versionLabel: string;
  readonly recordedAt: string;
  readonly signatureType?: SignatureRecord['signatureType'];
  readonly acceptanceMethod?: AcceptanceRecord['acceptanceMethod'];
  readonly locale: SignatureRecord['locale'];
  readonly deviceClass?: string;
  readonly browserFamily?: string;
  readonly ipHashPartial?: string;
  readonly signerLegalName: string;
};

export type SignatureHistoryView = {
  readonly legalProfileId: LegalProfileId;
  readonly entries: readonly SignatureHistoryEntry[];
};

/** Projection — LGX package card / LGS progress. */
export type PackageProgressView = {
  readonly packageId: SignaturePackageId;
  readonly packageCode: string;
  readonly signingStatus: SignaturePackage['signingStatus'];
  readonly documentCount: number;
  readonly completedCount: number;
  readonly progressRatio: string;
  readonly expiresAt: string;
  readonly items: SignaturePackage['items'];
};

/** Projection — LGC-005 Tax & W-9 Center (no tin_full). */
export type TaxCenterView = {
  readonly taxProfileId: TaxProfileId;
  readonly legalProfileId: LegalProfileId;
  readonly w9Status: TaxProfile['w9Status'];
  readonly tinLast4?: string;
  readonly approvedAt?: string;
  readonly w9DocumentId?: LegalDocumentId;
  readonly w9ArtifactId?: TaxProfile['w9ArtifactId'];
  readonly rejectionReasonCode?: string;
};

/** Projection — LGC-006 Compliance Center for one event type. */
export type ComplianceMatrixView = {
  readonly eventType: ComplianceEventType;
  readonly aggregateState: ComplianceAggregateState;
  readonly cells: ComplianceProfile['matrices'][ComplianceEventType];
};

export type ComplianceCenterView = {
  readonly legalProfileId: LegalProfileId;
  readonly aggregateCompliance: ComplianceAggregateState;
  readonly matrices: readonly ComplianceMatrixView[];
  readonly evaluatedAt: string;
};

/** Projection — LGC-007 Introduction Registry card. */
export type IntroductionRegistryCard = Pick<
  IntroductionRecord,
  | 'introductionId'
  | 'platformParty'
  | 'performerDisplayName'
  | 'counterpartyName'
  | 'counterpartyType'
  | 'introductionDate'
  | 'introductionSource'
  | 'introductionEvidence'
  | 'protectionStatus'
  | 'protectionExpiresAt'
>;

export type IntroductionRegistryView = {
  readonly viewerProfileId: LegalProfileId;
  readonly cards: readonly IntroductionRegistryCard[];
};

/** Projection — LGX-009 Audit Timeline. */
export type AuditTimelineView = {
  readonly legalProfileId?: LegalProfileId;
  readonly packageId?: SignaturePackageId;
  readonly events: readonly AuditEvent[];
};

/** Projection — Staff Legal Center overview KPIs. */
export type StaffLegalOverview = {
  readonly pendingSignatures: number;
  readonly missingW9: number;
  readonly expiredInsurance: number;
  readonly corporateBlocked: number;
  readonly complianceAlerts: number;
  readonly packagesExpiring48h: number;
};

/** Full expediente read model for Legal Center dashboard. */
export type LegalExpedienteSnapshot = {
  readonly version: 1;
  readonly profile: LegalProfile;
  readonly status: LegalStatusSnapshot;
  readonly documentsLibrary: DocumentsLibraryView;
  readonly taxCenter?: TaxCenterView;
  readonly complianceCenter?: ComplianceCenterView;
  readonly pendingPackages: readonly PackageProgressView[];
  readonly notifications: readonly LegalNotification[];
};

export type LegalExpedienteSnapshotResult =
  | { readonly ok: true; readonly snapshot: LegalExpedienteSnapshot }
  | { readonly ok: false; readonly code: LegalContractErrorCode; readonly reason?: string };

export type LegalContractErrorCode =
  | 'LEGAL_PROFILE_NOT_FOUND'
  | 'LEGAL_SNAPSHOT_INVALID'
  | 'LEGAL_TAX_ACCESS_DENIED'
  | 'LEGAL_DOCUMENT_NOT_FOUND';

export class LegalContractError extends Error {
  readonly code: LegalContractErrorCode;

  constructor(code: LegalContractErrorCode, message: string) {
    super(message);
    this.name = 'LegalContractError';
    this.code = code;
  }
}

/** Documents library filter — excludes fiscal W-9 from main list per TP-01. */
export const isPublicLegalLibraryDocument = (row: DocumentsLibraryRow): boolean =>
  row.templateCode !== 'SPC-001';

/** Audit payload guard — repositories must not persist forbidden keys. */
export const FORBIDDEN_AUDIT_PAYLOAD_KEYS = [
  'tin',
  'tinFull',
  'ssn',
  'signatureBitmap',
  'signatureRaw',
] as const;

export type ForbiddenAuditPayloadKey = (typeof FORBIDDEN_AUDIT_PAYLOAD_KEYS)[number];

export const assertAuditPayloadSafe = (payload: Readonly<Record<string, unknown>> | undefined): void => {
  if (!payload) return;
  for (const key of FORBIDDEN_AUDIT_PAYLOAD_KEYS) {
    if (key in payload) {
      throw new LegalContractError('LEGAL_SNAPSHOT_INVALID', `Forbidden audit payload key: ${key}`);
    }
  }
};
