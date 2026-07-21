/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import {
  LegalContractError,
  assertAuditPayloadSafe,
  isPublicLegalLibraryDocument,
} from '../../shared/services/legal/contracts';
import type { DocumentsLibraryRow } from '../../shared/services/legal/contracts';

describe('legal data contracts — TICKET-V2-LEGAL-DATA-CONTRACTS-SPEC-001', () => {
  it('isPublicLegalLibraryDocument excludes SPC-001 W-9 from main library', () => {
    const w9Row: DocumentsLibraryRow = {
      documentId: 'DOC-2026-000001',
      officialName: 'W-9 Package',
      templateCode: 'SPC-001',
      category: 'SPC',
      versionLabel: '1.0',
      lifecycleStatus: 'COMPLETED',
    };
    const ctrRow: DocumentsLibraryRow = {
      ...w9Row,
      documentId: 'DOC-2026-000002',
      templateCode: 'CTR-001',
      category: 'CTR',
      officialName: 'DJ Partner Agreement',
    };
    expect(isPublicLegalLibraryDocument(w9Row)).toBe(false);
    expect(isPublicLegalLibraryDocument(ctrRow)).toBe(true);
  });

  it('assertAuditPayloadSafe rejects forbidden keys', () => {
    expect(() => assertAuditPayloadSafe({ event: 'ok' })).not.toThrow();
    expect(() => assertAuditPayloadSafe(undefined)).not.toThrow();
    expect(() => assertAuditPayloadSafe({ tinFull: 'secret' })).toThrow(LegalContractError);
    expect(() => assertAuditPayloadSafe({ signatureRaw: 'bytes' })).toThrow(LegalContractError);
  });
});
