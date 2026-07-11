import { beforeEach, describe, expect, it } from 'vitest';
import {
  activateAuthForBoot,
  bootScaffold,
  initializeApiForBoot,
  registerAuthForBoot,
  resetBootApiWiringForTests,
  resetBootAuthWiringForTests,
} from '@mdj/bootstrap/boot';
import { resetApiClientForTests } from '../../shared/api/runtime';
import {
  EVENT_BUS_VERSION,
  getEventBus,
  getEventBusState,
  initializeEventBus,
  resetEventBusForTests,
} from '@mdj/shared/events';
import {
  areRuntimeEventListenersRegistered,
  emitSystemReady,
  getRuntimeState,
  initializeRuntime,
  resetRuntimeForTests,
} from '@mdj/shared/index';
import {
  getConfigState,
  initializeConfiguration,
  resetConfigurationForTests,
} from '@mdj/shared/config';
import {
  getErrorState,
  initializeErrorHandler,
  resetErrorHandlerForTests,
} from '@mdj/shared/errors';
import {
  getLoggingState,
  initializeLogging,
  resetLoggingForTests,
} from '@mdj/shared/logging';
import {
  getSessionState,
  initializeSession,
  resetSessionForTests,
} from '@mdj/shared/session';
import { resetAuthForTests } from '../../shared/auth/runtime';
import { resetThemeBootIntegrationForTests } from '@mdj/shared/theme';

const VALID_LOCAL_ENV = {
  MDJ_V2_ENV: 'local',
  MDJ_V2_APP_NAME: 'MiamiDJBeat-MigracionV2',
  MDJ_V2_DEPLOY_ROOT: '/',
  MDJ_V2_PORTAL_CLIENT_URL: 'http://localhost:5173/client/',
  MDJ_V2_PORTAL_ARTIST_URL: 'http://localhost:5173/artist/',
  MDJ_V2_PORTAL_STAFF_URL: 'http://localhost:5173/staff/',
  MDJ_V2_DEFAULT_LOCALE: 'en',
  MDJ_V2_DEFAULT_THEME: 'dark',
  MDJ_V2_LOG_LEVEL: 'debug',
  MDJ_V2_API_PUBLIC_URL: 'https://example.supabase.co',
  MDJ_V2_API_ANON_KEY: 'YOUR_ANON_KEY',
};

function bootThroughSession(portal: 'client' | 'artist' | 'staff'): void {
  initializeConfiguration(VALID_LOCAL_ENV);
  initializeEventBus();
  initializeLogging({ source: 'test', moduleId: 'MOD-010' });
  initializeErrorHandler();
  registerAuthForBoot();
  initializeSession({ portal });
  activateAuthForBoot(portal);
  const apiBoot = initializeApiForBoot(portal);
  expect(apiBoot.ok).toBe(true);
}

/** TICKET-V2-BOOTSTRAP-RUNTIME-P0-001 */
describe('MOD-RUNTIME — Registry · State · Lifecycle · Event wiring', () => {
  beforeEach(() => {
    resetBootAuthWiringForTests();
    resetBootApiWiringForTests();
    resetApiClientForTests();
    resetAuthForTests();
    resetThemeBootIntegrationForTests();
    resetRuntimeForTests();
    resetSessionForTests();
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
  });

  it('initializeEventBus emits BUS_READY but not SYSTEM_READY', () => {
    initializeEventBus();
    const history = getEventBus().getHistory().map((entry) => entry.name);
    expect(history).toContain('BUS_READY');
    expect(history).not.toContain('SYSTEM_READY');
  });

  it('initializeRuntime registers core modules and reaches RUNTIME_READY', () => {
    bootThroughSession('client');

    const runtime = initializeRuntime({ portal: 'client' });
    const snapshot = runtime.getSnapshot();

    expect(snapshot.lifecycle).toBe('RUNTIME_READY');
    expect(snapshot.portal).toBe('client');
    expect(snapshot.registrySize).toBeGreaterThanOrEqual(8);
    expect(areRuntimeEventListenersRegistered()).toBe(true);
    expect(runtime.getRegistry().map((entry) => entry.moduleId)).toEqual(
      expect.arrayContaining([
        'MOD-006',
        'MOD-004',
        'MOD-010',
        'MOD-014',
        'MOD-001',
        'MOD-002',
        'MOD-005',
        'MOD-RUNTIME',
      ]),
    );
  });

  it('SYSTEM_READY is not emitted before initializeRuntime()', () => {
    bootThroughSession('artist');
    const historyBeforeRuntime = getEventBus().getHistory().map((entry) => entry.name);
    expect(historyBeforeRuntime).not.toContain('SYSTEM_READY');

    initializeRuntime({ portal: 'artist' });
    const historyAfterRuntime = getEventBus().getHistory().map((entry) => entry.name);
    expect(historyAfterRuntime).not.toContain('SYSTEM_READY');
  });

  it('emitSystemReady publishes exactly one SYSTEM_READY after runtime wiring', () => {
    bootThroughSession('staff');
    initializeRuntime({ portal: 'staff' });
    emitSystemReady();

    const history = getEventBus().getHistory();
    const systemReadyEvents = history.filter((entry) => entry.name === 'SYSTEM_READY');
    expect(systemReadyEvents).toHaveLength(1);
    expect(systemReadyEvents[0]?.emitter.moduleId).toBe('MOD-RUNTIME');
    expect(systemReadyEvents[0]?.payload).toEqual({
      busVersion: EVENT_BUS_VERSION,
      runtimeVersion: '0.1.0-runtime-p0',
    });
    expect(getRuntimeState().systemReadyConfirmed).toBe(true);
  });

  it('bootScaffold follows canonical order and emits SYSTEM_READY once', () => {
    const boot = bootScaffold(VALID_LOCAL_ENV, 'client');
    expect(boot.ok).toBe(true);
    if (boot.ok) {
      expect(boot.runtimeReady).toBe(true);
      expect(boot.systemReadyConfirmed).toBe(true);
      expect(boot.runtimeState.lifecycle).toBe('RUNTIME_READY');
      expect(getConfigState()).toBe('FROZEN');
      expect(getSessionState()).toBe('SESSION_READY');
      expect(getLoggingState()).toBe('LOG_READY');
      expect(getErrorState()).toBe('ERR_READY');
    }

    const history = getEventBus().getHistory().map((entry) => entry.name);
    const busReadyIndex = history.indexOf('BUS_READY');
    const systemReadyIndex = history.indexOf('SYSTEM_READY');
    expect(busReadyIndex).toBeGreaterThanOrEqual(0);
    expect(systemReadyIndex).toBeGreaterThan(busReadyIndex);
    expect(history.filter((name) => name === 'SYSTEM_READY')).toHaveLength(1);
  });

  it('boot failure on missing env prevents SYSTEM_READY', () => {
    const boot = bootScaffold({ MDJ_V2_DEPLOY_ROOT: '/' }, 'client');
    expect(boot.ok).toBe(false);
    if (getEventBusState() === 'BUS_READY') {
      const history = getEventBus().getHistory().map((entry) => entry.name);
      expect(history).not.toContain('SYSTEM_READY');
    }
  });

  it('duplicate emitSystemReady is rejected', () => {
    bootThroughSession('client');
    initializeRuntime({ portal: 'client' });
    emitSystemReady();
    expect(() => emitSystemReady()).toThrow();
  });
});
