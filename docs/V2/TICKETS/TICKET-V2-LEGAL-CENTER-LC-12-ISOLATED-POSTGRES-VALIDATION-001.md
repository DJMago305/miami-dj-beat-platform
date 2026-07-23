# TICKET-V2-LEGAL-CENTER-LC-12-ISOLATED-POSTGRES-VALIDATION-001

## Estado

**LC-12 ISOLATED POSTGRES VALIDATION PASS — PENDIENTE DE VALIDACIÓN PO** (aprobado PO en closeout documental)

| Campo | Valor |
|-------|-------|
| Ticket | LC-12 Isolated Postgres Validation |
| Modo | Validación local aislada y desechable |
| Rama | `plan/v2-phase-4-api-client` |
| HEAD | `d26e896187314e1e10b59ab2c9ec751b8fe4a46e` |
| Fecha | 2026-07-22 |
| Supabase start/reset | ❌ NO |
| Cadena 110 migraciones | ❌ NO |
| Remoto / producción | ❌ NO |
| Push / deploy | ❌ NO |

---

## 1. Objetivo

Validar el DDL de LC-12 **sin** ejecutar la cadena legacy de 110 migraciones, en PostgreSQL temporal local desechable.

**Archivo validado:**

```
supabase/migrations/20260721044500_legal_center_persistence_foundation.sql
```

---

## 2. Decisión PO (closeout)

El Product Owner aprueba:

> **LC-12 ISOLATED POSTGRES VALIDATION PASS**

La migración LC-12 queda **aprobada técnicamente** como DDL autocontenido, validado en PostgreSQL temporal y desechable.

**Estado oficial:**

> **LC-12 DDL VALIDADO Y APROBADO EN POSTGRES AISLADO — APPLY MEDIANTE CADENA SUPABASE COMPLETA BLOQUEADO POR DEUDA LEGACY DE BOOTSTRAP.**

Esta aprobación **NO** declara:

- que las 110 migraciones reconstruyan base vacía;
- que `supabase start` / `supabase db reset` funcionen;
- que bootstrap V1 esté reparado;
- que LC-13 RLS/RPC esté implementado;
- autorización push / merge / PR / deploy.

---

## 3. Infraestructura de prueba

| Campo | Valor |
|-------|-------|
| Imagen | `postgres:16` (oficial) |
| Contenedor | `mdjb-lc12-isolated-postgres` |
| Volumen | `mdjb-lc12-isolated-postgres-data` |
| Base | `mdjb_lc12_validation` |
| Usuario | `postgres` |
| Password | generado local — **REDACTED** |
| Publicación de puertos | **❌ ninguna** (`docker run` sin `-p`) |
| Acceso | exclusivamente `docker exec` |
| Extensión | `pgcrypto` habilitada |

**Nota de precisión:** `supabase/config.toml` declara PostgreSQL **17**; esta prueba usó PostgreSQL **16**. Evidencia fuerte de portabilidad del DDL; no sustituye validación futura en PG 17 ni apply en cadena global.

---

## 4. Apply LC-12

| Campo | Resultado |
|-------|-----------|
| Exit code | **0** |
| Errores SQL | ninguno |
| Otros SQL ejecutados | **ninguno** |

---

## 5. Objetos validados

| Check | Resultado |
|-------|-----------|
| Tablas `legal_*` | **7/7** |
| Secuencia `legal_audit_event_sequence` | **1/1** |
| Registros iniciales | **0** en las 7 tablas |
| Primary keys | presentes (7 tablas) |
| Foreign keys internas | **12** |
| UNIQUE / CHECK | presentes según migración |
| Índices | **45** en catálogo |
| Defaults / tipos | coherentes |
| Función `prevent_legal_audit_mutation()` | presente |
| Triggers append-only (UPDATE/DELETE) | **2** — bloqueo validado |
| RLS | **0** policies — DEFERRED_TO_LC_13 |
| RPC `legal_read_*` | **0** — DEFERRED_TO_LC_13 |

---

## 6. Pruebas funcionales sintéticas

Ejecutadas en `BEGIN … ROLLBACK` — **sin COMMIT**.

| Prueba | Resultado |
|--------|-----------|
| Cadena insert template → version → asset → instance → w9 → submission → audit | PASS |
| FKs internas | PASS |
| Secuencia audit auto-increment | PASS |
| Append-only (UPDATE audit bloqueado) | PASS |
| Persistencia post-prueba | **0 registros** (ROLLBACK) |

Datos: exclusivamente sintéticos (`SPC-001`, `CLI-001`, `STAFF-SELLER-001`, etc.) — sin datos personales, fiscales ni reales.

---

## 7. Limpieza

| Recurso | Estado |
|---------|--------|
| Contenedor `mdjb-lc12-isolated-postgres` | eliminado |
| Volumen `mdjb-lc12-isolated-postgres-data` | eliminado |
| Imagen `postgres:16` | conservada (permitido) |
| Git | limpio · HEAD `d26e896` |

---

## 8. Estados oficiales

| Área | Estado |
|------|--------|
| LC-12 schema/DDL | **APPROVED_BY_PO_IN_ISOLATED_POSTGRES** |
| LC-12 full migration-chain apply | **BLOCKED_BY_LEGACY_BOOTSTRAP_DEBT** |
| LC-12 production apply | **NOT_AUTHORIZED** |
| Legacy bootstrap remediation | **DISCOVERED_NOT_IMPLEMENTED** |
| LC-13 RLS | **NOT_IMPLEMENTED / DEFERRED** |
| LC-13 RPC | **NOT_IMPLEMENTED / DEFERRED** |
| Push / merge / PR / deploy | **NOT_AUTHORIZED** |

---

## 9. Próximos pasos (documentados, no ejecutados)

1. Validar LC-12 aisladamente en PostgreSQL 17.
2. Diseñar pipeline V2 independiente.
3. Crear baseline legacy controlado (ticket separado).
4. Separar formalmente migraciones V1 y V2.
5. Tratar deuda bootstrap en ticket independiente.
6. LC-13 RLS/RPC solo tras autorización PO explícita.

**Recomendación provisional:** no alterar 110 migraciones en alcance Legal Center; mantener deuda legacy separada; considerar validación PG 17; no avanzar automáticamente a RLS/RPC.
