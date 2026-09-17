// supabase/functions/calendar-channel-renew/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Renovación automática del canal push de Google Calendar (events.watch).
// Google no deja "renovar" un canal -- hay que crear uno nuevo antes de que
// el viejo expire (documentado como pendiente en el propio calendar-sync-
// webhook al construirse esa pieza). Esta función cierra ese hueco.
//
// Disparador: pg_cron, mismo secreto compartido que ya usan send-reminder-sms
// y notify-dj-sms (Authorization: Bearer $CRON_EDGE_AUTH_SECRET) -- no se
// inventa un secreto nuevo para lo mismo.
//
// Reusa el mismo contrato de events.watch ya verificado en
// calendar-oauth-callback (POST calendars/primary/events/watch, misma forma
// de leer resourceId/expiration de la respuesta).
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL_FALLBACK = "https://hkuvuqupbxwkiykxvqdr.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || SUPABASE_URL_FALLBACK).replace(/\/$/, "");
const ADMIN = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
// Los canales de Calendar duran ~7 dias; se renuevan con margen para no
// depender de que el cron corra justo a tiempo el ultimo dia.
const RENEW_WINDOW_HOURS = 24;

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
            console.error("[calendar-channel-renew] refresh_token fallo:", r.status, JSON.stringify(d).slice(0, 300));
            return null;
        }
        return String(d.access_token);
    } catch (e) {
        console.error("[calendar-channel-renew] refresh_token red:", e);
        return null;
    }
}

serve(async (req: Request) => {
    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const cronSecret = Deno.env.get("CRON_EDGE_AUTH_SECRET") ?? "";
    if (!cronSecret || jwt !== cronSecret) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    const limite = new Date(Date.now() + RENEW_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const { data: porVencer, error } = await ADMIN
        .from("user_calendar_integrations")
        .select("user_id, access_token, refresh_token, channel_id, channel_resource_id")
        .eq("provider", "google")
        .eq("status", "active")
        .lte("channel_expires_at", limite);

    if (error) {
        console.error("[calendar-channel-renew] lookup error:", error.message);
        return new Response(JSON.stringify({ error: "lookup_failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }

    const resultados: Record<string, string> = {};
    for (const fila of porVencer ?? []) {
        const uid = String(fila.user_id);
        try {
            // El access_token guardado dura ~1h; si el canal vive dias, ya
            // esta vencido -- se refresca siempre aqui en vez de intentar
            // primero con el viejo y esperar un 401.
            const accessToken = await refrescarAccessToken(String(fila.refresh_token ?? ""));
            if (!accessToken) {
                await ADMIN.from("user_calendar_integrations")
                    .update({ status: "expired" })
                    .eq("user_id", uid).eq("provider", "google");
                resultados[uid] = "refresh_token_invalido";
                continue;
            }
            await ADMIN.from("user_calendar_integrations")
                .update({ access_token: accessToken })
                .eq("user_id", uid).eq("provider", "google");

            const webhookUrl = `${SUPABASE_URL}/functions/v1/calendar-sync-webhook`;
            const channelIdNuevo = crypto.randomUUID();
            const watchRes = await fetch(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events/watch",
                {
                    method: "POST",
                    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ id: channelIdNuevo, type: "web_hook", address: webhookUrl }),
                },
            );
            const watchBody = await watchRes.json().catch(() => ({}));
            if (!watchRes.ok || !watchBody.resourceId) {
                console.error(`[calendar-channel-renew] events.watch fallo user=${uid}:`, watchRes.status, JSON.stringify(watchBody).slice(0, 300));
                resultados[uid] = "watch_failed";
                continue;
            }

            await ADMIN
                .from("user_calendar_integrations")
                .update({
                    channel_id: channelIdNuevo,
                    channel_resource_id: String(watchBody.resourceId),
                    channel_expires_at: watchBody.expiration ? new Date(Number(watchBody.expiration)).toISOString() : null,
                })
                .eq("user_id", uid)
                .eq("provider", "google");

            // Cierra el canal viejo -- limpieza de buena fe. Si Google ya lo
            // vencio o el stop falla, no bloquea nada: el canal nuevo ya
            // quedo guardado y activo, channels.stop solo evita basura del
            // lado de Google.
            if (fila.channel_id && fila.channel_resource_id) {
                try {
                    await fetch("https://www.googleapis.com/calendar/v3/channels/stop", {
                        method: "POST",
                        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                        body: JSON.stringify({ id: fila.channel_id, resourceId: fila.channel_resource_id }),
                    });
                } catch (eStop) {
                    console.warn(`[calendar-channel-renew] channels.stop fallo (no bloqueante) user=${uid}:`, eStop);
                }
            }

            resultados[uid] = "renovado";
        } catch (e) {
            console.error(`[calendar-channel-renew] error user=${uid}:`, e);
            resultados[uid] = "error";
        }
    }

    return new Response(JSON.stringify({ ok: true, procesados: Object.keys(resultados).length, resultados }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
});
