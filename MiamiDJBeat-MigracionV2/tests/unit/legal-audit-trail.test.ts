/** @vitest-environment node */

/** LC-9 — Legal audit trail foundation tests */

import { describe, expect, it } from 'vitest';

import {
  createLegalAuditRecorder,
  createSystemLegalAuditActor,
  freezeLegalAuditEvent,
  isValidLegalAuditEventId,
  type AppendLegalAuditEventInput,
} from '../../shared/services/legal/audit';
import { createFixedLegalDocumentInstanceClock } from '../../shared/services/legal/domain';
import { createInMemoryLegalAuditTrail } from '../../shared/services/legal/in-memory/in-memory-legal-audit-trail';

const FIXED_NOW = '2026-07-20T12:00:00.000Z';
const clock = createFixedLegalDocumentInstanceClock(FIXED_NOW);

const systemActor = createSystemLegalAuditActor();

function successEvent(
  overrides: Partial<AppendLegalAuditEventInput> = {},
): AppendLegalAuditEventInput {
  return {
    actor: systemActor,
    action: 'instance_created',
    entityType: 'legal_document_instance',
    entityId: 'LDI-000001',
    outcome: 'success',
    metadata: Object.freeze({ channel: 'legal_center' }),
    ...overrides,
  };
}

describe('LC-9 legal audit trail — core store', () => {
  it('creates LegalAuditEvent with LAE-###### ids and monotonic sequence', () => {
    const trail = createInMemoryLegalAuditTrail({ clock });
    const first = trail.appendEvent(successEvent({ entityId: 'LDI-000001' }));
    const second = trail.appendEvent(
      successEvent({ action: 'instance_status_changed', entityId: 'LDI-000001' }),
    );

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value.id).toMatch(/^LAE-\d{6,}$/);
      expect(second.value.id).toMatch(/^LAE-\d{6,}$/);
      expect(isValidLegalAuditEventId(first.value.id)).toBe(true);
      expect(second.value.sequence).toBeGreaterThan(first.value.sequence);
      expect(first.value.occurredAt).toBe(FIXED_NOW);
    }
  });

  it('rejects duplicate explicit audit event ids', () => {
    const trail = createInMemoryLegalAuditTrail({ clock });
    const first = trail.appendEvent(successEvent({ id: 'LAE-000099' }));
    const duplicate = trail.appendEvent(successEvent({ id: 'LAE-000099', entityId: 'LDI-000002' }));

    expect(first.ok).toBe(true);
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.code).toBe('duplicate_audit_event_id');
    }
  });

  it('requires reasonCode for denied and failed outcomes', () => {
    const trail = createInMemoryLegalAuditTrail({ clock });
    const denied = trail.appendEvent({
      ...successEvent(),
      outcome: 'denied',
    });
    const failed = trail.appendEvent({
      ...successEvent(),
      outcome: 'failed',
    });

    expect(denied.ok).toBe(false);
    expect(failed.ok).toBe(false);
    if (!denied.ok && !failed.ok) {
      expect(denied.code).toBe('audit_reason_required');
      expect(failed.code).toBe('audit_reason_required');
    }
  });

  it('stores denied and failed events when reasonCode is present', () => {
    const trail = createInMemoryLegalAuditTrail({ clock });
    const denied = trail.appendEvent({
      ...successEvent({ action: 'legal_access_denied' }),
      outcome: 'denied',
      reasonCode: 'actor_not_authorized',
    });
    expect(denied.ok).toBe(true);
    if (denied.ok) {
      expect(denied.value.outcome).toBe('denied');
      expect(denied.value.reasonCode).toBe('actor_not_authorized');
    }
  });

  it('is append-only — get/list return clones and nested mutation does not affect store', () => {
    const trail = createInMemoryLegalAuditTrail({ clock });
    const appended = trail.appendEvent(
      successEvent({
        metadata: Object.freeze({ channel: 'legal_center', priority: 1 }),
        relatedEntityIds: Object.freeze({ recipientId: 'ART-001' }),
      }),
    );
    expect(appended.ok).toBe(true);
    if (!appended.ok) {
      return;
    }

    const fetched = trail.getEventById(appended.value.id);
    expect(fetched.ok).toBe(true);
    if (!fetched.ok) {
      return;
    }

    expect(() => {
      (fetched.value.metadata as Record<string, unknown>).channel = 'mutated';
    }).toThrow();

    expect(() => {
      (fetched.value.relatedEntityIds as Record<string, string>).recipientId = 'ART-999';
    }).toThrow();

    const refetched = trail.getEventById(appended.value.id);
    expect(refetched.ok).toBe(true);
    if (refetched.ok) {
      expect(refetched.value.metadata.channel).toBe('legal_center');
      expect(refetched.value.relatedEntityIds.recipientId).toBe('ART-001');
    }
  });

  it('deep-freezes LegalAuditEvent snapshots', () => {
    const event = freezeLegalAuditEvent({
      id: 'LAE-000001',
      sequence: 1,
      occurredAt: FIXED_NOW,
      actor: systemActor,
      action: 'instance_created',
      entityType: 'legal_document_instance',
      entityId: 'LDI-000001',
      relatedEntityIds: Object.freeze({ recipientId: 'ART-001' }),
      previousState: Object.freeze({ status: 'draft' }),
      nextState: Object.freeze({ status: 'pending' }),
      outcome: 'success',
      metadata: Object.freeze({ channel: 'legal_center' }),
    });

    expect(() => {
      (event.actor as { actorId: string }).actorId = 'changed';
    }).toThrow();
    expect(() => {
      (event.previousState as { status: string }).status = 'cancelled';
    }).toThrow();
  });

  it('filters events by entity, actor, action, correlation, and time range', () => {
    const trail = createInMemoryLegalAuditTrail({ clock });
    const correlationId = 'LAC-000001';
    trail.appendEvent(
      successEvent({
        entityId: 'LDI-000001',
        action: 'instance_created',
        correlationId,
      }),
    );
    trail.appendEvent(
      successEvent({
        entityId: 'W9R-000001',
        entityType: 'w9_request',
        action: 'w9_requested',
        actor: Object.freeze({
          actorType: 'staff',
          actorId: 'STAFF-OWNER-001',
          role: 'owner',
          portal: 'staff',
        }),
      }),
    );

    expect(trail.listEventsByEntity('legal_document_instance', 'LDI-000001')).toHaveLength(1);
    expect(trail.listEventsByActor('STAFF-OWNER-001')).toHaveLength(1);
    expect(trail.listEventsByAction('w9_requested')).toHaveLength(1);
    expect(trail.listEventsByCorrelationId(correlationId)).toHaveLength(1);
    expect(
      trail.listEventsByTimeRange('2026-07-20T11:00:00.000Z', '2026-07-20T13:00:00.000Z'),
    ).toHaveLength(2);
    expect(trail.listEvents({ limit: 1 })).toHaveLength(1);
  });

  it('orders events deterministically by sequence then id', () => {
    const trail = createInMemoryLegalAuditTrail({ clock });
    trail.appendEvent(successEvent({ entityId: 'LDI-000001' }));
    trail.appendEvent(successEvent({ entityId: 'LDI-000002' }));
    trail.appendEvent(successEvent({ entityId: 'LDI-000003' }));

    const listed = trail.listEvents();
    for (let index = 1; index < listed.length; index += 1) {
      expect(listed[index].sequence).toBeGreaterThan(listed[index - 1].sequence);
    }
  });

  it('reports audit_event_not_found for missing ids', () => {
    const trail = createInMemoryLegalAuditTrail({ clock });
    const missing = trail.getEventById('LAE-999999');
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.code).toBe('audit_event_not_found');
    }
  });

  it('supports recorder correlation ids in LAC-###### format', () => {
    const trail = createInMemoryLegalAuditTrail({ clock });
    const recorder = createLegalAuditRecorder({ auditTrail: trail, clock });
    const correlationId = recorder.nextCorrelationId();
    expect(correlationId).toMatch(/^LAC-\d{6,}$/);
  });

  it('forces append failure for rollback tests', () => {
    const trail = createInMemoryLegalAuditTrail({ clock });
    trail.setForceAppendFailure(true);
    const failed = trail.appendEvent(successEvent());
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(failed.code).toBe('audit_append_failed');
    }
    trail.setForceAppendFailure(false);
    expect(trail.listEvents()).toHaveLength(0);
  });
});
