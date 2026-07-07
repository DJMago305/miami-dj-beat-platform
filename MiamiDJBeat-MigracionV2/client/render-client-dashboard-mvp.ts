/** MOD-010 Client Dashboard MVP — render — TICKET-MOD-010-CLIENT-DASHBOARD-MVP-001 */

import {
  createComponentThemeBinding,
  createDashboardCard,
  createEmptyState,
  createHeroBanner,
  createKpiCard,
  createModuleCard,
  createPanel,
  createSectionHeader,
  type MdjThemeBinding,
} from '../shared/components/index';
import { getThemeDefinition } from '../shared/theme/runtime/theme-registry';
import {
  CLIENT_ACTIVITY,
  CLIENT_DASHBOARD_KPIS,
  CLIENT_DOCUMENTS,
  CLIENT_NOTIFICATIONS,
  CLIENT_PENDING_PAYMENTS,
  CLIENT_QUICK_ACTIONS,
  CLIENT_RECENT_ORDERS,
  CLIENT_UPCOMING_EVENTS,
  CLIENT_VIP,
} from './dashboard-mvp-data';
import { mountComponentDescriptor } from './mount-component-descriptor';

function resolveClientDashboardThemeBinding(): MdjThemeBinding {
  const tokens = getThemeDefinition('mdj-dark-gold')?.tokens;
  if (!tokens) {
    throw new Error('mdj-dark-gold theme tokens are required for client dashboard MVP');
  }

  return createComponentThemeBinding(tokens);
}

function createQuickActionsSection(themeBinding: MdjThemeBinding): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-client-dashboard__section';
  section.dataset.mdjClientSection = 'quick-actions';

  section.append(
    mountComponentDescriptor(
      createSectionHeader({ title: 'Quick Actions', variant: 'module-grid' }, themeBinding),
    ),
  );

  const grid = document.createElement('div');
  grid.className = 'mdj-client-quick-actions';

  for (const label of CLIENT_QUICK_ACTIONS) {
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

function createUpcomingEventsSection(themeBinding: MdjThemeBinding): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-client-dashboard__section mdj-client-dashboard__section--wide';
  section.dataset.mdjClientSection = 'upcoming-events';

  const panel = mountComponentDescriptor(
    createPanel({ title: 'Upcoming Events', variant: 'glass' }, themeBinding),
  );
  panel.classList.add('mdj-client-panel--timeline');

  const timeline = document.createElement('div');
  timeline.className = 'mdj-client-timeline';

  for (const event of CLIENT_UPCOMING_EVENTS) {
    const item = document.createElement('article');
    item.className = 'mdj-client-timeline__item';

    const date = document.createElement('p');
    date.className = 'mdj-client-timeline__date';
    date.textContent = event.date;

    const title = document.createElement('h3');
    title.className = 'mdj-client-timeline__title';
    title.textContent = event.title;

    const venue = document.createElement('p');
    venue.className = 'mdj-client-timeline__meta';
    venue.textContent = event.venue;

    const status = document.createElement('span');
    status.className = 'mdj-client-timeline__status';
    status.textContent = event.status;

    item.append(date, title, venue, status);
    timeline.append(item);
  }

  panel.append(timeline);
  section.append(panel);
  return section;
}

function createRecentOrdersSection(themeBinding: MdjThemeBinding): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-client-dashboard__section';
  section.dataset.mdjClientSection = 'recent-orders';

  const panel = mountComponentDescriptor(
    createPanel({ title: 'Recent Orders', variant: 'elevated' }, themeBinding),
  );

  const table = document.createElement('table');
  table.className = 'mdj-client-table';

  table.innerHTML = `
    <thead>
      <tr>
        <th scope="col">Order</th>
        <th scope="col">Service</th>
        <th scope="col">Amount</th>
        <th scope="col">Status</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement('tbody');
  for (const order of CLIENT_RECENT_ORDERS) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${order.id}</td>
      <td>${order.service}</td>
      <td>${order.amount}</td>
      <td><span class="mdj-client-table__status">${order.status}</span></td>
    `;
    tbody.append(row);
  }

  table.append(tbody);
  panel.append(table);
  section.append(panel);
  return section;
}

function createPaymentsSection(themeBinding: MdjThemeBinding): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-client-dashboard__section';
  section.dataset.mdjClientSection = 'pending-payments';

  const panel = mountComponentDescriptor(
    createPanel({ title: 'Pending Payments', variant: 'glass' }, themeBinding),
  );

  const list = document.createElement('dl');
  list.className = 'mdj-client-summary-list';

  for (const item of CLIENT_PENDING_PAYMENTS) {
    const row = document.createElement('div');
    row.className = 'mdj-client-summary-list__row';

    const dt = document.createElement('dt');
    dt.textContent = item.label;

    const dd = document.createElement('dd');
    dd.textContent = item.value;

    row.append(dt, dd);
    list.append(row);
  }

  panel.append(list);
  section.append(panel);
  return section;
}

function createDocumentsSection(themeBinding: MdjThemeBinding): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-client-dashboard__section';
  section.dataset.mdjClientSection = 'documents';

  section.append(
    mountComponentDescriptor(
      createSectionHeader({ title: 'Documents', variant: 'module-grid' }, themeBinding),
    ),
  );

  const list = document.createElement('ul');
  list.className = 'mdj-client-list';

  for (const documentName of CLIENT_DOCUMENTS) {
    const item = document.createElement('li');
    item.className = 'mdj-client-list__item';
    item.textContent = documentName;
    list.append(item);
  }

  section.append(list);
  return section;
}

function createVipSection(themeBinding: MdjThemeBinding): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-client-dashboard__section';
  section.dataset.mdjClientSection = 'vip-membership';

  section.append(
    mountComponentDescriptor(
      createModuleCard(
        {
          title: CLIENT_VIP.tier,
          description: `${CLIENT_VIP.perks}. ${CLIENT_VIP.renewal}.`,
          tag: 'Premium',
        },
        themeBinding,
      ),
    ),
  );

  return section;
}

function createNotificationsSection(themeBinding: MdjThemeBinding): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-client-dashboard__section';
  section.dataset.mdjClientSection = 'notifications';

  const panel = mountComponentDescriptor(
    createPanel({ title: 'Notifications', variant: 'elevated' }, themeBinding),
  );

  const list = document.createElement('ul');
  list.className = 'mdj-client-list';

  for (const notification of CLIENT_NOTIFICATIONS) {
    const item = document.createElement('li');
    item.className = 'mdj-client-list__item';
    item.textContent = notification;
    list.append(item);
  }

  panel.append(list);
  section.append(panel);
  return section;
}

function createActivitySection(themeBinding: MdjThemeBinding): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-client-dashboard__section mdj-client-dashboard__section--wide';
  section.dataset.mdjClientSection = 'activity-timeline';

  section.append(
    mountComponentDescriptor(
      createSectionHeader({ title: 'Activity Timeline', variant: 'module-grid' }, themeBinding),
    ),
  );

  const timeline = document.createElement('div');
  timeline.className = 'mdj-client-activity';

  for (const entry of CLIENT_ACTIVITY) {
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

  section.append(timeline);

  section.append(
    mountComponentDescriptor(
      createEmptyState(
        {
          title: 'More activity coming soon',
          description: 'Your full client history will appear here in a future release.',
          hint: 'Placeholder timeline only',
        },
        themeBinding,
      ),
    ),
  );

  return section;
}

export function renderClientDashboardMvp(mainRegion: HTMLElement): void {
  const themeBinding = resolveClientDashboardThemeBinding();
  mainRegion.classList.add('mdj-client-dashboard');
  mainRegion.replaceChildren();

  const hero = mountComponentDescriptor(
    createHeroBanner(
      {
        eyebrow: 'Welcome back',
        title: 'Your Miami DJ Beat Client Dashboard',
        subtitle:
          'Plan unforgettable events, track orders, manage payments, and access VIP benefits — all in one place.',
      },
      themeBinding,
    ),
  );

  const kpiGrid = mountComponentDescriptor(
    createDashboardCard({ variant: 'kpi-grid', region: 'kpis' }, themeBinding),
  );
  kpiGrid.replaceChildren(
    ...CLIENT_DASHBOARD_KPIS.map((kpi) =>
      mountComponentDescriptor(createKpiCard(kpi, themeBinding)),
    ),
  );

  const contentGrid = document.createElement('div');
  contentGrid.className = 'mdj-client-dashboard__grid';
  contentGrid.append(
    createQuickActionsSection(themeBinding),
    createUpcomingEventsSection(themeBinding),
    createRecentOrdersSection(themeBinding),
    createPaymentsSection(themeBinding),
    createDocumentsSection(themeBinding),
    createVipSection(themeBinding),
    createNotificationsSection(themeBinding),
    createActivitySection(themeBinding),
  );

  mainRegion.append(hero, kpiGrid, contentGrid);
}
