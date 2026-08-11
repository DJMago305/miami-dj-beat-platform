/**
 * Bookings / Agenda V2 — Read Model types (Paso 1).
 * Canonical matrix: docs/V2/BOOKINGS-V1-V2-MAPPING-MATRIX.md
 *
 * READ-ONLY: no writers, no SQL, no RLS changes.
 * Lab only: http://localhost:5173
 */

/** V2 canonical lifecycle for commercial bookings (mapped from leads.status / EBO). */
export type BookingLifecycleStatus =
  | 'Draft'
  | 'Confirmed'
  | 'InProgress'
  | 'Completed'
  | 'Cancelled';

/**
 * Payment signal — orthogonal to lifecycle (matrix §7 G6).
 * Mirrors common V1 leads.payment_status strings (normalized later in mappers).
 */
export type BookingPaymentStatus =
  | 'Unpaid'
  | 'Pending'
  | 'Partial'
  | 'Paid'
  | 'Unknown';

/** Provenance of a booking snapshot row. */
export type BookingSourceKind = 'lead' | 'event_builder' | 'legacy_dj_event';

/** Calendar cell / block kind — slots are virtual in V1 (no slots table). */
export type CalendarSlotKind =
  | 'booking'
  | 'residency'
  | 'availability'
  | 'busy'
  | 'vacation'
  | 'hold';

/** Who may see a slot / booking in lab projections (aligns to portal + RLS intent). */
export type BookingVisibilityAudience =
  | 'client_own'
  | 'artist_assigned'
  | 'artist_own_schedule'
  | 'staff_seller'
  | 'staff_full'
  | 'public_limited';

/** Production timeline status from mdj_event_flows (orthogonal to booking lifecycle). */
export type ProductionFlowStatus = 'draft' | 'ready' | 'sent' | 'archived';

/**
 * BookingSnapshotDTO — list / calendar chip (MOD-109 / MOD-207).
 * Projection of `public.leads` (+ optional bridges). Not a writer.
 */
export type BookingSnapshotDTO = {
  readonly bookingId: string;
  readonly clientUserId: string | null;
  readonly assignedArtistProfileId: string | null;
  readonly assignedArtistUserId: string | null;
  readonly assignedStaffUserId: string | null;
  readonly title: string | null;
  readonly eventDate: string | null;
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly locationLabel: string | null;
  readonly lifecycleStatus: BookingLifecycleStatus;
  readonly paymentStatus: BookingPaymentStatus | null;
  readonly sourceKind: BookingSourceKind;
  /** True when V1 status string did not map cleanly (§4.2). */
  readonly statusUnmapped: boolean;
  readonly mdjbClientId: string | null;
  readonly mdjbArtistId: string | null;
};

/**
 * CalendarSlotDTO — agenda cell / block (MOD-206 / MOD-207).
 * Virtual identity: no V1 `calendar_slots` table.
 */
export type CalendarSlotDTO = {
  readonly slotId: string;
  readonly slotKind: CalendarSlotKind;
  readonly ownerArtistUserId: string | null;
  readonly date: string | null;
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly label: string | null;
  readonly lifecycleStatus: BookingLifecycleStatus | null;
  readonly bookingId: string | null;
  readonly visibility: BookingVisibilityAudience;
};

/**
 * EventDetailReadDTO — owner/staff/assigned read detail (MOD-109 / MOD-308).
 * Extends snapshot with PII-sensitive and production fields (policy-gated in future service).
 */
export type EventDetailReadDTO = BookingSnapshotDTO & {
  readonly clientDisplayName: string | null;
  readonly clientEmail: string | null;
  readonly clientPhone: string | null;
  readonly notes: string | null;
  readonly budgetLabel: string | null;
  readonly leadOutcome: string | null;
  readonly productionFlowId: string | null;
  readonly productionStatus: ProductionFlowStatus | null;
  readonly eventBuilderOrderId: string | null;
  readonly completedAt: string | null;
};

/**
 * Normalize common V1 leads.status / EBO order_status strings → V2 lifecycle.
 * Pure helper for Paso 2+ mappers — no I/O.
 */
export function mapV1StatusToLifecycle(
  raw: string | null | undefined,
): { readonly status: BookingLifecycleStatus; readonly unmapped: boolean } {
  const key = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  switch (key) {
    case 'new':
    case 'open':
    case 'pending':
      return { status: 'Draft', unmapped: false };
    case 'confirmed':
      return { status: 'Confirmed', unmapped: false };
    case 'matched':
    case 'in_review':
    case 'in-progress':
    case 'in_progress':
      return { status: 'InProgress', unmapped: false };
    case 'completed':
      return { status: 'Completed', unmapped: false };
    case 'cancelled':
    case 'canceled':
      return { status: 'Cancelled', unmapped: false };
    case '':
      return { status: 'Draft', unmapped: true };
    default:
      return { status: 'Draft', unmapped: true };
  }
}
