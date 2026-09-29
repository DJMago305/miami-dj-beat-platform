# Rotar la service_role key expuesta el 2026-09-28

**Origen:** incidente de seguridad documentado en `docs/ESTADO_MAESTRO.md` (entrada "2026-09-28 · Incidente de seguridad — clave expuesta") — la clave legacy `service_role` (formato JWT) quedó expuesta en texto plano en una captura de pantalla compartida en el chat. Se intentó desactivar, casi rompe 58 Edge Functions que dependían de ella, se revirtió a tiempo ("Re-enable JWT-based API keys"). **La clave sigue técnicamente comprometida — nunca se rotó de verdad, solo se reactivó.**

**Pedido por el PO (2026-09-29):** "ábrelo como tarea aparte" — no cerrar esto en la sesión de las páginas de categoría, tratarlo por separado.

## Corrección real sobre lo que decía ESTADO_MAESTRO (verificado hoy, no repetido de memoria)

`ESTADO_MAESTRO.md` decía "pendiente real, sin fecha todavía: migrar las 58 Edge Functions a `SUPABASE_SECRET_KEYS`". **Eso ya no es exacto** — al revisar el código real:

- Existe `supabase/functions/_shared/service-key.ts` (creado el mismo 2026-09-28, después del incidente): `getServiceRoleKey()` prefiere `SUPABASE_SECRET_KEYS` (sistema nuevo) y cae a `SUPABASE_SERVICE_ROLE_KEY` (legacy) solo si el nuevo no existe.
- **56 de las Edge Functions ya importan y usan ese helper compartido** — confirmado con `grep` real sobre `supabase/functions/*/index.ts`, no supuesto.
- **Cero funciones leen la env var legacy directo** sin pasar por el helper (`grep` real, 0 resultados).
- La única función que crea un cliente de Supabase sin el helper (`mdjpro-install-handoff`) usa la clave `anon`, no `service_role` — no le aplica esta migración.

**Conclusión: el lado del código YA está migrado.** Lo que falta no es tocar 56 archivos, es mucho más chico.

## Lo único que falta, en orden

1. **Confirmar si `SUPABASE_SECRET_KEYS` ya existe como secreto real configurado** en el proyecto (`hkuvuqupbxwkiykxvqdr`) — esto NO se puede verificar por API/MCP (los secretos no son legibles, solo escribibles, por seguridad). El PO lo confirma con:
   ```bash
   supabase secrets list --project-ref hkuvuqupbxwkiykxvqdr
   ```
   o desde el Dashboard → Edge Functions → Secrets.
2. **Si NO existe todavía**: generar una clave nueva del sistema nuevo (Dashboard → Settings → API Keys → "Secret keys" → crear una), y configurarla como el secreto `SUPABASE_SECRET_KEYS` (formato JSON `{"default": "sb_secret_..."}`, según el propio comentario de `service-key.ts`) para las Edge Functions.
3. **Verificar que el camino nuevo funciona de verdad** antes de tocar la clave vieja — por ejemplo, invocando una función de bajo riesgo (`mdj-heartbeat`) y confirmando en los logs que respondió normal.
4. **Recién entonces, rotar/regenerar la clave `service_role` legacy comprometida** desde el Dashboard (esto SÍ invalida la clave expuesta de una vez, sin el riesgo de la vez pasada porque el fallback en `service-key.ts` deja de necesitarla).
5. Confirmar después de rotar: correr el mismo tipo de verificación de logs que se hizo el 28 (`function_edge_logs` sin 401/500/"invalid api key" en una ventana de 10-15 min) antes de cerrar el ticket.
6. Actualizar `docs/ESTADO_MAESTRO.md` para reflejar que la migración de código ya estaba hecha desde el 28, y cerrar el hilo con la fecha real de rotación.

## Riesgo si no se hace

Mientras la clave vieja siga activa (aunque no se use en el código), sigue siendo una credencial válida y expuesta — cualquiera que la haya visto en esa captura podría usarla directo contra la API de Supabase (bypass total de RLS) sin pasar por ninguna Edge Function. El código ya no depende de ella, pero **ella sigue funcionando** hasta que se rote.

## Fuera de alcance de este ticket

- No se toca ninguna Edge Function — ya están listas.
- No se desactivan las claves legacy tipo JWT en general (`anon` legacy, etc.) — solo se rota la `service_role` específica que se expuso, una vez migrado el paso 2.

## CERRADO (2026-09-29) — clave rotada y revocada, verificado sin errores

- Confirmado que `SUPABASE_SECRET_KEYS` ya tenía un secreto real configurado (`sb_secret_T5Y93...`, sección "Secret keys" de API Keys) — el código ya lo prefería desde el 28 de septiembre.
- **Hallazgo adicional durante la verificación**: 8 Edge Functions dependían de `SUPABASE_ANON_KEY` legacy sin respaldo a `SUPABASE_PUBLISHABLE_KEY` — mismo riesgo del lado `anon` que casi rompió la trastienda el 28. Corregido y desplegado (PR #596) — con un tropiezo real en el camino: el primer redeploy se hizo antes de fusionar el PR, así que subió el código viejo sin el arreglo; corregido con un segundo redeploy después de fusionar y confirmar el código real en disco.
- Auditoría de Database Webhooks y cron jobs antes de revocar: solo `on_portal_message_insert` tenía una clave legacy pegada en su definición — confirmado que no se rompe (la función `notify-portal-message` no verifica la firma del JWT, solo decodifica el payload — hallazgo de seguridad aparte, ver `docs/tickets/2026-09-29-notify-portal-message-auth-bypass.md`). Los 6 cron jobs reales usan su propio secreto en Vault, sin relación con la clave legacy.
- Rotación real ejecutada por el PO en el Dashboard de Supabase (JWT Keys → Legacy JWT Secret → Revoke), guiado paso a paso desde esta sesión, con capturas verificadas en cada paso antes de confirmar acciones irreversibles. Confirmado con `query_logs`: 0 errores 401 nuevos después de deshabilitar las claves legacy y después de revocar el secreto HS256.
- La clave `service_role` expuesta el 2026-09-28 ya no es válida — el secreto que la firmaba quedó revocado.
