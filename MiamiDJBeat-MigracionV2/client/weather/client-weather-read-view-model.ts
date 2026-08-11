/**
 * MOD-103 Weather Slice — Client Event Weather Banner ViewModel (pure).
 * READ-ONLY projection from fetchClientEventWeather. No cancel / date-change writers.
 *
 * Status chips (product Paso 5): Clear / Safe · Manageable Risk · Severe / Contingency Required
 */

import type {
  EventWeatherAlertDTO,
  VenueOutdoorRiskDTO,
  WeatherForecastReadDTO,
  WeatherOperationalAdvice,
  WeatherRiskLevel,
} from '../../shared/types/weather.types';

export const CLIENT_WEATHER_STATUS_FILTERS = Object.freeze([
  'All',
  'Clear / Safe',
  'Manageable Risk',
  'Severe / Contingency Required',
] as const);

export type ClientWeatherStatusFilter = (typeof CLIENT_WEATHER_STATUS_FILTERS)[number];

/** Stable chip bucket for data attrs. */
export type ClientWeatherStatusChip =
  | 'ClearSafe'
  | 'ManageableRisk'
  | 'SevereContingency';

export type ClientEventWeatherCardVM = {
  readonly alertId: string;
  readonly leadId: string | null;
  readonly eventTitle: string;
  readonly venueLabel: string;
  readonly eventDate: string;
  readonly riskLevel: WeatherRiskLevel;
  readonly statusChip: ClientWeatherStatusChip;
  readonly statusLabel: string;
  readonly tempLabel: string;
  readonly precipLabel: string;
  readonly windLabel: string;
  readonly conditionLabel: string;
  readonly forecastSummary: string;
  readonly outdoorRiskLabel: string;
  readonly recommendations: readonly WeatherOperationalAdvice[];
  readonly planBHint: string;
};

export type ClientWeatherSummaryVM = {
  readonly eventCount: number;
  readonly clearSafeCount: number;
  readonly manageableCount: number;
  readonly severeContingencyCount: number;
};

export type ClientWeatherReadViewModel = {
  readonly filter: ClientWeatherStatusFilter;
  readonly summary: ClientWeatherSummaryVM;
  readonly cards: readonly ClientEventWeatherCardVM[];
  /** Highest-severity banner for quick glance (first card after severity sort). */
  readonly banner: ClientEventWeatherCardVM | null;
};

function display(value: string | null | undefined, fallback = '—'): string {
  const t = typeof value === 'string' ? value.trim() : '';
  return t.length > 0 ? t : fallback;
}

export function toClientWeatherStatusChip(riskLevel: WeatherRiskLevel): ClientWeatherStatusChip {
  if (riskLevel === 'Critical' || riskLevel === 'Severe') return 'SevereContingency';
  if (riskLevel === 'Moderate') return 'ManageableRisk';
  return 'ClearSafe';
}

export function clientWeatherStatusLabel(chip: ClientWeatherStatusChip): string {
  if (chip === 'SevereContingency') return 'Severe / Contingency Required';
  if (chip === 'ManageableRisk') return 'Manageable Risk';
  return 'Clear / Safe';
}

export function planBHintForClient(
  riskLevel: WeatherRiskLevel,
  recommendations: readonly WeatherOperationalAdvice[],
): string {
  const codes = new Set(recommendations.map((r) => r.code));
  if (codes.has('relocate_dj_booth') || riskLevel === 'Critical') {
    return 'Plan B: relocate DJ / dance area under cover or indoors if storms persist.';
  }
  if (codes.has('bring_tent_cover') || riskLevel === 'Severe') {
    return 'Plan B: reserve tent / weather cover for outdoor guest areas.';
  }
  if (riskLevel === 'Moderate') {
    return 'Plan B: keep a light cover option ready for rain showers.';
  }
  return 'No contingency action required — conditions look favorable.';
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

function riskForLead(
  risks: readonly VenueOutdoorRiskDTO[],
  leadId: string | null,
): VenueOutdoorRiskDTO | null {
  if (!leadId) return null;
  return risks.find((r) => r.leadId === leadId) ?? null;
}

export function toClientEventWeatherCard(
  alert: EventWeatherAlertDTO,
  forecast: WeatherForecastReadDTO | null,
  risk: VenueOutdoorRiskDTO | null,
): ClientEventWeatherCardVM {
  const precip = forecast?.precipProbability;
  const precipLabel =
    precip == null || !Number.isFinite(precip) ? '—' : `${Math.round(precip * 100)}%`;
  const wind = forecast?.windMph;
  const windLabel = wind == null || !Number.isFinite(wind) ? '—' : `${wind} mph`;
  const temp = forecast?.tempF;
  const tempLabel = temp == null || !Number.isFinite(temp) ? '—' : `${temp}°F`;
  const recommendations =
    alert.recommendations.length > 0
      ? alert.recommendations
      : (risk?.advice ?? Object.freeze([]));
  const statusChip = toClientWeatherStatusChip(alert.riskLevel);

  return Object.freeze({
    alertId: alert.alertId,
    leadId: alert.leadId,
    eventTitle: display(alert.eventTitle, 'Your event'),
    venueLabel: display(alert.venueLabel ?? risk?.venueLabel, 'Venue TBD'),
    eventDate: display(alert.eventDate ?? risk?.eventDate),
    riskLevel: alert.riskLevel,
    statusChip,
    statusLabel: clientWeatherStatusLabel(statusChip),
    tempLabel,
    precipLabel,
    windLabel,
    conditionLabel: display(forecast?.conditionLabel, alert.headline),
    forecastSummary: display(risk?.forecastSummary ?? undefined, alert.detail ?? alert.headline),
    outdoorRiskLabel: alert.riskLevel,
    recommendations,
    planBHint: planBHintForClient(alert.riskLevel, recommendations),
  });
}

export function filterClientWeatherCards(
  cards: readonly ClientEventWeatherCardVM[],
  filter: ClientWeatherStatusFilter,
): readonly ClientEventWeatherCardVM[] {
  if (filter === 'All') return cards;
  if (filter === 'Clear / Safe') {
    return Object.freeze(cards.filter((c) => c.statusChip === 'ClearSafe'));
  }
  if (filter === 'Manageable Risk') {
    return Object.freeze(cards.filter((c) => c.statusChip === 'ManageableRisk'));
  }
  return Object.freeze(cards.filter((c) => c.statusChip === 'SevereContingency'));
}

const SEVERITY_RANK: Record<WeatherRiskLevel, number> = {
  Critical: 4,
  Severe: 3,
  Moderate: 2,
  Low: 1,
};

/**
 * Pure mapper — client event weather payload → display model.
 */
export function toClientWeatherReadViewModel(input: {
  readonly alerts: readonly EventWeatherAlertDTO[];
  readonly forecasts: readonly WeatherForecastReadDTO[];
  readonly risks?: readonly VenueOutdoorRiskDTO[];
  readonly filter?: ClientWeatherStatusFilter;
}): ClientWeatherReadViewModel {
  const filter = input.filter ?? 'All';
  const risks = input.risks ?? [];

  const allCards = Object.freeze(
    [...input.alerts]
      .map((alert) =>
        toClientEventWeatherCard(
          alert,
          forecastForLead(input.forecasts, alert.leadId),
          riskForLead(risks, alert.leadId),
        ),
      )
      .sort((a, b) => SEVERITY_RANK[b.riskLevel] - SEVERITY_RANK[a.riskLevel]),
  );

  let clearSafeCount = 0;
  let manageableCount = 0;
  let severeContingencyCount = 0;
  for (const c of allCards) {
    if (c.statusChip === 'ClearSafe') clearSafeCount += 1;
    if (c.statusChip === 'ManageableRisk') manageableCount += 1;
    if (c.statusChip === 'SevereContingency') severeContingencyCount += 1;
  }

  const cards = filterClientWeatherCards(allCards, filter);

  return Object.freeze({
    filter,
    summary: Object.freeze({
      eventCount: allCards.length,
      clearSafeCount,
      manageableCount,
      severeContingencyCount,
    }),
    cards,
    banner: allCards[0] ?? null,
  });
}
