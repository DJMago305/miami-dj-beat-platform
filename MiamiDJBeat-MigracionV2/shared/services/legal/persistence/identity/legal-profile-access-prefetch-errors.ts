/** LC-13B — Prefetch error taxonomy (fail-closed; no privilege elevation) */

export type LegalProfileAccessPrefetchErrorCode =
  | 'unauthenticated'
  | 'profile_missing'
  | 'profile_inactive'
  | 'identity_ambiguous'
  | 'role_unsupported'
  | 'portal_mismatch'
  | 'malformed_response'
  | 'rpc_unavailable'
  | 'timeout'
  | 'cancelled'
  | 'stale_revision';

export type LegalProfileAccessPrefetchFailure = {
  readonly ok: false;
  readonly code: LegalProfileAccessPrefetchErrorCode;
  readonly message: string;
  readonly retried: boolean;
};

export type LegalProfileAccessPrefetchSuccess = {
  readonly ok: true;
  readonly revision: string;
};

export type LegalProfileAccessPrefetchResult =
  | LegalProfileAccessPrefetchSuccess
  | LegalProfileAccessPrefetchFailure;

export function legalProfileAccessPrefetchFailure(
  code: LegalProfileAccessPrefetchErrorCode,
  message: string,
  retried = false,
): LegalProfileAccessPrefetchFailure {
  return Object.freeze({ ok: false, code, message, retried });
}

export function legalProfileAccessPrefetchSuccess(revision: string): LegalProfileAccessPrefetchSuccess {
  return Object.freeze({ ok: true, revision });
}

const TRANSIENT_PREFETCH_CODES = new Set<LegalProfileAccessPrefetchErrorCode>([
  'rpc_unavailable',
  'timeout',
]);

export function isTransientLegalProfileAccessPrefetchError(
  code: LegalProfileAccessPrefetchErrorCode,
): boolean {
  return TRANSIENT_PREFETCH_CODES.has(code);
}

export function mapRpcFailureCodeToPrefetchCode(code: string): LegalProfileAccessPrefetchErrorCode {
  switch (code) {
    case 'unauthenticated':
      return 'unauthenticated';
    case 'profile_missing':
      return 'profile_missing';
    case 'profile_inactive':
      return 'profile_inactive';
    case 'identity_ambiguous':
      return 'identity_ambiguous';
    case 'role_unsupported':
      return 'role_unsupported';
    case 'portal_mismatch':
      return 'portal_mismatch';
    default:
      return 'malformed_response';
  }
}
