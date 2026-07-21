/** LC-7 — In-memory W-9 collection workflow service */

import { resolveLegalTemplateAssetUrl } from '../assets/legal-template-asset-resolver';
import {
  createSystemLegalDocumentInstanceClock,
  type LegalDocumentInstanceClock,
} from '../domain/legal-document-instance-clock';
import { isValidLegalDocumentInstanceTimestamp } from '../domain/legal-document-instance-factory';
import type { LegalDocumentInstanceStatus } from '../domain/legal-document-instance-status';
import { canTransitionLegalDocumentStatus } from '../domain/legal-document-instance-transition';
import {
  createInMemoryLegalDocumentInstanceService,
  type InMemoryLegalDocumentInstanceService,
} from '../in-memory/in-memory-legal-document-instance-service';
import {
  createInMemoryLegalDocumentStorage,
} from '../in-memory/in-memory-legal-document-storage';
import {
  canActorDeleteSubmissions,
  canActorListSubmissions,
  canActorReviewSubmissions,
  canActorSubmitW9Document,
  canActorViewSubmission,
} from '../submissions/legal-document-submission-permissions';
import { toSubmissionPublicView } from '../submissions/legal-document-submission-transition';
import type {
  LegalDocumentSubmission,
  LegalDocumentSubmissionPublicView,
  LegalDocumentSubmissionSubmittedBy,
} from '../submissions/legal-document-submission-types';
import type { LegalDocumentStoragePort } from '../submissions/legal-document-storage-port';
import type { AppendLegalAuditEventInput } from '../audit/legal-audit-event-types';
import type { LegalAuditRecorder } from '../audit/legal-audit-recorder';
import {
  mapWorkflowActorToAuditActor,
} from '../audit/legal-audit-permissions';
import { mapW9WorkflowStatusToInstanceStatus } from '../workflows/legal-w9-instance-mapping';
import {
  applyLegalW9RequestStatusTransition,
  applyLegalW9ViewedTransition,
} from '../workflows/legal-w9-request-transition';
import {
  legalW9WorkflowError,
  legalW9WorkflowSuccess,
  type LegalW9WorkflowResult,
} from '../workflows/legal-w9-request-errors';
import {
  bumpW9RequestSequenceFloor,
  cloneLegalW9Request,
  formatLegalW9RequestId,
  freezeLegalW9Request,
  isValidLegalW9RequestId,
} from '../workflows/legal-w9-request-immutability';
import {
  isActiveLegalW9RequestStatus,
  isTerminalLegalW9RequestStatus,
  type LegalW9RequestStatus,
} from '../workflows/legal-w9-request-status';
import type {
  LegalW9AllowedRecipientType,
  LegalW9Request,
  LegalW9RequestId,
  ListW9RequestsFilter,
  RequestW9Input,
} from '../workflows/legal-w9-request-types';
import {
  LEGAL_W9_ALLOWED_RECIPIENT_TYPES,
  LEGAL_W9_DEMO_ARTIST_RECIPIENT_ID,
  LEGAL_W9_TEMPLATE_ID,
  LEGAL_W9_TEMPLATE_VERSION_ID,
} from '../workflows/legal-w9-request-types';
import {
  canActorAccessW9Request,
  canActorCreateW9Request,
  canActorListW9Requests,
  type LegalWorkflowActor,
} from '../workflows/legal-w9-workflow-actor';

export type SubmitW9DocumentInput = {
  readonly actor: LegalWorkflowActor;
  readonly workflowId: LegalW9RequestId;
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksum: string;
  readonly contentReference: string;
  readonly submittedByDisplayName: string;
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
};

export type InMemoryLegalW9WorkflowServiceOptions = {
  readonly clock?: LegalDocumentInstanceClock;
  readonly instanceService?: InMemoryLegalDocumentInstanceService;
  readonly storage?: LegalDocumentStoragePort;
  readonly auditRecorder?: LegalAuditRecorder;
  readonly seedDemo?: boolean;
};

function assertStaffRole(
  actor: LegalWorkflowActor,
): LegalW9WorkflowResult<'owner' | 'manager'> | ReturnType<typeof legalW9WorkflowError> {
  if (!canActorCreateW9Request(actor)) {
    return legalW9WorkflowError('w9_actor_not_authorized', 'Actor is not authorized to manage W-9 requests.');
  }
  if (actor.role !== 'owner' && actor.role !== 'manager') {
    return legalW9WorkflowError('w9_actor_not_authorized', 'Staff role must be owner or manager.');
  }
  return legalW9WorkflowSuccess(actor.role);
}

function validateRecipient(
  recipient: RequestW9Input['recipient'],
): LegalW9WorkflowResult<LegalW9AllowedRecipientType> | ReturnType<typeof legalW9WorkflowError> {
  if (recipient.recipientType === 'client') {
    return legalW9WorkflowError(
      'w9_recipient_not_allowed',
      'Client recipients are not allowed for W-9 collection.',
      Object.freeze({ recipientType: recipient.recipientType }),
    );
  }

  if (
    !LEGAL_W9_ALLOWED_RECIPIENT_TYPES.includes(recipient.recipientType as LegalW9AllowedRecipientType) ||
    recipient.recipientId.trim().length === 0 ||
    recipient.displayName.trim().length === 0
  ) {
    return legalW9WorkflowError('w9_invalid_recipient', 'Recipient type, id, and displayName are required.');
  }

  return legalW9WorkflowSuccess(recipient.recipientType as LegalW9AllowedRecipientType);
}

function validateDueAt(dueAt: string | undefined): LegalW9WorkflowResult<true> | ReturnType<typeof legalW9WorkflowError> {
  if (dueAt === undefined) {
    return legalW9WorkflowSuccess(true);
  }
  if (!isValidLegalDocumentInstanceTimestamp(dueAt)) {
    return legalW9WorkflowError(
      'w9_invalid_due_at',
      'dueAt must be a valid ISO 8601 timestamp.',
      Object.freeze({ dueAt }),
    );
  }
  return legalW9WorkflowSuccess(true);
}

function verifyW9TemplateForRecipient(
  recipientType: LegalW9AllowedRecipientType,
): LegalW9WorkflowResult<true> | ReturnType<typeof legalW9WorkflowError> {
  const portal =
    recipientType === 'artist' ? 'artist' : recipientType === 'external' ? 'artist' : 'staff';
  const resolved = resolveLegalTemplateAssetUrl({
    portal,
    templateCode: LEGAL_W9_TEMPLATE_ID,
    templateVersionId: LEGAL_W9_TEMPLATE_VERSION_ID,
  });

  if (!resolved.ok) {
    return legalW9WorkflowError(
      'w9_template_unavailable',
      'Corporate W-9 template asset is unavailable.',
      Object.freeze({ reason: resolved.reason }),
    );
  }

  return legalW9WorkflowSuccess(true);
}

export class InMemoryLegalW9WorkflowService {
  private readonly clock: LegalDocumentInstanceClock;
  private readonly instanceService: InMemoryLegalDocumentInstanceService;
  private readonly storage: LegalDocumentStoragePort;
  private readonly auditRecorder?: LegalAuditRecorder;
  private readonly requests = new Map<LegalW9RequestId, LegalW9Request>();
  private sequence = 0;

  constructor(options: InMemoryLegalW9WorkflowServiceOptions = {}) {
    this.clock = options.clock ?? createSystemLegalDocumentInstanceClock();
    this.auditRecorder = options.auditRecorder;
    this.instanceService =
      options.instanceService ??
      createInMemoryLegalDocumentInstanceService({
        clock: this.clock,
        auditRecorder: this.auditRecorder,
      });
    this.storage =
      options.storage ??
      createInMemoryLegalDocumentStorage({
        clock: this.clock,
      });

    if (options.seedDemo) {
      this.seedDemoRequest();
    }
  }

  getAuditRecorder(): LegalAuditRecorder | undefined {
    return this.auditRecorder;
  }

  getAuditTrail() {
    return this.auditRecorder?.getTrail();
  }

  private auditDenied(
    actor: LegalWorkflowActor,
    action: AppendLegalAuditEventInput['action'],
    entityType: AppendLegalAuditEventInput['entityType'],
    entityId: string,
    domainCode: string,
    metadata?: AppendLegalAuditEventInput['metadata'],
  ): void {
    this.auditRecorder?.recordDenied({
      actor: mapWorkflowActorToAuditActor(actor),
      action,
      entityType,
      entityId,
      domainCode,
      metadata,
    });
  }

  private auditSuccessEventsOrRollback<T>(
    value: T,
    rollback: () => void,
    events: readonly Omit<AppendLegalAuditEventInput, 'outcome'>[],
  ): LegalW9WorkflowResult<T> {
    if (!this.auditRecorder) {
      return legalW9WorkflowSuccess(value);
    }
    for (const event of events) {
      const appended = this.auditRecorder.recordSuccess(event);
      if (!appended.ok) {
        rollback();
        return legalW9WorkflowError(
          'w9_instance_transition_failed',
          appended.message,
          Object.freeze({ code: appended.code }),
        );
      }
    }
    return legalW9WorkflowSuccess(value);
  }

  getStoragePort(): LegalDocumentStoragePort {
    return this.storage;
  }

  private seedDemoRequest(): void {
    const actor: LegalWorkflowActor = Object.freeze({
      portal: 'staff',
      role: 'owner',
      actorId: 'STAFF-OWNER-001',
    });
    const created = this.requestW9({
      actor,
      recipient: Object.freeze({
        recipientType: 'artist',
        recipientId: LEGAL_W9_DEMO_ARTIST_RECIPIENT_ID,
        displayName: 'Demo Artist',
        email: 'demo-artist@example.test',
      }),
      requestedByDisplayName: 'Staff Owner Demo',
      metadata: Object.freeze({ seed: 'lc7-demo' }),
    });
    if (created.ok) {
      void this.makeW9Available(actor, created.value.id);
    }
  }

  private now(): string {
    return this.clock.now();
  }

  private syncSequenceFromRequestId(id: LegalW9RequestId): void {
    this.sequence = bumpW9RequestSequenceFloor(this.sequence, id);
  }

  private nextSequence(): number {
    this.sequence += 1;
    return this.sequence;
  }

  private persistRequest(request: LegalW9Request): LegalW9Request {
    const frozen = freezeLegalW9Request(request);
    this.requests.set(frozen.id, frozen);
    this.syncSequenceFromRequestId(frozen.id);
    return cloneLegalW9Request(frozen);
  }

  private syncInstanceToWorkflowStatus(
    documentInstanceId: string,
    workflowStatus: LegalW9RequestStatus,
  ): LegalW9WorkflowResult<true> {
    const targetStatus = mapW9WorkflowStatusToInstanceStatus(workflowStatus);
    if (!targetStatus) {
      return legalW9WorkflowSuccess(true);
    }

    const current = this.instanceService.getInstanceById(documentInstanceId);
    if (!current.ok) {
      return legalW9WorkflowError(
        'w9_instance_transition_failed',
        current.message,
        Object.freeze({ code: current.code }),
      );
    }

    return this.advanceInstanceStatus(documentInstanceId, current.value.status, targetStatus);
  }

  private advanceInstanceStatus(
    documentInstanceId: string,
    currentStatus: LegalDocumentInstanceStatus,
    targetStatus: LegalDocumentInstanceStatus,
  ): LegalW9WorkflowResult<true> {
    if (currentStatus === targetStatus) {
      return legalW9WorkflowSuccess(true);
    }

    if (targetStatus === 'expired') {
      const expired = this.instanceService.expireInstance(documentInstanceId);
      if (!expired.ok) {
        return legalW9WorkflowError('w9_instance_transition_failed', expired.message, {
          code: expired.code,
        });
      }
      return legalW9WorkflowSuccess(true);
    }

    if (targetStatus === 'cancelled') {
      const cancelled = this.instanceService.cancelInstance(documentInstanceId);
      if (!cancelled.ok) {
        return legalW9WorkflowError('w9_instance_transition_failed', cancelled.message, {
          code: cancelled.code,
        });
      }
      return legalW9WorkflowSuccess(true);
    }

    const path: LegalDocumentInstanceStatus[] = [];
    let cursor = currentStatus;
    if (targetStatus === 'signed' || targetStatus === 'rejected') {
      const moved = this.instanceService.transitionStatus(documentInstanceId, targetStatus);
      if (!moved.ok) {
        return legalW9WorkflowError('w9_instance_transition_failed', moved.message, {
          code: moved.code,
        });
      }
      return legalW9WorkflowSuccess(true);
    }

    const transitions: Array<[LegalDocumentInstanceStatus, LegalDocumentInstanceStatus]> = [
      ['draft', 'pending'],
      ['pending', 'sent'],
      ['sent', 'viewed'],
    ];

    while (cursor !== targetStatus) {
      const step = transitions.find(([from]) => from === cursor);
      if (!step) {
        return legalW9WorkflowError(
          'w9_instance_transition_failed',
          `Unable to align instance ${documentInstanceId} from ${cursor} to ${targetStatus}.`,
          Object.freeze({ currentStatus: cursor, targetStatus }),
        );
      }
      path.push(step[1]);
      cursor = step[1];
    }

    for (const nextStatus of path) {
      const moved = this.instanceService.transitionStatus(documentInstanceId, nextStatus);
      if (!moved.ok) {
        return legalW9WorkflowError('w9_instance_transition_failed', moved.message, {
          code: moved.code,
        });
      }
    }

    return legalW9WorkflowSuccess(true);
  }

  private validateInstanceSyncForWorkflowStatus(
    documentInstanceId: string,
    workflowStatus: LegalW9RequestStatus,
  ): LegalW9WorkflowResult<true> {
    const targetStatus = mapW9WorkflowStatusToInstanceStatus(workflowStatus);
    if (!targetStatus) {
      return legalW9WorkflowSuccess(true);
    }

    const current = this.instanceService.getInstanceById(documentInstanceId);
    if (!current.ok) {
      return legalW9WorkflowError(
        'w9_instance_transition_failed',
        current.message,
        Object.freeze({ code: current.code }),
      );
    }

    return this.validateInstanceCanReachStatus(current.value.status, targetStatus);
  }

  private validateInstanceCanReachStatus(
    currentStatus: LegalDocumentInstanceStatus,
    targetStatus: LegalDocumentInstanceStatus,
  ): LegalW9WorkflowResult<true> {
    if (currentStatus === targetStatus) {
      return legalW9WorkflowSuccess(true);
    }

    if (targetStatus === 'signed' || targetStatus === 'rejected') {
      if (!canTransitionLegalDocumentStatus(currentStatus, targetStatus)) {
        return legalW9WorkflowError(
          'w9_instance_transition_failed',
          `Unable to align instance from ${currentStatus} to ${targetStatus}.`,
          Object.freeze({ currentStatus, targetStatus }),
        );
      }
      return legalW9WorkflowSuccess(true);
    }

    const transitions: Array<[LegalDocumentInstanceStatus, LegalDocumentInstanceStatus]> = [
      ['draft', 'pending'],
      ['pending', 'sent'],
      ['sent', 'viewed'],
    ];
    let cursor = currentStatus;
    while (cursor !== targetStatus) {
      const step = transitions.find(([from]) => from === cursor);
      if (!step) {
        return legalW9WorkflowError(
          'w9_instance_transition_failed',
          `Unable to align instance from ${cursor} to ${targetStatus}.`,
          Object.freeze({ currentStatus: cursor, targetStatus }),
        );
      }
      if (!canTransitionLegalDocumentStatus(cursor, step[1])) {
        return legalW9WorkflowError(
          'w9_instance_transition_failed',
          `Unable to align instance from ${cursor} to ${targetStatus}.`,
          Object.freeze({ currentStatus: cursor, targetStatus }),
        );
      }
      cursor = step[1];
    }

    return legalW9WorkflowSuccess(true);
  }

  private applyPersistedWorkflowTransition(
    request: LegalW9Request,
  ): LegalW9WorkflowResult<LegalW9Request> {
    const synced = this.syncInstanceToWorkflowStatus(request.documentInstanceId, request.status);
    if (!synced.ok) {
      return synced;
    }
    return legalW9WorkflowSuccess(this.persistRequest(request));
  }

  private findActiveRequestForRecipient(
    recipientType: string,
    recipientId: string,
  ): LegalW9Request | undefined {
    return [...this.requests.values()].find(
      (request) =>
        request.recipient.recipientType === recipientType &&
        request.recipient.recipientId === recipientId.trim() &&
        isActiveLegalW9RequestStatus(request.status),
    );
  }

  private authorizeRead(
    actor: LegalWorkflowActor,
    request: LegalW9Request,
  ): LegalW9WorkflowResult<true> | ReturnType<typeof legalW9WorkflowError> {
    if (
      !canActorAccessW9Request(actor, request.recipient.recipientType, request.recipient.recipientId)
    ) {
      return legalW9WorkflowError('w9_actor_not_authorized', 'Actor is not authorized to access this W-9 request.');
    }
    return legalW9WorkflowSuccess(true);
  }

  private mapStatusToW9AuditAction(
    status: LegalW9RequestStatus,
  ): AppendLegalAuditEventInput['action'] | null {
    switch (status) {
      case 'available':
        return 'w9_made_available';
      case 'viewed':
        return 'w9_viewed';
      case 'awaiting_upload':
        return 'w9_awaiting_upload';
      case 'submitted':
        return 'w9_submitted';
      case 'accepted':
        return 'w9_accepted';
      case 'rejected':
        return 'w9_rejected';
      case 'cancelled':
        return 'w9_cancelled';
      case 'expired':
        return 'w9_expired';
      default:
        return null;
    }
  }

  private persistWorkflowWithAudit(
    actor: LegalWorkflowActor,
    previous: LegalW9Request,
    next: LegalW9Request,
    actionOverride?: AppendLegalAuditEventInput['action'],
    correlationId?: string,
  ): LegalW9WorkflowResult<LegalW9Request> {
    const persisted = this.persistRequest(next);
    const action = actionOverride ?? this.mapStatusToW9AuditAction(next.status);
    if (!action || !this.auditRecorder) {
      return legalW9WorkflowSuccess(persisted);
    }
    const auditResult = this.auditRecorder.recordSuccess({
      actor: mapWorkflowActorToAuditActor(actor),
      action,
      entityType: 'w9_request',
      entityId: persisted.id,
      previousState: Object.freeze({ status: previous.status }),
      nextState: Object.freeze({ status: persisted.status }),
      relatedEntityIds: Object.freeze({
        documentInstanceId: persisted.documentInstanceId,
        recipientId: persisted.recipient.recipientId,
      }),
      correlationId,
      metadata: Object.freeze({ recipientId: persisted.recipient.recipientId }),
    });
    if (!auditResult.ok) {
      this.requests.set(previous.id, freezeLegalW9Request(previous));
      return legalW9WorkflowError(
        'w9_instance_transition_failed',
        auditResult.message,
        Object.freeze({ code: auditResult.code }),
      );
    }
    return legalW9WorkflowSuccess(persisted);
  }

  requestW9(input: RequestW9Input): LegalW9WorkflowResult<LegalW9Request> {
    const roleResult = assertStaffRole(input.actor);
    if (!roleResult.ok) {
      this.auditDenied(
        input.actor,
        'w9_requested',
        'w9_request',
        input.id ?? 'W9R-PENDING',
        roleResult.code,
      );
      return roleResult;
    }

    const recipientResult = validateRecipient(input.recipient);
    if (!recipientResult.ok) {
      return recipientResult;
    }

    const dueAtResult = validateDueAt(input.dueAt);
    if (!dueAtResult.ok) {
      return dueAtResult;
    }

    const templateResult = verifyW9TemplateForRecipient(recipientResult.value);
    if (!templateResult.ok) {
      return templateResult;
    }

    const active = this.findActiveRequestForRecipient(
      input.recipient.recipientType,
      input.recipient.recipientId,
    );
    if (active) {
      this.auditDenied(
        input.actor,
        'w9_requested',
        'w9_request',
        active.id,
        'w9_active_request_exists',
      );
      return legalW9WorkflowError(
        'w9_active_request_exists',
        'An active W-9 request already exists for this recipient.',
        Object.freeze({ existingRequestId: active.id }),
      );
    }

    const now = this.now();
    if (!isValidLegalDocumentInstanceTimestamp(now)) {
      return legalW9WorkflowError('w9_invalid_due_at', 'Clock must provide a valid ISO 8601 timestamp.');
    }

    const instanceCreated = this.instanceService.createInstance({
      templateId: LEGAL_W9_TEMPLATE_ID,
      templateVersionId: LEGAL_W9_TEMPLATE_VERSION_ID,
      category: 'SPC',
      title: 'W-9 Request for Taxpayer Identification',
      recipient: Object.freeze({
        recipientType: input.recipient.recipientType,
        recipientId: input.recipient.recipientId.trim(),
        displayName: input.recipient.displayName.trim(),
        ...(input.recipient.email ? { email: input.recipient.email.trim() } : {}),
      }),
      owner: Object.freeze({
        ownerType: 'platform',
        ownerId: 'MDJB-PLATFORM',
        issuedBy: input.actor.actorId,
        assignedBy: input.actor.actorId,
      }),
      signatureRequirement: Object.freeze({ requirement: 'single_signer', requiredSignerCount: 1 }),
      metadata: Object.freeze({
        workflow: 'w9_collection',
        ...(input.metadata ?? {}),
      }),
      expiresAt: input.dueAt,
      initialStatus: 'draft',
    });

    if (!instanceCreated.ok) {
      return legalW9WorkflowError(
        'w9_instance_creation_failed',
        instanceCreated.message,
        Object.freeze({ code: instanceCreated.code }),
      );
    }

    const pending = this.instanceService.transitionStatus(instanceCreated.value.id, 'pending');
    if (!pending.ok) {
      return legalW9WorkflowError(
        'w9_instance_creation_failed',
        pending.message,
        Object.freeze({ code: pending.code }),
      );
    }

    let requestId: LegalW9RequestId;
    if (input.id !== undefined) {
      if (!isValidLegalW9RequestId(input.id)) {
        return legalW9WorkflowError('w9_invalid_recipient', 'Request id must match W9R-###### pattern.');
      }
      requestId = input.id.trim();
    } else {
      requestId = formatLegalW9RequestId(this.nextSequence());
    }

    if (this.requests.has(requestId)) {
      return legalW9WorkflowError(
        'w9_duplicate_request_id',
        `Duplicate W-9 request id: ${requestId}`,
        Object.freeze({ id: requestId }),
      );
    }

    const request = freezeLegalW9Request({
      id: requestId,
      documentInstanceId: instanceCreated.value.id,
      templateId: LEGAL_W9_TEMPLATE_ID,
      templateVersionId: LEGAL_W9_TEMPLATE_VERSION_ID,
      recipient: Object.freeze({
        recipientType: input.recipient.recipientType,
        recipientId: input.recipient.recipientId.trim(),
        displayName: input.recipient.displayName.trim(),
        ...(input.recipient.email ? { email: input.recipient.email.trim() } : {}),
      }),
      requestedBy: Object.freeze({
        actorId: input.actor.actorId,
        displayName: input.requestedByDisplayName.trim(),
        role: roleResult.value,
      }),
      status: 'requested',
      reviewStatus: 'not_started',
      requestedAt: now,
      updatedAt: now,
      ...(input.dueAt ? { dueAt: input.dueAt } : {}),
      metadata: Object.freeze({ ...(input.metadata ?? {}) }),
    });

    return this.persistWorkflowWithAudit(
      input.actor,
      request,
      request,
      'w9_requested',
    );
  }

  getW9RequestById(
    actor: LegalWorkflowActor,
    id: LegalW9RequestId,
  ): LegalW9WorkflowResult<LegalW9Request> {
    const request = this.requests.get(id);
    if (!request) {
      return legalW9WorkflowError('w9_request_not_found', `W-9 request not found: ${id}`, Object.freeze({ id }));
    }
    const auth = this.authorizeRead(actor, request);
    if (!auth.ok) {
      return auth;
    }
    return legalW9WorkflowSuccess(cloneLegalW9Request(request));
  }

  listW9Requests(
    actor: LegalWorkflowActor,
    filter: ListW9RequestsFilter = {},
  ): LegalW9WorkflowResult<readonly LegalW9Request[]> {
    if (!canActorListW9Requests(actor)) {
      this.auditDenied(actor, 'legal_access_denied', 'w9_request', 'W9R-LIST', 'w9_actor_not_authorized');
      return legalW9WorkflowError('w9_actor_not_authorized', 'Actor is not authorized to list W-9 requests.');
    }

    const rows = [...this.requests.values()].filter((request) => {
      if (filter.status && request.status !== filter.status) {
        return false;
      }
      return canActorAccessW9Request(actor, request.recipient.recipientType, request.recipient.recipientId);
    });

    return legalW9WorkflowSuccess(Object.freeze(rows.map((row) => cloneLegalW9Request(row))));
  }

  listW9RequestsByRecipient(
    actor: LegalWorkflowActor,
    recipientType: string,
    recipientId: string,
  ): LegalW9WorkflowResult<readonly LegalW9Request[]> {
    const listed = this.listW9Requests(actor);
    if (!listed.ok) {
      return listed;
    }

    const normalizedId = recipientId.trim();
    return legalW9WorkflowSuccess(
      Object.freeze(
        listed.value.filter(
          (request) =>
            request.recipient.recipientType === recipientType &&
            request.recipient.recipientId === normalizedId,
        ),
      ),
    );
  }

  listW9RequestsByStatus(
    actor: LegalWorkflowActor,
    status: LegalW9RequestStatus,
  ): LegalW9WorkflowResult<readonly LegalW9Request[]> {
    return this.listW9Requests(actor, { status });
  }

  private transitionWorkflow(
    actor: LegalWorkflowActor,
    id: LegalW9RequestId,
    nextStatus: LegalW9RequestStatus,
    transitionFn: (
      request: LegalW9Request,
      updatedAt: string,
    ) => LegalW9WorkflowResult<LegalW9Request> = (request, updatedAt) =>
      applyLegalW9RequestStatusTransition(request, nextStatus, updatedAt),
  ): LegalW9WorkflowResult<LegalW9Request> {
    const current = this.requests.get(id);
    if (!current) {
      return legalW9WorkflowError('w9_request_not_found', `W-9 request not found: ${id}`, Object.freeze({ id }));
    }

    const auth = this.authorizeRead(actor, current);
    if (!auth.ok) {
      return auth;
    }

    const updated = transitionFn(current, this.now());
    if (!updated.ok) {
      return updated;
    }

    const synced = this.syncInstanceToWorkflowStatus(updated.value.documentInstanceId, updated.value.status);
    if (!synced.ok) {
      return synced;
    }

    return this.persistWorkflowWithAudit(actor, current, updated.value);
  }

  makeW9Available(actor: LegalWorkflowActor, id: LegalW9RequestId): LegalW9WorkflowResult<LegalW9Request> {
    if (!canActorCreateW9Request(actor)) {
      return legalW9WorkflowError('w9_actor_not_authorized', 'Only staff owner/manager can publish W-9 requests.');
    }
    return this.transitionWorkflow(actor, id, 'available');
  }

  markW9Viewed(actor: LegalWorkflowActor, id: LegalW9RequestId): LegalW9WorkflowResult<LegalW9Request> {
    const current = this.requests.get(id);
    if (!current) {
      return legalW9WorkflowError('w9_request_not_found', `W-9 request not found: ${id}`, Object.freeze({ id }));
    }
    const auth = this.authorizeRead(actor, current);
    if (!auth.ok) {
      return auth;
    }
    return this.transitionWorkflow(actor, id, 'viewed', applyLegalW9ViewedTransition);
  }

  markAwaitingUpload(actor: LegalWorkflowActor, id: LegalW9RequestId): LegalW9WorkflowResult<LegalW9Request> {
    const current = this.requests.get(id);
    if (!current) {
      return legalW9WorkflowError('w9_request_not_found', `W-9 request not found: ${id}`, Object.freeze({ id }));
    }
    const auth = this.authorizeRead(actor, current);
    if (!auth.ok) {
      return auth;
    }
    return this.transitionWorkflow(actor, id, 'awaiting_upload');
  }

  cancelW9Request(actor: LegalWorkflowActor, id: LegalW9RequestId): LegalW9WorkflowResult<LegalW9Request> {
    if (actor.portal === 'artist') {
      return legalW9WorkflowError('w9_actor_not_authorized', 'Recipients cannot cancel W-9 requests in LC-7.');
    }
    if (!canActorCreateW9Request(actor)) {
      return legalW9WorkflowError('w9_actor_not_authorized', 'Only staff owner/manager can cancel W-9 requests.');
    }
    return this.transitionWorkflow(actor, id, 'cancelled');
  }

  expireW9Request(actor: LegalWorkflowActor, id: LegalW9RequestId): LegalW9WorkflowResult<LegalW9Request> {
    const current = this.requests.get(id);
    if (!current) {
      return legalW9WorkflowError('w9_request_not_found', `W-9 request not found: ${id}`, Object.freeze({ id }));
    }

    if (isTerminalLegalW9RequestStatus(current.status)) {
      return legalW9WorkflowError(
        'w9_request_already_terminal',
        `W-9 request ${id} is terminal (${current.status}).`,
        Object.freeze({ status: current.status }),
      );
    }

    const now = this.now();
    if (current.dueAt && now < current.dueAt) {
      return legalW9WorkflowError(
        'w9_expiration_not_due',
        `W-9 request ${id} cannot expire before dueAt (${current.dueAt}).`,
        Object.freeze({ dueAt: current.dueAt, now }),
      );
    }

    if (actor.portal === 'staff' && !canActorCreateW9Request(actor)) {
      return legalW9WorkflowError('w9_actor_not_authorized', 'Staff seller cannot expire W-9 requests.');
    }

    return this.transitionWorkflow(actor, id, 'expired');
  }

  private buildSubmittedBy(
    actor: LegalWorkflowActor,
    displayName: string,
  ): LegalDocumentSubmissionSubmittedBy {
    return Object.freeze({
      actorId: actor.actorId,
      displayName: displayName.trim(),
      portal: actor.portal,
      ...(actor.portal === 'staff' && actor.role ? { role: actor.role } : {}),
    });
  }

  private getLinkedSubmission(
    request: LegalW9Request,
  ): LegalW9WorkflowResult<LegalDocumentSubmission> | ReturnType<typeof legalW9WorkflowError> {
    if (!request.submissionId) {
      return legalW9WorkflowError(
        'w9_invalid_status_transition',
        `W-9 request ${request.id} has no linked submission.`,
        Object.freeze({ requestId: request.id }),
      );
    }
    const submission = this.storage.getSubmission(request.submissionId);
    if (!submission.ok) {
      return legalW9WorkflowError(
        'w9_instance_transition_failed',
        submission.message,
        Object.freeze({ code: submission.code }),
      );
    }
    if (submission.value.workflowId !== request.id) {
      return legalW9WorkflowError(
        'w9_invalid_status_transition',
        `Submission ${submission.value.id} is not linked to workflow ${request.id}.`,
      );
    }
    return legalW9WorkflowSuccess(submission.value);
  }

  submitW9Document(input: SubmitW9DocumentInput): LegalW9WorkflowResult<LegalW9Request> {
    if (!canActorSubmitW9Document(input.actor)) {
      this.auditDenied(
        input.actor,
        'w9_submitted',
        'w9_request',
        input.workflowId,
        'w9_actor_not_authorized',
      );
      return legalW9WorkflowError(
        'w9_actor_not_authorized',
        'Only artists can submit W-9 documents.',
      );
    }

    const current = this.requests.get(input.workflowId);
    if (!current) {
      return legalW9WorkflowError(
        'w9_request_not_found',
        `W-9 request not found: ${input.workflowId}`,
        Object.freeze({ id: input.workflowId }),
      );
    }

    const auth = this.authorizeRead(input.actor, current);
    if (!auth.ok) {
      return auth;
    }

    if (current.status !== 'awaiting_upload') {
      return legalW9WorkflowError(
        'w9_invalid_status_transition',
        `W-9 request ${current.id} must be awaiting_upload before submission.`,
        Object.freeze({ status: current.status }),
      );
    }

    const now = this.now();
    const planned = applyLegalW9RequestStatusTransition(current, 'submitted', now);
    if (!planned.ok) {
      return planned;
    }

    const instancePlan = this.validateInstanceSyncForWorkflowStatus(
      current.documentInstanceId,
      planned.value.status,
    );
    if (!instancePlan.ok) {
      return instancePlan;
    }

    const stored = this.storage.storeSubmission({
      documentInstanceId: current.documentInstanceId,
      workflowId: current.id,
      templateId: current.templateId,
      templateVersionId: current.templateVersionId,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      checksum: input.checksum,
      contentReference: input.contentReference,
      submittedBy: this.buildSubmittedBy(input.actor, input.submittedByDisplayName),
      metadata: input.metadata,
      initialStatus: 'uploaded',
    });
    if (!stored.ok) {
      return legalW9WorkflowError(
        'w9_instance_transition_failed',
        stored.message,
        Object.freeze({ code: stored.code }),
      );
    }

    const linked = freezeLegalW9Request({
      ...planned.value,
      submissionId: stored.value.id,
    });

    const applied = this.applyPersistedWorkflowTransition(linked);
    if (!applied.ok) {
      const purged = this.storage.purgeUnlinkedSubmission(stored.value.id);
      if (!purged.ok) {
        return legalW9WorkflowError(
          'w9_instance_transition_failed',
          purged.message,
          Object.freeze({ code: purged.code }),
        );
      }
      return applied;
    }

    const correlationId = this.auditRecorder?.nextCorrelationId();
    return this.auditSuccessEventsOrRollback(
      applied.value,
      () => {
        this.requests.set(current.id, freezeLegalW9Request(current));
        void this.storage.purgeUnlinkedSubmission(stored.value.id);
      },
      correlationId
        ? [
            {
              actor: mapWorkflowActorToAuditActor(input.actor, input.submittedByDisplayName),
              action: 'w9_submitted',
              entityType: 'w9_request',
              entityId: applied.value.id,
              previousState: Object.freeze({ status: current.status }),
              nextState: Object.freeze({ status: applied.value.status }),
              correlationId,
              relatedEntityIds: Object.freeze({
                submissionId: stored.value.id,
                documentInstanceId: current.documentInstanceId,
              }),
            },
            {
              actor: mapWorkflowActorToAuditActor(input.actor, input.submittedByDisplayName),
              action: 'submission_uploaded',
              entityType: 'legal_document_submission',
              entityId: stored.value.id,
              nextState: Object.freeze({ status: 'uploaded' }),
              correlationId,
              relatedEntityIds: Object.freeze({ workflowId: current.id }),
            },
          ]
        : [],
    );
  }

  markSubmissionUnderReview(
    actor: LegalWorkflowActor,
    workflowId: LegalW9RequestId,
  ): LegalW9WorkflowResult<LegalDocumentSubmission> {
    if (!canActorReviewSubmissions(actor)) {
      return legalW9WorkflowError(
        'w9_actor_not_authorized',
        'Only staff owner/manager can review W-9 submissions.',
      );
    }

    const current = this.requests.get(workflowId);
    if (!current) {
      return legalW9WorkflowError('w9_request_not_found', `W-9 request not found: ${workflowId}`, {
        id: workflowId,
      });
    }

    if (current.status !== 'submitted') {
      return legalW9WorkflowError(
        'w9_invalid_status_transition',
        `W-9 request ${workflowId} must be submitted before review.`,
        Object.freeze({ status: current.status }),
      );
    }

    const linked = this.getLinkedSubmission(current);
    if (!linked.ok) {
      return linked;
    }

    if (!canActorViewSubmission(actor, linked.value.submittedBy)) {
      return legalW9WorkflowError(
        'w9_actor_not_authorized',
        'Actor is not authorized to review this submission.',
      );
    }

    const reviewed = this.storage.transitionSubmission(linked.value.id, 'under_review');
    if (!reviewed.ok) {
      return legalW9WorkflowError(
        'w9_instance_transition_failed',
        reviewed.message,
        Object.freeze({ code: reviewed.code }),
      );
    }

    this.persistRequest(
      freezeLegalW9Request({
        ...current,
        updatedAt: this.now(),
      }),
    );

    const correlationId = this.auditRecorder?.nextCorrelationId();
    this.auditRecorder?.recordSuccess({
      actor: mapWorkflowActorToAuditActor(actor),
      action: 'w9_marked_under_review',
      entityType: 'w9_request',
      entityId: current.id,
      previousState: Object.freeze({ status: current.status }),
      nextState: Object.freeze({ status: current.status }),
      correlationId,
      metadata: Object.freeze({ recipientId: current.recipient.recipientId }),
    });
    this.auditRecorder?.recordSuccess({
      actor: mapWorkflowActorToAuditActor(actor),
      action: 'submission_review_started',
      entityType: 'legal_document_submission',
      entityId: reviewed.value.id,
      previousState: Object.freeze({ status: 'uploaded' }),
      nextState: Object.freeze({ status: 'under_review' }),
      correlationId,
      relatedEntityIds: Object.freeze({ workflowId: current.id }),
    });

    return legalW9WorkflowSuccess(reviewed.value);
  }

  acceptSubmission(
    actor: LegalWorkflowActor,
    workflowId: LegalW9RequestId,
  ): LegalW9WorkflowResult<LegalW9Request> {
    if (!canActorReviewSubmissions(actor)) {
      return legalW9WorkflowError(
        'w9_actor_not_authorized',
        'Only staff owner/manager can accept W-9 submissions.',
      );
    }

    const current = this.requests.get(workflowId);
    if (!current) {
      return legalW9WorkflowError('w9_request_not_found', `W-9 request not found: ${workflowId}`, {
        id: workflowId,
      });
    }

    if (isTerminalLegalW9RequestStatus(current.status)) {
      return legalW9WorkflowError(
        'w9_request_already_terminal',
        `W-9 request ${workflowId} is terminal (${current.status}).`,
        Object.freeze({ status: current.status }),
      );
    }

    const linked = this.getLinkedSubmission(current);
    if (!linked.ok) {
      return linked;
    }

    if (linked.value.status !== 'under_review') {
      return legalW9WorkflowError(
        'w9_invalid_status_transition',
        `Submission ${linked.value.id} must be under_review before acceptance.`,
        Object.freeze({ submissionStatus: linked.value.status }),
      );
    }

    const now = this.now();
    const planned = applyLegalW9RequestStatusTransition(current, 'accepted', now);
    if (!planned.ok) {
      return planned;
    }

    const instancePlan = this.validateInstanceSyncForWorkflowStatus(
      current.documentInstanceId,
      planned.value.status,
    );
    if (!instancePlan.ok) {
      return instancePlan;
    }

    const acceptedSubmission = this.storage.transitionSubmission(linked.value.id, 'accepted');
    if (!acceptedSubmission.ok) {
      return legalW9WorkflowError(
        'w9_instance_transition_failed',
        acceptedSubmission.message,
        Object.freeze({ code: acceptedSubmission.code }),
      );
    }

    const applied = this.applyPersistedWorkflowTransition(planned.value);
    if (!applied.ok) {
      const rollback = this.storage.transitionSubmission(linked.value.id, 'under_review');
      if (!rollback.ok) {
        return legalW9WorkflowError(
          'w9_instance_transition_failed',
          rollback.message,
          Object.freeze({ code: rollback.code }),
        );
      }
      return applied;
    }

    const correlationId = this.auditRecorder?.nextCorrelationId();
    return this.auditSuccessEventsOrRollback(
      applied.value,
      () => {
        this.requests.set(current.id, freezeLegalW9Request(current));
        void this.storage.transitionSubmission(linked.value.id, 'under_review');
      },
      correlationId
        ? [
            {
              actor: mapWorkflowActorToAuditActor(actor),
              action: 'submission_accepted',
              entityType: 'legal_document_submission',
              entityId: linked.value.id,
              previousState: Object.freeze({ status: 'under_review' }),
              nextState: Object.freeze({ status: 'accepted' }),
              correlationId,
            },
            {
              actor: mapWorkflowActorToAuditActor(actor),
              action: 'w9_accepted',
              entityType: 'w9_request',
              entityId: applied.value.id,
              previousState: Object.freeze({ status: current.status }),
              nextState: Object.freeze({ status: 'accepted' }),
              correlationId,
            },
            {
              actor: mapWorkflowActorToAuditActor(actor),
              action: 'instance_status_changed',
              entityType: 'legal_document_instance',
              entityId: current.documentInstanceId,
              nextState: Object.freeze({ status: 'signed' }),
              correlationId,
            },
          ]
        : [],
    );
  }

  rejectSubmission(
    actor: LegalWorkflowActor,
    workflowId: LegalW9RequestId,
  ): LegalW9WorkflowResult<LegalW9Request> {
    if (!canActorReviewSubmissions(actor)) {
      return legalW9WorkflowError(
        'w9_actor_not_authorized',
        'Only staff owner/manager can reject W-9 submissions.',
      );
    }

    const current = this.requests.get(workflowId);
    if (!current) {
      return legalW9WorkflowError('w9_request_not_found', `W-9 request not found: ${workflowId}`, {
        id: workflowId,
      });
    }

    if (isTerminalLegalW9RequestStatus(current.status)) {
      return legalW9WorkflowError(
        'w9_request_already_terminal',
        `W-9 request ${workflowId} is terminal (${current.status}).`,
        Object.freeze({ status: current.status }),
      );
    }

    const linked = this.getLinkedSubmission(current);
    if (!linked.ok) {
      return linked;
    }

    if (linked.value.status !== 'under_review') {
      return legalW9WorkflowError(
        'w9_invalid_status_transition',
        `Submission ${linked.value.id} must be under_review before rejection.`,
        Object.freeze({ submissionStatus: linked.value.status }),
      );
    }

    const now = this.now();
    const planned = applyLegalW9RequestStatusTransition(current, 'rejected', now);
    if (!planned.ok) {
      return planned;
    }

    const instancePlan = this.validateInstanceSyncForWorkflowStatus(
      current.documentInstanceId,
      planned.value.status,
    );
    if (!instancePlan.ok) {
      return instancePlan;
    }

    const rejectedSubmission = this.storage.transitionSubmission(linked.value.id, 'rejected');
    if (!rejectedSubmission.ok) {
      return legalW9WorkflowError(
        'w9_instance_transition_failed',
        rejectedSubmission.message,
        Object.freeze({ code: rejectedSubmission.code }),
      );
    }

    const applied = this.applyPersistedWorkflowTransition(planned.value);
    if (!applied.ok) {
      const rollback = this.storage.transitionSubmission(linked.value.id, 'under_review');
      if (!rollback.ok) {
        return legalW9WorkflowError(
          'w9_instance_transition_failed',
          rollback.message,
          Object.freeze({ code: rollback.code }),
        );
      }
      return applied;
    }

    const correlationId = this.auditRecorder?.nextCorrelationId();
    return this.auditSuccessEventsOrRollback(
      applied.value,
      () => {
        this.requests.set(current.id, freezeLegalW9Request(current));
        void this.storage.transitionSubmission(linked.value.id, 'under_review');
      },
      correlationId
        ? [
            {
              actor: mapWorkflowActorToAuditActor(actor),
              action: 'submission_rejected',
              entityType: 'legal_document_submission',
              entityId: linked.value.id,
              previousState: Object.freeze({ status: 'under_review' }),
              nextState: Object.freeze({ status: 'rejected' }),
              correlationId,
            },
            {
              actor: mapWorkflowActorToAuditActor(actor),
              action: 'w9_rejected',
              entityType: 'w9_request',
              entityId: applied.value.id,
              previousState: Object.freeze({ status: current.status }),
              nextState: Object.freeze({ status: 'rejected' }),
              correlationId,
            },
          ]
        : [],
    );
  }

  deleteW9Submission(
    actor: LegalWorkflowActor,
    workflowId: LegalW9RequestId,
  ): LegalW9WorkflowResult<LegalDocumentSubmission> {
    if (!canActorDeleteSubmissions(actor)) {
      return legalW9WorkflowError(
        'w9_actor_not_authorized',
        'Only staff owner can delete W-9 submissions.',
      );
    }

    const current = this.requests.get(workflowId);
    if (!current) {
      return legalW9WorkflowError('w9_request_not_found', `W-9 request not found: ${workflowId}`, {
        id: workflowId,
      });
    }

    const linked = this.getLinkedSubmission(current);
    if (!linked.ok) {
      return linked;
    }

    const deleted = this.storage.deleteSubmission(linked.value.id);
    if (!deleted.ok) {
      return legalW9WorkflowError(
        'w9_instance_transition_failed',
        deleted.message,
        Object.freeze({ code: deleted.code }),
      );
    }

    return this.auditSuccessEventsOrRollback(
      deleted.value,
      () => {
        void this.storage.transitionSubmission(linked.value.id, linked.value.status);
      },
      [
        {
          actor: mapWorkflowActorToAuditActor(actor),
          action: 'submission_deleted',
          entityType: 'legal_document_submission',
          entityId: linked.value.id,
          previousState: Object.freeze({ status: linked.value.status }),
          nextState: Object.freeze({ status: 'deleted' }),
          relatedEntityIds: Object.freeze({ workflowId: current.id }),
        },
      ],
    );
  }

  getW9SubmissionPublicView(
    actor: LegalWorkflowActor,
    workflowId: LegalW9RequestId,
  ): LegalW9WorkflowResult<LegalDocumentSubmissionPublicView | null> {
    const current = this.requests.get(workflowId);
    if (!current) {
      return legalW9WorkflowError('w9_request_not_found', `W-9 request not found: ${workflowId}`, {
        id: workflowId,
      });
    }

    const auth = this.authorizeRead(actor, current);
    if (!auth.ok) {
      this.auditDenied(
        actor,
        'legal_access_denied',
        'w9_request',
        workflowId,
        auth.code,
      );
      return auth;
    }

    if (!current.submissionId) {
      if (current.status === 'awaiting_upload') {
        return legalW9WorkflowSuccess(
          Object.freeze({
            id: 'LDS-PENDING',
            filename: 'w9-submission-pending.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 0,
            status: 'pending_upload' as const,
            submittedAt: current.updatedAt,
            updatedAt: current.updatedAt,
            statusLabel: 'Awaiting upload',
          }),
        );
      }
      return legalW9WorkflowSuccess(null);
    }

    const submission = this.storage.getSubmission(current.submissionId);
    if (!submission.ok) {
      return legalW9WorkflowError(
        'w9_instance_transition_failed',
        submission.message,
        Object.freeze({ code: submission.code }),
      );
    }

    if (!canActorViewSubmission(actor, submission.value.submittedBy)) {
      this.auditDenied(
        actor,
        'legal_access_denied',
        'legal_document_submission',
        submission.value.id,
        'w9_actor_not_authorized',
      );
      return legalW9WorkflowError(
        'w9_actor_not_authorized',
        'Actor is not authorized to view this submission.',
      );
    }

    if (submission.value.status === 'deleted') {
      return legalW9WorkflowSuccess(null);
    }

    this.auditRecorder?.recordSuccess({
      actor: mapWorkflowActorToAuditActor(actor),
      action: 'legal_sensitive_record_viewed',
      entityType: 'legal_document_submission',
      entityId: submission.value.id,
      relatedEntityIds: Object.freeze({ workflowId: current.id }),
      metadata: Object.freeze({ recipientId: current.recipient.recipientId }),
    });

    return legalW9WorkflowSuccess(toSubmissionPublicView(submission.value));
  }

  listW9Submissions(
    actor: LegalWorkflowActor,
  ): LegalW9WorkflowResult<readonly LegalDocumentSubmissionPublicView[]> {
    if (!canActorListSubmissions(actor)) {
      return legalW9WorkflowError(
        'w9_actor_not_authorized',
        'Actor is not authorized to list W-9 submissions.',
      );
    }

    const rows = this.storage.listSubmissions().filter((row) => {
      if (actor.portal === 'artist') {
        const request = row.workflowId ? this.requests.get(row.workflowId as LegalW9RequestId) : undefined;
        return (
          request !== undefined &&
          canActorAccessW9Request(actor, request.recipient.recipientType, request.recipient.recipientId)
        );
      }
      return canActorViewSubmission(actor, row.submittedBy);
    });

    return legalW9WorkflowSuccess(
      Object.freeze(rows.map((row) => toSubmissionPublicView(row))),
    );
  }
}

export function createInMemoryLegalW9WorkflowService(
  options: InMemoryLegalW9WorkflowServiceOptions = {},
): InMemoryLegalW9WorkflowService {
  return new InMemoryLegalW9WorkflowService(options);
}

export function createIsolatedLegalW9WorkflowService(
  options: Omit<InMemoryLegalW9WorkflowServiceOptions, 'seedDemo'> = {},
): InMemoryLegalW9WorkflowService {
  return new InMemoryLegalW9WorkflowService({ ...options, seedDemo: false });
}
