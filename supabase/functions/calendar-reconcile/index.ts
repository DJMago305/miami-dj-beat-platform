// supabase/functions/calendar-reconcile/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Conciliación periódica Google → Miami DJ Beat. Google es la fuente de verdad:
// nuestro calendario es su espejo. El webhook (calendar-sync-webhook) solo avisa
// altas/cambios del calendario principal y NUNCA propaga eliminaciones (sin
// syncToken, events.list no devuelve los borrados), y el calendario de cumpleaños
// de contactos no tiene canal push. Esta función cierra esos dos huecos.
//
// Por cada integración de Google activa (usuario x calendario):
//   1. Trae TODOS los eventos de la ventana [ayer, +1 año] con showDeleted=true,
//      con paginación. Si CUALQUIER página falla, no toca nada de esa integración.
//   2. Inserta/actualiza/cancela igual que el webhook.
//   3. Las filas locales activas de esa ventana (mismo tipo/calendario) que Google
//      ya no devuelve se marcan 'cancelado' (baja suave). Guardia: si eso cancelaría
//      más de 5 filas y más de la mitad, se omite y se reporta (evita un accidente).
//
// Disparador: pg_cron con CRON_EDGE_AUTH_SECRET (mismo patrón que calendar-channel-renew).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL_FALLBACK = "https://hkuvuqupbxwkiykxvqdr.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || SUPABASE_URL_FALLBACK).replace(/\/$/, "");
const ADMIN = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const BIRTHDAYS_CALENDAR_ID = "addressbook#contacts@group.v.calendar.google.com";

async function refrescarAccessToken(refreshToken: string): Promise<string | null> {
    const CLIENT_ID = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID") ?? "";
    const CLIENT_SECRET = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET") ?? "";
    if (!CLIENT_ID || !CLIENT_SECRET || !refreshToken) return null;
    try {
        const r = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refreshToken, grant_type: "refresh_token" }).toString(),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.access_token) { console.error("[calendar-reconcile] refresh_token fallo:", r.status); return null; }
        return String(d.access_token);
    } catch (e) { console.error("[calendar-reconcile] refresh_token red:", e); return null; }
}

type EventoGoogle = { id: string; status?: string; summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } };

/** events.list completo con paginación. null = falló alguna página (no se concilia nada). */
async function listarTodo(accessToken: string, calendarId: string, desde: Date, hasta: Date): Promise<EventoGoogle[] | null> {
    const out: EventoGoogle[] = [];
    let pageToken = "";
    for (let pagina = 0; pagina < 20; pagina++) {
        const u = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
        u.searchParams.set("singleEvents", "true");
        u.searchParams.set("showDeleted", "true");
        u.searchParams.set("maxResults", "250");
        u.searchParams.set("timeMin", desde.toISOString());
        u.searchParams.set("timeMax", hasta.toISOString());
        if (pageToken) u.searchParams.set("pageToken", pageToken);
        const r = await fetch(u.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!r.ok) { console.error(`[calendar-reconcile] events.list ${calendarId} página ${pagina}:`, r.status); return null; }
        const d = await r.json();
        if (Array.isArray(d.items)) out.push(...d.items);
        if (!d.nextPageToken) return out;
        pageToken = d.nextPageToken;
    }
    console.error("[calendar-reconcile] demasiadas páginas, se aborta:", calendarId);
    return null;
}

serve(async (req: Request) => {
    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const cronSecret = Deno.env.get("CRON_EDGE_AUTH_SECRET") ?? "";
    if (!cronSecret || jwt !== cronSecret) {
        return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    const { data: filas, error } = await ADMIN
        .from("user_calendar_integrations")
        .select("user_id, calendar_id, refresh_token")
        .eq("provider", "google").eq("status", "active");
    if (error) return new Response(JSON.stringify({ error: "lookup_failed" }), { status: 500, headers: { "Content-Type": "application/json" } });

    const desde = new Date(Date.now() - 24 * 3600 * 1000);
    const hasta = new Date(desde); hasta.setFullYear(hasta.getFullYear() + 1);
    const resultados: Record<string, unknown> = {};

    for (const fila of filas ?? []) {
        const uid = String(fila.user_id);
        const calendarId = String(fila.calendar_id || "primary");
        const clave = `${uid}:${calendarId}`;
        const tipo = calendarId === BIRTHDAYS_CALENDAR_ID ? "cumpleanos" : "nota";
        try {
            const token = await refrescarAccessToken(String(fila.refresh_token ?? ""));
            if (!token) { resultados[clave] = "token_invalido"; continue; }
            const eventos = await listarTodo(token, calendarId, desde, hasta);
            if (!eventos) { resultados[clave] = "lectura_incompleta_sin_cambios"; continue; }

            // Nombre para nuevas filas (misma resolución que el sync).
            const { data: dj } = await ADMIN.from("dj_profiles").select("stage_name, dj_name, full_name").eq("user_id", uid).maybeSingle();
            let nombre = String(dj?.stage_name || dj?.dj_name || dj?.full_name || "").trim();
            if (!nombre) {
                const { data: cl } = await ADMIN.from("client_profiles").select("full_name").eq("user_id", uid).maybeSingle();
                nombre = String(cl?.full_name || "").trim();
            }

            const idsGoogleVivos = new Set<string>();
            let insertados = 0, actualizados = 0, cancelados = 0;
            for (const ev of eventos) {
                if (!ev.id) continue;
                if (ev.status === "cancelled") {
                    const { data: c } = await ADMIN.from("elixis_agenda_eventos")
                        .update({ estado: "cancelado", updated_at: new Date().toISOString() })
                        .eq("external_event_id", ev.id).eq("user_id", uid).eq("estado", "activo").select("id");
                    cancelados += (c?.length ?? 0);
                    continue;
                }
                const inicio = ev.start?.dateTime || ev.start?.date;
                const fin = ev.end?.dateTime || ev.end?.date;
                if (!inicio || !fin) continue;
                idsGoogleVivos.add(ev.id);
                const { data: existente } = await ADMIN.from("elixis_agenda_eventos").select("id, estado").eq("external_event_id", ev.id).eq("user_id", uid).maybeSingle();
                if (existente) {
                    // Una fila que el usuario quitó a mano (cancelado) NO se revive.
                    if (existente.estado === "activo") {
                        await ADMIN.from("elixis_agenda_eventos").update({
                            fecha_inicio: new Date(inicio).toISOString(), fecha_fin: new Date(fin).toISOString(),
                            notas: ev.summary || null, updated_at: new Date().toISOString(),
                        }).eq("id", existente.id);
                        actualizados++;
                    }
                } else if (nombre) {
                    await ADMIN.from("elixis_agenda_eventos").insert({
                        user_id: uid, dj_nombre: nombre, fecha_inicio: new Date(inicio).toISOString(), fecha_fin: new Date(fin).toISOString(),
                        tipo, estado: "activo", notas: ev.summary || null, agent_id: "calendar-sync", external_event_id: ev.id,
                    });
                    insertados++;
                }
            }

            // Filas locales activas de esta ventana/calendario que Google ya no devuelve.
            const { data: locales } = await ADMIN.from("elixis_agenda_eventos")
                .select("id, external_event_id")
                .eq("user_id", uid).eq("agent_id", "calendar-sync").eq("tipo", tipo).eq("estado", "activo")
                .gte("fecha_inicio", desde.toISOString()).lte("fecha_inicio", hasta.toISOString());
            const huerfanas = (locales ?? []).filter((l) => l.external_event_id && !idsGoogleVivos.has(String(l.external_event_id)));
            let guardia = false;
            if (huerfanas.length > 5 && huerfanas.length > (locales?.length ?? 0) / 2) {
                guardia = true;
                console.error(`[calendar-reconcile] GUARDIA ${clave}: ${huerfanas.length}/${locales?.length} filas se cancelarían; se omite`);
            } else if (huerfanas.length) {
                await ADMIN.from("elixis_agenda_eventos").update({ estado: "cancelado", updated_at: new Date().toISOString() })
                    .in("id", huerfanas.map((h) => h.id));
                cancelados += huerfanas.length;
            }
            await ADMIN.from("user_calendar_integrations").update({ last_synced_at: new Date().toISOString() })
                .eq("user_id", uid).eq("provider", "google").eq("calendar_id", calendarId);
            resultados[clave] = { insertados, actualizados, cancelados, guardia };
        } catch (e) {
            console.error(`[calendar-reconcile] error ${clave}:`, e);
            resultados[clave] = "error";
        }
    }
    return new Response(JSON.stringify({ ok: true, resultados }), { status: 200, headers: { "Content-Type": "application/json" } });
});
