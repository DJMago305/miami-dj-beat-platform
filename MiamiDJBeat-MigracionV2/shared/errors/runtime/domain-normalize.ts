/** MOD-014 Error Handler — domain bridge — TICKET-V2-PHASE-8-MOD-014-ERROR-BRIDGE-CONTRACT-FIX-001 */

import { lookupCatalogEntry } from './catalog';
import { redactErrorMessage } from './redact';
import type { NormalizeContext, NormalizedError } from './types';

export const DOMAIN_ACCESS_SNAPSHOT_CODES = [
  'ACCESS_SNAPSHOT_REJECTED',
  'ACCESS_SNAPSHOT_UNKNOWN_PROFILE',
  'ACCESS_SNAPSHOT_UNRESOLVED_STAFF',
  'ACCESS_SNAPSHOT_INVALID_PAYLOAD',
] as const;

export type DomainAccessSnapshotCode = (typeof DOMAIN_ACCESS_SNAPSHOT_CODES)[number];

export type DomainFailureShape = {
  readonly ok: false;
  readonly code: DomainAccessSnapshotCode | string;
  readonly reason?: string;
};

/** Static mapping only — other access-snapshot codes resolve conditionally. */
export const DOMAIN_ACCESS_SNAPSHOT_STATIC_GLOBAL_MAP: Readonly<
  Record<'ACCESS_SNAPSHOT_INVALID_PAYLOAD', string>
> = {
  ACCESS_SNAPSHOT_INVALID_PAYLOAD: 'ERR-0501',
};

const DOMAIN_SNAPSHOT_CODES = new Set<string>(DOMAIN_ACCESS_SNAPSHOT_CODES);
const DOMAIN_RESOLVED_GLOBAL_CODES = new Set<string>(['ERR-0300', 'ERR-0501', 'ERR-0999']);

function isDomainAccessSnapshotCode(value: string): value is DomainAccessSnapshotCode {
  return DOMAIN_SNAPSHOT_CODES.has(value);
}

export function isDomainFailureShape(value: unknown): value is DomainFailureShape {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<DomainFailureShape>;
  return candidate.ok === false && typeof candidate.code === 'string';
}

function isNormalizedDomainError(value: unknown): value is NormalizedError {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<NormalizedError>;
  return (
    typeof candidate.code === 'string'
    && DOMAIN_RESOLVED_GLOBAL_CODES.has(candidate.code)
    && typeof candidate.cause === 'string'
    && isDomainAccessSnapshotCode(candidate.cause)
    && typeof candidate.severity === 'string'
    && typeof candidate.recovery === 'string'
    && typeof candidate.userMessageKey === 'string'
    && typeof candidate.logMessage === 'string'
    && typeof candidate.moduleId === 'string'
    && typeof candidate.timestamp === 'string'
  );
}

function idempotentDomainNormalized(error: NormalizedError): NormalizedError {
  if (Object.isFrozen(error)) {
    return error;
  }

  return Object.freeze({ ...error });
}

function buildDomainNormalizedError(
  globalCode: string,
  rawLogMessage: string,
  context: NormalizeContext,
  domainCause: string,
  userMessageKeyOverride?: string,
): NormalizedError {
  const catalog = lookupCatalogEntry(globalCode);
  const category = catalog?.category ?? 'C-03';
  const severity = catalog?.severity ?? 'ERROR';
  const recovery = catalog?.recovery ?? 'recoverable';
  const userMessageKey = userMessageKeyOverride ?? catalog?.userMessageKey ?? 'error.unexpected.generic';

  return Object.freeze({
    code: globalCode,
    category,
    severity,
    recovery,
    userMessageKey,
    logMessage: redactErrorMessage(rawLogMessage),
    moduleId: context.moduleId ?? 'MOD-003',
    timestamp: new Date().toISOString(),
    ...(context.correlationId ? { correlationId: context.correlationId } : {}),
    cause: domainCause,
  });
}

function resolveAccessSnapshotDomainMapping(
  domainCode: DomainAccessSnapshotCode,
  reason: string | undefined,
  context: NormalizeContext,
): NormalizedError {
  const message = reason?.trim() || `Domain access snapshot failure: ${domainCode}`;

  switch (domainCode) {
    case 'ACCESS_SNAPSHOT_REJECTED':
      if (reason?.trim() === 'no_session') {
        return buildDomainNormalizedError('ERR-0300', message, context, domainCode);
      }
      return buildDomainNormalizedError(
        'ERR-0999',
        message,
        context,
        domainCode,
        'error.access_snapshot.rejected',
      );
    case 'ACCESS_SNAPSHOT_UNKNOWN_PROFILE':
      return buildDomainNormalizedError(
        'ERR-0999',
        message,
        context,
        domainCode,
        'error.access_snapshot.unknown_profile',
      );
    case 'ACCESS_SNAPSHOT_UNRESOLVED_STAFF':
      return buildDomainNormalizedError(
        'ERR-0999',
        message,
        context,
        domainCode,
        'error.access_snapshot.unresolved_staff',
      );
    case 'ACCESS_SNAPSHOT_INVALID_PAYLOAD':
      return buildDomainNormalizedError('ERR-0501', message, context, domainCode);
    default:
      return buildDomainNormalizedError(
        'ERR-0999',
        message,
        {
          moduleId: context.moduleId ?? 'MOD-014',
          correlationId: context.correlationId,
        },
        'DOMAIN_UNKNOWN',
      );
  }
}

export function resolveDomainNormalization(
  input: unknown,
  context: NormalizeContext = {},
): NormalizedError {
  if (isNormalizedDomainError(input)) {
    return idempotentDomainNormalized(input);
  }

  if (isDomainFailureShape(input) && isDomainAccessSnapshotCode(input.code)) {
    return resolveAccessSnapshotDomainMapping(input.code, input.reason, context);
  }

  if (input === null || input === undefined) {
    return buildDomainNormalizedError(
      'ERR-0999',
      'Unknown domain error input could not be normalized.',
      {
        moduleId: context.moduleId ?? 'MOD-014',
        correlationId: context.correlationId,
      },
      'DOMAIN_UNKNOWN',
    );
  }

  if (typeof input === 'object') {
    const candidate = input as Record<string, unknown>;
    if (
      candidate.ok === false
      && typeof candidate.code === 'string'
      && isDomainAccessSnapshotCode(candidate.code)
    ) {
      const reason =
        typeof candidate.reason === 'string' ? candidate.reason : undefined;
      return resolveAccessSnapshotDomainMapping(candidate.code, reason, context);
    }
  }

  return buildDomainNormalizedError(
    'ERR-0999',
    'Unknown domain error input could not be normalized.',
    {
      moduleId: context.moduleId ?? 'MOD-014',
      correlationId: context.correlationId,
    },
    'DOMAIN_UNKNOWN',
  );
}
