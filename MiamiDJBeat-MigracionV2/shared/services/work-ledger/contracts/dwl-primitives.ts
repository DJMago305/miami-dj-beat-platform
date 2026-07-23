/** DWL data contracts — shared primitives — TICKET-V2-DWL-DC-1-CORE-WORK-CONTRACTS-001 */

import type { WorkSourceSystem } from './dwl-enums';
import type { MdjUserId } from './dwl-ids';

/** ISO-8601 date-time string — no Date objects in contracts. */
export type IsoDateTimeString = string;

/** ISO-8601 calendar date (YYYY-MM-DD). */
export type IsoDateString = string;

/** IANA timezone identifier (e.g. America/New_York). */
export type IanaTimezone = string;

/** Schema evolution marker — literal for contract version. */
export type WorkLedgerSchemaVersion = 1;

/** Provenance of a work record or assignment reference. */
export type WorkSourceReference = {
  readonly sourceSystem: WorkSourceSystem;
  readonly sourceRecordId: string;
};

/** JSON-safe audit metadata — no persistence IDs, no bank/legal payloads. */
export type WorkAuditMetadata = {
  readonly createdAt: IsoDateTimeString;
  readonly createdByUserId: MdjUserId;
  readonly updatedAt?: IsoDateTimeString;
  readonly updatedByUserId?: MdjUserId;
  readonly sourceReference: WorkSourceReference;
  readonly schemaVersion: WorkLedgerSchemaVersion;
};

/** Optional bounded operational period (conceptual helper — sessions use explicit fields). */
export type WorkPeriod = {
  readonly startAt: IsoDateTimeString;
  readonly endAt: IsoDateTimeString;
};
