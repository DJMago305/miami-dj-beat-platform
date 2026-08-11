/**
 * MOD-103 Session Wiring Pilot — Client portal read-only session injection (Paso 5).
 * Uses session-wiring adapter · no login forms · no Auth writers.
 * Enforces client_id (= session userId) scope for client domain reads.
 */

import {
  createSessionWiringAdapter,
  MOCK_SW_BEARER_ARTIST,
  MOCK_SW_BEARER_CLIENT,
  MOCK_SW_SNAPSHOT_ANONYMOUS,
  MOCK_SW_SNAPSHOT_ARTIST,
  MOCK_SW_SNAPSHOT_CLIENT,
  MOCK_SW_SNAPSHOT_EXPIRED,
  type DomainAccessVerdict,
  type DomainWiringId,
  type LabSessionSnapshotRow,
} from '../../shared/services/session-wiring/index';
import type { AuthBearerHeaderDTO, SessionContextDTO } from '../../shared/types/session.types';

export type ClientSessionPilotVariant = 'client' | 'anonymous' | 'expired' | 'artist';

export type ClientSessionWiringInjection = {
  readonly context: SessionContextDTO;
  readonly bearer: AuthBearerHeaderDTO;
  readonly variant: ClientSessionPilotVariant;
  readonly canReadClientPortal: boolean;
  /** Session-scoped client id used as client_id for domain reads. */
  readonly clientUserId: string | null;
  /** Redacted client id for UI badge (never full UUID in label). */
  readonly maskedClientId: string;
  readonly domainAccess: Readonly<Record<DomainWiringId, DomainAccessVerdict>>;
  readonly sourceLabel: string;
};

const CLIENT_DOMAINS: readonly DomainWiringId[] = Object.freeze([
  'profiles',
  'bookings',
  'financial',
  'weather',
]);

function pickFixtures(variant: ClientSessionPilotVariant): {
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
      bearerHeader: MOCK_SW_BEARER_CLIENT,
    });
  }
  if (variant === 'artist') {
    return Object.freeze({
      snapshot: MOCK_SW_SNAPSHOT_ARTIST,
      bearerHeader: MOCK_SW_BEARER_ARTIST,
    });
  }
  return Object.freeze({
    snapshot: MOCK_SW_SNAPSHOT_CLIENT,
    bearerHeader: MOCK_SW_BEARER_CLIENT,
  });
}

/**
 * Mask client / user id for badge display (read-only; no token leak).
 */
export function maskClientUserId(userId: string | null | undefined): string {
  const id = userId?.trim() ?? '';
  if (!id) return '(none)';
  if (id.length <= 8) return `${id.slice(0, 2)}…`;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

/**
 * Resolve lab client session context + per-domain read verdicts (read-only).
 */
export function resolveClientSessionWiringPilot(
  variant: ClientSessionPilotVariant = 'client',
): ClientSessionWiringInjection {
  const fixtures = pickFixtures(variant);
  const adapter = createSessionWiringAdapter({
    defaultSnapshot: fixtures.snapshot,
    defaultBearerHeader: fixtures.bearerHeader,
  });
  const { context, bearer } = adapter.getLabSessionContext();

  const domainAccess = Object.freeze(
    Object.fromEntries(
      CLIENT_DOMAINS.map((domain) => [
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

  const roleOk = context.sessionRole === 'client';
  const canReadClientPortal =
    roleOk &&
    bearer.present &&
    !context.isExpired &&
    !context.isAnonymous &&
    context.authorizationKind === 'ready' &&
    Boolean(context.userId);

  const clientUserId = canReadClientPortal ? context.userId : null;

  return Object.freeze({
    context,
    bearer,
    variant,
    canReadClientPortal,
    clientUserId,
    maskedClientId: maskClientUserId(clientUserId ?? context.userId),
    domainAccess,
    sourceLabel: canReadClientPortal
      ? `session-wiring pilot · client · id ${maskClientUserId(clientUserId)}`
      : `session-gated · ${context.sessionRole}`,
  });
}

export function clientDomainAccessAllowed(
  injection: ClientSessionWiringInjection | null | undefined,
  domain: DomainWiringId,
): boolean {
  if (!injection) return true;
  if (!injection.canReadClientPortal) return false;
  return injection.domainAccess[domain]?.allowed === true;
}

/**
 * Prefer session client_id over caller override when portal read is ready.
 */
export function resolveClientScopedUserId(
  injection: ClientSessionWiringInjection | null | undefined,
  inputClientUserId: string | undefined,
  fallback: string,
): string {
  if (injection?.canReadClientPortal && injection.clientUserId) {
    return injection.clientUserId;
  }
  return inputClientUserId ?? fallback;
}

export function annotateClientMountSourceLabel(
  base: string,
  injection: ClientSessionWiringInjection | null | undefined,
  domain: DomainWiringId,
): string {
  if (!injection) return base;
  const verdict = injection.domainAccess[domain];
  if (injection.canReadClientPortal && verdict?.allowed) {
    return `${base} · ${injection.sourceLabel}`;
  }
  return `${base} · session-gated (${verdict?.reason ?? 'denied'})`;
}

/**
 * DOM badge — CLIENT role + masked client id + redacted bearer (no login UI).
 */
export function renderClientSessionWiringBadge(
  container: HTMLElement,
  injection: ClientSessionWiringInjection,
): void {
  const root = document.createElement('aside');
  root.className = 'mdj-client-session-wiring';
  root.dataset.mdjComponent = 'ClientSessionWiringBadge';
  root.dataset.mdjMod = 'MOD-103-SW';
  root.dataset.mdjSessionRole = injection.context.sessionRole;
  root.dataset.mdjSessionReady = injection.canReadClientPortal ? '1' : '0';
  root.dataset.mdjBearerPresent = injection.bearer.present ? '1' : '0';
  root.dataset.mdjClientIdMasked = injection.maskedClientId;
  root.setAttribute('aria-label', 'Client session wiring read status');

  const eyebrow = document.createElement('p');
  eyebrow.className = 'mdj-client-session-wiring__eyebrow';
  eyebrow.textContent = 'MOD-103 Session Wiring · Read-only pilot';

  const title = document.createElement('h2');
  title.className = 'mdj-client-session-wiring__title';
  title.textContent = 'Session Context';

  const role = document.createElement('p');
  role.className = 'mdj-client-session-wiring__role';
  role.dataset.mdjSessionRoleLabel = '1';
  role.textContent = `Active role: ${injection.canReadClientPortal ? 'CLIENT' : injection.context.sessionRole}`;

  const clientId = document.createElement('p');
  clientId.className = 'mdj-client-session-wiring__client-id';
  clientId.dataset.mdjClientId = '1';
  clientId.textContent = `Client ID: ${injection.maskedClientId}`;

  const bearer = document.createElement('p');
  bearer.className = 'mdj-client-session-wiring__bearer';
  bearer.dataset.mdjBearerPreview = '1';
  bearer.textContent = `Bearer: ${injection.bearer.redactedPreview}`;

  const status = document.createElement('p');
  status.className = 'mdj-client-session-wiring__status';
  status.dataset.mdjSessionStatus = injection.canReadClientPortal ? 'ready' : 'gated';
  status.textContent = injection.canReadClientPortal
    ? 'Client portal read access: ready (scoped to client_id)'
    : `Client portal read access: gated (${injection.context.authorizationNoneReason ?? 'denied'})`;

  const domains = document.createElement('ul');
  domains.className = 'mdj-client-session-wiring__domains';
  domains.dataset.mdjSessionDomains = '1';
  for (const domain of CLIENT_DOMAINS) {
    const li = document.createElement('li');
    const verdict = injection.domainAccess[domain];
    li.dataset.mdjDomain = domain;
    li.dataset.mdjDomainAllowed = verdict.allowed ? '1' : '0';
    li.textContent = `${domain}: ${verdict.allowed ? 'ok' : verdict.reason}`;
    domains.append(li);
  }

  const note = document.createElement('p');
  note.className = 'mdj-client-session-wiring__note';
  note.textContent =
    'Read-only session injection — login / password / token refresh controls are not available in this slice.';

  root.append(eyebrow, title, role, clientId, bearer, status, domains, note);

  for (const el of root.querySelectorAll('form, input, textarea, select, button[type="submit"]')) {
    el.remove();
  }

  container.replaceChildren(root);
}
