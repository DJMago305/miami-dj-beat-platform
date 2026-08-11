/**
 * Bookings V2 — frozen read-model mocks for Vitest (Paso 2).
 * No network · no SQL · no mutations.
 */

import type {
  BookingSnapshotDTO,
  CalendarSlotDTO,
  EventDetailReadDTO,
} from '../../types/bookings.types';
import {
  mapArtistScheduleJsonToSlots,
  mapBookingSnapshotToCalendarSlot,
  mapLeadRowToBookingSnapshot,
  mapLeadRowToEventDetail,
} from './bookings.map-rows';

/** Raw lead-shaped rows (PostgREST-like) for mapper tests. */
export const MOCK_LEAD_ROW_DRAFT = Object.freeze({
  id: 'lead-draft-001',
  client_user_id: '00000000-0000-4000-8000-000000000001',
  assigned_dj_id: 'dj-profile-mock-1',
  assigned_staff_id: null,
  full_name: 'Jane Client',
  email: 'jane@example.com',
  phone: '+1-305-555-0100',
  event_type: 'Wedding',
  event_date: '2026-09-12',
  event_start_time: '18:00',
  event_end_time: '23:00',
  location: 'Coral Gables',
  status: 'NEW',
  payment_status: 'UNPAID',
  notes: 'Garden ceremony',
  budget: 2500,
  lead_outcome: 'open',
  event_completed_at: null,
});

export const MOCK_LEAD_ROW_CONFIRMED = Object.freeze({
  ...MOCK_LEAD_ROW_DRAFT,
  id: 'lead-confirmed-002',
  status: 'CONFIRMED',
  payment_status: 'PARTIAL',
  assigned_staff_id: '00000000-0000-4000-8000-000000000004',
});

export const MOCK_LEAD_ROW_MATCHED = Object.freeze({
  ...MOCK_LEAD_ROW_DRAFT,
  id: 'lead-matched-003',
  status: 'MATCHED',
  payment_status: 'PENDING',
});

export const MOCK_LEAD_ROW_COMPLETED = Object.freeze({
  ...MOCK_LEAD_ROW_DRAFT,
  id: 'lead-completed-004',
  status: 'COMPLETED',
  payment_status: 'PAID',
  event_completed_at: '2026-07-15T04:00:00.000Z',
});

export const MOCK_LEAD_ROW_CANCELLED = Object.freeze({
  ...MOCK_LEAD_ROW_DRAFT,
  id: 'lead-cancelled-005',
  status: 'CANCELLED',
  payment_status: 'UNPAID',
});

/** Another client — used for visibility filter tests. */
export const MOCK_LEAD_ROW_OTHER_CLIENT = Object.freeze({
  ...MOCK_LEAD_ROW_CONFIRMED,
  id: 'lead-other-006',
  client_user_id: '00000000-0000-4000-8000-000000000099',
  full_name: 'Other Client',
  email: 'other@example.com',
});

export const MOCK_ARTIST_USER_ID = '00000000-0000-4000-8000-000000000003';
export const MOCK_CLIENT_USER_ID = '00000000-0000-4000-8000-000000000001';
export const MOCK_DJ_PROFILE_ID = 'dj-profile-mock-1';

export const MOCK_BOOKING_SNAPSHOT_DRAFT: BookingSnapshotDTO = mapLeadRowToBookingSnapshot(
  MOCK_LEAD_ROW_DRAFT,
  { assignedArtistUserId: MOCK_ARTIST_USER_ID, mdjbClientId: 'MDJB-TEST-0001-C' },
);

export const MOCK_BOOKING_SNAPSHOT_CONFIRMED: BookingSnapshotDTO = mapLeadRowToBookingSnapshot(
  MOCK_LEAD_ROW_CONFIRMED,
  { assignedArtistUserId: MOCK_ARTIST_USER_ID, mdjbArtistId: 'MDJB-TEST-0003-A' },
);

export const MOCK_BOOKING_SNAPSHOT_IN_PROGRESS: BookingSnapshotDTO = mapLeadRowToBookingSnapshot(
  MOCK_LEAD_ROW_MATCHED,
  { assignedArtistUserId: MOCK_ARTIST_USER_ID },
);

export const MOCK_BOOKING_SNAPSHOT_COMPLETED: BookingSnapshotDTO = mapLeadRowToBookingSnapshot(
  MOCK_LEAD_ROW_COMPLETED,
  { assignedArtistUserId: MOCK_ARTIST_USER_ID },
);

export const MOCK_BOOKING_SNAPSHOT_CANCELLED: BookingSnapshotDTO = mapLeadRowToBookingSnapshot(
  MOCK_LEAD_ROW_CANCELLED,
  { assignedArtistUserId: MOCK_ARTIST_USER_ID },
);

export const MOCK_EVENT_DETAIL_CONFIRMED: EventDetailReadDTO = mapLeadRowToEventDetail(
  MOCK_LEAD_ROW_CONFIRMED,
  {
    assignedArtistUserId: MOCK_ARTIST_USER_ID,
    productionFlowId: 'flow-001',
    productionStatus: 'ready',
  },
);

export const MOCK_WEEKLY_SCHEDULE = Object.freeze({
  friday: Object.freeze({ venue: 'Club Nova', start: '22:00', end: '03:00' }),
  __busy_days: Object.freeze(['2026-08-20']),
});

export const MOCK_AVAILABILITY_SCHEDULE = Object.freeze({
  schedule: Object.freeze({
    '2026-08-22': Object.freeze({ start: '10:00', end: '14:00' }),
    '2026-08-23': Object.freeze({ blocked: true }),
  }),
});

export const MOCK_ARTIST_SCHEDULE_SLOTS: readonly CalendarSlotDTO[] = mapArtistScheduleJsonToSlots({
  ownerArtistUserId: MOCK_ARTIST_USER_ID,
  weeklySchedule: MOCK_WEEKLY_SCHEDULE,
  availabilitySchedule: MOCK_AVAILABILITY_SCHEDULE,
  vacationStart: '2026-12-24',
  vacationEnd: '2026-12-26',
});

export const MOCK_BOOKING_SLOT_CONFIRMED: CalendarSlotDTO = mapBookingSnapshotToCalendarSlot(
  MOCK_BOOKING_SNAPSHOT_CONFIRMED,
  'artist_assigned',
);

export const MOCK_ALL_LEAD_ROWS = Object.freeze([
  MOCK_LEAD_ROW_DRAFT,
  MOCK_LEAD_ROW_CONFIRMED,
  MOCK_LEAD_ROW_MATCHED,
  MOCK_LEAD_ROW_COMPLETED,
  MOCK_LEAD_ROW_CANCELLED,
  MOCK_LEAD_ROW_OTHER_CLIENT,
]);
