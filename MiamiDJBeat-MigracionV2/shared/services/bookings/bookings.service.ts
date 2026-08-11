/**
 * Bookings service — READ-ONLY fetching (Paso 2).
 * Injectable data port: SELECT-shaped reads only. No insert/update/delete/cancel.
 */

import { createApiError } from '../../api/runtime/errors';
import type {
  ApiFailure,
  ApiMetadata,
  ApiResponse,
  RequestContext,
  SessionReaderPort,
} from '../../api/runtime';
import type {
  BookingSnapshotDTO,
  BookingVisibilityAudience,
  CalendarSlotDTO,
  EventDetailReadDTO,
} from '../../types/bookings.types';
import {
  asRestRows,
  filterBookingsForArtist,
  filterBookingsForClient,
  mapArtistScheduleJsonToSlots,
  mapBookingSnapshotToCalendarSlot,
  mapLeadRowToBookingSnapshot,
  mapLeadRowToEventDetail,
  redactEventDetailForAudience,
} from './bookings.map-rows';

export type BookingsFetchOptions = {
  readonly timeoutMs?: number;
  readonly context?: Partial<RequestContext>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
};

export type BookingsServiceErrorCode =
  | 'BOOKINGS_SESSION_REQUIRED'
  | 'BOOKINGS_FORBIDDEN'
  | 'BOOKINGS_NOT_FOUND'
  | 'BOOKINGS_PARSE_ERROR'
  | 'BOOKINGS_SUBJECT_REQUIRED';

export type FetchOwnBookingsResult = {
  readonly bookings: readonly BookingSnapshotDTO[];
};

export type FetchArtistScheduleResult = {
  readonly slots: readonly CalendarSlotDTO[];
  readonly bookings: readonly BookingSnapshotDTO[];
};

export type FetchMasterScheduleResult = {
  readonly bookings: readonly BookingSnapshotDTO[];
  readonly slots: readonly CalendarSlotDTO[];
};

export type BookingsService = {
  /** Client portal — leads for the given client user (session required). */
  readonly fetchOwnBookings: (
    options: BookingsFetchOptions & { readonly clientUserId: string },
  ) => Promise<ApiResponse<FetchOwnBookingsResult>>;
  /** Artist portal — own schedule JSON slots + assigned bookings. */
  readonly fetchArtistSchedule: (
    options: BookingsFetchOptions & {
      readonly artistUserId: string;
      readonly artistProfileId?: string | null;
    },
  ) => Promise<ApiResponse<FetchArtistScheduleResult>>;
  /** Staff portal — master commercial schedule. */
  readonly fetchMasterSchedule: (
    options?: BookingsFetchOptions & {
      readonly audience?: Extract<BookingVisibilityAudience, 'staff_seller' | 'staff_full'>;
    },
  ) => Promise<ApiResponse<FetchMasterScheduleResult>>;
  /** Detail read — SELECT-only; PII redaction by audience. */
  readonly fetchEventDetail: (
    bookingId: string,
    options?: BookingsFetchOptions & { readonly audience?: BookingVisibilityAudience },
  ) => Promise<ApiResponse<EventDetailReadDTO>>;
};

/** Injectable read port — SELECT only (tests inject fixtures). */
export type BookingsDataPort = {
  readonly selectLeadsForClient: (
    clientUserId: string,
    options?: BookingsFetchOptions,
  ) => Promise<ApiResponse<unknown>>;
  readonly selectLeadsForArtist: (
    input: { readonly artistProfileId?: string | null; readonly artistUserId?: string | null },
    options?: BookingsFetchOptions,
  ) => Promise<ApiResponse<unknown>>;
  readonly selectLeadsForStaff: (options?: BookingsFetchOptions) => Promise<ApiResponse<unknown>>;
  readonly selectLeadById: (
    bookingId: string,
    options?: BookingsFetchOptions,
  ) => Promise<ApiResponse<unknown>>;
  readonly selectArtistScheduleProfile: (
    artistUserId: string,
    options?: BookingsFetchOptions,
  ) => Promise<
    ApiResponse<{
      readonly user_id?: string;
      readonly weekly_schedule?: unknown;
      readonly availability_schedule?: unknown;
      readonly vacation_start?: string | null;
      readonly vacation_end?: string | null;
    }>
  >;
};

export type CreateBookingsServiceInput = {
  readonly dataPort: BookingsDataPort;
  readonly sessionReader?: SessionReaderPort;
};

function buildFailure(
  code: BookingsServiceErrorCode,
  message: string,
  status: number,
  metadata: ApiMetadata,
): ApiFailure {
  return Object.freeze({
    ok: false,
    status,
    error: createApiError(
      code === 'BOOKINGS_PARSE_ERROR' ? 'API_PARSE_ERROR' : 'API_INVALID_PAYLOAD',
      message,
      status,
      code,
    ),
    metadata,
  });
}

function emptyMetadata(context?: Partial<RequestContext>): ApiMetadata {
  const requestId = context?.requestId ?? 'bookings_precheck';
  const correlationId = context?.correlationId ?? 'bookings_precheck';
  return Object.freeze({
    requestId,
    correlationId,
    durationMs: 0,
    attempt: 1,
    context: Object.freeze({
      requestId,
      correlationId,
      portal: context?.portal,
      sessionId: context?.sessionId ?? null,
      actorType: context?.actorType ?? 'guest',
    }),
  });
}

function requireSession(
  sessionReader: SessionReaderPort | undefined,
  options?: BookingsFetchOptions,
): ApiFailure | null {
  if ((sessionReader?.getAuthorizationHeader() ?? null) !== null) {
    return null;
  }
  return buildFailure(
    'BOOKINGS_SESSION_REQUIRED',
    'Bookings read requires an active session.',
    401,
    emptyMetadata(options?.context),
  );
}

function mapLeadRows(
  data: unknown,
  artistUserId?: string | null,
): BookingSnapshotDTO[] {
  return asRestRows(data).map((row) =>
    mapLeadRowToBookingSnapshot(row, { assignedArtistUserId: artistUserId ?? null }),
  );
}

export function createBookingsService(input: CreateBookingsServiceInput): BookingsService {
  const { dataPort, sessionReader } = input;

  const service: BookingsService = {
    async fetchOwnBookings(options) {
      const sessionFail = requireSession(sessionReader, options);
      if (sessionFail) return sessionFail;

      const clientUserId = options.clientUserId?.trim() ?? '';
      if (!clientUserId) {
        return buildFailure(
          'BOOKINGS_SUBJECT_REQUIRED',
          'clientUserId is required for fetchOwnBookings.',
          400,
          emptyMetadata(options.context),
        );
      }

      const result = await dataPort.selectLeadsForClient(clientUserId, options);
      if (!result.ok) return result;

      const mapped = mapLeadRows(result.data);
      const bookings = filterBookingsForClient(mapped, clientUserId);

      return Object.freeze({
        ok: true as const,
        status: result.status,
        data: Object.freeze({ bookings }),
        metadata: result.metadata,
      });
    },

    async fetchArtistSchedule(options) {
      const sessionFail = requireSession(sessionReader, options);
      if (sessionFail) return sessionFail;

      const artistUserId = options.artistUserId?.trim() ?? '';
      if (!artistUserId) {
        return buildFailure(
          'BOOKINGS_SUBJECT_REQUIRED',
          'artistUserId is required for fetchArtistSchedule.',
          400,
          emptyMetadata(options.context),
        );
      }

      const artistProfileId = options.artistProfileId ?? null;

      const [leadsResult, scheduleResult] = await Promise.all([
        dataPort.selectLeadsForArtist({ artistProfileId, artistUserId }, options),
        dataPort.selectArtistScheduleProfile(artistUserId, options),
      ]);

      if (!leadsResult.ok) return leadsResult;
      if (!scheduleResult.ok) return scheduleResult;

      const bookings = filterBookingsForArtist(mapLeadRows(leadsResult.data, artistUserId), {
        artistUserId,
        artistProfileId,
      });

      const profile = scheduleResult.data ?? {};
      const scheduleSlots = mapArtistScheduleJsonToSlots({
        ownerArtistUserId: artistUserId,
        weeklySchedule: profile.weekly_schedule,
        availabilitySchedule: profile.availability_schedule,
        vacationStart: profile.vacation_start ?? null,
        vacationEnd: profile.vacation_end ?? null,
      });

      const bookingSlots = bookings.map((b) =>
        mapBookingSnapshotToCalendarSlot(b, 'artist_assigned'),
      );

      return Object.freeze({
        ok: true as const,
        status: 200,
        data: Object.freeze({
          slots: Object.freeze([...scheduleSlots, ...bookingSlots]),
          bookings,
        }),
        metadata: leadsResult.metadata,
      });
    },

    async fetchMasterSchedule(options) {
      const sessionFail = requireSession(sessionReader, options);
      if (sessionFail) return sessionFail;

      const audience = options?.audience ?? 'staff_full';
      if (audience !== 'staff_seller' && audience !== 'staff_full') {
        return buildFailure(
          'BOOKINGS_FORBIDDEN',
          'Master schedule requires staff audience.',
          403,
          emptyMetadata(options?.context),
        );
      }

      const result = await dataPort.selectLeadsForStaff(options);
      if (!result.ok) return result;

      const bookings = Object.freeze(mapLeadRows(result.data));
      const slots = Object.freeze(
        bookings.map((b) => mapBookingSnapshotToCalendarSlot(b, audience)),
      );

      return Object.freeze({
        ok: true as const,
        status: result.status,
        data: Object.freeze({ bookings, slots }),
        metadata: result.metadata,
      });
    },

    async fetchEventDetail(bookingId, options) {
      const sessionFail = requireSession(sessionReader, options);
      if (sessionFail) return sessionFail;

      if (!bookingId.trim()) {
        return buildFailure(
          'BOOKINGS_NOT_FOUND',
          'bookingId required.',
          400,
          emptyMetadata(options?.context),
        );
      }

      const result = await dataPort.selectLeadById(bookingId, options);
      if (!result.ok) return result;

      const row = asRestRows(result.data)[0];
      if (!row) {
        return buildFailure(
          'BOOKINGS_NOT_FOUND',
          'Lead not found.',
          404,
          result.metadata ?? emptyMetadata(options?.context),
        );
      }

      const detail = mapLeadRowToEventDetail(row);
      const audience = options?.audience ?? 'staff_full';

      return Object.freeze({
        ok: true as const,
        status: result.status,
        data: redactEventDetailForAudience(detail, audience),
        metadata: result.metadata,
      });
    },
  };

  return Object.freeze(service);
}

/** Guard: public surface must not expose writers. */
export function listBookingsServiceReadMethods(): readonly string[] {
  return Object.freeze([
    'fetchOwnBookings',
    'fetchArtistSchedule',
    'fetchMasterSchedule',
    'fetchEventDetail',
  ]);
}
