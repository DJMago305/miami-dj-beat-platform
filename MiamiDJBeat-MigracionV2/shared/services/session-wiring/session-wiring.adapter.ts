/**
 * Session Wiring adapter — READ-ONLY session context (Paso 2).
 * Injectable snapshot / bearer sources for lab. No login · no refresh · no claim writers.
 */

import type { SessionReaderPort } from '../../api/runtime';
import type { AuthBearerHeaderDTO, SessionContextDTO } from '../../types/session.types';
import {
  evaluateDomainAccessWithSession,
  mapBearerTokenToHeader,
  mapJwtClaimsRowToContext,
  mapSessionSnapshotToContext,
  type DomainAccessVerdict,
  type DomainWiringId,
  type LabJwtClaimsRow,
  type LabSessionSnapshotRow,
} from './session-wiring.map-rows';

export type SessionWiringAdapterErrorCode =
  | 'SESSION_WIRING_MISSING_BEARER'
  | 'SESSION_WIRING_INVALID_SCHEME'
  | 'SESSION_WIRING_EXPIRED'
  | 'SESSION_WIRING_ANONYMOUS'
  | 'SESSION_WIRING_FORBIDDEN';

export type ValidateBearerResult = {
  readonly ok: boolean;
  readonly bearer: AuthBearerHeaderDTO;
  readonly code: SessionWiringAdapterErrorCode | 'OK';
  readonly message: string;
};

export type GetLabSessionContextInput = {
  readonly snapshot?: LabSessionSnapshotRow | null;
  readonly bearerHeader?: string | null;
  readonly jwtClaims?: LabJwtClaimsRow | null;
  readonly sessionReader?: SessionReaderPort | null;
  readonly nowMs?: number;
  readonly preferJwtClaims?: boolean;
};

export type GetLabSessionContextResult = {
  readonly context: SessionContextDTO;
  readonly bearer: AuthBearerHeaderDTO;
  readonly source: 'snapshot' | 'jwt_claims' | 'session_reader' | 'empty';
};

export type VerifyDomainAccessInput = {
  readonly domain: DomainWiringId;
  readonly context: SessionContextDTO;
  readonly bearer: AuthBearerHeaderDTO;
  readonly enforcePortalMatch?: boolean;
};

export type SessionWiringAdapter = {
  readonly getLabSessionContext: (
    input?: GetLabSessionContextInput,
  ) => GetLabSessionContextResult;
  readonly validateBearerTokenHeader: (raw: string | null | undefined) => ValidateBearerResult;
  readonly verifyDomainAccessWithSession: (input: VerifyDomainAccessInput) => DomainAccessVerdict;
};

export type CreateSessionWiringAdapterInput = {
  /** Optional default snapshot for getLabSessionContext() with no args. */
  readonly defaultSnapshot?: LabSessionSnapshotRow | null;
  readonly defaultBearerHeader?: string | null;
  readonly sessionReader?: SessionReaderPort | null;
};

export function createSessionWiringAdapter(
  defaults: CreateSessionWiringAdapterInput = {},
): SessionWiringAdapter {
  const adapter: SessionWiringAdapter = {
    getLabSessionContext(input = {}) {
      const nowMs = input.nowMs;
      const reader = input.sessionReader ?? defaults.sessionReader ?? null;
      const readerHeader = reader?.getAuthorizationHeader() ?? null;
      const bearerRaw =
        input.bearerHeader !== undefined
          ? input.bearerHeader
          : (readerHeader ?? defaults.defaultBearerHeader ?? null);
      const bearer = mapBearerTokenToHeader(bearerRaw);

      if (input.preferJwtClaims && input.jwtClaims) {
        return Object.freeze({
          context: mapJwtClaimsRowToContext(input.jwtClaims, {
            nowMs,
            bearerHeader: bearerRaw,
          }),
          bearer,
          source: 'jwt_claims' as const,
        });
      }

      const snapshot = input.snapshot ?? defaults.defaultSnapshot ?? null;
      if (snapshot) {
        return Object.freeze({
          context: mapSessionSnapshotToContext(snapshot, { nowMs }),
          bearer,
          source: 'snapshot' as const,
        });
      }

      if (input.jwtClaims) {
        return Object.freeze({
          context: mapJwtClaimsRowToContext(input.jwtClaims, {
            nowMs,
            bearerHeader: bearerRaw,
          }),
          bearer,
          source: 'jwt_claims' as const,
        });
      }

      if (reader) {
        const portal = reader.getPortal();
        const sessionId = reader.getSessionId();
        const actorType = reader.getActorType();
        const hasBearer = (readerHeader ?? null) !== null;
        const context = mapSessionSnapshotToContext(
          {
            user: hasBearer
              ? { userId: sessionId ? `user-from-session:${sessionId}` : 'user-from-reader' }
              : null,
            portal,
            roles:
              actorType === 'staff'
                ? ['staff']
                : portal === 'artist'
                  ? ['artist']
                  : portal === 'client'
                    ? ['client']
                    : [],
            sessionId,
            expiresAt: null,
            hydrationPhase: hasBearer ? 'signed_in' : 'none',
            state: hasBearer ? 'SESSION_READY' : 'SIGNED_OUT',
          },
          { nowMs },
        );
        return Object.freeze({
          context,
          bearer: mapBearerTokenToHeader(readerHeader),
          source: 'session_reader' as const,
        });
      }

      return Object.freeze({
        context: mapSessionSnapshotToContext(
          { user: null, portal: null, roles: [], sessionId: null, expiresAt: null },
          { nowMs },
        ),
        bearer: mapBearerTokenToHeader(null),
        source: 'empty' as const,
      });
    },

    validateBearerTokenHeader(raw) {
      const bearer = mapBearerTokenToHeader(raw);
      if (!bearer.present) {
        return Object.freeze({
          ok: false,
          bearer,
          code: 'SESSION_WIRING_MISSING_BEARER' as const,
          message: 'Authorization header is missing.',
        });
      }
      if (bearer.scheme !== 'Bearer') {
        return Object.freeze({
          ok: false,
          bearer,
          code: 'SESSION_WIRING_INVALID_SCHEME' as const,
          message: 'Authorization scheme must be Bearer.',
        });
      }
      return Object.freeze({
        ok: true,
        bearer,
        code: 'OK' as const,
        message: 'Bearer header present.',
      });
    },

    verifyDomainAccessWithSession(input) {
      return evaluateDomainAccessWithSession({
        domain: input.domain,
        context: input.context,
        bearer: input.bearer,
        enforcePortalMatch: input.enforcePortalMatch,
      });
    },
  };

  return Object.freeze(adapter);
}

/** Guard: public surface must not expose auth writers. */
export function listSessionWiringAdapterReadMethods(): readonly string[] {
  return Object.freeze([
    'getLabSessionContext',
    'validateBearerTokenHeader',
    'verifyDomainAccessWithSession',
  ]);
}
