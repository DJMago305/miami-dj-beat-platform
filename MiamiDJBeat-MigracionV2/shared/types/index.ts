/**
 * Shared TypeScript contracts (lab).
 * Domain types live here until a dedicated `shared/services/<domain>/` package owns them.
 */

export type {
  BookingLifecycleStatus,
  BookingPaymentStatus,
  BookingSourceKind,
  BookingSnapshotDTO,
  BookingVisibilityAudience,
  CalendarSlotDTO,
  CalendarSlotKind,
  EventDetailReadDTO,
  ProductionFlowStatus,
} from './bookings.types';

export { mapV1StatusToLifecycle } from './bookings.types';

export type {
  FinancialBalanceReadDTO,
  FinancialCounterpartyRole,
  FinancialDirectionRead,
  FinancialSourceSystem,
  FinancialTransactionKind,
  FinancialVisibilityAudience,
  PaymentMethodRead,
  PaymentReceiptReadDTO,
  PaymentTransactionStatus,
  TransactionHistoryDTO,
} from './financial.types';

export { mapV1PaymentSignalToTransactionStatus } from './financial.types';

export type {
  EventWeatherAlertDTO,
  VenueOutdoorRiskDTO,
  WeatherAlertSourceKind,
  WeatherEventWindowPhase,
  WeatherForecastReadDTO,
  WeatherFreshness,
  WeatherHourlyPreviewPoint,
  WeatherOperationalAdvice,
  WeatherOperationalAdviceCode,
  WeatherRiskDriver,
  WeatherRiskLevel,
  WeatherVisibilityAudience,
} from './weather.types';

export {
  elevateRiskFromWindAndRain,
  mapV1LogisticsAdviceTypeToRiskLevel,
} from './weather.types';

export type {
  AuthBearerHeaderDTO,
  SessionActorType,
  SessionAuthorizationKind,
  SessionAuthorizationNoneReason,
  SessionContextDTO,
  SessionHydrationPhase,
  SessionPortalId,
  SessionWiringRole,
} from './session.types';

export {
  isExpiresAtPast,
  mapLabelsToSessionWiringRole,
  parseAuthBearerHeader,
  redactBearerHeader,
  sessionAllowsDomainRead,
  toSessionContextDTO,
} from './session.types';

export type {
  ClientMutationKind,
  ClientMutationPayloadLimits,
  ClientMutationRequestDTO,
  ClientMutationResult,
  ClientMutationResultStatus,
  ClientMutationSuccessResult,
  ClientMutationUnauthorizedResult,
  ClientMutationIdempotencyConflictResult,
  ClientMutationValidationErrorResult,
  ClientMutationValidationIssue,
  CreateBookingRequestDTO,
  CreateBookingRequestRedactedDTO,
  SubmitOfflinePaymentProofDTO,
  SubmitOfflinePaymentProofRedactedDTO,
} from './client.mutations.types';

export {
  CLIENT_MUTATION_PAYLOAD_LIMITS,
  assertClientMutationAuthorized,
  maskClientMutationUserId,
  maskEmailForLog,
  maskPhoneForLog,
  redactCreateBookingRequest,
  redactSubmitOfflinePaymentProof,
  sanitizeClientMutationText,
  toClientMutationSuccessResult,
  validateCreateBookingRequest,
  validateSubmitOfflinePaymentProof,
} from './client.mutations.types';

export type {
  AcknowledgePayoutDTO,
  AcknowledgePayoutRedactedDTO,
  ArtistMutationGigNotAssignedResult,
  ArtistMutationIdempotencyConflictResult,
  ArtistMutationKind,
  ArtistMutationPayloadLimits,
  ArtistMutationRequestDTO,
  ArtistMutationResult,
  ArtistMutationResultStatus,
  ArtistMutationSuccessResult,
  ArtistMutationUnauthorizedResult,
  ArtistMutationValidationErrorResult,
  ArtistMutationValidationIssue,
  GigAssignmentDecision,
  RespondGigAssignmentDTO,
  RespondGigAssignmentRedactedDTO,
} from './artist.mutations.types';

export {
  ARTIST_MUTATION_PAYLOAD_LIMITS,
  assertArtistMutationAuthorized,
  assertGigAssignedToArtist,
  maskArtistMutationUserId,
  redactAcknowledgePayout,
  redactRespondGigAssignment,
  sanitizeArtistMutationText,
  toArtistMutationSuccessResult,
  validateAcknowledgePayout,
  validateRespondGigAssignment,
} from './artist.mutations.types';

export type {
  AssignArtistToBookingDTO,
  AssignArtistToBookingRedactedDTO,
  OfflinePaymentReviewDecision,
  ReviewOfflinePaymentDTO,
  ReviewOfflinePaymentRedactedDTO,
  StaffMutationBookingNotFoundResult,
  StaffMutationIdempotencyConflictResult,
  StaffMutationKind,
  StaffMutationPayloadLimits,
  StaffMutationPaymentNotFoundResult,
  StaffMutationRequestDTO,
  StaffMutationResult,
  StaffMutationResultStatus,
  StaffMutationSuccessResult,
  StaffMutationUnauthorizedResult,
  StaffMutationValidationErrorResult,
  StaffMutationValidationIssue,
} from './staff.mutations.types';

export {
  STAFF_MUTATION_PAYLOAD_LIMITS,
  assertBookingFound,
  assertOfflinePaymentFound,
  assertStaffMutationAuthorized,
  maskStaffMutationUserId,
  redactAssignArtistToBooking,
  redactReviewOfflinePayment,
  sanitizeStaffMutationText,
  toStaffMutationSuccessResult,
  validateAssignArtistToBooking,
  validateReviewOfflinePayment,
} from './staff.mutations.types';
