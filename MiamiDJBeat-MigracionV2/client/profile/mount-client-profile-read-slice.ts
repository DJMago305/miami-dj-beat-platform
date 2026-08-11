/**
 * MOD-103 Slice 1 — mount Client Profile Read View into client dashboard.
 * Lab default: LAB_CLIENT_PROFILE_VIP (no DB writers).
 * Optional: inject ProfilesService.fetchOwnClientProfile when available.
 * Paso 5: gated by client session-wiring pilot (client_id scope).
 */

import type {
  ClientProfileReadDTO,
  ProfilesService,
} from '../../shared/services/profiles/index';
import { LAB_CLIENT_PROFILE_DEFAULT } from './client-profile-read-fixtures';
import { renderClientProfileReadView } from './render-client-profile-read-view';
import {
  annotateClientMountSourceLabel,
  clientDomainAccessAllowed,
  type ClientSessionWiringInjection,
} from '../session/client-session-wiring-pilot';

export type MountClientProfileReadSliceInput = {
  readonly mainRegion: HTMLElement;
  readonly profilesService?: ProfilesService | null;
  readonly fallbackProfile?: ClientProfileReadDTO;
  readonly sessionWiring?: ClientSessionWiringInjection | null;
};

export type MountClientProfileReadSliceResult = {
  readonly ok: true;
  readonly source: 'service' | 'mock';
  readonly profile: ClientProfileReadDTO;
};

function resolveProfileSlot(mainRegion: HTMLElement): HTMLElement | null {
  return mainRegion.querySelector<HTMLElement>('[data-mdj-client-section="client-profile"]');
}

function fillSlot(
  slot: HTMLElement,
  profile: ClientProfileReadDTO,
  sourceLabel: string,
): void {
  const title = document.createElement('h2');
  title.className = 'mdj-shell-section-header';
  title.setAttribute('data-mdj-component', 'SectionHeader');
  title.textContent = 'Client Profile';

  const panel = document.createElement('div');
  panel.className = 'mdj-client-profile-read-host';
  panel.dataset.mdjClientProfileHost = 'mod-103';

  slot.replaceChildren(title, panel);
  renderClientProfileReadView(panel, profile, { sourceLabel });
}

/**
 * Hydrates the client-profile dashboard slot with MOD-103 read view.
 * Prefer live `fetchOwnClientProfile` when service returns ok; else mock.
 */
export async function mountClientProfileReadSlice(
  input: MountClientProfileReadSliceInput,
): Promise<MountClientProfileReadSliceResult> {
  const slot = resolveProfileSlot(input.mainRegion);
  if (!slot) {
    throw new Error('MOD-103: client-profile section slot missing');
  }

  const fallback = input.fallbackProfile ?? LAB_CLIENT_PROFILE_DEFAULT;
  let profile: ClientProfileReadDTO = fallback;
  let source: 'service' | 'mock' = 'mock';

  if (input.profilesService && clientDomainAccessAllowed(input.sessionWiring, 'profiles')) {
    try {
      const result = await input.profilesService.fetchOwnClientProfile();
      if (result.ok && result.data) {
        profile = result.data;
        source = 'service';
      }
    } catch {
      source = 'mock';
      profile = fallback;
    }
  }

  fillSlot(
    slot,
    profile,
    annotateClientMountSourceLabel(
      source === 'service' ? 'live read' : 'lab mock',
      input.sessionWiring,
      'profiles',
    ),
  );
  return Object.freeze({ ok: true as const, source, profile });
}

export function mountClientProfileReadSliceSync(
  mainRegion: HTMLElement,
  profile: ClientProfileReadDTO = LAB_CLIENT_PROFILE_DEFAULT,
  sessionWiring?: ClientSessionWiringInjection | null,
): void {
  const slot = resolveProfileSlot(mainRegion);
  if (!slot) return;
  fillSlot(
    slot,
    profile,
    annotateClientMountSourceLabel('lab mock', sessionWiring, 'profiles'),
  );
}
