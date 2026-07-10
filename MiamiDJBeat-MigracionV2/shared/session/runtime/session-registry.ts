/** MOD-002 Session Manager — session registry — TICKET-V2-PHASE-3-ARCHITECTURE-FOUNDATION-001 */

import type { PortalId } from '@mdj/shared/config';
import type { SessionLifecycleState, SessionSnapshot, SessionStateMachineState } from './types';

export type SessionRegistryEntry = {
  readonly sessionId: string;
  readonly portal: PortalId;
  readonly role: string;
  readonly capabilities: readonly string[];
  readonly lifecycleState: SessionLifecycleState;
  readonly machineState: SessionStateMachineState | null;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

function freezeEntry(entry: SessionRegistryEntry): SessionRegistryEntry {
  return Object.freeze({
    ...entry,
    capabilities: Object.freeze([...entry.capabilities]),
  });
}

/** Authoritative in-memory registry of active session records. */
export class SessionRegistry {
  private readonly entries = new Map<string, SessionRegistryEntry>();
  private activeSessionId: string | null = null;

  reset(): void {
    this.entries.clear();
    this.activeSessionId = null;
  }

  register(
    snapshot: SessionSnapshot,
    machineState: SessionStateMachineState | null,
    role: string,
    capabilities: readonly string[],
  ): SessionRegistryEntry {
    const now = new Date().toISOString();
    const existing = this.entries.get(snapshot.sessionId);
    const entry = freezeEntry({
      sessionId: snapshot.sessionId,
      portal: snapshot.portal,
      role,
      capabilities,
      lifecycleState: snapshot.state,
      machineState,
      expiresAt: snapshot.expiresAt,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });

    this.entries.set(snapshot.sessionId, entry);
    this.activeSessionId = snapshot.sessionId;
    return entry;
  }

  get(sessionId: string): SessionRegistryEntry | null {
    return this.entries.get(sessionId) ?? null;
  }

  getActive(): SessionRegistryEntry | null {
    if (!this.activeSessionId) {
      return null;
    }
    return this.entries.get(this.activeSessionId) ?? null;
  }

  remove(sessionId: string): void {
    this.entries.delete(sessionId);
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }
  }

  clear(): void {
    this.reset();
  }

  list(): readonly SessionRegistryEntry[] {
    return Object.freeze([...this.entries.values()]);
  }
}

const sessionRegistry = new SessionRegistry();

export function getSessionRegistry(): SessionRegistry {
  return sessionRegistry;
}

/** Test-only reset — not for production portals. */
export function resetSessionRegistryForTests(): void {
  sessionRegistry.reset();
}
