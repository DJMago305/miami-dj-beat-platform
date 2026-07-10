/** MOD-001 Authentication — mock provider — TICKET-V2-PHASE-5-MOD-001-AUTH-FOUNDATION-001 */

import type { AuthProviderPort } from './auth-provider-port';
import type {
  ProviderRefreshResult,
  ProviderRestoreResult,
  ProviderSignInInput,
  ProviderSignInResult,
  SignOutRequest,
} from './types';

type MockUserRecord = {
  readonly userId: string;
  readonly email: string;
  readonly mdjbId?: string;
  readonly displayName?: string;
  readonly accessTokenRef: string;
  readonly refreshTokenRef?: string;
  readonly expiresAt: string;
  readonly issuedAt: string;
};

export type MockAuthProviderOptions = {
  readonly users?: readonly {
    readonly email: string;
    readonly password?: string;
    readonly userId: string;
    readonly mdjbId?: string;
    readonly displayName?: string;
  }[];
  readonly defaultTtlMs?: number;
  readonly failRestore?: boolean;
  readonly failRefresh?: boolean;
  readonly unavailable?: boolean;
};

const DEFAULT_USERS = [
  {
    email: 'artist@lab.test',
    password: 'lab-pass',
    userId: 'mock-user-artist-1',
    mdjbId: 'MDJB-0001-0001-A',
    displayName: 'Lab Artist',
  },
  {
    email: 'client@lab.test',
    password: 'lab-pass',
    userId: 'mock-user-client-1',
    mdjbId: 'MDJB-0002-0002-C',
    displayName: 'Lab Client',
  },
] as const;

function isFailureEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return normalized === 'fail@lab.test' || normalized === 'invalid@lab.test';
}

function buildTokenRef(userId: string, suffix: string): string {
  return `mock-${userId}-${suffix}`;
}

export class MockAuthProvider implements AuthProviderPort {
  private readonly users: readonly {
    readonly email: string;
    readonly password?: string;
    readonly userId: string;
    readonly mdjbId?: string;
    readonly displayName?: string;
  }[];

  private readonly defaultTtlMs: number;
  private readonly failRestore: boolean;
  private readonly failRefresh: boolean;
  private readonly unavailable: boolean;
  private activeRecord: MockUserRecord | null = null;

  constructor(options: MockAuthProviderOptions = {}) {
    this.users = options.users ?? DEFAULT_USERS;
    this.defaultTtlMs = options.defaultTtlMs ?? 3_600_000;
    this.failRestore = options.failRestore ?? false;
    this.failRefresh = options.failRefresh ?? false;
    this.unavailable = options.unavailable ?? false;
  }

  async signIn(input: ProviderSignInInput): Promise<ProviderSignInResult> {
    if (this.unavailable) {
      return {
        ok: false,
        code: 'ERR-AUTH-006',
        message: 'Mock provider unavailable.',
      };
    }

    const email = input.credentials.email.trim().toLowerCase();
    if (isFailureEmail(email)) {
      return {
        ok: false,
        code: 'ERR-AUTH-002',
        message: 'Mock provider rejected credentials.',
      };
    }

    const user = this.users.find((entry) => entry.email.toLowerCase() === email);
    if (!user) {
      return {
        ok: false,
        code: 'ERR-AUTH-002',
        message: 'Mock provider user not found.',
      };
    }

    if (user.password !== undefined && user.password !== input.credentials.password) {
      return {
        ok: false,
        code: 'ERR-AUTH-002',
        message: 'Mock provider password mismatch.',
      };
    }

    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + this.defaultTtlMs).toISOString();
    const accessTokenRef = buildTokenRef(user.userId, 'access');
    const refreshTokenRef = buildTokenRef(user.userId, 'refresh');

    this.activeRecord = Object.freeze({
      userId: user.userId,
      email: user.email,
      mdjbId: user.mdjbId,
      displayName: user.displayName,
      accessTokenRef,
      refreshTokenRef,
      expiresAt,
      issuedAt,
    });

    return Object.freeze({
      ok: true,
      userId: user.userId,
      identity: Object.freeze({
        userId: user.userId,
        email: user.email,
        mdjbId: user.mdjbId,
        displayName: user.displayName,
        authProvider: 'mock',
      }),
      accessTokenRef,
      refreshTokenRef,
      expiresAt,
      issuedAt,
      provider: 'mock',
    });
  }

  async signOut(_request: SignOutRequest): Promise<void> {
    this.activeRecord = null;
  }

  async restore(): Promise<ProviderRestoreResult> {
    if (this.unavailable) {
      return {
        ok: false,
        code: 'ERR-AUTH-006',
        message: 'Mock provider unavailable during restore.',
      };
    }

    if (this.failRestore) {
      return {
        ok: false,
        code: 'ERR-AUTH-004',
        message: 'Mock provider restore failed.',
      };
    }

    if (!this.activeRecord) {
      return Object.freeze({ ok: true, empty: true });
    }

    if (Date.parse(this.activeRecord.expiresAt) <= Date.now()) {
      this.activeRecord = null;
      return {
        ok: false,
        code: 'ERR-AUTH-007',
        message: 'Mock provider restore found expired token.',
      };
    }

    const record = this.activeRecord;
    return Object.freeze({
      ok: true,
      userId: record.userId,
      identity: Object.freeze({
        userId: record.userId,
        email: record.email,
        mdjbId: record.mdjbId,
        displayName: record.displayName,
        authProvider: 'mock',
      }),
      accessTokenRef: record.accessTokenRef,
      refreshTokenRef: record.refreshTokenRef,
      expiresAt: record.expiresAt,
      issuedAt: record.issuedAt,
      provider: 'mock',
    });
  }

  async refresh(refreshTokenRef: string): Promise<ProviderRefreshResult> {
    if (this.unavailable) {
      return {
        ok: false,
        code: 'ERR-AUTH-006',
        message: 'Mock provider unavailable during refresh.',
      };
    }

    if (this.failRefresh || !this.activeRecord) {
      return {
        ok: false,
        code: 'ERR-AUTH-008',
        message: 'Mock provider refresh failed.',
      };
    }

    if (this.activeRecord.refreshTokenRef !== refreshTokenRef) {
      return {
        ok: false,
        code: 'ERR-AUTH-008',
        message: 'Mock provider refresh token mismatch.',
      };
    }

    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + this.defaultTtlMs).toISOString();
    const accessTokenRef = buildTokenRef(this.activeRecord.userId, `access-${Date.now()}`);

    this.activeRecord = Object.freeze({
      ...this.activeRecord,
      accessTokenRef,
      expiresAt,
      issuedAt,
    });

    return Object.freeze({
      ok: true,
      accessTokenRef,
      refreshTokenRef: this.activeRecord.refreshTokenRef,
      expiresAt,
      issuedAt,
    });
  }

  getActiveRecordForTests(): MockUserRecord | null {
    return this.activeRecord;
  }

  seedActiveRecordForTests(record: MockUserRecord): void {
    this.activeRecord = Object.freeze({ ...record });
  }
}

export function createMockAuthProvider(options?: MockAuthProviderOptions): MockAuthProvider {
  return new MockAuthProvider(options);
}
