// supabase/functions/elixis-tts/index.ts
// Voz de ELIXIS — TTS natural vía OpenAI (endpoint audio/speech).
// Reusa el secreto OPENAI_API_KEY ya existente (el mismo de booth-chat).
// Función NUEVA y AISLADA — NO toca booth-tts ni ninguna otra función.
// POST { text } -> audio/mpeg (mp3). CORS restringido + rate limit.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

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

function buildCorsHeaders(req: Request): Record<string, string> {
    const origin = req.headers.get("origin") ?? "";
    const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
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

    const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    if (!apiKey) {
        console.error("[elixis-tts] OPENAI_API_KEY not set");
        return new Response(JSON.stringify({ ok: false, error: "TTS not configured" }), {
            status: 503,
            headers: { ...cors, "Content-Type": "application/json" },
        });
    }

    let body: { text?: string; voice?: string };
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
                response_format: "mp3",
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
        headers: { ...cors, "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
});
