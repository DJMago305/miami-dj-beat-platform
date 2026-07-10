/** MOD-008 Portal Shell — unit tests — TICKET-MOD-008-PORTAL-SHELL-001 */

import { beforeEach, describe, expect, it } from 'vitest';
import { CLIENT_SHELL_CONTENT } from '../../shared/navigation/client-shell.config';
import { ARTIST_SHELL_CONTENT } from '../../shared/navigation/artist-shell.config';
import { STAFF_SHELL_CONTENT } from '../../shared/navigation/staff-shell.config';
import {
  buildPortalRuntimeStatus,
  renderPortalShell,
} from '../../shared/layout/render-portal-shell';

describe('MOD-008 Portal Shell configs', () => {
  it('client shell exposes client dashboard modules', () => {
    expect(CLIENT_SHELL_CONTENT.portalId).toBe('client');
    expect(CLIENT_SHELL_CONTENT.heroTitle).toBe('Client Dashboard');
    expect(CLIENT_SHELL_CONTENT.modules.some((entry) => entry.id === 'vip')).toBe(true);
  });

  it('artist shell exposes performer modules', () => {
    expect(ARTIST_SHELL_CONTENT.portalId).toBe('artist');
    expect(ARTIST_SHELL_CONTENT.modules.some((entry) => entry.id === 'song4tips')).toBe(true);
  });

  it('staff shell exposes backoffice modules', () => {
    expect(STAFF_SHELL_CONTENT.portalId).toBe('staff');
    expect(STAFF_SHELL_CONTENT.modules.some((entry) => entry.id === 'matching')).toBe(true);
  });
});

describe('MOD-008 Portal Shell render', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('renders header, sidebar, hero, KPIs, modules, and runtime status', () => {
    const root = document.querySelector('#app') as HTMLElement;
    expect(root).not.toBeNull();
    if (!root) return;

    renderPortalShell(
      root,
      CLIENT_SHELL_CONTENT,
      buildPortalRuntimeStatus({
        content: CLIENT_SHELL_CONTENT,
        environment: 'local',
        configLoaded: true,
        busReady: true,
        loggingReady: true,
        errorHandlerReady: true,
        sessionReady: true,
        runtimeReady: true,
        systemReadyConfirmed: true,
        themeReady: true,
        permissionsReady: true,
        permissionComponentCount: 12,
        businessLogic: false,
        version: '0.0.0-scaffold',
      }),
    );

    expect(root.querySelector('[data-mdj-shell-region="header"]')).not.toBeNull();
    expect(root.querySelector('[data-mdj-shell-region="sidebar"]')).not.toBeNull();
    expect(root.querySelector('[data-mdj-shell-region="hero"] h1')?.textContent).toBe(
      'Client Dashboard',
    );
    expect(root.querySelectorAll('.mdj-shell-kpi').length).toBe(4);
    expect(root.querySelectorAll('.mdj-shell-module').length).toBe(5);
    expect(root.querySelector('[data-mdj-status="theme"] .mdj-shell-status-pill__value')?.textContent).toBe(
      'ready',
    );
    expect(
      root.querySelector('[data-mdj-status="permissions"] .mdj-shell-status-pill__value')?.textContent,
    ).toBe('ready (12)');
  });
});
