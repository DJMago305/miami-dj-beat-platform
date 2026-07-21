/** @vitest-environment node */

/** LC-11 — Legal read repository parity tests */

import { describe, expect, it } from 'vitest';

import {
  createArtistReadContext,
  createLegalReadFixtureStore,
  createMemoryLegalReadRepositories,
  createStaffOwnerReadContext,
  createSupabaseSimulatedLegalReadRepositories,
} from '../../shared/services/legal/persistence';
import { createFixtureLegalPersistenceReadTransport } from '../../shared/services/legal/persistence/transport/legal-persistence-read-transport';

describe('LC-11 legal read repository parity', () => {
  it('returns equivalent domain reads for memory and Supabase simulated adapters', async () => {
    const store = createLegalReadFixtureStore();
    const memory = createMemoryLegalReadRepositories(store);
    const supabase = createSupabaseSimulatedLegalReadRepositories(createFixtureLegalPersistenceReadTransport(store));
    const owner = createStaffOwnerReadContext();
    const artist = createArtistReadContext('ART-DEMO-001');

    const memoryInstance = await memory.instances.getInstanceById(owner, 'LDI-000101');
    const supabaseInstance = await supabase.instances.getInstanceById(owner, 'LDI-000101');
    expect(memoryInstance.ok && supabaseInstance.ok).toBe(true);
    if (memoryInstance.ok && supabaseInstance.ok) {
      expect(memoryInstance.value).toEqual(supabaseInstance.value);
    }

    const memoryW9 = await memory.w9Requests.getW9RequestById(owner, 'W9R-000101');
    const supabaseW9 = await supabase.w9Requests.getW9RequestById(owner, 'W9R-000101');
    expect(memoryW9.ok && supabaseW9.ok).toBe(true);
    if (memoryW9.ok && supabaseW9.ok) {
      expect(memoryW9.value).toEqual(supabaseW9.value);
    }

    const memoryAudit = await memory.audit.listAuditEvents(artist, { limit: 10 });
    const supabaseAudit = await supabase.audit.listAuditEvents(artist, { limit: 10 });
    expect(memoryAudit.ok && supabaseAudit.ok).toBe(true);
    if (memoryAudit.ok && supabaseAudit.ok) {
      expect(memoryAudit.value.items).toEqual(supabaseAudit.value.items);
      expect(memoryAudit.value.hasMore).toBe(supabaseAudit.value.hasMore);
    }

    const memoryDeleted = await memory.submissions.listSubmissionsIncludingDeleted(owner, { limit: 10 });
    const supabaseDeleted = await supabase.submissions.listSubmissionsIncludingDeleted(owner, { limit: 10 });
    expect(memoryDeleted.ok && supabaseDeleted.ok).toBe(true);
    if (memoryDeleted.ok && supabaseDeleted.ok) {
      expect(memoryDeleted.value.items.map((row) => row.id)).toEqual(
        supabaseDeleted.value.items.map((row) => row.id),
      );
    }
  });

  it('returns matching pagination cursors for list endpoints', async () => {
    const store = createLegalReadFixtureStore({
      auditEvents: createLegalReadFixtureStore().auditEvents,
    });
    const memory = createMemoryLegalReadRepositories(store);
    const supabase = createSupabaseSimulatedLegalReadRepositories(createFixtureLegalPersistenceReadTransport(store));
    const owner = createStaffOwnerReadContext();

    const memoryPage = await memory.audit.listAuditEvents(owner, { limit: 1 });
    const supabasePage = await supabase.audit.listAuditEvents(owner, { limit: 1 });
    expect(memoryPage.ok && supabasePage.ok).toBe(true);
    if (memoryPage.ok && supabasePage.ok) {
      expect(memoryPage.value.items).toEqual(supabasePage.value.items);
      expect(memoryPage.value.hasMore).toBe(supabasePage.value.hasMore);
    }
  });
});
