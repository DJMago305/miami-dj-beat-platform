/** MOD-011 Artist Dashboard MVP — render — TICKET-MOD-011-ARTIST-DASHBOARD-MVP-001 */

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
  ARTIST_ACTIVITY,
  ARTIST_ANALYTICS,
  ARTIST_DASHBOARD_KPIS,
  ARTIST_JOBS,
  ARTIST_MEDIA,
  ARTIST_NOTIFICATIONS,
  ARTIST_SONG4TIPS,
} from './dashboard-mvp-data';
import { mountComponentDescriptor } from './mount-component-descriptor';
import { mountArtistProfileReadSliceSync } from './profile/mount-artist-profile-read-slice';
import { mountArtistScheduleReadSliceSync } from './schedule/mount-artist-schedule-read-slice';
import { mountArtistFinanceReadSliceSync } from './finance/mount-artist-finance-read-slice';
import { mountArtistWeatherReadSliceSync } from './weather/mount-artist-weather-read-slice';
import type { ArtistMutationsAdapter } from '../shared/services/artist-mutations/index';
import {
  renderArtistSessionWiringBadge,
  type ArtistSessionWiringInjection,
} from './session/artist-session-wiring-pilot';
import { applyV1BrandShell } from '../shared/branding/apply-v1-brand-shell';
import {
  buildArtistV1PortalLayout,
  mountArtistOwnerTabs,
} from './v1-artist-portal-layout';

function resolveArtistDashboardThemeBinding(): MdjThemeBinding {
  const tokens = getThemeDefinition('mdj-dark-gold')?.tokens;
  if (!tokens) {
    throw new Error('mdj-dark-gold theme tokens are required for artist dashboard MVP');
  }

  return createComponentThemeBinding(tokens);
}

function createArtistSection(sectionId: string, wide = false): HTMLElement {
  const section = document.createElement('section');
  section.className = `mdj-client-dashboard__section${wide ? ' mdj-client-dashboard__section--wide' : ''}`;
  section.dataset.mdjArtistSection = sectionId;
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

/** MOD-204 Slice 1 — profile slot; hydrated by mountArtistProfileReadSliceSync. */
function createProfileSection(_themeBinding: MdjThemeBinding): HTMLElement {
  return createArtistSection('artist-profile');
}

/** MOD-204 Slice 2 — schedule slot; hydrated by mountArtistScheduleReadSliceSync. */
function createArtistScheduleSection(): HTMLElement {
  return createArtistSection('artist-schedule', true);
}

/** MOD-204 Financial Slice — wallet slot; hydrated by mountArtistFinanceReadSliceSync. */
function createArtistWalletSection(): HTMLElement {
  return createArtistSection('artist-wallet', true);
}

/** MOD-204 Weather Slice — gig weather radar slot; hydrated by mountArtistWeatherReadSliceSync. */
function createArtistWeatherSection(): HTMLElement {
  return createArtistSection('artist-weather', true);
}

/** Writers Phase · Slice 2 · Paso 3 — artist mutation forms slot. */
function createArtistMutationsSection(): HTMLElement {
  return createArtistSection('artist-mutations', true);
}

/** MOD-204 Session Wiring Pilot — badge slot (ARTIST + masked DJ id). */
function createSessionWiringSection(sessionWiring: ArtistSessionWiringInjection): HTMLElement {
  const section = createArtistSection('session-wiring', true);
  const host = document.createElement('div');
  host.className = 'mdj-artist-session-wiring-host';
  host.dataset.mdjArtistSessionHost = 'mod-204-sw';
  renderArtistSessionWiringBadge(host, sessionWiring);
  section.append(host);
  return section;
}

/** MOD-206 — honest disclosure for the 3 sections un-hidden into "Mi Perfil". */
function createLabMockNote(text: string): HTMLElement {
  const note = document.createElement('p');
  note.className = 'mdj-artist-tab-panel__lab-badge';
  note.textContent = text;
  return note;
}

function createSong4TipsSection(themeBinding: MdjThemeBinding): HTMLElement {
  const section = createArtistSection('song4tips');

  const paymentConfigLink = document.createElement('button');
  paymentConfigLink.type = 'button';
  paymentConfigLink.className = 'mdj-song4tips-payment-link';
  paymentConfigLink.dataset.mdjSong4tipsPaymentConfigLink = '1';
  paymentConfigLink.textContent = 'Configurar Métodos de Pago';

  section.append(
    createLabMockNote('lab mock — placeholder, sin cableado real todavía'),
    mountComponentDescriptor(
      createModuleCard(
        {
          title: ARTIST_SONG4TIPS.title,
          description: ARTIST_SONG4TIPS.description,
          tag: ARTIST_SONG4TIPS.tag,
        },
        themeBinding,
      ),
    ),
    paymentConfigLink,
  );

  return section;
}

function createJobsSection(themeBinding: MdjThemeBinding): HTMLElement {
  const section = createArtistSection('jobs-marketplace');

  const panel = mountComponentDescriptor(
    createPanel({ title: 'Jobs Marketplace', variant: 'elevated' }, themeBinding),
  );
  panel.append(createList(ARTIST_JOBS));
  section.append(panel);
  return section;
}

function createMediaSection(themeBinding: MdjThemeBinding): HTMLElement {
  const section = createArtistSection('media-library');

  section.append(
    createLabMockNote('lab mock — placeholder, sin cableado real todavía'),
    mountComponentDescriptor(
      createSectionHeader({ title: 'Media Library', variant: 'module-grid' }, themeBinding),
    ),
    createList(ARTIST_MEDIA),
  );

  return section;
}

function createAnalyticsSection(themeBinding: MdjThemeBinding): HTMLElement {
  const section = createArtistSection('analytics');

  const panel = mountComponentDescriptor(
    createPanel({ title: 'Analytics', variant: 'glass' }, themeBinding),
  );
  section.append(createLabMockNote('lab mock — placeholder, sin cableado real todavía'));
  panel.append(createSummaryList(ARTIST_ANALYTICS));
  section.append(panel);
  return section;
}

function createNotificationsSection(themeBinding: MdjThemeBinding): HTMLElement {
  const section = createArtistSection('notifications');

  const panel = mountComponentDescriptor(
    createPanel({ title: 'Notifications', variant: 'elevated' }, themeBinding),
  );
  panel.append(createList(ARTIST_NOTIFICATIONS));
  section.append(panel);
  return section;
}

function createActivitySection(themeBinding: MdjThemeBinding): HTMLElement {
  const section = createArtistSection('activity-timeline', true);

  section.append(
    mountComponentDescriptor(
      createSectionHeader({ title: 'Activity Timeline', variant: 'module-grid' }, themeBinding),
    ),
  );

  const timeline = document.createElement('div');
  timeline.className = 'mdj-client-activity';

  for (const entry of ARTIST_ACTIVITY) {
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
          title: 'More artist activity coming soon',
          description: 'Full performer history and audit trail will appear in a future release.',
          hint: 'Placeholder timeline only',
        },
        themeBinding,
      ),
    ),
  );

  return section;
}

/**
 * MOD-206 — the top "Agenda" nav link used to anchor-scroll straight to
 * #agenda-fullpage; that target now lives inside the hidden-by-default
 * "Agenda · Gigs" tab panel, so the link must switch tabs first, then scroll.
 */
function wireAgendaFullpageNavLink(layoutRoot: HTMLElement): void {
  const link = document.querySelector<HTMLAnchorElement>('[data-mdj-agenda-fullpage-link="1"]');
  if (!link) return;

  link.addEventListener('click', (event) => {
    event.preventDefault();
    const tabButton = layoutRoot.querySelector<HTMLButtonElement>(
      '.mdj-artist-tabs__btn[data-tab="agenda"]',
    );
    tabButton?.click();
    document.getElementById('agenda-fullpage')?.scrollIntoView({ behavior: 'smooth' });
  });
}

/**
 * MOD-215 — the top "⚙️ CONFIG" nav link used to redirect out to
 * /v1/account-settings.html; per PO architecture decision (progressive
 * per-portal migration, not a V1/V2 Big Bang merge), it now switches to the
 * native "#config" tab inside this same V2 SPA instead of leaving the page.
 */
function wireArtistConfigNavLink(layoutRoot: HTMLElement): void {
  const link = document.querySelector<HTMLAnchorElement>('[data-mdj-config-tab-link="1"]');
  if (!link) return;

  link.addEventListener('click', (event) => {
    event.preventDefault();
    const tabButton = layoutRoot.querySelector<HTMLButtonElement>(
      '.mdj-artist-tabs__btn[data-tab="config"]',
    );
    tabButton?.click();
    layoutRoot.querySelector('.mdj-artist-tab-panels')?.scrollIntoView({ behavior: 'smooth' });
  });
}

/**
 * INSTRUCCIÓN 2026-08-12 — SoundForTips™'s "Configurar Métodos de Pago"
 * button switches to the "#wallet" tab (real Cash Flow / Balance SSOT /
 * Payment Config), since SoundForTips itself stays a #profile-scoped app
 * that only reads DJ payout-routing config, not a financial module.
 */
function wireSong4TipsPaymentConfigLink(layoutRoot: HTMLElement): void {
  const link = layoutRoot.querySelector<HTMLButtonElement>(
    '[data-mdj-song4tips-payment-config-link="1"]',
  );
  if (!link) return;

  link.addEventListener('click', () => {
    const tabButton = layoutRoot.querySelector<HTMLButtonElement>(
      '.mdj-artist-tabs__btn[data-tab="wallet"]',
    );
    tabButton?.click();
    layoutRoot.querySelector('[data-mdj-artist-section="artist-wallet"]')?.scrollIntoView({
      behavior: 'smooth',
    });
  });
}

export function renderArtistDashboardMvp(
  mainRegion: HTMLElement,
  sessionWiring?: ArtistSessionWiringInjection | null,
  _mutationsAdapter?: ArtistMutationsAdapter | null,
): void {
  const themeBinding = resolveArtistDashboardThemeBinding();
  mainRegion.classList.add('mdj-client-dashboard', 'mdj-v2-v1-artist-host');
  mainRegion.replaceChildren();

  mountArtistOwnerTabs();
  const layout = buildArtistV1PortalLayout();

  /* Legacy MVP nodes kept for unit tests; visually hidden via .mdj-v2-lab-legacy-* */
  const legacyHero = mountComponentDescriptor(
    createHeroBanner(
      {
        eyebrow: 'Performer workspace',
        title: 'Your Miami DJ Beat Artist Dashboard',
        subtitle:
          'Manage gigs, cash flow, Song4Tips, jobs, media, and performance insights from one professional console.',
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
    ...ARTIST_DASHBOARD_KPIS.map((kpi) =>
      mountComponentDescriptor(createKpiCard(kpi, themeBinding)),
    ),
  );

  const replaceLegacy = (
    sectionId: string,
    factory: () => HTMLElement,
    options?: { readonly legacy?: boolean },
  ): void => {
    const slot = layout.root.querySelector<HTMLElement>(
      `[data-mdj-artist-section="${sectionId}"]`,
    );
    if (!slot) return;
    const built = factory();
    if (options?.legacy !== false) {
      built.classList.add('mdj-v2-lab-legacy-mvp');
    }
    slot.replaceWith(built);
  };

  /* MOD-206 — un-hidden into the "Mi Perfil" tab, PO decision 2026-08-12
     (previously CSS-hidden as "Capitan rejected" legacy MVP lists; now shown
     as honestly-labeled placeholders instead). Everything else keeps its
     prior hidden treatment unchanged. */
  replaceLegacy('song4tips', () => createSong4TipsSection(themeBinding), { legacy: false });
  replaceLegacy('jobs-marketplace', () => createJobsSection(themeBinding));
  replaceLegacy('media-library', () => createMediaSection(themeBinding), { legacy: false });
  replaceLegacy('analytics', () => createAnalyticsSection(themeBinding), { legacy: false });
  replaceLegacy('notifications', () => createNotificationsSection(themeBinding));
  replaceLegacy('activity-timeline', () => createActivitySection(themeBinding));
  /* Real slice (Gig Weather Radar) — was accidentally caught by the generic
     legacy-hide default; fixed 2026-08-12, PO-authorized. */
  replaceLegacy('artist-weather', () => createArtistWeatherSection(), { legacy: false });

  if (sessionWiring) {
    const sessionSection = createSessionWiringSection(sessionWiring);
    sessionSection.classList.add('mdj-v2-lab-legacy-mvp');
    layout.mainCol.append(sessionSection);
  }

  mainRegion.append(legacyHero, legacyKpis, layout.root);
  applyV1BrandShell(mainRegion, 'artist');
  wireAgendaFullpageNavLink(layout.root);
  wireArtistConfigNavLink(layout.root);
  wireSong4TipsPaymentConfigLink(layout.root);
  mountArtistProfileReadSliceSync(mainRegion, undefined, sessionWiring);
  mountArtistScheduleReadSliceSync(mainRegion, undefined, sessionWiring);
  mountArtistFinanceReadSliceSync(mainRegion, undefined, sessionWiring);
  mountArtistWeatherReadSliceSync(mainRegion, undefined, sessionWiring);
  /* Artist mutations slice mounted once, downstream, in artist/main.ts's mountDashboard —
     not here, to avoid the double-mount this replaced (render-then-remount on the same slot). */
}
