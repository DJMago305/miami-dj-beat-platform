/** MOD-001 Authentication — service — TICKET-V2-PHASE-5-MOD-001-AUTH-FOUNDATION-001 */

import type { PortalId } from '@mdj/shared/config';
import { getEventBus } from '@mdj/shared/events';
import type { AuthPort } from './auth-port';
import type { AuthProviderPort } from './auth-provider-port';
import { AuthError } from './errors';
import type { SessionHandoffDeliveryInput, SessionHandoffPort } from './session-handoff-port';
import { assertAuthTransition } from './state-machine';
import type {
  AuthIdentityView,
  AuthLifecycleState,
  AuthSnapshot,
  AuthTransitionEvent,
  BuiltAuthHandoff,
  RefreshAuthResult,
  RestoreAuthResult,
  SignInCredentials,
  SignInResult,
  SignOutRequest,
  SignOutResult,
} from './types';

const AUTH_EMITTER = { moduleId: 'MOD-001', subsystem: 'auth' } as const;

export type AuthServiceDependencies = {
  readonly provider: AuthProviderPort;
  readonly sessionHandoffPort?: SessionHandoffPort;
};

let handoffCounter = 0;

function nextHandoffId(userId: string): string {
  handoffCounter += 1;
  return `auth-handoff-${userId}-${String(handoffCounter)}`;
}

function toIdentityView(
  identity: BuiltAuthHandoff['identity'],
  provider: BuiltAuthHandoff['handle']['provider'],
): AuthIdentityView {
  return Object.freeze({
    userId: identity.userId,
    email: identity.email,
    mdjbId: identity.mdjbId,
    displayName: identity.displayName,
    provider,
  });
}

function publishAuthEvent(name: 'USER_LOGIN' | 'USER_LOGOUT', payload: Record<string, unknown>): void {
  const result = getEventBus().publish({
    name,
    payload,
    emitter: AUTH_EMITTER,
    scope: 'public',
  });

  if (!result.ok) {
    throw new AuthError('ERR-AUTH-001', `Failed to publish ${name}: ${result.message}`);
  }
}

export class AuthService implements AuthPort {
  private state: AuthLifecycleState = 'UNKNOWN';
  private userId: string | null = null;
  private identity: AuthIdentityView | null = null;
  private activeHandoffId: string | null = null;
  private portal: PortalId | null = null;
  private refreshTokenRef: string | null = null;
  private updatedAt = new Date().toISOString();

  constructor(private readonly deps: AuthServiceDependencies) {}

  async initialize(): Promise<RestoreAuthResult> {
    this.applyTransition('BOOT_START', 'CHECKING_EXISTING_AUTH');
    return this.restoreInternal();
  }

  getSnapshot(): AuthSnapshot {
    return Object.freeze({
      state: this.state,
      userId: this.userId,
      identity: this.identity,
      activeHandoffId: this.activeHandoffId,
      portal: this.portal,
      updatedAt: this.updatedAt,
    });
  }

  getState(): AuthLifecycleState {
    return this.state;
  }

  async signIn(credentials: SignInCredentials, portal: PortalId): Promise<SignInResult> {
    if (this.state !== 'UNAUTHENTICATED' && this.state !== 'EXPIRED' && this.state !== 'FAILED') {
      return {
        ok: false,
        code: 'ERR-AUTH-001',
        message: `Sign-in is not allowed from state ${this.state}.`,
      };
    }

    this.portal = portal;
    this.applyTransition('SIGN_IN_REQUEST', 'AUTHENTICATING');

    const providerResult = await this.deps.provider.signIn({ credentials, portal });
    if (!providerResult.ok) {
      this.applyTransition('SIGN_IN_FAIL', 'FAILED');
      this.applyTransition('RESET_TO_ANONYMOUS', 'UNAUTHENTICATED');
      return {
        ok: false,
        code: providerResult.code,
        message: providerResult.message,
      };
    }

    return this.completeIdentityHandoff({
      userId: providerResult.userId,
      identity: providerResult.identity,
      accessTokenRef: providerResult.accessTokenRef,
      refreshTokenRef: providerResult.refreshTokenRef,
      expiresAt: providerResult.expiresAt,
      issuedAt: providerResult.issuedAt,
      provider: providerResult.provider,
      portal,
    });
  }

  async signOut(request: SignOutRequest = { reason: 'user' }): Promise<SignOutResult> {
    if (this.state !== 'SESSION_HANDOFF_SUCCEEDED') {
      if (this.userId) {
        this.emitUserLogout(request.reason, this.userId);
      }
      this.clearIdentity();
      if (this.state === 'FAILED') {
        this.applyTransition('RESET_TO_ANONYMOUS', 'UNAUTHENTICATED');
      } else if (this.state !== 'UNAUTHENTICATED' && this.state !== 'LOGGED_OUT') {
        this.state = 'UNAUTHENTICATED';
        this.updatedAt = new Date().toISOString();
      }
      return { ok: true, state: this.state };
    }

    this.applyTransition('SIGN_OUT_REQUEST', 'LOGGING_OUT');

    try {
      await this.deps.provider.signOut(request);
      this.emitUserLogout(request.reason, this.userId ?? undefined);
      this.applyTransition('SIGN_OUT_SUCCESS', 'LOGGED_OUT');
      this.clearIdentity();
      this.applyTransition('RESET_TO_ANONYMOUS', 'UNAUTHENTICATED');
      return { ok: true, state: this.state };
    } catch {
      this.applyTransition('SIGN_OUT_FAIL', 'FAILED');
      this.clearIdentity();
      this.applyTransition('RESET_TO_ANONYMOUS', 'UNAUTHENTICATED');
      return {
        ok: false,
        code: 'ERR-AUTH-003',
        message: 'Provider sign-out failed.',
      };
    }
  }

  async refresh(): Promise<RefreshAuthResult> {
    if (this.state !== 'SESSION_HANDOFF_SUCCEEDED') {
      return {
        ok: false,
        code: 'ERR-AUTH-008',
        message: `Refresh is not allowed from state ${this.state}.`,
      };
    }

    if (!this.refreshTokenRef) {
      return {
        ok: false,
        code: 'ERR-AUTH-008',
        message: 'Refresh token ref is unavailable.',
      };
    }

    this.applyTransition('REFRESH_REQUEST', 'REFRESHING');
    const refreshResult = await this.deps.provider.refresh(this.refreshTokenRef);

    if (!refreshResult.ok) {
      this.applyTransition('REFRESH_FAIL', 'EXPIRED');
      return {
        ok: false,
        code: refreshResult.code,
        message: refreshResult.message,
      };
    }

    if (!this.userId || !this.identity || !this.portal) {
      this.applyTransition('REFRESH_FAIL', 'EXPIRED');
      return {
        ok: false,
        code: 'ERR-AUTH-005',
        message: 'Refresh requires active identity context.',
      };
    }

    const handoff = this.buildHandoff({
      userId: this.userId,
      identity: {
        userId: this.identity.userId,
        email: this.identity.email,
        mdjbId: this.identity.mdjbId,
        displayName: this.identity.displayName,
        authProvider: this.identity.provider,
      },
      accessTokenRef: refreshResult.accessTokenRef,
      refreshTokenRef: refreshResult.refreshTokenRef ?? this.refreshTokenRef,
      expiresAt: refreshResult.expiresAt,
      issuedAt: refreshResult.issuedAt,
      provider: this.identity.provider,
      portal: this.portal,
    });

    this.refreshTokenRef = handoff.handle.refreshTokenRef ?? this.refreshTokenRef;
    this.emitUserLogin(handoff);
    this.applyTransition('USER_LOGIN_EMITTED', 'SESSION_HANDOFF_PENDING');

    const handoffResult = this.deliverHandoff(handoff);
    if (!handoffResult.ok) {
      this.applyTransition('HANDOFF_REJECTED', 'FAILED');
      this.clearIdentity();
      this.applyTransition('RESET_TO_ANONYMOUS', 'UNAUTHENTICATED');
      return {
        ok: false,
        code: 'ERR-AUTH-009',
        message: handoffResult.message,
      };
    }

    this.applyTransition('HANDOFF_ACCEPTED', 'SESSION_HANDOFF_SUCCEEDED');
    return {
      ok: true,
      handoffId: handoff.handle.handoffId,
      state: this.state,
    };
  }

  async requestLogout(reason: string, userId?: string): Promise<SignOutResult> {
    return this.signOut({
      reason: reason.trim() ? (reason as SignOutRequest['reason']) : 'forced',
      userId,
    });
  }

  private async restoreInternal(): Promise<RestoreAuthResult> {
    const restoreResult = await this.deps.provider.restore();

    if (!restoreResult.ok) {
      this.applyTransition('SIGN_IN_FAIL', 'UNAUTHENTICATED');
      return {
        ok: false,
        code: restoreResult.code,
        message: restoreResult.message,
      };
    }

    if ('empty' in restoreResult && restoreResult.empty) {
      this.clearIdentity();
      this.applyTransition('RESTORE_EMPTY', 'UNAUTHENTICATED');
      return { ok: true, state: this.state };
    }

    if (!('userId' in restoreResult)) {
      this.applyTransition('RESTORE_EMPTY', 'UNAUTHENTICATED');
      return { ok: true, state: this.state };
    }

    this.applyTransition('RESTORE_FOUND', 'AUTHENTICATED_IDENTITY_RECEIVED');
    const handoffResult = this.completeIdentityHandoff({
      userId: restoreResult.userId,
      identity: restoreResult.identity,
      accessTokenRef: restoreResult.accessTokenRef,
      refreshTokenRef: restoreResult.refreshTokenRef,
      expiresAt: restoreResult.expiresAt,
      issuedAt: restoreResult.issuedAt,
      provider: restoreResult.provider,
      portal: this.portal ?? 'client',
    });

    if (!handoffResult.ok) {
      return {
        ok: false,
        code: handoffResult.code,
        message: handoffResult.message,
      };
    }

    return {
      ok: true,
      state: this.state,
      userId: handoffResult.userId,
    };
  }

  private completeIdentityHandoff(input: {
    userId: string;
    identity: BuiltAuthHandoff['identity'];
    accessTokenRef: string;
    refreshTokenRef?: string;
    expiresAt: string;
    issuedAt: string;
    provider: BuiltAuthHandoff['handle']['provider'];
    portal: PortalId;
  }): SignInResult {
    this.applyTransition('SIGN_IN_SUCCESS', 'AUTHENTICATED_IDENTITY_RECEIVED');

    const handoff = this.buildHandoff(input);
    this.userId = input.userId;
    this.identity = toIdentityView(input.identity, input.provider);
    this.refreshTokenRef = input.refreshTokenRef ?? null;
    this.activeHandoffId = handoff.handle.handoffId;

    this.emitUserLogin(handoff);
    this.applyTransition('USER_LOGIN_EMITTED', 'SESSION_HANDOFF_PENDING');

    const delivery = this.deliverHandoff(handoff);
    if (!delivery.ok) {
      this.applyTransition('HANDOFF_REJECTED', 'FAILED');
      this.clearIdentity();
      this.applyTransition('RESET_TO_ANONYMOUS', 'UNAUTHENTICATED');
      return {
        ok: false,
        code: 'ERR-AUTH-009',
        message: delivery.message,
      };
    }

    this.applyTransition('HANDOFF_ACCEPTED', 'SESSION_HANDOFF_SUCCEEDED');
    return {
      ok: true,
      handoffId: handoff.handle.handoffId,
      userId: input.userId,
      state: this.state,
    };
  }

  private buildHandoff(input: {
    userId: string;
    identity: BuiltAuthHandoff['identity'];
    accessTokenRef: string;
    refreshTokenRef?: string;
    expiresAt: string;
    issuedAt: string;
    provider: BuiltAuthHandoff['handle']['provider'];
    portal: PortalId;
  }): BuiltAuthHandoff {
    const handoffId = nextHandoffId(input.userId);
    const handle = Object.freeze({
      handoffId,
      userId: input.userId,
      accessTokenRef: input.accessTokenRef,
      refreshTokenRef: input.refreshTokenRef,
      expiresAt: input.expiresAt,
      provider: input.provider,
      issuedAt: input.issuedAt,
    });

    return Object.freeze({
      handle,
      identity: Object.freeze({ ...input.identity }),
      portalContext: input.portal,
    });
  }

  private emitUserLogin(handoff: BuiltAuthHandoff): void {
    publishAuthEvent('USER_LOGIN', {
      userId: handoff.handle.userId,
      handoffId: handoff.handle.handoffId,
      accessTokenRef: handoff.handle.accessTokenRef,
      refreshTokenRef: handoff.handle.refreshTokenRef,
      expiresAt: handoff.handle.expiresAt,
      issuedAt: handoff.handle.issuedAt,
      provider: handoff.handle.provider,
    });
  }

  private emitUserLogout(reason: string, userId?: string): void {
    publishAuthEvent('USER_LOGOUT', {
      reason,
      userId,
    });
  }

  private deliverHandoff(handoff: BuiltAuthHandoff): { ok: true } | { ok: false; message: string } {
    if (!this.deps.sessionHandoffPort) {
      return { ok: true };
    }

    const input: SessionHandoffDeliveryInput = {
      handle: handoff.handle,
      identity: handoff.identity,
      portalContext: handoff.portalContext,
    };
    const result = this.deps.sessionHandoffPort.deliver(input);
    if (result.ok) {
      return { ok: true };
    }

    return {
      ok: false,
      message: result.message,
    };
  }

  private applyTransition(event: AuthTransitionEvent, to: AuthLifecycleState): void {
    assertAuthTransition(this.state, to, event);
    this.state = to;
    this.updatedAt = new Date().toISOString();
  }

  private clearIdentity(): void {
    this.userId = null;
    this.identity = null;
    this.activeHandoffId = null;
    this.portal = null;
    this.refreshTokenRef = null;
    this.updatedAt = new Date().toISOString();
  }

  resetForTests(): void {
    this.state = 'UNKNOWN';
    this.clearIdentity();
    this.updatedAt = new Date().toISOString();
  }
}

export function createAuthService(deps: AuthServiceDependencies): AuthService {
  return new AuthService(deps);
}

export function resetAuthHandoffCounterForTests(): void {
  handoffCounter = 0;
}
