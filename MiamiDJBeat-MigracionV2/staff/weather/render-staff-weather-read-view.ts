/**
 * MOD-301 Weather Slice — Staff Weather Risk Console Read View (DOM).
 * READ-ONLY — risk filter chips + venue/event search only.
 * No cancel / reschedule / mass-notify writers.
 */

import type {
  EventWeatherAlertDTO,
  VenueOutdoorRiskDTO,
  WeatherForecastReadDTO,
  WeatherRiskLevel,
  WeatherVisibilityAudience,
} from '../../shared/types/weather.types';
import {
  STAFF_WEATHER_RISK_FILTERS,
  toStaffWeatherReadViewModel,
  type StaffWeatherReadViewModel,
  type StaffWeatherRiskFilter,
} from './staff-weather-read-view-model';

export type StaffWeatherReadViewData = {
  readonly alerts: readonly EventWeatherAlertDTO[];
  readonly risks: readonly VenueOutdoorRiskDTO[];
  readonly forecasts: readonly WeatherForecastReadDTO[];
  readonly riskCounts?: Readonly<Record<WeatherRiskLevel, number>> | null;
  readonly audience?: Extract<WeatherVisibilityAudience, 'staff_seller' | 'staff_master'>;
};

export type RenderStaffWeatherReadViewOptions = {
  readonly sourceLabel?: string;
  readonly initialRiskFilter?: StaffWeatherRiskFilter;
  readonly initialSearchQuery?: string;
};

function createSummaryChip(label: string, value: string): HTMLElement {
  const chip = document.createElement('div');
  chip.className = 'mdj-staff-weather-read__summary-chip';
  const k = document.createElement('span');
  k.className = 'mdj-staff-weather-read__summary-label';
  k.textContent = label;
  const v = document.createElement('strong');
  v.className = 'mdj-staff-weather-read__summary-value';
  v.textContent = value;
  chip.append(k, v);
  return chip;
}

function renderSummary(vm: StaffWeatherReadViewModel): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-staff-weather-read__summary';
  section.dataset.mdjStaffWeatherSection = 'summary';
  section.append(
    createSummaryChip('Events', String(vm.summary.eventCount)),
    createSummaryChip('Critical', String(vm.summary.riskCounts.Critical)),
    createSummaryChip('Severe', String(vm.summary.riskCounts.Severe)),
    createSummaryChip('Moderate', String(vm.summary.riskCounts.Moderate)),
    createSummaryChip('Low', String(vm.summary.riskCounts.Low)),
  );
  return section;
}

function renderRiskFilters(
  active: StaffWeatherRiskFilter,
  onPick: (next: StaffWeatherRiskFilter) => void,
): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'mdj-staff-weather-read__filters';
  bar.dataset.mdjStaffWeatherSection = 'risk-filters';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Filter by weather risk level');

  for (const value of STAFF_WEATHER_RISK_FILTERS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `mdj-staff-weather-read__filter${value === active ? ' is-active' : ''}`;
    btn.setAttribute('data-mdj-weather-risk-filter', value);
    btn.textContent = value;
    btn.setAttribute('aria-pressed', value === active ? 'true' : 'false');
    btn.addEventListener('click', () => onPick(value));
    bar.append(btn);
  }
  return bar;
}

function renderSearch(
  query: string,
  onChange: (next: string) => void,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'mdj-staff-weather-read__search';
  wrap.dataset.mdjStaffWeatherSection = 'search';

  const label = document.createElement('label');
  label.className = 'mdj-staff-weather-read__search-label';
  label.htmlFor = 'mdj-staff-weather-search';
  label.textContent = 'Search event / venue';

  const input = document.createElement('input');
  input.type = 'search';
  input.id = 'mdj-staff-weather-search';
  input.className = 'mdj-staff-weather-read__search-input';
  input.dataset.mdjWeatherSearch = '1';
  input.setAttribute('role', 'searchbox');
  input.setAttribute('aria-label', 'Search monitored events by title or venue');
  input.placeholder = 'Event or venue…';
  input.value = query;
  input.autocomplete = 'off';
  input.addEventListener('input', () => onChange(input.value));

  wrap.append(label, input);
  return wrap;
}

function renderCard(card: StaffWeatherReadViewModel['cards'][number]): HTMLElement {
  const article = document.createElement('article');
  article.className = 'mdj-staff-weather-read__event-card';
  article.dataset.mdjAlertId = card.alertId;
  article.dataset.mdjWeatherRisk = card.riskLevel;
  if (card.leadId) article.dataset.mdjLeadId = card.leadId;

  const title = document.createElement('h3');
  title.className = 'mdj-staff-weather-read__event-title';
  title.textContent = card.eventTitle;

  const badge = document.createElement('span');
  badge.className = `mdj-staff-weather-read__badge mdj-staff-weather-read__badge--${card.riskLevel}`;
  badge.textContent = card.riskLevel;

  const meta = document.createElement('dl');
  meta.className = 'mdj-staff-weather-read__meta';
  const pairs: readonly [string, string][] = [
    ['Venue', card.venueLabel],
    ['Date', card.eventDate],
    ['Condition', card.conditionLabel],
    ['Temp', card.tempLabel],
    ['Precip', card.precipLabel],
    ['Wind', card.windLabel],
    ['Drivers', card.driversLabel],
    ['Summary', card.forecastSummary],
  ];
  for (const [label, value] of pairs) {
    const pair = document.createElement('div');
    pair.className = 'mdj-staff-weather-read__pair';
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    pair.append(dt, dd);
    meta.append(pair);
  }

  const advice = document.createElement('ul');
  advice.className = 'mdj-staff-weather-read__advice';
  advice.dataset.mdjStaffWeatherSection = 'advice';
  if (card.recommendations.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No operational recommendations.';
    advice.append(li);
  } else {
    for (const rec of card.recommendations) {
      const li = document.createElement('li');
      li.dataset.mdjAdviceCode = rec.code;
      li.textContent = rec.message;
      advice.append(li);
    }
  }

  const note = document.createElement('p');
  note.className = 'mdj-staff-weather-read__note';
  note.textContent =
    'Read-only weather risk — cancel / reschedule / notify actions are not available in this slice.';

  article.append(title, badge, meta, advice, note);
  return article;
}

function renderCards(vm: StaffWeatherReadViewModel): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-staff-weather-read__events';
  section.dataset.mdjStaffWeatherSection = 'events';

  if (vm.cards.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'mdj-staff-weather-read__empty';
    empty.textContent = 'No monitored events for this risk filter / search.';
    section.append(empty);
    return section;
  }

  for (const card of vm.cards) section.append(renderCard(card));
  return section;
}

export function renderStaffWeatherReadView(
  container: HTMLElement,
  data: StaffWeatherReadViewData,
  options?: RenderStaffWeatherReadViewOptions,
): StaffWeatherReadViewModel {
  const sourceLabel = options?.sourceLabel ?? 'fetchMasterWeatherConsole';
  let riskFilter: StaffWeatherRiskFilter = options?.initialRiskFilter ?? 'All';
  let searchQuery = options?.initialSearchQuery ?? '';

  const root = document.createElement('article');
  root.className = 'mdj-staff-weather-read';
  root.dataset.mdjComponent = 'StaffWeatherReadView';
  root.dataset.mdjMod = 'MOD-301-WX';
  root.setAttribute('aria-label', 'Staff weather risk console read view');

  const paint = (): StaffWeatherReadViewModel => {
    const vm = toStaffWeatherReadViewModel({
      alerts: data.alerts,
      risks: data.risks,
      forecasts: data.forecasts,
      riskCounts: data.riskCounts,
      audience: data.audience ?? 'staff_master',
      riskFilter,
      searchQuery,
    });

    const eyebrow = document.createElement('p');
    eyebrow.className = 'mdj-staff-weather-read__eyebrow';
    eyebrow.textContent = `MOD-301 Weather · Risk console · ${sourceLabel} · audience ${vm.audience}`;

    const heading = document.createElement('h2');
    heading.className = 'mdj-staff-weather-read__title';
    heading.textContent = 'Weather Risk Console';

    root.replaceChildren(
      eyebrow,
      heading,
      renderSummary(vm),
      renderRiskFilters(riskFilter, (next) => {
        riskFilter = next;
        paint();
      }),
      renderSearch(searchQuery, (next) => {
        searchQuery = next;
        paint();
      }),
      renderCards(vm),
    );

    // Strip writer surfaces; keep filter-only search input.
    for (const el of root.querySelectorAll('form, button[type="submit"], textarea, select')) {
      el.remove();
    }

    return vm;
  };

  container.replaceChildren(root);
  return paint();
}
