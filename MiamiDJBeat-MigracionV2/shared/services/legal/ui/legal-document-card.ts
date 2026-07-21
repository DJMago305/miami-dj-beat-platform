/** LegalDocumentCard — LC-4 — TICKET-V2-LEGAL-CENTER-UI-SHELL-001 · LC-5 download */

import { createLegalStatusBadge } from './legal-status-badge';
import type { LegalDocumentCardViewModel, LegalDocumentDownloadAction } from './legal-shell-types';

function appendDownloadRow(meta: HTMLElement, downloadAction: LegalDocumentDownloadAction): void {
  if (downloadAction.availability === 'forbidden') {
    return;
  }

  const row = document.createElement('div');
  row.className = 'mdj-legal-document-card__meta-row mdj-legal-document-card__meta-row--download';

  const dt = document.createElement('dt');
  dt.textContent = 'Download:';

  const dd = document.createElement('dd');

  if (downloadAction.availability === 'available') {
    const link = document.createElement('a');
    link.className = 'mdj-legal-document-card__download-link';
    link.href = downloadAction.url;
    link.textContent = downloadAction.label;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    if (downloadAction.filename) {
      link.download = downloadAction.filename;
    }
    dd.append(link);
  } else {
    dd.textContent = downloadAction.label;
    row.classList.add('mdj-legal-document-card__meta-row--coming-soon');
  }

  row.append(dt, dd);
  meta.append(row);
}

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

  const appendRow = (label: string, value: string): void => {
    const row = document.createElement('div');
    row.className = 'mdj-legal-document-card__meta-row';

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
  appendDownloadRow(meta, cardModel.downloadAction);

  card.append(header, meta);
  return card;
}
