/**
 * MOD-204 Slice 2 — Artist Schedule Read View tests.
 * READ-ONLY — no accept/reject/edit/save controls.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingsService } from '../../shared/services/bookings/index';
import { LAB_ARTIST_SCHEDULE } from '../../artist/schedule/artist-schedule-read-fixtures';
import {
  filterArtistGigsByLifecycle,
  toArtistScheduleReadViewModel,
} from '../../artist/schedule/artist-schedule-read-view-model';
import { renderArtistScheduleReadView } from '../../artist/schedule/render-artist-schedule-read-view';
import {
  mountArtistScheduleReadSlice,
  mountArtistScheduleReadSliceSync,
} from '../../artist/schedule/mount-artist-schedule-read-slice';
import { renderArtistDashboardMvp } from '../../artist/render-artist-dashboard-mvp';

describe('MOD-204 Slice 2 — view model', () => {
  it('limits All filter to Confirmed/InProgress/Completed presentation gigs', () => {
    const vm = toArtistScheduleReadViewModel({
      bookings: LAB_ARTIST_SCHEDULE.bookings,
      slots: LAB_ARTIST_SCHEDULE.slots,
      detailsById: LAB_ARTIST_SCHEDULE.detailsById,
      filter: 'All',
    });
    expect(vm.upcomingCount).toBeGreaterThan(0);
    expect(
      vm.cards.every((c) =>
        ['Confirmed', 'InProgress', 'Completed'].includes(c.lifecycleStatus),
      ),
    ).toBe(true);
    expect(vm.cards.every((c) => c.contactIsolated)).toBe(true);
  });

  it('filters Confirmed only', () => {
    const confirmed = filterArtistGigsByLifecycle(LAB_ARTIST_SCHEDULE.bookings, 'Confirmed');
    expect(confirmed.every((b) => b.lifecycleStatus === 'Confirmed')).toBe(true);
  });
});

describe('MOD-204 Slice 2 — renderArtistScheduleReadView', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('renders summary, filters, cards, and slots', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderArtistScheduleReadView(host, {
      bookings: LAB_ARTIST_SCHEDULE.bookings,
      slots: LAB_ARTIST_SCHEDULE.slots,
      detailsById: LAB_ARTIST_SCHEDULE.detailsById,
    });

    expect(host.querySelector('[data-mdj-component="ArtistScheduleReadView"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-mod="MOD-204-S2"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-artist-schedule-section="filters"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-artist-schedule-section="cards"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-artist-schedule-section="slots"]')).not.toBeNull();
    expect(host.textContent).toContain('Client contact / billing PII filtered');
  });

  it('Confirmed filter narrows cards (display-only)', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderArtistScheduleReadView(host, {
      bookings: LAB_ARTIST_SCHEDULE.bookings,
      slots: LAB_ARTIST_SCHEDULE.slots,
      detailsById: LAB_ARTIST_SCHEDULE.detailsById,
    });

    host.querySelector<HTMLButtonElement>('[data-mdj-schedule-filter="Confirmed"]')?.click();
    const cards = host.querySelectorAll('[data-mdj-lifecycle]');
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.getAttribute('data-mdj-lifecycle')).toBe('Confirmed');
    }
  });

  it('contains no accept/reject/save/edit writers', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderArtistScheduleReadView(host, {
      bookings: LAB_ARTIST_SCHEDULE.bookings,
      slots: LAB_ARTIST_SCHEDULE.slots,
    });

    expect(host.querySelectorAll('form, input, textarea, select, button[type="submit"]')).toHaveLength(
      0,
    );
    const text = host.textContent?.toLowerCase() ?? '';
    expect(text).not.toMatch(/\baccept\b|\breject\b|\bsave\b|\bedit schedule\b/);
  });
});

describe('MOD-204 Slice 2 — dashboard mount', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main data-mdj-shell-region="main"></main>';
  });

  it('sync mount places schedule in artist-schedule slot', () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderArtistDashboardMvp(main);

    expect(main.querySelector('[data-mdj-artist-section="artist-schedule"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-component="ArtistScheduleReadView"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-artist-schedule-host="mod-204-s2"]')).not.toBeNull();
  });

  it('async mount prefers BookingsService.fetchArtistSchedule', async () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderArtistDashboardMvp(main);

    const liveBookings = LAB_ARTIST_SCHEDULE.bookings.filter(
      (b) => b.lifecycleStatus === 'Confirmed',
    );
    const bookingsService = {
      fetchArtistSchedule: vi.fn(async () =>
        Object.freeze({
          ok: true as const,
          status: 200,
          data: Object.freeze({
            bookings: liveBookings,
            slots: LAB_ARTIST_SCHEDULE.slots,
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

    const result = await mountArtistScheduleReadSlice({ mainRegion: main, bookingsService });
    expect(result.source).toBe('service');
    expect(result.bookingCount).toBe(liveBookings.length);
  });

  it('async mount falls back to lab mock without service', async () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    mountArtistScheduleReadSliceSync(main);
    renderArtistDashboardMvp(main);

    const result = await mountArtistScheduleReadSlice({ mainRegion: main });
    expect(result.source).toBe('mock');
    expect(result.bookingCount).toBe(LAB_ARTIST_SCHEDULE.bookings.length);
  });
});
