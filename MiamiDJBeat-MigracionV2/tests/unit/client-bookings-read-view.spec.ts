/**
 * MOD-103 Slice 2 — Client Bookings Read View tests.
 * READ-ONLY — no cancel/pay/edit controls.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingsService } from '../../shared/services/bookings/index';
import { LAB_CLIENT_BOOKINGS } from '../../client/bookings/client-bookings-read-fixtures';
import {
  filterClientBookingsByLifecycle,
  lifecycleDisplayLabel,
  toClientBookingsReadViewModel,
} from '../../client/bookings/client-bookings-read-view-model';
import { renderClientBookingsReadView } from '../../client/bookings/render-client-bookings-read-view';
import {
  mountClientBookingsReadSlice,
  mountClientBookingsReadSliceSync,
} from '../../client/bookings/mount-client-bookings-read-slice';
import { renderClientDashboardMvp } from '../../client/render-client-dashboard-mvp';

describe('MOD-103 Slice 2 — view model', () => {
  it('maps Draft label as Draft / Requested and counts own bookings', () => {
    expect(lifecycleDisplayLabel('Draft')).toBe('Draft / Requested');
    const vm = toClientBookingsReadViewModel({
      bookings: LAB_CLIENT_BOOKINGS.bookings,
      detailsById: LAB_CLIENT_BOOKINGS.detailsById,
    });
    expect(vm.totalCount).toBe(LAB_CLIENT_BOOKINGS.bookings.length);
    expect(vm.cards.length).toBe(vm.totalCount);
    expect(vm.cards.some((c) => c.lifecycleLabel === 'Draft / Requested')).toBe(true);
  });

  it('filters Confirmed only', () => {
    const confirmed = filterClientBookingsByLifecycle(LAB_CLIENT_BOOKINGS.bookings, 'Confirmed');
    expect(confirmed.every((b) => b.lifecycleStatus === 'Confirmed')).toBe(true);
  });
});

describe('MOD-103 Slice 2 — renderClientBookingsReadView', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('renders summary, filters, and cards', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderClientBookingsReadView(host, {
      bookings: LAB_CLIENT_BOOKINGS.bookings,
      detailsById: LAB_CLIENT_BOOKINGS.detailsById,
    });

    expect(host.querySelector('[data-mdj-component="ClientBookingsReadView"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-mod="MOD-103-S2"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-client-bookings-section="filters"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-client-bookings-section="cards"]')).not.toBeNull();
    expect(host.textContent).toContain('My Reservations & Event Flow');
  });

  it('Confirmed filter narrows cards (display-only)', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderClientBookingsReadView(host, {
      bookings: LAB_CLIENT_BOOKINGS.bookings,
      detailsById: LAB_CLIENT_BOOKINGS.detailsById,
    });

    host.querySelector<HTMLButtonElement>('[data-mdj-bookings-filter="Confirmed"]')?.click();
    const cards = host.querySelectorAll('[data-mdj-lifecycle]');
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.getAttribute('data-mdj-lifecycle')).toBe('Confirmed');
    }
  });

  it('contains no cancel/pay/edit writers', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderClientBookingsReadView(host, { bookings: LAB_CLIENT_BOOKINGS.bookings });

    expect(host.querySelectorAll('form, input, textarea, select, button[type="submit"]')).toHaveLength(
      0,
    );
    const text = host.textContent?.toLowerCase() ?? '';
    expect(text).not.toMatch(/\bcancel booking\b|\bpay now\b|\bedit event\b/);
  });
});

describe('MOD-103 Slice 2 — dashboard mount', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main data-mdj-shell-region="main"></main>';
  });

  it('sync mount places bookings in client-bookings slot', () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderClientDashboardMvp(main);

    expect(main.querySelector('[data-mdj-client-section="client-bookings"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-component="ClientBookingsReadView"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-client-bookings-host="mod-103-s2"]')).not.toBeNull();
  });

  it('async mount prefers BookingsService.fetchOwnBookings', async () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderClientDashboardMvp(main);

    const live = LAB_CLIENT_BOOKINGS.bookings.filter((b) => b.lifecycleStatus === 'Confirmed');
    const bookingsService = {
      fetchOwnBookings: vi.fn(async () =>
        Object.freeze({
          ok: true as const,
          status: 200,
          data: Object.freeze({ bookings: live }),
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

    const result = await mountClientBookingsReadSlice({ mainRegion: main, bookingsService });
    expect(result.source).toBe('service');
    expect(result.bookingCount).toBe(live.length);
  });

  it('async mount falls back to lab mock without service', async () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    mountClientBookingsReadSliceSync(main);
    renderClientDashboardMvp(main);

    const result = await mountClientBookingsReadSlice({ mainRegion: main });
    expect(result.source).toBe('mock');
    expect(result.bookingCount).toBe(LAB_CLIENT_BOOKINGS.bookings.length);
  });
});
