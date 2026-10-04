# TICKET — ELIXIS no puede mandarle mensajes a los artistas (solo a clientes)

Creado 2026-10-04 a pedido del PO: «muy mal que ELIXIS no le manda mensajes a artistas, es un hueco terrible».
Estado: **ABIERTO, sin construir.** ELIXIS está pausado por orden del PO desde el 2026-09-23 (ver `docs/ESTADO_MAESTRO.md`); este ticket queda listo para cuando el PO dé la señal.

## 1. Cómo se encontró
El PO pidió escribirle a **Jaziel**, la última cuenta de artista creada (2026-09-10, perfil incompleto: sin especialidad, categoría, bio ni foto; entró una sola vez). Se quiso hacer con ELIXIS y no se pudo: hubo que redactar el correo y el SMS a mano para mandarlos desde el Gmail y el celular del PO.

## 2. Evidencia (código real, leído el 2026-10-04)
- `supabase/functions/elixis-chat/index.ts`, `runSmsQueueTool` (línea ~2881): el destinatario solo puede ser `cliente_id` (tabla `client_profiles`) o `contacto_id` (tabla `network_referencia_contactos`, «persona del Network SIN cuenta»). **Nunca consulta `dj_profiles`.** El teléfono siempre sale de la base, nunca de lo dictado (regla que se mantiene).
- `runEmailQueueTool`: el destinatario sale solo de `buscar_cliente`; se rechaza si el cliente desactivó notificaciones por email. Un artista no es cliente.
- El prompt (`elixis-chat/index.ts`, herramientas 11 y 12) dice lo mismo: «El destinatario SIEMPRE sale de buscar_cliente».
- Las colas `elixis_sms_encolar` / `elixis_email_encolar` reciben `p_dest_id uuid` sin tipo de destinatario; los despachadores son `elixis-sms-dispatch` y `elixis-email-dispatch`; la compuerta humana es `_shared/approval-gate.ts` + `confirmar_envio_mensaje`.
- **Trampa:** `consultar_red_contactos` (leída en `approval-gate.ts` como lectura libre) sí lee `dj_profiles` para el Directorio «Network». ELIXIS puede *ver* a un artista ahí y luego intentar mandarle un SMS con ese id; `runSmsQueueTool` lo busca en `network_referencia_contactos`, no lo encuentra y devuelve `cliente_no_encontrado`.
- No existe ninguna herramienta que notifique al artista dentro de su panel, aunque la base ya tiene `_dj_notificar()` (bandeja `dj_notifications` + cola de push `avisos_pendientes`), usada por los triggers de turnos y eventos.

## 3. Impacto
- El dueño no puede pedirle a ELIXIS «recuérdale a X que complete su perfil», «avísale a Y de su turno» ni «mándale el link a Z». Todo lo que concierne al equipo de artistas es manual, justo lo contrario de la regla del PO («todo se hace en el sistema, con ELIXIS o manual del staff»).
- Cuentas de artista incompletas (hoy Jaziel) se quedan a medias sin ningún aviso automático ni asistido.

## 4. Propuesta mínima (misma arquitectura HITL: ELIXIS solo ENCOLA, el humano confirma)
1. **`buscar_artista`** (lectura libre, igual que `buscar_cliente`): busca en `dj_profiles` por nombre artístico o legal; devuelve `user_id`, nombre, especialidad, plan y si el perfil está completo. Nunca devuelve el teléfono ni el correo al modelo.
2. **Extender `enviar_sms` y `enviar_email` con `artista_id`** (el `user_id` de `dj_profiles`). Teléfono desde `dj_profiles.phone`; correo desde `auth.users`. Se mantiene: solo staff/owner puede pedirlo, el contacto sale de la base, vista previa con teléfono parcialmente oculto, confirmación «sí» antes de despachar, y registro en `recordActionLog`. Si el artista no tiene teléfono o correo utilizable, la herramienta lo dice y no inventa.
3. **`notificar_artista`** (canal nuevo, el más fiable y gratis): escribe en la bandeja del panel del artista y en la cola de push usando `_dj_notificar()`. Es el único canal que no depende de Twilio ni de Resend.
4. **Recordatorio automático de perfil incompleto** (cron diario): artistas con `artist_specialty`, `bio_short` o `photo_url` vacíos a las 24 y 72 horas de crear la cuenta → aviso en bandeja + correo, máximo 2 avisos por cuenta, con registro. Texto base y enlace en el apéndice.
5. **Reglas que NO se tocan:** el SMS y el correo a artistas respetan las preferencias de notificación de cada cuenta; las categorías no se mezclan (un artista no se registra como «contacto del Network» ni como cliente para forzar el envío); la plantilla de artista, la de staff y la de cliente siguen separadas.

## 5. Advertencia sobre el SMS
Twilio devuelve 200 al *aceptar* el mensaje, no al entregarlo, y la entrega a números de EE. UU. tiene un problema conocido sin resolver (A2P 10DLC / toll-free sin verificar; ver `project_sms_aceptado_no_es_entregado`). Para artistas, el orden de confianza es: bandeja del panel + push → correo → SMS. La consola ya muestra «En manos de la operadora» en vez de «Enviado», y eso debe conservarse.

## 6. Criterios de aceptación
- El owner dice «mándale un mensaje a Jaziel…» → ELIXIS lo encuentra con `buscar_artista`, muestra el borrador, pide confirmación y, tras «sí», despacha por el canal pedido.
- Un usuario que no sea staff/owner no puede usarlo (queda rechazado por la compuerta).
- Un artista inexistente, sin teléfono o con avisos desactivados produce un mensaje claro, sin envío.
- Cada envío queda en el registro de acciones con quién lo pidió y a quién.
- El recordatorio automático manda como máximo 2 avisos por cuenta incompleta y se detiene al completarse el perfil.
- Pruebas: la suite de `elixis-chat` cubre destinatario inválido, sin teléfono, opt-out y el caso «id de artista pasado como contacto_id».

## 7. Gobernanza
- Dominio: herramientas de ELIXIS (`JURISDICCIONES.md` §2). El PO debe dar la señal para retomarlo (ELIXIS está pausado) y debe asignar el hilo.
- Despliegue de funciones y SQL de colas: lo corre el PO (el clasificador bloquea ambos desde el hilo del agente).
- Ya hay un SQL de bandeja reutilizable (`_dj_notificar`, `supabase/scripts/20260921_cableado_asignacion_dj.sql`), así que el canal 3 no necesita infraestructura nueva.

## Apéndice — mensaje manual que se usó el 2026-10-04 (Jaziel)
- Asunto: «Completa tu perfil en Miami DJ Beat». Cuerpo: avisa que su registro del 9 de septiembre está incompleto (categoría, especialidad, bio, foto), que no aparece en el directorio mientras tanto, y le da el enlace de entrada `https://www.miamidjbeat.com/login.html` para elegir su categoría y editar su perfil desde Config; contacto (305) 607-1780.
- SMS (183 caracteres, sin acentos, 2 segmentos): «Miami DJ Beat: tu registro esta incompleto. Entra, elige tu categoria y completa tu perfil para aparecer en el directorio: https://www.miamidjbeat.com/login.html Ayuda: (305) 607-1780».
