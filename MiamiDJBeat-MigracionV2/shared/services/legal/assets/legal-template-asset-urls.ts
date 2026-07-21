/** Vite-resolved URLs for ready legal template binaries */

import fw9CorporatePdfUrl from './templates/tax/SPC-001/TV-SPC-001-1/fw9-corporate.pdf?url';

export const LEGAL_TEMPLATE_ASSET_URLS = Object.freeze({
  'tax/SPC-001/TV-SPC-001-1/fw9-corporate': fw9CorporatePdfUrl,
} as const satisfies Record<string, string>);

export type LegalTemplateAssetUrlKey = keyof typeof LEGAL_TEMPLATE_ASSET_URLS;
