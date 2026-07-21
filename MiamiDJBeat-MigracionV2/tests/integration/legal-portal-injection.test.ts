/** @vitest-environment jsdom */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

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
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(grid.querySelector('[data-mdj-legal-center-shell="artist"]')).not.toBeNull();
  });

  it('client wire renders lab preview section into dashboard grid', async () => {
    const { resolveClientLegalPortalBundle } = await import('../../client/legal/client-legal-provider-wire');
    const bundle = resolveClientLegalPortalBundle();
    const grid = document.querySelector('.mdj-client-dashboard__grid') as HTMLElement;
    bundle.renderLegalCenterShell(grid);
    await bundle.getViewModel();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(grid.querySelector('[data-mdj-legal-center-shell="client"]')).not.toBeNull();
  });
});
