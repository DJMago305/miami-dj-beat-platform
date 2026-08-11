/**
 * profiles.spec.ts — Vitest contract tests for Profiles Read Model DTOs (Paso 2).
 * READ-ONLY validation · mocks only · no SQL · no writers.
 */
import { describe, expect, it } from 'vitest';
import {
  MOCK_ACCESS_SNAPSHOT_ARTIST_PRO,
  MOCK_ACCESS_SNAPSHOT_BUYER,
  MOCK_ACCESS_SNAPSHOT_FAILURE,
  MOCK_ACCESS_SNAPSHOT_STAFF_OWNER,
  MOCK_ACCESS_SNAPSHOT_VIP,
  MOCK_ARTIST_PROFILE_DJ_PRO,
  MOCK_CLIENT_PROFILE_REGULAR,
  MOCK_PUBLIC_ARTIST_CARD,
  MOCK_STAFF_IDENTITY_OWNER,
  mapAccessSnapshotRpcToDto,
  mapArtistTierFromSnapshot,
  resolveClientProfileId,
  resolveStaffProfileId,
  staffIsManagement,
} from '../../shared/services/profiles';
import type {
  AccessSnapshotDTO,
  ArtistProfileReadDTO,
  ClientProfileReadDTO,
  PublicArtistCardDTO,
  StaffIdentityDTO,
} from '../../shared/services/profiles';

function assertReadonlyDto(dto: object): void {
  expect(Object.isFrozen(dto)).toBe(true);
}

describe('profiles.spec — AccessSnapshotDTO', () => {
  it('mock buyer / vip / artist / staff satisfy success contract', () => {
    const samples: AccessSnapshotDTO[] = [
      MOCK_ACCESS_SNAPSHOT_BUYER,
      MOCK_ACCESS_SNAPSHOT_VIP,
      MOCK_ACCESS_SNAPSHOT_ARTIST_PRO,
      MOCK_ACCESS_SNAPSHOT_STAFF_OWNER,
    ];
    for (const snap of samples) {
      assertReadonlyDto(snap);
      expect(snap.ok).toBe(true);
      if (snap.ok) {
        expect(snap.profileKind).toBeTruthy();
        expect(typeof snap.buyerVip).toBe('boolean');
        expect(snap.mdjbId === null || typeof snap.mdjbId === 'string').toBe(true);
      }
    }
  });

  it('failure mock has reason', () => {
    assertReadonlyDto(MOCK_ACCESS_SNAPSHOT_FAILURE);
    expect(MOCK_ACCESS_SNAPSHOT_FAILURE.ok).toBe(false);
    if (!MOCK_ACCESS_SNAPSHOT_FAILURE.ok) {
      expect(MOCK_ACCESS_SNAPSHOT_FAILURE.reason).toBe('no_session');
    }
  });

  it('maps RPC snake_case → AccessSnapshotDTO (read-only)', () => {
    const dto = mapAccessSnapshotRpcToDto({
      ok: true,
      profile_kind: 'artist',
      artist_tier: 2,
      buyer_vip: false,
      role: 'dj',
      mdjb_id: 'MDJB-AAAA-BBBB-A',
      auth_uid: 'uid-1',
    });
    expect(dto).toEqual({
      ok: true,
      profileKind: 'artist',
      artistTier: 2,
      buyerVip: false,
      role: 'dj',
      mdjbId: 'MDJB-AAAA-BBBB-A',
      authUid: 'uid-1',
    });
    expect(mapArtistTierFromSnapshot(2)).toBe('Elite');
  });

  it('rejects invalid RPC profile_kind without throwing', () => {
    const dto = mapAccessSnapshotRpcToDto({ ok: true, profile_kind: 'hacker' });
    expect(dto.ok).toBe(false);
  });
});

describe('profiles.spec — ClientProfileReadDTO', () => {
  it('regular mock matches taxonomy fields', () => {
    const dto: ClientProfileReadDTO = MOCK_CLIENT_PROFILE_REGULAR;
    assertReadonlyDto(dto);
    expect(dto.clientProfileId).toBe('client.regular');
    expect(dto.clientProfileType).toBe('regular');
    expect(dto.fullName).toBeTruthy();
    expect(
      resolveClientProfileId({
        buyerBillingTier: dto.buyerBillingTier,
        isCommercial: dto.isCommercial,
      }),
    ).toBe('client.regular');
  });
});

describe('profiles.spec — ArtistProfileReadDTO', () => {
  it('keeps legal name distinct from stage name', () => {
    const dto: ArtistProfileReadDTO = MOCK_ARTIST_PROFILE_DJ_PRO;
    assertReadonlyDto(dto);
    expect(dto.fullName).toBe('Gerardo A Valle');
    expect(dto.stageName).toBe('DJMago305');
    expect(dto.fullName).not.toBe(dto.stageName);
    expect(dto.commercialTier).toBe('Pro');
    expect(dto.artistProfileId).toBe('artist.dj');
  });
});

describe('profiles.spec — PublicArtistCardDTO', () => {
  it('exposes no billing fields on public card mock', () => {
    const dto: PublicArtistCardDTO = MOCK_PUBLIC_ARTIST_CARD;
    assertReadonlyDto(dto);
    expect(dto.stageName).toBeTruthy();
    expect('buyerStripeCustomerId' in dto).toBe(false);
    expect('email' in dto).toBe(false);
    expect('fullName' in dto).toBe(false);
  });
});

describe('profiles.spec — StaffIdentityDTO', () => {
  it('owner mock is staff management', () => {
    const dto: StaffIdentityDTO = MOCK_STAFF_IDENTITY_OWNER;
    assertReadonlyDto(dto);
    expect(dto.staffProfileId).toBe('staff.owner');
    expect(dto.isStaff).toBe(true);
    expect(dto.isStaffManagement).toBe(true);
    expect(resolveStaffProfileId({ role: dto.role })).toBe('staff.owner');
    expect(staffIsManagement(dto.staffProfileId)).toBe(true);
  });
});
