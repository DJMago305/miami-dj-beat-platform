import { bootScaffold } from '@mdj/bootstrap/boot';
import { MDJ_V2_SCAFFOLD_VERSION, SCAFFOLD_META } from '@mdj/shared/index';
import {
  buildPortalRuntimeStatus,
  renderPortalShell,
} from '../shared/layout/render-portal-shell';
import { ARTIST_SHELL_CONTENT } from '../shared/navigation/artist-shell.config';
import '../client/dashboard-mvp.css';
import { resolveArtistPortalComponentGuards } from './component-guards-wire';
import { renderArtistDashboardMvp } from './render-artist-dashboard-mvp';
import '../shared/layout/portal-shell.css';
import './dashboard-mvp.css';

function mountArtistDashboard(app: HTMLElement): void {
  const mainRegion = app.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
  if (!mainRegion) {
    return;
  }

  renderArtistDashboardMvp(mainRegion);
}

function main(): void {
  const boot = bootScaffold(undefined, 'artist');
  const app = document.querySelector('#app');
  if (!app) return;

  if (!boot.ok) {
    renderPortalShell(
      app,
      ARTIST_SHELL_CONTENT,
      buildPortalRuntimeStatus({
        content: ARTIST_SHELL_CONTENT,
        environment: 'unknown',
        configLoaded: boot.configLoaded,
        busReady: boot.busReady,
        loggingReady: boot.loggingReady,
        errorHandlerReady: boot.errorHandlerReady,
        sessionReady: boot.sessionReady,
        themeReady: false,
        permissionsReady: false,
        permissionComponentCount: 0,
        businessLogic: SCAFFOLD_META.businessLogic,
        version: MDJ_V2_SCAFFOLD_VERSION,
        bootErrorCode: boot.errorCode,
      }),
    );
    return;
  }

  const guards = resolveArtistPortalComponentGuards();

  renderPortalShell(
    app,
    ARTIST_SHELL_CONTENT,
    buildPortalRuntimeStatus({
      content: ARTIST_SHELL_CONTENT,
      environment: boot.environment,
      configLoaded: boot.configLoaded,
      busReady: boot.busReady,
      loggingReady: boot.loggingReady,
      errorHandlerReady: boot.errorHandlerReady,
      sessionReady: boot.sessionReady,
      themeReady: boot.themeReady,
      permissionsReady: guards.componentCount > 0,
      permissionComponentCount: guards.componentCount,
      businessLogic: SCAFFOLD_META.businessLogic,
      version: MDJ_V2_SCAFFOLD_VERSION,
    }),
  );

  mountArtistDashboard(app);
}

main();
