/** LC-7 — W-9 workflow types and constants */

import type { LegalDocumentInstanceRecipient } from '../domain/legal-document-instance-types';
import type { LegalW9RequestStatus, LegalW9ReviewStatus } from './legal-w9-request-status';

export const LEGAL_W9_TEMPLATE_ID = 'SPC-001';
export const LEGAL_W9_TEMPLATE_VERSION_ID = 'TV-SPC-001-1';

/** Demo recipient id used by the V2 lab artist portal shell. */
export const LEGAL_W9_DEMO_ARTIST_RECIPIENT_ID = 'ART-001';

export const LEGAL_W9_ALLOWED_RECIPIENT_TYPES = [
  'artist',
  'vendor',
  'company',
  'external',
] as const;

export type LegalW9AllowedRecipientType = (typeof LEGAL_W9_ALLOWED_RECIPIENT_TYPES)[number];

export type LegalW9RequestId = string;

export type LegalW9RequestMetadata = Readonly<Record<string, string | number | boolean | null>>;

export type LegalW9RequestedBy = {
  readonly actorId: string;
  readonly displayName: string;
  readonly role: 'owner' | 'manager';
};

export type LegalW9Request = {
  readonly id: LegalW9RequestId;
  readonly documentInstanceId: string;
  readonly templateId: typeof LEGAL_W9_TEMPLATE_ID;
  readonly templateVersionId: typeof LEGAL_W9_TEMPLATE_VERSION_ID;
  readonly recipient: LegalDocumentInstanceRecipient;
  readonly requestedBy: LegalW9RequestedBy;
  readonly status: LegalW9RequestStatus;
  readonly reviewStatus: LegalW9ReviewStatus;
  readonly requestedAt: string;
  readonly updatedAt: string;
  readonly dueAt?: string;
  readonly viewedAt?: string;
  readonly completedAt?: string;
  readonly metadata: LegalW9RequestMetadata;
};

export type RequestW9Input = {
  readonly id?: LegalW9RequestId;
  readonly actor: import('./legal-w9-workflow-actor').LegalWorkflowActor;
  readonly recipient: LegalDocumentInstanceRecipient;
  readonly requestedByDisplayName: string;
  readonly dueAt?: string;
  readonly metadata?: LegalW9RequestMetadata;
};

export type ListW9RequestsFilter = {
  readonly status?: LegalW9RequestStatus;
};
