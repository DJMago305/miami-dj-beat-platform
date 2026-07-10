/**
 * Boot event trace — same diagnostic as node -e boot trace, with alias loader.
 * TICKET-V2-BOOTSTRAP-RUNTIME-P0-001
 *
 * Run:
 *   node --import ./scripts/mdj-alias-loader.mjs --experimental-strip-types ./scripts/boot-event-trace.mjs
 */

import { bootScaffold } from '../bootstrap/boot.ts';
import { getEventBus, resetEventBusForTests } from '../shared/events/runtime/index.ts';
import { resetRuntimeForTests } from '../shared/runtime/runtime-service.ts';
import { resetConfigurationForTests } from '../shared/config/runtime/index.ts';
import { resetLoggingForTests } from '../shared/logging/runtime/index.ts';
import { resetErrorHandlerForTests } from '../shared/errors/runtime/index.ts';
import { resetSessionForTests } from '../shared/session/runtime/index.ts';
import { resetThemeBootIntegrationForTests } from '../shared/theme/runtime/theme-boot-integration.ts';

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

for (const portal of ['client', 'artist', 'staff']) {
  resetThemeBootIntegrationForTests();
  resetRuntimeForTests();
  resetSessionForTests();
  resetErrorHandlerForTests();
  resetLoggingForTests();
  resetEventBusForTests();
  resetConfigurationForTests();

  const boot = bootScaffold(ENV, portal);
  const events = getEventBus().getHistory().map((entry) => entry.name);
  console.log(
    `${portal}: ${boot.ok ? 'OK' : 'FAIL'} | events: ${events.join(' -> ')} | SYSTEM_READY count: ${events.filter((name) => name === 'SYSTEM_READY').length}`,
  );
}
