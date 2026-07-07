import { bootScaffold } from '@mdj/bootstrap/boot';
import { MDJ_V2_SCAFFOLD_VERSION, SCAFFOLD_META } from '@mdj/shared/index';
import {
  buildPortalRuntimeStatus,
  renderPortalShell,
} from '../shared/layout/render-portal-shell';
import { STAFF_SHELL_CONTENT } from '../shared/navigation/staff-shell.config';
import { resolveStaffPortalComponentGuards } from './component-guards-wire';
import '../shared/layout/portal-shell.css';

function main(): void {
  const boot = bootScaffold(undefined, 'staff');
  const app = document.querySelector('#app');
  if (!app) return;

  if (!boot.ok) {
    renderPortalShell(
      app,
      STAFF_SHELL_CONTENT,
      buildPortalRuntimeStatus({
        content: STAFF_SHELL_CONTENT,
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

  const guards = resolveStaffPortalComponentGuards();

  renderPortalShell(
    app,
    STAFF_SHELL_CONTENT,
    buildPortalRuntimeStatus({
      content: STAFF_SHELL_CONTENT,
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
}

main();
