/**
 * MOD-204 Slice 2 — Artist Schedule / Gigs Read View (DOM).
 * READ-ONLY — filter chips only; no accept/reject/edit/save.
 */

import type {
  BookingSnapshotDTO,
  CalendarSlotDTO,
  EventDetailReadDTO,
} from '../../shared/types/bookings.types';
import {
  ARTIST_SCHEDULE_LIFECYCLE_FILTERS,
  toArtistScheduleReadViewModel,
  type ArtistScheduleLifecycleFilter,
  type ArtistScheduleReadViewModel,
} from './artist-schedule-read-view-model';

export type ArtistScheduleReadViewData = {
  readonly bookings: readonly BookingSnapshotDTO[];
  readonly slots: readonly CalendarSlotDTO[];
  readonly detailsById?: Readonly<Record<string, EventDetailReadDTO>>;
};

export type RenderArtistScheduleReadViewOptions = {
  readonly sourceLabel?: string;
  readonly initialFilter?: ArtistScheduleLifecycleFilter;
};

function renderFilters(
  active: ArtistScheduleLifecycleFilter,
  onFilter: (next: ArtistScheduleLifecycleFilter) => void,
): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'mdj-artist-schedule-read__filters';
  bar.dataset.mdjArtistScheduleSection = 'filters';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Filter gigs by presentation status');

  for (const status of ARTIST_SCHEDULE_LIFECYCLE_FILTERS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `mdj-artist-schedule-read__filter${status === active ? ' is-active' : ''}`;
    btn.dataset.mdjScheduleFilter = status;
    btn.textContent = status;
    btn.setAttribute('aria-pressed', status === active ? 'true' : 'false');
    btn.addEventListener('click', () => onFilter(status));
    bar.append(btn);
  }
  return bar;
}

function renderCard(card: ArtistScheduleReadViewModel['cards'][number]): HTMLElement {
  const article = document.createElement('article');
  article.className = 'mdj-artist-schedule-read__card';
  article.dataset.mdjBookingId = card.bookingId;
  article.dataset.mdjLifecycle = card.lifecycleStatus;

  const title = document.createElement('h3');
  title.className = 'mdj-artist-schedule-read__card-title';
  title.textContent = card.title;

  const badge = document.createElement('span');
  badge.className = `mdj-artist-schedule-read__badge mdj-artist-schedule-read__badge--${card.lifecycleStatus}`;
  badge.textContent = card.lifecycleStatus;

  const meta = document.createElement('dl');
  meta.className = 'mdj-artist-schedule-read__meta';
  const rows: readonly [string, string][] = [
    ['Date', card.eventDate],
    ['Time', card.timeRange],
    ['Venue', card.venueLabel],
    ['Show type', card.showType],
    ['Client', card.clientLabel],
    ['Tech / reqs', card.technicalRequirements],
  ];
  for (const [label, value] of rows) {
    const row = document.createElement('div');
    row.className = 'mdj-artist-schedule-read__row';
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    row.append(dt, dd);
    meta.append(row);
  }

  const pii = document.createElement('p');
  pii.className = 'mdj-artist-schedule-read__pii-note';
  pii.textContent = 'Client contact / billing PII filtered (artist_assigned).';

  article.append(title, badge, meta, pii);
  return article;
}

function renderCards(vm: ArtistScheduleReadViewModel): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-artist-schedule-read__cards';
  section.dataset.mdjArtistScheduleSection = 'cards';

  if (vm.cards.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'mdj-artist-schedule-read__empty';
    empty.textContent = 'No assigned gigs for this filter.';
    section.append(empty);
    return section;
  }

  for (const card of vm.cards) section.append(renderCard(card));
  return section;
}

function renderSlots(vm: ArtistScheduleReadViewModel): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-artist-schedule-read__slots';
  section.dataset.mdjArtistScheduleSection = 'slots';

  const heading = document.createElement('h3');
  heading.className = 'mdj-artist-schedule-read__section-title';
  heading.textContent = 'Availability & residency blocks';
  section.append(heading);

  if (vm.scheduleSlots.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'mdj-artist-schedule-read__empty';
    empty.textContent = 'No personal schedule blocks in payload.';
    section.append(empty);
    return section;
  }

  const list = document.createElement('ul');
  list.className = 'mdj-artist-schedule-read__slot-list';
  for (const slot of vm.scheduleSlots) {
    const li = document.createElement('li');
    li.dataset.mdjSlotKind = slot.kind;
    li.textContent = `${slot.kind}: ${slot.label}${slot.date !== '—' ? ` · ${slot.date}` : ''}`;
    list.append(li);
  }
  section.append(list);
  return section;
}

export function renderArtistScheduleReadView(
  container: HTMLElement,
  data: ArtistScheduleReadViewData,
  options?: RenderArtistScheduleReadViewOptions,
): ArtistScheduleReadViewModel {
  const sourceLabel = options?.sourceLabel ?? 'fetchArtistSchedule';
  let filter: ArtistScheduleLifecycleFilter = options?.initialFilter ?? 'All';

  const root = document.createElement('article');
  root.className = 'mdj-artist-schedule-read';
  root.dataset.mdjComponent = 'ArtistScheduleReadView';
  root.dataset.mdjMod = 'MOD-204-S2';
  root.setAttribute('aria-label', 'Artist schedule read view');

  const paint = (): ArtistScheduleReadViewModel => {
    const vm = toArtistScheduleReadViewModel({
      bookings: data.bookings,
      slots: data.slots,
      detailsById: data.detailsById,
      filter,
    });

    const eyebrow = document.createElement('p');
    eyebrow.className = 'mdj-artist-schedule-read__eyebrow';
    eyebrow.textContent = `MOD-204 Slice 2 · My schedule · ${sourceLabel}`;

    const heading = document.createElement('h2');
    heading.className = 'mdj-artist-schedule-read__title';
    heading.textContent = 'Assigned Gigs & Schedule';

    const summary = document.createElement('p');
    summary.className = 'mdj-artist-schedule-read__summary';
    summary.dataset.mdjArtistScheduleSection = 'summary';
    summary.textContent = `${vm.upcomingCount} presentation gig(s) · filter ${vm.filter}`;

    root.replaceChildren(
      eyebrow,
      heading,
      summary,
      renderFilters(filter, (next) => {
        filter = next;
        paint();
      }),
      renderCards(vm),
      renderSlots(vm),
    );

    for (const el of root.querySelectorAll('form, button[type="submit"], input, textarea, select')) {
      el.remove();
    }

    return vm;
  };

  container.replaceChildren(root);
  return paint();
}
