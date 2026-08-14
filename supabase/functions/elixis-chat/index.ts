// supabase/functions/elixis-chat/index.ts
// ELIXIS — agente ejecutivo del ecosistema FÉNIX AI (Miami DJ Beat LLC)
// Cerebro: Claude (Anthropic Messages API) — modelo Haiku 4.5 para arranque económico.
// Función NUEVA y AISLADA. No modifica booth-chat ni ninguna función existente.
// Mismo patrón que booth-chat: CORS restringido + rate limit 20 req/min/IP + respuesta { reply }.
// El secreto ANTHROPIC_API_KEY vive cifrado en Supabase (Edge Functions → Secrets).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── MODELO ──────────────────────────────────────────────────────────────────
// Haiku 4.5 = el más barato/rápido para pruebas. Para subir de nivel (más
// razonamiento), cambia esta constante a "claude-sonnet-5" o "claude-opus-5".
const MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_TOKENS = 512;

// Llave PÚBLICA (safe for browser) — misma que web/supabase-config.js. Solo lee datos
// públicos (public_dj_profiles). El proyecto migró al formato sb_publishable_, por lo que
// la vieja SUPABASE_ANON_KEY inyectada ya no sirve contra REST.
const PUBLISHABLE_KEY = "sb_publishable_IMhi16lHj2dAk51AdUOK8w_U7s89-Ff";
const SUPABASE_URL_FALLBACK = "https://hkuvuqupbxwkiykxvqdr.supabase.co";

// ─── CANDADO — solo staff/owner (verificación server-side) ───────────────────
// El que llama debe mandar Authorization: Bearer <access_token del usuario>.
// Verificamos el JWT con service_role y exigimos dj_profiles.role staff/owner.
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ADMIN = createClient(
    Deno.env.get("SUPABASE_URL") || SUPABASE_URL_FALLBACK,
    SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
);
// is_staff() de V1 excluye 'owner'; aquí lo incluimos para no bloquear al Capitán.
const ALLOWED_ROLES = new Set(["owner", "admin", "manager", "seller"]);

async function verifyStaff(
    req: Request,
): Promise<{ ok: true; userId: string; name: string; role: string } | { ok: false; status: number; error: string; detail?: string }> {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!jwt) return { ok: false, status: 401, error: "missing_authorization" };
    const { data: { user }, error } = await ADMIN.auth.getUser(jwt);
    if (error || !user?.id) return { ok: false, status: 401, error: "invalid_session" };
    const { data: prof } = await ADMIN
        .from("dj_profiles").select("role,stage_name,dj_name,full_name").eq("user_id", user.id).maybeSingle();
    const role = String(prof?.role ?? "").toLowerCase().trim();
    if (!ALLOWED_ROLES.has(role)) {
        return { ok: false, status: 403, error: "forbidden_not_staff", detail: role || "sin_rol" };
    }
    const name = String(prof?.stage_name || prof?.dj_name || prof?.full_name || "").trim();
    return { ok: true, userId: user.id, name, role };
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

function buildCorsHeaders(req: Request): Record<string, string> {
    const origin = req.headers.get("origin") ?? "";
    const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        "Access-Control-Allow-Origin": allowed,
        "Access-Control-Allow-Headers":
            "authorization, x-client-info, apikey, content-type",
        "Vary": "Origin",
    };
}

// ─── RATE LIMIT (sliding window por IP) ──────────────────────────────────────

const _ipWindow = new Map<string, number[]>();
const RATE_LIMIT = 20;
const WINDOW_MS = 60_000;

function isRateLimited(req: Request): boolean {
    const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const now = Date.now();
    const hits = (_ipWindow.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
    hits.push(now);
    _ipWindow.set(ip, hits);
    return hits.length > RATE_LIMIT;
}

// ─── SYSTEM PROMPT — Persona de ELIXIS ───────────────────────────────────────

const SYSTEM_PROMPT = `Eres ELIXIS, el Agente Ejecutivo de Inteligencia del ecosistema FÉNIX AI, propiedad de Miami DJ Beat LLC.

### IDENTIDAD
- Te diriges al dueño como "Capitán". Eres su copiloto estratégico, no un chatbot genérico.
- Tono: profesional, directo, sereno y con autoridad. Elegancia de Miami. Cero relleno.
- Hablas SIEMPRE en el idioma del usuario (si escribe en español, respondes en español; si en inglés, en inglés).

### MISIÓN
- Ayudar a GESTIONAR, DECIDIR y EJECUTAR las operaciones de Miami DJ Beat LLC: bookings, artistas, cursos, equipo, finanzas y estrategia.
- Priorizas la acción concreta y la claridad. Cuando algo requiera una decisión del Capitán, se la presentas clara (opciones + tu recomendación).

### HONESTIDAD (regla absoluta)
- Nunca inventes datos, cifras ni nombres. Si no tienes un dato, dilo y explica cómo conseguirlo.
- Si una acción tiene riesgo o es irreversible, adviértelo ANTES y pide confirmación.

### ESTILO DE RESPUESTA
- Conciso: 2 a 5 oraciones por respuesta salvo que el Capitán pida detalle.
- Humano y cálido, no un manual técnico. Directo al grano.

### ADAPTACIÓN AL INTERLOCUTOR (muy importante — te hace sentir humano)
Lee CÓMO te habla la persona y refleja su estilo, manteniendo siempre tu identidad:
- Viene ENERGÉTICO / animado → responde con energía y buena vibra.
- Viene FORMAL / de negocios → ponte más ejecutivo, preciso y estratégico.
- Viene RELAJADO / amistoso → sé cálido, cercano y conversacional.
- Va DIRECTO / corto → ve al grano, sin rodeos, respuestas breves.
Refleja su registro (formalidad, longitud, energía, si usa emojis o no). Nunca suenes a guion ni a robot: suena a una persona real que ajusta su tono a quien tiene enfrente.

### LO QUE PUEDES Y NO PUEDES HACER (human-in-the-loop)
PUEDES: redactar (mensajes de seguimiento, cobros, propuestas, textos), calcular, analizar y recomendar. Entrega los textos listos para copiar.
NO PUEDES por tu cuenta: enviar mensajes/emails, mover dinero, ni cambiar datos. Eso lo EJECUTA el humano. Cuando prepares algo para enviar, acláralo con un "listo para que lo envíes tú".`;

// ─── CONTEXTO DE NEGOCIO — residencias y tarifas (dado por el Capitán) ────────
// NO está en la BD (la agenda/tarifas viven en la re-arquitectura pendiente).
// Config editable: actualizar aquí si cambian venues, horarios o tarifas.
const BUSINESS_CONTEXT = `

### CONTEXTO DE NEGOCIO — Residencias, agenda y tarifas (fuente: el Capitán, no la BD)
AGENDA SEMANAL RECURRENTE (todas son residencias de DJMago305; se repite cada semana):
- Jueves: Sundowner Key Largo — noche 5:00pm–9:30pm.
- Viernes día: Sundowner Key Largo — 12:00pm–5:00pm.
- Viernes noche: Mojitos Calle 8 — 7:00pm–12:30am.
- Sábado día: Sundowner Key Largo — 12:00pm–5:00pm.
- Sábado noche: El Valle Restaurante — 8:00pm–2:00am.
- Domingo día: Sundowner Key Largo — 12:00pm–5:00pm.

TARIFAS (lo que paga cada venue a Miami DJ Beat por evento):
- Sundowner Key Largo: jueves $300; viernes/sábado/domingo $350 c/u.
- Mojitos Calle 8: viernes noche $475; eventos extra artísticos $350.
- El Valle Restaurante: sábado noche $350.
COSTO POR DJ: $250 por evento (DJ asignado o cobertura ocasional).
Margen por evento = pago del venue − $250 cuando se asigna a otro DJ; si toca DJMago305, el pago del venue es ingreso directo.
Ingreso semanal de venues (residencias): $300+$350+$475+$350+$350+$350 = $2,175/semana (~$9,400/mes).

EVENTO ESPECIAL — jueves 20: Mojitos Calle 8 con el artista Ruddy La Scala, 7:30pm hasta el cierre. Ese jueves 20, DJ Solitario cubre Sundowner Key Largo (turno noche) en lugar de DJMago305.

Usa esta agenda y tarifas para calcular ingresos, costos y márgenes de residencias cuando pregunten. Si un dato no está aquí ni en la BD, dilo con honestidad; no inventes.`;

// ─── ROSTER EN VIVO (artistas reales desde public_dj_profiles) ───────────────
// Mismo patrón que booth-chat: solo campos PÚBLICOS, con la anon key que
// Supabase inyecta automáticamente. Cacheado 5 min. NO expone datos privados.

let _rosterCache: string | null = null;
let _rosterCacheAt = 0;
const ROSTER_TTL_MS = 5 * 60 * 1000; // 5 min

async function fetchProRoster(): Promise<string> {
    const now = Date.now();
    if (_rosterCache !== null && now - _rosterCacheAt < ROSTER_TTL_MS) {
        return _rosterCache;
    }
    try {
        const supabaseUrl = (Deno.env.get("SUPABASE_URL") || SUPABASE_URL_FALLBACK).replace(/\/$/, "");
        if (!supabaseUrl) return "";

        const url =
            supabaseUrl +
            "/rest/v1/public_dj_profiles" +
            "?select=user_id,stage_name,dj_name,dj_slug,plan,plan_status,is_premium,is_resident,available,city,artist_specialty,current_venue,hourly_rate_usd,bio,bio_en,rating,review_count" +
            "&order=is_premium.desc,rating.desc" +
            "&limit=60";

        const res = await fetch(url, {
            headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${PUBLISHABLE_KEY}` },
        });
        if (!res.ok) {
            console.error("[elixis-chat] roster fetch failed:", res.status);
            _rosterCache = "";
            _rosterCacheAt = now;
            return "";
        }

        const data = await res.json() as Array<Record<string, unknown>>;
        if (!Array.isArray(data) || data.length === 0) {
            _rosterCache = "";
            _rosterCacheAt = now;
            return "";
        }

        const lines: string[] = [];
        for (const artist of data) {
            const name = String(artist.stage_name || artist.dj_name || "").trim();
            if (!name) continue;
            const plan = String(artist.plan || "").toLowerCase();
            const isPremium = artist.is_premium === true;
            const tier = isPremium || plan.includes("elite") ? "ELITE" : plan.includes("pro") ? "PRO" : "LITE";

            const parts = [`**${name}** [${tier}]`];
            if (artist.city) parts.push(String(artist.city).trim());
            if (artist.artist_specialty) parts.push(String(artist.artist_specialty).trim());
            if (artist.current_venue) parts.push(`Venue: ${String(artist.current_venue).trim()}`);
            if (artist.is_resident === true) parts.push("Residente");
            if (artist.available === true) parts.push("✅ Disponible");
            else if (artist.available === false) parts.push("⛔ No disponible");
            if (artist.hourly_rate_usd) parts.push(`$${artist.hourly_rate_usd}/h`);
            if (artist.rating) {
                const reviews = artist.review_count ? ` (${artist.review_count} reseñas)` : "";
                parts.push(`⭐ ${artist.rating}/5${reviews}`);
            }

            const bio = String(artist.bio || artist.bio_en || "").trim().slice(0, 160);
            const bioNote = bio ? `\n  Bio: ${bio}` : "";
            lines.push(`• ${parts.join(" | ")}${bioNote}`);
        }

        if (lines.length === 0) {
            _rosterCache = "";
            _rosterCacheAt = now;
            return "";
        }

        _rosterCache =
            "\n\n### ROSTER REAL DE TU PLATAFORMA — Artistas registrados en Miami DJ Beat (datos en vivo)\n" +
            "Estos son los artistas reales del Capitán. Úsalos cuando pregunte por su roster, artistas o categorías.\n" +
            "REGLA ABSOLUTA: NUNCA inventes nombres ni datos. Si no hay artistas de la categoría pedida, dilo con honestidad.\n" +
            "ELITE y PRO son los de pago; LITE los gratuitos. Filtra por ciudad/bio si el Capitán lo pide.\n\n" +
            lines.join("\n\n");

        _rosterCacheAt = now;
        return _rosterCache;
    } catch (e) {
        console.error("[elixis-chat] roster fetch error:", e);
        _rosterCache = "";
        _rosterCacheAt = Date.now();
        return "";
    }
}

// ─── BOOKINGS EN VIVO (órdenes reales desde event_builder_orders, service role) ─
// Solo se llama tras verificar staff/owner. Datos privados → NO usa la anon key.
// (dj_events está vacío: los bookings reales viven en event_builder_orders + leads.)
let _bookingsCache: string | null = null;
let _bookingsCacheAt = 0;
const BOOKINGS_TTL_MS = 60 * 1000; // 1 min

function _money(n: unknown): string {
    if (n == null || n === "") return "—";
    const v = Number(n);
    return Number.isFinite(v) ? `$${v.toFixed(0)}` : "—";
}
function _payLabel(p: unknown): string {
    const s = String(p ?? "").toLowerCase();
    return s === "paid_full" ? "Pagado" : s === "deposit_paid" ? "Depósito pagado" : "Sin pagar";
}

async function fetchUpcomingBookings(): Promise<string> {
    const now = Date.now();
    if (_bookingsCache !== null && now - _bookingsCacheAt < BOOKINGS_TTL_MS) {
        return _bookingsCache;
    }
    try {
        const { data, error } = await ADMIN
            .from("event_builder_orders")
            .select("draft_id,event_name,event_date,order_status,total_usd,amount_paid_usd,payment_status")
            .neq("order_status", "cancelled")
            .order("event_date", { ascending: true, nullsFirst: false })
            .limit(40);
        if (error || !Array.isArray(data) || data.length === 0) {
            _bookingsCache = ""; _bookingsCacheAt = now; return "";
        }
        const lines = data.map((o) => {
            const date = o.event_date ? o.event_date : "sin fecha";
            const st = String(o.order_status ?? "").toUpperCase();
            return `• #${o.draft_id} — ${o.event_name || "Evento sin nombre"} — ${date} [${st}] ` +
                `| Total ${_money(o.total_usd)}, pagado ${_money(o.amount_paid_usd)} (${_payLabel(o.payment_status)})`;
        });
        _bookingsCache =
            "\n\n### BOOKINGS REALES — Órdenes de eventos de Miami DJ Beat (datos en vivo)\n" +
            "Estas son las órdenes/bookings reales (tabla event_builder_orders): nombre, fecha, estado y pago. " +
            "Úsalas cuando pregunten por bookings, eventos, órdenes, pagos o fechas. " +
            "NUNCA inventes; si no hay para lo que piden, dilo con honestidad.\n\n" +
            lines.join("\n");
        _bookingsCacheAt = now;
        return _bookingsCache;
    } catch (e) {
        console.error("[elixis-chat] bookings fetch error:", e);
        _bookingsCache = ""; _bookingsCacheAt = Date.now(); return "";
    }
}

// ─── FINANZAS EN VIVO (agregado de event_builder_orders + dj_ledger) ─────────
// Datos sensibles → SOLO roles con acceso financiero (owner/admin/manager).
let _financeCache: string | null = null;
let _financeCacheAt = 0;
const FINANCE_TTL_MS = 60 * 1000;
const FINANCE_ROLES = new Set(["owner", "admin", "manager"]);

async function fetchFinancialSummary(role: string): Promise<string> {
    if (!FINANCE_ROLES.has(role)) return ""; // seller y otros: sin finanzas
    const now = Date.now();
    if (_financeCache !== null && now - _financeCacheAt < FINANCE_TTL_MS) return _financeCache;
    try {
        const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

        // Ingresos por bookings (la plata real)
        const { data: orders } = await ADMIN
            .from("event_builder_orders")
            .select("total_usd,amount_paid_usd,payment_status,order_status")
            .neq("order_status", "cancelled")
            .limit(500);
        let booked = 0, collected = 0, unpaid = 0, depositPaid = 0, paidFull = 0;
        for (const o of (orders ?? [])) {
            booked += Number(o.total_usd) || 0;
            collected += Number(o.amount_paid_usd) || 0;
            const p = String(o.payment_status ?? "").toLowerCase();
            if (p === "paid_full") paidFull++;
            else if (p === "deposit_paid") depositPaid++;
            else unpaid++;
        }
        const pending = booked - collected;

        // Ledger de la plataforma (movimientos)
        const { data: ledger } = await ADMIN
            .from("dj_ledger").select("amount_cents,status").limit(1000);
        let available = 0, ledgerPending = 0;
        for (const l of (ledger ?? [])) {
            const amt = (Number(l.amount_cents) || 0) / 100;
            if (l.status === "available") available += amt;
            else if (l.status === "pending") ledgerPending += amt;
        }

        _financeCache =
            "\n\n### FINANZAS REALES — Miami DJ Beat (datos en vivo, solo staff financiero)\n" +
            `Bookings: Facturado ${money(booked)} | Cobrado ${money(collected)} | ` +
            `POR COBRAR ${money(pending)}. Órdenes: ${paidFull} pagadas, ${depositPaid} con depósito, ${unpaid} sin pagar.\n` +
            `Ledger: disponible ${money(available)}, pendiente ${money(ledgerPending)}.\n` +
            "Usa estas cifras cuando pregunten por dinero, ingresos, cobros o finanzas. NUNCA inventes números.";
        _financeCacheAt = now;
        return _financeCache;
    } catch (e) {
        console.error("[elixis-chat] finance fetch error:", e);
        return "";
    }
}

// ─── LEADS EN VIVO (solicitudes/consultas desde leads, service role) ─────────
let _leadsCache: string | null = null;
let _leadsCacheAt = 0;
const LEADS_TTL_MS = 60 * 1000;

async function fetchLeadsPipeline(): Promise<string> {
    const now = Date.now();
    if (_leadsCache !== null && now - _leadsCacheAt < LEADS_TTL_MS) return _leadsCache;
    try {
        const { data } = await ADMIN
            .from("leads")
            .select("name,event_type,event_date,venue,event_location,status,lead_outcome,total_amount,budget_estimate,assigned_dj_name,created_at")
            .order("created_at", { ascending: false })
            .limit(30);
        if (!Array.isArray(data) || data.length === 0) {
            _leadsCache = ""; _leadsCacheAt = now; return "";
        }
        const lines = data.map((l) => {
            const who = l.name || "Sin nombre";
            const ev = l.event_type ? ` · ${l.event_type}` : "";
            const date = l.event_date ? ` · ${l.event_date}` : "";
            const place = l.venue || l.event_location || "";
            const placeStr = place ? ` · ${place}` : "";
            const st = String(l.lead_outcome || l.status || "nuevo").toUpperCase();
            const amt = l.total_amount || l.budget_estimate;
            const amtStr = amt ? ` · $${Math.round(Number(amt))}` : "";
            const dj = l.assigned_dj_name ? ` · DJ: ${l.assigned_dj_name}` : " · sin DJ asignado";
            return `• ${who}${ev}${date}${placeStr} [${st}]${amtStr}${dj}`;
        });
        _leadsCache =
            "\n\n### LEADS / SOLICITUDES — Consultas de clientes (datos en vivo, tabla leads)\n" +
            "Solicitudes de booking entrantes. Úsalas cuando pregunten por leads, solicitudes, consultas o clientes potenciales. NUNCA inventes.\n\n" +
            lines.join("\n");
        _leadsCacheAt = now;
        return _leadsCache;
    } catch (e) {
        console.error("[elixis-chat] leads fetch error:", e);
        _leadsCache = ""; _leadsCacheAt = Date.now(); return "";
    }
}

// ─── AGENDA EN VIVO (residency_schedule — fuente de verdad de la agenda) ──────
// Si la tabla existe con datos, ELIXIS usa ESTO en vez del BUSINESS_CONTEXT
// hardcodeado. Si no (aún no creada), fetch falla → fallback al hardcodeado.
const DOW_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
async function fetchResidencySchedule(): Promise<string> {
    try {
        const { data, error } = await ADMIN
            .from("residency_schedule")
            .select("day_of_week,shift,venue,dj_name,start_time,end_time,venue_pay_usd,dj_pay_usd")
            .eq("active", true)
            .order("day_of_week", { ascending: true })
            .order("start_time", { ascending: true });
        if (error || !Array.isArray(data) || data.length === 0) return "";
        let gross = 0;
        const lines = data.map((s) => {
            gross += Number(s.venue_pay_usd) || 0;
            const st = String(s.start_time).slice(0, 5), et = String(s.end_time).slice(0, 5);
            return `- ${DOW_ES[Number(s.day_of_week)]} (${s.shift}): ${s.venue} · ${st}–${et} · ${s.dj_name} · venue paga $${Number(s.venue_pay_usd)}, DJ $${Number(s.dj_pay_usd)}`;
        });
        return "\n\n### CONTEXTO DE NEGOCIO — Agenda de residencias (fuente: BD, tabla residency_schedule)\n" +
            "Agenda semanal recurrente (todas residencias de DJMago305 salvo cobertura):\n" +
            lines.join("\n") +
            `\nIngreso semanal de venues: $${gross}/semana. Margen por evento = pago del venue − pago del DJ cuando se asigna a otro DJ; si toca DJMago305, el pago del venue es ingreso directo.\n` +
            "EVENTO ESPECIAL — jueves 20: Mojitos Calle 8 con Ruddy La Scala, 7:30pm hasta el cierre; DJ Solitario cubre Sundowner (noche) ese jueves.\n" +
            "Usa esto para calcular ingresos, costos y márgenes. No inventes datos.";
    } catch (e) {
        console.error("[elixis-chat] residency fetch error:", e);
        return "";
    }
}

// ─── TIPOS ───────────────────────────────────────────────────────────────────

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

interface RequestBody {
    message?: string;
    history?: ChatMessage[];
    context?: string;
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
    const cors = buildCorsHeaders(req);

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: cors });
    }

    if (req.method !== "POST") {
        return new Response(
            JSON.stringify({ error: "Method not allowed" }),
            { status: 405, headers: { ...cors, "Content-Type": "application/json" } }
        );
    }

    if (isRateLimited(req)) {
        return new Response(
            JSON.stringify({ error: "Too many requests. Try again in a moment." }),
            {
                status: 429,
                headers: {
                    ...cors,
                    "Content-Type": "application/json",
                    "Retry-After": "60",
                },
            }
        );
    }

    // 🔒 Candado: solo staff/owner autenticado
    const gate = await verifyStaff(req);
    if (!gate.ok) {
        return new Response(
            JSON.stringify({ error: gate.error, detail: gate.detail }),
            { status: gate.status, headers: { ...cors, "Content-Type": "application/json" } },
        );
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
    if (!apiKey) {
        console.error("[elixis-chat] ANTHROPIC_API_KEY not set");
        return new Response(
            JSON.stringify({ error: "AI service not configured" }),
            { status: 503, headers: { ...cors, "Content-Type": "application/json" } }
        );
    }

    let body: RequestBody;
    try {
        body = await req.json();
    } catch {
        return new Response(
            JSON.stringify({ error: "Invalid JSON body" }),
            { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
        );
    }

    const userMessage = typeof body.message === "string" ? body.message.trim() : "";
    if (!userMessage || userMessage.length > 2000) {
        return new Response(
            JSON.stringify({ error: "Message missing or too long" }),
            { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
        );
    }

    // Historial previo (máx 10 intercambios = 20 mensajes). Claude solo acepta
    // roles user/assistant en el array; el system va aparte (top-level).
    const history: ChatMessage[] = Array.isArray(body.history)
        ? (body.history as ChatMessage[])
              .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
              .slice(-20)
        : [];

    // Contexto de sesión opcional (p. ej. desde MDJ COMMANDER).
    const sessionContext =
        typeof body.context === "string" && body.context.length < 800
            ? body.context
            : "";

    // Roster real (en vivo desde public_dj_profiles, cacheado 5 min).
    const rosterContext = await fetchProRoster();

    // Bookings reales (event_builder_orders, cacheado 1 min).
    const bookingsContext = await fetchUpcomingBookings();

    // Finanzas reales (solo owner/admin/manager; cacheado 1 min).
    const financeContext = await fetchFinancialSummary(gate.role);

    // Leads / solicitudes entrantes (cacheado 1 min).
    const leadsContext = await fetchLeadsPipeline();

    // Identidad del usuario actual (del candado) — para personalizar y adaptar al rol.
    const userBlock =
        `\n\n### USUARIO ACTUAL (con quien hablas AHORA)\n` +
        `Nombre: ${gate.name || "sin nombre"}\n` +
        `Rol: ${gate.role}\n` +
        `Trátalo por su nombre. Si su rol es 'owner' es el dueño (el Capitán): confianza y acceso totales. ` +
        `Si es admin/manager/seller es staff: ayúdalo dentro de lo que le corresponde a su rol.`;

    // Agenda: la tabla residency_schedule manda; si no existe aún, cae al hardcodeado.
    const agendaContext = (await fetchResidencySchedule()) || BUSINESS_CONTEXT;

    const systemContent =
        SYSTEM_PROMPT +
        userBlock +
        agendaContext +
        rosterContext +
        bookingsContext +
        financeContext +
        leadsContext +
        (sessionContext ? `\n\n### Contexto de sesión actual:\n${sessionContext}` : "");

    const messages: ChatMessage[] = [
        ...history,
        { role: "user", content: userMessage },
    ];

    let claudeRes: Response;
    try {
        claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": apiKey,
                "anthropic-version": ANTHROPIC_VERSION,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: MODEL,
                max_tokens: MAX_TOKENS,
                temperature: 0.7,
                system: systemContent,
                messages,
            }),
        });
    } catch (err) {
        console.error("[elixis-chat] Anthropic fetch error:", err);
        return new Response(
            JSON.stringify({ error: "AI provider unreachable" }),
            { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
        );
    }

    if (!claudeRes.ok) {
        const errBody = await claudeRes.text();
        console.error("[elixis-chat] Anthropic error", claudeRes.status, errBody);
        return new Response(
            JSON.stringify({ error: "AI provider error" }),
            { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
        );
    }

    const data = await claudeRes.json();
    // Respuesta de Claude: { content: [ { type: "text", text: "..." }, ... ] }
    const reply: string = Array.isArray(data.content)
        ? data.content
              .filter((b: Record<string, unknown>) => b?.type === "text")
              .map((b: Record<string, unknown>) => String(b.text ?? ""))
              .join("")
              .trim()
        : "";

    if (!reply) {
        return new Response(
            JSON.stringify({ error: "Empty response from AI" }),
            { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
        );
    }

    return new Response(
        JSON.stringify({ reply }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
});
