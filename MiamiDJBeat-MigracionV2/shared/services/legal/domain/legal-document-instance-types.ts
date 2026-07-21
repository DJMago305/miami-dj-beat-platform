/** LC-6 — Legal document instance domain types */

import type { LegalDocumentCategory } from '../contracts/legal-enums';
import type { LegalDocumentInstanceStatus } from './legal-document-instance-status';

export type LegalDocumentInstanceId = string;

export const LEGAL_DOCUMENT_INSTANCE_RECIPIENT_TYPES = [
  'staff',
  'artist',
  'client',
  'vendor',
  'company',
  'external',
] as const;

export type LegalDocumentInstanceRecipientType =
  (typeof LEGAL_DOCUMENT_INSTANCE_RECIPIENT_TYPES)[number];

export const LEGAL_DOCUMENT_INSTANCE_OWNER_TYPES = [
  'staff',
  'artist',
  'client',
  'vendor',
  'company',
  'external',
  'platform',
] as const;

export type LegalDocumentInstanceOwnerType = (typeof LEGAL_DOCUMENT_INSTANCE_OWNER_TYPES)[number];

export const LEGAL_DOCUMENT_INSTANCE_SOURCES = [
  'template',
  'uploaded',
  'generated',
  'external',
] as const;

export type LegalDocumentInstanceSource = (typeof LEGAL_DOCUMENT_INSTANCE_SOURCES)[number];

export const LEGAL_DOCUMENT_INSTANCE_SIGNATURE_REQUIREMENTS = [
  'not_required',
  'single_signer',
  'multiple_signers',
] as const;

export type LegalDocumentInstanceSignatureRequirement =
  (typeof LEGAL_DOCUMENT_INSTANCE_SIGNATURE_REQUIREMENTS)[number];

export type LegalDocumentInstanceMetadata = Readonly<
  Record<string, string | number | boolean | null>
>;

export type LegalDocumentInstanceRecipient = {
  readonly recipientType: LegalDocumentInstanceRecipientType;
  readonly recipientId: string;
  readonly displayName: string;
  readonly email?: string;
};

export type LegalDocumentInstanceOwner = {
  readonly ownerType: LegalDocumentInstanceOwnerType;
  readonly ownerId: string;
  readonly issuedBy?: string;
  readonly assignedBy?: string;
};

export type LegalDocumentInstanceSignatureRequirementSpec = {
  readonly requirement: LegalDocumentInstanceSignatureRequirement;
  readonly requiredSignerCount?: number;
};

export type LegalDocumentInstanceTimestamps = {
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly expiresAt?: string;
  readonly sentAt?: string;
  readonly viewedAt?: string;
  readonly signedAt?: string;
  readonly rejectedAt?: string;
  readonly cancelledAt?: string;
  readonly expiredAt?: string;
};

/** Concrete document assigned to a recipient — distinct from reusable LegalTemplate. */
export type LegalDocumentInstance = LegalDocumentInstanceTimestamps & {
  readonly id: LegalDocumentInstanceId;
  readonly templateId: string;
  readonly templateVersionId: string;
  readonly category: LegalDocumentCategory;
  readonly title: string;
  readonly recipient: LegalDocumentInstanceRecipient;
  readonly owner: LegalDocumentInstanceOwner;
  readonly status: LegalDocumentInstanceStatus;
  readonly instanceVersion: number;
  readonly source: LegalDocumentInstanceSource;
  readonly signatureRequirement: LegalDocumentInstanceSignatureRequirementSpec;
  readonly metadata: LegalDocumentInstanceMetadata;
};

export type CreateLegalDocumentInstanceInput = {
  readonly id?: LegalDocumentInstanceId;
  readonly templateId: string;
  readonly templateVersionId: string;
  readonly category: LegalDocumentCategory;
  readonly title: string;
  readonly recipient: LegalDocumentInstanceRecipient;
  readonly owner: LegalDocumentInstanceOwner;
  readonly expiresAt?: string;
  readonly source?: LegalDocumentInstanceSource;
  readonly signatureRequirement?: LegalDocumentInstanceSignatureRequirementSpec;
  readonly metadata?: LegalDocumentInstanceMetadata;
  readonly initialStatus?: 'draft' | 'pending';
};
