/** MOD-RUNTIME — errors — TICKET-V2-BOOTSTRAP-RUNTIME-P0-001 */

export type RuntimeErrorCode =
  | 'RUNTIME_NOT_READY'
  | 'RUNTIME_PREREQUISITE_MISSING'
  | 'RUNTIME_SYSTEM_READY_MISSING'
  | 'RUNTIME_ALREADY_SHUTDOWN';

export class RuntimeError extends Error {
  readonly code: RuntimeErrorCode;

  constructor(code: RuntimeErrorCode, message: string) {
    super(message);
    this.name = 'RuntimeError';
    this.code = code;
  }
}

export function isRuntimeError(error: unknown): error is RuntimeError {
  return error instanceof RuntimeError;
}
