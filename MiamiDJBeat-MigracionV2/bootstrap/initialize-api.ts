/** MOD-005 API Client — boot wiring — TICKET-V2-PHASE-6-MOD-005-API-BOOTSTRAP-WIRING-001 */

import { getConfig, type PortalId } from '@mdj/shared/config';
import { getEventBus } from '@mdj/shared/events';
import {
  getSessionSnapshot,
  parseUserLoginPayload,
  type SessionSnapshot,
} from '@mdj/shared/session';
import {
  createMemoryTransport,
  createSessionReaderFromSnapshot,
  initializeApiClient,
  type MemoryTransport,
} from '../shared/api/runtime';

export type BootApiInitializationResult =
  | { readonly ok: true; readonly state: 'API_READY' }
  | { readonly ok: false; readonly code: string; readonly message: string };

let bootMemoryTransport: MemoryTransport | null = null;

function resolveAuthorizationHeader(snapshot: SessionSnapshot): string | null {
  if (!snapshot.user) {
    return null;
  }

  const history = getEventBus().getHistory();
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (!entry || entry.name !== 'USER_LOGIN') {
      continue;
    }

    const payload = parseUserLoginPayload(entry);
    if (payload.userId !== snapshot.user.userId) {
      continue;
    }

    const accessTokenRef = payload.accessTokenRef?.trim();
    if (!accessTokenRef) {
      return null;
    }

    return `Bearer ${accessTokenRef}`;
  }

  return null;
}

function createLiveSessionReader() {
  return createSessionReaderFromSnapshot(
    () => getSessionSnapshot(),
    resolveAuthorizationHeader,
  );
}

export function initializeApiForBoot(_portal: PortalId): BootApiInitializationResult {
  const config = getConfig();
  const publicUrl = config.api.publicUrl?.trim();

  if (!publicUrl) {
    return {
      ok: false,
      code: 'ERR-API-CONFIG',
      message: 'API public URL is required before MOD-005 can initialize.',
    };
  }

  try {
    bootMemoryTransport = createMemoryTransport();
    initializeApiClient({
      config,
      transport: bootMemoryTransport,
      sessionReader: createLiveSessionReader(),
      moduleId: 'MOD-005',
    });

    return { ok: true, state: 'API_READY' };
  } catch (error) {
    bootMemoryTransport = null;
    return {
      ok: false,
      code: 'ERR-API-BOOT',
      message: error instanceof Error ? error.message : 'MOD-005 API Client boot failed.',
    };
  }
}

/** Test-only access to the boot-scoped memory transport instance. */
export function getBootMemoryTransportForTests(): MemoryTransport {
  if (!bootMemoryTransport) {
    throw new Error('Boot memory transport is not initialized.');
  }
  return bootMemoryTransport;
}

/** Test-only reset — not for production portals. */
export function resetBootApiWiringForTests(): void {
  bootMemoryTransport = null;
}
