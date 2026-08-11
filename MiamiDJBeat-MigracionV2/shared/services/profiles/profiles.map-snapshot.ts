/**
 * Profiles — pure RPC→DTO mapper (read-only).
 * Does not call Supabase; accepts plain objects only.
 */

import type {
  AccessSnapshotDTO,
  AccessSnapshotProfileKind,
  AccessSnapshotRpcPayload,
} from './profiles.types';

const PROFILE_KINDS: readonly AccessSnapshotProfileKind[] = [
  'buyer',
  'artist',
  'staff_seller',
  'staff_full',
  'unknown',
];

function asStringOrNull(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  return null;
}

function asNumberOrNull(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asProfileKind(value: unknown): AccessSnapshotProfileKind | null {
  if (typeof value !== 'string') return null;
  return (PROFILE_KINDS as readonly string[]).includes(value)
    ? (value as AccessSnapshotProfileKind)
    : null;
}

/**
 * Map loose `mdj_access_snapshot` JSON → AccessSnapshotDTO.
 * Returns failure DTO when payload is invalid (never throws).
 */
export function mapAccessSnapshotRpcToDto(raw: AccessSnapshotRpcPayload | null | undefined): AccessSnapshotDTO {
  if (!raw || typeof raw !== 'object') {
    return Object.freeze({ ok: false, reason: 'invalid_payload' });
  }
  if (raw.ok === false) {
    const reason = asStringOrNull(raw.reason);
    return Object.freeze({
      ok: false,
      reason: reason && reason.trim() ? reason : 'unknown_reason',
    });
  }
  if (raw.ok !== true) {
    return Object.freeze({ ok: false, reason: 'invalid_payload' });
  }
  const profileKind = asProfileKind(raw.profile_kind);
  if (!profileKind) {
    return Object.freeze({ ok: false, reason: 'invalid_profile_kind' });
  }
  return Object.freeze({
    ok: true,
    profileKind,
    artistTier: asNumberOrNull(raw.artist_tier),
    buyerVip: asBoolean(raw.buyer_vip, false),
    role: asStringOrNull(raw.role),
    mdjbId: asStringOrNull(raw.mdjb_id),
    authUid: asStringOrNull(raw.auth_uid),
  });
}
