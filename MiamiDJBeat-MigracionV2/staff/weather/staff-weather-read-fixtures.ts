/**
 * MOD-301 Weather Slice — Staff Weather Risk Console fixtures (lab).
 * Built from weather.mocks via pure mappers — no network / SQL / API keys.
 */

import {
  MOCK_WX_ALL_EVENT_ROWS,
  mapEventWeatherRowToAlert,
  mapObservationRowToForecast,
  mapVenueWeatherRowToOutdoorRisk,
  sortAlertsByRiskDesc,
  summarizeRiskCounts,
} from '../../shared/services/weather/index';
import type {
  EventWeatherAlertDTO,
  VenueOutdoorRiskDTO,
  WeatherForecastReadDTO,
  WeatherRiskLevel,
} from '../../shared/types/weather.types';

const audience = 'staff_master' as const;

const risks: readonly VenueOutdoorRiskDTO[] = Object.freeze(
  MOCK_WX_ALL_EVENT_ROWS.map((row) => mapVenueWeatherRowToOutdoorRisk(row, audience)),
);

const alerts: readonly EventWeatherAlertDTO[] = sortAlertsByRiskDesc(
  MOCK_WX_ALL_EVENT_ROWS.map((row) => mapEventWeatherRowToAlert(row, audience)),
);

const forecasts: readonly WeatherForecastReadDTO[] = Object.freeze(
  MOCK_WX_ALL_EVENT_ROWS.map((row) => mapObservationRowToForecast(row, audience)),
);

const riskCounts: Readonly<Record<WeatherRiskLevel, number>> = summarizeRiskCounts(risks);

export const LAB_STAFF_MASTER_WEATHER: {
  readonly alerts: readonly EventWeatherAlertDTO[];
  readonly risks: readonly VenueOutdoorRiskDTO[];
  readonly forecasts: readonly WeatherForecastReadDTO[];
  readonly riskCounts: Readonly<Record<WeatherRiskLevel, number>>;
  readonly audience: 'staff_master';
} = Object.freeze({
  audience,
  alerts,
  risks,
  forecasts,
  riskCounts,
});
