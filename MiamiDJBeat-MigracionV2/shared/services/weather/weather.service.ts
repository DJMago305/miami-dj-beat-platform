/**
 * Weather Engine service — READ-ONLY fetching (Paso 2).
 * Injectable data port: observation / event weather rows only.
 * No cancel · no reschedule · no provider API keys · no SQL writers.
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
  EventWeatherAlertDTO,
  VenueOutdoorRiskDTO,
  WeatherForecastReadDTO,
  WeatherRiskLevel,
  WeatherVisibilityAudience,
} from '../../types/weather.types';
import {
  asRestRows,
  asString,
  filterAlertsForClient,
  filterRisksForArtist,
  mapEventWeatherRowToAlert,
  mapObservationRowToForecast,
  mapVenueWeatherRowToOutdoorRisk,
  sortAlertsByRiskDesc,
  summarizeRiskCounts,
} from './weather.map-rows';

export type WeatherFetchOptions = {
  readonly timeoutMs?: number;
  readonly context?: Partial<RequestContext>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
};

export type WeatherServiceErrorCode =
  | 'WEATHER_SESSION_REQUIRED'
  | 'WEATHER_FORBIDDEN'
  | 'WEATHER_SUBJECT_REQUIRED'
  | 'WEATHER_PARSE_ERROR';

export type FetchClientEventWeatherResult = {
  readonly alerts: readonly EventWeatherAlertDTO[];
  readonly forecasts: readonly WeatherForecastReadDTO[];
  readonly risks: readonly VenueOutdoorRiskDTO[];
};

export type FetchArtistGigWeatherResult = {
  readonly risks: readonly VenueOutdoorRiskDTO[];
  readonly forecasts: readonly WeatherForecastReadDTO[];
  readonly alerts: readonly EventWeatherAlertDTO[];
};

export type FetchMasterWeatherConsoleResult = {
  readonly alerts: readonly EventWeatherAlertDTO[];
  readonly risks: readonly VenueOutdoorRiskDTO[];
  readonly forecasts: readonly WeatherForecastReadDTO[];
  readonly riskCounts: Readonly<Record<WeatherRiskLevel, number>>;
};

export type WeatherService = {
  /** Client portal — weather for own contracted events only. */
  readonly fetchClientEventWeather: (
    options: WeatherFetchOptions & { readonly clientUserId: string },
  ) => Promise<ApiResponse<FetchClientEventWeatherResult>>;
  /** Artist portal — outdoor risk / conditions for assigned gigs. */
  readonly fetchArtistGigWeather: (
    options: WeatherFetchOptions & {
      readonly artistUserId: string;
      readonly artistProfileId?: string | null;
    },
  ) => Promise<ApiResponse<FetchArtistGigWeatherResult>>;
  /** Staff portal — master weather / outdoor risk console. */
  readonly fetchMasterWeatherConsole: (
    options?: WeatherFetchOptions & {
      readonly audience?: Extract<WeatherVisibilityAudience, 'staff_seller' | 'staff_master'>;
    },
  ) => Promise<ApiResponse<FetchMasterWeatherConsoleResult>>;
};

/** Injectable read port — SELECT-shaped / fixture reads only. */
export type WeatherDataPort = {
  readonly selectEventWeatherForClient: (
    clientUserId: string,
    options?: WeatherFetchOptions,
  ) => Promise<ApiResponse<unknown>>;
  readonly selectEventWeatherForArtist: (
    input: { readonly artistProfileId?: string | null; readonly artistUserId?: string | null },
    options?: WeatherFetchOptions,
  ) => Promise<ApiResponse<unknown>>;
  readonly selectEventWeatherForStaff: (options?: WeatherFetchOptions) => Promise<ApiResponse<unknown>>;
};

export type CreateWeatherServiceInput = {
  readonly dataPort: WeatherDataPort;
  readonly sessionReader?: SessionReaderPort;
};

function buildFailure(
  code: WeatherServiceErrorCode,
  message: string,
  status: number,
  metadata: ApiMetadata,
): ApiFailure {
  return Object.freeze({
    ok: false,
    status,
    error: createApiError(
      code === 'WEATHER_PARSE_ERROR' ? 'API_PARSE_ERROR' : 'API_INVALID_PAYLOAD',
      message,
      status,
      code,
    ),
    metadata,
  });
}

function emptyMetadata(context?: Partial<RequestContext>): ApiMetadata {
  const requestId = context?.requestId ?? 'weather_precheck';
  const correlationId = context?.correlationId ?? 'weather_precheck';
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
  options?: WeatherFetchOptions,
): ApiFailure | null {
  if ((sessionReader?.getAuthorizationHeader() ?? null) !== null) {
    return null;
  }
  return buildFailure(
    'WEATHER_SESSION_REQUIRED',
    'Weather read requires an active session.',
    401,
    emptyMetadata(options?.context),
  );
}

function ownedLeadIdsFromRows(
  rows: readonly Record<string, unknown>[],
  clientUserId: string,
): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (asString(row.client_user_id) === clientUserId) {
      const id = asString(row.lead_id) ?? asString(row.id);
      if (id) ids.add(id);
    }
  }
  return ids;
}

function assignedLeadIdsFromRows(
  rows: readonly Record<string, unknown>[],
  artistProfileId: string | null | undefined,
): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    const assigned = asString(row.assigned_dj_id);
    if (artistProfileId && assigned && assigned !== artistProfileId) continue;
    const id = asString(row.lead_id) ?? asString(row.id);
    if (id) ids.add(id);
  }
  return ids;
}

export function createWeatherService(input: CreateWeatherServiceInput): WeatherService {
  const { dataPort, sessionReader } = input;

  const service: WeatherService = {
    async fetchClientEventWeather(options) {
      const sessionFail = requireSession(sessionReader, options);
      if (sessionFail) return sessionFail;

      const clientUserId = options.clientUserId?.trim() ?? '';
      if (!clientUserId) {
        return buildFailure(
          'WEATHER_SUBJECT_REQUIRED',
          'clientUserId is required for fetchClientEventWeather.',
          400,
          emptyMetadata(options.context),
        );
      }

      const result = await dataPort.selectEventWeatherForClient(clientUserId, options);
      if (!result.ok) return result;

      const rows = asRestRows(result.data).filter(
        (row) => asString(row.client_user_id) === clientUserId,
      );
      const owned = ownedLeadIdsFromRows(rows, clientUserId);

      const alerts = filterAlertsForClient(
        rows.map((row) => mapEventWeatherRowToAlert(row, 'client_event')),
        clientUserId,
        owned,
      );
      const forecasts = Object.freeze(
        rows.map((row) => mapObservationRowToForecast(row, 'client_event')),
      );
      const risks = Object.freeze(
        rows.map((row) => mapVenueWeatherRowToOutdoorRisk(row, 'client_event')),
      );

      return Object.freeze({
        ok: true as const,
        status: result.status,
        data: Object.freeze({
          alerts: sortAlertsByRiskDesc(alerts),
          forecasts,
          risks,
        }),
        metadata: result.metadata,
      });
    },

    async fetchArtistGigWeather(options) {
      const sessionFail = requireSession(sessionReader, options);
      if (sessionFail) return sessionFail;

      const artistUserId = options.artistUserId?.trim() ?? '';
      if (!artistUserId) {
        return buildFailure(
          'WEATHER_SUBJECT_REQUIRED',
          'artistUserId is required for fetchArtistGigWeather.',
          400,
          emptyMetadata(options.context),
        );
      }

      const artistProfileId = options.artistProfileId ?? null;
      const result = await dataPort.selectEventWeatherForArtist(
        { artistProfileId, artistUserId },
        options,
      );
      if (!result.ok) return result;

      const rows = asRestRows(result.data).filter((row) => {
        if (!artistProfileId) return true;
        const assigned = asString(row.assigned_dj_id);
        return !assigned || assigned === artistProfileId;
      });
      const assignedIds = assignedLeadIdsFromRows(rows, artistProfileId);

      const risks = filterRisksForArtist(
        rows.map((row) => mapVenueWeatherRowToOutdoorRisk(row, 'artist_gig')),
        assignedIds,
      );
      const forecasts = Object.freeze(
        rows.map((row) => mapObservationRowToForecast(row, 'artist_gig')),
      );
      const alerts = Object.freeze(
        sortAlertsByRiskDesc(rows.map((row) => mapEventWeatherRowToAlert(row, 'artist_gig'))),
      );

      return Object.freeze({
        ok: true as const,
        status: result.status,
        data: Object.freeze({ risks, forecasts, alerts }),
        metadata: result.metadata,
      });
    },

    async fetchMasterWeatherConsole(options) {
      const sessionFail = requireSession(sessionReader, options);
      if (sessionFail) return sessionFail;

      const audience = options?.audience ?? 'staff_master';
      if (audience !== 'staff_seller' && audience !== 'staff_master') {
        return buildFailure(
          'WEATHER_FORBIDDEN',
          'Master weather console requires staff audience.',
          403,
          emptyMetadata(options?.context),
        );
      }

      const result = await dataPort.selectEventWeatherForStaff(options);
      if (!result.ok) return result;

      const rows = asRestRows(result.data);
      const alerts = sortAlertsByRiskDesc(
        rows.map((row) => mapEventWeatherRowToAlert(row, audience)),
      );
      const risks = Object.freeze(
        rows.map((row) => mapVenueWeatherRowToOutdoorRisk(row, audience)),
      );
      const forecasts = Object.freeze(
        rows.map((row) => mapObservationRowToForecast(row, audience)),
      );
      const riskCounts = summarizeRiskCounts(risks);

      return Object.freeze({
        ok: true as const,
        status: result.status,
        data: Object.freeze({ alerts, risks, forecasts, riskCounts }),
        metadata: result.metadata,
      });
    },
  };

  return Object.freeze(service);
}

/** Guard: public surface must not expose writers. */
export function listWeatherServiceReadMethods(): readonly string[] {
  return Object.freeze([
    'fetchClientEventWeather',
    'fetchArtistGigWeather',
    'fetchMasterWeatherConsole',
  ]);
}
