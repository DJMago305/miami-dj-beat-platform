/** Session & Auth Wiring domain — public barrel (Paso 2 read adapter + mappers). */

export {
  evaluateDomainAccessWithSession,
  mapBearerTokenToHeader,
  mapJwtClaimsRowToContext,
  mapSessionSnapshotToContext,
  portalExpectedForRole,
  resolveWiringRoleFromSnapshot,
  rolesAllowedForDomain,
} from './session-wiring.map-rows';
export type {
  DomainAccessVerdict,
  DomainWiringId,
  LabJwtClaimsRow,
  LabSessionSnapshotRow,
} from './session-wiring.map-rows';

export {
  MOCK_SW_BEARER_ARTIST,
  MOCK_SW_BEARER_CLIENT,
  MOCK_SW_BEARER_EXPIRED,
  MOCK_SW_BEARER_SELLER,
  MOCK_SW_BEARER_STAFF,
  MOCK_SW_CLIENT_USER_ID,
  MOCK_SW_ARTIST_USER_ID,
  MOCK_SW_CONTEXT_ANON,
  MOCK_SW_CONTEXT_ARTIST,
  MOCK_SW_CONTEXT_CLIENT,
  MOCK_SW_CONTEXT_EXPIRED,
  MOCK_SW_CONTEXT_FROM_JWT,
  MOCK_SW_CONTEXT_SELLER,
  MOCK_SW_CONTEXT_STAFF,
  MOCK_SW_EXPIRES_FUTURE,
  MOCK_SW_EXPIRES_PAST,
  MOCK_SW_HEADER_ARTIST,
  MOCK_SW_HEADER_CLIENT,
  MOCK_SW_HEADER_EXPIRED,
  MOCK_SW_HEADER_MISSING,
  MOCK_SW_HEADER_SELLER,
  MOCK_SW_HEADER_STAFF,
  MOCK_SW_JWT_CLIENT,
  MOCK_SW_SELLER_USER_ID,
  MOCK_SW_SNAPSHOT_ANONYMOUS,
  MOCK_SW_SNAPSHOT_ARTIST,
  MOCK_SW_SNAPSHOT_CLIENT,
  MOCK_SW_SNAPSHOT_EXPIRED,
  MOCK_SW_SNAPSHOT_STAFF,
  MOCK_SW_SNAPSHOT_STAFF_SELLER,
  MOCK_SW_STAFF_USER_ID,
} from './session-wiring.mocks';

export {
  createSessionWiringAdapter,
  listSessionWiringAdapterReadMethods,
} from './session-wiring.adapter';
export type {
  CreateSessionWiringAdapterInput,
  GetLabSessionContextInput,
  GetLabSessionContextResult,
  SessionWiringAdapter,
  SessionWiringAdapterErrorCode,
  ValidateBearerResult,
  VerifyDomainAccessInput,
} from './session-wiring.adapter';
