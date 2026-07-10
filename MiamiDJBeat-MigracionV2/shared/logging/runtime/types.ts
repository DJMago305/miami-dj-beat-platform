/** MOD-010 Logging — types — TICKET-V2-RUNTIME-LOGGING-001 */

import type { LogLevel, MdjEnvironment, PortalId } from '@mdj/shared/config';

export type { LogLevel };

export type LogSource = 'boot' | 'core' | 'portal' | 'test';

export type LoggingLifecycleState = 'LOG_UNINITIALIZED' | 'LOG_READY' | 'LOG_SHUTDOWN';

export type LogEntry = {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly moduleId: string;
  readonly source: LogSource;
  readonly env: MdjEnvironment;
  readonly correlationId?: string;
  readonly sessionId?: string;
  readonly portal?: PortalId;
  readonly code?: string;
  readonly meta?: Readonly<Record<string, unknown>>;
};

export type LogContext = {
  moduleId?: string;
  source?: LogSource;
  correlationId?: string;
  sessionId?: string;
  portal?: PortalId;
  code?: string;
};

export type Logger = {
  readonly debug: (message: string, meta?: Record<string, unknown>) => void;
  readonly info: (message: string, meta?: Record<string, unknown>) => void;
  readonly warn: (message: string, meta?: Record<string, unknown>) => void;
  readonly error: (message: string, meta?: Record<string, unknown>) => void;
  readonly fatal: (message: string, meta?: Record<string, unknown>) => void;
};

export type LoggingPublicApi = Logger & {
  readonly getState: () => LoggingLifecycleState;
  readonly getHistory: () => readonly LogEntry[];
};

export type LoggingErrorCode =
  | 'LOG_ERROR_SINK_FAILURE'
  | 'LOG_ERROR_REDACTION_FAIL'
  | 'LOG_ERROR_CIRCULAR'
  | 'LOG_ERROR_LEVEL_INVALID'
  | 'LOG_FATAL_BOOT';
