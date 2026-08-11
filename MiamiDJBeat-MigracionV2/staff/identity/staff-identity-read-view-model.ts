/**
 * MOD-301 Slice 1 — Staff Identity Read ViewModel (pure).
 * READ-ONLY projection from StaffIdentityDTO + AccessSnapshotDTO. No writers.
 */

import type {
  AccessSnapshotDTO,
  StaffIdentityDTO,
} from '../../shared/services/profiles/index';

export type StaffScopeKind = 'full_management' | 'seller_limited' | 'unknown';

export type StaffIdentityReadViewModel = {
  readonly displayName: string;
  readonly roleLabel: string;
  readonly staffProfileId: string;
  readonly mdjbId: string | null;
  readonly userIdShort: string;
  readonly isStaff: boolean;
  readonly isStaffManagement: boolean;
  readonly scopeKind: StaffScopeKind;
  readonly scopeLabel: string;
  readonly accessOk: boolean;
  readonly accessProfileKind: string | null;
  readonly accessRole: string | null;
  readonly accessMdjbId: string | null;
  readonly accessAuthUidShort: string | null;
  readonly accessFailureReason: string | null;
  readonly permissionFlags: readonly { readonly id: string; readonly label: string; readonly on: boolean }[];
};

function displayOrNull(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : null;
}

function shortId(id: string | null | undefined): string | null {
  const raw = displayOrNull(id);
  if (!raw) return null;
  if (raw.length <= 12) return raw;
  return `${raw.slice(0, 8)}…`;
}

function roleDisplay(role: string | null): string {
  const r = displayOrNull(role);
  if (!r) return 'Unassigned';
  const map: Record<string, string> = {
    owner: 'Owner',
    manager: 'Manager',
    seller: 'Seller',
    admin: 'Admin',
  };
  return map[r.toLowerCase()] ?? r;
}

function resolveScope(identity: StaffIdentityDTO): {
  readonly kind: StaffScopeKind;
  readonly label: string;
} {
  if (identity.staffProfileId === 'staff.seller' || (!identity.isStaffManagement && identity.isStaff)) {
    return {
      kind: 'seller_limited',
      label: 'Seller — limited operational scope',
    };
  }
  if (identity.isStaffManagement) {
    const role = (identity.role ?? '').toLowerCase();
    if (role === 'owner') {
      return { kind: 'full_management', label: 'Full management — Owner' };
    }
    if (role === 'manager') {
      return { kind: 'full_management', label: 'Full management — Manager' };
    }
    return { kind: 'full_management', label: 'Full management (is_staff_management)' };
  }
  return { kind: 'unknown', label: 'Staff scope unknown' };
}

/**
 * Pure mapper — StaffIdentityDTO (+ optional AccessSnapshotDTO) → display model.
 */
export function toStaffIdentityReadViewModel(input: {
  readonly identity: StaffIdentityDTO;
  readonly accessSnapshot?: AccessSnapshotDTO | null;
  readonly displayName?: string | null;
}): StaffIdentityReadViewModel {
  const { identity } = input;
  const scope = resolveScope(identity);
  const snap = input.accessSnapshot ?? null;

  const permissionFlags = Object.freeze([
    Object.freeze({ id: 'is_staff', label: 'is_staff', on: identity.isStaff === true }),
    Object.freeze({
      id: 'is_staff_management',
      label: 'is_staff_management',
      on: identity.isStaffManagement === true,
    }),
    Object.freeze({
      id: 'seller_scope',
      label: 'Seller limited',
      on: scope.kind === 'seller_limited',
    }),
    Object.freeze({
      id: 'full_scope',
      label: 'Full management',
      on: scope.kind === 'full_management',
    }),
  ]);

  if (!snap) {
    return Object.freeze({
      displayName: displayOrNull(input.displayName) ?? roleDisplay(identity.role),
      roleLabel: roleDisplay(identity.role),
      staffProfileId: identity.staffProfileId,
      mdjbId: displayOrNull(identity.mdjbId),
      userIdShort: shortId(identity.userId) ?? '—',
      isStaff: identity.isStaff,
      isStaffManagement: identity.isStaffManagement,
      scopeKind: scope.kind,
      scopeLabel: scope.label,
      accessOk: false,
      accessProfileKind: null,
      accessRole: null,
      accessMdjbId: null,
      accessAuthUidShort: null,
      accessFailureReason: 'No AccessSnapshotDTO provided',
      permissionFlags,
    });
  }

  if (!snap.ok) {
    return Object.freeze({
      displayName: displayOrNull(input.displayName) ?? roleDisplay(identity.role),
      roleLabel: roleDisplay(identity.role),
      staffProfileId: identity.staffProfileId,
      mdjbId: displayOrNull(identity.mdjbId),
      userIdShort: shortId(identity.userId) ?? '—',
      isStaff: identity.isStaff,
      isStaffManagement: identity.isStaffManagement,
      scopeKind: scope.kind,
      scopeLabel: scope.label,
      accessOk: false,
      accessProfileKind: null,
      accessRole: null,
      accessMdjbId: null,
      accessAuthUidShort: null,
      accessFailureReason: snap.reason,
      permissionFlags,
    });
  }

  return Object.freeze({
    displayName: displayOrNull(input.displayName) ?? roleDisplay(identity.role),
    roleLabel: roleDisplay(identity.role),
    staffProfileId: identity.staffProfileId,
    mdjbId: displayOrNull(identity.mdjbId) ?? displayOrNull(snap.mdjbId),
    userIdShort: shortId(identity.userId) ?? shortId(snap.authUid) ?? '—',
    isStaff: identity.isStaff,
    isStaffManagement: identity.isStaffManagement,
    scopeKind: scope.kind,
    scopeLabel: scope.label,
    accessOk: true,
    accessProfileKind: snap.profileKind,
    accessRole: displayOrNull(snap.role),
    accessMdjbId: displayOrNull(snap.mdjbId),
    accessAuthUidShort: shortId(snap.authUid),
    accessFailureReason: null,
    permissionFlags,
  });
}
