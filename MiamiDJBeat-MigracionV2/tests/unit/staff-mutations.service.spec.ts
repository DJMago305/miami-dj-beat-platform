/**
 * staff-mutations.service.spec.ts — Writers Phase · Slice 3 · Paso 2.
 * Lab adapter + shared idempotency store — NO Supabase.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MOCK_SW_ARTIST_USER_ID,
  MOCK_SW_CLIENT_USER_ID,
  MOCK_SW_CONTEXT_ANON,
  MOCK_SW_CONTEXT_ARTIST,
  MOCK_SW_CONTEXT_CLIENT,
  MOCK_SW_CONTEXT_EXPIRED,
  MOCK_SW_CONTEXT_SELLER,
  MOCK_SW_CONTEXT_STAFF,
  MOCK_SW_SELLER_USER_ID,
  MOCK_SW_STAFF_USER_ID,
} from '../../shared/services/session-wiring/index';
import {
  createLabIdempotencyStore,
  createStaffMutationsAdapter,
  listStaffMutationsAdapterWriteMethods,
  resetStaffLabRecordIdSequence,
} from '../../shared/services/staff-mutations/index';

const REPO_ROOT = resolve(__dirname, '../..');
const ADAPTER_PATH = resolve(
  REPO_ROOT,
  'shared/services/staff-mutations/staff-mutations.adapter.ts',
);

function reviewPayload(overrides: Record<string, unknown> = {}) {
  return {
    staffUserId: MOCK_SW_STAFF_USER_ID,
    idempotencyKey: 'idem_pay_review_ok_01',
    paymentId: 'pay_lab_001',
    decision: 'APPROVE',
    rejectionReason: null,
    reviewNotes: null,
    ...overrides,
  };
}

function assignPayload(overrides: Record<string, unknown> = {}) {
  return {
    staffUserId: MOCK_SW_STAFF_USER_ID,
    idempotencyKey: 'idem_assign_ok_01',
    bookingId: 'bk_lab_001',
    artistUserId: MOCK_SW_ARTIST_USER_ID,
    notes: 'Primary DJ',
    replaceExisting: true,
    ...overrides,
  };
}

describe('staff-mutations adapter — happy path', () => {
  beforeEach(() => {
    resetStaffLabRecordIdSequence();
  });

  it('APPROVE offline payment stores approved_lab', () => {
    const adapter = createStaffMutationsAdapter({
      nowIso: () => '2026-08-11T17:30:00.000Z',
      knownPaymentIds: ['pay_lab_001'],
    });
    const result = adapter.reviewOfflinePayment({
      payload: reviewPayload(),
      session: { context: MOCK_SW_CONTEXT_STAFF },
    });

    expect(result.status).toBe('SUCCESS');
    if (result.status !== 'SUCCESS') return;
    expect(result.replayed).toBe(false);
    expect(result.labRecordId).toMatch(/^lab_payment_review_/);
    expect(result.acceptedAt).toBe('2026-08-11T17:30:00.000Z');

    const record = adapter.getLabRecord(result.labRecordId);
    expect(record?.kind).toBe('review_offline_payment');
    if (record?.kind === 'review_offline_payment') {
      expect(record.decision).toBe('APPROVE');
      expect(record.status).toBe('approved_lab');
    }
  });

  it('REJECT requires reason and stores rejected_lab', () => {
    const adapter = createStaffMutationsAdapter({
      knownPaymentIds: ['pay_lab_001'],
    });
    const missing = adapter.reviewOfflinePayment({
      payload: reviewPayload({
        decision: 'REJECT',
        rejectionReason: null,
        idempotencyKey: 'idem_pay_reject_bad',
      }),
      session: { context: MOCK_SW_CONTEXT_STAFF },
    });
    expect(missing.status).toBe('VALIDATION_ERROR');
    if (missing.status === 'VALIDATION_ERROR') {
      expect(missing.issues.some((i) => i.code === 'reject_reason_required')).toBe(true);
    }

    const ok = adapter.reviewOfflinePayment({
      payload: reviewPayload({
        decision: 'REJECT',
        rejectionReason: 'Unreadable transfer memo',
        idempotencyKey: 'idem_pay_reject_ok',
      }),
      session: { context: MOCK_SW_CONTEXT_STAFF },
    });
    expect(ok.status).toBe('SUCCESS');
    if (ok.status !== 'SUCCESS') return;
    const record = adapter.getLabRecord(ok.labRecordId);
    expect(record?.kind).toBe('review_offline_payment');
    if (record?.kind === 'review_offline_payment') {
      expect(record.status).toBe('rejected_lab');
    }
  });

  it('assigns artist to booking as assigned_lab (staff_seller allowed)', () => {
    const adapter = createStaffMutationsAdapter({
      knownBookingIds: ['bk_lab_001'],
    });
    const result = adapter.assignArtistToBooking({
      payload: assignPayload({
        staffUserId: MOCK_SW_SELLER_USER_ID,
        idempotencyKey: 'idem_assign_seller_01',
      }),
      session: { context: MOCK_SW_CONTEXT_SELLER },
    });
    expect(result.status).toBe('SUCCESS');
    if (result.status !== 'SUCCESS') return;
    const record = adapter.getLabRecord(result.labRecordId);
    expect(record?.kind).toBe('assign_artist_to_booking');
    if (record?.kind === 'assign_artist_to_booking') {
      expect(record.status).toBe('assigned_lab');
      expect(record.artistUserId).toBe(MOCK_SW_ARTIST_USER_ID);
    }
  });
});

describe('staff-mutations adapter — authorization & not-found', () => {
  beforeEach(() => {
    resetStaffLabRecordIdSequence();
  });

  it('rejects client and artist roles with UNAUTHORIZED_ROLE', () => {
    const adapter = createStaffMutationsAdapter({
      knownPaymentIds: ['pay_lab_001'],
    });
    const clientResult = adapter.reviewOfflinePayment({
      payload: reviewPayload({ staffUserId: MOCK_SW_CLIENT_USER_ID }),
      session: { context: MOCK_SW_CONTEXT_CLIENT },
    });
    expect(clientResult.status).toBe('UNAUTHORIZED_ROLE');
    if (clientResult.status === 'UNAUTHORIZED_ROLE') {
      expect(clientResult.reason).toBe('role_not_staff');
    }

    const artistResult = adapter.assignArtistToBooking({
      payload: assignPayload({ staffUserId: MOCK_SW_ARTIST_USER_ID }),
      session: { context: MOCK_SW_CONTEXT_ARTIST },
      bookingExists: true,
    });
    expect(artistResult.status).toBe('UNAUTHORIZED_ROLE');
  });

  it('rejects anonymous and expired sessions', () => {
    const adapter = createStaffMutationsAdapter();
    expect(
      adapter.reviewOfflinePayment({
        payload: reviewPayload(),
        session: { context: MOCK_SW_CONTEXT_ANON },
        paymentExists: true,
      }).status,
    ).toBe('UNAUTHORIZED_ROLE');
    expect(
      adapter.assignArtistToBooking({
        payload: assignPayload(),
        session: { context: MOCK_SW_CONTEXT_EXPIRED },
        bookingExists: true,
      }).status,
    ).toBe('UNAUTHORIZED_ROLE');
  });

  it('returns PAYMENT_NOT_FOUND when payment absent', () => {
    const adapter = createStaffMutationsAdapter({
      knownPaymentIds: [],
    });
    const result = adapter.reviewOfflinePayment({
      payload: reviewPayload({ paymentId: 'pay_missing', idempotencyKey: 'idem_pay_nf' }),
      session: { context: MOCK_SW_CONTEXT_STAFF },
    });
    expect(result.status).toBe('PAYMENT_NOT_FOUND');
    if (result.status === 'PAYMENT_NOT_FOUND') {
      expect(result.reason).toBe('payment_absent');
      expect(result.paymentId).toBe('pay_missing');
    }
  });

  it('returns BOOKING_NOT_FOUND when booking absent', () => {
    const adapter = createStaffMutationsAdapter({
      knownBookingIds: ['bk_other'],
    });
    const result = adapter.assignArtistToBooking({
      payload: assignPayload({ bookingId: 'bk_missing', idempotencyKey: 'idem_bk_nf' }),
      session: { context: MOCK_SW_CONTEXT_STAFF },
    });
    expect(result.status).toBe('BOOKING_NOT_FOUND');
    if (result.status === 'BOOKING_NOT_FOUND') {
      expect(result.reason).toBe('booking_absent');
    }
  });
});

describe('staff-mutations adapter — idempotency', () => {
  beforeEach(() => {
    resetStaffLabRecordIdSequence();
  });

  it('replays SUCCESS with same key and same payload', () => {
    const store = createLabIdempotencyStore();
    const adapter = createStaffMutationsAdapter({
      idempotencyStore: store,
      knownPaymentIds: ['pay_lab_001'],
    });
    const payload = reviewPayload({ idempotencyKey: 'idem_pay_dup_same' });

    const first = adapter.reviewOfflinePayment({
      payload,
      session: { context: MOCK_SW_CONTEXT_STAFF },
    });
    const second = adapter.reviewOfflinePayment({
      payload,
      session: { context: MOCK_SW_CONTEXT_STAFF },
    });

    expect(first.status).toBe('SUCCESS');
    expect(second.status).toBe('SUCCESS');
    if (first.status === 'SUCCESS' && second.status === 'SUCCESS') {
      expect(first.replayed).toBe(false);
      expect(second.replayed).toBe(true);
      expect(second.labRecordId).toBe(first.labRecordId);
    }
    expect(adapter.listLabRecords()).toHaveLength(1);
    expect(store.size()).toBe(1);
  });

  it('returns IDEMPOTENCY_CONFLICT when same key has different payload', () => {
    const adapter = createStaffMutationsAdapter({
      knownPaymentIds: ['pay_lab_001'],
    });
    const key = 'idem_pay_dup_diff';
    const first = adapter.reviewOfflinePayment({
      payload: reviewPayload({ idempotencyKey: key, decision: 'APPROVE' }),
      session: { context: MOCK_SW_CONTEXT_STAFF },
    });
    const conflict = adapter.reviewOfflinePayment({
      payload: reviewPayload({
        idempotencyKey: key,
        decision: 'REJECT',
        rejectionReason: 'Changed decision',
      }),
      session: { context: MOCK_SW_CONTEXT_STAFF },
    });

    expect(first.status).toBe('SUCCESS');
    expect(conflict.status).toBe('IDEMPOTENCY_CONFLICT');
    if (conflict.status === 'IDEMPOTENCY_CONFLICT' && first.status === 'SUCCESS') {
      expect(conflict.existingLabRecordId).toBe(first.labRecordId);
    }
    expect(adapter.listLabRecords()).toHaveLength(1);
  });
});

describe('staff-mutations adapter — surface contract', () => {
  it('exposes write methods and contains no productive DB writer calls', () => {
    expect(listStaffMutationsAdapterWriteMethods()).toContain('reviewOfflinePayment');
    expect(listStaffMutationsAdapterWriteMethods()).toContain('assignArtistToBooking');
    const source = readFileSync(ADAPTER_PATH, 'utf8');
    expect(source).not.toMatch(/from\(['"]leads['"]\)/);
    expect(source).not.toMatch(/createClient\(/);
    expect(source).not.toMatch(/\.insert\(/);
    expect(source).not.toMatch(/\.update\(/);
    expect(source).toContain('createLabIdempotencyStore');
  });
});
