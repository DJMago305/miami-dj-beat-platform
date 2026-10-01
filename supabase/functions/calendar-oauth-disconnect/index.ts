// supabase/functions/calendar-oauth-disconnect/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Paso 6 del epic de calendarios (2026-10-01): "desconectar" de verdad, no
// solo pausar. Hasta hoy, apagar el interruptor en account-settings.html/
// client-account.html solo ponía status='paused' en user_calendar_integrations
// -- el refresh_token seguía guardado (cifrado en Vault) y el grant de OAuth
// seguía vivo del lado de Google indefinidamente. Esta función SÍ revoca el
// acceso y borra el token.
//
// POST, Authorization: Bearer <jwt del usuario> -- ningún otro parámetro:
// siempre desconecta la cuenta del propio llamador, nunca la de otro.
//
// Las dos filas por usuario (calendar_id "primary" + la de cumpleaños, ver
// calendar-oauth-callback) comparten el MISMO refresh_token -- una sola
// autorización de Google cubre ambos calendarios. Revocar uno invalida el
// grant completo del lado de Google (confirmado contra la doc oficial:
// POST https://oauth2.googleapis.com/revoke con token=<refresh_token>).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getServiceRoleKey } from "../_shared/service-key.ts";

const SUPABASE_URL_FALLBACK = "https://hkuvuqupbxwkiykxvqdr.supabase.co";
const SERVICE_ROLE_KEY = getServiceRoleKey() ?? "";
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || SUPABASE_URL_FALLBACK).replace(/\/$/, "");
const ADMIN = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const ALLOWED_ORIGINS = ["https://miamidjbeat.com", "https://www.miamidjbeat.com"];
const LOCALHOST = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function cors(req: Request): Record<string, string> {
    const origin = req.headers.get("origin") ?? "";
    const ok = ALLOWED_ORIGINS.includes(origin) || LOCALHOST.test(origin);
    return {
        "Access-Control-Allow-Origin": ok ? origin : ALLOWED_ORIGINS[0],
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Vary": "Origin",
    };
}

const GOOGLE_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

serve(async (req: Request) => {
    const h = cors(req);
    const json = (b: unknown, s: number) =>
        new Response(JSON.stringify(b), { status: s, headers: { ...h, "Content-Type": "application/json" } });

    if (req.method === "OPTIONS") return new Response("ok", { headers: h });
    if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!jwt) return json({ ok: false, error: "missing_authorization" }, 401);
    const { data: { user }, error: authErr } = await ADMIN.auth.getUser(jwt);
    if (authErr || !user?.id) return json({ ok: false, error: "invalid_session" }, 401);

    const provider = "google"; // único proveedor OAuth2 soportado hoy -- Apple usa CalDAV, sin token que revocar aquí.

    const { data: filas, error: selErr } = await ADMIN
        .from("user_calendar_integrations")
        .select("id, google_refresh_token_secret_id")
        .eq("user_id", user.id)
        .eq("provider", provider);
    if (selErr) {
        console.error("[calendar-oauth-disconnect] select error:", selErr.message);
        return json({ ok: false, error: "db_error" }, 500);
    }
    if (!filas || filas.length === 0) return json({ ok: true, already_disconnected: true }, 200);

    // Revocar con Google -- basta UNA vez (mismo refresh_token en ambas filas).
    // Un 400 de Google aquí normalmente significa que el token ya estaba
    // revocado o vencido del lado de ellos -- no bloquea la limpieza de
    // nuestro lado, que de todos modos tiene que pasar.
    for (const fila of filas) {
        if (!fila.google_refresh_token_secret_id) continue;
        try {
            const { data: token } = await ADMIN.rpc("calendar_google_leer_token", { p_secret_id: fila.google_refresh_token_secret_id });
            if (token) {
                const r = await fetch(GOOGLE_REVOKE_ENDPOINT, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: new URLSearchParams({ token: String(token) }).toString(),
                });
                if (!r.ok) console.warn("[calendar-oauth-disconnect] Google revoke no-OK:", r.status);
            }
        } catch (e) {
            console.error("[calendar-oauth-disconnect] revoke error:", (e as Error).message);
        }
        break; // un solo intento de revoke alcanza para todo el grant
    }

    // Borra los secretos de Vault y las filas -- nunca dejar el refresh_token
    // huérfano ni una fila "pausada" fingiendo una conexión que ya no existe.
    for (const fila of filas) {
        if (!fila.google_refresh_token_secret_id) continue;
        try {
            await ADMIN.rpc("calendar_google_borrar_token", { p_secret_id: fila.google_refresh_token_secret_id });
        } catch (e) {
            console.error("[calendar-oauth-disconnect] vault delete error:", (e as Error).message);
        }
    }
    const { error: delErr } = await ADMIN
        .from("user_calendar_integrations")
        .delete()
        .eq("user_id", user.id)
        .eq("provider", provider);
    if (delErr) {
        console.error("[calendar-oauth-disconnect] delete error:", delErr.message);
        return json({ ok: false, error: "db_error" }, 500);
    }

    return json({ ok: true }, 200);
});
