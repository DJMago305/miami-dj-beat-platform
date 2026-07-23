/** LC-13B — Session-scoped legal profile resolution cache (memory-only; no tokens/PII) */

import type { DocumentedRoleId, ProfileKind } from '../../../../permissions/runtime';
import type { PortalId } from '../../../../config/runtime/types';

export type LegalProfileResolutionCacheKeyInput = {
  readonly authUserId: string;
  readonly profileKind: Exclude<ProfileKind, 'guest'>;
  readonly sourcePortal: PortalId;
  readonly documentedRole: DocumentedRoleId;
};

export type LegalProfileResolutionCacheEntry = {
  readonly legalRecipientId: string;
  readonly legalProfileId?: string;
  readonly revision: string;
  readonly sessionSnapshotVersion: number;
};

export type LegalProfileResolutionCachePort = {
  set(key: LegalProfileResolutionCacheKeyInput, entry: LegalProfileResolutionCacheEntry): void;
  get(key: LegalProfileResolutionCacheKeyInput): LegalProfileResolutionCacheEntry | null;
  has(key: LegalProfileResolutionCacheKeyInput): boolean;
  delete(key: LegalProfileResolutionCacheKeyInput): boolean;
  clear(): void;
  invalidateForAuthUser(authUserId: string): void;
};

function buildCacheKeyString(key: LegalProfileResolutionCacheKeyInput): string {
  return [
    key.authUserId.trim(),
    key.profileKind,
    key.sourcePortal,
    key.documentedRole,
  ].join('|');
}

export function buildLegalProfileResolutionCacheKey(key: LegalProfileResolutionCacheKeyInput): string {
  return buildCacheKeyString(key);
}

export class LegalProfileResolutionCache implements LegalProfileResolutionCachePort {
  private readonly entries = new Map<string, LegalProfileResolutionCacheEntry>();
  private readonly keysByAuthUser = new Map<string, Set<string>>();

  set(key: LegalProfileResolutionCacheKeyInput, entry: LegalProfileResolutionCacheEntry): void {
    const cacheKey = buildCacheKeyString(key);
    this.entries.set(cacheKey, Object.freeze({ ...entry }));
    const authKeys = this.keysByAuthUser.get(key.authUserId) ?? new Set<string>();
    authKeys.add(cacheKey);
    this.keysByAuthUser.set(key.authUserId, authKeys);
  }

  get(key: LegalProfileResolutionCacheKeyInput): LegalProfileResolutionCacheEntry | null {
    return this.entries.get(buildCacheKeyString(key)) ?? null;
  }

  has(key: LegalProfileResolutionCacheKeyInput): boolean {
    return this.entries.has(buildCacheKeyString(key));
  }

  delete(key: LegalProfileResolutionCacheKeyInput): boolean {
    const cacheKey = buildCacheKeyString(key);
    const deleted = this.entries.delete(cacheKey);
    const authKeys = this.keysByAuthUser.get(key.authUserId);
    authKeys?.delete(cacheKey);
    if (authKeys && authKeys.size === 0) {
      this.keysByAuthUser.delete(key.authUserId);
    }
    return deleted;
  }

  clear(): void {
    this.entries.clear();
    this.keysByAuthUser.clear();
  }

  invalidateForAuthUser(authUserId: string): void {
    const authKeys = this.keysByAuthUser.get(authUserId);
    if (!authKeys) {
      return;
    }
    for (const cacheKey of authKeys) {
      this.entries.delete(cacheKey);
    }
    this.keysByAuthUser.delete(authUserId);
  }
}

let defaultCache: LegalProfileResolutionCache = new LegalProfileResolutionCache();

export function getDefaultLegalProfileResolutionCache(): LegalProfileResolutionCache {
  return defaultCache;
}

export function resetLegalProfileResolutionCacheForTests(): void {
  defaultCache = new LegalProfileResolutionCache();
}
