/** MOD-002 Session Manager — persistence port — TICKET-MOD-002-SESSION-HYDRATION-RESTORE-001 */

import type { PortalId } from '@mdj/shared/config';

/** Version gate for persisted records — bump when shape changes. */
export const PERSISTED_SESSION_RECORD_VERSION = 1;

/** Minimal restore payload — no capabilities, no raw tokens (SESSION-STORAGE.md). */
export type PersistedSessionRecord = {
  readonly recordVersion: number;
  readonly sessionId?: string;
  readonly portal?: PortalId;
  readonly userId?: string | null;
  readonly email?: string;
  readonly mdjbId?: string;
  readonly expiresAt?: string | null;
  readonly authRef?: string | null;
  readonly locale?: 'en' | 'es';
  readonly theme?: 'dark' | 'light';
  readonly persistedAt?: string;
};

export type RestoreResult = {
  readonly found: boolean;
  readonly record: PersistedSessionRecord | null;
};

/** Internal persistence contract — not a real Storage backend (Phase 4 lab). */
export type PersistencePort = {
  restore(): RestoreResult | Promise<RestoreResult>;
  persist?(record: PersistedSessionRecord): void | Promise<void>;
  clear?(): void | Promise<void>;
};

/** Default boot port — always empty restore → ANONYMOUS path. */
export function createNoopPersistencePort(): PersistencePort {
  return {
    restore: () => ({ found: false, record: null }),
  };
}

/** Test/lab in-memory port — optional seed for restore scenarios. */
export function createInMemoryPersistencePort(seed?: PersistedSessionRecord | null): PersistencePort {
  let stored: PersistedSessionRecord | null = seed ?? null;

  return {
    restore: () => ({
      found: stored !== null,
      record: stored,
    }),
    persist: (record) => {
      stored = Object.freeze({ ...record });
    },
    clear: () => {
      stored = null;
    },
  };
}
