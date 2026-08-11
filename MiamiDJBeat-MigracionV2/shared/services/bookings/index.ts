/** Bookings domain — public barrel (Paso 2 read model + read fetch). */

export {
  asRestRows,
  filterBookingsForArtist,
  filterBookingsForClient,
  mapArtistScheduleJsonToSlots,
  mapBookingSnapshotToCalendarSlot,
  mapLeadRowToBookingSnapshot,
  mapLeadRowToEventDetail,
  mapV1PaymentStatus,
  redactEventDetailForAudience,
} from './bookings.map-rows';
export type { ArtistScheduleJsonInput, MapLeadOptions } from './bookings.map-rows';

export {
  MOCK_ALL_LEAD_ROWS,
  MOCK_ARTIST_SCHEDULE_SLOTS,
  MOCK_ARTIST_USER_ID,
  MOCK_AVAILABILITY_SCHEDULE,
  MOCK_BOOKING_SLOT_CONFIRMED,
  MOCK_BOOKING_SNAPSHOT_CANCELLED,
  MOCK_BOOKING_SNAPSHOT_COMPLETED,
  MOCK_BOOKING_SNAPSHOT_CONFIRMED,
  MOCK_BOOKING_SNAPSHOT_DRAFT,
  MOCK_BOOKING_SNAPSHOT_IN_PROGRESS,
  MOCK_CLIENT_USER_ID,
  MOCK_DJ_PROFILE_ID,
  MOCK_EVENT_DETAIL_CONFIRMED,
  MOCK_LEAD_ROW_CANCELLED,
  MOCK_LEAD_ROW_COMPLETED,
  MOCK_LEAD_ROW_CONFIRMED,
  MOCK_LEAD_ROW_DRAFT,
  MOCK_LEAD_ROW_MATCHED,
  MOCK_LEAD_ROW_OTHER_CLIENT,
  MOCK_WEEKLY_SCHEDULE,
} from './bookings.mocks';

export {
  createBookingsService,
  listBookingsServiceReadMethods,
} from './bookings.service';
export type {
  BookingsDataPort,
  BookingsFetchOptions,
  BookingsService,
  BookingsServiceErrorCode,
  CreateBookingsServiceInput,
  FetchArtistScheduleResult,
  FetchMasterScheduleResult,
  FetchOwnBookingsResult,
} from './bookings.service';
