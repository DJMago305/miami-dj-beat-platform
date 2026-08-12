/**
 * Mount Artist Mutations slice into artist dashboard (Paso 3).
 */

import type { ArtistMutationsAdapter } from '../../shared/services/artist-mutations/index';
import type { SessionContextDTO } from '../../shared/types/session.types';
import type { ArtistSessionWiringInjection } from '../session/artist-session-wiring-pilot';
import { renderArtistMutationsSlice } from './render-artist-mutations-slice';

export type MountArtistMutationsSliceInput = {
  readonly mainRegion: HTMLElement;
  readonly adapter: ArtistMutationsAdapter;
  readonly sessionContext: SessionContextDTO;
  readonly artistUserId: string;
  readonly sessionWiring?: ArtistSessionWiringInjection | null;
};

function resolveSlot(mainRegion: HTMLElement): HTMLElement | null {
  return mainRegion.querySelector<HTMLElement>('[data-mdj-artist-section="artist-mutations"]');
}

/**
 * Hydrates artist-mutations dashboard slot with writer forms.
 */
export function mountArtistMutationsSlice(input: MountArtistMutationsSliceInput): void {
  const slot = resolveSlot(input.mainRegion);
  if (!slot) {
    throw new Error('MOD-204-MUT: artist-mutations section slot missing');
  }

  const canWrite =
    input.sessionWiring == null
      ? true
      : input.sessionWiring.canReadArtistPortal &&
        input.sessionContext.sessionRole === 'artist' &&
        Boolean(input.artistUserId);

  if (!canWrite) {
    const gated = document.createElement('aside');
    gated.className = 'mdj-artist-mutations-slice mdj-artist-mutations-slice--gated';
    gated.dataset.mdjComponent = 'ArtistMutationsSlice';
    gated.dataset.mdjSessionReady = '0';
    gated.textContent =
      'Artist mutations gated — session must be an active artist role to submit writers.';
    slot.replaceChildren(gated);
    return;
  }

  const host = document.createElement('div');
  host.className = 'mdj-artist-mutations-host';
  host.dataset.mdjArtistMutationsHost = 'mod-204-mut';
  slot.replaceChildren(host);
  renderArtistMutationsSlice(host, {
    adapter: input.adapter,
    sessionContext: input.sessionContext,
    artistUserId: input.artistUserId,
    gigAssignedDjId: input.sessionWiring?.assignedDjUserId ?? input.artistUserId,
  });
}
