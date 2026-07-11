/** MOD-005 API Client — Supabase invoke header policy — TICKET-V2-PHASE-6-EDGE-HEADER-POLICY-IMPLEMENTATION-001 */

import type { SupabaseInvokeAuthMode } from './types';

export type ResolveSupabaseInvokeHeadersInput = {
  readonly authMode: SupabaseInvokeAuthMode;
  readonly anonKey: string | null;
  readonly sessionAuthorization: string | null;
};

const SUPABASE_INVOKE_RESERVED_HEADERS = ['apikey', 'Authorization', 'authorization'] as const;

export function resolveSupabaseInvokeHeaders(
  input: ResolveSupabaseInvokeHeadersInput,
): Readonly<Record<string, string>> {
  const headers: Record<string, string> = {};
  const anonKey = input.anonKey?.trim() ?? '';

  if (anonKey) {
    headers.apikey = anonKey;
  }

  const sessionAuthorization = input.sessionAuthorization?.trim() ?? '';
  if (sessionAuthorization) {
    headers.Authorization = sessionAuthorization;
    return Object.freeze({ ...headers });
  }

  if (input.authMode === 'anon' && anonKey) {
    headers.Authorization = `Bearer ${anonKey}`;
  }

  return Object.freeze({ ...headers });
}

export function mergeSupabaseInvokeCallerHeaders(
  callerHeaders: Readonly<Record<string, string>> | undefined,
  policyHeaders: Readonly<Record<string, string>>,
): Record<string, string> {
  const merged: Record<string, string> = { ...(callerHeaders ?? {}) };

  for (const key of SUPABASE_INVOKE_RESERVED_HEADERS) {
    delete merged[key];
  }

  return { ...merged, ...policyHeaders };
}
