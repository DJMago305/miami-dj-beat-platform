/** Access permission orchestrator — TICKET-V2-PHASE-8-ACCESS-PERMISSION-ORCHESTRATOR-001 */

import { mapAccessSnapshotToProfileResolveInput } from '../access-snapshot';
import type {
  AccessPermissionOrchestrator,
  AccessPermissionResolutionFailure,
  AccessPermissionResolutionOptions,
  AccessPermissionResolutionResult,
  CreateAccessPermissionOrchestratorInput,
} from './access-permission-orchestrator-types';
import {
  isApiErrorRetryable,
  isDomainMappingRetryable,
  isPermissionResolverRetryable,
} from './retryable-policy';

const DEFAULT_MODULE_ID = 'MOD-ACCESS-PERMISSIONS';

function createDefaultEpochGenerator(): { next: () => number } {
  let epoch = 0;
  return {
    next() {
      epoch += 1;
      return epoch;
    },
  };
}

function combineAbortSignals(
  signals: readonly (AbortSignal | undefined)[],
): AbortSignal | undefined {
  const active = signals.filter((signal): signal is AbortSignal => signal !== undefined);
  if (active.length === 0) {
    return undefined;
  }
  if (active.length === 1) {
    return active[0];
  }
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any(active);
  }

  const controller = new AbortController();
  const abortFrom = (source: AbortSignal) => {
    if (!controller.signal.aborted) {
      controller.abort(source.reason);
    }
  };

  for (const signal of active) {
    if (signal.aborted) {
      abortFrom(signal);
      break;
    }
    signal.addEventListener('abort', () => abortFrom(signal), { once: true });
  }

  return controller.signal;
}

function buildCancelledFailure(epoch: number): AccessPermissionResolutionFailure {
  return Object.freeze({
    ok: false,
    resolutionEpoch: epoch,
    stage: 'cancelled',
    retryable: false,
    cancelled: true,
  });
}

function buildStaleFailure(epoch: number): AccessPermissionResolutionFailure {
  return Object.freeze({
    ok: false,
    resolutionEpoch: epoch,
    stage: 'stale',
    retryable: false,
    stale: true,
  });
}

function isStaleCompletion(requestEpoch: number, currentEpoch: number): boolean {
  return requestEpoch !== currentEpoch;
}

function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

export function createAccessPermissionOrchestrator(
  input: CreateAccessPermissionOrchestratorInput,
): AccessPermissionOrchestrator {
  const {
    accessSnapshotService,
    resolvePermissions,
    normalizeApiClientError,
    normalizeDomainError,
    normalizeError,
    moduleId = DEFAULT_MODULE_ID,
    epochGenerator = createDefaultEpochGenerator(),
  } = input;

  let currentEpoch = 0;
  let activeAbortController: AbortController | null = null;

  async function resolve(
    options: AccessPermissionResolutionOptions,
  ): Promise<AccessPermissionResolutionResult> {
    if (isAborted(options.signal)) {
      const epoch = epochGenerator.next();
      currentEpoch = epoch;
      activeAbortController?.abort();
      activeAbortController = null;
      return buildCancelledFailure(epoch);
    }

    activeAbortController?.abort();
    const internalController = new AbortController();
    activeAbortController = internalController;

    const requestEpoch = epochGenerator.next();
    currentEpoch = requestEpoch;

    const combinedSignal = combineAbortSignals([options.signal, internalController.signal]);
    if (isAborted(combinedSignal)) {
      return buildCancelledFailure(requestEpoch);
    }

    const fetchResult = await accessSnapshotService.fetchSnapshot({
      signal: combinedSignal,
      context: options.correlationId
        ? Object.freeze({ correlationId: options.correlationId })
        : undefined,
    });

    if (isStaleCompletion(requestEpoch, currentEpoch)) {
      return buildStaleFailure(requestEpoch);
    }
    if (isAborted(combinedSignal)) {
      return buildCancelledFailure(requestEpoch);
    }

    if (!fetchResult.ok) {
      const correlationId = fetchResult.metadata.correlationId;
      const normalizedError = normalizeApiClientError(fetchResult, {
        moduleId,
        correlationId,
      });

      if (fetchResult.error.code === 'API_CANCELLED') {
        return Object.freeze({
          ok: false,
          resolutionEpoch: requestEpoch,
          stage: 'cancelled',
          normalizedError,
          retryable: false,
          cancelled: true,
        });
      }

      return Object.freeze({
        ok: false,
        resolutionEpoch: requestEpoch,
        stage: 'snapshot',
        normalizedError,
        retryable: isApiErrorRetryable(fetchResult.error, fetchResult.status),
      });
    }

    const mapped = mapAccessSnapshotToProfileResolveInput(fetchResult.data);

    if (isStaleCompletion(requestEpoch, currentEpoch)) {
      return buildStaleFailure(requestEpoch);
    }
    if (isAborted(combinedSignal)) {
      return buildCancelledFailure(requestEpoch);
    }

    if (!mapped.ok) {
      const correlationId = options.correlationId ?? fetchResult.metadata.correlationId;
      const normalizedError = normalizeDomainError(mapped, {
        moduleId,
        correlationId,
      });

      return Object.freeze({
        ok: false,
        resolutionEpoch: requestEpoch,
        stage: 'mapping',
        normalizedError,
        retryable: isDomainMappingRetryable(mapped.code),
      });
    }

    let permissions;
    try {
      permissions = resolvePermissions({
        profile: mapped.profile,
        portal: options.portal,
        flags: mapped.flags,
        userId: options.userId,
        snapshotVersion: options.snapshotVersion,
      });
    } catch (error) {
      if (isStaleCompletion(requestEpoch, currentEpoch)) {
        return buildStaleFailure(requestEpoch);
      }
      if (isAborted(combinedSignal)) {
        return buildCancelledFailure(requestEpoch);
      }

      const normalizedError = normalizeError(error, {
        moduleId,
        correlationId: options.correlationId ?? fetchResult.metadata.correlationId,
      });

      return Object.freeze({
        ok: false,
        resolutionEpoch: requestEpoch,
        stage: 'permissions',
        normalizedError,
        retryable: isPermissionResolverRetryable(),
      });
    }

    if (isStaleCompletion(requestEpoch, currentEpoch)) {
      return buildStaleFailure(requestEpoch);
    }
    if (isAborted(combinedSignal)) {
      return buildCancelledFailure(requestEpoch);
    }

    if (mapped.profile.kind === 'guest') {
      const normalizedError = normalizeDomainError(
        Object.freeze({
          ok: false as const,
          code: 'ACCESS_SNAPSHOT_UNKNOWN_PROFILE' as const,
          reason: 'Guest profile is not allowed for authenticated resolution.',
        }),
        { moduleId, correlationId: options.correlationId ?? fetchResult.metadata.correlationId },
      );

      return Object.freeze({
        ok: false,
        resolutionEpoch: requestEpoch,
        stage: 'mapping',
        normalizedError,
        retryable: false,
      });
    }

    return Object.freeze({
      ok: true,
      resolutionEpoch: requestEpoch,
      stage: 'complete',
      profile: mapped.profile,
      flags: mapped.flags,
      permissions,
    });
  }

  return Object.freeze({
    resolve,
  });
}
