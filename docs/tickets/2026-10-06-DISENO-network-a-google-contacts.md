# DISEÑO · Network manda a Google Contacts (Network = maestro, Google = esclavo)

Fecha: 2026-10-06 · Estado: **solo diseño. Nada construido, nada tocado en las cuentas de Google.** Para construir hace falta la orden explícita del PO (permiso nuevo en su Google + función nueva desplegada).

## 1. Objetivo

Lo que el PO edita en Network (nombre, empresa, teléfonos, categoría/lista, «ya no trabaja», cumpleaños, notas) aparece en Google Contacts sin editar dos veces. Una sola dirección: **Network → Google**.

## 2. Lo que ya existe (verificado en el código y en producción)

- Calendar sincroniza **fechas**, no contactos (`calendar-reconcile`, `calendar-sync-webhook`: Google → plataforma; `calendar-evento-editar` y `calendar-push-important-date`: plataforma → Google). Permiso actual: solo `calendar.events`.
- Hay infraestructura reutilizable: OAuth con `state` firmado (`calendar-oauth-init/callback`), tokens cifrados en Vault (`calendar_google_leer_token`, solo `service_role`), cron con `CRON_EDGE_AUTH_SECRET`, patrón de baja suave.
- El Network: `network_referencia_contactos` (970 fichas, 811 con teléfono), `network_lists`, `network_list_members`. Campos útiles ya estructurados: `nombre, empresa, telefono, phones_extra[{tipo,numero}], email, emails_extra, birth_date (+ año conocido), aniversario, direccion, redes_sociales, notas, photo_url`.

## 3. Mapa de campos (Network → People API de Google)

| Network | Google Contacts |
|---|---|
| nombre | names (givenName/familyName por separación simple; si dudoso, todo en givenName) |
| empresa | organizations.name |
| telefono + phones_extra | phoneNumbers (tipo: mobile/work/other según `tipo`) |
| email + emails_extra | emailAddresses |
| birth_date | birthdays (sin año si `birth_date_year_conocido=false`) |
| aniversario | events (type anniversary) |
| direccion | addresses |
| redes_sociales | urls |
| notas | biographies (límite de Google: 4000 caracteres, se recorta con aviso) |
| id de la ficha | userDefined `MDJB_ID` (trazabilidad; permite re-enlazar si se pierde el mapa) |
| listas del Network | **etiquetas** (contact groups) con prefijo `MDJB · ` (ej. `MDJB · Managers`, `MDJB · Seguridad`) |
| «Ya no trabaja» / «Por verificar» | etiqueta `MDJB · Ya no trabaja` / `MDJB · Por verificar` |
| photo_url | **Fase 2** (requiere subir la imagen por `updateContactPhoto`) |

Regla de seguridad de etiquetas: la función **solo crea, asigna y quita etiquetas con prefijo `MDJB · `**. Las etiquetas existentes del PO (por ejemplo «Miami DJ Beat - Negocio») jamás se tocan.

## 4. Piezas nuevas

1. **Permiso**: scope `https://www.googleapis.com/auth/contacts` (sensible). Cuenta única: la del PO (`miamidjbeat@gmail.com`). Pantalla de consentimiento: si el proyecto de Google Cloud está en modo «Testing», el refresh token **caduca a los 7 días**; hay que verificar en qué modo está el cliente OAuth actual antes de construir (decisión técnica #1).
2. **Edge Functions**: `contacts-oauth-init` / `contacts-oauth-callback` (copia del patrón de Calendar, tabla de integración aparte, solo owner) y `contacts-push-network` (el motor de envío). No se reutiliza el scope de Calendar: son permisos distintos.
3. **Tabla `network_google_map`**: `contacto_id`, `fuente`, `google_resource_name`, `google_etag`, `hash_ultimo_envio`, `enviado_en`, `estado` (ok/conflicto/error), `error`. Es lo que evita duplicados y permite saber qué cambió.
4. **Tabla `network_google_outbox`** (cola): un disparador en `network_referencia_contactos` y `network_list_members` anota «este contacto cambió». Un cron cada 5-10 min procesa por lotes (`batchCreateContacts` / `batchUpdateContacts`, hasta 200 por llamada, respetando la cuota de escritura de la People API). Un fallo no bloquea el guardado en Network (igual que `calendar-push-important-date`: es un plus, nunca bloquea).

## 5. Primera carga (lo más delicado: no duplicar los 150 contactos que ya tiene en Google)

1. **Ensayo en seco (solo lectura)**: leer los contactos actuales de Google y cruzarlos con el Network por teléfono normalizado (E.164) y correo. Entregar al PO un informe: «se enlazan N, se crean M, dudosos K». **No se escribe nada hasta que el PO lo apruebe.**
2. Los que coinciden se **adoptan** (se guarda su `resource_name` y se les agrega `MDJB_ID` + etiquetas); no se crean copias. Los dudosos (mismo nombre, otro teléfono) van a revisión manual, no se fusionan solos.
3. Solo entonces se crean los que no existen, en lotes, con la marca `MDJB_ID`.
4. Se envía primero un **piloto de 10 fichas** que el PO revisa en su teléfono antes del resto.

## 6. Reglas de comportamiento (decisiones ya recomendadas)

- **Network gana**. Cada envío compara el `etag`: si el contacto cambió en Google desde el último envío, **no se pisa en silencio**: queda en estado `conflicto` y se muestra al PO («en Google dice X, en Network dice Y; ¿cuál?»). Opción de política: «Network siempre gana» activable por el PO.
- **Nunca se borra un contacto en Google.** Si se borra o se vuelve «ya no trabaja» en Network, solo cambian las etiquetas (se quita la de su categoría y se pone `MDJB · Ya no trabaja`). Borrar de verdad = acción manual del PO.
- **Cuentas con datos propios** (clientes y DJs con cuenta, `fuente = client|dj`): **fase 1 solo fichas de referencia (contactos sin cuenta)**. Mandar los datos de clientes y artistas a una cuenta personal de Google toca privacidad y la Política de Privacidad (`web/PRIVACY_POLICY.md` menciona Google solo para calendario); queda como decisión del PO.
- **Fichas sensibles** (ej. la contadora personal, Sirley): se excluyen por defecto con una etiqueta interna «No enviar a Google»; el PO decide cuáles.

## 7. Riesgo a resolver antes: bucle de cumpleaños

Los cumpleaños que se escriben en Google Contacts aparecen en el **calendario de cumpleaños de Google**, y `calendar-reconcile` ya lee ese calendario y los guarda en `elixis_agenda_eventos` como tipo `cumpleanos`. Ya hubo 21 copias idénticas de un cumpleaños (corregido el 2026-10-05 con índice único y limpieza). Enviar `birth_date` a Google generaría cumpleaños nuevos en la agenda, y duplicados contra el que el Network ya aporta (`staff_contacto_de_cumpleanos`). Opciones: (a) fase 1 **sin** cumpleaños, solo teléfono/empresa/etiquetas (recomendada); (b) incluirlos y probar primero que el índice único `(user_id, external_event_id)` y la deduplicación por texto/fecha absorben los nuevos.

## 8. Fases propuestas

| Fase | Contenido | Escribe en Google |
|---|---|---|
| 0 | Verificar modo del cliente OAuth (Testing/Producción) y cuota; decisiones del PO de la sección 9 | No |
| 1 | OAuth de Contacts + ensayo en seco con informe | No (solo lectura) |
| 2 | Piloto de 10 fichas → carga completa de referencia (sin cumpleaños ni foto) | Sí, tras aprobación |
| 3 | Cola automática (disparadores + cron) para cambios futuros | Sí |
| 4 | Cumpleaños, aniversario, foto | Sí |
| 5 (opcional) | Leer cambios desde Google (`syncToken`) y proponerlos en una cola de revisión en Network | No (solo propone) |

## 9. Decisiones que necesita del PO

1. ¿Autoriza dar permiso de **Contacts** a la app en `miamidjbeat@gmail.com`?
2. ¿Solo fichas de referencia (recomendado) o también clientes/DJs con cuenta?
3. ¿Network gana siempre, o conflictos a revisión (recomendado)?
4. ¿Cumpleaños en fase 1 o después (recomendado: después)?
5. Qué fichas no se envían (contadora, otras personales).
6. ¿Prefijo de etiquetas `MDJB · ` aceptable, o prefiere otro nombre?

## 10. Qué NO hace este diseño

- No sincroniza la hoja de Sheets «Banco de Contactos» (si también debe quedar al día, es otro destino con la API de Sheets; mismo patrón de cola).
- No toca Outlook/iPhone.
- No cambia ELIXIS (`consultar_red_contactos`): leer listas desde ELIXIS es un ticket aparte que necesita orden y despliegue.
