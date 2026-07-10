/** MOD-006 Configuration — TICKET-V2-RUNTIME-CONFIG-001 */

export type MdjEnvironment = 'local' | 'staging' | 'production';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type SessionStorageBackend = 'local' | 'session' | 'cookie';

export type PortalId = 'client' | 'artist' | 'staff';

export type ConfigLifecycleState = 'UNLOADED' | 'LOADING' | 'FROZEN' | 'ERROR';

export type ConfigErrorCode =
  | 'CONFIG_ERROR_INVALID_ENV'
  | 'CONFIG_ERROR_MISSING_KEY'
  | 'CONFIG_ERROR_FORBIDDEN_KEY'
  | 'CONFIG_ERROR_INVALID_URL'
  | 'CONFIG_ERROR_V1_PATH'
  | 'CONFIG_ERROR_INVALID_LOG_LEVEL';

export type AppConfig = {
  readonly env: MdjEnvironment;
  readonly appName: string;
  readonly deploy: {
    readonly root: string;
    readonly portalUrls: Readonly<Record<PortalId, string>>;
  };
  readonly api: {
    readonly publicUrl: string;
    readonly anonKey: string;
  };
  readonly session: {
    readonly storage: SessionStorageBackend;
    readonly refreshBeforeMs: number;
  };
  readonly i18n: {
    readonly defaultLocale: 'en' | 'es';
  };
  readonly theme: {
    readonly defaultMode: 'dark' | 'light';
  };
  readonly logging: {
    readonly level: LogLevel;
  };
  readonly features: {
    readonly eventBus: boolean;
    readonly strictConfig: boolean;
    readonly debugPanel: boolean;
  };
  readonly derived: {
    readonly portalIds: readonly PortalId[];
    readonly sessionStorageKeyPrefix: 'mdj_v2_session_';
    readonly eventBusCatalogVersion: 1;
  };
};

export type RawEnvMap = Record<string, string | undefined>;

export type ParsedConfigDraft = {
  env: MdjEnvironment;
  appName: string;
  deployRoot: string;
  portalClientUrl: string;
  portalArtistUrl: string;
  portalStaffUrl: string;
  defaultLocale: 'en' | 'es';
  defaultTheme: 'dark' | 'light';
  logLevel: LogLevel;
  apiPublicUrl: string;
  apiAnonKey: string;
  sessionStorage: SessionStorageBackend;
  refreshBeforeMs: number;
  features: {
    eventBus: boolean;
    strictConfig: boolean;
    debugPanel: boolean;
  };
  warnings: string[];
};
