# Auditoría forense: cableado de la asignación de un DJ (2026-09-21) — SOLO LECTURA

Tres investigaciones en paralelo, todas de solo lectura sobre producción (`hkuvuqupbxwkiykxvqdr`): (1) qué ve realmente un DJ, (2) avisos y recordatorios de punta a punta, (3) el modelo de «asignación por temporada». Nada se modificó.

## Diagnóstico en una frase
Hoy un DJ asignado recibe, como máximo, **un email que depende de un clic del manager**; no hay push, no hay SMS, no hay recordatorios, y su agenda personal solo se escribe si ese mismo clic ocurre en `staff-admin.html`. Ninguna pieza del servidor garantiza que el DJ se entere.

## Lo que SÍ funciona (no tocar)
- RLS de `leads`: un DJ lee los eventos asignados a él (compara bien `dj_profiles.id` contra `auth.uid()`); no hay confusión id/user_id en las lecturas del DJ.
- Aviso de mensajes del portal (email) a nivel de base de datos; recordatorios de contrato por SMS (cron cada 10 min, 432 corridas correctas).
- Trigger de avisos de órdenes al cliente: **encola** bien (lo que no funciona es el envío, ver P0-2).

## Hallazgos priorizados
### P0 — el DJ no se entera
1. **La asignación depende de un clic** (`web/staff-admin.html:4302-4345` llama a `notify-dj-assignment`); `web/js/production-module.js:1184` asigna sin avisar; `leads` no tiene trigger de asignación. Sin trigger no hay agenda personal (`artist_agenda` solo tiene 1 fila, de ELIXIS) ni aviso.
2. **El despachador de avisos nunca corre:** ningún cron ni código invoca `mdj-avisos-despachar`; `avisos_pendientes` acumula 3 pendientes con 0 intentos (1 de prueba del 21-ago y 2 `orden_cancelada` de hoy generadas al cancelar las órdenes de prueba de Wendy). Falta el secreto en Vault para autorizarlo (`x-mdj-cron` = `MDJ_CRON_KEY`).
3. **El asignación por temporada de DJYuyo es invisible para él:** la fila `ca248010` (viernes noche, Sundowner Key Largo) tiene `dj_id` NULL; la vista `residency_schedule_secure` solo deja pasar al DJ por `dj_id`. Simulado como DJYuyo: 0 filas en todas las tablas de agenda.
4. **Los DJ no tienen canal:** `push_suscripciones` tiene 1 fila (el owner); `mdj-push.js` solo se carga en la cuenta de cliente, no en el panel del DJ.

### P1
5. **Recordatorios 24 h / 2 h:** existe un mecanismo, pero cuelga de `booked_events` (0 filas; nadie escribe ahí). Además falta el secreto `edge_twilio_auth` en Vault, `notify-dj-sms` exige un Bearer que el gateway rechazaría (`verify_jwt=true`), y **0 de 12 teléfonos** están en formato E.164. El SMS toll-free sigue sin verificar (error 30032).
6. **Modelo de temporada:** ninguna de las 7 filas usa `start_date`/`end_date`/`series_name`; la de DJYuyo es indistinguible de una residencia permanente y su nota habla de rotación con DJSolitario (contradice la aclaración del PO). El cambio día→noche fueron 3 acciones sueltas sin atomicidad; `reasignar_dj_*` cambia el nombre pero no el `dj_id`.
7. **El DJ ve eventos CANCELADOS como trabajos vigentes** (`dj-dashboard.html:6855-6900`) y puede marcarlos «completado».
8. **Excepciones de fecha ilegibles para el DJ** (`residency_schedule_exceptions` solo staff): el reemplazado sigue viéndolas y el reemplazo no.
9. **Secretos incrustados en un trigger de producción** (`on_portal_message_insert`: un JWT de servicio y un secreto de webhook en texto plano visibles en `pg_get_triggerdef`): moverlos a Vault y rotarlos.
10. **Importación financiera de residencias** (`financial-engine import_residencies`): días fijos y deduplicación por título → agreements duplicados; no hay registro de «noche trabajada» ni pagos ligados (tablas de pagos vacías).

### P2 / P3
11. Cambio de fecha/cancelación de un evento asignado no avisa al DJ (no hay trigger de UPDATE en `leads`). 12. Notas de evento manager→DJ nunca disparan (falta trigger; script sin aplicar). 13. Panel «hoy» ignora fechas y excepciones. 14. Localización ambigua por (día, turno, venue) en `residency_schedule_modificar`. 15. Doble trigger de INSERT en `portal_messages`. 16. Comentarios obsoletos sobre `dj_id` «huérfano». 17. El calendario solo expande el año visible.

## Plan de arreglo por prioridades (propuesto, NADA aplicado)
- **Etapa 1 — servidor, sin tocar pantallas (P0-1, P0-2, P0-3):** trigger en `leads` (asignar/cambiar DJ, fecha, cancelar) que escribe la agenda personal con la función `artist_agenda_record_from_assignment` ya existente y encola `avisos_pendientes` (`dj_asignado`, `dj_evento_movido`, `dj_evento_cancelado`), con `EXCEPTION WHEN OTHERS` para no tumbar la asignación; cron cada minuto para `mdj-avisos-despachar` con el secreto en Vault; `dj_id` de la fila de DJYuyo. Probado en transacción deshecha.
- **Etapa 2 — pantalla del DJ (P0-4, P1-7):** botón «Activar avisos» (push) en `dj-dashboard.html`; ocultar/etiquetar cancelados. PR con visto bueno visual.
- **Etapa 3 — recordatorios y temporadas (P1-5, P1-6, P1-8):** columna `programado_para` + 24 h y 2 h desde `leads`; acción `reemplazar_turno` atómica; `end_date`/`series_name`; excepciones legibles por el DJ; teléfonos a E.164.
- **Etapa 4 — higiene (P1-9, P1-10, P2/P3):** secretos a Vault y rotación; corregir la importación financiera; el resto.
- **Externo:** verificación del número toll-free de Twilio (SMS).

## Decisiones/insumos que necesita el PO
1. ¿El viernes noche de DJYuyo en Sundowner es **una temporada con fin** (¿hasta cuándo?) o **rota semanalmente** con DJSolitario?
2. Secreto del despachador: confirmar/poner `MDJ_CRON_KEY` en los secretos de las funciones (el PO lo escribe él en Supabase; nunca en el chat).
3. Visto bueno para empezar por la Etapa 1.
