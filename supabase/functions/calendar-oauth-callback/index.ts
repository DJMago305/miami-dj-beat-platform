// supabase/functions/calendar-oauth-callback/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Fase 2, pieza 2/3: Google redirige aqui al navegador del DJ despues de que
// aprueba el consentimiento (?code=&state=), o con ?error= si lo rechaza.
// Es un GET del navegador, SIN el JWT de la sesion de la app -- por eso
// `state` (ver calendar-oauth-init) lleva el user_id firmado con HMAC en vez
// de depender de una sesion viva.
//
// Verificado contra la doc oficial vigente de Google (token exchange):
// POST https://oauth2.googleapis.com/token con code/client_id/client_secret/
// redirect_uri/grant_type=authorization_code -> {access_token, refresh_token,
// expires_in, token_type, scope}. redirect_uri aqui tiene que ser EXACTAMENTE
// igual a la que se mando en calendar-oauth-init (Google lo exige).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL_FALLBACK = "https://hkuvuqupbxwkiykxvqdr.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || SUPABASE_URL_FALLBACK).replace(/\/$/, "");
const ADMIN = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const SITE_URL = (Deno.env.get("SITE_URL") || "https://miamidjbeat.com").replace(/\/$/, "");
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

function base64urlDecode(s: string): Uint8Array {
    const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}
function base64url(bytes: Uint8Array): string {
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function hmacSign(payload: string, secret: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    return base64url(new Uint8Array(sig));
}

/** Verifica la firma y la expiracion de `state`. Devuelve {uid, provider} o
 *  null si esta forjado, corrupto o vencido -- nunca confia en el contenido
 *  sin antes recalcular la firma con el MISMO secreto que lo emitio. */
async function verificarState(state: string, secret: string): Promise<{ uid: string; provider: string } | null> {
    const partes = state.split(".");
    if (partes.length !== 2) return null;
    const [payloadB64, sig] = partes;
    const sigEsperada = await hmacSign(payloadB64, secret);
    if (sig !== sigEsperada) return null;
    try {
        const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64)));
        if (typeof payload?.exp !== "number" || Date.now() > payload.exp) return null;
        if (typeof payload?.uid !== "string" || typeof payload?.p !== "string") return null;
        return { uid: payload.uid, provider: payload.p };
    } catch {
        return null;
    }
}

function redirectAPerfil(estado: "success" | "error" | "cancelled", detalle?: string): Response {
    const u = new URL(`${SITE_URL}/dj-profile.html`);
    u.searchParams.set("calendar_connect", estado);
    if (detalle) u.searchParams.set("calendar_connect_detail", detalle);
    // "*": esto es una navegacion real del navegador siguiendo la
    // redireccion de Google, nunca pasa por una verificacion CORS de verdad
    // -- el header solo importa para pruebas directas via fetch() y no
    // expone nada sensible (Location es la unica cabecera con datos).
    return new Response(null, {
        status: 302,
        headers: { Location: u.toString(), "Access-Control-Allow-Origin": "*" },
    });
}

serve(async (req: Request) => {
    if (req.method !== "GET") return new Response("method_not_allowed", { status: 405 });

    const params = new URL(req.url).searchParams;

    // El DJ nego el consentimiento en la pantalla de Google -- no es un error
    // real del sistema, es una decision legitima del usuario.
    if (params.get("error")) {
        return redirectAPerfil("cancelled", params.get("error") ?? undefined);
    }

    const code = params.get("code") ?? "";
    const state = params.get("state") ?? "";
    if (!code || !state) return redirectAPerfil("error", "missing_code_or_state");

    const STATE_SECRET = Deno.env.get("CALENDAR_OAUTH_STATE_SECRET") ?? "";
    if (!STATE_SECRET) {
        console.error("[calendar-oauth-callback] falta CALENDAR_OAUTH_STATE_SECRET");
        return redirectAPerfil("error", "not_configured");
    }

    const verificado = await verificarState(state, STATE_SECRET);
    if (!verificado) {
        // Firma invalida, vencida (10 min) o corrupta -- nunca se asume un
        // usuario a partir de un state que no calza con su propia firma.
        console.error("[calendar-oauth-callback] state invalido o vencido");
        return redirectAPerfil("error", "invalid_state");
    }
    const { uid: userId, provider } = verificado;

    if (provider !== "google") return redirectAPerfil("error", "provider_invalido");

    const CLIENT_ID = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID") ?? "";
    const CLIENT_SECRET = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET") ?? "";
    if (!CLIENT_ID || !CLIENT_SECRET) {
        console.error("[calendar-oauth-callback] faltan GOOGLE_CALENDAR_CLIENT_ID / GOOGLE_CALENDAR_CLIENT_SECRET");
        return redirectAPerfil("error", "not_configured");
    }

    const redirectUri = `${SUPABASE_URL}/functions/v1/calendar-oauth-callback`;

    try {
        const tokenRes = await fetch(GOOGLE_TOKEN_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                redirect_uri: redirectUri,
                grant_type: "authorization_code",
            }).toString(),
        });
        const tokenBody = await tokenRes.json().catch(() => ({}));
        if (!tokenRes.ok) {
            console.error("[calendar-oauth-callback] Google token exchange error:", tokenRes.status, JSON.stringify(tokenBody).slice(0, 400));
            return redirectAPerfil("error", "token_exchange_failed");
        }

        const accessToken = String(tokenBody.access_token ?? "");
        const refreshToken = String(tokenBody.refresh_token ?? "");
        if (!accessToken) {
            console.error("[calendar-oauth-callback] Google no devolvio access_token");
            return redirectAPerfil("error", "no_access_token");
        }
        // refresh_token solo llega la PRIMERA vez que el usuario autoriza (o
        // con prompt=consent forzado, como ya se manda en calendar-oauth-init)
        // -- si por algun motivo no llega, se preserva el que ya hubiera en
        // la fila anterior en vez de pisarlo con NULL.
        const { data: filaExistente } = await ADMIN
            .from("user_calendar_integrations")
            .select("refresh_token")
            .eq("user_id", userId)
            .eq("provider", "google")
            .maybeSingle();

        const { error: upsertErr } = await ADMIN
            .from("user_calendar_integrations")
            .upsert({
                user_id: userId,
                provider: "google",
                access_token: accessToken,
                refresh_token: refreshToken || filaExistente?.refresh_token || null,
                status: "active",
                last_synced_at: null,
                updated_at: new Date().toISOString(),
            }, { onConflict: "user_id,provider" });

        if (upsertErr) {
            console.error("[calendar-oauth-callback] upsert error:", upsertErr.message);
            return redirectAPerfil("error", "save_failed");
        }

        // Crea el canal de escucha (events.watch) para que Google empiece a
        // avisar a calendar-sync-webhook. Sin esto la conexion queda "activa"
        // en la tabla pero Google nunca manda nada -- verificado contra la
        // doc oficial vigente (developers.google.com/calendar/api/guides/push):
        // POST calendars/{id}/events/watch con {id, type:'web_hook', address}.
        // Un fallo aca NO revierte la conexion ya guardada -- el DJ igual
        // queda conectado, solo sin sincronizacion automatica hasta que se
        // reintente (fuera de alcance de este archivo: no hay reintento
        // automatico todavia).
        try {
            const webhookUrl = `${SUPABASE_URL}/functions/v1/calendar-sync-webhook`;
            const channelId = crypto.randomUUID();
            const watchRes = await fetch(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events/watch",
                {
                    method: "POST",
                    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ id: channelId, type: "web_hook", address: webhookUrl }),
                },
            );
            const watchBody = await watchRes.json().catch(() => ({}));
            if (watchRes.ok && watchBody.resourceId) {
                await ADMIN
                    .from("user_calendar_integrations")
                    .update({
                        channel_id: channelId,
                        channel_resource_id: String(watchBody.resourceId),
                        channel_expires_at: watchBody.expiration ? new Date(Number(watchBody.expiration)).toISOString() : null,
                    })
                    .eq("user_id", userId)
                    .eq("provider", "google");
                console.log(`[calendar-oauth-callback] canal creado · user=${userId} · channel=${channelId}`);
            } else {
                console.error("[calendar-oauth-callback] events.watch fallo (conexion igual quedo activa):", watchRes.status, JSON.stringify(watchBody).slice(0, 300));
            }
        } catch (watchErr) {
            console.error("[calendar-oauth-callback] events.watch red (conexion igual quedo activa):", watchErr);
        }

        console.log(`[calendar-oauth-callback] conectado · user=${userId} · provider=google`);
        return redirectAPerfil("success");
    } catch (err) {
        console.error("[calendar-oauth-callback] red:", err);
        return redirectAPerfil("error", "network");
    }
});
