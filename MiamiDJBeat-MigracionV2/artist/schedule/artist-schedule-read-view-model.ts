/**
 * MOD-204 Slice 2 — Artist Schedule / Gigs Read ViewModel (pure).
 * READ-ONLY projection from fetchArtistSchedule. Client PII redacted (artist_assigned).
 */

import type {
  BookingLifecycleStatus,
  BookingSnapshotDTO,
  CalendarSlotDTO,
  EventDetailReadDTO,
} from '../../shared/types/bookings.types';
import { redactEventDetailForAudience } from '../../shared/services/bookings/index';

/** Presentation filters requested for artist schedule Slice 2. */
export const ARTIST_SCHEDULE_LIFECYCLE_FILTERS = Object.freeze([
  'All',
  'Confirmed',
  'InProgress',
  'Completed',
] as const);

export type ArtistScheduleLifecycleFilter = (typeof ARTIST_SCHEDULE_LIFECYCLE_FILTERS)[number];

export type ArtistGigCardVM = {
  readonly bookingId: string;
  readonly title: string;
  readonly showType: string;
  readonly eventDate: string;
  readonly timeRange: string;
  readonly venueLabel: string;
  readonly lifecycleStatus: BookingLifecycleStatus;
  readonly clientLabel: string;
  readonly technicalRequirements: string;
  readonly notesSafe: string | null;
  readonly contactIsolated: true;
};

export type ArtistScheduleReadViewModel = {
  readonly filter: ArtistScheduleLifecycleFilter;
  readonly upcomingCount: number;
  readonly cards: readonly ArtistGigCardVM[];
  readonly scheduleSlots: readonly {
    readonly slotId: string;
    readonly kind: string;
    readonly label: string;
    readonly date: string;
  }[];
};

function display(value: string | null | undefined, fallback = '—'): string {
  const t = typeof value === 'string' ? value.trim() : '';
  return t.length > 0 ? t : fallback;
}

const PRESENTATION_STATUSES: readonly BookingLifecycleStatus[] = [
  'Confirmed',
  'InProgress',
  'Completed',
];

export function filterArtistGigsByLifecycle(
  bookings: readonly BookingSnapshotDTO[],
  filter: ArtistScheduleLifecycleFilter,
): readonly BookingSnapshotDTO[] {
  const presentation = bookings.filter((b) =>
    PRESENTATION_STATUSES.includes(b.lifecycleStatus),
  );
  if (filter === 'All') return Object.freeze(presentation);
  return Object.freeze(presentation.filter((b) => b.lifecycleStatus === filter));
}

export function toArtistGigCard(
  booking: BookingSnapshotDTO,
  detail: EventDetailReadDTO | null,
): ArtistGigCardVM {
  const redacted = detail
    ? redactEventDetailForAudience(detail, 'artist_assigned')
    : null;
  const tech =
    display(redacted?.notes, '') !== ''
      ? `Ops notes (safe): ${display(redacted?.notes)}`
      : 'No technical requirements on file.';

  return Object.freeze({
    bookingId: booking.bookingId,
    title: display(booking.title, 'Assigned gig'),
    showType: display(booking.title, 'Event'),
    eventDate: display(booking.eventDate),
    timeRange: `${display(booking.startTime)} – ${display(booking.endTime)}`,
    venueLabel: display(booking.locationLabel, 'Venue TBD'),
    lifecycleStatus: booking.lifecycleStatus,
    clientLabel: display(redacted?.clientDisplayName, 'Client'),
    technicalRequirements: tech,
    notesSafe: redacted?.notes ?? null,
    contactIsolated: true as const,
  });
}

export function toArtistScheduleReadViewModel(input: {
  readonly bookings: readonly BookingSnapshotDTO[];
  readonly slots: readonly CalendarSlotDTO[];
  readonly detailsById?: Readonly<Record<string, EventDetailReadDTO>>;
  readonly filter?: ArtistScheduleLifecycleFilter;
}): ArtistScheduleReadViewModel {
  const filter = input.filter ?? 'All';
  const filtered = filterArtistGigsByLifecycle(input.bookings, filter);
  const cards = filtered.map((b) =>
    toArtistGigCard(b, input.detailsById?.[b.bookingId] ?? null),
  );

  const scheduleSlots = input.slots
    .filter((s) => s.slotKind !== 'booking')
    .slice(0, 12)
    .map((s) =>
      Object.freeze({
        slotId: s.slotId,
        kind: s.slotKind,
        label: display(s.label, s.slotKind),
        date: display(s.date),
      }),
    );

  return Object.freeze({
    filter,
    upcomingCount: filterArtistGigsByLifecycle(input.bookings, 'All').length,
    cards: Object.freeze(cards),
    scheduleSlots: Object.freeze(scheduleSlots),
  });
}
