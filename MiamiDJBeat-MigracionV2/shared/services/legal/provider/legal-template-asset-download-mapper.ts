/** Map legal template assets to UI download actions — LC-5 */

import { resolveLegalTemplateAssetUrl } from '../assets';
import type {
  LegalCenterShellPortal,
  LegalDocumentDownloadAction,
} from '../ui/legal-shell-types';
import { LEGAL_DOWNLOAD_COMING_SOON_ACTION } from '../ui/legal-shell-types';

export type MapTemplateAssetDownloadInput = {
  readonly portal: LegalCenterShellPortal;
  readonly templateCode: string;
  readonly templateVersionId?: string;
  readonly label?: string;
};

export function mapTemplateAssetToDownloadAction(
  input: MapTemplateAssetDownloadInput,
): LegalDocumentDownloadAction {
  const result = resolveLegalTemplateAssetUrl({
    portal: input.portal,
    templateCode: input.templateCode,
    templateVersionId: input.templateVersionId,
  });

  if (result.ok) {
    return Object.freeze({
      availability: 'available',
      label: input.label ?? 'Download PDF',
      url: result.url,
      filename: result.entry.filename,
    });
  }

  if (result.reason === 'portal_forbidden') {
    return Object.freeze({ availability: 'forbidden' });
  }

  return LEGAL_DOWNLOAD_COMING_SOON_ACTION;
}
