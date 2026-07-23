/** DWL data contracts — enumerations — TICKET-V2-DWL-DC-1-CORE-WORK-CONTRACTS-001 */

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
