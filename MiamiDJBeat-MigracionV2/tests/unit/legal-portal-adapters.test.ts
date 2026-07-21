/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import { isPublicLegalLibraryDocument } from '../../shared/services/legal/contracts';
import { LEGAL_FIXTURE_PROFILE_IDS } from '../../shared/services/legal/in-memory';
import {
  assertViewModelSafe,
  buildArtistLegalProfileViewModel,
  buildClientLegalDocumentsViewModel,
  buildStaffLegalCenterViewModel,
  createInMemoryLegalProviderForTests,
  resolveLegalProvider,
} from '../../shared/services/legal/provider';

describe('legal portal adapters — TICKET-V2-LEGAL-PROVIDER-FACTORY-PORTAL-INJECTION-001', () => {
  it('4) staff owner receives permitted overview summary', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const model = await buildStaffLegalCenterViewModel(provider, { role: 'staff_owner' });
    expect(model.state).toBe('ready');
    expect(model.summary?.profileCount).toBeGreaterThan(0);
    expect(model.summary?.greenCount).toBeGreaterThan(0);
  });

  it('5) staff manager receives masked W-9 status', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const model = await buildStaffLegalCenterViewModel(provider, { role: 'staff_manager' });
    expect(model.maskedW9Status).toBe('approved');
  });

  it('6) staff seller does not receive fiscal fields', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const model = await buildStaffLegalCenterViewModel(provider, { role: 'staff_seller' });
    expect(model.maskedW9Status).toBeUndefined();
    expect(model.complianceSummary).toBe('summary-only');
    expect(() => assertViewModelSafe(model)).not.toThrow();
  });

  it('7) artist receives only own expediente', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const model = await buildArtistLegalProfileViewModel(provider, {
      profileId: LEGAL_FIXTURE_PROFILE_IDS.artistGreen,
      viewerProfileId: LEGAL_FIXTURE_PROFILE_IDS.artistGreen,
    });
    expect(model.state).toBe('ready');
    expect(model.legalStatus).toBe('GREEN');
  });

  it('8) artist cannot access another profile through adapter', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const model = await buildArtistLegalProfileViewModel(provider, {
      profileId: LEGAL_FIXTURE_PROFILE_IDS.artistGreen,
      viewerProfileId: LEGAL_FIXTURE_PROFILE_IDS.client,
    });
    expect(model.state).toBe('forbidden');
  });

  it('9) client receives only own contracts and authorizations', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const model = await buildClientLegalDocumentsViewModel(provider, {
      profileId: LEGAL_FIXTURE_PROFILE_IDS.client,
      viewerProfileId: LEGAL_FIXTURE_PROFILE_IDS.client,
    });
    expect(model.state).toBe('ready');
    expect(model.contractsCount).toBeGreaterThan(0);
  });

  it('10) client view model has no TaxProfile exposure', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const model = await buildClientLegalDocumentsViewModel(provider, {
      profileId: LEGAL_FIXTURE_PROFILE_IDS.client,
      viewerProfileId: LEGAL_FIXTURE_PROFILE_IDS.client,
    });
    expect(JSON.stringify(model).includes('taxProfile')).toBe(false);
    expect(JSON.stringify(model).includes('w9Status')).toBe(false);
  });

  it('11) client does not receive internal introduction registry counts', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const model = await buildClientLegalDocumentsViewModel(provider, {
      profileId: LEGAL_FIXTURE_PROFILE_IDS.client,
      viewerProfileId: LEGAL_FIXTURE_PROFILE_IDS.client,
    });
    expect(JSON.stringify(model).includes('introduction')).toBe(false);
  });

  it('12) view models are defensively safe to serialize', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const models = await Promise.all([
      buildStaffLegalCenterViewModel(provider, { role: 'staff_owner' }),
      buildArtistLegalProfileViewModel(provider, {
        profileId: LEGAL_FIXTURE_PROFILE_IDS.artistGreen,
        viewerProfileId: LEGAL_FIXTURE_PROFILE_IDS.artistGreen,
      }),
      buildClientLegalDocumentsViewModel(provider, {
        profileId: LEGAL_FIXTURE_PROFILE_IDS.client,
        viewerProfileId: LEGAL_FIXTURE_PROFILE_IDS.client,
      }),
    ]);
    for (const model of models) {
      expect(() => assertViewModelSafe(model)).not.toThrow();
      expect(Object.isExtensible(model)).toBe(false);
    }
  });

  it('14) not_found is returned for unknown profile', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const model = await buildArtistLegalProfileViewModel(provider, {
      profileId: 'LP-UNKNOWN-999',
      viewerProfileId: 'LP-UNKNOWN-999',
    });
    expect(model.state).toBe('not_found');
  });

  it('15) view models do not contain forbidden keys', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const model = await buildStaffLegalCenterViewModel(provider, { role: 'staff_owner' });
    const serialized = JSON.stringify(model);
    expect(serialized.includes('tinFull')).toBe(false);
    expect(serialized.includes('signatureRaw')).toBe(false);
    expect(serialized.includes('tokenId')).toBe(false);
  });

  it('16) adapters do not mutate fixture seed state', async () => {
    const { service, context } = createInMemoryLegalProviderForTests();
    const before = JSON.stringify(service.store.getSnapshot().profiles);
    await buildStaffLegalCenterViewModel(context, { role: 'staff_owner' });
    await buildArtistLegalProfileViewModel(context, {
      profileId: LEGAL_FIXTURE_PROFILE_IDS.artistGreen,
      viewerProfileId: LEGAL_FIXTURE_PROFILE_IDS.artistGreen,
    });
    const after = JSON.stringify(service.store.getSnapshot().profiles);
    expect(after).toBe(before);
  });

  it('W-9 remains excluded from public library rows used by adapters', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const library = await provider.ports.documents.getLibraryView(LEGAL_FIXTURE_PROFILE_IDS.artistGreen);
    expect(library?.rows.every(isPublicLegalLibraryDocument)).toBe(true);
  });
});
