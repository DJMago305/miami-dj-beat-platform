/**
 * MOD-204 Slice 1 — mount Artist Profile Read View into artist dashboard.
 * Lab default: MOCK_ARTIST_PROFILE_DJ_PRO (no DB writers).
 * Optional: inject ProfilesService.fetchOwnArtistProfile when available.
 * Paso 4: gated by artist session-wiring pilot (assigned_dj scope).
 */

import {
  MOCK_ARTIST_PROFILE_DJ_PRO,
  type ArtistProfileReadDTO,
  type ProfilesService,
} from '../../shared/services/profiles/index';
import { renderArtistProfileReadView } from './render-artist-profile-read-view';
import {
  annotateArtistMountSourceLabel,
  artistDomainAccessAllowed,
  type ArtistSessionWiringInjection,
} from '../session/artist-session-wiring-pilot';

export type MountArtistProfileReadSliceInput = {
  readonly mainRegion: HTMLElement;
  /** Optional live read service — never used for writes. */
  readonly profilesService?: ProfilesService | null;
  /** Override fixture for tests. */
  readonly fallbackProfile?: ArtistProfileReadDTO;
  readonly sessionWiring?: ArtistSessionWiringInjection | null;
};

export type MountArtistProfileReadSliceResult = {
  readonly ok: true;
  readonly source: 'service' | 'mock';
  readonly profile: ArtistProfileReadDTO;
};

function resolveProfileSlot(mainRegion: HTMLElement): HTMLElement | null {
  return mainRegion.querySelector<HTMLElement>('[data-mdj-artist-section="artist-profile"]');
}

/**
 * Hydrates the artist-profile dashboard slot with MOD-204 read view.
 * Prefer live `fetchOwnArtistProfile` when service returns ok; else mock.
 */
export async function mountArtistProfileReadSlice(
  input: MountArtistProfileReadSliceInput,
): Promise<MountArtistProfileReadSliceResult> {
  const slot = resolveProfileSlot(input.mainRegion);
  if (!slot) {
    throw new Error('MOD-204: artist-profile section slot missing');
  }

  const fallback = input.fallbackProfile ?? MOCK_ARTIST_PROFILE_DJ_PRO;
  let profile: ArtistProfileReadDTO = fallback;
  let source: 'service' | 'mock' = 'mock';

  if (input.profilesService && artistDomainAccessAllowed(input.sessionWiring, 'profiles')) {
    try {
      const result = await input.profilesService.fetchOwnArtistProfile();
      if (result.ok && result.data) {
        profile = result.data;
        source = 'service';
      }
    } catch {
      // Lab: stay on mock — never throw into portal shell.
      source = 'mock';
      profile = fallback;
    }
  }

  const title = document.createElement('h2');
  title.className = 'mdj-shell-section-header';
  title.setAttribute('data-mdj-component', 'SectionHeader');
  title.textContent = 'Artist Profile';

  const panel = document.createElement('div');
  panel.className = 'mdj-artist-profile-read-host';
  panel.dataset.mdjArtistProfileHost = 'mod-204';

  slot.replaceChildren(title, panel);
  renderArtistProfileReadView(panel, profile, {
    sourceLabel: annotateArtistMountSourceLabel(
      source === 'service' ? 'live read' : 'lab mock',
      input.sessionWiring,
      'profiles',
    ),
  });

  return Object.freeze({ ok: true as const, source, profile });
}

/**
 * Synchronous lab mount (mock only) — used when dashboard renders before async hydrate.
 */
export function mountArtistProfileReadSliceSync(
  mainRegion: HTMLElement,
  profile: ArtistProfileReadDTO = MOCK_ARTIST_PROFILE_DJ_PRO,
  sessionWiring?: ArtistSessionWiringInjection | null,
): void {
  const slot = resolveProfileSlot(mainRegion);
  if (!slot) return;

  const title = document.createElement('h2');
  title.className = 'mdj-shell-section-header';
  title.setAttribute('data-mdj-component', 'SectionHeader');
  title.textContent = 'Artist Profile';

  const panel = document.createElement('div');
  panel.className = 'mdj-artist-profile-read-host';
  panel.dataset.mdjArtistProfileHost = 'mod-204';

  slot.replaceChildren(title, panel);
  renderArtistProfileReadView(panel, profile, {
    sourceLabel: annotateArtistMountSourceLabel('lab mock', sessionWiring, 'profiles'),
  });
}
