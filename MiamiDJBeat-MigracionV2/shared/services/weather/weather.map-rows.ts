/**
 * Weather Engine — map observation / event rows → Read DTOs (Paso 2, read-only).
 * Canonical matrix: docs/V2/WEATHER-V1-V2-MAPPING-MATRIX.md
 *
 * No provider secrets · no cancel/reschedule · no SQL.
 */

import {
  elevateRiskFromWindAndRain,
  mapV1LogisticsAdviceTypeToRiskLevel,
  type EventWeatherAlertDTO,
  type VenueOutdoorRiskDTO,
  type WeatherForecastReadDTO,
  type WeatherFreshness,
  type WeatherHourlyPreviewPoint,
  type WeatherOperationalAdvice,
  type WeatherOperationalAdviceCode,
  type WeatherRiskDriver,
  type WeatherRiskLevel,
  type WeatherVisibilityAudience,
} from '../../types/weather.types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asRestRows(data: unknown): readonly Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter(isRecord);
  }
  return isRecord(data) ? [data] : [];
}

export function asString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

export function asNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  return null;
}

const ADVICE_MESSAGES: Readonly<Record<WeatherOperationalAdviceCode, string>> = Object.freeze({
  bring_tent_cover: 'Bring tent / weather cover for outdoor setup',
  protect_electronics: 'Protect electronics from rain and moisture',
  relocate_dj_booth: 'Relocate DJ booth to covered / indoor area',
  secure_light_structures: 'Secure light structures and stands against wind',
  extra_load_in_time: 'Allow extra load-in time for weather delays',
  monitor_lightning: 'Monitor lightning; pause outdoor set if active',
  hydrate_heat: 'Heat/humidity: hydrate crew; shade rest area',
  all_clear: 'Conditions favorable for outdoor performance',
});

/**
 * Derive base risk from precip probability + logistics advice type (before wind/rain elevate).
 */
export function deriveBaseRiskLevel(row: Record<string, unknown>): WeatherRiskLevel {
  const advice = mapV1LogisticsAdviceTypeToRiskLevel(
    asString(row.advice_type) ?? asString(row.logistics_type),
  );
  if (!advice.unmapped) return advice.level;

  const precip = asNumber(row.precip_probability) ?? asNumber(row.pop) ?? 0;
  const condition = (asString(row.condition_code) ?? asString(row.condition_main) ?? '')
    .trim()
    .toLowerCase();
  const heavy =
    asBoolean(row.heavy_rain) === true ||
    condition.includes('thunder') ||
    condition.includes('storm') ||
    (asNumber(row.owm_id) ?? 0) >= 502;

  if (heavy || precip >= 0.7) return 'Severe';
  if (precip >= 0.4) return 'Moderate';
  return 'Low';
}

/**
 * Final risk after wind/rain elevation (legacy extreme protocol).
 */
export function resolveOutdoorRiskLevel(row: Record<string, unknown>): WeatherRiskLevel {
  const base = deriveBaseRiskLevel(row);
  const windMph = asNumber(row.wind_mph) ?? asNumber(row.wind_speed);
  const condition = (asString(row.condition_code) ?? asString(row.condition_main) ?? '')
    .trim()
    .toLowerCase();
  const heavyRain =
    asBoolean(row.heavy_rain) === true ||
    condition.includes('thunder') ||
    condition.includes('storm') ||
    (asNumber(row.owm_id) ?? 0) >= 502 ||
    (asNumber(row.precip_probability) ?? 0) >= 0.75;

  return elevateRiskFromWindAndRain({ base, windMph, heavyRain });
}

export function collectRiskDrivers(row: Record<string, unknown>): readonly WeatherRiskDriver[] {
  const drivers: WeatherRiskDriver[] = [];
  const precip = asNumber(row.precip_probability) ?? asNumber(row.pop) ?? 0;
  const wind = asNumber(row.wind_mph) ?? asNumber(row.wind_speed) ?? 0;
  const temp = asNumber(row.temp_f) ?? asNumber(row.temp) ?? 0;
  const humidity = asNumber(row.humidity_pct) ?? asNumber(row.humidity) ?? 0;
  const condition = (asString(row.condition_code) ?? asString(row.condition_main) ?? '')
    .trim()
    .toLowerCase();

  if (precip >= 0.35 || condition.includes('rain') || asBoolean(row.heavy_rain) === true) {
    drivers.push('rain');
  }
  if (wind >= 20) drivers.push('wind');
  if (temp >= 90) drivers.push('heat');
  if (humidity >= 80) drivers.push('humidity');
  if (condition.includes('storm') || condition.includes('thunder')) {
    drivers.push('storm');
    drivers.push('lightning');
  }
  if (asBoolean(row.flood_risk) === true) drivers.push('flood');
  if (drivers.length === 0) drivers.push('other');

  return Object.freeze([...new Set(drivers)]);
}

/**
 * Build operational advice list from risk + drivers (read-only recommendations).
 */
export function buildOperationalAdvice(
  riskLevel: WeatherRiskLevel,
  drivers: readonly WeatherRiskDriver[],
): readonly WeatherOperationalAdvice[] {
  if (riskLevel === 'Low') {
    return Object.freeze([
      Object.freeze({
        code: 'all_clear' as const,
        message: ADVICE_MESSAGES.all_clear,
        riskLevel: 'Low' as const,
      }),
    ]);
  }

  const codes: WeatherOperationalAdviceCode[] = [];
  if (drivers.includes('rain') || drivers.includes('storm')) {
    codes.push('bring_tent_cover', 'protect_electronics');
  }
  if (riskLevel === 'Severe' || riskLevel === 'Critical') {
    codes.push('relocate_dj_booth');
  }
  if (drivers.includes('wind')) {
    codes.push('secure_light_structures');
  }
  if (drivers.includes('lightning') || drivers.includes('storm')) {
    codes.push('monitor_lightning');
  }
  if (drivers.includes('heat') || drivers.includes('humidity')) {
    codes.push('hydrate_heat');
  }
  if (riskLevel === 'Moderate' || riskLevel === 'Severe' || riskLevel === 'Critical') {
    codes.push('extra_load_in_time');
  }

  const unique = [...new Set(codes)];
  return Object.freeze(
    unique.map((code) =>
      Object.freeze({
        code,
        message: ADVICE_MESSAGES[code],
        riskLevel,
      }),
    ),
  );
}

function parseFreshness(raw: string | null): WeatherFreshness {
  const s = (raw ?? '').trim().toUpperCase();
  if (s === 'LIVE' || s === 'CACHED' || s === 'STALE' || s === 'OFFLINE' || s === 'UNKNOWN') {
    return s;
  }
  return 'UNKNOWN';
}

function parseHourlyPreview(raw: unknown): readonly WeatherHourlyPreviewPoint[] {
  if (!Array.isArray(raw)) return Object.freeze([]);
  return Object.freeze(
    raw.filter(isRecord).map((p) =>
      Object.freeze({
        at: asString(p.at) ?? asString(p.dt),
        tempF: asNumber(p.temp_f) ?? asNumber(p.temp),
        conditionLabel: asString(p.condition_label) ?? asString(p.description),
        precipProbability: asNumber(p.precip_probability) ?? asNumber(p.pop),
        windMph: asNumber(p.wind_mph) ?? asNumber(p.wind_speed),
      }),
    ),
  );
}

/**
 * Pure mapper — observation row → WeatherForecastReadDTO.
 */
export function mapObservationRowToForecast(
  row: Record<string, unknown>,
  visibility: WeatherVisibilityAudience,
): WeatherForecastReadDTO {
  const lat = asNumber(row.latitude) ?? asNumber(row.lat);
  const lon = asNumber(row.longitude) ?? asNumber(row.lon);
  const leadId = asString(row.lead_id);
  const asOf = asString(row.as_of) ?? asString(row.retrieved_at) ?? asString(row.updated_at);
  const forecastId =
    leadId != null
      ? `wx:event:${leadId}`
      : lat != null && lon != null
        ? `wx:${lat}:${lon}:${asOf ?? 'na'}`
        : `wx:loc:${asString(row.location_label) ?? 'unknown'}`;

  return Object.freeze({
    forecastId,
    locationLabel: asString(row.location_label) ?? asString(row.venue_label) ?? asString(row.city),
    latitude: lat,
    longitude: lon,
    timezone: asString(row.timezone),
    asOf,
    freshness: parseFreshness(asString(row.freshness)),
    conditionCode: asString(row.condition_code) ?? asString(row.condition_main),
    conditionLabel: asString(row.condition_label) ?? asString(row.description),
    tempF: asNumber(row.temp_f) ?? asNumber(row.temp),
    feelsLikeF: asNumber(row.feels_like_f) ?? asNumber(row.feels_like),
    humidityPct: asNumber(row.humidity_pct) ?? asNumber(row.humidity),
    windMph: asNumber(row.wind_mph) ?? asNumber(row.wind_speed),
    precipProbability: asNumber(row.precip_probability) ?? asNumber(row.pop),
    hourlyPreview: parseHourlyPreview(row.hourly_preview),
    providerAttribution: asString(row.provider_attribution) ?? 'lab_mock',
    visibility,
  });
}

/**
 * Pure mapper — event weather signal → EventWeatherAlertDTO.
 */
export function mapEventWeatherRowToAlert(
  row: Record<string, unknown>,
  visibility: WeatherVisibilityAudience,
): EventWeatherAlertDTO {
  const leadId = asString(row.lead_id) ?? asString(row.id);
  const riskLevel = resolveOutdoorRiskLevel(row);
  const drivers = collectRiskDrivers(row);
  const recommendations = buildOperationalAdvice(riskLevel, drivers);
  const condition =
    asString(row.condition_label) ?? asString(row.condition_code) ?? 'Weather advisory';
  const venue = asString(row.venue_label) ?? asString(row.location_label);
  const asOf = asString(row.as_of) ?? asString(row.issued_at) ?? asString(row.updated_at);
  const phaseRaw = (asString(row.window_phase) ?? 'PRE').toUpperCase();
  const windowPhase =
    phaseRaw === 'PRE' || phaseRaw === 'SHOW' || phaseRaw === 'POST' ? phaseRaw : 'UNKNOWN';
  const sourceRaw = (asString(row.source_kind) ?? 'lab_mock').toLowerCase();
  const sourceKind =
    sourceRaw === 'provider_alert' || sourceRaw === 'derived_risk' || sourceRaw === 'lab_mock'
      ? sourceRaw
      : 'lab_mock';

  const headline =
    asString(row.headline) ??
    (riskLevel === 'Low'
      ? `Favorable conditions — ${condition}`
      : `${riskLevel} weather risk — ${condition}`);

  return Object.freeze({
    alertId: leadId ? `alert:${leadId}:${riskLevel}:${asOf ?? 'na'}` : `alert:unknown:${riskLevel}`,
    leadId,
    bookingId: asString(row.booking_id) ?? leadId,
    eventDate: asString(row.event_date),
    eventTitle: asString(row.event_title) ?? asString(row.event_type) ?? asString(row.title),
    venueLabel: venue,
    riskLevel,
    headline,
    detail: asString(row.detail) ?? asString(row.description),
    recommendations,
    windowPhase,
    issuedAt: asOf,
    sourceKind,
    visibility,
  });
}

/**
 * Pure mapper — venue/gig signal → VenueOutdoorRiskDTO.
 */
export function mapVenueWeatherRowToOutdoorRisk(
  row: Record<string, unknown>,
  visibility: WeatherVisibilityAudience,
): VenueOutdoorRiskDTO {
  const leadId = asString(row.lead_id) ?? asString(row.id);
  const venue = asString(row.venue_label) ?? asString(row.location_label) ?? asString(row.city);
  const eventDate = asString(row.event_date);
  const riskLevel = resolveOutdoorRiskLevel(row);
  const drivers = collectRiskDrivers(row);
  const advice = buildOperationalAdvice(riskLevel, drivers);
  const condition =
    asString(row.condition_label) ?? asString(row.condition_code) ?? 'Unknown conditions';
  const wind = asNumber(row.wind_mph) ?? asNumber(row.wind_speed);
  const precip = asNumber(row.precip_probability) ?? asNumber(row.pop);

  const forecastSummary =
    asString(row.forecast_summary) ??
    `${condition}; wind ${wind ?? '—'} mph; precip ${
      precip == null ? '—' : `${Math.round(precip * 100)}%`
    }; risk ${riskLevel}`;

  return Object.freeze({
    riskId: `risk:${venue ?? 'unknown'}:${eventDate ?? 'na'}:${leadId ?? 'na'}`,
    venueLabel: venue,
    leadId,
    eventDate,
    isOutdoorLikely: asBoolean(row.is_outdoor) ?? asBoolean(row.is_outdoor_likely),
    riskLevel,
    drivers,
    advice,
    forecastSummary,
    visibility,
  });
}

export function filterAlertsForClient(
  alerts: readonly EventWeatherAlertDTO[],
  clientUserId: string,
  ownedLeadIds: ReadonlySet<string>,
): readonly EventWeatherAlertDTO[] {
  void clientUserId;
  return Object.freeze(
    alerts.filter((a) => a.visibility === 'client_event' && a.leadId != null && ownedLeadIds.has(a.leadId)),
  );
}

export function filterRisksForArtist(
  risks: readonly VenueOutdoorRiskDTO[],
  assignedLeadIds: ReadonlySet<string>,
): readonly VenueOutdoorRiskDTO[] {
  return Object.freeze(
    risks.filter(
      (r) =>
        r.visibility === 'artist_gig' && (r.leadId == null || assignedLeadIds.has(r.leadId)),
    ),
  );
}

export function filterAlertsForStaffMaster(
  alerts: readonly EventWeatherAlertDTO[],
): readonly EventWeatherAlertDTO[] {
  return Object.freeze(
    alerts.filter((a) => a.visibility === 'staff_master' || a.visibility === 'staff_seller'),
  );
}

export function sortAlertsByRiskDesc(
  alerts: readonly EventWeatherAlertDTO[],
): readonly EventWeatherAlertDTO[] {
  const rank: Record<WeatherRiskLevel, number> = {
    Critical: 4,
    Severe: 3,
    Moderate: 2,
    Low: 1,
  };
  return Object.freeze(
    [...alerts].sort((a, b) => rank[b.riskLevel] - rank[a.riskLevel]),
  );
}

export function summarizeRiskCounts(
  risks: readonly { readonly riskLevel: WeatherRiskLevel }[],
): Readonly<Record<WeatherRiskLevel, number>> {
  const counts: Record<WeatherRiskLevel, number> = {
    Low: 0,
    Moderate: 0,
    Severe: 0,
    Critical: 0,
  };
  for (const r of risks) {
    counts[r.riskLevel] += 1;
  }
  return Object.freeze(counts);
}
