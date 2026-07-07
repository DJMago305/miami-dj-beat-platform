/** MOD-011 Artist Dashboard MVP — render — TICKET-MOD-011-ARTIST-DASHBOARD-MVP-001 */

import {
  createComponentThemeBinding,
  createDashboardCard,
  createEmptyState,
  createHeroBanner,
  createKpiCard,
  createModuleCard,
  createPanel,
  createProfileCard,
  createSectionHeader,
  type MdjThemeBinding,
} from '../shared/components/index';
import { getThemeDefinition } from '../shared/theme/runtime/theme-registry';
import {
  ARTIST_ACTIVITY,
  ARTIST_ANALYTICS,
  ARTIST_CALENDAR_EVENTS,
  ARTIST_CASH_FLOW,
  ARTIST_DASHBOARD_KPIS,
  ARTIST_JOBS,
  ARTIST_MEDIA,
  ARTIST_NOTIFICATIONS,
  ARTIST_PROFILE,
  ARTIST_SONG4TIPS,
  ARTIST_UPCOMING_GIGS,
} from './dashboard-mvp-data';
import { mountComponentDescriptor } from './mount-component-descriptor';

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

function createProfileSection(themeBinding: MdjThemeBinding): HTMLElement {
  const section = createArtistSection('artist-profile');

  section.append(
    mountComponentDescriptor(
      createSectionHeader({ title: 'Artist Profile', variant: 'module-grid' }, themeBinding),
    ),
    mountComponentDescriptor(
      createProfileCard(
        {
          name: ARTIST_PROFILE.stageName,
          role: ARTIST_PROFILE.level,
          meta: `${ARTIST_PROFILE.status} · ${ARTIST_PROFILE.specialty}`,
        },
        themeBinding,
      ),
    ),
  );

  const details = document.createElement('dl');
  details.className = 'mdj-client-summary-list';
  details.append(
    createSummaryRow('Status', ARTIST_PROFILE.status),
    createSummaryRow('Specialty', ARTIST_PROFILE.specialty),
  );
  section.append(details);

  return section;
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

function createCalendarSection(themeBinding: MdjThemeBinding): HTMLElement {
  const section = createArtistSection('calendar');

  const panel = mountComponentDescriptor(
    createPanel({ title: 'Calendar', variant: 'elevated' }, themeBinding),
  );
  panel.append(createList(ARTIST_CALENDAR_EVENTS.map((event) => `${event.date} — ${event.label}`)));
  section.append(panel);
  return section;
}

function createCashFlowSection(themeBinding: MdjThemeBinding): HTMLElement {
  const section = createArtistSection('cash-flow');

  const panel = mountComponentDescriptor(
    createPanel({ title: 'Cash Flow', variant: 'glass' }, themeBinding),
  );
  panel.append(createSummaryList(ARTIST_CASH_FLOW));
  section.append(panel);
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

export function renderArtistDashboardMvp(mainRegion: HTMLElement): void {
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
  contentGrid.append(
    createProfileSection(themeBinding),
    createUpcomingGigsSection(themeBinding),
    createCalendarSection(themeBinding),
    createCashFlowSection(themeBinding),
    createSong4TipsSection(themeBinding),
    createJobsSection(themeBinding),
    createMediaSection(themeBinding),
    createAnalyticsSection(themeBinding),
    createNotificationsSection(themeBinding),
    createActivitySection(themeBinding),
  );

  mainRegion.append(hero, kpiGrid, contentGrid);
}
