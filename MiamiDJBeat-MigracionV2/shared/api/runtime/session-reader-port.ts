/** MOD-005 API Client — session reader port — TICKET-V2-PHASE-4-MOD-005-FOUNDATION-001 */

import type { PortalId } from '@mdj/shared/config';
import type { SessionSnapshot } from '@mdj/shared/session';

export type SessionReaderPort = {
  getSessionId(): string | null;
  getPortal(): PortalId | null;
  getAuthorizationHeader(): string | null;
  getActorType(): string;
};

export function createSessionReaderFromSnapshot(
  getSnapshot: () => SessionSnapshot | null,
  resolveAuthorization?: (snapshot: SessionSnapshot) => string | null,
): SessionReaderPort {
  return {
    getSessionId() {
      return getSnapshot()?.sessionId ?? null;
    },
    getPortal() {
      return getSnapshot()?.portal ?? null;
    },
    getAuthorizationHeader() {
      const snapshot = getSnapshot();
      if (!snapshot || !snapshot.user) {
        return null;
      }
      return resolveAuthorization?.(snapshot) ?? null;
    },
    getActorType() {
      const snapshot = getSnapshot();
      if (!snapshot?.user) {
        return 'guest';
      }
      return 'authenticated';
    },
  };
}

export function createStaticSessionReader(input: {
  sessionId?: string | null;
  portal?: PortalId | null;
  authorizationHeader?: string | null;
  actorType?: string;
}): SessionReaderPort {
  return {
    getSessionId: () => input.sessionId ?? null,
    getPortal: () => input.portal ?? null,
    getAuthorizationHeader: () => input.authorizationHeader ?? null,
    getActorType: () => input.actorType ?? 'guest',
  };
}
