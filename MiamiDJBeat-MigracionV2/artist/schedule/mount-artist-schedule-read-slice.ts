/**
 * MOD-204 Slice 2 — mount Artist Schedule Read View into artist dashboard.
 * Lab default: LAB_ARTIST_SCHEDULE. Optional: BookingsService.fetchArtistSchedule.
 * Paso 4: session gate + assigned_dj_id scope for live reads.
 */

import type { BookingsService } from '../../shared/services/bookings/index';
import type {
  BookingSnapshotDTO,
  CalendarSlotDTO,
  EventDetailReadDTO,
} from '../../shared/types/bookings.types';
import { LAB_ARTIST_SCHEDULE } from './artist-schedule-read-fixtures';
import { renderArtistScheduleReadView } from './render-artist-schedule-read-view';
import {
  annotateArtistMountSourceLabel,
  artistDomainAccessAllowed,
  resolveArtistScopedUserId,
  type ArtistSessionWiringInjection,
} from '../session/artist-session-wiring-pilot';

export type MountArtistScheduleReadSliceInput = {
  readonly mainRegion: HTMLElement;
  readonly bookingsService?: BookingsService | null;
  readonly artistUserId?: string;
  readonly artistProfileId?: string | null;
  readonly sessionWiring?: ArtistSessionWiringInjection | null;
  readonly fallback?: {
    readonly bookings: readonly BookingSnapshotDTO[];
    readonly slots: readonly CalendarSlotDTO[];
    readonly detailsById?: Readonly<Record<string, EventDetailReadDTO>>;
  };
};

export type MountArtistScheduleReadSliceResult = {
  readonly ok: true;
  readonly source: 'service' | 'mock';
  readonly bookingCount: number;
  readonly scopedArtistUserId?: string;
};

function resolveSlot(mainRegion: HTMLElement): HTMLElement | null {
  return mainRegion.querySelector<HTMLElement>('[data-mdj-artist-section="artist-schedule"]');
}

function fillSlot(
  slot: HTMLElement,
  payload: {
    readonly bookings: readonly BookingSnapshotDTO[];
    readonly slots: readonly CalendarSlotDTO[];
    readonly detailsById?: Readonly<Record<string, EventDetailReadDTO>>;
    readonly sourceLabel: string;
  },
): void {
  const title = document.createElement('h2');
  title.className = 'mdj-shell-section-header';
  title.setAttribute('data-mdj-component', 'SectionHeader');
  title.textContent = 'My Schedule';

  const panel = document.createElement('div');
  panel.className = 'mdj-artist-schedule-read-host';
  panel.dataset.mdjArtistScheduleHost = 'mod-204-s2';

  slot.replaceChildren(title, panel);
  renderArtistScheduleReadView(
    panel,
    {
      bookings: payload.bookings,
      slots: payload.slots,
      detailsById: payload.detailsById,
    },
    { sourceLabel: payload.sourceLabel },
  );
}

export async function mountArtistScheduleReadSlice(
  input: MountArtistScheduleReadSliceInput,
): Promise<MountArtistScheduleReadSliceResult> {
  const slot = resolveSlot(input.mainRegion);
  if (!slot) {
    throw new Error('MOD-204-S2: artist-schedule section slot missing');
  }

  const fallback = input.fallback ?? LAB_ARTIST_SCHEDULE;
  let bookings = fallback.bookings;
  let slots = fallback.slots;
  let detailsById = fallback.detailsById;
  let source: 'service' | 'mock' = 'mock';
  const scopedArtistUserId = resolveArtistScopedUserId(
    input.sessionWiring,
    input.artistUserId,
    LAB_ARTIST_SCHEDULE.artistUserId,
  );

  if (input.bookingsService && artistDomainAccessAllowed(input.sessionWiring, 'bookings')) {
    try {
      const result = await input.bookingsService.fetchArtistSchedule({
        artistUserId: scopedArtistUserId,
        artistProfileId: input.artistProfileId ?? LAB_ARTIST_SCHEDULE.artistProfileId,
      });
      if (result.ok && result.data) {
        bookings = result.data.bookings;
        slots = result.data.slots;
        detailsById = undefined;
        source = 'service';
      }
    } catch {
      source = 'mock';
      bookings = fallback.bookings;
      slots = fallback.slots;
      detailsById = fallback.detailsById;
    }
  }

  fillSlot(slot, {
    bookings,
    slots,
    detailsById,
    sourceLabel: annotateArtistMountSourceLabel(
      source === 'service' ? 'live fetchArtistSchedule' : 'lab mock',
      input.sessionWiring,
      'bookings',
    ),
  });

  return Object.freeze({
    ok: true as const,
    source,
    bookingCount: bookings.length,
    scopedArtistUserId,
  });
}

export function mountArtistScheduleReadSliceSync(
  mainRegion: HTMLElement,
  fallback = LAB_ARTIST_SCHEDULE,
  sessionWiring?: ArtistSessionWiringInjection | null,
): void {
  const slot = resolveSlot(mainRegion);
  if (!slot) return;
  fillSlot(slot, {
    bookings: fallback.bookings,
    slots: fallback.slots,
    detailsById: fallback.detailsById,
    sourceLabel: annotateArtistMountSourceLabel('lab mock', sessionWiring, 'bookings'),
  });
}
