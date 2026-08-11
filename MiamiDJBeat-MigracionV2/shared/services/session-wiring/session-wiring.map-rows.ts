/**
 * Session Wiring — map SessionSnapshot / Bearer rows → Read DTOs (Paso 2, read-only).
 * Canonical matrix: docs/V2/SESSION-AUTH-WIRING-MATRIX.md
 *
 * No login · no token refresh · no claim mutation · no SQL.
 */

import {
  isExpiresAtPast,
  mapLabelsToSessionWiringRole,
  parseAuthBearerHeader,
  sessionAllowsDomainRead,
  toSessionContextDTO,
  type AuthBearerHeaderDTO,
  type SessionAuthorizationNoneReason,
  type SessionContextDTO,
  type SessionHydrationPhase,
  type SessionPortalId,
  type SessionWiringRole,
} from '../../types/session.types';

/** Structural SessionSnapshot subset — avoids hard coupling to MOD-002 internals. */
export type LabSessionSnapshotRow = {
  readonly user?: { readonly userId?: string | null; readonly mdjbId?: string | null } | null;
  readonly portal?: string | null;
  readonly roles?: readonly string[] | null;
  readonly sessionId?: string | null;
  readonly expiresAt?: string | null;
  readonly hydrationPhase?: string | null;
  readonly state?: string | null;
};

/** Optional JWT-like claim bag for lab fixtures (not verified cryptographically). */
export type LabJwtClaimsRow = {
  readonly sub?: string | null;
  readonly user_id?: string | null;
  readonly role?: string | null;
  readonly roles?: readonly string[] | null;
  readonly portal?: string | null;
  readonly exp?: number | string | null;
  readonly mdjb_id?: string | null;
  readonly session_id?: string | null;
};

export type DomainWiringId = 'profiles' | 'bookings' | 'financial' | 'weather';

export type DomainAccessVerdict = {
  readonly allowed: boolean;
  readonly domain: DomainWiringId;
  readonly reason:
    | 'ok'
    | 'missing_bearer'
    | 'invalid_scheme'
    | 'expired'
    | 'anonymous'
    | 'role_mismatch'
    | 'portal_mismatch';
  readonly context: SessionContextDTO;
  readonly bearer: AuthBearerHeaderDTO;
};

function asString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function normalizeHydration(raw: string | null | undefined): SessionHydrationPhase {
  const s = (raw ?? '').trim().toLowerCase();
  if (s === 'initial' || s === 'signed_in' || s === 'none') return s;
  return 'none';
}

function inferNoneReasonFromSnapshotState(
  state: string | null | undefined,
  isExpired: boolean,
  hasUser: boolean,
): SessionAuthorizationNoneReason | null {
  if (isExpired) return 'expired';
  const s = (state ?? '').trim().toUpperCase();
  if (s.includes('EXPIRED') || s === 'SESSION_EXPIRED') return 'expired';
  if (s.includes('DESTROY')) return 'destroyed';
  if (s.includes('ERROR')) return 'error';
  if (!hasUser) return 'anonymous';
  return null;
}

/**
 * Pure mapper — SessionSnapshot-like row → SessionContextDTO.
 */
export function mapSessionSnapshotToContext(
  row: LabSessionSnapshotRow | null | undefined,
  options?: { readonly nowMs?: number; readonly forceNoneReason?: SessionAuthorizationNoneReason | null },
): SessionContextDTO {
  const userId = asString(row?.user?.userId);
  const expiresAt = asString(row?.expiresAt);
  const expired = isExpiresAtPast(expiresAt, options?.nowMs);
  const noneReason =
    options?.forceNoneReason ??
    inferNoneReasonFromSnapshotState(asString(row?.state), expired, userId != null);

  const authorizationKind =
    userId && !expired && noneReason !== 'anonymous' && noneReason !== 'expired' ? 'ready' : 'none';

  return toSessionContextDTO({
    sessionId: asString(row?.sessionId),
    userId,
    portal: asString(row?.portal),
    roles: row?.roles ?? [],
    expiresAt,
    authorizationKind,
    authorizationNoneReason: authorizationKind === 'none' ? noneReason ?? 'anonymous' : null,
    mdjbId: asString(row?.user?.mdjbId),
    hydrationPhase: normalizeHydration(asString(row?.hydrationPhase)),
    nowMs: options?.nowMs,
  });
}

/**
 * Pure mapper — Authorization header string → AuthBearerHeaderDTO.
 */
export function mapBearerTokenToHeader(
  raw: string | null | undefined,
  credentialVersion: number | null = null,
): AuthBearerHeaderDTO {
  return parseAuthBearerHeader(raw, credentialVersion);
}

/**
 * Pure mapper — lab JWT-like claims → SessionContextDTO (no crypto verify).
 */
export function mapJwtClaimsRowToContext(
  claims: LabJwtClaimsRow | null | undefined,
  options?: { readonly nowMs?: number; readonly bearerHeader?: string | null },
): SessionContextDTO {
  const userId = asString(claims?.sub) ?? asString(claims?.user_id);
  let expiresAt: string | null = null;
  if (typeof claims?.exp === 'number' && Number.isFinite(claims.exp)) {
    expiresAt = new Date(claims.exp * (claims.exp < 1e12 ? 1000 : 1)).toISOString();
  } else if (typeof claims?.exp === 'string') {
    expiresAt = claims.exp;
  }

  const roles =
    claims?.roles ??
    (claims?.role ? [String(claims.role)] : []);

  const expired = isExpiresAtPast(expiresAt, options?.nowMs);
  const bearer = mapBearerTokenToHeader(options?.bearerHeader ?? null);
  const authorizationKind =
    userId && !expired && bearer.present && bearer.scheme === 'Bearer' ? 'ready' : 'none';

  return toSessionContextDTO({
    sessionId: asString(claims?.session_id),
    userId,
    portal: asString(claims?.portal),
    roles,
    expiresAt,
    authorizationKind,
    authorizationNoneReason: expired
      ? 'expired'
      : !userId
        ? 'anonymous'
        : !bearer.present
          ? 'cleared'
          : authorizationKind === 'none'
            ? 'anonymous'
            : null,
    mdjbId: asString(claims?.mdjb_id),
    hydrationPhase: userId ? 'signed_in' : 'none',
    nowMs: options?.nowMs,
  });
}

/** Roles allowed to call a domain read surface (lab wiring heuristic). */
export function rolesAllowedForDomain(domain: DomainWiringId): readonly SessionWiringRole[] {
  switch (domain) {
    case 'profiles':
      return Object.freeze(['client', 'artist', 'staff', 'staff_seller']);
    case 'bookings':
      return Object.freeze(['client', 'artist', 'staff', 'staff_seller']);
    case 'financial':
      return Object.freeze(['client', 'artist', 'staff', 'staff_seller']);
    case 'weather':
      return Object.freeze(['client', 'artist', 'staff', 'staff_seller']);
    default:
      return Object.freeze([]);
  }
}

export function portalExpectedForRole(role: SessionWiringRole): SessionPortalId | null {
  if (role === 'client') return 'client';
  if (role === 'artist') return 'artist';
  if (role === 'staff' || role === 'staff_seller') return 'staff';
  return null;
}

/**
 * Pure gate — does this session context + bearer allow a domain read?
 * Aligns with sealed services' requireSession (Bearer present) + role/portal sanity.
 */
export function evaluateDomainAccessWithSession(input: {
  readonly domain: DomainWiringId;
  readonly context: SessionContextDTO;
  readonly bearer: AuthBearerHeaderDTO;
  readonly enforcePortalMatch?: boolean;
}): DomainAccessVerdict {
  const { domain, context, bearer } = input;
  const base = Object.freeze({ domain, context, bearer });

  if (!bearer.present) {
    return Object.freeze({ ...base, allowed: false, reason: 'missing_bearer' as const });
  }
  if (bearer.scheme !== 'Bearer') {
    return Object.freeze({ ...base, allowed: false, reason: 'invalid_scheme' as const });
  }
  if (context.isExpired || context.authorizationNoneReason === 'expired') {
    return Object.freeze({ ...base, allowed: false, reason: 'expired' as const });
  }
  if (context.isAnonymous || !context.userId || context.authorizationKind !== 'ready') {
    return Object.freeze({ ...base, allowed: false, reason: 'anonymous' as const });
  }
  if (!sessionAllowsDomainRead({ context, bearer })) {
    return Object.freeze({ ...base, allowed: false, reason: 'anonymous' as const });
  }
  if (!rolesAllowedForDomain(domain).includes(context.sessionRole)) {
    return Object.freeze({ ...base, allowed: false, reason: 'role_mismatch' as const });
  }
  if (input.enforcePortalMatch) {
    const expected = portalExpectedForRole(context.sessionRole);
    if (expected && context.portal && context.portal !== expected) {
      return Object.freeze({ ...base, allowed: false, reason: 'portal_mismatch' as const });
    }
  }

  return Object.freeze({ ...base, allowed: true, reason: 'ok' as const });
}

export function resolveWiringRoleFromSnapshot(
  row: LabSessionSnapshotRow | null | undefined,
): SessionWiringRole {
  const portal =
    row?.portal === 'client' || row?.portal === 'artist' || row?.portal === 'staff'
      ? row.portal
      : null;
  return mapLabelsToSessionWiringRole(row?.roles, portal);
}
