/** @vitest-environment node */

/** LC-11 — Legal read repository contract tests */

import { describe, expect, it } from 'vitest';

import { createApiClient, createMemoryTransport, createStaticSessionReader } from '../../shared/api/runtime';
import {
  createArtistReadContext,
  createClientReadContext,
  createLegalReadFixtureStore,
  createLegalReadPersistenceProvider,
  createMemoryLegalReadRepositories,
  createStaffManagerReadContext,
  createStaffOwnerReadContext,
  createStaffSellerReadContext,
  createSupabaseSimulatedLegalReadRepositories,
  LEGAL_READ_RPC_NAMES,
  type LegalReadPersistenceRepositories,
} from '../../shared/services/legal/persistence';
import { createFixtureLegalPersistenceReadTransport } from '../../shared/services/legal/persistence/transport/legal-persistence-read-transport';

function createContractFixture(): LegalReadPersistenceRepositories {
  const store = createLegalReadFixtureStore();
  return createMemoryLegalReadRepositories(store);
}

function createSupabaseContractFixture(): LegalReadPersistenceRepositories {
  const store = createLegalReadFixtureStore();
  return createSupabaseSimulatedLegalReadRepositories(createFixtureLegalPersistenceReadTransport(store));
}

async function runLegalReadRepositoryContract(
  createRepositories: () => LegalReadPersistenceRepositories,
) {
  const repos = createRepositories();
  const owner = createStaffOwnerReadContext();
  const artist = createArtistReadContext('ART-DEMO-001');
  const artistB = createArtistReadContext('ART-OTHER-999');
  const seller = createStaffSellerReadContext();
  const client = createClientReadContext();

  const template = await repos.templates.getTemplateById(owner, 'SPC-001');
  expect(template.ok).toBe(true);

  const missingInstance = await repos.instances.getInstanceById(owner, 'LDI-999999');
  expect(missingInstance.ok).toBe(false);

  const instance = await repos.instances.getInstanceById(owner, 'LDI-000101');
  expect(instance.ok).toBe(true);

  const artistInstance = await repos.instances.getInstanceById(artist, 'LDI-000101');
  expect(artistInstance.ok).toBe(true);
  const blockedArtist = await repos.instances.getInstanceById(artistB, 'LDI-000101');
  expect(blockedArtist.ok).toBe(false);

  const w9List = await repos.w9Requests.listW9Requests(owner, { limit: 10 });
  expect(w9List.ok && w9List.value.items.length).toBeGreaterThan(0);

  const active = await repos.w9Requests.findActiveW9RequestByRecipientAndTemplate(
    owner,
    'artist',
    'ART-DEMO-001',
    'SPC-001',
  );
  expect(active.ok && active.value?.id).toBe('W9R-000101');

  const submission = await repos.submissions.getSubmissionById(owner, 'LDS-000101');
  expect(submission.ok).toBe(true);

  const deletedDenied = await repos.submissions.getSubmissionById(createStaffManagerReadContext(), 'LDS-000102');
  expect(deletedDenied.ok).toBe(false);

  const deletedOwner = await repos.submissions.listSubmissionsIncludingDeleted(owner, { limit: 10 });
  expect(deletedOwner.ok && deletedOwner.value.items.some((row) => row.status === 'deleted')).toBe(true);

  const sellerW9 = await repos.w9Requests.listW9Requests(seller, { limit: 5 });
  expect(sellerW9.ok).toBe(false);

  const clientW9 = await repos.w9Requests.listW9Requests(client, { limit: 5 });
  expect(clientW9.ok).toBe(false);

  const audit = await repos.audit.listAuditEvents(owner, { limit: 10 });
  expect(audit.ok).toBe(true);
  if (audit.ok) {
    expect(audit.value.items.length).toBeGreaterThan(0);
    expect(audit.value.items[0].sequence).toBeLessThanOrEqual(audit.value.items.at(-1)!.sequence);
  }

  const artistAudit = await repos.audit.listAuditEvents(artist, { limit: 10 });
  expect(artistAudit.ok && artistAudit.value.items.length).toBeGreaterThan(0);

  const sellerAudit = await repos.audit.listAuditEvents(seller, { limit: 5 });
  expect(sellerAudit.ok).toBe(false);

  const badCursor = await repos.instances.listInstances(owner, { cursor: 'bad-cursor' });
  expect(badCursor.ok).toBe(false);

  if (instance.ok) {
    expect(() => {
      (instance.value.metadata as Record<string, string>).channel = 'mutated';
    }).toThrow();
  }
}

describe('LC-11 legal read repository contracts', () => {
  it('passes contract against memory read adapter', async () => {
    await runLegalReadRepositoryContract(createContractFixture);
  });

  it('passes contract against Supabase simulated read adapter', async () => {
    await runLegalReadRepositoryContract(createSupabaseContractFixture);
  });

  it('uses ApiClient rpc transport envelope for simulated Supabase reads', async () => {
    const store = createLegalReadFixtureStore();
    const transport = createMemoryTransport();
    transport.enqueue({
      kind: 'response',
      status: 200,
      body: {
        data: store.instances,
        next_cursor: null,
        has_more: false,
      },
    });
    const client = createApiClient({
      transport,
      config: { baseUrl: 'https://example.supabase.co', anonKey: 'anon-key' },
      sessionReader: createStaticSessionReader({
        portal: 'staff',
        sessionId: 'ses_test',
        authorizationHeader: 'Bearer token',
        actorType: 'authenticated',
      }),
    });
    const provider = createLegalReadPersistenceProvider({
      mode: 'supabase',
      apiClient: client,
    });
    expect(provider.mode).toBe('supabase');
    const rpcTransport = createFixtureLegalPersistenceReadTransport(store);
    const rpcResult = await rpcTransport.callRpc(LEGAL_READ_RPC_NAMES.instances, { limit: 5 });
    expect(rpcResult.ok && rpcResult.value.data.length).toBeGreaterThan(0);
  });
});
