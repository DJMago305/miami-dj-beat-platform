/**
 * V2 lab — lift & shift staff ops console from ui-v1-clone/admin-dashboard.html
 */

import { MDJ_V1_ASSET_BASE } from '../shared/branding/mount-v1-site-header';
import { getLabPortalIdentity } from '../shared/branding/lab-portal-identity-ssot';
import { STAFF_LEADS } from './dashboard-mvp-data';
import type { StaffDashboardDataProvider } from './data/staff-dashboard-data-provider';

export type StaffV1LayoutOptions = {
  readonly photoUrl?: string | null;
  readonly backgroundUrl?: string | null;
  readonly displayName?: string | null;
};

export type StaffV1LayoutSlots = {
  readonly root: HTMLElement;
  readonly content: HTMLElement;
  readonly mutationsHost: HTMLElement;
};

function createSectionSlot(sectionId: string, wide = false): HTMLElement {
  const section = document.createElement('section');
  section.className = `mdj-client-dashboard__section${wide ? ' mdj-client-dashboard__section--wide' : ''} admin-card mdj-v2-v1-slot`;
  section.dataset.mdjStaffSection = sectionId;
  return section;
}

export function mountStaffOwnerTabs(): HTMLElement {
  let tabs = document.getElementById('owner-tabs');
  if (tabs?.dataset.mdjV2LabStaffTabs === '1') return tabs;

  tabs = document.createElement('nav');
  tabs.className = 'dj-owner-tabs';
  tabs.id = 'owner-tabs';
  tabs.dataset.mdjNoMarquee = '1';
  tabs.dataset.mdjV2LabStaffTabs = '1';
  tabs.setAttribute('aria-label', 'Staff navigation');

  const container = document.createElement('div');
  container.className = 'container';
  container.innerHTML = `
    <a href="${MDJ_V1_ASSET_BASE}/index.html" class="dj-tab-btn dj-tab-btn--home" data-i18n="nav-home">Inicio</a>
    <a href="${MDJ_V1_ASSET_BASE}/academia.html?mdj_nav=profile" class="dj-tab-btn" data-i18n="nav-academia">Academia</a>
    <a href="${MDJ_V1_ASSET_BASE}/shop.html?mdj_nav=profile" class="dj-tab-btn" data-i18n="nav-shop">Shop</a>
    <a href="${MDJ_V1_ASSET_BASE}/dj-dashboard.html?mdj_nav=profile" class="dj-tab-btn" data-i18n="dash-your-profile">Agenda</a>
    <a href="${MDJ_V1_ASSET_BASE}/account-settings.html?mdj_nav=profile" class="dj-tab-btn" data-i18n="nav-settings">⚙️ CONFIG</a>
    <a href="${MDJ_V1_ASSET_BASE}/dj-tools.html?mdj_nav=profile" class="dj-tab-btn" data-i18n="nav-tools">DJ Tools</a>
    <a href="${MDJ_V1_ASSET_BASE}/dj-dashboard.html?tab=flow&amp;mdj_nav=profile" class="dj-tab-btn" data-i18n="flow-dash">Cash Flow</a>
    <a href="${MDJ_V1_ASSET_BASE}/dj-profile.html?mdj_nav=profile" class="dj-tab-btn" data-i18n="menu-account">Mi Perfil</a>
    <a href="/staff/" class="dj-tab-btn active" data-mdj-nav="staff">STAFF</a>
    <a href="${MDJ_V1_ASSET_BASE}/dj-profile.html?tab=sft&amp;mdj_nav=profile" class="dj-tab-btn" data-i18n="nav-soundfortips">SoundForTips™</a>
  `.trim();

  tabs.append(container);

  const headerHost = document.getElementById('mdj-v2-v1-site-header-host');
  const app = document.getElementById('app');
  if (headerHost?.nextSibling) {
    headerHost.parentNode?.insertBefore(tabs, headerHost.nextSibling);
  } else if (app?.parentNode) {
    app.parentNode.insertBefore(tabs, app);
  } else {
    document.body.prepend(tabs);
  }

  document.body.classList.add('mdj-artist-academy', 'page-admin-dashboard');
  return tabs;
}

function buildOwnerHeroBanner(options?: StaffV1LayoutOptions): HTMLElement {
  const hero = document.createElement('section');
  hero.className = 'mdj-v2-owner-hero';
  hero.dataset.mdjOwnerHero = '1';

  /* SSOT only — Gerardo A Valle owner (never artist stage assets) */
  const identity = getLabPortalIdentity('staff');
  const photo = (options?.photoUrl || identity.photoUrl).trim();
  const eagleBg = (options?.backgroundUrl || identity.backgroundUrl).trim();
  const title = (options?.displayName || identity.displayName).trim();

  hero.dataset.mdjIdentitySsot = identity.role;
  hero.dataset.mdjIdentityUserId = identity.userId;
  hero.dataset.mdjV1AssetMap = 'ssot:staff.photoUrl+backgroundUrl';

  hero.innerHTML = `
    <div class="mdj-v2-owner-hero__bg" style="background-image:url('${eagleBg}')" aria-hidden="true"></div>
    <div class="mdj-v2-owner-hero__overlay"></div>
    <div class="mdj-v2-owner-hero__content">
      <p class="mdj-v2-owner-hero__eyebrow">✦ OWNER · VERIFICADO</p>
      <h1 class="mdj-v2-owner-hero__title">${title}</h1>
      <p class="mdj-v2-owner-hero__meta">Miami DJ Beat · Operations Console</p>
    </div>
    <div class="mdj-v2-owner-hero__inset">
      <img src="${photo}" alt="${title}" />
    </div>
  `.trim();

  return hero;
}

function buildLeadsTable(dataProvider: StaffDashboardDataProvider): HTMLElement {
  const wrap = document.createElement('div');
  wrap.id = 'leads';
  wrap.className = 'mdj-v2-leads-panel';
  wrap.style.display = 'block';

  const title = document.createElement('h3');
  title.className = 'mdj-v2-leads-panel__title';
  title.textContent = 'Solicitudes de Clientes';

  const sourceBadge = document.createElement('p');
  sourceBadge.className = 'mdj-v2-leads-panel__source-badge';
  sourceBadge.textContent = 'lab mock / client requests';

  const tableWrap = document.createElement('div');
  tableWrap.className = 'leads-table-wrap';
  tableWrap.id = 'leads-container';

  const table = document.createElement('table');
  table.className = 'mdj-v2-leads-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Solicitud</th>
        <th>Fuente</th>
        <th>Estado</th>
      </tr>
    </thead>
  `;
  const tbody = document.createElement('tbody');
  const mvp = dataProvider.getMvpView();
  const leads = mvp.pipelineLeads.length > 0 ? mvp.pipelineLeads : STAFF_LEADS;

  for (const lead of leads) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${lead.date}</td>
      <td>${lead.title}</td>
      <td>${lead.source}</td>
      <td><span class="leads-status--open">${lead.status}</span></td>
    `;
    tbody.append(tr);
  }
  table.append(tbody);
  tableWrap.append(table);
  wrap.append(title, sourceBadge, tableWrap);
  return wrap;
}

export function buildStaffV1OpsLayout(
  dataProvider: StaffDashboardDataProvider,
  options?: StaffV1LayoutOptions,
): StaffV1LayoutSlots {
  const root = document.createElement('div');
  root.className = 'mdj-v2-v1-staff-portal container';
  root.dataset.mdjV1StaffLayout = '1';

  const grid = document.createElement('div');
  grid.className = 'admin-grid';

  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.innerHTML = `
    <a href="#profile" class="side-link side-link--staff-settings" style="display:flex;align-items:center;gap:9px;">Perfil</a>
    <div class="sidebar-group-label">Clientes</div>
    <a href="#leads" class="side-link active" style="display:flex;align-items:center;gap:9px;">Leads</a>
    <a href="#actividad" class="side-link" style="display:flex;align-items:center;gap:9px;">Actividad</a>
    <a href="#crm" class="side-link" style="display:flex;align-items:center;gap:9px;">Base CRM</a>
    <div class="sidebar-group-label">Equipo</div>
    <a href="#djs" class="side-link" style="display:flex;align-items:center;gap:9px;">Gestión de DJs</a>
    <a href="#staff" class="side-link" style="display:flex;align-items:center;gap:9px;">Staff</a>
    <div class="sidebar-group-label">Operaciones</div>
    <a href="#writers" class="side-link" style="display:flex;align-items:center;gap:9px;">Writers · Pagos</a>
    <a href="#production" class="side-link" style="display:flex;align-items:center;gap:9px;">Production</a>
  `.trim();

  const content = document.createElement('section');
  content.className = 'content';

  content.append(buildOwnerHeroBanner(options));
  content.append(buildLeadsTable(dataProvider));

  const mutationsCard = document.createElement('div');
  mutationsCard.className = 'admin-card mdj-v2-v1-ops-card';
  mutationsCard.id = 'writers';
  const mutationsTitle = document.createElement('h3');
  mutationsTitle.className = 'mdj-v2-v1-ops-card__title';
  mutationsTitle.textContent = 'Writers · Payment Review & Artist Assignment';
  const mutationsHost = createSectionSlot('staff-mutations', true);
  mutationsHost.classList.add('mdj-v2-v1-mutations-slot');
  mutationsCard.append(mutationsTitle, mutationsHost);
  content.append(mutationsCard);

  const profileSlot = createSectionSlot('staff-profile');
  profileSlot.id = 'profile';
  content.append(profileSlot);

  const opsPreview = createSectionSlot('operations-preview', true);
  opsPreview.classList.add('mdj-v2-lab-legacy-mvp');
  const quick = createSectionSlot('quick-actions', true);
  quick.classList.add('mdj-v2-lab-legacy-mvp');
  const cal = createSectionSlot('master-calendar', true);
  const fin = createSectionSlot('master-finance', true);
  const weather = createSectionSlot('master-weather', true);
  weather.classList.add('mdj-v2-lab-legacy-mvp');
  const leadsPipe = createSectionSlot('leads-pipeline', true);
  leadsPipe.classList.add('mdj-v2-lab-legacy-mvp');
  const invoices = createSectionSlot('invoices-queue');
  invoices.classList.add('mdj-v2-lab-legacy-mvp');
  const crm = createSectionSlot('crm-snapshot');
  crm.id = 'crm';
  const production = createSectionSlot('production-tasks');
  production.id = 'production';
  const matching = createSectionSlot('matching-queue');
  matching.classList.add('mdj-v2-lab-legacy-mvp');
  const reports = createSectionSlot('reports-preview');
  reports.classList.add('mdj-v2-lab-legacy-mvp');
  const notif = createSectionSlot('notifications');
  notif.classList.add('mdj-v2-lab-legacy-mvp');
  const activity = createSectionSlot('activity-timeline', true);
  activity.id = 'actividad';

  content.append(
    opsPreview,
    quick,
    cal,
    fin,
    weather,
    leadsPipe,
    invoices,
    crm,
    production,
    matching,
    reports,
    notif,
    activity,
  );

  grid.append(sidebar, content);
  root.append(grid);

  return { root, content, mutationsHost };
}
