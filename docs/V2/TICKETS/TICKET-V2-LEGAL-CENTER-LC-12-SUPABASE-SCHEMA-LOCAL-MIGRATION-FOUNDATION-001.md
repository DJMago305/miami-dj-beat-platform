# TICKET-V2-LEGAL-CENTER-LC-12-SUPABASE-SCHEMA-LOCAL-MIGRATION-FOUNDATION-001

## Estado

**LC-12 CERRADO — APROBADO TÉCNICAMENTE POR EL PRODUCT OWNER**

Migration local versionada · **NO aplicada** · sin push · sin merge · sin PR · sin deploy · sin Supabase remoto · **LC-13 no iniciado**.

| Campo | Valor |
|-------|-------|
| Ticket | LC-12 — Supabase Persistence Schema & Local Migration Foundation |
| Hardening | LC-12 Schema Contract Hardening (`TICKET-V2-LEGAL-CENTER-LC-12-SCHEMA-HARDENING-001`) |
| Rama | `plan/v2-phase-4-api-client` |
| HEAD baseline | `ad9bb8f3c5cfd85b06a25d83cc49b37edd5a6187` |
| Commit baseline | `ad9bb8f feat(v2-legal): add read-only persistence adapters` |
| Tests baseline (pre-LC-12) | 999 PASS |
| Tests post-LC-12 foundation | 1018 PASS |
| Tests post-hardening | **1029 PASS** (+29 LC-12, +1 LC-11 audit parity) |
| typecheck | exit 0 |
| HTTP QA | 5/5 HTTP 200 |
| Fecha implementación | 2026-07-21 |
| Fecha hardening | 2026-07-21 |

---

## 1. Objetivo

Fundación local y versionada del schema PostgreSQL/Supabase para Legal Center V2, traduciendo los row contracts LC-11 a SQL con constraints, FKs, índices, soft delete, optimistic concurrency y audit append-only.

**No** aplica migrations remotas · **no** conecta Supabase · **no** crea RPC/write adapters · **no** activa RLS.

---

## 2. Baseline de arranque

| Check | Resultado |
|-------|-----------|
| Rama | `plan/v2-phase-4-api-client` ✓ |
| HEAD | `ad9bb8f` ✓ |
| Working tree inicial | limpio ✓ |
| Suite | 999 PASS ✓ |
| HTTP × 5 | 200 OK ✓ |

---

## 3. Restricciones de seguridad

| Prohibido | Estado |
|-----------|--------|
| `supabase db push` / `migration up` / `link` | NO ejecutado |
| Conexión remota / credenciales | NO usado |
| RLS activa | NO creada |
| RPC `legal_read_*` | NO creados |
| Write adapters TS | NO creados |
| UI / assets | Sin cambios |
| Datos fiscales reales | NO incluidos |

---

## 4. Ruta de migration

Convención canónica del repo: **`supabase/migrations/`** (raíz del monorepo).

Evidencia:

| Señal | Resultado |
|-------|-----------|
| `find . -type d -path "*/supabase/migrations"` | **una sola** ruta: `./supabase/migrations` |
| `supabase/config.toml` | `./supabase/config.toml` (raíz) |
| Migraciones existentes | 109+ archivos `.sql` en `./supabase/migrations/` |
| Carpeta duplicada en `MiamiDJBeat-MigracionV2/` | **no existe** |

Archivo LC-12:

```
supabase/migrations/20260721044500_legal_center_persistence_foundation.sql
```

**Estado:** validado **textualmente** · **NO parseado por PostgreSQL** · **NO aplicado**.

Herramientas disponibles (sin ejecutar DB):

| Herramienta | Disponible |
|-------------|------------|
| `psql` | no en PATH |
| `postgres` | no en PATH |
| `pg_isready` | no en PATH |
| `supabase` CLI | sí (`/opt/homebrew/bin/supabase`) |
| `docker` | no verificado / no iniciado |

No se instaló parser SQL adicional · no se modificó `package.json`.

---

## 5. Siete tablas

| # | Tabla | Aggregate |
|---|-------|-----------|
| 1 | `legal_templates` | Template catalog |
| 2 | `legal_template_versions` | Version history |
| 3 | `legal_template_assets` | Asset metadata (no binary) |
| 4 | `legal_document_instances` | LC-6 instances |
| 5 | `legal_w9_requests` | LC-7 W-9 workflow |
| 6 | `legal_document_submissions` | LC-8 submissions |
| 7 | `legal_audit_events` | LC-9 audit append-only |

Secuencia técnica: `legal_audit_event_sequence`.

---

## 6. Dual-ID

| Capa | Columna SQL | Dominio |
|------|-------------|---------|
| PK interno | `id uuid DEFAULT gen_random_uuid()` | oculto |
| Business ID | `business_id text UNIQUE` | SPC-/TV-/LDI-/W9R-/LDS-/LAE-* |
| FK interno | `*_row_id uuid` | relaciones RESTRICT |

Prefijos validados por CHECK donde aplica.

---

## 7. Paridad LC-11 ↔ SQL

Manifest de prueba:

`MiamiDJBeat-MigracionV2/shared/services/legal/persistence/schema/legal-persistence-sql-schema-manifest.ts`

Documenta mapeo row property → SQL column (p.ej. `template_id` row UUID → `template_row_id` SQL FK).

### Matriz final dominio ↔ row ↔ SQL (post-hardening)

Prioridad aplicada: dominio LC-6–LC-9 → LC-10 → LC-11 row → LC-12 SQL.

| Tema | Dominio (LC-9) | Row LC-11 (enmienda mínima) | SQL LC-12 | Decisión final |
|------|----------------|----------------------------|-----------|----------------|
| Audit `related_entity_ids` | `Record<string,string>` en evento | `readonly string[]` persistido | `jsonb NOT NULL DEFAULT '[]'::jsonb` + `CHECK jsonb_typeof = 'array'` | **Array en SQL/row**; mapper `mapRelatedEntityIdsArrayToDomain()` reconstruye mapa de dominio |
| Audit `correlation_id` | obligatorio en flujos LC-9 | `string` requerido + `isValidLegalAuditCorrelationId` | `text NOT NULL` + present + `^LAC-[0-9]{6,}$` | **NOT NULL** en las tres capas |
| W-9 partial unique | un activo por recipient+template | N/A (índice SQL) | `(recipient_type, recipient_id, template_row_id)` WHERE active incluye **`submitted`** | Active = requested, available, viewed, awaiting_upload, **submitted**; terminal excluidos |
| Template assets storage | metadata privada | `object_key` | `object_key text NOT NULL` + COMMENT único | Sin cambio sustantivo |
| Audit `related_entity_ids` object (§7 previo) | — | contradecía dominio | corregido | **No** mantener object en SQL |

Bridge audit read-scope: `resolveAuditRecipientIdFromRelatedEntityIds()` en memory/supabase read repos.

---

## 8. Foreign keys

Todas las relaciones operativas usan UUID `*_row_id` con:

```
ON UPDATE RESTRICT
ON DELETE RESTRICT
```

Audit `entity_id` / `related_entity_ids` conservan business IDs **sin FK rígida** para preservar historial.

---

## 9. Constraints destacados

- Status CHECK alineados LC-6/7/8/9
- `row_version >= 1` en aggregates mutables
- Submission: MIME PDF, `size_bytes <= 20971520`, timestamp order, soft-delete coherence
- Audit: outcome ∈ success/denied/failed; reason_code obligatorio en denied/failed
- Self-replace submissions: no auto-referencia

---

## 10. Índices

Índices de soporte para queries LC-11: recipient, status, template business IDs, submitted_at, occurred_at, correlation_id, replacement chain.

Partial unique:

```sql
legal_w9_requests_one_active_per_recipient_template
ON (recipient_type, recipient_id, template_row_id)
WHERE status IN ('requested','available','viewed','awaiting_upload','submitted')
```

Terminal excluidos: `accepted`, `rejected`, `expired`, `cancelled`.

---

## 11. Optimistic concurrency

`row_version bigint NOT NULL DEFAULT 1` en templates, versions, assets, instances, w9_requests, submissions.

Patrón futuro documentado:

```sql
UPDATE ... SET row_version = row_version + 1
WHERE id = $1 AND row_version = $expected;
```

No implementado en LC-12.

---

## 12. Soft delete

Solo `legal_document_submissions`:

- `deleted_at`, `deleted_by_actor_id`, `delete_reason_code`
- CHECK coherencia `status='deleted'` ↔ `deleted_at IS NOT NULL`
- Sin hard delete workflow

---

## 13. Audit append-only

- Sin `row_version`, `updated_at`, `deleted_at`
- Secuencia dedicada `legal_audit_event_sequence`
- Función `prevent_legal_audit_mutation()` + triggers BEFORE UPDATE/DELETE

---

## 14. Storage metadata-only

Submissions y template assets almacenan `storage_key` / `object_key` como referencias privadas. Sin `bytea`, PDF, base64.

---

## 15. JSONB policy

JSONB solo para metadata, signature/field schemas, audit snapshots, `allowed_portals` (array), `related_entity_ids` (**array** de business IDs).

CHECK `jsonb_typeof(...) = 'object'|'array'` donde aplica.

---

## 16. Timestamps

Todos los eventos legales usan `timestamptz`. Defaults `now()` en created/updated donde aplica.

---

## 17. Orden de migration

1. sequence audit
2. templates
3. template versions
4. template assets
5. document instances
6. w9 requests
7. submissions
8. deferred FK w9 → submission
9. audit events
10. partial unique W-9
11. indexes
12. append-only triggers
13. comments

Sin DROP TABLE · sin TRUNCATE · sin DELETE FROM · sin seeds.

---

## 18. Rollback conceptual

Orden inverso de dependencias. DROP requiere autorización PO. Producción preferirá forward-fix. **No** se incluye script destructivo ejecutable.

---

## 19. Validación SQL (tests)

| Archivo | Tests |
|---------|-------|
| `tests/unit/legal-persistence-sql-schema.test.ts` | 14 |
| `tests/unit/legal-persistence-sql-safety.test.ts` | 15 |
| **Total LC-12** | **29** |

Cubre: tablas, UUID PK, business IDs, FK RESTRICT, row_version, audit sequence, append-only trigger, W-9 partial unique (**submitted incluido**, `template_row_id`), PDF/20MB, timestamps, parity manifest, `related_entity_ids` array + default `[]`, `correlation_id NOT NULL` + LAC format, COMMENT único en `legal_template_assets`, prohibidos (RLS/RPC/secrets/bytea/DROP), literales SQL aislados, `$$` balanceados, paréntesis (textual, sin parser PG).

**Nivel real:** validación **textual estática** · PostgreSQL **no ejecutado** · no equivalente a parse real.

---

## 20. QA final

| Check | Resultado |
|-------|-----------|
| LC-12 tests | 29 PASS |
| LC-11 audit parity test | 1 PASS (array + correlation) |
| Suite completa | **1029 PASS** |
| typecheck | exit 0 |
| git diff --check | limpio |
| HTTP × 5 | 200 OK |
| LC-5→LC-11 regresión | ninguna |
| UI / assets | cero cambios |

HTTP URLs verificadas (`localhost:5173`):

| URL | HTTP |
|-----|------|
| `/staff/` | 200 |
| `/staff/?previewRole=seller` | 200 |
| `/artist/` | 200 |
| `/client/` | 200 |
| W-9 PDF `.../fw9-corporate.pdf` | 200 |

---

## 21. Archivos creados / modificados

**Creados (LC-12 foundation):**

```
supabase/migrations/20260721044500_legal_center_persistence_foundation.sql
MiamiDJBeat-MigracionV2/shared/services/legal/persistence/schema/legal-persistence-sql-schema-manifest.ts
MiamiDJBeat-MigracionV2/tests/unit/legal-persistence-sql-schema.test.ts
MiamiDJBeat-MigracionV2/tests/unit/legal-persistence-sql-safety.test.ts
docs/V2/TICKETS/TICKET-V2-LEGAL-CENTER-LC-12-SUPABASE-SCHEMA-LOCAL-MIGRATION-FOUNDATION-001.md
```

**Modificados (hardening LC-11 parity mínima + LC-12 SQL):**

```
MiamiDJBeat-MigracionV2/shared/services/legal/persistence/shared/legal-audit-related-entity-ids.ts (nuevo helper)
MiamiDJBeat-MigracionV2/shared/services/legal/persistence/schema/legal-persistence-row-types.ts
MiamiDJBeat-MigracionV2/shared/services/legal/persistence/validation/legal-persistence-row-validation.ts
MiamiDJBeat-MigracionV2/shared/services/legal/persistence/mappers/legal-persistence-mappers.ts
MiamiDJBeat-MigracionV2/shared/services/legal/persistence/fixtures/legal-read-fixture-store.ts
MiamiDJBeat-MigracionV2/shared/services/legal/persistence/memory/memory-legal-read-repositories.ts
MiamiDJBeat-MigracionV2/shared/services/legal/persistence/supabase/supabase-legal-read-repositories.ts
MiamiDJBeat-MigracionV2/tests/unit/legal-persistence-schema.test.ts
supabase/migrations/20260721044500_legal_center_persistence_foundation.sql
```

**Sin cambios:** UI · assets · auth · `web/` prod.

---

## 22. Riesgos remanentes

1. SQL aún **no ejecutado** contra PostgreSQL real (solo validación textual).
2. Constraints pueden requerir ajuste tras primera migration local controlada.
3. RLS todavía no existe (LC-13+).
4. Read RPCs todavía no existen.
5. Write RPCs todavía no existen.
6. Business-ID generation server-side pendiente.
7. Storage bucket privado pendiente de provisioning.
8. `recipient_type/recipient_id` es denormalización controlada en submissions.
9. Audit grants insert-only pendientes de fase RLS.
10. Cursor compuesto DB pendiente (LC-11 lab usa offset).
11. `related_entity_ids` array no valida tipo de cada elemento en SQL (solo `jsonb_typeof = 'array'`); validación string en TypeScript row layer.
12. Dominio LC-9 sigue exponiendo `relatedEntityIds` como mapa; persistencia usa array ordenado — contrato documentado en mapper.

---

## 23. Exclusiones confirmadas

- Migration **no aplicada**
- Supabase **no conectado**
- Tablas **no creadas** en remoto
- RLS **no activa**
- RPC **no creados**
- Producción **no afectada**
- Write support **no implementado**
- LC-13 **no iniciado**

---

## 24. Fase recomendada siguiente (LC-13)

1. RLS matrix + policies.
2. Read RPC functions (`legal_read_*`).
3. Business ID generation transaccional server-side.
4. Primera aplicación controlada en entorno local Supabase (con autorización PO).
5. Parity tests runtime contra Postgres local.

---

## 26. LC-12 Schema Hardening (TICKET-V2-LEGAL-CENTER-LC-12-SCHEMA-HARDENING-001)

| Corrección | Resultado |
|------------|-----------|
| `related_entity_ids` | `jsonb NOT NULL DEFAULT '[]'::jsonb` + `CHECK (jsonb_typeof = 'array')` |
| `correlation_id` | `text NOT NULL` + non-empty + `^LAC-[0-9]{6,}$` |
| W-9 active index | `(recipient_type, recipient_id, template_row_id)` · incluye `submitted` · excluye terminal |
| COMMENT SQL | Una sola `COMMENT ON TABLE legal_template_assets`; `object_key` column comment completo |
| LC-11 enmienda mínima | row array + mapper helpers + read repos + fixtures + 1 test LC-11 |

**Estado hardening:** LC-12 CERRADO — APROBADO TÉCNICAMENTE POR EL PRODUCT OWNER · commit local autorizado · migration no aplicada.

---

## 27. Aprobación técnica PO (TICKET-V2-LEGAL-CENTER-LC-12-CLOSEOUT-AND-COMMIT-001)

**Estado final:** LC-12 CERRADO — APROBADO TÉCNICAMENTE POR EL PRODUCT OWNER

| Ítem aprobado | Confirmación |
|---------------|--------------|
| `related_entity_ids` persistido como jsonb array | `jsonb NOT NULL DEFAULT '[]'::jsonb` + `CHECK jsonb_typeof = 'array'` |
| Bridge explícito hacia dominio LC-9 | `mapRelatedEntityIdsArrayToDomain()` + `resolveAuditRecipientIdFromRelatedEntityIds()` |
| `correlation_id NOT NULL` | `text NOT NULL` + present + `^LAC-[0-9]{6,}$` |
| W-9 active unique index incluyendo `submitted` | `(recipient_type, recipient_id, template_row_id)` · active incluye submitted |
| Comentarios SQL corregidos | Una `COMMENT ON TABLE legal_template_assets`; `object_key` column comment completo |
| Ruta canónica `supabase/migrations/` | `./supabase/migrations/20260721044500_legal_center_persistence_foundation.sql` |
| SQL validado estáticamente | 29 tests LC-12 · **no** parseado/ejecutado en PostgreSQL real |
| Migration no aplicada | Confirmado — local versionada únicamente |
| LC-11 parity actualizado | Enmienda mínima audit (array + correlation + mapper + repos + fixtures) |
| Tests LC-12 | 29 PASS (14 schema + 15 safety) |
| Tests LC-11 schema | 11 PASS |
| Suite completa | 1029 PASS |
| Typecheck | exit 0 |
| HTTP 200 × 5 | staff · seller preview · artist · client · W-9 PDF |
| Cero UI | Confirmado |
| Cero assets nuevos | Confirmado |
| Cero RLS | Confirmado |
| Cero RPC | Confirmado |
| Cero Supabase remoto | Confirmado |
| Cero deploy | Confirmado |
| LC-13 | No iniciado |

Commit local autorizado: `feat(v2-legal): add local persistence schema foundation` · **sin push** · **sin merge** · **sin PR** · **sin deploy**.

---

## 25. Confirmación operativa

| Acción | Estado |
|--------|--------|
| Commit local | **SÍ** (closeout autorizado PO) |
| Push | **NO** |
| Merge | **NO** |
| PR | **NO** |
| Deploy | **NO** |
| Migration apply | **NO** |
| LC-13 | **NO iniciado** |
