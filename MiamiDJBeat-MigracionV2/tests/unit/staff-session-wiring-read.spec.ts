/**
 * MOD-301 Session Wiring Pilot — Staff portal read-only injection (Paso 3).
 * No login forms · no Auth writers · no DB mutation.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDefaultStaffDashboardDataProvider } from '../../staff/data/staff-dashboard-data-provider';
import { renderStaffDashboardMvp } from '../../staff/render-staff-dashboard-mvp';
import {
  annotateStaffMountSourceLabel,
  renderStaffSessionWiringBadge,
  resolveStaffSessionWiringPilot,
  staffDomainAccessAllowed,
} from '../../staff/session/staff-session-wiring-pilot';
import { mountStaffIdentityReadSlice } from '../../staff/identity/mount-staff-identity-read-slice';
import { mountStaffCalendarReadSlice } from '../../staff/calendar/mount-staff-calendar-read-slice';
import { mountStaffFinanceReadSlice } from '../../staff/finance/mount-staff-finance-read-slice';
import { mountStaffWeatherReadSlice } from '../../staff/weather/mount-staff-weather-read-slice';
import type { ProfilesService } from '../../shared/services/profiles/index';
import type { BookingsService } from '../../shared/services/bookings/index';
import type { FinancialService } from '../../shared/services/financial/index';
import type { WeatherService } from '../../shared/services/weather/index';

const REPO_ROOT = resolve(__dirname, '../..');
const MAIN_PATH = resolve(REPO_ROOT, 'staff/main.ts');

describe('MOD-301 SW — resolveStaffSessionWiringPilot', () => {
  it('injects ready staff session with domain reads allowed', () => {
    const injection = resolveStaffSessionWiringPilot('staff');
    expect(injection.context.sessionRole).toBe('staff');
    expect(injection.canReadStaffPortal).toBe(true);
    expect(injection.bearer.present).toBe(true);
    expect(injection.bearer.redactedPreview).toMatch(/^Bearer /);
    expect(injection.bearer.redactedPreview).not.toContain('ghi789rst');
    for (const domain of ['profiles', 'bookings', 'financial', 'weather'] as const) {
      expect(staffDomainAccessAllowed(injection, domain)).toBe(true);
      expect(injection.domainAccess[domain].allowed).toBe(true);
    }
  });

  it('injects staff_seller variant with portal read ready', () => {
    const injection = resolveStaffSessionWiringPilot('staff_seller');
    expect(injection.context.sessionRole).toBe('staff_seller');
    expect(injection.canReadStaffPortal).toBe(true);
    expect(staffDomainAccessAllowed(injection, 'financial')).toBe(true);
  });

  it('gates anonymous and expired variants', () => {
    const anon = resolveStaffSessionWiringPilot('anonymous');
    expect(anon.canReadStaffPortal).toBe(false);
    expect(staffDomainAccessAllowed(anon, 'profiles')).toBe(false);

    const expired = resolveStaffSessionWiringPilot('expired');
    expect(expired.canReadStaffPortal).toBe(false);
    expect(staffDomainAccessAllowed(expired, 'weather')).toBe(false);
  });

  it('annotates source labels for allowed vs gated domains', () => {
    const ok = resolveStaffSessionWiringPilot('staff');
    expect(annotateStaffMountSourceLabel('lab mock', ok, 'bookings')).toContain(
      'session-wiring pilot',
    );

    const gated = resolveStaffSessionWiringPilot('anonymous');
    expect(annotateStaffMountSourceLabel('lab mock', gated, 'bookings')).toContain(
      'session-gated',
    );
  });
});

describe('MOD-301 SW — badge UI (read-only)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('renders role + redacted bearer without login/password controls', () => {
    const host = document.querySelector('#host') as HTMLElement;
    const injection = resolveStaffSessionWiringPilot('staff');
    renderStaffSessionWiringBadge(host, injection);

    const badge = host.querySelector('[data-mdj-component="StaffSessionWiringBadge"]');
    expect(badge).toBeTruthy();
    expect(badge?.getAttribute('data-mdj-session-role')).toBe('staff');
    expect(badge?.getAttribute('data-mdj-session-ready')).toBe('1');
    expect(host.querySelector('[data-mdj-session-role-label]')?.textContent).toContain(
      'Active role: staff',
    );
    expect(host.querySelector('[data-mdj-bearer-preview]')?.textContent).toMatch(/^Bearer:/);
    expect(host.querySelector('[data-mdj-bearer-preview]')?.textContent).not.toContain(
      'ghi789rst',
    );
    expect(host.querySelectorAll('[data-mdj-session-domains] [data-mdj-domain]').length).toBe(4);
    expect(host.querySelector('form')).toBeNull();
    expect(host.querySelector('input')).toBeNull();
    expect(host.querySelector('button[type="submit"]')).toBeNull();
  });

  it('marks gated status for anonymous pilot', () => {
    const host = document.querySelector('#host') as HTMLElement;
    renderStaffSessionWiringBadge(host, resolveStaffSessionWiringPilot('anonymous'));
    const badge = host.querySelector('[data-mdj-component="StaffSessionWiringBadge"]');
    expect(badge?.getAttribute('data-mdj-session-ready')).toBe('0');
    expect(host.querySelector('[data-mdj-session-status="gated"]')).toBeTruthy();
  });
});

describe('MOD-301 SW — dashboard + domain mounts', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main data-mdj-shell-region="main"></main>';
  });

  it('injects session badge into staff dashboard when wiring provided', () => {
    const main = document.querySelector('main') as HTMLElement;
    const injection = resolveStaffSessionWiringPilot('staff');
    renderStaffDashboardMvp(main, getDefaultStaffDashboardDataProvider(), injection);

    expect(main.querySelector('[data-mdj-staff-section="session-wiring"]')).toBeTruthy();
    expect(
      main.querySelector('[data-mdj-component="StaffSessionWiringBadge"]'),
    ).toBeTruthy();
    expect(main.querySelector('[data-mdj-staff-section="staff-profile"]')).toBeTruthy();
    expect(main.querySelector('[data-mdj-staff-section="master-calendar"]')).toBeTruthy();
    expect(main.querySelector('[data-mdj-staff-section="master-finance"]')).toBeTruthy();
    expect(main.querySelector('[data-mdj-staff-section="master-weather"]')).toBeTruthy();
  });

  it('skips live ProfilesService when session is gated', async () => {
    const main = document.querySelector('main') as HTMLElement;
    renderStaffDashboardMvp(main, getDefaultStaffDashboardDataProvider());
    const fetchOwnAccessSnapshot = vi.fn();
    const profilesService = { fetchOwnAccessSnapshot } as unknown as ProfilesService;
    const gated = resolveStaffSessionWiringPilot('anonymous');

    const result = await mountStaffIdentityReadSlice({
      mainRegion: main,
      profilesService,
      sessionWiring: gated,
    });

    expect(fetchOwnAccessSnapshot).not.toHaveBeenCalled();
    expect(result.source).toBe('mock');
    expect(
      main.querySelector('[data-mdj-staff-identity-host]')?.textContent ?? '',
    ).toMatch(/session-gated/i);
  });

  it('skips live BookingsService when session is gated', async () => {
    const main = document.querySelector('main') as HTMLElement;
    renderStaffDashboardMvp(main, getDefaultStaffDashboardDataProvider());
    const fetchMasterSchedule = vi.fn();
    const bookingsService = { fetchMasterSchedule } as unknown as BookingsService;
    const gated = resolveStaffSessionWiringPilot('expired');

    const result = await mountStaffCalendarReadSlice({
      mainRegion: main,
      bookingsService,
      sessionWiring: gated,
    });

    expect(fetchMasterSchedule).not.toHaveBeenCalled();
    expect(result.source).toBe('mock');
  });

  it('skips live FinancialService and WeatherService when session is gated', async () => {
    const main = document.querySelector('main') as HTMLElement;
    renderStaffDashboardMvp(main, getDefaultStaffDashboardDataProvider());
    const fetchMasterFinancialLedger = vi.fn();
    const fetchMasterWeatherConsole = vi.fn();
    const gated = resolveStaffSessionWiringPilot('anonymous');

    await mountStaffFinanceReadSlice({
      mainRegion: main,
      financialService: { fetchMasterFinancialLedger } as unknown as FinancialService,
      sessionWiring: gated,
    });
    await mountStaffWeatherReadSlice({
      mainRegion: main,
      weatherService: { fetchMasterWeatherConsole } as unknown as WeatherService,
      sessionWiring: gated,
    });

    expect(fetchMasterFinancialLedger).not.toHaveBeenCalled();
    expect(fetchMasterWeatherConsole).not.toHaveBeenCalled();
  });
});

describe('MOD-301 SW — main.ts wiring contract', () => {
  it('boots staff portal with resolveStaffSessionWiringPilot and injects into mounts', () => {
    const mainSource = readFileSync(MAIN_PATH, 'utf8');
    expect(mainSource).toContain('resolveStaffSessionWiringPilot');
    expect(mainSource).toContain(
      'renderStaffDashboardMvp(mainRegion, staffDataProvider, sessionWiring, mutationsAdapter)',
    );
    expect(mainSource).toContain('sessionWiring');
    expect(mainSource).not.toMatch(/password|signInWithPassword|createUser/i);
  });
});
