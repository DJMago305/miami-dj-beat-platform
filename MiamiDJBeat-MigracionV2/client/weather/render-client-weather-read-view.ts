/**
 * MOD-103 Weather Slice — Client Event Weather Banner Read View (DOM).
 * READ-ONLY — status chips only; no cancel / reschedule / claim forms.
 */

import type {
  EventWeatherAlertDTO,
  VenueOutdoorRiskDTO,
  WeatherForecastReadDTO,
} from '../../shared/types/weather.types';
import {
  CLIENT_WEATHER_STATUS_FILTERS,
  toClientWeatherReadViewModel,
  type ClientWeatherReadViewModel,
  type ClientWeatherStatusFilter,
} from './client-weather-read-view-model';

export type ClientWeatherReadViewData = {
  readonly alerts: readonly EventWeatherAlertDTO[];
  readonly forecasts: readonly WeatherForecastReadDTO[];
  readonly risks?: readonly VenueOutdoorRiskDTO[];
};

export type RenderClientWeatherReadViewOptions = {
  readonly sourceLabel?: string;
  readonly initialFilter?: ClientWeatherStatusFilter;
};

function renderBanner(vm: ClientWeatherReadViewModel): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-client-weather-read__banner';
  section.dataset.mdjClientWeatherSection = 'banner';

  if (!vm.banner) {
    const empty = document.createElement('p');
    empty.className = 'mdj-client-weather-read__empty';
    empty.textContent = 'No weather alerts for your contracted events.';
    section.append(empty);
    return section;
  }

  const chip = document.createElement('span');
  chip.className = `mdj-client-weather-read__status mdj-client-weather-read__status--${vm.banner.statusChip}`;
  chip.dataset.mdjWeatherStatus = vm.banner.statusChip;
  chip.textContent = vm.banner.statusLabel;

  const title = document.createElement('h3');
  title.className = 'mdj-client-weather-read__banner-title';
  title.textContent = vm.banner.eventTitle;

  const detail = document.createElement('p');
  detail.className = 'mdj-client-weather-read__banner-detail';
  detail.textContent = `${vm.banner.venueLabel} · ${vm.banner.eventDate} · ${vm.banner.conditionLabel} · outdoor risk ${vm.banner.outdoorRiskLabel}`;

  const planB = document.createElement('p');
  planB.className = 'mdj-client-weather-read__plan-b';
  planB.textContent = vm.banner.planBHint;

  section.append(chip, title, detail, planB);
  return section;
}

function renderSummary(vm: ClientWeatherReadViewModel): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-client-weather-read__summary';
  section.dataset.mdjClientWeatherSection = 'summary';

  const chips: readonly [string, string][] = [
    ['Events', String(vm.summary.eventCount)],
    ['Clear / Safe', String(vm.summary.clearSafeCount)],
    ['Manageable', String(vm.summary.manageableCount)],
    ['Severe / Contingency', String(vm.summary.severeContingencyCount)],
  ];

  for (const [label, value] of chips) {
    const el = document.createElement('div');
    el.className = 'mdj-client-weather-read__summary-chip';
    const k = document.createElement('span');
    k.className = 'mdj-client-weather-read__summary-label';
    k.textContent = label;
    const v = document.createElement('strong');
    v.className = 'mdj-client-weather-read__summary-value';
    v.textContent = value;
    el.append(k, v);
    section.append(el);
  }
  return section;
}

function renderFilters(
  active: ClientWeatherStatusFilter,
  onFilter: (next: ClientWeatherStatusFilter) => void,
): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'mdj-client-weather-read__filters';
  bar.dataset.mdjClientWeatherSection = 'filters';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Filter event weather by status chip');

  for (const status of CLIENT_WEATHER_STATUS_FILTERS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `mdj-client-weather-read__filter${status === active ? ' is-active' : ''}`;
    btn.dataset.mdjWeatherFilter = status;
    btn.textContent = status;
    btn.setAttribute('aria-pressed', status === active ? 'true' : 'false');
    btn.addEventListener('click', () => onFilter(status));
    bar.append(btn);
  }
  return bar;
}

function renderCard(card: ClientWeatherReadViewModel['cards'][number]): HTMLElement {
  const article = document.createElement('article');
  article.className = 'mdj-client-weather-read__card';
  article.dataset.mdjAlertId = card.alertId;
  article.dataset.mdjWeatherRisk = card.riskLevel;
  article.dataset.mdjWeatherStatus = card.statusChip;
  if (card.leadId) article.dataset.mdjLeadId = card.leadId;

  const title = document.createElement('h3');
  title.className = 'mdj-client-weather-read__card-title';
  title.textContent = card.eventTitle;

  const badge = document.createElement('span');
  badge.className = `mdj-client-weather-read__status mdj-client-weather-read__status--${card.statusChip}`;
  badge.textContent = card.statusLabel;

  const meta = document.createElement('dl');
  meta.className = 'mdj-client-weather-read__meta';
  const pairs: readonly [string, string][] = [
    ['Venue', card.venueLabel],
    ['Date', card.eventDate],
    ['Forecast', card.conditionLabel],
    ['Temp', card.tempLabel],
    ['Rain chance', card.precipLabel],
    ['Wind', card.windLabel],
    ['Outdoor risk', card.outdoorRiskLabel],
    ['Summary', card.forecastSummary],
    ['Plan B', card.planBHint],
  ];
  for (const [label, value] of pairs) {
    const row = document.createElement('div');
    row.className = 'mdj-client-weather-read__row';
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    row.append(dt, dd);
    meta.append(row);
  }

  const advice = document.createElement('ul');
  advice.className = 'mdj-client-weather-read__advice';
  advice.dataset.mdjClientWeatherSection = 'advice';
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
  note.className = 'mdj-client-weather-read__note';
  note.textContent =
    'Read-only event weather — cancel, date change, and claim actions are not available in this slice.';

  article.append(title, badge, meta, advice, note);
  return article;
}

function renderCards(vm: ClientWeatherReadViewModel): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-client-weather-read__cards';
  section.dataset.mdjClientWeatherSection = 'cards';

  if (vm.cards.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'mdj-client-weather-read__empty';
    empty.textContent = 'No events for this weather status filter.';
    section.append(empty);
    return section;
  }

  for (const card of vm.cards) section.append(renderCard(card));
  return section;
}

export function renderClientWeatherReadView(
  container: HTMLElement,
  data: ClientWeatherReadViewData,
  options?: RenderClientWeatherReadViewOptions,
): ClientWeatherReadViewModel {
  const sourceLabel = options?.sourceLabel ?? 'fetchClientEventWeather';
  let filter: ClientWeatherStatusFilter = options?.initialFilter ?? 'All';

  const root = document.createElement('article');
  root.className = 'mdj-client-weather-read';
  root.dataset.mdjComponent = 'ClientWeatherReadView';
  root.dataset.mdjMod = 'MOD-103-WX';
  root.setAttribute('aria-label', 'Client event weather alert read view');

  const paint = (): ClientWeatherReadViewModel => {
    const vm = toClientWeatherReadViewModel({
      alerts: data.alerts,
      forecasts: data.forecasts,
      risks: data.risks,
      filter,
    });

    const eyebrow = document.createElement('p');
    eyebrow.className = 'mdj-client-weather-read__eyebrow';
    eyebrow.textContent = `MOD-103 Weather · Event weather alerts · ${sourceLabel}`;

    const heading = document.createElement('h2');
    heading.className = 'mdj-client-weather-read__title';
    heading.textContent = 'Event Weather & Outdoor Risk';

    root.replaceChildren(
      eyebrow,
      heading,
      renderBanner(vm),
      renderSummary(vm),
      renderFilters(filter, (next) => {
        filter = next;
        paint();
      }),
      renderCards(vm),
    );

    for (const el of root.querySelectorAll('form, button[type="submit"], input, textarea, select')) {
      el.remove();
    }

    return vm;
  };

  container.replaceChildren(root);
  return paint();
}
