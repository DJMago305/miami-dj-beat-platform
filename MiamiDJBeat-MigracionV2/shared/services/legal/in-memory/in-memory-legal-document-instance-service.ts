/** LC-6 — In-memory legal document instance service */

import {
  createLegalDocumentInstance,
  type CreateLegalDocumentInstanceDependencies,
} from '../domain/legal-document-instance-factory';
import {
  legalDocumentInstanceError,
  legalDocumentInstanceSuccess,
  type LegalDocumentInstanceResult,
} from '../domain/legal-document-instance-errors';
import {
  createSystemLegalDocumentInstanceClock,
  type LegalDocumentInstanceClock,
} from '../domain/legal-document-instance-clock';
import { transitionLegalDocumentInstanceStatus } from '../domain/legal-document-instance-transition';
import {
  bumpSequenceFloor,
  cloneLegalDocumentInstance,
} from '../domain/legal-document-instance-immutability';
import { isValidLegalDocumentInstanceTimestamp } from '../domain/legal-document-instance-factory';
import type {
  CreateLegalDocumentInstanceInput,
  LegalDocumentInstance,
  LegalDocumentInstanceId,
  LegalDocumentInstanceRecipientType,
} from '../domain/legal-document-instance-types';
import { isTerminalLegalDocumentInstanceStatus } from '../domain/legal-document-instance-status';
import type { LegalDocumentInstanceStatus } from '../domain/legal-document-instance-status';
import {
  createSystemLegalAuditActor,
} from '../audit/legal-audit-permissions';
import type { LegalAuditRecorder } from '../audit/legal-audit-recorder';

export type InMemoryLegalDocumentInstanceServiceOptions = {
  readonly clock?: LegalDocumentInstanceClock;
  readonly initialSequence?: number;
  readonly auditRecorder?: LegalAuditRecorder;
};

export type ListLegalDocumentInstancesFilter = {
  readonly status?: LegalDocumentInstanceStatus;
};

function cloneInstance(instance: LegalDocumentInstance): LegalDocumentInstance {
  return cloneLegalDocumentInstance(instance);
}

export class InMemoryLegalDocumentInstanceService {
  private readonly clock: LegalDocumentInstanceClock;
  private readonly auditRecorder?: LegalAuditRecorder;
  private readonly instances = new Map<LegalDocumentInstanceId, LegalDocumentInstance>();
  private sequence: number;

  constructor(options: InMemoryLegalDocumentInstanceServiceOptions = {}) {
    this.clock = options.clock ?? createSystemLegalDocumentInstanceClock();
    this.auditRecorder = options.auditRecorder;
    this.sequence = options.initialSequence ?? 0;
  }

  getAuditRecorder(): LegalAuditRecorder | undefined {
    return this.auditRecorder;
  }

  private nextSequence(): number {
    this.sequence += 1;
    return this.sequence;
  }

  private factoryDependencies(): CreateLegalDocumentInstanceDependencies {
    return Object.freeze({
      clock: this.clock,
      nextSequence: () => this.nextSequence(),
    });
  }

  private syncSequenceFromInstanceId(id: LegalDocumentInstanceId): void {
    this.sequence = bumpSequenceFloor(this.sequence, id);
  }

  createInstance(
    input: CreateLegalDocumentInstanceInput,
  ): LegalDocumentInstanceResult<LegalDocumentInstance> {
    const result = createLegalDocumentInstance(input, this.factoryDependencies());
    if (!result.ok) {
      return result;
    }

    if (this.instances.has(result.value.id)) {
      return legalDocumentInstanceError(
        'duplicate_instance_id',
        `Duplicate legal document instance id: ${result.value.id}`,
        Object.freeze({ id: result.value.id }),
      );
    }

    this.instances.set(result.value.id, result.value);
    this.syncSequenceFromInstanceId(result.value.id);
    const cloned = cloneInstance(result.value);
    if (
      this.auditRecorder &&
      !this.auditRecorder.recordSuccess({
        actor: createSystemLegalAuditActor(),
        action: 'instance_created',
        entityType: 'legal_document_instance',
        entityId: cloned.id,
        nextState: Object.freeze({ status: cloned.status }),
        relatedEntityIds: Object.freeze({
          templateId: cloned.templateId,
          recipientId: cloned.recipient.recipientId,
        }),
      }).ok
    ) {
      this.instances.delete(result.value.id);
      return legalDocumentInstanceError(
        'invalid_status_transition',
        'Audit append failed during instance creation.',
      );
    }
    return legalDocumentInstanceSuccess(cloned);
  }

  getInstanceById(id: LegalDocumentInstanceId): LegalDocumentInstanceResult<LegalDocumentInstance> {
    const instance = this.instances.get(id);
    if (!instance) {
      return legalDocumentInstanceError('instance_not_found', `Legal document instance not found: ${id}`, {
        id,
      });
    }
    return legalDocumentInstanceSuccess(cloneInstance(instance));
  }

  listInstances(filter: ListLegalDocumentInstancesFilter = {}): readonly LegalDocumentInstance[] {
    const rows = [...this.instances.values()];
    const filtered = filter.status ? rows.filter((row) => row.status === filter.status) : rows;
    return Object.freeze(filtered.map((row) => cloneInstance(row)));
  }

  listInstancesByRecipient(
    recipientType: LegalDocumentInstanceRecipientType,
    recipientId: string,
  ): readonly LegalDocumentInstance[] {
    const normalizedId = recipientId.trim();
    return Object.freeze(
      [...this.instances.values()]
        .filter(
          (row) =>
            row.recipient.recipientType === recipientType &&
            row.recipient.recipientId === normalizedId,
        )
        .map((row) => cloneInstance(row)),
    );
  }

  listInstancesByTemplate(templateId: string): readonly LegalDocumentInstance[] {
    const normalizedTemplateId = templateId.trim();
    return Object.freeze(
      [...this.instances.values()]
        .filter((row) => row.templateId === normalizedTemplateId)
        .map((row) => cloneInstance(row)),
    );
  }

  transitionStatus(
    id: LegalDocumentInstanceId,
    nextStatus: LegalDocumentInstanceStatus,
  ): LegalDocumentInstanceResult<LegalDocumentInstance> {
    const current = this.instances.get(id);
    if (!current) {
      return legalDocumentInstanceError('instance_not_found', `Legal document instance not found: ${id}`, {
        id,
      });
    }

    const transition = transitionLegalDocumentInstanceStatus(current, nextStatus, this.clock.now());
    if (!transition.ok) {
      if (this.auditRecorder) {
        this.auditRecorder.recordFailed({
          actor: createSystemLegalAuditActor(),
          action: 'instance_status_changed',
          entityType: 'legal_document_instance',
          entityId: id,
          previousState: Object.freeze({ status: current.status }),
          nextState: Object.freeze({ status: nextStatus }),
          domainCode: transition.code,
        });
      }
      return transition;
    }

    this.instances.set(id, transition.value);
    this.syncSequenceFromInstanceId(id);
    const cloned = cloneInstance(transition.value);
    const action =
      nextStatus === 'cancelled'
        ? 'instance_cancelled'
        : nextStatus === 'expired'
          ? 'instance_expired'
          : nextStatus === 'viewed'
            ? 'instance_viewed'
            : 'instance_status_changed';
    if (
      this.auditRecorder &&
      !this.auditRecorder.recordSuccess({
        actor: createSystemLegalAuditActor(),
        action,
        entityType: 'legal_document_instance',
        entityId: id,
        previousState: Object.freeze({ status: current.status }),
        nextState: Object.freeze({ status: nextStatus }),
      }).ok
    ) {
      this.instances.set(id, current);
      return legalDocumentInstanceError(
        'invalid_status_transition',
        'Audit append failed during instance transition.',
      );
    }
    return legalDocumentInstanceSuccess(cloned);
  }

  cancelInstance(id: LegalDocumentInstanceId): LegalDocumentInstanceResult<LegalDocumentInstance> {
    return this.transitionStatus(id, 'cancelled');
  }

  expireInstance(id: LegalDocumentInstanceId): LegalDocumentInstanceResult<LegalDocumentInstance> {
    const current = this.instances.get(id);
    if (!current) {
      return legalDocumentInstanceError('instance_not_found', `Legal document instance not found: ${id}`, {
        id,
      });
    }

    if (isTerminalLegalDocumentInstanceStatus(current.status)) {
      return legalDocumentInstanceError(
        'expiration_not_allowed',
        `Cannot expire terminal instance ${id} (${current.status}).`,
        Object.freeze({ status: current.status }),
      );
    }

    const now = this.clock.now();
    if (!isValidLegalDocumentInstanceTimestamp(now)) {
      return legalDocumentInstanceError(
        'invalid_instance_timestamp',
        'Clock must provide a valid ISO 8601 timestamp.',
        Object.freeze({ now }),
      );
    }

    if (current.expiresAt && now < current.expiresAt) {
      return legalDocumentInstanceError(
        'expiration_not_due',
        `Instance ${id} cannot expire before expiresAt (${current.expiresAt}).`,
        Object.freeze({ expiresAt: current.expiresAt, now }),
      );
    }

    const transition = transitionLegalDocumentInstanceStatus(current, 'expired', now);
    if (!transition.ok) {
      if (transition.code === 'already_terminal') {
        return legalDocumentInstanceError(
          'expiration_not_allowed',
          transition.message,
          transition.metadata,
        );
      }
      return transition;
    }

    this.instances.set(id, transition.value);
    this.syncSequenceFromInstanceId(id);
    return legalDocumentInstanceSuccess(cloneInstance(transition.value));
  }
}

export function createInMemoryLegalDocumentInstanceService(
  options: InMemoryLegalDocumentInstanceServiceOptions = {},
): InMemoryLegalDocumentInstanceService {
  return new InMemoryLegalDocumentInstanceService(options);
}
