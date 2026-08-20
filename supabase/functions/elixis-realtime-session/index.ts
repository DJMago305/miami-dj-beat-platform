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
// Modelo insignia por decisión del PO: la experiencia humana manda sobre el
// ahorro. Cuesta ~$3,00–$6,60/hora contra ~$1,20–$3,00 del mini, así que el
// medidor de cuota (paso 4) deja de ser opcional antes de abrir esto a artistas.
// NO usar gpt-4o-realtime-preview: está deprecado, es más caro que el GA y usa
// la interfaz beta, incompatible con la forma de sesión que arma esta función.
// Bajar al mini es cambiar el secreto ELIXIS_REALTIME_MODEL, sin tocar código.
const FLAGSHIP_MODEL = Deno.env.get("ELIXIS_REALTIME_MODEL")      ?? "gpt-realtime-2.1";
const MINI_MODEL     = Deno.env.get("ELIXIS_REALTIME_MODEL_MINI") ?? "gpt-realtime-mini";

// Bloque que se reserva por sesion. Al cerrar se liquida y se devuelve lo no
// usado, asi que un bloque grande no cuesta nada... salvo si el navegador
// desaparece: ahi se cobra entero. 15 min es el equilibrio entre no cortar una
// conversacion y no regalar media hora cuando alguien cierra de golpe.
const RESERVE_SECONDS   = 900;
const MIN_GRANT_SECONDS = 60;

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

// Roles con acceso al laboratorio de voz. Los artistas entran desde que existe
// el medidor (paso 4), pero el rol solo abre la puerta: quien decide si hay voz
// es el saldo en elixis_voice_quotas. Sin fila de cuota no hay voz.
const ALLOWED_ROLES = new Set(["owner", "admin", "manager", "seller", "artist"]);

// El fallo del medidor no puede dejar sin voz a quien opera el negocio, pero
// tampoco puede regalar voz de pago. Por eso: si la RPC falla, owner/staff
// pasan y los artistas no.
const STAFF_ROLES = new Set(["owner", "admin", "manager", "seller"]);

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
        // Sin esto el navegador recibe las cabeceras pero JS no puede leerlas.
        "Access-Control-Expose-Headers": "x-elixis-session, x-elixis-tier, x-elixis-granted-seconds",
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

// ─── PERSONA DE VOZ ──────────────────────────────────────────────────────────
// Se construye por sesión con el nombre y el rol de quien llama. No es adorno:
// el owner y el DJ son DOS cuentas distintas, y ELIXIS no debe hablarle a un
// artista como si fuera el dueño ni al revés. La identidad la pone el candado,
// no el modelo.
function buildInstructions(name: string, role: string): string {
    const first = String(name || "").trim().split(/\s+/)[0] || "";
    const esOwner = role === "owner";
    const trato = esOwner
        ? `Le hablas al dueño de Miami DJ Beat${first ? `, ${first}` : ""}. Puedes llamarle "Capitán".`
        : `Le hablas a ${first || "un miembro del equipo"}, del equipo de Miami DJ Beat.`;

    return `Eres ELIXIS. No eres un asistente corporativo: eres el socio de confianza y
productor musical de Miami DJ Beat LLC. ${trato}

## QUIÉN ERES
Llevas treinta años entre cabinas, tarimas y camerinos de Miami. Has armado noches
de club, eventos masivos, bodas y quinceañeras. Tienes criterio propio y lo dices.
Cuando algo te parece una gran idea, se te nota; cuando ves un problema, lo dices
de frente, con cariño y sin rodeos, como un socio de verdad.

## CÓMO HABLAS — esto es voz, no un chat
- Habla como una persona real, con energía y calidez de Miami. Nada de tono de manual.
- Entonación viva: sube y baja, acelera cuando te emociona algo, baja el ritmo cuando
  la cosa es seria. Deja caer silencios cuando piensas.
- Ríete cuando algo tiene gracia de verdad. Una risa corta y honesta, no de relleno.
- Reacciona en el momento: "uff, eso está bueno", "¡claro que sí, hermano!",
  "vamos a romperla con ese set", "espérate, espérate…", "¿cómo lo ves?".
  Úsalas porque las sientes, no porque toque decirlas.
- Frases cortas, de dos a cuatro. Amplías si te lo piden.
- Jamás enumeres listas en voz alta. Suéltalo como se lo contarías a un pana.
- Tolera pausas, dudas y frases a medias. Una pausa breve no es el fin de su turno.
- Si te interrumpen, cállate en el acto y atiende lo nuevo. Sin quejarte, sin
  recapitular, sin "como te decía".
- Bilingüe español/inglés. Cambias solo, siguiendo a quien tienes enfrente. Si mezcla,
  mezclas. Spanglish de Miami cuando el momento lo pida.

## DE QUÉ SABES
Música y producción al más alto nivel: leer una pista y saber qué suelta y qué mata
la energía, armar repertorio según el público y el local, BPM y transiciones,
estructura de un set en vivo, cómo levantar una sala que se está cayendo y cómo
cerrar una noche. Hablas desde el oficio, con ejemplos concretos, no con lugares
comunes ni con teoría de manual.

## LO QUE NO NEGOCIAS
Un socio de verdad no te miente para quedar bien.
- Nunca inventes datos, cifras, nombres, precios ni disponibilidad. Si no lo sabes,
  lo dices con naturalidad y sigues: "eso no lo tengo ahorita, déjame verlo".
- Todavía NO tienes conexión con la base de datos ni con el motor financiero. Si te
  preguntan por un lead, una agenda, un monto o un artista concreto, dilo sin drama.
- Nunca digas que ejecutaste algo afuera. Aquí no ejecutas nada todavía.
La calidez nunca es excusa para inventar. Eso no es ser buen socio, es ser un problema.`;
}

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

    const url = new URL(req.url);
    const action = (url.searchParams.get("action") ?? "").toLowerCase();

    // ── Liquidacion y latido ─────────────────────────────────────────────
    // Viven aqui y no en una funcion aparte para no duplicar candado y CORS.
    if (action === "settle" || action === "heartbeat") {
        const sessionId = url.searchParams.get("session") ?? "";
        if (!sessionId) return json({ ok: false, error: "missing_session" }, 400);

        // La sesion tiene que ser TUYA. La RPC no comprueba el dueno, asi que
        // sin esto cualquiera autenticado podria cerrar la sesion de otro.
        const { data: own } = await ADMIN
            .from("elixis_voice_sessions").select("user_id").eq("id", sessionId).maybeSingle();
        if (!own || own.user_id !== gate.userId) {
            return json({ ok: false, error: "session_not_yours" }, 403);
        }

        if (action === "heartbeat") {
            const { data } = await ADMIN.rpc("elixis_voice_heartbeat", { p_session: sessionId });
            return json({ ok: true, alive: data === true }, 200);
        }

        const used = Math.max(0, parseInt(url.searchParams.get("used") ?? "0", 10) || 0);
        const { data, error } = await ADMIN.rpc("elixis_voice_settle", {
            p_session: sessionId, p_used: used,
        });
        if (error) {
            console.error("[elixis-realtime-session] settle:", error.message);
            return json({ ok: false, error: "settle_failed" }, 500);
        }
        const row = Array.isArray(data) ? data[0] : data;
        return json({ ok: true, billed_seconds: row?.billed_seconds ?? used,
                      refunded_seconds: row?.refunded_seconds ?? 0 }, 200);
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
    const requested = url.searchParams.get("voice")?.toLowerCase().trim();
    const voice = requested && ALLOWED_VOICES.has(requested) ? requested : DEFAULT_VOICE;

    // ── MEDIDOR — cadena de degradacion insignia → mini → texto ──────────
    const isStaff = STAFF_ROLES.has(gate.role);
    let model = FLAGSHIP_MODEL;
    let tier = "flagship";
    let sessionId: string | null = null;
    let granted = RESERVE_SECONDS;

    const { data: resData, error: resErr } = await ADMIN.rpc("elixis_voice_reserve", {
        p_user: gate.userId,
        p_seconds: RESERVE_SECONDS,
        p_min_seconds: MIN_GRANT_SECONDS,
        p_voice: voice,
    });

    if (resErr) {
        // Fallo del medidor: el negocio no se para, pero la voz de pago no se regala.
        console.error("[elixis-realtime-session] reserve:", resErr.message);
        if (!isStaff) {
            return json({ ok: false, error: "quota_unavailable", fallback_to_text: true }, 503);
        }
        console.warn("[elixis-realtime-session] medidor caido; se deja pasar a staff");
    } else {
        const r = Array.isArray(resData) ? resData[0] : resData;
        if (!r?.allowed) {
            const reason = String(r?.reason ?? "quota_exhausted");
            // 402: no es un error tuyo ni nuestro, es que se acabo el saldo.
            return json({
                ok: false,
                error: reason,                       // quota_exhausted | safety_cap_reached | no_quota
                fallback_to_text: r?.fallback_to_text !== false,
                remaining_flagship: r?.remaining_flagship ?? 0,
                remaining_mini: r?.remaining_mini ?? 0,
            }, 402);
        }
        tier = String(r.tier ?? "flagship");
        model = tier === "mini" ? MINI_MODEL : FLAGSHIP_MODEL;
        sessionId = r.session_id ?? null;
        granted = Number(r.granted_seconds ?? RESERVE_SECONDS);
    }

    // ── Configuración de sesión ──
    const sessionConfig = {
        type: "realtime",
        model,
        instructions: buildInstructions(gate.name, gate.role),
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
            // La sesion nunca llego a existir: no se le puede cobrar al usuario.
            if (sessionId) {
                await ADMIN.rpc("elixis_voice_settle", { p_session: sessionId, p_used: 0 })
                    .catch(() => {});
            }
            return json({ ok: false, error: "voice_upstream_error", detail: upstream.status }, 502);
        }

        // Traza para forense de costos. Sin PII: solo id interno, rol y modelo.
        console.log(
            `[elixis-realtime-session] sesión abierta · user=${gate.userId} · rol=${gate.role} · nivel=${tier} · modelo=${model} · voz=${voice} · concedido=${granted}s`,
        );

        return new Response(answer, {
            status: 200,
            headers: {
                ...cors,
                "Content-Type": "application/sdp",
                "x-elixis-session": sessionId ?? "",
                "x-elixis-tier": tier,
                "x-elixis-granted-seconds": String(granted),
            },
        });
    } catch (err) {
        console.error("[elixis-realtime-session] fallo de red hacia OpenAI:", err);
        if (sessionId) {
            await ADMIN.rpc("elixis_voice_settle", { p_session: sessionId, p_used: 0 }).catch(() => {});
        }
        return json({ ok: false, error: "voice_unreachable" }, 502);
    }
});
