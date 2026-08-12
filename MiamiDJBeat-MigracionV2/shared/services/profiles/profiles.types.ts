/**
 * Profiles V2 — Read Model DTOs (Paso 2).
 * Canonical matrix: docs/V2/PROFILES-V1-V2-MAPPING-MATRIX.md
 * Taxonomy: docs/V2/PROFILE-TAXONOMY.md
 *
 * READ-ONLY: no writers, no SQL, no RLS changes.
 * Lab only: http://localhost:5173
 */

import type {
  ArtistCategory,
  ArtistProfileId,
  ArtistTier,
  ClientProfileId,
  ClientProfileType,
  StaffProfileId,
} from '../../permissions/runtime/types';

/** Buyer billing tier as stored on `client_profiles.buyer_billing_tier`. */
export type BuyerBillingTier = 'none' | 'vip' | (string & {});

/** Commercial `venue_type` values (V1 commercial migration). */
export type ClientVenueType =
  | 'nightclub'
  | 'lounge'
  | 'banquet_hall'
  | 'rooftop'
  | 'hotel'
  | 'restaurant'
  | 'venue_rental'
  | 'other'
  | (string & {});

/** `mdj_access_snapshot.profile_kind` values. */
export type AccessSnapshotProfileKind =
  | 'buyer'
  | 'artist'
  | 'staff_seller'
  | 'staff_full'
  | 'unknown';

/**
 * AccessSnapshotDTO — domain read model for `public.mdj_access_snapshot()`.
 * CamelCase projection of the RPC JSON (matrix §3). Not a writer.
 */
export type AccessSnapshotSuccessDTO = {
  readonly ok: true;
  readonly profileKind: AccessSnapshotProfileKind;
  readonly artistTier: number | null;
  readonly buyerVip: boolean;
  readonly role: string | null;
  readonly mdjbId: string | null;
  readonly authUid: string | null;
};

export type AccessSnapshotFailureDTO = {
  readonly ok: false;
  readonly reason: string;
};

export type AccessSnapshotDTO = AccessSnapshotSuccessDTO | AccessSnapshotFailureDTO;

/**
 * ClientProfileReadDTO — MOD-103 · `public.client_profiles`.
 */
export type ClientProfileReadDTO = {
  readonly userId: string;
  readonly profileId: string | null;
  readonly fullName: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly username: string | null;
  readonly languagePreference: string | null;
  readonly avatarUrl: string | null;
  readonly photoUrl: string | null;
  readonly city: string | null;
  readonly addressStreet: string | null;
  readonly addressApt: string | null;
  readonly addressState: string | null;
  readonly addressZip: string | null;
  readonly addressCountry: string | null;
  readonly billingSameAsHome: boolean | null;
  readonly billingStreet: string | null;
  readonly billingApt: string | null;
  readonly billingCity: string | null;
  readonly billingState: string | null;
  readonly billingZip: string | null;
  readonly billingCountry: string | null;
  readonly billingNameOnCard: string | null;
  readonly notifyEmailBookings: boolean | null;
  readonly notifyEmailMarketing: boolean | null;
  readonly notifySms: boolean | null;
  readonly buyerBillingTier: BuyerBillingTier | null;
  readonly buyerStripeCustomerId: string | null;
  readonly loyaltyPoints: number | null;
  readonly totalEventsBooked: number | null;
  readonly discountEligible: boolean | null;
  readonly sourceRef: string | null;
  readonly isCommercial: boolean | null;
  readonly companyName: string | null;
  readonly venueType: ClientVenueType | null;
  readonly mdjbId: string | null;
  readonly clientProfileId: ClientProfileId;
  readonly clientProfileType: ClientProfileType;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
};

/**
 * ArtistSocialLinksDTO — MOD-213 · `public.dj_profiles` social handles.
 * Each field is a full URL or null when the artist hasn't linked that
 * platform. Optional/nullable on the parent DTO — artists created before
 * this field existed simply carry `socialLinks: null`.
 */
export type ArtistSocialLinksDTO = {
  readonly instagram: string | null;
  readonly youtube: string | null;
  readonly spotify: string | null;
  readonly soundcloud: string | null;
  readonly mixcloud: string | null;
};

/**
 * ArtistProfileReadDTO — MOD-204 owner · `public.dj_profiles`.
 * `fullName` = legal; `stageName` / `djName` = artistic brand.
 */
export type ArtistProfileReadDTO = {
  readonly userId: string;
  readonly rowId: string | null;
  readonly role: string | null;
  readonly fullName: string | null;
  readonly stageName: string | null;
  readonly djName: string | null;
  readonly username: string | null;
  readonly djSlug: string | null;
  readonly email: string | null;
  readonly commercialTier: ArtistTier;
  readonly artistProfileId: ArtistProfileId;
  readonly artistCategory: ArtistCategory;
  readonly mdjbId: string | null;
  readonly bio: string | null;
  readonly bioEn: string | null;
  readonly bioShort: string | null;
  readonly bioLong: string | null;
  readonly photoUrl: string | null;
  readonly backgroundUrl: string | null;
  readonly photoFocalX: number | null;
  readonly photoFocalY: number | null;
  readonly heroBgZoom: number | null;
  readonly hourlyRateUsd: number | null;
  readonly artistSpecialty: string | null;
  readonly city: string | null;
  readonly available: boolean | null;
  readonly verified: boolean | null;
  readonly rating: number | null;
  readonly reviewCount: number | null;
  readonly soundfortipsActive: boolean | null;
  readonly sftOk: boolean | null;
  readonly socialLinks: ArtistSocialLinksDTO | null;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
};

/**
 * PublicArtistCardDTO — roster / `public.public_dj_profiles` (no billing PII).
 */
export type PublicArtistCardDTO = {
  readonly userId: string;
  readonly stageName: string | null;
  readonly djName: string | null;
  readonly username: string | null;
  readonly djSlug: string | null;
  readonly photoUrl: string | null;
  readonly bioShort: string | null;
  readonly city: string | null;
  readonly artistSpecialty: string | null;
  readonly hourlyRateUsd: number | null;
  readonly rating: number | null;
  readonly reviewCount: number | null;
  readonly available: boolean | null;
  readonly verified: boolean | null;
  readonly artistCategory: ArtistCategory;
  readonly commercialTier: ArtistTier | null;
};

/**
 * StaffIdentityDTO — Staff portal shell identity.
 */
export type StaffIdentityDTO = {
  readonly userId: string;
  readonly role: string | null;
  readonly staffProfileId: StaffProfileId;
  readonly isStaff: boolean;
  readonly isStaffManagement: boolean;
  readonly mdjbId: string | null;
};

/** Signals for Client taxonomy resolution (no DB I/O). */
export type ClientTaxonomySignals = {
  readonly buyerBillingTier?: string | null;
  readonly buyerVip?: boolean | null;
  readonly isCommercial?: boolean | null;
};

/** Signals for Staff taxonomy resolution. */
export type StaffTaxonomySignals = {
  readonly role?: string | null;
  readonly profileKind?: 'staff_seller' | 'staff_full' | string | null;
};

/** Signals for Artist taxonomy resolution. */
export type ArtistTaxonomySignals = {
  readonly artistTier?: number | null;
  readonly artistSpecialty?: string | null;
  readonly artistCategoryHint?: ArtistCategory | null;
  readonly artistProfileIdHint?: ArtistProfileId | null;
};

/** Loose RPC JSON shape — read-only projection input (not a Supabase client). */
export type AccessSnapshotRpcPayload = {
  readonly ok: boolean;
  readonly reason?: unknown;
  readonly profile_kind?: unknown;
  readonly artist_tier?: unknown;
  readonly buyer_vip?: unknown;
  readonly role?: unknown;
  readonly mdjb_id?: unknown;
  readonly auth_uid?: unknown;
};
