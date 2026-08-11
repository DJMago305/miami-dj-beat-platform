/**
 * MOD-301 Session Wiring Pilot — Staff portal read-only session injection (Paso 3).
 * Uses session-wiring adapter · no login forms · no Auth writers.
 */

import {
  createSessionWiringAdapter,
  MOCK_SW_BEARER_SELLER,
  MOCK_SW_BEARER_STAFF,
  MOCK_SW_SNAPSHOT_ANONYMOUS,
  MOCK_SW_SNAPSHOT_EXPIRED,
  MOCK_SW_SNAPSHOT_STAFF,
  MOCK_SW_SNAPSHOT_STAFF_SELLER,
  type DomainAccessVerdict,
  type DomainWiringId,
  type LabSessionSnapshotRow,
} from '../../shared/services/session-wiring/index';
import type { AuthBearerHeaderDTO, SessionContextDTO } from '../../shared/types/session.types';

export type StaffSessionPilotVariant = 'staff' | 'staff_seller' | 'anonymous' | 'expired';

export type StaffSessionWiringInjection = {
  readonly context: SessionContextDTO;
  readonly bearer: AuthBearerHeaderDTO;
  readonly variant: StaffSessionPilotVariant;
  readonly canReadStaffPortal: boolean;
  readonly domainAccess: Readonly<Record<DomainWiringId, DomainAccessVerdict>>;
  readonly sourceLabel: string;
};

const STAFF_DOMAINS: readonly DomainWiringId[] = Object.freeze([
  'profiles',
  'bookings',
  'financial',
  'weather',
]);

function pickFixtures(variant: StaffSessionPilotVariant): {
  readonly snapshot: LabSessionSnapshotRow;
  readonly bearerHeader: string | null;
} {
  if (variant === 'staff_seller') {
    return Object.freeze({
      snapshot: MOCK_SW_SNAPSHOT_STAFF_SELLER,
      bearerHeader: MOCK_SW_BEARER_SELLER,
    });
  }
  if (variant === 'anonymous') {
    return Object.freeze({
      snapshot: MOCK_SW_SNAPSHOT_ANONYMOUS,
      bearerHeader: null,
    });
  }
  if (variant === 'expired') {
    return Object.freeze({
      snapshot: MOCK_SW_SNAPSHOT_EXPIRED,
      bearerHeader: MOCK_SW_BEARER_STAFF,
    });
  }
  return Object.freeze({
    snapshot: MOCK_SW_SNAPSHOT_STAFF,
    bearerHeader: MOCK_SW_BEARER_STAFF,
  });
}

/**
 * Resolve lab staff session context + per-domain read verdicts (read-only).
 */
export function resolveStaffSessionWiringPilot(
  variant: StaffSessionPilotVariant = 'staff',
): StaffSessionWiringInjection {
  const fixtures = pickFixtures(variant);
  const adapter = createSessionWiringAdapter({
    defaultSnapshot: fixtures.snapshot,
    defaultBearerHeader: fixtures.bearerHeader,
  });
  const { context, bearer } = adapter.getLabSessionContext();

  const domainAccess = Object.freeze(
    Object.fromEntries(
      STAFF_DOMAINS.map((domain) => [
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

  const roleOk = context.sessionRole === 'staff' || context.sessionRole === 'staff_seller';
  const canReadStaffPortal =
    roleOk &&
    bearer.present &&
    !context.isExpired &&
    !context.isAnonymous &&
    context.authorizationKind === 'ready';

  return Object.freeze({
    context,
    bearer,
    variant,
    canReadStaffPortal,
    domainAccess,
    sourceLabel: canReadStaffPortal
      ? `session-wiring pilot · ${context.sessionRole}`
      : `session-gated · ${context.sessionRole}`,
  });
}

export function staffDomainAccessAllowed(
  injection: StaffSessionWiringInjection | null | undefined,
  domain: DomainWiringId,
): boolean {
  if (!injection) return true;
  if (!injection.canReadStaffPortal) return false;
  return injection.domainAccess[domain]?.allowed === true;
}

export function annotateStaffMountSourceLabel(
  base: string,
  injection: StaffSessionWiringInjection | null | undefined,
  domain: DomainWiringId,
): string {
  if (!injection) return base;
  const verdict = injection.domainAccess[domain];
  if (injection.canReadStaffPortal && verdict?.allowed) {
    return `${base} · ${injection.sourceLabel}`;
  }
  return `${base} · session-gated (${verdict?.reason ?? 'denied'})`;
}

/**
 * DOM badge — active role + redacted bearer status (no token leak, no login UI).
 */
export function renderStaffSessionWiringBadge(
  container: HTMLElement,
  injection: StaffSessionWiringInjection,
): void {
  const root = document.createElement('aside');
  root.className = 'mdj-staff-session-wiring';
  root.dataset.mdjComponent = 'StaffSessionWiringBadge';
  root.dataset.mdjMod = 'MOD-301-SW';
  root.dataset.mdjSessionRole = injection.context.sessionRole;
  root.dataset.mdjSessionReady = injection.canReadStaffPortal ? '1' : '0';
  root.dataset.mdjBearerPresent = injection.bearer.present ? '1' : '0';
  root.setAttribute('aria-label', 'Staff session wiring read status');

  const eyebrow = document.createElement('p');
  eyebrow.className = 'mdj-staff-session-wiring__eyebrow';
  eyebrow.textContent = 'MOD-301 Session Wiring · Read-only pilot';

  const title = document.createElement('h2');
  title.className = 'mdj-staff-session-wiring__title';
  title.textContent = 'Session Context';

  const role = document.createElement('p');
  role.className = 'mdj-staff-session-wiring__role';
  role.dataset.mdjSessionRoleLabel = '1';
  role.textContent = `Active role: ${injection.context.sessionRole}`;

  const bearer = document.createElement('p');
  bearer.className = 'mdj-staff-session-wiring__bearer';
  bearer.dataset.mdjBearerPreview = '1';
  bearer.textContent = `Bearer: ${injection.bearer.redactedPreview}`;

  const status = document.createElement('p');
  status.className = 'mdj-staff-session-wiring__status';
  status.dataset.mdjSessionStatus = injection.canReadStaffPortal ? 'ready' : 'gated';
  status.textContent = injection.canReadStaffPortal
    ? 'Staff portal read access: ready'
    : `Staff portal read access: gated (${injection.context.authorizationNoneReason ?? 'denied'})`;

  const domains = document.createElement('ul');
  domains.className = 'mdj-staff-session-wiring__domains';
  domains.dataset.mdjSessionDomains = '1';
  for (const domain of STAFF_DOMAINS) {
    const li = document.createElement('li');
    const verdict = injection.domainAccess[domain];
    li.dataset.mdjDomain = domain;
    li.dataset.mdjDomainAllowed = verdict.allowed ? '1' : '0';
    li.textContent = `${domain}: ${verdict.allowed ? 'ok' : verdict.reason}`;
    domains.append(li);
  }

  const note = document.createElement('p');
  note.className = 'mdj-staff-session-wiring__note';
  note.textContent =
    'Read-only session injection — login / password / token refresh controls are not available in this slice.';

  root.append(eyebrow, title, role, bearer, status, domains, note);

  // Strip any accidental writer surfaces.
  for (const el of root.querySelectorAll('form, input, textarea, select, button[type="submit"]')) {
    el.remove();
  }

  container.replaceChildren(root);
}
