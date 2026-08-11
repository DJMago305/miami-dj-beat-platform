/** Staff Mutations domain — public barrel (Writers Phase · Slice 3 · Paso 2). */

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
  fingerprintAssignArtistToBooking,
  fingerprintReviewOfflinePayment,
  mapAssignArtistToBookingToLabRecord,
  mapReviewOfflinePaymentToLabRecord,
  nextStaffLabRecordId,
  redactAssignArtistToBooking,
  redactReviewOfflinePayment,
  resetStaffLabRecordIdSequence,
} from './staff-mutations.map-rows';
export type {
  LabArtistAssignmentRecord,
  LabOfflinePaymentReviewRecord,
  LabStaffMutationRecord,
} from './staff-mutations.map-rows';

export {
  createStaffMutationsAdapter,
  listStaffMutationsAdapterWriteMethods,
} from './staff-mutations.adapter';
export type {
  AssignArtistToBookingInput,
  CreateStaffMutationsAdapterInput,
  ReviewOfflinePaymentInput,
  StaffMutationSessionInput,
  StaffMutationsAdapter,
} from './staff-mutations.adapter';
