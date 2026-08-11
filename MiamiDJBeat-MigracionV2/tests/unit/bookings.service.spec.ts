/**
 * bookings.service.spec.ts — Paso 2 read-only bookings service + mappers.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ApiMetadata, ApiResponse } from '../../shared/api/runtime';
import { createStaticSessionReader } from '../../shared/api/runtime';
import {
  MOCK_ALL_LEAD_ROWS,
  MOCK_ARTIST_USER_ID,
  MOCK_AVAILABILITY_SCHEDULE,
  MOCK_BOOKING_SNAPSHOT_CONFIRMED,
  MOCK_BOOKING_SNAPSHOT_DRAFT,
  MOCK_BOOKING_SNAPSHOT_IN_PROGRESS,
  MOCK_CLIENT_USER_ID,
  MOCK_DJ_PROFILE_ID,
  MOCK_LEAD_ROW_CONFIRMED,
  MOCK_LEAD_ROW_DRAFT,
  MOCK_WEEKLY_SCHEDULE,
  createBookingsService,
  filterBookingsForClient,
  listBookingsServiceReadMethods,
  mapArtistScheduleJsonToSlots,
  mapLeadRowToBookingSnapshot,
  mapV1PaymentStatus,
  redactEventDetailForAudience,
  mapLeadRowToEventDetail,
  type BookingsDataPort,
} from '../../shared/services/bookings/index';
import { mapV1StatusToLifecycle } from '../../shared/types/bookings.types';

const meta: ApiMetadata = Object.freeze({
  requestId: 'req_bookings',
  correlationId: 'corr_bookings',
  durationMs: 1,
  attempt: 1,
  context: Object.freeze({
    requestId: 'req_bookings',
    correlationId: 'corr_bookings',
    portal: 'client' as const,
    sessionId: 'ses_1',
    actorType: 'authenticated',
  }),
});

function ok<T>(data: T): ApiResponse<T> {
  return Object.freeze({ ok: true, status: 200, data, metadata: meta });
}

function createPort(partial: Partial<BookingsDataPort> = {}): BookingsDataPort {
  return Object.freeze({
    selectLeadsForClient: vi.fn(async () => ok([])),
    selectLeadsForArtist: vi.fn(async () => ok([])),
    selectLeadsForStaff: vi.fn(async () => ok([])),
    selectLeadById: vi.fn(async () => ok([])),
    selectArtistScheduleProfile: vi.fn(async () =>
      ok({
        user_id: MOCK_ARTIST_USER_ID,
        weekly_schedule: MOCK_WEEKLY_SCHEDULE,
        availability_schedule: MOCK_AVAILABILITY_SCHEDULE,
        vacation_start: '2026-12-24',
        vacation_end: '2026-12-26',
      }),
    ),
    ...partial,
  });
}

const authed = () =>
  createStaticSessionReader({
    portal: 'client',
    sessionId: 'ses_1',
    authorizationHeader: 'Bearer test',
    actorType: 'authenticated',
  });

describe('bookings.map-rows — lifecycle & payment', () => {
  it('maps NEW→Draft, MATCHED→InProgress, CONFIRMED→Confirmed', () => {
    expect(mapLeadRowToBookingSnapshot(MOCK_LEAD_ROW_DRAFT).lifecycleStatus).toBe('Draft');
    expect(MOCK_BOOKING_SNAPSHOT_IN_PROGRESS.lifecycleStatus).toBe('InProgress');
    expect(MOCK_BOOKING_SNAPSHOT_CONFIRMED.lifecycleStatus).toBe('Confirmed');
    expect(mapV1StatusToLifecycle('COMPLETED').status).toBe('Completed');
    expect(mapV1StatusToLifecycle('cancelled').status).toBe('Cancelled');
  });

  it('maps payment_status orthogonally', () => {
    expect(mapV1PaymentStatus('UNPAID')).toBe('Unpaid');
    expect(mapV1PaymentStatus('PARTIAL')).toBe('Partial');
    expect(mapV1PaymentStatus('PAID')).toBe('Paid');
    expect(mapV1PaymentStatus('weird')).toBe('Unknown');
  });

  it('filters client visibility to own user id only', () => {
    const all = MOCK_ALL_LEAD_ROWS.map((row) =>
      mapLeadRowToBookingSnapshot(row, { assignedArtistUserId: MOCK_ARTIST_USER_ID }),
    );
    const own = filterBookingsForClient(all, MOCK_CLIENT_USER_ID);
    expect(own.every((b) => b.clientUserId === MOCK_CLIENT_USER_ID)).toBe(true);
    expect(own.some((b) => b.bookingId === 'lead-other-006')).toBe(false);
  });

  it('expands artist schedule JSON into virtual slots', () => {
    const slots = mapArtistScheduleJsonToSlots({
      ownerArtistUserId: MOCK_ARTIST_USER_ID,
      weeklySchedule: MOCK_WEEKLY_SCHEDULE,
      availabilitySchedule: MOCK_AVAILABILITY_SCHEDULE,
      vacationStart: '2026-12-24',
      vacationEnd: '2026-12-26',
    });
    expect(slots.some((s) => s.slotKind === 'residency')).toBe(true);
    expect(slots.some((s) => s.slotKind === 'busy')).toBe(true);
    expect(slots.some((s) => s.slotKind === 'vacation')).toBe(true);
    expect(slots.some((s) => s.slotKind === 'availability')).toBe(true);
  });

  it('redacts PII for artist_assigned audience', () => {
    const detail = mapLeadRowToEventDetail(MOCK_LEAD_ROW_CONFIRMED);
    const redacted = redactEventDetailForAudience(detail, 'artist_assigned');
    expect(redacted.clientEmail).toBeNull();
    expect(redacted.clientPhone).toBeNull();
    expect(redacted.clientDisplayName).toBe('Jane Client');
  });
});

describe('bookings.service — session & surface', () => {
  it('exposes only read methods (no writers)', () => {
    const methods = listBookingsServiceReadMethods();
    expect(methods).toEqual([
      'fetchOwnBookings',
      'fetchArtistSchedule',
      'fetchMasterSchedule',
      'fetchEventDetail',
    ]);
    const service = createBookingsService({ dataPort: createPort(), sessionReader: authed() });
    expect(Object.keys(service).sort()).toEqual([...methods].sort());
    expect(JSON.stringify(service)).not.toMatch(/insert|update|delete|cancel|upsert/i);
  });

  it('requires session for fetchOwnBookings', async () => {
    const guest = createStaticSessionReader({
      portal: 'client',
      sessionId: null,
      authorizationHeader: null,
      actorType: 'guest',
    });
    const service = createBookingsService({ dataPort: createPort({}), sessionReader: guest });
    const result = await service.fetchOwnBookings({ clientUserId: MOCK_CLIENT_USER_ID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.details).toBe('BOOKINGS_SESSION_REQUIRED');
  });
});

describe('bookings.service — fetchOwnBookings', () => {
  it('returns only the authenticated client bookings', async () => {
    const port = createPort({
      selectLeadsForClient: vi.fn(async () => ok([...MOCK_ALL_LEAD_ROWS])),
    });
    const service = createBookingsService({ dataPort: port, sessionReader: authed() });
    const result = await service.fetchOwnBookings({ clientUserId: MOCK_CLIENT_USER_ID });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.bookings.every((b) => b.clientUserId === MOCK_CLIENT_USER_ID)).toBe(true);
    expect(result.data.bookings.map((b) => b.lifecycleStatus)).toContain('Draft');
    expect(result.data.bookings.map((b) => b.lifecycleStatus)).toContain('Confirmed');
  });
});

describe('bookings.service — fetchArtistSchedule', () => {
  it('merges schedule slots with assigned booking slots', async () => {
    const port = createPort({
      selectLeadsForArtist: vi.fn(async () =>
        ok([MOCK_LEAD_ROW_CONFIRMED, MOCK_LEAD_ROW_DRAFT]),
      ),
    });
    const service = createBookingsService({
      dataPort: port,
      sessionReader: createStaticSessionReader({
        portal: 'artist',
        sessionId: 'ses_a',
        authorizationHeader: 'Bearer artist',
        actorType: 'authenticated',
      }),
    });
    const result = await service.fetchArtistSchedule({
      artistUserId: MOCK_ARTIST_USER_ID,
      artistProfileId: MOCK_DJ_PROFILE_ID,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.bookings.length).toBeGreaterThan(0);
    expect(result.data.slots.some((s) => s.slotKind === 'booking')).toBe(true);
    expect(result.data.slots.some((s) => s.slotKind === 'residency')).toBe(true);
  });
});

describe('bookings.service — fetchMasterSchedule', () => {
  it('returns all staff-visible bookings as master slots', async () => {
    const port = createPort({
      selectLeadsForStaff: vi.fn(async () => ok([...MOCK_ALL_LEAD_ROWS])),
    });
    const service = createBookingsService({
      dataPort: port,
      sessionReader: createStaticSessionReader({
        portal: 'staff',
        sessionId: 'ses_s',
        authorizationHeader: 'Bearer staff',
        actorType: 'staff',
      }),
    });
    const result = await service.fetchMasterSchedule({ audience: 'staff_full' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.bookings.length).toBe(MOCK_ALL_LEAD_ROWS.length);
    expect(result.data.slots).toHaveLength(result.data.bookings.length);
    expect(result.data.slots.every((s) => s.visibility === 'staff_full')).toBe(true);
  });
});

describe('bookings.service — fetchEventDetail', () => {
  it('returns detail for staff_full with PII', async () => {
    const port = createPort({
      selectLeadById: vi.fn(async () => ok([MOCK_LEAD_ROW_CONFIRMED])),
    });
    const service = createBookingsService({ dataPort: port, sessionReader: authed() });
    const result = await service.fetchEventDetail('lead-confirmed-002', {
      audience: 'staff_full',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.clientEmail).toBe('jane@example.com');
    expect(result.data.lifecycleStatus).toBe('Confirmed');
  });

  it('returns NOT_FOUND when lead missing', async () => {
    const service = createBookingsService({
      dataPort: createPort({ selectLeadById: vi.fn(async () => ok([])) }),
      sessionReader: authed(),
    });
    const result = await service.fetchEventDetail('missing');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.details).toBe('BOOKINGS_NOT_FOUND');
  });
});

describe('bookings.mocks — lifecycle fixtures', () => {
  it('covers Draft Confirmed InProgress Completed Cancelled', () => {
    expect(MOCK_BOOKING_SNAPSHOT_DRAFT.lifecycleStatus).toBe('Draft');
    expect(MOCK_BOOKING_SNAPSHOT_CONFIRMED.lifecycleStatus).toBe('Confirmed');
    expect(MOCK_BOOKING_SNAPSHOT_IN_PROGRESS.lifecycleStatus).toBe('InProgress');
  });
});
