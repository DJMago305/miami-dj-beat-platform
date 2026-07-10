/** MOD-002 Session Manager — local storage adapters — TICKET-V2-PHASE-3-ARCHITECTURE-FOUNDATION-001 */

import {
  PERSISTED_SESSION_RECORD_VERSION,
  type PersistedSessionRecord,
  type PersistencePort,
  type RestoreResult,
} from './persistence-port';

export type SessionStorageBackend = 'memory' | 'localStorage' | 'sessionStorage';

export type SessionStorageAdapter = PersistencePort & {
  readonly backend: SessionStorageBackend;
};

export const SESSION_STORAGE_KEY = 'mdj_v2_session_record';

type MemoryRecordStore = {
  value: PersistedSessionRecord | null;
};

function parseRecord(raw: string | null): PersistedSessionRecord | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as PersistedSessionRecord;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    if (parsed.recordVersion !== PERSISTED_SESSION_RECORD_VERSION) {
      return null;
    }
    return Object.freeze({ ...parsed });
  } catch {
    return null;
  }
}

function resolveWebStorage(kind: 'localStorage' | 'sessionStorage'): Storage | null {
  try {
    const storage = globalThis[kind];
    if (!storage || typeof storage.getItem !== 'function') {
      return null;
    }
    return storage;
  } catch {
    return null;
  }
}

function createWebStorageAdapter(
  backend: SessionStorageBackend,
  storageKind: 'localStorage' | 'sessionStorage',
): SessionStorageAdapter {
  const storage = resolveWebStorage(storageKind);

  return {
    backend,
    restore: (): RestoreResult => {
      if (!storage) {
        return { found: false, record: null };
      }
      const raw = storage.getItem(SESSION_STORAGE_KEY);
      if (!raw) {
        return { found: false, record: null };
      }
      const record = parseRecord(raw);
      if (record === null) {
        // SESSION-STORAGE.md — parse error: clear storage → ANONYMOUS path
        storage.removeItem(SESSION_STORAGE_KEY);
        return { found: false, record: null };
      }
      return { found: true, record };
    },
    persist: (record: PersistedSessionRecord) => {
      if (!storage) {
        return;
      }
      storage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify(
          Object.freeze({
            ...record,
            recordVersion: PERSISTED_SESSION_RECORD_VERSION,
            persistedAt: new Date().toISOString(),
          }),
        ),
      );
    },
    clear: () => {
      if (!storage) {
        return;
      }
      storage.removeItem(SESSION_STORAGE_KEY);
    },
  };
}

/** In-memory adapter — lab default for unit tests and ephemeral sessions. */
export function createMemoryStorageAdapter(seed?: PersistedSessionRecord | null): SessionStorageAdapter {
  const store: MemoryRecordStore = { value: seed ? Object.freeze({ ...seed }) : null };

  return {
    backend: 'memory',
    restore: () => ({
      found: store.value !== null,
      record: store.value,
    }),
    persist: (record) => {
      store.value = Object.freeze({ ...record });
    },
    clear: () => {
      store.value = null;
    },
  };
}

/** Browser localStorage adapter — non-secret fields only (SESSION-STORAGE.md). */
export function createLocalStorageAdapter(): SessionStorageAdapter {
  return createWebStorageAdapter('localStorage', 'localStorage');
}

/** Browser sessionStorage adapter — tab-scoped session restore. */
export function createSessionStorageAdapter(): SessionStorageAdapter {
  return createWebStorageAdapter('sessionStorage', 'sessionStorage');
}
