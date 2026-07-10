/**
 * Portal runtime verification via jsdom (boot + bootstrapPortal + DOM assertions).
 * TICKET-V2-BOOTSTRAP-RUNTIME-P0-001
 *
 * Run:
 *   node --import ./scripts/mdj-alias-loader.mjs --experimental-strip-types ./scripts/portal-runtime-verify.mjs
 */

import { JSDOM } from 'jsdom';
import { bootScaffold } from '../bootstrap/boot.ts';
import { bootstrapPortal } from '../shared/runtime/portal-bootstrap.ts';
import { getEventBus, resetEventBusForTests } from '../shared/events/runtime/index.ts';
import { resetRuntimeForTests } from '../shared/runtime/runtime-service.ts';
import { resetConfigurationForTests } from '../shared/config/runtime/index.ts';
import { resetLoggingForTests } from '../shared/logging/runtime/index.ts';
import { resetErrorHandlerForTests } from '../shared/errors/runtime/index.ts';
import { resetSessionForTests } from '../shared/session/runtime/index.ts';
import { resetThemeBootIntegrationForTests } from '../shared/theme/runtime/theme-boot-integration.ts';
import { CLIENT_SHELL_CONTENT } from '../shared/navigation/client-shell.config.ts';
import { ARTIST_SHELL_CONTENT } from '../shared/navigation/artist-shell.config.ts';
import { STAFF_SHELL_CONTENT } from '../shared/navigation/staff-shell.config.ts';

const ENV = {
  MDJ_V2_ENV: 'local',
  MDJ_V2_APP_NAME: 'MiamiDJBeat-MigracionV2',
  MDJ_V2_DEPLOY_ROOT: '/',
  MDJ_V2_PORTAL_CLIENT_URL: 'http://localhost:5173/client/',
  MDJ_V2_PORTAL_ARTIST_URL: 'http://localhost:5173/artist/',
  MDJ_V2_PORTAL_STAFF_URL: 'http://localhost:5173/staff/',
  MDJ_V2_DEFAULT_LOCALE: 'en',
  MDJ_V2_DEFAULT_THEME: 'dark',
  MDJ_V2_LOG_LEVEL: 'error',
  MDJ_V2_API_PUBLIC_URL: 'https://example.supabase.co',
  MDJ_V2_API_ANON_KEY: 'YOUR_ANON_KEY',
};

const portals = [
  { id: 'client', content: CLIENT_SHELL_CONTENT, heading: 'Client Dashboard' },
  { id: 'artist', content: ARTIST_SHELL_CONTENT, heading: 'Artist Dashboard' },
  { id: 'staff', content: STAFF_SHELL_CONTENT, heading: 'Staff Operations Dashboard' },
];

let failures = 0;

for (const portal of portals) {
  resetThemeBootIntegrationForTests();
  resetRuntimeForTests();
  resetSessionForTests();
  resetErrorHandlerForTests();
  resetLoggingForTests();
  resetEventBusForTests();
  resetConfigurationForTests();

  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>');
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Node = window.Node;

  const boot = bootScaffold(ENV, portal.id);
  const root = document.querySelector('#app');
  const result = bootstrapPortal({
    shellContent: portal.content,
    boot,
    root,
    permissionComponentCount: 4,
    mountDashboard: () => undefined,
  });

  const history = getEventBus().getHistory().map((entry) => entry.name);
  const statusPills = [...root.querySelectorAll('.mdj-shell-status-pill')].map(
    (node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  );
  const checks = {
    bootOk: boot.ok,
    portalReady: result.portalReadyEmitted,
    dashboardReady: result.dashboardReadyEmitted,
    systemReadyOnce: history.filter((name) => name === 'SYSTEM_READY').length === 1,
    shellHeader: Boolean(root.querySelector('[data-mdj-shell-region="header"]')),
    heroTitle: root.textContent?.includes(portal.heading) ?? false,
    configReady: statusPills.some((text) => text.includes('Configuration') && text.includes('ready')),
    busReady: statusPills.some((text) => text.includes('Event Bus') && text.includes('ready')),
    runtimeReady: statusPills.some((text) => text.includes('Runtime') && text.includes('ready')),
  };

  const portalFailures = Object.entries(checks).filter(([, ok]) => !ok);
  if (portalFailures.length > 0) {
    failures += portalFailures.length;
    console.error(`${portal.id}: FAIL`, Object.fromEntries(portalFailures));
  } else {
    console.log(`${portal.id}: PASS`, checks, '| events:', history.join(' -> '));
  }
}

if (failures > 0) {
  process.exit(1);
}

console.log('portal-runtime-verify: all portals passed');
