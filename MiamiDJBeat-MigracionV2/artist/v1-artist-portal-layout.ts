/**
 * V2 lab — lift & shift artist portal chrome from ui-v1-clone/dj-profile.html
 * + admin-dashboard artist strip (STAFF + SoundForTips).
 */

import { MDJ_V1_ASSET_BASE } from '../shared/branding/mount-v1-site-header';
import { getLabPortalIdentity } from '../shared/branding/lab-portal-identity-ssot';
import {
  createArtistTabController,
  wireArtistTabController,
} from './tabs/artist-tab-controller';

export type ArtistV1LayoutOptions = {
  readonly profile?: {
    readonly photoUrl?: string | null;
    readonly backgroundUrl?: string | null;
    readonly stageName?: string | null;
  } | null;
};

export type ArtistV1LayoutSlots = {
  readonly root: HTMLElement;
  readonly hero: HTMLElement;
  readonly mainCol: HTMLElement;
  /** MOD-206 — the 3-tab bar + panels wrapper (Mi Perfil / Agenda · Gigs / Ingresos · Wallet). */
  readonly tabPanelsWrap: HTMLElement;
  readonly mutationsHost: HTMLElement;
};

function createSectionSlot(sectionId: string, wide = false): HTMLElement {
  const section = document.createElement('section');
  section.className = `mdj-client-dashboard__section${wide ? ' mdj-client-dashboard__section--wide' : ''} dj-card mdj-v2-v1-slot`;
  section.dataset.mdjArtistSection = sectionId;
  return section;
}

/** Capitan strip: INICIO / ACADEMIA / SHOP / AGENDA / CONFIG / DJ TOOLS / CASH FLOW / MI PERFIL / STAFF / SOUNDFORTIPS */
export function mountArtistOwnerTabs(): HTMLElement {
  let tabs = document.getElementById('owner-tabs');
  if (tabs?.dataset.mdjV2LabArtistTabs === '1') return tabs;

  tabs = document.createElement('nav');
  tabs.className = 'dj-owner-tabs';
  tabs.id = 'owner-tabs';
  tabs.dataset.mdjNoMarquee = '1';
  tabs.dataset.mdjV2LabArtistTabs = '1';
  tabs.setAttribute('aria-label', 'Navegación de artista');

  const container = document.createElement('div');
  container.className = 'container';
  container.innerHTML = `
    <a href="${MDJ_V1_ASSET_BASE}/index.html" class="dj-tab-btn dj-tab-btn--home" data-i18n="nav-home">Inicio</a>
    <a href="${MDJ_V1_ASSET_BASE}/academia.html?mdj_nav=profile" class="dj-tab-btn" data-i18n="nav-academia">Academia</a>
    <a href="${MDJ_V1_ASSET_BASE}/shop.html?mdj_nav=profile" class="dj-tab-btn" data-i18n="nav-shop">Shop</a>
    <a href="#agenda-fullpage" class="dj-tab-btn" data-i18n="dash-your-profile" data-mdj-agenda-fullpage-link="1">Agenda</a>
    <a href="${MDJ_V1_ASSET_BASE}/account-settings.html?mdj_nav=profile" class="dj-tab-btn" data-i18n="nav-settings">⚙️ CONFIG</a>
    <a href="${MDJ_V1_ASSET_BASE}/dj-tools.html?mdj_nav=profile" class="dj-tab-btn" data-i18n="nav-tools">DJ Tools</a>
    <a href="${MDJ_V1_ASSET_BASE}/dj-dashboard.html?tab=flow&amp;mdj_nav=profile" class="dj-tab-btn" data-i18n="flow-dash">Cash Flow</a>
    <a href="/artist/" class="dj-tab-btn active" data-i18n="menu-account">Mi Perfil</a>
    <a href="/staff/" class="dj-tab-btn" data-mdj-nav="staff">STAFF</a>
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

  document.body.classList.add('dj-profile', 'mdj-from-profile');
  return tabs;
}

export function buildArtistV1PortalLayout(options?: ArtistV1LayoutOptions): ArtistV1LayoutSlots {
  const root = document.createElement('div');
  root.className = 'mdj-v2-v1-artist-portal';
  root.dataset.mdjV1ArtistLayout = '1';

  /* SSOT: LabPortalIdentity · mirrors V1 dj_profiles photo_url / background_url / stage_name */
  const identity = getLabPortalIdentity('artist');
  const stageName = options?.profile?.stageName || identity.stageName || identity.displayName;
  const photo = (options?.profile?.photoUrl || identity.photoUrl).trim();
  const cover = (options?.profile?.backgroundUrl || identity.backgroundUrl).trim();

  const hero = document.createElement('div');
  hero.className = 'dj-hero mdj-v2-v1-dj-hero';
  hero.dataset.mdjIdentitySsot = identity.username;
  hero.dataset.mdjV1AssetMap = 'ssot:artist.photoUrl+backgroundUrl';
  hero.innerHTML = `
    <img class="dj-hero-bg-photo loaded" id="hero-bg-photo" src="${cover}" alt="Cover — ${stageName}" />
    <div class="dj-hero-overlay"></div>
    <div id="pub-hero-top-stack" class="dj-hero-top-stack" style="display:block;">
      <div id="pub-hero-plan-pill" class="dj-hero-plan-pill dj-hero-plan-pill--pro">✦ ARTISTA · VERIFICADO</div>
    </div>
    <div class="dj-hero-inset">
      <img id="pub-photo-inset" class="loaded" src="${photo}" alt="${stageName}" />
    </div>
    <div class="dj-hero-content">
      <div class="dj-hero-left">
        <div class="dj-hero-role" id="pub-role-label">DJ · PRODUCER</div>
        <h1 id="pub-name" class="dj-hero-name">${stageName}<span class="dot">.</span></h1>
        <div class="dj-rating" id="pub-hero-rating"></div>
      </div>
    </div>
  `.trim();

  const body = document.createElement('div');
  body.className = 'dj-body dj-body--no-sidebar';

  const mainCol = document.createElement('div');
  mainCol.className = 'dj-main-col';

  const mutationsCard = document.createElement('div');
  mutationsCard.className = 'dj-card mdj-v2-v1-ops-card';
  const mutationsTitle = document.createElement('h3');
  mutationsTitle.className = 'mdj-v2-v1-ops-card__title';
  mutationsTitle.textContent = 'Writers · Gig & Payout';
  const mutationsHost = createSectionSlot('artist-mutations', true);
  mutationsHost.classList.add('mdj-v2-v1-mutations-slot');
  mutationsCard.append(mutationsTitle, mutationsHost);
  mainCol.append(mutationsCard);

  const gigsSlot = createSectionSlot('upcoming-gigs', true);
  gigsSlot.classList.add('mdj-v2-v1-ops-card');
  mainCol.append(gigsSlot);

  const scheduleSlot = createSectionSlot('artist-schedule', true);
  scheduleSlot.classList.add('mdj-v2-v1-ops-card');
  mainCol.append(scheduleSlot);

  const walletSlot = createSectionSlot('artist-wallet', true);
  walletSlot.classList.add('mdj-v2-v1-ops-card');
  mainCol.append(walletSlot);

  /* Real slice (Gig Weather Radar, real per-gig risk/forecast/advice) — no
     legacy-hide class. Was previously caught by the same generic hide
     mechanism as the placeholder sections below; fixed 2026-08-12. */
  const weatherSlot = createSectionSlot('artist-weather', true);
  const jobsSlot = createSectionSlot('jobs-marketplace');
  jobsSlot.classList.add('mdj-v2-lab-legacy-mvp');
  const notifSlot = createSectionSlot('notifications');
  notifSlot.classList.add('mdj-v2-lab-legacy-mvp');
  const activitySlot = createSectionSlot('activity-timeline', true);
  activitySlot.classList.add('mdj-v2-lab-legacy-mvp');
  mainCol.append(weatherSlot, jobsSlot, notifSlot, activitySlot);

  body.append(mainCol);

  /* MOD-206 — "Mi Perfil" tab (Perfil + Bio, real; Media/Analytics/SoundForTips,
     un-hidden by explicit PO decision 2026-08-12, honestly labeled below).
     "Agenda · Gigs" / "Ingresos · Wallet" left prepared/empty — moving the real
     schedule/wallet/mutations content into them is a separate, future round. */
  const { tabBar, panels } = createArtistTabController([
    { id: 'profile', label: 'Mi Perfil' },
    { id: 'agenda', label: 'Agenda · Gigs' },
    { id: 'wallet', label: 'Ingresos · Wallet' },
  ]);

  const profileSlot = createSectionSlot('artist-profile');
  profileSlot.classList.add('owner-card');
  const songSlot = createSectionSlot('song4tips');
  const mediaSlot = createSectionSlot('media-library');
  const analyticsSlot = createSectionSlot('analytics');
  panels.profile.append(profileSlot, mediaSlot, analyticsSlot, songSlot);

  const agendaPrepared = document.createElement('p');
  agendaPrepared.className = 'mdj-artist-tab-panel__prepared-note';
  agendaPrepared.textContent =
    'Pestaña preparada — Agenda, Gigs y Writers se trasladarán aquí en una ronda futura.';
  panels.agenda.append(agendaPrepared);

  const walletPrepared = document.createElement('p');
  walletPrepared.className = 'mdj-artist-tab-panel__prepared-note';
  walletPrepared.textContent = 'Pestaña preparada — Ingresos/Wallet se trasladará aquí en una ronda futura.';
  panels.wallet.append(walletPrepared);

  const tabPanelsWrap = document.createElement('div');
  tabPanelsWrap.className = 'mdj-artist-tab-panels';
  tabPanelsWrap.append(panels.profile, panels.agenda, panels.wallet);

  wireArtistTabController(tabBar, panels);

  root.append(hero, tabBar, tabPanelsWrap, body);

  return { root, hero, mainCol, tabPanelsWrap, mutationsHost };
}
