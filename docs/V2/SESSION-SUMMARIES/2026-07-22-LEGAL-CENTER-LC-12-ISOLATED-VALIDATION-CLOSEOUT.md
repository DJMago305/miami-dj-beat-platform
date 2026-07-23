# LEGAL CENTER LC-12 — ISOLATED VALIDATION CLOSEOUT

**Ticket:** TICKET-V2-LEGAL-CENTER-LC-12-ISOLATED-VALIDATION-DOCUMENTATION-CLOSEOUT-001
**Fecha:** 2026-07-22
**Modo:** Documentación de cierre técnico — **sin commit en este ticket**

---

## 1. Baseline Git

| Campo | Valor |
|-------|-------|
| **Rama** | `plan/v2-phase-4-api-client` |
| **HEAD** | `d26e896187314e1e10b59ab2c9ec751b8fe4a46e` |
| **Working tree (pre-docs)** | limpio |

---

## 2. Decisión Product Owner

El Product Owner aprueba:

> **LC-12 ISOLATED POSTGRES VALIDATION PASS**

**Estado oficial:**

> **LC-12 DDL VALIDADO Y APROBADO EN POSTGRES AISLADO — APPLY MEDIANTE CADENA SUPABASE COMPLETA BLOQUEADO POR DEUDA LEGACY DE BOOTSTRAP.**

---

## 3. Cronología técnica (resumen)

| Fase | Ticket / evento | Resultado |
|------|-------------------|-----------|
| Readiness | LC-12 local migration apply readiness | Artefacto listo; Docker ausente inicialmente |
| Prerrequisitos | LC-12 prerequisite hardening (`d26e896`) | `seed.sql` neutro + protocolo aislamiento |
| Apply cadena | LC-12 local migration apply | **`supabase start` FAIL** — `42P01` `dj_profiles` |
| Discovery | Empty DB bootstrap discovery | **MULTIPLE_CAUSES** — cadena incompleta |
| Validación aislada | LC-12 isolated Postgres validation | **PASS** — DDL autocontenido |
| Closeout | Este documento | Documentación PO |

---

## 4. Fallo seguro del apply por cadena completa

| Campo | Valor |
|-------|-------|
| Comando | `supabase start` (local, sin `--linked`) |
| Docker | operativo |
| Migración fallida | `20260302_flow_tab_implementation.sql` |
| SQLSTATE | `42P01` |
| Objeto ausente | `public.dj_profiles` |
| LC-12 alcanzada | ❌ NO |
| `supabase db reset` | ❌ NO ejecutado |
| Stack activo | ❌ NO |
| Remoto | ❌ NO |

---

## 5. Discovery bootstrap legacy

| Hallazgo | Detalle |
|----------|---------|
| Migraciones | 110 en `supabase/migrations/` |
| Primera migración | ALTER `dj_profiles` — sin CREATE previo en cadena |
| CREATE `dj_profiles` | `web/sql/migrations/04_hybrid_login_infra.sql` |
| Otros objetos core | `client_profiles`, `leads` — sin CREATE en cadena Supabase |
| Clasificación | **MULTIPLE_CAUSES** |

Componentes: MIGRATION_HISTORY_INCOMPLETE · LOST_BASELINE · LEGACY_REMOTE_SCHEMA_DEPENDENCY · MIGRATION_ORDER_ERROR (menor).

**Alcance del hallazgo:** reproducibilidad desde base local vacía — **no** afirma producción rota.

---

## 6. Validación aislada LC-12 (evidencia aprobada)

| Evidencia | Resultado |
|-----------|-----------|
| PostgreSQL | `postgres:16` · sin `-p` |
| Contenedor / volumen | `mdjb-lc12-isolated-postgres` / `mdjb-lc12-isolated-postgres-data` — eliminados |
| `pgcrypto` | presente |
| Apply LC-12 | exit **0** |
| Tablas | **7/7** |
| Secuencia | **1/1** |
| FKs internas | **12** |
| Índices / constraints | validados |
| Append-only audit | validado |
| Pruebas sintéticas | `BEGIN/ROLLBACK` · 0 persistencia |
| Git | sin cambios runtime |
| Datos reales | ❌ ninguno |

**Precisión PG 17:** `config.toml` declara PG 17; prueba en PG 16 — PASS válido; validación PG 17 recomendada como opción futura.

---

## 7. Estados oficiales separados

| Estado | Valor |
|--------|-------|
| LC-12 schema/DDL | **APPROVED_BY_PO_IN_ISOLATED_POSTGRES** |
| LC-12 full migration-chain apply | **BLOCKED_BY_LEGACY_BOOTSTRAP_DEBT** |
| LC-12 production apply | **NOT_AUTHORIZED** |
| Legacy bootstrap remediation | **DISCOVERED_NOT_IMPLEMENTED** |
| LC-13 RLS | **NOT_IMPLEMENTED / DEFERRED** |
| LC-13 RPC | **NOT_IMPLEMENTED / DEFERRED** |
| Push / merge / PR / deploy | **NOT_AUTHORIZED** |
| V2 production release | **BLOCKED_PENDING_COMPLETE_PROJECT_AND_FINAL_PO_APPROVAL** |

---

## 8. Separación de concerns

| Concern | Estado |
|---------|--------|
| Aprobación técnica DDL LC-12 | ✅ Aprobada PO (Postgres aislado) |
| Cadena global Supabase | ❌ Bloqueada (deuda bootstrap) |
| LC-13 RLS/RPC | ⏳ No autorizado · ticket PO futuro |

---

## 9. Próximos pasos (opciones, sin ejecutar)

1. Validación LC-12 en PostgreSQL 17 aislado.
2. Pipeline V2 independiente.
3. Baseline legacy controlado (ticket separado).
4. Separación formal V1/V2 migraciones.
5. Remediación bootstrap legacy.
6. LC-13 RLS/RPC tras PO explícito.

**Recomendación provisional:** no alterar 110 migraciones en alcance Legal Center; deuda legacy separada; considerar PG 17; no avanzar automáticamente a RLS/RPC.

---

## 10. Documentación generada (este closeout)

| Archivo | Acción |
|---------|--------|
| `docs/V2/TICKETS/TICKET-V2-SUPABASE-EMPTY-DB-BOOTSTRAP-DISCOVERY-001.md` | creado |
| `docs/V2/TICKETS/TICKET-V2-LEGAL-CENTER-LC-12-ISOLATED-POSTGRES-VALIDATION-001.md` | creado |
| `docs/V2/SESSION-SUMMARIES/2026-07-22-LEGAL-CENTER-LC-12-ISOLATED-VALIDATION-CLOSEOUT.md` | creado |
| `docs/V2/README.md` | actualizado |
| `docs/V2/NOTA-DIARIA-LAB-001.md` | actualizado |

---

## 11. Restricciones intactas

Sin runtime · sin SQL apply · sin Docker/Supabase en closeout · sin baseline · sin LC-13 · sin commit · sin push · sin merge · sin PR · sin deploy.

---

## 12. Estado final

> **DOCUMENTACIÓN LC-12 AISLADA PREPARADA — PENDIENTE DE REVISIÓN Y AUTORIZACIÓN PO PARA COMMIT LOCAL**
