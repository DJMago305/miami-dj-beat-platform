/** MOD-001 Authentication — provider port — TICKET-V2-PHASE-5-MOD-001-AUTH-FOUNDATION-001 */

import type {
  ProviderRefreshResult,
  ProviderRestoreResult,
  ProviderSignInInput,
  ProviderSignInResult,
  SignOutRequest,
} from './types';

export type AuthProviderPort = {
  readonly signIn: (input: ProviderSignInInput) => Promise<ProviderSignInResult>;
  readonly signOut: (request: SignOutRequest) => Promise<void>;
  readonly restore: () => Promise<ProviderRestoreResult>;
  readonly refresh: (refreshTokenRef: string) => Promise<ProviderRefreshResult>;
};
