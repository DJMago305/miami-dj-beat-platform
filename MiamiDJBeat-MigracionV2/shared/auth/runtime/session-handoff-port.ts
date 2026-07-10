/** MOD-001 Authentication — session handoff port — TICKET-V2-PHASE-5-MOD-001-AUTH-FOUNDATION-001 */

import type { PortalId } from '@mdj/shared/config';
import type { AuthHandle, IdentitySnapshot } from './types';

export type SessionHandoffDeliveryInput = {
  readonly handle: AuthHandle;
  readonly identity?: IdentitySnapshot;
  readonly portalContext?: PortalId;
};

export type SessionHandoffAcceptance = {
  readonly ok: true;
  readonly handoffId: string;
  readonly userId: string;
};

export type SessionHandoffRejection = {
  readonly ok: false;
  readonly handoffId: string;
  readonly code: string;
  readonly message: string;
};

export type SessionHandoffDeliveryResult = SessionHandoffAcceptance | SessionHandoffRejection;

/** Injected at bootstrap — Auth never imports Session implementation. */
export type SessionHandoffPort = {
  readonly deliver: (input: SessionHandoffDeliveryInput) => SessionHandoffDeliveryResult;
};
