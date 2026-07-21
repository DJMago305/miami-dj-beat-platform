/** LegalSection — LC-4 — TICKET-V2-LEGAL-CENTER-UI-SHELL-001 */

import { createEmptyLegalState } from './empty-legal-state';
import { createLegalDocumentCard } from './legal-document-card';
import type { LegalSectionViewModel } from './legal-shell-types';

export function createLegalSection(section: LegalSectionViewModel): HTMLElement {
  const root = document.createElement('section');
  root.className = 'mdj-legal-section';
  root.dataset.mdjLegalSection = section.sectionId;
  root.dataset.mdjLegalCategory = section.category;

  const header = document.createElement('div');
  header.className = 'mdj-legal-section__header';

  const title = document.createElement('h3');
  title.className = 'mdj-legal-section__title';
  title.textContent = section.title;

  header.append(title);
  root.append(header);

  const body = document.createElement('div');
  body.className = 'mdj-legal-section__body';

  if (section.documents.length === 0) {
    body.append(
      createEmptyLegalState({
        title: 'No documents in this category',
        description: 'Documents will appear here when available for this legal center view.',
        hint: 'Lab shell · read-only',
      }),
    );
  } else {
    const grid = document.createElement('div');
    grid.className = 'mdj-legal-section__grid';
    for (const documentCard of section.documents) {
      grid.append(createLegalDocumentCard(documentCard));
    }
    body.append(grid);
  }

  root.append(body);
  return root;
}
