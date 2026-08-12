/**
 * MOD-205 — mount the Artist Agenda full-page shell into the artist dashboard,
 * then boot the real WebGL Atmospheric Hero engine against it.
 * See render-artist-agenda-fullpage-view.ts (structure) and
 * weather-hero-engine.ts (ported engine, verbatim shader/physics).
 */

import { renderArtistAgendaFullpageView } from './render-artist-agenda-fullpage-view';
import { initWeatherHeroEngine } from './weather-hero-engine';

/**
 * Appends the Agenda full-page section to `mainRegion` and boots the WebGL
 * engine, if not already present. Idempotent: calling twice is a no-op.
 * Returns a dispose function (stops the render loop + removes listeners),
 * or null if the section was already mounted by a prior call.
 */
export function mountArtistAgendaFullpage(mainRegion: HTMLElement): (() => void) | null {
  if (mainRegion.querySelector('#agenda-fullpage')) return null;
  renderArtistAgendaFullpageView(mainRegion);
  return initWeatherHeroEngine();
}
