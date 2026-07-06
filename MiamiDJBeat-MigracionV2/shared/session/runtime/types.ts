/** MOD-002 Session Manager — types — TICKET-V2-RUNTIME-SESSION-001 */

import type { PortalId } from '@mdj/shared/config';

/** Official 9-state machine — SESSION-STATE-MACHINE.md (Phase 1; not wired to boot). */
export type SessionStateMachineState =
  | 'INITIAL'
  | 'LOADING'
  | 'AUTHENTICATED'
  | 'ANONYMOUS'
  | 'EXPIRED'
  | 'REFRESHING'
  | 'LOGGING_OUT'
  | 'DESTROYED'
  | 'ERROR';

/** Events that drive official session state transitions. */
export type SessionTransitionEvent =
  | 'MODULE_LOAD'
  | 'SYSTEM_READY'
  | 'VALIDATE_OK_USER'
  | 'VALIDATE_OK_NO_USER'
  | 'VALIDATE_FAIL_RECOVERABLE'
  | 'VALIDATE_FAIL_FATAL'
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'PERMISSION_CHANGED'
  | 'REFRESH_START'
  | 'REFRESH_OK'
  | 'REFRESH_FAIL'
  | 'EXPIRY_DETECTED'
  | 'TEARDOWN_COMPLETE'
  | 'MANUAL_RECOVERY'
  | 'NEW_BOOT_CYCLE';

/** Pre-INITIAL uses null (module load entry). */
export type SessionTransitionFrom = SessionStateMachineState | null;

/** Scaffold runtime states — unchanged for boot baseline (TICKET-V2-BOOTLINE-BASELINE-001). */
export type SessionLifecycleState =
  | 'SESSION_UNINITIALIZED'
  | 'INITIAL_SESSION'
  | 'SIGNED_OUT'
  | 'SIGNED_IN'
  | 'SESSION_READY'
  | 'SESSION_EXPIRED';

export type HydrationPhase = 'initial' | 'signed_in' | 'none';

export type AuthProvider = 'mock' | 'supabase';

export type AuthHandle = {
  readonly handoffId: string;
  readonly userId: string;
  readonly accessTokenRef: string;
  readonly refreshTokenRef?: string;
  readonly expiresAt: string;
  readonly provider: AuthProvider;
  readonly issuedAt: string;
};

export type UserRef = {
  readonly userId: string;
  readonly email?: string;
  readonly mdjbId?: string;
};

export type SessionSnapshot = {
  readonly user: UserRef | null;
  readonly portal: PortalId;
  readonly roles: readonly string[];
  readonly capabilities: readonly string[];
  readonly locale: 'en' | 'es';
  readonly theme: 'dark' | 'light';
  readonly featureFlags: Readonly<Record<string, boolean>>;
  readonly sessionId: string;
  readonly expiresAt: string | null;
  readonly hydrationPhase: HydrationPhase;
  readonly state: SessionLifecycleState;
  readonly snapshotVersion: number;
  readonly updatedAt: string;
  readonly isRefreshing: boolean;
};

export type SessionPublicApi = {
  readonly ingestAuthHandle: (handle: AuthHandle) => SessionSnapshot;
  readonly clearSession: (reason?: string) => SessionSnapshot;
  readonly destroySession: (reason?: string) => void;
  readonly getSnapshot: () => SessionSnapshot;
  readonly getState: () => SessionLifecycleState;
};

export type SessionErrorCode =
  | 'SESSION_ERROR_INVALID_HANDLE'
  | 'SESSION_ERROR_EXPIRED_HANDLE'
  | 'SESSION_ERROR_NOT_READY'
  | 'SESSION_ERROR_ILLEGAL_TRANSITION';

export type InitializeSessionOptions = {
  portal: PortalId;
};

/** Official session events emitted by MOD-002 (Phase 3 wiring). */
export type SessionEmitEventName =
  | 'SESSION_CREATED'
  | 'SESSION_READY'
  | 'SESSION_DESTROYED'
  | 'SESSION_EXPIRED'
  | 'SESSION_ERROR';

export type UserLoginEventPayload = {
  readonly userId: string;
  readonly handoffId?: string;
  readonly accessTokenRef?: string;
  readonly refreshTokenRef?: string;
  readonly expiresAt?: string;
  readonly issuedAt?: string;
  readonly provider?: AuthProvider;
};

export type UserLogoutEventPayload = {
  readonly reason: string;
  readonly userId?: string;
};

export type RoleChangedEventPayload = {
  readonly userId: string;
  readonly role: string;
  readonly principal: string;
  readonly roles?: readonly string[];
};

export type PermissionChangedEventPayload = {
  readonly userId: string;
  readonly snapshotVersion?: number;
  readonly capabilities?: readonly string[];
};
