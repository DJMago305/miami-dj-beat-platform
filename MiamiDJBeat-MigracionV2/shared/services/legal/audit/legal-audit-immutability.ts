/** LC-9 — Legal audit immutability and IDs */

import type { LegalAuditEvent } from './legal-audit-event-types';

export function freezeLegalAuditEvent(event: LegalAuditEvent): LegalAuditEvent {
  return Object.freeze({
    ...event,
    actor: Object.freeze({ ...event.actor }),
    relatedEntityIds: Object.freeze({ ...event.relatedEntityIds }),
    ...(event.previousState ? { previousState: Object.freeze({ ...event.previousState }) } : {}),
    ...(event.nextState ? { nextState: Object.freeze({ ...event.nextState }) } : {}),
    metadata: Object.freeze({ ...event.metadata }),
  });
}

export function cloneLegalAuditEvent(event: LegalAuditEvent): LegalAuditEvent {
  return freezeLegalAuditEvent({
    ...event,
    actor: { ...event.actor },
    relatedEntityIds: { ...event.relatedEntityIds },
    ...(event.previousState ? { previousState: { ...event.previousState } } : {}),
    ...(event.nextState ? { nextState: { ...event.nextState } } : {}),
    metadata: { ...event.metadata },
  });
}

export function parseLegalAuditEventSequence(id: string): number | null {
  const match = /^LAE-(\d+)$/.exec(id.trim());
  if (!match) {
    return null;
  }
  const numeric = Number.parseInt(match[1], 10);
  if (!Number.isInteger(numeric) || numeric < 1) {
    return null;
  }
  return numeric;
}

export function formatLegalAuditEventId(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError('Legal audit event sequence must be a positive integer.');
  }
  return `LAE-${String(sequence).padStart(6, '0')}`;
}

export function bumpAuditEventSequenceFloor(currentSequence: number, eventId: string): number {
  const parsed = parseLegalAuditEventSequence(eventId);
  if (parsed === null) {
    return currentSequence;
  }
  return Math.max(currentSequence, parsed);
}

export function isValidLegalAuditEventId(value: string): boolean {
  return /^LAE-\d{6,}$/.test(value.trim());
}

export function formatLegalAuditCorrelationId(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError('Legal audit correlation sequence must be a positive integer.');
  }
  return `LAC-${String(sequence).padStart(6, '0')}`;
}

export function isValidLegalAuditCorrelationId(value: string): boolean {
  return /^LAC-\d{6,}$/.test(value.trim());
}

export function sanitizeAuditState(
  value: Readonly<Record<string, string | number | boolean | null | undefined>>,
): Readonly<Record<string, string | number | boolean | null>> {
  const sanitized: Record<string, string | number | boolean | null> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) {
      continue;
    }
    const blockedKeys = ['storageKey', 'checksum', 'contentReference', 'filename', 'ssn', 'ein', 'tin'];
    if (blockedKeys.includes(key)) {
      continue;
    }
    sanitized[key] = entry;
  }
  return Object.freeze(sanitized);
}

export function sortAuditEventsDeterministically(
  events: readonly LegalAuditEvent[],
): readonly LegalAuditEvent[] {
  return Object.freeze(
    [...events].sort((left, right) => {
      if (left.sequence !== right.sequence) {
        return left.sequence - right.sequence;
      }
      return left.occurredAt.localeCompare(right.occurredAt);
    }),
  );
}
