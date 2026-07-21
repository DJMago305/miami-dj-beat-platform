/** @vitest-environment node */

/** LC-11 — Legal read persistence provider tests */

import { describe, expect, it } from 'vitest';

import { createApiClient, createMemoryTransport, createStaticSessionReader } from '../../shared/api/runtime';
import {
  createLegalReadFixtureStore,
  createLegalReadPersistenceProvider,
  createStaffOwnerReadContext,
  legalPersistenceError,
} from '../../shared/services/legal/persistence';
import { createFixtureLegalPersistenceReadTransport } from '../../shared/services/legal/persistence/transport/legal-persistence-read-transport';

describe('LC-11 legal read persistence provider', () => {
  it('defaults to memory mode', async () => {
    const provider = createLegalReadPersistenceProvider();
    expect(provider.mode).toBe('memory');
    const owner = createStaffOwnerReadContext();
    const template = await provider.repositories.templates.getTemplateById(owner, 'SPC-001');
    expect(template.ok).toBe(true);
  });

  it('creates supabase mode with ApiClient transport', async () => {
    const store = createLegalReadFixtureStore();
    const transport = createMemoryTransport();
    transport.enqueue({
      kind: 'response',
      status: 200,
      body: { data: store.instances, next_cursor: null, has_more: false },
    });
    const apiClient = createApiClient({
      transport,
      config: { baseUrl: 'https://example.supabase.co', anonKey: 'anon-key' },
      sessionReader: createStaticSessionReader({
        portal: 'staff',
        sessionId: 'ses_test',
        authorizationHeader: 'Bearer token',
        actorType: 'authenticated',
      }),
    });
    const provider = createLegalReadPersistenceProvider({ mode: 'supabase', apiClient });
    expect(provider.mode).toBe('supabase');
    const owner = createStaffOwnerReadContext();
    const listed = await provider.repositories.instances.listInstances(owner, { limit: 5 });
    expect(listed.ok).toBe(true);
  });

  it('requires transport or ApiClient for supabase mode', () => {
    try {
      createLegalReadPersistenceProvider({ mode: 'supabase' });
      expect.unreachable('Expected provider creation to throw');
    } catch (error) {
      expect(error).toEqual(
        legalPersistenceError(
          'persistence_provider_dependency_missing',
          'Supabase read persistence mode requires ApiClient or LegalPersistenceReadTransport.',
        ),
      );
    }
  });

  it('accepts explicit transport without fixtureStore for supabase mode', async () => {
    const transport = createFixtureLegalPersistenceReadTransport(createLegalReadFixtureStore());
    const provider = createLegalReadPersistenceProvider({ mode: 'supabase', transport });
    const owner = createStaffOwnerReadContext();
    const submission = await provider.repositories.submissions.getSubmissionById(owner, 'LDS-000101');
    expect(submission.ok).toBe(true);
  });
});
