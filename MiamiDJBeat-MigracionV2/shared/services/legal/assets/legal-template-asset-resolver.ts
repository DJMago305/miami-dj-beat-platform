/** Resolve shared legal template asset URLs for Legal Center V2 lab */

import {
  getLegalTemplateAssetCatalogEntry,
  getLegalTemplateAssetCatalogEntryByVersion,
  listLegalTemplateAssetCatalogEntries,
} from './legal-template-asset-catalog';
import {
  canPortalAccessLegalTemplateAsset,
  listLegalTemplateAssetsForPortal,
} from './legal-template-asset-access';
import { LEGAL_TEMPLATE_ASSET_URLS } from './legal-template-asset-urls';
import type {
  LegalTemplateAssetCatalogEntry,
  LegalTemplateAssetPortal,
  LegalTemplateAssetResolveInput,
  LegalTemplateAssetResolveResult,
} from './legal-template-asset-types';

function resolveCatalogEntry(input: LegalTemplateAssetResolveInput): LegalTemplateAssetCatalogEntry | undefined {
  if (input.templateVersionId) {
    const byVersion = getLegalTemplateAssetCatalogEntryByVersion(input.templateVersionId);
    if (byVersion && byVersion.templateCode === input.templateCode) {
      return byVersion;
    }
    return undefined;
  }
  return getLegalTemplateAssetCatalogEntry(input.templateCode);
}

export function resolveLegalTemplateAssetUrl(
  input: LegalTemplateAssetResolveInput,
): LegalTemplateAssetResolveResult {
  const entry = resolveCatalogEntry(input);
  if (!entry) {
    return Object.freeze({ ok: false, reason: 'not_registered' });
  }

  if (input.templateVersionId && entry.templateVersionId !== input.templateVersionId) {
    return Object.freeze({ ok: false, reason: 'version_mismatch' });
  }

  if (!canPortalAccessLegalTemplateAsset(input.portal, entry)) {
    return Object.freeze({ ok: false, reason: 'portal_forbidden' });
  }

  if (entry.availability !== 'ready') {
    return Object.freeze({ ok: false, reason: 'asset_not_ready' });
  }

  const url = LEGAL_TEMPLATE_ASSET_URLS[entry.assetKey as keyof typeof LEGAL_TEMPLATE_ASSET_URLS];
  if (!url) {
    return Object.freeze({ ok: false, reason: 'asset_not_ready' });
  }

  return Object.freeze({ ok: true, url, entry });
}

export function listSharedLegalTemplateAssetsForPortal(
  portal: LegalTemplateAssetPortal,
): readonly LegalTemplateAssetCatalogEntry[] {
  return listLegalTemplateAssetsForPortal(portal, listLegalTemplateAssetCatalogEntries());
}

export function listReadySharedLegalTemplateAssetsForPortal(
  portal: LegalTemplateAssetPortal,
): readonly LegalTemplateAssetCatalogEntry[] {
  return listSharedLegalTemplateAssetsForPortal(portal).filter((entry) => entry.availability === 'ready');
}
