/**
 * MOD-301 Weather Slice — Staff Weather Risk Console Read View tests.
 * READ-ONLY — no cancel / reschedule / mass-notify writers.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WeatherService } from '../../shared/services/weather/index';
import { LAB_STAFF_MASTER_WEATHER } from '../../staff/weather/staff-weather-read-fixtures';
import {
  filterWeatherCards,
  toStaffWeatherReadViewModel,
} from '../../staff/weather/staff-weather-read-view-model';
import { renderStaffWeatherReadView } from '../../staff/weather/render-staff-weather-read-view';
import {
  mountStaffWeatherReadSlice,
  mountStaffWeatherReadSliceSync,
} from '../../staff/weather/mount-staff-weather-read-slice';
import { getDefaultStaffDashboardDataProvider } from '../../staff/data/staff-dashboard-data-provider';
import { renderStaffDashboardMvp } from '../../staff/render-staff-dashboard-mvp';

describe('MOD-301 Weather — view model', () => {
  it('summarizes risk counts Low / Moderate / Severe / Critical', () => {
    const vm = toStaffWeatherReadViewModel({
      alerts: LAB_STAFF_MASTER_WEATHER.alerts,
      risks: LAB_STAFF_MASTER_WEATHER.risks,
      forecasts: LAB_STAFF_MASTER_WEATHER.forecasts,
      riskCounts: LAB_STAFF_MASTER_WEATHER.riskCounts,
      audience: 'staff_master',
    });
    expect(vm.summary.eventCount).toBe(LAB_STAFF_MASTER_WEATHER.alerts.length);
    expect(vm.summary.riskCounts.Critical).toBeGreaterThanOrEqual(1);
    expect(vm.summary.criticalCount).toBe(vm.summary.riskCounts.Critical);
    expect(vm.cards.length).toBe(LAB_STAFF_MASTER_WEATHER.alerts.length);
  });

  it('filters cards by Critical risk', () => {
    const vm = toStaffWeatherReadViewModel({
      alerts: LAB_STAFF_MASTER_WEATHER.alerts,
      risks: LAB_STAFF_MASTER_WEATHER.risks,
      forecasts: LAB_STAFF_MASTER_WEATHER.forecasts,
      riskFilter: 'Critical',
    });
    expect(vm.cards.length).toBeGreaterThan(0);
    expect(vm.cards.every((c) => c.riskLevel === 'Critical')).toBe(true);
  });

  it('searches by venue / event title', () => {
    const all = toStaffWeatherReadViewModel({
      alerts: LAB_STAFF_MASTER_WEATHER.alerts,
      risks: LAB_STAFF_MASTER_WEATHER.risks,
      forecasts: LAB_STAFF_MASTER_WEATHER.forecasts,
    }).cards;
    const filtered = filterWeatherCards(all, 'All', 'Brickell');
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((c) => /brickell/i.test(`${c.venueLabel} ${c.eventTitle}`))).toBe(true);
  });
});

describe('MOD-301 Weather — renderStaffWeatherReadView', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('renders summary, risk filters, search, and event cards', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderStaffWeatherReadView(host, {
      alerts: LAB_STAFF_MASTER_WEATHER.alerts,
      risks: LAB_STAFF_MASTER_WEATHER.risks,
      forecasts: LAB_STAFF_MASTER_WEATHER.forecasts,
      riskCounts: LAB_STAFF_MASTER_WEATHER.riskCounts,
      audience: 'staff_master',
    });

    expect(host.querySelector('[data-mdj-component="StaffWeatherReadView"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-mod="MOD-301-WX"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-staff-weather-section="summary"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-staff-weather-section="risk-filters"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-staff-weather-section="search"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-staff-weather-section="events"]')).not.toBeNull();
    expect(host.textContent).toContain('Weather Risk Console');
    expect(host.textContent).toContain('Critical');
  });

  it('Critical filter narrows event cards (display-only)', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderStaffWeatherReadView(host, {
      alerts: LAB_STAFF_MASTER_WEATHER.alerts,
      risks: LAB_STAFF_MASTER_WEATHER.risks,
      forecasts: LAB_STAFF_MASTER_WEATHER.forecasts,
      audience: 'staff_master',
    });

    host.querySelector<HTMLButtonElement>('[data-mdj-weather-risk-filter="Critical"]')?.click();
    const cards = host.querySelectorAll('[data-mdj-weather-risk]');
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.getAttribute('data-mdj-weather-risk')).toBe('Critical');
    }
  });

  it('search input filters by venue without writer controls', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderStaffWeatherReadView(host, {
      alerts: LAB_STAFF_MASTER_WEATHER.alerts,
      risks: LAB_STAFF_MASTER_WEATHER.risks,
      forecasts: LAB_STAFF_MASTER_WEATHER.forecasts,
      audience: 'staff_master',
    });

    const input = host.querySelector<HTMLInputElement>('[data-mdj-weather-search="1"]');
    expect(input).not.toBeNull();
    if (!input) return;
    input.value = 'Brickell';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    const cards = host.querySelectorAll('[data-mdj-weather-risk]');
    expect(cards.length).toBeGreaterThan(0);
    expect(host.textContent).toMatch(/Brickell/i);
  });

  it('contains no cancel / reschedule / notify writers', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderStaffWeatherReadView(host, {
      alerts: LAB_STAFF_MASTER_WEATHER.alerts,
      risks: LAB_STAFF_MASTER_WEATHER.risks,
      forecasts: LAB_STAFF_MASTER_WEATHER.forecasts,
      audience: 'staff_master',
    });

    expect(host.querySelectorAll('form, button[type="submit"], textarea, select')).toHaveLength(0);
    const text = host.textContent?.toLowerCase() ?? '';
    expect(text).not.toMatch(/\bcancel event\b|\breschedule now\b|\bnotify all\b|\bsend alert blast\b/);
    expect(host.querySelector('[data-mdj-action], [data-mdj-writer]')).toBeNull();
  });

  it('shows operational recommendations on critical cards', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderStaffWeatherReadView(host, {
      alerts: LAB_STAFF_MASTER_WEATHER.alerts,
      risks: LAB_STAFF_MASTER_WEATHER.risks,
      forecasts: LAB_STAFF_MASTER_WEATHER.forecasts,
      audience: 'staff_master',
      // filter via render options
    }, { initialRiskFilter: 'Critical' });

    expect(host.querySelector('[data-mdj-advice-code="relocate_dj_booth"]')).not.toBeNull();
  });
});

describe('MOD-301 Weather — dashboard mount', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main data-mdj-shell-region="main"></main>';
  });

  it('sync mount places console in master-weather slot', () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderStaffDashboardMvp(main, getDefaultStaffDashboardDataProvider());

    expect(main.querySelector('[data-mdj-staff-section="master-weather"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-component="StaffWeatherReadView"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-staff-weather-host="mod-301-wx"]')).not.toBeNull();
  });

  it('async mount prefers WeatherService.fetchMasterWeatherConsole', async () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderStaffDashboardMvp(main, getDefaultStaffDashboardDataProvider());

    const liveAlerts = LAB_STAFF_MASTER_WEATHER.alerts.filter((a) => a.riskLevel === 'Critical');
    const weatherService = {
      fetchMasterWeatherConsole: vi.fn(async () =>
        Object.freeze({
          ok: true as const,
          status: 200,
          data: Object.freeze({
            alerts: liveAlerts,
            risks: LAB_STAFF_MASTER_WEATHER.risks.filter((r) => r.riskLevel === 'Critical'),
            forecasts: LAB_STAFF_MASTER_WEATHER.forecasts,
            riskCounts: Object.freeze({
              Low: 0,
              Moderate: 0,
              Severe: 0,
              Critical: liveAlerts.length,
            }),
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

    const result = await mountStaffWeatherReadSlice({
      mainRegion: main,
      weatherService,
      audience: 'staff_master',
    });
    expect(result.source).toBe('service');
    expect(result.eventCount).toBe(liveAlerts.length);
  });

  it('async mount falls back to lab mock without service', async () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    mountStaffWeatherReadSliceSync(main);
    renderStaffDashboardMvp(main, getDefaultStaffDashboardDataProvider());

    const result = await mountStaffWeatherReadSlice({ mainRegion: main });
    expect(result.source).toBe('mock');
    expect(result.eventCount).toBe(LAB_STAFF_MASTER_WEATHER.alerts.length);
  });
});
