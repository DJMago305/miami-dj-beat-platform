/**
 * Session & Auth Wiring V2 — Read Model types (Paso 1).
 * Canonical matrix: docs/V2/SESSION-AUTH-WIRING-MATRIX.md
 *
 * READ-ONLY: no login/register/password writers, no auth.users SQL, no role mutation.
 * Lab only: http://localhost:5173
 *
 * Complements (does not replace) MOD-002 SessionSnapshot / SessionReaderPort.
 */

/** Product wiring roles for domain audience injection (not Postgres authority). */
export type SessionWiringRole =
  | 'guest'
  | 'client'
  | 'artist'
  | 'staff'
  | 'staff_seller';

/** Portal shell ids aligned to lab navigation. */
export type SessionPortalId = 'client' | 'artist' | 'staff';

/** Actor classification for RequestContext / API metadata. */
export type SessionActorType = 'guest' | 'authenticated' | 'staff' | 'system';

/** Authorization readiness (mirrors SessionAuthorizationState kinds, read-only). */
export type SessionAuthorizationKind = 'ready' | 'none';

export type SessionAuthorizationNoneReason =
  | 'anonymous'
  | 'expired'
  | 'destroyed'
  | 'error'
  | 'cleared'
  | 'unbound';

export type SessionHydrationPhase = 'initial' | 'signed_in' | 'none';

/**
 * SessionContextDTO — read projection of session claims for domain wiring.
 */
export type SessionContextDTO = {
  readonly sessionId: string | null;
  readonly userId: string | null;
  readonly portal: SessionPortalId | null;
  readonly sessionRole: SessionWiringRole;
  readonly actorType: SessionActorType;
  readonly expiresAt: string | null;
  readonly isExpired: boolean;
  readonly isAnonymous: boolean;
  readonly authorizationKind: SessionAuthorizationKind;
  readonly authorizationNoneReason: SessionAuthorizationNoneReason | null;
  readonly rolesRaw: readonly string[];
  readonly mdjbId: string | null;
  readonly hydrationPhase: SessionHydrationPhase;
};

/**
 * AuthBearerHeaderDTO — Authorization header projection (never log headerValue in prod).
 */
export type AuthBearerHeaderDTO = {
  readonly present: boolean;
  readonly scheme: 'Bearer' | 'Unknown' | 'None';
  /** Full header including scheme — lab/tests only; do not persist or log. */
  readonly headerValue: string | null;
  /** Safe diagnostic form, e.g. `Bearer ab12…9f`. */
  readonly redactedPreview: string;
  readonly credentialVersion: number | null;
};

function isPortal(value: string | null | undefined): value is SessionPortalId {
  return value === 'client' || value === 'artist' || value === 'staff';
}

/**
 * Map raw role labels (SessionSnapshot.roles / profile role) → SessionWiringRole.
 * Read-only heuristic for lab wiring — Postgres remains authority in production.
 */
export function mapLabelsToSessionWiringRole(
  roles: readonly string[] | null | undefined,
  portal?: SessionPortalId | null,
): SessionWiringRole {
  const normalized = (roles ?? []).map((r) => String(r).trim().toLowerCase());
  if (normalized.some((r) => r === 'seller' || r === 'staff_seller' || r.includes('seller'))) {
    return 'staff_seller';
  }
  if (
    normalized.some(
      (r) =>
        r === 'staff' ||
        r === 'owner' ||
        r === 'manager' ||
        r === 'admin' ||
        r === 'staff_full' ||
        r === 'staff_management',
    )
  ) {
    return 'staff';
  }
  if (normalized.some((r) => r === 'artist' || r === 'dj' || r === 'performer')) {
    return 'artist';
  }
  if (normalized.some((r) => r === 'client' || r === 'buyer' || r === 'customer')) {
    return 'client';
  }
  if (portal === 'staff') return 'staff';
  if (portal === 'artist') return 'artist';
  if (portal === 'client') return 'client';
  return 'guest';
}

export function redactBearerHeader(raw: string | null | undefined): string {
  const t = typeof raw === 'string' ? raw.trim() : '';
  if (!t) return '—';
  const parts = t.split(/\s+/);
  const scheme = parts[0] ?? '';
  const token = parts.slice(1).join(' ');
  if (!token) return scheme || '—';
  if (token.length <= 8) return `${scheme} …`;
  return `${scheme} ${token.slice(0, 4)}…${token.slice(-2)}`;
}

export function parseAuthBearerHeader(
  raw: string | null | undefined,
  credentialVersion: number | null = null,
): AuthBearerHeaderDTO {
  const t = typeof raw === 'string' ? raw.trim() : '';
  if (!t) {
    return Object.freeze({
      present: false,
      scheme: 'None' as const,
      headerValue: null,
      redactedPreview: '—',
      credentialVersion: null,
    });
  }
  const schemeToken = t.split(/\s+/)[0] ?? '';
  const scheme =
    schemeToken.toLowerCase() === 'bearer' ? ('Bearer' as const) : ('Unknown' as const);
  return Object.freeze({
    present: true,
    scheme,
    headerValue: t,
    redactedPreview: redactBearerHeader(t),
    credentialVersion,
  });
}

export function isExpiresAtPast(
  expiresAt: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!expiresAt) return false;
  const ms = Date.parse(expiresAt);
  if (!Number.isFinite(ms)) return false;
  return ms <= nowMs;
}

/**
 * Build SessionContextDTO from lab/session fields (pure). Does not call Auth writers.
 */
export function toSessionContextDTO(input: {
  readonly sessionId?: string | null;
  readonly userId?: string | null;
  readonly portal?: string | null;
  readonly roles?: readonly string[] | null;
  readonly expiresAt?: string | null;
  readonly actorType?: string | null;
  readonly authorizationKind?: SessionAuthorizationKind;
  readonly authorizationNoneReason?: SessionAuthorizationNoneReason | null;
  readonly mdjbId?: string | null;
  readonly hydrationPhase?: SessionHydrationPhase | null;
  readonly nowMs?: number;
}): SessionContextDTO {
  const rawPortal = input.portal ?? null;
  const portal: SessionPortalId | null = isPortal(rawPortal) ? rawPortal : null;
  const userId = input.userId?.trim() ? input.userId.trim() : null;
  const authorizationKind = input.authorizationKind ?? (userId ? 'ready' : 'none');
  const noneReason =
    authorizationKind === 'none'
      ? (input.authorizationNoneReason ?? (userId ? null : 'anonymous'))
      : null;
  const isExpired =
    noneReason === 'expired' || isExpiresAtPast(input.expiresAt ?? null, input.nowMs);
  const sessionRole = mapLabelsToSessionWiringRole(input.roles, portal);
  const actorRaw = (input.actorType ?? '').trim().toLowerCase();
  let actorType: SessionActorType = 'guest';
  if (actorRaw === 'staff' || actorRaw === 'system' || actorRaw === 'authenticated') {
    actorType = actorRaw;
  } else if (userId && !isExpired) {
    actorType = sessionRole === 'staff' || sessionRole === 'staff_seller' ? 'staff' : 'authenticated';
  }

  return Object.freeze({
    sessionId: input.sessionId?.trim() ? input.sessionId.trim() : null,
    userId,
    portal,
    sessionRole: userId && !isExpired ? sessionRole : 'guest',
    actorType: isExpired || !userId ? 'guest' : actorType,
    expiresAt: input.expiresAt ?? null,
    isExpired,
    isAnonymous: !userId || noneReason === 'anonymous',
    authorizationKind: isExpired ? 'none' : authorizationKind,
    authorizationNoneReason: isExpired ? 'expired' : noneReason,
    rolesRaw: Object.freeze([...(input.roles ?? [])]),
    mdjbId: input.mdjbId?.trim() ? input.mdjbId.trim() : null,
    hydrationPhase: input.hydrationPhase ?? 'none',
  });
}

/**
 * Whether domain services should treat the session as ready for Bearer-gated reads.
 * Aligns with requireSession() presence check (header present).
 */
export function sessionAllowsDomainRead(input: {
  readonly context: SessionContextDTO;
  readonly bearer: AuthBearerHeaderDTO;
}): boolean {
  if (!input.bearer.present) return false;
  if (input.context.isExpired) return false;
  if (input.context.authorizationKind !== 'ready') return false;
  return input.context.userId != null;
}
