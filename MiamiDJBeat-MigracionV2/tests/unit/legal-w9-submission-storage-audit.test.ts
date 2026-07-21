/** @vitest-environment jsdom */

/** LC-8 audit — coordination, replace/delete policy, security, authorization */

import { describe, expect, it, beforeEach } from 'vitest';

import { createFixedLegalDocumentInstanceClock } from '../../shared/services/legal/domain';
import {
  createInMemoryLegalDocumentInstanceService,
} from '../../shared/services/legal/in-memory/in-memory-legal-document-instance-service';
import {
  createInMemoryLegalDocumentStorage,
} from '../../shared/services/legal/in-memory/in-memory-legal-document-storage';
import {
  createIsolatedLegalW9WorkflowService,
  type InMemoryLegalW9WorkflowService,
} from '../../shared/services/legal/in-memory/in-memory-legal-w9-workflow-service';
import {
  buildClientLegalCenterShellViewModel,
  resolveLegalProvider,
} from '../../shared/services/legal/provider';
import { renderLegalCenterShell } from '../../shared/services/legal/ui';
import {
  isTerminalLegalDocumentSubmissionStatus,
} from '../../shared/services/legal/submissions';
import {
  LEGAL_W9_TEMPLATE_ID,
  LEGAL_W9_TEMPLATE_VERSION_ID,
  type LegalWorkflowActor,
} from '../../shared/services/legal/workflows';

const FIXED_NOW = '2026-07-20T12:00:00.000Z';
const clock = createFixedLegalDocumentInstanceClock(FIXED_NOW);

const ownerActor: LegalWorkflowActor = Object.freeze({
  portal: 'staff',
  role: 'owner',
  actorId: 'STAFF-OWNER-001',
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

function submissionPayload() {
  return Object.freeze({
    filename: 'w9-demo.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 2048,
    checksum: 'sha256:demo-checksum-audit-001',
    contentReference: 'in-memory://w9/demo/audit-001',
    submittedByDisplayName: 'Demo Artist',
  });
}

async function seedUnderReview(
  service: InMemoryLegalW9WorkflowService,
  artistId: string,
) {
  const created = service.requestW9({
    actor: ownerActor,
    recipient: recipient(artistId),
    requestedByDisplayName: 'Staff Owner',
  });
  expect(created.ok).toBe(true);
  if (!created.ok) {
    throw new Error('seed failed');
  }
  const artistActor: LegalWorkflowActor = Object.freeze({ portal: 'artist', actorId: artistId });
  service.makeW9Available(ownerActor, created.value.id);
  service.markW9Viewed(artistActor, created.value.id);
  service.markAwaitingUpload(artistActor, created.value.id);
  service.submitW9Document({
    actor: artistActor,
    workflowId: created.value.id,
    ...submissionPayload(),
  });
  service.markSubmissionUnderReview(ownerActor, created.value.id);
  return created.value;
}

describe('LC-8 audit — coordinated mutations without partial state', () => {
  it('rolls back submission to under_review when workflow/instance acceptance fails', async () => {
    const instanceService = createInMemoryLegalDocumentInstanceService({ clock });
    const service = createIsolatedLegalW9WorkflowService({ clock, instanceService });
    const request = await seedUnderReview(service, 'ART-A');

    instanceService.cancelInstance(request.documentInstanceId);

    const accepted = service.acceptSubmission(ownerActor, request.id);
    expect(accepted.ok).toBe(false);

    const workflow = service.getW9RequestById(ownerActor, request.id);
    expect(workflow.ok && workflow.value.status).toBe('submitted');

    const submission = service.getStoragePort().getSubmission(workflow.ok ? workflow.value.submissionId! : '');
    expect(submission.ok && submission.value.status).toBe('under_review');

    const instance = instanceService.getInstanceById(request.documentInstanceId);
    expect(instance.ok && instance.value.status).toBe('cancelled');
  });

  it('does not store submission when instance sync validation fails before submit', async () => {
    const instanceService = createInMemoryLegalDocumentInstanceService({ clock });
    const storage = createInMemoryLegalDocumentStorage({ clock });
    const service = createIsolatedLegalW9WorkflowService({ clock, instanceService, storage });
    const created = service.requestW9({
      actor: ownerActor,
      recipient: recipient('ART-A'),
      requestedByDisplayName: 'Staff Owner',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    service.makeW9Available(ownerActor, created.value.id);
    service.markW9Viewed(artistA, created.value.id);
    service.markAwaitingUpload(artistA, created.value.id);
    instanceService.cancelInstance(created.value.documentInstanceId);

    const submitted = service.submitW9Document({
      actor: artistA,
      workflowId: created.value.id,
      ...submissionPayload(),
    });
    expect(submitted.ok).toBe(false);
    expect(storage.listSubmissions().length).toBe(0);
    expect(storage.listSubmissionsIncludingDeleted().length).toBe(0);
  });
});

describe('LC-8 audit — replace and delete policy', () => {
  let storage: ReturnType<typeof createInMemoryLegalDocumentStorage>;

  beforeEach(() => {
    storage = createInMemoryLegalDocumentStorage({ clock });
  });

  it('creates a new LDS on replace and soft-deletes the superseded submission', () => {
    const stored = storage.storeSubmission({
      documentInstanceId: 'LDI-000100',
      workflowId: 'W9R-000100',
      templateId: LEGAL_W9_TEMPLATE_ID,
      templateVersionId: LEGAL_W9_TEMPLATE_VERSION_ID,
      filename: 'w9-demo.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      checksum: 'sha256:demo-checksum-replace-001',
      contentReference: 'in-memory://w9/demo/replace-001',
      submittedBy: Object.freeze({
        actorId: 'ART-A',
        displayName: 'Artist A',
        portal: 'artist',
      }),
    });
    expect(stored.ok).toBe(true);
    if (!stored.ok) {
      return;
    }

    const replaced = storage.replaceSubmission(stored.value.id, {
      templateId: LEGAL_W9_TEMPLATE_ID,
      templateVersionId: LEGAL_W9_TEMPLATE_VERSION_ID,
      filename: 'w9-replaced.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      checksum: 'sha256:demo-checksum-replace-002',
      contentReference: 'in-memory://w9/demo/replace-002',
      submittedBy: Object.freeze({
        actorId: 'ART-A',
        displayName: 'Artist A',
        portal: 'artist',
      }),
    });
    expect(replaced.ok).toBe(true);
    if (!replaced.ok) {
      return;
    }
    expect(replaced.value.id).not.toBe(stored.value.id);
    expect(storage.listSubmissions().length).toBe(1);
    expect(storage.listSubmissionsIncludingDeleted().length).toBe(2);

    const old = storage.getSubmission(stored.value.id);
    expect(old.ok && old.value.status).toBe('deleted');
    expect(old.ok && old.value.metadata.replacedBySubmissionId).toBe(replaced.value.id);
    expect(replaced.value.metadata.replacesSubmissionId).toBe(stored.value.id);
  });

  it('blocks replace on terminal submissions', () => {
    const stored = storage.storeSubmission({
      documentInstanceId: 'LDI-000101',
      workflowId: 'W9R-000101',
      templateId: LEGAL_W9_TEMPLATE_ID,
      templateVersionId: LEGAL_W9_TEMPLATE_VERSION_ID,
      filename: 'w9-demo.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      checksum: 'sha256:demo-checksum-replace-003',
      contentReference: 'in-memory://w9/demo/replace-003',
      submittedBy: Object.freeze({
        actorId: 'ART-A',
        displayName: 'Artist A',
        portal: 'artist',
      }),
    });
    expect(stored.ok).toBe(true);
    if (!stored.ok) {
      return;
    }
    storage.transitionSubmission(stored.value.id, 'under_review');
    storage.transitionSubmission(stored.value.id, 'accepted');
    const blocked = storage.replaceSubmission(stored.value.id, {
      templateId: LEGAL_W9_TEMPLATE_ID,
      templateVersionId: LEGAL_W9_TEMPLATE_VERSION_ID,
      filename: 'w9-replaced.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      checksum: 'sha256:demo-checksum-replace-004',
      contentReference: 'in-memory://w9/demo/replace-004',
      submittedBy: Object.freeze({
        actorId: 'ART-A',
        displayName: 'Artist A',
        portal: 'artist',
      }),
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.code).toBe('submission_replace_not_allowed');
    }
  });

  it('soft-deletes without removing audit record', () => {
    const stored = storage.storeSubmission({
      documentInstanceId: 'LDI-000102',
      workflowId: 'W9R-000102',
      templateId: LEGAL_W9_TEMPLATE_ID,
      templateVersionId: LEGAL_W9_TEMPLATE_VERSION_ID,
      filename: 'w9-demo.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      checksum: 'sha256:demo-checksum-delete-001',
      contentReference: 'in-memory://w9/demo/delete-001',
      submittedBy: Object.freeze({
        actorId: 'ART-A',
        displayName: 'Artist A',
        portal: 'artist',
      }),
    });
    expect(stored.ok).toBe(true);
    if (!stored.ok) {
      return;
    }
    const deleted = storage.deleteSubmission(stored.value.id);
    expect(deleted.ok).toBe(true);
    if (!deleted.ok) {
      return;
    }
    expect(deleted.value.status).toBe('deleted');
    expect(isTerminalLegalDocumentSubmissionStatus(deleted.value.status)).toBe(true);
    expect(storage.listSubmissions().length).toBe(0);
    expect(storage.getSubmission(stored.value.id).ok).toBe(true);
    expect(storage.listSubmissionsIncludingDeleted().length).toBe(1);
  });
});

describe('LC-8 audit — security and authorization', () => {
  let service: InMemoryLegalW9WorkflowService;

  beforeEach(() => {
    service = createIsolatedLegalW9WorkflowService({ clock });
  });

  it('rejects unsafe contentReference and checksum formats', () => {
    const storage = createInMemoryLegalDocumentStorage({ clock });
    expect(
      storage.storeSubmission({
        documentInstanceId: 'LDI-000200',
        templateId: LEGAL_W9_TEMPLATE_ID,
        templateVersionId: LEGAL_W9_TEMPLATE_VERSION_ID,
        filename: 'w9-demo.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        checksum: 'not-a-valid-digest',
        contentReference: 'https://evil.example/w9.pdf',
        submittedBy: Object.freeze({
          actorId: 'ART-A',
          displayName: 'Artist A',
          portal: 'artist',
        }),
      }).ok,
    ).toBe(false);
  });

  it('blocks cross-artist read/submit and seller/client listing', async () => {
    const request = await seedUnderReview(service, 'ART-A');
    const artistBSubmit = service.submitW9Document({
      actor: artistB,
      workflowId: request.id,
      ...submissionPayload(),
    });
    expect(artistBSubmit.ok).toBe(false);

    const artistBView = service.getW9SubmissionPublicView(artistB, request.id);
    expect(artistBView.ok).toBe(false);

    const sellerList = service.listW9Submissions(sellerActor);
    expect(sellerList.ok).toBe(false);

    const clientList = service.listW9Submissions(clientActor);
    expect(clientList.ok).toBe(false);

    const ownerList = service.listW9Submissions(ownerActor);
    expect(ownerList.ok && ownerList.value.length).toBeGreaterThan(0);
    expect(JSON.stringify(ownerList)).not.toContain('storageKey');
  });

  it('keeps client shell free of fiscal identifiers and internal references', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const clientShell = await buildClientLegalCenterShellViewModel(provider, {
      profileId: 'LP-CLI-001',
      viewerProfileId: 'LP-CLI-001',
    });
    const clientHtml = renderLegalCenterShell(clientShell).outerHTML;
    expect(clientHtml).not.toContain('LDS-');
    expect(clientHtml).not.toContain('W9R-');
    expect(clientHtml).not.toContain('LDI-');
    expect(clientHtml).not.toContain('storageKey');
    expect(clientHtml).not.toContain('checksum');
  });
});
