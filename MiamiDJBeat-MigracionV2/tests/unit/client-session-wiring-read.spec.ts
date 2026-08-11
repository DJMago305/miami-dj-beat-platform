/**
 * MOD-103 Session Wiring Pilot — Client portal read-only injection (Paso 5).
 * No login forms · no Auth writers · client_id isolation.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MOCK_SW_CLIENT_USER_ID } from '../../shared/services/session-wiring/index';
import { renderClientDashboardMvp } from '../../client/render-client-dashboard-mvp';
import {
  annotateClientMountSourceLabel,
  clientDomainAccessAllowed,
  maskClientUserId,
  renderClientSessionWiringBadge,
  resolveClientScopedUserId,
  resolveClientSessionWiringPilot,
} from '../../client/session/client-session-wiring-pilot';
import { mountClientProfileReadSlice } from '../../client/profile/mount-client-profile-read-slice';
import { mountClientBookingsReadSlice } from '../../client/bookings/mount-client-bookings-read-slice';
import { mountClientFinanceReadSlice } from '../../client/finance/mount-client-finance-read-slice';
import { mountClientWeatherReadSlice } from '../../client/weather/mount-client-weather-read-slice';
import type { ProfilesService } from '../../shared/services/profiles/index';
import type { BookingsService } from '../../shared/services/bookings/index';
import type { FinancialService } from '../../shared/services/financial/index';
import type { WeatherService } from '../../shared/services/weather/index';

const REPO_ROOT = resolve(__dirname, '../..');
const MAIN_PATH = resolve(REPO_ROOT, 'client/main.ts');

describe('MOD-103 SW — resolveClientSessionWiringPilot', () => {
  it('injects ready client session with domain reads allowed', () => {
    const injection = resolveClientSessionWiringPilot('client');
    expect(injection.context.sessionRole).toBe('client');
    expect(injection.canReadClientPortal).toBe(true);
    expect(injection.clientUserId).toBe(MOCK_SW_CLIENT_USER_ID);
    expect(injection.maskedClientId).toBe(maskClientUserId(MOCK_SW_CLIENT_USER_ID));
    expect(injection.maskedClientId).not.toBe(MOCK_SW_CLIENT_USER_ID);
    expect(injection.bearer.present).toBe(true);
    expect(injection.bearer.redactedPreview).not.toContain('abc123xyz');
    for (const domain of ['profiles', 'bookings', 'financial', 'weather'] as const) {
      expect(clientDomainAccessAllowed(injection, domain)).toBe(true);
    }
  });

  it('gates anonymous, expired, and artist (wrong portal role)', () => {
    expect(resolveClientSessionWiringPilot('anonymous').canReadClientPortal).toBe(false);
    expect(resolveClientSessionWiringPilot('expired').canReadClientPortal).toBe(false);
    const artist = resolveClientSessionWiringPilot('artist');
    expect(artist.canReadClientPortal).toBe(false);
    expect(clientDomainAccessAllowed(artist, 'bookings')).toBe(false);
  });

  it('forces client_id over caller override when ready', () => {
    const ok = resolveClientSessionWiringPilot('client');
    expect(
      resolveClientScopedUserId(ok, 'other-client-should-not-win', 'fallback-client'),
    ).toBe(MOCK_SW_CLIENT_USER_ID);

    const gated = resolveClientSessionWiringPilot('anonymous');
    expect(resolveClientScopedUserId(gated, 'caller-client', 'fallback-client')).toBe(
      'caller-client',
    );
  });

  it('annotates source labels for allowed vs gated domains', () => {
    const ok = resolveClientSessionWiringPilot('client');
    expect(annotateClientMountSourceLabel('lab mock', ok, 'bookings')).toContain(
      'session-wiring pilot',
    );
    const gated = resolveClientSessionWiringPilot('anonymous');
    expect(annotateClientMountSourceLabel('lab mock', gated, 'bookings')).toContain(
      'session-gated',
    );
  });
});

describe('MOD-103 SW — badge UI (read-only)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('renders CLIENT role + masked client id without login controls', () => {
    const host = document.querySelector('#host') as HTMLElement;
    const injection = resolveClientSessionWiringPilot('client');
    renderClientSessionWiringBadge(host, injection);

    const badge = host.querySelector('[data-mdj-component="ClientSessionWiringBadge"]');
    expect(badge).toBeTruthy();
    expect(badge?.getAttribute('data-mdj-session-role')).toBe('client');
    expect(badge?.getAttribute('data-mdj-session-ready')).toBe('1');
    expect(host.querySelector('[data-mdj-session-role-label]')?.textContent).toContain(
      'Active role: CLIENT',
    );
    expect(host.querySelector('[data-mdj-client-id]')?.textContent).toContain(
      injection.maskedClientId,
    );
    expect(host.querySelector('[data-mdj-client-id]')?.textContent).not.toContain(
      MOCK_SW_CLIENT_USER_ID,
    );
    expect(host.querySelector('form')).toBeNull();
    expect(host.querySelector('input')).toBeNull();
    expect(host.querySelector('button[type="submit"]')).toBeNull();
  });

  it('marks gated status for wrong-role artist pilot', () => {
    const host = document.querySelector('#host') as HTMLElement;
    renderClientSessionWiringBadge(host, resolveClientSessionWiringPilot('artist'));
    expect(
      host
        .querySelector('[data-mdj-component="ClientSessionWiringBadge"]')
        ?.getAttribute('data-mdj-session-ready'),
    ).toBe('0');
    expect(host.querySelector('[data-mdj-session-status="gated"]')).toBeTruthy();
  });
});

describe('MOD-103 SW — dashboard + domain mounts', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main data-mdj-shell-region="main"></main>';
  });

  it('injects session badge into client dashboard when wiring provided', () => {
    const main = document.querySelector('main') as HTMLElement;
    const injection = resolveClientSessionWiringPilot('client');
    renderClientDashboardMvp(main, injection);

    expect(main.querySelector('[data-mdj-client-section="session-wiring"]')).toBeTruthy();
    expect(
      main.querySelector('[data-mdj-component="ClientSessionWiringBadge"]'),
    ).toBeTruthy();
    expect(main.querySelector('[data-mdj-client-section="client-profile"]')).toBeTruthy();
    expect(main.querySelector('[data-mdj-client-section="client-bookings"]')).toBeTruthy();
    expect(main.querySelector('[data-mdj-client-section="client-payments"]')).toBeTruthy();
    expect(main.querySelector('[data-mdj-client-section="client-weather"]')).toBeTruthy();
  });

  it('skips live ProfilesService when session is gated', async () => {
    const main = document.querySelector('main') as HTMLElement;
    renderClientDashboardMvp(main);
    const fetchOwnClientProfile = vi.fn();
    const gated = resolveClientSessionWiringPilot('anonymous');

    const result = await mountClientProfileReadSlice({
      mainRegion: main,
      profilesService: { fetchOwnClientProfile } as unknown as ProfilesService,
      sessionWiring: gated,
    });

    expect(fetchOwnClientProfile).not.toHaveBeenCalled();
    expect(result.source).toBe('mock');
  });

  it('scopes BookingsService to client_id and ignores foreign override', async () => {
    const main = document.querySelector('main') as HTMLElement;
    renderClientDashboardMvp(main);
    const fetchOwnBookings = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'LAB', message: 'mock miss' },
    });
    const ok = resolveClientSessionWiringPilot('client');

    const result = await mountClientBookingsReadSlice({
      mainRegion: main,
      bookingsService: { fetchOwnBookings } as unknown as BookingsService,
      clientUserId: 'foreign-client-id-must-not-be-used',
      sessionWiring: ok,
    });

    expect(fetchOwnBookings).toHaveBeenCalledTimes(1);
    expect(fetchOwnBookings.mock.calls[0]?.[0]?.clientUserId).toBe(MOCK_SW_CLIENT_USER_ID);
    expect(result.scopedClientUserId).toBe(MOCK_SW_CLIENT_USER_ID);
  });

  it('skips live FinancialService and WeatherService when session is gated', async () => {
    const main = document.querySelector('main') as HTMLElement;
    renderClientDashboardMvp(main);
    const fetchOwnPaymentReceipts = vi.fn();
    const fetchClientEventWeather = vi.fn();
    const gated = resolveClientSessionWiringPilot('expired');

    await mountClientFinanceReadSlice({
      mainRegion: main,
      financialService: { fetchOwnPaymentReceipts } as unknown as FinancialService,
      sessionWiring: gated,
    });
    await mountClientWeatherReadSlice({
      mainRegion: main,
      weatherService: { fetchClientEventWeather } as unknown as WeatherService,
      sessionWiring: gated,
    });

    expect(fetchOwnPaymentReceipts).not.toHaveBeenCalled();
    expect(fetchClientEventWeather).not.toHaveBeenCalled();
  });
});

describe('MOD-103 SW — main.ts wiring contract', () => {
  it('boots client portal with resolveClientSessionWiringPilot and injects into mounts', () => {
    const mainSource = readFileSync(MAIN_PATH, 'utf8');
    expect(mainSource).toContain('resolveClientSessionWiringPilot');
    expect(mainSource).toContain('renderClientDashboardMvp(mainRegion, sessionWiring)');
    expect(mainSource).toContain('sessionWiring');
    expect(mainSource).not.toMatch(/password|signInWithPassword|createUser/i);
  });
});
