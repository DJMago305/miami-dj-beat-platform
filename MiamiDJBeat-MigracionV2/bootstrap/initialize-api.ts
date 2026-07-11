/** MOD-005 API Client — boot wiring — TICKET-V2-PHASE-6-MOD-005-API-BOOTSTRAP-WIRING-001 */

import { getConfig, type PortalId } from '@mdj/shared/config';
import { getEventBus } from '@mdj/shared/events';
import { getSessionAuthorizationHeader, getSessionSnapshot } from '@mdj/shared/session';
import {
  createMemoryTransport,
  createSessionReaderFromSnapshot,
  getApiClient,
  getApiClientState,
  initializeApiClient,
  type MemoryTransport,
} from '../shared/api/runtime';

export type BootApiInitializationResult =
  | { readonly ok: true; readonly state: 'API_READY' }
  | { readonly ok: false; readonly code: string; readonly message: string };

let bootMemoryTransport: MemoryTransport | null = null;
let logoutCancellationWired = false;
const logoutCancellationSubscriptionIds: string[] = [];

function createLiveSessionReader() {
  return createSessionReaderFromSnapshot(
    () => getSessionSnapshot(),
    () => getSessionAuthorizationHeader(),
  );
}

function cancelAllInFlightApiRequests(): void {
  if (getApiClientState() !== 'API_READY') {
    return;
  }

  getApiClient().cancelAll();
}

function wireApiClientLogoutCancellation(): void {
  if (logoutCancellationWired) {
    return;
  }

  const bus = getEventBus();

  logoutCancellationSubscriptionIds.push(
    bus.subscribe('USER_LOGOUT', () => {
      cancelAllInFlightApiRequests();
    }),
  );

  logoutCancellationSubscriptionIds.push(
    bus.subscribe('SESSION_DESTROYED', () => {
      cancelAllInFlightApiRequests();
    }),
  );

  logoutCancellationWired = true;
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
    wireApiClientLogoutCancellation();

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
  if (logoutCancellationWired) {
    const bus = getEventBus();
    for (const subscriptionId of logoutCancellationSubscriptionIds) {
      bus.unsubscribe(subscriptionId);
    }
    logoutCancellationSubscriptionIds.length = 0;
    logoutCancellationWired = false;
  }

  bootMemoryTransport = null;
}
