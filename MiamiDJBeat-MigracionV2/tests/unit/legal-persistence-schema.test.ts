/** @vitest-environment node */

/** LC-11 — Legal persistence schema and validation tests */

import { describe, expect, it } from 'vitest';

import {
  LC11_FIXTURE_AUDIT_ROWS,
  LC11_FIXTURE_INSTANCE_ROW,
  LC11_FIXTURE_SUBMISSION_ACTIVE_ROW,
  LC11_FIXTURE_TEMPLATE_ROW,
} from '../../shared/services/legal/persistence/fixtures/legal-read-fixture-store';
import {
  mapLegalAuditEventRowToDomain,
  mapLegalDocumentInstanceRowToDomain,
  mapLegalDocumentSubmissionRowToDomain,
  mapLegalTemplateRowToDomain,
} from '../../shared/services/legal/persistence/mappers/legal-persistence-mappers';
import {
  decodeReadCursor,
  encodeReadCursor,
  normalizeReadLimit,
  paginateRows,
} from '../../shared/services/legal/persistence/legal-persistence-page';
import {
  isValidPersistenceTimestamp,
  isValidPersistenceUuid,
  validateLegalAuditEventRow,
  validateLegalDocumentInstanceRow,
  validateLegalDocumentSubmissionRow,
  validateLegalPersistenceReadEnvelope,
  validateLegalTemplateRow,
} from '../../shared/services/legal/persistence/validation/legal-persistence-row-validation';

describe('LC-11 persistence schema validation', () => {
  it('validates UUID, timestamps, and row_version', () => {
    expect(isValidPersistenceUuid(LC11_FIXTURE_TEMPLATE_ROW.id)).toBe(true);
    expect(isValidPersistenceTimestamp(LC11_FIXTURE_TEMPLATE_ROW.created_at)).toBe(true);
    expect(validateLegalTemplateRow(LC11_FIXTURE_TEMPLATE_ROW).ok).toBe(true);
  });

  it('rejects invalid business IDs and statuses', () => {
    const invalid = validateLegalDocumentInstanceRow({
      ...LC11_FIXTURE_INSTANCE_ROW,
      business_id: 'INVALID',
      status: 'unknown',
    });
    expect(invalid.ok).toBe(false);
  });

  it('maps rows to domain with business IDs and hidden UUID internals', () => {
    const mapped = mapLegalDocumentInstanceRowToDomain(LC11_FIXTURE_INSTANCE_ROW);
    expect(mapped.ok).toBe(true);
    if (mapped.ok) {
      expect(mapped.value.id).toBe('LDI-000101');
      expect(mapped.value.id).not.toContain(LC11_FIXTURE_INSTANCE_ROW.id);
    }
  });

  it('validates transport envelope shape', () => {
    const envelope = validateLegalPersistenceReadEnvelope<{ id: string }>({
      data: [{ id: 'x' }],
      next_cursor: null,
      has_more: false,
    });
    expect(envelope.ok).toBe(true);
  });

  it('paginates with opaque cursor', () => {
    const rows = Object.freeze([1, 2, 3, 4, 5]);
    const page1 = paginateRows(rows, 2, 0);
    expect(page1.items).toEqual([1, 2]);
    expect(page1.hasMore).toBe(true);
    const cursor = page1.nextCursor;
    expect(cursor).toBeTruthy();
    const decoded = decodeReadCursor(cursor ?? undefined);
    expect(decoded.ok && decoded.value).toBe(2);
    const page2 = paginateRows(rows, 2, decoded.ok ? decoded.value : 0);
    expect(page2.items).toEqual([3, 4]);
  });

  it('rejects invalid query limits and cursors', () => {
    expect(normalizeReadLimit(0).ok).toBe(false);
    expect(decodeReadCursor('not-a-cursor').ok).toBe(false);
  });

  it('validates submission and audit rows', () => {
    expect(validateLegalDocumentSubmissionRow(LC11_FIXTURE_SUBMISSION_ACTIVE_ROW).ok).toBe(true);
    expect(validateLegalAuditEventRow(LC11_FIXTURE_AUDIT_ROWS[0]).ok).toBe(true);
    const auditMapped = mapLegalAuditEventRowToDomain(LC11_FIXTURE_AUDIT_ROWS[0]);
    expect(auditMapped.ok && auditMapped.value.sequence).toBe(1);
  });

  it('maps template row to contract domain', () => {
    const mapped = mapLegalTemplateRowToDomain(LC11_FIXTURE_TEMPLATE_ROW);
    expect(mapped.ok && mapped.value.templateId).toBe('SPC-001');
  });

  it('encodes deterministic cursor payloads', () => {
    const cursor = encodeReadCursor(10);
    const decoded = decodeReadCursor(cursor);
    expect(decoded.ok && decoded.value).toBe(10);
  });

  it('maps submission row without exposing storage UUID', () => {
    const mapped = mapLegalDocumentSubmissionRowToDomain(LC11_FIXTURE_SUBMISSION_ACTIVE_ROW);
    expect(mapped.ok && mapped.value.id).toBe('LDS-000101');
    expect(mapped.ok && mapped.value.storageKey).toContain('legal/submissions');
    if (mapped.ok) {
      expect(mapped.value.createdAt).toBe('2026-07-21T11:55:00.000Z');
      expect(mapped.value.submittedAt).toBe('2026-07-21T12:00:00.000Z');
    }
  });
});
