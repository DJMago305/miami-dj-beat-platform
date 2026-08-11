/**
 * MOD-103 Slice 1 — Client Profile Read View tests.
 * READ-ONLY UI contract — no writers / forms / save controls.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MOCK_CLIENT_PROFILE_REGULAR,
  type ClientProfileReadDTO,
  type ProfilesService,
} from '../../shared/services/profiles/index';
import {
  LAB_CLIENT_PROFILE_COMMERCIAL,
  LAB_CLIENT_PROFILE_VIP,
} from '../../client/profile/client-profile-read-fixtures';
import { toClientProfileReadViewModel } from '../../client/profile/client-profile-read-view-model';
import { renderClientProfileReadView } from '../../client/profile/render-client-profile-read-view';
import {
  mountClientProfileReadSlice,
  mountClientProfileReadSliceSync,
} from '../../client/profile/mount-client-profile-read-slice';
import { renderClientDashboardMvp } from '../../client/render-client-dashboard-mvp';

describe('MOD-103 Slice 1 — view model', () => {
  it('maps VIP badge, contact, and masks Stripe id from lab VIP fixture', () => {
    const vm = toClientProfileReadViewModel(LAB_CLIENT_PROFILE_VIP);
    expect(vm.displayName).toBe('Maria VIP Client');
    expect(vm.vipStatus).toBe('vip');
    expect(vm.vipLabel).toBe('Cliente VIP');
    expect(vm.commercialStatus).toBe('individual');
    expect(vm.email).toContain('@');
    expect(vm.totalEventsBookedLabel).toBe('7');
    expect(vm.stripeCustomerMasked).toMatch(/^cus_…\d{4}$|^cus_…/);
    expect(vm.stripeCustomerMasked).not.toBe(LAB_CLIENT_PROFILE_VIP.buyerStripeCustomerId);
  });

  it('maps commercial company brand from lab commercial fixture', () => {
    const vm = toClientProfileReadViewModel(LAB_CLIENT_PROFILE_COMMERCIAL);
    expect(vm.companyOrBrand).toBe('Brickell Events Co');
    expect(vm.commercialStatus).toBe('commercial');
    expect(vm.clientProfileTypeLabel).toBe('commercial');
  });

  it('maps regular mock as non-VIP individual', () => {
    const vm = toClientProfileReadViewModel(MOCK_CLIENT_PROFILE_REGULAR);
    expect(vm.vipStatus).toBe('regular');
    expect(vm.commercialStatus).toBe('individual');
  });
});

describe('MOD-103 Slice 1 — renderClientProfileReadView', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('renders header, contact, booking prefs, and billing sections', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderClientProfileReadView(host, LAB_CLIENT_PROFILE_VIP);

    const root = host.querySelector('[data-mdj-component="ClientProfileReadView"]');
    expect(root).not.toBeNull();
    expect(root?.getAttribute('data-mdj-mod')).toBe('MOD-103');
    expect(host.querySelector('[data-mdj-client-profile-section="header"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-client-profile-section="contact"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-client-profile-section="booking-prefs"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-client-profile-section="billing-private"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-client-vip="vip"]')).not.toBeNull();
    expect(host.textContent).toContain('Maria VIP Client');
    expect(host.textContent).toContain('Cliente VIP');
  });

  it('contains no form, submit, or editable controls (read-only guard)', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderClientProfileReadView(host, LAB_CLIENT_PROFILE_VIP);

    expect(host.querySelectorAll('form')).toHaveLength(0);
    expect(host.querySelectorAll('input, textarea, select')).toHaveLength(0);
    expect(host.querySelectorAll('button[type="submit"]')).toHaveLength(0);
    expect(host.textContent?.toLowerCase()).not.toMatch(/\bsave\b|\bedit profile\b/);
  });
});

describe('MOD-103 Slice 1 — dashboard mount', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main data-mdj-shell-region="main"></main>';
  });

  it('sync mount places MOD-103 read view in client-profile slot', () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderClientDashboardMvp(main);

    expect(main.querySelector('[data-mdj-client-section="client-profile"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-component="ClientProfileReadView"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-client-profile-host="mod-103"]')).not.toBeNull();
  });

  it('async mount prefers ProfilesService when fetch succeeds', async () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderClientDashboardMvp(main);

    const live: ClientProfileReadDTO = {
      ...MOCK_CLIENT_PROFILE_REGULAR,
      fullName: 'Live Client Read',
      buyerBillingTier: 'vip',
      clientProfileId: 'client.vip',
      clientProfileType: 'vip',
    };

    const profilesService = {
      fetchOwnClientProfile: vi.fn(async () =>
        Object.freeze({
          ok: true as const,
          status: 200,
          data: live,
          metadata: Object.freeze({
            requestId: 'test',
            correlationId: 'corr',
            durationMs: 1,
            attempt: 1,
            context: Object.freeze({ requestId: 'test', correlationId: 'corr' }),
          }),
        }),
      ),
    } as unknown as ProfilesService;

    const result = await mountClientProfileReadSlice({ mainRegion: main, profilesService });
    expect(result.source).toBe('service');
    expect(result.profile.fullName).toBe('Live Client Read');
    expect(main.textContent).toContain('Live Client Read');
    expect(main.querySelector('[data-mdj-client-vip="vip"]')).not.toBeNull();
  });

  it('async mount falls back to lab mock when service is absent', async () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    mountClientProfileReadSliceSync(main);
    renderClientDashboardMvp(main);

    const result = await mountClientProfileReadSlice({ mainRegion: main });
    expect(result.source).toBe('mock');
    expect(result.profile.fullName).toBe('Maria VIP Client');
  });
});
