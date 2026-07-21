/** Legal data contracts — canonical ID patterns — TICKET-V2-LEGAL-DATA-CONTRACTS-SPEC-001 */

/** Branded string IDs — format enforced at repository boundary (future), not at compile time. */
export type LegalProfileId = string;
export type LegalDocumentId = string;
export type LegalTemplateId = string;
export type TemplateVersionId = string;
export type SignaturePackageId = string;
export type SigningSessionId = string;
export type SignatureRecordId = string;
export type AcceptanceRecordId = string;
export type FinalArtifactId = string;
export type TaxProfileId = string;
export type ComplianceProfileId = string;
export type IntroductionRecordId = string;
export type AuditEventId = string;
export type LegalNotificationId = string;
export type SecureSigningTokenId = string;

/** External correlation IDs (MOD-409, auth). */
export type MdjUserId = string;
export type MdjbPublicId = string;
export type OrderId = string;
export type StaffUserId = string;
