/** MOD-002 Session — access permission resolution port — TICKET-V2-PHASE-8-SESSION-PROVIDER-PERMISSIONS-WIRING-001 */

import type { AccessPermissionOrchestrator } from '../../services/access-permissions';

/** Minimal port — SessionProvider does not depend on ApiClient or AccessSnapshotService. */
export type AccessPermissionResolutionPort = Pick<AccessPermissionOrchestrator, 'resolve'>;

export type AccessPermissionResolutionTrigger =
  | 'auth-handoff'
  | 'restore'
  | 'refresh'
  | 'permission-changed-external';

export type PermissionsResolutionPhase = 'idle' | 'pending' | 'resolved' | 'failed';
