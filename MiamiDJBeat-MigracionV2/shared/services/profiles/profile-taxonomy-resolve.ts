/**
 * Profiles domain — pure taxonomy resolvers (read-only).
 * docs/V2/PROFILES-V1-V2-MAPPING-MATRIX.md §2 · PROFILE-TAXONOMY.md
 */

import type {
  ArtistCategory,
  ArtistProfileId,
  ArtistTier,
  ClientProfileId,
  ClientProfileType,
  StaffProfileId,
} from '../../permissions/runtime/types';
import type {
  ArtistTaxonomySignals,
  ClientTaxonomySignals,
  StaffTaxonomySignals,
} from './profiles.types';

const ARTIST_CATEGORY_TO_PROFILE: Readonly<Record<ArtistCategory, ArtistProfileId>> = Object.freeze({
  DJ: 'artist.dj',
  Singer: 'artist.singer_solo',
  Band: 'artist.band_group',
  MC: 'artist.mc_host',
  Musician: 'artist.musician',
  Dancer: 'artist.dancer_performer',
  Clown: 'artist.clown_kids',
  Other: 'artist.custom',
});

function normalizeToken(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

/**
 * Resolve Client taxonomy ID.
 * VIP from `buyer_vip` OR `buyer_billing_tier === 'vip'`.
 * Commercial requires explicit `isCommercial` (gap G1 — not in snapshot).
 * Priority: commercial > vip > regular (commercial VIP still commercial).
 */
export function resolveClientProfileId(signals: ClientTaxonomySignals): ClientProfileId {
  if (signals.isCommercial === true) {
    return 'client.commercial';
  }
  const tier = normalizeToken(signals.buyerBillingTier);
  if (signals.buyerVip === true || tier === 'vip') {
    return 'client.vip';
  }
  return 'client.regular';
}

export function resolveClientProfileType(profileId: ClientProfileId): ClientProfileType {
  if (profileId === 'client.vip') return 'vip';
  if (profileId === 'client.commercial') return 'commercial';
  return 'regular';
}

/**
 * Map snapshot / row `artist_tier` (0|1|2) → ArtistTier.
 * Null/undefined → Lite (safe default for performer context).
 */
export function mapArtistTierFromSnapshot(artistTier: number | null | undefined): ArtistTier {
  if (artistTier === 2) return 'Elite';
  if (artistTier === 1) return 'Pro';
  return 'Lite';
}

/**
 * Best-effort specialty → ArtistCategory (gap G3 — no V1 enum).
 * Unknown strings → DJ (roster default).
 */
export function resolveArtistCategoryFromSpecialty(
  specialty: string | null | undefined,
): ArtistCategory {
  const s = normalizeToken(specialty);
  if (!s) return 'DJ';
  if (/\b(singer|vocal|solo)\b/.test(s)) return 'Singer';
  if (/\b(band|orchestra|group)\b/.test(s)) return 'Band';
  if (/\b(mc|host|emcee)\b/.test(s)) return 'MC';
  if (/\b(musician|instrument|sax|guitar|piano)\b/.test(s)) return 'Musician';
  if (/\b(dancer|dance|performer)\b/.test(s)) return 'Dancer';
  if (/\b(clown|kids|children)\b/.test(s)) return 'Clown';
  if (/\b(other|custom)\b/.test(s)) return 'Other';
  if (/\bdj\b/.test(s) || s.includes('open format') || s.includes('latin')) return 'DJ';
  return 'DJ';
}

export function artistCategoryToProfileId(category: ArtistCategory): ArtistProfileId {
  return ARTIST_CATEGORY_TO_PROFILE[category];
}

export function resolveArtistTaxonomy(signals: ArtistTaxonomySignals): {
  readonly commercialTier: ArtistTier;
  readonly artistCategory: ArtistCategory;
  readonly artistProfileId: ArtistProfileId;
} {
  const commercialTier = mapArtistTierFromSnapshot(signals.artistTier);
  const artistCategory =
    signals.artistCategoryHint ||
    resolveArtistCategoryFromSpecialty(signals.artistSpecialty);
  const artistProfileId =
    signals.artistProfileIdHint || artistCategoryToProfileId(artistCategory);
  return Object.freeze({ commercialTier, artistCategory, artistProfileId });
}

/**
 * Staff role string → StaffProfileId (gap G2).
 * admin maps to manager band per PROFILE-TAXONOMY (Admin = management variant).
 */
export function resolveStaffProfileId(signals: StaffTaxonomySignals): StaffProfileId {
  const role = normalizeToken(signals.role);
  if (role === 'seller' || signals.profileKind === 'staff_seller') {
    return 'staff.seller';
  }
  if (role === 'owner') {
    return 'staff.owner';
  }
  if (role === 'manager' || role === 'admin') {
    return 'staff.manager';
  }
  if (signals.profileKind === 'staff_full') {
    return 'staff.manager';
  }
  return 'staff.seller';
}

export function staffIsManagement(profileId: StaffProfileId): boolean {
  return profileId === 'staff.owner' || profileId === 'staff.manager';
}

export function staffIsStaff(profileId: StaffProfileId): boolean {
  return (
    profileId === 'staff.owner' ||
    profileId === 'staff.manager' ||
    profileId === 'staff.seller'
  );
}
