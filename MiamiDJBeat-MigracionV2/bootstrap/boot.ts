/**
 * TICKET-V2-BOOTSTRAP-RUNTIME-P0-001
 * Boot: CONFIG → BUS → LOGGING → ERROR → AUTH(register) → SESSION → AUTH(activate) → API CLIENT → RUNTIME → SYSTEM_READY → THEME
 */

import {
  ConfigError,
  getConfig,
  getConfigState,
  initializeConfiguration,
  type MdjEnvironment,
  type PortalId,
  type RawEnvMap,
} from '@mdj/shared/config';
import {
  getErrorState,
  initializeErrorHandler,
  type ErrorHandlerLifecycleState,
} from '@mdj/shared/errors';
import {
  getEventBusState,
  initializeEventBus,
  type BusLifecycleState,
} from '@mdj/shared/events';
import {
  getLoggingState,
  initializeLogging,
  type LoggingLifecycleState,
} from '@mdj/shared/logging';
import { getAuthService } from '../shared/auth/runtime';
import type { AuthLifecycleState } from '../shared/auth/runtime/types';
import {
  emitSystemReady,
  getRuntimeState,
  initializeRuntime,
  RuntimeError,
  type RuntimeSnapshot,
} from '../shared/runtime/index';
import {
  getSessionSnapshot,
  getSessionState,
  initializeSession,
  type SessionLifecycleState,
} from '@mdj/shared/session';
import { bootIntegrateTheme } from '../shared/theme/runtime/theme-boot-integration';
import { activateAuthForBoot, registerAuthForBoot } from './initialize-auth';
import { initializeApiForBoot } from './initialize-api';

export {
  BOOT_AUTH_HANDOFF_MODE,
  activateAuthForBoot,
  getBootMockAuthProviderForTests,
  registerAuthForBoot,
  resetBootAuthWiringForTests,
  type BootAuthActivationResult,
  type BootAuthRegistration,
} from './initialize-auth';
export {
  getBootMemoryTransportForTests,
  initializeApiForBoot,
  resetBootApiWiringForTests,
  type BootApiInitializationResult,
} from './initialize-api';

export type BootPhase =
  | 'config'
  | 'event-bus'
  | 'logging'
  | 'error-handler'
  | 'auth'
  | 'session'
  | 'api-client'
  | 'runtime'
  | 'system-ready'
  | 'theme';

export type BootSuccess = {
  ok: true;
  phase: BootPhase;
  configLoaded: true;
  busReady: true;
  loggingReady: true;
  errorHandlerReady: true;
  authReady: true;
  sessionReady: true;
  runtimeReady: true;
  systemReadyConfirmed: true;
  themeReady: true;
  environment: MdjEnvironment;
  configState: ReturnType<typeof getConfigState>;
  busState: BusLifecycleState;
  loggingState: LoggingLifecycleState;
  errorHandlerState: ErrorHandlerLifecycleState;
  authState: AuthLifecycleState;
  sessionState: SessionLifecycleState;
  runtimeState: RuntimeSnapshot;
};

export type BootFailure = {
  ok: false;
  phase: BootPhase;
  configLoaded: boolean;
  busReady: boolean;
  loggingReady: boolean;
  errorHandlerReady: boolean;
  authReady: boolean;
  sessionReady: boolean;
  runtimeReady: boolean;
  systemReadyConfirmed: boolean;
  themeReady: false;
  errorCode: string;
  message: string;
};

export type BootResult = BootSuccess | BootFailure;

export function bootScaffold(envOverrides?: RawEnvMap, portal: PortalId = 'client'): BootResult {
  try {
    const config = initializeConfiguration(envOverrides ?? {});
    initializeEventBus();
    initializeLogging({ source: 'boot', moduleId: 'MOD-010' });
    initializeErrorHandler();
    registerAuthForBoot();
    initializeSession({ portal });

    const authActivation = activateAuthForBoot(portal);
    if (!authActivation.ok && !authActivation.recoverable) {
      return {
        ok: false,
        phase: 'auth',
        configLoaded: true,
        busReady: true,
        loggingReady: true,
        errorHandlerReady: true,
        authReady: false,
        sessionReady: getSessionState() === 'SESSION_READY',
        runtimeReady: false,
        systemReadyConfirmed: false,
        themeReady: false,
        errorCode: authActivation.code,
        message: authActivation.message,
      };
    }

    const apiBoot = initializeApiForBoot(portal);
    if (!apiBoot.ok) {
      return {
        ok: false,
        phase: 'api-client',
        configLoaded: true,
        busReady: true,
        loggingReady: true,
        errorHandlerReady: true,
        authReady: true,
        sessionReady: getSessionState() === 'SESSION_READY',
        runtimeReady: false,
        systemReadyConfirmed: false,
        themeReady: false,
        errorCode: apiBoot.code,
        message: apiBoot.message,
      };
    }

    initializeRuntime({ portal });
    emitSystemReady();

    const sessionSnapshot = getSessionSnapshot();
    const themeBoot = bootIntegrateTheme({
      portal,
      configDefaultMode: getConfig().theme.defaultMode,
      sessionThemeMode: sessionSnapshot.theme,
    });

    if (!themeBoot.themeReady) {
      return {
        ok: false,
        phase: 'theme',
        configLoaded: true,
        busReady: true,
        loggingReady: true,
        errorHandlerReady: true,
        authReady: true,
        sessionReady: true,
        runtimeReady: true,
        systemReadyConfirmed: true,
        themeReady: false,
        errorCode: 'THEME_BOOT_FAILED',
        message: 'Theme runtime failed to reach READY during boot.',
      };
    }

    return {
      ok: true,
      phase: 'theme',
      configLoaded: true,
      busReady: true,
      loggingReady: true,
      errorHandlerReady: true,
      authReady: true,
      sessionReady: true,
      runtimeReady: true,
      systemReadyConfirmed: true,
      themeReady: true,
      environment: config.env,
      configState: getConfigState(),
      busState: getEventBusState(),
      loggingState: getLoggingState(),
      errorHandlerState: getErrorState(),
      authState: getAuthService().getState(),
      sessionState: getSessionState(),
      runtimeState: getRuntimeState(),
    };
  } catch (error) {
    if (error instanceof ConfigError) {
      return {
        ok: false,
        phase: 'config',
        configLoaded: false,
        busReady: false,
        loggingReady: false,
        errorHandlerReady: false,
        authReady: false,
        sessionReady: false,
        runtimeReady: false,
        systemReadyConfirmed: false,
        themeReady: false,
        errorCode: error.code,
        message: error.message,
      };
    }
    if (error instanceof RuntimeError) {
      return {
        ok: false,
        phase: 'runtime',
        configLoaded: getConfigState() === 'FROZEN',
        busReady: getEventBusState() === 'BUS_READY',
        loggingReady: getLoggingState() === 'LOG_READY',
        errorHandlerReady: getErrorState() === 'ERR_READY',
        authReady: true,
        sessionReady: getSessionState() === 'SESSION_READY',
        runtimeReady: false,
        systemReadyConfirmed: false,
        themeReady: false,
        errorCode: error.code,
        message: error.message,
      };
    }
    throw error;
  }
}
