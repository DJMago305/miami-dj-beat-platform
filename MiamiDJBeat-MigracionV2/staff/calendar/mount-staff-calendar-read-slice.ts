/**
 * MOD-301 Slice 2 — mount Staff Master Calendar into staff dashboard.
 * Lab default: LAB_STAFF_MASTER_SCHEDULE. Optional: BookingsService.fetchMasterSchedule.
 */

import type { BookingsService } from '../../shared/services/bookings/index';
import type {
  BookingSnapshotDTO,
  BookingVisibilityAudience,
  CalendarSlotDTO,
  EventDetailReadDTO,
} from '../../shared/types/bookings.types';
import { LAB_STAFF_MASTER_SCHEDULE } from './staff-calendar-read-fixtures';
import { renderStaffCalendarReadView } from './render-staff-calendar-read-view';
import {
  annotateStaffMountSourceLabel,
  staffDomainAccessAllowed,
  type StaffSessionWiringInjection,
} from '../session/staff-session-wiring-pilot';

export type MountStaffCalendarReadSliceInput = {
  readonly mainRegion: HTMLElement;
  readonly bookingsService?: BookingsService | null;
  readonly audience?: Extract<BookingVisibilityAudience, 'staff_seller' | 'staff_full'>;
  readonly sessionWiring?: StaffSessionWiringInjection | null;
  readonly fallback?: {
    readonly bookings: readonly BookingSnapshotDTO[];
    readonly slots: readonly CalendarSlotDTO[];
    readonly detailsById?: Readonly<Record<string, EventDetailReadDTO>>;
  };
};

export type MountStaffCalendarReadSliceResult = {
  readonly ok: true;
  readonly source: 'service' | 'mock';
  readonly bookingCount: number;
};

function resolveSlot(mainRegion: HTMLElement): HTMLElement | null {
  return mainRegion.querySelector<HTMLElement>('[data-mdj-staff-section="master-calendar"]');
}

function fillSlot(
  slot: HTMLElement,
  payload: {
    readonly bookings: readonly BookingSnapshotDTO[];
    readonly slots: readonly CalendarSlotDTO[];
    readonly detailsById?: Readonly<Record<string, EventDetailReadDTO>>;
    readonly audience: BookingVisibilityAudience;
    readonly sourceLabel: string;
  },
): void {
  const title = document.createElement('h2');
  title.className = 'mdj-shell-section-header';
  title.setAttribute('data-mdj-component', 'SectionHeader');
  title.textContent = 'Master Calendar';

  const panel = document.createElement('div');
  panel.className = 'mdj-staff-calendar-read-host';
  panel.dataset.mdjStaffCalendarHost = 'mod-301-s2';

  slot.replaceChildren(title, panel);
  renderStaffCalendarReadView(
    panel,
    {
      bookings: payload.bookings,
      slots: payload.slots,
      detailsById: payload.detailsById,
      audience: payload.audience,
    },
    { sourceLabel: payload.sourceLabel },
  );
}

export async function mountStaffCalendarReadSlice(
  input: MountStaffCalendarReadSliceInput,
): Promise<MountStaffCalendarReadSliceResult> {
  const slot = resolveSlot(input.mainRegion);
  if (!slot) {
    throw new Error('MOD-301-S2: master-calendar section slot missing');
  }

  const audience =
    input.audience ??
    (input.sessionWiring?.context.sessionRole === 'staff_seller' ? 'staff_seller' : 'staff_full');
  const fallback = input.fallback ?? LAB_STAFF_MASTER_SCHEDULE;
  let bookings = fallback.bookings;
  let slots = fallback.slots;
  let detailsById = fallback.detailsById;
  let source: 'service' | 'mock' = 'mock';

  if (input.bookingsService && staffDomainAccessAllowed(input.sessionWiring, 'bookings')) {
    try {
      const result = await input.bookingsService.fetchMasterSchedule({ audience });
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
    audience,
    sourceLabel: annotateStaffMountSourceLabel(
      source === 'service' ? 'live fetchMasterSchedule' : 'lab mock',
      input.sessionWiring,
      'bookings',
    ),
  });

  return Object.freeze({ ok: true as const, source, bookingCount: bookings.length });
}

export function mountStaffCalendarReadSliceSync(
  mainRegion: HTMLElement,
  fallback = LAB_STAFF_MASTER_SCHEDULE,
  audience: Extract<BookingVisibilityAudience, 'staff_seller' | 'staff_full'> = 'staff_full',
  sessionWiring?: StaffSessionWiringInjection | null,
): void {
  const slot = resolveSlot(mainRegion);
  if (!slot) return;
  const resolvedAudience =
    sessionWiring?.context.sessionRole === 'staff_seller' ? 'staff_seller' : audience;
  fillSlot(slot, {
    bookings: fallback.bookings,
    slots: fallback.slots,
    detailsById: fallback.detailsById,
    audience: resolvedAudience,
    sourceLabel: annotateStaffMountSourceLabel('lab mock', sessionWiring, 'bookings'),
  });
}
