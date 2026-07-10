import { beforeEach, describe, expect, it } from 'vitest';
import { initializeConfiguration, resetConfigurationForTests } from '@mdj/shared/config';
import { initializeErrorHandler, resetErrorHandlerForTests } from '@mdj/shared/errors';
import { getEventBus, initializeEventBus, resetEventBusForTests } from '@mdj/shared/events';
import { initializeLogging, resetLoggingForTests } from '@mdj/shared/logging';
import {
  areSessionEventListenersRegistered,
  ensureSessionEventListeners,
  parsePermissionChangedPayload,
  parseUserLoginPayload,
  publishSessionEvent,
  resetSessionEventListenersForTests,
} from '../../shared/session/runtime/session-listeners';

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

function bootBus(): void {
  initializeConfiguration(VALID_LOCAL_ENV);
  initializeEventBus();
  initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
  initializeErrorHandler();
}

describe('MOD-002 Session Listeners — TICKET-MOD-002-SESSION-EVENT-WIRING-001', () => {
  beforeEach(() => {
    resetSessionEventListenersForTests();
    resetErrorHandlerForTests();
    resetLoggingForTests();
    resetEventBusForTests();
    resetConfigurationForTests();
  });

  it('registers listeners exactly once (idempotent)', () => {
    bootBus();

    const calls = { systemReady: 0 };
    ensureSessionEventListeners({
      onSystemReady: () => {
        calls.systemReady += 1;
      },
      onUserLogin: () => undefined,
      onUserLogout: () => undefined,
      onRoleChanged: () => undefined,
      onPermissionChanged: () => undefined,
    });

    expect(areSessionEventListenersRegistered()).toBe(true);

    ensureSessionEventListeners({
      onSystemReady: () => {
        calls.systemReady += 1;
      },
      onUserLogin: () => undefined,
      onUserLogout: () => undefined,
      onRoleChanged: () => undefined,
      onPermissionChanged: () => undefined,
    });

    calls.systemReady = 0;

    const published = getEventBus().publish({
      name: 'SYSTEM_READY',
      payload: { busVersion: '1.0.0', runtimeVersion: '0.1.0-runtime-p0' },
      emitter: { moduleId: 'MOD-RUNTIME', subsystem: 'test' },
      scope: 'internal',
    });

    expect(published.ok).toBe(true);
    expect(calls.systemReady).toBe(1);
  });

  it('parses USER_LOGIN payload for mock auth handoff', () => {
    const envelope = {
      eventId: 'evt_test',
      name: 'USER_LOGIN',
      version: 1,
      timestamp: new Date().toISOString(),
      emitter: { moduleId: 'MOD-001' },
      scope: 'public' as const,
      payload: {
        userId: 'user-999',
        handoffId: 'handoff-999',
        accessTokenRef: 'token-ref',
        provider: 'mock',
      },
    };

    expect(parseUserLoginPayload(envelope)).toEqual({
      userId: 'user-999',
      handoffId: 'handoff-999',
      accessTokenRef: 'token-ref',
      refreshTokenRef: undefined,
      expiresAt: undefined,
      issuedAt: undefined,
      provider: 'mock',
    });
  });

  it('parses PERMISSION_CHANGED payload', () => {
    const envelope = {
      eventId: 'evt_perm',
      name: 'PERMISSION_CHANGED',
      version: 1,
      timestamp: new Date().toISOString(),
      emitter: { moduleId: 'MOD-003' },
      scope: 'internal' as const,
      payload: {
        userId: 'user-123',
        snapshotVersion: 4,
        capabilities: ['bookings.read'],
      },
    };

    expect(parsePermissionChangedPayload(envelope)).toEqual({
      userId: 'user-123',
      snapshotVersion: 4,
      capabilities: ['bookings.read'],
    });
  });

  it('publishes official SESSION_ERROR event', () => {
    bootBus();
    const seen: string[] = [];
    getEventBus().subscribe('SESSION_ERROR', (envelope) => {
      seen.push(String(envelope.payload.code));
    });

    publishSessionEvent('SESSION_ERROR', {
      code: 'SESSION_ERROR_ILLEGAL_TRANSITION',
      sessionId: 'ses_test',
    });

    expect(seen).toEqual(['SESSION_ERROR_ILLEGAL_TRANSITION']);
  });
});
