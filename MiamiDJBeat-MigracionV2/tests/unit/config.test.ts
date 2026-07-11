import { describe, expect, it, beforeEach } from 'vitest';
import {
  ConfigError,
  getConfig,
  getConfigState,
  initializeConfiguration,
  resetConfigurationForTests,
} from '@mdj/shared/config';

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
  MDJ_V2_SESSION_STORAGE: 'session',
  MDJ_V2_REFRESH_BEFORE_MS: '300000',
  MDJ_V2_FEATURE_EVENT_BUS: 'true',
  MDJ_V2_FEATURE_STRICT_CONFIG: 'true',
  MDJ_V2_FEATURE_DEBUG_PANEL: 'true',
};

describe('MOD-006 Configuration', () => {
  beforeEach(() => {
    resetConfigurationForTests();
  });

  it('loads, validates and freezes AppConfig for local env', () => {
    const config = initializeConfiguration(VALID_LOCAL_ENV);
    expect(getConfigState()).toBe('FROZEN');
    expect(config.env).toBe('local');
    expect(config.logging.level).toBe('debug');
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.deploy.portalUrls)).toBe(true);
    expect(getConfig()).toBe(config);
  });

  it('rejects invalid MDJ_V2_ENV', () => {
    expect(() =>
      initializeConfiguration({ ...VALID_LOCAL_ENV, MDJ_V2_ENV: 'invalid' }),
    ).toThrowError(ConfigError);
    expect(getConfigState()).toBe('ERROR');
  });

  it('rejects forbidden keys', () => {
    try {
      initializeConfiguration({ ...VALID_LOCAL_ENV, SUPABASE_SERVICE_ROLE_KEY: 'secret' });
      expect.unreachable('should throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).code).toBe('CONFIG_ERROR_FORBIDDEN_KEY');
    }
  });

  it('rejects V1 /web/ deploy root', () => {
    try {
      initializeConfiguration({ ...VALID_LOCAL_ENV, MDJ_V2_DEPLOY_ROOT: '/web/' });
      expect.unreachable('should throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).code).toBe('CONFIG_ERROR_V1_PATH');
    }
  });

  it('falls back log level when invalid and records warning path', () => {
    const config = initializeConfiguration({
      ...VALID_LOCAL_ENV,
      MDJ_V2_LOG_LEVEL: 'not-a-level',
    });
    expect(config.logging.level).toBe('info');
  });

  it('throws when getConfig called before initialize', () => {
    expect(() => getConfig()).toThrowError(/not initialized/i);
    expect(getConfigState()).toBe('UNLOADED');
  });

  it('defaults api.transportMode to memory when MDJ_V2_API_TRANSPORT is unset', () => {
    const config = initializeConfiguration(VALID_LOCAL_ENV);
    expect(config.api.transportMode).toBe('memory');
  });

  it('resolves api.transportMode from MDJ_V2_API_TRANSPORT with trim and case-insensitive fetch', () => {
    const config = initializeConfiguration({
      ...VALID_LOCAL_ENV,
      MDJ_V2_API_TRANSPORT: ' FETCH ',
    });
    expect(config.api.transportMode).toBe('fetch');
  });

  it('falls back api.transportMode to memory for unknown transport flags', () => {
    const config = initializeConfiguration({
      ...VALID_LOCAL_ENV,
      MDJ_V2_API_TRANSPORT: 'supabase',
    });
    expect(config.api.transportMode).toBe('memory');
  });
});
