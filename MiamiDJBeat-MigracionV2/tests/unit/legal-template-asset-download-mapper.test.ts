/** LC-5 — legal template asset download mapper tests */

import { describe, expect, it } from 'vitest';

import { LEGAL_TEMPLATE_ASSET_URLS } from '../../shared/services/legal/assets/legal-template-asset-urls';
import { mapTemplateAssetToDownloadAction } from '../../shared/services/legal/provider/legal-template-asset-download-mapper';

describe('legal template asset download mapper — LC-5', () => {
  it('maps staff W-9 to an available download action with runtime URL', () => {
    const action = mapTemplateAssetToDownloadAction({
      portal: 'staff',
      templateCode: 'SPC-001',
      templateVersionId: 'TV-SPC-001-1',
      label: 'Download W-9',
    });

    expect(action.availability).toBe('available');
    if (action.availability === 'available') {
      expect(action.label).toBe('Download W-9');
      expect(action.url).toBe(LEGAL_TEMPLATE_ASSET_URLS['tax/SPC-001/TV-SPC-001-1/fw9-corporate']);
      expect(action.filename).toBe('fw9-corporate.pdf');
    }
  });

  it('maps artist W-9 to an available download action', () => {
    const action = mapTemplateAssetToDownloadAction({
      portal: 'artist',
      templateCode: 'SPC-001',
      templateVersionId: 'TV-SPC-001-1',
    });

    expect(action.availability).toBe('available');
  });

  it('maps client W-9 to forbidden', () => {
    const action = mapTemplateAssetToDownloadAction({
      portal: 'client',
      templateCode: 'SPC-001',
      templateVersionId: 'TV-SPC-001-1',
    });

    expect(action).toEqual({ availability: 'forbidden' });
  });

  it('maps planned templates to coming soon', () => {
    const action = mapTemplateAssetToDownloadAction({
      portal: 'staff',
      templateCode: 'CTR-001',
    });

    expect(action).toEqual({ availability: 'coming_soon', label: 'Coming soon' });
  });
});
