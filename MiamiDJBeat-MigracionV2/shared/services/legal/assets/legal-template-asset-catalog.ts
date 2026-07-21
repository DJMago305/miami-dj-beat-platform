/** Legal template asset catalog — shared templates for Staff · Artist · Client */

import type { LegalTemplateAssetCatalogEntry } from './legal-template-asset-types';

const COUNSEL_REFERENCE_ROOT = 'MiamiDJBeat-MigracionV2/docs/legal';

function entry(
  partial: LegalTemplateAssetCatalogEntry,
): LegalTemplateAssetCatalogEntry {
  return Object.freeze(partial);
}

/**
 * Canonical registry for Legal Center V2 shared templates.
 * Only rows with availability `ready` must have a binary under ./templates/ and a URL map entry.
 */
export const LEGAL_TEMPLATE_ASSET_CATALOG: readonly LegalTemplateAssetCatalogEntry[] = Object.freeze([
  entry({
    templateCode: 'SPC-001',
    templateVersionId: 'TV-SPC-001-1',
    category: 'w9',
    officialName: 'W-9 Request for Taxpayer Identification',
    assetKey: 'tax/SPC-001/TV-SPC-001-1/fw9-corporate',
    filename: 'fw9-corporate.pdf',
    mimeType: 'application/pdf',
    kind: 'pdf',
    availability: 'ready',
    sharedAcrossPortals: true,
    allowedPortals: Object.freeze(['staff', 'artist']),
    isPublicLibraryDocument: false,
    counselReferencePath: `${COUNSEL_REFERENCE_ROOT}/fw9.pdf`,
  }),
  entry({
    templateCode: 'SPC-002',
    templateVersionId: 'TV-SPC-002-1',
    category: 'agreements',
    officialName: 'Certificate of Insurance',
    assetKey: 'agreements/SPC-002/TV-SPC-002-1/coi-template',
    filename: 'coi-template.pdf',
    mimeType: 'application/pdf',
    kind: 'pdf',
    availability: 'planned',
    sharedAcrossPortals: true,
    allowedPortals: Object.freeze(['staff', 'artist']),
    isPublicLibraryDocument: true,
  }),
  entry({
    templateCode: 'CTR-001',
    templateVersionId: 'TV-CTR-001-1',
    category: 'contracts',
    officialName: 'Event Service Agreement',
    assetKey: 'contracts/client/CTR-001/TV-CTR-001-1/event-service-agreement',
    filename: 'event-service-agreement.pdf',
    mimeType: 'application/pdf',
    kind: 'pdf',
    availability: 'planned',
    sharedAcrossPortals: true,
    allowedPortals: Object.freeze(['staff', 'client']),
    isPublicLibraryDocument: true,
  }),
  entry({
    templateCode: 'CTR-002',
    templateVersionId: 'TV-CTR-002-1',
    category: 'artist_documents',
    officialName: 'DJ Partner Agreement',
    assetKey: 'contracts/artist/CTR-002/TV-CTR-002-1/dj-partner-agreement',
    filename: 'dj-partner-agreement.pdf',
    mimeType: 'application/pdf',
    kind: 'pdf',
    availability: 'planned',
    sharedAcrossPortals: true,
    allowedPortals: Object.freeze(['staff', 'artist']),
    isPublicLibraryDocument: true,
  }),
  entry({
    templateCode: 'CTR-CORP-001',
    templateVersionId: 'TV-CTR-CORP-001-1',
    category: 'contracts',
    officialName: 'Corporate Event Master Agreement',
    assetKey: 'contracts/corporate/CTR-CORP-001/TV-CTR-CORP-001-1/corporate-master',
    filename: 'corporate-master-agreement.pdf',
    mimeType: 'application/pdf',
    kind: 'pdf',
    availability: 'planned',
    sharedAcrossPortals: true,
    allowedPortals: Object.freeze(['staff']),
    isPublicLibraryDocument: true,
  }),
  entry({
    templateCode: 'NDA-001',
    templateVersionId: 'TV-NDA-001-1',
    category: 'nda',
    officialName: 'Mutual Non-Disclosure Agreement',
    assetKey: 'nda/NDA-001/TV-NDA-001-1/mutual-nda',
    filename: 'mutual-nda.pdf',
    mimeType: 'application/pdf',
    kind: 'pdf',
    availability: 'planned',
    sharedAcrossPortals: true,
    allowedPortals: Object.freeze(['staff', 'artist', 'client']),
    isPublicLibraryDocument: true,
  }),
  entry({
    templateCode: 'REL-001',
    templateVersionId: 'TV-REL-001-1',
    category: 'releases',
    officialName: 'Media Release Authorization',
    assetKey: 'releases/REL-001/TV-REL-001-1/media-release',
    filename: 'media-release.pdf',
    mimeType: 'application/pdf',
    kind: 'pdf',
    availability: 'planned',
    sharedAcrossPortals: true,
    allowedPortals: Object.freeze(['staff', 'artist', 'client']),
    isPublicLibraryDocument: true,
  }),
  entry({
    templateCode: 'LGL-002',
    templateVersionId: 'TV-LGL-002-1',
    category: 'privacy_policies',
    officialName: 'Privacy Policy',
    assetKey: 'policies/LGL-002/TV-LGL-002-1/privacy-policy',
    filename: 'privacy-policy.pdf',
    mimeType: 'application/pdf',
    kind: 'pdf',
    availability: 'planned',
    sharedAcrossPortals: true,
    allowedPortals: Object.freeze(['staff', 'artist', 'client']),
    isPublicLibraryDocument: true,
  }),
  entry({
    templateCode: 'VND-001',
    templateVersionId: 'TV-VND-001-1',
    category: 'vendor_documents',
    officialName: 'Vendor Services Agreement',
    assetKey: 'vendor/VND-001/TV-VND-001-1/vendor-services',
    filename: 'vendor-services-agreement.pdf',
    mimeType: 'application/pdf',
    kind: 'pdf',
    availability: 'planned',
    sharedAcrossPortals: true,
    allowedPortals: Object.freeze(['staff']),
    isPublicLibraryDocument: true,
  }),
]);

const CATALOG_BY_CODE = new Map<string, LegalTemplateAssetCatalogEntry>(
  LEGAL_TEMPLATE_ASSET_CATALOG.map((row) => [row.templateCode, row]),
);

const CATALOG_BY_VERSION = new Map<string, LegalTemplateAssetCatalogEntry>(
  LEGAL_TEMPLATE_ASSET_CATALOG.map((row) => [row.templateVersionId, row]),
);

export function getLegalTemplateAssetCatalogEntry(
  templateCode: string,
): LegalTemplateAssetCatalogEntry | undefined {
  return CATALOG_BY_CODE.get(templateCode);
}

export function getLegalTemplateAssetCatalogEntryByVersion(
  templateVersionId: string,
): LegalTemplateAssetCatalogEntry | undefined {
  return CATALOG_BY_VERSION.get(templateVersionId);
}

export function listLegalTemplateAssetCatalogEntries(): readonly LegalTemplateAssetCatalogEntry[] {
  return LEGAL_TEMPLATE_ASSET_CATALOG;
}

export function listReadyLegalTemplateAssetCatalogEntries(): readonly LegalTemplateAssetCatalogEntry[] {
  return LEGAL_TEMPLATE_ASSET_CATALOG.filter((row) => row.availability === 'ready');
}
