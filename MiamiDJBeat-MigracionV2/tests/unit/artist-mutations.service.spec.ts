/**
 * artist-mutations.service.spec.ts — Writers Phase · Slice 2 · Paso 2.
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
} from '../../shared/services/session-wiring/index';
import {
  createArtistMutationsAdapter,
  createLabIdempotencyStore,
  listArtistMutationsAdapterWriteMethods,
  resetArtistLabRecordIdSequence,
} from '../../shared/services/artist-mutations/index';

const REPO_ROOT = resolve(__dirname, '../..');
const ADAPTER_PATH = resolve(
  REPO_ROOT,
  'shared/services/artist-mutations/artist-mutations.adapter.ts',
);

function gigPayload(overrides: Record<string, unknown> = {}) {
  return {
    artistUserId: MOCK_SW_ARTIST_USER_ID,
    assignedDjId: MOCK_SW_ARTIST_USER_ID,
    idempotencyKey: 'idem_gig_ok_01',
    bookingId: 'bk_gig_001',
    decision: 'ACCEPT',
    rejectionNotes: null,
    responseNotes: null,
    ...overrides,
  };
}

function payoutPayload(overrides: Record<string, unknown> = {}) {
  return {
    artistUserId: MOCK_SW_ARTIST_USER_ID,
    assignedDjId: MOCK_SW_ARTIST_USER_ID,
    idempotencyKey: 'idem_payout_ok_01',
    payoutId: 'po_lab_001',
    acknowledged: true,
    feedback: 'Received — thanks',
    ...overrides,
  };
}

describe('artist-mutations adapter — happy path', () => {
  beforeEach(() => {
    resetArtistLabRecordIdSequence();
  });

  it('ACCEPT gig assignment stores accepted_lab record', () => {
    const adapter = createArtistMutationsAdapter({
      nowIso: () => '2026-08-11T13:00:00.000Z',
    });
    const result = adapter.respondGigAssignment({
      payload: gigPayload(),
      session: { context: MOCK_SW_CONTEXT_ARTIST },
      gigAssignedDjId: MOCK_SW_ARTIST_USER_ID,
    });

    expect(result.status).toBe('SUCCESS');
    if (result.status !== 'SUCCESS') return;
    expect(result.replayed).toBe(false);
    expect(result.labRecordId).toMatch(/^lab_gig_/);
    expect(result.acceptedAt).toBe('2026-08-11T13:00:00.000Z');

    const record = adapter.getLabRecord(result.labRecordId);
    expect(record?.kind).toBe('respond_gig_assignment');
    if (record?.kind === 'respond_gig_assignment') {
      expect(record.decision).toBe('ACCEPT');
      expect(record.status).toBe('accepted_lab');
    }
  });

  it('DECLINE gig assignment requires notes and stores declined_lab', () => {
    const adapter = createArtistMutationsAdapter();
    const missingNotes = adapter.respondGigAssignment({
      payload: gigPayload({
        decision: 'DECLINE',
        rejectionNotes: null,
        idempotencyKey: 'idem_gig_decline_bad',
      }),
      session: { context: MOCK_SW_CONTEXT_ARTIST },
    });
    expect(missingNotes.status).toBe('VALIDATION_ERROR');
    if (missingNotes.status === 'VALIDATION_ERROR') {
      expect(missingNotes.issues.some((i) => i.code === 'decline_notes_required')).toBe(true);
    }

    const ok = adapter.respondGigAssignment({
      payload: gigPayload({
        decision: 'DECLINE',
        rejectionNotes: 'Conflict with another booking',
        idempotencyKey: 'idem_gig_decline_ok',
      }),
      session: { context: MOCK_SW_CONTEXT_ARTIST },
    });
    expect(ok.status).toBe('SUCCESS');
    if (ok.status !== 'SUCCESS') return;
    const record = adapter.getLabRecord(ok.labRecordId);
    expect(record?.kind).toBe('respond_gig_assignment');
    if (record?.kind === 'respond_gig_assignment') {
      expect(record.status).toBe('declined_lab');
    }
  });

  it('acknowledge payout stores acknowledged_lab', () => {
    const adapter = createArtistMutationsAdapter();
    const result = adapter.acknowledgePayout({
      payload: payoutPayload(),
      session: { context: MOCK_SW_CONTEXT_ARTIST },
    });
    expect(result.status).toBe('SUCCESS');
    if (result.status !== 'SUCCESS') return;
    const record = adapter.getLabRecord(result.labRecordId);
    expect(record?.kind).toBe('acknowledge_payout');
    if (record?.kind === 'acknowledge_payout') {
      expect(record.status).toBe('acknowledged_lab');
      expect(record.payoutId).toBe('po_lab_001');
    }
  });
});

describe('artist-mutations adapter — assignment & authorization', () => {
  beforeEach(() => {
    resetArtistLabRecordIdSequence();
  });

  it('rejects when gigAssignedDjId belongs to another DJ (GIG_NOT_ASSIGNED)', () => {
    const adapter = createArtistMutationsAdapter();
    const result = adapter.respondGigAssignment({
      payload: gigPayload({ idempotencyKey: 'idem_gig_foreign_01' }),
      session: { context: MOCK_SW_CONTEXT_ARTIST },
      gigAssignedDjId: MOCK_SW_CLIENT_USER_ID,
    });
    expect(result.status).toBe('GIG_NOT_ASSIGNED');
    if (result.status === 'GIG_NOT_ASSIGNED') {
      expect(result.reason).toBe('assigned_dj_mismatch');
    }
    expect(adapter.listLabRecords()).toHaveLength(0);
  });

  it('rejects client role with UNAUTHORIZED_ROLE', () => {
    const adapter = createArtistMutationsAdapter();
    const result = adapter.respondGigAssignment({
      payload: gigPayload(),
      session: { context: MOCK_SW_CONTEXT_CLIENT },
    });
    expect(result.status).toBe('UNAUTHORIZED_ROLE');
    if (result.status === 'UNAUTHORIZED_ROLE') {
      expect(result.reason).toBe('role_not_artist');
    }
  });

  it('rejects anonymous and expired sessions', () => {
    const adapter = createArtistMutationsAdapter();
    expect(
      adapter.respondGigAssignment({
        payload: gigPayload(),
        session: { context: MOCK_SW_CONTEXT_ANON },
      }).status,
    ).toBe('UNAUTHORIZED_ROLE');
    expect(
      adapter.acknowledgePayout({
        payload: payoutPayload(),
        session: { context: MOCK_SW_CONTEXT_EXPIRED },
      }).status,
    ).toBe('UNAUTHORIZED_ROLE');
  });

  it('rejects artistUserId that does not match session scope', () => {
    const adapter = createArtistMutationsAdapter();
    const result = adapter.respondGigAssignment({
      payload: gigPayload({
        artistUserId: 'foreign-artist-id-0001',
        assignedDjId: 'foreign-artist-id-0001',
        idempotencyKey: 'idem_gig_scope_01',
      }),
      session: { context: MOCK_SW_CONTEXT_ARTIST },
    });
    expect(result.status).toBe('VALIDATION_ERROR');
    if (result.status === 'VALIDATION_ERROR') {
      expect(result.issues.some((i) => i.code === 'scope_mismatch')).toBe(true);
    }
  });
});

describe('artist-mutations adapter — idempotency', () => {
  beforeEach(() => {
    resetArtistLabRecordIdSequence();
  });

  it('replays SUCCESS with same key and same payload', () => {
    const store = createLabIdempotencyStore();
    const adapter = createArtistMutationsAdapter({ idempotencyStore: store });
    const payload = gigPayload({ idempotencyKey: 'idem_gig_dup_same_01' });

    const first = adapter.respondGigAssignment({
      payload,
      session: { context: MOCK_SW_CONTEXT_ARTIST },
    });
    const second = adapter.respondGigAssignment({
      payload,
      session: { context: MOCK_SW_CONTEXT_ARTIST },
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
    const adapter = createArtistMutationsAdapter();
    const key = 'idem_gig_dup_diff_01';
    const first = adapter.respondGigAssignment({
      payload: gigPayload({ idempotencyKey: key, decision: 'ACCEPT' }),
      session: { context: MOCK_SW_CONTEXT_ARTIST },
    });
    const conflict = adapter.respondGigAssignment({
      payload: gigPayload({
        idempotencyKey: key,
        decision: 'DECLINE',
        rejectionNotes: 'Changed mind',
      }),
      session: { context: MOCK_SW_CONTEXT_ARTIST },
    });

    expect(first.status).toBe('SUCCESS');
    expect(conflict.status).toBe('IDEMPOTENCY_CONFLICT');
    if (conflict.status === 'IDEMPOTENCY_CONFLICT' && first.status === 'SUCCESS') {
      expect(conflict.existingLabRecordId).toBe(first.labRecordId);
    }
    expect(adapter.listLabRecords()).toHaveLength(1);
  });
});

describe('artist-mutations adapter — surface contract', () => {
  it('exposes write methods and contains no productive DB writer calls', () => {
    expect(listArtistMutationsAdapterWriteMethods()).toContain('respondGigAssignment');
    expect(listArtistMutationsAdapterWriteMethods()).toContain('acknowledgePayout');
    const source = readFileSync(ADAPTER_PATH, 'utf8');
    expect(source).not.toMatch(/from\(['"]leads['"]\)/);
    expect(source).not.toMatch(/createClient\(/);
    expect(source).not.toMatch(/\.insert\(/);
    expect(source).not.toMatch(/\.update\(/);
    expect(source).toContain('createLabIdempotencyStore');
  });
});
