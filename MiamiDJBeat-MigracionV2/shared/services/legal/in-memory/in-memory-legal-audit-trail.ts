/** LC-9 — In-memory legal audit trail */

import type { LegalDocumentInstanceClock } from '../domain/legal-document-instance-clock';
import { createSystemLegalDocumentInstanceClock } from '../domain/legal-document-instance-clock';
import {
  legalAuditError,
  legalAuditSuccess,
  type LegalAuditResult,
} from '../audit/legal-audit-errors';
import type {
  AppendLegalAuditEventInput,
  LegalAuditEvent,
  LegalAuditEventId,
  ListLegalAuditEventsFilter,
} from '../audit/legal-audit-event-types';
import {
  bumpAuditEventSequenceFloor,
  cloneLegalAuditEvent,
  isValidLegalAuditEventId,
  sortAuditEventsDeterministically,
} from '../audit/legal-audit-immutability';
import { buildAuditEventId, finalizeAuditEvent } from '../audit/legal-audit-recorder';
import type { LegalAuditTrailPort } from '../audit/legal-audit-trail-port';

export type InMemoryLegalAuditTrailOptions = {
  readonly clock?: LegalDocumentInstanceClock;
  readonly initialSequence?: number;
  readonly forceAppendFailure?: boolean;
};

export class InMemoryLegalAuditTrail implements LegalAuditTrailPort {
  private readonly clock: LegalDocumentInstanceClock;
  private readonly events = new Map<LegalAuditEventId, LegalAuditEvent>();
  private sequence: number;
  private forceAppendFailure: boolean;

  constructor(options: InMemoryLegalAuditTrailOptions = {}) {
    this.clock = options.clock ?? createSystemLegalDocumentInstanceClock();
    this.sequence = options.initialSequence ?? 0;
    this.forceAppendFailure = options.forceAppendFailure ?? false;
  }

  setForceAppendFailure(value: boolean): void {
    this.forceAppendFailure = value;
  }

  private nextSequence(): number {
    this.sequence += 1;
    return this.sequence;
  }

  private applyFilter(
    rows: readonly LegalAuditEvent[],
    filter: ListLegalAuditEventsFilter = {},
  ): readonly LegalAuditEvent[] {
    let result = [...rows];
    if (filter.entityType) {
      result = result.filter((row) => row.entityType === filter.entityType);
    }
    if (filter.entityId) {
      const normalized = filter.entityId.trim();
      result = result.filter((row) => row.entityId === normalized);
    }
    if (filter.actorId) {
      const normalized = filter.actorId.trim();
      result = result.filter((row) => row.actor.actorId === normalized);
    }
    if (filter.action) {
      result = result.filter((row) => row.action === filter.action);
    }
    if (filter.correlationId) {
      result = result.filter((row) => row.correlationId === filter.correlationId);
    }
    if (filter.fromOccurredAt) {
      result = result.filter((row) => row.occurredAt >= filter.fromOccurredAt!);
    }
    if (filter.toOccurredAt) {
      result = result.filter((row) => row.occurredAt <= filter.toOccurredAt!);
    }
    const sorted = sortAuditEventsDeterministically(result);
    if (filter.limit !== undefined && filter.limit >= 0) {
      return Object.freeze(sorted.slice(0, filter.limit));
    }
    return Object.freeze(sorted.map((row) => cloneLegalAuditEvent(row)));
  }

  appendEvent(input: AppendLegalAuditEventInput): LegalAuditResult<LegalAuditEvent> {
    if (this.forceAppendFailure) {
      return legalAuditError('audit_append_failed', 'Forced audit append failure.');
    }
    if (input.outcome !== 'success' && !input.reasonCode?.trim()) {
      return legalAuditError('audit_reason_required', 'Denied/failed audit events require reasonCode.');
    }

    const occurredAt = this.clock.now();
    const sequence = this.nextSequence();
    const idResult = buildAuditEventId(sequence, input.id);
    if (!idResult.ok) {
      return idResult;
    }
    const id = idResult.value;
    if (this.events.has(id)) {
      return legalAuditError(
        'duplicate_audit_event_id',
        `Duplicate audit event id: ${id}`,
        Object.freeze({ id }),
      );
    }

    const event = finalizeAuditEvent(input, sequence, occurredAt, id);
    this.events.set(id, event);
    this.sequence = bumpAuditEventSequenceFloor(this.sequence, id);
    return legalAuditSuccess(cloneLegalAuditEvent(event));
  }

  getEventById(id: LegalAuditEventId): LegalAuditResult<LegalAuditEvent> {
    const event = this.events.get(id);
    if (!event) {
      return legalAuditError('audit_event_not_found', `Audit event not found: ${id}`, Object.freeze({ id }));
    }
    return legalAuditSuccess(cloneLegalAuditEvent(event));
  }

  listEvents(filter: ListLegalAuditEventsFilter = {}): readonly LegalAuditEvent[] {
    return this.applyFilter([...this.events.values()], filter);
  }

  listEventsByEntity(
    entityType: AppendLegalAuditEventInput['entityType'],
    entityId: string,
  ): readonly LegalAuditEvent[] {
    return this.applyFilter([...this.events.values()], {
      entityType,
      entityId: entityId.trim(),
    });
  }

  listEventsByActor(actorId: string): readonly LegalAuditEvent[] {
    return this.applyFilter([...this.events.values()], { actorId: actorId.trim() });
  }

  listEventsByAction(action: AppendLegalAuditEventInput['action']): readonly LegalAuditEvent[] {
    return this.applyFilter([...this.events.values()], { action });
  }

  listEventsByCorrelationId(correlationId: string): readonly LegalAuditEvent[] {
    return this.applyFilter([...this.events.values()], { correlationId: correlationId.trim() });
  }

  listEventsByTimeRange(fromOccurredAt: string, toOccurredAt: string): readonly LegalAuditEvent[] {
    if (!fromOccurredAt.trim() || !toOccurredAt.trim() || fromOccurredAt > toOccurredAt) {
      return Object.freeze([]);
    }
    return this.applyFilter([...this.events.values()], { fromOccurredAt, toOccurredAt });
  }
}

export function createInMemoryLegalAuditTrail(
  options: InMemoryLegalAuditTrailOptions = {},
): InMemoryLegalAuditTrail {
  return new InMemoryLegalAuditTrail(options);
}

export function createIsolatedInMemoryLegalAuditTrail(
  options: InMemoryLegalAuditTrailOptions = {},
): InMemoryLegalAuditTrail {
  return new InMemoryLegalAuditTrail(options);
}

export function isValidAuditTrailEventId(value: string): boolean {
  return isValidLegalAuditEventId(value);
}
