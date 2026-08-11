/**
 * session-wiring.service.spec.ts — Paso 2 read-only session wiring adapter + mappers.
 */
import { describe, expect, it } from 'vitest';
import { createStaticSessionReader } from '../../shared/api/runtime';
import {
  MOCK_SW_BEARER_CLIENT,
  MOCK_SW_CONTEXT_ANON,
  MOCK_SW_CONTEXT_ARTIST,
  MOCK_SW_CONTEXT_CLIENT,
  MOCK_SW_CONTEXT_EXPIRED,
  MOCK_SW_CONTEXT_SELLER,
  MOCK_SW_CONTEXT_STAFF,
  MOCK_SW_HEADER_CLIENT,
  MOCK_SW_HEADER_MISSING,
  MOCK_SW_JWT_CLIENT,
  MOCK_SW_SNAPSHOT_ANONYMOUS,
  MOCK_SW_SNAPSHOT_CLIENT,
  MOCK_SW_SNAPSHOT_EXPIRED,
  MOCK_SW_SNAPSHOT_STAFF_SELLER,
  createSessionWiringAdapter,
  evaluateDomainAccessWithSession,
  listSessionWiringAdapterReadMethods,
  mapBearerTokenToHeader,
  mapJwtClaimsRowToContext,
  mapSessionSnapshotToContext,
  resolveWiringRoleFromSnapshot,
} from '../../shared/services/session-wiring/index';

describe('session-wiring.map-rows — parse & roles', () => {
  it('parses Bearer header and redacts preview', () => {
    const header = mapBearerTokenToHeader(MOCK_SW_BEARER_CLIENT);
    expect(header.present).toBe(true);
    expect(header.scheme).toBe('Bearer');
    expect(header.redactedPreview).toMatch(/^Bearer /);
    expect(header.redactedPreview).not.toContain('abc123xyz');
  });

  it('maps client / artist / staff / seller roles from snapshots', () => {
    expect(MOCK_SW_CONTEXT_CLIENT.sessionRole).toBe('client');
    expect(MOCK_SW_CONTEXT_ARTIST.sessionRole).toBe('artist');
    expect(MOCK_SW_CONTEXT_STAFF.sessionRole).toBe('staff');
    expect(resolveWiringRoleFromSnapshot(MOCK_SW_SNAPSHOT_STAFF_SELLER)).toBe('staff_seller');
    expect(MOCK_SW_CONTEXT_SELLER.sessionRole).toBe('staff_seller');
  });

  it('marks anonymous and expired snapshots correctly', () => {
    expect(MOCK_SW_CONTEXT_ANON.isAnonymous).toBe(true);
    expect(MOCK_SW_CONTEXT_ANON.authorizationKind).toBe('none');
    expect(MOCK_SW_CONTEXT_EXPIRED.isExpired).toBe(true);
    expect(MOCK_SW_CONTEXT_EXPIRED.authorizationNoneReason).toBe('expired');
    expect(MOCK_SW_CONTEXT_EXPIRED.sessionRole).toBe('guest');
  });

  it('maps JWT-like claims with bearer into ready client context', () => {
    const ctx = mapJwtClaimsRowToContext(MOCK_SW_JWT_CLIENT, {
      bearerHeader: MOCK_SW_BEARER_CLIENT,
    });
    expect(ctx.sessionRole).toBe('client');
    expect(ctx.authorizationKind).toBe('ready');
    expect(ctx.userId).toBe(MOCK_SW_CONTEXT_CLIENT.userId);
  });
});

describe('session-wiring.map-rows — domain gating', () => {
  it('allows client session for weather / financial reads', () => {
    const weather = evaluateDomainAccessWithSession({
      domain: 'weather',
      context: MOCK_SW_CONTEXT_CLIENT,
      bearer: MOCK_SW_HEADER_CLIENT,
    });
    expect(weather.allowed).toBe(true);
    expect(weather.reason).toBe('ok');

    const financial = evaluateDomainAccessWithSession({
      domain: 'financial',
      context: MOCK_SW_CONTEXT_CLIENT,
      bearer: MOCK_SW_HEADER_CLIENT,
    });
    expect(financial.allowed).toBe(true);
  });

  it('rejects missing bearer and expired context', () => {
    expect(
      evaluateDomainAccessWithSession({
        domain: 'profiles',
        context: MOCK_SW_CONTEXT_CLIENT,
        bearer: MOCK_SW_HEADER_MISSING,
      }).reason,
    ).toBe('missing_bearer');

    expect(
      evaluateDomainAccessWithSession({
        domain: 'bookings',
        context: MOCK_SW_CONTEXT_EXPIRED,
        bearer: MOCK_SW_HEADER_CLIENT,
      }).reason,
    ).toBe('expired');

    expect(
      evaluateDomainAccessWithSession({
        domain: 'profiles',
        context: MOCK_SW_CONTEXT_ANON,
        bearer: MOCK_SW_HEADER_CLIENT,
      }).reason,
    ).toBe('anonymous');
  });

  it('rejects invalid Authorization scheme', () => {
    const basic = mapBearerTokenToHeader('Basic dXNlcjpwYXNz');
    const verdict = evaluateDomainAccessWithSession({
      domain: 'profiles',
      context: MOCK_SW_CONTEXT_CLIENT,
      bearer: basic,
    });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe('invalid_scheme');
  });

  it('enforces portal match when requested', () => {
    const mismatched = mapSessionSnapshotToContext({
      ...MOCK_SW_SNAPSHOT_CLIENT,
      portal: 'artist',
    });
    const verdict = evaluateDomainAccessWithSession({
      domain: 'bookings',
      context: mismatched,
      bearer: MOCK_SW_HEADER_CLIENT,
      enforcePortalMatch: true,
    });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe('portal_mismatch');
  });
});

describe('session-wiring.adapter — surface & methods', () => {
  it('exposes only read methods (no auth writers)', () => {
    const methods = listSessionWiringAdapterReadMethods();
    expect(methods).toEqual([
      'getLabSessionContext',
      'validateBearerTokenHeader',
      'verifyDomainAccessWithSession',
    ]);
    const adapter = createSessionWiringAdapter();
    expect(Object.keys(adapter).sort()).toEqual([...methods].sort());
    expect(JSON.stringify(adapter)).not.toMatch(
      /login|register|refreshToken|setCookie|signIn|signUp|resetPassword|mutateClaim/i,
    );
  });

  it('getLabSessionContext from snapshot + bearer', () => {
    const adapter = createSessionWiringAdapter({
      defaultSnapshot: MOCK_SW_SNAPSHOT_CLIENT,
      defaultBearerHeader: MOCK_SW_BEARER_CLIENT,
    });
    const result = adapter.getLabSessionContext();
    expect(result.source).toBe('snapshot');
    expect(result.context.sessionRole).toBe('client');
    expect(result.bearer.present).toBe(true);
  });

  it('getLabSessionContext prefers jwt claims when flagged', () => {
    const adapter = createSessionWiringAdapter();
    const result = adapter.getLabSessionContext({
      preferJwtClaims: true,
      jwtClaims: MOCK_SW_JWT_CLIENT,
      bearerHeader: MOCK_SW_BEARER_CLIENT,
    });
    expect(result.source).toBe('jwt_claims');
    expect(result.context.authorizationKind).toBe('ready');
  });

  it('getLabSessionContext can read SessionReaderPort', () => {
    const adapter = createSessionWiringAdapter();
    const reader = createStaticSessionReader({
      portal: 'artist',
      sessionId: 'ses_reader',
      authorizationHeader: 'Bearer lab_artist_token_def456uvw',
      actorType: 'authenticated',
    });
    const result = adapter.getLabSessionContext({ sessionReader: reader });
    expect(result.source).toBe('session_reader');
    expect(result.bearer.scheme).toBe('Bearer');
    expect(result.context.portal).toBe('artist');
  });

  it('validateBearerTokenHeader accepts Bearer and rejects empty/Basic', () => {
    const adapter = createSessionWiringAdapter();
    expect(adapter.validateBearerTokenHeader(MOCK_SW_BEARER_CLIENT).ok).toBe(true);
    expect(adapter.validateBearerTokenHeader(null).code).toBe('SESSION_WIRING_MISSING_BEARER');
    expect(adapter.validateBearerTokenHeader('Basic x').code).toBe(
      'SESSION_WIRING_INVALID_SCHEME',
    );
  });

  it('verifyDomainAccessWithSession wires evaluate gate', () => {
    const adapter = createSessionWiringAdapter();
    const ok = adapter.verifyDomainAccessWithSession({
      domain: 'weather',
      context: MOCK_SW_CONTEXT_STAFF,
      bearer: mapBearerTokenToHeader('Bearer lab_staff_token_ghi789rst'),
    });
    expect(ok.allowed).toBe(true);

    const denied = adapter.verifyDomainAccessWithSession({
      domain: 'financial',
      context: mapSessionSnapshotToContext(MOCK_SW_SNAPSHOT_ANONYMOUS),
      bearer: mapBearerTokenToHeader(null),
    });
    expect(denied.allowed).toBe(false);
  });

  it('expired snapshot from adapter remains gated off', () => {
    const adapter = createSessionWiringAdapter({
      defaultSnapshot: MOCK_SW_SNAPSHOT_EXPIRED,
      defaultBearerHeader: MOCK_SW_BEARER_CLIENT,
    });
    const { context, bearer } = adapter.getLabSessionContext();
    const verdict = adapter.verifyDomainAccessWithSession({
      domain: 'profiles',
      context,
      bearer,
    });
    expect(context.isExpired).toBe(true);
    expect(verdict.reason).toBe('expired');
  });
});
