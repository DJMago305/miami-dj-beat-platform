/**
 * MOD-103 Slice 2 — lab fixtures for Client Bookings.
 */

import {
  MOCK_ALL_LEAD_ROWS,
  MOCK_ARTIST_USER_ID,
  MOCK_CLIENT_USER_ID,
  mapLeadRowToBookingSnapshot,
  mapLeadRowToEventDetail,
} from '../../shared/services/bookings/index';
import type { BookingSnapshotDTO, EventDetailReadDTO } from '../../shared/types/bookings.types';

export type ClientBookingsLabBundle = {
  readonly clientUserId: string;
  readonly bookings: readonly BookingSnapshotDTO[];
  readonly detailsById: Readonly<Record<string, EventDetailReadDTO>>;
};

function buildBundle(): ClientBookingsLabBundle {
  const ownRows = MOCK_ALL_LEAD_ROWS.filter((row) => row.client_user_id === MOCK_CLIENT_USER_ID);
  const bookings = ownRows.map((row) =>
    mapLeadRowToBookingSnapshot(row, { assignedArtistUserId: MOCK_ARTIST_USER_ID }),
  );
  const detailsById: Record<string, EventDetailReadDTO> = {};
  for (const row of ownRows) {
    detailsById[String(row.id)] = mapLeadRowToEventDetail(row, {
      assignedArtistUserId: MOCK_ARTIST_USER_ID,
    });
  }
  return Object.freeze({
    clientUserId: MOCK_CLIENT_USER_ID,
    bookings: Object.freeze(bookings),
    detailsById: Object.freeze(detailsById),
  });
}

export const LAB_CLIENT_BOOKINGS: ClientBookingsLabBundle = buildBundle();
