import { bootScaffold } from '@mdj/bootstrap/boot';
import { bootstrapPortal } from '../shared/runtime/index';
import { CLIENT_SHELL_CONTENT } from '../shared/navigation/client-shell.config';
import { resolveClientPortalComponentGuards } from './component-guards-wire';
import { resolveClientLegalPortalBundle } from './legal/client-legal-provider-wire';
import { renderClientDashboardMvp } from './render-client-dashboard-mvp';
import '../shared/layout/portal-shell.css';
import '../shared/services/legal/ui/legal-center-shell.css';
import './dashboard-mvp.css';

function main(): void {
  const app = document.querySelector('#app') as HTMLElement | null;
  if (!app) return;

  const boot = bootScaffold(undefined, 'client');
  const clientLegalBundle = resolveClientLegalPortalBundle();
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
      const contentGrid = mainRegion.querySelector('.mdj-client-dashboard__grid');
      clientLegalBundle.renderLegalCenterShell(contentGrid ?? mainRegion);
    },
  });
}

main();
