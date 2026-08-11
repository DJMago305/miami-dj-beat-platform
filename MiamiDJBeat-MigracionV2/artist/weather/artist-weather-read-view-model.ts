/**
 * MOD-204 Weather Slice — Artist Gig Weather Radar ViewModel (pure).
 * READ-ONLY projection from fetchArtistGigWeather. No cancel / relocate writers.
 *
 * Filters (product Paso 4): All · Outdoor High Risk · Manageable · Safe / Indoor
 */

import type {
  EventWeatherAlertDTO,
  VenueOutdoorRiskDTO,
  WeatherForecastReadDTO,
  WeatherOperationalAdvice,
  WeatherRiskLevel,
} from '../../shared/types/weather.types';

export const ARTIST_WEATHER_VIEW_FILTERS = Object.freeze([
  'All',
  'Outdoor High Risk',
  'Manageable',
  'Safe / Indoor',
] as const);

export type ArtistWeatherViewFilter = (typeof ARTIST_WEATHER_VIEW_FILTERS)[number];

/** Stable bucket for filter chips / data attrs. */
export type ArtistWeatherRiskBucket =
  | 'OutdoorHighRisk'
  | 'Manageable'
  | 'SafeIndoor';

export type ArtistGigWeatherCardVM = {
  readonly riskId: string;
  readonly leadId: string | null;
  readonly eventTitle: string;
  readonly venueLabel: string;
  readonly eventDate: string;
  readonly riskLevel: WeatherRiskLevel;
  readonly riskBucket: ArtistWeatherRiskBucket;
  readonly isOutdoorLikely: boolean | null;
  readonly tempLabel: string;
  readonly precipLabel: string;
  readonly windLabel: string;
  readonly conditionLabel: string;
  readonly forecastSummary: string;
  readonly gearAdvice: readonly WeatherOperationalAdvice[];
  readonly wardrobeHint: string;
  readonly driversLabel: string;
};

export type ArtistWeatherSummaryVM = {
  readonly gigCount: number;
  readonly outdoorHighRiskCount: number;
  readonly manageableCount: number;
  readonly safeIndoorCount: number;
  readonly criticalCount: number;
};

export type ArtistWeatherReadViewModel = {
  readonly filter: ArtistWeatherViewFilter;
  readonly summary: ArtistWeatherSummaryVM;
  readonly cards: readonly ArtistGigWeatherCardVM[];
};

function display(value: string | null | undefined, fallback = '—'): string {
  const t = typeof value === 'string' ? value.trim() : '';
  return t.length > 0 ? t : fallback;
}

export function toArtistWeatherRiskBucket(
  riskLevel: WeatherRiskLevel,
  isOutdoorLikely: boolean | null,
): ArtistWeatherRiskBucket {
  if (riskLevel === 'Critical' || riskLevel === 'Severe') return 'OutdoorHighRisk';
  if (riskLevel === 'Moderate') return 'Manageable';
  if (isOutdoorLikely === false) return 'SafeIndoor';
  return 'SafeIndoor';
}

export function wardrobeHintForRisk(
  riskLevel: WeatherRiskLevel,
  drivers: readonly string[],
  isOutdoorLikely: boolean | null,
): string {
  if (isOutdoorLikely === false && riskLevel === 'Low') {
    return 'Indoor gig — standard stage attire is fine.';
  }
  if (drivers.includes('heat') || drivers.includes('humidity')) {
    return 'Heat/humidity — light breathable attire; pack spare shirt.';
  }
  if (drivers.includes('rain') || drivers.includes('storm')) {
    return 'Wet weather — waterproof layers and covered footwear.';
  }
  if (drivers.includes('wind')) {
    return 'Wind — secure light wardrobe pieces and hats.';
  }
  if (riskLevel === 'Critical' || riskLevel === 'Severe') {
    return 'High outdoor risk — bring weather layers and covered footwear.';
  }
  if (riskLevel === 'Moderate') {
    return 'Variable conditions — keep a light cover layer handy.';
  }
  return 'Conditions favorable — standard outdoor stage attire.';
}

function forecastForLead(
  forecasts: readonly WeatherForecastReadDTO[],
  leadId: string | null,
): WeatherForecastReadDTO | null {
  if (!leadId) return null;
  return (
    forecasts.find((f) => f.forecastId === `wx:event:${leadId}`) ??
    forecasts.find((f) => f.forecastId.includes(leadId)) ??
    null
  );
}

function alertForLead(
  alerts: readonly EventWeatherAlertDTO[],
  leadId: string | null,
): EventWeatherAlertDTO | null {
  if (!leadId) return null;
  return alerts.find((a) => a.leadId === leadId) ?? null;
}

export function toArtistGigWeatherCard(
  risk: VenueOutdoorRiskDTO,
  forecast: WeatherForecastReadDTO | null,
  alert: EventWeatherAlertDTO | null,
): ArtistGigWeatherCardVM {
  const precip = forecast?.precipProbability;
  const precipLabel =
    precip == null || !Number.isFinite(precip) ? '—' : `${Math.round(precip * 100)}%`;
  const wind = forecast?.windMph;
  const windLabel = wind == null || !Number.isFinite(wind) ? '—' : `${wind} mph`;
  const temp = forecast?.tempF;
  const tempLabel = temp == null || !Number.isFinite(temp) ? '—' : `${temp}°F`;
  const drivers = risk.drivers ?? [];
  const gearAdvice =
    risk.advice.length > 0
      ? risk.advice
      : (alert?.recommendations ?? Object.freeze([]));

  return Object.freeze({
    riskId: risk.riskId,
    leadId: risk.leadId,
    eventTitle: display(alert?.eventTitle, 'Assigned gig'),
    venueLabel: display(risk.venueLabel, 'Venue TBD'),
    eventDate: display(risk.eventDate ?? alert?.eventDate),
    riskLevel: risk.riskLevel,
    riskBucket: toArtistWeatherRiskBucket(risk.riskLevel, risk.isOutdoorLikely),
    isOutdoorLikely: risk.isOutdoorLikely,
    tempLabel,
    precipLabel,
    windLabel,
    conditionLabel: display(forecast?.conditionLabel, risk.forecastSummary ?? undefined),
    forecastSummary: display(risk.forecastSummary, alert?.headline),
    gearAdvice,
    wardrobeHint: wardrobeHintForRisk(risk.riskLevel, drivers, risk.isOutdoorLikely),
    driversLabel: drivers.length > 0 ? drivers.join(', ') : '—',
  });
}

export function filterArtistWeatherCards(
  cards: readonly ArtistGigWeatherCardVM[],
  filter: ArtistWeatherViewFilter,
): readonly ArtistGigWeatherCardVM[] {
  if (filter === 'All') return cards;
  if (filter === 'Outdoor High Risk') {
    return Object.freeze(cards.filter((c) => c.riskBucket === 'OutdoorHighRisk'));
  }
  if (filter === 'Manageable') {
    return Object.freeze(cards.filter((c) => c.riskBucket === 'Manageable'));
  }
  return Object.freeze(cards.filter((c) => c.riskBucket === 'SafeIndoor'));
}

/**
 * Pure mapper — artist gig weather payload → display model.
 */
export function toArtistWeatherReadViewModel(input: {
  readonly risks: readonly VenueOutdoorRiskDTO[];
  readonly forecasts: readonly WeatherForecastReadDTO[];
  readonly alerts?: readonly EventWeatherAlertDTO[];
  readonly filter?: ArtistWeatherViewFilter;
}): ArtistWeatherReadViewModel {
  const filter = input.filter ?? 'All';
  const alerts = input.alerts ?? [];

  const allCards = Object.freeze(
    input.risks.map((risk) =>
      toArtistGigWeatherCard(
        risk,
        forecastForLead(input.forecasts, risk.leadId),
        alertForLead(alerts, risk.leadId),
      ),
    ),
  );

  let outdoorHighRiskCount = 0;
  let manageableCount = 0;
  let safeIndoorCount = 0;
  let criticalCount = 0;
  for (const c of allCards) {
    if (c.riskBucket === 'OutdoorHighRisk') outdoorHighRiskCount += 1;
    if (c.riskBucket === 'Manageable') manageableCount += 1;
    if (c.riskBucket === 'SafeIndoor') safeIndoorCount += 1;
    if (c.riskLevel === 'Critical') criticalCount += 1;
  }

  return Object.freeze({
    filter,
    summary: Object.freeze({
      gigCount: allCards.length,
      outdoorHighRiskCount,
      manageableCount,
      safeIndoorCount,
      criticalCount,
    }),
    cards: filterArtistWeatherCards(allCards, filter),
  });
}
