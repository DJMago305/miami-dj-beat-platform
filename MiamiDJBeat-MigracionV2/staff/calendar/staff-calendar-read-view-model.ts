/**
 * MOD-301 Slice 2 — Staff Master Calendar Read ViewModel (pure).
 * READ-ONLY projection from fetchMasterSchedule / BookingSnapshotDTO. No writers.
 */

import type {
  BookingLifecycleStatus,
  BookingSnapshotDTO,
  BookingVisibilityAudience,
  CalendarSlotDTO,
  EventDetailReadDTO,
} from '../../shared/types/bookings.types';
import { redactEventDetailForAudience } from '../../shared/services/bookings/index';

export const STAFF_CALENDAR_LIFECYCLE_FILTERS = Object.freeze([
  'All',
  'Draft',
  'Confirmed',
  'InProgress',
  'Completed',
  'Cancelled',
] as const);

export type StaffCalendarLifecycleFilter = (typeof STAFF_CALENDAR_LIFECYCLE_FILTERS)[number];

export type StaffCalendarEventCardVM = {
  readonly bookingId: string;
  readonly title: string;
  readonly eventDate: string;
  readonly timeRange: string;
  readonly locationLabel: string;
  readonly lifecycleStatus: BookingLifecycleStatus;
  readonly paymentStatus: string;
  readonly assignmentLabel: string;
  readonly clientLabel: string;
  readonly contactEmail: string | null;
  readonly contactPhone: string | null;
  readonly notes: string | null;
  readonly piiIsolated: boolean;
};

export type StaffCalendarSummaryVM = {
  readonly totalBookings: number;
  readonly byStatus: Readonly<Record<BookingLifecycleStatus, number>>;
  readonly assignedCount: number;
  readonly unassignedCount: number;
  readonly slotCount: number;
};

export type StaffCalendarReadViewModel = {
  readonly audience: BookingVisibilityAudience;
  readonly filter: StaffCalendarLifecycleFilter;
  readonly summary: StaffCalendarSummaryVM;
  readonly cards: readonly StaffCalendarEventCardVM[];
  readonly slotsPreview: readonly { readonly slotId: string; readonly label: string; readonly kind: string }[];
};

function display(value: string | null | undefined, fallback = '—'): string {
  const t = typeof value === 'string' ? value.trim() : '';
  return t.length > 0 ? t : fallback;
}

function emptyStatusCounts(): Record<BookingLifecycleStatus, number> {
  return {
    Draft: 0,
    Confirmed: 0,
    InProgress: 0,
    Completed: 0,
    Cancelled: 0,
  };
}

export function filterBookingsByLifecycle(
  bookings: readonly BookingSnapshotDTO[],
  filter: StaffCalendarLifecycleFilter,
): readonly BookingSnapshotDTO[] {
  if (filter === 'All') return bookings;
  return Object.freeze(bookings.filter((b) => b.lifecycleStatus === filter));
}

export function toStaffCalendarEventCard(
  booking: BookingSnapshotDTO,
  detail: EventDetailReadDTO | null,
  audience: BookingVisibilityAudience,
): StaffCalendarEventCardVM {
  const redacted = detail
    ? redactEventDetailForAudience(detail, audience)
    : null;
  const assigned =
    booking.assignedArtistProfileId || booking.assignedArtistUserId
      ? `Artist · ${display(booking.assignedArtistProfileId ?? booking.assignedArtistUserId)}`
      : 'Unassigned';
  const piiIsolated = audience !== 'staff_full' && audience !== 'client_own';

  return Object.freeze({
    bookingId: booking.bookingId,
    title: display(booking.title, 'Untitled event'),
    eventDate: display(booking.eventDate),
    timeRange: `${display(booking.startTime)} – ${display(booking.endTime)}`,
    locationLabel: display(booking.locationLabel),
    lifecycleStatus: booking.lifecycleStatus,
    paymentStatus: display(booking.paymentStatus),
    assignmentLabel: assigned,
    clientLabel: display(redacted?.clientDisplayName ?? null, piiIsolated ? 'Client (hidden)' : '—'),
    contactEmail: redacted?.clientEmail ?? null,
    contactPhone: redacted?.clientPhone ?? null,
    notes: redacted?.notes ?? null,
    piiIsolated,
  });
}

/**
 * Pure mapper — master schedule payload → display model (optional lifecycle filter).
 */
export function toStaffCalendarReadViewModel(input: {
  readonly bookings: readonly BookingSnapshotDTO[];
  readonly slots: readonly CalendarSlotDTO[];
  readonly detailsById?: Readonly<Record<string, EventDetailReadDTO>>;
  readonly audience?: BookingVisibilityAudience;
  readonly filter?: StaffCalendarLifecycleFilter;
}): StaffCalendarReadViewModel {
  const audience = input.audience ?? 'staff_full';
  const filter = input.filter ?? 'All';
  const filtered = filterBookingsByLifecycle(input.bookings, filter);
  const byStatus = emptyStatusCounts();
  let assignedCount = 0;
  let unassignedCount = 0;

  for (const b of input.bookings) {
    byStatus[b.lifecycleStatus] += 1;
    if (b.assignedArtistProfileId || b.assignedArtistUserId) assignedCount += 1;
    else unassignedCount += 1;
  }

  const cards = filtered.map((b) =>
    toStaffCalendarEventCard(b, input.detailsById?.[b.bookingId] ?? null, audience),
  );

  const slotsPreview = input.slots.slice(0, 12).map((s) =>
    Object.freeze({
      slotId: s.slotId,
      label: display(s.label, s.slotKind),
      kind: s.slotKind,
    }),
  );

  return Object.freeze({
    audience,
    filter,
    summary: Object.freeze({
      totalBookings: input.bookings.length,
      byStatus: Object.freeze(byStatus),
      assignedCount,
      unassignedCount,
      slotCount: input.slots.length,
    }),
    cards: Object.freeze(cards),
    slotsPreview: Object.freeze(slotsPreview),
  });
}
