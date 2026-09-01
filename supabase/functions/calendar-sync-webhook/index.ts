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
//     de conectar (events.watch) -- AUN NO EXISTE ninguna renovacion antes
//     del vencimiento (channel_expires_at, columna nueva de esta misma fase):
//     cuando venza, este webhook simplemente deja de recibir trafico hasta
//     que el DJ reconecte a mano. Renovacion automatica queda para una fase
//     futura, anotada aqui para no perderla.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL_FALLBACK = "https://hkuvuqupbxwkiykxvqdr.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ADMIN = createClient(
    Deno.env.get("SUPABASE_URL") || SUPABASE_URL_FALLBACK,
    SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
);

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

async function refrescarAccessToken(refreshToken: string): Promise<string | null> {
    const CLIENT_ID = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID") ?? "";
    const CLIENT_SECRET = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET") ?? "";
    if (!CLIENT_ID || !CLIENT_SECRET || !refreshToken) return null;
    try {
        const r = await fetch(GOOGLE_TOKEN_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: "refresh_token",
            }).toString(),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.access_token) {
            console.error("[calendar-sync-webhook] refresh_token fallo:", r.status, JSON.stringify(d).slice(0, 300));
            return null;
        }
        return String(d.access_token);
    } catch (e) {
        console.error("[calendar-sync-webhook] refresh_token red:", e);
        return null;
    }
}

type EventoGoogle = {
    id: string;
    status?: string;
    summary?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
};

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

    // channel_id nos dice A QUE integracion pertenece esta notificacion --
    // el body viene vacio, no hay otra forma de saberlo (ver cabecera).
    const { data: integracion, error: e1 } = await ADMIN
        .from("user_calendar_integrations")
        .select("user_id, access_token, refresh_token, sync_token, status")
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

    let accessToken = String(integracion.access_token ?? "");
    let syncToken = String(integracion.sync_token ?? "");

    async function listarCambios(token: string): Promise<{ ok: true; eventos: EventoGoogle[]; nextSyncToken: string | null } | { ok: false; status: number }> {
        const u = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
        if (syncToken) u.searchParams.set("syncToken", syncToken);
        else u.searchParams.set("timeMin", new Date().toISOString());
        const r = await fetch(u.toString(), { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) return { ok: false, status: r.status };
        const d = await r.json();
        return { ok: true, eventos: Array.isArray(d.items) ? d.items : [], nextSyncToken: d.nextSyncToken ?? null };
    }

    let resultado = await listarCambios(accessToken);
    if (!resultado.ok && resultado.status === 401) {
        // access_token vencido -- se refresca UNA vez con el refresh_token guardado.
        const nuevo = await refrescarAccessToken(String(integracion.refresh_token ?? ""));
        if (!nuevo) {
            await ADMIN.from("user_calendar_integrations").update({ status: "expired" }).eq("channel_id", channelId);
            return new Response("token_expired", { status: 200 });
        }
        accessToken = nuevo;
        await ADMIN.from("user_calendar_integrations").update({ access_token: accessToken }).eq("channel_id", channelId);
        resultado = await listarCambios(accessToken);
    }
    if (!resultado.ok) {
        console.error("[calendar-sync-webhook] events.list fallo:", resultado.status);
        return new Response("events_list_failed", { status: 200 }); // 200: no queremos que Google reintente en bucle un fallo persistente
    }

    // dj_nombre es NOT NULL en elixis_agenda_eventos (1-200 caracteres) --
    // se resuelve una sola vez antes del loop, no por evento.
    const { data: djProf } = await ADMIN
        .from("dj_profiles")
        .select("stage_name, dj_name, full_name")
        .eq("user_id", integracion.user_id)
        .maybeSingle();
    const djNombre = String(djProf?.stage_name || djProf?.dj_name || djProf?.full_name || "").trim();
    if (!djNombre) {
        console.error(`[calendar-sync-webhook] sin dj_profiles.stage_name/dj_name/full_name para user_id=${integracion.user_id}, se omiten inserciones nuevas`);
    }

    for (const ev of resultado.eventos) {
        if (!ev.id) continue;
        if (ev.status === "cancelled") {
            // Cancelacion externa: el propio UPDATE dispara log_agenda_changes()
            // (fase anterior, ya en produccion) y deja constancia sola en
            // company_incident_log -- no hace falta duplicar esa logica aqui.
            await ADMIN
                .from("elixis_agenda_eventos")
                .update({ estado: "cancelado", updated_at: new Date().toISOString() })
                .eq("external_event_id", ev.id)
                .eq("user_id", integracion.user_id);
            continue;
        }
        const inicio = ev.start?.dateTime || ev.start?.date;
        const fin = ev.end?.dateTime || ev.end?.date;
        if (!inicio || !fin) continue;

        const { data: existente } = await ADMIN
            .from("elixis_agenda_eventos")
            .select("id")
            .eq("external_event_id", ev.id)
            .eq("user_id", integracion.user_id)
            .maybeSingle();

        if (existente) {
            await ADMIN
                .from("elixis_agenda_eventos")
                .update({
                    fecha_inicio: new Date(inicio).toISOString(),
                    fecha_fin: new Date(fin).toISOString(),
                    notas: ev.summary || null,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", existente.id);
        } else if (djNombre) {
            // Evento nuevo creado del lado de Google. tipo='nota' -- la
            // taxonomia (residencia/boda/privado/cumpleanos/nota) no tiene
            // todavia una categoria "externo"; se deja anotado, no se agrega
            // sola sin que el PO la pida.
            await ADMIN.from("elixis_agenda_eventos").insert({
                user_id: integracion.user_id,
                dj_nombre: djNombre,
                fecha_inicio: new Date(inicio).toISOString(),
                fecha_fin: new Date(fin).toISOString(),
                tipo: "nota",
                estado: "activo",
                notas: ev.summary || null,
                agent_id: "calendar-sync",
                external_event_id: ev.id,
            });
        }
    }

    await ADMIN
        .from("user_calendar_integrations")
        .update({
            sync_token: resultado.nextSyncToken ?? syncToken,
            last_synced_at: new Date().toISOString(),
        })
        .eq("channel_id", channelId);

    return new Response("ok", { status: 200 });
});
