/** Legal lab preview renderer — TICKET-V2-LEGAL-PROVIDER-FACTORY-PORTAL-INJECTION-001 */

import type {
  ArtistLegalProfileViewModel,
  ClientLegalDocumentsViewModel,
  LegalLabPreviewViewModel,
  StaffLegalCenterViewModel,
} from './legal-portal-view-models';

function createSummaryRow(label: string, value: string): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'mdj-client-summary-list__row';

  const dt = document.createElement('dt');
  dt.textContent = label;

  const dd = document.createElement('dd');
  dd.textContent = value;

  row.append(dt, dd);
  return row;
}

function renderStaffPreview(model: StaffLegalCenterViewModel): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-client-dashboard__section mdj-client-dashboard__section--wide';
  section.dataset.mdjLegalLabPreview = 'staff';

  const heading = document.createElement('h2');
  heading.className = 'mdj-client-section-title';
  heading.textContent = 'Legal Center Lab Preview';

  const hint = document.createElement('p');
  hint.className = 'mdj-client-section-subtitle';
  hint.textContent = `${model.previewLabel} · read-only in-memory · not production UI`;

  const list = document.createElement('dl');
  list.className = 'mdj-client-summary-list';

  if (model.state !== 'ready' || !model.summary) {
    list.append(createSummaryRow('State', model.state));
    if (model.message) {
      list.append(createSummaryRow('Message', model.message));
    }
    section.append(heading, hint, list);
    return section;
  }

  list.append(
    createSummaryRow('Profiles', String(model.summary.profileCount)),
    createSummaryRow('GREEN', String(model.summary.greenCount)),
    createSummaryRow('YELLOW', String(model.summary.yellowCount)),
    createSummaryRow('RED', String(model.summary.redCount)),
    createSummaryRow('Pending signatures', String(model.summary.pendingSignatures)),
    createSummaryRow('Missing W-9', String(model.summary.missingW9)),
    createSummaryRow('Active introductions', String(model.summary.activeIntroductions)),
  );

  if (model.maskedW9Status) {
    list.append(createSummaryRow('Masked W-9 status', model.maskedW9Status));
  }
  if (model.complianceSummary) {
    list.append(createSummaryRow('Compliance', model.complianceSummary));
  }
  if (model.restrictionsSummary?.length) {
    list.append(createSummaryRow('Restrictions', model.restrictionsSummary.join(', ')));
  }

  section.append(heading, hint, list);
  return section;
}

function renderArtistPreview(model: ArtistLegalProfileViewModel): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-client-dashboard__section';
  section.dataset.mdjLegalLabPreview = 'artist';

  const heading = document.createElement('h2');
  heading.className = 'mdj-client-section-title';
  heading.textContent = 'My Legal Profile · Lab Preview';

  const list = document.createElement('dl');
  list.className = 'mdj-client-summary-list';
  list.append(createSummaryRow('State', model.state));

  if (model.state === 'ready') {
    list.append(
      createSummaryRow('Legal Status', model.legalStatus ?? 'unknown'),
      createSummaryRow('Signed documents', String(model.signedDocumentsCount ?? 0)),
      createSummaryRow('W-9 status', model.w9Status ?? 'n/a'),
      createSummaryRow('Compliance', model.complianceState ?? 'n/a'),
      createSummaryRow('Active introductions', String(model.activeIntroductions ?? 0)),
      createSummaryRow('Pending documents', String(model.pendingDocuments ?? 0)),
      createSummaryRow('Expiring items', String(model.expiringItems ?? 0)),
    );
  } else if (model.message) {
    list.append(createSummaryRow('Message', model.message));
  }

  section.append(heading, list);
  return section;
}

function renderClientPreview(model: ClientLegalDocumentsViewModel): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-client-dashboard__section';
  section.dataset.mdjLegalLabPreview = 'client';

  const heading = document.createElement('h2');
  heading.className = 'mdj-client-section-title';
  heading.textContent = 'My Documents · Lab Preview';

  const list = document.createElement('dl');
  list.className = 'mdj-client-summary-list';
  list.append(createSummaryRow('State', model.state));

  if (model.state === 'ready') {
    list.append(
      createSummaryRow('Contracts', String(model.contractsCount ?? 0)),
      createSummaryRow('Signed', String(model.signedCount ?? 0)),
      createSummaryRow('Pending', String(model.pendingCount ?? 0)),
      createSummaryRow('Downloadable artifacts', String(model.downloadableArtifactsCount ?? 0)),
    );
  } else if (model.message) {
    list.append(createSummaryRow('Message', model.message));
  }

  section.append(heading, list);
  return section;
}

export function renderLegalLabPreviewSection(viewModel: LegalLabPreviewViewModel): HTMLElement {
  switch (viewModel.portal) {
    case 'staff':
      return renderStaffPreview(viewModel.model);
    case 'artist':
      return renderArtistPreview(viewModel.model);
    case 'client':
      return renderClientPreview(viewModel.model);
  }
}
