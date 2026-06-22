# TICKET: Ver Orden — Acceso Manager para Owner
**Estado:** 🔴 ABIERTO — sin aprobación visual  
**Fecha inicio:** 2026-06-18  
**Archivos en scope:** `web/client-portal.js`, `web/client-portal.html`, SQL RLS en Supabase  

---

## OBJETIVO REAL (clarificado 2026-06-18)

El staff (owner / manager / seller) debe poder abrir una orden desde el admin dashboard y:

1. **Ver todos los talentos solicitados** en la orden (DJ, saxofonista, hora loca, MC, etc.)
2. **Asignar manualmente** cualquier talento que el sistema no encontró automáticamente
3. **Registrar en el ticket** que ya tiene el talento confirmado
4. **Cerrar la orden** una vez todos los talentos están asignados y el evento está listo

**Flujo operativo:**
```
Admin Dashboard → Ver orden (lead)
→ Vista interna de la orden con lista de talentos solicitados
→ Staff revisa qué talento está asignado y qué falta
→ Si falta saxofonista → busca manualmente → asigna en el ticket
→ Marca orden como cerrada/completada
→ Sistema refleja el cierre al cliente
```

**Nota de diseño:** Este flujo es el trabajo manual de producción del equipo.
No es solo lectura — es la herramienta de trabajo del staff para cerrar eventos.

---

## OBJETIVO TÉCNICO (acceso al portal)

---

## OBJETIVO TÉCNICO (acceso al portal)
Que el staff con rol `owner` pueda hacer clic en **Ver orden** desde el admin dashboard y abrir la vista de la orden del cliente en `client-portal.html?lead=<id>&mode=manager` con capacidad de edición.

---

## COMPORTAMIENTO ACTUAL
Al hacer clic en **Ver orden** → abre `client-portal.html?lead=<id>&mode=manager` → muestra:

> **"No disponible con esta cuenta"**  
> "Este evento no está vinculado a tu correo. Usa la cuenta con la que reservaste o contacta a soporte."

---

## DIAGNÓSTICO COMPLETO

### Flujo de `client-portal.js` cuando `mode=manager`

```
URL: client-portal.html?lead=<id>&mode=manager

1. this.isManager = params.get('mode') === 'manager'  → true
2. if (this.isManager && leadId) → entra al bloque de auth manager
3. Espera Supabase client → OK
4. Obtiene sesión → user = Gerardo (owner) → OK
5. mdjPortalResolveStaff(db, user) → ¿retorna true o false?
6. Si false → showLeadAccessDenied() ← AQUÍ FALLA
```

### Función `mdjPortalResolveStaff` (línea 675, `client-portal.js`)

```javascript
async function mdjPortalResolveStaff(db, user) {
    // 1. Chequea app_metadata.role del JWT
    var appR = String((user.app_metadata && user.app_metadata.role) || '').toLowerCase();
    if (appR === 'admin' || appR === 'manager' || appR === 'seller') return true;
    // 'owner' NO ESTÁ → no pasa aquí

    // 2. Chequea user_metadata.user_type
    var ut = String((user.user_metadata && user.user_metadata.user_type) || '').toLowerCase();
    if (ut === 'admin' || ut === 'manager' || ut === 'seller') return true;
    // 'owner' NO ESTÁ → no pasa aquí

    // 3. Chequea dj_profiles.role en BD
    var pr = await db.from('dj_profiles').select('role').eq('user_id', user.id).maybeSingle();
    var dr = String((pr && pr.data && pr.data.role) || '').toLowerCase();
    return dr === 'admin' || dr === 'manager' || dr === 'seller';
    // 'owner' NO ESTÁ → retorna false → BLOQUEADO
}
```

### RLS Policy `leads_select_admin` (aplicada en Supabase)
**ESTADO:** Ya modificada en Supabase SQL Editor el 2026-06-18. Ahora usa `is_staff()`:

```sql
-- APLICADO EN SUPABASE (sin migration file todavía)
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

**Nota:** `is_staff()` cubre `admin, manager, owner, seller` según `.cursorrules`. Verificar con:
```sql
SELECT public.is_staff('<uid_de_gerardo>');
-- Debe retornar: true
```

---

## ESTADO DE ARCHIVOS DESPUÉS DEL ROLLBACK
- `web/client-portal.js` → **REVERTIDO** al estado original
- `web/client-portal.html` → **REVERTIDO** al estado original
- SQL Supabase (RLS) → **NO REVERTIBLE desde repo** — aplicado en BD, ver sección SQL

---

## INTENTOS QUE FALLARON (sin aprobación visual)

### Intento 1 — Agregar `owner` a `mdjPortalResolveStaff`
- **Archivo:** `web/client-portal.js` líneas 677-684
- **Cambio:** agregué `|| appR === 'owner'`, `|| ut === 'owner'`, `|| dr === 'owner'`
- **Resultado:** sin aprobación visual — el "No disponible" seguía
- **Estado:** **REVERTIDO** — archivo en estado original

### Intento 2 — Actualizar cache buster en `client-portal.html`
- **Archivo:** `web/client-portal.html` línea 1077
- **Cambio:** `?v=20260603-portal-lang-respect-header` → `?v=20260618-owner-manager-access`
- **Resultado:** sin aprobación visual
- **Estado:** **REVERTIDO** — archivo en estado original

### Intento 3 — `owner` en JS + cache buster (2do intento)
- **Archivos:** `web/client-portal.js` + `web/client-portal.html`
- **Cambio:** `appR === 'owner'` + cache buster `?v=20260618-owner-manager-access`
- **Resultado:** sin aprobación visual — "No disponible" seguía
- **Estado:** **REVERTIDO** ✅

### Intento 4 — SQL RLS con fallback JWT
- **SQL ejecutado:**
```sql
DROP POLICY IF EXISTS "leads_select_admin" ON public.leads;
CREATE POLICY "leads_select_admin"
  ON public.leads FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR lower(coalesce(auth.jwt()->'app_metadata'->>'role','')) IN ('admin','owner','manager','seller')
  );
-- (mismo patrón para leads_update_admin)
```
- **Resultado:** `Success. No rows returned` — corrió pero "No disponible" seguía
- **Estado:** **APLICADO EN SUPABASE** (no revertido — no daña funcionalidad existente)

### Intento 5 — SQL RLS en Supabase (1er intento, is_staff solo)
- **SQL ejecutado:** reemplazó `IN ('admin', 'manager')` por `is_staff(auth.uid())`
- **Resultado:** `Success. No rows returned` — corrió, pero "No disponible" siguió
- **Estado:** **SOBREESCRITO por Intento 4** (ahora tiene is_staff + JWT fallback)

---

## ESTADO ACTUAL DEL RLS EN SUPABASE (activo en BD)
```sql
-- leads_select_admin (activo ahora):
USING (
    public.is_staff(auth.uid())
    OR lower(coalesce(auth.jwt()->'app_metadata'->>'role','')) IN ('admin','owner','manager','seller')
)
-- leads_update_admin (activo ahora): mismo patrón
```
**Nota:** El admin dashboard sigue mostrando los 11 leads sin regresión.

---

## DATOS CONFIRMADOS EN BD
| Campo | Valor | Fuente |
|-------|-------|--------|
| `miamidjbeat@gmail.com` app_role | `owner` | `auth.users.raw_app_meta_data` |
| `djmago305@gmail.com` app_role | `manager` | `auth.users.raw_app_meta_data` |
| `is_staff()` incluye `owner` | SÍ | `pg_get_functiondef` |
| `miamidjbeat` en `dj_profiles` | DESCONOCIDO | Query retornó vacío en SQL Editor (auth.uid()=NULL) |

## LA CAUSA REAL AÚN NO ESTÁ CONFIRMADA
Los dos bloqueos JS + RLS estaban siendo atacados pero el resultado visual seguía fallando.
Hipótesis que quedó sin probar: el browser estaba sirviendo una versión cacheada del portal
que no recibía el JS actualizado a pesar del cache buster. La próxima sesión debe hacer
debug en DevTools → Network tab para confirmar qué versión de `client-portal.js` carga.

---

## HIPÓTESIS PARA PRÓXIMA SESIÓN (por orden de probabilidad)

### Hipótesis A — `is_staff()` no incluye `owner` (más probable)
Verificar en SQL Editor de Supabase:
```sql
-- Pega el UID de Gerardo (lo puedes ver en auth.users)
SELECT public.is_staff('UID_DE_GERARDO_AQUI');
```
Si retorna `false` → el problema es la definición de `is_staff()`.  
Fix: ver migración `20260430180000_staff_roles_unify_is_staff.sql` o la más reciente.

### Hipótesis B — Cache del browser sirvió JS viejo
Aunque el intento 1 falló visualmente, puede ser que el browser cacheó la versión sin el fix de `owner`.  
Fix: actualizar cache buster `client-portal.html` + verificar que el fix de `owner` en `mdjPortalResolveStaff` funciona con el buster correcto.

### Hipótesis C — URL contaminada con `access_denied=1`
Cuando la primera visita falla, `showLeadAccessDenied()` cambia la URL a:
```
client-portal.html?lead=<id>&access_denied=1
```
Esto **elimina** `mode=manager`. Si el usuario intenta de nuevo desde esa pestaña, `this.isManager = false` y entra al flujo de cliente → falla.  
Fix: siempre abrir "Ver orden" desde el admin (link con `target="_blank"`) con URL limpia, nunca reusar la pestaña contaminada.

### Hipótesis D — `portalFetchLeadRowById` tiene su propio gate
Incluso si `mdjPortalResolveStaff` pasa, la query en `portalFetchLeadRowById` (línea ~714) puede fallar si la RLS bloquea a owner.  
Fix: ya aplicado en Supabase (hipótesis A/D combinadas).

---

## PASOS EXACTOS PARA LA PRÓXIMA SESIÓN

```
PASO 1 — Verificar is_staff() para Gerardo
→ Supabase SQL Editor:
   SELECT public.is_staff(auth.uid());
   (logueado como Gerardo)

PASO 2 — Si is_staff() = true:
→ Autorizar cambio en client-portal.js:
   - Agregar 'owner' a mdjPortalResolveStaff (las 3 líneas)
→ Autorizar cambio en client-portal.html:
   - Actualizar cache buster

PASO 3 — Si is_staff() = false:
→ Fix en is_staff() function definición (migration SQL)
→ Luego Paso 2

PASO 4 — Crear migration file para el RLS ya aplicado:
→ supabase/migrations/20260618200000_leads_rls_add_owner_is_staff.sql

PASO 5 — Test visual: Ver orden → debe abrir vista de orden del cliente
```

---

## ARCHIVOS INVOLUCRADOS
| Archivo | Línea | Cambio requerido | Estado |
|---------|-------|-----------------|--------|
| `web/client-portal.js` | 677-684 | Agregar `owner` a `mdjPortalResolveStaff` | ⏳ pendiente autorización |
| `web/client-portal.html` | 1077 | Actualizar cache buster | ⏳ pendiente autorización |
| `supabase/migrations/20260618200000_...sql` | nuevo | Migration del RLS ya aplicado | ⏳ pendiente crear |

---

## NOTA IMPORTANTE — SQL YA EN PRODUCCIÓN
El SQL de RLS fue ejecutado directamente en Supabase SQL Editor y está activo en la BD.  
El admin dashboard sigue mostrando los 11 leads correctamente (no hay regresión visible).  
Pero el migration file en el repo NO existe todavía — discrepancia entre repo y BD.
