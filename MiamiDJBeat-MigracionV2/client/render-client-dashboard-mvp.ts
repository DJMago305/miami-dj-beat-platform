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
  CLIENT_VIP,
} from './dashboard-mvp-data';
import { mountComponentDescriptor } from './mount-component-descriptor';
import { mountClientProfileReadSliceSync } from './profile/mount-client-profile-read-slice';
import { mountClientBookingsReadSliceSync } from './bookings/mount-client-bookings-read-slice';
import { mountClientFinanceReadSliceSync } from './finance/mount-client-finance-read-slice';
import { mountClientWeatherReadSliceSync } from './weather/mount-client-weather-read-slice';
import type { ClientMutationsAdapter } from '../shared/services/client-mutations/index';
import {
  renderClientSessionWiringBadge,
  type ClientSessionWiringInjection,
} from './session/client-session-wiring-pilot';
import { applyV1BrandShell } from '../shared/branding/apply-v1-brand-shell';
import {
  createClientTabController,
  wireClientTabController,
} from './tabs/client-tab-controller';

function resolveClientDashboardThemeBinding(): MdjThemeBinding {
  const tokens = getThemeDefinition('mdj-dark-gold')?.tokens;
  if (!tokens) {
    throw new Error('mdj-dark-gold theme tokens are required for client dashboard MVP');
  }

  return createComponentThemeBinding(tokens);
}

function createClientProfileSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-client-dashboard__section mdj-client-dashboard__section--wide';
  section.dataset.mdjClientSection = 'client-profile';
  return section;
}

/** MOD-103 Slice 2 — bookings slot; hydrated by mountClientBookingsReadSliceSync. */
function createClientBookingsSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-client-dashboard__section mdj-client-dashboard__section--wide';
  section.dataset.mdjClientSection = 'client-bookings';
  return section;
}

/** MOD-103 Financial Slice — payments slot; hydrated by mountClientFinanceReadSliceSync. */
function createClientPaymentsSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-client-dashboard__section mdj-client-dashboard__section--wide';
  section.dataset.mdjClientSection = 'client-payments';
  return section;
}

/** MOD-103 Weather Slice — event weather slot; hydrated by mountClientWeatherReadSliceSync. */
function createClientWeatherSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-client-dashboard__section mdj-client-dashboard__section--wide';
  section.dataset.mdjClientSection = 'client-weather';
  return section;
}

/** Writers Phase · Slice 1 · Paso 3 — client mutation forms slot. */
function createClientMutationsSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-client-dashboard__section mdj-client-dashboard__section--wide';
  section.dataset.mdjClientSection = 'client-mutations';
  return section;
}

/** MOD-103 Session Wiring Pilot — badge slot (CLIENT + masked client id). */
function createSessionWiringSection(sessionWiring: ClientSessionWiringInjection): HTMLElement {
  const section = document.createElement('section');
  section.className =
    'mdj-client-dashboard__section mdj-client-dashboard__section--wide mdj-v2-lab-legacy-mvp';
  section.dataset.mdjClientSection = 'session-wiring';
  const host = document.createElement('div');
  host.className = 'mdj-client-session-wiring-host';
  host.dataset.mdjClientSessionHost = 'mod-103-sw';
  renderClientSessionWiringBadge(host, sessionWiring);
  section.append(host);
  return section;
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

function createRecentOrdersSection(themeBinding: MdjThemeBinding): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-client-dashboard__section mdj-client-dashboard__section--wide';
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

function createDocumentsSection(themeBinding: MdjThemeBinding): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-client-dashboard__section mdj-client-dashboard__section--wide';
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

/**
 * MOD-207 — Pagos y Finanzas tab: CLIENT_PENDING_PAYMENTS summary (balance
 * due, next reminder, payment method). Previously only fed the Hero KPI
 * strip's "Pending Payments" card with no section rendering the list itself.
 */
function createPendingPaymentsSection(themeBinding: MdjThemeBinding): HTMLElement {
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

function createVipSection(themeBinding: MdjThemeBinding): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-client-dashboard__section';
  section.dataset.mdjClientSection = 'vip-membership';

  /* MOD-211 — was hardcoded 'Premium' regardless of actual VIP status,
     contradicting "Cliente regular" clients with no active membership
     (visual audit finding, 2026-08-12). Derives from the same SSOT status
     the rest of the card already uses. */
  const vipTag = CLIENT_VIP.status === 'vip' ? 'VIP' : 'STANDARD';

  section.append(
    mountComponentDescriptor(
      createModuleCard(
        {
          title: CLIENT_VIP.tier,
          description: `${CLIENT_VIP.perks}. ${CLIENT_VIP.renewal}.`,
          tag: vipTag,
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

export function renderClientDashboardMvp(
  mainRegion: HTMLElement,
  sessionWiring?: ClientSessionWiringInjection | null,
  _mutationsAdapter?: ClientMutationsAdapter | null,
): void {
  const themeBinding = resolveClientDashboardThemeBinding();
  mainRegion.classList.add('mdj-client-dashboard');
  mainRegion.replaceChildren();

  const hero = mountComponentDescriptor(
    createHeroBanner(
      {
        eyebrow: 'Welcome back · lab mock / client portal overview',
        title: 'Your Miami DJ Beat Client Dashboard',
        subtitle:
          'Plan unforgettable events, track orders, manage payments, and access VIP benefits — all in one place.',
      },
      themeBinding,
    ),
  );
  hero.classList.add('mdj-client-dashboard__section--wide');

  const kpiGrid = mountComponentDescriptor(
    createDashboardCard({ variant: 'kpi-grid', region: 'kpis' }, themeBinding),
  );
  kpiGrid.replaceChildren(
    ...CLIENT_DASHBOARD_KPIS.map((kpi) =>
      mountComponentDescriptor(createKpiCard(kpi, themeBinding)),
    ),
  );
  kpiGrid.classList.add('mdj-client-dashboard__section--wide');

  /* MOD-207 — definitive tab distribution (Capitan, 2026-08-12), mirrors
     ui-v1-clone/client-account.html's .ca-panel + .is-active pattern (same
     mechanism already ported for Artist in MOD-206):
     #overview = Hero + KPIs (SSOT) + real Profile/Contact/Config + VIP +
                 Quick Actions + Notifications + Activity (account-level,
                 not booking/finance-specific).
     #bookings = real Bookings slice ("My Reservations & Event Flow") +
                 CLIENT_RECENT_ORDERS + booking request/payment-proof forms
                 + event Documents (contracts/riders/insurance) + event
                 Weather — Weather/Documents placed here as the closest
                 event-scoped fit (same reasoning as Agenda's Gig Weather
                 Radar in MOD-206). Legacy "upcoming-events" section
                 (CLIENT_UPCOMING_EVENTS timeline) REMOVED outright, not
                 just hidden — fully superseded by the real Bookings slice,
                 same pattern as "upcoming-gigs" in MOD-206 (Capitan,
                 2026-08-12). CLIENT_UPCOMING_EVENTS itself stays — still
                 feeds the Hero KPI strip's "Active Events" card.
     #finance  = real Payment Receipts/balance slice + new
                 Pending Payments summary (CLIENT_PENDING_PAYMENTS had no
                 rendering section before this round — it only fed the KPI
                 strip). */
  const { tabBar, panels } = createClientTabController([
    { id: 'overview', label: 'Perfil y Resumen' },
    { id: 'bookings', label: 'Eventos y Reservas' },
    { id: 'finance', label: 'Pagos y Finanzas' },
  ]);

  if (sessionWiring) {
    panels.overview.append(createSessionWiringSection(sessionWiring));
  }
  panels.overview.append(
    hero,
    kpiGrid,
    createClientProfileSection(),
    createVipSection(themeBinding),
    createQuickActionsSection(themeBinding),
    createNotificationsSection(themeBinding),
    createActivitySection(themeBinding),
  );

  /* MOD-211 — Recent Orders and Documents were the only two non-`--wide`
     (half-width) sections in this panel, each landing alone in its own
     grid row with the other half empty (visual audit finding,
     2026-08-12). Both now carry `--wide` like every other section here. */
  panels.bookings.append(
    createClientBookingsSection(),
    createRecentOrdersSection(themeBinding),
    createClientMutationsSection(),
    createClientWeatherSection(),
    createDocumentsSection(themeBinding),
  );

  panels.finance.append(createClientPaymentsSection(), createPendingPaymentsSection(themeBinding));

  const tabPanelsWrap = document.createElement('div');
  tabPanelsWrap.className = 'mdj-client-tab-panels';
  tabPanelsWrap.append(panels.overview, panels.bookings, panels.finance);

  wireClientTabController(tabBar, panels);

  mainRegion.append(tabBar, tabPanelsWrap);
  /* Priority 2 · Paso 1 — V1 master container + brand mark (visual only). */
  applyV1BrandShell(mainRegion, 'client');
  mountClientProfileReadSliceSync(mainRegion, undefined, sessionWiring);
  mountClientBookingsReadSliceSync(mainRegion, undefined, sessionWiring);
  mountClientFinanceReadSliceSync(mainRegion, undefined, sessionWiring);
  mountClientWeatherReadSliceSync(mainRegion, undefined, sessionWiring);
  /* Client mutations slice mounted once, downstream, in client/main.ts's mountDashboard —
     not here, to avoid the double-mount this replaced (render-then-remount on the same slot). */
}
