/** @vitest-environment node */

/** LC-12 — Legal persistence SQL schema static validation */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  LEGAL_PERSISTENCE_ACTIVE_W9_STATUSES,
  LEGAL_PERSISTENCE_MIGRATION_FILE,
  LEGAL_PERSISTENCE_ROW_SQL_COLUMN_MAP,
  LEGAL_PERSISTENCE_SUBMISSION_MAX_BYTES,
  LEGAL_PERSISTENCE_TABLES,
  LEGAL_PERSISTENCE_TERMINAL_W9_STATUSES,
} from '../../shared/services/legal/persistence/schema/legal-persistence-sql-schema-manifest';

const MIGRATION_RELATIVE = LEGAL_PERSISTENCE_MIGRATION_FILE;

function readMigrationSql(): string {
  const fromMigracion = resolve(process.cwd(), '..', MIGRATION_RELATIVE);
  const fromRepoRoot = resolve(process.cwd(), MIGRATION_RELATIVE);
  try {
    return readFileSync(fromMigracion, 'utf8');
  } catch {
    return readFileSync(fromRepoRoot, 'utf8');
  }
}

function expectSqlContains(sql: string, fragment: string): void {
  expect(sql.includes(fragment), `expected migration to contain: ${fragment}`).toBe(true);
}

describe('LC-12 legal persistence SQL schema', () => {
  const sql = readMigrationSql();

  it('defines all seven required tables', () => {
    for (const table of LEGAL_PERSISTENCE_TABLES) {
      expectSqlContains(sql, `CREATE TABLE IF NOT EXISTS public.${table}`);
    }
  });

  it('uses UUID primary keys with gen_random_uuid defaults', () => {
    for (const table of LEGAL_PERSISTENCE_TABLES) {
      expectSqlContains(sql, `CREATE TABLE IF NOT EXISTS public.${table}`);
      expect(sql).toMatch(new RegExp(`public\\.${table}[\\s\\S]*?id uuid PRIMARY KEY DEFAULT gen_random_uuid\\(\\)`));
    }
  });

  it('defines business_id unique constraints for aggregates', () => {
    expectSqlContains(sql, 'legal_templates_business_id_unique');
    expectSqlContains(sql, 'legal_template_versions_business_id_unique');
    expectSqlContains(sql, 'legal_document_instances_business_id_unique');
    expectSqlContains(sql, 'legal_w9_requests_business_id_unique');
    expectSqlContains(sql, 'legal_document_submissions_business_id_unique');
    expectSqlContains(sql, 'legal_audit_events_business_id_unique');
    expectSqlContains(sql, 'legal_template_assets_asset_key_unique');
  });

  it('defines row_version on mutable aggregates but not audit', () => {
    for (const table of [
      'legal_templates',
      'legal_template_versions',
      'legal_template_assets',
      'legal_document_instances',
      'legal_w9_requests',
      'legal_document_submissions',
    ]) {
      expect(sql).toMatch(new RegExp(`public\\.${table}[\\s\\S]*row_version bigint`));
    }
    expect(sql).not.toMatch(/public\.legal_audit_events[\s\S]*row_version/);
  });

  it('defines audit sequence and append-only mutation guard', () => {
    expectSqlContains(sql, 'CREATE SEQUENCE IF NOT EXISTS public.legal_audit_event_sequence');
    expectSqlContains(sql, 'DEFAULT nextval(\'public.legal_audit_event_sequence\')');
    expectSqlContains(sql, 'prevent_legal_audit_mutation');
    expectSqlContains(sql, 'BEFORE UPDATE ON public.legal_audit_events');
    expectSqlContains(sql, 'BEFORE DELETE ON public.legal_audit_events');
  });

  it('defines W-9 partial unique index using LC-7 active statuses and template_row_id', () => {
    expectSqlContains(sql, 'legal_w9_requests_one_active_per_recipient_template');
    expectSqlContains(sql, 'recipient_type, recipient_id, template_row_id');
    const partialIndex = sql.match(
      /legal_w9_requests_one_active_per_recipient_template[\s\S]*?WHERE status IN \(([^)]+)\)/,
    );
    expect(partialIndex).toBeTruthy();
    if (partialIndex) {
      for (const status of LEGAL_PERSISTENCE_ACTIVE_W9_STATUSES) {
        expect(partialIndex[1]).toContain(`'${status}'`);
      }
      for (const status of LEGAL_PERSISTENCE_TERMINAL_W9_STATUSES) {
        expect(partialIndex[1]).not.toContain(`'${status}'`);
      }
    }
  });

  it('stores audit related_entity_ids as jsonb array with default empty array', () => {
    expectSqlContains(sql, "related_entity_ids jsonb NOT NULL DEFAULT '[]'::jsonb");
    expectSqlContains(sql, "jsonb_typeof(related_entity_ids) = 'array'");
    expect(sql).not.toMatch(/jsonb_typeof\(related_entity_ids\) = 'object'/);
  });

  it('requires audit correlation_id NOT NULL with LAC format constraints', () => {
    expectSqlContains(sql, 'correlation_id text NOT NULL');
    expect(sql).not.toMatch(/correlation_id text NULL/i);
    expectSqlContains(sql, 'legal_audit_events_correlation_id_present');
    expectSqlContains(sql, "correlation_id ~ '^LAC-[0-9]{6,}$'");
  });

  it('defines exactly one COMMENT ON TABLE for legal_template_assets', () => {
    const tableComments = sql.match(/COMMENT ON TABLE public\.legal_template_assets/g) ?? [];
    expect(tableComments).toHaveLength(1);
    expectSqlContains(sql, 'COMMENT ON COLUMN public.legal_template_assets.object_key IS');
  });

  it('enforces submission PDF mime and 20MB max size', () => {
    expectSqlContains(sql, "mime_type = 'application/pdf'");
    expectSqlContains(sql, 'size_bytes <= 20971520');
    expect(20971520).toBe(LEGAL_PERSISTENCE_SUBMISSION_MAX_BYTES);
  });

  it('enforces submission timestamp ordering and soft delete coherence', () => {
    expectSqlContains(sql, 'created_at <= submitted_at AND submitted_at <= updated_at');
    expectSqlContains(sql, "status = 'deleted' AND deleted_at IS NOT NULL");
  });

  it('uses ON DELETE RESTRICT for legal document foreign keys', () => {
    const restrictCount = (sql.match(/ON DELETE RESTRICT/g) ?? []).length;
    expect(restrictCount).toBeGreaterThanOrEqual(8);
  });

  it('maps LC-11 row contract properties to SQL columns via manifest', () => {
    for (const table of LEGAL_PERSISTENCE_TABLES) {
      const map = LEGAL_PERSISTENCE_ROW_SQL_COLUMN_MAP[table];
      for (const column of new Set(Object.values(map))) {
        expect(
          new RegExp(`\\b${column}\\b`).test(sql),
          `${table} column ${column} missing from migration`,
        ).toBe(true);
      }
    }
  });

  it('documents recipient denormalization on submissions', () => {
    expectSqlContains(sql, 'Controlled denormalization');
    expectSqlContains(sql, 'recipient_type text NOT NULL');
    expectSqlContains(sql, 'recipient_id text NOT NULL');
  });
});
