// supabase/functions/booth-tts/index.ts
// Text-to-speech proxy for "The AI Booth" — ElevenLabs API key stays server-side only.
// Deploy: supabase secrets set ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=...
//         supabase functions deploy booth-tts
//
// Env:
//   ELEVENLABS_API_KEY   (required) — never in frontend
//   ELEVENLABS_VOICE_ID  (required) — voice from ElevenLabs dashboard (e.g. professional narrator)
//   ELEVENLABS_MODEL_ID  (optional) — default: eleven_multilingual_v2
//
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// ── CORS — only official Miami DJ Beat domains ────────────────────────────────
const ALLOWED_ORIGINS = [
    "https://miamidjbeat.com",
    "https://www.miamidjbeat.com",
    "https://miamidjbeat.vercel.app",
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

// ── Rate limiting — in-memory sliding window (10 req / 60 s / IP) ─────────────
const _ipWindow = new Map<string, number[]>();
const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;

function isRateLimited(req: Request): boolean {
    const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
        req.headers.get("x-real-ip") ??
        "unknown";
    const now = Date.now();
    const hits = (_ipWindow.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
    hits.push(now);
    _ipWindow.set(ip, hits);
    return hits.length > RATE_LIMIT;
}

const MAX_CHARS = 2800;

serve(async (req) => {
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

    const apiKey = Deno.env.get("ELEVENLABS_API_KEY") ?? "";
    const voiceId = Deno.env.get("ELEVENLABS_VOICE_ID") ?? "";
    const modelId = Deno.env.get("ELEVENLABS_MODEL_ID") ?? "eleven_multilingual_v2";

    if (!apiKey || !voiceId) {
        return new Response(
            JSON.stringify({
                ok: false,
                error: "Booth TTS not configured (ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID)",
            }),
            { status: 503, headers: { ...cors, "Content-Type": "application/json" } },
        );
    }

    let body: { text?: string };
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
            status: 400,
            headers: { ...cors, "Content-Type": "application/json" },
        });
    }

    const raw = typeof body.text === "string" ? body.text.trim() : "";
    if (!raw) {
        return new Response(JSON.stringify({ ok: false, error: "Missing text" }), {
            status: 400,
            headers: { ...cors, "Content-Type": "application/json" },
        });
    }

    const text = raw.length > MAX_CHARS ? raw.slice(0, MAX_CHARS) : raw;

    const elevenUrl = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;

    const ttsRes = await fetch(elevenUrl, {
        method: "POST",
        headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
        },
        body: JSON.stringify({
            text,
            model_id: modelId,
            voice_settings: {
                stability: 0.52,
                similarity_boost: 0.78,
                style: 0.35,
                use_speaker_boost: true,
            },
        }),
    });

    if (!ttsRes.ok) {
        const errText = await ttsRes.text();
        console.error("[booth-tts] ElevenLabs error:", ttsRes.status, errText);
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
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
        },
    });
});
