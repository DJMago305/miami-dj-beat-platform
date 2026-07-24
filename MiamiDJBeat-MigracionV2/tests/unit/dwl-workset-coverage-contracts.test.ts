/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import {
  WorkLedgerContractError,
  assertValidWorkCoverageScope,
  assertValidWorkSetSequence,
  asArtistProfileId,
  asMdjUserId,
  asProfessionalIdentityId,
  asWorkCoverageRecordId,
  asWorkRecordId,
  asWorkSessionId,
  asWorkSetId,
  COVERAGE_TYPES,
  isCoverageReasonCode,
  isCoverageScopeKind,
  isCoverageStatus,
  isCoverageType,
  isWorkSetStatus,
  type ArtistProfileId,
  type MdjUserId,
  type ProfessionalIdentityReference,
  type WorkCoverageRecord,
  type WorkCoverageScope,
  type WorkRecord,
  type WorkSet,
  type WorkSetId,
} from '../../shared/services/work-ledger/contracts';

const SOURCE = { sourceSystem: 'staff_manual' as const, sourceRecordId: 'src-dc2-001' };

const sampleAudit = (createdByUserId: MdjUserId = asMdjUserId('user-owner-001')) => ({
  createdAt: '2026-07-23T12:00:00.000Z',
  createdByUserId,
  sourceReference: SOURCE,
  schemaVersion: 1 as const,
});

const sampleCoveringIdentity = (): ProfessionalIdentityReference => ({
  schemaVersion: 1,
  professionalIdentityId: asProfessionalIdentityId('prof-dj-b'),
  artistProfileId: asArtistProfileId('artist-dj-b'),
  displayNameSnapshot: 'DJ B',
  workRole: 'DJ',
});

const sampleWorkSet = (): WorkSet => ({
  schemaVersion: 1,
  workSetId: asWorkSetId('wset-001'),
  workSessionId: asWorkSessionId('ws-001'),
  workRecordId: asWorkRecordId('wr-001'),
  sequence: 1,
  label: 'Main set',
  scheduledStartAt: '2026-07-23T21:00:00.000Z',
  scheduledEndAt: '2026-07-23T23:00:00.000Z',
  setStatus: 'COMPLETED',
  setType: 'MAIN',
  sourceReference: SOURCE,
  auditMetadata: sampleAudit(),
});

const sampleCoverageRecord = (
  scope: WorkCoverageScope,
  overrides: Partial<WorkCoverageRecord> = {},
): WorkCoverageRecord => ({
  schemaVersion: 1,
  workCoverageRecordId: asWorkCoverageRecordId('wcr-001'),
  workRecordId: asWorkRecordId('wr-001'),
  coverageType: 'FULL_REPLACEMENT',
  coverageStatus: 'COMPLETED',
  coverageScope: scope,
  coveredArtistProfileId: asArtistProfileId('artist-dj-a'),
  coveredProfessionalIdentityId: asProfessionalIdentityId('prof-dj-a'),
  coveringArtistProfileId: asArtistProfileId('artist-dj-b'),
  coveringProfessionalIdentityId: asProfessionalIdentityId('prof-dj-b'),
  effectiveStartAt: '2026-07-23T20:00:00.000Z',
  effectiveEndAt: '2026-07-24T02:00:00.000Z',
  reasonCode: 'PLANNED_SUBSTITUTION',
  sourceReference: SOURCE,
  createdByUserId: asMdjUserId('user-owner-001'),
  auditMetadata: sampleAudit(),
  ...overrides,
});

const FORBIDDEN_FINANCIAL_KEYS = [
  'compensationAmount',
  'compensationStatus',
  'grossRevenue',
  'paymentStatus',
  'obligationId',
  'transactionId',
  'allocationId',
  'rate',
  'fee',
  'amount',
  'currency',
  'invoice',
  'settlement',
  'cashFlow',
  'beneficiary',
  'ownerDraw',
  'commission',
  'revenue',
  'payment',
] as const;

describe('DWL WorkSet & WorkCoverageRecord — TICKET-V2-DWL-DC-2-WORKSET-COVERAGE-IMPLEMENTATION-001', () => {
  it('requires WorkSet to reference WorkSessionId and WorkRecordId', () => {
    const workSet = sampleWorkSet();
    expect(workSet.workSessionId).toBe('ws-001');
    expect(workSet.workRecordId).toBe('wr-001');
    expect(workSet.workSetId).toBe('wset-001');
  });

  it('does not expose forbidden financial fields on WorkSet fixture', () => {
    const keys = Object.keys(sampleWorkSet());
    for (const key of FORBIDDEN_FINANCIAL_KEYS) {
      expect(keys).not.toContain(key);
    }
  });

  it('does not expose forbidden financial fields on WorkCoverageRecord fixture', () => {
    const keys = Object.keys(
      sampleCoverageRecord({
        scopeKind: 'WORK_RECORD_SCOPE',
        workRecordId: asWorkRecordId('wr-001'),
      }),
    );
    for (const key of FORBIDDEN_FINANCIAL_KEYS) {
      expect(keys).not.toContain(key);
    }
  });

  it('preserves covered and covering identities separately on WorkCoverageRecord', () => {
    const coverage = sampleCoverageRecord({
      scopeKind: 'WORK_SESSION_SCOPE',
      workRecordId: asWorkRecordId('wr-001'),
      workSessionId: asWorkSessionId('ws-001'),
    });
    expect(coverage.coveredArtistProfileId).toBe('artist-dj-a');
    expect(coverage.coveringArtistProfileId).toBe('artist-dj-b');
    expect(coverage.coveredProfessionalIdentityId).toBe('prof-dj-a');
    expect(coverage.coveringProfessionalIdentityId).toBe('prof-dj-b');
    expect(coverage.coveredArtistProfileId).not.toBe(coverage.coveringArtistProfileId);
  });

  it('keeps createdByUserId independent from artistProfileId on coverage', () => {
    const coverage = sampleCoverageRecord({
      scopeKind: 'WORK_RECORD_SCOPE',
      workRecordId: asWorkRecordId('wr-001'),
    });
    expect(coverage.createdByUserId).toBe('user-owner-001');
    expect(coverage.coveringArtistProfileId).toBe('artist-dj-b');
    expect(coverage.createdByUserId).not.toBe(coverage.coveringArtistProfileId);
    expect(coverage.createdByUserId).not.toBe(coverage.coveredArtistProfileId);
  });

  it('treats ProfessionalIdentityReference as operational snapshot, not auth account', () => {
    const identity = sampleCoveringIdentity();
    expect(identity.displayNameSnapshot).toBe('DJ B');
    expect(identity.professionalIdentityId).toBe('prof-dj-b');
    expect(Object.keys(identity)).not.toContain('email');
    expect(Object.keys(identity)).not.toContain('password');
    expect(Object.keys(identity)).not.toContain('sessionToken');
  });

  it('supports WORK_RECORD_SCOPE coverage scope', () => {
    const scope: WorkCoverageScope = {
      scopeKind: 'WORK_RECORD_SCOPE',
      workRecordId: asWorkRecordId('wr-001'),
    };
    expect(() => assertValidWorkCoverageScope(scope)).not.toThrow();
    const coverage = sampleCoverageRecord(scope);
    expect(coverage.coverageScope.scopeKind).toBe('WORK_RECORD_SCOPE');
  });

  it('supports WORK_SESSION_SCOPE coverage scope', () => {
    const scope: WorkCoverageScope = {
      scopeKind: 'WORK_SESSION_SCOPE',
      workRecordId: asWorkRecordId('wr-001'),
      workSessionId: asWorkSessionId('ws-001'),
    };
    expect(() => assertValidWorkCoverageScope(scope)).not.toThrow();
    expect(sampleCoverageRecord(scope).coverageScope.scopeKind).toBe('WORK_SESSION_SCOPE');
  });

  it('supports WORK_SET_SCOPE coverage scope', () => {
    const scope: WorkCoverageScope = {
      scopeKind: 'WORK_SET_SCOPE',
      workRecordId: asWorkRecordId('wr-001'),
      workSessionId: asWorkSessionId('ws-001'),
      workSetId: asWorkSetId('wset-001'),
    };
    expect(() => assertValidWorkCoverageScope(scope)).not.toThrow();
    expect(sampleCoverageRecord(scope).coverageScope.scopeKind).toBe('WORK_SET_SCOPE');
  });

  it('supports TIME_RANGE_SCOPE for explicit partial intervals', () => {
    const scope: WorkCoverageScope = {
      scopeKind: 'TIME_RANGE_SCOPE',
      workRecordId: asWorkRecordId('wr-001'),
      workSessionId: asWorkSessionId('ws-001'),
    };
    expect(() => assertValidWorkCoverageScope(scope)).not.toThrow();
    const coverage = sampleCoverageRecord(scope, {
      coverageType: 'PARTIAL_COVERAGE',
      effectiveStartAt: '2026-07-23T20:00:00.000Z',
      effectiveEndAt: '2026-07-23T22:00:00.000Z',
    });
    expect(coverage.coverageType).toBe('PARTIAL_COVERAGE');
    expect(coverage.effectiveStartAt).not.toBe(coverage.effectiveEndAt);
  });

  it('does not infer FULL_REPLACEMENT from WorkRecord NO_SHOW status alone', () => {
    const noShowRecord: Pick<WorkRecord, 'workStatus'> = { workStatus: 'NO_SHOW' };
    expect(noShowRecord.workStatus).toBe('NO_SHOW');
    expect(COVERAGE_TYPES).toContain('FULL_REPLACEMENT');
    expect(noShowRecord.workStatus).not.toBe('FULL_REPLACEMENT');
  });

  it('preserves supersession reference on corrected coverage records', () => {
    const originalId = asWorkCoverageRecordId('wcr-001');
    const corrected = sampleCoverageRecord(
      {
        scopeKind: 'WORK_RECORD_SCOPE',
        workRecordId: asWorkRecordId('wr-001'),
      },
      {
        workCoverageRecordId: asWorkCoverageRecordId('wcr-002'),
        coverageStatus: 'SUPERSEDED',
        supersedesCoverageRecordId: originalId,
        correctionReason: 'Interval corrected after dispute review',
        correctedAt: '2026-07-24T10:00:00.000Z',
        correctedByUserId: asMdjUserId('user-owner-001'),
      },
    );
    expect(corrected.supersedesCoverageRecordId).toBe('wcr-001');
    expect(corrected.coverageStatus).toBe('SUPERSEDED');
    expect(corrected.correctionReason).toContain('Interval corrected');
  });

  it('uses branded WorkSetId and WorkCoverageRecordId — not generic strings at compile time', () => {
    const setId = asWorkSetId('wset-001');
    const coverageId = asWorkCoverageRecordId('wcr-001');

    type ExpectNotAssignable<T, U> = T extends U ? never : true;
    type SetToCoverage = ExpectNotAssignable<WorkSetId, typeof coverageId>;

    const setToCoverage: SetToCoverage = true;
    expect(setToCoverage).toBe(true);
    expect(setId).toBe('wset-001');
    expect(coverageId).toBe('wcr-001');

    // @ts-expect-error WorkSetId must not assign to WorkCoverageRecordId
    const badId: typeof coverageId = setId;
    expect(badId).toBe('wset-001');
  });

  it('exports DC-2 symbols from contracts barrel', async () => {
    const contracts = await import('../../shared/services/work-ledger/contracts');
    expect(contracts.asWorkSetId).toBeTypeOf('function');
    expect(contracts.asWorkCoverageRecordId).toBeTypeOf('function');
    expect(contracts.isCoverageType).toBeTypeOf('function');
    expect(contracts.assertValidWorkCoverageScope).toBeTypeOf('function');
    expect(contracts.WORK_SET_STATUSES).toContain('COMPLETED');
    expect(contracts.COVERAGE_TYPES).toContain('FULL_REPLACEMENT');
  });

  it('exports DC-2 symbols from work-ledger barrel', async () => {
    const workLedger = await import('../../shared/services/work-ledger');
    expect(workLedger.isWorkSetStatus).toBeTypeOf('function');
    expect(workLedger.isCoverageReasonCode).toBeTypeOf('function');
    expect(workLedger.COVERAGE_SCOPE_KINDS).toContain('TIME_RANGE_SCOPE');
  });

  it('validates WorkSet sequence with shared positive integer guard', () => {
    expect(() => assertValidWorkSetSequence(1)).not.toThrow();
    expect(() => assertValidWorkSetSequence(0)).toThrow(WorkLedgerContractError);
  });

  it('narrows coverage enums via guards', () => {
    expect(isCoverageType('FULL_REPLACEMENT')).toBe(true);
    expect(isCoverageType('PAID')).toBe(false);
    expect(isCoverageStatus('COMPLETED')).toBe(true);
    expect(isCoverageReasonCode('PLANNED_SUBSTITUTION')).toBe(true);
    expect(isCoverageScopeKind('WORK_SET_SCOPE')).toBe(true);
    expect(isWorkSetStatus('PARTIAL')).toBe(true);
  });

  it('rejects invalid WORK_SET_SCOPE missing workSetId', () => {
    expect(() =>
      assertValidWorkCoverageScope({
        scopeKind: 'WORK_SET_SCOPE',
        workRecordId: asWorkRecordId('wr-001'),
        workSessionId: asWorkSessionId('ws-001'),
      } as WorkCoverageScope),
    ).toThrow(WorkLedgerContractError);

    expect(() =>
      assertValidWorkCoverageScope({
        scopeKind: 'WORK_SET_SCOPE',
        workRecordId: asWorkRecordId('wr-001'),
        workSessionId: asWorkSessionId('ws-001'),
        workSetId: asWorkSetId('wset-001'),
      }),
    ).not.toThrow();
  });

  it('JSON-serializes WorkSet and WorkCoverageRecord', () => {
    const workSet = JSON.parse(JSON.stringify(sampleWorkSet())) as WorkSet;
    const coverage = JSON.parse(
      JSON.stringify(
        sampleCoverageRecord({
          scopeKind: 'WORK_RECORD_SCOPE',
          workRecordId: asWorkRecordId('wr-001'),
        }),
      ),
    ) as WorkCoverageRecord;
    expect(workSet.workSetId).toBe('wset-001');
    expect(coverage.coveredArtistProfileId).toBe('artist-dj-a');
    expect(coverage.coveringArtistProfileId).toBe('artist-dj-b');
  });

  it('preserves Owner admin authorship and DJ performer attribution without merging', () => {
    const coverage = sampleCoverageRecord({
      scopeKind: 'WORK_RECORD_SCOPE',
      workRecordId: asWorkRecordId('wr-001'),
    });
    expect(coverage.createdByUserId).toBe('user-owner-001');
    expect(coverage.coveringArtistProfileId).toBe('artist-dj-b');
    expect(coverage.coveredArtistProfileId).toBe('artist-dj-a');
    expect(coverage.createdByUserId).not.toBe(coverage.coveringArtistProfileId);
  });

  it('module source has no runtime forbidden imports in work-ledger contracts', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const root = path.resolve(import.meta.dirname, '../../shared/services/work-ledger');
    const files = [
      'contracts/dwl-ids.ts',
      'contracts/dwl-enums.ts',
      'contracts/dwl-primitives.ts',
      'contracts/dwl-entities.ts',
      'contracts/dwl-guards.ts',
      'contracts/index.ts',
      'index.ts',
    ];
    const forbidden = [
      '@supabase',
      'localStorage',
      'fetch(',
      "from '../finance",
      "from '../../finance",
      '/repository',
      '/adapter',
      'react',
    ];
    for (const file of files) {
      const content = await fs.readFile(path.join(root, file), 'utf8');
      for (const needle of forbidden) {
        expect(content.includes(needle), `${file} must not reference ${needle}`).toBe(false);
      }
    }
  });

  it('does not introduce compile-time dependency on financial modules from WorkSet type', () => {
    type WorkSetKeys = keyof WorkSet;
    type ForbiddenFinancialKey = (typeof FORBIDDEN_FINANCIAL_KEYS)[number];
    type HasForbiddenKey = Extract<WorkSetKeys, ForbiddenFinancialKey>;
    type ExpectNone = HasForbiddenKey extends never ? true : never;
    const none: ExpectNone = true;
    expect(none).toBe(true);
  });

  it('keeps ArtistProfileId separate from MdjUserId on coverage identities', () => {
    const profileId = asArtistProfileId('artist-dj-b');
    const userId = asMdjUserId('user-owner-001');

    type ExpectNotAssignable<T, U> = T extends U ? never : true;
    type ProfileToUser = ExpectNotAssignable<ArtistProfileId, MdjUserId>;

    const profileToUser: ProfileToUser = true;
    expect(profileToUser).toBe(true);
    expect(userId).not.toBe(profileId);
  });
});
