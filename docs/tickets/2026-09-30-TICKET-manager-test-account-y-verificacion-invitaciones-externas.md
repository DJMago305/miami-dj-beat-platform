# TICKET — Cuenta de prueba Manager + verificación de invitaciones desde fuera de la red local

**Fecha de apertura:** 2026-09-30
**Origen:** hoja de ruta dada por el PO al cierre de la sesión de hoy (permisos de vendedora + gate de enrutamiento cliente/artista, PRs #604 y #606, ambos mergeados)
**Estado:** Pendiente — para la próxima sesión, no ejecutado hoy

---

## 1. Aprovisionamiento de cuenta Manager de prueba

- Crear en Supabase Auth la cuenta `manager.test@miamidjbeat.com` con rol explícito `manager` en base de datos. **La crea el PO** (regla del proyecto: creación de cuentas prohibida para el agente).
- Delimitar en `web/staff.html` su perímetro operativo exacto:
  - **Habilitados:** Schedule/Agenda, Eventos, Pedidos, Leads, DJ Management, Producción y Venues.
  - **Restringidos con candado 🔒 (cero llamadas de red):** Gobernanza, balances globales corporativos y configuración Stripe.
- Eliminar el bloque de código legado que hace fallback de Manager a permisos de Owner (hoy `applySide3RoleGate` retorna temprano para `role === 'owner' || role === 'manager'` — ver [web/staff.html](../../web/staff.html), función `applySide3RoleGate`, y `MDJ_VISTAS_POR_ROL.manager` — ambos deliberadamente sin restringir hasta hoy, documentado en `docs/ESTADO_MAESTRO.md` [2026-09-30] por falta de cuenta real para verificar).

**Por qué se pausó hoy:** no existe todavía ninguna cuenta real de manager — el patrón que costó caro hoy con seller fue construir permisos "a ciegas" sin poder probarlos en vivo (varias vueltas de ida y vuelta). Con la cuenta de prueba creada, se repite el mismo proceso de verificación en vivo ya usado con Wendy/Owner/Cliente.

## 2. Verificación de invitaciones remotas desde el exterior

- Enviar invitación formal desde el panel a la cuenta de prueba de Manager.
- Abrir el correo desde un dispositivo móvil o navegador externo, fuera de la red local, para certificar:
  - Redirección canónica a `https://www.miamidjbeat.com/account-settings.html` (confirmar si el dominio real usa `www` o no — hoy el `SITE_URL` configurado en Supabase Auth y el fallback del edge function usan `https://miamidjbeat.com`, sin `www`, ya verificado funcionando; no cambiar sin comprobar primero cuál es el dominio canónico real en Vercel).
  - Ausencia total de fallbacks a `localhost`.
  - Establecimiento correcto de contraseña inicial, sin mezcla de sesión (mismo bug que ya se corrigió hoy en `account-settings.html`: `autocomplete` de Chrome mezclando cuentas del mismo navegador — confirmar que no reaparezca al probar desde un dispositivo distinto).

---

## Contexto de la sesión que generó este ticket

Cerrado hoy, mergeado en `main`:
- PR [#604](https://github.com/DJMago305/miami-dj-beat-platform/pull/604) — matriz de permisos de vendedora, Cash Flow embebido, navegación unificada.
- PR [#606](https://github.com/DJMago305/miami-dj-beat-platform/pull/606) — gate de `staff.html` distingue cliente de artista, redirige a `client-portal.html`.

Ver `docs/ESTADO_MAESTRO.md`, entradas `[2026-09-30]`, para el detalle completo día a día.
