# SMS — CERRADO: ambos toll-free entregan de verdad, confirmado con datos reales

**Fecha:** 2026-09-27
**Disparado por:** el PO preguntó por el estado real de la verificación toll-free y luego corrigió que ya se había probado.
**Estado:** CERRADO. `+18334322941` entregaba desde el 23-sept; `+18447474159` se probó en vivo hoy (comando `curl` directo a la API de Twilio, corrido por el propio PO en su terminal, con su Auth Token — nunca compartido en el chat) y Twilio confirma **`Delivered`** a las 2026-09-27 19:07:21 PDT (`+18447474159` → `+13056071780`). Los dos números toll-free de Miami DJ Beat LLC entregan SMS reales. No hace falta construir nada nuevo.

## Lo que confirman los logs reales de Twilio (consola, 2026-09-27, PO logueado)

Hay **dos** números toll-free, con historiales completamente distintos:

- **`+18334322941` (SoundForTips)**: mensajes reales del 2026-09-23 con estado **`Delivered`** (varios, ida y vuelta con `+13056071780`), más algunos `Received` (entrantes) y **un** `Failed` puntual. **El PO tenía razón — este número sí está entregando de verdad desde el 23 de septiembre.**
- **`+18447474159` (bookings/agenda de DJs)**: **todos** sus envíos históricos (marzo, agosto, 1 de septiembre) están en **`Undelivered`**, sin ninguna excepción. No hay ningún envío registrado después del 1 de septiembre — es decir, **nunca se ha probado un envío por este número desde que quedó verificado** (la aprobación de Twilio para este número llegó después, entre el 23 y el 27 de septiembre). Dato pendiente, no dato ya probado.

**Corrección a la nota anterior de este ticket**: la tabla `elixis_sms_pending` no tenía nada después del 2 de septiembre porque, en efecto, nadie ha usado ESE número desde entonces — el dato de Twilio (fuente de verdad real) lo confirma, no era una limitación de búsqueda.

## Hallazgo nuevo, sin relación con lo anterior: `+18447474159` tiene el webhook de entrantes en demo

Revisando su configuración en Twilio: el webhook de "Handling for incoming messages" sigue apuntando a `https://demo.twilio.com/welcome/sms/reply/` (el de ejemplo de Twilio), no a `system-messages-webhook` (el receptor real que si tiene `+18334322941`). Si alguien responde un SMS a este número hoy, esa respuesta no llega a ningún lado de Miami DJ Beat. Corregirlo es un cambio de una sola URL en la consola de Twilio (o vía API), sin tocar código — pendiente de que el PO lo autorice.

## Verificado antes de proponer construir nada nuevo (condición explícita del PO)

Ya existe `supabase/functions/elixis-sms-estado/index.ts` — función de solo lectura (GET, nunca envía nada) que le pregunta directo a la API de Twilio el estado real de cualquier SID o de los últimos 20 mensajes, y **traduce los códigos de error reales al español** (30032 toll-free sin verificar, 30034 sin A2P 10DLC, etc.). Hace exactamente lo que este ticket iba a pedir construir (un `StatusCallback` webhook nuevo) — **no hace falta construir nada**, ya existe y ya resolvió esta misma duda hoy consultando Twilio directo. Lo único que falta, si se quiere, es una pantalla en staff que la use en vez de tener que entrar a la consola de Twilio — no pedido todavía, no se construye sin que el PO lo pida.

## Próximo paso

Nada urgente de código. Lo único que queda abierto es corregir el webhook de entrantes de `+18447474159` (hoy apunta a la demo de Twilio) cuando el PO lo autorice — no bloquea el envío, solo las respuestas entrantes por ese número.

Familia: [[project_sms_aceptado_no_es_entregado]].
