/**
 * MOD-204 Slice 1 — Artist Profile Read ViewModel (pure).
 * READ-ONLY display projection from ArtistProfileReadDTO. No writers.
 */

import type { ArtistProfileReadDTO, ArtistSocialLinksDTO } from '../../shared/services/profiles/index';

export type ArtistProfileSftGateStatus = 'eligible' | 'not_eligible' | 'unknown';

export type ArtistSocialPlatform = 'instagram' | 'youtube' | 'spotify' | 'soundcloud' | 'mixcloud';

export type ArtistSocialLinkVM = {
  readonly platform: ArtistSocialPlatform;
  readonly label: string;
  readonly url: string;
};

const SOCIAL_PLATFORM_LABELS: Readonly<Record<ArtistSocialPlatform, string>> = Object.freeze({
  instagram: 'Instagram',
  youtube: 'YouTube',
  spotify: 'Spotify',
  soundcloud: 'SoundCloud',
  mixcloud: 'Mixcloud',
});

/** Simplified line-glyphs (not official brand marks) for the hero's floating icon row. */
export const SOCIAL_PLATFORM_ICON_SVG: Readonly<Record<ArtistSocialPlatform, string>> = Object.freeze({
  instagram:
    '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor"/></svg>',
  youtube:
    '<svg viewBox="0 0 24 24"><rect x="2.5" y="5.5" width="19" height="13" rx="3.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10.2 9.3v5.4l4.9-2.7z" fill="currentColor"/></svg>',
  spotify:
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6.8 10.2c3.4-1 7-.7 10 1M7.2 13c2.8-.75 5.7-.5 8.2.85M7.6 15.7c2.3-.55 4.6-.4 6.6.7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  soundcloud:
    '<svg viewBox="0 0 24 24"><path d="M3.5 14.5v3M6 12.5v5M8.5 11v6.5M11 12.2v5.3M13.5 9.5v8h6.2a3 3 0 0 0 .3-6c-.35-2.3-2.3-4-4.5-4-1.15 0-2.2.45-3 1.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  mixcloud:
    '<svg viewBox="0 0 24 24"><path d="M3 14c1.6-3.4 3.2-3.4 4.8 0 1.6-5.4 3.2-5.4 4.8 0 1.6-3.4 3.2-3.4 4.8 0 1.6-3.4 3.2-3.4 4.6 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
});

/** Hero "share profile" icon — always shown, independent of linked platforms. */
export const SOCIAL_SHARE_ICON_SVG =
  '<svg viewBox="0 0 24 24"><circle cx="18" cy="5.5" r="2.3" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="6" cy="12" r="2.3" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="18" cy="18.5" r="2.3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 10.8l8-4.2M8 13.2l8 4.2" stroke="currentColor" stroke-width="1.5"/></svg>';

export type ArtistProfileReadViewModel = {
  readonly stageName: string;
  readonly djName: string | null;
  readonly usernameHandle: string | null;
  readonly mdjbId: string | null;
  readonly commercialTierLabel: string;
  readonly artistCategoryLabel: string;
  readonly sftGateStatus: ArtistProfileSftGateStatus;
  readonly sftGateLabel: string;
  readonly soundfortipsBoothLabel: string;
  /** Owner-only PII — never treat as public brand. */
  readonly legalFullName: string | null;
  readonly emailPrivate: string | null;
  readonly bioPrimary: string | null;
  readonly bioEn: string | null;
  readonly bioShort: string | null;
  readonly bioLong: string | null;
  readonly residencyCity: string | null;
  readonly specialty: string | null;
  readonly availableLabel: string | null;
  readonly verifiedLabel: string | null;
  readonly ratingLabel: string | null;
  readonly photoUrl: string | null;
  readonly backgroundUrl: string | null;
  readonly hourlyRateLabel: string | null;
  readonly socialLinksAvailable: boolean;
  readonly socialLinks: readonly ArtistSocialLinkVM[];
};

function displayOrNull(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : null;
}

function resolveSftGate(profile: ArtistProfileReadDTO): {
  readonly status: ArtistProfileSftGateStatus;
  readonly label: string;
} {
  if (profile.sftOk === true) {
    return { status: 'eligible', label: 'SFT eligible (PRO gate OK)' };
  }
  if (profile.sftOk === false) {
    return { status: 'not_eligible', label: 'SFT not eligible' };
  }
  if (profile.commercialTier === 'Pro' || profile.commercialTier === 'Elite') {
    return { status: 'eligible', label: 'SFT eligible (tier Pro/Elite)' };
  }
  if (profile.commercialTier === 'Lite') {
    return { status: 'not_eligible', label: 'SFT locked (Lite)' };
  }
  return { status: 'unknown', label: 'SFT status unknown' };
}

function boolLabel(value: boolean | null, yes: string, no: string): string | null {
  if (value === true) return yes;
  if (value === false) return no;
  return null;
}

/** Filters to only the platforms the artist actually linked — no blank/placeholder entries. */
export function resolveSocialLinks(
  links: ArtistSocialLinksDTO | null,
): readonly ArtistSocialLinkVM[] {
  if (!links) return [];
  const platforms: readonly ArtistSocialPlatform[] = [
    'instagram',
    'youtube',
    'spotify',
    'soundcloud',
    'mixcloud',
  ];
  const resolved: ArtistSocialLinkVM[] = [];
  for (const platform of platforms) {
    const url = displayOrNull(links[platform]);
    if (url) resolved.push({ platform, label: SOCIAL_PLATFORM_LABELS[platform], url });
  }
  return Object.freeze(resolved);
}

/**
 * Pure mapper — ArtistProfileReadDTO → display strings for MOD-204 Slice 1.
 */
export function toArtistProfileReadViewModel(
  profile: ArtistProfileReadDTO,
): ArtistProfileReadViewModel {
  const stage =
    displayOrNull(profile.stageName) ??
    displayOrNull(profile.djName) ??
    displayOrNull(profile.username) ??
    'Artist';
  const sft = resolveSftGate(profile);
  const username = displayOrNull(profile.username);
  const socialLinks = resolveSocialLinks(profile.socialLinks);
  const rating =
    profile.rating != null
      ? `${profile.rating.toFixed(1)}${
          profile.reviewCount != null ? ` · ${profile.reviewCount} reviews` : ''
        }`
      : null;

  return Object.freeze({
    stageName: stage,
    djName: displayOrNull(profile.djName),
    usernameHandle: username ? `@${username.replace(/^@/, '')}` : null,
    mdjbId: displayOrNull(profile.mdjbId),
    commercialTierLabel: profile.commercialTier,
    artistCategoryLabel: profile.artistCategory,
    sftGateStatus: sft.status,
    sftGateLabel: sft.label,
    soundfortipsBoothLabel:
      boolLabel(profile.soundfortipsActive, 'Booth active', 'Booth inactive') ?? 'Booth unknown',
    legalFullName: displayOrNull(profile.fullName),
    emailPrivate: displayOrNull(profile.email),
    bioPrimary:
      displayOrNull(profile.bioEn) ??
      displayOrNull(profile.bio) ??
      displayOrNull(profile.bioShort) ??
      displayOrNull(profile.bioLong),
    bioEn: displayOrNull(profile.bioEn),
    bioShort: displayOrNull(profile.bioShort),
    bioLong: displayOrNull(profile.bioLong),
    residencyCity: displayOrNull(profile.city),
    specialty: displayOrNull(profile.artistSpecialty),
    availableLabel: boolLabel(profile.available, 'Available', 'Unavailable'),
    verifiedLabel: boolLabel(profile.verified, 'Verified', 'Unverified'),
    ratingLabel: rating,
    photoUrl: displayOrNull(profile.photoUrl),
    backgroundUrl: displayOrNull(profile.backgroundUrl),
    hourlyRateLabel:
      profile.hourlyRateUsd != null ? `$${profile.hourlyRateUsd.toFixed(0)} / hr` : null,
    socialLinksAvailable: socialLinks.length > 0,
    socialLinks,
  });
}
