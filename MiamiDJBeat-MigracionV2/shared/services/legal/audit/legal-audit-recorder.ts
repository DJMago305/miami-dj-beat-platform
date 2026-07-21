/** LC-9 — Legal audit recorder and correlation */

import type { LegalDocumentInstanceClock } from '../domain/legal-document-instance-clock';
import { isLegalAuditAction } from './legal-audit-action';
import type { AppendLegalAuditEventInput, LegalAuditEvent } from './legal-audit-event-types';
import {
  legalAuditError,
  legalAuditSuccess,
  mapDomainReasonCode,
  type LegalAuditResult,
} from './legal-audit-errors';
import {
  bumpAuditEventSequenceFloor,
  formatLegalAuditCorrelationId,
  freezeLegalAuditEvent,
  formatLegalAuditEventId,
  isValidLegalAuditEventId,
  sanitizeAuditState,
} from './legal-audit-immutability';
import type { LegalAuditTrailPort } from './legal-audit-trail-port';

export type LegalAuditRecorderOptions = {
  readonly auditTrail?: LegalAuditTrailPort;
  readonly clock: LegalDocumentInstanceClock;
  readonly failAppendForTests?: boolean;
};

export class LegalAuditRecorder {
  private readonly auditTrail?: LegalAuditTrailPort;
  private readonly failAppendForTests: boolean;
  private correlationSequence = 0;

  constructor(options: LegalAuditRecorderOptions) {
    this.auditTrail = options.auditTrail;
    void options.clock;
    this.failAppendForTests = options.failAppendForTests ?? false;
  }

  isEnabled(): boolean {
    return this.auditTrail !== undefined;
  }

  getTrail(): LegalAuditTrailPort | undefined {
    return this.auditTrail;
  }

  nextCorrelationId(): string {
    this.correlationSequence += 1;
    return formatLegalAuditCorrelationId(this.correlationSequence);
  }

  record(input: AppendLegalAuditEventInput): LegalAuditResult<LegalAuditEvent | null> {
    if (!this.auditTrail) {
      return legalAuditSuccess(null);
    }
    if (this.failAppendForTests) {
      return legalAuditError('audit_append_failed', 'Audit append blocked for test rollback.');
    }
    if (!isLegalAuditAction(input.action)) {
      return legalAuditError('invalid_audit_action', `Unknown audit action: ${input.action}`);
    }
    if (input.outcome !== 'success' && !input.reasonCode?.trim()) {
      return legalAuditError('audit_reason_required', 'Denied/failed audit events require reasonCode.');
    }

    const normalized: AppendLegalAuditEventInput = {
      ...input,
      relatedEntityIds: Object.freeze({ ...(input.relatedEntityIds ?? {}) }),
      ...(input.previousState ? { previousState: sanitizeAuditState(input.previousState) } : {}),
      ...(input.nextState ? { nextState: sanitizeAuditState(input.nextState) } : {}),
      metadata: Object.freeze({ ...(input.metadata ?? {}) }),
    };

    return this.auditTrail.appendEvent(normalized);
  }

  recordDenied(
    input: Omit<AppendLegalAuditEventInput, 'outcome'> & { readonly domainCode: string },
  ): LegalAuditResult<LegalAuditEvent | null> {
    return this.record({
      ...input,
      outcome: 'denied',
      reasonCode: mapDomainReasonCode(input.domainCode),
    });
  }

  recordFailed(
    input: Omit<AppendLegalAuditEventInput, 'outcome'> & { readonly domainCode: string },
  ): LegalAuditResult<LegalAuditEvent | null> {
    return this.record({
      ...input,
      outcome: 'failed',
      reasonCode: mapDomainReasonCode(input.domainCode),
    });
  }

  recordSuccess(input: Omit<AppendLegalAuditEventInput, 'outcome'>): LegalAuditResult<LegalAuditEvent | null> {
    return this.record({ ...input, outcome: 'success' });
  }

  appendAfterMutation<T>(
    mutate: () => T,
    buildEvents: (value: T) => readonly Omit<AppendLegalAuditEventInput, 'outcome'>[],
    rollback: (value: T) => void,
  ): { readonly value: T; readonly auditFailed: boolean } {
    const value = mutate();
    if (!this.auditTrail) {
      return Object.freeze({ value, auditFailed: false });
    }
    for (const eventInput of buildEvents(value)) {
      const appended = this.recordSuccess(eventInput);
      if (!appended.ok) {
        rollback(value);
        return Object.freeze({ value: mutate(), auditFailed: true });
      }
    }
    return Object.freeze({ value, auditFailed: false });
  }
}

export function createLegalAuditRecorder(options: LegalAuditRecorderOptions): LegalAuditRecorder {
  return new LegalAuditRecorder(options);
}

export function buildAuditEventId(sequence: number, explicitId?: string): LegalAuditResult<string> {
  if (explicitId !== undefined) {
    if (!isValidLegalAuditEventId(explicitId)) {
      return legalAuditError('invalid_audit_entity', 'Audit event id must match LAE-###### pattern.');
    }
    return legalAuditSuccess(explicitId.trim());
  }
  return legalAuditSuccess(formatLegalAuditEventId(sequence));
}

export function bumpAuditSequence(current: number, eventId: string): number {
  return bumpAuditEventSequenceFloor(current, eventId);
}

export function finalizeAuditEvent(
  input: AppendLegalAuditEventInput,
  sequence: number,
  occurredAt: string,
  id: string,
): LegalAuditEvent {
  return freezeLegalAuditEvent({
    id,
    sequence,
    occurredAt,
    actor: Object.freeze({ ...input.actor }),
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    relatedEntityIds: Object.freeze({ ...(input.relatedEntityIds ?? {}) }),
    ...(input.previousState ? { previousState: sanitizeAuditState(input.previousState) } : {}),
    ...(input.nextState ? { nextState: sanitizeAuditState(input.nextState) } : {}),
    outcome: input.outcome,
    ...(input.reasonCode ? { reasonCode: input.reasonCode } : {}),
    ...(input.correlationId ? { correlationId: input.correlationId } : {}),
    ...(input.requestId ? { requestId: input.requestId } : {}),
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}
