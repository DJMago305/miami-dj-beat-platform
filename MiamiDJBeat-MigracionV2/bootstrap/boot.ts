/**
 * TICKET-V2-BOOTSTRAP-RUNTIME-P0-001
 * Boot: CONFIG → BUS → LOGGING → ERROR → SESSION → RUNTIME → SYSTEM_READY → THEME
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

export type BootPhase =
  | 'config'
  | 'event-bus'
  | 'logging'
  | 'error-handler'
  | 'session'
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
  sessionReady: true;
  runtimeReady: true;
  systemReadyConfirmed: true;
  themeReady: true;
  environment: MdjEnvironment;
  configState: ReturnType<typeof getConfigState>;
  busState: BusLifecycleState;
  loggingState: LoggingLifecycleState;
  errorHandlerState: ErrorHandlerLifecycleState;
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
    initializeSession({ portal });
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
      sessionReady: true,
      runtimeReady: true,
      systemReadyConfirmed: true,
      themeReady: true,
      environment: config.env,
      configState: getConfigState(),
      busState: getEventBusState(),
      loggingState: getLoggingState(),
      errorHandlerState: getErrorState(),
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
