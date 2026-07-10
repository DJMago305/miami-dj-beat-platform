/** MOD-001 Authentication — types — TICKET-V2-PHASE-5-MOD-001-AUTH-FOUNDATION-001 */

import type { PortalId } from '@mdj/shared/config';
import type { AuthHandle, AuthProvider, IdentitySnapshot } from '@mdj/shared/session';

/** Official 12-state machine — AUTH-LIFECYCLE.md */
export type AuthLifecycleState =
  | 'UNKNOWN'
  | 'CHECKING_EXISTING_AUTH'
  | 'UNAUTHENTICATED'
  | 'AUTHENTICATING'
  | 'AUTHENTICATED_IDENTITY_RECEIVED'
  | 'SESSION_HANDOFF_PENDING'
  | 'SESSION_HANDOFF_SUCCEEDED'
  | 'REFRESHING'
  | 'EXPIRED'
  | 'LOGGING_OUT'
  | 'LOGGED_OUT'
  | 'FAILED';

export type AuthTransitionEvent =
  | 'BOOT_START'
  | 'RESTORE_EMPTY'
  | 'RESTORE_FOUND'
  | 'SIGN_IN_REQUEST'
  | 'SIGN_IN_SUCCESS'
  | 'SIGN_IN_FAIL'
  | 'USER_LOGIN_EMITTED'
  | 'HANDOFF_ACCEPTED'
  | 'HANDOFF_REJECTED'
  | 'REFRESH_REQUEST'
  | 'REFRESH_SUCCESS'
  | 'REFRESH_FAIL'
  | 'TOKEN_EXPIRED'
  | 'SIGN_OUT_REQUEST'
  | 'SIGN_OUT_SUCCESS'
  | 'SIGN_OUT_FAIL'
  | 'RESET_TO_ANONYMOUS';

export type AuthTransitionFrom = AuthLifecycleState | null;

export type SignInCredentials = {
  readonly email: string;
  readonly password?: string;
};

export type SignOutReason = 'user' | 'forced' | 'staff_gate' | 'expired' | 'logout';

export type SignOutRequest = {
  readonly reason: SignOutReason;
  readonly userId?: string;
};

export type ProviderSignInInput = {
  readonly credentials: SignInCredentials;
  readonly portal: PortalId;
};

export type ProviderSignInSuccess = {
  readonly ok: true;
  readonly userId: string;
  readonly identity: IdentitySnapshot;
  readonly accessTokenRef: string;
  readonly refreshTokenRef?: string;
  readonly expiresAt: string;
  readonly issuedAt: string;
  readonly provider: AuthProvider;
};

export type ProviderSignInFailure = {
  readonly ok: false;
  readonly code: AuthErrorCode;
  readonly message: string;
};

export type ProviderSignInResult = ProviderSignInSuccess | ProviderSignInFailure;

export type ProviderRestoreResult =
  | {
      readonly ok: true;
      readonly userId: string;
      readonly identity: IdentitySnapshot;
      readonly accessTokenRef: string;
      readonly refreshTokenRef?: string;
      readonly expiresAt: string;
      readonly issuedAt: string;
      readonly provider: AuthProvider;
    }
  | { readonly ok: false; readonly code: AuthErrorCode; readonly message: string }
  | { readonly ok: true; readonly empty: true };

export type ProviderRefreshResult =
  | {
      readonly ok: true;
      readonly accessTokenRef: string;
      readonly refreshTokenRef?: string;
      readonly expiresAt: string;
      readonly issuedAt: string;
    }
  | { readonly ok: false; readonly code: AuthErrorCode; readonly message: string };

export type AuthIdentityView = {
  readonly userId: string;
  readonly email?: string;
  readonly mdjbId?: string;
  readonly displayName?: string;
  readonly provider: AuthProvider;
};

export type AuthSnapshot = {
  readonly state: AuthLifecycleState;
  readonly userId: string | null;
  readonly identity: AuthIdentityView | null;
  readonly activeHandoffId: string | null;
  readonly portal: PortalId | null;
  readonly updatedAt: string;
};

export type SignInResult =
  | {
      readonly ok: true;
      readonly handoffId: string;
      readonly userId: string;
      readonly state: AuthLifecycleState;
    }
  | { readonly ok: false; readonly code: AuthErrorCode; readonly message: string };

export type SignOutResult =
  | { readonly ok: true; readonly state: AuthLifecycleState }
  | { readonly ok: false; readonly code: AuthErrorCode; readonly message: string };

export type RestoreAuthResult =
  | { readonly ok: true; readonly state: AuthLifecycleState; readonly userId?: string }
  | { readonly ok: false; readonly code: AuthErrorCode; readonly message: string };

export type RefreshAuthResult =
  | { readonly ok: true; readonly handoffId: string; readonly state: AuthLifecycleState }
  | { readonly ok: false; readonly code: AuthErrorCode; readonly message: string };

export type AuthErrorCode =
  | 'ERR-AUTH-001'
  | 'ERR-AUTH-002'
  | 'ERR-AUTH-003'
  | 'ERR-AUTH-004'
  | 'ERR-AUTH-005'
  | 'ERR-AUTH-006'
  | 'ERR-AUTH-007'
  | 'ERR-AUTH-008'
  | 'ERR-AUTH-009'
  | 'ERR-AUTH-010';

export type BuiltAuthHandoff = {
  readonly handle: AuthHandle;
  readonly identity: IdentitySnapshot;
  readonly portalContext: PortalId;
};

export type { AuthHandle, IdentitySnapshot };
