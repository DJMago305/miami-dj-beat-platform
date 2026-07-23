/** LC-13B — TypeScript contract for legal_resolve_profile_access RPC (SQL not implemented) */

import type { LegalProfileResolutionCacheEntry } from './legal-profile-resolution-cache';

export const LEGAL_RESOLVE_PROFILE_ACCESS_RPC = 'legal_resolve_profile_access' as const;

export type LegalResolveProfileAccessSourcePortal = 'staff' | 'artist' | 'client';

export type LegalResolveProfileAccessRequest = {
  readonly source_portal: LegalResolveProfileAccessSourcePortal;
  readonly correlation_id?: string;
};

export type LegalResolveProfileAccessFailureCode =
  | 'profile_missing'
  | 'identity_ambiguous'
  | 'portal_mismatch'
  | 'unauthenticated'
  | 'role_unsupported'
  | 'profile_inactive';

export type LegalResolveProfileAccessSuccessPayload = {
  readonly ok: true;
  readonly actor_type: 'staff' | 'artist' | 'client';
  readonly actor_role: 'owner' | 'manager' | 'seller' | 'artist' | 'client';
  readonly business_entity_id: string;
  readonly recipient_scope: string | null;
  readonly profile_status: 'active' | 'inactive';
  readonly revision: string;
  readonly mdjb_id?: string;
};

export type LegalResolveProfileAccessFailurePayload = {
  readonly ok: false;
  readonly code: LegalResolveProfileAccessFailureCode | string;
  readonly reason: string;
};

export type LegalResolveProfileAccessPayload =
  | LegalResolveProfileAccessSuccessPayload
  | LegalResolveProfileAccessFailurePayload;

export type ValidateLegalResolveProfileAccessPayloadResult =
  | { readonly ok: true; readonly payload: LegalResolveProfileAccessPayload }
  | { readonly ok: false; readonly reason: string };

const ACTOR_TYPES = new Set(['staff', 'artist', 'client']);
const ACTOR_ROLES = new Set(['owner', 'manager', 'seller', 'artist', 'client']);
const PROFILE_STATUSES = new Set(['active', 'inactive']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return typeof value === 'string' ? value : undefined;
}

export function validateLegalResolveProfileAccessPayload(
  value: unknown,
): ValidateLegalResolveProfileAccessPayloadResult {
  if (!isRecord(value)) {
    return { ok: false, reason: 'legal_resolve_profile_access payload must be an object.' };
  }

  if (typeof value.ok !== 'boolean') {
    return { ok: false, reason: 'legal_resolve_profile_access payload requires boolean ok.' };
  }

  if (value.ok === false) {
    const code = readNonEmptyString(value.code);
    const reason = readNonEmptyString(value.reason);
    if (!code || !reason) {
      return { ok: false, reason: 'legal_resolve_profile_access rejection requires code and reason.' };
    }
    return Object.freeze({
      ok: true,
      payload: Object.freeze({ ok: false, code, reason }),
    });
  }

  const actorType = readNonEmptyString(value.actor_type);
  const actorRole = readNonEmptyString(value.actor_role);
  const businessEntityId = readNonEmptyString(value.business_entity_id);
  const profileStatus = readNonEmptyString(value.profile_status);
  const revision = readNonEmptyString(value.revision);

  if (!actorType || !ACTOR_TYPES.has(actorType)) {
    return { ok: false, reason: 'legal_resolve_profile_access success requires actor_type.' };
  }
  if (!actorRole || !ACTOR_ROLES.has(actorRole)) {
    return { ok: false, reason: 'legal_resolve_profile_access success requires actor_role.' };
  }
  if (!businessEntityId) {
    return { ok: false, reason: 'legal_resolve_profile_access success requires business_entity_id.' };
  }
  if (!profileStatus || !PROFILE_STATUSES.has(profileStatus)) {
    return { ok: false, reason: 'legal_resolve_profile_access success requires profile_status.' };
  }
  if (!revision) {
    return { ok: false, reason: 'legal_resolve_profile_access success requires revision.' };
  }

  const recipientScope =
    value.recipient_scope === null
      ? null
      : readNonEmptyString(value.recipient_scope) ?? undefined;

  if (value.recipient_scope !== null && value.recipient_scope !== undefined && recipientScope === undefined) {
    return { ok: false, reason: 'legal_resolve_profile_access recipient_scope must be string or null.' };
  }

  const mdjbId = readOptionalString(value.mdjb_id);

  return Object.freeze({
    ok: true,
    payload: Object.freeze({
      ok: true,
      actor_type: actorType as LegalResolveProfileAccessSuccessPayload['actor_type'],
      actor_role: actorRole as LegalResolveProfileAccessSuccessPayload['actor_role'],
      business_entity_id: businessEntityId,
      recipient_scope: recipientScope ?? null,
      profile_status: profileStatus as LegalResolveProfileAccessSuccessPayload['profile_status'],
      revision,
      ...(mdjbId ? { mdjb_id: mdjbId } : {}),
    }),
  });
}

export function mapLegalResolveProfileAccessSuccessToCacheEntry(
  payload: LegalResolveProfileAccessSuccessPayload,
  sessionSnapshotVersion: number,
): LegalProfileResolutionCacheEntry {
  return Object.freeze({
    legalRecipientId: payload.business_entity_id,
    revision: payload.revision,
    sessionSnapshotVersion,
  });
}
