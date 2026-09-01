// supabase/functions/calendar-oauth-init/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Fase 2, pieza 1/3 del epic de calendarios: arranca el flujo OAuth de Google
// Calendar. Devuelve la URL de autorización de Google para que el frontend
// redirija al DJ -- no hace la redirección él mismo, para que el botón
// "Conectar Google Calendar" pueda mostrar un estado de carga antes de saltar.
//
// GET ?provider=google   ·   Authorization: Bearer <jwt del DJ>
//
// SEGURIDAD DEL PARAMETRO STATE (verificado contra la doc oficial vigente de
// Google, developers.google.com/identity/protocols/oauth2/web-server):
// Google exige devolver el mismo `state` que se envió, y recomienda
// verificarlo al volver para mitigar CSRF -- pero el callback (pieza 2/3) es
// un GET que Google le pega directo al navegador, SIN el JWT de esta sesión.
// Por eso `state` no es un valor aleatorio suelto: lleva el user_id y el
// proveedor firmados con HMAC-SHA256 (CALENDAR_OAUTH_STATE_SECRET, secreto
// del servidor) mas una expiracion corta -- el callback lo puede verificar y
// decodificar sin sesion activa, y nadie puede forjar un state para
// suplantar a otro usuario sin conocer el secreto.
//
// Apple Calendar NO tiene un flujo OAuth2 equivalente al de Google -- Apple
// usa CalDAV con contraseñas especificas de app (no hay "authorization code"
// ni "client_secret" de por medio). Pedir provider=apple aqui devuelve
// honestamente que no esta implementado, en vez de fingir paridad con Google.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL_FALLBACK = "https://hkuvuqupbxwkiykxvqdr.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
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

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
// Scope minimo real para leer/escribir eventos -- no se pide acceso a Gmail,
// Drive ni ningun otro producto de Google.
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

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

/** state = base64url(json).base64url(hmac(json)) -- decodificable y verificable
 *  sin sesion activa en el callback, sin exponer nada que el propio JWT no
 *  supiera ya (user_id, provider, una expiracion de 10 minutos). */
async function firmarState(userId: string, provider: string, secret: string): Promise<string> {
    const payload = JSON.stringify({ uid: userId, p: provider, exp: Date.now() + 10 * 60 * 1000 });
    const payloadB64 = base64url(new TextEncoder().encode(payload));
    const sig = await hmacSign(payloadB64, secret);
    return `${payloadB64}.${sig}`;
}

serve(async (req: Request) => {
    const h = cors(req);
    const json = (b: unknown, s: number) =>
        new Response(JSON.stringify(b), { status: s, headers: { ...h, "Content-Type": "application/json" } });

    if (req.method === "OPTIONS") return new Response("ok", { headers: h });
    if (req.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, 405);

    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!jwt) return json({ ok: false, error: "missing_authorization" }, 401);
    const { data: { user }, error: authErr } = await ADMIN.auth.getUser(jwt);
    if (authErr || !user?.id) return json({ ok: false, error: "invalid_session" }, 401);

    const provider = (new URL(req.url).searchParams.get("provider") ?? "google").toLowerCase();
    if (provider === "apple") {
        return json({
            ok: false,
            error: "apple_not_supported_yet",
            detalle: "Apple Calendar no usa OAuth2 -- usa CalDAV con contraseñas de aplicación. Requiere un flujo distinto, sin construir todavía.",
        }, 501);
    }
    if (provider !== "google") return json({ ok: false, error: "provider_invalido" }, 400);

    const CLIENT_ID = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID") ?? "";
    const STATE_SECRET = Deno.env.get("CALENDAR_OAUTH_STATE_SECRET") ?? "";
    if (!CLIENT_ID || !STATE_SECRET) {
        console.error("[calendar-oauth-init] faltan GOOGLE_CALENDAR_CLIENT_ID / CALENDAR_OAUTH_STATE_SECRET");
        return json({ ok: false, error: "calendar_oauth_not_configured" }, 503);
    }

    const redirectUri = `${SUPABASE_URL}/functions/v1/calendar-oauth-callback`;
    const state = await firmarState(user.id, provider, STATE_SECRET);

    const u = new URL(GOOGLE_AUTH_ENDPOINT);
    u.searchParams.set("client_id", CLIENT_ID);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", GOOGLE_CALENDAR_SCOPE);
    u.searchParams.set("access_type", "offline");
    u.searchParams.set("include_granted_scopes", "true");
    // consent forzado: sin esto, Google NO reenvia refresh_token si el
    // usuario ya autorizo esta app antes -- lo confirma la doc oficial.
    u.searchParams.set("prompt", "consent");
    u.searchParams.set("state", state);

    return json({ ok: true, url: u.toString() }, 200);
});
