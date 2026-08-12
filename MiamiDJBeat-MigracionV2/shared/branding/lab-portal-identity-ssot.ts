/**
 * Lab Portal Identity — Single Source of Truth (SSOT).
 *
 * Mirrors V1 session hydration (mdj-shared-header.js + dj_profiles / client_profiles):
 *   displayName  ← stage_name | full_name (role-aware)
 *   photoUrl     ← dj_profiles.photo_url | client_profiles.avatar_url/photo_url
 *   backgroundUrl← dj_profiles.background_url (artist) | corporate eagle (owner)
 *
 * Production-aligned lab fixtures (offline copies under /v1/assets/profiles/).
 * Layouts / header MUST read from getLabPortalIdentity() — no ad-hoc image paths.
 */

import {
  MDJ_V1_PROFILE_DJMAGO305_AVATAR,
  MDJ_V1_PROFILE_DJMAGO305_HERO,
  MDJ_V1_PROFILE_GERARDO_AVATAR,
  MDJ_V1_PROFILE_GERARDO_EAGLE_BANNER,
  MDJ_V1_PROFILE_WENDY_AVATAR,
} from './v1-lab-assets';

export type LabPortalKind = 'artist' | 'staff' | 'client';

/**
 * V1-shaped identity row used by header + hero chrome.
 * Field names intentionally mirror production profile columns.
 */
export type LabPortalIdentitySSOT = {
  readonly portal: LabPortalKind;
  /** Header label (V1 displayName). */
  readonly displayName: string;
  /** Legal / formal name (certificates, owner). */
  readonly legalName: string;
  /** Artistic stage name (artist only). */
  readonly stageName: string | null;
  /** dj_profiles.photo_url / client avatar. */
  readonly photoUrl: string;
  /** dj_profiles.background_url OR owner corporate mark. */
  readonly backgroundUrl: string;
  readonly role: string;
  readonly username: string;
  readonly mdjbId: string;
  readonly userId: string;
  readonly email: string;
};

/** Artist Backstage — DJMago305 (public_dj_profiles · dj_slug=djmago305). */
export const LAB_IDENTITY_ARTIST_DJMAGO305: LabPortalIdentitySSOT = Object.freeze({
  portal: 'artist',
  displayName: 'DJMago305',
  legalName: 'Gerardo A Valle',
  stageName: 'DJMago305',
  photoUrl: MDJ_V1_PROFILE_DJMAGO305_AVATAR,
  backgroundUrl: MDJ_V1_PROFILE_DJMAGO305_HERO,
  role: 'dj',
  username: 'djmago305',
  mdjbId: 'MDJB-TEST-0003-A',
  userId: '3f5d5196-273c-458e-a4af-6b3545422177',
  email: 'artist@example.com',
});

/**
 * Staff / Owner — Gerardo A Valle (Miami DJ Beat LLC).
 * photo_url  = formal face portrait (navy shirt) — gerardo-a-valle-owner-portrait.png
 * background_url = corporate banner (eagle + MIAMI DJ BEAT / ENTERTAINMENT & EVENTS)
 * Forbidden: seals/logos as avatar, headphones DJ shots, MDJPRO marks.
 */
export const LAB_IDENTITY_STAFF_OWNER_GERARDO: LabPortalIdentitySSOT = Object.freeze({
  portal: 'staff',
  displayName: 'Gerardo A Valle',
  legalName: 'Gerardo A Valle',
  stageName: null,
  photoUrl: MDJ_V1_PROFILE_GERARDO_AVATAR,
  backgroundUrl: MDJ_V1_PROFILE_GERARDO_EAGLE_BANNER,
  role: 'owner',
  username: 'gerardo',
  mdjbId: 'MDJB-TEST-0004-M',
  userId: '00000000-0000-4000-8000-000000000004',
  email: 'owner@miamidjbeat.com',
});

/** Client — Wendy E Ayala (client_profiles · username Wendy). */
export const LAB_IDENTITY_CLIENT_WENDY: LabPortalIdentitySSOT = Object.freeze({
  portal: 'client',
  displayName: 'Wendy',
  legalName: 'Wendy E Ayala',
  stageName: null,
  photoUrl: MDJ_V1_PROFILE_WENDY_AVATAR,
  backgroundUrl: MDJ_V1_PROFILE_WENDY_AVATAR,
  role: 'client',
  username: 'Wendy',
  mdjbId: 'MDJB-WENDY-C',
  userId: '5fa2fb78-7f03-4091-baad-4ded37cb5e58',
  email: 'wendyeayala@hotmail.com',
});

export function getLabPortalIdentity(portal: LabPortalKind): LabPortalIdentitySSOT {
  if (portal === 'staff') return LAB_IDENTITY_STAFF_OWNER_GERARDO;
  if (portal === 'client') return LAB_IDENTITY_CLIENT_WENDY;
  return LAB_IDENTITY_ARTIST_DJMAGO305;
}
