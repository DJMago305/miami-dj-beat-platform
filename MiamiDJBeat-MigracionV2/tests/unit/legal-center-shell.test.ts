/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';

import { resolveLegalProvider } from '../../shared/services/legal/provider';
import {
  buildArtistLegalCenterShellViewModel,
  buildClientLegalCenterShellViewModel,
  buildStaffLegalCenterShellViewModel,
  mapLifecycleToCardStatus,
} from '../../shared/services/legal/provider/legal-center-shell-mapper';
import { LEGAL_FIXTURE_PROFILE_IDS } from '../../shared/services/legal/in-memory';
import {
  createEmptyLegalState,
  createLegalCenterShell,
  createLegalDocumentCard,
  createLegalSection,
  createLegalStatusBadge,
  LEGAL_DOWNLOAD_COMING_SOON_ACTION,
  renderLegalCenterShell,
  type LegalCenterShellViewModel,
} from '../../shared/services/legal/ui';
import { LEGAL_TEMPLATE_ASSET_URLS } from '../../shared/services/legal/assets/legal-template-asset-urls';

describe('legal center UI shell — LC-4 — TICKET-V2-LEGAL-CENTER-UI-SHELL-001', () => {
  it('renders LegalCenterShell with portal marker', () => {
    const viewModel: LegalCenterShellViewModel = Object.freeze({
      portal: 'artist',
      state: 'ready',
      title: 'My Legal Profile',
      aggregateStatus: 'GREEN',
      sections: Object.freeze([]),
    });

    const shell = renderLegalCenterShell(viewModel);
    expect(shell.dataset.mdjLegalCenterShell).toBe('artist');
    expect(shell.querySelector('.mdj-legal-center-shell__title')?.textContent).toBe('My Legal Profile');
  });

  it('renders category sections and document cards', () => {
    const section = createLegalSection(
      Object.freeze({
        sectionId: 'section-contracts',
        title: 'Contracts',
        category: 'contracts',
        documents: Object.freeze([
          Object.freeze({
            id: 'DOC-1',
            title: 'DJ Partner Agreement',
            type: 'contracts',
            status: 'signed',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-15T00:00:00.000Z',
            requiresSignature: true,
            downloadAction: LEGAL_DOWNLOAD_COMING_SOON_ACTION,
          }),
        ]),
      }),
    );

    expect(section.dataset.mdjLegalCategory).toBe('contracts');
    expect(section.querySelector('[data-mdj-legal-document-card="DOC-1"]')).not.toBeNull();
  });

  it('renders empty legal state inside sections without documents', () => {
    const section = createLegalSection(
      Object.freeze({
        sectionId: 'section-empty',
        title: 'Releases',
        category: 'releases',
        documents: Object.freeze([]),
      }),
    );

    expect(section.querySelector('[data-mdj-legal-empty-state="true"]')).not.toBeNull();
  });

  it('renders status badges with tone classes', () => {
    const badge = createLegalStatusBadge({ label: 'GREEN', tone: 'GREEN' });
    expect(badge.classList.contains('mdj-legal-status-badge--green')).toBe(true);

    const card = createLegalDocumentCard(
      Object.freeze({
        id: 'DOC-2',
        title: 'Privacy Policy',
        type: 'privacy_policies',
        status: 'signed',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        requiresSignature: false,
        downloadAction: LEGAL_DOWNLOAD_COMING_SOON_ACTION,
      }),
    );
    expect(card.querySelector('.mdj-legal-status-badge')).not.toBeNull();
    expect(card.querySelector('.mdj-legal-document-card__download-link')).toBeNull();
    expect(card.textContent).toContain('Coming soon');
  });

  it('renders authorized download link with secure rel attributes', () => {
    const runtimeUrl = LEGAL_TEMPLATE_ASSET_URLS['tax/SPC-001/TV-SPC-001-1/fw9-corporate'];
    const card = createLegalDocumentCard(
      Object.freeze({
        id: 'DOC-W9',
        title: 'W-9 Status',
        type: 'w9',
        status: 'signed',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        requiresSignature: false,
        downloadAction: Object.freeze({
          availability: 'available',
          label: 'Download W-9',
          url: runtimeUrl,
          filename: 'fw9-corporate.pdf',
        }),
      }),
    );

    const link = card.querySelector('.mdj-legal-document-card__download-link') as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link?.href).toContain('fw9-corporate');
    expect(link?.target).toBe('_blank');
    expect(link?.rel).toBe('noopener noreferrer');
    expect(link?.textContent).toBe('Download W-9');
  });

  it('does not render download row when action is forbidden', () => {
    const card = createLegalDocumentCard(
      Object.freeze({
        id: 'DOC-FORBIDDEN',
        title: 'Hidden W-9',
        type: 'w9',
        status: 'rejected',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        requiresSignature: false,
        downloadAction: Object.freeze({ availability: 'forbidden' }),
      }),
    );

    expect(card.textContent).not.toContain('Download:');
    expect(card.querySelector('a')).toBeNull();
  });

  it('maps lifecycle statuses to card statuses', () => {
    expect(mapLifecycleToCardStatus('COMPLETED')).toBe('signed');
    expect(mapLifecycleToCardStatus('EXPIRED')).toBe('expired');
    expect(mapLifecycleToCardStatus('VOIDED')).toBe('rejected');
  });

  it('integrates artist shell with authorized W-9 download action', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const shell = await buildArtistLegalCenterShellViewModel(provider, {
      profileId: LEGAL_FIXTURE_PROFILE_IDS.artistGreen,
      viewerProfileId: LEGAL_FIXTURE_PROFILE_IDS.artistGreen,
    });

    expect(shell.state).toBe('ready');
    const w9Section = shell.sections.find((section) => section.sectionId === 'section-w9-center');
    expect(w9Section).toBeDefined();
    const w9Card = w9Section?.documents[0];
    expect(w9Card?.downloadAction.availability).toBe('available');
    if (w9Card?.downloadAction.availability === 'available') {
      expect(w9Card.downloadAction.label).toBe('Download W-9');
    }

    const rendered = createLegalCenterShell(shell);
    expect(rendered.querySelector('.mdj-legal-document-card__download-link')).not.toBeNull();
  });

  it('integrates staff shell without exposing store', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const shell = await buildStaffLegalCenterShellViewModel(provider, { role: 'staff_owner' });
    expect(shell.portal).toBe('staff');
    expect(shell.kpis?.length).toBeGreaterThan(0);
  });

  it('integrates client shell without tax sections', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const shell = await buildClientLegalCenterShellViewModel(provider, {
      profileId: LEGAL_FIXTURE_PROFILE_IDS.client,
      viewerProfileId: LEGAL_FIXTURE_PROFILE_IDS.client,
    });
    expect(shell.sections.every((section) => section.category !== 'w9')).toBe(true);
  });

  it('renders shell empty state for not_found', () => {
    const shell = createLegalCenterShell(
      Object.freeze({
        portal: 'client',
        state: 'not_found',
        title: 'My Documents',
        message: 'No legal profile available',
        sections: Object.freeze([]),
      }),
    );
    expect(shell.querySelector('[data-mdj-legal-empty-state="true"]')).not.toBeNull();
  });

  it('renders standalone empty legal state component', () => {
    const empty = createEmptyLegalState({
      title: 'No documents',
      description: 'Nothing to show',
    });
    expect(empty.dataset.mdjLegalEmptyState).toBe('true');
  });
});
