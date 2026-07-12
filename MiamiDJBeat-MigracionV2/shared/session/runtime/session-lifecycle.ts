/** MOD-002 Session Manager — lifecycle facade — TICKET-V2-PHASE-3-ARCHITECTURE-FOUNDATION-001 */

import type {
  InitializeSessionOptions,
  SessionAuthOutcome,
  SessionPublicApi,
  SessionRefreshOptions,
  SessionSnapshot,
} from './types';

export type SessionLifecycleApi = {
  readonly createSession: (options: InitializeSessionOptions) => SessionPublicApi;
  readonly hydrateSession: () => SessionAuthOutcome;
  readonly refreshSession: (options?: SessionRefreshOptions) => Promise<SessionSnapshot>;
  readonly expireSession: (reason?: string) => SessionSnapshot;
  readonly destroySession: (reason?: string) => void;
};
