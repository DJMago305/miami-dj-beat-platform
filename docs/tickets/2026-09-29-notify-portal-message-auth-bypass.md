# notify-portal-message: verificación de service_role sin firma (bypass real)

**Origen:** encontrado el 2026-09-29 mientras se investigaba si era seguro rotar la
`service_role` key legacy expuesta (`docs/tickets/2026-09-29-rotar-service-role-key-expuesta.md`).
Al revisar el único webhook de base de datos con una clave legacy pegada en su
definición (`on_portal_message_insert` → `notify-portal-message`), se encontró
que esa función acepta el token sin comprobar su firma.

## Qué es

`supabase/functions/notify-portal-message/index.ts`, función `authorizeRequest()`
(línea ~526):

```ts
function bearerIsServiceRole(token: string): boolean {
    const payload = decodeJwtPayload(token);
    return payload?.role === "service_role";
}
```

Esta función solo decodifica el PAYLOAD del JWT (base64, sin verificar la firma
criptográfica) y revisa si el campo `role` dice `"service_role"`. Se usa como uno
de los caminos de autorización en `authorizeRequest()`:

```ts
if (bearer && bearerIsServiceRole(bearer)) {
    return true;
}
```

## El hueco real

Cualquiera puede fabricar un string con forma de JWT (header.payload.firma) con
`{"role":"service_role"}` en el payload, usando una firma inventada o vacía —
`decodeJwtPayload` no verifica que la firma sea válida, así que `bearerIsServiceRole`
devuelve `true` igual. Eso deja pasar la petición a `notify-portal-message` sin
credencial real de ningún tipo.

**Impacto**: la función envía correo transaccional real (Resend) cuando se
inserta un mensaje en `portal_messages` — con este bypass, alguien podría
invocarla directamente y potencialmente disparar el envío de correos sin pasar
por una fila real verificada, dependiendo de qué tanto del resto del cuerpo de
la función confía en el payload recibido sin re-validarlo contra la tabla real
(no confirmado a fondo todavía — pendiente de auditar el resto del flujo tras
`authorizeRequest()`).

## Por qué no bloqueó la rotación de la clave

Verificado que esto NO es un problema causado por rotar la `service_role` key
legacy — de hecho es lo opuesto: como `bearerIsServiceRole` nunca verifica la
firma, seguirá "funcionando" (aceptando el token viejo pegado en el trigger)
incluso después de revocar la clave que lo firmó. Es un hallazgo aparte,
independiente de esa rotación.

## Otros lugares verificados, sin el mismo problema

- Los 6 cron jobs reales (`dispatch_contract_reminders_cron`,
  `dispatch_yearly_recall_cron`, `renew_google_calendar_channels_cron`,
  `notify_yearly_recall_cron`, `reconcile_google_calendar_cron`,
  `mdj_avisos_despachar_cron`) usan `vault.decrypted_secrets` (secreto propio
  `cron_edge_auth_secret_reminders`), no una clave de Supabase — sin riesgo.
- `on_portal_message_insert` es el ÚNICO trigger de base de datos con un JWT
  pegado en texto plano (confirmado con `information_schema.triggers`,
  filtrando por `Bearer`/`http_request`).

## Arreglo propuesto (no aplicado todavía)

`authorizeRequest()` ya tiene caminos de autorización más seguros que no
necesitan este atajo: comparación exacta contra `getServiceRoleKey()` (línea
~541) y el secreto de webhook `x-webhook-secret`/`WEBHOOK_SECRET` (línea
~551). La opción más simple es **eliminar por completo la función
`bearerIsServiceRole` y su uso** — no aporta nada que los otros dos caminos no
cubran ya de forma segura. Si de verdad hace falta aceptar un JWT firmado por
Supabase (no solo con forma de JWT), habría que usar `sb.auth.getUser(bearer)`
o similar para validar la firma de verdad, no decodificar a mano.

## Fuera de alcance de este ticket

- No se toca la clave `service_role` ni su rotación — eso es el ticket aparte
  ya en curso.
- No se audita el resto del flujo de `notify-portal-message` más allá de
  `authorizeRequest()` — si hace falta, es una auditoría aparte.
