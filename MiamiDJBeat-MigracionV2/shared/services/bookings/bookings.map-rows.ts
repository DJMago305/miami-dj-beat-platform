/**
 * Bookings — map V1 lead rows / schedule JSON → Read DTOs (Paso 2, read-only).
 * Canonical matrix: docs/V2/BOOKINGS-V1-V2-MAPPING-MATRIX.md
 */

import {
  mapV1StatusToLifecycle,
  type BookingPaymentStatus,
  type BookingSnapshotDTO,
  type BookingVisibilityAudience,
  type CalendarSlotDTO,
  type EventDetailReadDTO,
  type ProductionFlowStatus,
} from '../../types/bookings.types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asRestRows(data: unknown): readonly Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter(isRecord);
  }
  return isRecord(data) ? [data] : [];
}

function asString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

export function mapV1PaymentStatus(
  raw: string | null | undefined,
): BookingPaymentStatus | null {
  if (raw == null || String(raw).trim() === '') return null;
  const key = String(raw).trim().toLowerCase();
  if (key === 'unpaid') return 'Unpaid';
  if (key === 'pending' || key === 'pending_zelle') return 'Pending';
  if (key === 'partial') return 'Partial';
  if (key === 'paid' || key === 'paid_full' || key === 'deposit_paid') return 'Paid';
  return 'Unknown';
}

export type MapLeadOptions = {
  readonly assignedArtistUserId?: string | null;
  readonly mdjbClientId?: string | null;
  readonly mdjbArtistId?: string | null;
  readonly productionFlowId?: string | null;
  readonly productionStatus?: ProductionFlowStatus | null;
  readonly eventBuilderOrderId?: string | null;
};

/**
 * Pure mapper — `public.leads` row → BookingSnapshotDTO.
 */
export function mapLeadRowToBookingSnapshot(
  row: Record<string, unknown>,
  opts?: MapLeadOptions,
): BookingSnapshotDTO {
  const lifecycle = mapV1StatusToLifecycle(asString(row.status));
  const title =
    asString(row.event_type) ??
    asString(row.event_name) ??
    asString(row.title) ??
    null;

  return Object.freeze({
    bookingId: asString(row.id) ?? '',
    clientUserId: asString(row.client_user_id),
    assignedArtistProfileId: asString(row.assigned_dj_id),
    assignedArtistUserId: opts?.assignedArtistUserId ?? null,
    assignedStaffUserId: asString(row.assigned_staff_id),
    title,
    eventDate: asString(row.event_date),
    startTime: asString(row.event_start_time),
    endTime: asString(row.event_end_time),
    locationLabel: asString(row.location),
    lifecycleStatus: lifecycle.status,
    paymentStatus: mapV1PaymentStatus(asString(row.payment_status)),
    sourceKind: 'lead',
    statusUnmapped: lifecycle.unmapped,
    mdjbClientId: opts?.mdjbClientId ?? null,
    mdjbArtistId: opts?.mdjbArtistId ?? null,
  });
}

/**
 * Pure mapper — lead row → EventDetailReadDTO (includes PII fields; caller gates visibility).
 */
export function mapLeadRowToEventDetail(
  row: Record<string, unknown>,
  opts?: MapLeadOptions,
): EventDetailReadDTO {
  const snapshot = mapLeadRowToBookingSnapshot(row, opts);
  const budget = row.budget;
  const budgetLabel =
    budget === undefined || budget === null
      ? null
      : typeof budget === 'number'
        ? `$${budget}`
        : asString(budget);

  return Object.freeze({
    ...snapshot,
    clientDisplayName: asString(row.full_name),
    clientEmail: asString(row.email),
    clientPhone: asString(row.phone),
    notes: asString(row.notes),
    budgetLabel,
    leadOutcome: asString(row.lead_outcome),
    productionFlowId: opts?.productionFlowId ?? asString(row.production_flow_id),
    productionStatus: opts?.productionStatus ?? null,
    eventBuilderOrderId: opts?.eventBuilderOrderId ?? asString(row.event_builder_order_id),
    completedAt: asString(row.event_completed_at),
  });
}

/**
 * Booking chip as a calendar slot (virtual slotId).
 */
export function mapBookingSnapshotToCalendarSlot(
  booking: BookingSnapshotDTO,
  visibility: BookingVisibilityAudience,
): CalendarSlotDTO {
  return Object.freeze({
    slotId: `lead:${booking.bookingId}`,
    slotKind: 'booking',
    ownerArtistUserId: booking.assignedArtistUserId,
    date: booking.eventDate,
    startTime: booking.startTime,
    endTime: booking.endTime,
    label: booking.title,
    lifecycleStatus: booking.lifecycleStatus,
    bookingId: booking.bookingId,
    visibility,
  });
}

export type ArtistScheduleJsonInput = {
  readonly ownerArtistUserId: string;
  readonly weeklySchedule?: unknown;
  readonly availabilitySchedule?: unknown;
  readonly vacationStart?: string | null;
  readonly vacationEnd?: string | null;
};

function pushSlot(out: CalendarSlotDTO[], slot: CalendarSlotDTO): void {
  out.push(Object.freeze(slot));
}

/**
 * Expand artist profile schedule JSON → virtual CalendarSlotDTO[] (read-only).
 * Best-effort parsing of V1 shapes used by agenda-engine.
 */
export function mapArtistScheduleJsonToSlots(
  input: ArtistScheduleJsonInput,
): readonly CalendarSlotDTO[] {
  const slots: CalendarSlotDTO[] = [];
  const owner = input.ownerArtistUserId;
  const visibility: BookingVisibilityAudience = 'artist_own_schedule';

  if (input.vacationStart || input.vacationEnd) {
    pushSlot(slots, {
      slotId: `vacation:${owner}:${input.vacationStart ?? 'x'}:${input.vacationEnd ?? 'x'}`,
      slotKind: 'vacation',
      ownerArtistUserId: owner,
      date: input.vacationStart ?? null,
      startTime: null,
      endTime: null,
      label: 'Vacation',
      lifecycleStatus: null,
      bookingId: null,
      visibility,
    });
  }

  const weekly = input.weeklySchedule;
  if (isRecord(weekly)) {
    const busy = weekly.__busy_days;
    if (Array.isArray(busy)) {
      for (const day of busy) {
        const d = asString(day);
        if (!d) continue;
        pushSlot(slots, {
          slotId: `busy:${owner}:${d}`,
          slotKind: 'busy',
          ownerArtistUserId: owner,
          date: d,
          startTime: null,
          endTime: null,
          label: 'Busy',
          lifecycleStatus: null,
          bookingId: null,
          visibility,
        });
      }
    }
    for (const [key, value] of Object.entries(weekly)) {
      if (key.startsWith('_') || key.startsWith('__')) continue;
      if (!isRecord(value)) continue;
      const label = asString(value.venue) ?? asString(value.label) ?? `Residency · ${key}`;
      pushSlot(slots, {
        slotId: `weekly:${owner}:${key}`,
        slotKind: 'residency',
        ownerArtistUserId: owner,
        date: null,
        startTime: asString(value.start) ?? asString(value.start_time),
        endTime: asString(value.end) ?? asString(value.end_time),
        label,
        lifecycleStatus: null,
        bookingId: null,
        visibility,
      });
    }
  }

  const availability = input.availabilitySchedule;
  if (isRecord(availability)) {
    const schedule = availability.schedule;
    if (isRecord(schedule)) {
      for (const [date, entry] of Object.entries(schedule)) {
        const blocked =
          entry === 'blocked' ||
          (isRecord(entry) && (entry.blocked === true || asString(entry.status) === 'blocked'));
        pushSlot(slots, {
          slotId: `avail:${owner}:${date}`,
          slotKind: blocked ? 'busy' : 'availability',
          ownerArtistUserId: owner,
          date,
          startTime: isRecord(entry) ? asString(entry.start) : null,
          endTime: isRecord(entry) ? asString(entry.end) : null,
          label: blocked ? 'Blocked' : 'Available',
          lifecycleStatus: null,
          bookingId: null,
          visibility,
        });
      }
    }
  }

  return Object.freeze(slots);
}

/** Client sees only own bookings. */
export function filterBookingsForClient(
  bookings: readonly BookingSnapshotDTO[],
  clientUserId: string,
): readonly BookingSnapshotDTO[] {
  return Object.freeze(bookings.filter((b) => b.clientUserId === clientUserId));
}

/** Artist sees bookings assigned to their dj profile id and/or user id. */
export function filterBookingsForArtist(
  bookings: readonly BookingSnapshotDTO[],
  input: { readonly artistUserId?: string | null; readonly artistProfileId?: string | null },
): readonly BookingSnapshotDTO[] {
  return Object.freeze(
    bookings.filter((b) => {
      if (input.artistProfileId && b.assignedArtistProfileId === input.artistProfileId) return true;
      if (input.artistUserId && b.assignedArtistUserId === input.artistUserId) return true;
      return false;
    }),
  );
}

/** Strip PII from event detail for non-privileged audiences. */
export function redactEventDetailForAudience(
  detail: EventDetailReadDTO,
  audience: BookingVisibilityAudience,
): EventDetailReadDTO {
  if (audience === 'staff_full' || audience === 'client_own') {
    return detail;
  }
  if (audience === 'artist_assigned') {
    return Object.freeze({
      ...detail,
      clientEmail: null,
      clientPhone: null,
      budgetLabel: null,
    });
  }
  return Object.freeze({
    ...detail,
    clientDisplayName: null,
    clientEmail: null,
    clientPhone: null,
    notes: null,
    budgetLabel: null,
    leadOutcome: null,
  });
}
