import { beforeEach, describe, expect, it } from 'vitest';
import {
  AuthSessionBoundary,
  resetAuthSessionBoundaryForTests,
} from '../../shared/session/runtime/auth-session-boundary';
import { SessionError } from '../../shared/session/runtime/errors';

describe('MOD-001 ↔ MOD-002 AuthSessionBoundary — TICKET-MOD-002-AUTH-HANDOFF-001', () => {
  let boundary: AuthSessionBoundary;

  beforeEach(() => {
    resetAuthSessionBoundaryForTests();
    boundary = new AuthSessionBoundary();
  });

  it('validates a mock AuthHandle and maps IdentitySnapshot to UserRef', () => {
    const input = boundary.createMockAuthHandoff('user-auth-1', {}, {
      userId: 'user-auth-1',
      email: 'auth@example.com',
      mdjbId: 'MDJB-0001-0001-A',
    });

    const validated = boundary.validateAuthHandoff(input);

    expect(validated.hydrationPhase).toBe('signed_in');
    expect(validated.userRef.userId).toBe('user-auth-1');
    expect(validated.userRef.email).toBe('auth@example.com');
    expect(validated.userRef.mdjbId).toBe('MDJB-0001-0001-A');
    expect(Object.isFrozen(validated)).toBe(true);
    expect(Object.isFrozen(validated.userRef)).toBe(true);
  });

  it('rejects identity userId mismatch with SESSION_ERROR_INVALID_HANDLE', () => {
    const input = boundary.createMockAuthHandoff('user-a', {}, { userId: 'user-b' });

    expect(() => boundary.validateAuthHandoff(input)).toThrow(SessionError);
    expect(() => boundary.validateAuthHandoff(input)).toThrow(/userId must match/i);
  });

  it('rejects expired AuthHandle with SESSION_ERROR_EXPIRED_HANDLE', () => {
    const input = boundary.createMockExpiredHandoff('expired-user');

    expect(() => boundary.validateAuthHandoff(input)).toThrow(SessionError);
    try {
      boundary.validateAuthHandoff(input);
    } catch (error) {
      expect(error).toBeInstanceOf(SessionError);
      expect((error as SessionError).code).toBe('SESSION_ERROR_EXPIRED_HANDLE');
    }
  });

  it('tryValidateAuthHandoff returns structured rejection without throwing', () => {
    const input = boundary.createMockExpiredHandoff('expired-user-2');
    const result = boundary.tryValidateAuthHandoff(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('SESSION_ERROR_EXPIRED_HANDLE');
      expect(result.handoffId).toBe(input.handle.handoffId);
    }
  });

  it('buildAuthHandleFromUserLogin produces a frozen mock handle', () => {
    const handle = boundary.buildAuthHandleFromUserLogin({
      userId: 'bus-user-99',
      handoffId: 'handoff-bus-99',
    });

    expect(handle.userId).toBe('bus-user-99');
    expect(handle.provider).toBe('mock');
    expect(Object.isFrozen(handle)).toBe(true);
  });

  it('normalizeLogout defaults empty reason to logout', () => {
    const normalized = boundary.normalizeLogout({ reason: '  ' });
    expect(normalized.reason).toBe('logout');
  });
});
