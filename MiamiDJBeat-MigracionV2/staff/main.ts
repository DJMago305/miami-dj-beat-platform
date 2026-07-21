import { bootScaffold } from '@mdj/bootstrap/boot';
import { bootstrapPortal } from '../shared/runtime/index';
import { STAFF_SHELL_CONTENT } from '../shared/navigation/staff-shell.config';
import { resolveStaffPortalComponentGuards } from './component-guards-wire';
import { resolveStaffDashboardDataProvider } from './data/staff-dashboard-provider-factory';
import { resolveStaffLegalPortalBundle } from './legal/staff-legal-provider-wire';
import { renderStaffDashboardMvp } from './render-staff-dashboard-mvp';
import { applyStaffPreviewRoleForDev } from './staff-preview-role';
import '../shared/layout/portal-shell.css';
import '../shared/services/legal/ui/legal-center-shell.css';
import './dashboard-mvp.css';

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

  bootstrapPortal({
    shellContent: STAFF_SHELL_CONTENT,
    boot,
    root: app,
    permissionComponentCount: guards.componentCount,
    mountDashboard: (root) => {
      const mainRegion = root.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
      if (!mainRegion) return;
      renderStaffDashboardMvp(mainRegion, staffDataProvider);
      const contentGrid = mainRegion.querySelector('.mdj-client-dashboard__grid');
      staffLegalBundle.renderLegalCenterShell(contentGrid ?? mainRegion);
    },
  });
}

main();
