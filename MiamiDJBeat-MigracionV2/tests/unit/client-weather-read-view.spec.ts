/**
 * MOD-103 Weather Slice — Client Event Weather Banner Read View tests.
 * READ-ONLY — no cancel / date-change / claim writers.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WeatherService } from '../../shared/services/weather/index';
import { LAB_CLIENT_EVENT_WEATHER } from '../../client/weather/client-weather-read-fixtures';
import {
  filterClientWeatherCards,
  toClientWeatherReadViewModel,
  toClientWeatherStatusChip,
} from '../../client/weather/client-weather-read-view-model';
import { renderClientWeatherReadView } from '../../client/weather/render-client-weather-read-view';
import {
  mountClientWeatherReadSlice,
  mountClientWeatherReadSliceSync,
} from '../../client/weather/mount-client-weather-read-slice';
import { renderClientDashboardMvp } from '../../client/render-client-dashboard-mvp';

describe('MOD-103 Weather — view model', () => {
  it('summarizes Clear / Manageable / Severe chips and sets severity banner', () => {
    const vm = toClientWeatherReadViewModel({
      alerts: LAB_CLIENT_EVENT_WEATHER.alerts,
      forecasts: LAB_CLIENT_EVENT_WEATHER.forecasts,
      risks: LAB_CLIENT_EVENT_WEATHER.risks,
    });
    expect(vm.summary.eventCount).toBe(LAB_CLIENT_EVENT_WEATHER.alerts.length);
    expect(vm.summary.severeContingencyCount).toBeGreaterThanOrEqual(1);
    expect(vm.summary.manageableCount).toBeGreaterThanOrEqual(1);
    expect(vm.summary.clearSafeCount).toBeGreaterThanOrEqual(1);
    expect(vm.banner?.statusChip).toBe('SevereContingency');
    expect(vm.banner?.riskLevel).toBe('Critical');
  });

  it('maps risk levels to status chips', () => {
    expect(toClientWeatherStatusChip('Low')).toBe('ClearSafe');
    expect(toClientWeatherStatusChip('Moderate')).toBe('ManageableRisk');
    expect(toClientWeatherStatusChip('Severe')).toBe('SevereContingency');
    expect(toClientWeatherStatusChip('Critical')).toBe('SevereContingency');
  });

  it('filters by status chip labels', () => {
    const all = toClientWeatherReadViewModel({
      alerts: LAB_CLIENT_EVENT_WEATHER.alerts,
      forecasts: LAB_CLIENT_EVENT_WEATHER.forecasts,
      risks: LAB_CLIENT_EVENT_WEATHER.risks,
    }).cards;
    expect(
      filterClientWeatherCards(all, 'Severe / Contingency Required').every(
        (c) => c.statusChip === 'SevereContingency',
      ),
    ).toBe(true);
    expect(
      filterClientWeatherCards(all, 'Manageable Risk').every(
        (c) => c.statusChip === 'ManageableRisk',
      ),
    ).toBe(true);
    expect(
      filterClientWeatherCards(all, 'Clear / Safe').every((c) => c.statusChip === 'ClearSafe'),
    ).toBe(true);
  });
});

describe('MOD-103 Weather — renderClientWeatherReadView', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('renders banner, summary, filters, and detail cards', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderClientWeatherReadView(host, {
      alerts: LAB_CLIENT_EVENT_WEATHER.alerts,
      forecasts: LAB_CLIENT_EVENT_WEATHER.forecasts,
      risks: LAB_CLIENT_EVENT_WEATHER.risks,
    });

    expect(host.querySelector('[data-mdj-component="ClientWeatherReadView"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-mod="MOD-103-WX"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-client-weather-section="banner"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-client-weather-section="summary"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-client-weather-section="filters"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-client-weather-section="cards"]')).not.toBeNull();
    expect(host.textContent).toContain('Event Weather & Outdoor Risk');
    expect(host.textContent).toMatch(/Plan B|Contingency|Clear \/ Safe/i);
  });

  it('Severe / Contingency Required filter narrows cards', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderClientWeatherReadView(host, {
      alerts: LAB_CLIENT_EVENT_WEATHER.alerts,
      forecasts: LAB_CLIENT_EVENT_WEATHER.forecasts,
      risks: LAB_CLIENT_EVENT_WEATHER.risks,
    });

    host
      .querySelector<HTMLButtonElement>(
        '[data-mdj-weather-filter="Severe / Contingency Required"]',
      )
      ?.click();
    const cards = host.querySelectorAll('[data-mdj-client-weather-section="cards"] [data-mdj-weather-status]');
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.getAttribute('data-mdj-weather-status')).toBe('SevereContingency');
    }
  });

  it('shows tent / relocate recommendations on severe contingency cards', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderClientWeatherReadView(
      host,
      {
        alerts: LAB_CLIENT_EVENT_WEATHER.alerts,
        forecasts: LAB_CLIENT_EVENT_WEATHER.forecasts,
        risks: LAB_CLIENT_EVENT_WEATHER.risks,
      },
      { initialFilter: 'Severe / Contingency Required' },
    );

    expect(host.querySelector('[data-mdj-advice-code="bring_tent_cover"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-advice-code="relocate_dj_booth"]')).not.toBeNull();
  });

  it('contains no cancel / date-change / claim writers', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderClientWeatherReadView(host, {
      alerts: LAB_CLIENT_EVENT_WEATHER.alerts,
      forecasts: LAB_CLIENT_EVENT_WEATHER.forecasts,
      risks: LAB_CLIENT_EVENT_WEATHER.risks,
    });

    expect(host.querySelectorAll('form, input, textarea, select, button[type="submit"]')).toHaveLength(
      0,
    );
    const text = host.textContent?.toLowerCase() ?? '';
    expect(text).not.toMatch(
      /\bcancel event\b|\bchange date\b|\brequest refund\b|\bfile a claim\b|\breschedule now\b/,
    );
    expect(host.querySelector('[data-mdj-action], [data-mdj-writer]')).toBeNull();
  });
});

describe('MOD-103 Weather — dashboard mount', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main data-mdj-shell-region="main"></main>';
  });

  it('sync mount places weather in client-weather slot', () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderClientDashboardMvp(main);

    expect(main.querySelector('[data-mdj-client-section="client-weather"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-component="ClientWeatherReadView"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-client-weather-host="mod-103-wx"]')).not.toBeNull();
  });

  it('async mount prefers WeatherService.fetchClientEventWeather', async () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderClientDashboardMvp(main);

    const liveAlerts = LAB_CLIENT_EVENT_WEATHER.alerts.filter((a) => a.riskLevel === 'Critical');
    const weatherService = {
      fetchClientEventWeather: vi.fn(async () =>
        Object.freeze({
          ok: true as const,
          status: 200,
          data: Object.freeze({
            alerts: liveAlerts,
            forecasts: LAB_CLIENT_EVENT_WEATHER.forecasts,
            risks: LAB_CLIENT_EVENT_WEATHER.risks.filter((r) => r.riskLevel === 'Critical'),
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

    const result = await mountClientWeatherReadSlice({
      mainRegion: main,
      weatherService,
      clientUserId: LAB_CLIENT_EVENT_WEATHER.clientUserId,
    });
    expect(result.source).toBe('service');
    expect(result.eventCount).toBe(liveAlerts.length);
  });

  it('async mount falls back to lab mock without service', async () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    mountClientWeatherReadSliceSync(main);
    renderClientDashboardMvp(main);

    const result = await mountClientWeatherReadSlice({ mainRegion: main });
    expect(result.source).toBe('mock');
    expect(result.eventCount).toBe(LAB_CLIENT_EVENT_WEATHER.alerts.length);
  });
});
