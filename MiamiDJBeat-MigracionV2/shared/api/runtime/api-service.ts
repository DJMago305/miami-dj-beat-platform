/** MOD-005 API Client — singleton service — TICKET-V2-PHASE-6-MOD-005-API-BOOTSTRAP-WIRING-001 */

import type { AppConfig } from '@mdj/shared/config';
import type { Logger } from '@mdj/shared/logging';
import { createApiClient } from './api-client';
import type { SessionReaderPort } from './session-reader-port';
import type { TransportPort } from './transport-port';
import type { ApiClientConfig, ApiClientPublicApi } from './types';

export type ApiClientLifecycleState =
  | 'API_UNINITIALIZED'
  | 'API_BOOTING'
  | 'API_READY'
  | 'API_ERROR';

export type InitializeApiClientDependencies = {
  readonly transport: TransportPort;
  readonly config?: AppConfig | ApiClientConfig;
  readonly sessionReader?: SessionReaderPort;
  readonly logger?: Logger;
  readonly moduleId?: string;
};

let frozenClient: ApiClientPublicApi | null = null;
let lifecycleState: ApiClientLifecycleState = 'API_UNINITIALIZED';

export function initializeApiClient(deps: InitializeApiClientDependencies): ApiClientPublicApi {
  if (lifecycleState === 'API_READY' && frozenClient) {
    return frozenClient;
  }

  if (lifecycleState === 'API_BOOTING') {
    throw new Error('MOD-005 API Client initialization is already in progress.');
  }

  lifecycleState = 'API_BOOTING';

  try {
    frozenClient = createApiClient(deps);
    lifecycleState = 'API_READY';
    return frozenClient;
  } catch (error) {
    frozenClient = null;
    lifecycleState = 'API_ERROR';
    throw error;
  }
}

export function getApiClient(): ApiClientPublicApi {
  if (!frozenClient || lifecycleState !== 'API_READY') {
    throw new Error('MOD-005 API Client is not initialized.');
  }
  return frozenClient;
}

export function getApiClientState(): ApiClientLifecycleState {
  return lifecycleState;
}

/** Test-only reset — not for production portals. */
export function resetApiClientForTests(): void {
  frozenClient?.cancelAll();
  frozenClient = null;
  lifecycleState = 'API_UNINITIALIZED';
}
