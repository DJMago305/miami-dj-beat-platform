import { bootScaffold } from '@mdj/bootstrap/boot';
import { bootstrapPortal } from '../shared/runtime/index';
import { STAFF_SHELL_CONTENT } from '../shared/navigation/staff-shell.config';
import { resolveStaffPortalComponentGuards } from './component-guards-wire';
import { renderStaffDashboardMvp } from './render-staff-dashboard-mvp';
import '../shared/layout/portal-shell.css';
import './dashboard-mvp.css';

function main(): void {
  const app = document.querySelector('#app') as HTMLElement | null;
  if (!app) return;

  const boot = bootScaffold(undefined, 'staff');
  const guards = boot.ok ? resolveStaffPortalComponentGuards() : { componentCount: 0 };

  bootstrapPortal({
    shellContent: STAFF_SHELL_CONTENT,
    boot,
    root: app,
    permissionComponentCount: guards.componentCount,
    mountDashboard: (root) => {
      const mainRegion = root.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
      if (!mainRegion) return;
      renderStaffDashboardMvp(mainRegion);
    },
  });
}

main();
