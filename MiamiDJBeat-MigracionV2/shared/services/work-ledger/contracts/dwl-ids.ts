/** DWL data contracts — nominal IDs — DC-1 + DC-2 */

/**
 * Branded string IDs — compile-time nominal separation (pattern: OFTL FinancialObligationId).
 * JSON serialization remains a plain string value.
 */
export type WorkRecordId = string & { readonly __brand: 'WorkRecordId' };
export type WorkSessionId = string & { readonly __brand: 'WorkSessionId' };
export type WorkSetId = string & { readonly __brand: 'WorkSetId' };
export type WorkCoverageRecordId = string & { readonly __brand: 'WorkCoverageRecordId' };
export type WorkAssignmentReferenceId = string & {
  readonly __brand: 'WorkAssignmentReferenceId';
};
export type ProfessionalIdentityId = string & { readonly __brand: 'ProfessionalIdentityId' };

/** Opaque cross-domain references — validated at persistence boundary. */
export type EventId = string & { readonly __brand: 'EventId' };
export type VenueId = string & { readonly __brand: 'VenueId' };

/** Identity separation — artist profile ≠ user account (DWL-DC1-INV-04, INV-13). */
export type ArtistProfileId = string & { readonly __brand: 'ArtistProfileId' };
export type MdjUserId = string & { readonly __brand: 'MdjUserId' };

/** Boundary cast helpers — no runtime validation in DC-1. */
export function asWorkRecordId(value: string): WorkRecordId {
  return value as WorkRecordId;
}

export function asWorkSessionId(value: string): WorkSessionId {
  return value as WorkSessionId;
}

export function asWorkSetId(value: string): WorkSetId {
  return value as WorkSetId;
}

export function asWorkCoverageRecordId(value: string): WorkCoverageRecordId {
  return value as WorkCoverageRecordId;
}

export function asWorkAssignmentReferenceId(value: string): WorkAssignmentReferenceId {
  return value as WorkAssignmentReferenceId;
}

export function asProfessionalIdentityId(value: string): ProfessionalIdentityId {
  return value as ProfessionalIdentityId;
}

export function asEventId(value: string): EventId {
  return value as EventId;
}

export function asVenueId(value: string): VenueId {
  return value as VenueId;
}

export function asArtistProfileId(value: string): ArtistProfileId {
  return value as ArtistProfileId;
}

export function asMdjUserId(value: string): MdjUserId {
  return value as MdjUserId;
}
