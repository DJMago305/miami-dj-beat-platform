/**
 * MOD-301 Slice 1 — Staff Identity Read View tests.
 * READ-ONLY UI — no role assignment / permission mutation controls.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MOCK_ACCESS_SNAPSHOT_STAFF_OWNER,
  MOCK_STAFF_IDENTITY_OWNER,
  type AccessSnapshotDTO,
  type ProfilesService,
} from '../../shared/services/profiles/index';
import {
  LAB_STAFF_IDENTITY_MANAGER,
  LAB_STAFF_IDENTITY_SELLER,
} from '../../staff/identity/staff-identity-read-fixtures';
import { toStaffIdentityReadViewModel } from '../../staff/identity/staff-identity-read-view-model';
import { renderStaffIdentityReadView } from '../../staff/identity/render-staff-identity-read-view';
import {
  mountStaffIdentityReadSlice,
  mountStaffIdentityReadSliceSync,
} from '../../staff/identity/mount-staff-identity-read-slice';
import { getDefaultStaffDashboardDataProvider } from '../../staff/data/staff-dashboard-data-provider';
import { renderStaffDashboardMvp } from '../../staff/render-staff-dashboard-mvp';

describe('MOD-301 Slice 1 — view model', () => {
  it('maps owner as full management with access snapshot OK', () => {
    const vm = toStaffIdentityReadViewModel({
      identity: MOCK_STAFF_IDENTITY_OWNER,
      accessSnapshot: MOCK_ACCESS_SNAPSHOT_STAFF_OWNER,
      displayName: 'Gerardo · Owner',
    });
    expect(vm.displayName).toBe('Gerardo · Owner');
    expect(vm.roleLabel).toBe('Owner');
    expect(vm.scopeKind).toBe('full_management');
    expect(vm.isStaffManagement).toBe(true);
    expect(vm.accessOk).toBe(true);
    expect(vm.accessProfileKind).toBe('staff_full');
  });

  it('maps seller as limited scope', () => {
    const vm = toStaffIdentityReadViewModel({
      identity: LAB_STAFF_IDENTITY_SELLER.identity,
      accessSnapshot: LAB_STAFF_IDENTITY_SELLER.accessSnapshot,
      displayName: LAB_STAFF_IDENTITY_SELLER.displayName,
    });
    expect(vm.scopeKind).toBe('seller_limited');
    expect(vm.isStaffManagement).toBe(false);
    expect(vm.staffProfileId).toBe('staff.seller');
  });

  it('maps manager as full management', () => {
    const vm = toStaffIdentityReadViewModel({
      identity: LAB_STAFF_IDENTITY_MANAGER.identity,
      accessSnapshot: LAB_STAFF_IDENTITY_MANAGER.accessSnapshot,
    });
    expect(vm.scopeKind).toBe('full_management');
    expect(vm.roleLabel).toBe('Manager');
  });
});

describe('MOD-301 Slice 1 — renderStaffIdentityReadView', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('renders header, permissions, access snapshot, and operational scope', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderStaffIdentityReadView(host, MOCK_STAFF_IDENTITY_OWNER, {
      displayName: 'Gerardo · Owner',
      accessSnapshot: MOCK_ACCESS_SNAPSHOT_STAFF_OWNER,
    });

    const root = host.querySelector('[data-mdj-component="StaffIdentityReadView"]');
    expect(root).not.toBeNull();
    expect(root?.getAttribute('data-mdj-mod')).toBe('MOD-301');
    expect(host.querySelector('[data-mdj-staff-identity-section="header"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-staff-identity-section="permissions"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-staff-identity-section="access-snapshot"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-staff-identity-section="operational-scope"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-staff-scope="full_management"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-staff-flag="is_staff_management"][data-mdj-staff-flag-on="true"]')).not.toBeNull();
    expect(host.textContent).toContain('Gerardo · Owner');
  });

  it('contains no form or role-assignment controls (read-only guard)', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderStaffIdentityReadView(host, LAB_STAFF_IDENTITY_SELLER.identity, {
      accessSnapshot: LAB_STAFF_IDENTITY_SELLER.accessSnapshot,
      displayName: LAB_STAFF_IDENTITY_SELLER.displayName,
    });

    expect(host.querySelectorAll('form')).toHaveLength(0);
    expect(host.querySelectorAll('input, textarea, select')).toHaveLength(0);
    expect(host.querySelectorAll('button[type="submit"]')).toHaveLength(0);
    expect(host.textContent?.toLowerCase()).not.toMatch(/\bsave\b|\bassign role\b|\bedit permissions\b/);
  });
});

describe('MOD-301 Slice 1 — dashboard mount', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main data-mdj-shell-region="main"></main>';
  });

  it('sync mount places MOD-301 read view in staff-profile slot', () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderStaffDashboardMvp(main, getDefaultStaffDashboardDataProvider());

    expect(main.querySelector('[data-mdj-staff-section="staff-profile"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-component="StaffIdentityReadView"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-staff-identity-host="mod-301"]')).not.toBeNull();
  });

  it('async mount prefers ProfilesService access snapshot for staff_full', async () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderStaffDashboardMvp(main, getDefaultStaffDashboardDataProvider());

    const liveSnap: AccessSnapshotDTO = Object.freeze({
      ok: true,
      profileKind: 'staff_full',
      artistTier: null,
      buyerVip: false,
      role: 'manager',
      mdjbId: 'MDJB-LIVE-MGR-M',
      authUid: '00000000-0000-4000-8000-000000000099',
    });

    const profilesService = {
      fetchOwnAccessSnapshot: vi.fn(async () =>
        Object.freeze({
          ok: true as const,
          status: 200,
          data: liveSnap,
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

    const result = await mountStaffIdentityReadSlice({ mainRegion: main, profilesService });
    expect(result.source).toBe('service');
    expect(result.identity.role).toBe('manager');
    expect(main.textContent).toContain('Manager');
    expect(main.querySelector('[data-mdj-staff-profile-id="staff.manager"]')).not.toBeNull();
  });

  it('async mount falls back to lab mock when service is absent', async () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    mountStaffIdentityReadSliceSync(main);
    renderStaffDashboardMvp(main, getDefaultStaffDashboardDataProvider());

    const result = await mountStaffIdentityReadSlice({ mainRegion: main });
    expect(result.source).toBe('mock');
    expect(result.identity.role).toBe('owner');
  });
});
