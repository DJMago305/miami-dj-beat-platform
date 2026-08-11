import { bootScaffold } from '@mdj/bootstrap/boot';
import { bootstrapPortal } from '../shared/runtime/index';
import { CLIENT_SHELL_CONTENT } from '../shared/navigation/client-shell.config';
import { resolveClientPortalComponentGuards } from './component-guards-wire';
import { resolveClientLegalPortalBundle } from './legal/client-legal-provider-wire';
import { renderClientDashboardMvp } from './render-client-dashboard-mvp';
import { mountClientProfileReadSlice } from './profile/mount-client-profile-read-slice';
import { mountClientBookingsReadSlice } from './bookings/mount-client-bookings-read-slice';
import { mountClientFinanceReadSlice } from './finance/mount-client-finance-read-slice';
import { mountClientWeatherReadSlice } from './weather/mount-client-weather-read-slice';
import { mountClientMutationsSlice } from './mutations/mount-client-mutations-slice';
import { resolveClientSessionWiringPilot } from './session/client-session-wiring-pilot';
import { createClientMutationsAdapter } from '../shared/services/client-mutations/index';
import '../shared/layout/portal-shell.css';
import '../shared/services/legal/ui/legal-center-shell.css';
import './dashboard-mvp.css';
import './profile/client-profile-read-view.css';
import './bookings/client-bookings-read-view.css';
import './finance/client-finance-read-view.css';
import './weather/client-weather-read-view.css';
import './session/client-session-wiring-pilot.css';
import './mutations/client-mutations-view.css';

function main(): void {
  const app = document.querySelector('#app') as HTMLElement | null;
  if (!app) return;

  const boot = bootScaffold(undefined, 'client');
  const clientLegalBundle = resolveClientLegalPortalBundle();
  const guards = boot.ok ? resolveClientPortalComponentGuards() : { componentCount: 0 };
  // Paso 5 — read-only session wiring pilot (lab fixtures; client_id scope).
  const sessionWiring = resolveClientSessionWiringPilot('client');
  // Writers Phase · Slice 1 · Paso 3 — lab mutations adapter (no HTTP / no Supabase).
  const mutationsAdapter = createClientMutationsAdapter();

  bootstrapPortal({
    shellContent: CLIENT_SHELL_CONTENT,
    boot,
    root: app,
    permissionComponentCount: guards.componentCount,
    mountDashboard: (root) => {
      const mainRegion = root.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
      if (!mainRegion) return;
      renderClientDashboardMvp(mainRegion, sessionWiring, mutationsAdapter);
      void mountClientProfileReadSlice({ mainRegion, sessionWiring });
      // MOD-103 Slice 2 — bookings (lab mock; gated + scoped by session wiring).
      void mountClientBookingsReadSlice({ mainRegion, sessionWiring });
      // MOD-103 Financial Slice — receipts (lab mock; gated + scoped by session wiring).
      void mountClientFinanceReadSlice({ mainRegion, sessionWiring });
      // MOD-103 Weather Slice — event weather (lab mock; gated + scoped by session wiring).
      void mountClientWeatherReadSlice({ mainRegion, sessionWiring });
      // Writers Phase · Slice 1 · Paso 3 — booking request + offline payment proof forms.
      if (sessionWiring.clientUserId) {
        mountClientMutationsSlice({
          mainRegion,
          adapter: mutationsAdapter,
          sessionContext: sessionWiring.context,
          clientUserId: sessionWiring.clientUserId,
          sessionWiring,
        });
      }
      const contentGrid = mainRegion.querySelector('.mdj-client-dashboard__grid');
      clientLegalBundle.renderLegalCenterShell(contentGrid ?? mainRegion);
    },
  });
}

main();
