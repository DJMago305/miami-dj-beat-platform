/** Access permission orchestrator — types — TICKET-V2-PHASE-8-ACCESS-PERMISSION-ORCHESTRATOR-001 */

import type { PortalId } from '@mdj/shared/config';
import type { NormalizedError, normalizeApiClientError, normalizeDomainError, normalizeError } from '@mdj/shared/errors';
import type {
  PermissionSnapshot,
  ProfileResolveInput,
  SnapshotFlags,
} from '../../permissions/runtime/types';
import { resolvePermissionSnapshot } from '../../permissions/runtime';
import type { AccessSnapshotService } from '../access-snapshot';

export type AccessPermissionFailureStage =
  | 'snapshot'
  | 'mapping'
  | 'permissions'
  | 'cancelled'
  | 'stale';

export type AccessPermissionResolutionSuccess = {
  readonly ok: true;
  readonly resolutionEpoch: number;
  readonly stage: 'complete';
  readonly profile: ProfileResolveInput;
  readonly flags: SnapshotFlags;
  readonly permissions: PermissionSnapshot;
};

export type AccessPermissionResolutionFailure = {
  readonly ok: false;
  readonly resolutionEpoch: number;
  readonly stage: AccessPermissionFailureStage;
  readonly normalizedError?: NormalizedError;
  readonly retryable: boolean;
  readonly cancelled?: boolean;
  readonly stale?: boolean;
};

export type AccessPermissionResolutionResult =
  | AccessPermissionResolutionSuccess
  | AccessPermissionResolutionFailure;

export type AccessPermissionResolutionOptions = {
  readonly portal: PortalId;
  readonly userId: string;
  readonly sessionId: string;
  readonly snapshotVersion: number;
  readonly correlationId?: string;
  readonly signal?: AbortSignal;
};

export type ResolvePermissionSnapshotFn = typeof resolvePermissionSnapshot;

export type NormalizeApiClientErrorFn = typeof normalizeApiClientError;

export type NormalizeDomainErrorFn = typeof normalizeDomainError;

export type NormalizeErrorFn = typeof normalizeError;

export type EpochGenerator = {
  readonly next: () => number;
};

export type CreateAccessPermissionOrchestratorInput = {
  readonly accessSnapshotService: AccessSnapshotService;
  readonly resolvePermissions: ResolvePermissionSnapshotFn;
  readonly normalizeApiClientError: NormalizeApiClientErrorFn;
  readonly normalizeDomainError: NormalizeDomainErrorFn;
  readonly normalizeError: NormalizeErrorFn;
  readonly moduleId?: string;
  readonly epochGenerator?: EpochGenerator;
};

export type AccessPermissionOrchestrator = {
  readonly resolve: (
    options: AccessPermissionResolutionOptions,
  ) => Promise<AccessPermissionResolutionResult>;
};
