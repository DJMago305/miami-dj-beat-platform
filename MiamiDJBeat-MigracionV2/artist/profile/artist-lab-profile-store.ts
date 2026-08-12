/**
 * MOD-215 — shared in-memory store for the artist's Config-tab edits
 * (stage name, city, role/category tag, social links). Lab-only: no
 * Supabase persistence yet, mirrors the closured-state idiom already used
 * by createArtistMutationsAdapter (shared/services/artist-mutations).
 *
 * Both the page-level Hero (v1-artist-portal-layout.ts) and the read-only
 * "Mi Perfil" section (mount-artist-profile-read-slice.ts) subscribe here,
 * so a Config save is reflected everywhere instantly without a page reload.
 */

import type { ArtistProfileReadDTO, ArtistSocialLinksDTO } from '../../shared/services/profiles/index';
import { LAB_ARTIST_PROFILE_DJMAGO305 } from './artist-profile-read-fixtures';

export type ArtistLabProfileState = {
  readonly stageName: string;
  readonly city: string;
  readonly roleTag: string;
  readonly socialLinks: ArtistSocialLinksDTO;
  readonly bio: string;
  /** Owner-only account data — edited in Config, never displayed in "Mi Perfil" (PO decision, 2026-08-12). */
  readonly legalFullName: string;
  readonly email: string;
};

type ArtistLabProfileListener = (state: ArtistLabProfileState) => void;

function createArtistLabProfileStore(initial: ArtistLabProfileState) {
  let state = initial;
  const listeners = new Set<ArtistLabProfileListener>();

  return {
    getState: (): ArtistLabProfileState => state,
    setState: (patch: Partial<ArtistLabProfileState>): void => {
      state = Object.freeze({ ...state, ...patch });
      listeners.forEach((listener) => listener(state));
    },
    subscribe: (listener: ArtistLabProfileListener): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const EMPTY_SOCIAL_LINKS: ArtistSocialLinksDTO = Object.freeze({
  instagram: null,
  youtube: null,
  spotify: null,
  soundcloud: null,
  mixcloud: null,
});

const INITIAL_STATE: ArtistLabProfileState = Object.freeze({
  stageName: LAB_ARTIST_PROFILE_DJMAGO305.stageName ?? 'DJMago305',
  city: LAB_ARTIST_PROFILE_DJMAGO305.city ?? 'Miami',
  roleTag: 'DJ · Producer',
  socialLinks: LAB_ARTIST_PROFILE_DJMAGO305.socialLinks ?? EMPTY_SOCIAL_LINKS,
  bio: LAB_ARTIST_PROFILE_DJMAGO305.bioEn ?? LAB_ARTIST_PROFILE_DJMAGO305.bio ?? '',
  legalFullName: LAB_ARTIST_PROFILE_DJMAGO305.fullName ?? '',
  email: LAB_ARTIST_PROFILE_DJMAGO305.email ?? '',
});

export const artistLabProfileStore = createArtistLabProfileStore(INITIAL_STATE);

/** Merges the store's editable fields onto the sealed lab DTO for the "Mi Perfil" read view. */
export function buildEffectiveArtistProfile(): ArtistProfileReadDTO {
  const state = artistLabProfileStore.getState();
  return Object.freeze({
    ...LAB_ARTIST_PROFILE_DJMAGO305,
    stageName: state.stageName,
    djName: state.stageName,
    city: state.city,
    socialLinks: state.socialLinks,
    bioEn: state.bio,
    fullName: state.legalFullName,
    email: state.email,
  });
}
