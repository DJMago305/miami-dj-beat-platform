/** MOD-001 Authentication — public port — TICKET-V2-PHASE-5-MOD-001-AUTH-FOUNDATION-001 */

import type { PortalId } from '@mdj/shared/config';
import type {
  AuthSnapshot,
  RefreshAuthResult,
  RestoreAuthResult,
  SignInCredentials,
  SignInResult,
  SignOutRequest,
  SignOutResult,
} from './types';

export type AuthInitializeOptions = {
  readonly portal?: PortalId;
};

export type AuthPort = {
  readonly initialize: (options?: AuthInitializeOptions) => Promise<RestoreAuthResult>;
  readonly initializeForBoot: (portal: PortalId) => RestoreAuthResult;
  readonly getSnapshot: () => AuthSnapshot;
  readonly getState: () => AuthSnapshot['state'];
  readonly signIn: (credentials: SignInCredentials, portal: PortalId) => Promise<SignInResult>;
  readonly signOut: (request?: SignOutRequest) => Promise<SignOutResult>;
  readonly refresh: () => Promise<RefreshAuthResult>;
  readonly requestLogout: (reason: string, userId?: string) => Promise<SignOutResult>;
};
