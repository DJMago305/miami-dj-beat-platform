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
  ARTIST_UPCOMING_GIGS,
} from './dashboard-mvp-data';
import { mountComponentDescriptor } from './mount-component-descriptor';
import { mountArtistProfileReadSliceSync } from './profile/mount-artist-profile-read-slice';
import { mountArtistScheduleReadSliceSync } from './schedule/mount-artist-schedule-read-slice';
import { mountArtistFinanceReadSliceSync } from './finance/mount-artist-finance-read-slice';
import { mountArtistWeatherReadSliceSync } from './weather/mount-artist-weather-read-slice';
import { mountArtistMutationsSliceSync } from './mutations/mount-artist-mutations-slice';
import type { ArtistMutationsAdapter } from '../shared/services/artist-mutations/index';
import {
  renderArtistSessionWiringBadge,
  type ArtistSessionWiringInjection,
} from './session/artist-session-wiring-pilot';

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

function createUpcomingGigsSection(themeBinding: MdjThemeBinding): HTMLElement {
  const section = createArtistSection('upcoming-gigs', true);

  const panel = mountComponentDescriptor(
    createPanel({ title: 'Upcoming Gigs', variant: 'glass' }, themeBinding),
  );
  panel.classList.add('mdj-client-panel--timeline');

  const timeline = document.createElement('div');
  timeline.className = 'mdj-client-timeline';

  for (const gig of ARTIST_UPCOMING_GIGS) {
    const item = document.createElement('article');
    item.className = 'mdj-client-timeline__item';

    const date = document.createElement('p');
    date.className = 'mdj-client-timeline__date';
    date.textContent = gig.date;

    const title = document.createElement('h3');
    title.className = 'mdj-client-timeline__title';
    title.textContent = gig.title;

    const venue = document.createElement('p');
    venue.className = 'mdj-client-timeline__meta';
    venue.textContent = gig.venue;

    const payout = document.createElement('span');
    payout.className = 'mdj-client-timeline__status';
    payout.textContent = gig.payout;

    item.append(date, title, venue, payout);
    timeline.append(item);
  }

  panel.append(timeline);
  section.append(panel);
  return section;
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

function createSong4TipsSection(themeBinding: MdjThemeBinding): HTMLElement {
  const section = createArtistSection('song4tips');

  section.append(
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

export function renderArtistDashboardMvp(
  mainRegion: HTMLElement,
  sessionWiring?: ArtistSessionWiringInjection | null,
  mutationsAdapter?: ArtistMutationsAdapter | null,
): void {
  const themeBinding = resolveArtistDashboardThemeBinding();
  mainRegion.classList.add('mdj-client-dashboard');
  mainRegion.replaceChildren();

  const hero = mountComponentDescriptor(
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

  const kpiGrid = mountComponentDescriptor(
    createDashboardCard({ variant: 'kpi-grid', region: 'kpis' }, themeBinding),
  );
  kpiGrid.replaceChildren(
    ...ARTIST_DASHBOARD_KPIS.map((kpi) =>
      mountComponentDescriptor(createKpiCard(kpi, themeBinding)),
    ),
  );

  const contentGrid = document.createElement('div');
  contentGrid.className = 'mdj-client-dashboard__grid';
  const sections: HTMLElement[] = [];
  if (sessionWiring) {
    sections.push(createSessionWiringSection(sessionWiring));
  }
  sections.push(
    createProfileSection(themeBinding),
    createUpcomingGigsSection(themeBinding),
    createArtistScheduleSection(),
    createArtistWalletSection(),
    createArtistWeatherSection(),
    createArtistMutationsSection(),
    createSong4TipsSection(themeBinding),
    createJobsSection(themeBinding),
    createMediaSection(themeBinding),
    createAnalyticsSection(themeBinding),
    createNotificationsSection(themeBinding),
    createActivitySection(themeBinding),
  );
  contentGrid.append(...sections);

  mainRegion.append(hero, kpiGrid, contentGrid);
  mountArtistProfileReadSliceSync(mainRegion, undefined, sessionWiring);
  mountArtistScheduleReadSliceSync(mainRegion, undefined, sessionWiring);
  mountArtistFinanceReadSliceSync(mainRegion, undefined, sessionWiring);
  mountArtistWeatherReadSliceSync(mainRegion, undefined, sessionWiring);
  if (mutationsAdapter && sessionWiring?.assignedDjUserId) {
    mountArtistMutationsSliceSync(
      mainRegion,
      mutationsAdapter,
      sessionWiring.context,
      sessionWiring.assignedDjUserId,
      sessionWiring,
    );
  }
}
