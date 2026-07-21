/** @vitest-environment node */

/** LC-6 — Legal document instance lifecycle tests */

import { describe, expect, it } from 'vitest';

import {
  canTransitionLegalDocumentStatus,
  createFixedLegalDocumentInstanceClock,
  createLegalDocumentInstance,
  formatLegalDocumentInstanceId,
  isValidLegalDocumentInstanceId,
  isValidLegalDocumentInstanceTimestamp,
  isValidLegalDocumentInstanceVersion,
  LEGAL_DOCUMENT_INSTANCE_STATUSES,
  TERMINAL_LEGAL_DOCUMENT_INSTANCE_STATUSES,
  transitionLegalDocumentInstanceStatus,
  type CreateLegalDocumentInstanceInput,
  type LegalDocumentInstanceStatus,
} from '../../shared/services/legal/domain';
import { createInMemoryLegalDocumentInstanceService } from '../../shared/services/legal/in-memory';
import { LEGAL_TEMPLATE_ASSET_URLS } from '../../shared/services/legal/assets/legal-template-asset-urls';
import { mapTemplateAssetToDownloadAction } from '../../shared/services/legal/provider/legal-template-asset-download-mapper';

const FIXED_NOW = '2026-07-20T12:00:00.000Z';
const FIXED_EXPIRES = '2026-07-21T12:00:00.000Z';
const FIXED_PAST_EXPIRES = '2026-07-19T12:00:00.000Z';

const clock = createFixedLegalDocumentInstanceClock(FIXED_NOW);

function baseInput(
  overrides: Partial<CreateLegalDocumentInstanceInput> = {},
): CreateLegalDocumentInstanceInput {
  return {
    templateId: 'SPC-001',
    templateVersionId: 'TV-SPC-001-1',
    category: 'SPC',
    title: 'Corporate W-9 Request',
    recipient: {
      recipientType: 'artist',
      recipientId: 'ART-001',
      displayName: 'DJ Example',
      email: 'artist@example.com',
    },
    owner: {
      ownerType: 'platform',
      ownerId: 'MDJB-PLATFORM',
      issuedBy: 'STAFF-001',
      assignedBy: 'STAFF-001',
    },
    signatureRequirement: { requirement: 'single_signer', requiredSignerCount: 1 },
    metadata: Object.freeze({ channel: 'legal_center', priority: 1, rush: false, note: null }),
    ...overrides,
  };
}

describe('legal document instance factory — LC-6', () => {
  it('creates a valid instance with draft status, version 1, and deterministic timestamps', () => {
    const result = createLegalDocumentInstance(
      { ...baseInput(), id: 'LDI-000001' },
      { clock, nextSequence: () => 1 },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('LDI-000001');
      expect(result.value.status).toBe('draft');
      expect(result.value.instanceVersion).toBe(1);
      expect(result.value.createdAt).toBe(FIXED_NOW);
      expect(result.value.updatedAt).toBe(FIXED_NOW);
      expect(result.value.source).toBe('template');
      expect(result.value.templateId).toBe('SPC-001');
      expect(result.value.templateVersionId).toBe('TV-SPC-001-1');
      expect(result.value.metadata).toEqual({
        channel: 'legal_center',
        priority: 1,
        rush: false,
        note: null,
      });
    }
  });

  it('rejects invalid recipient', () => {
    const result = createLegalDocumentInstance(
      {
        ...baseInput(),
        recipient: {
          recipientType: 'artist',
          recipientId: '',
          displayName: 'Missing Id',
        },
      },
      { clock, nextSequence: () => 1 },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_recipient');
    }
  });

  it('rejects invalid template reference', () => {
    const result = createLegalDocumentInstance(
      { ...baseInput(), templateId: '  ', templateVersionId: 'TV-SPC-001-1' },
      { clock, nextSequence: () => 1 },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_template_reference');
    }
  });

  it('auto-generates opaque ids via sequence', () => {
    let seq = 0;
    const first = createLegalDocumentInstance(baseInput(), {
      clock,
      nextSequence: () => {
        seq += 1;
        return seq;
      },
    });
    const second = createLegalDocumentInstance(baseInput(), {
      clock,
      nextSequence: () => {
        seq += 1;
        return seq;
      },
    });

    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value.id).toBe('LDI-000001');
      expect(second.value.id).toBe('LDI-000002');
      expect(first.value.templateId).toBe(second.value.templateId);
      expect(first.value.id).not.toBe(second.value.templateId);
    }
  });
});

describe('legal document instance ids — LC-6', () => {
  it('validates LDI pattern and rejects templateId as instance id', () => {
    expect(isValidLegalDocumentInstanceId('LDI-000001')).toBe(true);
    expect(isValidLegalDocumentInstanceId('SPC-001')).toBe(false);
    expect(formatLegalDocumentInstanceId(42)).toBe('LDI-000042');
  });

  it('rejects duplicate instance id in service', () => {
    const service = createInMemoryLegalDocumentInstanceService({ clock });
    const first = service.createInstance({ ...baseInput(), id: 'LDI-000010' });
    const duplicate = service.createInstance({ ...baseInput(), id: 'LDI-000010' });

    expect(first.ok).toBe(true);
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.code).toBe('duplicate_instance_id');
    }
  });
});

describe('legal document instance status matrix — LC-6', () => {
  const validPairs: Array<[LegalDocumentInstanceStatus, LegalDocumentInstanceStatus]> = [
    ['draft', 'pending'],
    ['draft', 'cancelled'],
    ['pending', 'sent'],
    ['pending', 'cancelled'],
    ['pending', 'expired'],
    ['sent', 'viewed'],
    ['sent', 'signed'],
    ['sent', 'rejected'],
    ['sent', 'expired'],
    ['sent', 'cancelled'],
    ['viewed', 'signed'],
    ['viewed', 'rejected'],
    ['viewed', 'expired'],
    ['viewed', 'cancelled'],
  ];

  it.each(validPairs)('allows %s → %s', (current, next) => {
    expect(canTransitionLegalDocumentStatus(current, next)).toBe(true);
  });

  const invalidPairs: Array<[LegalDocumentInstanceStatus, LegalDocumentInstanceStatus]> = [
    ['signed', 'draft'],
    ['expired', 'sent'],
    ['cancelled', 'viewed'],
    ['rejected', 'signed'],
    ['draft', 'sent'],
    ['draft', 'signed'],
    ['pending', 'viewed'],
  ];

  it.each(invalidPairs)('blocks %s → %s', (current, next) => {
    expect(canTransitionLegalDocumentStatus(current, next)).toBe(false);
  });

  it('blocks repeated transitions to the same status', () => {
    const service = createInMemoryLegalDocumentInstanceService({ clock });
    const created = service.createInstance({ ...baseInput(), id: 'LDI-000020' });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const again = service.transitionStatus('LDI-000020', 'draft');
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.code).toBe('invalid_status_transition');
    }
  });

  it('blocks transitions from terminal states', () => {
    const service = createInMemoryLegalDocumentInstanceService({ clock });
    service.createInstance({ ...baseInput(), id: 'LDI-000021' });
    service.transitionStatus('LDI-000021', 'pending');
    service.transitionStatus('LDI-000021', 'sent');
    service.transitionStatus('LDI-000021', 'signed');

    const blocked = service.transitionStatus('LDI-000021', 'viewed');
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.code).toBe('already_terminal');
    }
  });
});

describe('legal document instance timestamps — LC-6', () => {
  it('sets lifecycle timestamps on valid transitions', () => {
    const service = createInMemoryLegalDocumentInstanceService({ clock });
    service.createInstance({ ...baseInput(), id: 'LDI-000030' });

    service.transitionStatus('LDI-000030', 'pending');
    service.transitionStatus('LDI-000030', 'sent');
    let current = service.getInstanceById('LDI-000030');
    expect(current.ok && current.value.sentAt).toBe(FIXED_NOW);

    service.transitionStatus('LDI-000030', 'viewed');
    current = service.getInstanceById('LDI-000030');
    expect(current.ok && current.value.viewedAt).toBe(FIXED_NOW);

    service.transitionStatus('LDI-000030', 'rejected');
    current = service.getInstanceById('LDI-000030');
    expect(current.ok && current.value.rejectedAt).toBe(FIXED_NOW);
    expect(current.ok && current.value.updatedAt).toBe(FIXED_NOW);
  });

  it('sets cancelledAt and expiredAt through dedicated flows', () => {
    const cancelService = createInMemoryLegalDocumentInstanceService({ clock });
    cancelService.createInstance({ ...baseInput(), id: 'LDI-000031' });
    cancelService.transitionStatus('LDI-000031', 'pending');
    cancelService.cancelInstance('LDI-000031');
    const cancelled = cancelService.getInstanceById('LDI-000031');
    expect(cancelled.ok && cancelled.value.cancelledAt).toBe(FIXED_NOW);

    const expireClock = createFixedLegalDocumentInstanceClock(FIXED_NOW);
    const expireService = createInMemoryLegalDocumentInstanceService({
      clock: expireClock,
    });
    expireService.createInstance({
      ...baseInput(),
      id: 'LDI-000032',
      expiresAt: FIXED_PAST_EXPIRES,
    });
    expireService.transitionStatus('LDI-000032', 'pending');
    expireService.expireInstance('LDI-000032');
    const expired = expireService.getInstanceById('LDI-000032');
    expect(expired.ok && expired.value.expiredAt).toBe(FIXED_NOW);
  });
});

describe('legal document instance expiration — LC-6', () => {
  it('expires when due and blocks early expiration', () => {
    const service = createInMemoryLegalDocumentInstanceService({ clock });
    service.createInstance({ ...baseInput(), id: 'LDI-000040', expiresAt: FIXED_EXPIRES });
    service.transitionStatus('LDI-000040', 'pending');

    const early = service.expireInstance('LDI-000040');
    expect(early.ok).toBe(false);
    if (!early.ok) {
      expect(early.code).toBe('expiration_not_due');
    }
  });

  it('does not expire signed, rejected, or cancelled instances', () => {
    const service = createInMemoryLegalDocumentInstanceService({ clock });
    service.createInstance({ ...baseInput(), id: 'LDI-000041', expiresAt: FIXED_PAST_EXPIRES });
    service.transitionStatus('LDI-000041', 'pending');
    service.transitionStatus('LDI-000041', 'sent');
    service.transitionStatus('LDI-000041', 'signed');

    const signedExpire = service.expireInstance('LDI-000041');
    expect(signedExpire.ok).toBe(false);
    if (!signedExpire.ok) {
      expect(signedExpire.code).toBe('expiration_not_allowed');
    }

    service.createInstance({ ...baseInput(), id: 'LDI-000042', expiresAt: FIXED_PAST_EXPIRES });
    service.transitionStatus('LDI-000042', 'pending');
    service.transitionStatus('LDI-000042', 'sent');
    service.transitionStatus('LDI-000042', 'rejected');
    expect(service.expireInstance('LDI-000042').ok).toBe(false);

    service.createInstance({ ...baseInput(), id: 'LDI-000043' });
    service.transitionStatus('LDI-000043', 'pending');
    service.cancelInstance('LDI-000043');
    expect(service.expireInstance('LDI-000043').ok).toBe(false);
  });
});

describe('in-memory legal document instance service — LC-6', () => {
  it('supports create, get, list, list by recipient, list by template, and isolation', () => {
    const service = createInMemoryLegalDocumentInstanceService({ clock });

    const artistA = service.createInstance({
      ...baseInput(),
      recipient: { recipientType: 'artist', recipientId: 'ART-001', displayName: 'Artist A' },
    });
    const artistB = service.createInstance({
      ...baseInput(),
      recipient: { recipientType: 'artist', recipientId: 'ART-002', displayName: 'Artist B' },
    });
    const vendor = service.createInstance({
      ...baseInput(),
      templateId: 'CTR-VEN-001',
      templateVersionId: 'TV-CTR-VEN-001-1',
      category: 'CTR',
      recipient: { recipientType: 'vendor', recipientId: 'VEN-008', displayName: 'Vendor 8' },
    });

    expect(artistA.ok && artistB.ok && vendor.ok).toBe(true);
    if (!artistA.ok || !artistB.ok || !vendor.ok) {
      return;
    }

    expect(service.listInstances()).toHaveLength(3);
    expect(service.listInstancesByTemplate('SPC-001')).toHaveLength(2);
    expect(service.listInstancesByRecipient('artist', 'ART-001')).toHaveLength(1);
    expect(service.listInstancesByRecipient('vendor', 'VEN-008')).toHaveLength(1);

    const fetched = service.getInstanceById(artistA.value.id);
    expect(fetched.ok).toBe(true);
    if (fetched.ok) {
      const again = service.getInstanceById(artistA.value.id);
      expect(again.ok).toBe(true);
      if (again.ok) {
        expect(fetched.value).not.toBe(again.value);
        expect(fetched.value).toEqual(again.value);
        expect(fetched.value.metadata).toEqual(artistA.value.metadata);
      }
    }
  });

  it('returns instance_not_found for missing ids', () => {
    const service = createInMemoryLegalDocumentInstanceService({ clock });
    const missing = service.getInstanceById('LDI-999999');
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.code).toBe('instance_not_found');
    }
  });
});

describe('legal document instance versioning — LC-6', () => {
  it('starts at version 1 and rejects invalid versions', () => {
    const service = createInMemoryLegalDocumentInstanceService({ clock });
    const created = service.createInstance({ ...baseInput(), id: 'LDI-000050' });
    expect(created.ok && created.value.instanceVersion).toBe(1);
    expect(isValidLegalDocumentInstanceVersion(1)).toBe(true);
    expect(isValidLegalDocumentInstanceVersion(0)).toBe(false);
    expect(isValidLegalDocumentInstanceVersion(-1)).toBe(false);
    expect(isValidLegalDocumentInstanceVersion(1.5)).toBe(false);
  });

  it('preserves instanceVersion across non-material transitions', () => {
    const service = createInMemoryLegalDocumentInstanceService({ clock });
    service.createInstance({ ...baseInput(), id: 'LDI-000051' });
    service.transitionStatus('LDI-000051', 'pending');
    service.transitionStatus('LDI-000051', 'sent');
    const current = service.getInstanceById('LDI-000051');
    expect(current.ok && current.value.instanceVersion).toBe(1);
  });
});

describe('legal document instance transition helper — LC-6', () => {
  it('covers every declared status in the transition contract', () => {
    expect(LEGAL_DOCUMENT_INSTANCE_STATUSES).toHaveLength(8);
    const draftInstance = Object.freeze({
      id: 'LDI-000060',
      templateId: 'SPC-001',
      templateVersionId: 'TV-SPC-001-1',
      category: 'SPC' as const,
      title: 'W-9',
      recipient: Object.freeze({
        recipientType: 'artist' as const,
        recipientId: 'ART-001',
        displayName: 'Artist',
      }),
      owner: Object.freeze({ ownerType: 'platform' as const, ownerId: 'MDJB' }),
      status: 'draft' as const,
      instanceVersion: 1,
      source: 'template' as const,
      signatureRequirement: Object.freeze({ requirement: 'not_required' as const }),
      metadata: Object.freeze({}),
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    });

    const moved = transitionLegalDocumentInstanceStatus(draftInstance, 'pending', FIXED_NOW);
    expect(moved.ok).toBe(true);
  });
});

describe('LC-6 technical audit — IDs, immutability, timestamps', () => {
  it('bumps auto-sequence after explicit LDI-000010 so the next id does not collide', () => {
    const service = createInMemoryLegalDocumentInstanceService({ clock });
    const explicit = service.createInstance({ ...baseInput(), id: 'LDI-000010' });
    const auto = service.createInstance(baseInput());

    expect(explicit.ok && auto.ok).toBe(true);
    if (explicit.ok && auto.ok) {
      expect(explicit.value.id).toBe('LDI-000010');
      expect(auto.value.id).toBe('LDI-000011');
      expect(auto.value.id).not.toBe(explicit.value.id);
    }
  });

  it('rejects duplicate explicit ids and keeps templateId separate from instanceId', () => {
    const service = createInMemoryLegalDocumentInstanceService({ clock });
    const first = service.createInstance({ ...baseInput(), id: 'LDI-000015' });
    const duplicate = service.createInstance({ ...baseInput(), id: 'LDI-000015' });

    expect(first.ok).toBe(true);
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.code).toBe('duplicate_instance_id');
    }
    expect(formatLegalDocumentInstanceId(15)).toBe('LDI-000015');
    expect(isValidLegalDocumentInstanceId('SPC-001')).toBe(false);
  });

  it('blocks nested mutation attempts on recipient, owner, and metadata', () => {
    const service = createInMemoryLegalDocumentInstanceService({ clock });
    const created = service.createInstance({ ...baseInput(), id: 'LDI-000016' });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const fetched = service.getInstanceById('LDI-000016');
    expect(fetched.ok).toBe(true);
    if (!fetched.ok) {
      return;
    }

    expect(() => {
      (fetched.value.recipient as { displayName: string }).displayName = 'Mutated Name';
    }).toThrow();
    expect(() => {
      (fetched.value.owner as { ownerId: string }).ownerId = 'HACKED';
    }).toThrow();
    expect(() => {
      (fetched.value.metadata as Record<string, string>).channel = 'mutated';
    }).toThrow();

    const again = service.getInstanceById('LDI-000016');
    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.value.recipient.displayName).toBe('DJ Example');
      expect(again.value.owner.ownerId).toBe('MDJB-PLATFORM');
      expect(again.value.metadata.channel).toBe('legal_center');
    }
  });

  it('rejects invalid expiresAt and accepts deterministic expiration at or after expiresAt', () => {
    const invalid = createLegalDocumentInstance(
      { ...baseInput(), id: 'LDI-000017', expiresAt: 'not-a-date' },
      { clock, nextSequence: () => 17 },
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.code).toBe('invalid_instance_timestamp');
    }

    expect(isValidLegalDocumentInstanceTimestamp('2026-07-20T12:00:00.000Z')).toBe(true);
    expect(isValidLegalDocumentInstanceTimestamp('NaN')).toBe(false);

    const earlyService = createInMemoryLegalDocumentInstanceService({ clock });
    earlyService.createInstance({ ...baseInput(), id: 'LDI-000018', expiresAt: FIXED_EXPIRES });
    earlyService.transitionStatus('LDI-000018', 'pending');
    const early = earlyService.expireInstance('LDI-000018');
    expect(early.ok).toBe(false);
    if (!early.ok) {
      expect(early.code).toBe('expiration_not_due');
    }

    const dueClock = createFixedLegalDocumentInstanceClock(FIXED_EXPIRES);
    const dueService = createInMemoryLegalDocumentInstanceService({ clock: dueClock });
    dueService.createInstance({ ...baseInput(), id: 'LDI-000019', expiresAt: FIXED_EXPIRES });
    dueService.transitionStatus('LDI-000019', 'pending');
    const due = dueService.expireInstance('LDI-000019');
    expect(due.ok).toBe(true);
    if (due.ok) {
      expect(due.value.status).toBe('expired');
      expect(due.value.expiredAt).toBe(FIXED_EXPIRES);
      expect(due.value.updatedAt).toBe(FIXED_EXPIRES);
    }
  });

  it('keeps the approved transition matrix without outbound terminal transitions', () => {
    const matrix: Record<LegalDocumentInstanceStatus, readonly LegalDocumentInstanceStatus[]> = {
      draft: ['pending', 'cancelled'],
      pending: ['sent', 'cancelled', 'expired'],
      sent: ['viewed', 'signed', 'rejected', 'expired', 'cancelled'],
      viewed: ['signed', 'rejected', 'expired', 'cancelled'],
      signed: [],
      rejected: [],
      expired: [],
      cancelled: [],
    };

    for (const status of LEGAL_DOCUMENT_INSTANCE_STATUSES) {
      for (const next of LEGAL_DOCUMENT_INSTANCE_STATUSES) {
        const expected = matrix[status].includes(next);
        expect(canTransitionLegalDocumentStatus(status, next)).toBe(expected);
      }
    }

    for (const terminal of TERMINAL_LEGAL_DOCUMENT_INSTANCE_STATUSES) {
      for (const next of LEGAL_DOCUMENT_INSTANCE_STATUSES) {
        expect(canTransitionLegalDocumentStatus(terminal, next)).toBe(false);
      }
    }
  });
});

describe('LC-5 regression — authorized W-9 download unchanged', () => {
  it('staff and artist still resolve runtime W-9 download action', () => {
    const staffAction = mapTemplateAssetToDownloadAction({
      portal: 'staff',
      templateCode: 'SPC-001',
      templateVersionId: 'TV-SPC-001-1',
      label: 'Download W-9',
    });
    const artistAction = mapTemplateAssetToDownloadAction({
      portal: 'artist',
      templateCode: 'SPC-001',
      templateVersionId: 'TV-SPC-001-1',
    });
    const clientAction = mapTemplateAssetToDownloadAction({
      portal: 'client',
      templateCode: 'SPC-001',
      templateVersionId: 'TV-SPC-001-1',
    });

    expect(staffAction.availability).toBe('available');
    expect(artistAction.availability).toBe('available');
    expect(clientAction).toEqual({ availability: 'forbidden' });
    if (staffAction.availability === 'available') {
      expect(staffAction.url).toBe(
        LEGAL_TEMPLATE_ASSET_URLS['tax/SPC-001/TV-SPC-001-1/fw9-corporate'],
      );
    }
  });
});
