/**
 * MOD-103 Slice 2 — Client Bookings / Event Flow Read ViewModel (pure).
 * READ-ONLY projection from fetchOwnBookings. No cancel/pay/edit writers.
 */

import type {
  BookingLifecycleStatus,
  BookingSnapshotDTO,
  EventDetailReadDTO,
} from '../../shared/types/bookings.types';
import { redactEventDetailForAudience } from '../../shared/services/bookings/index';

export const CLIENT_BOOKINGS_LIFECYCLE_FILTERS = Object.freeze([
  'All',
  'Draft',
  'Confirmed',
  'InProgress',
  'Completed',
  'Cancelled',
] as const);

export type ClientBookingsLifecycleFilter = (typeof CLIENT_BOOKINGS_LIFECYCLE_FILTERS)[number];

export type ClientBookingCardVM = {
  readonly bookingId: string;
  readonly title: string;
  readonly eventType: string;
  readonly eventDate: string;
  readonly timeRange: string;
  readonly venueLabel: string;
  readonly lifecycleStatus: BookingLifecycleStatus;
  readonly lifecycleLabel: string;
  readonly assignmentLabel: string;
  readonly servicesSummary: string;
  readonly timelineLabel: string;
  readonly paymentStatus: string;
};

export type ClientBookingsReadViewModel = {
  readonly filter: ClientBookingsLifecycleFilter;
  readonly totalCount: number;
  readonly cards: readonly ClientBookingCardVM[];
};

function display(value: string | null | undefined, fallback = '—'): string {
  const t = typeof value === 'string' ? value.trim() : '';
  return t.length > 0 ? t : fallback;
}

export function lifecycleDisplayLabel(status: BookingLifecycleStatus): string {
  if (status === 'Draft') return 'Draft / Requested';
  return status;
}

export function filterClientBookingsByLifecycle(
  bookings: readonly BookingSnapshotDTO[],
  filter: ClientBookingsLifecycleFilter,
): readonly BookingSnapshotDTO[] {
  if (filter === 'All') return bookings;
  return Object.freeze(bookings.filter((b) => b.lifecycleStatus === filter));
}

function timelineFor(status: BookingLifecycleStatus): string {
  switch (status) {
    case 'Draft':
      return 'Requested → awaiting confirmation';
    case 'Confirmed':
      return 'Confirmed → event scheduled';
    case 'InProgress':
      return 'In progress → matching / prep';
    case 'Completed':
      return 'Completed → event closed';
    case 'Cancelled':
      return 'Cancelled';
    default:
      return '—';
  }
}

export function toClientBookingCard(
  booking: BookingSnapshotDTO,
  detail: EventDetailReadDTO | null,
): ClientBookingCardVM {
  const own = detail ? redactEventDetailForAudience(detail, 'client_own') : null;
  const assigned =
    booking.assignedArtistProfileId || booking.assignedArtistUserId
      ? `Artist assigned · ${display(booking.assignedArtistProfileId ?? booking.assignedArtistUserId)}`
      : booking.assignedStaffUserId
        ? `Staff assigned · ${display(booking.assignedStaffUserId)}`
        : 'Assignment pending';

  const services =
    own?.budgetLabel != null
      ? `Contracted package · budget ${own.budgetLabel}`
      : 'Services summary on file with Miami DJ Beat.';

  return Object.freeze({
    bookingId: booking.bookingId,
    title: display(booking.title, 'My event'),
    eventType: display(booking.title, 'Event'),
    eventDate: display(booking.eventDate),
    timeRange: `${display(booking.startTime)} – ${display(booking.endTime)}`,
    venueLabel: display(booking.locationLabel, 'Venue TBD'),
    lifecycleStatus: booking.lifecycleStatus,
    lifecycleLabel: lifecycleDisplayLabel(booking.lifecycleStatus),
    assignmentLabel: assigned,
    servicesSummary: services,
    timelineLabel: timelineFor(booking.lifecycleStatus),
    paymentStatus: display(booking.paymentStatus),
  });
}

export function toClientBookingsReadViewModel(input: {
  readonly bookings: readonly BookingSnapshotDTO[];
  readonly detailsById?: Readonly<Record<string, EventDetailReadDTO>>;
  readonly filter?: ClientBookingsLifecycleFilter;
}): ClientBookingsReadViewModel {
  const filter = input.filter ?? 'All';
  const filtered = filterClientBookingsByLifecycle(input.bookings, filter);
  const cards = filtered.map((b) =>
    toClientBookingCard(b, input.detailsById?.[b.bookingId] ?? null),
  );

  return Object.freeze({
    filter,
    totalCount: input.bookings.length,
    cards: Object.freeze(cards),
  });
}
