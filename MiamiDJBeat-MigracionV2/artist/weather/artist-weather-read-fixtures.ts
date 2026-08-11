/**
 * MOD-204 Weather Slice — Artist Gig Weather Radar fixtures (lab).
 * Assigned gigs only — excludes other-client rows. No network / SQL / API keys.
 */

import {
  MOCK_WX_ARTIST_USER_ID,
  MOCK_WX_DJ_PROFILE_ID,
  MOCK_WX_EVENT_CLEAR,
  MOCK_WX_EVENT_CRITICAL_STORM,
  MOCK_WX_EVENT_HEAT,
  MOCK_WX_EVENT_MODERATE_RAIN,
  mapEventWeatherRowToAlert,
  mapObservationRowToForecast,
  mapVenueWeatherRowToOutdoorRisk,
} from '../../shared/services/weather/index';
import type {
  EventWeatherAlertDTO,
  VenueOutdoorRiskDTO,
  WeatherForecastReadDTO,
} from '../../shared/types/weather.types';

const audience = 'artist_gig' as const;

/** Gigs assigned to mock artist profile (excludes MOCK_WX_EVENT_OTHER_CLIENT). */
export const MOCK_WX_ARTIST_GIG_ROWS = Object.freeze([
  MOCK_WX_EVENT_CLEAR,
  MOCK_WX_EVENT_MODERATE_RAIN,
  MOCK_WX_EVENT_CRITICAL_STORM,
  MOCK_WX_EVENT_HEAT,
]);

export const LAB_ARTIST_GIG_WEATHER: {
  readonly artistUserId: string;
  readonly artistProfileId: string;
  readonly risks: readonly VenueOutdoorRiskDTO[];
  readonly forecasts: readonly WeatherForecastReadDTO[];
  readonly alerts: readonly EventWeatherAlertDTO[];
} = Object.freeze({
  artistUserId: MOCK_WX_ARTIST_USER_ID,
  artistProfileId: MOCK_WX_DJ_PROFILE_ID,
  risks: Object.freeze(
    MOCK_WX_ARTIST_GIG_ROWS.map((row) => mapVenueWeatherRowToOutdoorRisk(row, audience)),
  ),
  forecasts: Object.freeze(
    MOCK_WX_ARTIST_GIG_ROWS.map((row) => mapObservationRowToForecast(row, audience)),
  ),
  alerts: Object.freeze(
    MOCK_WX_ARTIST_GIG_ROWS.map((row) => mapEventWeatherRowToAlert(row, audience)),
  ),
});
