# TICKET-V2-LEGAL-CENTER-LC-13A-ISOLATED-READ-SECURITY-VALIDATION-001

## Estado

**LC-13A READ SECURITY VALIDADA EN POSTGRES AISLADO — PENDIENTE DE REVISIÓN Y APROBACIÓN PO**

| Campo | Valor |
|-------|-------|
| Ticket | LC-13A — Read Security (RLS + 7 read RPCs) |
| Modo | Implementación + validación local aislada |
| Rama | `plan/v2-phase-4-api-client` |
| HEAD baseline | `41e0bedfc906b7f438d38d3f9a60c6b1d7a8ba34` |
| Fecha | 2026-07-22 |
| Commit | ❌ **NO autorizado en este ticket** |
| Push / merge / PR / deploy | ❌ **PROHIBIDOS** |
| Producción | ❌ **NOT_AUTHORIZED** |
| Supabase remoto / cadena 110 | ❌ **NO tocados** |
| Bootstrap legacy | ❌ **BLOCKED_BY_LEGACY_BOOTSTRAP_DEBT** (sin reparación) |

---

## 1. Objetivo cumplido

Implementar y validar **exclusivamente** la capa de lectura del Legal Center sobre PostgreSQL 16 aislado:

- RLS SELECT en las 7 tablas LC-12
- DELETE físico denegado (políticas explícitas + audit append-only)
- 7 RPC `SECURITY INVOKER` (paridad LC-13A)
- Validación reproducible con actores owner / manager / seller / artist / client / anonymous
- Rollback limpio (contenedor + volumen eliminados)

**Fuera de alcance (no implementado):**

- Write workflows · public links · email · signatures · storage real
- Bootstrap repair · integración V1 · runtime TypeScript
- Apply en cadena Supabase legacy

---

## 2. Infraestructura de prueba

| Campo | Valor |
|-------|-------|
| Imagen | `postgres:16` |
| Contenedor | `mdjb-lc13-read-security` |
| Container ID | `2f7b347f66f1d5ccd9d1beea71e6734a6ef18ca5c97086382e3509c1eef8e1fe` |
| Volumen | `mdjb-lc13-read-security-data` |
| Base | `mdjb_lc13_read_validation` |
| Publicación puertos | ❌ ninguna |
| Acceso | `docker exec` exclusivamente |
| Extensión | `pgcrypto` |
| Rol de prueba RLS | `lc13_tester` (LOGIN, `IN ROLE authenticated`) |

**Limpieza:** contenedor y volumen eliminados al cierre. `docker ps` / `docker volume ls` sin residuos `mdjb-lc13-read-security*`.

---

## 3. Migraciones aplicadas (solo 2)

| Orden | Archivo |
|-------|---------|
| 1 | `supabase/migrations/20260721044500_legal_center_persistence_foundation.sql` (LC-12) |
| 2 | `supabase/migrations/20260722101300_legal_center_read_security_lc13a.sql` (LC-13A) |

**NO** se aplicaron las 110 migraciones legacy.

---

## 4. Artefacto LC-13A creado

**Archivo:** `supabase/migrations/20260722101300_legal_center_read_security_lc13a.sql`

### A) Helpers mínimos

| Objeto | Propósito |
|--------|-----------|
| `auth.uid()` stub | Sesión vía GUC `request.jwt.claim.sub` |
| `legal_lc13_identity_profiles` | Bridge aislado (no `dj_profiles`) |
| `legal_lc13_read_access_context()` | Contexto read LC-13B-aligned |
| `legal_lc13_test_set_session(uuid)` | Setter de sesión — validación only |
| `legal_lc13_is_fiscal_template(text)` | Clasificación W-9 (`SPC-001`) |
| `legal_lc13_is_public_library_template(...)` | Catálogo público |
| `legal_lc13_can_read_fiscal()` | Gate fiscal (seller/client deny) |
| `legal_lc13_can_read_full_audit()` | Owner/manager raw audit |
| `legal_lc13_can_read_deleted_submissions()` | Owner only |
| `legal_lc13_matches_recipient_scope(text)` | Aislamiento artist/client |
| `legal_lc13_can_select_template(...)` | RLS templates |
| `legal_lc13_can_select_template_asset(...)` | RLS assets |
| `legal_lc13_can_select_audit_event(...)` | RLS audit projection |
| `legal_lc13_normalize_read_limit(int)` | Límite 1–100 |
| `legal_lc13_empty_read_envelope()` | Envelope vacío anti-enumeration |

### B) RLS — 7 tablas

`ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` en:

- `legal_templates`
- `legal_template_versions`
- `legal_template_assets`
- `legal_document_instances`
- `legal_w9_requests`
- `legal_document_submissions`
- `legal_audit_events`

**Políticas (15 total en catálogo):**

| Tabla | SELECT | DELETE | UPDATE |
|-------|--------|--------|--------|
| `legal_templates` | ✅ scoped | ❌ deny | (sin policy = deny) |
| `legal_template_versions` | ✅ scoped | ❌ deny | deny |
| `legal_template_assets` | ✅ scoped | ❌ deny | deny |
| `legal_document_instances` | ✅ recipient + staff | ❌ deny | deny |
| `legal_w9_requests` | ✅ fiscal + scope | ❌ deny | deny |
| `legal_document_submissions` | ✅ fiscal + scope + deleted gate | ❌ deny | deny |
| `legal_audit_events` | ✅ staff / artist projection | ❌ deny + trigger | ❌ deny + trigger |

**Reglas verificadas:**

- Anonymous sin acceso (0 filas / `persistence_identity_unavailable`)
- Seller sin fiscal (templates W-9, W-9 rows, RPC fiscal)
- Owner acceso completo incl. deleted submissions
- Manager operacional sin deleted submissions
- Artist/client limitados a recipient scope propio
- `legal_audit_events` append-only (trigger LC-12 + RLS UPDATE/DELETE deny)

### C) RPC read — SECURITY INVOKER (7)

| RPC | Aggregate |
|-----|-----------|
| `legal_read_templates` | Templates |
| `legal_read_template_versions` | Versions |
| `legal_read_template_assets` | Assets metadata |
| `legal_read_instances` | Document instances |
| `legal_read_w9_requests` | W-9 workflow |
| `legal_read_submissions` | Submissions |
| `legal_read_audit_events` | Audit trail |

Envelope: `{ data, next_cursor, has_more }` · columnas sensibles omitidas (`object_key`, `storage_key`, UUID interno).

---

## 5. Resultado de pruebas

**Matriz ejecutada:** 22 casos · **22 PASS · 0 FAIL**

| Test | Actor | Resultado |
|------|-------|-----------|
| owner_instances_all | owner | PASS (3) |
| owner_w9_all | owner | PASS (2) |
| owner_audit_all | owner | PASS (3) |
| owner_deleted_submission | owner | PASS (1) |
| owner_rpc_templates | owner | PASS |
| manager_instances_all | manager | PASS (3) |
| manager_deleted_submission | manager | PASS (0) |
| seller_fiscal_template | seller | PASS (0) |
| seller_public_template | seller | PASS (1) |
| seller_w9_rows | seller | PASS (0) |
| seller_rpc_w9 | seller | PASS (DENY) |
| seller_rpc_audit | seller | PASS (DENY) |
| artist_own_instances | artist | PASS (1) |
| artist_foreign_instance | artist | PASS (0) |
| artist_rpc_w9 | artist | PASS (1) |
| artist2_leak_scan | artist2 | PASS (0 cross-tenant) |
| client_own_instances | client | PASS (1) |
| client_foreign_instance | client | PASS (0) |
| client_rpc_w9 | client | PASS (DENY) |
| client_rpc_submissions | client | PASS (DENY) |
| anon_direct_select | anonymous | PASS (0) |
| anon_rpc_templates | anonymous | PASS (DENY) |

**Inmutabilidad audit (superuser session):**

- UPDATE audit → blocked (`append-only; UPDATE is forbidden`)
- DELETE audit → blocked (`append-only; DELETE is forbidden`)

**EXPLAIN — índice recipient:**

```
Index Scan using legal_document_instances_recipient_idx
  Index Cond: ((recipient_type = 'artist') AND (recipient_id = 'ART-001'))
```

---

## 6. Matriz ALLOW / DENY (resumen)

| Actor | Templates fiscal | Templates public | Instances own | W-9 | Submissions | Audit | Anonymous |
|-------|------------------|------------------|---------------|-----|-------------|-------|-----------|
| owner | ALLOW | ALLOW | ALLOW all | ALLOW | ALLOW (+deleted) | ALLOW | DENY |
| manager | ALLOW | ALLOW | ALLOW all | ALLOW | ALLOW (no deleted) | ALLOW | DENY |
| seller | DENY | ALLOW | DENY | DENY | DENY | DENY | DENY |
| artist | ALLOW (W-9 flow) | ALLOW | ALLOW own | ALLOW own | ALLOW own | PROJECTION | DENY |
| client | DENY | ALLOW | ALLOW own | DENY | DENY | DENY | DENY |
| anonymous | DENY | DENY | DENY | DENY | DENY | DENY | DENY |

---

## 7. Aislamiento cross-tenant

- `ART-002` no ve filas con `recipient_id = 'ART-001'` (0 filas)
- Artist RPC con `recipient_id` ajeno → envelope vacío / 0 filas
- Client no accede a instancias fiscales de artistas

---

## 8. Estados oficiales post-validación

| Área | Estado |
|------|--------|
| LC-12 DDL | APPROVED_BY_PO_IN_ISOLATED_POSTGRES |
| LC-13A SQL (repo) | Creado — validado aislado — **pendiente PO** |
| LC-13A apply cadena Supabase | BLOCKED_BY_LEGACY_BOOTSTRAP_DEBT |
| LC-13A producción | NOT_AUTHORIZED |
| LC-13B runtime bridge | Live (sin cambios en este ticket) |
| Public links / writes | DEFERRED |
| Push / deploy | NOT_AUTHORIZED |

---

## 9. Restricciones respetadas

| Prohibido | Cumplido |
|-----------|----------|
| supabase link/start/reset/db push | ✅ |
| Producción / remoto | ✅ |
| Edge / TypeScript runtime | ✅ |
| Bootstrap repair | ✅ |
| Modificar migraciones anteriores | ✅ |
| Commit / push / merge / PR / deploy | ✅ (sin commit) |

---

## 10. Estado final

> **LC-13A READ SECURITY VALIDADA EN POSTGRES AISLADO — PENDIENTE DE REVISIÓN Y APROBACIÓN PO**

**No implica:** bootstrap reparado · cadena 110 apply · autorización producción · deploy.

Handoff: [`SESSION-SUMMARIES/2026-07-22-LC13A-READ-SECURITY-VALIDATION.md`](../SESSION-SUMMARIES/2026-07-22-LC13A-READ-SECURITY-VALIDATION.md)
