/**
 * Session Wiring V2 — frozen read-model mocks for Vitest (Paso 2).
 * No network · no SQL · no login · no token refresh writers.
 */

import type { AuthBearerHeaderDTO, SessionContextDTO } from '../../types/session.types';
import {
  mapBearerTokenToHeader,
  mapJwtClaimsRowToContext,
  mapSessionSnapshotToContext,
  type LabJwtClaimsRow,
  type LabSessionSnapshotRow,
} from './session-wiring.map-rows';

export const MOCK_SW_CLIENT_USER_ID = '00000000-0000-4000-8000-000000000001';
export const MOCK_SW_ARTIST_USER_ID = '00000000-0000-4000-8000-000000000003';
export const MOCK_SW_STAFF_USER_ID = '00000000-0000-4000-8000-000000000009';
export const MOCK_SW_SELLER_USER_ID = '00000000-0000-4000-8000-000000000008';

/** Far-future expiry for “ready” fixtures. */
export const MOCK_SW_EXPIRES_FUTURE = '2099-01-01T00:00:00.000Z';
/** Past expiry for expired fixtures. */
export const MOCK_SW_EXPIRES_PAST = '2020-01-01T00:00:00.000Z';

export const MOCK_SW_BEARER_CLIENT = 'Bearer lab_client_token_abc123xyz';
export const MOCK_SW_BEARER_ARTIST = 'Bearer lab_artist_token_def456uvw';
export const MOCK_SW_BEARER_STAFF = 'Bearer lab_staff_token_ghi789rst';
export const MOCK_SW_BEARER_SELLER = 'Bearer lab_seller_token_jkl012mno';
export const MOCK_SW_BEARER_EXPIRED = 'Bearer lab_expired_token_zzz999';

export const MOCK_SW_SNAPSHOT_CLIENT: LabSessionSnapshotRow = Object.freeze({
  user: Object.freeze({ userId: MOCK_SW_CLIENT_USER_ID, mdjbId: 'MDJB-AAAA-BBBB-C' }),
  portal: 'client',
  roles: Object.freeze(['client']),
  sessionId: 'ses_client_001',
  expiresAt: MOCK_SW_EXPIRES_FUTURE,
  hydrationPhase: 'signed_in',
  state: 'SESSION_READY',
});

export const MOCK_SW_SNAPSHOT_ARTIST: LabSessionSnapshotRow = Object.freeze({
  user: Object.freeze({ userId: MOCK_SW_ARTIST_USER_ID, mdjbId: 'MDJB-AAAA-CCCC-A' }),
  portal: 'artist',
  roles: Object.freeze(['artist', 'dj']),
  sessionId: 'ses_artist_001',
  expiresAt: MOCK_SW_EXPIRES_FUTURE,
  hydrationPhase: 'signed_in',
  state: 'SESSION_READY',
});

export const MOCK_SW_SNAPSHOT_STAFF: LabSessionSnapshotRow = Object.freeze({
  user: Object.freeze({ userId: MOCK_SW_STAFF_USER_ID, mdjbId: 'MDJB-AAAA-DDDD-M' }),
  portal: 'staff',
  roles: Object.freeze(['owner', 'staff']),
  sessionId: 'ses_staff_001',
  expiresAt: MOCK_SW_EXPIRES_FUTURE,
  hydrationPhase: 'signed_in',
  state: 'SESSION_READY',
});

export const MOCK_SW_SNAPSHOT_STAFF_SELLER: LabSessionSnapshotRow = Object.freeze({
  user: Object.freeze({ userId: MOCK_SW_SELLER_USER_ID, mdjbId: 'MDJB-AAAA-EEEE-S' }),
  portal: 'staff',
  roles: Object.freeze(['seller']),
  sessionId: 'ses_seller_001',
  expiresAt: MOCK_SW_EXPIRES_FUTURE,
  hydrationPhase: 'signed_in',
  state: 'SESSION_READY',
});

export const MOCK_SW_SNAPSHOT_ANONYMOUS: LabSessionSnapshotRow = Object.freeze({
  user: null,
  portal: 'client',
  roles: Object.freeze([]),
  sessionId: 'ses_anon_001',
  expiresAt: null,
  hydrationPhase: 'none',
  state: 'SIGNED_OUT',
});

export const MOCK_SW_SNAPSHOT_EXPIRED: LabSessionSnapshotRow = Object.freeze({
  user: Object.freeze({ userId: MOCK_SW_CLIENT_USER_ID, mdjbId: 'MDJB-AAAA-BBBB-C' }),
  portal: 'client',
  roles: Object.freeze(['client']),
  sessionId: 'ses_expired_001',
  expiresAt: MOCK_SW_EXPIRES_PAST,
  hydrationPhase: 'signed_in',
  state: 'SESSION_EXPIRED',
});

export const MOCK_SW_JWT_CLIENT: LabJwtClaimsRow = Object.freeze({
  sub: MOCK_SW_CLIENT_USER_ID,
  role: 'client',
  portal: 'client',
  exp: Math.floor(Date.parse(MOCK_SW_EXPIRES_FUTURE) / 1000),
  mdjb_id: 'MDJB-AAAA-BBBB-C',
  session_id: 'ses_jwt_client',
});

export const MOCK_SW_CONTEXT_CLIENT: SessionContextDTO = mapSessionSnapshotToContext(
  MOCK_SW_SNAPSHOT_CLIENT,
);
export const MOCK_SW_CONTEXT_ARTIST: SessionContextDTO = mapSessionSnapshotToContext(
  MOCK_SW_SNAPSHOT_ARTIST,
);
export const MOCK_SW_CONTEXT_STAFF: SessionContextDTO = mapSessionSnapshotToContext(
  MOCK_SW_SNAPSHOT_STAFF,
);
export const MOCK_SW_CONTEXT_SELLER: SessionContextDTO = mapSessionSnapshotToContext(
  MOCK_SW_SNAPSHOT_STAFF_SELLER,
);
export const MOCK_SW_CONTEXT_ANON: SessionContextDTO = mapSessionSnapshotToContext(
  MOCK_SW_SNAPSHOT_ANONYMOUS,
);
export const MOCK_SW_CONTEXT_EXPIRED: SessionContextDTO = mapSessionSnapshotToContext(
  MOCK_SW_SNAPSHOT_EXPIRED,
);

export const MOCK_SW_HEADER_CLIENT: AuthBearerHeaderDTO =
  mapBearerTokenToHeader(MOCK_SW_BEARER_CLIENT);
export const MOCK_SW_HEADER_ARTIST: AuthBearerHeaderDTO =
  mapBearerTokenToHeader(MOCK_SW_BEARER_ARTIST);
export const MOCK_SW_HEADER_STAFF: AuthBearerHeaderDTO = mapBearerTokenToHeader(MOCK_SW_BEARER_STAFF);
export const MOCK_SW_HEADER_SELLER: AuthBearerHeaderDTO =
  mapBearerTokenToHeader(MOCK_SW_BEARER_SELLER);
export const MOCK_SW_HEADER_EXPIRED: AuthBearerHeaderDTO =
  mapBearerTokenToHeader(MOCK_SW_BEARER_EXPIRED);
export const MOCK_SW_HEADER_MISSING: AuthBearerHeaderDTO = mapBearerTokenToHeader(null);

export const MOCK_SW_CONTEXT_FROM_JWT: SessionContextDTO = mapJwtClaimsRowToContext(
  MOCK_SW_JWT_CLIENT,
  { bearerHeader: MOCK_SW_BEARER_CLIENT },
);
