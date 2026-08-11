/** Artist Mutations domain — public barrel (Writers Phase · Slice 2 · Paso 2). */

export {
  createLabIdempotencyStore,
} from '../client-mutations/lab-idempotency.store';
export type {
  LabIdempotencyLookup,
  LabIdempotencyMutationKind,
  LabIdempotencyRecord,
  LabIdempotencyScopeKey,
  LabIdempotencyStore,
} from '../client-mutations/lab-idempotency.store';

export {
  fingerprintAcknowledgePayout,
  fingerprintRespondGigAssignment,
  mapAcknowledgePayoutToLabRecord,
  mapRespondGigAssignmentToLabRecord,
  nextArtistLabRecordId,
  redactAcknowledgePayout,
  redactRespondGigAssignment,
  resetArtistLabRecordIdSequence,
} from './artist-mutations.map-rows';
export type {
  LabArtistMutationRecord,
  LabGigAssignmentRecord,
  LabPayoutAckRecord,
} from './artist-mutations.map-rows';

export {
  createArtistMutationsAdapter,
  listArtistMutationsAdapterWriteMethods,
} from './artist-mutations.adapter';
export type {
  AcknowledgePayoutInput,
  ArtistMutationSessionInput,
  ArtistMutationsAdapter,
  CreateArtistMutationsAdapterInput,
  RespondGigAssignmentInput,
} from './artist-mutations.adapter';
