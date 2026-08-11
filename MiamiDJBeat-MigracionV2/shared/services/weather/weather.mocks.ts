/**
 * Weather Engine V2 — frozen read-model mocks for Vitest (Paso 2).
 * No network · no SQL · no provider API keys · no mutations.
 */

import type {
  EventWeatherAlertDTO,
  VenueOutdoorRiskDTO,
  WeatherForecastReadDTO,
} from '../../types/weather.types';
import {
  mapEventWeatherRowToAlert,
  mapObservationRowToForecast,
  mapVenueWeatherRowToOutdoorRisk,
} from './weather.map-rows';

export const MOCK_WX_CLIENT_USER_ID = '00000000-0000-4000-8000-000000000001';
export const MOCK_WX_OTHER_CLIENT_USER_ID = '00000000-0000-4000-8000-000000000099';
export const MOCK_WX_ARTIST_USER_ID = '00000000-0000-4000-8000-000000000003';
export const MOCK_WX_DJ_PROFILE_ID = 'dj-profile-wx-1';

/** Clear outdoor — Low risk (client own event). */
export const MOCK_WX_EVENT_CLEAR = Object.freeze({
  lead_id: 'wx-lead-clear-001',
  booking_id: 'wx-lead-clear-001',
  client_user_id: MOCK_WX_CLIENT_USER_ID,
  assigned_dj_id: MOCK_WX_DJ_PROFILE_ID,
  event_title: 'Sunset Cocktail',
  event_date: '2026-09-12',
  venue_label: 'South Beach Lawn',
  location_label: 'Miami Beach, FL',
  latitude: 25.7907,
  longitude: -80.13,
  timezone: 'America/New_York',
  as_of: '2026-08-11T14:00:00.000Z',
  freshness: 'CACHED',
  condition_code: 'Clear',
  condition_label: 'Clear skies',
  temp_f: 84,
  feels_like_f: 86,
  humidity_pct: 55,
  wind_mph: 8,
  precip_probability: 0.05,
  heavy_rain: false,
  is_outdoor: true,
  advice_type: 'success',
  window_phase: 'PRE',
  source_kind: 'lab_mock',
  provider_attribution: 'lab_mock',
  hourly_preview: Object.freeze([
    Object.freeze({
      at: '2026-09-12T18:00:00.000Z',
      temp_f: 82,
      condition_label: 'Clear',
      precip_probability: 0.05,
      wind_mph: 7,
    }),
  ]),
});

/** Moderate rain caution — client own. */
export const MOCK_WX_EVENT_MODERATE_RAIN = Object.freeze({
  ...MOCK_WX_EVENT_CLEAR,
  lead_id: 'wx-lead-rain-002',
  booking_id: 'wx-lead-rain-002',
  event_title: 'Garden Reception',
  event_date: '2026-09-20',
  venue_label: 'Coral Gables Garden',
  condition_code: 'Rain',
  condition_label: 'Light rain expected',
  temp_f: 78,
  feels_like_f: 80,
  humidity_pct: 82,
  wind_mph: 12,
  precip_probability: 0.55,
  advice_type: 'warning',
  headline: 'Moderate rain risk for outdoor reception',
  detail: 'Bring cover for booth and electronics.',
});

/** Severe wind + rain — Critical elevate (artist gig). */
export const MOCK_WX_EVENT_CRITICAL_STORM = Object.freeze({
  ...MOCK_WX_EVENT_CLEAR,
  lead_id: 'wx-lead-storm-003',
  booking_id: 'wx-lead-storm-003',
  event_title: 'Rooftop Corporate',
  event_date: '2026-09-25',
  venue_label: 'Brickell Rooftop',
  condition_code: 'Thunderstorm',
  condition_label: 'Thunderstorms and strong wind',
  owm_id: 502,
  temp_f: 76,
  humidity_pct: 90,
  wind_mph: 34,
  precip_probability: 0.85,
  heavy_rain: true,
  advice_type: 'danger',
  window_phase: 'SHOW',
  source_kind: 'derived_risk',
  headline: 'Critical storm risk — relocate booth',
  detail: 'Wind >30 mph with heavy rain; outdoor set unsafe.',
});

/** Other client's event — must not leak to client portal. */
export const MOCK_WX_EVENT_OTHER_CLIENT = Object.freeze({
  ...MOCK_WX_EVENT_MODERATE_RAIN,
  lead_id: 'wx-lead-other-004',
  booking_id: 'wx-lead-other-004',
  client_user_id: MOCK_WX_OTHER_CLIENT_USER_ID,
  assigned_dj_id: 'dj-profile-other',
  event_title: 'Private Other Client',
  venue_label: 'Key Biscayne Club',
});

/** Heat / humidity moderate — artist assigned gig. */
export const MOCK_WX_EVENT_HEAT = Object.freeze({
  ...MOCK_WX_EVENT_CLEAR,
  lead_id: 'wx-lead-heat-005',
  booking_id: 'wx-lead-heat-005',
  event_title: 'Daytime Pool Party',
  event_date: '2026-10-02',
  venue_label: 'Wynwood Courtyard',
  condition_code: 'Hot',
  condition_label: 'Hot and humid',
  temp_f: 94,
  feels_like_f: 102,
  humidity_pct: 88,
  wind_mph: 6,
  precip_probability: 0.1,
  advice_type: 'warning',
  window_phase: 'PRE',
});

export const MOCK_WX_ALL_EVENT_ROWS = Object.freeze([
  MOCK_WX_EVENT_CLEAR,
  MOCK_WX_EVENT_MODERATE_RAIN,
  MOCK_WX_EVENT_CRITICAL_STORM,
  MOCK_WX_EVENT_OTHER_CLIENT,
  MOCK_WX_EVENT_HEAT,
]);

/** Lead ids owned by mock client. */
export const MOCK_WX_CLIENT_OWNED_LEAD_IDS = Object.freeze([
  'wx-lead-clear-001',
  'wx-lead-rain-002',
  'wx-lead-storm-003',
  'wx-lead-heat-005',
]);

/** Lead ids assigned to mock artist. */
export const MOCK_WX_ARTIST_ASSIGNED_LEAD_IDS = Object.freeze([
  'wx-lead-clear-001',
  'wx-lead-rain-002',
  'wx-lead-storm-003',
  'wx-lead-heat-005',
]);

export const MOCK_WX_FORECAST_CLEAR: WeatherForecastReadDTO = mapObservationRowToForecast(
  MOCK_WX_EVENT_CLEAR,
  'client_event',
);

export const MOCK_WX_ALERT_CRITICAL: EventWeatherAlertDTO = mapEventWeatherRowToAlert(
  MOCK_WX_EVENT_CRITICAL_STORM,
  'client_event',
);

export const MOCK_WX_RISK_STORM: VenueOutdoorRiskDTO = mapVenueWeatherRowToOutdoorRisk(
  MOCK_WX_EVENT_CRITICAL_STORM,
  'artist_gig',
);

export const MOCK_WX_ALERT_STAFF_STORM: EventWeatherAlertDTO = mapEventWeatherRowToAlert(
  MOCK_WX_EVENT_CRITICAL_STORM,
  'staff_master',
);
