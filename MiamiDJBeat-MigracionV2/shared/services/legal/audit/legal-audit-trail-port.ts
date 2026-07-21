/** LC-9 — Legal audit trail port */

import type {
  AppendLegalAuditEventInput,
  LegalAuditEvent,
  LegalAuditEventId,
  ListLegalAuditEventsFilter,
} from './legal-audit-event-types';
import type { LegalAuditResult } from './legal-audit-errors';

export type LegalAuditTrailPort = {
  appendEvent(input: AppendLegalAuditEventInput): LegalAuditResult<LegalAuditEvent>;
  getEventById(id: LegalAuditEventId): LegalAuditResult<LegalAuditEvent>;
  listEvents(filter?: ListLegalAuditEventsFilter): readonly LegalAuditEvent[];
  listEventsByEntity(entityType: AppendLegalAuditEventInput['entityType'], entityId: string): readonly LegalAuditEvent[];
  listEventsByActor(actorId: string): readonly LegalAuditEvent[];
  listEventsByAction(action: AppendLegalAuditEventInput['action']): readonly LegalAuditEvent[];
  listEventsByCorrelationId(correlationId: string): readonly LegalAuditEvent[];
  listEventsByTimeRange(fromOccurredAt: string, toOccurredAt: string): readonly LegalAuditEvent[];
};

export type NoOpLegalAuditTrail = LegalAuditTrailPort;

export function createNoOpLegalAuditTrail(): NoOpLegalAuditTrail {
  const empty = Object.freeze([] as readonly LegalAuditEvent[]);
  return Object.freeze({
    appendEvent() {
      return Object.freeze({
        ok: true,
        value: Object.freeze({
          id: 'LAE-NOOP',
          sequence: 0,
          occurredAt: '1970-01-01T00:00:00.000Z',
          actor: Object.freeze({
            actorType: 'system',
            actorId: 'SYSTEM',
            role: 'system',
            portal: 'system',
          }),
          action: 'legal_access_denied',
          entityType: 'legal_document_instance',
          entityId: 'LDI-NOOP',
          relatedEntityIds: Object.freeze({}),
          outcome: 'success',
          metadata: Object.freeze({}),
        }),
      });
    },
    getEventById() {
      return Object.freeze({ ok: false, code: 'audit_event_not_found', message: 'No-op audit trail.' });
    },
    listEvents: () => empty,
    listEventsByEntity: () => empty,
    listEventsByActor: () => empty,
    listEventsByAction: () => empty,
    listEventsByCorrelationId: () => empty,
    listEventsByTimeRange: () => empty,
  });
}
