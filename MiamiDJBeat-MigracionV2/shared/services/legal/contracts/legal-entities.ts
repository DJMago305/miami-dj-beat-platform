/** Legal data contracts — LDC entities — TICKET-V2-LEGAL-DATA-CONTRACTS-SPEC-001 */

import type {
  AcceptanceRecordId,
  AuditEventId,
  ComplianceProfileId,
  FinalArtifactId,
  IntroductionRecordId,
  LegalDocumentId,
  LegalNotificationId,
  LegalProfileId,
  LegalTemplateId,
  MdjUserId,
  MdjbPublicId,
  OrderId,
  SignaturePackageId,
  SignatureRecordId,
  SigningSessionId,
  StaffUserId,
  TaxProfileId,
  TemplateVersionId,
} from './legal-ids';
import type {
  AcceptanceMethod,
  AuditActorType,
  ComplianceAggregateState,
  ComplianceEventType,
  ComplianceRequirementState,
  CounterpartyType,
  DeviceClass,
  FinalArtifactType,
  IntroductionSource,
  LegalAggregateStatus,
  LegalDocumentCategory,
  LegalDocumentLifecycleStatus,
  LegalLocale,
  LegalNotificationChannel,
  LegalNotificationSeverity,
  LegalNotificationType,
  LegalRestriction,
  LegalStatusItemState,
  LegalSubjectType,
  LegalTemplateStatus,
  PackageItemStatus,
  PackagePriority,
  ProtectionStatus,
  RecipientRole,
  SignaturePackageSigningStatus,
  SignatureType,
  SigningAuthMode,
  SigningSessionStatus,
  SigningWizardStep,
  W9Status,
  LegalAclSubject,
} from './legal-enums';

export type LegalDocumentPermissions = {
  readonly read: readonly LegalAclSubject[];
  readonly download: readonly LegalAclSubject[];
  readonly sign: readonly LegalAclSubject[];
};

export type LegalStatusItem = {
  readonly itemCode: string;
  readonly itemState: LegalStatusItemState;
  readonly labelKey: string;
  readonly expiresAt?: string;
  readonly blocks?: readonly LegalRestriction[];
};

/** LDC-001 — LegalProfile */
export type LegalProfile = {
  readonly legalProfileId: LegalProfileId;
  readonly subjectType: LegalSubjectType;
  readonly userId?: MdjUserId;
  readonly mdjbId?: MdjbPublicId;
  readonly legalName: string;
  readonly primaryEmail: string;
  readonly aggregateStatus: LegalAggregateStatus;
  readonly statusComputedAt: string;
  readonly statusItems: readonly LegalStatusItem[];
  readonly restrictions: readonly LegalRestriction[];
  readonly documentIds?: readonly LegalDocumentId[];
  readonly taxProfileId?: TaxProfileId;
  readonly complianceProfileId?: ComplianceProfileId;
  readonly introductionIds?: readonly IntroductionRecordId[];
  readonly activePackageIds?: readonly SignaturePackageId[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

/** LDC-002 — LegalDocument */
export type LegalDocument = {
  readonly documentId: LegalDocumentId;
  readonly templateCode: string;
  readonly category: LegalDocumentCategory;
  readonly templateVersionId: TemplateVersionId;
  readonly versionLabel: string;
  readonly ownerProfileId: LegalProfileId;
  readonly signerProfileIds: readonly LegalProfileId[];
  readonly packageId?: SignaturePackageId;
  readonly orderId?: OrderId;
  readonly fieldValues?: Readonly<Record<string, unknown>>;
  readonly lifecycleStatus: LegalDocumentLifecycleStatus;
  readonly signedAt?: string;
  readonly expiresAt?: string;
  readonly supersededByDocumentId?: LegalDocumentId;
  readonly finalArtifactId?: FinalArtifactId;
  readonly permissions: LegalDocumentPermissions;
  readonly locale: LegalLocale;
  readonly createdAt: string;
};

/** LDC-003 — LegalTemplate */
export type LegalTemplate = {
  readonly templateId: LegalTemplateId;
  readonly templateCode: string;
  readonly category: LegalDocumentCategory;
  readonly officialName: string;
  readonly currentPublishedVersionId?: TemplateVersionId;
  readonly signaturePlanDefault: Readonly<Record<string, unknown>>;
  readonly fieldSchemaDefault: Readonly<Record<string, unknown>>;
  readonly isPolicy: boolean;
  readonly requiresCountersign: boolean;
  readonly counselReviewRequired: boolean;
  readonly status: LegalTemplateStatus;
};

/** LDC-004 — TemplateVersion */
export type TemplateVersion = {
  readonly templateVersionId: TemplateVersionId;
  readonly templateId: LegalTemplateId;
  readonly semver: string;
  readonly contentHash: string;
  readonly publishedAt: string;
  readonly publishedByStaffId: StaffUserId;
  readonly localeBodies: Readonly<Partial<Record<LegalLocale, string>>>;
  readonly effectiveFrom: string;
  readonly retiredAt?: string;
};

export type SignaturePackageItem = {
  readonly itemOrder: number;
  readonly templateCode: string;
  readonly documentId?: LegalDocumentId;
  readonly itemStatus: PackageItemStatus;
  readonly requiresCountersign: boolean;
};

export type SignerAssignment = {
  readonly signerProfileId: LegalProfileId;
  readonly signerRole: RecipientRole;
  readonly signerEmail: string;
  readonly signOrder: number;
};

export type PackageDependencyRule = {
  readonly beforeTemplateCode: string;
  readonly afterTemplateCode: string;
};

/** LDC-005 — SignaturePackage */
export type SignaturePackage = {
  readonly packageId: SignaturePackageId;
  readonly packageCode: string;
  readonly recipientProfileId?: LegalProfileId;
  readonly recipientEmail: string;
  readonly recipientLegalName: string;
  readonly recipientRole: RecipientRole;
  readonly createdByStaffId: StaffUserId;
  readonly presetId?: string;
  readonly signingStatus: SignaturePackageSigningStatus;
  readonly documentCount: number;
  readonly completedCount: number;
  readonly progressRatio: string;
  readonly items: readonly SignaturePackageItem[];
  readonly signers: readonly SignerAssignment[];
  readonly dependencies?: readonly PackageDependencyRule[];
  readonly priority: PackagePriority;
  readonly expiresAt: string;
  readonly supersedesPackageId?: SignaturePackageId;
  readonly orderId?: OrderId;
  readonly deliveredAt?: string;
  readonly completedAt?: string;
};

/** LDC-006 — SigningSession */
export type SigningSession = {
  readonly sessionId: SigningSessionId;
  readonly packageId: SignaturePackageId;
  readonly signerProfileId?: LegalProfileId;
  readonly authMode: SigningAuthMode;
  readonly tokenId?: string;
  readonly status: SigningSessionStatus;
  readonly wizardStep: SigningWizardStep;
  readonly startedAt: string;
  readonly pausedAt?: string;
  readonly resumedAt?: string;
  readonly completedAt?: string;
  readonly locale: LegalLocale;
  readonly deviceClass: DeviceClass;
  readonly browserFamily: string;
  readonly ipHash: string;
  readonly userAgentTrunc: string;
};

/** LDC-007 — SignatureRecord */
export type SignatureRecord = {
  readonly signatureId: SignatureRecordId;
  readonly sessionId: SigningSessionId;
  readonly documentId: LegalDocumentId;
  readonly templateVersionId: TemplateVersionId;
  readonly signerProfileId: LegalProfileId;
  readonly signatureType: SignatureType;
  readonly signaturePayloadHash: string;
  readonly sectionId?: string;
  readonly clauseId?: string;
  readonly typedText?: string;
  readonly recordedAt: string;
  readonly locale: LegalLocale;
};

/** LDC-008 — AcceptanceRecord */
export type AcceptanceRecord = {
  readonly acceptanceId: AcceptanceRecordId;
  readonly documentId: LegalDocumentId;
  readonly templateCode: string;
  readonly templateVersionId: TemplateVersionId;
  readonly acceptorProfileId: LegalProfileId;
  readonly acceptanceMethod: AcceptanceMethod;
  readonly sessionId?: SigningSessionId;
  readonly acceptedAt: string;
  readonly ipHash: string;
  readonly relatedOrderId?: OrderId;
};

/** LDC-009 — FinalArtifact */
export type FinalArtifact = {
  readonly artifactId: FinalArtifactId;
  readonly documentId?: LegalDocumentId;
  readonly packageId?: SignaturePackageId;
  readonly artifactType: FinalArtifactType;
  readonly storageRef: string;
  readonly sha256: string;
  readonly pageCount: number;
  readonly generatedAt: string;
  readonly isFiscal: boolean;
};

/** LDC-010 — TaxProfile — fiscal tier isolated (no tin_full). */
export type TaxProfile = {
  readonly taxProfileId: TaxProfileId;
  readonly ownerProfileId: LegalProfileId;
  readonly w9Status: W9Status;
  readonly w9DocumentId?: LegalDocumentId;
  readonly w9ArtifactId?: FinalArtifactId;
  readonly tinLast4?: string;
  readonly taxClassification?: string;
  readonly approvedAt?: string;
  readonly approvedByStaffId?: StaffUserId;
  readonly rejectionReasonCode?: string;
  readonly verificationHistory?: readonly AuditEventId[];
  readonly updatedAt: string;
};

export type ComplianceRequirementCell = {
  readonly requirementCode: string;
  readonly state: ComplianceRequirementState;
  readonly sourceDocumentId?: LegalDocumentId;
  readonly expiresAt?: string;
};

/** LDC-011 — ComplianceProfile */
export type ComplianceProfile = {
  readonly complianceProfileId: ComplianceProfileId;
  readonly ownerProfileId: LegalProfileId;
  readonly matrices: Readonly<Partial<Record<ComplianceEventType, readonly ComplianceRequirementCell[]>>>;
  readonly aggregateCompliance: ComplianceAggregateState;
  readonly evaluatedAt: string;
};

/** LDC-012 — IntroductionRecord */
export type IntroductionRecord = {
  readonly introductionId: IntroductionRecordId;
  readonly platformParty: 'Miami DJ Beat LLC';
  readonly performerProfileId: LegalProfileId;
  readonly performerDisplayName: string;
  readonly counterpartyType: CounterpartyType;
  readonly counterpartyProfileId?: LegalProfileId;
  readonly counterpartyName: string;
  readonly introductionDate: string;
  readonly introductionSource: IntroductionSource;
  readonly introductionEvidence: string;
  readonly protectionStatus: ProtectionStatus;
  readonly protectionExpiresAt: string;
  readonly waiverDocumentId?: LegalDocumentId;
  readonly orderId?: OrderId;
  readonly createdBy: 'system' | StaffUserId;
};

/** LDC-013 — AuditEvent — payload must not contain raw TIN or signature bitmaps. */
export type AuditEvent = {
  readonly auditId: AuditEventId;
  readonly eventType: string;
  readonly occurredAt: string;
  readonly actorType: AuditActorType;
  readonly actorIdHash: string;
  readonly legalProfileId?: LegalProfileId;
  readonly packageId?: SignaturePackageId;
  readonly sessionId?: SigningSessionId;
  readonly documentId?: LegalDocumentId;
  readonly introductionId?: IntroductionRecordId;
  readonly ipHash?: string;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly correlationId?: string;
};

/** LDC-014 — LegalNotification */
export type LegalNotification = {
  readonly notificationId: LegalNotificationId;
  readonly notificationType: LegalNotificationType;
  readonly recipientProfileId: LegalProfileId;
  readonly recipientChannel: LegalNotificationChannel;
  readonly severity: LegalNotificationSeverity;
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly actionUrl?: string;
  readonly relatedEntityType?: 'package' | 'document' | 'tax' | 'introduction';
  readonly relatedEntityId?: string;
  readonly readAt?: string;
  readonly dismissedAt?: string;
  readonly createdAt: string;
};
