/**
 * profiles.service.spec.ts — Paso 3 read-only service tests (mocked data port).
 */
import { describe, expect, it, vi } from 'vitest';
import type { ApiMetadata, ApiResponse } from '../../shared/api/runtime';
import { createStaticSessionReader } from '../../shared/api/runtime';
import {
  MOCK_ACCESS_SNAPSHOT_ARTIST_PRO,
  MOCK_ACCESS_SNAPSHOT_BUYER,
  MOCK_ARTIST_PROFILE_DJ_PRO,
  MOCK_CLIENT_PROFILE_REGULAR,
  MOCK_PUBLIC_ARTIST_CARD,
} from '../../shared/services/profiles/profiles.mocks';
import { createProfilesService, type ProfilesDataPort } from '../../shared/services/profiles/profiles.service';

const meta: ApiMetadata = Object.freeze({
  requestId: 'req_profiles',
  correlationId: 'corr_profiles',
  durationMs: 1,
  attempt: 1,
  context: Object.freeze({
    requestId: 'req_profiles',
    correlationId: 'corr_profiles',
    portal: 'client' as const,
    sessionId: 'ses_1',
    actorType: 'authenticated',
  }),
});

function ok<T>(data: T): ApiResponse<T> {
  return Object.freeze({ ok: true, status: 200, data, metadata: meta });
}

function createPort(partial: Partial<ProfilesDataPort>): ProfilesDataPort {
  return Object.freeze({
    invokeAccessSnapshot: vi.fn(async () =>
      ok({
        ok: true,
        profile_kind: 'buyer',
        buyer_vip: false,
        artist_tier: null,
        role: null,
        mdjb_id: MOCK_ACCESS_SNAPSHOT_BUYER.ok ? MOCK_ACCESS_SNAPSHOT_BUYER.mdjbId : null,
        auth_uid: 'uid-1',
      }),
    ),
    selectOwnDjProfile: vi.fn(async () => ok([])),
    selectOwnClientProfile: vi.fn(async () => ok([])),
    selectPublicArtistByHandle: vi.fn(async () => ok([])),
    ...partial,
  });
}

describe('profiles.service — fetchOwnAccessSnapshot', () => {
  it('requires session', async () => {
    const guest = createStaticSessionReader({
      portal: 'client',
      sessionId: null,
      authorizationHeader: null,
      actorType: 'guest',
    });
    const service = createProfilesService({
      dataPort: createPort({}),
      sessionReader: guest,
    });
    const result = await service.fetchOwnAccessSnapshot();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.details).toBe('PROFILES_SESSION_REQUIRED');
    }
  });

  it('maps RPC payload to AccessSnapshotDTO', async () => {
    const session = createStaticSessionReader({
      portal: 'artist',
      sessionId: 'ses_1',
      authorizationHeader: 'Bearer test',
      actorType: 'authenticated',
    });
    const service = createProfilesService({
      dataPort: createPort({
        invokeAccessSnapshot: vi.fn(async () =>
          ok({
            ok: true,
            profile_kind: 'artist',
            artist_tier: 1,
            buyer_vip: false,
            role: 'dj',
            mdjb_id: MOCK_ACCESS_SNAPSHOT_ARTIST_PRO.ok
              ? MOCK_ACCESS_SNAPSHOT_ARTIST_PRO.mdjbId
              : null,
            auth_uid: 'uid-artist',
          }),
        ),
      }),
      sessionReader: session,
    });
    const result = await service.fetchOwnAccessSnapshot();
    expect(result.ok).toBe(true);
    if (result.ok && result.data.ok) {
      expect(result.data.profileKind).toBe('artist');
      expect(result.data.artistTier).toBe(1);
      expect(result.data.mdjbId).toBe(
        MOCK_ACCESS_SNAPSHOT_ARTIST_PRO.ok ? MOCK_ACCESS_SNAPSHOT_ARTIST_PRO.mdjbId : null,
      );
    }
  });
});

describe('profiles.service — fetchOwnClientProfile', () => {
  it('maps client_profiles row + mdjb from snapshot', async () => {
    const session = createStaticSessionReader({
      portal: 'client',
      sessionId: 'ses_1',
      authorizationHeader: 'Bearer test',
      actorType: 'authenticated',
    });
    const service = createProfilesService({
      dataPort: createPort({
        selectOwnClientProfile: vi.fn(async () =>
          ok([
            {
              id: MOCK_CLIENT_PROFILE_REGULAR.profileId,
              user_id: MOCK_CLIENT_PROFILE_REGULAR.userId,
              full_name: MOCK_CLIENT_PROFILE_REGULAR.fullName,
              email: MOCK_CLIENT_PROFILE_REGULAR.email,
              phone: null,
              username: MOCK_CLIENT_PROFILE_REGULAR.username,
              language_preference: 'en',
              avatar_url: null,
              photo_url: null,
              city: 'Miami',
              address_street: null,
              address_apt: null,
              address_state: 'FL',
              address_zip: null,
              address_country: 'United States',
              billing_same_as_home: true,
              billing_street: null,
              billing_apt: null,
              billing_city: null,
              billing_state: null,
              billing_zip: null,
              billing_country: null,
              billing_name_on_card: null,
              notify_email_bookings: true,
              notify_email_marketing: false,
              notify_sms: false,
              buyer_billing_tier: 'none',
              buyer_stripe_customer_id: null,
              loyalty_points: 0,
              total_events_booked: 0,
              discount_eligible: true,
              source_ref: null,
              is_commercial: false,
              company_name: null,
              venue_type: null,
              created_at: MOCK_CLIENT_PROFILE_REGULAR.createdAt,
              updated_at: MOCK_CLIENT_PROFILE_REGULAR.updatedAt,
            },
          ]),
        ),
        invokeAccessSnapshot: vi.fn(async () =>
          ok({
            ok: true,
            profile_kind: 'buyer',
            buyer_vip: false,
            artist_tier: null,
            mdjb_id: MOCK_CLIENT_PROFILE_REGULAR.mdjbId,
            auth_uid: MOCK_CLIENT_PROFILE_REGULAR.userId,
          }),
        ),
      }),
      sessionReader: session,
    });

    const result = await service.fetchOwnClientProfile();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.clientProfileId).toBe('client.regular');
      expect(result.data.mdjbId).toBe(MOCK_CLIENT_PROFILE_REGULAR.mdjbId);
      expect(result.data.fullName).toBe(MOCK_CLIENT_PROFILE_REGULAR.fullName);
    }
  });

  it('returns PROFILES_NOT_FOUND when row missing', async () => {
    const session = createStaticSessionReader({
      portal: 'client',
      sessionId: 'ses_1',
      authorizationHeader: 'Bearer test',
      actorType: 'authenticated',
    });
    const service = createProfilesService({
      dataPort: createPort({}),
      sessionReader: session,
    });
    const result = await service.fetchOwnClientProfile();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.details).toBe('PROFILES_NOT_FOUND');
    }
  });
});

describe('profiles.service — fetchOwnArtistProfile', () => {
  it('maps dj_profiles + tier from snapshot', async () => {
    const session = createStaticSessionReader({
      portal: 'artist',
      sessionId: 'ses_1',
      authorizationHeader: 'Bearer test',
      actorType: 'authenticated',
    });
    const service = createProfilesService({
      dataPort: createPort({
        selectOwnDjProfile: vi.fn(async () =>
          ok([
            {
              id: MOCK_ARTIST_PROFILE_DJ_PRO.rowId,
              user_id: MOCK_ARTIST_PROFILE_DJ_PRO.userId,
              role: 'dj',
              full_name: MOCK_ARTIST_PROFILE_DJ_PRO.fullName,
              stage_name: MOCK_ARTIST_PROFILE_DJ_PRO.stageName,
              dj_name: MOCK_ARTIST_PROFILE_DJ_PRO.djName,
              username: MOCK_ARTIST_PROFILE_DJ_PRO.username,
              dj_slug: MOCK_ARTIST_PROFILE_DJ_PRO.djSlug,
              email: MOCK_ARTIST_PROFILE_DJ_PRO.email,
              bio: null,
              bio_en: MOCK_ARTIST_PROFILE_DJ_PRO.bioEn,
              bio_short: MOCK_ARTIST_PROFILE_DJ_PRO.bioShort,
              bio_long: null,
              photo_url: null,
              background_url: null,
              photo_focal_x: 50,
              photo_focal_y: 50,
              hero_bg_zoom: 100,
              hourly_rate_usd: 150,
              artist_specialty: 'Open Format · Latin',
              city: 'Miami',
              available: true,
              verified: true,
              rating: 4.9,
              review_count: 12,
              soundfortips_active: true,
              created_at: MOCK_ARTIST_PROFILE_DJ_PRO.createdAt,
              updated_at: MOCK_ARTIST_PROFILE_DJ_PRO.updatedAt,
            },
          ]),
        ),
        invokeAccessSnapshot: vi.fn(async () =>
          ok({
            ok: true,
            profile_kind: 'artist',
            artist_tier: 1,
            buyer_vip: false,
            role: 'dj',
            mdjb_id: MOCK_ARTIST_PROFILE_DJ_PRO.mdjbId,
            auth_uid: MOCK_ARTIST_PROFILE_DJ_PRO.userId,
          }),
        ),
      }),
      sessionReader: session,
    });

    const result = await service.fetchOwnArtistProfile();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.stageName).toBe(MOCK_ARTIST_PROFILE_DJ_PRO.stageName);
      expect(result.data.fullName).not.toBe(result.data.stageName);
      expect(result.data.commercialTier).toBe('Pro');
      expect(result.data.mdjbId).toBe(MOCK_ARTIST_PROFILE_DJ_PRO.mdjbId);
    }
  });
});

describe('profiles.service — fetchPublicArtistCard', () => {
  it('rejects empty handle', async () => {
    const service = createProfilesService({ dataPort: createPort({}) });
    const result = await service.fetchPublicArtistCard('  ');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.details).toBe('PROFILES_INVALID_LOOKUP');
    }
  });

  it('maps public_dj_profiles row (no session required)', async () => {
    const service = createProfilesService({
      dataPort: createPort({
        selectPublicArtistByHandle: vi.fn(async () =>
          ok([
            {
              user_id: MOCK_PUBLIC_ARTIST_CARD.userId,
              stage_name: MOCK_PUBLIC_ARTIST_CARD.stageName,
              dj_name: MOCK_PUBLIC_ARTIST_CARD.djName,
              username: MOCK_PUBLIC_ARTIST_CARD.username,
              dj_slug: MOCK_PUBLIC_ARTIST_CARD.djSlug,
              photo_url: null,
              bio_short: MOCK_PUBLIC_ARTIST_CARD.bioShort,
              city: 'Miami',
              artist_specialty: 'Open Format · Latin',
              hourly_rate_usd: 150,
              rating: 4.9,
              review_count: 12,
              available: true,
              verified: true,
            },
          ]),
        ),
      }),
    });
    const result = await service.fetchPublicArtistCard('djmago305');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.stageName).toBe(MOCK_PUBLIC_ARTIST_CARD.stageName);
      expect('email' in result.data).toBe(false);
      expect('fullName' in result.data).toBe(false);
    }
  });
});

describe('profiles.service — no writers on public surface', () => {
  it('exposes only read methods including identity classification', () => {
    const service = createProfilesService({ dataPort: createPort({}) });
    const keys = Object.keys(service).sort();
    expect(keys).toEqual([
      'fetchOwnAccessSnapshot',
      'fetchOwnArtistProfile',
      'fetchOwnClientProfile',
      'fetchOwnIdentityClassification',
      'fetchPublicArtistCard',
    ]);
    expect('update' in service).toBe(false);
    expect('insert' in service).toBe(false);
    expect('upsert' in service).toBe(false);
    expect('delete' in service).toBe(false);
  });
});
