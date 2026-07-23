/** DWL data contracts — core entities — TICKET-V2-DWL-DC-1-CORE-WORK-CONTRACTS-001 */

import type {
  AttendanceStatus,
  PerformanceStatus,
  WorkRecordStatus,
  WorkRole,
  WorkSessionStatus,
} from './dwl-enums';
import type {
  ArtistProfileId,
  EventId,
  MdjUserId,
  ProfessionalIdentityId,
  VenueId,
  WorkAssignmentReferenceId,
  WorkRecordId,
  WorkSessionId,
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
