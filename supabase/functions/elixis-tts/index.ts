// supabase/functions/elixis-tts/index.ts
// Voz de ELIXIS — TTS natural vía OpenAI (endpoint audio/speech).
// Reusa el secreto OPENAI_API_KEY ya existente (el mismo de booth-chat).
// Función NUEVA y AISLADA — NO toca booth-tts ni ninguna otra función.
// POST { text, format? } -> audio/mpeg (mp3, default) o audio/pcm (crudo,
// para avatar-heygen-stream.js). CORS restringido + rate limit.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Motor de voz: gpt-4o-mini-tts es el modelo NUEVO, mucho más natural y expresivo
// que tts-1, y acepta "instructions" (dirección de actuación) para sonar humano.
const MODEL = "gpt-4o-mini-tts";
const DEFAULT_VOICE = "ash"; // masculina, cálida y natural
const ALLOWED_VOICES = new Set([
    "alloy", "ash", "ballad", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer", "verse",
]);
// Dirección de actuación — el gran salto hacia lo humano.
const INSTRUCTIONS =
    "Eres la voz de un copiloto humano de confianza para un empresario de Miami. " +
    "Habla en español latino, natural y conversacional, con calidez, cercanía y seguridad. " +
    "Ritmo relajado y humano, entonación expresiva (no monótona ni robótica), " +
    "como un amigo experto que te habla con confianza y buena energía.";
const MAX_CHARS = 2000;

// ─── CANDADO — solo staff/owner (verificación server-side) ───────────────────
const SUPABASE_URL_FALLBACK = "https://hkuvuqupbxwkiykxvqdr.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ADMIN = createClient(
    Deno.env.get("SUPABASE_URL") || SUPABASE_URL_FALLBACK,
    SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
);
const ALLOWED_ROLES = new Set(["owner", "admin", "manager", "seller"]);

async function verifyStaff(
    req: Request,
): Promise<{ ok: true; userId: string } | { ok: false; status: number; error: string; detail?: string }> {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!jwt) return { ok: false, status: 401, error: "missing_authorization" };
    const { data: { user }, error } = await ADMIN.auth.getUser(jwt);
    if (error || !user?.id) return { ok: false, status: 401, error: "invalid_session" };
    const { data: prof } = await ADMIN
        .from("dj_profiles").select("role").eq("user_id", user.id).maybeSingle();
    const role = String(prof?.role ?? "").toLowerCase().trim();
    if (!ALLOWED_ROLES.has(role)) {
        return { ok: false, status: 403, error: "forbidden_not_staff", detail: role || "sin_rol" };
    }
    return { ok: true, userId: user.id };
}

// ─── CORS ────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
    "https://miamidjbeat.com",
    "https://www.miamidjbeat.com",
    "https://miamidjbeat.vercel.app",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:8080",
    "http://localhost:3000",
];

// Mismo patron que elixis-realtime-session / elixis-orchestrator: el panel
// local corre en el primer puerto libre (8124, 8210...), que cambia -- una
// lista fija de puertos falla en silencio con CORS opaco. Faltaba aqui
// (encontrado 2026-08-27 al conectar avatar-heygen-stream.js, que llama a
// esta funcion desde el mismo puerto que ya fallaba en elixis-orchestrator).
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

// ─── RATE LIMIT (20 req / 60 s / IP) ─────────────────────────────────────────
const _ipWindow = new Map<string, number[]>();
const RATE_LIMIT = 20;
const WINDOW_MS = 60_000;

function isRateLimited(req: Request): boolean {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const now = Date.now();
    const hits = (_ipWindow.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
    hits.push(now);
    _ipWindow.set(ip, hits);
    return hits.length > RATE_LIMIT;
}

serve(async (req: Request) => {
    const cors = buildCorsHeaders(req);

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: cors });
    }
    if (req.method !== "POST") {
        return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
            status: 405,
            headers: { ...cors, "Content-Type": "application/json" },
        });
    }
    if (isRateLimited(req)) {
        return new Response(JSON.stringify({ ok: false, error: "Too many requests" }), {
            status: 429,
            headers: { ...cors, "Content-Type": "application/json", "Retry-After": "60" },
        });
    }

    // 🔒 Candado: solo staff/owner autenticado
    const gate = await verifyStaff(req);
    if (!gate.ok) {
        return new Response(
            JSON.stringify({ ok: false, error: gate.error, detail: gate.detail }),
            { status: gate.status, headers: { ...cors, "Content-Type": "application/json" } },
        );
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    if (!apiKey) {
        console.error("[elixis-tts] OPENAI_API_KEY not set");
        return new Response(JSON.stringify({ ok: false, error: "TTS not configured" }), {
            status: 503,
            headers: { ...cors, "Content-Type": "application/json" },
        });
    }

    let body: { text?: string; voice?: string; format?: string };
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
            status: 400,
            headers: { ...cors, "Content-Type": "application/json" },
        });
    }

    const voice = typeof body.voice === "string" && ALLOWED_VOICES.has(body.voice)
        ? body.voice
        : DEFAULT_VOICE;

    // "pcm" es para avatar-heygen-stream.js: LiveAvatar pide audio crudo
    // PCM 16-bit 24kHz para mover los labios (agent.speak), no un texto que
    // ella misma convierta. OpenAI ya lo entrega en ese formato exacto sin
    // necesitar ninguna conversion en el navegador (verificado contra el
    // OpenAPI real de OpenAI, 2026-08-27). Todo lo demas sigue pidiendo mp3
    // como siempre -- este parametro es opcional y no rompe nada existente.
    const format = body.format === "pcm" ? "pcm" : "mp3";

    const raw = typeof body.text === "string" ? body.text.trim() : "";
    if (!raw) {
        return new Response(JSON.stringify({ ok: false, error: "Missing text" }), {
            status: 400,
            headers: { ...cors, "Content-Type": "application/json" },
        });
    }
    const text = raw.length > MAX_CHARS ? raw.slice(0, MAX_CHARS) : raw;

    let ttsRes: Response;
    try {
        ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: MODEL,
                voice,
                input: text,
                instructions: INSTRUCTIONS,
                response_format: format,
            }),
        });
    } catch (err) {
        console.error("[elixis-tts] OpenAI fetch error:", err);
        return new Response(JSON.stringify({ ok: false, error: "TTS provider unreachable" }), {
            status: 502,
            headers: { ...cors, "Content-Type": "application/json" },
        });
    }

    if (!ttsRes.ok) {
        const errText = await ttsRes.text();
        console.error("[elixis-tts] OpenAI error:", ttsRes.status, errText);
        return new Response(
            JSON.stringify({
                ok: false,
                error: "TTS provider error",
                detail: ttsRes.status === 401 ? "Invalid API key" : "Upstream failure",
            }),
            { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
        );
    }

    const audioBuffer = await ttsRes.arrayBuffer();
    return new Response(audioBuffer, {
        status: 200,
        headers: {
            ...cors,
            "Content-Type": format === "pcm" ? "audio/pcm" : "audio/mpeg",
            "Cache-Control": "no-store",
        },
    });
});
