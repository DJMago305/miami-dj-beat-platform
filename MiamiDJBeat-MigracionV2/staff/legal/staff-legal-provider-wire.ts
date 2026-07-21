/** Staff legal provider wire — composition root — TICKET-V2-LEGAL-PROVIDER-FACTORY-PORTAL-INJECTION-001 */

import {
  DEFAULT_LEGAL_PROVIDER_MODE,
  buildStaffLegalCenterShellViewModel,
  buildStaffLegalCenterViewModel,
  resolveLegalProvider,
  type LegalProviderContext,
  type StaffLegalCenterViewModel,
  type StaffLegalPortalRole,
} from '../../shared/services/legal/provider';
import { renderLegalCenterShell } from '../../shared/services/legal/ui';
import { parseStaffPreviewRoleFromUrl } from '../staff-preview-role';

export type StaffLegalPortalBundle = {
  readonly provider: LegalProviderContext;
  readonly role: StaffLegalPortalRole;
  readonly getViewModel: () => Promise<StaffLegalCenterViewModel>;
  readonly renderLegalCenterShell: (mainRegion: ParentNode) => void;
};

function resolveStaffLegalRoleFromPreview(search = typeof window === 'undefined' ? '' : window.location.search): StaffLegalPortalRole {
  const previewRole = parseStaffPreviewRoleFromUrl(search);
  if (previewRole === 'seller') {
    return 'staff_seller';
  }
  if (previewRole === 'manager') {
    return 'staff_manager';
  }
  return 'staff_owner';
}

export function resolveStaffLegalPortalBundle(
  search = typeof window === 'undefined' ? '' : window.location.search,
): StaffLegalPortalBundle {
  const provider = resolveLegalProvider({ mode: DEFAULT_LEGAL_PROVIDER_MODE });
  const role = resolveStaffLegalRoleFromPreview(search);

  return Object.freeze({
    provider,
    role,
    getViewModel: async () => buildStaffLegalCenterViewModel(provider, { role }),
    renderLegalCenterShell: (mainRegion) => {
      void buildStaffLegalCenterShellViewModel(provider, { role }).then((shell) => {
        mainRegion.append(renderLegalCenterShell(shell));
      });
    },
  });
}
