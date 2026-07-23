# TICKET-V1-OWNER-OPS-FEED-MVP-001

**Estado:** IMPLEMENTADO EN LOCAL — PENDIENTE VALIDACIÓN VISUAL PO  
**Tipo:** V1 · UI operativa · solo localhost  
**Product Owner:** Gerardo A. Valle  
**Baseline:** `plan/v2-phase-4-api-client` · `32a5a206069dd777a31325db54c4c92d5375944e`

---

## Objetivo

MVP **Owner Operations Feed** dentro del portal STAFF V1 (`admin-dashboard.html`): una vista **Actividad** que agrega lectura de actividad reciente desde fuentes V1 existentes, sin CRM nuevo, sin migraciones, sin escrituras remotas.

---

## Alcance implementado

| Área | Detalle |
|------|---------|
| Menú lateral | Sección **Clientes**: Leads → **Actividad** → Órdenes Event Builder → Base CRM |
| Vista | `#actividad` — feed unificado, filtros, Actualizar, meta de última carga y contador |
| Consultas | Solo `SELECT` vía `window.getSupabaseClient()` |
| Escrituras | **Ninguna** |
| Backend | **Sin cambios** (RLS, triggers, Edge, migraciones intactos) |

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `web/admin-dashboard.html` | Sidebar, sección UI, estilos scoped, `loadOwnerOpsFeed` / `renderOwnerOpsFeed` / filtros |

**Runtime:** 1 archivo (dentro del límite de 3 del ticket).

---

## Fuentes conectadas (SELECT)

| Fuente | Tipo feed | Notas |
|--------|-----------|-------|
| `leads` | lead | Obligatoria · columnas operativas sin tokens Stripe |
| `client_profiles` | registro | Alta reciente de clientes |
| `dj_profiles` | registro | Artistas/DJs · excluye roles staff (`owner/admin/manager/seller`) |
| `portal_messages` | mensaje | Sin cuerpo del mensaje · solo dirección y estado leído |
| `platform_inbox_messages` + `platform_tickets` | ticket | Asunto y estado · sin contenido completo |
| `payments` | pago | Monto agregado · sin IDs Stripe en UI |

Errores por fuente: banner discreto + `console.error` con prefijo `[OwnerOpsFeed][source]`. El panel sigue operativo si falla una fuente.

---

## Fuentes pospuestas

| Fuente | Motivo |
|--------|--------|
| `mdjpro_license_keys` | Sin SELECT directo para browser · solo RPC `mdjpro_license_snapshot()` por usuario |
| `mdjpro_license_events` | RLS: usuario lee solo eventos de su licencia |
| `processed_webhooks` | No hay lectura staff cableada en V1 UI |
| Realtime / push / email digest | Fuera de alcance MVP |

---

## Comportamiento MVP

- Carga al abrir **Actividad** o pulsar **Actualizar**
- Orden descendente por fecha (máx. 60 ítems normalizados)
- Filtros: Todos · Leads · Registros · Mensajes/Tickets · Pagos/MDJPRO
- Estado vacío por filtro
- Fail-closed por fuente (sin elevar permisos)

---

## Validación local

| Check | Resultado |
|-------|-----------|
| `http://localhost:8080/admin-dashboard.html` | HTTP 200 · markup `loadOwnerOpsFeed` / `#actividad` presente en HTML servido |
| Sesión Owner + datos reales | **PENDIENTE PO** (sin insertar fixtures) |
| Console / Network con sesión | **PENDIENTE PO** |
| Regresión otras pestañas Staff | **PENDIENTE PO** |

---

## Restricciones respetadas

- Solo localhost
- Sin commit · sin push · sin deploy · sin Supabase remoto administrativo
- Sin migraciones · sin RLS · sin Edge · sin V2 · sin auth/login
- Sin datos de prueba insertados en remoto

---

## Riesgos / limitaciones

1. Si RLS remoto deniega una fuente en prod/local, el feed muestra aviso parcial (comportamiento esperado).
2. `payments` puede estar vacía aunque haya cobros reflejados en `leads.balance_paid`.
3. MDJPRO no aparece como evento de licencia hasta ticket con backend/RPC staff.
4. No hay Realtime: requiere **Actualizar** manual.

---

## Estado final

```
TICKET-V1-OWNER-OPS-FEED-MVP-001
OWNER OPERATIONS FEED IMPLEMENTED LOCALLY —
EXISTING V1 DATA REUSED —
NO BACKEND REWRITE —
NO REMOTE WRITES —
NO PRODUCTION CHANGES —
PENDING PRODUCT OWNER VISUAL VALIDATION —
NO COMMIT · NO PUSH
```

---

## PO VISUAL VALIDATION — CORRECTION PASS 001

**Estado:** CORRECCIÓN LOCAL COMPLETA — PENDIENTE REVALIDACIÓN PO  
**Fecha:** 2026-07-22

### Problema 1 — `ReferenceError: Can't find variable: loadCRM`

| Campo | Detalle |
|-------|---------|
| **Evidencia** | Console al pulsar Base CRM · `onclick — admin-dashboard.html` |
| **Causa** | El MVP añadió `onclick="loadOwnerOpsFeed()"` en el enlace **Actividad** y dejó `handleHashNavigation()` ejecutándose **a mitad del script** (≈ línea 3932), **antes** de registrar `window.loadOwnerOpsFeed` (≈ 4648) y `window.loadCRM` (≈ 5152). Con hash `#actividad` o `#crm`, el `.click()` sintético disparaba handlers inline → `ReferenceError` → **aborto del resto del script** → `loadCRM` nunca se asignaba. |
| **Corrección** | 1) Eliminar `onclick` inline en enlaces **Actividad** y **Base CRM**. 2) Invocar `loadOwnerOpsFeed()` / `loadCRM()` desde el listener lateral existente (`target === 'actividad' \| 'crm'`). 3) Mover `handleHashNavigation()` al **final** del bloque `<script>`, después de todos los `window.*` loaders. 4) Botón Actualizar CRM → `window.loadCRM && window.loadCRM()`. |
| **Regresión CRM** | No reescrito · mismo `window.loadCRM` · contrato preservado. |

### Problema 2 — HTTP 400 en `dj_profiles`

| Campo | Detalle |
|-------|---------|
| **Evidencia PO (Network)** | `GET /rest/v1/dj_profiles?select=id,full_name,stage_name,role,email,avatar_url,created_at&role=in.(owner,admin,manager,seller)&order=role.asc` |
| **Origen de esa URL** | **`loadStaff()`** (pestaña Equipo → Staff), **no** el feed Actividad. Incluye columna `avatar_url` no usada en otras consultas V1 probadas del panel. |
| **Consulta anterior del feed** | `select=id,full_name,stage_name,dj_name,email,role,status,created_at&order=created_at.desc&limit=25` |
| **Respuesta Supabase (contrato típico PostgREST 400)** | Cuando una columna del `select` no existe en la vista expuesta: `code: PGRST204` · `message: column … does not exist` · `details` / `hint` null o referencia a columna. *(Confirmación exacta en Network → Response pendiente de revalidación PO con sesión.)* |
| **Decisión feed** | Alinear consulta del feed con columnas ya usadas en V1 (`loadStaffActivity`): `id,full_name,stage_name,email,role,created_at` — sin `dj_name`, sin `status`. Filtrado staff sigue en cliente. Log de error enriquecido (`message`, `details`, `hint`, `code`). **Fuente no pospuesta** — consulta corregida, no retirada. |
| **`loadStaff` 400** | **Fuera de alcance** de este pass (no es consulta del feed). Sigue visible si PO abre pestaña Staff. |

### Validación local (agente)

| Check | Resultado |
|-------|-----------|
| Simulación script con hash `#actividad` post-fix | `loadCRM` y `loadOwnerOpsFeed` definidos al finalizar parse |
| `http://localhost:8080/admin-dashboard.html` | HTTP 200 |
| Sesión Owner · Console · Network completos | **PENDIENTE PO** |

### Errores preexistentes fuera de alcance

- `favicon.ico` 404
- Clasificación incorrecta de perfiles (Ary DJ Productions / Aron Rosso) — ticket separado
- `loadStaff()` → `avatar_url` en `dj_profiles` (si persiste 400 al abrir Staff)
- Ausencia Realtime / MDJPRO en feed

### Estado tras correction pass

```
OWNER OPERATIONS FEED CORRECTION PASS 001 COMPLETE LOCALLY —
BASE CRM REGRESSION FIXED —
DJ_PROFILES FEED QUERY ALIGNED TO V1 COLUMNS —
NO REMOTE WRITES —
NO PRODUCTION CHANGES —
PENDING PRODUCT OWNER REVALIDATION —
NO COMMIT · NO PUSH
```
