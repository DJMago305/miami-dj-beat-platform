/**
 * MOD-204 Slice 1 — Artist Profile Read ViewModel (pure).
 * READ-ONLY display projection from ArtistProfileReadDTO. No writers.
 */

import type { ArtistProfileReadDTO } from '../../shared/services/profiles/index';

export type ArtistProfileSftGateStatus = 'eligible' | 'not_eligible' | 'unknown';

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
  /** Social URLs not yet on DTO — Slice 1 shows empty state. */
  readonly socialLinksAvailable: false;
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
    socialLinksAvailable: false,
  });
}
