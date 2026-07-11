import { beforeEach, describe, expect, it } from 'vitest';
import {
  activateAuthForBoot,
  bootScaffold,
  getBootMockAuthProviderForTests,
  initializeApiForBoot,
  registerAuthForBoot,
  resetBootApiWiringForTests,
  resetBootAuthWiringForTests,
} from '@mdj/bootstrap/boot';
import { resetApiClientForTests } from '../../shared/api/runtime';
import {
  getConfigState,
  initializeConfiguration,
  resetConfigurationForTests,
} from '@mdj/shared/config';
import {
  initializeErrorHandler,
  resetErrorHandlerForTests,
} from '@mdj/shared/errors';
import {
  getEventBus,
  initializeEventBus,
  resetEventBusForTests,
} from '@mdj/shared/events';
import {
  emitSystemReady,
  getRuntime,
  getRuntimeState,
  initializeRuntime,
  resetRuntimeForTests,
} from '@mdj/shared/index';
import {
  initializeLogging,
  resetLoggingForTests,
} from '@mdj/shared/logging';
import {
  getSessionState,
  initializeSession,
  resetSessionForTests,
} from '@mdj/shared/session';
import { resetThemeBootIntegrationForTests } from '@mdj/shared/theme';
import {
  getAuthService,
  resetAuthForTests,
  resetAuthHandoffCounterForTests,
} from '../../shared/auth/runtime';

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
} as const;

const EXPECTED_CORE_REGISTRY_ORDER = [
  'MOD-006',
  'MOD-004',
  'MOD-010',
  'MOD-014',
  'MOD-001',
  'MOD-002',
  'MOD-005',
  'MOD-RUNTIME',
] as const;

function resetBootState(): void {
  resetBootAuthWiringForTests();
  resetBootApiWiringForTests();
  resetApiClientForTests();
  resetAuthHandoffCounterForTests();
  resetAuthForTests();
  resetSessionForTests();
  resetRuntimeForTests();
  resetThemeBootIntegrationForTests();
  resetErrorHandlerForTests();
  resetLoggingForTests();
  resetEventBusForTests();
  resetConfigurationForTests();
}

function bootThroughAuthActivation(portal: 'client' | 'artist' | 'staff'): void {
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

function getMod005RegistryEntry() {
  return getRuntime().getRegistry().find((entry) => entry.moduleId === 'MOD-005');
}

function seedValidMockRestore(userId: string, email: string): void {
  const provider = getBootMockAuthProviderForTests();
  provider.seedActiveRecordForTests({
    userId,
    email,
    accessTokenRef: `mock-${userId}-access`,
    refreshTokenRef: `mock-${userId}-refresh`,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    issuedAt: new Date().toISOString(),
  });
}

function getMod001RegistryEntry() {
  return getRuntime().getRegistry().find((entry) => entry.moduleId === 'MOD-001');
}

/** TICKET-V2-PHASE-5-MOD-001-RUNTIME-REGISTRY-001 */
describe('MOD-001 Runtime Registry — static boot snapshot', () => {
  beforeEach(() => {
    resetBootState();
  });

  it('registers MOD-001 with label Authentication on guest boot', () => {
    bootThroughAuthActivation('client');
    const runtime = initializeRuntime({ portal: 'client' });
    const mod001 = runtime.getRegistry().find((entry) => entry.moduleId === 'MOD-001');

    expect(mod001).toBeDefined();
    expect(mod001?.label).toBe('Authentication');
    expect(mod001?.lifecycleState).toBe('UNAUTHENTICATED');
    expect(mod001?.registeredAt).toEqual(expect.any(Number));
  });

  it('registers SESSION_HANDOFF_SUCCEEDED after valid restore', () => {
    registerAuthForBoot();
    seedValidMockRestore('mock-user-client-1', 'client@lab.test');

    const boot = bootScaffold(VALID_LOCAL_ENV, 'client');
    expect(boot.ok).toBe(true);
    if (!boot.ok) {
      return;
    }

    const mod001 = getMod001RegistryEntry();
    expect(mod001?.label).toBe('Authentication');
    expect(mod001?.lifecycleState).toBe('SESSION_HANDOFF_SUCCEEDED');
    expect(getAuthService().getState()).toBe('SESSION_HANDOFF_SUCCEEDED');
  });

  it('registers MOD-001 exactly once with registry size 8', () => {
    bootThroughAuthActivation('staff');
    const runtime = initializeRuntime({ portal: 'staff' });
    const registry = runtime.getRegistry();
    const mod001Entries = registry.filter((entry) => entry.moduleId === 'MOD-001');

    expect(mod001Entries).toHaveLength(1);
    expect(runtime.getSnapshot().registrySize).toBe(8);
  });

  it('preserves existing core modules and canonical registry order', () => {
    bootThroughAuthActivation('artist');
    const runtime = initializeRuntime({ portal: 'artist' });
    const moduleIds = runtime.getRegistry().map((entry) => entry.moduleId);

    expect(moduleIds).toEqual([...EXPECTED_CORE_REGISTRY_ORDER]);
    expect(moduleIds).toEqual(
      expect.arrayContaining(['MOD-006', 'MOD-004', 'MOD-010', 'MOD-014', 'MOD-002', 'MOD-RUNTIME']),
    );
  });

  it('resetRuntimeForTests clears MOD-001 from registry', () => {
    bootThroughAuthActivation('client');
    initializeRuntime({ portal: 'client' });
    expect(getMod001RegistryEntry()).toBeDefined();

    resetRuntimeForTests();
    expect(() => getRuntime()).toThrow();

    bootThroughAuthActivation('client');
    initializeRuntime({ portal: 'client' });
    expect(getMod001RegistryEntry()?.lifecycleState).toBe('UNAUTHENTICATED');
  });

  it('does not synchronize registry on post-boot auth changes or USER_LOGIN', async () => {
    const boot = bootScaffold(VALID_LOCAL_ENV, 'client');
    expect(boot.ok).toBe(true);
    if (!boot.ok) {
      return;
    }

    const registryStateBefore = getMod001RegistryEntry()?.lifecycleState;
    expect(registryStateBefore).toBe('UNAUTHENTICATED');

    const signInResult = await getAuthService().signIn(
      { email: 'client@lab.test', password: 'lab-pass' },
      'client',
    );
    expect(signInResult.ok).toBe(true);
    expect(getAuthService().getState()).not.toBe('UNAUTHENTICATED');

    expect(getMod001RegistryEntry()?.lifecycleState).toBe(registryStateBefore);

    getEventBus().publish({
      name: 'USER_LOGIN',
      payload: { userId: 'synthetic-user', email: 'synthetic@lab.test' },
      emitter: { moduleId: 'MOD-TEST', subsystem: 'registry-auth-test' },
      scope: 'internal',
    });

    expect(getMod001RegistryEntry()?.lifecycleState).toBe(registryStateBefore);
    expect(getRuntimeState().wiring.observedEvents).not.toContain('USER_LOGIN');
  });

  it('leaves Session state unchanged and emits SYSTEM_READY only after initializeRuntime', () => {
    bootThroughAuthActivation('client');
    expect(getSessionState()).toBe('SESSION_READY');
    expect(getConfigState()).toBe('FROZEN');

    const historyBeforeRuntime = getEventBus().getHistory().map((entry) => entry.name);
    expect(historyBeforeRuntime).not.toContain('SYSTEM_READY');

    initializeRuntime({ portal: 'client' });
    const historyAfterRuntime = getEventBus().getHistory().map((entry) => entry.name);
    expect(historyAfterRuntime).not.toContain('SYSTEM_READY');

    emitSystemReady();
    expect(getEventBus().getHistory().filter((entry) => entry.name === 'SYSTEM_READY')).toHaveLength(1);
    expect(getSessionState()).toBe('SESSION_READY');
  });
});

/** TICKET-V2-PHASE-6-MOD-005-RUNTIME-REGISTRY-001 */
describe('MOD-005 Runtime Registry — static boot snapshot', () => {
  beforeEach(() => {
    resetBootState();
  });

  it('registers MOD-005 with label API Client and API_READY on guest boot', () => {
    bootThroughAuthActivation('client');
    const runtime = initializeRuntime({ portal: 'client' });
    const mod005 = runtime.getRegistry().find((entry) => entry.moduleId === 'MOD-005');

    expect(mod005).toBeDefined();
    expect(mod005?.label).toBe('API Client');
    expect(mod005?.lifecycleState).toBe('API_READY');
    expect(mod005?.registeredAt).toEqual(expect.any(Number));
    expect(Object.keys(mod005 ?? {})).toEqual(['moduleId', 'label', 'lifecycleState', 'registeredAt']);
  });

  it('registers API_READY after signed-in bootScaffold', () => {
    registerAuthForBoot();
    seedValidMockRestore('mock-user-client-1', 'client@lab.test');

    const boot = bootScaffold(VALID_LOCAL_ENV, 'client');
    expect(boot.ok).toBe(true);
    if (!boot.ok) {
      return;
    }

    const mod005 = getMod005RegistryEntry();
    expect(mod005?.label).toBe('API Client');
    expect(mod005?.lifecycleState).toBe('API_READY');
  });

  it('registers MOD-005 exactly once with registry size 8', () => {
    bootThroughAuthActivation('artist');
    const runtime = initializeRuntime({ portal: 'artist' });
    const mod005Entries = runtime.getRegistry().filter((entry) => entry.moduleId === 'MOD-005');

    expect(mod005Entries).toHaveLength(1);
    expect(runtime.getSnapshot().registrySize).toBe(8);
  });

  it('places MOD-005 after MOD-002 and before MOD-RUNTIME', () => {
    bootThroughAuthActivation('client');
    const runtime = initializeRuntime({ portal: 'client' });
    const moduleIds = runtime.getRegistry().map((entry) => entry.moduleId);

    expect(moduleIds).toEqual([...EXPECTED_CORE_REGISTRY_ORDER]);
    expect(moduleIds.indexOf('MOD-005')).toBe(moduleIds.indexOf('MOD-002') + 1);
    expect(moduleIds.indexOf('MOD-RUNTIME')).toBe(moduleIds.indexOf('MOD-005') + 1);
  });

  it('does not expose Authorization or credential fields in registry entries', () => {
    bootThroughAuthActivation('client');
    initializeRuntime({ portal: 'client' });
    const serialized = JSON.stringify(getRuntime().getRegistry());

    expect(serialized).not.toMatch(/Authorization/i);
    expect(serialized).not.toMatch(/accessTokenRef/i);
    expect(serialized).not.toMatch(/Bearer /);
    expect(serialized).not.toMatch(/credentialVersion/i);
    expect(serialized).not.toMatch(/expiresAt/i);
  });

  it('does not synchronize MOD-005 registry on post-boot signIn', async () => {
    const boot = bootScaffold(VALID_LOCAL_ENV, 'client');
    expect(boot.ok).toBe(true);
    if (!boot.ok) {
      return;
    }

    const registryStateBefore = getMod005RegistryEntry()?.lifecycleState;
    expect(registryStateBefore).toBe('API_READY');

    const signInResult = await getAuthService().signIn(
      { email: 'client@lab.test', password: 'lab-pass' },
      'client',
    );
    expect(signInResult.ok).toBe(true);

    expect(getMod005RegistryEntry()?.lifecycleState).toBe(registryStateBefore);
  });
});
