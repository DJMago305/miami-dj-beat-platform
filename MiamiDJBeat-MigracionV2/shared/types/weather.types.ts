/**
 * Weather Engine V2 — Read Model types (Paso 1).
 * Canonical matrix: docs/V2/WEATHER-V1-V2-MAPPING-MATRIX.md
 *
 * Architecture reference (read-only): Candidate C FROZEN in offline-payment worktree.
 * READ-ONLY: no cancel/reschedule writers, no SQL, no provider secrets in DTOs.
 * Lab only: http://localhost:5173
 */

/** V2 canonical outdoor / event weather risk (product Paso 1). */
export type WeatherRiskLevel = 'Low' | 'Moderate' | 'Severe' | 'Critical';

/** Provider/cache freshness (Candidate C metadata vocabulary). */
export type WeatherFreshness = 'LIVE' | 'CACHED' | 'STALE' | 'OFFLINE' | 'UNKNOWN';

/** Event window phase for alerts (Candidate C Event Weather Window). */
export type WeatherEventWindowPhase = 'PRE' | 'SHOW' | 'POST' | 'UNKNOWN';

/** How an alert was produced. */
export type WeatherAlertSourceKind = 'provider_alert' | 'derived_risk' | 'lab_mock';

/** Who may see weather rows in lab projections. */
export type WeatherVisibilityAudience =
  | 'client_event'
  | 'artist_gig'
  | 'staff_seller'
  | 'staff_master'
  | 'public_none';

/** Drivers that elevate outdoor risk. */
export type WeatherRiskDriver =
  | 'rain'
  | 'wind'
  | 'heat'
  | 'humidity'
  | 'storm'
  | 'lightning'
  | 'flood'
  | 'other';

/**
 * Operational advice codes — display copy is UI concern;
 * codes align to dj-logistics merit (Candidate C KEEP/REFACTOR).
 */
export type WeatherOperationalAdviceCode =
  | 'bring_tent_cover'
  | 'protect_electronics'
  | 'relocate_dj_booth'
  | 'secure_light_structures'
  | 'extra_load_in_time'
  | 'monitor_lightning'
  | 'hydrate_heat'
  | 'all_clear';

export type WeatherOperationalAdvice = {
  readonly code: WeatherOperationalAdviceCode;
  readonly message: string;
  readonly riskLevel: WeatherRiskLevel;
};

export type WeatherHourlyPreviewPoint = {
  readonly at: string | null;
  readonly tempF: number | null;
  readonly conditionLabel: string | null;
  readonly precipProbability: number | null;
  readonly windMph: number | null;
};

/**
 * WeatherForecastReadDTO — normalized forecast read (no provider secrets).
 */
export type WeatherForecastReadDTO = {
  readonly forecastId: string;
  readonly locationLabel: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly timezone: string | null;
  readonly asOf: string | null;
  readonly freshness: WeatherFreshness;
  readonly conditionCode: string | null;
  readonly conditionLabel: string | null;
  readonly tempF: number | null;
  readonly feelsLikeF: number | null;
  readonly humidityPct: number | null;
  readonly windMph: number | null;
  readonly precipProbability: number | null;
  readonly hourlyPreview: readonly WeatherHourlyPreviewPoint[];
  readonly providerAttribution: string | null;
  readonly visibility: WeatherVisibilityAudience;
};

/**
 * EventWeatherAlertDTO — alert tied to a booked event / lead.
 */
export type EventWeatherAlertDTO = {
  readonly alertId: string;
  readonly leadId: string | null;
  readonly bookingId: string | null;
  readonly eventDate: string | null;
  readonly eventTitle: string | null;
  readonly venueLabel: string | null;
  readonly riskLevel: WeatherRiskLevel;
  readonly headline: string;
  readonly detail: string | null;
  readonly recommendations: readonly WeatherOperationalAdvice[];
  readonly windowPhase: WeatherEventWindowPhase;
  readonly issuedAt: string | null;
  readonly sourceKind: WeatherAlertSourceKind;
  readonly visibility: WeatherVisibilityAudience;
};

/**
 * VenueOutdoorRiskDTO — outdoor risk card for venue / gig.
 */
export type VenueOutdoorRiskDTO = {
  readonly riskId: string;
  readonly venueLabel: string | null;
  readonly leadId: string | null;
  readonly eventDate: string | null;
  readonly isOutdoorLikely: boolean | null;
  readonly riskLevel: WeatherRiskLevel;
  readonly drivers: readonly WeatherRiskDriver[];
  readonly advice: readonly WeatherOperationalAdvice[];
  readonly forecastSummary: string | null;
  readonly visibility: WeatherVisibilityAudience;
};

/**
 * Map legacy logistics advice type (dj-logistics-engine) → WeatherRiskLevel.
 * Discovery helper for Paso 2+ mappers. Read-only.
 */
export function mapV1LogisticsAdviceTypeToRiskLevel(
  raw: string | null | undefined,
): { readonly level: WeatherRiskLevel; readonly unmapped: boolean } {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (s === 'success' || s === 'ok' || s === 'low') {
    return Object.freeze({ level: 'Low' as const, unmapped: false });
  }
  if (s === 'warning' || s === 'moderate') {
    return Object.freeze({ level: 'Moderate' as const, unmapped: false });
  }
  if (s === 'severe') {
    return Object.freeze({ level: 'Severe' as const, unmapped: false });
  }
  if (s === 'danger' || s === 'critical' || s === 'extreme') {
    return Object.freeze({ level: 'Critical' as const, unmapped: false });
  }
  return Object.freeze({ level: 'Moderate' as const, unmapped: true });
}

/**
 * Elevate risk from wind (mph) + heavy rain heuristic (legacy event-weather extreme protocol).
 */
export function elevateRiskFromWindAndRain(input: {
  readonly base: WeatherRiskLevel;
  readonly windMph: number | null | undefined;
  readonly heavyRain: boolean;
}): WeatherRiskLevel {
  const wind = input.windMph ?? 0;
  if (input.heavyRain && wind > 30) return 'Critical';
  if (wind > 30 || input.heavyRain) {
    if (input.base === 'Critical') return 'Critical';
    return 'Severe';
  }
  return input.base;
}
