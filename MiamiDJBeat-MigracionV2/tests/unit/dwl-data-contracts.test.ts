/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import {
  WorkLedgerContractError,
  assertValidWorkSessionSequence,
  asArtistProfileId,
  asEventId,
  asMdjUserId,
  asProfessionalIdentityId,
  asVenueId,
  asWorkAssignmentReferenceId,
  asWorkRecordId,
  asWorkSessionId,
  isAttendanceStatus,
  isPerformanceStatus,
  isWorkRecordStatus,
  isWorkRole,
  isWorkSessionStatus,
  type ArtistProfileId,
  type MdjUserId,
  type ProfessionalIdentityId,
  type ProfessionalIdentityReference,
  type WorkAssignmentReference,
  type WorkRecord,
  type WorkRecordId,
  type WorkSession,
  type WorkSessionId,
} from '../../shared/services/work-ledger/contracts';

const SOURCE = { sourceSystem: 'staff_manual' as const, sourceRecordId: 'src-001' };

const sampleAudit = () => ({
  createdAt: '2026-07-23T12:00:00.000Z',
  createdByUserId: asMdjUserId('user-owner-001'),
  sourceReference: SOURCE,
  schemaVersion: 1 as const,
});

const sampleProfessionalIdentity = (): ProfessionalIdentityReference => ({
  schemaVersion: 1,
  professionalIdentityId: asProfessionalIdentityId('prof-djmago305'),
  artistProfileId: asArtistProfileId('artist-djmago305'),
  displayNameSnapshot: 'DJMago305',
  workRole: 'DJ',
  profileReference: 'dj-profile-djmago305',
});

const sampleAssignmentReference = (): WorkAssignmentReference => ({
  schemaVersion: 1,
  assignmentReferenceId: asWorkAssignmentReferenceId('asgn-ref-001'),
  externalAssignmentId: 'evt-asgn-001',
  eventId: asEventId('event-001'),
  artistProfileId: asArtistProfileId('artist-djmago305'),
  sourceSystem: 'events_roster',
  sourceReference: { sourceSystem: 'events_roster', sourceRecordId: 'roster-001' },
  capturedAt: '2026-07-23T10:00:00.000Z',
});

const sampleWorkRecord = (): WorkRecord => ({
  schemaVersion: 1,
  workRecordId: asWorkRecordId('wr-001'),
  eventId: asEventId('event-001'),
  venueId: asVenueId('venue-001'),
  assignmentReference: sampleAssignmentReference(),
  artistProfileId: asArtistProfileId('artist-djmago305'),
  professionalIdentity: sampleProfessionalIdentity(),
  scheduledDate: '2026-07-23',
  timezone: 'America/New_York',
  workRole: 'DJ',
  workStatus: 'COMPLETED',
  attendanceStatus: 'ARRIVED',
  performanceStatus: 'COMPLETED',
  sourceReference: SOURCE,
  createdByUserId: asMdjUserId('user-owner-001'),
  auditMetadata: sampleAudit(),
});

const sampleWorkSession = (): WorkSession => ({
  schemaVersion: 1,
  workSessionId: asWorkSessionId('ws-001'),
  workRecordId: asWorkRecordId('wr-001'),
  sequence: 1,
  scheduledStartAt: '2026-07-23T20:00:00.000Z',
  scheduledEndAt: '2026-07-24T02:00:00.000Z',
  timezone: 'America/New_York',
  sessionStatus: 'COMPLETED',
  auditMetadata: sampleAudit(),
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
] as const;

describe('DWL data contracts — TICKET-V2-DWL-DC-1-CORE-WORK-CONTRACTS-001', () => {
  it('builds valid WorkRecord fixture', () => {
    const record = sampleWorkRecord();
    expect(record.workRecordId).toBe('wr-001');
    expect(record.artistProfileId).toBe('artist-djmago305');
    expect(record.professionalIdentity.displayNameSnapshot).toBe('DJMago305');
  });

  it('builds valid WorkSession fixture', () => {
    const session = sampleWorkSession();
    expect(session.workSessionId).toBe('ws-001');
    expect(session.sequence).toBe(1);
  });

  it('builds valid WorkAssignmentReference fixture', () => {
    const ref = sampleAssignmentReference();
    expect(ref.assignmentReferenceId).toBe('asgn-ref-001');
    expect(ref.externalAssignmentId).toBe('evt-asgn-001');
  });

  it('builds valid ProfessionalIdentityReference fixture', () => {
    const identity = sampleProfessionalIdentity();
    expect(identity.professionalIdentityId).toBe('prof-djmago305');
    expect(identity.workRole).toBe('DJ');
  });

  it('JSON-serializes WorkRecord', () => {
    const roundtrip = JSON.parse(JSON.stringify(sampleWorkRecord())) as WorkRecord;
    expect(roundtrip.schemaVersion).toBe(1);
    expect(roundtrip.workStatus).toBe('COMPLETED');
  });

  it('JSON-serializes WorkSession', () => {
    const roundtrip = JSON.parse(JSON.stringify(sampleWorkSession())) as WorkSession;
    expect(roundtrip.workRecordId).toBe('wr-001');
    expect(roundtrip.sessionStatus).toBe('COMPLETED');
  });

  it('serializes branded IDs as plain strings in JSON', () => {
    const parsed = JSON.parse(JSON.stringify(sampleWorkRecord())) as {
      workRecordId: string;
      artistProfileId: string;
    };
    expect(typeof parsed.workRecordId).toBe('string');
    expect(typeof parsed.artistProfileId).toBe('string');
  });

  it('keeps WorkRecordId and WorkSessionId nominally incompatible at compile time', () => {
    const recordId = asWorkRecordId('wr-001');
    const sessionId = asWorkSessionId('ws-001');

    type ExpectNotAssignable<T, U> = T extends U ? never : true;
    type RecordToSession = ExpectNotAssignable<WorkRecordId, WorkSessionId>;

    const recordToSession: RecordToSession = true;
    expect(recordToSession).toBe(true);
    expect(sessionId).toBe('ws-001');

    // @ts-expect-error WorkRecordId must not assign to WorkSessionId
    const badSessionId: WorkSessionId = recordId;
    expect(badSessionId).toBe('wr-001');
  });

  it('keeps ArtistProfileId separate from MdjUserId at compile time', () => {
    const profileId = asArtistProfileId('artist-djmago305');
    const userId = asMdjUserId('user-owner-001');

    type ExpectNotAssignable<T, U> = T extends U ? never : true;
    type ProfileToUser = ExpectNotAssignable<ArtistProfileId, MdjUserId>;

    const profileToUser: ProfileToUser = true;
    expect(profileToUser).toBe(true);
    expect(userId).toBe('user-owner-001');

    // @ts-expect-error ArtistProfileId must not assign to MdjUserId
    const badUserId: MdjUserId = profileId;
    expect(badUserId).toBe('artist-djmago305');
  });

  it('keeps ProfessionalIdentityId separate from ArtistProfileId at compile time', () => {
    const identityId = asProfessionalIdentityId('prof-djmago305');
    const profileId = asArtistProfileId('artist-djmago305');

    type ExpectNotAssignable<T, U> = T extends U ? never : true;
    type IdentityToProfile = ExpectNotAssignable<ProfessionalIdentityId, ArtistProfileId>;

    const identityToProfile: IdentityToProfile = true;
    expect(identityToProfile).toBe(true);
    expect(profileId).toBe('artist-djmago305');

    // @ts-expect-error ProfessionalIdentityId must not assign to ArtistProfileId
    const badProfileId: ArtistProfileId = identityId;
    expect(badProfileId).toBe('prof-djmago305');
  });

  it('links WorkSession to parent WorkRecordId', () => {
    const session = sampleWorkSession();
    expect(session.workRecordId).toBe('wr-001');
  });

  it('accepts sequence value 1', () => {
    expect(() => assertValidWorkSessionSequence(1)).not.toThrow();
  });

  it('accepts Number.MAX_SAFE_INTEGER as sequence', () => {
    expect(() => assertValidWorkSessionSequence(Number.MAX_SAFE_INTEGER)).not.toThrow();
  });

  it('rejects sequence value 0', () => {
    expect(() => assertValidWorkSessionSequence(0)).toThrow(WorkLedgerContractError);
  });

  it('rejects negative sequence values', () => {
    expect(() => assertValidWorkSessionSequence(-1)).toThrow(WorkLedgerContractError);
  });

  it('rejects decimal sequence values', () => {
    expect(() => assertValidWorkSessionSequence(1.5)).toThrow(WorkLedgerContractError);
  });

  it('rejects NaN sequence values', () => {
    expect(() => assertValidWorkSessionSequence(Number.NaN)).toThrow(WorkLedgerContractError);
  });

  it('rejects Infinity sequence values', () => {
    expect(() => assertValidWorkSessionSequence(Number.POSITIVE_INFINITY)).toThrow(
      WorkLedgerContractError,
    );
  });

  it('rejects -Infinity sequence values', () => {
    expect(() => assertValidWorkSessionSequence(Number.NEGATIVE_INFINITY)).toThrow(
      WorkLedgerContractError,
    );
  });

  it('rejects unsafe positive sequence integers', () => {
    expect(() => assertValidWorkSessionSequence(Number.MAX_SAFE_INTEGER + 1)).toThrow(
      WorkLedgerContractError,
    );
  });

  it('rejects unsafe negative sequence integers', () => {
    expect(() => assertValidWorkSessionSequence(Number.MIN_SAFE_INTEGER - 1)).toThrow(
      WorkLedgerContractError,
    );
  });

  it('accepts valid WorkRecordStatus values via guard', () => {
    expect(isWorkRecordStatus('COMPLETED')).toBe(true);
    expect(isWorkRecordStatus('INVALID')).toBe(false);
  });

  it('rejects invalid WorkRecordStatus via guard', () => {
    expect(isWorkRecordStatus('PAID')).toBe(false);
  });

  it('narrows AttendanceStatus via guard', () => {
    expect(isAttendanceStatus('ARRIVED')).toBe(true);
    expect(isAttendanceStatus('UNKNOWN_STATUS')).toBe(false);
  });

  it('narrows PerformanceStatus via guard', () => {
    expect(isPerformanceStatus('COMPLETED')).toBe(true);
    expect(isPerformanceStatus('PAID')).toBe(false);
  });

  it('narrows WorkSessionStatus via guard', () => {
    expect(isWorkSessionStatus('SCHEDULED')).toBe(true);
    expect(isWorkSessionStatus('POSTED')).toBe(false);
  });

  it('narrows WorkRole via guard', () => {
    expect(isWorkRole('DJ')).toBe(true);
    expect(isWorkRole('OWNER')).toBe(false);
  });

  it('exports public contract symbols from contracts barrel', async () => {
    const contracts = await import('../../shared/services/work-ledger/contracts');
    expect(contracts.assertValidWorkSessionSequence).toBeTypeOf('function');
    expect(contracts.asWorkRecordId).toBeTypeOf('function');
    expect(contracts.WORK_RECORD_STATUSES.length).toBeGreaterThan(0);
  });

  it('exports public contract symbols from work-ledger barrel', async () => {
    const workLedger = await import('../../shared/services/work-ledger');
    expect(workLedger.isWorkRole).toBeTypeOf('function');
    expect(workLedger.WORK_ROLES).toContain('DJ');
  });

  it('does not expose forbidden financial fields on core fixtures', () => {
    const recordKeys = Object.keys(sampleWorkRecord());
    const sessionKeys = Object.keys(sampleWorkSession());
    for (const key of FORBIDDEN_FINANCIAL_KEYS) {
      expect(recordKeys).not.toContain(key);
      expect(sessionKeys).not.toContain(key);
    }
  });

  it('module source has no runtime forbidden imports', async () => {
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
      'sessionStorage',
      'fetch(',
      'XMLHttpRequest',
      'rpc',
      'process.env',
      'navigator',
      "from '../provider",
      'from "./provider',
      "from '../../provider",
      "from '../finance",
      "from '../../finance",
      '/repository',
      '/adapter',
      'react',
      'window.',
      'document.',
    ];
    for (const file of files) {
      const content = await fs.readFile(path.join(root, file), 'utf8');
      for (const needle of forbidden) {
        expect(content.includes(needle), `${file} must not reference ${needle}`).toBe(false);
      }
    }
  });

  it('JSON-serializes WorkAssignmentReference and ProfessionalIdentityReference', () => {
    const assignment = JSON.parse(JSON.stringify(sampleAssignmentReference())) as WorkAssignmentReference;
    const identity = JSON.parse(
      JSON.stringify(sampleProfessionalIdentity()),
    ) as ProfessionalIdentityReference;
    expect(assignment.externalAssignmentId).toBe('evt-asgn-001');
    expect(identity.displayNameSnapshot).toBe('DJMago305');
  });

  it('preserves Owner account, DJMago305 profile and identity separately in JSON', () => {
    const parsed = JSON.parse(JSON.stringify(sampleWorkRecord())) as {
      createdByUserId: string;
      artistProfileId: string;
      professionalIdentity: { professionalIdentityId: string; displayNameSnapshot: string };
    };
    expect(parsed.createdByUserId).toBe('user-owner-001');
    expect(parsed.artistProfileId).toBe('artist-djmago305');
    expect(parsed.professionalIdentity.professionalIdentityId).toBe('prof-djmago305');
    expect(parsed.professionalIdentity.displayNameSnapshot).toBe('DJMago305');
    expect(parsed.createdByUserId).not.toBe(parsed.artistProfileId);
    expect(parsed.createdByUserId).not.toBe(parsed.professionalIdentity.professionalIdentityId);
  });

  it('preserves professional display name snapshot independent of user account', () => {
    const record = sampleWorkRecord();
    expect(record.professionalIdentity.displayNameSnapshot).toBe('DJMago305');
    expect(record.createdByUserId).toBe('user-owner-001');
    expect(record.artistProfileId).toBe('artist-djmago305');
    expect(record.createdByUserId).not.toBe(record.artistProfileId);
  });

  it('represents Owner/DJMago305 without merging identities', () => {
    const record = sampleWorkRecord();
    expect(record.createdByUserId).toBe('user-owner-001');
    expect(record.artistProfileId).toBe('artist-djmago305');
    expect(record.professionalIdentity.artistProfileId).toBe('artist-djmago305');
    expect(record.professionalIdentity.displayNameSnapshot).toBe('DJMago305');
  });

  it('uses ISO strings only — no Date or BigInt in serialized WorkRecord', () => {
    const record = sampleWorkRecord();
    expect(record.scheduledDate).not.toBeInstanceOf(Date);
    const parsed = JSON.parse(JSON.stringify(record)) as WorkRecord;
    expect(typeof parsed.scheduledDate).toBe('string');
    expect(typeof parsed.auditMetadata.createdAt).toBe('string');
    expect(parsed.scheduledDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
