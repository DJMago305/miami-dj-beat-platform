/**
 * MOD-301 Slice 2 — Staff Master Calendar Read View tests.
 * READ-ONLY — filter chips only; no create/reassign/save/cancel controls.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingsService } from '../../shared/services/bookings/index';
import { LAB_STAFF_MASTER_SCHEDULE } from '../../staff/calendar/staff-calendar-read-fixtures';
import {
  filterBookingsByLifecycle,
  toStaffCalendarReadViewModel,
} from '../../staff/calendar/staff-calendar-read-view-model';
import { renderStaffCalendarReadView } from '../../staff/calendar/render-staff-calendar-read-view';
import {
  mountStaffCalendarReadSlice,
  mountStaffCalendarReadSliceSync,
} from '../../staff/calendar/mount-staff-calendar-read-slice';
import { getDefaultStaffDashboardDataProvider } from '../../staff/data/staff-dashboard-data-provider';
import { renderStaffDashboardMvp } from '../../staff/render-staff-dashboard-mvp';

describe('MOD-301 Slice 2 — view model', () => {
  it('summarizes lifecycle counts and assignment', () => {
    const vm = toStaffCalendarReadViewModel({
      bookings: LAB_STAFF_MASTER_SCHEDULE.bookings,
      slots: LAB_STAFF_MASTER_SCHEDULE.slots,
      detailsById: LAB_STAFF_MASTER_SCHEDULE.detailsById,
      audience: 'staff_full',
    });
    expect(vm.summary.totalBookings).toBe(LAB_STAFF_MASTER_SCHEDULE.bookings.length);
    expect(vm.summary.byStatus.Draft).toBeGreaterThan(0);
    expect(vm.summary.byStatus.Confirmed).toBeGreaterThan(0);
    expect(vm.cards.length).toBe(vm.summary.totalBookings);
  });

  it('filters by Confirmed lifecycle', () => {
    const confirmed = filterBookingsByLifecycle(LAB_STAFF_MASTER_SCHEDULE.bookings, 'Confirmed');
    expect(confirmed.every((b) => b.lifecycleStatus === 'Confirmed')).toBe(true);
    const vm = toStaffCalendarReadViewModel({
      bookings: LAB_STAFF_MASTER_SCHEDULE.bookings,
      slots: LAB_STAFF_MASTER_SCHEDULE.slots,
      filter: 'Confirmed',
      audience: 'staff_full',
      detailsById: LAB_STAFF_MASTER_SCHEDULE.detailsById,
    });
    expect(vm.cards.every((c) => c.lifecycleStatus === 'Confirmed')).toBe(true);
  });

  it('isolates contact PII for staff_seller audience', () => {
    const vm = toStaffCalendarReadViewModel({
      bookings: LAB_STAFF_MASTER_SCHEDULE.bookings,
      slots: LAB_STAFF_MASTER_SCHEDULE.slots,
      detailsById: LAB_STAFF_MASTER_SCHEDULE.detailsById,
      audience: 'staff_seller',
      filter: 'Confirmed',
    });
    expect(vm.cards.length).toBeGreaterThan(0);
    expect(vm.cards.every((c) => c.contactEmail === null && c.contactPhone === null)).toBe(true);
    expect(vm.cards.every((c) => c.piiIsolated)).toBe(true);
  });
});

describe('MOD-301 Slice 2 — renderStaffCalendarReadView', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('renders summary, filters, cards, and slots sections', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderStaffCalendarReadView(host, {
      bookings: LAB_STAFF_MASTER_SCHEDULE.bookings,
      slots: LAB_STAFF_MASTER_SCHEDULE.slots,
      detailsById: LAB_STAFF_MASTER_SCHEDULE.detailsById,
      audience: 'staff_full',
    });

    const root = host.querySelector('[data-mdj-component="StaffCalendarReadView"]');
    expect(root).not.toBeNull();
    expect(root?.getAttribute('data-mdj-mod')).toBe('MOD-301-S2');
    expect(host.querySelector('[data-mdj-staff-calendar-section="summary"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-staff-calendar-section="filters"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-staff-calendar-section="cards"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-staff-calendar-section="slots"]')).not.toBeNull();
    expect(host.querySelectorAll('[data-mdj-calendar-filter]').length).toBe(6);
  });

  it('filter chip Confirmed narrows visible cards (display-only)', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderStaffCalendarReadView(host, {
      bookings: LAB_STAFF_MASTER_SCHEDULE.bookings,
      slots: LAB_STAFF_MASTER_SCHEDULE.slots,
      detailsById: LAB_STAFF_MASTER_SCHEDULE.detailsById,
      audience: 'staff_full',
    });

    const confirmedBtn = host.querySelector<HTMLButtonElement>(
      '[data-mdj-calendar-filter="Confirmed"]',
    );
    expect(confirmedBtn).not.toBeNull();
    confirmedBtn?.click();

    const cards = host.querySelectorAll('[data-mdj-lifecycle]');
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.getAttribute('data-mdj-lifecycle')).toBe('Confirmed');
    }
  });

  it('contains no form/submit/save/create/cancel writers', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderStaffCalendarReadView(host, {
      bookings: LAB_STAFF_MASTER_SCHEDULE.bookings,
      slots: LAB_STAFF_MASTER_SCHEDULE.slots,
      audience: 'staff_full',
    });

    expect(host.querySelectorAll('form')).toHaveLength(0);
    expect(host.querySelectorAll('input, textarea, select')).toHaveLength(0);
    expect(host.querySelectorAll('button[type="submit"]')).toHaveLength(0);
    const text = host.textContent?.toLowerCase() ?? '';
    expect(text).not.toMatch(/\bcreate event\b|\breassign\b|\bsave\b|\bcancel reservation\b/);
  });
});

describe('MOD-301 Slice 2 — dashboard mount', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main data-mdj-shell-region="main"></main>';
  });

  it('sync mount places calendar in master-calendar slot', () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderStaffDashboardMvp(main, getDefaultStaffDashboardDataProvider());

    expect(main.querySelector('[data-mdj-staff-section="master-calendar"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-component="StaffCalendarReadView"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-staff-calendar-host="mod-301-s2"]')).not.toBeNull();
  });

  it('async mount prefers BookingsService.fetchMasterSchedule', async () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderStaffDashboardMvp(main, getDefaultStaffDashboardDataProvider());

    const liveBookings = LAB_STAFF_MASTER_SCHEDULE.bookings.filter(
      (b) => b.lifecycleStatus === 'Confirmed',
    );
    const bookingsService = {
      fetchMasterSchedule: vi.fn(async () =>
        Object.freeze({
          ok: true as const,
          status: 200,
          data: Object.freeze({
            bookings: liveBookings,
            slots: LAB_STAFF_MASTER_SCHEDULE.slots.slice(0, liveBookings.length),
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
    } as unknown as BookingsService;

    const result = await mountStaffCalendarReadSlice({
      mainRegion: main,
      bookingsService,
      audience: 'staff_full',
    });
    expect(result.source).toBe('service');
    expect(result.bookingCount).toBe(liveBookings.length);
    expect(main.textContent).toContain('Master Schedule');
  });

  it('async mount falls back to lab mock without service', async () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    mountStaffCalendarReadSliceSync(main);
    renderStaffDashboardMvp(main, getDefaultStaffDashboardDataProvider());

    const result = await mountStaffCalendarReadSlice({ mainRegion: main });
    expect(result.source).toBe('mock');
    expect(result.bookingCount).toBe(LAB_STAFF_MASTER_SCHEDULE.bookings.length);
  });
});
