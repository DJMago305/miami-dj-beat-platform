/** Legal Center UI shell types — LC-4 — TICKET-V2-LEGAL-CENTER-UI-SHELL-001 */

import type { LegalAggregateStatus } from '../contracts/legal-enums';
import type { LegalPortalViewState } from '../provider/legal-portal-view-models';

export const LEGAL_DOCUMENT_CARD_STATUSES = [
  'draft',
  'pending',
  'sent',
  'viewed',
  'signed',
  'expired',
  'rejected',
] as const;

export type LegalDocumentCardStatus = (typeof LEGAL_DOCUMENT_CARD_STATUSES)[number];

export const LEGAL_DOCUMENT_CATEGORIES = [
  'contracts',
  'agreements',
  'w9',
  'tax_documents',
  'privacy_policies',
  'releases',
  'nda',
  'vendor_documents',
  'artist_documents',
] as const;

export type LegalDocumentCategory = (typeof LEGAL_DOCUMENT_CATEGORIES)[number];

export type LegalDocumentDownloadAction =
  | {
      readonly availability: 'available';
      readonly label: string;
      readonly url: string;
      readonly filename?: string;
    }
  | {
      readonly availability: 'coming_soon';
      readonly label: string;
    }
  | {
      readonly availability: 'forbidden';
    };

export const LEGAL_DOWNLOAD_COMING_SOON_ACTION: LegalDocumentDownloadAction = Object.freeze({
  availability: 'coming_soon',
  label: 'Coming soon',
});

export type LegalDocumentCardViewModel = {
  readonly id: string;
  readonly title: string;
  readonly type: LegalDocumentCategory;
  readonly status: LegalDocumentCardStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly requiresSignature: boolean;
  readonly downloadAction: LegalDocumentDownloadAction;
};

export type LegalSectionViewModel = {
  readonly sectionId: string;
  readonly title: string;
  readonly category: LegalDocumentCategory;
  readonly documents: readonly LegalDocumentCardViewModel[];
};

export type LegalCenterShellPortal = 'staff' | 'artist' | 'client';

export type LegalCenterShellViewModel = {
  readonly portal: LegalCenterShellPortal;
  readonly state: LegalPortalViewState;
  readonly title: string;
  readonly subtitle?: string;
  readonly aggregateStatus?: LegalAggregateStatus;
  readonly statusLabel?: string;
  readonly kpis?: readonly { readonly label: string; readonly value: string }[];
  readonly sections: readonly LegalSectionViewModel[];
  readonly message?: string;
};
