/**
 * client-mutations.service.spec.ts — Writers Phase · Slice 1 · Paso 2.
 * Lab adapter + idempotency store — NO Supabase.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MOCK_SW_CLIENT_USER_ID, MOCK_SW_CONTEXT_ARTIST, MOCK_SW_CONTEXT_CLIENT, MOCK_SW_CONTEXT_ANON, MOCK_SW_CONTEXT_EXPIRED } from '../../shared/services/session-wiring/index';
import {
  createClientMutationsAdapter,
  createLabIdempotencyStore,
  listClientMutationsAdapterWriteMethods,
  resetLabRecordIdSequence,
} from '../../shared/services/client-mutations/index';
import { CLIENT_MUTATION_PAYLOAD_LIMITS } from '../../shared/types/client.mutations.types';

const REPO_ROOT = resolve(__dirname, '../..');
const ADAPTER_PATH = resolve(REPO_ROOT, 'shared/services/client-mutations/client-mutations.adapter.ts');

function bookingPayload(overrides: Record<string, unknown> = {}) {
  return {
    clientUserId: MOCK_SW_CLIENT_USER_ID,
    idempotencyKey: 'idem_booking_ok_01',
    title: 'Wedding reception',
    eventDate: '2026-09-15',
    startTime: '18:00',
    endTime: '23:00',
    locationLabel: 'Miami Beach',
    notes: null,
    preferredArtistProfileId: null,
    contactName: 'Ada',
    contactEmail: 'ada@example.com',
    contactPhone: '+13055550100',
    ...overrides,
  };
}

function paymentPayload(overrides: Record<string, unknown> = {}) {
  return {
    clientUserId: MOCK_SW_CLIENT_USER_ID,
    idempotencyKey: 'idem_pay_ok_01',
    bookingId: 'bk_lab_001',
    amountMinorUnits: 25_000,
    currencyCode: 'USD',
    paymentMethod: 'Zelle',
    proofReference: 'ZELLE-REF-99',
    proofNotes: null,
    paidAt: '2026-08-10',
    ...overrides,
  };
}

describe('client-mutations adapter — happy path', () => {
  beforeEach(() => {
    resetLabRecordIdSequence();
  });

  it('accepts create booking request for client session and stores lab record', () => {
    const adapter = createClientMutationsAdapter({
      nowIso: () => '2026-08-11T08:00:00.000Z',
    });
    const result = adapter.submitBookingRequest({
      payload: bookingPayload(),
      session: { context: MOCK_SW_CONTEXT_CLIENT },
    });

    expect(result.status).toBe('SUCCESS');
    if (result.status !== 'SUCCESS') return;
    expect(result.replayed).toBe(false);
    expect(result.labRecordId).toMatch(/^lab_booking_/);
    expect(result.acceptedAt).toBe('2026-08-11T08:00:00.000Z');

    const record = adapter.getLabRecord(result.labRecordId);
    expect(record?.kind).toBe('create_booking_request');
    if (record?.kind === 'create_booking_request') {
      expect(record.title).toBe('Wedding reception');
      expect(record.status).toBe('accepted_lab');
    }
  });

  it('accepts offline payment proof for client session', () => {
    const adapter = createClientMutationsAdapter();
    const result = adapter.submitOfflinePaymentProof({
      payload: paymentPayload(),
      session: { context: MOCK_SW_CONTEXT_CLIENT },
    });

    expect(result.status).toBe('SUCCESS');
    if (result.status !== 'SUCCESS') return;
    expect(result.mutationKind).toBe('submit_offline_payment_proof');
    expect(adapter.listLabRecords()).toHaveLength(1);
  });
});

describe('client-mutations adapter — authorization', () => {
  beforeEach(() => {
    resetLabRecordIdSequence();
  });

  it('rejects artist role with UNAUTHORIZED_ROLE', () => {
    const adapter = createClientMutationsAdapter();
    const result = adapter.submitBookingRequest({
      payload: bookingPayload(),
      session: { context: MOCK_SW_CONTEXT_ARTIST },
    });
    expect(result.status).toBe('UNAUTHORIZED_ROLE');
    if (result.status === 'UNAUTHORIZED_ROLE') {
      expect(result.reason).toBe('role_not_client');
    }
    expect(adapter.listLabRecords()).toHaveLength(0);
  });

  it('rejects anonymous and expired sessions', () => {
    const adapter = createClientMutationsAdapter();
    expect(
      adapter.submitBookingRequest({
        payload: bookingPayload(),
        session: { context: MOCK_SW_CONTEXT_ANON },
      }).status,
    ).toBe('UNAUTHORIZED_ROLE');
    expect(
      adapter.submitOfflinePaymentProof({
        payload: paymentPayload(),
        session: { context: MOCK_SW_CONTEXT_EXPIRED },
      }).status,
    ).toBe('UNAUTHORIZED_ROLE');
  });

  it('rejects clientUserId that does not match session scope', () => {
    const adapter = createClientMutationsAdapter();
    const result = adapter.submitBookingRequest({
      payload: bookingPayload({ clientUserId: 'foreign-client-id-0001' }),
      session: { context: MOCK_SW_CONTEXT_CLIENT },
    });
    expect(result.status).toBe('VALIDATION_ERROR');
    if (result.status === 'VALIDATION_ERROR') {
      expect(result.issues.some((i) => i.code === 'scope_mismatch')).toBe(true);
    }
  });
});

describe('client-mutations adapter — idempotency', () => {
  beforeEach(() => {
    resetLabRecordIdSequence();
  });

  it('replays SUCCESS with same key and same payload', () => {
    const store = createLabIdempotencyStore();
    const adapter = createClientMutationsAdapter({ idempotencyStore: store });
    const payload = bookingPayload({ idempotencyKey: 'idem_dup_same_01' });

    const first = adapter.submitBookingRequest({
      payload,
      session: { context: MOCK_SW_CONTEXT_CLIENT },
    });
    const second = adapter.submitBookingRequest({
      payload,
      session: { context: MOCK_SW_CONTEXT_CLIENT },
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
    const adapter = createClientMutationsAdapter();
    const key = 'idem_dup_diff_01';
    const first = adapter.submitBookingRequest({
      payload: bookingPayload({ idempotencyKey: key, title: 'First title' }),
      session: { context: MOCK_SW_CONTEXT_CLIENT },
    });
    const conflict = adapter.submitBookingRequest({
      payload: bookingPayload({ idempotencyKey: key, title: 'Second title' }),
      session: { context: MOCK_SW_CONTEXT_CLIENT },
    });

    expect(first.status).toBe('SUCCESS');
    expect(conflict.status).toBe('IDEMPOTENCY_CONFLICT');
    if (conflict.status === 'IDEMPOTENCY_CONFLICT' && first.status === 'SUCCESS') {
      expect(conflict.existingLabRecordId).toBe(first.labRecordId);
    }
    expect(adapter.listLabRecords()).toHaveLength(1);
  });
});

describe('client-mutations adapter — validation & payload limits', () => {
  beforeEach(() => {
    resetLabRecordIdSequence();
  });

  it('rejects missing title as VALIDATION_ERROR', () => {
    const adapter = createClientMutationsAdapter();
    const result = adapter.submitBookingRequest({
      payload: bookingPayload({ title: '' }),
      session: { context: MOCK_SW_CONTEXT_CLIENT },
    });
    expect(result.status).toBe('VALIDATION_ERROR');
  });

  it('rejects StripeCard offline method', () => {
    const adapter = createClientMutationsAdapter();
    const result = adapter.submitOfflinePaymentProof({
      payload: paymentPayload({ paymentMethod: 'StripeCard' }),
      session: { context: MOCK_SW_CONTEXT_CLIENT },
    });
    expect(result.status).toBe('VALIDATION_ERROR');
    if (result.status === 'VALIDATION_ERROR') {
      expect(result.issues.some((i) => i.code === 'unsupported_method')).toBe(true);
    }
  });

  it('rejects oversized payload', () => {
    const adapter = createClientMutationsAdapter();
    const hugeNotes = 'x'.repeat(CLIENT_MUTATION_PAYLOAD_LIMITS.maxPayloadChars + 100);
    const result = adapter.submitBookingRequest({
      payload: bookingPayload({ notes: hugeNotes, idempotencyKey: 'idem_payload_big_01' }),
      session: { context: MOCK_SW_CONTEXT_CLIENT },
    });
    expect(result.status).toBe('VALIDATION_ERROR');
    if (result.status === 'VALIDATION_ERROR') {
      expect(result.issues.some((i) => i.code === 'payload_too_large' || i.code === 'too_long')).toBe(
        true,
      );
    }
  });
});

describe('client-mutations adapter — surface contract', () => {
  it('exposes write methods and contains no productive DB writer calls', () => {
    expect(listClientMutationsAdapterWriteMethods()).toContain('submitBookingRequest');
    expect(listClientMutationsAdapterWriteMethods()).toContain('submitOfflinePaymentProof');
    const source = readFileSync(ADAPTER_PATH, 'utf8');
    expect(source).not.toMatch(/from\(['"]leads['"]\)/);
    expect(source).not.toMatch(/createClient\(/);
    expect(source).toContain('createLabIdempotencyStore');
  });
});
