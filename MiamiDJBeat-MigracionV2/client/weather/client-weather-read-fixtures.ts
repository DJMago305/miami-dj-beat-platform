/**
 * MOD-103 Weather Slice — Client Event Weather fixtures (lab).
 * Own contracted events only — excludes other-client rows. No network / SQL / API keys.
 */

import {
  MOCK_WX_CLIENT_USER_ID,
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

const audience = 'client_event' as const;

/** Events owned by mock client (excludes MOCK_WX_EVENT_OTHER_CLIENT). */
export const MOCK_WX_CLIENT_EVENT_ROWS = Object.freeze([
  MOCK_WX_EVENT_CLEAR,
  MOCK_WX_EVENT_MODERATE_RAIN,
  MOCK_WX_EVENT_CRITICAL_STORM,
  MOCK_WX_EVENT_HEAT,
]);

export const LAB_CLIENT_EVENT_WEATHER: {
  readonly clientUserId: string;
  readonly alerts: readonly EventWeatherAlertDTO[];
  readonly forecasts: readonly WeatherForecastReadDTO[];
  readonly risks: readonly VenueOutdoorRiskDTO[];
} = Object.freeze({
  clientUserId: MOCK_WX_CLIENT_USER_ID,
  alerts: Object.freeze(
    MOCK_WX_CLIENT_EVENT_ROWS.map((row) => mapEventWeatherRowToAlert(row, audience)),
  ),
  forecasts: Object.freeze(
    MOCK_WX_CLIENT_EVENT_ROWS.map((row) => mapObservationRowToForecast(row, audience)),
  ),
  risks: Object.freeze(
    MOCK_WX_CLIENT_EVENT_ROWS.map((row) => mapVenueWeatherRowToOutdoorRisk(row, audience)),
  ),
});
