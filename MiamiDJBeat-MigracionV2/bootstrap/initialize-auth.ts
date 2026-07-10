/** MOD-001 Authentication — boot wiring — TICKET-V2-PHASE-5-MOD-001-AUTH-BOOTSTRAP-WIRING-001 */

import type { PortalId } from '@mdj/shared/config';
import {
  AuthError,
  createMockAuthProvider,
  getAuthService,
  initializeAuth,
  type MockAuthProvider,
  type MockAuthProviderOptions,
} from '../shared/auth/runtime';
import type { AuthErrorCode, AuthLifecycleState } from '../shared/auth/runtime/types';

export const BOOT_AUTH_HANDOFF_MODE = 'event-bus-only' as const;

const RECOVERABLE_BOOT_AUTH_CODES = new Set<AuthErrorCode>([
  'ERR-AUTH-004',
  'ERR-AUTH-006',
  'ERR-AUTH-007',
  'ERR-AUTH-009',
]);

export type BootAuthRegistration = {
  readonly handoffMode: typeof BOOT_AUTH_HANDOFF_MODE;
};

export type BootAuthActivationResult =
  | { readonly ok: true; readonly state: AuthLifecycleState; readonly userId?: string }
  | {
      readonly ok: false;
      readonly recoverable: boolean;
      readonly code: string;
      readonly message: string;
    };

let bootMockProvider: MockAuthProvider | null = null;

export function registerAuthForBoot(
  options?: MockAuthProviderOptions,
): BootAuthRegistration {
  if (!bootMockProvider || options !== undefined) {
    bootMockProvider = createMockAuthProvider(options);
  }

  initializeAuth({ provider: bootMockProvider });
  return { handoffMode: BOOT_AUTH_HANDOFF_MODE };
}

export function activateAuthForBoot(portal: PortalId): BootAuthActivationResult {
  try {
    const result = getAuthService().initializeForBoot(portal);

    if (result.ok) {
      return {
        ok: true,
        state: result.state,
        ...(result.userId ? { userId: result.userId } : {}),
      };
    }

    return {
      ok: false,
      recoverable: RECOVERABLE_BOOT_AUTH_CODES.has(result.code),
      code: result.code,
      message: result.message,
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        recoverable: false,
        code: error.code,
        message: error.message,
      };
    }

    throw error;
  }
}

/** Test-only access to the boot-scoped mock provider instance. */
export function getBootMockAuthProviderForTests(): MockAuthProvider {
  if (!bootMockProvider) {
    throw new Error('Boot mock auth provider is not registered.');
  }
  return bootMockProvider;
}

/** Test-only reset — not for production portals. */
export function resetBootAuthWiringForTests(): void {
  bootMockProvider = null;
}
