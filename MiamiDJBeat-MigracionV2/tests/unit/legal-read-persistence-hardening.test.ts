/** @vitest-environment node */

/** LC-11 — Legal read persistence hardening audit tests */

import { describe, expect, it } from 'vitest';

import { createApiClient, createMemoryTransport, createStaticSessionReader } from '../../shared/api/runtime';
import {
  isLegalDocumentSubmissionStatus,
  LEGAL_DOCUMENT_SUBMISSION_STATUSES,
} from '../../shared/services/legal/submissions/legal-document-submission-status';
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
  LC11_FIXTURE_SUBMISSION_ACTIVE_ROW,
  LC11_FIXTURE_UUIDS,
  LEGAL_READ_RPC_NAMES,
  legalPersistenceError,
  mapLegalDocumentSubmissionRowToDomain,
  validateLegalDocumentSubmissionRow,
} from '../../shared/services/legal/persistence';
import { notFound } from '../../shared/services/legal/persistence/shared/legal-read-repository-helpers';
import { decodeReadCursor, normalizeReadLimit, paginateRows } from '../../shared/services/legal/persistence/legal-persistence-page';
import { createFixtureLegalPersistenceReadTransport } from '../../shared/services/legal/persistence/transport/legal-persistence-read-transport';
import type { LegalReadPersistenceRepositories } from '../../shared/services/legal/persistence/ports/legal-read-repository-ports';

function createTransportBackedSupabase(
  store = createLegalReadFixtureStore(),
): LegalReadPersistenceRepositories {
  return createSupabaseSimulatedLegalReadRepositories(createFixtureLegalPersistenceReadTransport(store));
}

function expectProviderThrow(run: () => unknown, expected: ReturnType<typeof legalPersistenceError>): void {
  try {
    run();
    expect.unreachable('Expected provider creation to throw');
  } catch (error) {
    expect(error).toEqual(expected);
  }
}

describe('LC-11 hardening — provider dependencies', () => {
  it('memory mode works without ApiClient or transport', async () => {
    const provider = createLegalReadPersistenceProvider({ mode: 'memory' });
    const owner = createStaffOwnerReadContext();
    const result = await provider.repositories.templates.getTemplateById(owner, 'SPC-001');
    expect(result.ok).toBe(true);
  });

  it('supabase mode without ApiClient or transport throws typed dependency error', () => {
    expectProviderThrow(
      () => createLegalReadPersistenceProvider({ mode: 'supabase' }),
      legalPersistenceError(
        'persistence_provider_dependency_missing',
        'Supabase read persistence mode requires ApiClient or LegalPersistenceReadTransport.',
      ),
    );
  });

  it('supabase mode with transport does not require fixtureStore on repositories', async () => {
    const transport = createFixtureLegalPersistenceReadTransport(createLegalReadFixtureStore());
    const provider = createLegalReadPersistenceProvider({ mode: 'supabase', transport });
    const owner = createStaffOwnerReadContext();
    const submission = await provider.repositories.submissions.getSubmissionById(owner, 'LDS-000101');
    expect(submission.ok).toBe(true);
    if (submission.ok) {
      expect(submission.value.id).toBe('LDS-000101');
      expect(submission.value.createdAt).toBe('2026-07-21T11:55:00.000Z');
      expect(submission.value.submittedAt).toBe('2026-07-21T12:00:00.000Z');
    }
  });

  it('invalid mode throws typed mode error', () => {
    expectProviderThrow(
      () => createLegalReadPersistenceProvider({ mode: 'postgres' as never }),
      legalPersistenceError('persistence_mode_invalid', 'Legal read persistence mode must be memory or supabase.'),
    );
  });

  it('does not depend on window in provider source', () => {
    expect(createLegalReadPersistenceProvider.toString()).not.toMatch(/window/);
  });
});

describe('LC-11 hardening — submission timestamps', () => {
  it('preserves distinct createdAt and submittedAt', () => {
    const mapped = mapLegalDocumentSubmissionRowToDomain(LC11_FIXTURE_SUBMISSION_ACTIVE_ROW);
    expect(mapped.ok).toBe(true);
    if (mapped.ok) {
      expect(mapped.value.createdAt).toBe('2026-07-21T11:55:00.000Z');
      expect(mapped.value.submittedAt).toBe('2026-07-21T12:00:00.000Z');
      expect(mapped.value.updatedAt).toBe('2026-07-21T12:00:00.000Z');
      expect(mapped.value.createdAt).not.toBe(mapped.value.submittedAt);
    }
  });

  it('rejects incoherent timestamp order', () => {
    const invalid = validateLegalDocumentSubmissionRow({
      ...LC11_FIXTURE_SUBMISSION_ACTIVE_ROW,
      created_at: '2026-07-21T13:00:00.000Z',
      submitted_at: '2026-07-21T12:00:00.000Z',
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.code).toBe('persistence_timestamp_invalid');
    }
  });
});

describe('LC-11 hardening — authorization matrix', () => {
  it('uses access forbidden for seller/client fiscal reads and not found for cross-artist', async () => {
    const repos = createTransportBackedSupabase();
    const artistA = createArtistReadContext('ART-DEMO-001');
    const artistB = createArtistReadContext('ART-OTHER-999');
    const seller = createStaffSellerReadContext();
    const client = createClientReadContext();
    const manager = createStaffManagerReadContext();
    const owner = createStaffOwnerReadContext();

    const allowed = await repos.instances.getInstanceById(artistA, 'LDI-000101');
    expect(allowed.ok).toBe(true);

    const blocked = await repos.instances.getInstanceById(artistB, 'LDI-000101');
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.code).toBe('persistence_entity_not_found');
    }

    const sellerW9 = await repos.w9Requests.listW9Requests(seller, { limit: 5 });
    expect(sellerW9.ok).toBe(false);
    if (!sellerW9.ok) {
      expect(sellerW9.code).toBe('persistence_access_forbidden');
    }

    const clientAudit = await repos.audit.listAuditEvents(client, { limit: 5 });
    expect(clientAudit.ok).toBe(false);
    if (!clientAudit.ok) {
      expect(clientAudit.code).toBe('persistence_access_forbidden');
    }

    const ownerDeleted = await repos.submissions.getSubmissionById(owner, 'LDS-000102');
    expect(ownerDeleted.ok).toBe(true);

    const managerDeleted = await repos.submissions.getSubmissionById(manager, 'LDS-000102');
    expect(managerDeleted.ok).toBe(false);
    if (!managerDeleted.ok) {
      expect(managerDeleted.code).toBe('persistence_entity_not_found');
    }
  });

  it('matches memory and supabase authorization outcomes', async () => {
    const store = createLegalReadFixtureStore();
    const memory = createMemoryLegalReadRepositories(store);
    const supabase = createTransportBackedSupabase(store);
    const artistB = createArtistReadContext('ART-OTHER-999');

    const memoryBlocked = await memory.instances.getInstanceById(artistB, 'LDI-000101');
    const supabaseBlocked = await supabase.instances.getInstanceById(artistB, 'LDI-000101');
    expect(memoryBlocked.ok).toBe(false);
    expect(supabaseBlocked.ok).toBe(false);
    if (!memoryBlocked.ok && !supabaseBlocked.ok) {
      expect(memoryBlocked.code).toBe(supabaseBlocked.code);
    }
  });
});

describe('LC-11 hardening — UUID not exposed', () => {
  it('does not leak persistence UUIDs in domain JSON', async () => {
    const repos = createTransportBackedSupabase();
    const owner = createStaffOwnerReadContext();
    const submission = await repos.submissions.getSubmissionById(owner, 'LDS-000101');
    expect(submission.ok).toBe(true);
    if (submission.ok) {
      const serialized = JSON.stringify(submission.value);
      expect(serialized).not.toContain(LC11_FIXTURE_UUIDS.submissionActive);
      expect(serialized).not.toContain(LC11_FIXTURE_UUIDS.instance);
    }
  });

  it('does not leak persistence UUIDs in notFound errors', () => {
    const error = notFound('Submission', 'LDS-999999');
    expect(error.ok).toBe(false);
    if (!error.ok) {
      const serialized = JSON.stringify(error);
      expect(serialized).not.toContain(LC11_FIXTURE_UUIDS.submissionActive);
      expect(error.message).not.toContain(LC11_FIXTURE_UUIDS.submissionActive);
    }
  });
});

describe('LC-11 hardening — pagination and cursor', () => {
  it('rejects invalid limits and corrupted cursors', () => {
    expect(normalizeReadLimit(0).ok).toBe(false);
    expect(normalizeReadLimit(-1).ok).toBe(false);
    expect(normalizeReadLimit(101).ok).toBe(false);
    expect(decodeReadCursor('%%%').ok).toBe(false);
    expect(decodeReadCursor(Buffer.from(JSON.stringify({ offset: -1 }), 'utf8').toString('base64url')).ok).toBe(
      false,
    );
  });

  it('returns stable pages without duplicates', () => {
    const rows = Object.freeze(['a', 'b', 'c', 'd']);
    const page1 = paginateRows(rows, 2, 0);
    const offset = decodeReadCursor(page1.nextCursor ?? undefined);
    expect(offset.ok).toBe(true);
    const page2 = paginateRows(rows, 2, offset.ok ? offset.value : 0);
    expect(page1.items).toEqual(['a', 'b']);
    expect(page2.items).toEqual(['c', 'd']);
    expect(new Set([...page1.items, ...page2.items]).size).toBe(4);
  });
});

describe('LC-11 hardening — ApiClient rpc usage', () => {
  it('routes supabase reads through ApiClient.rpc with validated envelope', async () => {
    const store = createLegalReadFixtureStore();
    const transport = createMemoryTransport();
    transport.enqueue({
      kind: 'response',
      status: 200,
      body: {
        data: store.templates,
        next_cursor: null,
        has_more: false,
      },
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
    const owner = createStaffOwnerReadContext();
    const result = await provider.repositories.templates.getTemplateById(owner, 'SPC-001');
    expect(result.ok).toBe(true);
    expect(transport.calls.some((call) => call.url.includes(LEGAL_READ_RPC_NAMES.templates))).toBe(true);
    expect(transport.calls.length).toBeGreaterThan(0);
  });

  it('normalizes transport failures without leaking payload', async () => {
    const transport = createMemoryTransport();
    transport.enqueue({
      kind: 'response',
      status: 500,
      body: {
        error: 'internal',
        storage_key: 'legal/submissions/secret.pdf',
        checksum: 'sha256:secret',
      },
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
    const owner = createStaffOwnerReadContext();
    const result = await provider.repositories.instances.listInstances(owner, { limit: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('persistence_transport_error');
      expect(JSON.stringify(result)).not.toContain('sha256:secret');
      expect(JSON.stringify(result)).not.toContain('legal/submissions/secret.pdf');
    }
  });
});

describe('LC-11 hardening — LC-8 submission status guard', () => {
  it('uses canonical status catalog for positive and negative checks', () => {
    for (const status of LEGAL_DOCUMENT_SUBMISSION_STATUSES) {
      expect(isLegalDocumentSubmissionStatus(status)).toBe(true);
    }
    expect(isLegalDocumentSubmissionStatus('uploaded')).toBe(true);
    expect(isLegalDocumentSubmissionStatus('unknown')).toBe(false);
  });
});

describe('LC-11 hardening — immutability', () => {
  it('does not mutate source rows when mapping submissions', () => {
    const row = { ...LC11_FIXTURE_SUBMISSION_ACTIVE_ROW, metadata: { ...LC11_FIXTURE_SUBMISSION_ACTIVE_ROW.metadata } };
    const mapped = mapLegalDocumentSubmissionRowToDomain(row);
    expect(mapped.ok).toBe(true);
    if (mapped.ok) {
      expect(() => {
        (mapped.value.metadata as Record<string, string>).channel = 'changed';
      }).toThrow();
      expect(row.metadata.channel).toBe('legal_center');
    }
  });
});

describe('LC-11 hardening — parity coverage by repository family', () => {
  const families: Array<{
    name: string;
    run: (
      memory: LegalReadPersistenceRepositories,
      supabase: LegalReadPersistenceRepositories,
    ) => Promise<void>;
  }> = [
    {
      name: 'template',
      run: async (memory, supabase) => {
        const owner = createStaffOwnerReadContext();
        const memoryGet = await memory.templates.getTemplateById(owner, 'SPC-001');
        const supabaseGet = await supabase.templates.getTemplateById(owner, 'SPC-001');
        expect(memoryGet).toEqual(supabaseGet);
        const memoryList = await memory.templates.listTemplates(owner, { limit: 5 });
        const supabaseList = await supabase.templates.listTemplates(owner, { limit: 5 });
        expect(memoryList).toEqual(supabaseList);
      },
    },
    {
      name: 'instance',
      run: async (memory, supabase) => {
        const owner = createStaffOwnerReadContext();
        const memoryGet = await memory.instances.getInstanceById(owner, 'LDI-000101');
        const supabaseGet = await supabase.instances.getInstanceById(owner, 'LDI-000101');
        expect(memoryGet).toEqual(supabaseGet);
        const memoryList = await memory.instances.listInstancesByStatus(owner, 'viewed', { limit: 5 });
        const supabaseList = await supabase.instances.listInstancesByStatus(owner, 'viewed', { limit: 5 });
        expect(memoryList).toEqual(supabaseList);
      },
    },
    {
      name: 'w9',
      run: async (memory, supabase) => {
        const owner = createStaffOwnerReadContext();
        const memoryGet = await memory.w9Requests.getW9RequestById(owner, 'W9R-000101');
        const supabaseGet = await supabase.w9Requests.getW9RequestById(owner, 'W9R-000101');
        expect(memoryGet).toEqual(supabaseGet);
        const memoryList = await memory.w9Requests.listW9RequestsByRecipient(owner, 'artist', 'ART-DEMO-001', {
          limit: 5,
        });
        const supabaseList = await supabase.w9Requests.listW9RequestsByRecipient(owner, 'artist', 'ART-DEMO-001', {
          limit: 5,
        });
        expect(memoryList).toEqual(supabaseList);
      },
    },
    {
      name: 'submission',
      run: async (memory, supabase) => {
        const owner = createStaffOwnerReadContext();
        const memoryGet = await memory.submissions.getSubmissionById(owner, 'LDS-000101');
        const supabaseGet = await supabase.submissions.getSubmissionById(owner, 'LDS-000101');
        expect(memoryGet).toEqual(supabaseGet);
        const memoryList = await memory.submissions.listSubmissionsByInstance(owner, 'LDI-000101', { limit: 5 });
        const supabaseList = await supabase.submissions.listSubmissionsByInstance(owner, 'LDI-000101', { limit: 5 });
        expect(memoryList).toEqual(supabaseList);
      },
    },
    {
      name: 'audit',
      run: async (memory, supabase) => {
        const artist = createArtistReadContext('ART-DEMO-001');
        const memoryList = await memory.audit.listAuditEvents(artist, { limit: 5 });
        const supabaseList = await supabase.audit.listAuditEvents(artist, { limit: 5 });
        expect(memoryList).toEqual(supabaseList);
        const memoryGet = await memory.audit.getAuditEventById(artist, 'LAE-000102');
        const supabaseGet = await supabase.audit.getAuditEventById(artist, 'LAE-000102');
        expect(memoryGet).toEqual(supabaseGet);
      },
    },
  ];

  for (const family of families) {
    it(`keeps memory and supabase parity for ${family.name}`, async () => {
      const store = createLegalReadFixtureStore();
      const memory = createMemoryLegalReadRepositories(store);
      const supabase = createTransportBackedSupabase(store);
      await family.run(memory, supabase);
    });
  }
});
