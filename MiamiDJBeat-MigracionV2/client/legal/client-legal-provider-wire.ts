/** Client legal provider wire — composition root — TICKET-V2-LEGAL-PROVIDER-FACTORY-PORTAL-INJECTION-001 */

import { LEGAL_FIXTURE_PROFILE_IDS } from '../../shared/services/legal/in-memory/legal-fixtures';
import {
  DEFAULT_LEGAL_PROVIDER_MODE,
  buildClientLegalCenterShellViewModel,
  buildClientLegalDocumentsViewModel,
  resolveLegalProvider,
  type ClientLegalDocumentsViewModel,
  type LegalProviderContext,
} from '../../shared/services/legal/provider';
import { renderLegalCenterShell } from '../../shared/services/legal/ui';

export type ClientLegalPortalBundle = {
  readonly provider: LegalProviderContext;
  readonly profileId: typeof LEGAL_FIXTURE_PROFILE_IDS.client;
  readonly getViewModel: () => Promise<ClientLegalDocumentsViewModel>;
  readonly renderLegalCenterShell: (mainRegion: ParentNode) => void;
};

export function resolveClientLegalPortalBundle(): ClientLegalPortalBundle {
  const provider = resolveLegalProvider({ mode: DEFAULT_LEGAL_PROVIDER_MODE });
  const profileId = LEGAL_FIXTURE_PROFILE_IDS.client;

  return Object.freeze({
    provider,
    profileId,
    getViewModel: async () =>
      buildClientLegalDocumentsViewModel(provider, {
        profileId,
        viewerProfileId: profileId,
      }),
    renderLegalCenterShell: (mainRegion) => {
      void buildClientLegalCenterShellViewModel(provider, {
        profileId,
        viewerProfileId: profileId,
      }).then((shell) => {
        mainRegion.append(renderLegalCenterShell(shell));
      });
    },
  });
}
