/** MOD-006 Configuration — public API — TICKET-V2-RUNTIME-CONFIG-001 */

export { ConfigError, isConfigError } from './errors';
export {
  getConfig,
  getConfigState,
  getConfigWarnings,
  initializeConfiguration,
  resetConfigurationForTests,
} from './config-service';
export type {
  AppConfig,
  ConfigErrorCode,
  ConfigLifecycleState,
  LogLevel,
  MdjEnvironment,
  PortalId,
  RawEnvMap,
} from './types';
