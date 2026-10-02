# TICKET — Orden de prueba atascada en `merch_orders` sin poder limpiarse

**Fecha de apertura:** 2026-09-30
**Origen:** el PO encontró una orden en Cash Flow que parecía una compra real sin enviar; se investigó y resultó ser una sesión de Stripe en modo prueba (`cs_test_...`) de hace más de un mes, nunca limpiada.
**Estado:** Pendiente — desviaba del trabajo real de hoy (Matrix con datos reales), se deja para retomar aparte.

## El hallazgo

`public.merch_orders`, fila `id = 6deb594c-9e23-423f-b379-4da2969f302e`: gorra "cap-gold" $37.44, `customer_email = djmago305@gmail.com`, `status = 'paid_pending_fulfillment'`, `stripe_session_id` empieza con `cs_test_` (modo prueba de Stripe, **nunca fue un cargo real**). Lleva desde el 2026-08-28 sin `fulfilled_at`, apareciendo como si fuera un pedido real pendiente de envío.

**Ya corregido, no requiere acción:** la función `mdj_metricas_adquisicion_reales()` (Cash Flow → panel "Adquisición real") ya excluye explícitamente cualquier `stripe_session_id like 'cs_test_%'`, así que esta fila no contamina ningún número real que vea el PO.

## Lo que falta (por qué se deja pendiente)

- Intenté cambiar su `status` a algo que dijera claramente "dato de prueba" para que dejara de aparecer en la cola de "pendiente de enviar" del panel de Pedidos — **la tabla tiene un `CHECK constraint` en `status` que no permite valores nuevos** sin antes revisar cuáles son los valores válidos y decidir a cuál mapearlo (o ampliar el constraint).
- No se tocó nada más para no seguir desviando tiempo de la tarea real de hoy.

## Próximo paso sugerido

1. Revisar el `CHECK constraint` real de `merch_orders.status` (`information_schema` o `pg_constraint`) para ver los valores permitidos.
2. Decidir con el PO: ¿se agrega un valor nuevo tipo `test_data` al constraint, o se reusa uno existente (ej. `cancelled`) para sacarla de la cola de pendientes?
3. Aplicar el cambio y confirmar que desaparece de cualquier panel de "pedidos pendientes" en `staff.html`/`staff-admin.html`.
