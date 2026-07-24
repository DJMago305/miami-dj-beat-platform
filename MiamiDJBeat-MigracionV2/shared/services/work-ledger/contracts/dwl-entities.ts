/** DWL data contracts — core entities — DC-1 + DC-2 (C-003 WorkSet · C-005 WorkCoverageRecord) */

import type {
  AttendanceStatus,
  CoverageReasonCode,
  CoverageScopeKind,
  CoverageStatus,
  CoverageType,
  PerformanceStatus,
  WorkRecordStatus,
  WorkRole,
  WorkSessionStatus,
  WorkSetStatus,
  WorkSetType,
} from './dwl-enums';
import type {
  ArtistProfileId,
  EventId,
  MdjUserId,
  ProfessionalIdentityId,
  VenueId,
  WorkAssignmentReferenceId,
  WorkCoverageRecordId,
  WorkRecordId,
  WorkSessionId,
  WorkSetId,
} from './dwl-ids';
import type {
  IanaTimezone,
  IsoDateString,
  IsoDateTimeString,
  WorkAuditMetadata,
  WorkLedgerSchemaVersion,
  WorkSourceReference,
} from './dwl-primitives';

/** DWL-C-004 — stable link to roster assignment; not a full Assignment entity. */
export type WorkAssignmentReference = {
  readonly schemaVersion: WorkLedgerSchemaVersion;
  readonly assignmentReferenceId: WorkAssignmentReferenceId;
  readonly externalAssignmentId: string;
  readonly eventId: EventId;
  readonly artistProfileId: ArtistProfileId;
  readonly sourceSystem: WorkSourceReference['sourceSystem'];
  readonly sourceReference: WorkSourceReference;
  readonly capturedAt: IsoDateTimeString;
};

/** DWL-C-011 — professional identity snapshot at work capture time. */
export type ProfessionalIdentityReference = {
  readonly schemaVersion: WorkLedgerSchemaVersion;
  readonly professionalIdentityId: ProfessionalIdentityId;
  readonly artistProfileId: ArtistProfileId;
  readonly displayNameSnapshot: string;
  readonly workRole: WorkRole;
  readonly profileReference?: string;
};

/** DWL-C-001 — canonical operational work fact. Not payment · not obligation · not CF. */
export type WorkRecord = {
  readonly schemaVersion: WorkLedgerSchemaVersion;
  readonly workRecordId: WorkRecordId;
  readonly eventId: EventId;
  readonly venueId?: VenueId;
  readonly assignmentReference?: WorkAssignmentReference;
  readonly artistProfileId: ArtistProfileId;
  readonly professionalIdentity: ProfessionalIdentityReference;
  readonly scheduledDate: IsoDateString;
  readonly timezone: IanaTimezone;
  readonly workRole: WorkRole;
  readonly workStatus: WorkRecordStatus;
  readonly attendanceStatus: AttendanceStatus;
  readonly performanceStatus: PerformanceStatus;
  readonly sourceReference: WorkSourceReference;
  readonly createdByUserId: MdjUserId;
  readonly auditMetadata: WorkAuditMetadata;
};

/**
 * DWL-C-002 — operational session within a WorkRecord.
 * Cardinality: WorkSession → workRecordId (sessions not embedded on WorkRecord).
 */
export type WorkSession = {
  readonly schemaVersion: WorkLedgerSchemaVersion;
  readonly workSessionId: WorkSessionId;
  readonly workRecordId: WorkRecordId;
  readonly sequence: number;
  readonly scheduledStartAt: IsoDateTimeString;
  readonly scheduledEndAt: IsoDateTimeString;
  readonly actualStartAt?: IsoDateTimeString;
  readonly actualEndAt?: IsoDateTimeString;
  readonly timezone: IanaTimezone;
  readonly sessionStatus: WorkSessionStatus;
  readonly venueId?: VenueId;
  readonly notes?: string;
  readonly auditMetadata: WorkAuditMetadata;
};

/**
 * DWL-C-003 — optional operational subdivision of a WorkSession.
 * Not compensation · not metrics SSOT · always requires parent WorkSession.
 */
export type WorkSet = {
  readonly schemaVersion: WorkLedgerSchemaVersion;
  readonly workSetId: WorkSetId;
  readonly workSessionId: WorkSessionId;
  readonly workRecordId: WorkRecordId;
  readonly sequence: number;
  readonly label?: string;
  readonly scheduledStartAt: IsoDateTimeString;
  readonly scheduledEndAt: IsoDateTimeString;
  readonly actualStartAt?: IsoDateTimeString;
  readonly actualEndAt?: IsoDateTimeString;
  readonly setStatus: WorkSetStatus;
  readonly setType?: WorkSetType;
  readonly venueId?: VenueId;
  readonly stageReference?: string;
  readonly performedByProfessionalIdentity?: ProfessionalIdentityReference;
  readonly performedByArtistProfileId?: ArtistProfileId;
  readonly notes?: string;
  readonly sourceReference: WorkSourceReference;
  readonly auditMetadata: WorkAuditMetadata;
};

/** Provisional authorization metadata — Evidence/Approval deferred to DC-3. */
export type WorkCoverageAuthorizationContext = {
  readonly authorizedByUserId?: MdjUserId;
  readonly authorizationReference?: string;
  readonly provisional?: boolean;
};

/** Exactly one explicit coverage scope per record (DC-2 §18.1). */
export type WorkCoverageScope =
  | {
      readonly scopeKind: Extract<CoverageScopeKind, 'WORK_RECORD_SCOPE'>;
      readonly workRecordId: WorkRecordId;
    }
  | {
      readonly scopeKind: Extract<CoverageScopeKind, 'WORK_SESSION_SCOPE'>;
      readonly workRecordId: WorkRecordId;
      readonly workSessionId: WorkSessionId;
    }
  | {
      readonly scopeKind: Extract<CoverageScopeKind, 'WORK_SET_SCOPE'>;
      readonly workRecordId: WorkRecordId;
      readonly workSessionId: WorkSessionId;
      readonly workSetId: WorkSetId;
    }
  | {
      readonly scopeKind: Extract<CoverageScopeKind, 'TIME_RANGE_SCOPE'>;
      readonly workRecordId: WorkRecordId;
      readonly workSessionId?: WorkSessionId;
      readonly workSetId?: WorkSetId;
    };

/**
 * DWL-C-005 — canonical coverage/substitution fact.
 * Preserves original assigned identity and covering performer separately.
 * Not payment · not compensation · not obligation · not dispute resolution.
 */
export type WorkCoverageRecord = {
  readonly schemaVersion: WorkLedgerSchemaVersion;
  readonly workCoverageRecordId: WorkCoverageRecordId;
  readonly workRecordId: WorkRecordId;
  readonly coverageType: CoverageType;
  readonly coverageStatus: CoverageStatus;
  readonly coverageScope: WorkCoverageScope;
  readonly coveredArtistProfileId: ArtistProfileId;
  readonly coveredProfessionalIdentityId: ProfessionalIdentityId;
  readonly coveringArtistProfileId: ArtistProfileId;
  readonly coveringProfessionalIdentityId: ProfessionalIdentityId;
  readonly effectiveStartAt: IsoDateTimeString;
  readonly effectiveEndAt: IsoDateTimeString;
  readonly reasonCode: CoverageReasonCode;
  readonly reasonNotes?: string;
  readonly authorizationContext?: WorkCoverageAuthorizationContext;
  readonly sourceReference: WorkSourceReference;
  readonly createdByUserId: MdjUserId;
  readonly auditMetadata: WorkAuditMetadata;
  readonly supersedesCoverageRecordId?: WorkCoverageRecordId;
  readonly correctionReason?: string;
  readonly correctedAt?: IsoDateTimeString;
  readonly correctedByUserId?: MdjUserId;
};
