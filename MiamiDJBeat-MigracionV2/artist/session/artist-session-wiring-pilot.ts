/**
 * MOD-204 Session Wiring Pilot — Artist portal read-only session injection (Paso 4).
 * Uses session-wiring adapter · no login forms · no Auth writers.
 * Enforces assigned_dj_id (= session userId) scope for artist domain reads.
 */

import {
  createSessionWiringAdapter,
  MOCK_SW_BEARER_ARTIST,
  MOCK_SW_BEARER_STAFF,
  MOCK_SW_SNAPSHOT_ANONYMOUS,
  MOCK_SW_SNAPSHOT_ARTIST,
  MOCK_SW_SNAPSHOT_EXPIRED,
  MOCK_SW_SNAPSHOT_STAFF,
  type DomainAccessVerdict,
  type DomainWiringId,
  type LabSessionSnapshotRow,
} from '../../shared/services/session-wiring/index';
import type { AuthBearerHeaderDTO, SessionContextDTO } from '../../shared/types/session.types';

export type ArtistSessionPilotVariant = 'artist' | 'anonymous' | 'expired' | 'staff';

export type ArtistSessionWiringInjection = {
  readonly context: SessionContextDTO;
  readonly bearer: AuthBearerHeaderDTO;
  readonly variant: ArtistSessionPilotVariant;
  readonly canReadArtistPortal: boolean;
  /** Session-scoped DJ id used as assigned_dj_id for domain reads. */
  readonly assignedDjUserId: string | null;
  /** Redacted DJ id for UI badge (never full UUID in label). */
  readonly maskedDjId: string;
  readonly domainAccess: Readonly<Record<DomainWiringId, DomainAccessVerdict>>;
  readonly sourceLabel: string;
};

const ARTIST_DOMAINS: readonly DomainWiringId[] = Object.freeze([
  'profiles',
  'bookings',
  'financial',
  'weather',
]);

function pickFixtures(variant: ArtistSessionPilotVariant): {
  readonly snapshot: LabSessionSnapshotRow;
  readonly bearerHeader: string | null;
} {
  if (variant === 'anonymous') {
    return Object.freeze({
      snapshot: MOCK_SW_SNAPSHOT_ANONYMOUS,
      bearerHeader: null,
    });
  }
  if (variant === 'expired') {
    return Object.freeze({
      snapshot: MOCK_SW_SNAPSHOT_EXPIRED,
      bearerHeader: MOCK_SW_BEARER_ARTIST,
    });
  }
  if (variant === 'staff') {
    return Object.freeze({
      snapshot: MOCK_SW_SNAPSHOT_STAFF,
      bearerHeader: MOCK_SW_BEARER_STAFF,
    });
  }
  return Object.freeze({
    snapshot: MOCK_SW_SNAPSHOT_ARTIST,
    bearerHeader: MOCK_SW_BEARER_ARTIST,
  });
}

/**
 * Mask assigned DJ / user id for badge display (read-only; no token leak).
 */
export function maskArtistDjId(userId: string | null | undefined): string {
  const id = userId?.trim() ?? '';
  if (!id) return '(none)';
  if (id.length <= 8) return `${id.slice(0, 2)}…`;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

/**
 * Resolve lab artist session context + per-domain read verdicts (read-only).
 */
export function resolveArtistSessionWiringPilot(
  variant: ArtistSessionPilotVariant = 'artist',
): ArtistSessionWiringInjection {
  const fixtures = pickFixtures(variant);
  const adapter = createSessionWiringAdapter({
    defaultSnapshot: fixtures.snapshot,
    defaultBearerHeader: fixtures.bearerHeader,
  });
  const { context, bearer } = adapter.getLabSessionContext();

  const domainAccess = Object.freeze(
    Object.fromEntries(
      ARTIST_DOMAINS.map((domain) => [
        domain,
        adapter.verifyDomainAccessWithSession({
          domain,
          context,
          bearer,
          enforcePortalMatch: true,
        }),
      ]),
    ) as Record<DomainWiringId, DomainAccessVerdict>,
  );

  const roleOk = context.sessionRole === 'artist';
  const canReadArtistPortal =
    roleOk &&
    bearer.present &&
    !context.isExpired &&
    !context.isAnonymous &&
    context.authorizationKind === 'ready' &&
    Boolean(context.userId);

  const assignedDjUserId = canReadArtistPortal ? context.userId : null;

  return Object.freeze({
    context,
    bearer,
    variant,
    canReadArtistPortal,
    assignedDjUserId,
    maskedDjId: maskArtistDjId(assignedDjUserId ?? context.userId),
    domainAccess,
    sourceLabel: canReadArtistPortal
      ? `session-wiring pilot · artist · dj ${maskArtistDjId(assignedDjUserId)}`
      : `session-gated · ${context.sessionRole}`,
  });
}

export function artistDomainAccessAllowed(
  injection: ArtistSessionWiringInjection | null | undefined,
  domain: DomainWiringId,
): boolean {
  if (!injection) return true;
  if (!injection.canReadArtistPortal) return false;
  return injection.domainAccess[domain]?.allowed === true;
}

/**
 * Prefer session assigned_dj_id over caller override when portal read is ready.
 */
export function resolveArtistScopedUserId(
  injection: ArtistSessionWiringInjection | null | undefined,
  inputArtistUserId: string | undefined,
  fallback: string,
): string {
  if (injection?.canReadArtistPortal && injection.assignedDjUserId) {
    return injection.assignedDjUserId;
  }
  return inputArtistUserId ?? fallback;
}

export function annotateArtistMountSourceLabel(
  base: string,
  injection: ArtistSessionWiringInjection | null | undefined,
  domain: DomainWiringId,
): string {
  if (!injection) return base;
  const verdict = injection.domainAccess[domain];
  if (injection.canReadArtistPortal && verdict?.allowed) {
    return `${base} · ${injection.sourceLabel}`;
  }
  return `${base} · session-gated (${verdict?.reason ?? 'denied'})`;
}

/**
 * DOM badge — ARTIST role + masked DJ id + redacted bearer (no login UI).
 */
export function renderArtistSessionWiringBadge(
  container: HTMLElement,
  injection: ArtistSessionWiringInjection,
): void {
  const root = document.createElement('aside');
  root.className = 'mdj-artist-session-wiring';
  root.dataset.mdjComponent = 'ArtistSessionWiringBadge';
  root.dataset.mdjMod = 'MOD-204-SW';
  root.dataset.mdjSessionRole = injection.context.sessionRole;
  root.dataset.mdjSessionReady = injection.canReadArtistPortal ? '1' : '0';
  root.dataset.mdjBearerPresent = injection.bearer.present ? '1' : '0';
  root.dataset.mdjAssignedDjMasked = injection.maskedDjId;
  root.setAttribute('aria-label', 'Artist session wiring read status');

  const eyebrow = document.createElement('p');
  eyebrow.className = 'mdj-artist-session-wiring__eyebrow';
  eyebrow.textContent = 'MOD-204 Session Wiring · Read-only pilot';

  const title = document.createElement('h2');
  title.className = 'mdj-artist-session-wiring__title';
  title.textContent = 'Session Context';

  const role = document.createElement('p');
  role.className = 'mdj-artist-session-wiring__role';
  role.dataset.mdjSessionRoleLabel = '1';
  role.textContent = `Active role: ${injection.canReadArtistPortal ? 'ARTIST' : injection.context.sessionRole}`;

  const dj = document.createElement('p');
  dj.className = 'mdj-artist-session-wiring__dj';
  dj.dataset.mdjAssignedDj = '1';
  dj.textContent = `Assigned DJ ID: ${injection.maskedDjId}`;

  const bearer = document.createElement('p');
  bearer.className = 'mdj-artist-session-wiring__bearer';
  bearer.dataset.mdjBearerPreview = '1';
  bearer.textContent = `Bearer: ${injection.bearer.redactedPreview}`;

  const status = document.createElement('p');
  status.className = 'mdj-artist-session-wiring__status';
  status.dataset.mdjSessionStatus = injection.canReadArtistPortal ? 'ready' : 'gated';
  status.textContent = injection.canReadArtistPortal
    ? 'Artist portal read access: ready (scoped to assigned_dj_id)'
    : `Artist portal read access: gated (${injection.context.authorizationNoneReason ?? 'denied'})`;

  const domains = document.createElement('ul');
  domains.className = 'mdj-artist-session-wiring__domains';
  domains.dataset.mdjSessionDomains = '1';
  for (const domain of ARTIST_DOMAINS) {
    const li = document.createElement('li');
    const verdict = injection.domainAccess[domain];
    li.dataset.mdjDomain = domain;
    li.dataset.mdjDomainAllowed = verdict.allowed ? '1' : '0';
    li.textContent = `${domain}: ${verdict.allowed ? 'ok' : verdict.reason}`;
    domains.append(li);
  }

  const note = document.createElement('p');
  note.className = 'mdj-artist-session-wiring__note';
  note.textContent =
    'Read-only session injection — login / password / token refresh controls are not available in this slice.';

  root.append(eyebrow, title, role, dj, bearer, status, domains, note);

  for (const el of root.querySelectorAll('form, input, textarea, select, button[type="submit"]')) {
    el.remove();
  }

  container.replaceChildren(root);
}
