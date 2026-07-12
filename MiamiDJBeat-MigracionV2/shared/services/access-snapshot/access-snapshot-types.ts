/** Domain service — access snapshot RPC types — TICKET-V2-PHASE-7-DOMAIN-SERVICE-WIRING-001 */

import type { ApiResponse, RequestContext } from '../../api/runtime/types';
import type { ProfileResolveInput, SnapshotFlags } from '../../permissions/runtime/types';

export const MDJ_ACCESS_SNAPSHOT_RPC = 'mdj_access_snapshot' as const;

export const MDJ_ACCESS_SNAPSHOT_PROFILE_KINDS = [
  'buyer',
  'artist',
  'staff_seller',
  'staff_full',
  'unknown',
] as const;

export type MdjAccessSnapshotProfileKind = (typeof MDJ_ACCESS_SNAPSHOT_PROFILE_KINDS)[number];

export type MdjAccessSnapshotSuccess = {
  readonly ok: true;
  readonly profile_kind: MdjAccessSnapshotProfileKind;
  readonly artist_tier?: number | null;
  readonly buyer_vip?: boolean;
  readonly role?: string | null;
  readonly auth_uid?: string;
};

export type MdjAccessSnapshotFailure = {
  readonly ok: false;
  readonly reason: string;
};

export type MdjAccessSnapshotPayload = MdjAccessSnapshotSuccess | MdjAccessSnapshotFailure;

export type AccessSnapshotServiceResult<T> = ApiResponse<T>;

/** Caller-safe options — authMode/requireSession are sealed by the service. */
export type AccessSnapshotFetchOptions = {
  readonly timeoutMs?: number;
  readonly context?: Partial<RequestContext>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
  readonly retrySafe?: boolean;
};

export type AccessSnapshotMappingCode =
  | 'ACCESS_SNAPSHOT_REJECTED'
  | 'ACCESS_SNAPSHOT_UNKNOWN_PROFILE'
  | 'ACCESS_SNAPSHOT_UNRESOLVED_STAFF'
  | 'ACCESS_SNAPSHOT_INVALID_PAYLOAD';

export type AccessSnapshotMappingResult =
  | {
      readonly ok: true;
      readonly profile: ProfileResolveInput;
      readonly flags: SnapshotFlags;
    }
  | {
      readonly ok: false;
      readonly code: AccessSnapshotMappingCode;
      readonly reason?: string;
    };

export type ValidateMdjAccessSnapshotPayloadResult =
  | { readonly ok: true; readonly payload: MdjAccessSnapshotPayload }
  | { readonly ok: false; readonly reason: string };
