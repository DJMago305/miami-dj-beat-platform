/**
 * MOD-204 Weather Slice — Artist Gig Weather Radar Read View tests.
 * READ-ONLY — no cancel / relocate / reject writers.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WeatherService } from '../../shared/services/weather/index';
import { LAB_ARTIST_GIG_WEATHER } from '../../artist/weather/artist-weather-read-fixtures';
import {
  filterArtistWeatherCards,
  toArtistWeatherReadViewModel,
  toArtistWeatherRiskBucket,
} from '../../artist/weather/artist-weather-read-view-model';
import { renderArtistWeatherReadView } from '../../artist/weather/render-artist-weather-read-view';
import {
  mountArtistWeatherReadSlice,
  mountArtistWeatherReadSliceSync,
} from '../../artist/weather/mount-artist-weather-read-slice';
import { renderArtistDashboardMvp } from '../../artist/render-artist-dashboard-mvp';

describe('MOD-204 Weather — view model', () => {
  it('summarizes gig risk buckets', () => {
    const vm = toArtistWeatherReadViewModel({
      risks: LAB_ARTIST_GIG_WEATHER.risks,
      forecasts: LAB_ARTIST_GIG_WEATHER.forecasts,
      alerts: LAB_ARTIST_GIG_WEATHER.alerts,
    });
    expect(vm.summary.gigCount).toBe(LAB_ARTIST_GIG_WEATHER.risks.length);
    expect(vm.summary.outdoorHighRiskCount).toBeGreaterThanOrEqual(1);
    expect(vm.summary.manageableCount).toBeGreaterThanOrEqual(1);
    expect(vm.summary.safeIndoorCount).toBeGreaterThanOrEqual(1);
    expect(vm.cards.length).toBe(LAB_ARTIST_GIG_WEATHER.risks.length);
  });

  it('maps Critical/Severe to OutdoorHighRisk and Moderate to Manageable', () => {
    expect(toArtistWeatherRiskBucket('Critical', true)).toBe('OutdoorHighRisk');
    expect(toArtistWeatherRiskBucket('Severe', true)).toBe('OutdoorHighRisk');
    expect(toArtistWeatherRiskBucket('Moderate', true)).toBe('Manageable');
    expect(toArtistWeatherRiskBucket('Low', true)).toBe('SafeIndoor');
  });

  it('filters Outdoor High Risk / Manageable / Safe / Indoor', () => {
    const all = toArtistWeatherReadViewModel({
      risks: LAB_ARTIST_GIG_WEATHER.risks,
      forecasts: LAB_ARTIST_GIG_WEATHER.forecasts,
      alerts: LAB_ARTIST_GIG_WEATHER.alerts,
    }).cards;
    expect(
      filterArtistWeatherCards(all, 'Outdoor High Risk').every(
        (c) => c.riskBucket === 'OutdoorHighRisk',
      ),
    ).toBe(true);
    expect(
      filterArtistWeatherCards(all, 'Manageable').every((c) => c.riskBucket === 'Manageable'),
    ).toBe(true);
    expect(
      filterArtistWeatherCards(all, 'Safe / Indoor').every((c) => c.riskBucket === 'SafeIndoor'),
    ).toBe(true);
  });
});

describe('MOD-204 Weather — renderArtistWeatherReadView', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('renders summary, filters, cards with gear and wardrobe', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderArtistWeatherReadView(host, {
      risks: LAB_ARTIST_GIG_WEATHER.risks,
      forecasts: LAB_ARTIST_GIG_WEATHER.forecasts,
      alerts: LAB_ARTIST_GIG_WEATHER.alerts,
    });

    expect(host.querySelector('[data-mdj-component="ArtistWeatherReadView"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-mod="MOD-204-WX"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-artist-weather-section="summary"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-artist-weather-section="filters"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-artist-weather-section="cards"]')).not.toBeNull();
    expect(host.textContent).toContain('Gig Weather Radar');
    expect(host.textContent).toMatch(/Wardrobe|stage attire|waterproof|breathable/i);
  });

  it('Outdoor High Risk filter narrows cards (display-only)', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderArtistWeatherReadView(host, {
      risks: LAB_ARTIST_GIG_WEATHER.risks,
      forecasts: LAB_ARTIST_GIG_WEATHER.forecasts,
      alerts: LAB_ARTIST_GIG_WEATHER.alerts,
    });

    host
      .querySelector<HTMLButtonElement>('[data-mdj-weather-filter="Outdoor High Risk"]')
      ?.click();
    const cards = host.querySelectorAll('[data-mdj-weather-bucket]');
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.getAttribute('data-mdj-weather-bucket')).toBe('OutdoorHighRisk');
    }
  });

  it('shows relocate_dj_booth advice on critical storm gig', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderArtistWeatherReadView(
      host,
      {
        risks: LAB_ARTIST_GIG_WEATHER.risks,
        forecasts: LAB_ARTIST_GIG_WEATHER.forecasts,
        alerts: LAB_ARTIST_GIG_WEATHER.alerts,
      },
      { initialFilter: 'Outdoor High Risk' },
    );

    expect(host.querySelector('[data-mdj-advice-code="relocate_dj_booth"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-advice-code="protect_electronics"]')).not.toBeNull();
  });

  it('contains no cancel / relocate / reject writers', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderArtistWeatherReadView(host, {
      risks: LAB_ARTIST_GIG_WEATHER.risks,
      forecasts: LAB_ARTIST_GIG_WEATHER.forecasts,
      alerts: LAB_ARTIST_GIG_WEATHER.alerts,
    });

    expect(host.querySelectorAll('form, input, textarea, select, button[type="submit"]')).toHaveLength(
      0,
    );
    const text = host.textContent?.toLowerCase() ?? '';
    expect(text).not.toMatch(/\bcancel gig\b|\brequest relocate\b|\breject event\b|\bdecline show\b/);
    expect(host.querySelector('[data-mdj-action], [data-mdj-writer]')).toBeNull();
  });
});

describe('MOD-204 Weather — dashboard mount', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main data-mdj-shell-region="main"></main>';
  });

  it('sync mount places radar in artist-weather slot', () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderArtistDashboardMvp(main);

    expect(main.querySelector('[data-mdj-artist-section="artist-weather"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-component="ArtistWeatherReadView"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-artist-weather-host="mod-204-wx"]')).not.toBeNull();
  });

  it('async mount prefers WeatherService.fetchArtistGigWeather', async () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderArtistDashboardMvp(main);

    const liveRisks = LAB_ARTIST_GIG_WEATHER.risks.filter((r) => r.riskLevel === 'Critical');
    const weatherService = {
      fetchArtistGigWeather: vi.fn(async () =>
        Object.freeze({
          ok: true as const,
          status: 200,
          data: Object.freeze({
            risks: liveRisks,
            forecasts: LAB_ARTIST_GIG_WEATHER.forecasts,
            alerts: LAB_ARTIST_GIG_WEATHER.alerts.filter((a) => a.riskLevel === 'Critical'),
          }),
          metadata: Object.freeze({
            requestId: 't',
            correlationId: 'c',
            durationMs: 1,
            attempt: 1,
            context: Object.freeze({ requestId: 't', correlationId: 'c' }),
          }),
        }),
      ),
    } as unknown as WeatherService;

    const result = await mountArtistWeatherReadSlice({
      mainRegion: main,
      weatherService,
      artistUserId: LAB_ARTIST_GIG_WEATHER.artistUserId,
      artistProfileId: LAB_ARTIST_GIG_WEATHER.artistProfileId,
    });
    expect(result.source).toBe('service');
    expect(result.gigCount).toBe(liveRisks.length);
  });

  it('async mount falls back to lab mock without service', async () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    mountArtistWeatherReadSliceSync(main);
    renderArtistDashboardMvp(main);

    const result = await mountArtistWeatherReadSlice({ mainRegion: main });
    expect(result.source).toBe('mock');
    expect(result.gigCount).toBe(LAB_ARTIST_GIG_WEATHER.risks.length);
  });
});
