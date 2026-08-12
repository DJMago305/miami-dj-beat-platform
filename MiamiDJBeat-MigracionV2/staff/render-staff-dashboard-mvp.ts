/** MOD-012 Staff Dashboard MVP — render — TICKET-MOD-012-STAFF-DASHBOARD-MVP-001 */

import {
  createComponentThemeBinding,
  createDashboardCard,
  createEmptyState,
  createHeroBanner,
  createKpiCard,
  createPanel,
  createSectionHeader,
  type MdjThemeBinding,
} from '../shared/components/index';
import { getThemeDefinition } from '../shared/theme/runtime/theme-registry';
import {
  type StaffDashboardDataProvider,
} from './data/staff-dashboard-data-provider';
import { mountComponentDescriptor } from './mount-component-descriptor';
import { createOperationsPreviewSection } from './render-operations-preview';
import { mountStaffIdentityReadSliceSync } from './identity/mount-staff-identity-read-slice';
import { mountStaffCalendarReadSliceSync } from './calendar/mount-staff-calendar-read-slice';
import { mountStaffFinanceReadSliceSync } from './finance/mount-staff-finance-read-slice';
import { mountStaffWeatherReadSliceSync } from './weather/mount-staff-weather-read-slice';
import type { StaffMutationsAdapter } from '../shared/services/staff-mutations/index';
import {
  renderStaffSessionWiringBadge,
  type StaffSessionWiringInjection,
} from './session/staff-session-wiring-pilot';
import { applyV1BrandShell } from '../shared/branding/apply-v1-brand-shell';
import {
  buildStaffV1OpsLayout,
  mountStaffOwnerTabs,
} from './v1-staff-ops-layout';

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

/** MOD-301 Slice 1 — identity slot; hydrated by mountStaffIdentityReadSliceSync. */
function createProfileSection(
  _themeBinding: MdjThemeBinding,
  _dataProvider: StaffDashboardDataProvider,
): HTMLElement {
  return createStaffSection('staff-profile');
}

/** MOD-301 Slice 2 — master calendar slot; hydrated by mountStaffCalendarReadSliceSync. */
function createMasterCalendarSection(): HTMLElement {
  return createStaffSection('master-calendar', true);
}

/** MOD-301 Financial Slice — master finance slot; hydrated by mountStaffFinanceReadSliceSync. */
function createMasterFinanceSection(): HTMLElement {
  return createStaffSection('master-finance', true);
}

/** MOD-301 Weather Slice — weather risk console slot; hydrated by mountStaffWeatherReadSliceSync. */
function createMasterWeatherSection(): HTMLElement {
  return createStaffSection('master-weather', true);
}

/** Writers Phase · Slice 3 · Paso 3 — staff mutation forms slot. */
function createStaffMutationsSection(): HTMLElement {
  return createStaffSection('staff-mutations', true);
}

/** MOD-301 Session Wiring Pilot — badge slot (role + redacted bearer). */
function createSessionWiringSection(
  sessionWiring: StaffSessionWiringInjection,
): HTMLElement {
  const section = createStaffSection('session-wiring', true);
  const host = document.createElement('div');
  host.className = 'mdj-staff-session-wiring-host';
  host.dataset.mdjStaffSessionHost = 'mod-301-sw';
  renderStaffSessionWiringBadge(host, sessionWiring);
  section.append(host);
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
  sessionWiring?: StaffSessionWiringInjection | null,
  _mutationsAdapter?: StaffMutationsAdapter | null,
): void {
  const themeBinding = resolveStaffDashboardThemeBinding();
  const mvpView = dataProvider.getMvpView();
  mainRegion.classList.add('mdj-client-dashboard', 'mdj-v2-v1-staff-host');
  mainRegion.replaceChildren();

  mountStaffOwnerTabs();
  const layout = buildStaffV1OpsLayout(dataProvider);

  const legacyHero = mountComponentDescriptor(
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
  legacyHero.classList.add('mdj-v2-lab-legacy-hero');

  const legacyKpis = mountComponentDescriptor(
    createDashboardCard({ variant: 'kpi-grid', region: 'kpis' }, themeBinding),
  );
  legacyKpis.classList.add('mdj-v2-lab-legacy-kpis');
  legacyKpis.replaceChildren(
    ...mvpView.kpis.map((kpi) => mountComponentDescriptor(createKpiCard(kpi, themeBinding))),
  );

  const replaceLegacy = (sectionId: string, factory: () => HTMLElement): void => {
    const slot = layout.root.querySelector<HTMLElement>(
      `[data-mdj-staff-section="${sectionId}"]`,
    );
    if (!slot) return;
    const built = factory();
    built.classList.add('mdj-v2-lab-legacy-mvp');
    slot.replaceWith(built);
  };

  replaceLegacy('operations-preview', () =>
    createOperationsPreviewSection(themeBinding, dataProvider),
  );
  replaceLegacy('quick-actions', () => createQuickActionsSection(themeBinding, dataProvider));
  replaceLegacy('leads-pipeline', () => createLeadsSection(themeBinding, dataProvider));
  replaceLegacy('invoices-queue', () => createInvoicesSection(themeBinding, dataProvider));
  replaceLegacy('crm-snapshot', () => createCrmSection(themeBinding, dataProvider));
  replaceLegacy('production-tasks', () => createProductionSection(themeBinding, dataProvider));
  replaceLegacy('matching-queue', () => createMatchingSection(themeBinding, dataProvider));
  replaceLegacy('reports-preview', () => createReportsSection(themeBinding, dataProvider));
  replaceLegacy('notifications', () => createNotificationsSection(themeBinding, dataProvider));
  replaceLegacy('activity-timeline', () => createActivitySection(themeBinding, dataProvider));
  replaceLegacy('master-weather', () => createMasterWeatherSection());

  if (sessionWiring) {
    const sessionSection = createSessionWiringSection(sessionWiring);
    sessionSection.classList.add('mdj-v2-lab-legacy-mvp');
    layout.content.append(sessionSection);
  }

  mainRegion.append(legacyHero, legacyKpis, layout.root);
  applyV1BrandShell(mainRegion, 'staff');

  const calendarAudience =
    sessionWiring?.context.sessionRole === 'staff_seller' ? 'staff_seller' : 'staff_full';
  const financeAudience =
    sessionWiring?.context.sessionRole === 'staff_seller' ? 'staff_seller' : 'staff_full';
  const weatherAudience =
    sessionWiring?.context.sessionRole === 'staff_seller' ? 'staff_seller' : 'staff_master';

  mountStaffIdentityReadSliceSync(mainRegion, undefined, sessionWiring);
  mountStaffCalendarReadSliceSync(mainRegion, undefined, calendarAudience, sessionWiring);
  mountStaffFinanceReadSliceSync(mainRegion, undefined, financeAudience, sessionWiring);
  mountStaffWeatherReadSliceSync(mainRegion, undefined, weatherAudience, sessionWiring);
  /* Staff mutations slice mounted once, downstream, in staff/main.ts's mountDashboard —
     not here, to avoid the double-mount this replaced (render-then-remount on the same slot). */
}
