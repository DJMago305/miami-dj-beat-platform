import { bootScaffold } from '@mdj/bootstrap/boot';
import { bootstrapPortal } from '../shared/runtime/index';
import { CLIENT_SHELL_CONTENT } from '../shared/navigation/client-shell.config';
import { resolveClientPortalComponentGuards } from './component-guards-wire';
import { renderClientDashboardMvp } from './render-client-dashboard-mvp';
import '../shared/layout/portal-shell.css';
import './dashboard-mvp.css';

function main(): void {
  const app = document.querySelector('#app') as HTMLElement | null;
  if (!app) return;

  const boot = bootScaffold(undefined, 'client');
  const guards = boot.ok ? resolveClientPortalComponentGuards() : { componentCount: 0 };

  bootstrapPortal({
    shellContent: CLIENT_SHELL_CONTENT,
    boot,
    root: app,
    permissionComponentCount: guards.componentCount,
    mountDashboard: (root) => {
      const mainRegion = root.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
      if (!mainRegion) return;
      renderClientDashboardMvp(mainRegion);
    },
  });
}

main();
