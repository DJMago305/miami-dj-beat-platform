# TICKET: WhatsApp Business real para recordatorios (hoy cae a SMS)

**Fecha:** 2026-10-01
**Reportado por:** el PO, al notar que la conexión de WhatsApp Business "también pide autorización" (paralelo a la verificación OAuth de Google).
**Estado:** Pendiente — pospuesto explícitamente por el PO para otra sesión.

## Qué hay hoy

`supabase/functions/send-reminder-sms/index.ts` despacha recordatorios de contrato pendiente de firma. Acepta `channel: "sms" | "whatsapp"` en `reminder_queue`, pero el código mismo documenta (línea 111-116) que el canal `whatsapp` **nunca se implementó de verdad** — cualquier fila con `channel='whatsapp'` se manda igual por SMS normal (Twilio rechazaría limpio si de verdad se intentara mandar con el prefijo `whatsapp:` sin lo de abajo).

## Qué falta para que funcione de verdad

**Del lado de cuenta (no es código, es similar a la verificación OAuth de Google que ya está en curso):**
1. Registrar un remitente de **WhatsApp Business API** en la consola de Twilio — el número de SMS actual (`TWILIO_PHONE_NUMBER`) no sirve automáticamente para WhatsApp.
2. Eso exige una cuenta de **Meta Business Manager verificada** (documentos de negocio, verificación de Meta).
3. Someter el texto del recordatorio (`TEMPLATES.contract_pending_reminder` en el código actual) como **plantilla de mensaje**, aprobada por Meta — WhatsApp Business API no permite texto libre como primer mensaje fuera de una conversación ya iniciada por el cliente.

**Del lado de código, una vez lo de arriba esté aprobado:**
- Cambiar el envío para canal `whatsapp` de `Body: texto libre` (como está ahora) a usar la plantilla aprobada vía `ContentSid`/`ContentVariables` de Twilio (Twilio Content API), en vez del `Body` de texto plano que usa el canal SMS.
- El resto del flujo (cola `reminder_queue`, reintentos, revalidación contra `contract_sends`, aceptado≠entregado) ya sirve tal cual para ambos canales, sin cambios.

## Por qué no se ejecuta ahora

El PO pidió dejarlo documentado para otra sesión — no es un bug, es una pieza de "Fase 2" nunca construida, y el primer paso real (registro en Twilio + verificación de Meta) lo tiene que iniciar él, no es algo ejecutable desde este hilo.
