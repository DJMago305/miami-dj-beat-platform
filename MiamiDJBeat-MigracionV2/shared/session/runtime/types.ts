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

/** Traceable hydration steps — TICKET-MOD-002-SESSION-HYDRATION-RESTORE-001. */
export type HydrationTraceStep =
  | 'boot_started'
  | 'restore_begin'
  | 'restore_empty'
  | 'restore_found'
  | 'restore_expired'
  | 'restore_invalid'
  | 'validate_anonymous'
  | 'validate_authenticated'
  | 'ready';

export type HydrationTrace = {
  readonly steps: readonly HydrationTraceStep[];
  readonly startedAt: string;
  readonly completedAt: string | null;
};

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

/** MOD-001 identity allow-list — AUTH-SESSION-BOUNDARY.md §4. */
export type IdentitySnapshot = {
  readonly userId: string;
  readonly email?: string;
  readonly mdjbId?: string;
  readonly displayName?: string;
  readonly authProvider?: AuthProvider;
};

/** MOD-001 → MOD-002 handoff envelope — contract only, no Auth implementation. */
export type AuthHandoffInput = {
  readonly handle: AuthHandle;
  readonly identity?: IdentitySnapshot;
  readonly portalContext?: PortalId;
};

export type ValidatedAuthHandoff = {
  readonly handle: AuthHandle;
  readonly userRef: UserRef;
  readonly hydrationPhase: 'signed_in';
};

export type AuthHandoffRejection = {
  readonly ok: false;
  readonly handoffId: string;
  readonly code: SessionErrorCode;
  readonly message: string;
};

export type AuthHandoffAcceptance = {
  readonly ok: true;
  readonly handoffId: string;
  readonly userId: string;
  readonly hydrationPhase: 'signed_in';
};

export type AuthHandoffResult = AuthHandoffAcceptance | AuthHandoffRejection;

export type AuthLogoutInput = {
  readonly reason: string;
  readonly userId?: string;
};

export type AuthLogoutBoundaryResult = {
  readonly reason: string;
  readonly userId?: string;
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
  readonly ingestAuthHandle: (handle: AuthHandle, identity?: IdentitySnapshot) => SessionSnapshot;
  readonly clearSession: (reason?: string) => SessionSnapshot;
  readonly destroySession: (reason?: string) => void;
  readonly refreshSession: (options?: SessionRefreshOptions) => Promise<SessionSnapshot>;
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

/** MOD-001 refresh contract input — mock/internal only (Phase 6). */
export type SessionRefreshRequest = {
  readonly sessionId: string;
  readonly userId: string;
  readonly accessTokenRef: string;
  readonly expiresAt: string | null;
};

export type SessionRefreshPortSuccess = {
  readonly ok: true;
  readonly expiresAt: string;
  readonly accessTokenRef?: string;
};

export type SessionRefreshPortFailure = {
  readonly ok: false;
  readonly reason: string;
};

export type SessionRefreshPortResult = SessionRefreshPortSuccess | SessionRefreshPortFailure;

/** Internal refresh port — not a real Auth/network backend. */
export type SessionRefreshPort = {
  refresh(request: SessionRefreshRequest): SessionRefreshPortResult | Promise<SessionRefreshPortResult>;
};

export type SessionRefreshOptions = {
  readonly reason?: string;
  readonly accessTokenRef?: string;
};

export type SessionExpiryProbe = {
  readonly expired: boolean;
  readonly expiresAt: string | null;
  readonly sessionId: string;
};
