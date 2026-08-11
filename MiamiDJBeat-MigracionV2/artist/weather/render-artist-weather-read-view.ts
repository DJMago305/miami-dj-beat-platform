/**
 * MOD-204 Weather Slice — Artist Gig Weather Radar Read View (DOM).
 * READ-ONLY — filter chips only; no cancel / relocate / reject forms.
 */

import type {
  EventWeatherAlertDTO,
  VenueOutdoorRiskDTO,
  WeatherForecastReadDTO,
} from '../../shared/types/weather.types';
import {
  ARTIST_WEATHER_VIEW_FILTERS,
  toArtistWeatherReadViewModel,
  type ArtistWeatherReadViewModel,
  type ArtistWeatherViewFilter,
} from './artist-weather-read-view-model';

export type ArtistWeatherReadViewData = {
  readonly risks: readonly VenueOutdoorRiskDTO[];
  readonly forecasts: readonly WeatherForecastReadDTO[];
  readonly alerts?: readonly EventWeatherAlertDTO[];
};

export type RenderArtistWeatherReadViewOptions = {
  readonly sourceLabel?: string;
  readonly initialFilter?: ArtistWeatherViewFilter;
};

function renderSummary(vm: ArtistWeatherReadViewModel): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-artist-weather-read__summary';
  section.dataset.mdjArtistWeatherSection = 'summary';

  const chips: readonly [string, string][] = [
    ['Gigs', String(vm.summary.gigCount)],
    ['Outdoor high risk', String(vm.summary.outdoorHighRiskCount)],
    ['Manageable', String(vm.summary.manageableCount)],
    ['Safe / indoor', String(vm.summary.safeIndoorCount)],
    ['Critical', String(vm.summary.criticalCount)],
  ];

  for (const [label, value] of chips) {
    const chip = document.createElement('div');
    chip.className = 'mdj-artist-weather-read__summary-chip';
    const k = document.createElement('span');
    k.className = 'mdj-artist-weather-read__summary-label';
    k.textContent = label;
    const v = document.createElement('strong');
    v.className = 'mdj-artist-weather-read__summary-value';
    v.textContent = value;
    chip.append(k, v);
    section.append(chip);
  }
  return section;
}

function renderFilters(
  active: ArtistWeatherViewFilter,
  onFilter: (next: ArtistWeatherViewFilter) => void,
): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'mdj-artist-weather-read__filters';
  bar.dataset.mdjArtistWeatherSection = 'filters';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Filter gig weather by risk band');

  for (const status of ARTIST_WEATHER_VIEW_FILTERS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `mdj-artist-weather-read__filter${status === active ? ' is-active' : ''}`;
    btn.dataset.mdjWeatherFilter = status;
    btn.textContent = status;
    btn.setAttribute('aria-pressed', status === active ? 'true' : 'false');
    btn.addEventListener('click', () => onFilter(status));
    bar.append(btn);
  }
  return bar;
}

function renderCard(card: ArtistWeatherReadViewModel['cards'][number]): HTMLElement {
  const article = document.createElement('article');
  article.className = 'mdj-artist-weather-read__card';
  article.dataset.mdjRiskId = card.riskId;
  article.dataset.mdjWeatherRisk = card.riskLevel;
  article.dataset.mdjWeatherBucket = card.riskBucket;
  if (card.leadId) article.dataset.mdjLeadId = card.leadId;

  const title = document.createElement('h3');
  title.className = 'mdj-artist-weather-read__card-title';
  title.textContent = card.eventTitle;

  const badge = document.createElement('span');
  badge.className = `mdj-artist-weather-read__badge mdj-artist-weather-read__badge--${card.riskLevel}`;
  badge.textContent = card.riskLevel;

  const meta = document.createElement('dl');
  meta.className = 'mdj-artist-weather-read__meta';
  const pairs: readonly [string, string][] = [
    ['Venue', card.venueLabel],
    ['Date', card.eventDate],
    ['Condition', card.conditionLabel],
    ['Temp', card.tempLabel],
    ['Rain chance', card.precipLabel],
    ['Wind', card.windLabel],
    ['Drivers', card.driversLabel],
    ['Summary', card.forecastSummary],
    ['Wardrobe', card.wardrobeHint],
  ];
  for (const [label, value] of pairs) {
    const row = document.createElement('div');
    row.className = 'mdj-artist-weather-read__row';
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    row.append(dt, dd);
    meta.append(row);
  }

  const gear = document.createElement('ul');
  gear.className = 'mdj-artist-weather-read__gear';
  gear.dataset.mdjArtistWeatherSection = 'gear';
  if (card.gearAdvice.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No gear contingencies listed.';
    gear.append(li);
  } else {
    for (const advice of card.gearAdvice) {
      const li = document.createElement('li');
      li.dataset.mdjAdviceCode = advice.code;
      li.textContent = advice.message;
      gear.append(li);
    }
  }

  const note = document.createElement('p');
  note.className = 'mdj-artist-weather-read__note';
  note.textContent =
    'Read-only gig weather — cancel, relocate, or reject actions are not available in this slice.';

  article.append(title, badge, meta, gear, note);
  return article;
}

function renderCards(vm: ArtistWeatherReadViewModel): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-artist-weather-read__cards';
  section.dataset.mdjArtistWeatherSection = 'cards';

  if (vm.cards.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'mdj-artist-weather-read__empty';
    empty.textContent = 'No gigs for this weather filter.';
    section.append(empty);
    return section;
  }

  for (const card of vm.cards) section.append(renderCard(card));
  return section;
}

export function renderArtistWeatherReadView(
  container: HTMLElement,
  data: ArtistWeatherReadViewData,
  options?: RenderArtistWeatherReadViewOptions,
): ArtistWeatherReadViewModel {
  const sourceLabel = options?.sourceLabel ?? 'fetchArtistGigWeather';
  let filter: ArtistWeatherViewFilter = options?.initialFilter ?? 'All';

  const root = document.createElement('article');
  root.className = 'mdj-artist-weather-read';
  root.dataset.mdjComponent = 'ArtistWeatherReadView';
  root.dataset.mdjMod = 'MOD-204-WX';
  root.setAttribute('aria-label', 'Artist gig weather radar read view');

  const paint = (): ArtistWeatherReadViewModel => {
    const vm = toArtistWeatherReadViewModel({
      risks: data.risks,
      forecasts: data.forecasts,
      alerts: data.alerts,
      filter,
    });

    const eyebrow = document.createElement('p');
    eyebrow.className = 'mdj-artist-weather-read__eyebrow';
    eyebrow.textContent = `MOD-204 Weather · Gig weather radar · ${sourceLabel}`;

    const heading = document.createElement('h2');
    heading.className = 'mdj-artist-weather-read__title';
    heading.textContent = 'Gig Weather Radar';

    root.replaceChildren(
      eyebrow,
      heading,
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
