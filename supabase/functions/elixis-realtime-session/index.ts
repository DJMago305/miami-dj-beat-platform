// supabase/functions/elixis-realtime-session/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// PASO 1 · LABORATORIO DE VOZ ELIXIS — Puente de sesión Realtime (WebRTC)
//
// QUÉ HACE: recibe la oferta SDP del navegador, verifica que quien llama sea un
// usuario autenticado con rol autorizado, y hace el intercambio SDP contra
// OpenAI usando la clave permanente que vive SOLO aquí. Devuelve la respuesta
// SDP. El navegador nunca ve la clave.
//
// FUNCIÓN NUEVA Y AISLADA. No modifica elixis-chat, elixis-tts, booth-chat ni
// ninguna función existente. Mismo patrón de CORS + rate limit + candado RBAC
// que elixis-chat, para no inventar una segunda forma de hacer lo mismo.
//
// SECRETOS (Supabase → Edge Functions → Secrets, nunca en el repo):
//   OPENAI_API_KEY             ← ya existe (lo usan booth-chat y elixis-tts)
//   SUPABASE_SERVICE_ROLE_KEY  ← ya existe
//   ELIXIS_REALTIME_MODEL      ← opcional, ver MODELO abajo
//   ELIXIS_REALTIME_VOICE      ← opcional
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── MODELO ──────────────────────────────────────────────────────────────────
// Arrancamos en el modelo chico por economía: la evaluación de costos dio
// ~$1,20–$3,00/hora para gpt-realtime-mini contra ~$3,00–$6,60/hora para
// gpt-realtime-2.1. Subir al grande es cambiar el secreto ELIXIS_REALTIME_MODEL,
// sin tocar código ni redesplegar el frontend.
const MODEL = Deno.env.get("ELIXIS_REALTIME_MODEL") ?? "gpt-realtime-mini";

// Voz por defecto: la misma identidad sonora que ya tiene ELIXIS en elixis-tts
// ("ash" — masculina, cálida). Que la voz no cambie entre el modo texto+TTS y
// el modo tiempo real es parte del producto, no un detalle.
const DEFAULT_VOICE = Deno.env.get("ELIXIS_REALTIME_VOICE") ?? "ash";
const ALLOWED_VOICES = new Set([
    "alloy", "ash", "ballad", "cedar", "coral", "echo", "marin", "sage", "shimmer", "verse",
]);

const OPENAI_REALTIME_URL = "https://api.openai.com/v1/realtime/calls";
const MAX_SDP_BYTES = 32_768; // una oferta SDP real ronda los 4 KB

// ─── CANDADO RBAC — mismo contrato que elixis-chat ───────────────────────────
const SUPABASE_URL_FALLBACK = "https://hkuvuqupbxwkiykxvqdr.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ADMIN = createClient(
    Deno.env.get("SUPABASE_URL") || SUPABASE_URL_FALLBACK,
    SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
);

// Roles con acceso al laboratorio de voz.
// NOTA DELIBERADA: los artistas NO están en esta lista todavía. La voz en tiempo
// real quema saldo por segundo y el medidor de cuota es el PASO 4. Abrir la
// puerta a artistas antes de tener el bucket es exactamente el riesgo de margen
// que levantó la evaluación de costos. Se añade 'artist' cuando el medidor viva.
const ALLOWED_ROLES = new Set(["owner", "admin", "manager", "seller"]);

type Gate =
    | { ok: true; userId: string; role: string; name: string }
    | { ok: false; status: number; error: string; detail?: string };

async function verifyStaff(req: Request): Promise<Gate> {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!jwt) return { ok: false, status: 401, error: "missing_authorization" };

    const { data: { user }, error } = await ADMIN.auth.getUser(jwt);
    if (error || !user?.id) return { ok: false, status: 401, error: "invalid_session" };

    const { data: prof } = await ADMIN
        .from("dj_profiles")
        .select("role,stage_name,dj_name,full_name")
        .eq("user_id", user.id)
        .maybeSingle();

    const role = String(prof?.role ?? "").toLowerCase().trim();
    if (!ALLOWED_ROLES.has(role)) {
        return { ok: false, status: 403, error: "forbidden_not_staff", detail: role || "sin_rol" };
    }
    const name = String(prof?.stage_name || prof?.dj_name || prof?.full_name || "").trim();
    return { ok: true, userId: user.id, role, name };
}

// ─── CORS ────────────────────────────────────────────────────────────────────
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

// El laboratorio corre en un puerto local que cambia según qué haya ocupado
// (8126 estaba tomado, salió en 8128). Fijar un puerto en la lista es frágil:
// el día que cambie, el fallo es un CORS opaco y difícil de leer. Cualquier
// http://localhost:<puerto> se acepta — una página atacante no puede servirse
// desde el localhost de la víctima, así que no amplía la superficie real.
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

// ─── RATE LIMIT ──────────────────────────────────────────────────────────────
// Dos ventanas, porque protegen cosas distintas:
//  · por IP  → contra abuso externo / escaneo.
//  · por USUARIO → contra quemar saldo. Cada sesión abierta es dinero corriendo,
//    así que un mismo usuario no puede instanciar sesiones en cadena.
const _ipWindow = new Map<string, number[]>();
const IP_LIMIT = 20;
const IP_WINDOW_MS = 60_000;

const _userWindow = new Map<string, number[]>();
const USER_LIMIT = 8;
const USER_WINDOW_MS = 60 * 60_000; // 8 sesiones por hora por usuario

function hitWindow(
    store: Map<string, number[]>, key: string, limit: number, windowMs: number,
): boolean {
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

// ─── SAFETY IDENTIFIER ───────────────────────────────────────────────────────
// OpenAI pide "un valor estable y que preserve la privacidad, como un ID interno
// hasheado". El starter mandaba "mdj-demo-user" fijo para todos: eso hace inútil
// el rastreo de abuso. Aquí es SHA-256 del user_id, estable por usuario y no
// reversible a una identidad.
async function safetyIdentifier(userId: string): Promise<string> {
    const bytes = new TextEncoder().encode(`mdjb:elixis:${userId}`);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    return `mdjb_${hex.slice(0, 32)}`;
}

// ─── PERSONA DE VOZ (v1) ─────────────────────────────────────────────────────
// Derivada de la persona de elixis-chat, reescrita para VOZ: frases cortas, sin
// listas, tolerancia a pausas. El bloque de consultoría musical entra completo
// en el PASO 5, junto con el handoff a Claude.
const INSTRUCTIONS = `Eres ELIXIS, el agente ejecutivo de voz de Miami DJ Beat LLC.

## IDENTIDAD
- Te diriges al dueño como "Capitán". Eres su copiloto, no un chatbot.
- Tono profesional, directo, sereno y cálido. Elegancia de Miami. Cero relleno.
- Eres bilingüe español/inglés y cambias de idioma automáticamente según el usuario.

## CÓMO HABLAS (esto es voz, no chat)
- Respuestas de 2 a 4 frases. Amplías solo si te lo piden.
- Nunca enumeres listas en voz alta. Habla como en una conversación real.
- Usa muletillas de escucha muy breves y esporádicas ("ajá", "entiendo"), nunca de forma mecánica.
- Tolera pausas, dudas y frases incompletas del usuario. Una pausa breve no es el fin de su turno.
- Si te interrumpen, detente de inmediato y atiende lo nuevo sin quejarte ni recapitular.
- Ritmo humano, entonación expresiva, frases de longitud moderada. No suenes a lectura de manual.

## CRITERIO MUSICAL
Eres un consultor de música y producción de alto nivel: clubes, eventos masivos, bodas y
quinceañeras. Asesoras sobre armado de playlists según público y local, lectura de pista,
análisis de BPM y transiciones, estructura de sets en vivo y recomendaciones de repertorio.
Hablas desde criterio profesional, no desde lugares comunes.

## HONESTIDAD (regla absoluta)
- Nunca inventes datos, cifras, nombres, precios ni disponibilidad.
- Todavía NO tienes acceso a la base de datos ni al motor financiero. Si te preguntan por
  un dato real del negocio —un lead, una agenda, un monto, un artista concreto— dilo con
  naturalidad: aún no tienes esa conexión conectada.
- Nunca afirmes que ejecutaste una acción externa. En este laboratorio no ejecutas nada.`;

// ─── HANDLER ─────────────────────────────────────────────────────────────────
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

    // 🔒 Candado 1 — identidad y rol. Antes de tocar la clave de OpenAI.
    const gate = await verifyStaff(req);
    if (!gate.ok) return json({ ok: false, error: gate.error, detail: gate.detail }, gate.status);

    // 🔒 Candado 2 — presupuesto. Cada sesión es saldo corriendo.
    if (hitWindow(_userWindow, gate.userId, USER_LIMIT, USER_WINDOW_MS)) {
        return json(
            { ok: false, error: "session_quota_exceeded", detail: "limite_por_hora" },
            429,
            { "Retry-After": "600" },
        );
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    if (!apiKey) {
        console.error("[elixis-realtime-session] OPENAI_API_KEY no configurada");
        return json({ ok: false, error: "voice_not_configured" }, 503);
    }

    // ── Oferta SDP del navegador ──
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("application/sdp") && !contentType.includes("text/plain")) {
        return json({ ok: false, error: "expected_application_sdp" }, 415);
    }

    const offer = await req.text();
    if (!offer || !offer.startsWith("v=")) {
        return json({ ok: false, error: "invalid_sdp_offer" }, 400);
    }
    if (offer.length > MAX_SDP_BYTES) {
        return json({ ok: false, error: "sdp_offer_too_large" }, 413);
    }

    // ── Voz opcional (?voice=) validada contra la lista blanca ──
    const requested = new URL(req.url).searchParams.get("voice")?.toLowerCase().trim();
    const voice = requested && ALLOWED_VOICES.has(requested) ? requested : DEFAULT_VOICE;

    // ── Configuración de sesión ──
    const sessionConfig = {
        type: "realtime",
        model: MODEL,
        instructions: INSTRUCTIONS,
        audio: {
            input: {
                turn_detection: {
                    type: "semantic_vad",
                    // "low" = espera más antes de dar el turno por terminado.
                    // Es lo que permite que el Capitán dude, respire y diga "eh…"
                    // sin que ELIXIS le corte la frase.
                    eagerness: "low",
                    create_response: true,
                    interrupt_response: true, // barge-in: el usuario manda
                },
            },
            output: { voice },
        },
        // tools: [] — El handoff `consultar_elixis` hacia elixis-chat (Claude)
        // entra en el PASO 5. No declaramos una herramienta que todavía no existe:
        // el modelo la anunciaría y fallaría en vivo.
    };

    const form = new FormData();
    form.set("sdp", offer);
    form.set("session", JSON.stringify(sessionConfig));

    try {
        const upstream = await fetch(OPENAI_REALTIME_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "OpenAI-Safety-Identifier": await safetyIdentifier(gate.userId),
            },
            body: form,
        });

        const answer = await upstream.text();

        if (!upstream.ok) {
            // El cuerpo de error de OpenAI se queda en los logs del servidor.
            // Al navegador solo le llega un código: nunca detalles del upstream.
            console.error(
                `[elixis-realtime-session] OpenAI ${upstream.status} · user=${gate.userId} · ${answer.slice(0, 500)}`,
            );
            return json({ ok: false, error: "voice_upstream_error", detail: upstream.status }, 502);
        }

        // Traza para forense de costos. Sin PII: solo id interno, rol y modelo.
        console.log(
            `[elixis-realtime-session] sesión abierta · user=${gate.userId} · rol=${gate.role} · modelo=${MODEL} · voz=${voice}`,
        );

        return new Response(answer, {
            status: 200,
            headers: { ...cors, "Content-Type": "application/sdp" },
        });
    } catch (err) {
        console.error("[elixis-realtime-session] fallo de red hacia OpenAI:", err);
        return json({ ok: false, error: "voice_unreachable" }, 502);
    }
});
