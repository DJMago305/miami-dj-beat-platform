/** Legal portal view models — TICKET-V2-LEGAL-PROVIDER-FACTORY-PORTAL-INJECTION-001 */

import type { LegalAggregateStatus } from '../contracts/legal-enums';

export type LegalPortalViewState =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'not_found'
  | 'forbidden'
  | 'error';

export type StaffLegalPortalRole = 'staff_owner' | 'staff_manager' | 'staff_seller';

export type StaffLegalCenterViewModel = {
  readonly state: LegalPortalViewState;
  readonly role: StaffLegalPortalRole;
  readonly previewLabel: string;
  readonly summary?: {
    readonly profileCount: number;
    readonly greenCount: number;
    readonly yellowCount: number;
    readonly redCount: number;
    readonly pendingSignatures: number;
    readonly missingW9: number;
    readonly activeIntroductions: number;
  };
  readonly maskedW9Status?: string;
  readonly restrictionsSummary?: readonly string[];
  readonly requiredDocumentsSummary?: readonly string[];
  readonly complianceSummary?: string;
  readonly message?: string;
};

export type ArtistLegalProfileViewModel = {
  readonly state: LegalPortalViewState;
  readonly legalStatus?: LegalAggregateStatus;
  readonly signedDocumentsCount?: number;
  readonly w9Status?: string;
  readonly complianceState?: string;
  readonly activeIntroductions?: number;
  readonly pendingDocuments?: number;
  readonly expiringItems?: number;
  readonly message?: string;
};

export type ClientLegalDocumentsViewModel = {
  readonly state: LegalPortalViewState;
  readonly contractsCount?: number;
  readonly signedCount?: number;
  readonly pendingCount?: number;
  readonly downloadableArtifactsCount?: number;
  readonly message?: string;
};

export type LegalLabPreviewViewModel =
  | { readonly portal: 'staff'; readonly model: StaffLegalCenterViewModel }
  | { readonly portal: 'artist'; readonly model: ArtistLegalProfileViewModel }
  | { readonly portal: 'client'; readonly model: ClientLegalDocumentsViewModel };
