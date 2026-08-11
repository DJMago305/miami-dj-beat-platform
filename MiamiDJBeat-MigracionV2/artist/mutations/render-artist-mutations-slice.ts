/**
 * Render Artist Mutations slice — gig decision + payout ack (Paso 3).
 */

import type { ArtistMutationsAdapter } from '../../shared/services/artist-mutations/index';
import type { SessionContextDTO } from '../../shared/types/session.types';
import { renderArtistGigDecisionForm } from './artist-gig-decision-form';
import { renderArtistPayoutAckForm } from './artist-payout-ack-form';

export type RenderArtistMutationsSliceOptions = {
  readonly adapter: ArtistMutationsAdapter;
  readonly sessionContext: SessionContextDTO;
  readonly artistUserId: string;
  readonly gigAssignedDjId?: string | null;
};

/**
 * Renders gig decision + payout acknowledgement forms into host.
 */
export function renderArtistMutationsSlice(
  container: HTMLElement,
  options: RenderArtistMutationsSliceOptions,
): void {
  const root = document.createElement('section');
  root.className = 'mdj-artist-mutations-slice';
  root.dataset.mdjComponent = 'ArtistMutationsSlice';
  root.dataset.mdjMod = 'MOD-204-MUT';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'mdj-artist-mutations-slice__eyebrow';
  eyebrow.textContent = 'MOD-204 Writers · Lab only';

  const title = document.createElement('h2');
  title.className = 'mdj-shell-section-header';
  title.setAttribute('data-mdj-component', 'SectionHeader');
  title.textContent = 'Artist Mutations';

  const intro = document.createElement('p');
  intro.className = 'mdj-artist-mutations-slice__intro';
  intro.textContent =
    'Accept or decline assigned gigs and acknowledge payouts. Results stay in the lab adapter store.';

  const grid = document.createElement('div');
  grid.className = 'mdj-artist-mutations-slice__grid';

  const gigHost = document.createElement('div');
  gigHost.className = 'mdj-artist-mutations-slice__card';
  gigHost.dataset.mdjMutationsHost = 'gig';

  const payoutHost = document.createElement('div');
  payoutHost.className = 'mdj-artist-mutations-slice__card';
  payoutHost.dataset.mdjMutationsHost = 'payout';

  renderArtistGigDecisionForm(gigHost, {
    adapter: options.adapter,
    sessionContext: options.sessionContext,
    artistUserId: options.artistUserId,
    gigAssignedDjId: options.gigAssignedDjId ?? options.artistUserId,
  });
  renderArtistPayoutAckForm(payoutHost, {
    adapter: options.adapter,
    sessionContext: options.sessionContext,
    artistUserId: options.artistUserId,
  });

  grid.append(gigHost, payoutHost);
  root.append(eyebrow, title, intro, grid);
  container.replaceChildren(root);
}
