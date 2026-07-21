/** LC-7 — In-memory W-9 collection workflow service */

import { resolveLegalTemplateAssetUrl } from '../assets/legal-template-asset-resolver';
import {
  createSystemLegalDocumentInstanceClock,
  type LegalDocumentInstanceClock,
} from '../domain/legal-document-instance-clock';
import { isValidLegalDocumentInstanceTimestamp } from '../domain/legal-document-instance-factory';
import type { LegalDocumentInstanceStatus } from '../domain/legal-document-instance-status';
import {
  createInMemoryLegalDocumentInstanceService,
  type InMemoryLegalDocumentInstanceService,
} from '../in-memory/in-memory-legal-document-instance-service';
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
  type LegalW9OperationalStatus,
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

export type InMemoryLegalW9WorkflowServiceOptions = {
  readonly clock?: LegalDocumentInstanceClock;
  readonly instanceService?: InMemoryLegalDocumentInstanceService;
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
  private readonly requests = new Map<LegalW9RequestId, LegalW9Request>();
  private sequence = 0;

  constructor(options: InMemoryLegalW9WorkflowServiceOptions = {}) {
    this.clock = options.clock ?? createSystemLegalDocumentInstanceClock();
    this.instanceService =
      options.instanceService ??
      createInMemoryLegalDocumentInstanceService({
        clock: this.clock,
      });

    if (options.seedDemo) {
      this.seedDemoRequest();
    }
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

  requestW9(input: RequestW9Input): LegalW9WorkflowResult<LegalW9Request> {
    const roleResult = assertStaffRole(input.actor);
    if (!roleResult.ok) {
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

    return legalW9WorkflowSuccess(this.persistRequest(request));
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
    nextStatus: LegalW9OperationalStatus,
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

    return legalW9WorkflowSuccess(this.persistRequest(updated.value));
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
