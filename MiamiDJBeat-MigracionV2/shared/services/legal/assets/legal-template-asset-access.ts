/** Portal access policy for shared legal template assets */

import type {
  LegalTemplateAssetCatalogEntry,
  LegalTemplateAssetPortal,
} from './legal-template-asset-types';

export function canPortalAccessLegalTemplateAsset(
  portal: LegalTemplateAssetPortal,
  entry: LegalTemplateAssetCatalogEntry,
): boolean {
  return entry.allowedPortals.includes(portal);
}

export function listLegalTemplateAssetsForPortal(
  portal: LegalTemplateAssetPortal,
  entries: readonly LegalTemplateAssetCatalogEntry[],
): readonly LegalTemplateAssetCatalogEntry[] {
  return entries.filter((entry) => canPortalAccessLegalTemplateAsset(portal, entry));
}

export function listPublicLegalLibraryTemplateAssets(
  entries: readonly LegalTemplateAssetCatalogEntry[],
): readonly LegalTemplateAssetCatalogEntry[] {
  return entries.filter((entry) => entry.isPublicLibraryDocument);
}
