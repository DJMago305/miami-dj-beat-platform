/** @vitest-environment node */

/** LC-12 — Legal persistence SQL safety static validation */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { LEGAL_PERSISTENCE_MIGRATION_FILE } from '../../shared/services/legal/persistence/schema/legal-persistence-sql-schema-manifest';

function readMigrationSql(): string {
  const fromMigracion = resolve(process.cwd(), '..', LEGAL_PERSISTENCE_MIGRATION_FILE);
  const fromRepoRoot = resolve(process.cwd(), LEGAL_PERSISTENCE_MIGRATION_FILE);
  try {
    return readFileSync(fromMigracion, 'utf8');
  } catch {
    return readFileSync(fromRepoRoot, 'utf8');
  }
}

function countDollarQuoteDelimiters(sql: string): number {
  return (sql.match(/\$\$/g) ?? []).length;
}

function stripSqlLiteralsAndComments(sql: string): string {
  let stripped = '';
  let index = 0;
  while (index < sql.length) {
    const rest = sql.slice(index);
    if (rest.startsWith('--')) {
      const lineEnd = rest.indexOf('\n');
      index += lineEnd === -1 ? rest.length : lineEnd + 1;
      continue;
    }
    if (rest.startsWith('/*')) {
      const blockEnd = rest.indexOf('*/');
      index += blockEnd === -1 ? rest.length : blockEnd + 2;
      continue;
    }
    if (rest.startsWith("'")) {
      index += 1;
      while (index < sql.length) {
        if (sql[index] === "'" && sql[index + 1] === "'") {
          index += 2;
          continue;
        }
        if (sql[index] === "'") {
          index += 1;
          break;
        }
        index += 1;
      }
      continue;
    }
    stripped += sql[index];
    index += 1;
  }
  return stripped;
}

function finalParenthesisBalance(sql: string): number {
  const stripped = stripSqlLiteralsAndComments(sql);
  let balance = 0;
  for (const char of stripped) {
    if (char === '(') balance += 1;
    if (char === ')') balance -= 1;
  }
  return balance;
}

const PROHIBITED_PATTERNS = [
  /\bservice_role\b/i,
  /\bSUPABASE_SERVICE_ROLE\b/,
  /postgresql:\/\//i,
  /\bDROP TABLE\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE FROM\b/i,
  /\bbytea\b/i,
  /\bbase64\b/i,
  /\bENABLE ROW LEVEL SECURITY\b/i,
  /\bCREATE POLICY\b/i,
  /\bCREATE FUNCTION legal_read_/i,
] as const;

describe('LC-12 legal persistence SQL safety', () => {
  const sql = readMigrationSql();

  it('does not contain prohibited destructive or remote patterns', () => {
    for (const pattern of PROHIBITED_PATTERNS) {
      expect(sql.match(pattern), `prohibited pattern matched: ${pattern}`).toBeNull();
    }
  });

  it('does not store binary payloads', () => {
    expect(sql.toLowerCase()).not.toContain('bytea');
    expect(sql.toLowerCase()).not.toContain('encode(');
    expect(sql.toLowerCase()).not.toContain('decode(');
  });

  it('does not activate RLS or define RPC read functions', () => {
    expect(sql).not.toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(sql).not.toMatch(/CREATE\s+FUNCTION\s+legal_read_/i);
  });

  it('does not include real fiscal secrets or connection strings', () => {
    expect(sql).not.toMatch(/\b\d{2}-\d{7}\b/);
    expect(sql).not.toMatch(/@example\.(com|org)/i);
    expect(sql).not.toMatch(/Bearer\s+[A-Za-z0-9._-]+/);
  });

  it('uses timestamptz for legal timestamps', () => {
    expect(sql).toMatch(/created_at timestamptz/);
    expect(sql).toMatch(/occurred_at timestamptz/);
    expect(sql).not.toMatch(/created_at timestamp without time zone/i);
  });

  it('restricts audit outcomes and reason_code policy', () => {
    expect(sql).toMatch(/outcome IN \('success', 'denied', 'failed'\)/);
    expect(sql).toMatch(/legal_audit_events_reason_code_required/);
  });

  it('keeps audit related_entity_ids as jsonb array per LC-9/LC-12 contract', () => {
    expect(sql).toMatch(/related_entity_ids jsonb[\s\S]*jsonb_typeof\(related_entity_ids\) = 'array'/);
    expect(sql).not.toMatch(/jsonb_typeof\(related_entity_ids\) = 'object'/);
  });

  it('rejects nullable correlation_id in migration text', () => {
    expect(sql).toMatch(/correlation_id text NOT NULL/);
    expect(sql).not.toMatch(/correlation_id text NULL/i);
  });

  it('does not contain isolated SQL string literals after semicolons', () => {
    expect(sql).not.toMatch(/;\s*\n\s*'[^']+'\s*;/);
    expect(sql).not.toMatch(/;\s*'[^']+'\s*;/);
  });

  it('keeps COMMENT ON statements syntactically complete', () => {
    const commentStatements = sql.match(/COMMENT ON[\s\S]*?;/g) ?? [];
    expect(commentStatements.length).toBeGreaterThan(0);
    for (const statement of commentStatements) {
      expect(statement).toMatch(/^COMMENT ON (TABLE|COLUMN|INDEX|SEQUENCE|FUNCTION)/);
      expect(statement).toMatch(/\sIS\s[\s\S]*;$/);
    }
  });

  it('balances dollar-quote delimiters in trigger function', () => {
    expect(countDollarQuoteDelimiters(sql) % 2).toBe(0);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.prevent_legal_audit_mutation\(\)[\s\S]*END;\s*\$\$;/);
  });

  it('does not leave basic parenthesis balance unclosed', () => {
    expect(finalParenthesisBalance(sql)).toBe(0);
  });

  it('ends with valid trigger wiring (no trailing orphan statement)', () => {
    const trimmed = sql.trim();
    expect(trimmed.endsWith(';')).toBe(true);
    expect(trimmed).toMatch(/COMMENT ON FUNCTION public\.prevent_legal_audit_mutation\(\) IS[\s\S]*;$/);
  });
});

describe('LC-12 legal persistence SQL safety — negative test fixtures', () => {
  it('allows prohibited tokens only in test fixtures, not migration', () => {
    const migration = readMigrationSql();
    expect(migration.includes('DROP TABLE')).toBe(false);
    expect('DROP TABLE'.length).toBeGreaterThan(0);
  });

  it('detects isolated string literal pattern in synthetic bad SQL', () => {
    const badSql = "COMMENT ON TABLE foo IS 'ok';\n  'orphan literal';\n";
    expect(badSql).toMatch(/;\s*\n\s*'[^']+'\s*;/);
  });
});
