# URGENTE — SMS: "toll-free verificado" no es lo mismo que "entrega confirmada"

**Fecha:** 2026-09-27
**Disparado por:** el PO preguntó "ya el toll free está verificado también, creo que ya sabemos que está funcionando, comprueba ese dato" y luego "creo que eso ya se probó, tú estás desactualizado" — punto de vista del PO: puede que él ya haya probado el envío directamente y le haya llegado.
**Estado:** dato en disputa — pendiente de que el PO confirme si probó un envío real después de la verificación, y pendiente de construir la única pieza que daría certeza real.

## Lo que se confirmó con datos reales (2026-09-27)

- Twilio aprobó la verificación toll-free de `+18447474159` para Miami DJ Beat LLC (correos de Twilio, "Aviso" 2026-09-27 y "Approved!" el mismo día) — esto resuelve el error específico 30032 (toll-free sin verificar), una de las causas sospechadas desde antes (ver [[project_sms_aceptado_no_es_entregado]]).
- Consultada la tabla real `public.elixis_sms_pending` en producción (`hkuvuqupbxwkiykxvqdr`): el registro más reciente es del **2026-09-02** — no hay ningún envío registrado en esa tabla después de la verificación del toll-free. Si el PO probó el envío por otra vía (no por ELIXIS/esta tabla), ese dato no quedó aquí.
- **Aunque hubiera un envío reciente, esta tabla no puede probar entrega real** — solo guarda si Twilio *aceptó* el mensaje (columna `estado`/`twilio_sid`), nunca si llegó al teléfono. Antes del fix del 2026-08-20 esa misma limitación ya causó falsa confianza (Twilio devolvía 200 y se marcaba "enviado" aunque nunca llegara).

## Lo que falta construir para que esto deje de ser una duda (pedido explícito del PO: "lo que no se ha construido ahí hay que hacerlo, debemos verificarlo")

La única fuente de verdad real es el webhook `StatusCallback` de Twilio (evento que Twilio manda cuando el mensaje pasa a `delivered`/`undelivered`/`failed`, con el código de error real de la operadora si falla). Hoy no existe:

1. Edge Function nueva (ej. `twilio-sms-status-callback`) que reciba el POST de Twilio con `MessageSid`, `MessageStatus`, `ErrorCode`.
2. Configurar esa URL como `StatusCallback` en las llamadas de `elixis-sms-dispatch` (o en la consola de Twilio, según cómo esté armado hoy el dispatch).
3. Columna(s) nuevas en `elixis_sms_pending` (o tabla aparte) para el estado final real: `entregado`/`fallido_operadora`/`error_code_operadora`.
4. Reflejar ese estado real en la consola de staff, en vez de quedarse en "enviado" para siempre.

## Próximo paso inmediato

Antes de construir nada: **preguntar al PO si el envío que él considera "ya probado" fue disparado desde ELIXIS/el sistema, o directo desde otro lado** (su teléfono, la consola de Twilio, etc.) — si fue fuera del sistema, no prueba que el flujo real de Miami DJ Beat esté entregando. Si confirma que sí fue desde el sistema y sí le llegó, de todas formas construir el StatusCallback sigue siendo lo único que da certeza permanente hacia adelante (no solo para esta prueba puntual).

No se ha escrito código todavía — pendiente de luz verde del PO para empezar (regla de gobernanza estándar: ningún commit sin ticket + aprobación).

Familia: [[project_sms_aceptado_no_es_entregado]].
