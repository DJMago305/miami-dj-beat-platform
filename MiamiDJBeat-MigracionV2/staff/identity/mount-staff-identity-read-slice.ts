/**
 * MOD-301 Slice 1 — mount Staff Identity Read View into staff dashboard.
 * Lab default: LAB_STAFF_IDENTITY_OWNER (no DB writers / no role mutation).
 * Optional: ProfilesService.fetchOwnAccessSnapshot → mapStaffIdentityFromRole.
 */

import {
  mapStaffIdentityFromRole,
  type AccessSnapshotDTO,
  type ProfilesService,
  type StaffIdentityDTO,
} from '../../shared/services/profiles/index';
import {
  LAB_STAFF_IDENTITY_DEFAULT,
  type StaffIdentityLabBundle,
} from './staff-identity-read-fixtures';
import { renderStaffIdentityReadView } from './render-staff-identity-read-view';
import {
  annotateStaffMountSourceLabel,
  staffDomainAccessAllowed,
  type StaffSessionWiringInjection,
} from '../session/staff-session-wiring-pilot';

export type MountStaffIdentityReadSliceInput = {
  readonly mainRegion: HTMLElement;
  readonly profilesService?: ProfilesService | null;
  readonly fallback?: StaffIdentityLabBundle;
  readonly sessionWiring?: StaffSessionWiringInjection | null;
};

export type MountStaffIdentityReadSliceResult = {
  readonly ok: true;
  readonly source: 'service' | 'mock';
  readonly identity: StaffIdentityDTO;
  readonly accessSnapshot: AccessSnapshotDTO | null;
};

function resolveProfileSlot(mainRegion: HTMLElement): HTMLElement | null {
  return mainRegion.querySelector<HTMLElement>('[data-mdj-staff-section="staff-profile"]');
}

function fillSlot(
  slot: HTMLElement,
  bundle: {
    readonly identity: StaffIdentityDTO;
    readonly accessSnapshot: AccessSnapshotDTO | null;
    readonly displayName: string | null;
    readonly sourceLabel: string;
  },
): void {
  const title = document.createElement('h2');
  title.className = 'mdj-shell-section-header';
  title.setAttribute('data-mdj-component', 'SectionHeader');
  title.textContent = 'Staff Identity';

  const panel = document.createElement('div');
  panel.className = 'mdj-staff-identity-read-host';
  panel.dataset.mdjStaffIdentityHost = 'mod-301';

  slot.replaceChildren(title, panel);
  renderStaffIdentityReadView(panel, bundle.identity, {
    sourceLabel: bundle.sourceLabel,
    displayName: bundle.displayName,
    accessSnapshot: bundle.accessSnapshot,
  });
}

/**
 * Hydrates staff-profile slot with MOD-301 read view.
 * Prefer live access snapshot when service returns staff_*; else lab mock.
 */
export async function mountStaffIdentityReadSlice(
  input: MountStaffIdentityReadSliceInput,
): Promise<MountStaffIdentityReadSliceResult> {
  const slot = resolveProfileSlot(input.mainRegion);
  if (!slot) {
    throw new Error('MOD-301: staff-profile section slot missing');
  }

  const fallback = input.fallback ?? LAB_STAFF_IDENTITY_DEFAULT;
  let identity = fallback.identity;
  let accessSnapshot: AccessSnapshotDTO | null = fallback.accessSnapshot;
  let displayName: string | null = fallback.displayName;
  let source: 'service' | 'mock' = 'mock';

  if (input.profilesService && staffDomainAccessAllowed(input.sessionWiring, 'profiles')) {
    try {
      const result = await input.profilesService.fetchOwnAccessSnapshot();
      if (result.ok && result.data && result.data.ok) {
        const snap = result.data;
        if (snap.profileKind === 'staff_seller' || snap.profileKind === 'staff_full') {
          identity = mapStaffIdentityFromRole(
            snap.authUid ?? identity.userId,
            snap.role,
            snap.mdjbId,
            snap.profileKind,
          );
          accessSnapshot = snap;
          displayName = null;
          source = 'service';
        }
      }
    } catch {
      source = 'mock';
      identity = fallback.identity;
      accessSnapshot = fallback.accessSnapshot;
      displayName = fallback.displayName;
    }
  }

  fillSlot(slot, {
    identity,
    accessSnapshot,
    displayName,
    sourceLabel: annotateStaffMountSourceLabel(
      source === 'service' ? 'live read' : 'lab mock',
      input.sessionWiring,
      'profiles',
    ),
  });

  return Object.freeze({ ok: true as const, source, identity, accessSnapshot });
}

export function mountStaffIdentityReadSliceSync(
  mainRegion: HTMLElement,
  fallback: StaffIdentityLabBundle = LAB_STAFF_IDENTITY_DEFAULT,
  sessionWiring?: StaffSessionWiringInjection | null,
): void {
  const slot = resolveProfileSlot(mainRegion);
  if (!slot) return;
  fillSlot(slot, {
    identity: fallback.identity,
    accessSnapshot: fallback.accessSnapshot,
    displayName: fallback.displayName,
    sourceLabel: annotateStaffMountSourceLabel('lab mock', sessionWiring, 'profiles'),
  });
}
