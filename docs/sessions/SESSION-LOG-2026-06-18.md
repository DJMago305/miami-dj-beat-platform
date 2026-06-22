# SESSION LOG — 2026-06-18 (Tarde)

## Archivos modificados esta sesión
- `web/admin-dashboard.html`
- `web/client-portal.js`
- `web/client-portal.html`
- SQL directo en Supabase (sin migration file — ver pendiente)

---

## TRABAJO COMPLETADO

### TICKET-LEADS-TABLE-001 — Rediseño tabla Leads admin (✅ CERRADO LOCAL)

**Objetivo:** Transformar la tabla de Leads en el admin dashboard en una vista Excel profesional.

**Cambios aplicados:**

1. **Título limpiado**
   - Eliminado "Panel de Control del Manager" (`<h1>`)
   - Eliminado badge "Acceso: Super Admin (Full Control)" (oculto con `display:none`, lógica de roles preservada)
   - "Nuevas Solicitudes de Clientes" → `Solicitudes de Clientes` como heading dorado plano fuera del card

2. **Dos tablas separadas**
   - Tabla 1: `🔴 Pendientes (n)` — órdenes activas
   - Tabla 2: `✅ Completadas (0)` — con mensaje "Sin órdenes completadas aún."
   - Cada una es un bloque independiente con su propio `<table>`

3. **Estilo Excel**
   - Bordes verticales entre columnas (`border-right: 1px solid rgba(255,255,255,0.05)`)
   - Headers sticky (`position: sticky; top: 0`)
   - Font size 15px — lectura natural
   - Padding aumentado a 13px/16px

4. **Columna Cliente cableada**
   - Fuente de datos prioritaria: `client_profiles.full_name` via `user_id` (FK correcta, no `id`)
   - Fallback: `leads.name → leads.contact_person → '—'`
   - Fetch paralelo al cargar leads: `clientNameMap[client_user_id]`
   - Resultado: "Wendy E Ayala" aparece correctamente

5. **Panel scoping corregido**
   - El `id="leads"` estaba en `<h3>` — el sistema de paneles solo ocultaba el título, el contenido flotaba
   - Fix: envuelto en `<div id="leads" style="display:none;">` con el container adentro

6. **Limpieza de código**
   - Eliminada función `buildRows` duplicada (vieja sin `# Orden` column)
   - Eliminada regla CSS `.leads-section-header` (ya no usada)
   - Agregado `console.error('[Leads query error]', leadError)` para diagnóstico

---

### TICKET-CLIENT-PORTAL-OWNER — Fix acceso manager para owner (⚠️ PARCIALMENTE RESUELTO)

**Objetivo:** Que staff con rol `owner` pueda abrir "Ver orden" desde el admin y ver la orden del cliente.

**Problema raíz encontrado:**
- `mdjPortalResolveStaff()` en `client-portal.js` aceptaba `admin/manager/seller` pero NO `owner`
- RLS policy `leads_select_admin` en Postgres solo permitía `admin/manager`, NO `owner`

**Cambios aplicados:**

1. **`web/client-portal.js` — `mdjPortalResolveStaff()`**
   - Agregado `|| appR === 'owner'` en check de `app_metadata.role`
   - Agregado `|| ut === 'owner'` en check de `user_metadata.user_type`
   - Agregado `|| dr === 'owner'` en check de `dj_profiles.role`

2. **`web/client-portal.html` — cache buster actualizado**
   - `?v=20260603-portal-lang-respect-header` → `?v=20260618-owner-manager-access`

3. **SQL ejecutado directo en Supabase SQL Editor (sin migration file)**
   ```sql
   DROP POLICY IF EXISTS "leads_select_admin" ON public.leads;
   CREATE POLICY "leads_select_admin"
     ON public.leads FOR SELECT TO authenticated
     USING (public.is_staff(auth.uid()));

   DROP POLICY IF EXISTS "leads_update_admin" ON public.leads;
   CREATE POLICY "leads_update_admin"
     ON public.leads FOR UPDATE TO authenticated
     USING (public.is_staff(auth.uid()))
     WITH CHECK (public.is_staff(auth.uid()));
   ```

**Estado:** Sigue mostrando "No disponible con esta cuenta". Causa no confirmada.

---

## PENDIENTES DE LA PRÓXIMA SESIÓN

### 🔴 CRÍTICO — Ver orden aún bloqueado

**Síntomas:** `client-portal.html?lead=<id>&mode=manager` muestra "No disponible con esta cuenta" para el owner.

**Diagnóstico completo hecho:**
- ✅ `mdjPortalResolveStaff` — ahora incluye `owner`
- ✅ RLS `leads_select_admin` — ahora usa `is_staff(auth.uid())`
- ❓ `is_staff()` function — verificar que incluye `owner` (posible causa)
- ❓ URL contaminada con `access_denied=1` — puede estar eliminando `mode=manager`
- ❓ `portalFetchLeadRowById` — puede tener su propio gate

**Próximos pasos para resolver:**
1. Verificar en SQL: `SELECT public.is_staff('<gerardo_uid>')` — debe retornar `true`
2. Revisar `portalFetchLeadRowById` en `client-portal.js` para confirmar que usa la misma query
3. Crear migration file para el SQL ya aplicado en Supabase

### 🟡 Migration file pendiente
El SQL de RLS fix se ejecutó directo. Crear:
```
supabase/migrations/20260618200000_leads_rls_add_owner_is_staff.sql
```

### 🟡 `full_name` en query de admin
Se probó agregar `full_name` al `MDJ_ADMIN_LEADS_COLUMNS` pero causó query vacía.
Investigar si el error es de otra columna (`dj_agreed_payout_usd` / `dj_payout_released_at`).
Agregar `full_name` de vuelta una vez confirmadas las columnas existentes.

---

## STRIPE PRICE IDs — CONFIRMADOS (no cambiar)
| Variable | Price ID | Uso |
|----------|----------|-----|
| `STRIPE_PRICE_MONTHLY` | ✅ confirmado | PRO Artist mensual $100 |
| `STRIPE_PRICE_SEMESTRAL` | ✅ confirmado | PRO Artist 6 meses $480 |
| `STRIPE_PRICE_ANNUAL` | ⚠️ pendiente configurar | PRO Artist anual $840 |
| `STRIPE_PRICE_APP_MONTHLY` | `price_1TjV9aDtBrAhSobylMVTFqV0` ✅ | MDJPRO App mensual $19.99 |
| `STRIPE_PRICE_APP_ANNUAL` | ⚠️ pendiente crear en Stripe | MDJPRO App anual |

**Nota:** `STRIPE_PRICE_MONTHLY` y `STRIPE_PRICE_SEMESTRAL` incluyen licencia MDJPRO.
`STRIPE_PRICE_APP_MONTHLY` / `STRIPE_PRICE_APP_ANNUAL` = solo app, sin PRO Artist.
