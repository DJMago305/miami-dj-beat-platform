// Mapeo bidireccional entre el store en memoria del motor T009 (camelCase) y las
// 13 tablas financial_ de Supabase (snake_case). Reusa el contrato del motor como
// verdad; aquí solo se traduce nombre de columna + 3 reconciliaciones motor↔DDL.

// Colección del store -> tabla, en ORDEN de FKs (para upsert/carga seguros).
export const COLL_TABLE: [string, string][] = [
  ["venues", "financial_venues"],
  ["venueAgreements", "financial_venue_agreements"],
  ["occurrences", "financial_occurrences"],
  ["performanceFinancialRecords", "financial_performance_records"],
  ["venueReceivables", "financial_venue_receivables"],
  ["payables", "financial_payables"],
  ["payments", "financial_payments"],
  ["paymentAllocations", "financial_payment_allocations"],
  ["ownerLedgerEntries", "financial_owner_ledger_entries"],
  ["reconciliations", "financial_reconciliations"],
  ["commandReceipts", "financial_command_receipts"],
];

// Columnas exactas por tabla (del DDL canónico). Solo estas se leen/escriben.
export const COLUMNS: Record<string, string[]> = {
  financial_venues: ["id","name","address","contact_name","contact_phone","contact_email","status","created_at","updated_at","created_by"],
  financial_venue_agreements: ["id","venue_id","title","frequency","scheduled_days","rate_by_day","currency","effective_from","effective_until","status","payment_method","notes","created_at","updated_at","created_by"],
  financial_occurrences: ["id","venue_id","agreement_id","assigned_profile_id","date","shift","status","created_at","updated_at","created_by"],
  financial_performance_records: ["id","occurrence_id","agreement_id","rate_amount_cents","currency","assigned_profile_id","expected_artist_payout_cents","rate_by_day_snapshot","created_at","updated_at","created_by"],
  financial_venue_receivables: ["id","occurrence_id","amount_cents","currency","status","due_date","created_at","updated_at","created_by"],
  financial_payables: ["id","source_type","source_id","payee_type","payee_id","purpose","amount_cents","currency","status","due_date","created_at","updated_at","created_by"],
  financial_payments: ["id","direction","amount_cents","currency","method","account","reference","payment_date","status","idempotency_key","reversal_of_payment_id","created_at","updated_at","created_by"],
  financial_payment_allocations: ["id","payment_id","target_type","target_id","amount_cents","direction","reversal_of_allocation_id","idempotency_key","created_at","created_by"],
  financial_owner_ledger_entries: ["id","posting_type","direction","amount_cents","currency","source_type","source_id","reversal_of_entry_id","created_at","created_by"],
  financial_reconciliations: ["id","payment_id","attempt_uuid","evidence_ref","status","reconciled_by","reconciled_at","notes","created_at"],
  financial_command_receipts: ["command_id","command_type","idempotency_key","payload_fingerprint","result_snapshot","created_at"],
};

// PK / clave de conflicto para upsert.
export const CONFLICT: Record<string, string> = {
  financial_venues: "id", financial_venue_agreements: "id", financial_occurrences: "id",
  financial_performance_records: "id", financial_venue_receivables: "id", financial_payables: "id",
  financial_payments: "id", financial_payment_allocations: "id", financial_owner_ledger_entries: "id",
  financial_reconciliations: "id", financial_command_receipts: "command_type,idempotency_key",
};

const snakeToCamel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

// Reconciliaciones motor↔DDL al PERSISTIR (NOT NULL / CHECK que el motor no llena igual):
function persistValue(table: string, col: string, e: any): any {
  if (table === "financial_payments") {
    if (col === "idempotency_key") return e.idempotencyKey ?? e.id;      // uuid NOT NULL UNIQUE
    if (col === "method") return String(e.method ?? "OTHER").toUpperCase(); // CHECK exige mayúscula
  }
  if (table === "financial_payment_allocations" && col === "idempotency_key") return e.idempotencyKey ?? e.id;
  if (table === "financial_venue_agreements" && col === "frequency") return e.frequency ?? "WEEKLY"; // NOT NULL
  const v = e[snakeToCamel(col)];
  return v === undefined ? null : v;
}

export function entityToRow(table: string, e: any): Record<string, any> {
  const row: Record<string, any> = {};
  for (const col of COLUMNS[table]) row[col] = persistValue(table, col, e);
  return row;
}

export function rowToEntity(table: string, row: any): any {
  const e: any = {};
  for (const col of COLUMNS[table]) e[snakeToCamel(col)] = row[col];
  return e;
}

export function emptyStore(): any {
  const s: any = {};
  for (const [coll] of COLL_TABLE) s[coll] = [];
  return s;
}

// Hidrata el store del motor desde las 13 tablas (una request = stateless).
export async function loadStore(sb: any): Promise<any> {
  const store = emptyStore();
  for (const [coll, table] of COLL_TABLE) {
    const { data, error } = await sb.from(table).select("*");
    if (error) throw new Error(`load ${table}: ${error.message}`);
    store[coll] = (data ?? []).map((r: any) => rowToEntity(table, r));
  }
  return store;
}

// Persiste el store (upsert idempotente por PK) en orden de FKs. El motor nunca
// borra (append-only / cambios de status), así que upsert cubre insert+update.
export async function persistStore(sb: any, store: any): Promise<void> {
  for (const [coll, table] of COLL_TABLE) {
    const rows = (store[coll] ?? []).map((e: any) => entityToRow(table, e));
    if (!rows.length) continue;
    const { error } = await sb.from(table).upsert(rows, { onConflict: CONFLICT[table] });
    if (error) throw new Error(`persist ${table}: ${error.message}`);
  }
}
