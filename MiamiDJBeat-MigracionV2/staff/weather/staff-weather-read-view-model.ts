/**
 * MOD-301 Weather Slice — Staff Weather Risk Console ViewModel (pure).
 * READ-ONLY projection from fetchMasterWeatherConsole. No cancel/reschedule.
 */

import type {
  EventWeatherAlertDTO,
  VenueOutdoorRiskDTO,
  WeatherForecastReadDTO,
  WeatherOperationalAdvice,
  WeatherRiskLevel,
  WeatherVisibilityAudience,
} from '../../shared/types/weather.types';

export const STAFF_WEATHER_RISK_FILTERS = Object.freeze([
  'All',
  'Critical',
  'Severe',
  'Moderate',
  'Low',
] as const);

export type StaffWeatherRiskFilter = (typeof STAFF_WEATHER_RISK_FILTERS)[number];

export type StaffWeatherEventCardVM = {
  readonly alertId: string;
  readonly riskId: string | null;
  readonly leadId: string | null;
  readonly eventTitle: string;
  readonly venueLabel: string;
  readonly eventDate: string;
  readonly riskLevel: WeatherRiskLevel;
  readonly tempLabel: string;
  readonly precipLabel: string;
  readonly windLabel: string;
  readonly conditionLabel: string;
  readonly forecastSummary: string;
  readonly recommendations: readonly WeatherOperationalAdvice[];
  readonly driversLabel: string;
};

export type StaffWeatherSummaryVM = {
  readonly eventCount: number;
  readonly riskCounts: Readonly<Record<WeatherRiskLevel, number>>;
  readonly criticalCount: number;
  readonly severeCount: number;
};

export type StaffWeatherReadViewModel = {
  readonly audience: Extract<WeatherVisibilityAudience, 'staff_seller' | 'staff_master'>;
  readonly riskFilter: StaffWeatherRiskFilter;
  readonly searchQuery: string;
  readonly summary: StaffWeatherSummaryVM;
  readonly cards: readonly StaffWeatherEventCardVM[];
};

function display(value: string | null | undefined, fallback = '—'): string {
  const t = typeof value === 'string' ? value.trim() : '';
  return t.length > 0 ? t : fallback;
}

function emptyRiskCounts(): Record<WeatherRiskLevel, number> {
  return { Low: 0, Moderate: 0, Severe: 0, Critical: 0 };
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

export function toStaffWeatherEventCard(
  alert: EventWeatherAlertDTO,
  forecast: WeatherForecastReadDTO | null,
  risk: VenueOutdoorRiskDTO | null,
): StaffWeatherEventCardVM {
  const precip = forecast?.precipProbability;
  const precipLabel =
    precip == null || !Number.isFinite(precip) ? '—' : `${Math.round(precip * 100)}%`;
  const wind = forecast?.windMph;
  const windLabel = wind == null || !Number.isFinite(wind) ? '—' : `${wind} mph`;
  const temp = forecast?.tempF;
  const tempLabel = temp == null || !Number.isFinite(temp) ? '—' : `${temp}°F`;

  return Object.freeze({
    alertId: alert.alertId,
    riskId: risk?.riskId ?? null,
    leadId: alert.leadId,
    eventTitle: display(alert.eventTitle, 'Untitled event'),
    venueLabel: display(alert.venueLabel ?? risk?.venueLabel, 'Venue TBD'),
    eventDate: display(alert.eventDate ?? risk?.eventDate),
    riskLevel: alert.riskLevel,
    tempLabel,
    precipLabel,
    windLabel,
    conditionLabel: display(forecast?.conditionLabel, alert.headline),
    forecastSummary: display(risk?.forecastSummary, alert.detail ?? alert.headline),
    recommendations: alert.recommendations.length
      ? alert.recommendations
      : (risk?.advice ?? Object.freeze([])),
    driversLabel:
      risk?.drivers?.length && risk.drivers.length > 0 ? risk.drivers.join(', ') : '—',
  });
}

export function filterWeatherCards(
  cards: readonly StaffWeatherEventCardVM[],
  riskFilter: StaffWeatherRiskFilter,
  searchQuery: string,
): readonly StaffWeatherEventCardVM[] {
  const q = searchQuery.trim().toLowerCase();
  return Object.freeze(
    cards.filter((card) => {
      if (riskFilter !== 'All' && card.riskLevel !== riskFilter) return false;
      if (!q) return true;
      const hay = `${card.eventTitle} ${card.venueLabel} ${card.leadId ?? ''}`.toLowerCase();
      return hay.includes(q);
    }),
  );
}

/**
 * Pure mapper — master weather console payload → display model.
 */
export function toStaffWeatherReadViewModel(input: {
  readonly alerts: readonly EventWeatherAlertDTO[];
  readonly risks: readonly VenueOutdoorRiskDTO[];
  readonly forecasts: readonly WeatherForecastReadDTO[];
  readonly riskCounts?: Readonly<Record<WeatherRiskLevel, number>> | null;
  readonly audience?: Extract<WeatherVisibilityAudience, 'staff_seller' | 'staff_master'>;
  readonly riskFilter?: StaffWeatherRiskFilter;
  readonly searchQuery?: string;
}): StaffWeatherReadViewModel {
  const audience = input.audience ?? 'staff_master';
  const riskFilter = input.riskFilter ?? 'All';
  const searchQuery = input.searchQuery ?? '';

  const riskCounts = { ...emptyRiskCounts(), ...(input.riskCounts ?? {}) };
  if (!input.riskCounts) {
    for (const r of input.risks) {
      riskCounts[r.riskLevel] += 1;
    }
  }

  const allCards = input.alerts.map((alert) =>
    toStaffWeatherEventCard(
      alert,
      forecastForLead(input.forecasts, alert.leadId),
      riskForLead(input.risks, alert.leadId),
    ),
  );

  const cards = filterWeatherCards(allCards, riskFilter, searchQuery);

  return Object.freeze({
    audience,
    riskFilter,
    searchQuery,
    summary: Object.freeze({
      eventCount: input.alerts.length,
      riskCounts: Object.freeze({ ...riskCounts }),
      criticalCount: riskCounts.Critical,
      severeCount: riskCounts.Severe,
    }),
    cards,
  });
}
