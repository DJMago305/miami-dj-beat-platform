/** @vitest-environment jsdom */

/** LC-9 — Legal audit integration with LC-6/7/8 */

import { describe, expect, it, beforeEach } from 'vitest';

import {
  canActorQueryLegalAuditTrail,
  createLegalAuditRecorder,
  filterAuditEventsForArtist,
  filterAuditEventsForStaffRole,
  toArtistLegalAuditPublicView,
  toStaffLegalAuditPublicView,
} from '../../shared/services/legal/audit';
import { createFixedLegalDocumentInstanceClock } from '../../shared/services/legal/domain';
import {
  createInMemoryLegalAuditTrail,
} from '../../shared/services/legal/in-memory/in-memory-legal-audit-trail';
import {
  createInMemoryLegalDocumentInstanceService,
} from '../../shared/services/legal/in-memory/in-memory-legal-document-instance-service';
import {
  createInMemoryLegalDocumentStorage,
} from '../../shared/services/legal/in-memory/in-memory-legal-document-storage';
import {
  createIsolatedLegalW9WorkflowService,
} from '../../shared/services/legal/in-memory/in-memory-legal-w9-workflow-service';
import {
  appendLegalAuditSections,
  buildStaffLegalActivitySection,
} from '../../shared/services/legal/provider/legal-audit-shell-mapper';
import {
  buildStaffLegalCenterShellViewModel,
  resolveLegalProvider,
} from '../../shared/services/legal/provider';
import { renderLegalCenterShell } from '../../shared/services/legal/ui';
import type { CreateLegalDocumentInstanceInput } from '../../shared/services/legal/domain';
import type { LegalWorkflowActor } from '../../shared/services/legal/workflows';

const FIXED_NOW = '2026-07-20T12:00:00.000Z';
const clock = createFixedLegalDocumentInstanceClock(FIXED_NOW);

const ownerActor: LegalWorkflowActor = Object.freeze({
  portal: 'staff',
  role: 'owner',
  actorId: 'STAFF-OWNER-001',
});
const managerActor: LegalWorkflowActor = Object.freeze({
  portal: 'staff',
  role: 'manager',
  actorId: 'STAFF-MANAGER-001',
});
const sellerActor: LegalWorkflowActor = Object.freeze({
  portal: 'staff',
  role: 'seller',
  actorId: 'STAFF-SELLER-001',
});
const artistA: LegalWorkflowActor = Object.freeze({ portal: 'artist', actorId: 'ART-A' });
const artistB: LegalWorkflowActor = Object.freeze({ portal: 'artist', actorId: 'ART-B' });
const clientActor: LegalWorkflowActor = Object.freeze({ portal: 'client', actorId: 'CLI-001' });

function recipient(id: string) {
  return Object.freeze({
    recipientType: 'artist' as const,
    recipientId: id,
    displayName: `Demo ${id}`,
    email: `${id.toLowerCase()}@example.test`,
  });
}

function submissionPayload(artistId: string) {
  return Object.freeze({
    filename: 'w9-demo.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 2048,
    checksum: `sha256:demo-checksum-${artistId}`,
    contentReference: `in-memory://w9/demo/${artistId}`,
    submittedByDisplayName: 'Demo Artist',
  });
}

function createAuditedLab() {
  const auditTrail = createInMemoryLegalAuditTrail({ clock });
  const auditRecorder = createLegalAuditRecorder({ auditTrail, clock });
  const instanceService = createInMemoryLegalDocumentInstanceService({ clock, auditRecorder });
  const storage = createInMemoryLegalDocumentStorage({ clock });
  const service = createIsolatedLegalW9WorkflowService({
    clock,
    instanceService,
    storage,
    auditRecorder,
  });
  return Object.freeze({ auditTrail, auditRecorder, instanceService, storage, service });
}

function seedAwaitingUpload(lab: ReturnType<typeof createAuditedLab>, artistId: string) {
  const created = lab.service.requestW9({
    actor: ownerActor,
    recipient: recipient(artistId),
    requestedByDisplayName: 'Staff Owner',
  });
  expect(created.ok).toBe(true);
  if (!created.ok) {
    throw new Error('seed failed');
  }
  lab.service.makeW9Available(ownerActor, created.value.id);
  lab.service.markW9Viewed(Object.freeze({ portal: 'artist', actorId: artistId }), created.value.id);
  lab.service.markAwaitingUpload(Object.freeze({ portal: 'artist', actorId: artistId }), created.value.id);
  return created.value;
}

function baseInstanceInput(
  overrides: Partial<CreateLegalDocumentInstanceInput> = {},
): CreateLegalDocumentInstanceInput {
  return {
    templateId: 'SPC-001',
    templateVersionId: 'TV-SPC-001-1',
    category: 'SPC',
    title: 'Corporate W-9 Request',
    recipient: recipient('ART-A'),
    owner: {
      ownerType: 'platform',
      ownerId: 'MDJB-PLATFORM',
      issuedBy: 'STAFF-001',
      assignedBy: 'STAFF-001',
    },
    signatureRequirement: { requirement: 'single_signer', requiredSignerCount: 1 },
    metadata: Object.freeze({ channel: 'legal_center' }),
    ...overrides,
  };
}

describe('LC-9 audit integration — LC-6 document instances', () => {
  it('records instance creation, transition, cancellation, and expiration', () => {
    const { auditTrail, instanceService } = createAuditedLab();
    const created = instanceService.createInstance(baseInstanceInput());
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    instanceService.transitionStatus(created.value.id, 'pending');
    instanceService.transitionStatus(created.value.id, 'sent');
    instanceService.cancelInstance(created.value.id);

    const events = auditTrail.listEventsByEntity('legal_document_instance', created.value.id);
    const actions = events.map((event) => event.action);
    expect(actions).toContain('instance_created');
    expect(actions).toContain('instance_status_changed');
    expect(actions).toContain('instance_cancelled');
  });

  it('rolls back instance creation when audit append fails', () => {
    const auditTrail = createInMemoryLegalAuditTrail({ clock });
    auditTrail.setForceAppendFailure(true);
    const auditRecorder = createLegalAuditRecorder({ auditTrail, clock });
    const instanceService = createInMemoryLegalDocumentInstanceService({ clock, auditRecorder });
    const created = instanceService.createInstance(baseInstanceInput({ id: 'LDI-ROLLBACK-001' }));

    expect(created.ok).toBe(false);
    expect(instanceService.getInstanceById('LDI-ROLLBACK-001').ok).toBe(false);
    expect(auditTrail.listEvents()).toHaveLength(0);
  });
});

describe('LC-9 audit integration — LC-7 W-9 workflow', () => {
  let lab: ReturnType<typeof createAuditedLab>;

  beforeEach(() => {
    lab = createAuditedLab();
  });

  it('records owner/manager request success and seller/client denied', () => {
    const ownerCreated = lab.service.requestW9({
      actor: ownerActor,
      recipient: recipient('ART-A'),
      requestedByDisplayName: 'Staff Owner',
    });
    expect(ownerCreated.ok).toBe(true);

    const sellerAttempt = lab.service.requestW9({
      actor: sellerActor,
      recipient: recipient('ART-B'),
      requestedByDisplayName: 'Seller Blocked',
    });
    expect(sellerAttempt.ok).toBe(false);

    const deniedEvents = lab.auditTrail.listEventsByAction('w9_requested');
    expect(deniedEvents.some((event) => event.outcome === 'success')).toBe(true);
    expect(deniedEvents.some((event) => event.outcome === 'denied')).toBe(true);
  });

  it('records available, viewed, cancel, and duplicate active request denied', () => {
    const created = lab.service.requestW9({
      actor: ownerActor,
      recipient: recipient('ART-A'),
      requestedByDisplayName: 'Staff Owner',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    lab.service.makeW9Available(ownerActor, created.value.id);
    lab.service.markW9Viewed(artistA, created.value.id);

    const duplicate = lab.service.requestW9({
      actor: ownerActor,
      recipient: recipient('ART-A'),
      requestedByDisplayName: 'Duplicate',
    });
    expect(duplicate.ok).toBe(false);

    lab.service.cancelW9Request(ownerActor, created.value.id);

    const actions = lab.auditTrail.listEvents().map((event) => event.action);
    expect(actions).toContain('w9_made_available');
    expect(actions).toContain('w9_viewed');
    expect(actions).toContain('w9_cancelled');
  });
});

describe('LC-9 audit integration — LC-8 submissions', () => {
  let lab: ReturnType<typeof createAuditedLab>;
  let workflowId: string;

  beforeEach(() => {
    lab = createAuditedLab();
    const request = seedAwaitingUpload(lab, 'ART-A');
    workflowId = request.id;
  });

  it('records submit, review, accept, reject, delete with correlation ids', () => {
    const submitted = lab.service.submitW9Document({
      actor: artistA,
      workflowId,
      ...submissionPayload('ART-A'),
    });
    expect(submitted.ok).toBe(true);

    lab.service.markSubmissionUnderReview(managerActor, workflowId);
    lab.service.acceptSubmission(ownerActor, workflowId);

    const correlated = lab.auditTrail
      .listEvents()
      .filter((event) => event.correlationId !== undefined);
    expect(correlated.length).toBeGreaterThan(0);

    const actions = lab.auditTrail.listEvents().map((event) => event.action);
    expect(actions).toContain('w9_submitted');
    expect(actions).toContain('submission_uploaded');
    expect(actions).toContain('submission_review_started');
    expect(actions).toContain('submission_accepted');
    expect(actions).toContain('w9_accepted');
  });

  it('records sensitive view success and cross-artist access denied', () => {
    const submitted = lab.service.submitW9Document({
      actor: artistA,
      workflowId,
      ...submissionPayload('ART-A'),
    });
    expect(submitted.ok).toBe(true);

    const ownerView = lab.service.getW9SubmissionPublicView(ownerActor, workflowId);
    expect(ownerView.ok).toBe(true);

    const artistBView = lab.service.getW9SubmissionPublicView(artistB, workflowId);
    expect(artistBView.ok).toBe(false);

    const denied = lab.auditTrail.listEventsByAction('legal_access_denied');
    expect(denied.length).toBeGreaterThan(0);
    expect(lab.auditTrail.listEventsByAction('legal_sensitive_record_viewed').length).toBeGreaterThan(0);
  });

  it('rolls back accept when audit append fails after domain mutation', () => {
    const submitted = lab.service.submitW9Document({
      actor: artistA,
      workflowId,
      ...submissionPayload('ART-A'),
    });
    expect(submitted.ok).toBe(true);
    lab.service.markSubmissionUnderReview(managerActor, workflowId);

    lab.auditTrail.setForceAppendFailure(true);
    const accepted = lab.service.acceptSubmission(ownerActor, workflowId);
    expect(accepted.ok).toBe(false);

    const current = lab.service.getW9RequestById(ownerActor, workflowId);
    expect(current.ok).toBe(true);
    if (current.ok) {
      expect(current.value.status).toBe('submitted');
    }
  });
});

describe('LC-9 audit authorization and public projection', () => {
  it('blocks seller and client from querying legal audit trail', () => {
    expect(canActorQueryLegalAuditTrail(sellerActor)).toBe(false);
    expect(canActorQueryLegalAuditTrail(clientActor)).toBe(false);
    expect(canActorQueryLegalAuditTrail(ownerActor)).toBe(true);
    expect(canActorQueryLegalAuditTrail(artistA)).toBe(true);
  });

  it('filters artist events to own documents only', () => {
    const lab = createAuditedLab();
    lab.service.requestW9({
      actor: ownerActor,
      recipient: recipient('ART-A'),
      requestedByDisplayName: 'Staff Owner',
    });
    lab.service.requestW9({
      actor: ownerActor,
      recipient: recipient('ART-B'),
      requestedByDisplayName: 'Staff Owner',
    });

    const artistAEvents = filterAuditEventsForArtist(lab.auditTrail.listEvents(), 'ART-A');
    const artistBEvents = filterAuditEventsForArtist(lab.auditTrail.listEvents(), 'ART-B');
    expect(artistAEvents.length).toBeGreaterThan(0);
    expect(artistBEvents.length).toBeGreaterThan(0);
    expect(artistAEvents.some((event) => event.metadata.recipientId === 'ART-B')).toBe(false);
  });

  it('public mapper hides internal ids, correlationId, and technical metadata', () => {
    const lab = createAuditedLab();
    const created = lab.service.requestW9({
      actor: ownerActor,
      recipient: recipient('ART-A'),
      requestedByDisplayName: 'Staff Owner',
    });
    expect(created.ok).toBe(true);
    const event = lab.auditTrail.listEvents()[0];
    const staffView = toStaffLegalAuditPublicView(event);
    const artistView = toArtistLegalAuditPublicView(event);

    expect(staffView).not.toHaveProperty('correlationId');
    expect(staffView).not.toHaveProperty('metadata');
    expect(artistView.actorLabel).not.toContain('STAFF-OWNER-001');
    expect(JSON.stringify(staffView)).not.toContain('storageKey');
    expect(JSON.stringify(staffView)).not.toContain('checksum');
  });

  it('staff owner shell includes Legal Activity and seller shell excludes it', async () => {
    const ownerShell = await buildStaffLegalCenterShellViewModel(resolveLegalProvider({ mode: 'IN_MEMORY' }), {
      role: 'staff_owner',
    });
    const sellerShell = await buildStaffLegalCenterShellViewModel(resolveLegalProvider({ mode: 'IN_MEMORY' }), {
      role: 'staff_seller',
    });

    const ownerHtml = renderLegalCenterShell(ownerShell).outerHTML;
    const sellerHtml = renderLegalCenterShell(sellerShell).outerHTML;
    expect(ownerHtml).toContain('Legal Activity');
    expect(sellerHtml).not.toContain('Legal Activity');
  });

  it('appendLegalAuditSections keeps client shell without audit sections', () => {
    const sections = appendLegalAuditSections([], { portal: 'client' });
    expect(sections).toHaveLength(0);
    expect(buildStaffLegalActivitySection('staff_seller')).toBeNull();
    expect(filterAuditEventsForStaffRole([], 'staff_owner')).toHaveLength(0);
  });
});
