/** Phase 9 — dev-only staff role preview via URL (portal-local; no session runtime edits). */

import type { ProfileResolveInput, StaffProfileId } from '../shared/permissions/runtime/types';
import {
  deliverAuthHandoff,
  getAuthSessionBoundaryForTests,
  setSessionPermissionProfileForTests,
} from '@mdj/shared/session';
import { STAFF_PREVIEW_OPERATOR_NAMES } from './operations-preview-data';

export type StaffPreviewRole = 'owner' | 'manager' | 'seller';

const STAFF_PREVIEW_PROFILE_IDS: Record<StaffPreviewRole, StaffProfileId> = {
  owner: 'staff.owner',
  manager: 'staff.manager',
  seller: 'staff.seller',
};

export function parseStaffPreviewRoleFromUrl(search = window.location.search): StaffPreviewRole | null {
  const raw = new URLSearchParams(search).get('previewRole')?.trim().toLowerCase();
  if (raw === 'owner' || raw === 'manager' || raw === 'seller') {
    return raw;
  }
  return null;
}

/**
 * After SESSION_READY: set preview profile and republish permissions via dev mock auth handoff.
 * DEV-only · valid previewRole query param only.
 */
export function applyStaffPreviewRoleForDev(search = window.location.search): StaffProfileId | null {
  if (!import.meta.env.DEV) {
    return null;
  }

  const previewRole = parseStaffPreviewRoleFromUrl(search);
  if (!previewRole) {
    return null;
  }

  const profileId = STAFF_PREVIEW_PROFILE_IDS[previewRole];
  const profile: ProfileResolveInput = { kind: 'staff', profileId };
  setSessionPermissionProfileForTests(profile);

  const boundary = getAuthSessionBoundaryForTests();
  const previewUserId = `staff-preview-${previewRole}`;
  const handoff = boundary.createMockAuthHandoff(
    previewUserId,
    { handoffId: `staff-preview-handoff-${previewRole}` },
    {
      userId: previewUserId,
      email: STAFF_PREVIEW_OPERATOR_NAMES[profileId],
      authProvider: 'mock',
    },
  );
  deliverAuthHandoff(handoff);

  return profileId;
}

/** @deprecated Use applyStaffPreviewRoleForDev after bootScaffold when SESSION_READY. */
export function prepareStaffPreviewRoleForDev(search = window.location.search): StaffProfileId | null {
  return applyStaffPreviewRoleForDev(search);
}

export function buildStaffPreviewRoleUrl(role: StaffPreviewRole): string {
  const url = new URL(window.location.href);
  url.searchParams.set('previewRole', role);
  return url.toString();
}
