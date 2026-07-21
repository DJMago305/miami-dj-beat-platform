/** LegalCenterShell — LC-4 — TICKET-V2-LEGAL-CENTER-UI-SHELL-001 */

import { createEmptyLegalState } from './empty-legal-state';
import { createLegalSection } from './legal-section';
import { createLegalStatusBadge } from './legal-status-badge';
import type { LegalCenterShellViewModel } from './legal-shell-types';

export function createLegalCenterShell(viewModel: LegalCenterShellViewModel): HTMLElement {
  const shell = document.createElement('section');
  shell.className = 'mdj-legal-center-shell';
  shell.dataset.mdjLegalCenterShell = viewModel.portal;

  const header = document.createElement('header');
  header.className = 'mdj-legal-center-shell__header';

  const headerCopy = document.createElement('div');
  headerCopy.className = 'mdj-legal-center-shell__header-copy';

  const title = document.createElement('h2');
  title.className = 'mdj-legal-center-shell__title';
  title.textContent = viewModel.title;

  headerCopy.append(title);

  if (viewModel.subtitle) {
    const subtitle = document.createElement('p');
    subtitle.className = 'mdj-legal-center-shell__subtitle';
    subtitle.textContent = viewModel.subtitle;
    headerCopy.append(subtitle);
  }

  header.append(headerCopy);

  if (viewModel.aggregateStatus) {
    header.append(
      createLegalStatusBadge({
        label: viewModel.statusLabel ?? viewModel.aggregateStatus,
        tone: viewModel.aggregateStatus,
        emphasis: viewModel.aggregateStatus === 'RED' ? 'soft' : 'default',
      }),
    );
  }

  shell.append(header);

  if (viewModel.state !== 'ready') {
    shell.append(
      createEmptyLegalState({
        title: 'Legal center unavailable',
        description: viewModel.message ?? `State: ${viewModel.state}`,
        hint: 'Lab shell · read-only',
      }),
    );
    return shell;
  }

  if (viewModel.kpis && viewModel.kpis.length > 0) {
    const kpiRow = document.createElement('dl');
    kpiRow.className = 'mdj-legal-center-shell__kpis';
    for (const kpi of viewModel.kpis) {
      const row = document.createElement('div');
      row.className = 'mdj-legal-center-shell__kpi-row';

      const dt = document.createElement('dt');
      dt.textContent = kpi.label;

      const dd = document.createElement('dd');
      dd.textContent = kpi.value;

      row.append(dt, dd);
      kpiRow.append(row);
    }
    shell.append(kpiRow);
  }

  const sectionsWrap = document.createElement('div');
  sectionsWrap.className = 'mdj-legal-center-shell__sections';

  if (viewModel.sections.length === 0) {
    sectionsWrap.append(
      createEmptyLegalState({
        title: 'No legal sections yet',
        description: 'Category sections will populate from the legal provider in future phases.',
        hint: 'LC-4 shell',
      }),
    );
  } else {
    for (const section of viewModel.sections) {
      sectionsWrap.append(createLegalSection(section));
    }
  }

  shell.append(sectionsWrap);
  return shell;
}

export function renderLegalCenterShell(viewModel: LegalCenterShellViewModel): HTMLElement {
  return createLegalCenterShell(viewModel);
}
