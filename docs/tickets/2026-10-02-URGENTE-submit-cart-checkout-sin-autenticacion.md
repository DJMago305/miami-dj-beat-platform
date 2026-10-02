# URGENTE — `submit-cart-checkout` está en producción sin autenticación ni comprobación de dueño

**Fecha:** 2026-10-02 · **Origen:** auditoría de solo lectura pedida por el PO (prioridad 1 de la lista de pendientes) · **Estado:** corrección IMPLEMENTADA en la rama `feature/public-checkout-fase4` (sin PR, sin desplegar, sin probar contra la base real). La función desplegada en producción SIGUE siendo la versión vulnerable hasta que el PO la redespliegue.

## Qué es y dónde está
Edge Function de la Fase 4 del checkout público: recalcula el total de un lead desde `service_catalog` y lo **aprueba** (escribe `total_amount` y `total_aprobado_usd`, ya iguales, con la clave de servicio) para que `create-event-payment` cobre el depósito del 50 %. Código en la rama `feature/public-checkout-fase4` (commit WIP `9b752ab3`, sin PR). **Desplegada en producción** (v1, 2026-10-01) con `verify_jwt = false`. **Ningún archivo de `main` la llama**; sin llamadas en las últimas 24 h (el log solo permite mirar 24 h hacia atrás).

## Hallazgos (leídos en el código, no explotados)
1. **Sin autenticación.** No valida `Authorization` ni quién llama. Cualquiera con un `lead_id` puede invocarla.
2. **Sin comprobación de dueño.** No compara `leads.client_user_id` con el usuario. El checkout sí guarda `client_user_id = session.user.id` al crear el lead (`web/js/rentals.js` ~línea 1013), así que la comprobación es posible.
3. **Puede sobrescribir un total ya aprobado o pagado.** Solo rechaza leads `CANCELLED` o `COMPLETED`. No exige `total_aprobado_usd IS NULL`, ni `balance_paid = 0`, ni que el lead sea reciente. Con el `lead_id` de un cliente real (que aparece en su enlace `client-portal.html?lead=<id>`) se podría reescribir su total aprobado con el de un carrito arbitrario, incluso uno de un solo artículo barato.
4. **Confía en las líneas que manda el que llama.** Calcula el total con los `sku` y cantidades del cuerpo de la petición, no con lo que el lead tiene guardado. `leads` no guarda el carrito en una columna; vive en otra tabla (por localizar).
5. **Sin límite de cantidad ni de frecuencia.**

**Mitigante real hoy:** el `lead_id` es un UUID no adivinable y nada del sitio publicado llama a la función. El riesgo es de quien ya tenga un enlace con ese id; sube en cuanto se conecte el frontend.

## Corrección propuesta (sin implementar; toca dinero, requiere aprobación del PO)
- Exigir sesión: verificar el JWT del usuario (`getUser`) y que `leads.client_user_id = user.id`.
- Actualización atómica y condicional: solo si `total_aprobado_usd IS NULL`, `coalesce(balance_paid,0) = 0` y el lead tiene pocos minutos. Si no se cumple, responder 409 sin escribir.
- Idealmente derivar o contrastar las líneas con el carrito guardado del lead, en vez de creerle a la petición.
- Tope razonable de cantidad por línea.
- Probar en PRUEBA con montos conocidos antes de conectar `rentals.js`; después PR, merge y despliegue.

## Aviso al hacer el PR de la rama del checkout
La rama `feature/public-checkout-fase4` está atrasada respecto a `main` (parte de ~#608). Su `supabase/config.toml` no incluye la entrada `[functions.calendar-oauth-callback] verify_jwt = false` que `main` ya tiene: hay que rebasarla antes del PR para no perderla ni chocar.

## Implementación (2026-10-02, rama feature/public-checkout-fase4)
- `submit-cart-checkout/index.ts`: exige `Authorization: Bearer <token de sesión>` y valida con `auth.getUser` (la clave pública se rechaza con 401); solo el dueño (`leads.client_user_id`) puede aprobar, y para cualquier otro caso responde 404 igual que si el lead no existiera; solo aprueba un lead nunca aprobado, sin pagos, con `payment_status` UNPAID/PENDING y de menos de 30 min; escritura atómica con `.is('total_aprobado_usd', null)` y dueño en el UPDATE (409 si cambió); topes de 100 líneas y 500 unidades; errores internos sin detalles al cliente.
- `web/js/rentals.js`: `mdjRentalsApproveAndPay` manda el token de sesión a esta función (la llamada a `create-event-payment` no cambia); sin sesión cae al portal. `rentals.html` sube `?v=` a `20261002-checkout-fase4-token` (caché inmutable de un año en Vercel).
- Rama rebasada sobre `main` (estaba 56 commits atrasada; `config.toml` conserva `calendar-oauth-callback`).
- **Probado:** las reglas de decisión (15 casos, incluidos los de ataque: lead ajeno, sin dueño, ya aprobado, con pagos, pago en curso, cancelado, expirado) y los topes de líneas y cantidad, extraídos del archivo real. Sintaxis de ambos archivos.
- **NO probado:** la función completa contra la base real (Deno no está en esta máquina) ni el flujo de punta a punta con Stripe. Antes de mergear: probar en PRUEBA con un lead de prueba y montos conocidos; confirmar que un token ajeno recibe 404 y que la clave pública recibe 401.
- **Pendiente tras mergear:** redesplegar `submit-cart-checkout` (`supabase functions deploy submit-cart-checkout`) para que la vulnerable deje de estar en producción.
