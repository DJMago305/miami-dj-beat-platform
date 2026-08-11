/**
 * MOD-301 Slice 2 — Staff Master Calendar Read View (DOM).
 * Strictly READ-ONLY — filter chips only re-render; no create/reassign/save/cancel.
 */

import type {
  BookingSnapshotDTO,
  BookingVisibilityAudience,
  CalendarSlotDTO,
  EventDetailReadDTO,
} from '../../shared/types/bookings.types';
import {
  STAFF_CALENDAR_LIFECYCLE_FILTERS,
  toStaffCalendarReadViewModel,
  type StaffCalendarLifecycleFilter,
  type StaffCalendarReadViewModel,
} from './staff-calendar-read-view-model';

export type StaffCalendarReadViewData = {
  readonly bookings: readonly BookingSnapshotDTO[];
  readonly slots: readonly CalendarSlotDTO[];
  readonly detailsById?: Readonly<Record<string, EventDetailReadDTO>>;
  readonly audience?: BookingVisibilityAudience;
};

export type RenderStaffCalendarReadViewOptions = {
  readonly sourceLabel?: string;
  readonly initialFilter?: StaffCalendarLifecycleFilter;
};

function createSummaryChip(label: string, value: string): HTMLElement {
  const chip = document.createElement('div');
  chip.className = 'mdj-staff-calendar-read__summary-chip';
  const k = document.createElement('span');
  k.className = 'mdj-staff-calendar-read__summary-label';
  k.textContent = label;
  const v = document.createElement('strong');
  v.className = 'mdj-staff-calendar-read__summary-value';
  v.textContent = value;
  chip.append(k, v);
  return chip;
}

function renderSummary(vm: StaffCalendarReadViewModel): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-staff-calendar-read__summary';
  section.dataset.mdjStaffCalendarSection = 'summary';
  section.append(
    createSummaryChip('Total', String(vm.summary.totalBookings)),
    createSummaryChip('Assigned', String(vm.summary.assignedCount)),
    createSummaryChip('Unassigned', String(vm.summary.unassignedCount)),
    createSummaryChip('Slots', String(vm.summary.slotCount)),
    createSummaryChip('Draft', String(vm.summary.byStatus.Draft)),
    createSummaryChip('Confirmed', String(vm.summary.byStatus.Confirmed)),
    createSummaryChip('InProgress', String(vm.summary.byStatus.InProgress)),
    createSummaryChip('Completed', String(vm.summary.byStatus.Completed)),
    createSummaryChip('Cancelled', String(vm.summary.byStatus.Cancelled)),
  );
  return section;
}

function renderFilters(
  active: StaffCalendarLifecycleFilter,
  onFilter: (next: StaffCalendarLifecycleFilter) => void,
): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'mdj-staff-calendar-read__filters';
  bar.dataset.mdjStaffCalendarSection = 'filters';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Filter by reservation status');

  for (const status of STAFF_CALENDAR_LIFECYCLE_FILTERS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `mdj-staff-calendar-read__filter${status === active ? ' is-active' : ''}`;
    btn.dataset.mdjCalendarFilter = status;
    btn.textContent = status;
    btn.setAttribute('aria-pressed', status === active ? 'true' : 'false');
    btn.addEventListener('click', () => onFilter(status));
    bar.append(btn);
  }
  return bar;
}

function renderCard(card: StaffCalendarReadViewModel['cards'][number]): HTMLElement {
  const article = document.createElement('article');
  article.className = 'mdj-staff-calendar-read__card';
  article.dataset.mdjBookingId = card.bookingId;
  article.dataset.mdjLifecycle = card.lifecycleStatus;

  const title = document.createElement('h3');
  title.className = 'mdj-staff-calendar-read__card-title';
  title.textContent = card.title;

  const badge = document.createElement('span');
  badge.className = `mdj-staff-calendar-read__badge mdj-staff-calendar-read__badge--${card.lifecycleStatus}`;
  badge.textContent = card.lifecycleStatus;

  const meta = document.createElement('dl');
  meta.className = 'mdj-staff-calendar-read__card-meta';

  const rows: readonly [string, string][] = [
    ['Date', card.eventDate],
    ['Time', card.timeRange],
    ['Location', card.locationLabel],
    ['Assignment', card.assignmentLabel],
    ['Client', card.clientLabel],
    ['Payment', card.paymentStatus],
  ];

  for (const [label, value] of rows) {
    const row = document.createElement('div');
    row.className = 'mdj-staff-calendar-read__row';
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    row.append(dt, dd);
    meta.append(row);
  }

  if (!card.piiIsolated && (card.contactEmail || card.contactPhone)) {
    const contact = document.createElement('p');
    contact.className = 'mdj-staff-calendar-read__contact';
    contact.textContent = [card.contactEmail, card.contactPhone].filter(Boolean).join(' · ');
    article.append(title, badge, meta, contact);
  } else {
    const note = document.createElement('p');
    note.className = 'mdj-staff-calendar-read__pii-note';
    note.textContent = card.piiIsolated
      ? 'Contact / billing PII isolated for this staff audience.'
      : 'No contact on file.';
    article.append(title, badge, meta, note);
  }

  return article;
}

function renderCards(vm: StaffCalendarReadViewModel): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-staff-calendar-read__cards';
  section.dataset.mdjStaffCalendarSection = 'cards';

  if (vm.cards.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'mdj-staff-calendar-read__empty';
    empty.textContent = 'No reservations for this filter.';
    section.append(empty);
    return section;
  }

  for (const card of vm.cards) section.append(renderCard(card));
  return section;
}

function renderSlotsPreview(vm: StaffCalendarReadViewModel): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-staff-calendar-read__slots';
  section.dataset.mdjStaffCalendarSection = 'slots';

  const heading = document.createElement('h3');
  heading.className = 'mdj-staff-calendar-read__section-title';
  heading.textContent = 'Slots preview';
  section.append(heading);

  if (vm.slotsPreview.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'mdj-staff-calendar-read__empty';
    empty.textContent = 'No calendar slots in master payload.';
    section.append(empty);
    return section;
  }

  const list = document.createElement('ul');
  list.className = 'mdj-staff-calendar-read__slot-list';
  for (const slot of vm.slotsPreview) {
    const li = document.createElement('li');
    li.dataset.mdjSlotKind = slot.kind;
    li.textContent = `${slot.kind}: ${slot.label}`;
    list.append(li);
  }
  section.append(list);
  return section;
}

/**
 * Renders master calendar read view. Filter chips only change local display.
 */
export function renderStaffCalendarReadView(
  container: HTMLElement,
  data: StaffCalendarReadViewData,
  options?: RenderStaffCalendarReadViewOptions,
): StaffCalendarReadViewModel {
  const sourceLabel = options?.sourceLabel ?? 'fetchMasterSchedule';
  let filter: StaffCalendarLifecycleFilter = options?.initialFilter ?? 'All';

  const root = document.createElement('article');
  root.className = 'mdj-staff-calendar-read';
  root.dataset.mdjComponent = 'StaffCalendarReadView';
  root.dataset.mdjMod = 'MOD-301-S2';
  root.setAttribute('aria-label', 'Staff master calendar read view');

  const paint = (): StaffCalendarReadViewModel => {
    const vm = toStaffCalendarReadViewModel({
      bookings: data.bookings,
      slots: data.slots,
      detailsById: data.detailsById,
      audience: data.audience ?? 'staff_full',
      filter,
    });

    const eyebrow = document.createElement('p');
    eyebrow.className = 'mdj-staff-calendar-read__eyebrow';
    eyebrow.textContent = `MOD-301 Slice 2 · Master calendar · ${sourceLabel} · audience ${vm.audience}`;

    const heading = document.createElement('h2');
    heading.className = 'mdj-staff-calendar-read__title';
    heading.textContent = 'Master Schedule';

    root.replaceChildren(
      eyebrow,
      heading,
      renderSummary(vm),
      renderFilters(filter, (next) => {
        filter = next;
        paint();
      }),
      renderCards(vm),
      renderSlotsPreview(vm),
    );

    // Hard guard: no forms / submit / text inputs (filter buttons allowed).
    for (const el of root.querySelectorAll('form, button[type="submit"], input, textarea, select')) {
      el.remove();
    }

    return vm;
  };

  container.replaceChildren(root);
  return paint();
}
