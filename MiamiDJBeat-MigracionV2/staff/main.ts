import { bootScaffold } from '@mdj/bootstrap/boot';
import { bootstrapPortal } from '../shared/runtime/index';
import { STAFF_SHELL_CONTENT } from '../shared/navigation/staff-shell.config';
import { resolveStaffPortalComponentGuards } from './component-guards-wire';
import { resolveStaffDashboardDataProvider } from './data/staff-dashboard-provider-factory';
import { resolveStaffLegalPortalBundle } from './legal/staff-legal-provider-wire';
import { renderStaffDashboardMvp } from './render-staff-dashboard-mvp';
import { mountStaffIdentityReadSlice } from './identity/mount-staff-identity-read-slice';
import { mountStaffCalendarReadSlice } from './calendar/mount-staff-calendar-read-slice';
import { mountStaffFinanceReadSlice } from './finance/mount-staff-finance-read-slice';
import { mountStaffWeatherReadSlice } from './weather/mount-staff-weather-read-slice';
import { mountStaffMutationsSlice } from './mutations/mount-staff-mutations-slice';
import { resolveStaffSessionWiringPilot } from './session/staff-session-wiring-pilot';
import { createStaffMutationsAdapter } from '../shared/services/staff-mutations/index';
import { applyStaffPreviewRoleForDev } from './staff-preview-role';
import '../shared/layout/portal-shell.css';
import '../shared/services/legal/ui/legal-center-shell.css';
import './dashboard-mvp.css';
import './identity/staff-identity-read-view.css';
import './calendar/staff-calendar-read-view.css';
import './finance/staff-finance-read-view.css';
import './weather/staff-weather-read-view.css';
import './session/staff-session-wiring-pilot.css';
import './mutations/staff-mutations-view.css';

function main(): void {
  const app = document.querySelector('#app') as HTMLElement | null;
  if (!app) return;

  const boot = bootScaffold(undefined, 'staff');
  if (boot.ok) {
    applyStaffPreviewRoleForDev();
  }
  const staffDataProvider = resolveStaffDashboardDataProvider();
  const staffLegalBundle = resolveStaffLegalPortalBundle();
  const guards = boot.ok ? resolveStaffPortalComponentGuards() : { componentCount: 0 };
  // Paso 3 — read-only session wiring pilot (lab fixtures; no login writers).
  const sessionWiring = resolveStaffSessionWiringPilot('staff');
  // Writers Phase · Slice 3 · Paso 3 — lab mutations adapter (no HTTP / no Supabase).
  const mutationsAdapter = createStaffMutationsAdapter();
  const calendarAudience =
    sessionWiring.context.sessionRole === 'staff_seller' ? 'staff_seller' : 'staff_full';
  const financeAudience =
    sessionWiring.context.sessionRole === 'staff_seller' ? 'staff_seller' : 'staff_full';
  const weatherAudience =
    sessionWiring.context.sessionRole === 'staff_seller' ? 'staff_seller' : 'staff_master';

  bootstrapPortal({
    shellContent: STAFF_SHELL_CONTENT,
    boot,
    root: app,
    permissionComponentCount: guards.componentCount,
    mountDashboard: (root) => {
      const mainRegion = root.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
      if (!mainRegion) return;
      renderStaffDashboardMvp(mainRegion, staffDataProvider, sessionWiring, mutationsAdapter);
      void mountStaffIdentityReadSlice({ mainRegion, sessionWiring });
      // MOD-301 Slice 2 — master calendar (lab mock; gated by session wiring).
      void mountStaffCalendarReadSlice({
        mainRegion,
        audience: calendarAudience,
        sessionWiring,
      });
      // MOD-301 Financial Slice — master ledger (lab mock; gated by session wiring).
      void mountStaffFinanceReadSlice({
        mainRegion,
        audience: financeAudience,
        sessionWiring,
      });
      // MOD-301 Weather Slice — risk console (lab mock; gated by session wiring).
      void mountStaffWeatherReadSlice({
        mainRegion,
        audience: weatherAudience,
        sessionWiring,
      });
      // Writers Phase · Slice 3 · Paso 3 — payment review + artist assignment forms.
      if (sessionWiring.context.userId) {
        mountStaffMutationsSlice({
          mainRegion,
          adapter: mutationsAdapter,
          sessionContext: sessionWiring.context,
          staffUserId: sessionWiring.context.userId,
          sessionWiring,
        });
      }
      const contentGrid = mainRegion.querySelector('.mdj-client-dashboard__grid');
      staffLegalBundle.renderLegalCenterShell(contentGrid ?? mainRegion);
    },
  });
}

main();
