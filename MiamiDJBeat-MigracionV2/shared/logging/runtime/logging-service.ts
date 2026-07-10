/** MOD-010 Logging — in-memory service — TICKET-V2-RUNTIME-LOGGING-001 */

import { getConfig, type LogLevel, type MdjEnvironment } from '@mdj/shared/config';
import { getEventBusState } from '@mdj/shared/events';
import { redactMeta } from './redact';
import type {
  LogContext,
  LogEntry,
  Logger,
  LoggingLifecycleState,
  LoggingPublicApi,
} from './types';

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

const MAX_HISTORY = 200;

let lifecycleState: LoggingLifecycleState = 'LOG_UNINITIALIZED';
let minLevel: LogLevel = 'info';
let runtimeEnv: MdjEnvironment = 'local';
let defaultContext: LogContext = { moduleId: 'MOD-010', source: 'core' };

const ringBuffer: LogEntry[] = [];
let frozenApi: LoggingPublicApi | null = null;

function shouldEmit(level: LogLevel): boolean {
  if (level === 'fatal') {
    return true;
  }
  return LEVEL_RANK[level] >= LEVEL_RANK[minLevel];
}

function writeLocalSink(entry: LogEntry): void {
  const payload = {
    timestamp: entry.timestamp,
    level: entry.level,
    message: entry.message,
    moduleId: entry.moduleId,
    source: entry.source,
    env: entry.env,
    ...(entry.correlationId ? { correlationId: entry.correlationId } : {}),
    ...(entry.code ? { code: entry.code } : {}),
    ...(entry.meta ? { meta: entry.meta } : {}),
  };

  switch (entry.level) {
    case 'debug':
      console.debug(payload);
      break;
    case 'info':
      console.info(payload);
      break;
    case 'warn':
      console.warn(payload);
      break;
    case 'error':
    case 'fatal':
      console.error(payload);
      break;
  }
}

function pushHistory(entry: LogEntry): void {
  ringBuffer.push(entry);
  if (ringBuffer.length > MAX_HISTORY) {
    ringBuffer.shift();
  }
}

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (lifecycleState !== 'LOG_READY') {
    return;
  }

  if (!shouldEmit(level)) {
    return;
  }

  let redactedMeta: Record<string, unknown> | undefined;
  if (meta) {
    try {
      const redacted = redactMeta(meta);
      if (redacted && typeof redacted === 'object' && !Array.isArray(redacted)) {
        redactedMeta = Object.freeze({ ...(redacted as Record<string, unknown>) });
      }
    } catch {
      redactedMeta = Object.freeze({ redaction: 'LOG_ERROR_REDACTION_FAIL' });
    }
  }

  const entry = Object.freeze({
    timestamp: new Date().toISOString(),
    level,
    message,
    moduleId: defaultContext.moduleId ?? 'MOD-010',
    source: defaultContext.source ?? 'core',
    env: runtimeEnv,
    ...(defaultContext.correlationId ? { correlationId: defaultContext.correlationId } : {}),
    ...(defaultContext.sessionId ? { sessionId: defaultContext.sessionId } : {}),
    ...(defaultContext.portal ? { portal: defaultContext.portal } : {}),
    ...(defaultContext.code ? { code: defaultContext.code } : {}),
    ...(redactedMeta ? { meta: redactedMeta } : {}),
  }) satisfies LogEntry;

  pushHistory(entry);

  if (runtimeEnv === 'local') {
    writeLocalSink(entry);
  }
}

function buildLogger(): Logger {
  return Object.freeze({
    debug: (message, meta) => {
      emit('debug', message, meta);
    },
    info: (message, meta) => {
      emit('info', message, meta);
    },
    warn: (message, meta) => {
      emit('warn', message, meta);
    },
    error: (message, meta) => {
      emit('error', message, meta);
    },
    fatal: (message, meta) => {
      emit('fatal', message, meta);
    },
  });
}

function buildPublicApi(logger: Logger): LoggingPublicApi {
  return Object.freeze({
    ...logger,
    getState: () => lifecycleState,
    getHistory: () => Object.freeze([...ringBuffer]),
  });
}

/** Requires frozen Config + BUS_READY (ticket boot order). */
export function initializeLogging(context: LogContext = {}): LoggingPublicApi {
  if (lifecycleState === 'LOG_READY' && frozenApi) {
    return frozenApi;
  }

  if (lifecycleState === 'LOG_SHUTDOWN') {
    throw new Error('Logging has been shut down.');
  }

  if (getEventBusState() !== 'BUS_READY') {
    throw new Error('Event Bus must be BUS_READY before Logging initialization.');
  }

  const config = getConfig();
  runtimeEnv = config.env;
  minLevel = config.logging.level;
  defaultContext = {
    moduleId: context.moduleId ?? 'MOD-010',
    source: context.source ?? 'boot',
    ...(context.correlationId ? { correlationId: context.correlationId } : {}),
    ...(context.sessionId ? { sessionId: context.sessionId } : {}),
    ...(context.portal ? { portal: context.portal } : {}),
    ...(context.code ? { code: context.code } : {}),
  };

  lifecycleState = 'LOG_READY';
  const logger = buildLogger();
  frozenApi = buildPublicApi(logger);

  logger.info('Logging initialized', {
    minLevel,
    env: runtimeEnv,
    source: 'boot',
  });

  return frozenApi;
}

export function getLogger(): LoggingPublicApi {
  if (!frozenApi || lifecycleState !== 'LOG_READY') {
    throw new Error('Logging is not initialized. Call initializeLogging() during boot.');
  }
  return frozenApi;
}

export function getLoggingState(): LoggingLifecycleState {
  return lifecycleState;
}

/** Test-only reset — not for production portals. */
export function resetLoggingForTests(): void {
  ringBuffer.length = 0;
  lifecycleState = 'LOG_UNINITIALIZED';
  frozenApi = null;
  minLevel = 'info';
  runtimeEnv = 'local';
  defaultContext = { moduleId: 'MOD-010', source: 'core' };
}
