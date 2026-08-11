/**
 * MOD-103 Slice 2 — Client Bookings Read View (DOM).
 * READ-ONLY — filter chips only; no cancel/pay/edit forms.
 */

import type { BookingSnapshotDTO, EventDetailReadDTO } from '../../shared/types/bookings.types';
import {
  CLIENT_BOOKINGS_LIFECYCLE_FILTERS,
  toClientBookingsReadViewModel,
  type ClientBookingsLifecycleFilter,
  type ClientBookingsReadViewModel,
} from './client-bookings-read-view-model';

export type ClientBookingsReadViewData = {
  readonly bookings: readonly BookingSnapshotDTO[];
  readonly detailsById?: Readonly<Record<string, EventDetailReadDTO>>;
};

export type RenderClientBookingsReadViewOptions = {
  readonly sourceLabel?: string;
  readonly initialFilter?: ClientBookingsLifecycleFilter;
};

function filterButtonLabel(status: ClientBookingsLifecycleFilter): string {
  return status === 'Draft' ? 'Draft / Requested' : status;
}

function renderFilters(
  active: ClientBookingsLifecycleFilter,
  onFilter: (next: ClientBookingsLifecycleFilter) => void,
): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'mdj-client-bookings-read__filters';
  bar.dataset.mdjClientBookingsSection = 'filters';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Filter bookings by status');

  for (const status of CLIENT_BOOKINGS_LIFECYCLE_FILTERS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `mdj-client-bookings-read__filter${status === active ? ' is-active' : ''}`;
    btn.dataset.mdjBookingsFilter = status;
    btn.textContent = filterButtonLabel(status);
    btn.setAttribute('aria-pressed', status === active ? 'true' : 'false');
    btn.addEventListener('click', () => onFilter(status));
    bar.append(btn);
  }
  return bar;
}

function renderCard(card: ClientBookingsReadViewModel['cards'][number]): HTMLElement {
  const article = document.createElement('article');
  article.className = 'mdj-client-bookings-read__card';
  article.dataset.mdjBookingId = card.bookingId;
  article.dataset.mdjLifecycle = card.lifecycleStatus;

  const title = document.createElement('h3');
  title.className = 'mdj-client-bookings-read__card-title';
  title.textContent = card.title;

  const badge = document.createElement('span');
  badge.className = `mdj-client-bookings-read__badge mdj-client-bookings-read__badge--${card.lifecycleStatus}`;
  badge.textContent = card.lifecycleLabel;

  const meta = document.createElement('dl');
  meta.className = 'mdj-client-bookings-read__meta';
  const rows: readonly [string, string][] = [
    ['Date', card.eventDate],
    ['Time', card.timeRange],
    ['Venue', card.venueLabel],
    ['Type', card.eventType],
    ['Timeline', card.timelineLabel],
    ['Assignment', card.assignmentLabel],
    ['Services', card.servicesSummary],
    ['Payment', card.paymentStatus],
  ];
  for (const [label, value] of rows) {
    const row = document.createElement('div');
    row.className = 'mdj-client-bookings-read__row';
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    row.append(dt, dd);
    meta.append(row);
  }

  const note = document.createElement('p');
  note.className = 'mdj-client-bookings-read__note';
  note.textContent = 'Read-only event flow — cancel / pay / change requests not available in this slice.';

  article.append(title, badge, meta, note);
  return article;
}

function renderCards(vm: ClientBookingsReadViewModel): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-client-bookings-read__cards';
  section.dataset.mdjClientBookingsSection = 'cards';

  if (vm.cards.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'mdj-client-bookings-read__empty';
    empty.textContent = 'No bookings for this filter.';
    section.append(empty);
    return section;
  }

  for (const card of vm.cards) section.append(renderCard(card));
  return section;
}

export function renderClientBookingsReadView(
  container: HTMLElement,
  data: ClientBookingsReadViewData,
  options?: RenderClientBookingsReadViewOptions,
): ClientBookingsReadViewModel {
  const sourceLabel = options?.sourceLabel ?? 'fetchOwnBookings';
  let filter: ClientBookingsLifecycleFilter = options?.initialFilter ?? 'All';

  const root = document.createElement('article');
  root.className = 'mdj-client-bookings-read';
  root.dataset.mdjComponent = 'ClientBookingsReadView';
  root.dataset.mdjMod = 'MOD-103-S2';
  root.setAttribute('aria-label', 'Client bookings read view');

  const paint = (): ClientBookingsReadViewModel => {
    const vm = toClientBookingsReadViewModel({
      bookings: data.bookings,
      detailsById: data.detailsById,
      filter,
    });

    const eyebrow = document.createElement('p');
    eyebrow.className = 'mdj-client-bookings-read__eyebrow';
    eyebrow.textContent = `MOD-103 Slice 2 · My bookings · ${sourceLabel}`;

    const heading = document.createElement('h2');
    heading.className = 'mdj-client-bookings-read__title';
    heading.textContent = 'My Reservations & Event Flow';

    const summary = document.createElement('p');
    summary.className = 'mdj-client-bookings-read__summary';
    summary.dataset.mdjClientBookingsSection = 'summary';
    summary.textContent = `${vm.totalCount} booking(s) · showing ${vm.cards.length} · filter ${filterButtonLabel(vm.filter)}`;

    root.replaceChildren(
      eyebrow,
      heading,
      summary,
      renderFilters(filter, (next) => {
        filter = next;
        paint();
      }),
      renderCards(vm),
    );

    for (const el of root.querySelectorAll('form, button[type="submit"], input, textarea, select')) {
      el.remove();
    }

    return vm;
  };

  container.replaceChildren(root);
  return paint();
}
