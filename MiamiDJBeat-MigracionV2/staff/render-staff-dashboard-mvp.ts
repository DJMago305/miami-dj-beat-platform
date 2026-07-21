/** MOD-012 Staff Dashboard MVP — render — TICKET-MOD-012-STAFF-DASHBOARD-MVP-001 */

import {
  createComponentThemeBinding,
  createDashboardCard,
  createEmptyState,
  createHeroBanner,
  createKpiCard,
  createPanel,
  createProfileCard,
  createSectionHeader,
  type MdjThemeBinding,
} from '../shared/components/index';
import { getThemeDefinition } from '../shared/theme/runtime/theme-registry';
import {
  type StaffDashboardDataProvider,
} from './data/staff-dashboard-data-provider';
import { mountComponentDescriptor } from './mount-component-descriptor';
import { createOperationsPreviewSection } from './render-operations-preview';

function resolveStaffDashboardThemeBinding(): MdjThemeBinding {
  const tokens = getThemeDefinition('mdj-dark-gold')?.tokens;
  if (!tokens) {
    throw new Error('mdj-dark-gold theme tokens are required for staff dashboard MVP');
  }

  return createComponentThemeBinding(tokens);
}

function createStaffSection(sectionId: string, wide = false): HTMLElement {
  const section = document.createElement('section');
  section.className = `mdj-client-dashboard__section${wide ? ' mdj-client-dashboard__section--wide' : ''}`;
  section.dataset.mdjStaffSection = sectionId;
  return section;
}

function createSummaryList(items: readonly { readonly label: string; readonly value: string }[]): HTMLElement {
  const list = document.createElement('dl');
  list.className = 'mdj-client-summary-list';

  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'mdj-client-summary-list__row';

    const dt = document.createElement('dt');
    dt.textContent = item.label;

    const dd = document.createElement('dd');
    dd.textContent = item.value;

    row.append(dt, dd);
    list.append(row);
  }

  return list;
}

function createList(items: readonly string[]): HTMLElement {
  const list = document.createElement('ul');
  list.className = 'mdj-client-list';

  for (const item of items) {
    const li = document.createElement('li');
    li.className = 'mdj-client-list__item';
    li.textContent = item;
    list.append(li);
  }

  return list;
}

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

function createQuickActionsSection(
  themeBinding: MdjThemeBinding,
  dataProvider: StaffDashboardDataProvider,
): HTMLElement {
  const section = createStaffSection('quick-actions', true);
  const mvpView = dataProvider.getMvpView();

  section.append(
    mountComponentDescriptor(
      createSectionHeader({ title: 'Quick Actions', variant: 'module-grid' }, themeBinding),
    ),
  );

  const grid = document.createElement('div');
  grid.className = 'mdj-client-quick-actions';

  for (const label of mvpView.quickActions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mdj-client-quick-actions__button';
    button.textContent = label;
    button.setAttribute('aria-label', label);
    grid.append(button);
  }

  section.append(grid);
  return section;
}

function createProfileSection(
  themeBinding: MdjThemeBinding,
  dataProvider: StaffDashboardDataProvider,
): HTMLElement {
  const section = createStaffSection('staff-profile');
  const profile = dataProvider.getMvpView().profile;

  section.append(
    mountComponentDescriptor(
      createSectionHeader({ title: 'Staff Profile', variant: 'module-grid' }, themeBinding),
    ),
    mountComponentDescriptor(
      createProfileCard(
        {
          name: profile.operatorName,
          role: profile.role,
          meta: `${profile.status} · ${profile.coverage}`,
        },
        themeBinding,
      ),
    ),
  );

  const details = document.createElement('dl');
  details.className = 'mdj-client-summary-list';
  details.append(
    createSummaryRow('Status', profile.status),
    createSummaryRow('Coverage', profile.coverage),
  );
  section.append(details);

  return section;
}

function createLeadsSection(
  themeBinding: MdjThemeBinding,
  dataProvider: StaffDashboardDataProvider,
): HTMLElement {
  const section = createStaffSection('leads-pipeline', true);

  const panel = mountComponentDescriptor(
    createPanel({ title: 'Leads Pipeline', variant: 'glass' }, themeBinding),
  );
  panel.classList.add('mdj-client-panel--timeline');

  const timeline = document.createElement('div');
  timeline.className = 'mdj-client-timeline';

  for (const lead of dataProvider.getMvpView().pipelineLeads) {
    const item = document.createElement('article');
    item.className = 'mdj-client-timeline__item';

    const date = document.createElement('p');
    date.className = 'mdj-client-timeline__date';
    date.textContent = lead.date;

    const title = document.createElement('h3');
    title.className = 'mdj-client-timeline__title';
    title.textContent = lead.title;

    const source = document.createElement('p');
    source.className = 'mdj-client-timeline__meta';
    source.textContent = lead.source;

    const status = document.createElement('span');
    status.className = 'mdj-client-timeline__status';
    status.textContent = lead.status;

    item.append(date, title, source, status);
    timeline.append(item);
  }

  panel.append(timeline);
  section.append(panel);
  return section;
}

function createInvoicesSection(
  themeBinding: MdjThemeBinding,
  dataProvider: StaffDashboardDataProvider,
): HTMLElement {
  const section = createStaffSection('invoices-queue');

  const panel = mountComponentDescriptor(
    createPanel({ title: 'Invoices Queue', variant: 'elevated' }, themeBinding),
  );

  const table = document.createElement('table');
  table.className = 'mdj-client-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th scope="col">Invoice</th>
        <th scope="col">Client</th>
        <th scope="col">Amount</th>
        <th scope="col">Status</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement('tbody');
  for (const invoice of dataProvider.getMvpView().invoiceQueue) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${invoice.id}</td>
      <td>${invoice.client}</td>
      <td>${invoice.amount}</td>
      <td><span class="mdj-client-table__status">${invoice.status}</span></td>
    `;
    tbody.append(row);
  }

  table.append(tbody);
  panel.append(table);
  section.append(panel);
  return section;
}

function createCrmSection(
  themeBinding: MdjThemeBinding,
  dataProvider: StaffDashboardDataProvider,
): HTMLElement {
  const section = createStaffSection('crm-snapshot');

  const panel = mountComponentDescriptor(
    createPanel({ title: 'CRM Snapshot', variant: 'glass' }, themeBinding),
  );
  panel.append(createSummaryList(dataProvider.getMvpView().crm));
  section.append(panel);
  return section;
}

function createProductionSection(
  themeBinding: MdjThemeBinding,
  dataProvider: StaffDashboardDataProvider,
): HTMLElement {
  const section = createStaffSection('production-tasks');

  const panel = mountComponentDescriptor(
    createPanel({ title: 'Production Tasks', variant: 'elevated' }, themeBinding),
  );
  panel.append(createList(dataProvider.getMvpView().productionSummaries));
  section.append(panel);
  return section;
}

function createMatchingSection(
  themeBinding: MdjThemeBinding,
  dataProvider: StaffDashboardDataProvider,
): HTMLElement {
  const section = createStaffSection('matching-queue');

  const panel = mountComponentDescriptor(
    createPanel({ title: 'Matching Queue', variant: 'glass' }, themeBinding),
  );
  panel.append(createList(dataProvider.getMvpView().matchingSummaries));
  section.append(panel);
  return section;
}

function createReportsSection(
  themeBinding: MdjThemeBinding,
  dataProvider: StaffDashboardDataProvider,
): HTMLElement {
  const section = createStaffSection('reports-preview');

  const panel = mountComponentDescriptor(
    createPanel({ title: 'Reports Preview', variant: 'elevated' }, themeBinding),
  );
  panel.append(createSummaryList(dataProvider.getMvpView().reports));
  section.append(panel);
  return section;
}

function createNotificationsSection(
  themeBinding: MdjThemeBinding,
  dataProvider: StaffDashboardDataProvider,
): HTMLElement {
  const section = createStaffSection('notifications');

  const panel = mountComponentDescriptor(
    createPanel({ title: 'Notifications', variant: 'elevated' }, themeBinding),
  );
  panel.append(createList(dataProvider.getMvpView().notifications));
  section.append(panel);
  return section;
}

function createActivitySection(
  themeBinding: MdjThemeBinding,
  dataProvider: StaffDashboardDataProvider,
): HTMLElement {
  const section = createStaffSection('activity-timeline', true);

  section.append(
    mountComponentDescriptor(
      createSectionHeader({ title: 'Activity Timeline', variant: 'module-grid' }, themeBinding),
    ),
  );

  const timeline = document.createElement('div');
  timeline.className = 'mdj-client-activity';

  for (const entry of dataProvider.getMvpView().activity) {
    const item = document.createElement('article');
    item.className = 'mdj-client-activity__item';

    const time = document.createElement('p');
    time.className = 'mdj-client-activity__time';
    time.textContent = entry.time;

    const detail = document.createElement('p');
    detail.className = 'mdj-client-activity__detail';
    detail.textContent = entry.detail;

    item.append(time, detail);
    timeline.append(item);
  }

  section.append(
    timeline,
    mountComponentDescriptor(
      createEmptyState(
        {
          title: 'More staff activity coming soon',
          description: 'Full operations audit trail will appear in a future release.',
          hint: 'Placeholder timeline only',
        },
        themeBinding,
      ),
    ),
  );

  return section;
}

export function renderStaffDashboardMvp(
  mainRegion: HTMLElement,
  dataProvider: StaffDashboardDataProvider,
): void {
  const themeBinding = resolveStaffDashboardThemeBinding();
  const mvpView = dataProvider.getMvpView();
  mainRegion.classList.add('mdj-client-dashboard');
  mainRegion.replaceChildren();

  const hero = mountComponentDescriptor(
    createHeroBanner(
      {
        eyebrow: 'Backoffice control',
        title: 'Your Miami DJ Beat Staff Operations Dashboard',
        subtitle:
          'Coordinate leads, invoices, CRM, production, matching, and reporting from one professional operations console.',
      },
      themeBinding,
    ),
  );

  const kpiGrid = mountComponentDescriptor(
    createDashboardCard({ variant: 'kpi-grid', region: 'kpis' }, themeBinding),
  );
  kpiGrid.replaceChildren(
    ...mvpView.kpis.map((kpi) => mountComponentDescriptor(createKpiCard(kpi, themeBinding))),
  );

  const contentGrid = document.createElement('div');
  contentGrid.className = 'mdj-client-dashboard__grid';
  contentGrid.append(
    createOperationsPreviewSection(themeBinding, dataProvider),
    createQuickActionsSection(themeBinding, dataProvider),
    createProfileSection(themeBinding, dataProvider),
    createLeadsSection(themeBinding, dataProvider),
    createInvoicesSection(themeBinding, dataProvider),
    createCrmSection(themeBinding, dataProvider),
    createProductionSection(themeBinding, dataProvider),
    createMatchingSection(themeBinding, dataProvider),
    createReportsSection(themeBinding, dataProvider),
    createNotificationsSection(themeBinding, dataProvider),
    createActivitySection(themeBinding, dataProvider),
  );

  mainRegion.append(hero, kpiGrid, contentGrid);
}
