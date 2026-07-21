/** Legal domain events — MOD-004 bus (future) — TICKET-V2-LEGAL-DATA-CONTRACTS-SPEC-001 */

import type {
  ComplianceProfileId,
  IntroductionRecordId,
  LegalDocumentId,
  LegalProfileId,
  SignaturePackageId,
  SignatureRecordId,
  TaxProfileId,
} from './legal-ids';
import type {
  ComplianceEventType,
  LegalAggregateStatus,
  LegalRestriction,
} from './legal-enums';

export const LEGAL_DOMAIN_EVENTS = [
  'LEGAL_PROFILE_CREATED',
  'LEGAL_STATUS_CHANGED',
  'PACKAGE_SENT',
  'PACKAGE_OPENED',
  'PACKAGE_COMPLETED',
  'DOCUMENT_SIGNED',
  'DOCUMENT_ACCEPTED',
  'W9_SUBMITTED',
  'W9_APPROVED',
  'W9_REJECTED',
  'COMPLIANCE_BLOCKED',
  'COMPLIANCE_CLEARED',
  'INTRODUCTION_CREATED',
  'INTRODUCTION_EXPIRED',
  'INTRODUCTION_WAIVED',
  'ARTIFACT_GENERATED',
  'LEGAL_NOTIFICATION_CREATED',
] as const;

export type LegalDomainEventName = (typeof LEGAL_DOMAIN_EVENTS)[number];

export type LegalDomainEventPayloadMap = {
  readonly LEGAL_PROFILE_CREATED: {
    readonly legalProfileId: LegalProfileId;
    readonly subjectType: string;
  };
  readonly LEGAL_STATUS_CHANGED: {
    readonly legalProfileId: LegalProfileId;
    readonly previousStatus: LegalAggregateStatus;
    readonly nextStatus: LegalAggregateStatus;
    readonly restrictions: readonly LegalRestriction[];
  };
  readonly PACKAGE_SENT: {
    readonly packageId: SignaturePackageId;
    readonly recipientEmail: string;
  };
  readonly PACKAGE_OPENED: {
    readonly packageId: SignaturePackageId;
    readonly sessionId: string;
  };
  readonly PACKAGE_COMPLETED: {
    readonly packageId: SignaturePackageId;
    readonly artifactIds: readonly string[];
  };
  readonly DOCUMENT_SIGNED: {
    readonly documentId: LegalDocumentId;
    readonly signatureId: SignatureRecordId;
  };
  readonly DOCUMENT_ACCEPTED: {
    readonly documentId: LegalDocumentId;
    readonly acceptanceId: string;
  };
  readonly W9_SUBMITTED: { readonly taxProfileId: TaxProfileId };
  readonly W9_APPROVED: { readonly taxProfileId: TaxProfileId; readonly staffUserId: string };
  readonly W9_REJECTED: { readonly taxProfileId: TaxProfileId; readonly reasonCode: string };
  readonly COMPLIANCE_BLOCKED: {
    readonly complianceProfileId: ComplianceProfileId;
    readonly eventType: ComplianceEventType;
  };
  readonly COMPLIANCE_CLEARED: { readonly complianceProfileId: ComplianceProfileId };
  readonly INTRODUCTION_CREATED: {
    readonly introductionId: IntroductionRecordId;
    readonly performerProfileId: LegalProfileId;
    readonly counterpartyName: string;
  };
  readonly INTRODUCTION_EXPIRED: { readonly introductionId: IntroductionRecordId };
  readonly INTRODUCTION_WAIVED: {
    readonly introductionId: IntroductionRecordId;
    readonly waiverDocumentId: LegalDocumentId;
  };
  readonly ARTIFACT_GENERATED: { readonly artifactId: string; readonly sha256: string };
  readonly LEGAL_NOTIFICATION_CREATED: {
    readonly notificationId: string;
    readonly notificationType: string;
  };
};

export type LegalDomainEvent<TName extends LegalDomainEventName = LegalDomainEventName> = {
  readonly name: TName;
  readonly occurredAt: string;
  readonly correlationId?: string;
  readonly payload: LegalDomainEventPayloadMap[TName];
};
