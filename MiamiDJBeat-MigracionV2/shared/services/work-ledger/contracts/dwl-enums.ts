/** DWL data contracts — enumerations — DC-1 + DC-2 */

/** Performer / talent role on a work record — discovery §6–7. */
export const WORK_ROLES = [
  'DJ',
  'ARTIST',
  'SINGER',
  'BAND',
  'ORCHESTRA',
  'MC',
  'DANCER',
  'TECHNICIAN',
  'VENDOR',
  'OTHER',
] as const;
export type WorkRole = (typeof WORK_ROLES)[number];

/** WorkRecord operational lifecycle — aligned with DWL specification §13. */
export const WORK_RECORD_STATUSES = [
  'DRAFT',
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'PARTIALLY_COMPLETED',
  'CANCELLED',
  'NO_SHOW',
  'SUPERSEDED',
] as const;
export type WorkRecordStatus = (typeof WORK_RECORD_STATUSES)[number];

/** Attendance tracking — discovery §7. */
export const ATTENDANCE_STATUSES = [
  'UNKNOWN',
  'EXPECTED',
  'ARRIVED',
  'LATE',
  'ABSENT',
  'EXCUSED',
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** Performance outcome — discovery §7. */
export const PERFORMANCE_STATUSES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETED',
  'PARTIAL',
  'CANCELLED',
  'REPLACED',
  'NOT_APPLICABLE',
] as const;
export type PerformanceStatus = (typeof PERFORMANCE_STATUSES)[number];

/** WorkSession lifecycle within a WorkRecord. */
export const WORK_SESSION_STATUSES = [
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'PARTIAL',
  'CANCELLED',
  'NO_SHOW',
] as const;
export type WorkSessionStatus = (typeof WORK_SESSION_STATUSES)[number];

/** Provenance systems for work ledger rows (conceptual — not persistence-bound). */
export const WORK_SOURCE_SYSTEMS = [
  'events_roster',
  'staff_manual',
  'import',
  'system_derived',
] as const;
export type WorkSourceSystem = (typeof WORK_SOURCE_SYSTEMS)[number];

/** WorkSet lifecycle within a WorkSession — aligned with session granularity (DC-2 §9). */
export const WORK_SET_STATUSES = [
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'PARTIAL',
  'CANCELLED',
  'NO_SHOW',
] as const;
export type WorkSetStatus = (typeof WORK_SET_STATUSES)[number];

/** Optional commercial/operational set classification (DC-2 §9). */
export const WORK_SET_TYPES = ['MAIN', 'OPENING', 'CLOSING', 'EXTENSION', 'OTHER'] as const;
export type WorkSetType = (typeof WORK_SET_TYPES)[number];

/** Coverage nature — distinct from CoverageStatus (DC-2 §13.1). */
export const COVERAGE_TYPES = [
  'FULL_REPLACEMENT',
  'PARTIAL_COVERAGE',
  'EMERGENCY_COVERAGE',
  'PLANNED_SUBSTITUTION',
  'LATE_TAKEOVER',
  'EARLY_RELIEF',
  'SHARED_COVERAGE',
  'OTHER',
] as const;
export type CoverageType = (typeof COVERAGE_TYPES)[number];

/** Coverage lifecycle (DC-2 §13.2). */
export const COVERAGE_STATUSES = [
  'PLANNED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'DISPUTED',
  'SUPERSEDED',
] as const;
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

/** Controlled operational reason codes — not free-text medical/legal payloads (DC-2 §12). */
export const COVERAGE_REASON_CODES = [
  'ARTIST_NO_SHOW',
  'EMERGENCY_SUBSTITUTION',
  'PLANNED_SUBSTITUTION',
  'LATE_ARRIVAL',
  'EARLY_RELIEF',
  'SHARED_PERFORMANCE',
  'OPERATIONAL_DECISION',
  'CORRECTION',
  'OTHER',
] as const;
export type CoverageReasonCode = (typeof COVERAGE_REASON_CODES)[number];

/** Discriminant for WorkCoverageRecord.coverageScope union (DC-2 §18.1). */
export const COVERAGE_SCOPE_KINDS = [
  'WORK_RECORD_SCOPE',
  'WORK_SESSION_SCOPE',
  'WORK_SET_SCOPE',
  'TIME_RANGE_SCOPE',
] as const;
export type CoverageScopeKind = (typeof COVERAGE_SCOPE_KINDS)[number];
