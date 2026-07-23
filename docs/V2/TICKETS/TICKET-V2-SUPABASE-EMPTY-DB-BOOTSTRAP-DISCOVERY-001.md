# TICKET-V2-SUPABASE-EMPTY-DB-BOOTSTRAP-DISCOVERY-001

## Estado

**BOOTSTRAP DISCOVERY COMPLETADO — PENDIENTE DE DECISIÓN PO**

| Campo | Valor |
|-------|-------|
| Ticket | Supabase Empty DB Bootstrap Discovery |
| Modo | Discovery forense — solo lectura |
| Rama | `plan/v2-phase-4-api-client` |
| HEAD al cierre | `d26e896187314e1e10b59ab2c9ec751b8fe4a46e` |
| Fecha | 2026-07-22 |
| SQL apply | ❌ NO |
| Supabase start/reset | ❌ NO (en este ticket) |
| Remoto / producción | ❌ NO |
| Push / deploy | ❌ NO |

---

## 1. Objetivo

Determinar por qué el historial de migraciones en `supabase/migrations/` **no reconstruye una base PostgreSQL vacía** en entorno local, tras el fallo documentado en `TICKET-V2-LEGAL-CENTER-LC-12-LOCAL-MIGRATION-APPLY-001`.

---

## 2. Contexto del fallo observado

| Campo | Valor |
|-------|-------|
| Comando | `supabase start` (local, sin `--linked`) |
| Docker | operativo al momento del apply |
| Primera migración aplicada | `20260302_flow_tab_implementation.sql` |
| SQLSTATE | `42P01` |
| Error | `relation "public.dj_profiles" does not exist` |
| Statement | `ALTER TABLE public.dj_profiles ADD COLUMN …` |
| LC-12 alcanzada | ❌ NO (migración #110) |
| `supabase db reset` | ❌ NO ejecutado |
| Stack activo al cierre | ❌ NO |
| Acceso remoto | ❌ NO |

**Nota:** el hallazgo afecta la **reproducibilidad desde base local vacía**. No afirma que producción esté rota.

---

## 3. Inventario de migraciones

| Métrica | Valor |
|---------|-------|
| Total archivos | **110** |
| Orden Supabase | Lexicográfico por nombre |
| Primera migración | `20260302_flow_tab_implementation.sql` |
| Última migración | `20260721044500_legal_center_persistence_foundation.sql` (LC-12) |
| Archivos vacíos | 0 |
| Timestamps duplicados | 2 pares (orden resuelto por sufijo lexical) |

---

## 4. Origen de `public.dj_profiles`

| Pregunta | Respuesta |
|----------|-----------|
| ¿`CREATE TABLE public.dj_profiles` en `supabase/migrations/`? | **❌ NO** |
| ¿Definición fundacional en repo? | **✅ SÍ** — `web/sql/migrations/04_hybrid_login_infra.sql` (commit `ee7461f`) |
| ¿En cadena Supabase? | **❌ NO** |
| ¿Scripts manuales? | `supabase/setup.sql` (ALTER, no CREATE) · `SUPABASE-RUNBOOK.md` asume tabla existente |

---

## 5. Evidencia Git

| Pregunta | Evidencia |
|----------|-----------|
| ¿Migración Supabase que creara `dj_profiles`? | No encontrada en historial |
| ¿Eliminada/renombrada? | Sin evidencia |
| ¿Versionado posterior a base existente? | **Sí** — `ac015fd` (2026-03-03) introduce primera migración Supabase ya con ALTER |
| Commit introductor primera migración | `ac015fd` — `security: blindaje financiero e integridad de reputación` |
| Prerequisitos documentados | **No** |

---

## 6. Dependencias implícitas adicionales

Objetos core referenciados por migraciones Supabase **sin CREATE** en la cadena:

| Objeto | CREATE en `supabase/migrations/` |
|--------|-----------------------------------|
| `public.dj_profiles` | ❌ |
| `public.client_profiles` | ❌ (ALTER only; CREATE en `web/sql/` y `supabase/client_profiles_schema.sql`) |
| `public.leads` | ❌ (ALTER only en repo; sin CREATE en todo el repositorio) |

Pipelines paralelos: `web/sql/migrations/` (14 archivos) · scripts SQL Editor · `supabase/setup*.sql`.

---

## 7. Clasificación

**MULTIPLE_CAUSES**

| Componente | Descripción |
|------------|-------------|
| **MIGRATION_HISTORY_INCOMPLETE** | Primera migración Supabase = ALTER, no bootstrap |
| **LOST_BASELINE** | Sin migración baseline versionada en cadena |
| **LEGACY_REMOTE_SCHEMA_DEPENDENCY** | Esquema histórico creado manualmente / fuera de cadena |
| **MIGRATION_ORDER_ERROR** | Menor — timestamps duplicados (lexical OK) |

---

## 8. Relación con LC-12

LC-12 (`20260721044500_legal_center_persistence_foundation.sql`) es **autocontenida** y **no causó** el fallo de bootstrap. Nunca se alcanza en reset desde vacío mientras falle la migración #1.

Validación aislada posterior: `TICKET-V2-LEGAL-CENTER-LC-12-ISOLATED-POSTGRES-VALIDATION-001`.

---

## 9. Estrategias futuras (sin selección PO)

| ID | Opción | Recomendación documental |
|----|--------|--------------------------|
| A | Baseline migration pre-20260302 | CONDITIONAL |
| B | Recuperar baseline perdida de Git | NO |
| C | Schema baseline desde `web/sql/` | CONDITIONAL |
| D | Autocontener 110 migraciones | NO |
| E | Snapshot prod local | NO (V2 lab) |
| F | Probar LC-12 aislada | CONDITIONAL — **ejecutado PASS** |
| G | Separar V1 legacy / V2 | CONDITIONAL |
| H | Baseline V2 independiente | CONDITIONAL |

**Recomendación provisional:** no alterar las 110 migraciones dentro del alcance Legal Center; tratar deuda legacy en ticket independiente.

---

## 10. Restricciones

| Prohibido | Estado |
|-----------|--------|
| Modificar migraciones | ❌ NO en discovery |
| Crear baseline | ❌ NO autorizado |
| Supabase remoto | ❌ NO |
| Push / deploy | ❌ NO |

---

## 11. Estado final

> **BOOTSTRAP DISCOVERY COMPLETADO — PENDIENTE DE DECISIÓN PO**

**Estado oficial relacionado:**

> **LC-12 DDL VALIDADO Y APROBADO EN POSTGRES AISLADO — APPLY MEDIANTE CADENA SUPABASE COMPLETA BLOQUEADO POR DEUDA LEGACY DE BOOTSTRAP.**
