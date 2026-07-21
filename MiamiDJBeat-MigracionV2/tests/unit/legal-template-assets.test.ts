/** Legal template assets — shared catalog + resolver */

import { describe, expect, it } from 'vitest';

import {
  canPortalAccessLegalTemplateAsset,
  getLegalTemplateAssetCatalogEntry,
  listLegalTemplateAssetCatalogEntries,
  listReadyLegalTemplateAssetCatalogEntries,
  listReadySharedLegalTemplateAssetsForPortal,
  listSharedLegalTemplateAssetsForPortal,
  resolveLegalTemplateAssetUrl,
} from '../../shared/services/legal/assets';

describe('legal template assets — W-9 corporate registration', () => {
  it('registers SPC-001 as the only ready shared template', () => {
    const ready = listReadyLegalTemplateAssetCatalogEntries();
    expect(ready).toHaveLength(1);
    expect(ready[0]?.templateCode).toBe('SPC-001');
    expect(ready[0]?.templateVersionId).toBe('TV-SPC-001-1');
    expect(ready[0]?.filename).toBe('fw9-corporate.pdf');
  });

  it('resolves W-9 URL for staff and artist but not client', () => {
    const staff = resolveLegalTemplateAssetUrl({
      portal: 'staff',
      templateCode: 'SPC-001',
      templateVersionId: 'TV-SPC-001-1',
    });
    const artist = resolveLegalTemplateAssetUrl({
      portal: 'artist',
      templateCode: 'SPC-001',
    });
    const client = resolveLegalTemplateAssetUrl({
      portal: 'client',
      templateCode: 'SPC-001',
    });

    expect(staff.ok).toBe(true);
    expect(artist.ok).toBe(true);
    expect(client.ok).toBe(false);
    if (staff.ok) {
      expect(staff.url).toContain('fw9-corporate');
    }
    if (!client.ok) {
      expect(client.reason).toBe('portal_forbidden');
    }
  });

  it('keeps W-9 out of the public library catalog slice', () => {
    const w9 = getLegalTemplateAssetCatalogEntry('SPC-001');
    expect(w9?.isPublicLibraryDocument).toBe(false);
  });

  it('lists planned templates for future document families', () => {
    const catalog = listLegalTemplateAssetCatalogEntries();
    const codes = catalog.map((row) => row.templateCode);
    expect(codes).toEqual(
      expect.arrayContaining([
        'SPC-001',
        'CTR-001',
        'CTR-002',
        'CTR-CORP-001',
        'NDA-001',
        'REL-001',
        'LGL-002',
        'VND-001',
      ]),
    );
  });

  it('exposes portal-filtered ready assets through provider exports', () => {
    expect(listReadySharedLegalTemplateAssetsForPortal('staff')).toHaveLength(1);
    expect(listReadySharedLegalTemplateAssetsForPortal('artist')).toHaveLength(1);
    expect(listReadySharedLegalTemplateAssetsForPortal('client')).toHaveLength(0);
    expect(listSharedLegalTemplateAssetsForPortal('client').some((row) => row.templateCode === 'NDA-001')).toBe(true);
  });

  it('enforces portal access policy on catalog rows', () => {
    const w9 = getLegalTemplateAssetCatalogEntry('SPC-001');
    expect(w9).toBeDefined();
    if (!w9) {
      return;
    }
    expect(canPortalAccessLegalTemplateAsset('staff', w9)).toBe(true);
    expect(canPortalAccessLegalTemplateAsset('artist', w9)).toBe(true);
    expect(canPortalAccessLegalTemplateAsset('client', w9)).toBe(false);
  });

  it('returns asset_not_ready for planned templates', () => {
    const result = resolveLegalTemplateAssetUrl({
      portal: 'staff',
      templateCode: 'CTR-001',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('asset_not_ready');
    }
  });
});
