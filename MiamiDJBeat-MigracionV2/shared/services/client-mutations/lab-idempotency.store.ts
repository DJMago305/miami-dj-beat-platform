/**
 * Lab idempotency store — in-memory only (Writers Phase).
 * Shared by Client Slice 1 + Artist Slice 2 + Staff Slice 3 adapters.
 * NO Supabase · NO durable disk · isolated per adapter instance / test.
 */

import type { ArtistMutationKind } from '../../types/artist.mutations.types';
import type { ClientMutationKind } from '../../types/client.mutations.types';
import type { StaffMutationKind } from '../../types/staff.mutations.types';

export type LabIdempotencyMutationKind =
  | ClientMutationKind
  | ArtistMutationKind
  | StaffMutationKind;

export type LabIdempotencyScopeKey = string;

export type LabIdempotencyRecord = {
  readonly scopeKey: LabIdempotencyScopeKey;
  /** Session-scoped actor (clientUserId or artistUserId). */
  readonly actorUserId: string;
  readonly mutationKind: LabIdempotencyMutationKind;
  readonly idempotencyKey: string;
  readonly payloadFingerprint: string;
  readonly labRecordId: string;
  readonly acceptedAt: string;
};

export type LabIdempotencyLookup =
  | { readonly hit: false }
  | {
      readonly hit: true;
      readonly record: LabIdempotencyRecord;
      readonly samePayload: boolean;
    };

export type LabIdempotencyStore = {
  readonly buildScopeKey: (input: {
    readonly actorUserId: string;
    readonly mutationKind: LabIdempotencyMutationKind;
    readonly idempotencyKey: string;
  }) => LabIdempotencyScopeKey;
  readonly lookup: (input: {
    readonly actorUserId: string;
    readonly mutationKind: LabIdempotencyMutationKind;
    readonly idempotencyKey: string;
    readonly payloadFingerprint: string;
  }) => LabIdempotencyLookup;
  readonly put: (record: LabIdempotencyRecord) => LabIdempotencyRecord;
  readonly getByLabRecordId: (labRecordId: string) => LabIdempotencyRecord | null;
  readonly size: () => number;
  readonly clear: () => void;
  readonly list: () => readonly LabIdempotencyRecord[];
};

/**
 * Create an isolated in-memory idempotency store for lab mutations.
 * Scope: `(actorUserId, mutationKind, idempotencyKey)`.
 */
export function createLabIdempotencyStore(): LabIdempotencyStore {
  const byScope = new Map<LabIdempotencyScopeKey, LabIdempotencyRecord>();
  const byRecordId = new Map<string, LabIdempotencyRecord>();

  const buildScopeKey: LabIdempotencyStore['buildScopeKey'] = (input) =>
    `${input.actorUserId}::${input.mutationKind}::${input.idempotencyKey}`;

  const store: LabIdempotencyStore = {
    buildScopeKey,
    lookup(input) {
      const scopeKey = buildScopeKey(input);
      const existing = byScope.get(scopeKey);
      if (!existing) {
        return Object.freeze({ hit: false as const });
      }
      return Object.freeze({
        hit: true as const,
        record: existing,
        samePayload: existing.payloadFingerprint === input.payloadFingerprint,
      });
    },
    put(record) {
      const frozen = Object.freeze({ ...record });
      byScope.set(frozen.scopeKey, frozen);
      byRecordId.set(frozen.labRecordId, frozen);
      return frozen;
    },
    getByLabRecordId(labRecordId) {
      return byRecordId.get(labRecordId) ?? null;
    },
    size() {
      return byScope.size;
    },
    clear() {
      byScope.clear();
      byRecordId.clear();
    },
    list() {
      return Object.freeze([...byScope.values()]);
    },
  };

  return store;
}
