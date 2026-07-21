/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import type { LegalServicePorts } from '../../shared/services/legal/contracts';
import {
  LegalProviderFactoryError,
  createLegalProvider,
  resolveLegalProvider,
} from '../../shared/services/legal/provider';

describe('legal provider factory — TICKET-V2-LEGAL-PROVIDER-FACTORY-PORTAL-INJECTION-001', () => {
  it('1) resolves IN_MEMORY mode', () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    expect(provider.mode).toBe('IN_MEMORY');
  });

  it('2) rejects unknown provider mode explicitly', () => {
    expect(() => resolveLegalProvider({ mode: 'SUPABASE' })).toThrow(LegalProviderFactoryError);
    expect(() => resolveLegalProvider({ mode: 'PRODUCTION' })).toThrow(LegalProviderFactoryError);
  });

  it('3) returns valid LegalServicePorts', async () => {
    const provider = createLegalProvider({ mode: 'IN_MEMORY' });
    const ports: LegalServicePorts = provider.ports;
    const overview = await ports.staff.getOverview();
    expect(overview.pendingSignatures).toBeGreaterThanOrEqual(0);
  });

  it('does not expose in-memory store on provider context', () => {
    const provider = resolveLegalProvider({ mode: 'IN_MEMORY' });
    expect('store' in provider).toBe(false);
  });
});
