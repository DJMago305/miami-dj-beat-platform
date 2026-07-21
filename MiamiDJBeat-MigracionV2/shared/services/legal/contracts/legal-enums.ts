/** Legal data contracts — enumerations — TICKET-V2-LEGAL-DATA-CONTRACTS-SPEC-001 */

export const LEGAL_AGGREGATE_STATUSES = ['GREEN', 'YELLOW', 'RED'] as const;
export type LegalAggregateStatus = (typeof LEGAL_AGGREGATE_STATUSES)[number];

export const LEGAL_STATUS_ITEM_STATES = ['green', 'yellow', 'red'] as const;
export type LegalStatusItemState = (typeof LEGAL_STATUS_ITEM_STATES)[number];

export const LEGAL_RESTRICTIONS = [
  'no_matching',
  'no_payout',
  'no_booking_accept',
  'no_corporate',
] as const;
export type LegalRestriction = (typeof LEGAL_RESTRICTIONS)[number];

export const LEGAL_SUBJECT_TYPES = [
  'staff',
  'artist',
  'client',
  'vendor',
  'venue',
  'external',
] as const;
export type LegalSubjectType = (typeof LEGAL_SUBJECT_TYPES)[number];

export const LEGAL_DOCUMENT_CATEGORIES = ['LGL', 'CTR', 'SPC'] as const;
export type LegalDocumentCategory = (typeof LEGAL_DOCUMENT_CATEGORIES)[number];

export const LEGAL_DOCUMENT_LIFECYCLE_STATUSES = [
  'DRAFT',
  'READY_TO_SEND',
  'SENT',
  'VIEWED',
  'IN_PROGRESS',
  'SIGNED_BY_RECIPIENT',
  'SIGNED_BY_MIAMI_DJ_BEAT',
  'COMPLETED',
  'VOIDED',
  'EXPIRED',
  'SUPERSEDED',
] as const;
export type LegalDocumentLifecycleStatus = (typeof LEGAL_DOCUMENT_LIFECYCLE_STATUSES)[number];

export const LEGAL_TEMPLATE_STATUSES = ['draft', 'published', 'retired'] as const;
export type LegalTemplateStatus = (typeof LEGAL_TEMPLATE_STATUSES)[number];

export const SIGNATURE_PACKAGE_SIGNING_STATUSES = [
  'CREATED',
  'DELIVERED',
  'OPENED',
  'STARTED',
  'IN_PROGRESS',
  'WAITING_SIGNATURE',
  'SIGNED',
  'COMPLETED',
  'EXPIRED',
  'VOIDED',
  'SUPERSEDED',
] as const;
export type SignaturePackageSigningStatus = (typeof SIGNATURE_PACKAGE_SIGNING_STATUSES)[number];

export const PACKAGE_ITEM_STATUSES = [
  'pending',
  'viewed',
  'in_progress',
  'signed',
  'accepted',
  'void',
] as const;
export type PackageItemStatus = (typeof PACKAGE_ITEM_STATUSES)[number];

export const PACKAGE_PRIORITIES = ['normal', 'urgent'] as const;
export type PackagePriority = (typeof PACKAGE_PRIORITIES)[number];

export const RECIPIENT_ROLES = [
  'client',
  'dj',
  'artist',
  'vendor',
  'venue',
  'corporate',
  'external',
] as const;
export type RecipientRole = (typeof RECIPIENT_ROLES)[number];

export const SIGNING_AUTH_MODES = ['account', 'token'] as const;
export type SigningAuthMode = (typeof SIGNING_AUTH_MODES)[number];

export const SIGNING_SESSION_STATUSES = [
  'active',
  'paused',
  'completed',
  'expired',
  'voided',
] as const;
export type SigningSessionStatus = (typeof SIGNING_SESSION_STATUSES)[number];

export const SIGNING_WIZARD_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export type SigningWizardStep = (typeof SIGNING_WIZARD_STEPS)[number];

export const DEVICE_CLASSES = ['mobile', 'tablet', 'desktop'] as const;
export type DeviceClass = (typeof DEVICE_CLASSES)[number];

export const LEGAL_LOCALES = ['en', 'es'] as const;
export type LegalLocale = (typeof LEGAL_LOCALES)[number];

export const SIGNATURE_TYPES = [
  'drawn',
  'typed',
  'initials',
  'checkbox',
  'explicit_confirm',
] as const;
export type SignatureType = (typeof SIGNATURE_TYPES)[number];

export const ACCEPTANCE_METHODS = ['checkbox', 'explicit_confirm', 'signature'] as const;
export type AcceptanceMethod = (typeof ACCEPTANCE_METHODS)[number];

export const FINAL_ARTIFACT_TYPES = ['single_pdf', 'package_bundle', 'w9_pdf'] as const;
export type FinalArtifactType = (typeof FINAL_ARTIFACT_TYPES)[number];

export const W9_STATUSES = [
  'missing',
  'pending_review',
  'approved',
  'rejected',
  'expired',
] as const;
export type W9Status = (typeof W9_STATUSES)[number];

export const COMPLIANCE_AGGREGATE_STATES = ['allowed', 'warning', 'blocked'] as const;
export type ComplianceAggregateState = (typeof COMPLIANCE_AGGREGATE_STATES)[number];

export const COMPLIANCE_REQUIREMENT_STATES = ['fulfilled', 'pending', 'blocking'] as const;
export type ComplianceRequirementState = (typeof COMPLIANCE_REQUIREMENT_STATES)[number];

export const COMPLIANCE_EVENT_TYPES = [
  'private_event',
  'restaurant',
  'corporate_event',
  'festival',
] as const;
export type ComplianceEventType = (typeof COMPLIANCE_EVENT_TYPES)[number];

export const COUNTERPARTY_TYPES = [
  'client',
  'venue',
  'restaurant',
  'club',
  'hotel',
  'corporate',
  'vendor',
] as const;
export type CounterpartyType = (typeof COUNTERPARTY_TYPES)[number];

export const INTRODUCTION_SOURCES = [
  'platform_match',
  'staff_intro',
  'event_booking',
  'inquiry',
] as const;
export type IntroductionSource = (typeof INTRODUCTION_SOURCES)[number];

export const PROTECTION_STATUSES = ['active', 'expired', 'waived', 'disputed'] as const;
export type ProtectionStatus = (typeof PROTECTION_STATUSES)[number];

export const AUDIT_ACTOR_TYPES = ['system', 'staff', 'user', 'token_signer'] as const;
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export const LEGAL_NOTIFICATION_TYPES = [
  'w9_pending',
  'w9_required',
  'insurance_expiring',
  'insurance_expired',
  'contract_expiring',
  'signature_required',
  'compliance_blocked',
  'introduction_expiring_soon',
  'policy_version_bump',
  'package_expiring',
] as const;
export type LegalNotificationType = (typeof LEGAL_NOTIFICATION_TYPES)[number];

export const LEGAL_NOTIFICATION_CHANNELS = ['in_app', 'email_stub'] as const;
export type LegalNotificationChannel = (typeof LEGAL_NOTIFICATION_CHANNELS)[number];

export const LEGAL_NOTIFICATION_SEVERITIES = ['info', 'warning', 'critical'] as const;
export type LegalNotificationSeverity = (typeof LEGAL_NOTIFICATION_SEVERITIES)[number];

export const LEGAL_ACL_SUBJECTS = [
  'owner',
  'staff_owner',
  'staff_manager',
  'staff_seller',
  'signer',
  'token_signer',
] as const;
export type LegalAclSubject = (typeof LEGAL_ACL_SUBJECTS)[number];
