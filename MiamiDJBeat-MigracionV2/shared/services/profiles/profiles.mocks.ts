/**
 * Profiles V2 — frozen read-model mocks for Vitest (Paso 2).
 * No network · no SQL · no mutations.
 */

import type {
  AccessSnapshotDTO,
  ArtistProfileReadDTO,
  ClientProfileReadDTO,
  PublicArtistCardDTO,
  StaffIdentityDTO,
} from './profiles.types';

export const MOCK_ACCESS_SNAPSHOT_BUYER: AccessSnapshotDTO = Object.freeze({
  ok: true,
  profileKind: 'buyer',
  artistTier: null,
  buyerVip: false,
  role: null,
  mdjbId: 'MDJB-TEST-0001-C',
  authUid: '00000000-0000-4000-8000-000000000001',
});

export const MOCK_ACCESS_SNAPSHOT_VIP: AccessSnapshotDTO = Object.freeze({
  ok: true,
  profileKind: 'buyer',
  artistTier: null,
  buyerVip: true,
  role: null,
  mdjbId: 'MDJB-TEST-0002-C',
  authUid: '00000000-0000-4000-8000-000000000002',
});

export const MOCK_ACCESS_SNAPSHOT_ARTIST_PRO: AccessSnapshotDTO = Object.freeze({
  ok: true,
  profileKind: 'artist',
  artistTier: 1,
  buyerVip: false,
  role: 'dj',
  mdjbId: 'MDJB-TEST-0003-A',
  authUid: '00000000-0000-4000-8000-000000000003',
});

export const MOCK_ACCESS_SNAPSHOT_STAFF_OWNER: AccessSnapshotDTO = Object.freeze({
  ok: true,
  profileKind: 'staff_full',
  artistTier: null,
  buyerVip: false,
  role: 'owner',
  mdjbId: 'MDJB-TEST-0004-M',
  authUid: '00000000-0000-4000-8000-000000000004',
});

export const MOCK_ACCESS_SNAPSHOT_FAILURE: AccessSnapshotDTO = Object.freeze({
  ok: false,
  reason: 'no_session',
});

export const MOCK_CLIENT_PROFILE_REGULAR: ClientProfileReadDTO = Object.freeze({
  userId: '00000000-0000-4000-8000-000000000001',
  profileId: 'client-profile-mock-1',
  fullName: 'Jane Client',
  email: 'jane@example.com',
  phone: null,
  username: 'janeclient',
  languagePreference: 'en',
  avatarUrl: null,
  photoUrl: null,
  city: 'Miami',
  addressStreet: null,
  addressApt: null,
  addressState: 'FL',
  addressZip: null,
  addressCountry: 'United States',
  billingSameAsHome: true,
  billingStreet: null,
  billingApt: null,
  billingCity: null,
  billingState: null,
  billingZip: null,
  billingCountry: null,
  billingNameOnCard: null,
  notifyEmailBookings: true,
  notifyEmailMarketing: false,
  notifySms: false,
  buyerBillingTier: 'none',
  buyerStripeCustomerId: null,
  loyaltyPoints: 0,
  totalEventsBooked: 0,
  discountEligible: true,
  sourceRef: null,
  isCommercial: false,
  companyName: null,
  venueType: null,
  mdjbId: 'MDJB-TEST-0001-C',
  clientProfileId: 'client.regular',
  clientProfileType: 'regular',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
});

export const MOCK_ARTIST_PROFILE_DJ_PRO: ArtistProfileReadDTO = Object.freeze({
  userId: '00000000-0000-4000-8000-000000000003',
  rowId: 'dj-profile-mock-1',
  role: 'dj',
  fullName: 'Gerardo A Valle',
  stageName: 'DJMago305',
  djName: 'DJMago305',
  username: 'djmago305',
  djSlug: 'djmago305',
  email: 'artist@example.com',
  commercialTier: 'Pro',
  artistProfileId: 'artist.dj',
  artistCategory: 'DJ',
  mdjbId: 'MDJB-TEST-0003-A',
  bio: null,
  bioEn: 'Miami open format',
  bioShort: 'Open Format · Latin',
  bioLong: null,
  photoUrl: null,
  backgroundUrl: null,
  photoFocalX: 50,
  photoFocalY: 50,
  heroBgZoom: 100,
  hourlyRateUsd: 150,
  artistSpecialty: 'Open Format · Latin',
  city: 'Miami',
  available: true,
  verified: true,
  rating: 4.9,
  reviewCount: 12,
  soundfortipsActive: true,
  sftOk: true,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
});

export const MOCK_PUBLIC_ARTIST_CARD: PublicArtistCardDTO = Object.freeze({
  userId: '00000000-0000-4000-8000-000000000003',
  stageName: 'DJMago305',
  djName: 'DJMago305',
  username: 'djmago305',
  djSlug: 'djmago305',
  photoUrl: null,
  bioShort: 'Open Format · Latin',
  city: 'Miami',
  artistSpecialty: 'Open Format · Latin',
  hourlyRateUsd: 150,
  rating: 4.9,
  reviewCount: 12,
  available: true,
  verified: true,
  artistCategory: 'DJ',
  commercialTier: 'Pro',
});

export const MOCK_STAFF_IDENTITY_OWNER: StaffIdentityDTO = Object.freeze({
  userId: '00000000-0000-4000-8000-000000000004',
  role: 'owner',
  staffProfileId: 'staff.owner',
  isStaff: true,
  isStaffManagement: true,
  mdjbId: 'MDJB-TEST-0004-M',
});
