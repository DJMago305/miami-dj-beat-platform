# TICKET: Staff Order — Detalles mínimos pendientes de aprobación
**Estado:** 🟡 PENDIENTE — diseño base implementado, faltan detalles y aprobación visual  
**Fecha notarización:** 2026-06-22  
**Prioridad:** Media — base ya construida, solo detalles finales  
**Declarado por el Capitán:** "diseños de órdenes que ya estaban hechos y faltaban detalles mínimos"

---

## SUB-TICKET A — TICKET-UBICACION-001
**Archivo:** `web/staff-order.html`  
**Estado:** ✅ Implementado en sesión 2026-06-21 — ❌ Sin aprobación visual

**Cambios aplicados (pendientes de aprobación):**
- Campo `Ubicación` editable en `renderInfoGrid`
- `save()` persiste `leads.location` en Supabase
- Formato teléfono: `(305)-423-5812`
- Formato fecha: `2026 / 09 / 22`
- `colgroup` con anchos balanceados en la tabla

**Acción requerida:** Prueba visual por el Capitán → aprobación → commit.

---

## SUB-TICKET B — TICKET-EVENT-TIME-001
**Archivos:** `web/staff-order.html`, `web/client-portal.js`  
**Estado:** ❌ Sin implementar — pendiente verificación de columnas en DB

**Lo que falta:**
1. Verificar si `leads` tiene `event_start_time` / `event_end_time` en Supabase
2. Si no existen → migración SQL
3. Campos `type="time"` editables en `renderInfoGrid` de `staff-order.html`
4. `save()` persiste ambos campos
5. Mostrar hora inicio y cierre en la barra de info del portal cliente

**Acción requerida:** Confirmar columnas DB → scope explícito del Capitán → implementar.

---

## SUB-TICKET C — TICKET-EVENT-BRIEF-001
**Estado:** ❌ Sin diseño ni implementación

**Lo que falta:**
- Decisión del Capitán sobre formato de entrega del brief a artistas/proveedores
- ¿Email automático? ¿Link de solo lectura? ¿Panel en `dj-dashboard.html`?
- ¿Qué datos incluye el brief?
- ¿Quién puede disparar el envío? (solo `is_staff_management`)

**Acción requerida:** Sesión de diseño con Capitán + Arquitecto antes de tocar código.

---

## SUB-TICKET D — TICKET-VER-ORDEN-OWNER-ACCESS
**Archivos:** `web/client-portal.js`, `web/client-portal.html`, Supabase SQL  
**Estado:** ⚠️ Parcialmente implementado — bloqueado por causa no confirmada

**Cambios ya aplicados (pueden estar en disco):**
- `mdjPortalResolveStaff()` — `owner` añadido a las 3 verificaciones de rol
- RLS `leads_select_admin` + `leads_update_admin` — usa `is_staff()` en Supabase BD
- Cache buster `client-portal.html` actualizado

**Pendiente confirmar:**
1. `SELECT public.is_staff('<uid_gerardo>');` en SQL Editor → debe retornar `true`
2. URL contaminada `access_denied=1` elimina `mode=manager` — abrir siempre con link limpio
3. Migration file `supabase/migrations/20260618200000_leads_rls_add_owner_is_staff.sql` — no creado

**Acción requerida:** Verificar `is_staff()` en Supabase SQL Editor → confirmar resultado → continuar.

---

## ORDEN DE ATAQUE RECOMENDADO

1. **Sub-ticket A** — Solo aprobación visual (ya implementado)
2. **Sub-ticket D** — Un query SQL confirma el bloqueante
3. **Sub-ticket B** — Verificar columnas DB + implementar
4. **Sub-ticket C** — Requiere sesión de diseño separada
