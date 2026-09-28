// supabase/functions/dj-bio-translate/index.ts
// Pieza 1 del ticket "Auto-traducción con IA" (docs/tickets/2026-09-27-
// auto-traduccion-ia-bio-y-ui.md). Función NUEVA y AISLADA -- no modifica
// elixis-chat ni ninguna otra función existente.
//
// Regla obligatoria del ticket (mismo patrón que rige a ELIXIS): el modelo
// PROPONE, nunca publica directo. Esta función NUNCA escribe en la columna
// pública real (dj_profiles.bio_en) -- solo en bio_en_draft. Un humano
// (el propio DJ, o staff/owner para perfiles que administra el hilo
// maestro) aprueba desde jobs.html antes de que pase a bio_en real.
//
// Modelo: mismo que ELIXIS (Anthropic Claude), pero Haiku -- traducir un
// párrafo es una tarea simple, no hace falta Sonnet/pensamiento extendido.
// Mismo secreto ANTHROPIC_API_KEY ya configurado en Supabase (Edge
// Functions → Secrets), sin setup nuevo del owner.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_TOKENS = 1024;

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ADMIN = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
);

// ─── CORS (mismo allow-list que elixis-chat) ──────────────────────────────
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

function buildCorsHeaders(req: Request): Record<string, string> {
    const origin = req.headers.get("origin") ?? "";
    const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        "Access-Control-Allow-Origin": allowed,
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Vary": "Origin",
    };
}

// ─── RATE LIMIT (sliding window por IP, más estricto que elixis-chat -- tarea barata pero sin necesidad de volumen alto) ──
const _ipWindow = new Map<string, number[]>();
const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;
function isRateLimited(req: Request): boolean {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const now = Date.now();
    const hits = (_ipWindow.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
    hits.push(now);
    _ipWindow.set(ip, hits);
    return hits.length > RATE_LIMIT;
}

// ─── CANDADO — el propio DJ dueño del perfil, o staff/owner ───────────────
// Perfiles administrados por el hilo maestro (DJMago305/DJSolitario): el
// owner/staff aprueba esos casos (confirmado por el PO, 2026-09-28) -- por
// eso el candado permite AMBOS caminos, no solo "es tu propio perfil".
const STAFF_ROLES = new Set(["owner", "admin", "manager", "seller"]);

async function verifyCaller(
    req: Request,
    targetDjUserId: string,
): Promise<{ ok: true; userId: string } | { ok: false; status: number; error: string }> {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!jwt) return { ok: false, status: 401, error: "missing_authorization" };
    const { data: { user }, error } = await ADMIN.auth.getUser(jwt);
    if (error || !user?.id) return { ok: false, status: 401, error: "invalid_session" };
    if (user.id === targetDjUserId) return { ok: true, userId: user.id };
    const { data: prof } = await ADMIN.from("dj_profiles").select("role").eq("user_id", user.id).maybeSingle();
    const role = String(prof?.role ?? "").toLowerCase().trim();
    if (STAFF_ROLES.has(role)) return { ok: true, userId: user.id };
    return { ok: false, status: 403, error: "forbidden_not_owner_or_staff" };
}

serve(async (req: Request) => {
    const cors = buildCorsHeaders(req);
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (isRateLimited(req)) {
        return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
    }

    let body: { dj_user_id?: string };
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const djUserId = String(body?.dj_user_id ?? "").trim();
    if (!djUserId) {
        return new Response(JSON.stringify({ error: "dj_user_id_required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const auth = await verifyCaller(req, djUserId);
    if (!auth.ok) {
        return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Lee la biografía real ACTUAL de la base -- nunca confía en texto que
    // mande el cliente (evita que alguien mande texto arbitrario a traducir
    // y guardarlo como si fuera la bio real de otro DJ).
    const { data: prof, error: profErr } = await ADMIN
        .from("dj_profiles")
        .select("bio, bio_language, stage_name, dj_name")
        .eq("user_id", djUserId)
        .maybeSingle();
    if (profErr || !prof) {
        return new Response(JSON.stringify({ error: "dj_profile_not_found" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const sourceText = String(prof.bio ?? "").trim();
    if (!sourceText) {
        return new Response(JSON.stringify({ error: "empty_bio_nothing_to_translate" }), { status: 422, headers: { ...cors, "Content-Type": "application/json" } });
    }
    // Alcance de esta pieza (2026-09-28, confirmado en el ticket): solo
    // dj_profiles.bio -> bio_en_draft. bio_short/bio_long no tienen columna
    // "_en" todavía -- fuera de alcance, no se inventa una aquí.
    const sourceLang = String(prof.bio_language || "es").toLowerCase() === "en" ? "en" : "es";
    const targetLangLabel = sourceLang === "es" ? "English" : "Spanish";

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
    if (!apiKey) {
        console.error("[dj-bio-translate] ANTHROPIC_API_KEY not set");
        return new Response(JSON.stringify({ error: "server_misconfigured" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const systemPrompt =
        `You translate a DJ's professional biography for a talent platform (Miami DJ Beat). ` +
        `Translate the text into ${targetLangLabel}, preserving tone (confident, professional) and any real proper nouns exactly as written ` +
        `(stage names, place names, genre names like "Open Format", "Tech House", brand names). ` +
        `Do not add facts that are not in the original. Reply with ONLY the translated text, no preamble, no quotes around it.`;

    let translation = "";
    try {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "x-api-key": apiKey, "anthropic-version": ANTHROPIC_VERSION, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: MODEL,
                max_tokens: MAX_TOKENS,
                system: systemPrompt,
                messages: [{ role: "user", content: sourceText }],
            }),
        });
        if (!r.ok) {
            const errText = await r.text();
            console.error("[dj-bio-translate] Anthropic error:", r.status, errText);
            return new Response(JSON.stringify({ error: "translation_provider_error" }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
        }
        const j = await r.json();
        const blocks: Array<Record<string, unknown>> = Array.isArray(j.content) ? j.content : [];
        translation = blocks.filter((b) => b?.type === "text").map((b) => String(b.text ?? "")).join("").trim();
    } catch (e) {
        console.error("[dj-bio-translate] fetch failed:", e);
        return new Response(JSON.stringify({ error: "translation_provider_unreachable" }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (!translation) {
        return new Response(JSON.stringify({ error: "empty_translation" }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // NUNCA escribe en bio_en (la real, pública) -- solo en el borrador.
    // Un humano decide desde jobs.html si la usa.
    const { error: updErr } = await ADMIN
        .from("dj_profiles")
        .update({ bio_en_draft: translation, bio_en_draft_generated_at: new Date().toISOString() })
        .eq("user_id", djUserId);
    if (updErr) {
        console.error("[dj-bio-translate] failed to save draft:", updErr);
        return new Response(JSON.stringify({ error: "failed_to_save_draft" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ draft: translation }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
});
