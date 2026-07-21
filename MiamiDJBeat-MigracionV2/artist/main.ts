import { bootScaffold } from '@mdj/bootstrap/boot';
import { bootstrapPortal } from '../shared/runtime/index';
import { ARTIST_SHELL_CONTENT } from '../shared/navigation/artist-shell.config';
import { resolveArtistPortalComponentGuards } from './component-guards-wire';
import { resolveArtistLegalPortalBundle } from './legal/artist-legal-provider-wire';
import { renderArtistDashboardMvp } from './render-artist-dashboard-mvp';
import '../shared/layout/portal-shell.css';
import '../shared/services/legal/ui/legal-center-shell.css';
import './dashboard-mvp.css';

function main(): void {
  const app = document.querySelector('#app') as HTMLElement | null;
  if (!app) return;

  const boot = bootScaffold(undefined, 'artist');
  const artistLegalBundle = resolveArtistLegalPortalBundle();
  const guards = boot.ok ? resolveArtistPortalComponentGuards() : { componentCount: 0 };

  bootstrapPortal({
    shellContent: ARTIST_SHELL_CONTENT,
    boot,
    root: app,
    permissionComponentCount: guards.componentCount,
    mountDashboard: (root) => {
      const mainRegion = root.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
      if (!mainRegion) return;
      renderArtistDashboardMvp(mainRegion);
      const contentGrid = mainRegion.querySelector('.mdj-client-dashboard__grid');
      artistLegalBundle.renderLegalCenterShell(contentGrid ?? mainRegion);
    },
  });
}

main();
