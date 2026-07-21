/** Legal provider layer — public exports — TICKET-V2-LEGAL-PROVIDER-FACTORY-PORTAL-INJECTION-001 */

export * from './legal-provider-mode';
export * from './legal-provider-factory';
export * from './legal-portal-view-models';
export * from './legal-portal-adapters';
export * from './legal-lab-preview-render';
export * from './legal-center-shell-mapper';
export * from './legal-template-asset-download-mapper';
export {
  resolveLegalTemplateAssetUrl,
  listSharedLegalTemplateAssetsForPortal,
  listReadySharedLegalTemplateAssetsForPortal,
  getLegalTemplateAssetCatalogEntry,
  listLegalTemplateAssetCatalogEntries,
  listReadyLegalTemplateAssetCatalogEntries,
  canPortalAccessLegalTemplateAsset,
} from '../assets';
