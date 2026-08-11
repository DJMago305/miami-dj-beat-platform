/**
 * MOD-301 Slice 2 — lab fixtures for Staff Master Calendar (portal-local).
 */

import {
  MOCK_ALL_LEAD_ROWS,
  MOCK_ARTIST_USER_ID,
  mapBookingSnapshotToCalendarSlot,
  mapLeadRowToBookingSnapshot,
  mapLeadRowToEventDetail,
} from '../../shared/services/bookings/index';
import type {
  BookingSnapshotDTO,
  CalendarSlotDTO,
  EventDetailReadDTO,
} from '../../shared/types/bookings.types';

export type StaffCalendarLabBundle = {
  readonly bookings: readonly BookingSnapshotDTO[];
  readonly slots: readonly CalendarSlotDTO[];
  readonly detailsById: Readonly<Record<string, EventDetailReadDTO>>;
};

function buildBundle(): StaffCalendarLabBundle {
  const bookings = MOCK_ALL_LEAD_ROWS.map((row) =>
    mapLeadRowToBookingSnapshot(row, { assignedArtistUserId: MOCK_ARTIST_USER_ID }),
  );
  const slots = bookings.map((b) => mapBookingSnapshotToCalendarSlot(b, 'staff_full'));
  const detailsById: Record<string, EventDetailReadDTO> = {};
  for (const row of MOCK_ALL_LEAD_ROWS) {
    const id = String(row.id);
    detailsById[id] = mapLeadRowToEventDetail(row, {
      assignedArtistUserId: MOCK_ARTIST_USER_ID,
    });
  }
  return Object.freeze({
    bookings: Object.freeze(bookings),
    slots: Object.freeze(slots),
    detailsById: Object.freeze(detailsById),
  });
}

export const LAB_STAFF_MASTER_SCHEDULE: StaffCalendarLabBundle = buildBundle();
