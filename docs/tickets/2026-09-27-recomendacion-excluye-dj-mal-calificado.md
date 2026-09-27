# TICKET — Nunca recomendar a un cliente el mismo DJ que calificó mal
Creado 2026-09-27 a pedido del PO. **PROPUESTO, sin construir.**

## El pedido del PO, textual
"El registro nunca más le dará ese DJ a ese cliente... nunca a un cliente que da bajas calificaciones de un DJ se le recomendará el mismo DJ." El PO asumía que esto ya estaba funcionando — no era así, verificado hoy con datos reales, no opinión.

También aclaró el matiz importante: esto es sobre la relación **cliente↔DJ específica**, no sobre hundir la reputación general del DJ por una mala experiencia aislada — "si el DJ hace 10 bodas con buenas calificaciones y una que no fue favorable, hay un balance, es 10 contra 1, no se puede juzgar por un cliente". O sea: el DJ sigue apareciendo bien calificado para todos los demás clientes; solo ese cliente en particular no debe volver a verlo recomendado.

## Lo que ya existe de verdad (verificado hoy, no una foto vieja)
- **Tabla `dj_public_reviews`** — ya tiene exactamente el par necesario: `dj_user_id`, `reviewer_user_id`, `rating`, `comment`, `status`. 3 reseñas reales hoy en producción.
- **Función `get_recommended_djs(p_master_client_id, p_event_date)`** — ya existe, ya ordena por afiliación/PRO/disponibilidad/calificación general del DJ (`dp.rating`).
- **Pero `get_recommended_djs()` NO consulta `dj_public_reviews` en absoluto** — no hay ninguna exclusión por historial cliente↔DJ.
- **Y esa función solo se llama desde una herramienta interna de staff** (`web/calendario-operacional-inteligente.html`) — nunca se conecta al buscador público (`find-dj.html`) ni a ningún flujo real donde un cliente vea recomendaciones directamente.

**Conclusión:** las piezas para construir esto ya existen, reales, en producción — solo falta conectarlas. No es un proyecto desde cero como el modelo grande de "experiencia por tipo de venue" (ver `project_cashflow_financial_intelligence_vision.md` en memoria) — es mucho más chico y accionable.

## Diseño propuesto (sin decidir todavía, para que el PO lo revise)
1. **Modificar `get_recommended_djs()`** (o crear una función nueva) para que excluya cualquier DJ donde exista una fila en `dj_public_reviews` con `reviewer_user_id = p_master_client_id` (o el client_id real del que pide recomendación) y `rating` por debajo de un umbral — **falta decidir el umbral** (¿1-2 estrellas de 5? el PO no dio un número).
2. **No tocar el rating general del DJ** — la exclusión es solo para ESE cliente específico, el resto de clientes lo siguen viendo normal. Esto ya es coherente con cómo está escrita la función hoy (usa `dp.rating`, el promedio general, no algo por-cliente).
3. **Conectar esta función (o su lógica) al flujo público real** — hoy solo vive en la herramienta interna de staff. Para que el pedido del PO se cumpla de verdad, el buscador/flujo de reserva que usa el cliente final necesita esta misma exclusión, no solo la vista de staff.
4. **RESUELTO (2026-09-27) — la reseña debe venir de un cliente real que lo contrató.** El PO confirmó: "sí protege al artista/DJ, solo clientes que lo usen" — y aclaró que **esta regla aplica a cualquier categoría de evento**, no solo bodas. Verificado a nivel de base de datos: hoy `dj_public_reviews` **no exige esto** — `reviewer_user_id` solo tiene una FK a `auth.users` (cualquier cuenta con sesión puede reseñar a cualquier DJ, sin comprobar que lo haya contratado). Esta protección hay que agregarla antes de construir la exclusión — de lo contrario, alguien podría dejar una reseña falsa sin haber contratado nunca a ese DJ y bloquearlo injustamente. Falta decidir el mecanismo exacto: ¿atar la reseña a una fila real en `bookings`/`booked_events`/`dj_events` confirmada, o a algún otro registro de contratación real?

## CONSTRUIDO Y APLICADO EN PRODUCCIÓN (2026-09-27)
El PO decidió arrancar. Antes de construir se verificó `leads` (única tabla con `client_user_id`+`assigned_dj_id` juntos): de 7 filas totales, **las 7 están CANCELLED**, solo 1 tiene cliente+DJ juntos, 0 tienen pago liberado — exigir contratación confirmada hoy habría bloqueado prácticamente todas las reseñas reales, incluidas las 3 que ya existen. **Decisión del PO**: construirlo ahora sin esa verificación (protege menos hoy, pero ya funciona), agregarla cuando haya contrataciones confirmadas reales. Umbral decidido: **1-2 estrellas de 5**.

`supabase/migrations/20260927150000_get_recommended_djs_excluye_mal_calificados.sql` — `get_recommended_djs()` ahora excluye, por cliente específico, cualquier DJ que ese mismo cliente calificó 1-2 estrellas en `dj_public_reviews` (`status='published'`). No toca `dp.rating` (el promedio general que ven los demás clientes).

**Verificado con datos reales, no solo lógica:**
- Caso normal (cliente sin reseñas negativas, `89186c43-...`): la lista de 8 DJs sale completa, sin cambios.
- Caso de exclusión: simulado con una reseña de 1 estrella dentro de una transacción con `ROLLBACK` (sin dejar ningún dato falso) — DJSolitario desapareció de la lista (8→7). Confirmado `dj_public_reviews` sigue en 3 filas reales tras la prueba.

**Sigue pendiente, sin construir todavía:**
1. La verificación de contratación confirmada (queda documentada arriba, para cuando `leads`/`bookings` tengan datos reales).
2. Conectar esta función al flujo público real — sigue viviendo solo en `web/calendario-operacional-inteligente.html` (herramienta interna de staff), no en `find-dj.html` ni en ningún flujo de cliente final.
