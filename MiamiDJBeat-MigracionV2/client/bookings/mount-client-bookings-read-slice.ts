/**
 * MOD-103 Slice 2 — mount Client Bookings Read View into client dashboard.
 * Lab default: LAB_CLIENT_BOOKINGS. Optional: BookingsService.fetchOwnBookings.
 * Paso 5: session gate + client_id scope for live reads.
 */

import type { BookingsService } from '../../shared/services/bookings/index';
import type { BookingSnapshotDTO, EventDetailReadDTO } from '../../shared/types/bookings.types';
import { LAB_CLIENT_BOOKINGS } from './client-bookings-read-fixtures';
import { renderClientBookingsReadView } from './render-client-bookings-read-view';
import {
  annotateClientMountSourceLabel,
  clientDomainAccessAllowed,
  resolveClientScopedUserId,
  type ClientSessionWiringInjection,
} from '../session/client-session-wiring-pilot';

export type MountClientBookingsReadSliceInput = {
  readonly mainRegion: HTMLElement;
  readonly bookingsService?: BookingsService | null;
  readonly clientUserId?: string;
  readonly sessionWiring?: ClientSessionWiringInjection | null;
  readonly fallback?: {
    readonly bookings: readonly BookingSnapshotDTO[];
    readonly detailsById?: Readonly<Record<string, EventDetailReadDTO>>;
  };
};

export type MountClientBookingsReadSliceResult = {
  readonly ok: true;
  readonly source: 'service' | 'mock';
  readonly bookingCount: number;
  readonly scopedClientUserId?: string;
};

function resolveSlot(mainRegion: HTMLElement): HTMLElement | null {
  return mainRegion.querySelector<HTMLElement>('[data-mdj-client-section="client-bookings"]');
}

function fillSlot(
  slot: HTMLElement,
  payload: {
    readonly bookings: readonly BookingSnapshotDTO[];
    readonly detailsById?: Readonly<Record<string, EventDetailReadDTO>>;
    readonly sourceLabel: string;
  },
): void {
  const title = document.createElement('h2');
  title.className = 'mdj-shell-section-header';
  title.setAttribute('data-mdj-component', 'SectionHeader');
  title.textContent = 'My Bookings';

  const panel = document.createElement('div');
  panel.className = 'mdj-client-bookings-read-host';
  panel.dataset.mdjClientBookingsHost = 'mod-103-s2';

  slot.replaceChildren(title, panel);
  renderClientBookingsReadView(
    panel,
    {
      bookings: payload.bookings,
      detailsById: payload.detailsById,
    },
    { sourceLabel: payload.sourceLabel },
  );
}

export async function mountClientBookingsReadSlice(
  input: MountClientBookingsReadSliceInput,
): Promise<MountClientBookingsReadSliceResult> {
  const slot = resolveSlot(input.mainRegion);
  if (!slot) {
    throw new Error('MOD-103-S2: client-bookings section slot missing');
  }

  const fallback = input.fallback ?? LAB_CLIENT_BOOKINGS;
  let bookings = fallback.bookings;
  let detailsById = fallback.detailsById;
  let source: 'service' | 'mock' = 'mock';
  const scopedClientUserId = resolveClientScopedUserId(
    input.sessionWiring,
    input.clientUserId,
    LAB_CLIENT_BOOKINGS.clientUserId,
  );

  if (input.bookingsService && clientDomainAccessAllowed(input.sessionWiring, 'bookings')) {
    try {
      const result = await input.bookingsService.fetchOwnBookings({
        clientUserId: scopedClientUserId,
      });
      if (result.ok && result.data) {
        bookings = result.data.bookings;
        detailsById = undefined;
        source = 'service';
      }
    } catch {
      source = 'mock';
      bookings = fallback.bookings;
      detailsById = fallback.detailsById;
    }
  }

  fillSlot(slot, {
    bookings,
    detailsById,
    sourceLabel: annotateClientMountSourceLabel(
      source === 'service' ? 'live fetchOwnBookings' : 'lab mock',
      input.sessionWiring,
      'bookings',
    ),
  });

  return Object.freeze({
    ok: true as const,
    source,
    bookingCount: bookings.length,
    scopedClientUserId,
  });
}

export function mountClientBookingsReadSliceSync(
  mainRegion: HTMLElement,
  fallback = LAB_CLIENT_BOOKINGS,
  sessionWiring?: ClientSessionWiringInjection | null,
): void {
  const slot = resolveSlot(mainRegion);
  if (!slot) return;
  fillSlot(slot, {
    bookings: fallback.bookings,
    detailsById: fallback.detailsById,
    sourceLabel: annotateClientMountSourceLabel('lab mock', sessionWiring, 'bookings'),
  });
}
