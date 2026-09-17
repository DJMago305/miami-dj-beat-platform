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
// 2026-09-17: hay hasta 2 filas por usuario (calendar_id "primary" y el de
// cumpleaños) -- se renueva cada fila por separado, cada una con su propio
// channel_id/channel_expires_at. Lógica de events.watch/channels.stop movida
// a _shared/google-calendar-sync.ts, reusada también por calendar-oauth-
// callback y calendar-sync-webhook.
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cerrarCanalWatch, crearCanalWatch, refrescarAccessToken } from "../_shared/google-calendar-sync.ts";

const SUPABASE_URL_FALLBACK = "https://hkuvuqupbxwkiykxvqdr.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || SUPABASE_URL_FALLBACK).replace(/\/$/, "");
const ADMIN = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// Los canales de Calendar duran ~7 dias; se renuevan con margen para no
// depender de que el cron corra justo a tiempo el ultimo dia.
const RENEW_WINDOW_HOURS = 24;

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
        .select("user_id, calendar_id, access_token, refresh_token, channel_id, channel_resource_id")
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
        const calendarId = String(fila.calendar_id || "primary");
        const clave = `${uid}:${calendarId}`;
        try {
            // El access_token guardado dura ~1h; si el canal vive dias, ya
            // esta vencido -- se refresca siempre aqui en vez de intentar
            // primero con el viejo y esperar un 401.
            const accessToken = await refrescarAccessToken(String(fila.refresh_token ?? ""));
            if (!accessToken) {
                await ADMIN.from("user_calendar_integrations")
                    .update({ status: "expired" })
                    .eq("user_id", uid).eq("provider", "google").eq("calendar_id", calendarId);
                resultados[clave] = "refresh_token_invalido";
                continue;
            }
            await ADMIN.from("user_calendar_integrations")
                .update({ access_token: accessToken })
                .eq("user_id", uid).eq("provider", "google").eq("calendar_id", calendarId);

            const webhookUrl = `${SUPABASE_URL}/functions/v1/calendar-sync-webhook`;
            const canal = await crearCanalWatch(accessToken, calendarId, webhookUrl);
            if (!canal) {
                resultados[clave] = "watch_failed";
                continue;
            }

            await ADMIN
                .from("user_calendar_integrations")
                .update({
                    channel_id: canal.channelId,
                    channel_resource_id: canal.resourceId,
                    channel_expires_at: canal.expiresAt,
                })
                .eq("user_id", uid)
                .eq("provider", "google")
                .eq("calendar_id", calendarId);

            // Cierra el canal viejo -- limpieza de buena fe, no bloqueante.
            if (fila.channel_id && fila.channel_resource_id) {
                await cerrarCanalWatch(accessToken, String(fila.channel_id), String(fila.channel_resource_id));
            }

            resultados[clave] = "renovado";
        } catch (e) {
            console.error(`[calendar-channel-renew] error ${clave}:`, e);
            resultados[clave] = "error";
        }
    }

    return new Response(JSON.stringify({ ok: true, procesados: Object.keys(resultados).length, resultados }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
});
