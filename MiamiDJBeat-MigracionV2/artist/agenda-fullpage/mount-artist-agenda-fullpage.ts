/**
 * MOD-205 — mount the Artist Agenda full-page shell into the artist dashboard.
 * Structural placeholder only — see render-artist-agenda-fullpage-view.ts.
 */

import { renderArtistAgendaFullpageView } from './render-artist-agenda-fullpage-view';

/**
 * Appends the Agenda full-page section to `mainRegion` if not already present.
 * Idempotent: calling twice is a no-op on the second call.
 */
export function mountArtistAgendaFullpage(mainRegion: HTMLElement): void {
  if (mainRegion.querySelector('#agenda-fullpage')) return;
  renderArtistAgendaFullpageView(mainRegion);
}
