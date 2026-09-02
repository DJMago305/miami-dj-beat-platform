// supabase/functions/heygen-session-token/index.ts
// ────────────────────────────────────────────────────────────────────────
// PUENTE DE TOKEN · LiveAvatar / HeyGen (reescrito 2026-08-27, v3)
//
// QUE HACE: un usuario staff autenticado pide un token de sesion; esta
// funcion llama a LiveAvatar con la clave permanente (que vive SOLO aqui,
// en Supabase Secrets) y devuelve UNICAMENTE el session_token de corta
// duracion. El navegador nunca ve la clave real.
//
// SIMPLIFICADO (v3): las versiones anteriores tambien llamaban aqui a
// POST /v1/sessions/start (para arrancar LiveKit+websocket) y se lo
// mandaban entero al frontend. Ya no hace falta: el SDK oficial
// "@heygen/liveavatar-web-sdk" (ver avatar-heygen-stream.js) hace ESA
// llamada el solo, desde el navegador, usando el session_token como
// Bearer -- confirmado leyendo su codigo fuente compilado real
// (SessionApiClient.js: startSession() llama a /v1/sessions/start con
// fetch directo). Es seguro que lo haga el navegador porque usa el token
// CORTO y ya-limitado-por-rol, nunca la clave permanente.
//
// HISTORIAL: v1 llamaba a POST /v1/streaming.create_token (api.heygen.com,
// producto descontinuado -- conectaba sin error pero nunca entregaba
// imagen). v2 armaba LiveKit + un websocket a mano contra la API real,
// pero el comando de habla nunca coincidia con el protocolo real (se
// mandaba "agent.speak"/"type", el real es "avatar.speak_audio"/
// "event_type" -- encontrado leyendo el SDK oficial, no la documentacion
// prosa). v3 (esta) usa el SDK oficial para todo lo que no sea la clave
// permanente.
//
// ⚠️ La API key original que se iba a usar aqui se pego en texto plano en
// un chat -- se dio por comprometida, se roto/regenero en el panel de
// LiveAvatar, y la NUEVA se cargo directo en:
//   Supabase → Project Settings → Edge Functions → Secrets → HEYGEN_API_KEY
// Sin ese secreto configurado, esta funcion responde 503 con la verdad
// (heygen_not_configured), nunca finge un token que no tiene.
// ────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LIVEAVATAR_BASE = "https://api.liveavatar.com";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SUPABASE_URL_FALLBACK = "https://hkuvuqupbxwkiykxvqdr.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ADMIN = createClient(
    Deno.env.get("SUPABASE_URL") || SUPABASE_URL_FALLBACK,
    SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
);

// Mismo candado de rol que elixis-realtime-session: streaming de HeyGen
// cuesta dinero por minuto, no es para cualquier cuenta autenticada.
const ALLOWED_ROLES = new Set(["owner", "admin", "manager", "seller", "artist"]);

type Gate =
    | { ok: true; userId: string; role: string }
    | { ok: false; status: number; error: string; detail?: string };

async function verifyStaff(req: Request): Promise<Gate> {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!jwt) return { ok: false, status: 401, error: "missing_authorization" };

    const { data: { user }, error } = await ADMIN.auth.getUser(jwt);
    if (error || !user?.id) return { ok: false, status: 401, error: "invalid_session" };

    const { data: prof } = await ADMIN
        .from("dj_profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

    const role = String(prof?.role ?? "").toLowerCase().trim();
    if (!ALLOWED_ROLES.has(role)) {
        return { ok: false, status: 403, error: "forbidden_not_staff", detail: role || "sin_rol" };
    }
    return { ok: true, userId: user.id, role };
}

// ─── CORS (identico a elixis-realtime-session, mismo motivo) ──────────────
const ALLOWED_ORIGINS = [
    "https://miamidjbeat.com",
    "https://www.miamidjbeat.com",
    "https://miamidjbeat.vercel.app",
    "http://localhost:8080",
    "http://localhost:3000",
    "http://127.0.0.1:8080",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
];
const LOCALHOST_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function buildCorsHeaders(req: Request): Record<string, string> {
    const origin = req.headers.get("origin") ?? "";
    const isAllowed = ALLOWED_ORIGINS.includes(origin) || LOCALHOST_ORIGIN.test(origin);
    const allowed = isAllowed ? origin : ALLOWED_ORIGINS[0];
    return {
        "Access-Control-Allow-Origin": allowed,
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Vary": "Origin",
    };
}

// ─── RATE LIMIT ─────────────────────────────────────────────────────────
// Cada token puede arrancar una sesion facturable de HeyGen: limites mas
// estrictos que un simple endpoint de lectura.
const _ipWindow = new Map<string, number[]>();
const IP_LIMIT = 10;
const IP_WINDOW_MS = 60_000;

const _userWindow = new Map<string, number[]>();
const USER_LIMIT = 6;
const USER_WINDOW_MS = 60 * 60_000; // 6 sesiones de streaming por hora por usuario

function hitWindow(store: Map<string, number[]>, key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const hits = (store.get(key) ?? []).filter((t) => now - t < windowMs);
    hits.push(now);
    store.set(key, hits);
    return hits.length > limit;
}

function isIpRateLimited(req: Request): boolean {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    return hitWindow(_ipWindow, ip, IP_LIMIT, IP_WINDOW_MS);
}

// ─── HANDLER ────────────────────────────────────────────────────────────
serve(async (req: Request) => {
    const cors = buildCorsHeaders(req);
    const json = (body: unknown, status: number, extra: Record<string, string> = {}) =>
        new Response(JSON.stringify(body), {
            status,
            headers: { ...cors, "Content-Type": "application/json", ...extra },
        });

    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

    if (isIpRateLimited(req)) {
        return json({ ok: false, error: "too_many_requests" }, 429, { "Retry-After": "60" });
    }

    const gate = await verifyStaff(req);
    if (!gate.ok) return json({ ok: false, error: gate.error, detail: gate.detail }, gate.status);

    if (hitWindow(_userWindow, gate.userId, USER_LIMIT, USER_WINDOW_MS)) {
        return json(
            { ok: false, error: "session_quota_exceeded", detail: "limite_por_hora" },
            429,
            { "Retry-After": "600" },
        );
    }

    const apiKey = Deno.env.get("HEYGEN_API_KEY") ?? "";
    if (!apiKey) {
        console.error("[heygen-session-token] HEYGEN_API_KEY no configurada");
        return json({ ok: false, error: "heygen_not_configured" }, 503);
    }

    let body: { avatar_id?: unknown };
    try {
        body = await req.json();
    } catch {
        return json({ ok: false, error: "invalid_json" }, 400);
    }
    const avatarId = typeof body.avatar_id === "string" ? body.avatar_id.trim() : "";
    if (!UUID_RE.test(avatarId)) {
        return json({ ok: false, error: "invalid_avatar_id" }, 400);
    }

    try {
        // Paso 1: token de sesion corto, con la clave permanente que nunca
        // sale de este servidor.
        const tokenRes = await fetch(`${LIVEAVATAR_BASE}/v1/sessions/token`, {
            method: "POST",
            headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "LITE", avatar_id: avatarId, is_sandbox: false }),
        });
        const tokenPayload = await tokenRes.json().catch(() => ({}));
        if (!tokenRes.ok) {
            console.error(
                `[heygen-session-token] /sessions/token ${tokenRes.status} · ${JSON.stringify(tokenPayload).slice(0, 300)}`,
            );
            return json({ ok: false, error: "heygen_token_error", detail: tokenRes.status }, 502);
        }
        const sessionToken = tokenPayload?.data?.session_token;
        if (!sessionToken) {
            console.error("[heygen-session-token] sin session_token:", JSON.stringify(tokenPayload).slice(0, 300));
            return json({ ok: false, error: "heygen_no_session_token" }, 502);
        }

        console.log(`[heygen-session-token] token emitido · user=${gate.userId} · rol=${gate.role}`);
        return json({ ok: true, session_token: sessionToken }, 200);
    } catch (err) {
        console.error("[heygen-session-token] fallo de red hacia LiveAvatar:", err);
        return json({ ok: false, error: "heygen_unreachable" }, 502);
    }
});
