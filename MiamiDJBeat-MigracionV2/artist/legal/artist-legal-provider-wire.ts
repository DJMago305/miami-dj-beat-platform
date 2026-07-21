/** Artist legal provider wire — composition root — TICKET-V2-LEGAL-PROVIDER-FACTORY-PORTAL-INJECTION-001 */

import { LEGAL_FIXTURE_PROFILE_IDS } from '../../shared/services/legal/in-memory/legal-fixtures';
import {
  DEFAULT_LEGAL_PROVIDER_MODE,
  buildArtistLegalCenterShellViewModel,
  buildArtistLegalProfileViewModel,
  resolveLegalProvider,
  type ArtistLegalProfileViewModel,
  type LegalProviderContext,
} from '../../shared/services/legal/provider';
import { renderLegalCenterShell } from '../../shared/services/legal/ui';

export type ArtistLegalPortalBundle = {
  readonly provider: LegalProviderContext;
  readonly profileId: typeof LEGAL_FIXTURE_PROFILE_IDS.artistGreen;
  readonly getViewModel: () => Promise<ArtistLegalProfileViewModel>;
  readonly renderLegalCenterShell: (mainRegion: ParentNode) => void;
};

export function resolveArtistLegalPortalBundle(): ArtistLegalPortalBundle {
  const provider = resolveLegalProvider({ mode: DEFAULT_LEGAL_PROVIDER_MODE });
  const profileId = LEGAL_FIXTURE_PROFILE_IDS.artistGreen;

  return Object.freeze({
    provider,
    profileId,
    getViewModel: async () =>
      buildArtistLegalProfileViewModel(provider, {
        profileId,
        viewerProfileId: profileId,
      }),
    renderLegalCenterShell: (mainRegion) => {
      void buildArtistLegalCenterShellViewModel(provider, {
        profileId,
        viewerProfileId: profileId,
      }).then((shell) => {
        mainRegion.append(renderLegalCenterShell(shell));
      });
    },
  });
}
