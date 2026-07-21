/** @vitest-environment jsdom */

/** LC-8 — W-9 submission and storage port tests */

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
  buildArtistLegalCenterShellViewModel,
  buildStaffLegalCenterShellViewModel,
  resolveLegalProvider,
} from '../../shared/services/legal/provider';
import { renderLegalCenterShell } from '../../shared/services/legal/ui';
import {
  canTransitionSubmissionStatus,
  createLegalDocumentSubmission,
  LEGAL_DOCUMENT_SUBMISSION_MAX_BYTES,
  transitionSubmissionStatus,
} from '../../shared/services/legal/submissions';
import {
  canTransitionLegalW9RequestStatus,
  LEGAL_W9_TEMPLATE_ID,
  LEGAL_W9_TEMPLATE_VERSION_ID,
  resetSharedLegalW9WorkflowServiceForTests,
  type LegalWorkflowActor,
} from '../../shared/services/legal/workflows';

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
const artistActor: LegalWorkflowActor = Object.freeze({
  portal: 'artist',
  actorId: 'ART-001',
});

const fixtureSubmittedBy = Object.freeze({
  actorId: 'ART-001',
  displayName: 'Demo Artist',
  portal: 'artist' as const,
});

function recipient(id = 'ART-001') {
  return Object.freeze({
    recipientType: 'artist' as const,
    recipientId: id,
    displayName: 'Demo Artist',
    email: 'demo-artist@example.test',
  });
}

function validSubmissionInput(documentInstanceId: string, workflowId?: string) {
  return Object.freeze({
    documentInstanceId,
    workflowId,
    templateId: LEGAL_W9_TEMPLATE_ID,
    templateVersionId: LEGAL_W9_TEMPLATE_VERSION_ID,
    filename: 'w9-demo.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    checksum: 'sha256:demo-checksum-001',
    contentReference: 'in-memory://w9/demo/001',
    submittedBy: fixtureSubmittedBy,
  });
}

async function seedAwaitingUpload(service: InMemoryLegalW9WorkflowService, artistId = 'ART-001') {
  const created = service.requestW9({
    actor: ownerActor,
    recipient: recipient(artistId),
    requestedByDisplayName: 'Staff Owner',
  });
  expect(created.ok).toBe(true);
  if (!created.ok) {
    throw new Error('seed failed');
  }
  service.makeW9Available(ownerActor, created.value.id);
  service.markW9Viewed(Object.freeze({ portal: 'artist', actorId: artistId }), created.value.id);
  service.markAwaitingUpload(Object.freeze({ portal: 'artist', actorId: artistId }), created.value.id);
  return created.value;
}

describe('LC-8 submission model — creation and IDs', () => {
  it('creates LDS ids and metadata-only stored assets', () => {
    let sequence = 0;
    const created = createLegalDocumentSubmission(validSubmissionInput('LDI-000001', 'W9R-000001'), {
      clock,
      nextSequence: () => {
        sequence += 1;
        return sequence;
      },
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.value.id).toMatch(/^LDS-/);
    expect(created.value.storageKey).toContain('LDI-000001');
    expect(created.value.status).toBe('uploaded');
    expect(created.value.contentReference).toBe('in-memory://w9/demo/001');
    expect(created.value).not.toHaveProperty('blob');
  });
});

describe('LC-8 submission validations', () => {
  it('rejects invalid mime types, oversize files, filenames, and checksums', () => {
    const base = validSubmissionInput('LDI-000002');
    const storage = createInMemoryLegalDocumentStorage({ clock });

    expect(storage.storeSubmission({ ...base, mimeType: 'image/png' }).ok).toBe(false);
    expect(storage.storeSubmission({ ...base, mimeType: 'video/mp4' }).ok).toBe(false);
    expect(
      storage.storeSubmission({ ...base, sizeBytes: LEGAL_DOCUMENT_SUBMISSION_MAX_BYTES + 1 }).ok,
    ).toBe(false);
    expect(storage.storeSubmission({ ...base, filename: '../w9.pdf' }).ok).toBe(false);
    expect(storage.storeSubmission({ ...base, checksum: 'short' }).ok).toBe(false);
    expect(
      storage.storeSubmission({ ...base, contentReference: 'https://evil.example/w9.pdf' }).ok,
    ).toBe(false);
  });
});

describe('LC-8 in-memory storage port', () => {
  let storage: ReturnType<typeof createInMemoryLegalDocumentStorage>;

  beforeEach(() => {
    storage = createInMemoryLegalDocumentStorage({ clock });
  });

  it('supports store, get, list, replace, delete, and exists', () => {
    const stored = storage.storeSubmission(validSubmissionInput('LDI-000010', 'W9R-000010'));
    expect(stored.ok).toBe(true);
    if (!stored.ok) {
      return;
    }

    expect(storage.exists(stored.value.id)).toBe(true);
    const fetched = storage.getSubmission(stored.value.id);
    expect(fetched.ok && fetched.value.filename).toBe('w9-demo.pdf');

    const byInstance = storage.listSubmissionsByInstance('LDI-000010');
    expect(byInstance.length).toBe(1);
    const byWorkflow = storage.listSubmissionsByWorkflow('W9R-000010');
    expect(byWorkflow.length).toBe(1);
    expect(storage.listSubmissions().length).toBe(1);

    const replaced = storage.replaceSubmission(stored.value.id, {
      ...validSubmissionInput('LDI-000010', 'W9R-000010'),
      filename: 'w9-replaced.pdf',
      checksum: 'sha256:demo-checksum-002',
      contentReference: 'in-memory://w9/demo/002',
    });
    expect(replaced.ok).toBe(true);
    if (!replaced.ok) {
      return;
    }
    expect(replaced.value.id).not.toBe(stored.value.id);
    expect(replaced.value.filename).toBe('w9-replaced.pdf');
    expect(storage.listSubmissions().length).toBe(1);

    const superseded = storage.getSubmission(stored.value.id);
    expect(superseded.ok && superseded.value.status).toBe('deleted');

    const deleted = storage.deleteSubmission(replaced.value.id);
    expect(deleted.ok && deleted.value.status).toBe('deleted');
  });
});

describe('LC-8 submission status transitions', () => {
  it('allows uploaded → under_review → accepted/rejected and blocks terminal regressions', () => {
    const storage = createInMemoryLegalDocumentStorage({ clock });
    const stored = storage.storeSubmission(validSubmissionInput('LDI-000020', 'W9R-000020'));
    expect(stored.ok).toBe(true);
    if (!stored.ok) {
      return;
    }

    const underReview = storage.transitionSubmission(stored.value.id, 'under_review');
    expect(underReview.ok && underReview.value.status).toBe('under_review');

    const accepted = storage.transitionSubmission(stored.value.id, 'accepted');
    expect(accepted.ok && accepted.value.status).toBe('accepted');

    const invalid = storage.transitionSubmission(stored.value.id, 'uploaded');
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.code).toBe('submission_already_terminal');
    }
  });

  it('matches the submission transition matrix', () => {
    const matrix = {
      pending_upload: ['uploaded', 'deleted'],
      uploaded: ['under_review', 'deleted'],
      under_review: ['accepted', 'rejected', 'deleted'],
      accepted: [],
      rejected: [],
      deleted: [],
    } as const;

    for (const [from, targets] of Object.entries(matrix)) {
      for (const to of Object.keys(matrix)) {
        const expected = (targets as readonly string[]).includes(to);
        expect(canTransitionSubmissionStatus(from as keyof typeof matrix, to as keyof typeof matrix)).toBe(
          expected,
        );
      }
    }
  });
});

describe('LC-8 submission immutability', () => {
  it('freezes submittedBy, metadata, checksum, and storageKey', () => {
    const storage = createInMemoryLegalDocumentStorage({ clock });
    const stored = storage.storeSubmission(validSubmissionInput('LDI-000030', 'W9R-000030'));
    expect(stored.ok).toBe(true);
    if (!stored.ok) {
      return;
    }

    expect(() => {
      (stored.value as { checksum: string }).checksum = 'mutated';
    }).toThrow();
    expect(() => {
      (stored.value as { storageKey: string }).storageKey = 'mutated';
    }).toThrow();
    expect(() => {
      (stored.value.submittedBy as { actorId: string }).actorId = 'HACKED';
    }).toThrow();
    expect(() => {
      (stored.value.metadata as Record<string, string>).channel = 'mutated';
    }).toThrow();
  });
});

describe('LC-8 W-9 workflow integration', () => {
  let service: InMemoryLegalW9WorkflowService;

  beforeEach(() => {
    service = createIsolatedLegalW9WorkflowService({ clock });
  });

  it('runs awaiting_upload → submitted → under_review → accepted with synced instance', async () => {
    const instanceService = createInMemoryLegalDocumentInstanceService({ clock });
    const scoped = createIsolatedLegalW9WorkflowService({ clock, instanceService });
    const request = await seedAwaitingUpload(scoped);

    const submitted = scoped.submitW9Document({
      actor: artistActor,
      workflowId: request.id,
      filename: 'w9-demo.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      checksum: 'sha256:demo-checksum-w9',
      contentReference: 'in-memory://w9/demo/submit-001',
      submittedByDisplayName: 'Demo Artist',
    });
    expect(submitted.ok && submitted.value.status).toBe('submitted');
    expect(submitted.ok && submitted.value.submissionId).toMatch(/^LDS-/);

    const underReview = scoped.markSubmissionUnderReview(ownerActor, request.id);
    expect(underReview.ok && underReview.value.status).toBe('under_review');

    const accepted = scoped.acceptSubmission(ownerActor, request.id);
    expect(accepted.ok && accepted.value.status).toBe('accepted');

    const instance = instanceService.getInstanceById(request.documentInstanceId);
    expect(instance.ok && instance.value.status).toBe('signed');
  });

  it('supports rejection and blocks invalid workflow transitions', async () => {
    const request = await seedAwaitingUpload(service);
    service.submitW9Document({
      actor: artistActor,
      workflowId: request.id,
      filename: 'w9-demo.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      checksum: 'sha256:demo-checksum-w9',
      contentReference: 'in-memory://w9/demo/submit-002',
      submittedByDisplayName: 'Demo Artist',
    });
    service.markSubmissionUnderReview(managerActor, request.id);
    const rejected = service.rejectSubmission(managerActor, request.id);
    expect(rejected.ok && rejected.value.status).toBe('rejected');

    const invalid = service.acceptSubmission(ownerActor, request.id);
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.code).toBe('w9_request_already_terminal');
    }
  });

  it('extends LC-7 workflow transitions without breaking the operational matrix', () => {
    expect(canTransitionLegalW9RequestStatus('awaiting_upload', 'submitted')).toBe(true);
    expect(canTransitionLegalW9RequestStatus('submitted', 'accepted')).toBe(true);
    expect(canTransitionLegalW9RequestStatus('submitted', 'rejected')).toBe(true);
    expect(canTransitionLegalW9RequestStatus('accepted', 'submitted')).toBe(false);
    expect(canTransitionLegalW9RequestStatus('rejected', 'submitted')).toBe(false);
  });
});

describe('LC-8 submission permissions', () => {
  let service: InMemoryLegalW9WorkflowService;

  beforeEach(() => {
    service = createIsolatedLegalW9WorkflowService({ clock });
  });

  it('allows artist self-submit and blocks staff/client/seller paths', async () => {
    const request = await seedAwaitingUpload(service);

    const blockedStaff = service.submitW9Document({
      actor: ownerActor,
      workflowId: request.id,
      filename: 'w9-demo.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      checksum: 'sha256:demo-checksum-w9',
      contentReference: 'in-memory://w9/demo/submit-003',
      submittedByDisplayName: 'Staff Owner',
    });
    expect(blockedStaff.ok).toBe(false);

    const submitted = service.submitW9Document({
      actor: artistActor,
      workflowId: request.id,
      filename: 'w9-demo.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      checksum: 'sha256:demo-checksum-w9',
      contentReference: 'in-memory://w9/demo/submit-004',
      submittedByDisplayName: 'Demo Artist',
    });
    expect(submitted.ok).toBe(true);

    const sellerPreview = service.getW9SubmissionPublicView(sellerActor, request.id);
    expect(sellerPreview.ok).toBe(false);

    const ownerPreview = service.getW9SubmissionPublicView(ownerActor, request.id);
    expect(ownerPreview.ok && ownerPreview.value?.statusLabel).toBe('Uploaded');
    expect(JSON.stringify(ownerPreview)).not.toContain('storageKey');
    expect(JSON.stringify(ownerPreview)).not.toContain('sha256:demo-checksum-w9');
  });

  it('allows owner delete and blocks manager delete', async () => {
    const request = await seedAwaitingUpload(service);
    service.submitW9Document({
      actor: artistActor,
      workflowId: request.id,
      filename: 'w9-demo.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      checksum: 'sha256:demo-checksum-w9',
      contentReference: 'in-memory://w9/demo/submit-005',
      submittedByDisplayName: 'Demo Artist',
    });

    const managerDelete = service.deleteW9Submission(managerActor, request.id);
    expect(managerDelete.ok).toBe(false);

    const ownerDelete = service.deleteW9Submission(ownerActor, request.id);
    expect(ownerDelete.ok && ownerDelete.value.status).toBe('deleted');
  });
});

describe('LC-8 UI placeholders and LC-5/LC-6/LC-7 regression', () => {
  beforeEach(() => {
    resetSharedLegalW9WorkflowServiceForTests();
  });

  it('staff shell shows submission status preview without internal storage fields', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const staffShell = await buildStaffLegalCenterShellViewModel(provider, { role: 'staff_owner' });
    const staffHtml = renderLegalCenterShell(staffShell).outerHTML;
    expect(staffHtml).toContain('Submission status:');
    expect(staffHtml).not.toContain('storageKey');
    expect(staffHtml).not.toContain('checksum');
  });

  it('artist shell shows submission pipeline ready placeholder', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const artistShell = await buildArtistLegalCenterShellViewModel(provider, {
      profileId: 'LP-ART-GREEN-001',
      viewerProfileId: 'LP-ART-GREEN-001',
    });
    const artistHtml = renderLegalCenterShell(artistShell).outerHTML;
    expect(artistHtml).toContain('Submission pipeline ready');
    expect(artistHtml).not.toContain('storageKey');
  });

  it('keeps direct submission transition helper behavior', () => {
    const storage = createInMemoryLegalDocumentStorage({ clock });
    const stored = storage.storeSubmission(validSubmissionInput('LDI-000040', 'W9R-000040'));
    expect(stored.ok).toBe(true);
    if (!stored.ok) {
      return;
    }
    const moved = transitionSubmissionStatus(stored.value, 'under_review', FIXED_NOW);
    expect(moved.ok && moved.value.status).toBe('under_review');
  });
});
