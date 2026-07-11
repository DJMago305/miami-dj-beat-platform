/** MOD-006 Configuration — Parse + Validate — TICKET-V2-RUNTIME-CONFIG-001 */

import { ConfigError } from './errors';
import type {
  ApiTransportMode,
  AppConfig,
  LogLevel,
  MdjEnvironment,
  ParsedConfigDraft,
  PortalId,
  RawEnvMap,
  SessionStorageBackend,
} from './types';

const ENV_VALUES: MdjEnvironment[] = ['local', 'staging', 'production'];
const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];
const SESSION_STORAGE: SessionStorageBackend[] = ['local', 'session', 'cookie'];
const PORTAL_IDS: PortalId[] = ['client', 'artist', 'staff'];

const FORBIDDEN_KEY_PATTERNS: RegExp[] = [
  /^SUPABASE_SERVICE_ROLE_KEY$/i,
  /_SECRET$/i,
  /_PRIVATE_KEY$/i,
  /^V1_/i,
];

function requireKey(raw: RawEnvMap, key: string, env: MdjEnvironment): string {
  const value = raw[key]?.trim();
  if (value) {
    return value;
  }
  if (env === 'local' && key === 'MDJ_V2_API_PUBLIC_URL') {
    return 'https://local-placeholder.supabase.co';
  }
  if (env === 'local' && key === 'MDJ_V2_API_ANON_KEY') {
    return 'local-dev-anon-key-placeholder';
  }
  throw new ConfigError('CONFIG_ERROR_MISSING_KEY', `Missing required config key: ${key}`);
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') {
    return true;
  }
  if (normalized === 'false' || normalized === '0') {
    return false;
  }
  throw new ConfigError('CONFIG_ERROR_INVALID_URL', `Invalid boolean value: ${value}`);
}

function parseEnv(raw: RawEnvMap): MdjEnvironment {
  const value = raw.MDJ_V2_ENV?.trim();
  if (!value) {
    throw new ConfigError('CONFIG_ERROR_MISSING_KEY', 'Missing required config key: MDJ_V2_ENV');
  }
  if (!ENV_VALUES.includes(value as MdjEnvironment)) {
    throw new ConfigError('CONFIG_ERROR_INVALID_ENV', `Invalid MDJ_V2_ENV: ${value}`);
  }
  return value as MdjEnvironment;
}

function scanForbiddenKeys(raw: RawEnvMap): void {
  for (const key of Object.keys(raw)) {
    if (FORBIDDEN_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
      throw new ConfigError('CONFIG_ERROR_FORBIDDEN_KEY', `Forbidden config key detected: ${key}`);
    }
    const lower = key.toLowerCase();
    if (lower.includes('service_role')) {
      throw new ConfigError('CONFIG_ERROR_FORBIDDEN_KEY', `Forbidden config key detected: ${key}`);
    }
  }
}

function assertValidUrl(label: string, value: string): void {
  try {
    const parsed = new URL(value);
    if (!parsed.protocol.startsWith('http')) {
      throw new Error('invalid protocol');
    }
  } catch {
    throw new ConfigError('CONFIG_ERROR_INVALID_URL', `Invalid URL for ${label}: ${value}`);
  }
}

function normalizeDeployRoot(value: string): string {
  const trimmed = value.trim();
  if (trimmed.includes('/web/') || trimmed.endsWith('/web')) {
    throw new ConfigError('CONFIG_ERROR_V1_PATH', 'Deploy root must not reference V1 /web/ path');
  }
  if (trimmed === '/') {
    return '/';
  }
  return trimmed.replace(/\/+$/, '');
}

function derivePortalUrl(deployRoot: string, portal: PortalId, explicit?: string): string {
  if (explicit?.trim()) {
    return explicit.trim().replace(/\/+$/, '') + '/';
  }
  const base = deployRoot === '/' ? '' : deployRoot.replace(/\/+$/, '');
  return `${base}/${portal}/`.replace(/\/{2,}/g, '/').replace(':/', '://');
}

function parseLogLevel(raw: RawEnvMap, env: MdjEnvironment, warnings: string[]): LogLevel {
  const value = raw.MDJ_V2_LOG_LEVEL?.trim().toLowerCase();
  if (!value) {
    return env === 'local' ? 'debug' : 'info';
  }
  if (!LOG_LEVELS.includes(value as LogLevel)) {
    warnings.push(`CONFIG_ERROR_INVALID_LOG_LEVEL: fallback to info (${value})`);
    return 'info';
  }
  const level = value as LogLevel;
  if (env === 'production' && level === 'debug') {
    warnings.push('Production debug log level rejected; using info');
    return 'info';
  }
  return level;
}

function parseApiTransportMode(raw: RawEnvMap): ApiTransportMode {
  const configured = raw.MDJ_V2_API_TRANSPORT?.trim().toLowerCase();
  return configured === 'fetch' ? 'fetch' : 'memory';
}

function assertNoV1PathInUrls(...urls: string[]): void {
  for (const url of urls) {
    if (url.includes('/web/')) {
      throw new ConfigError('CONFIG_ERROR_V1_PATH', `URL must not contain V1 /web/ path: ${url}`);
    }
  }
}

export function parseAndValidateConfig(raw: RawEnvMap): { config: AppConfig; warnings: string[] } {
  scanForbiddenKeys(raw);

  const warnings: string[] = [];
  const env = parseEnv(raw);
  const strict = parseBoolean(raw.MDJ_V2_FEATURE_STRICT_CONFIG, true);

  const deployRoot = normalizeDeployRoot(requireKey(raw, 'MDJ_V2_DEPLOY_ROOT', env));
  const portalClientUrl = derivePortalUrl(deployRoot, 'client', raw.MDJ_V2_PORTAL_CLIENT_URL);
  const portalArtistUrl = derivePortalUrl(deployRoot, 'artist', raw.MDJ_V2_PORTAL_ARTIST_URL);
  const portalStaffUrl = derivePortalUrl(deployRoot, 'staff', raw.MDJ_V2_PORTAL_STAFF_URL);

  assertValidUrl('MDJ_V2_PORTAL_CLIENT_URL', portalClientUrl);
  assertValidUrl('MDJ_V2_PORTAL_ARTIST_URL', portalArtistUrl);
  assertValidUrl('MDJ_V2_PORTAL_STAFF_URL', portalStaffUrl);

  const apiPublicUrl = requireKey(raw, 'MDJ_V2_API_PUBLIC_URL', env);
  const apiAnonKey = requireKey(raw, 'MDJ_V2_API_ANON_KEY', env);
  assertValidUrl('MDJ_V2_API_PUBLIC_URL', apiPublicUrl);
  assertNoV1PathInUrls(portalClientUrl, portalArtistUrl, portalStaffUrl, apiPublicUrl);

  const sessionStorageRaw = raw.MDJ_V2_SESSION_STORAGE?.trim() ?? 'session';
  if (!SESSION_STORAGE.includes(sessionStorageRaw as SessionStorageBackend)) {
    if (strict) {
      throw new ConfigError('CONFIG_ERROR_INVALID_URL', `Invalid MDJ_V2_SESSION_STORAGE: ${sessionStorageRaw}`);
    }
    warnings.push('Invalid session storage; fallback to session');
  }
  const sessionStorage = SESSION_STORAGE.includes(sessionStorageRaw as SessionStorageBackend)
    ? (sessionStorageRaw as SessionStorageBackend)
    : 'session';

  const refreshRaw = raw.MDJ_V2_REFRESH_BEFORE_MS?.trim();
  const refreshBeforeMs = refreshRaw ? Number(refreshRaw) : 300_000;
  if (!Number.isFinite(refreshBeforeMs) || refreshBeforeMs <= 0) {
    throw new ConfigError('CONFIG_ERROR_INVALID_URL', 'Invalid MDJ_V2_REFRESH_BEFORE_MS');
  }

  const defaultLocaleRaw = raw.MDJ_V2_DEFAULT_LOCALE?.trim() ?? 'en';
  if (defaultLocaleRaw !== 'en' && defaultLocaleRaw !== 'es') {
    throw new ConfigError(
      'CONFIG_ERROR_INVALID_URL',
      `Invalid MDJ_V2_DEFAULT_LOCALE: ${defaultLocaleRaw}`,
    );
  }
  const defaultLocale = defaultLocaleRaw;

  const defaultThemeRaw = raw.MDJ_V2_DEFAULT_THEME?.trim() ?? 'dark';
  if (defaultThemeRaw !== 'dark' && defaultThemeRaw !== 'light') {
    throw new ConfigError(
      'CONFIG_ERROR_INVALID_URL',
      `Invalid MDJ_V2_DEFAULT_THEME: ${defaultThemeRaw}`,
    );
  }
  const defaultTheme = defaultThemeRaw;

  const draft: ParsedConfigDraft = {
    env,
    appName: raw.MDJ_V2_APP_NAME?.trim() || 'MiamiDJBeat-MigracionV2',
    deployRoot,
    portalClientUrl,
    portalArtistUrl,
    portalStaffUrl,
    defaultLocale,
    defaultTheme,
    logLevel: parseLogLevel(raw, env, warnings),
    apiPublicUrl,
    apiAnonKey,
    apiTransportMode: parseApiTransportMode(raw),
    sessionStorage,
    refreshBeforeMs,
    features: {
      eventBus: parseBoolean(raw.MDJ_V2_FEATURE_EVENT_BUS, true),
      strictConfig: strict,
      debugPanel: parseBoolean(raw.MDJ_V2_FEATURE_DEBUG_PANEL, env === 'local'),
    },
    warnings,
  };

  if (!draft.features.strictConfig && env === 'production') {
    throw new ConfigError('CONFIG_ERROR_INVALID_ENV', 'Strict config cannot be disabled in production');
  }

  const config: AppConfig = {
    env: draft.env,
    appName: draft.appName,
    deploy: {
      root: draft.deployRoot,
      portalUrls: {
        client: draft.portalClientUrl,
        artist: draft.portalArtistUrl,
        staff: draft.portalStaffUrl,
      },
    },
    api: {
      publicUrl: draft.apiPublicUrl,
      anonKey: draft.apiAnonKey,
      transportMode: draft.apiTransportMode,
    },
    session: {
      storage: draft.sessionStorage,
      refreshBeforeMs: draft.refreshBeforeMs,
    },
    i18n: {
      defaultLocale: draft.defaultLocale,
    },
    theme: {
      defaultMode: draft.defaultTheme,
    },
    logging: {
      level: draft.logLevel,
    },
    features: draft.features,
    derived: {
      portalIds: PORTAL_IDS,
      sessionStorageKeyPrefix: 'mdj_v2_session_',
      eventBusCatalogVersion: 1,
    },
  };

  return { config, warnings: [...warnings, ...draft.warnings] };
}
