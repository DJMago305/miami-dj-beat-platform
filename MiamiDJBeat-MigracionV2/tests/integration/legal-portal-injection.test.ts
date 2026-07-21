/** @vitest-environment jsdom */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';

import { LEGAL_TEMPLATE_ASSET_URLS } from '../../shared/services/legal/assets/legal-template-asset-urls';
import { LEGAL_FIXTURE_PROFILE_IDS } from '../../shared/services/legal/in-memory';
import { resolveLegalProvider } from '../../shared/services/legal/provider';
import {
  buildArtistLegalCenterShellViewModel,
  buildClientLegalCenterShellViewModel,
  buildStaffLegalCenterShellViewModel,
} from '../../shared/services/legal/provider/legal-center-shell-mapper';
import { renderLegalCenterShell } from '../../shared/services/legal/ui';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RUNTIME_W9_URL = LEGAL_TEMPLATE_ASSET_URLS['tax/SPC-001/TV-SPC-001-1/fw9-corporate'];

const STAFF_MAIN = resolve(REPO_ROOT, 'staff/main.ts');
const ARTIST_MAIN = resolve(REPO_ROOT, 'artist/main.ts');
const CLIENT_MAIN = resolve(REPO_ROOT, 'client/main.ts');

describe('legal portal injection — TICKET-V2-LEGAL-PROVIDER-FACTORY-PORTAL-INJECTION-001', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main data-mdj-shell-region="main"><div class="mdj-client-dashboard__grid"></div></main>';
  });

  it('13) portal entrypoints do not import in-memory service directly', () => {
    const staffMain = readFileSync(STAFF_MAIN, 'utf8');
    const artistMain = readFileSync(ARTIST_MAIN, 'utf8');
    const clientMain = readFileSync(CLIENT_MAIN, 'utf8');

    for (const source of [staffMain, artistMain, clientMain]) {
      expect(source).not.toMatch(/createInMemoryLegalService|createLegalInMemoryService/);
      expect(source).not.toMatch(/shared\/services\/legal\/in-memory/);
    }

    expect(staffMain).toContain('resolveStaffLegalPortalBundle');
    expect(artistMain).toContain('resolveArtistLegalPortalBundle');
    expect(clientMain).toContain('resolveClientLegalPortalBundle');
  });

  it('staff wire resolves bundle without exposing store', async () => {
    const { resolveStaffLegalPortalBundle } = await import('../../staff/legal/staff-legal-provider-wire');
    const bundle = resolveStaffLegalPortalBundle('?previewRole=owner');
    expect(bundle.role).toBe('staff_owner');
    expect('store' in bundle.provider).toBe(false);
    const model = await bundle.getViewModel();
    expect(model.state).toBe('ready');
  });

  it('artist wire renders lab preview section into dashboard grid', async () => {
    const { resolveArtistLegalPortalBundle } = await import('../../artist/legal/artist-legal-provider-wire');
    const bundle = resolveArtistLegalPortalBundle();
    const grid = document.querySelector('.mdj-client-dashboard__grid') as HTMLElement;
    bundle.renderLegalCenterShell(grid);
    await bundle.getViewModel();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
    expect(grid.querySelector('[data-mdj-legal-center-shell="artist"]')).not.toBeNull();
  });

  it('client wire renders lab preview section into dashboard grid', async () => {
    const { resolveClientLegalPortalBundle } = await import('../../client/legal/client-legal-provider-wire');
    const bundle = resolveClientLegalPortalBundle();
    const grid = document.querySelector('.mdj-client-dashboard__grid') as HTMLElement;
    bundle.renderLegalCenterShell(grid);
    await bundle.getViewModel();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
    expect(grid.querySelector('[data-mdj-legal-center-shell="client"]')).not.toBeNull();
  });
});

describe('legal template asset integration — LC-5', () => {
  it('staff owner shell HTML exposes authorized W-9 download link', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const shell = await buildStaffLegalCenterShellViewModel(provider, { role: 'staff_owner' });
    const html = renderLegalCenterShell(shell).outerHTML;

    expect(html).toContain('Download W-9');
    expect(html).toContain(RUNTIME_W9_URL);
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('artist shell HTML exposes authorized W-9 download link', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const shell = await buildArtistLegalCenterShellViewModel(provider, {
      profileId: LEGAL_FIXTURE_PROFILE_IDS.artistGreen,
      viewerProfileId: LEGAL_FIXTURE_PROFILE_IDS.artistGreen,
    });
    const html = renderLegalCenterShell(shell).outerHTML;

    expect(html).toContain('Download W-9');
    expect(html).toContain(RUNTIME_W9_URL);
  });

  it('client shell HTML does not leak W-9 asset identifiers or runtime URL', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const shell = await buildClientLegalCenterShellViewModel(provider, {
      profileId: LEGAL_FIXTURE_PROFILE_IDS.client,
      viewerProfileId: LEGAL_FIXTURE_PROFILE_IDS.client,
    });
    const html = renderLegalCenterShell(shell).outerHTML;

    expect(html).not.toContain('SPC-001');
    expect(html).not.toContain('TV-SPC-001-1');
    expect(html).not.toContain('fw9-corporate.pdf');
    expect(html).not.toContain(RUNTIME_W9_URL);
    expect(html).not.toContain('Tax & W-9 Center');
  });

  it('staff seller shell keeps fiscal section hidden and omits runtime W-9 URL', async () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    const shell = await buildStaffLegalCenterShellViewModel(provider, { role: 'staff_seller' });
    const html = renderLegalCenterShell(shell).outerHTML;

    expect(html).not.toContain('Tax & W-9 Center');
    expect(html).not.toContain(RUNTIME_W9_URL);
    expect(html).not.toContain('Download W-9');
  });
});
