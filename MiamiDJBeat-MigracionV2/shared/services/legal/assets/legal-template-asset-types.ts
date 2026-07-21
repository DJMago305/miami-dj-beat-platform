/** Legal template asset types — shared binary catalog — Legal Center V2 */

export const LEGAL_TEMPLATE_ASSET_AVAILABILITY = ['ready', 'planned'] as const;
export type LegalTemplateAssetAvailability = (typeof LEGAL_TEMPLATE_ASSET_AVAILABILITY)[number];

export const LEGAL_TEMPLATE_ASSET_PORTALS = ['staff', 'artist', 'client'] as const;
export type LegalTemplateAssetPortal = (typeof LEGAL_TEMPLATE_ASSET_PORTALS)[number];

export const LEGAL_TEMPLATE_ASSET_KINDS = ['pdf', 'markdown', 'html'] as const;
export type LegalTemplateAssetKind = (typeof LEGAL_TEMPLATE_ASSET_KINDS)[number];

/** Shell-aligned categories for shared template routing (LC-4 mapper compatible). */
export const LEGAL_TEMPLATE_ASSET_CATEGORIES = [
  'contracts',
  'agreements',
  'w9',
  'tax_documents',
  'privacy_policies',
  'releases',
  'nda',
  'vendor_documents',
  'artist_documents',
] as const;
export type LegalTemplateAssetCategory = (typeof LEGAL_TEMPLATE_ASSET_CATEGORIES)[number];

/** Static catalog row — metadata only; binaries live under ./templates/ */
export type LegalTemplateAssetCatalogEntry = {
  readonly templateCode: string;
  readonly templateVersionId: string;
  readonly category: LegalTemplateAssetCategory;
  readonly officialName: string;
  readonly assetKey: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly kind: LegalTemplateAssetKind;
  readonly availability: LegalTemplateAssetAvailability;
  readonly sharedAcrossPortals: boolean;
  readonly allowedPortals: readonly LegalTemplateAssetPortal[];
  readonly isPublicLibraryDocument: boolean;
  readonly counselReferencePath?: string;
};

export type LegalTemplateAssetResolveInput = {
  readonly portal: LegalTemplateAssetPortal;
  readonly templateCode: string;
  readonly templateVersionId?: string;
};

export type LegalTemplateAssetResolveResult =
  | {
      readonly ok: true;
      readonly url: string;
      readonly entry: LegalTemplateAssetCatalogEntry;
    }
  | {
      readonly ok: false;
      readonly reason:
        | 'not_registered'
        | 'asset_not_ready'
        | 'portal_forbidden'
        | 'version_mismatch';
    };
