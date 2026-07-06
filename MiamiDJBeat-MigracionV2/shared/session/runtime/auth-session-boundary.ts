/** MOD-001 ↔ MOD-002 Auth Session Boundary — TICKET-MOD-002-AUTH-HANDOFF-001 */

import type { PortalId } from '@mdj/shared/config';
import { SessionError } from './errors';
import type {
  AuthHandle,
  AuthHandoffInput,
  AuthHandoffResult,
  AuthLogoutBoundaryResult,
  AuthLogoutInput,
  IdentitySnapshot,
  UserLoginEventPayload,
  UserRef,
  ValidatedAuthHandoff,
} from './types';

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isExpiredIsoTimestamp(value: string): boolean {
  const expiryMs = Date.parse(value);
  return Number.isNaN(expiryMs) || expiryMs <= Date.now();
}

/** MOD-001 ↔ MOD-002 contract — validates handoffs; Session applies lifecycle. */
export class AuthSessionBoundary {
  validateAuthHandoff(input: AuthHandoffInput): ValidatedAuthHandoff {
    const { handle, identity } = input;
    this.assertValidHandle(handle);

    if (identity && identity.userId !== handle.userId) {
      throw new SessionError(
        'SESSION_ERROR_INVALID_HANDLE',
        'IdentitySnapshot userId must match AuthHandle userId.',
      );
    }

    return Object.freeze({
      handle,
      userRef: this.resolveUserRef(handle, identity),
      hydrationPhase: 'signed_in',
    });
  }

  tryValidateAuthHandoff(input: AuthHandoffInput): AuthHandoffResult {
    try {
      const validated = this.validateAuthHandoff(input);
      return Object.freeze({
        ok: true,
        handoffId: validated.handle.handoffId,
        userId: validated.userRef.userId,
        hydrationPhase: validated.hydrationPhase,
      });
    } catch (error) {
      if (error instanceof SessionError) {
        return Object.freeze({
          ok: false,
          handoffId: input.handle.handoffId,
          code: error.code,
          message: error.message,
        });
      }
      throw error;
    }
  }

  resolveUserRef(handle: AuthHandle, identity?: IdentitySnapshot): UserRef {
    return Object.freeze({
      userId: handle.userId,
      email: identity?.email,
      mdjbId: identity?.mdjbId,
    });
  }

  buildAuthHandleFromUserLogin(payload: UserLoginEventPayload): AuthHandle {
    if (!payload.userId) {
      throw new SessionError('SESSION_ERROR_INVALID_HANDLE', 'USER_LOGIN payload is missing userId.');
    }

    return Object.freeze({
      handoffId: payload.handoffId ?? `handoff-${payload.userId}`,
      userId: payload.userId,
      accessTokenRef: payload.accessTokenRef ?? 'mock-access-ref',
      refreshTokenRef: payload.refreshTokenRef,
      expiresAt: payload.expiresAt ?? new Date(Date.now() + 3_600_000).toISOString(),
      provider: payload.provider ?? 'mock',
      issuedAt: payload.issuedAt ?? new Date().toISOString(),
    });
  }

  normalizeLogout(input: AuthLogoutInput): AuthLogoutBoundaryResult {
    const reason = input.reason.trim() || 'logout';
    return Object.freeze({
      reason,
      userId: input.userId,
    });
  }

  /** Lab/test helper — simulates MOD-001 handoff without Auth runtime. */
  createMockAuthHandoff(
    userId: string,
    overrides: Partial<AuthHandle> = {},
    identity?: IdentitySnapshot,
    portalContext?: PortalId,
  ): AuthHandoffInput {
    const handle = Object.freeze({
      handoffId: overrides.handoffId ?? `mock-handoff-${userId}`,
      userId,
      accessTokenRef: overrides.accessTokenRef ?? 'mock-access-ref',
      refreshTokenRef: overrides.refreshTokenRef,
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 3_600_000).toISOString(),
      provider: overrides.provider ?? ('mock' as const),
      issuedAt: overrides.issuedAt ?? new Date().toISOString(),
    });

    return Object.freeze({
      handle,
      identity: identity ?? Object.freeze({ userId, authProvider: 'mock' }),
      portalContext,
    });
  }

  /** Lab/test helper — expired mock for SESSION_EXPIRED lifecycle tests. */
  createMockExpiredHandoff(userId: string): AuthHandoffInput {
    return this.createMockAuthHandoff(userId, {
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
    });
  }

  private assertValidHandle(handle: AuthHandle): void {
    const requiredFields = [
      handle.handoffId,
      handle.userId,
      handle.accessTokenRef,
      handle.expiresAt,
      handle.issuedAt,
    ];

    if (requiredFields.some((value) => value.length === 0)) {
      throw new SessionError('SESSION_ERROR_INVALID_HANDLE', 'AuthHandle is missing required fields.');
    }

    const allowedProviders: AuthHandle['provider'][] = ['mock', 'supabase'];
    if (!allowedProviders.includes(handle.provider)) {
      throw new SessionError('SESSION_ERROR_INVALID_HANDLE', 'AuthHandle provider is invalid.');
    }

    const expiryMs = Date.parse(handle.expiresAt);
    if (Number.isNaN(expiryMs)) {
      throw new SessionError('SESSION_ERROR_INVALID_HANDLE', 'AuthHandle expiresAt is invalid.');
    }

    if (isExpiredIsoTimestamp(handle.expiresAt)) {
      throw new SessionError('SESSION_ERROR_EXPIRED_HANDLE', 'AuthHandle is expired.');
    }

    if (!isNonEmptyString(handle.userId)) {
      throw new SessionError('SESSION_ERROR_INVALID_HANDLE', 'AuthHandle userId is invalid.');
    }
  }
}

let defaultBoundary: AuthSessionBoundary | null = null;

export function getAuthSessionBoundary(): AuthSessionBoundary {
  if (!defaultBoundary) {
    defaultBoundary = new AuthSessionBoundary();
  }
  return defaultBoundary;
}

/** Test-only reset — not for production portals. */
export function resetAuthSessionBoundaryForTests(): void {
  defaultBoundary = null;
}
