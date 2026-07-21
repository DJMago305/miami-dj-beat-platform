/** @vitest-environment jsdom */

/** LC-7 — W-9 collection workflow tests */

import { describe, expect, it, beforeEach } from 'vitest';

import { LEGAL_TEMPLATE_ASSET_URLS } from '../../shared/services/legal/assets/legal-template-asset-urls';
import { createFixedLegalDocumentInstanceClock } from '../../shared/services/legal/domain';
import {
  createInMemoryLegalDocumentInstanceService,
} from '../../shared/services/legal/in-memory/in-memory-legal-document-instance-service';
import {
  createIsolatedLegalW9WorkflowService,
  type InMemoryLegalW9WorkflowService,
} from '../../shared/services/legal/in-memory/in-memory-legal-w9-workflow-service';
import { mapTemplateAssetToDownloadAction } from '../../shared/services/legal/provider/legal-template-asset-download-mapper';
import {
  buildArtistLegalCenterShellViewModel,
  buildClientLegalCenterShellViewModel,
  buildStaffLegalCenterShellViewModel,
  resolveLegalProvider,
} from '../../shared/services/legal/provider';
import { renderLegalCenterShell } from '../../shared/services/legal/ui';
import {
  canTransitionLegalW9RequestStatus,
  LEGAL_W9_TEMPLATE_ID,
  LEGAL_W9_TEMPLATE_VERSION_ID,
  resetSharedLegalW9WorkflowServiceForTests,
  type LegalWorkflowActor,
} from '../../shared/services/legal/workflows';

const FIXED_NOW = '2026-07-20T12:00:00.000Z';
const FIXED_DUE = '2026-07-25T12:00:00.000Z';
const FIXED_PAST_DUE = '2026-07-19T12:00:00.000Z';
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
const clientActor: LegalWorkflowActor = Object.freeze({
  portal: 'client',
  actorId: 'CLI-001',
});

function recipient(
  type: 'artist' | 'vendor' | 'company' | 'external' | 'client',
  id = `${type.toUpperCase()}-001`,
) {
  return Object.freeze({
    recipientType: type,
    recipientId: id,
    displayName: `Demo ${type}`,
    email: `${id.toLowerCase()}@example.test`,
  });
}

describe('LC-7 W-9 workflow — creation and permissions', () => {
  let service: InMemoryLegalW9WorkflowService;

  beforeEach(() => {
    service = createIsolatedLegalW9WorkflowService({ clock });
  });

  it('allows staff owner and manager to request W-9 for allowed recipients', () => {
    for (const actor of [ownerActor, managerActor]) {
      for (const type of ['artist', 'vendor', 'company', 'external'] as const) {
        const created = service.requestW9({
          actor,
          recipient: recipient(type, `${type}-${actor.actorId}`),
          requestedByDisplayName: 'Staff Demo',
        });
        expect(created.ok, `${actor.role} ${type}`).toBe(true);
        if (created.ok) {
          expect(created.value.templateId).toBe(LEGAL_W9_TEMPLATE_ID);
          expect(created.value.templateVersionId).toBe(LEGAL_W9_TEMPLATE_VERSION_ID);
          expect(created.value.status).toBe('requested');
        }
      }
    }
  });

  it('blocks seller, artist, and client from creating W-9 requests', () => {
    for (const actor of [sellerActor, artistActor, clientActor]) {
      const created = service.requestW9({
        actor,
        recipient: recipient('artist'),
        requestedByDisplayName: 'Blocked',
      });
      expect(created.ok).toBe(false);
      if (!created.ok) {
        expect(created.code).toBe('w9_actor_not_authorized');
      }
    }
  });

  it('rejects client recipients explicitly', () => {
    const created = service.requestW9({
      actor: ownerActor,
      recipient: recipient('client', 'CLI-004'),
      requestedByDisplayName: 'Staff Owner',
    });
    expect(created.ok).toBe(false);
    if (!created.ok) {
      expect(created.code).toBe('w9_recipient_not_allowed');
    }
  });
});

describe('LC-7 W-9 workflow — instance integration and IDs', () => {
  let service: InMemoryLegalW9WorkflowService;

  beforeEach(() => {
    service = createIsolatedLegalW9WorkflowService({ clock });
  });

  it('creates distinct W9R and LDI ids and syncs initial instance status to pending', () => {
    const instanceService = createInMemoryLegalDocumentInstanceService({ clock });
    const scopedService = createIsolatedLegalW9WorkflowService({ clock, instanceService });
    const created = scopedService.requestW9({
      actor: ownerActor,
      recipient: recipient('artist', 'ART-100'),
      requestedByDisplayName: 'Staff Owner',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    expect(created.value.id).toMatch(/^W9R-/);
    expect(created.value.documentInstanceId).toMatch(/^LDI-/);
    expect(created.value.id).not.toBe(created.value.documentInstanceId);

    const instance = instanceService.getInstanceById(created.value.documentInstanceId);
    expect(instance.ok && instance.value.status).toBe('pending');
  });

  it('rejects duplicate explicit W9R ids and active duplicate recipients', () => {
    const first = service.requestW9({
      actor: ownerActor,
      id: 'W9R-000010',
      recipient: recipient('vendor', 'VEN-008'),
      requestedByDisplayName: 'Staff Owner',
    });
    const duplicateId = service.requestW9({
      actor: ownerActor,
      id: 'W9R-000010',
      recipient: recipient('vendor', 'VEN-009'),
      requestedByDisplayName: 'Staff Owner',
    });
    expect(first.ok).toBe(true);
    expect(duplicateId.ok).toBe(false);
    if (!duplicateId.ok) {
      expect(duplicateId.code).toBe('w9_duplicate_request_id');
    }

    const activeDuplicate = service.requestW9({
      actor: ownerActor,
      recipient: recipient('vendor', 'VEN-008'),
      requestedByDisplayName: 'Staff Owner',
    });
    expect(activeDuplicate.ok).toBe(false);
    if (!activeDuplicate.ok) {
      expect(activeDuplicate.code).toBe('w9_active_request_exists');
    }
  });

  it('allows a new request after cancellation or expiration', () => {
    const created = service.requestW9({
      actor: ownerActor,
      recipient: recipient('company', 'CO-001'),
      requestedByDisplayName: 'Staff Owner',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    service.cancelW9Request(ownerActor, created.value.id);
    const second = service.requestW9({
      actor: ownerActor,
      recipient: recipient('company', 'CO-001'),
      requestedByDisplayName: 'Staff Owner',
    });
    expect(second.ok).toBe(true);

    const dueService = createIsolatedLegalW9WorkflowService({
      clock: createFixedLegalDocumentInstanceClock(FIXED_DUE),
    });
    const expirable = dueService.requestW9({
      actor: ownerActor,
      recipient: recipient('external', 'EXT-001'),
      requestedByDisplayName: 'Staff Owner',
      dueAt: FIXED_PAST_DUE,
    });
    expect(expirable.ok).toBe(true);
    if (expirable.ok) {
      dueService.makeW9Available(ownerActor, expirable.value.id);
      dueService.expireW9Request(ownerActor, expirable.value.id);
      const again = dueService.requestW9({
        actor: ownerActor,
        recipient: recipient('external', 'EXT-001'),
        requestedByDisplayName: 'Staff Owner',
      });
      expect(again.ok).toBe(true);
    }
  });
});

describe('LC-7 W-9 workflow — transitions and dates', () => {
  let service: InMemoryLegalW9WorkflowService;

  beforeEach(() => {
    service = createIsolatedLegalW9WorkflowService({ clock });
  });

  it('runs requested → available → viewed → awaiting_upload with synced instance statuses', () => {
    const instanceService = createInMemoryLegalDocumentInstanceService({ clock });
    const scopedService = createIsolatedLegalW9WorkflowService({ clock, instanceService });
    const created = scopedService.requestW9({
      actor: ownerActor,
      recipient: recipient('artist', 'ART-001'),
      requestedByDisplayName: 'Staff Owner',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const available = scopedService.makeW9Available(ownerActor, created.value.id);
    const viewed = scopedService.markW9Viewed(artistActor, created.value.id);
    const awaiting = scopedService.markAwaitingUpload(artistActor, created.value.id);

    expect(available.ok && available.value.status).toBe('available');
    expect(viewed.ok && viewed.value.status).toBe('viewed');
    expect(awaiting.ok && awaiting.value.status).toBe('awaiting_upload');

    const instance = instanceService.getInstanceById(created.value.documentInstanceId);
    expect(instance.ok && instance.value.status).toBe('viewed');
    expect(viewed.ok && viewed.value.viewedAt).toBe(FIXED_NOW);
  });

  it('supports idempotent viewed transitions', () => {
    const created = service.requestW9({
      actor: ownerActor,
      recipient: recipient('artist', 'ART-001'),
      requestedByDisplayName: 'Staff Owner',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    service.makeW9Available(ownerActor, created.value.id);
    service.markW9Viewed(artistActor, created.value.id);
    const again = service.markW9Viewed(artistActor, created.value.id);
    expect(again.ok).toBe(true);
  });

  it('rejects invalid workflow transitions and terminal mutations', () => {
    const created = service.requestW9({
      actor: ownerActor,
      recipient: recipient('artist', 'ART-001'),
      requestedByDisplayName: 'Staff Owner',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const invalid = service.markAwaitingUpload(artistActor, created.value.id);
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.code).toBe('w9_invalid_status_transition');
    }

    service.cancelW9Request(ownerActor, created.value.id);
    const afterCancel = service.makeW9Available(ownerActor, created.value.id);
    expect(afterCancel.ok).toBe(false);
    if (!afterCancel.ok) {
      expect(afterCancel.code).toBe('w9_request_already_terminal');
    }
  });

  it('validates dueAt and expiration timing', () => {
    const invalidDue = service.requestW9({
      actor: ownerActor,
      recipient: recipient('vendor', 'VEN-100'),
      requestedByDisplayName: 'Staff Owner',
      dueAt: 'not-a-date',
    });
    expect(invalidDue.ok).toBe(false);
    if (!invalidDue.ok) {
      expect(invalidDue.code).toBe('w9_invalid_due_at');
    }

    const created = service.requestW9({
      actor: ownerActor,
      recipient: recipient('vendor', 'VEN-101'),
      requestedByDisplayName: 'Staff Owner',
      dueAt: FIXED_DUE,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const early = service.expireW9Request(ownerActor, created.value.id);
    expect(early.ok).toBe(false);
    if (!early.ok) {
      expect(early.code).toBe('w9_expiration_not_due');
    }

    const dueClockService = createIsolatedLegalW9WorkflowService({
      clock: createFixedLegalDocumentInstanceClock(FIXED_DUE),
    });
    const dueCreated = dueClockService.requestW9({
      actor: ownerActor,
      recipient: recipient('vendor', 'VEN-102'),
      requestedByDisplayName: 'Staff Owner',
      dueAt: FIXED_DUE,
    });
    expect(dueCreated.ok).toBe(true);
    if (dueCreated.ok) {
      dueClockService.makeW9Available(ownerActor, dueCreated.value.id);
      const expired = dueClockService.expireW9Request(ownerActor, dueCreated.value.id);
      expect(expired.ok).toBe(true);
      if (expired.ok) {
        expect(expired.value.status).toBe('expired');
        expect(expired.value.updatedAt).toBe(FIXED_DUE);
      }
    }
  });
});

describe('LC-7 W-9 workflow — lists, immutability, and access control', () => {
  let service: InMemoryLegalW9WorkflowService;

  beforeEach(() => {
    service = createIsolatedLegalW9WorkflowService({ clock });
  });

  it('lists requests for authorized actors and scopes artist visibility', () => {
    service.requestW9({
      actor: ownerActor,
      recipient: recipient('artist', 'ART-001'),
      requestedByDisplayName: 'Staff Owner',
    });
    service.requestW9({
      actor: ownerActor,
      recipient: recipient('vendor', 'VEN-200'),
      requestedByDisplayName: 'Staff Owner',
    });

    const staffList = service.listW9Requests(ownerActor);
    expect(staffList.ok && staffList.value.length).toBe(2);

    const artistList = service.listW9Requests(artistActor);
    expect(artistList.ok && artistList.value.length).toBe(1);
    expect(artistList.ok && artistList.value[0]?.recipient.recipientId).toBe('ART-001');

    const sellerList = service.listW9Requests(sellerActor);
    expect(sellerList.ok).toBe(false);
    if (!sellerList.ok) {
      expect(sellerList.code).toBe('w9_actor_not_authorized');
    }

    const clientList = service.listW9Requests(clientActor);
    expect(clientList.ok).toBe(false);
  });

  it('filters by recipient and status', () => {
    const created = service.requestW9({
      actor: ownerActor,
      recipient: recipient('artist', 'ART-050'),
      requestedByDisplayName: 'Staff Owner',
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      service.makeW9Available(ownerActor, created.value.id);
    }

    const byRecipient = service.listW9RequestsByRecipient(ownerActor, 'artist', 'ART-050');
    expect(byRecipient.ok && byRecipient.value.length).toBe(1);

    const byStatus = service.listW9RequestsByStatus(ownerActor, 'available');
    expect(byStatus.ok && byStatus.value.length).toBe(1);
  });

  it('protects nested fields from external mutation', () => {
    const created = service.requestW9({
      actor: ownerActor,
      recipient: recipient('artist', 'ART-060'),
      requestedByDisplayName: 'Staff Owner',
      metadata: Object.freeze({ channel: 'lab' }),
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const fetched = service.getW9RequestById(ownerActor, created.value.id);
    expect(fetched.ok).toBe(true);
    if (!fetched.ok) {
      return;
    }

    expect(() => {
      (fetched.value.recipient as { displayName: string }).displayName = 'Hacked';
    }).toThrow();
    expect(() => {
      (fetched.value.requestedBy as { actorId: string }).actorId = 'HACKED';
    }).toThrow();
    expect(() => {
      (fetched.value.metadata as Record<string, string>).channel = 'mutated';
    }).toThrow();

    const again = service.getW9RequestById(ownerActor, created.value.id);
    expect(again.ok && again.value.recipient.displayName).toBe('Demo artist');
    expect(again.ok && again.value.requestedBy.actorId).toBe('STAFF-OWNER-001');
    expect(again.ok && again.value.metadata.channel).toBe('lab');
  });
});

describe('LC-7 W-9 workflow — transition matrix', () => {
  it('matches the approved operational matrix', () => {
    const matrix = {
      requested: ['available', 'cancelled', 'expired'],
      available: ['viewed', 'cancelled', 'expired'],
      viewed: ['awaiting_upload', 'cancelled', 'expired'],
      awaiting_upload: ['submitted', 'cancelled', 'expired'],
      expired: [],
      cancelled: [],
      submitted: ['accepted', 'rejected'],
      accepted: [],
      rejected: [],
    } as const;

    for (const [from, targets] of Object.entries(matrix)) {
      for (const to of Object.keys(matrix)) {
        const expected = (targets as readonly string[]).includes(to);
        expect(canTransitionLegalW9RequestStatus(from as keyof typeof matrix, to as keyof typeof matrix)).toBe(
          expected,
        );
      }
    }
  });
});

describe('LC-7 regression — LC-5/LC-6 and client fiscal isolation', () => {
  beforeEach(() => {
    resetSharedLegalW9WorkflowServiceForTests();
  });

  it('keeps LC-5 download resolver unchanged', () => {
    const staffAction = mapTemplateAssetToDownloadAction({
      portal: 'staff',
      templateCode: 'SPC-001',
      templateVersionId: 'TV-SPC-001-1',
      label: 'Download W-9',
    });
    expect(staffAction.availability).toBe('available');
    if (staffAction.availability === 'available') {
      expect(staffAction.url).toBe(
        LEGAL_TEMPLATE_ASSET_URLS['tax/SPC-001/TV-SPC-001-1/fw9-corporate'],
      );
    }
  });

  it('staff owner shell exposes W-9 collection without leaking to client', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const staffShell = await buildStaffLegalCenterShellViewModel(provider, { role: 'staff_owner' });
    const staffHtml = renderLegalCenterShell(staffShell).outerHTML;
    expect(staffHtml).toContain('W-9 Collection Requests');
    expect(staffHtml).toContain('Request W-9');

    const clientShell = await buildClientLegalCenterShellViewModel(provider, {
      profileId: 'LP-CLI-001',
      viewerProfileId: 'LP-CLI-001',
    });
    const clientHtml = renderLegalCenterShell(clientShell).outerHTML;
    expect(clientHtml).not.toContain('W-9 Collection Requests');
    expect(clientHtml).not.toContain('W9R-');
    expect(clientHtml).not.toContain('SPC-001');
    expect(clientHtml).not.toContain('fw9-corporate.pdf');
    expect(clientHtml).not.toContain(LEGAL_TEMPLATE_ASSET_URLS['tax/SPC-001/TV-SPC-001-1/fw9-corporate']);
  });

  it('artist shell shows assigned W-9 with download link', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const artistShell = await buildArtistLegalCenterShellViewModel(provider, {
      profileId: 'LP-ART-GREEN-001',
      viewerProfileId: 'LP-ART-GREEN-001',
    });
    const artistHtml = renderLegalCenterShell(artistShell).outerHTML;
    expect(artistHtml).toContain('Assigned W-9 Request');
    expect(artistHtml).toContain('Download W-9');
    expect(artistHtml).toContain('Submission pipeline ready');
  });

  it('staff seller shell omits W-9 collection section', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const sellerShell = await buildStaffLegalCenterShellViewModel(provider, { role: 'staff_seller' });
    const sellerHtml = renderLegalCenterShell(sellerShell).outerHTML;
    expect(sellerHtml).not.toContain('W-9 Collection Requests');
  });
});
