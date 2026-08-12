/**
 * V2 lab — STRICT per-role profile assets (no cross-reuse).
 *
 * Artist  → DJMago305 artistic hero + avatar
 * Owner   → corporate eagle + Gerardo directive portrait (NOT artistic hero)
 * Client  → Wendy Ayala avatar
 *
 * Fallback order: remoteUrl → local /v1/assets/profiles/* → placeholder
 */

const V1 = '/v1';

/** Artist (DJMago305) — artistic set only */
export const MDJ_V1_PROFILE_DJMAGO305_AVATAR = `${V1}/assets/profiles/djmago305-avatar.png`;
export const MDJ_V1_PROFILE_DJMAGO305_HERO = `${V1}/assets/profiles/djmago305-hero-cover.jpg`;

/** Owner (Gerardo A Valle) — Miami DJ Beat LLC */
/** Header/avatar: formal face portrait (navy shirt) — production CONFIG/MI PERFIL. */
export const MDJ_V1_PROFILE_GERARDO_AVATAR = `${V1}/assets/profiles/gerardo-a-valle-owner-portrait.png`;
/** Hero banner: Águila Dorada + MIAMI DJ BEAT / ENTERTAINMENT & EVENTS (centered). */
export const MDJ_V1_PROFILE_GERARDO_EAGLE_BANNER = `${V1}/assets/profiles/gerardo-a-valle-owner-banner.png`;
/** Seal-only asset (not used as avatar). */
export const MDJ_V1_PROFILE_GERARDO_EAGLE_SEAL = `${V1}/assets/profiles/gerardo-a-valle-owner-eagle.png`;
/** Provenance alias for portrait. */
export const MDJ_V1_PROFILE_GERARDO_PORTRAIT = MDJ_V1_PROFILE_GERARDO_AVATAR;

/** Client (Wendy E Ayala) */
export const MDJ_V1_PROFILE_WENDY_AVATAR = `${V1}/assets/profiles/wendy-ayala-avatar.png`;

/** Brand / HTML defaults */
export const MDJ_V1_ASSET_AVATAR_PLACEHOLDER = `${V1}/assets/dj-avatar-placeholder.png`;
export const MDJ_V1_ASSET_EAGLE = `${V1}/assets/branding/logo-transparent.png`;
export const MDJ_V1_ASSET_LETTERS = `${V1}/assets/branding/logo-transparent%20Letras.png`;

/** Production Storage references (provenance) */
export const MDJ_V1_SUPABASE_DJMAGO305_AVATAR =
  'https://hkuvuqupbxwkiykxvqdr.supabase.co/storage/v1/object/public/avatars/3f5d5196-273c-458e-a4af-6b3545422177/avatar.png';
export const MDJ_V1_SUPABASE_DJMAGO305_HERO =
  'https://hkuvuqupbxwkiykxvqdr.supabase.co/storage/v1/object/public/avatars/3f5d5196-273c-458e-a4af-6b3545422177/hero-cover.jpg';
export const MDJ_V1_SUPABASE_WENDY_AVATAR =
  'https://hkuvuqupbxwkiykxvqdr.supabase.co/storage/v1/object/public/avatars/5fa2fb78-7f03-4091-baad-4ded37cb5e58/avatar.png';

/** @deprecated aliases — Miami DJ Beat LLC assets only */
export const MDJ_V1_LAB_PORTRAIT = MDJ_V1_PROFILE_DJMAGO305_AVATAR;
export const MDJ_V1_LAB_EAGLE = MDJ_V1_ASSET_EAGLE;
export const MDJ_V1_LAB_LETTERS = MDJ_V1_ASSET_LETTERS;
/** @deprecated — owner no longer uses artistic hero cover */
export const MDJ_V1_PROFILE_GERARDO_HERO = MDJ_V1_PROFILE_GERARDO_EAGLE_BANNER;

export type ProfileImageKind = 'avatar' | 'hero';
export type ProfileSubject = 'artist' | 'owner' | 'client';

export type ResolveProfileImageInput = {
  readonly kind: ProfileImageKind;
  readonly subject: ProfileSubject;
  readonly remoteUrl?: string | null;
};

/**
 * Prefer remote Supabase URL when present; else role-local clone asset; else placeholder.
 * Owner hero → corporate eagle only (never DJMago305 artistic cover).
 */
export function resolveProfileImageSrc(input: ResolveProfileImageInput): string {
  const remote = typeof input.remoteUrl === 'string' ? input.remoteUrl.trim() : '';
  if (remote.startsWith('http://') || remote.startsWith('https://') || remote.startsWith('/')) {
    return remote;
  }

  if (input.subject === 'client') {
    return input.kind === 'hero' ? MDJ_V1_ASSET_AVATAR_PLACEHOLDER : MDJ_V1_PROFILE_WENDY_AVATAR;
  }

  if (input.subject === 'owner') {
    return input.kind === 'hero' ? MDJ_V1_PROFILE_GERARDO_EAGLE_BANNER : MDJ_V1_PROFILE_GERARDO_AVATAR;
  }

  /* artist */
  return input.kind === 'hero' ? MDJ_V1_PROFILE_DJMAGO305_HERO : MDJ_V1_PROFILE_DJMAGO305_AVATAR;
}

export type LabPortalSessionLabel = {
  readonly displayName: string;
  readonly profileHref: string;
};

export function labSessionLabelForPortal(
  portal: 'client' | 'artist' | 'staff',
): LabPortalSessionLabel {
  if (portal === 'client') {
    return { displayName: 'Wendy', profileHref: '/client/' };
  }
  if (portal === 'staff') {
    return { displayName: 'Gerardo A Valle', profileHref: '/staff/' };
  }
  return { displayName: 'DJMago305', profileHref: '/artist/' };
}
