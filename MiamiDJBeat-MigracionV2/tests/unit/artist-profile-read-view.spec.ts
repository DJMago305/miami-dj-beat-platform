/**
 * MOD-204 Slice 1 — Artist Profile Read View tests.
 * READ-ONLY UI contract — no writers / forms / save controls.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MOCK_ARTIST_PROFILE_DJ_PRO,
  type ArtistProfileReadDTO,
  type ProfilesService,
} from '../../shared/services/profiles/index';
import { toArtistProfileReadViewModel } from '../../artist/profile/artist-profile-read-view-model';
import { renderArtistProfileReadView } from '../../artist/profile/render-artist-profile-read-view';
import {
  mountArtistProfileReadSlice,
  mountArtistProfileReadSliceSync,
} from '../../artist/profile/mount-artist-profile-read-slice';
import { renderArtistDashboardMvp } from '../../artist/render-artist-dashboard-mvp';

describe('MOD-204 Slice 1 — view model', () => {
  it('maps stage name, Pro tier, and SFT eligible from mock DJ PRO', () => {
    const vm = toArtistProfileReadViewModel(MOCK_ARTIST_PROFILE_DJ_PRO);
    expect(vm.stageName).toBe('DJMago305');
    expect(vm.commercialTierLabel).toBe('Pro');
    expect(vm.sftGateStatus).toBe('eligible');
    expect(vm.legalFullName).toBe('Gerardo A Valle');
    expect(vm.residencyCity).toBe('Miami');
    expect(vm.socialLinksAvailable).toBe(false);
  });

  it('marks Lite tier as SFT not eligible when sftOk is null', () => {
    const lite: ArtistProfileReadDTO = {
      ...MOCK_ARTIST_PROFILE_DJ_PRO,
      commercialTier: 'Lite',
      artistProfileId: 'artist.dj',
      sftOk: null,
      soundfortipsActive: false,
    };
    const vm = toArtistProfileReadViewModel(lite);
    expect(vm.commercialTierLabel).toBe('Lite');
    expect(vm.sftGateStatus).toBe('not_eligible');
  });
});

describe('MOD-204 Slice 1 — renderArtistProfileReadView', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('renders header, private identity, bio, residency, and media sections', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderArtistProfileReadView(host, MOCK_ARTIST_PROFILE_DJ_PRO);

    const root = host.querySelector('[data-mdj-component="ArtistProfileReadView"]');
    expect(root).not.toBeNull();
    expect(root?.getAttribute('data-mdj-mod')).toBe('MOD-204');
    expect(host.querySelector('[data-mdj-artist-profile-section="header"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-artist-profile-section="private-identity"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-artist-profile-section="bio"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-artist-profile-section="residency"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-artist-profile-section="media"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-artist-tier="Pro"]')?.textContent).toBe('Pro');
    expect(host.querySelector('[data-mdj-sft-gate="eligible"]')).not.toBeNull();
    expect(host.textContent).toContain('DJMago305');
    expect(host.textContent).toContain('Gerardo A Valle');
    expect(host.textContent).toContain('Miami');
  });

  it('contains no form, submit, or editable controls (read-only guard)', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderArtistProfileReadView(host, MOCK_ARTIST_PROFILE_DJ_PRO);

    expect(host.querySelectorAll('form')).toHaveLength(0);
    expect(host.querySelectorAll('input, textarea, select')).toHaveLength(0);
    expect(host.querySelectorAll('button[type="submit"]')).toHaveLength(0);
    expect(host.textContent?.toLowerCase()).not.toMatch(/\bsave\b|\bedit profile\b/);
  });
});

describe('MOD-204 Slice 1 — dashboard mount', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main data-mdj-shell-region="main"></main>';
  });

  it('sync mount replaces artist-profile slot with MOD-204 read view', () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderArtistDashboardMvp(main);

    expect(main.querySelector('[data-mdj-artist-section="artist-profile"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-component="ArtistProfileReadView"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-artist-profile-host="mod-204"]')).not.toBeNull();
  });

  it('async mount prefers ProfilesService when fetch succeeds', async () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderArtistDashboardMvp(main);

    const live: ArtistProfileReadDTO = {
      ...MOCK_ARTIST_PROFILE_DJ_PRO,
      stageName: 'LiveStageRead',
      commercialTier: 'Elite',
      sftOk: true,
    };

    const profilesService = {
      fetchOwnArtistProfile: vi.fn(async () =>
        Object.freeze({
          ok: true as const,
          status: 200,
          data: live,
          metadata: Object.freeze({ requestId: 'test', durationMs: 1 }),
        }),
      ),
    } as unknown as ProfilesService;

    const result = await mountArtistProfileReadSlice({ mainRegion: main, profilesService });
    expect(result.source).toBe('service');
    expect(result.profile.stageName).toBe('LiveStageRead');
    expect(main.textContent).toContain('LiveStageRead');
    expect(main.querySelector('[data-mdj-artist-tier="Elite"]')).not.toBeNull();
  });

  it('async mount falls back to mock when service is absent', async () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    mountArtistProfileReadSliceSync(main); // ensure slot exists via dashboard path
    renderArtistDashboardMvp(main);

    const result = await mountArtistProfileReadSlice({ mainRegion: main });
    expect(result.source).toBe('mock');
    expect(result.profile.stageName).toBe('DJMago305');
  });
});
