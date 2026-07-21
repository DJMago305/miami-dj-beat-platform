/** LC-11 — Legal persistence read errors */

export type LegalPersistenceErrorCode =
  | 'invalid_persistence_row'
  | 'persistence_entity_not_found'
  | 'persistence_relation_invalid'
  | 'persistence_status_invalid'
  | 'persistence_timestamp_invalid'
  | 'persistence_version_invalid'
  | 'persistence_cursor_invalid'
  | 'persistence_query_invalid'
  | 'persistence_transport_error'
  | 'persistence_access_forbidden'
  | 'persistence_api_client_required'
  | 'persistence_provider_dependency_missing'
  | 'persistence_mode_invalid';

export type LegalPersistenceError = {
  readonly ok: false;
  readonly code: LegalPersistenceErrorCode;
  readonly message: string;
  readonly context?: Readonly<Record<string, string | number | boolean | null>>;
};

export type LegalPersistenceResult<T> = { readonly ok: true; readonly value: T } | LegalPersistenceError;

export function legalPersistenceError(
  code: LegalPersistenceErrorCode,
  message: string,
  context?: Readonly<Record<string, string | number | boolean | null>>,
): LegalPersistenceError {
  return Object.freeze({
    ok: false,
    code,
    message,
    ...(context ? { context: Object.freeze({ ...context }) } : {}),
  });
}

export function legalPersistenceSuccess<T>(value: T): LegalPersistenceResult<T> {
  return Object.freeze({ ok: true, value });
}
