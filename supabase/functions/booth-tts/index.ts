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

const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_CHARS = 2800;

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
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
            { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    let body: { text?: string };
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const raw = typeof body.text === "string" ? body.text.trim() : "";
    if (!raw) {
        return new Response(JSON.stringify({ ok: false, error: "Missing text" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
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
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    const audioBuffer = await ttsRes.arrayBuffer();

    return new Response(audioBuffer, {
        status: 200,
        headers: {
            ...corsHeaders,
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
        },
    });
});
