/** LegalDocumentCard — LC-4 — TICKET-V2-LEGAL-CENTER-UI-SHELL-001 */

import { createLegalStatusBadge } from './legal-status-badge';
import type { LegalDocumentCardViewModel } from './legal-shell-types';

/** LC-4A — placeholder until LC-4 PDF engine; consistent across all cards. */
const LEGAL_DOWNLOAD_PLACEHOLDER = 'Coming soon';

export function createLegalDocumentCard(cardModel: LegalDocumentCardViewModel): HTMLElement {
  const card = document.createElement('article');
  card.className = 'mdj-legal-document-card';
  card.dataset.mdjLegalDocumentCard = cardModel.id;

  const header = document.createElement('div');
  header.className = 'mdj-legal-document-card__header';

  const title = document.createElement('h3');
  title.className = 'mdj-legal-document-card__title';
  title.textContent = cardModel.title;

  header.append(
    title,
    createLegalStatusBadge({ label: cardModel.status, tone: cardModel.status }),
  );

  const meta = document.createElement('dl');
  meta.className = 'mdj-legal-document-card__meta';

  const appendRow = (label: string, value: string, modifiers: readonly string[] = []): void => {
    const row = document.createElement('div');
    row.className = ['mdj-legal-document-card__meta-row', ...modifiers].join(' ');

    const dt = document.createElement('dt');
    dt.textContent = `${label}:`;

    const dd = document.createElement('dd');
    dd.textContent = value;

    row.append(dt, dd);
    meta.append(row);
  };

  appendRow('Type', cardModel.type.replace(/_/g, ' '));
  appendRow('Updated', cardModel.updatedAt.slice(0, 10));
  appendRow('Signature', cardModel.requiresSignature ? 'Required' : 'Not required');
  appendRow('Download', LEGAL_DOWNLOAD_PLACEHOLDER, ['mdj-legal-document-card__meta-row--download']);

  card.append(header, meta);
  return card;
}
