/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import {
  LegalContractError,
  assertAuditPayloadSafe,
  isPublicLegalLibraryDocument,
} from '../../shared/services/legal/contracts';
import {
  LEGAL_FIXTURE_EXPEDIENTE,
  LEGAL_FIXTURE_INTRODUCTION_IDS,
  LEGAL_FIXTURE_PACKAGE_IDS,
  LEGAL_FIXTURE_PROFILE_IDS,
  collectFixtureSeedPayloadForSecretScan,
  createInMemoryLegalService,
  createSeededInMemoryLegalStore,
} from '../../shared/services/legal/in-memory';

describe('legal in-memory service — TICKET-V2-LEGAL-IN-MEMORY-SERVICE-001', () => {
  it('1) loads fixtures deterministically with stable profile ids', () => {
    const storeA = createSeededInMemoryLegalStore();
    const storeB = createSeededInMemoryLegalStore();

    expect([...storeA.getSnapshot().profiles.keys()].sort()).toEqual(
      [...storeB.getSnapshot().profiles.keys()].sort(),
    );
    expect(LEGAL_FIXTURE_EXPEDIENTE.artistGreen).toBe('LP-ART-GREEN-001');
    expect(LEGAL_FIXTURE_EXPEDIENTE.providerRed).toBe('LP-PRO-RED-001');
  });

  it('2) queries expediente snapshot by profile id', async () => {
    const legal = createInMemoryLegalService();
    const result = await legal.profile.getExpedienteSnapshot(LEGAL_FIXTURE_PROFILE_IDS.artistGreen);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.version).toBe(1);
      expect(result.snapshot.profile.legalName).toBe('Gerardo A Valle');
    }
  });

  it('3) DJ GREEN resolves GREEN with resolver', () => {
    const legal = createInMemoryLegalService();
    const resolution = legal.resolveLegalStatusForProfile(LEGAL_FIXTURE_PROFILE_IDS.artistGreen);
    expect(resolution?.status).toBe('GREEN');
    expect(resolution?.reasons.every((reason) => !reason.blocking)).toBe(true);
  });

  it('4) Artist YELLOW resolves YELLOW', () => {
    const legal = createInMemoryLegalService();
    const resolution = legal.resolveLegalStatusForProfile(LEGAL_FIXTURE_PROFILE_IDS.artistYellow);
    expect(resolution?.status).toBe('YELLOW');
    expect(resolution?.reasons.some((reason) => !reason.blocking)).toBe(true);
  });

  it('5) Provider RED resolves RED with blocking reasons', () => {
    const legal = createInMemoryLegalService();
    const resolution = legal.resolveLegalStatusForProfile(LEGAL_FIXTURE_PROFILE_IDS.providerRed);
    expect(resolution?.status).toBe('RED');
    expect(resolution?.reasons.some((reason) => reason.blocking)).toBe(true);
    expect(resolution?.restrictions).toContain('no_matching');
    expect(resolution?.restrictions).toContain('no_payout');
  });

  it('6) staff seller projection does not receive W-9 tax center', async () => {
    const legal = createInMemoryLegalService();
    const view = legal.projectExpedienteForViewer(LEGAL_FIXTURE_PROFILE_IDS.artistGreen, {
      role: 'staff_seller',
      subjectProfileId: LEGAL_FIXTURE_PROFILE_IDS.artistGreen,
    });
    expect(view?.taxCenter).toBeUndefined();
    const rawTax = await legal.tax.getTaxCenterView(LEGAL_FIXTURE_PROFILE_IDS.artistGreen);
    expect(rawTax?.w9Status).toBe('approved');
  });

  it('7) client projection does not receive tax center', async () => {
    const legal = createInMemoryLegalService();
    const view = legal.projectExpedienteForViewer(LEGAL_FIXTURE_PROFILE_IDS.client, {
      role: 'client',
      viewerProfileId: LEGAL_FIXTURE_PROFILE_IDS.client,
      subjectProfileId: LEGAL_FIXTURE_PROFILE_IDS.client,
    });
    expect(view?.taxCenter).toBeUndefined();
    expect(view?.complianceCenter).toBeUndefined();
    const clientProfile = legal.getProfileById(LEGAL_FIXTURE_PROFILE_IDS.client);
    expect(clientProfile?.taxProfileId).toBeUndefined();
  });

  it('8) W-9 SPC-001 is excluded from public documents library', async () => {
    const legal = createInMemoryLegalService();
    const library = await legal.documents.getLibraryView(LEGAL_FIXTURE_PROFILE_IDS.artistGreen);
    expect(library?.rows.some((row) => row.templateCode === 'SPC-001')).toBe(false);
    expect(library?.rows.every(isPublicLegalLibraryDocument)).toBe(true);
  });

  it('9) TIN remains masked in staff owner projection', () => {
    const legal = createInMemoryLegalService();
    const view = legal.projectExpedienteForViewer(LEGAL_FIXTURE_PROFILE_IDS.artistGreen, {
      role: 'staff_owner',
      subjectProfileId: LEGAL_FIXTURE_PROFILE_IDS.artistGreen,
    });
    expect(view?.taxCenter?.tinLast4).toBe('***-1234');
  });

  it('10) audit payload guard rejects forbidden keys', () => {
    expect(() => assertAuditPayloadSafe({ tinFull: 'secret' })).toThrow(LegalContractError);
    expect(() => assertAuditPayloadSafe({ signatureRaw: 'bytes' })).toThrow(LegalContractError);
  });

  it('11) external signer cannot access foreign packages', () => {
    const legal = createInMemoryLegalService();
    expect(
      legal.canExternalSignerAccessPackage(
        LEGAL_FIXTURE_PROFILE_IDS.externalSigner,
        LEGAL_FIXTURE_PACKAGE_IDS.yellowPackage,
      ),
    ).toBe(false);
    expect(
      legal.getExternalSignerPackageView(
        LEGAL_FIXTURE_PROFILE_IDS.externalSigner,
        LEGAL_FIXTURE_PACKAGE_IDS.externalPackage,
      )?.packageId,
    ).toBe(LEGAL_FIXTURE_PACKAGE_IDS.externalPackage);
  });

  it('12) canonical introduction record returns active protection metadata', async () => {
    const legal = createInMemoryLegalService();
    const registry = await legal.introduction.getIntroductionRegistryView(
      LEGAL_FIXTURE_PROFILE_IDS.artistGreen,
    );
    const intro = registry?.cards.find(
      (card) => card.introductionId === LEGAL_FIXTURE_INTRODUCTION_IDS.canonical,
    );
    expect(intro?.counterpartyName).toBe('Mojitos Calle 8');
    expect(intro?.performerDisplayName).toBe('DJMago305');
    expect(intro?.protectionStatus).toBe('active');
    expect(intro?.protectionExpiresAt).toBe('2028-05-01T00:00:00.000Z');
  });

  it('13) store snapshots do not share mutable internal references', () => {
    const store = createSeededInMemoryLegalStore();
    const first = store.getSnapshot();
    first.profiles.set('LP-MUTATION-TEST', {
      legalProfileId: 'LP-MUTATION-TEST',
      subjectType: 'external',
      legalName: 'Mutation',
      primaryEmail: 'mut@lab.mdj',
      aggregateStatus: 'RED',
      statusComputedAt: '2026-07-20T21:00:00.000Z',
      statusItems: [],
      restrictions: [],
      createdAt: '2026-07-20T21:00:00.000Z',
      updatedAt: '2026-07-20T21:00:00.000Z',
    });
    const second = store.getSnapshot();
    expect(second.profiles.has('LP-MUTATION-TEST')).toBe(false);
  });

  it('14) unknown profile id returns typed not-found result', async () => {
    const legal = createInMemoryLegalService();
    const result = await legal.profile.getExpedienteSnapshot('LP-UNKNOWN-999');
    expect(result).toEqual(
      expect.objectContaining({ ok: false, code: 'LEGAL_PROFILE_NOT_FOUND' }),
    );
    expect(legal.getProfileById('LP-UNKNOWN-999')).toBeNull();
  });

  it('15) fixtures contain no usable secrets or forbidden fiscal keys', () => {
    const payload = JSON.stringify(collectFixtureSeedPayloadForSecretScan());
    const forbiddenPatterns = [
      'tinFull',
      'ssn',
      'signatureRaw',
      'signatureBitmap',
      'sk_live',
      'Bearer ',
      'eyJhbGci',
    ];
    for (const pattern of forbiddenPatterns) {
      expect(payload.includes(pattern)).toBe(false);
    }
    expect(payload.includes('lab-stub-token-ref-only')).toBe(true);
  });
});
