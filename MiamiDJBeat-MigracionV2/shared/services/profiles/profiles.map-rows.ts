/**
 * Profiles — map PostgREST rows → Read DTOs (Paso 3, read-only).
 */

import {
  resolveArtistTaxonomy,
  resolveClientProfileId,
  resolveClientProfileType,
  resolveStaffProfileId,
  staffIsManagement,
  staffIsStaff,
} from './profile-taxonomy-resolve';
import type {
  ArtistProfileReadDTO,
  ClientProfileReadDTO,
  PublicArtistCardDTO,
  StaffIdentityDTO,
} from './profiles.types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function firstRestRow(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) {
    const first = data[0];
    return isRecord(first) ? first : null;
  }
  return isRecord(data) ? data : null;
}

function asString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function asNumber(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value;
  return null;
}

export function mapClientProfileRow(row: Record<string, unknown>): ClientProfileReadDTO {
  const buyerBillingTier = asString(row.buyer_billing_tier);
  const isCommercial = asBoolean(row.is_commercial);
  const clientProfileId = resolveClientProfileId({
    buyerBillingTier,
    isCommercial,
  });
  return Object.freeze({
    userId: asString(row.user_id) ?? '',
    profileId: asString(row.id),
    fullName: asString(row.full_name),
    email: asString(row.email),
    phone: asString(row.phone),
    username: asString(row.username),
    languagePreference: asString(row.language_preference),
    avatarUrl: asString(row.avatar_url),
    photoUrl: asString(row.photo_url),
    city: asString(row.city),
    addressStreet: asString(row.address_street),
    addressApt: asString(row.address_apt),
    addressState: asString(row.address_state),
    addressZip: asString(row.address_zip),
    addressCountry: asString(row.address_country),
    billingSameAsHome: asBoolean(row.billing_same_as_home),
    billingStreet: asString(row.billing_street),
    billingApt: asString(row.billing_apt),
    billingCity: asString(row.billing_city),
    billingState: asString(row.billing_state),
    billingZip: asString(row.billing_zip),
    billingCountry: asString(row.billing_country),
    billingNameOnCard: asString(row.billing_name_on_card),
    notifyEmailBookings: asBoolean(row.notify_email_bookings),
    notifyEmailMarketing: asBoolean(row.notify_email_marketing),
    notifySms: asBoolean(row.notify_sms),
    buyerBillingTier,
    buyerStripeCustomerId: asString(row.buyer_stripe_customer_id),
    loyaltyPoints: asNumber(row.loyalty_points),
    totalEventsBooked: asNumber(row.total_events_booked),
    discountEligible: asBoolean(row.discount_eligible),
    sourceRef: asString(row.source_ref),
    isCommercial,
    companyName: asString(row.company_name),
    venueType: asString(row.venue_type),
    mdjbId: null,
    clientProfileId,
    clientProfileType: resolveClientProfileType(clientProfileId),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  });
}

export function mapArtistProfileRow(
  row: Record<string, unknown>,
  opts?: { readonly artistTier?: number | null; readonly mdjbId?: string | null; readonly sftOk?: boolean | null },
): ArtistProfileReadDTO {
  const specialty = asString(row.artist_specialty);
  const taxonomy = resolveArtistTaxonomy({
    artistTier: opts?.artistTier ?? null,
    artistSpecialty: specialty,
  });
  return Object.freeze({
    userId: asString(row.user_id) ?? '',
    rowId: asString(row.id),
    role: asString(row.role),
    fullName: asString(row.full_name),
    stageName: asString(row.stage_name),
    djName: asString(row.dj_name),
    username: asString(row.username),
    djSlug: asString(row.dj_slug),
    email: asString(row.email),
    commercialTier: taxonomy.commercialTier,
    artistProfileId: taxonomy.artistProfileId,
    artistCategory: taxonomy.artistCategory,
    mdjbId: opts?.mdjbId ?? null,
    bio: asString(row.bio),
    bioEn: asString(row.bio_en),
    bioShort: asString(row.bio_short),
    bioLong: asString(row.bio_long),
    photoUrl: asString(row.photo_url),
    backgroundUrl: asString(row.background_url),
    photoFocalX: asNumber(row.photo_focal_x),
    photoFocalY: asNumber(row.photo_focal_y),
    heroBgZoom: asNumber(row.hero_bg_zoom),
    hourlyRateUsd: asNumber(row.hourly_rate_usd),
    artistSpecialty: specialty,
    city: asString(row.city),
    available: asBoolean(row.available),
    verified: asBoolean(row.verified),
    rating: asNumber(row.rating),
    reviewCount: asNumber(row.review_count),
    soundfortipsActive: asBoolean(row.soundfortips_active),
    sftOk: opts?.sftOk ?? null,
    /* MOD-213 — real dj_profiles social-handle columns not confirmed/wired
       yet; null here until that mapping is explicitly authorized. Lab
       fixtures populate this field directly for local UI development
       (see artist/profile/artist-profile-read-fixtures.ts). */
    socialLinks: null,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  });
}

export function mapPublicArtistCardRow(row: Record<string, unknown>): PublicArtistCardDTO {
  const specialty = asString(row.artist_specialty);
  const taxonomy = resolveArtistTaxonomy({ artistSpecialty: specialty });
  return Object.freeze({
    userId: asString(row.user_id) ?? '',
    stageName: asString(row.stage_name),
    djName: asString(row.dj_name),
    username: asString(row.username),
    djSlug: asString(row.dj_slug),
    photoUrl: asString(row.photo_url),
    bioShort: asString(row.bio_short) ?? asString(row.bio),
    city: asString(row.city),
    artistSpecialty: specialty,
    hourlyRateUsd: asNumber(row.hourly_rate_usd),
    rating: asNumber(row.rating),
    reviewCount: asNumber(row.review_count),
    available: asBoolean(row.available),
    verified: asBoolean(row.verified),
    artistCategory: taxonomy.artistCategory,
    commercialTier: null,
  });
}

export function mapStaffIdentityFromRole(
  userId: string,
  role: string | null,
  mdjbId: string | null,
  profileKind?: string | null,
): StaffIdentityDTO {
  const staffProfileId = resolveStaffProfileId({ role, profileKind });
  return Object.freeze({
    userId,
    role,
    staffProfileId,
    isStaff: staffIsStaff(staffProfileId),
    isStaffManagement: staffIsManagement(staffProfileId),
    mdjbId,
  });
}
