/**
 * MOD-205 — mount the Artist Agenda full-page shell into the artist dashboard,
 * then boot the real WebGL Atmospheric Hero engine against it.
 * See render-artist-agenda-fullpage-view.ts (structure) and
 * weather-hero-engine.ts (ported engine, verbatim shader/physics).
 */

import { renderArtistAgendaFullpageView } from './render-artist-agenda-fullpage-view';
import { initWeatherHeroEngine } from './weather-hero-engine';
import type { ArtistSessionWiringInjection } from '../session/artist-session-wiring-pilot';

/**
 * Appends the Agenda full-page section into the "Agenda · Gigs" tab panel
 * (MOD-206 — [data-tab-panel="agenda"], built by buildArtistV1PortalLayout
 * ahead of this call) and boots the WebGL engine, if not already present.
 * Idempotent: calling twice is a no-op. `sessionWiring` is threaded through
 * only to label the DJ Advice module's data source honestly (same
 * annotateArtistMountSourceLabel convention as every other real slice) -
 * the Hero engine itself doesn't need it.
 * Returns a dispose function (stops the render loop + removes listeners),
 * or null if the section was already mounted by a prior call.
 */
export function mountArtistAgendaFullpage(
  mainRegion: HTMLElement,
  sessionWiring?: ArtistSessionWiringInjection | null,
): (() => void) | null {
  if (mainRegion.querySelector('#agenda-fullpage')) return null;
  const agendaPanel =
    mainRegion.querySelector<HTMLElement>('[data-tab-panel="agenda"]') ?? mainRegion;
  renderArtistAgendaFullpageView(agendaPanel, sessionWiring);
  return initWeatherHeroEngine();
}
