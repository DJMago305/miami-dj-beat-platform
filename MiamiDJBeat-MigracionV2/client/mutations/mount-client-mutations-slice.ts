/**
 * Mount Client Mutations slice into client dashboard (Paso 3).
 */

import type { ClientMutationsAdapter } from '../../shared/services/client-mutations/index';
import type { SessionContextDTO } from '../../shared/types/session.types';
import type { ClientSessionWiringInjection } from '../session/client-session-wiring-pilot';
import { renderClientMutationsSlice } from './render-client-mutations-slice';

export type MountClientMutationsSliceInput = {
  readonly mainRegion: HTMLElement;
  readonly adapter: ClientMutationsAdapter;
  readonly sessionContext: SessionContextDTO;
  readonly clientUserId: string;
  readonly sessionWiring?: ClientSessionWiringInjection | null;
};

function resolveSlot(mainRegion: HTMLElement): HTMLElement | null {
  return mainRegion.querySelector<HTMLElement>('[data-mdj-client-section="client-mutations"]');
}

/**
 * Hydrates client-mutations dashboard slot with writer forms.
 */
export function mountClientMutationsSlice(input: MountClientMutationsSliceInput): void {
  const slot = resolveSlot(input.mainRegion);
  if (!slot) {
    throw new Error('MOD-103-MUT: client-mutations section slot missing');
  }

  const canWrite =
    input.sessionWiring == null
      ? true
      : input.sessionWiring.canReadClientPortal &&
        input.sessionContext.sessionRole === 'client' &&
        Boolean(input.clientUserId);

  if (!canWrite) {
    const gated = document.createElement('aside');
    gated.className = 'mdj-client-mutations-slice mdj-client-mutations-slice--gated';
    gated.dataset.mdjComponent = 'ClientMutationsSlice';
    gated.dataset.mdjSessionReady = '0';
    gated.textContent =
      'Client mutations gated — session must be an active client role to submit writers.';
    slot.replaceChildren(gated);
    return;
  }

  const host = document.createElement('div');
  host.className = 'mdj-client-mutations-host';
  host.dataset.mdjClientMutationsHost = 'mod-103-mut';
  slot.replaceChildren(host);
  renderClientMutationsSlice(host, {
    adapter: input.adapter,
    sessionContext: input.sessionContext,
    clientUserId: input.clientUserId,
  });
}
