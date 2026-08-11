/** Client Mutations domain — public barrel (Writers Phase · Slice 1 · Paso 2). */

export {
  createLabIdempotencyStore,
} from './lab-idempotency.store';
export type {
  LabIdempotencyLookup,
  LabIdempotencyMutationKind,
  LabIdempotencyRecord,
  LabIdempotencyScopeKey,
  LabIdempotencyStore,
} from './lab-idempotency.store';

export {
  fingerprintCreateBookingRequest,
  fingerprintSubmitOfflinePaymentProof,
  mapCreateBookingRequestToLabRecord,
  mapSubmitOfflinePaymentProofToLabRecord,
  nextLabRecordId,
  redactCreateBookingRequest,
  redactSubmitOfflinePaymentProof,
  resetLabRecordIdSequence,
} from './client-mutations.map-rows';
export type {
  LabBookingRequestRecord,
  LabMutationRecord,
  LabOfflinePaymentProofRecord,
} from './client-mutations.map-rows';

export {
  createClientMutationsAdapter,
  listClientMutationsAdapterWriteMethods,
} from './client-mutations.adapter';
export type {
  ClientMutationSessionInput,
  ClientMutationsAdapter,
  CreateClientMutationsAdapterInput,
  SubmitBookingRequestInput,
  SubmitOfflinePaymentProofInput,
} from './client-mutations.adapter';
