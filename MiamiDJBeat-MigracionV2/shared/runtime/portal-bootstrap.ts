/** MOD-RUNTIME — portal bootstrap — TICKET-V2-BOOTSTRAP-RUNTIME-P0-001 */

import type { BootResult } from '@mdj/bootstrap/boot';
import { getEventBus } from '@mdj/shared/events';
import { getLogger } from '@mdj/shared/logging';
import {
  buildPortalRuntimeStatus,
  renderPortalShell,
} from '../layout/render-portal-shell';
import type { PortalShellContent } from '../layout/types';
import { getRuntimeState } from './runtime-service';
import { RUNTIME_META, MDJ_V2_RUNTIME_VERSION } from './meta';

const PORTAL_EMITTER = Object.freeze({ moduleId: 'MOD-PORTAL-SHELL', subsystem: 'portal-bootstrap' });

export type PortalBootstrapInput = {
  readonly shellContent: PortalShellContent;
  readonly boot: BootResult;
  readonly root: HTMLElement;
  readonly permissionComponentCount: number;
  readonly mountDashboard?: (root: HTMLElement) => void;
};

export type PortalBootstrapResult = {
  readonly ok: boolean;
  readonly portalReadyEmitted: boolean;
  readonly dashboardReadyEmitted: boolean;
  readonly runtimeReady: boolean;
  readonly systemReadyConfirmed: boolean;
};

function emitPortalReady(portal: PortalShellContent['portalId'], surface: 'shell' | 'nav'): boolean {
  const result = getEventBus().publish({
    name: 'PORTAL_READY',
    emitter: PORTAL_EMITTER,
    payload: { portal, surface },
    scope: 'public',
  });
  return result.ok;
}

function emitDashboardReady(portal: PortalShellContent['portalId']): boolean {
  const result = getEventBus().publish({
    name: 'DASHBOARD_READY',
    emitter: PORTAL_EMITTER,
    payload: { portal },
    scope: 'public',
  });
  return result.ok;
}

/**
 * Portal bootstrap — renders shell, emits PORTAL_READY / DASHBOARD_READY.
 * Assumes bootScaffold() completed (Core + Runtime + Theme when applicable).
 */
export function bootstrapPortal(input: PortalBootstrapInput): PortalBootstrapResult {
  const { shellContent, boot, root, permissionComponentCount, mountDashboard } = input;
  const runtimeSnapshot = getRuntimeState();

  if (!boot.ok) {
    renderPortalShell(
      root,
      shellContent,
      buildPortalRuntimeStatus({
        content: shellContent,
        environment: 'unknown',
        configLoaded: boot.configLoaded,
        busReady: boot.busReady,
        loggingReady: boot.loggingReady,
        errorHandlerReady: boot.errorHandlerReady,
        sessionReady: boot.sessionReady,
        runtimeReady: boot.runtimeReady,
        systemReadyConfirmed: boot.systemReadyConfirmed,
        themeReady: false,
        permissionsReady: false,
        permissionComponentCount: 0,
        businessLogic: RUNTIME_META.businessLogic,
        version: MDJ_V2_RUNTIME_VERSION,
        bootErrorCode: boot.errorCode,
      }),
    );

    getLogger().warn('Portal bootstrap aborted — boot failure', {
      moduleId: 'MOD-RUNTIME',
      portal: shellContent.portalId,
      errorCode: boot.errorCode,
    });

    return {
      ok: false,
      portalReadyEmitted: false,
      dashboardReadyEmitted: false,
      runtimeReady: false,
      systemReadyConfirmed: false,
    };
  }

  renderPortalShell(
    root,
    shellContent,
    buildPortalRuntimeStatus({
      content: shellContent,
      environment: boot.environment,
      configLoaded: boot.configLoaded,
      busReady: boot.busReady,
      loggingReady: boot.loggingReady,
      errorHandlerReady: boot.errorHandlerReady,
      sessionReady: boot.sessionReady,
      runtimeReady: boot.runtimeReady,
      systemReadyConfirmed: boot.systemReadyConfirmed,
      themeReady: boot.themeReady,
      permissionsReady: permissionComponentCount > 0,
      permissionComponentCount,
      businessLogic: RUNTIME_META.businessLogic,
      version: MDJ_V2_RUNTIME_VERSION,
    }),
  );

  const portalReadyEmitted = emitPortalReady(shellContent.portalId, 'shell');

  let dashboardReadyEmitted = false;
  if (mountDashboard) {
    mountDashboard(root);
    dashboardReadyEmitted = emitDashboardReady(shellContent.portalId);
  }

  getLogger().info('Portal bootstrap complete', {
    moduleId: 'MOD-RUNTIME',
    portal: shellContent.portalId,
    portalReadyEmitted,
    dashboardReadyEmitted,
    runtimeLifecycle: runtimeSnapshot.lifecycle,
    systemReadyConfirmed: runtimeSnapshot.systemReadyConfirmed,
  });

  return {
    ok: true,
    portalReadyEmitted,
    dashboardReadyEmitted,
    runtimeReady: boot.runtimeReady,
    systemReadyConfirmed: runtimeSnapshot.systemReadyConfirmed,
  };
}
