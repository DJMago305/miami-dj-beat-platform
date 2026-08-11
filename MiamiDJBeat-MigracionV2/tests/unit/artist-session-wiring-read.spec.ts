/**
 * MOD-204 Session Wiring Pilot — Artist portal read-only injection (Paso 4).
 * No login forms · no Auth writers · assigned_dj_id isolation.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MOCK_SW_ARTIST_USER_ID } from '../../shared/services/session-wiring/index';
import { renderArtistDashboardMvp } from '../../artist/render-artist-dashboard-mvp';
import {
  annotateArtistMountSourceLabel,
  artistDomainAccessAllowed,
  maskArtistDjId,
  renderArtistSessionWiringBadge,
  resolveArtistScopedUserId,
  resolveArtistSessionWiringPilot,
} from '../../artist/session/artist-session-wiring-pilot';
import { mountArtistProfileReadSlice } from '../../artist/profile/mount-artist-profile-read-slice';
import { mountArtistScheduleReadSlice } from '../../artist/schedule/mount-artist-schedule-read-slice';
import { mountArtistFinanceReadSlice } from '../../artist/finance/mount-artist-finance-read-slice';
import { mountArtistWeatherReadSlice } from '../../artist/weather/mount-artist-weather-read-slice';
import type { ProfilesService } from '../../shared/services/profiles/index';
import type { BookingsService } from '../../shared/services/bookings/index';
import type { FinancialService } from '../../shared/services/financial/index';
import type { WeatherService } from '../../shared/services/weather/index';

const REPO_ROOT = resolve(__dirname, '../..');
const MAIN_PATH = resolve(REPO_ROOT, 'artist/main.ts');

describe('MOD-204 SW — resolveArtistSessionWiringPilot', () => {
  it('injects ready artist session with domain reads allowed', () => {
    const injection = resolveArtistSessionWiringPilot('artist');
    expect(injection.context.sessionRole).toBe('artist');
    expect(injection.canReadArtistPortal).toBe(true);
    expect(injection.assignedDjUserId).toBe(MOCK_SW_ARTIST_USER_ID);
    expect(injection.maskedDjId).toBe(maskArtistDjId(MOCK_SW_ARTIST_USER_ID));
    expect(injection.maskedDjId).not.toBe(MOCK_SW_ARTIST_USER_ID);
    expect(injection.bearer.present).toBe(true);
    expect(injection.bearer.redactedPreview).not.toContain('def456uvw');
    for (const domain of ['profiles', 'bookings', 'financial', 'weather'] as const) {
      expect(artistDomainAccessAllowed(injection, domain)).toBe(true);
    }
  });

  it('gates anonymous, expired, and staff (wrong portal role)', () => {
    expect(resolveArtistSessionWiringPilot('anonymous').canReadArtistPortal).toBe(false);
    expect(resolveArtistSessionWiringPilot('expired').canReadArtistPortal).toBe(false);
    const staff = resolveArtistSessionWiringPilot('staff');
    expect(staff.canReadArtistPortal).toBe(false);
    expect(artistDomainAccessAllowed(staff, 'bookings')).toBe(false);
  });

  it('forces assigned_dj_id over caller override when ready', () => {
    const ok = resolveArtistSessionWiringPilot('artist');
    expect(
      resolveArtistScopedUserId(ok, 'other-dj-should-not-win', 'fallback-dj'),
    ).toBe(MOCK_SW_ARTIST_USER_ID);

    const gated = resolveArtistSessionWiringPilot('anonymous');
    expect(resolveArtistScopedUserId(gated, 'caller-dj', 'fallback-dj')).toBe('caller-dj');
  });

  it('annotates source labels for allowed vs gated domains', () => {
    const ok = resolveArtistSessionWiringPilot('artist');
    expect(annotateArtistMountSourceLabel('lab mock', ok, 'bookings')).toContain(
      'session-wiring pilot',
    );
    const gated = resolveArtistSessionWiringPilot('anonymous');
    expect(annotateArtistMountSourceLabel('lab mock', gated, 'bookings')).toContain(
      'session-gated',
    );
  });
});

describe('MOD-204 SW — badge UI (read-only)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('renders ARTIST role + masked DJ id without login controls', () => {
    const host = document.querySelector('#host') as HTMLElement;
    const injection = resolveArtistSessionWiringPilot('artist');
    renderArtistSessionWiringBadge(host, injection);

    const badge = host.querySelector('[data-mdj-component="ArtistSessionWiringBadge"]');
    expect(badge).toBeTruthy();
    expect(badge?.getAttribute('data-mdj-session-role')).toBe('artist');
    expect(badge?.getAttribute('data-mdj-session-ready')).toBe('1');
    expect(host.querySelector('[data-mdj-session-role-label]')?.textContent).toContain(
      'Active role: ARTIST',
    );
    expect(host.querySelector('[data-mdj-assigned-dj]')?.textContent).toContain(
      injection.maskedDjId,
    );
    expect(host.querySelector('[data-mdj-assigned-dj]')?.textContent).not.toContain(
      MOCK_SW_ARTIST_USER_ID,
    );
    expect(host.querySelector('form')).toBeNull();
    expect(host.querySelector('input')).toBeNull();
    expect(host.querySelector('button[type="submit"]')).toBeNull();
  });

  it('marks gated status for wrong-role staff pilot', () => {
    const host = document.querySelector('#host') as HTMLElement;
    renderArtistSessionWiringBadge(host, resolveArtistSessionWiringPilot('staff'));
    expect(
      host.querySelector('[data-mdj-component="ArtistSessionWiringBadge"]')?.getAttribute(
        'data-mdj-session-ready',
      ),
    ).toBe('0');
    expect(host.querySelector('[data-mdj-session-status="gated"]')).toBeTruthy();
  });
});

describe('MOD-204 SW — dashboard + domain mounts', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main data-mdj-shell-region="main"></main>';
  });

  it('injects session badge into artist dashboard when wiring provided', () => {
    const main = document.querySelector('main') as HTMLElement;
    const injection = resolveArtistSessionWiringPilot('artist');
    renderArtistDashboardMvp(main, injection);

    expect(main.querySelector('[data-mdj-artist-section="session-wiring"]')).toBeTruthy();
    expect(
      main.querySelector('[data-mdj-component="ArtistSessionWiringBadge"]'),
    ).toBeTruthy();
    expect(main.querySelector('[data-mdj-artist-section="artist-profile"]')).toBeTruthy();
    expect(main.querySelector('[data-mdj-artist-section="artist-schedule"]')).toBeTruthy();
    expect(main.querySelector('[data-mdj-artist-section="artist-wallet"]')).toBeTruthy();
    expect(main.querySelector('[data-mdj-artist-section="artist-weather"]')).toBeTruthy();
  });

  it('skips live ProfilesService when session is gated', async () => {
    const main = document.querySelector('main') as HTMLElement;
    renderArtistDashboardMvp(main);
    const fetchOwnArtistProfile = vi.fn();
    const gated = resolveArtistSessionWiringPilot('anonymous');

    const result = await mountArtistProfileReadSlice({
      mainRegion: main,
      profilesService: { fetchOwnArtistProfile } as unknown as ProfilesService,
      sessionWiring: gated,
    });

    expect(fetchOwnArtistProfile).not.toHaveBeenCalled();
    expect(result.source).toBe('mock');
  });

  it('scopes BookingsService to assigned_dj_id and ignores foreign override', async () => {
    const main = document.querySelector('main') as HTMLElement;
    renderArtistDashboardMvp(main);
    const fetchArtistSchedule = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'LAB', message: 'mock miss' },
    });
    const ok = resolveArtistSessionWiringPilot('artist');

    const result = await mountArtistScheduleReadSlice({
      mainRegion: main,
      bookingsService: { fetchArtistSchedule } as unknown as BookingsService,
      artistUserId: 'foreign-dj-id-must-not-be-used',
      sessionWiring: ok,
    });

    expect(fetchArtistSchedule).toHaveBeenCalledTimes(1);
    expect(fetchArtistSchedule.mock.calls[0]?.[0]?.artistUserId).toBe(MOCK_SW_ARTIST_USER_ID);
    expect(result.scopedArtistUserId).toBe(MOCK_SW_ARTIST_USER_ID);
  });

  it('skips live FinancialService and WeatherService when session is gated', async () => {
    const main = document.querySelector('main') as HTMLElement;
    renderArtistDashboardMvp(main);
    const fetchArtistWalletBalance = vi.fn();
    const fetchArtistGigWeather = vi.fn();
    const gated = resolveArtistSessionWiringPilot('expired');

    await mountArtistFinanceReadSlice({
      mainRegion: main,
      financialService: { fetchArtistWalletBalance } as unknown as FinancialService,
      sessionWiring: gated,
    });
    await mountArtistWeatherReadSlice({
      mainRegion: main,
      weatherService: { fetchArtistGigWeather } as unknown as WeatherService,
      sessionWiring: gated,
    });

    expect(fetchArtistWalletBalance).not.toHaveBeenCalled();
    expect(fetchArtistGigWeather).not.toHaveBeenCalled();
  });
});

describe('MOD-204 SW — main.ts wiring contract', () => {
  it('boots artist portal with resolveArtistSessionWiringPilot and injects into mounts', () => {
    const mainSource = readFileSync(MAIN_PATH, 'utf8');
    expect(mainSource).toContain('resolveArtistSessionWiringPilot');
    expect(mainSource).toContain('renderArtistDashboardMvp(mainRegion, sessionWiring, mutationsAdapter)');
    expect(mainSource).toContain('sessionWiring');
    expect(mainSource).toContain('createArtistMutationsAdapter');
    expect(mainSource).not.toMatch(/password|signInWithPassword|createUser/i);
  });
});
