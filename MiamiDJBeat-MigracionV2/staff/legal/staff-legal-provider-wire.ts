/** Staff legal provider wire — composition root — TICKET-V2-LEGAL-PROVIDER-FACTORY-PORTAL-INJECTION-001 · LC-13B */

import {
  DEFAULT_LEGAL_PROVIDER_MODE,
  buildStaffLegalCenterShellViewModel,
  buildStaffLegalCenterViewModel,
  resolveLegalProvider,
  type LegalProviderContext,
  type StaffLegalCenterViewModel,
  type StaffLegalPortalRole,
} from '../../shared/services/legal/provider';
import {
  DEFAULT_MEMORY_LEGAL_PROFILE_LOOKUP,
  resolveLegalReadAccessContextFromSession,
} from '../../shared/services/legal/persistence/identity';
import { renderLegalCenterShell } from '../../shared/services/legal/ui';
import {
  asSessionSnapshotWithPermissions,
  getSessionSnapshot,
} from '../../shared/session/runtime';

export type StaffLegalPortalBundle = {
  readonly provider: LegalProviderContext;
  readonly role: StaffLegalPortalRole;
  readonly getViewModel: () => Promise<StaffLegalCenterViewModel>;
  readonly renderLegalCenterShell: (mainRegion: ParentNode) => void;
};

function mapLegalReadContextToStaffPortalRole(
  role: 'owner' | 'manager' | 'seller',
): StaffLegalPortalRole {
  if (role === 'owner') {
    return 'staff_owner';
  }
  if (role === 'manager') {
    return 'staff_manager';
  }
  return 'staff_seller';
}

/** Fail-closed: least-privilege seller when session bridge cannot resolve staff context. */
function resolveStaffLegalRoleFromSession(): StaffLegalPortalRole {
  const snapshot = asSessionSnapshotWithPermissions(getSessionSnapshot());
  const bridgeResult = resolveLegalReadAccessContextFromSession({
    session: snapshot,
    permissions: snapshot.permissions,
    legalProfileLookup: DEFAULT_MEMORY_LEGAL_PROFILE_LOOKUP,
  });

  if (!bridgeResult.ok || bridgeResult.value.actorType !== 'staff' || bridgeResult.value.portal !== 'staff') {
    return 'staff_seller';
  }

  const staffRole = bridgeResult.value.role;
  if (staffRole !== 'owner' && staffRole !== 'manager' && staffRole !== 'seller') {
    return 'staff_seller';
  }

  return mapLegalReadContextToStaffPortalRole(staffRole);
}

export function resolveStaffLegalPortalBundle(): StaffLegalPortalBundle {
  const provider = resolveLegalProvider({ mode: DEFAULT_LEGAL_PROVIDER_MODE });
  const role = resolveStaffLegalRoleFromSession();

  return Object.freeze({
    provider,
    role,
    getViewModel: async () => buildStaffLegalCenterViewModel(provider, { role }),
    renderLegalCenterShell: (mainRegion) => {
      void buildStaffLegalCenterShellViewModel(provider, { role }).then((shell) => {
        mainRegion.append(renderLegalCenterShell(shell));
      });
    },
  });
}
