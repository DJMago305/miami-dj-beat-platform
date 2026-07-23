# TICKET-V2-LEGAL-CENTER-LC-12-LOCAL-APPLY-PREREQUISITE-HARDENING-001

## Estado

**PRERREQUISITOS VERSIONABLES CORREGIDOS** — apply local LC-12 **continúa bloqueado** hasta Docker y autorización PO.

| Campo | Valor |
|-------|-------|
| Ticket | LC-12 Local Apply Prerequisite Hardening |
| Modo | Corrección mínima de prerrequisitos versionables |
| Rama | `plan/v2-phase-4-api-client` |
| HEAD baseline | `33783f3bbf0907f4f100cc1ff3c64d9d602e08f6` |
| Fecha | 2026-07-22 |
| SQL apply | ❌ NO autorizado en este ticket |
| Supabase start/stop | ❌ NO ejecutado |
| `supabase unlink` | ❌ NO ejecutado |
| Push / deploy | ❌ NO |

---

## 1. Objetivo

Eliminar bloqueos **versionables** detectados en el informe de readiness LC-12 local migration apply (`TICKET-V2-LEGAL-CENTER-LC-12-LOCAL-MIGRATION-APPLY-READINESS-001`) antes del ticket futuro de aplicación local de LC-12.

Acciones autorizadas en este ticket:

1. Crear `supabase/seed.sql` neutro (sin datos).
2. Documentar protocolo de aislamiento local vs remoto para el operador del ticket de apply.

**No** aplica migraciones · **no** inicia Docker/Supabase · **no** modifica LC-12 SQL · **no** interactúa con Supabase remoto.

---

## 2. Baseline

| Check | Resultado |
|-------|-----------|
| Rama | `plan/v2-phase-4-api-client` |
| HEAD | `33783f3bbf0907f4f100cc1ff3c64d9d602e08f6` |
| Working tree (pre-cambio) | limpio |
| LC-12 migration aplicada | ❌ NO |
| LC-13B bridge runtime | ✅ Aprobado PO (commit `decf057`) |

---

## 3. Hallazgos de readiness (referencia)

Informe readiness LC-12 (2026-07-22):

| Hallazgo | Severidad | Acción en este ticket |
|----------|-----------|------------------------|
| `supabase/seed.sql` ausente pero referenciado en `config.toml` | Media (infra) | ✅ Corregido — archivo neutro creado |
| Docker ausente | Alta | ⏳ Prerrequisito manual — fuera de alcance |
| Metadata de link remoto en `supabase/.temp/` | Alta (operativo) | ✅ Documentado — sin `unlink` en este ticket |
| Artefacto LC-12 SQL + tests estáticos | Listo | Sin cambios (no autorizado) |

---

## 4. Docker como prerrequisito manual

El stack Supabase local (`supabase start`, `supabase db reset`) **requiere Docker Desktop** activo.

En la auditoría de readiness:

- Supabase CLI: disponible (`/opt/homebrew/bin/supabase` v2.95.4).
- Docker: **no encontrado** en PATH al momento del audit.

**Este ticket no instala Docker.** El operador del ticket de apply debe validar manualmente:

```bash
docker info
```

Si falla, **detenerse** — no iniciar Supabase ni aplicar migraciones.

---

## 5. Estado de enlace remoto detectado en `supabase/.temp/`

Se detectó metadata de proyecto Supabase enlazado en el directorio local `.temp/` (no versionado en git):

| Artefacto | Estado |
|-----------|--------|
| `supabase/.temp/project-ref` | presente — ref remoto parcial `hkuv***` |
| `supabase/.temp/linked-project.json` | presente — nombre proyecto remoto PO |

**Importante:**

- La existencia de esta metadata **NO autoriza** ninguna operación remota.
- **Este ticket no ejecutó** `supabase unlink` ni modificó `supabase/.temp/**`.
- El ticket futuro de apply debe operar **exclusivamente** contra el stack localhost iniciado con Docker.

---

## 6. Riesgo de comandos remotos

Con metadata de link presente, errores operativos pueden dirigir cambios al proyecto remoto si se usan comandos incorrectos.

| Riesgo | Comando / patrón | Consecuencia |
|--------|------------------|--------------|
| Push schema remoto | `supabase db push` | Aplica migraciones al proyecto linked |
| Reset remoto | `supabase db reset --linked` | Destruye/recrea BD remota |
| Migración remota | `supabase migration up --linked` | Aplica pendientes en remoto |
| Re-link | `supabase link` | Refuerza/enlaza remoto |
| Unlink no autorizado | `supabase unlink` | Fuera de alcance sin ticket PO |
| Deploy Edge remoto | `supabase functions deploy` | Producción remota |
| Ref explícito | cualquier flag `--project-ref` | Target remoto |
| URL remota | `DATABASE_URL` / `POSTGRES_URL` apuntando a `*.supabase.co` | Conexión fuera de localhost |

**Regla:** si un comando puede alcanzar un host distinto de `127.0.0.1` / `localhost`, **detenerse**.

---

## 7. Lista blanca de comandos futuros (ticket de apply LC-12)

Solo para el ticket PO futuro de aplicación local — **NO ejecutar en este ticket**:

| Orden | Comando | Propósito |
|-------|---------|-----------|
| 1 | `docker info` | Confirmar Docker activo |
| 2 | `supabase --version` | Confirmar CLI |
| 3 | `supabase start` | Levantar stack **local** |
| 4 | `supabase status` | Verificar URLs **localhost** |
| 5 | `supabase db reset` | Aplicar cadena completa de migraciones incl. LC-12 |

Verificación SQL (solo contra DSN local):

```
postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

Ejemplos de consultas de evidencia (post-reset, ticket apply):

- Listar tablas `legal_*`
- Listar constraints en `legal_audit_events`
- Confirmar **0** policies en tablas `legal_*`
- Confirmar **0** funciones `legal_read_*`

---

## 8. Lista negra de comandos

**Prohibidos** en el ticket de apply local LC-12 y en este hardening:

| Comando / patrón | Motivo |
|------------------|--------|
| `supabase db push` | Target remoto cuando linked |
| `supabase db reset --linked` | Reset remoto |
| `supabase migration up --linked` | Migración remota |
| `supabase link` | Enlace remoto |
| `supabase unlink` | No autorizado sin ticket PO explícito |
| `supabase functions deploy` | Deploy remoto |
| Cualquier `--project-ref` | Target remoto explícito |
| Conexión vía `DATABASE_URL` remoto (`*.supabase.co`) | Fuera de localhost |
| SQL Editor Dashboard remoto | No es gate LC-12 lab local |

---

## 9. Reglas de validación localhost

Antes de `supabase db reset` en el ticket de apply:

1. Ejecutar `supabase status`.
2. Confirmar que la salida muestra URLs con **`127.0.0.1`** o **`localhost`**.
3. Puerto API esperado: **`54321`**.
4. Puerto Postgres esperado: **`54322`**.
5. Si la salida **no** muestra localhost → **detenerse** — no ejecutar reset.
6. Ejecutar `supabase db reset` **sin** flag `--linked`.
7. Capturar logs locales (`tee` a `/tmp/mdj-lc12-*.log` recomendado).

**Aclaración CLI:**

- `supabase db reset` **sin** `--linked` corresponde al stack local iniciado por `supabase start`.
- Está **absolutamente prohibido** agregar `--linked`.

---

## 10. Evidencia requerida en el ticket de aplicación

El ticket futuro de apply LC-12 debe adjuntar:

| Evidencia | Contenido |
|-----------|-----------|
| Baseline git | rama + HEAD al momento del apply |
| `docker info` | exit 0 |
| `supabase status` | URLs localhost `:54321` / `:54322` |
| Log `supabase db reset` | migraciones aplicadas sin error |
| Query tablas | 7 tablas `legal_*` + secuencia audit |
| Query constraints | incl. append-only audit guard |
| Query índices | partial unique W-9 activo presente |
| Ausencia RLS/RPC Legal | 0 policies · 0 `legal_read_*` |
| Gates npm | `npm test -- --run` + `npm run typecheck` exit 0 |

Toda URL en evidencia debe ser `127.0.0.1` o `localhost`. **No** incluir project refs completos, tokens ni service-role keys.

---

## 11. Rollback local

En el laboratorio local exclusivamente:

| Escenario | Acción |
|-----------|--------|
| Reset falló | Corregir causa → `supabase stop` → `supabase start` → `supabase db reset` |
| Schema indeseado | `supabase db reset` (recrea desde migraciones repo) |
| Apagar stack | `supabase stop` |

No existe rollback incremental “undo LC-12” sin nueva migration; en lab, **reset es el rollback**.

---

## 12. Restricciones PO

| Prohibido | Estado |
|-----------|--------|
| Aplicar SQL / LC-12 migration | ❌ NO (ticket apply separado) |
| Iniciar/detener Supabase en este ticket | ❌ NO |
| `supabase unlink` | ❌ NO |
| Modificar `supabase/migrations/**` | ❌ NO |
| Modificar `supabase/config.toml` | ❌ NO |
| Push | ❌ NO — requiere **`APROBADO PUSH`** |
| Deploy producción | ❌ NO — requiere **`APROBADO DEPLOY PRODUCCIÓN`** |
| Declarar LC-12 aplicada | ❌ NO — migration sigue sin apply |

Gate posterior a apply exitoso: **LC-13B RLS/RPC** (ticket PO + evidencia LC-12 local).

---

## 13. Estado final

| Ítem | Estado |
|------|--------|
| `supabase/seed.sql` neutro | ✅ Creado |
| Protocolo aislamiento documentado | ✅ Este ticket |
| Docker Desktop | ⏳ Pendiente instalación/validación manual |
| Metadata link remoto | ⚠️ Presente en `.temp/` — operador debe validar localhost antes de reset |
| LC-12 migration aplicada | ❌ NO |
| Apply local LC-12 | ⏳ Bloqueado hasta Docker + ticket PO apply |

**Veredicto:**

> **PRERREQUISITOS VERSIONABLES CORREGIDOS — APPLY LOCAL LC-12 CONTINÚA BLOQUEADO HASTA DOCKER Y AUTORIZACIÓN PO.**

---

## Anexo — Contrato `[db.seed]` observado

Fuente: `supabase/config.toml` (sin modificar en este ticket).

| Directiva | Valor |
|-----------|-------|
| `[db.seed] enabled` | `true` |
| `sql_paths` | `["./seed.sql"]` |
| Ruta resuelta | `supabase/seed.sql` (relativa al directorio `supabase/`) |
| Estado pre-ticket | archivo **ausente** |
| Estado post-ticket | archivo **presente** — comentarios únicamente, sin DML/DDL |

---

## Anexo — Contenido autorizado de `supabase/seed.sql`

```sql
-- Intentionally empty.
-- Miami DJ Beat V2 currently has no approved local seed data.
-- This file exists so `supabase db reset` can complete using the
-- configured local seed path without introducing production,
-- personal, fiscal, authentication, or Legal Center records.
```

Sin INSERT · UPDATE · DELETE · TRUNCATE · DDL · DCL · funciones · datos · secretos · referencias remotas.
