// supabase/functions/calendar-sync-webhook/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Fase 2, pieza 3/3: recibe las notificaciones push de Google Calendar y
// actualiza/borra filas en elixis_agenda_eventos vía external_event_id.
//
// CONTRATO REAL, verificado contra la doc oficial vigente de Google
// (developers.google.com/calendar/api/guides/push) antes de escribir esto:
//   - El body de la peticion viene SIEMPRE VACIO. Todo viaja en headers:
//     X-Goog-Channel-ID, X-Goog-Resource-ID, X-Goog-Resource-State
//     (sync | exists | not_exists), X-Goog-Channel-Token, X-Goog-Channel-Expiration.
//   - La notificacion NO trae que cambio -- solo avisa "algo cambio". Hay que
//     llamar events.list?syncToken=... para saber que fue.
//   - No existe forma de "renovar" un canal, hay que crear uno nuevo antes de
//     que expire. El canal se crea en calendar-oauth-callback, justo despues
//     de conectar (events.watch); calendar-channel-renew (2026-09-17) lo
//     renueva automaticamente antes del vencimiento via pg_cron.
//
// 2026-09-17: ahora hay hasta 2 filas de integracion por usuario (calendar_id
// "primary" y el de cumpleaños) -- el channel_id ya identifica de cual
// calendario vino el aviso, y ese calendar_id decide el tipo que se guarda
// en elixis_agenda_eventos (cumpleanos vs nota). Logica de events.list/
// events.watch/procesar movida a _shared/google-calendar-sync.ts, reusada
// tambien por calendar-oauth-callback y calendar-channel-renew.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BIRTHDAYS_CALENDAR_ID, listarEventosGoogle, procesarEventosGoogle, refrescarAccessToken } from "../_shared/google-calendar-sync.ts";

const SUPABASE_URL_FALLBACK = "https://hkuvuqupbxwkiykxvqdr.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ADMIN = createClient(
    Deno.env.get("SUPABASE_URL") || SUPABASE_URL_FALLBACK,
    SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
);

serve(async (req: Request) => {
    if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });

    // Confirmacion de que el canal quedo activo -- Google la manda una sola
    // vez, al crear la suscripcion. No hay nada que sincronizar todavia.
    const resourceState = req.headers.get("X-Goog-Resource-State") ?? "";
    if (resourceState === "sync") {
        return new Response("ok", { status: 200 });
    }

    const channelId = req.headers.get("X-Goog-Channel-ID") ?? "";
    if (!channelId) return new Response("missing_channel_id", { status: 400 });

    // channel_id nos dice A QUE integracion (usuario + calendario) pertenece
    // esta notificacion -- el body viene vacio, no hay otra forma de saberlo.
    const { data: integracion, error: e1 } = await ADMIN
        .from("user_calendar_integrations")
        .select("user_id, calendar_id, access_token, refresh_token, sync_token, status")
        .eq("channel_id", channelId)
        .eq("provider", "google")
        .maybeSingle();
    if (e1) {
        console.error("[calendar-sync-webhook] lookup error:", e1.message);
        return new Response("lookup_error", { status: 500 });
    }
    if (!integracion || integracion.status !== "active") {
        // Canal huerfano (revocado/expirado de nuestro lado) -- Google seguira
        // reintentando si devolvemos error; 200 le dice que ya no siga.
        console.warn(`[calendar-sync-webhook] canal sin integracion activa: ${channelId}`);
        return new Response("ok", { status: 200 });
    }

    const userId = String(integracion.user_id);
    const calendarId = String(integracion.calendar_id || "primary");
    const tipoDefault: "cumpleanos" | "nota" = calendarId === BIRTHDAYS_CALENDAR_ID ? "cumpleanos" : "nota";

    let accessToken = String(integracion.access_token ?? "");
    const syncToken = String(integracion.sync_token ?? "");

    let resultado = await listarEventosGoogle(accessToken, calendarId, syncToken);
    if (!resultado.ok && resultado.status === 401) {
        // access_token vencido -- se refresca UNA vez con el refresh_token guardado.
        const nuevo = await refrescarAccessToken(String(integracion.refresh_token ?? ""));
        if (!nuevo) {
            await ADMIN.from("user_calendar_integrations").update({ status: "expired" }).eq("channel_id", channelId);
            return new Response("token_expired", { status: 200 });
        }
        accessToken = nuevo;
        await ADMIN.from("user_calendar_integrations").update({ access_token: accessToken }).eq("channel_id", channelId);
        resultado = await listarEventosGoogle(accessToken, calendarId, syncToken);
    }
    if (!resultado.ok) {
        console.error("[calendar-sync-webhook] events.list fallo:", resultado.status);
        return new Response("events_list_failed", { status: 200 }); // 200: no queremos que Google reintente en bucle un fallo persistente
    }

    await procesarEventosGoogle(ADMIN, userId, resultado.eventos, tipoDefault);

    await ADMIN
        .from("user_calendar_integrations")
        .update({
            sync_token: resultado.nextSyncToken ?? syncToken,
            last_synced_at: new Date().toISOString(),
        })
        .eq("channel_id", channelId);

    return new Response("ok", { status: 200 });
});
