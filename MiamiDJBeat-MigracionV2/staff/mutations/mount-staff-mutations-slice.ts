/**
 * Mount Staff Mutations slice into staff dashboard (Paso 3).
 */

import type { StaffMutationsAdapter } from '../../shared/services/staff-mutations/index';
import type { SessionContextDTO } from '../../shared/types/session.types';
import type { StaffSessionWiringInjection } from '../session/staff-session-wiring-pilot';
import { renderStaffMutationsSlice } from './render-staff-mutations-slice';

export type MountStaffMutationsSliceInput = {
  readonly mainRegion: HTMLElement;
  readonly adapter: StaffMutationsAdapter;
  readonly sessionContext: SessionContextDTO;
  readonly staffUserId: string;
  readonly sessionWiring?: StaffSessionWiringInjection | null;
};

function resolveSlot(mainRegion: HTMLElement): HTMLElement | null {
  return mainRegion.querySelector<HTMLElement>('[data-mdj-staff-section="staff-mutations"]');
}

/**
 * Hydrates staff-mutations dashboard slot with writer forms.
 */
export function mountStaffMutationsSlice(input: MountStaffMutationsSliceInput): void {
  const slot = resolveSlot(input.mainRegion);
  if (!slot) {
    throw new Error('MOD-301-MUT: staff-mutations section slot missing');
  }

  const roleOk =
    input.sessionContext.sessionRole === 'staff' ||
    input.sessionContext.sessionRole === 'staff_seller';

  const canWrite =
    input.sessionWiring == null
      ? roleOk && Boolean(input.staffUserId)
      : input.sessionWiring.canReadStaffPortal && roleOk && Boolean(input.staffUserId);

  if (!canWrite) {
    const gated = document.createElement('aside');
    gated.className = 'mdj-staff-mutations-slice mdj-staff-mutations-slice--gated';
    gated.dataset.mdjComponent = 'StaffMutationsSlice';
    gated.dataset.mdjSessionReady = '0';
    gated.textContent =
      'Staff mutations gated — session must be an active staff or staff_seller role to submit writers.';
    slot.replaceChildren(gated);
    return;
  }

  const host = document.createElement('div');
  host.className = 'mdj-staff-mutations-host';
  host.dataset.mdjStaffMutationsHost = 'mod-301-mut';
  slot.replaceChildren(host);
  renderStaffMutationsSlice(host, {
    adapter: input.adapter,
    sessionContext: input.sessionContext,
    staffUserId: input.staffUserId,
  });
}

export function mountStaffMutationsSliceSync(
  mainRegion: HTMLElement,
  adapter: StaffMutationsAdapter,
  sessionContext: SessionContextDTO,
  staffUserId: string,
  sessionWiring?: StaffSessionWiringInjection | null,
): void {
  const slot = resolveSlot(mainRegion);
  if (!slot) return;
  mountStaffMutationsSlice({
    mainRegion,
    adapter,
    sessionContext,
    staffUserId,
    sessionWiring,
  });
}
