/**
 * MOD-204 Slice 2 — lab fixtures for Artist Schedule.
 */

import {
  MOCK_ALL_LEAD_ROWS,
  MOCK_ARTIST_SCHEDULE_SLOTS,
  MOCK_ARTIST_USER_ID,
  MOCK_DJ_PROFILE_ID,
  mapLeadRowToBookingSnapshot,
  mapLeadRowToEventDetail,
} from '../../shared/services/bookings/index';
import type {
  BookingSnapshotDTO,
  CalendarSlotDTO,
  EventDetailReadDTO,
} from '../../shared/types/bookings.types';

export type ArtistScheduleLabBundle = {
  readonly artistUserId: string;
  readonly artistProfileId: string;
  readonly bookings: readonly BookingSnapshotDTO[];
  readonly slots: readonly CalendarSlotDTO[];
  readonly detailsById: Readonly<Record<string, EventDetailReadDTO>>;
};

function buildBundle(): ArtistScheduleLabBundle {
  const bookings = MOCK_ALL_LEAD_ROWS.filter(
    (row) => row.client_user_id !== '00000000-0000-4000-8000-000000000099',
  ).map((row) =>
    mapLeadRowToBookingSnapshot(row, { assignedArtistUserId: MOCK_ARTIST_USER_ID }),
  );

  const detailsById: Record<string, EventDetailReadDTO> = {};
  for (const row of MOCK_ALL_LEAD_ROWS) {
    if (row.client_user_id === '00000000-0000-4000-8000-000000000099') continue;
    detailsById[String(row.id)] = mapLeadRowToEventDetail(row, {
      assignedArtistUserId: MOCK_ARTIST_USER_ID,
    });
  }

  return Object.freeze({
    artistUserId: MOCK_ARTIST_USER_ID,
    artistProfileId: MOCK_DJ_PROFILE_ID,
    bookings: Object.freeze(bookings),
    slots: MOCK_ARTIST_SCHEDULE_SLOTS,
    detailsById: Object.freeze(detailsById),
  });
}

export const LAB_ARTIST_SCHEDULE: ArtistScheduleLabBundle = buildBundle();
