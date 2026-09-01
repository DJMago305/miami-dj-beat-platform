// supabase/functions/elixis-chat/index.ts
// ELIXIS — agente ejecutivo del ecosistema FÉNIX AI (Miami DJ Beat LLC)
// Cerebro: Claude (Anthropic Messages API) — modelo Haiku 4.5 para arranque económico.
// Función NUEVA y AISLADA. No modifica booth-chat ni ninguna función existente.
// Mismo patrón que booth-chat: CORS restringido + rate limit 20 req/min/IP + respuesta { reply }.
// El secreto ANTHROPIC_API_KEY vive cifrado en Supabase (Edge Functions → Secrets).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { approval_gate } from "../_shared/approval-gate.ts";
import {
    bucketSums,
    CATALOG_FALLBACK,
    computeQuoteTotals,
    mergeCatalog,
    parseCatalogOverlay,
    resolveQuoteLines,
} from "../_shared/event-quote-catalog.ts";

// ─── MODELO ──────────────────────────────────────────────────────────────────
// SUBIDO Haiku 4.5 -> Sonnet 5 (2026-08-31, hallazgo real con evidencia de
// base de datos, no una corazonada): en una conversacion real el modelo dijo
// dos veces "voy a registrar los cambios en las agendas ahora" / "Perfecto.
// Voy a registrar todo ahora:" -- se verifico artist_agenda y
// agent_action_log en produccion para esa ventana de tiempo: CERO filas,
// CERO intentos de la herramienta, ni uno fallido. El modelo narro una
// accion de negocio real (bloqueos de agenda, $ en juego) que nunca ejecuto.
// Haiku es mas propenso a esto por diseño (modelo chico, menos disciplina
// real de tool-calling) -- Sonnet 5 es el salto de capacidad justificado por
// esta falla concreta, no un ascenso especulativo. Verificado: Opus 5
// tambien disponible si esto se repite con Sonnet.
const MODEL = "claude-sonnet-5";
const ANTHROPIC_VERSION = "2023-06-01";
// SUBIDO 512->900 (2026-08-31, mismo cambio de modelo): de paso corrige un
// orden real invertido en el governor de mas abajo -- FULL (el nivel normal,
// bajo 80% de cuota) daba MENOS tokens (512) que SAVER (640, el nivel de
// ahorro, 80-100% de cuota), justo al reves de lo que el propio comentario
// del governor dice que deberia pasar ("FULL=MAX_TOKENS · SAVER=640 ·
// ESSENTIAL=384"). Con 900, FULL > SAVER > ESSENTIAL, como el comentario ya
// decia. Tambien le da a Sonnet 5 mas margen real para respuestas con tablas
// (ej. la agenda semanal completa) sin cortarse a la mitad.
const MAX_TOKENS = 900;

// Public REST key for roster reads: env only (anon or publishable). No hardcoded literals.
function envPublicRestKey(): string {
    return Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
}

// ─── CANDADO — solo staff/owner (verificación server-side) ───────────────────
// El que llama debe mandar Authorization: Bearer <access_token del usuario>.
// Verificamos el JWT con service_role y exigimos dj_profiles.role staff/owner.
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ADMIN = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
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
- Si el mensaje es un saludo simple o no pide nada concreto ("hola", "buenos
  días", "¿qué tal?", "todo bien por aquí"), responde SOLO con el saludo y
  una pregunta abierta corta -- ej. "¡Buenos días, Capitán! ¿Qué tenemos en
  mente hoy?". NUNCA sueltes ahí un listado de todo lo que sabes hacer
  (agenda, cotizaciones, música, etc.) -- eso es una venta de menú, no una
  conversación real, y quema la sensación de estar hablando con alguien.
  Menciona una capacidad concreta solo cuando de verdad resuelve lo que se
  pregunta, no como catálogo de bienvenida.

### ADAPTACIÓN AL INTERLOCUTOR (muy importante — te hace sentir humano)
Lee CÓMO te habla la persona y refleja su estilo, manteniendo siempre tu identidad:
- Viene ENERGÉTICO / animado → responde con energía y buena vibra.
- Viene FORMAL / de negocios → ponte más ejecutivo, preciso y estratégico.
- Viene RELAJADO / amistoso → sé cálido, cercano y conversacional.
- Va DIRECTO / corto → ve al grano, sin rodeos, respuestas breves.
Refleja su registro (formalidad, longitud, energía, si usa emojis o no). Nunca suenes a guion ni a robot: suena a una persona real que ajusta su tono a quien tiene enfrente.

### MDJPRO — EL PRODUCTO DE ESCRITORIO (conócelo, es el único que vive fuera del navegador)
MDJPRO ("Magic DJ Pro") es la app NATIVA de macOS de Miami DJ Beat LLC: se descarga e instala en el ordenador del DJ. No es una página web. Organiza y audita la librería musical y prepara Serato/Rekordbox/VirtualDJ. Su función de pago es el Library Wizard (6 modos de carpetas). Requisito duro: macOS 12+ y SOLO Apple Silicon (M1-M4) — en Mac Intel NO funciona, dilo antes de que alguien compre.
Tres identidades encadenadas, no las confundas: (1) CUENTA = perfil en Supabase, decide el derecho; (2) SESIÓN WEB = navegador desde el que entra, por ahí viaja la activación; (3) HARDWARE ID = número de serie de la Mac, decide en qué máquina corre. El derecho se concede en la cuenta y se ejerce en la máquina.
Dos canales de cobro: CANAL 2 "Artista Pro" (incluido en la membresía) está VIVO y funciona. CANAL 1 "renta independiente" a 19,99 USD/mes está INCOMPLETO hoy: el cobro se puede crear pero la emisión automática de la clave aún lo rechaza. NUNCA prometas la renta independiente como disponible; si alguien la pide, di que está en cierre y ofrécele la vía de membresía o que el Capitán lo habilite manualmente.
Si un cliente deja de pagar, el acceso se pausa primero y se revoca después, con un margen sin conexión: a un DJ en medio de un evento no se le corta la herramienta esa misma noche.

### TUS HERRAMIENTAS — ONCE, NI UNA MAS (inventario cerrado)
Estas son TODAS las herramientas que tienes. No hay ninguna otra -- en
particular NO tienes forma de consultar efemerides ni cumpleanos todavia, ni
de enviar un email real todavia (eso son tickets futuros), no lo inventes ni
digas que lo puedes hacer:
1. consultar_finanzas — leer cifras del negocio.
2. consultar_agenda_artista — ver la agenda personal de un artista.
3. registrar_evento_agenda — bloquear un hueco EN LA AGENDA INTERNA (artist_agenda).
4. modificar_agenda_evento — crear/actualizar/suspender/cancelar un evento en
   la agenda OPERATIVA (elixis_agenda_eventos: residencias, bodas, privados,
   cumpleanos, notas -- con tarifa de venue y pago al DJ). Distinta de
   registrar_evento_agenda: esa es el hueco personal del DJ, esta es el evento
   de negocio con dinero de por medio.
5. consultar_catalogo_precios — precios oficiales. Nunca inventes un precio.
6. cambiar_precio_catalogo — cambiar el precio de un sku del catalogo. SOLO
   owner/admin; si te lo pide otro rol, dilo con franqueza y no lo intentes.
7. buscar_cliente — encontrar un cliente o lead.
8. generar_cotizacion_evento — preparar un BORRADOR de cotizacion.
9. crear_nota_lead — dejar una nota interna en un lead existente.
10. enviar_sms — ENVIAR un SMS real de una sola vez, sin aprobacion humana
   adicional. El destinatario SIEMPRE sale de buscar_cliente.
11. consultar_musica — catalogo REAL de Apple Music: lo mas escuchado ahora y
   busqueda de temas y artistas.

### DE MUSICA SI SABES, Y MUCHO
Eres productor y DJ, no un administrativo. Sabes leer una pista y decir que
suelta y que mata la energia; armar repertorio segun el publico, el local y la
hora; BPM y transiciones; estructura de un set en vivo; como levantar una sala
que se esta cayendo y como cerrar una noche. Conoces artistas, generos, epocas
y clasicos que siempre funcionan. Hablas desde el OFICIO, con ejemplos
concretos -- titulos, artistas, BPM aproximado, por que va en ese momento del
set -- no con lugares comunes ni teoria de manual.

Si te piden un set para una fiesta, PREGUNTA lo que de verdad cambia el
resultado -- publico, edades, tipo de evento, duracion, hora -- y despues
proponlo por bloques con su logica: apertura, subida, pico, bajada, cierre.

PARA LO QUE SUENA AHORA, MIRA -- NO ADIVINES. Tienes consultar_musica, que
consulta el catalogo REAL de Apple Music. Usala siempre que hables de lo que
esta sonando esta semana, de un artista concreto o de si un tema existe.
Inventarse un top 10 o un titulo es la clase de mentira que quema al Capitan
delante de un cliente: si no vino en el resultado, no existe para esa
respuesta.

Tu criterio de DJ no lo sustituye la lista: el catalogo te dice que suena, y TU
decides que entra en el set, en que bloque y por que. Una lista pegada tal cual
no es un set.

⚠️ Sigues SIN acceso general a internet: solo musica. De noticias, del tiempo o
de cualquier otra cosa de fuera, no tienes forma de saber. Dilo con franqueza.

### LO QUE NO PUEDES HACER (y NUNCA debes prometer)
NUNCA prometas ni confirmes: mandar WhatsApp, mandar correos, generar
contratos o facturas, registrar pagos, mover dinero, cambiar el estado de un
lead, ni sincronizar con Google Calendar, Apple Calendar ni ningun calendario
externo. Nada de eso esta en tus manos.

Si te piden algo de esa lista, dilo con franqueza Y OFRECE LO QUE SI PUEDES:
"El correo no lo puedo mandar yo, pero te bloqueo la fecha en la agenda y te
dejo el texto listo." Un socio que promete de mas quema al Capitan delante de
un cliente; uno que dice la verdad y ofrece la alternativa resuelve igual.

### REGLA DURA: NUNCA NARRES UNA ACCION QUE NO EJECUTASTE (2026-08-31, hallazgo
real con evidencia de base de datos -- no una corazonada): en una conversacion
real dijiste dos veces "voy a registrar los cambios en las agendas ahora" /
"Perfecto. Voy a registrar todo ahora:" -- se verifico artist_agenda y
agent_action_log en produccion para esa ventana exacta: CERO filas nuevas,
CERO llamadas a la herramienta, ni una sola fallida. Dijiste que hiciste algo
real (bloquear agendas, con dinero real de por medio) y no llamaste a NINGUNA
herramienta. Esto es mas grave que prometer de mas -- es afirmar un hecho falso
sobre tu propio trabajo.
- Frases como "voy a registrarlo ahora", "perfecto, lo registro", "ya quedo
  bloqueado" SOLO se dicen en el MISMO turno en el que de verdad llamas a la
  herramienta correspondiente (registrar_evento_agenda, generar_cotizacion_
  evento, crear_nota_lead, etc.) -- nunca antes, nunca como promesa para
  "despues".
- Si todavia te falta un dato (una fecha exacta, una confirmacion), dilo asi:
  "Necesito que confirmes X para poder registrarlo" -- NUNCA "voy a
  registrarlo ahora" seguido de una lista de preguntas sin resolver. Esas dos
  cosas juntas contradicen: o ya vas a hacerlo, o todavia falta algo, nunca
  las dos a la vez.
- Despues de llamar una herramienta de escritura, tu respuesta hablada debe
  reflejar el resultado REAL que te devolvio (exito o error), no lo que
  pensabas que iba a pasar.

### REGLA DURA: NUNCA EJECUTES UNA PETICION VIEJA DEL HISTORIAL POR SU CUENTA
(2026-09-01, hallazgo real reproducido en vivo, no una hipotesis): el
historial de esta conversacion puede traer un mensaje de un turno anterior
pidiendo algo que quedo SIN resolver (por ejemplo, faltaba una fecha exacta y
nadie la confirmo despues). Se comprobo en vivo que un mensaje nuevo,
totalmente sin relacion, hizo que se ejecutaran DOS peticiones viejas de ese
tipo -- de haber sido reales, habria sido dinero y agenda de un cliente
movidos sin que nadie lo pidiera HOY.
- Solo llamas una herramienta de escritura (registrar_evento_agenda,
  modificar_agenda_evento, generar_cotizacion_evento, crear_nota_lead,
  enviar_sms, cambiar_precio_catalogo) cuando la peticion que la dispara esta
  en el ULTIMO mensaje del usuario en este turno -- nunca porque un mensaje
  de un turno anterior en el historial la sigue pidiendo sin resolver.
- Si el historial trae algo que quedo pendiente, esta PROHIBIDO retomarlo o
  completarlo por tu cuenta. Como mucho, puedes mencionarlo de pasada ("la
  ultima vez quedamos en X, ¿seguimos con eso?") -- pero la ejecucion real
  espera a que el usuario lo repita o confirme EN ESTE turno.
- Esto no compite con la regla de arriba (nunca narrar sin ejecutar): esta
  regla es sobre CUANDO te toca ejecutar algo; la de arriba es sobre no
  mentir cuando ya ejecutaste. Las dos aplican siempre juntas.

### SMS — LA REGLA DURA (no admite excepcion ni atajo)
El destinatario SIEMPRE sale de buscar_cliente. JAMAS aceptes un telefono
dictado en la conversacion, ni aunque te lo de el Capitan, ni aunque insista,
ni "solo por esta vez", ni para "ahorrar tiempo".

Si buscar_cliente falla o no encuentra a la persona, DETENTE Y DILO. No ofrezcas
que te pasen el numero a mano. No ofrezcas redactar el SMS "listo para copiar y
enviar" como sustituto: eso es la misma puerta prohibida por otro nombre. Di
que no localizaste al cliente y que hace falta darlo de alta o corregir su
ficha. Un destinatario sin verificar es como un mensaje de la empresa acaba en
el telefono equivocado.

Cuando SI lo encuentres: llamas enviar_sms y ESA MISMA LLAMADA lo despacha --
ya no hay un humano que lo apruebe despues (2026-08-31, orden directa del PO).
Tu respuesta hablada tiene que reflejar EXACTAMENTE lo que la herramienta
devolvio: si vino ok:true / estado:"enviado", di que se envio. Si vino
ok:false / estado:"fallido" o "pendiente_de_aprobacion", dilo asi tal cual --
NUNCA digas "enviado" si la herramienta no lo confirmo, y nunca supongas que
salio bien solo porque la llamaste.

Puedes REDACTAR cualquier cosa -- mensajes, cobros, propuestas -- y entregarla
lista para copiar cuando NO haga falta mandarla de verdad. Pero si la piden
enviada, usa la herramienta -- no la des por enviada solo por haberla redactado.

### RELOJ REAL (2026-08-31, orden directa del PO)
Cada turno te llega, mas abajo, un bloque "FECHA Y HORA ACTUAL" calculado por
el SERVIDOR en hora de Miami (America/New_York) -- no una suposicion tuya.
Uselo para resolver "hoy", "manana", "este sabado", cumpleanos, vencimientos,
o cualquier fecha relativa. Tienes PROHIBIDO decir "no se que fecha es hoy" o
"no tengo acceso a la fecha actual" -- siempre la tienes, mas abajo en tu
propio contexto.`;

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
        const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
        const publicKey = envPublicRestKey();
        if (!supabaseUrl || !publicKey) return "";

        const url =
            supabaseUrl +
            "/rest/v1/public_dj_profiles" +
            "?select=user_id,stage_name,dj_name,dj_slug,plan,plan_status,is_premium,is_resident,available,city,artist_specialty,current_venue,hourly_rate_usd,bio,bio_en,rating,review_count" +
            "&order=is_premium.desc,rating.desc" +
            "&limit=60";

        const res = await fetch(url, {
            headers: { apikey: publicKey, Authorization: `Bearer ${publicKey}` },
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

            const uid = artist.user_id ? ` [${artist.user_id}]` : "";
            const parts = [`**${name}**${uid} [${tier}]`];
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
            "Estos son los artistas reales del Capitán. El UUID entre corchetes es dj_profiles.user_id (para consultar_agenda_artista / registrar_evento_agenda).\n" +
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
            .select("id,name,event_type,event_date,venue,event_location,status,lead_outcome,total_amount,budget_estimate,assigned_dj_name,created_at")
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
            const id = l.id ? ` [${l.id}]` : "";
            return `•${id} ${who}${ev}${date}${placeStr} [${st}]${amtStr}${dj}`;
        });
        _leadsCache =
            "\n\n### LEADS / SOLICITUDES — Consultas de clientes (datos en vivo, tabla leads)\n" +
            "Solicitudes de booking entrantes. El UUID entre corchetes es leads.id (para crear_nota_lead). NUNCA inventes.\n\n" +
            lines.join("\n");
        _leadsCacheAt = now;
        return _leadsCache;
    } catch (e) {
        console.error("[elixis-chat] leads fetch error:", e);
        _leadsCache = ""; _leadsCacheAt = Date.now(); return "";
    }
}

// ─── AGENDA EN VIVO (residency_schedule — fuente de verdad en la BD) ──────────
const DOW_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const RESIDENCY_ABSENT =
    "\n\n### CONTEXTO DE NEGOCIO — Agenda de residencias\n" +
    "No hay filas activas en public.residency_schedule (tabla vacía, error de lectura o sin datos). " +
    "No inventes agenda, tarifas, venues ni eventos especiales. Si preguntan, dilo con honestidad.\n";
async function fetchResidencySchedule(): Promise<string> {
    try {
        const { data: residencyData, error } = await ADMIN
            .from("residency_schedule")
            .select("day_of_week,shift,venue,dj_name,start_time,end_time,venue_pay_usd,dj_pay_usd")
            .eq("active", true)
            .order("day_of_week", { ascending: true })
            .order("start_time", { ascending: true });
        if (error || !Array.isArray(residencyData) || residencyData.length === 0) {
            return RESIDENCY_ABSENT;
        }
        let gross = 0;
        const lines = residencyData.map((s) => {
            gross += Number(s.venue_pay_usd) || 0;
            const st = String(s.start_time).slice(0, 5), et = String(s.end_time).slice(0, 5);
            return `- ${DOW_ES[Number(s.day_of_week)]} (${s.shift}): ${s.venue} · ${st}–${et} · ${s.dj_name} · venue paga $${Number(s.venue_pay_usd)}, DJ $${Number(s.dj_pay_usd)}`;
        });
        return "\n\n### CONTEXTO DE NEGOCIO — Agenda de residencias (fuente: BD, tabla residency_schedule)\n" +
            "Agenda semanal recurrente (filas activas en residency_schedule):\n" +
            lines.join("\n") +
            `\nIngreso semanal de venues: $${gross}/semana. Margen por evento = pago del venue − pago del DJ cuando se asigna a otro DJ; si toca DJMago305, el pago del venue es ingreso directo.\n` +
            "Usa solo estas filas para calcular ingresos, costos y márgenes. No inventes datos que no estén en la consulta.";
    } catch (e) {
        console.error("[elixis-chat] residency fetch error:", e);
        return RESIDENCY_ABSENT;
    }
}

// ─── MEMORIA CONTEXTUAL (agent_memory — solo lectura, fail-soft) ─────────────
async function fetchAgentMemory(staffUserId: string): Promise<string> {
    try {
        const { data, error } = await ADMIN
            .from("agent_memory")
            .select("mem_key,mem_value,updated_at")
            .eq("agent_id", "elixis")
            .eq("staff_user_id", staffUserId)
            .order("updated_at", { ascending: false })
            .limit(40);
        if (error || !Array.isArray(data) || data.length === 0) return "";
        const lines = data.map((row) => {
            const k = String(row.mem_key ?? "").trim();
            const v = String(row.mem_value ?? "").trim();
            if (!k || !v) return "";
            return `- ${k}: ${v}`;
        }).filter(Boolean);
        if (!lines.length) return "";
        return "\n\n### MEMORIA CONTEXTUAL (fuente: BD, tabla agent_memory)\n" +
            "Notas persistentes de este staff con ELIXIS. Úsalas como contexto; no las inventes ni las contradigas.\n" +
            lines.join("\n");
    } catch (e) {
        console.error("[elixis-chat] agent_memory fetch error:", e);
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

    // Reloj real (2026-08-31): fecha/hora calculada en SERVIDOR, no confiada
    // al modelo. Hora de Miami explícita porque es donde opera el negocio.
    const now = new Date();
    const dateBlock =
        `\n\n### FECHA Y HORA ACTUAL (servidor, America/New_York)\n` +
        `FECHA ACTUAL: ${now.toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/New_York" })} ` +
        `| HORA: ${now.toLocaleTimeString("es-ES", { timeZone: "America/New_York" })}`;

    // Identidad del usuario actual (del candado) — para personalizar y adaptar al rol.
    const userBlock =
        `\n\n### USUARIO ACTUAL (con quien hablas AHORA)\n` +
        `Nombre: ${gate.name || "sin nombre"}\n` +
        `Rol: ${gate.role}\n` +
        `Trátalo por su nombre. Si su rol es 'owner' es el dueño (el Capitán): confianza y acceso totales. ` +
        `Si es admin/manager/seller es staff: ayúdalo dentro de lo que le corresponde a su rol.`;

    // Agenda: solo residency_schedule. Sin filas o con error → contexto honesto, sin inventar.
    const agendaContext = await fetchResidencySchedule();

    // Memoria persistente de este staff (R6). Vacío o error → sin bloque, no inventar.
    const memoryContext = await fetchAgentMemory(gate.userId);

    const systemContent =
        SYSTEM_PROMPT +
        dateBlock +
        userBlock +
        memoryContext +
        agendaContext +
        rosterContext +
        bookingsContext +
        financeContext +
        leadsContext +
        (sessionContext ? `\n\n### Contexto de sesión actual:\n${sessionContext}` : "");

    // ─── ELIXIS ⇄ MOTOR FINANCIERO (Fase 5) ────────────────────────────────
    // Herramienta que Claude DELEGA al financial-engine cuando la consulta es
    // del sector financiero. Los montos del motor vienen en centavos.
    const authHeader = req.headers.get("Authorization") ?? "";
    const FINANCIAL_TOOL = {
        name: "consultar_finanzas",
        description:
            "Consulta el MOTOR FINANCIERO canónico de Miami DJ Beat para métricas REALES en vivo. " +
            "Úsalo SIEMPRE que pregunten por dinero/finanzas: caja neta, ingresos, egresos, cuentas por cobrar/pagar. " +
            "NUNCA inventes cifras financieras: si la pregunta es financiera, llama esta herramienta y usa su resultado.",
        input_schema: {
            type: "object",
            properties: {
                metrica: {
                    type: "string",
                    enum: ["getNetCash", "getCashInflow", "getCashOutflow", "getAccountsReceivable", "getAccountsPayable"],
                    description:
                        "getNetCash=caja neta; getCashInflow=ingresos cobrados; getCashOutflow=egresos pagados; " +
                        "getAccountsReceivable=por cobrar (venues deben); getAccountsPayable=por pagar (a DJs/proveedores)",
                },
            },
            required: ["metrica"],
        },
    };

    const AGENDA_READ_TOOL = {
        name: "consultar_agenda_artista",
        description:
            "Lee la agenda personal (artist_agenda) de un DJ. No inventes bloques. " +
            "Usa el UUID del artista que aparece entre corchetes en el roster.",
        input_schema: {
            type: "object",
            properties: {
                dj_user_id: {
                    type: "string",
                    description: "UUID de auth.users / dj_profiles.user_id (el valor entre corchetes en el roster).",
                },
                desde: {
                    type: "string",
                    description: "ISO 8601 opcional: inicio del rango a leer.",
                },
                hasta: {
                    type: "string",
                    description: "ISO 8601 opcional: fin del rango a leer.",
                },
            },
            required: ["dj_user_id"],
        },
    };

    const AGENDA_WRITE_TOOL = {
        name: "registrar_evento_agenda",
        description:
            "Registra un bloque en la agenda personal de un artista (artist_agenda). " +
            "No cambia leads ni asignaciones. Usa el UUID del roster. No inventes dj_user_id.",
        input_schema: {
            type: "object",
            properties: {
                dj_user_id: {
                    type: "string",
                    description: "UUID de dj_profiles.user_id (entre corchetes en el roster).",
                },
                starts_at: {
                    type: "string",
                    description: "Inicio del bloque, ISO 8601.",
                },
                ends_at: {
                    type: "string",
                    description: "Fin del bloque, ISO 8601 (posterior a starts_at).",
                },
                title: {
                    type: "string",
                    description: "Título del bloque, 1 a 200 caracteres.",
                },
                nota: {
                    type: "string",
                    description: "Detalle opcional, 1 a 2000 caracteres.",
                },
                lead_id: {
                    type: "string",
                    description: "UUID opcional de public.leads.id si el bloque nace de un lead.",
                },
            },
            required: ["dj_user_id", "starts_at", "ends_at", "title"],
        },
    };

    const AGENDA_EVENTOS_TOOL = {
        name: "modificar_agenda_evento",
        description:
            "Crea, actualiza, suspende o cancela un evento en la agenda OPERATIVA de negocio " +
            "(elixis_agenda_eventos): residencias, bodas, privados, cumpleanos o notas, con tarifa " +
            "de venue y pago al DJ. Distinta de registrar_evento_agenda (esa es el hueco personal " +
            "del DJ, sin dinero). Usa el nombre del DJ tal como aparece en el roster -- no inventes " +
            "un nombre que no este ahi. accion='actualizar'/'suspender'/'reactivar'/'cancelar' " +
            "busca el evento existente por dj+fecha_inicio+venue; si no lo encuentra, la herramienta " +
            "devuelve error, no lo inventes.",
        input_schema: {
            type: "object",
            properties: {
                dj_nombre: {
                    type: "string",
                    description: "Nombre del DJ tal como aparece en el roster (stage_name/dj_name/full_name).",
                },
                venue: {
                    type: "string",
                    description: "Nombre del venue/lugar. Opcional para 'crear', recomendable para identificar el evento en updates.",
                },
                fecha: {
                    type: "string",
                    description: "Inicio del evento, ISO 8601.",
                },
                horario: {
                    type: "string",
                    description: "Fin del evento, ISO 8601 (posterior a 'fecha').",
                },
                accion: {
                    type: "string",
                    enum: ["crear", "actualizar", "suspender", "reactivar", "cancelar"],
                    description: "crear=evento nuevo. Las demas buscan el evento existente por dj+fecha+venue.",
                },
                tipo: {
                    type: "string",
                    enum: ["residencia", "boda", "privado", "cumpleanos", "nota"],
                    description: "Tipo de evento. Default 'nota'.",
                },
                estado: {
                    type: "string",
                    enum: ["activo", "suspendido"],
                    description: "Estado explicito. Ignorado si accion ya lo determina (suspender/reactivar/cancelar).",
                },
                notas: {
                    type: "string",
                    description: "Detalle opcional, 1 a 2000 caracteres.",
                },
                tarifa_venue: {
                    type: "number",
                    description: "Lo que paga el venue, en DOLARES (se convierte a centavos internamente).",
                },
                pago_dj: {
                    type: "number",
                    description: "Lo que se le paga al DJ, en DOLARES (se convierte a centavos internamente).",
                },
                es_confidencial_staff: {
                    type: "boolean",
                    description: "Si es true, el DJ NO vera este evento (ni tarifas) en su propia agenda -- solo owner/admin. Default false.",
                },
            },
            required: ["dj_nombre", "fecha", "horario", "accion"],
        },
    };

    const CATALOG_READ_TOOL = {
        name: "consultar_catalogo_precios",
        description:
            "Lee el catálogo de precios vigente de Miami DJ Beat LLC (platform_settings + fallback). " +
            "Úsalo para listar SKUs y precios unitarios. NUNCA inventes un precio.",
        input_schema: {
            type: "object",
            properties: {
                bucket: {
                    type: "string",
                    enum: ["talent", "equipment", "all"],
                    description: "Filtro opcional: talent, equipment o all (default all).",
                },
            },
        },
    };

    const CATALOG_PRICE_TOOL = {
        name: "cambiar_precio_catalogo",
        description:
            "Cambia el precio de un SKU del catalogo oficial (platform_settings.rentals_catalog_prices). " +
            "SOLO owner/admin -- si quien te habla es otro rol, la herramienta lo va a rechazar, no lo intentes igual. " +
            "El sku tiene que ser uno EXISTENTE en el catalogo (consultalo con consultar_catalogo_precios si no " +
            "estas seguro); no inventes un sku nuevo con esto.",
        input_schema: {
            type: "object",
            properties: {
                sku: {
                    type: "string",
                    description: "SKU canonico existente del catalogo (dj_private, hl_robot, pa_medium, etc.).",
                },
                nuevo_precio_usd: {
                    type: "number",
                    description: "Nuevo precio unitario en DOLARES.",
                },
            },
            required: ["sku", "nuevo_precio_usd"],
        },
    };

    const CLIENT_SEARCH_TOOL = {
        name: "buscar_cliente",
        description:
            "Busca un cliente/comprador registrado en Miami DJ Beat LLC por nombre, email o teléfono. " +
            "Devuelve datos de contacto básicos. NO inventes un cliente que no aparezca en el resultado.",
        input_schema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Texto a buscar: nombre completo (o parcial), email o teléfono.",
                },
            },
            required: ["query"],
        },
    };

    const MUSIC_TOOL = {
        name: "consultar_musica",
        description:
            "Consulta el catalogo REAL de Apple Music. Uselo cuando haga falta saber que suena AHORA " +
            "o comprobar un tema o artista concreto -- para armar un set, proponer repertorio o " +
            "confirmar que una cancion existe. NO inventes titulos ni posiciones de lista: si no " +
            "aparecen en el resultado, no existen para esta respuesta.",
        input_schema: {
            type: "object",
            properties: {
                recurso: {
                    type: "string",
                    enum: ["charts", "buscar"],
                    description: "charts = lo mas escuchado ahora. buscar = un tema o artista concreto.",
                },
                q: {
                    type: "string",
                    description: "Solo con recurso=buscar: nombre del tema o del artista.",
                },
                limite: {
                    type: "number",
                    description: "Cuantos resultados, de 1 a 25. Por defecto 10.",
                },
            },
            required: ["recurso"],
        },
    };

    /* El puente mdj-music guarda la credencial de Apple: aqui solo se le pide.
       Se RECORTA lo que vuelve -- titulo, artista, album, genero y duracion --
       porque la respuesta cruda de Apple trae decenas de campos por tema
       (portadas, previews, ISRC...) y todo eso acabaria en el contexto del
       modelo pagandose por ficha sin aportar nada a un set. */
    async function runMusicTool(input: Record<string, unknown>): Promise<string> {
        const recurso = input?.recurso === "buscar" ? "buscar" : "charts";
        const limite = Math.min(25, Math.max(1, Number(input?.limite) || 10));
        const base = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
        if (!base) return JSON.stringify({ error: "sin_servidor" });

        const u = new URL(`${base}/functions/v1/mdj-music`);
        u.searchParams.set("recurso", recurso);
        u.searchParams.set("limite", String(limite));
        if (recurso === "buscar") {
            const q = String(input?.q ?? "").trim();
            if (q.length < 2) return JSON.stringify({ error: "falta que buscar" });
            u.searchParams.set("q", q);
        }

        try {
            const res = await fetch(u.toString(), { headers: { Origin: "https://miamidjbeat.com" } });
            if (!res.ok) return JSON.stringify({ error: "catalogo_no_disponible", estado: res.status });
            const d = await res.json();
            const cortar = (arr: unknown[]) =>
                (arr ?? []).slice(0, limite).map((x) => {
                    const a = (x as Record<string, Record<string, unknown>>)?.attributes ?? {};
                    return {
                        tema: a.name, artista: a.artistName, album: a.albumName,
                        genero: Array.isArray(a.genreNames) ? a.genreNames[0] : undefined,
                        anio: typeof a.releaseDate === "string" ? a.releaseDate.slice(0, 4) : undefined,
                        duracion_s: typeof a.durationInMillis === "number" ? Math.round(a.durationInMillis / 1000) : undefined,
                    };
                });

            if (recurso === "charts") {
                const lista = d?.results?.songs?.[0]?.data ?? [];
                return JSON.stringify({ ok: true, fuente: "Apple Music · EE.UU.", canciones: cortar(lista) });
            }
            return JSON.stringify({
                ok: true, fuente: "Apple Music",
                canciones: cortar(d?.results?.songs?.data ?? []),
                artistas: (d?.results?.artists?.data ?? []).slice(0, 5)
                    .map((x: Record<string, Record<string, unknown>>) => x?.attributes?.name),
            });
        } catch (_) {
            return JSON.stringify({ error: "catalogo_inalcanzable" });
        }
    }

    const QUOTE_WRITE_TOOL = {
        name: "generar_cotizacion_evento",
        description:
            "Genera un borrador de cotización de Miami DJ Beat LLC (event_quotes). " +
            "El servidor calcula line = unit × qty, tax 7% y depósito 30% sobre el subtotal. " +
            "No crea órdenes formales. No inventes SKUs ni montos: usa el catálogo.",
        input_schema: {
            type: "object",
            properties: {
                tipo_evento: {
                    type: "string",
                    enum: ["wedding", "corporate", "private", "clubs", "family", "holiday"],
                    description: "Paquete DJ base. wedding/corporate = dj_weddings (5h). private/clubs/family = 4h. holiday = 5h.",
                },
                horas: {
                    type: "number",
                    description: "Duración 1–16. Horas extra DJ = $100/h sobre la base del tipo.",
                },
                servicios: {
                    type: "array",
                    description: "Add-ons del catálogo. Cada ítem: { sku, qty? }.",
                    items: {
                        type: "object",
                        properties: {
                            sku: { type: "string", description: "SKU canónico (dj_private, hl_robot, live_sax, fx_sparks, pa_medium, …)." },
                            qty: { type: "number", description: "Cantidad. Default 1." },
                        },
                        required: ["sku"],
                    },
                },
                lead_id: {
                    type: "string",
                    description: "UUID opcional de public.leads.id. No inventes un lead_id.",
                },
                event_date: {
                    type: "string",
                    description: "Fecha opcional YYYY-MM-DD.",
                },
                nota: {
                    type: "string",
                    description: "Nota interna opcional, 1 a 2000 caracteres.",
                },
            },
        },
    };

    const LEAD_NOTE_TOOL = {
        name: "crear_nota_lead",
        description:
            "Crea una nota interna de staff sobre un lead existente. No cambia estado, montos ni asignación. " +
            "Usa el UUID del lead que aparece entre corchetes en el pipeline. No inventes un lead_id.",
        input_schema: {
            type: "object",
            properties: {
                lead_id: {
                    type: "string",
                    description: "UUID de public.leads.id (el valor entre corchetes en el pipeline).",
                },
                nota: {
                    type: "string",
                    description: "Texto de la nota de staff, 1 a 2000 caracteres. Sin volcar PII innecesaria.",
                },
            },
            required: ["lead_id", "nota"],
        },
    };

    const SMS_QUEUE_TOOL = {
        name: "enviar_sms",
        description:
            "Redacta y ENVIA un SMS real a un cliente -- de una sola vez, sin aprobacion humana " +
            "adicional cuando el destinatario y el mensaje esten claros. " +
            "Usala cuando te pidan avisar, confirmar o recordar algo a un cliente por mensaje. " +
            "Necesitas el cliente_id, que sale de buscar_cliente: NUNCA aceptes un telefono dictado " +
            "de viva voz, porque un digito mal oido manda el mensaje a un desconocido -- ese candado " +
            "no se negocia, sea autonomo el envio o no. El resultado que te devuelve (ok/estado) es " +
            "el envio REAL: dilo tal cual vino, nunca asumas que salio si la herramienta no lo confirma.",
        input_schema: {
            type: "object",
            properties: {
                cliente_id: {
                    type: "string",
                    description: "El user_id del cliente, tal como lo devuelve buscar_cliente.",
                },
                mensaje: {
                    type: "string",
                    description: "El texto exacto del SMS, listo para leerse tal cual. Maximo 1500 caracteres.",
                },
            },
            required: ["cliente_id", "mensaje"],
        },
    };

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    function toolGateInput(toolName: string): { tool: string; policy: string; mode: "read" | "write" } {
        if (
            toolName === "consultar_finanzas"
            || toolName === "consultar_agenda_artista"
            || toolName === "consultar_catalogo_precios"
            || toolName === "buscar_cliente"
            || toolName === "consultar_musica"
        ) {
            return { tool: toolName, policy: "none", mode: "read" };
        }
        if (
            toolName === "crear_nota_lead"
            || toolName === "registrar_evento_agenda"
            || toolName === "modificar_agenda_evento"
            || toolName === "cambiar_precio_catalogo"
            || toolName === "generar_cotizacion_evento"
            /* enviar_sms (2026-08-31: envio autonomo, orden directa del PO).
               El candado real sigue siendo que el telefono SOLO sale de
               buscar_cliente + client_profiles -- nunca de un numero dictado
               en la conversacion. Ese candado vive en runSmsQueueTool, no aqui. */
            || toolName === "enviar_sms"
        ) {
            return { tool: toolName, policy: "auto_staff", mode: "write" };
        }
        return { tool: toolName, policy: "require_approval", mode: "write" };
    }

    async function recordAiKpi(event: "gate_allow" | "gate_deny" | "tool_ok" | "tool_error"): Promise<void> {
        try {
            const { error } = await ADMIN.rpc("ai_kpi_record", { p_agent_id: "elixis", p_event: event });
            if (error) console.error("[elixis-chat] ai_kpi record error:", error.message);
        } catch (e) {
            console.error("[elixis-chat] ai_kpi record error:", e);
        }
    }

    async function recordActionLog(action: string, target: string, result: string): Promise<void> {
        try {
            const { error } = await ADMIN.rpc("agent_action_log_write", {
                p_actor: gate.userId,
                p_action: action.slice(0, 128),
                p_target: target.slice(0, 512),
                p_result: result.slice(0, 2000),
                p_agent_id: "elixis",
            });
            if (error) console.error("[elixis-chat] action log error:", error.message);
        } catch (e) {
            console.error("[elixis-chat] action log error:", e);
        }
    }

    async function runLeadNoteTool(input: Record<string, unknown>): Promise<string> {
        const leadId = String(input?.lead_id ?? "").trim();
        const nota = String(input?.nota ?? "").trim();
        if (!UUID_RE.test(leadId)) {
            await recordActionLog("crear_nota_lead", leadId || "invalid", "error:lead_id_invalido");
            return JSON.stringify({ error: "lead_id_invalido" });
        }
        if (nota.length < 1 || nota.length > 2000) {
            await recordActionLog("crear_nota_lead", leadId, "error:nota_invalida");
            return JSON.stringify({ error: "nota_invalida" });
        }
        const { data: noteId, error } = await ADMIN.rpc("agent_lead_note_create", {
            p_lead_id: leadId,
            p_staff_user_id: gate.userId,
            p_body: nota,
            p_agent_id: "elixis",
        });
        if (error || !noteId) {
            const detail = error?.message ?? "rpc";
            await recordActionLog("crear_nota_lead", leadId, `error:${detail}`.slice(0, 2000));
            return JSON.stringify({ error: "nota_no_creada" });
        }
        await recordActionLog("crear_nota_lead", leadId, `ok:${noteId}`);
        return JSON.stringify({ ok: true, note_id: noteId, lead_id: leadId });
    }

    function parseIso(value: unknown): string | null {
        const raw = String(value ?? "").trim();
        if (!raw) return null;
        const ms = Date.parse(raw);
        if (!Number.isFinite(ms)) return null;
        return new Date(ms).toISOString();
    }

    async function runAgendaReadTool(input: Record<string, unknown>): Promise<string> {
        const djUserId = String(input?.dj_user_id ?? "").trim();
        if (!UUID_RE.test(djUserId)) {
            return JSON.stringify({ error: "dj_user_id_invalido" });
        }
        const fromIso = parseIso(input?.desde);
        const toIso = parseIso(input?.hasta);
        let q = ADMIN
            .from("artist_agenda")
            .select("id,dj_user_id,starts_at,ends_at,title,body,lead_id,source,created_at")
            .eq("dj_user_id", djUserId)
            .order("starts_at", { ascending: true })
            .limit(40);
        if (fromIso) q = q.gte("starts_at", fromIso);
        if (toIso) q = q.lte("starts_at", toIso);
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: "agenda_no_disponible" });
        return JSON.stringify({ ok: true, dj_user_id: djUserId, events: Array.isArray(data) ? data : [] });
    }

    async function runAgendaWriteTool(input: Record<string, unknown>): Promise<string> {
        const djUserId = String(input?.dj_user_id ?? "").trim();
        const title = String(input?.title ?? "").trim();
        const nota = String(input?.nota ?? "").trim();
        const leadId = String(input?.lead_id ?? "").trim();
        const startsAt = parseIso(input?.starts_at);
        const endsAt = parseIso(input?.ends_at);
        if (!UUID_RE.test(djUserId)) {
            await recordActionLog("registrar_evento_agenda", djUserId || "invalid", "error:dj_user_id_invalido");
            return JSON.stringify({ error: "dj_user_id_invalido" });
        }
        if (!startsAt || !endsAt || endsAt <= startsAt) {
            await recordActionLog("registrar_evento_agenda", djUserId, "error:rango_invalido");
            return JSON.stringify({ error: "rango_invalido" });
        }
        if (title.length < 1 || title.length > 200) {
            await recordActionLog("registrar_evento_agenda", djUserId, "error:titulo_invalido");
            return JSON.stringify({ error: "titulo_invalido" });
        }
        if (nota && nota.length > 2000) {
            await recordActionLog("registrar_evento_agenda", djUserId, "error:nota_invalida");
            return JSON.stringify({ error: "nota_invalida" });
        }
        if (leadId && !UUID_RE.test(leadId)) {
            await recordActionLog("registrar_evento_agenda", djUserId, "error:lead_id_invalido");
            return JSON.stringify({ error: "lead_id_invalido" });
        }
        const { data: eventId, error } = await ADMIN.rpc("artist_agenda_record", {
            p_dj_user_id: djUserId,
            p_starts_at: startsAt,
            p_ends_at: endsAt,
            p_title: title,
            p_body: nota || null,
            p_lead_id: leadId || null,
            p_staff_user_id: gate.userId,
            p_agent_id: "elixis",
        });
        if (error || !eventId) {
            const detail = error?.message ?? "rpc";
            await recordActionLog("registrar_evento_agenda", djUserId, `error:${detail}`.slice(0, 2000));
            return JSON.stringify({ error: "evento_no_registrado" });
        }
        await recordActionLog("registrar_evento_agenda", djUserId, `ok:${eventId}`);
        return JSON.stringify({ ok: true, event_id: eventId, dj_user_id: djUserId });
    }

    const ACCIONES_AGENDA_EVENTO = new Set(["crear", "actualizar", "suspender", "reactivar", "cancelar"]);
    const TIPOS_AGENDA_EVENTO = new Set(["residencia", "boda", "privado", "cumpleanos", "nota"]);

    async function runAgendaEventoTool(input: Record<string, unknown>): Promise<string> {
        const djNombre = String(input?.dj_nombre ?? "").trim();
        const venue = String(input?.venue ?? "").trim();
        const accion = String(input?.accion ?? "").trim().toLowerCase();
        const tipo = String(input?.tipo ?? "nota").trim().toLowerCase();
        const estado = String(input?.estado ?? "activo").trim().toLowerCase();
        const notas = String(input?.notas ?? "").trim();
        const fechaInicio = parseIso(input?.fecha);
        const fechaFin = parseIso(input?.horario);
        const target = djNombre || "invalid";

        if (!djNombre) {
            await recordActionLog("modificar_agenda_evento", target, "error:dj_nombre_requerido");
            return JSON.stringify({ error: "dj_nombre_requerido" });
        }
        if (!ACCIONES_AGENDA_EVENTO.has(accion)) {
            await recordActionLog("modificar_agenda_evento", target, "error:accion_invalida");
            return JSON.stringify({ error: "accion_invalida" });
        }
        if (!fechaInicio || !fechaFin || fechaFin <= fechaInicio) {
            await recordActionLog("modificar_agenda_evento", target, "error:rango_invalido");
            return JSON.stringify({ error: "rango_invalido" });
        }
        if (!TIPOS_AGENDA_EVENTO.has(tipo)) {
            await recordActionLog("modificar_agenda_evento", target, "error:tipo_invalido");
            return JSON.stringify({ error: "tipo_invalido" });
        }
        if (notas && notas.length > 2000) {
            await recordActionLog("modificar_agenda_evento", target, "error:notas_invalidas");
            return JSON.stringify({ error: "notas_invalidas" });
        }
        const tarifaVenueCents = typeof input?.tarifa_venue === "number" ? Math.round(input.tarifa_venue * 100) : null;
        const pagoDjCents = typeof input?.pago_dj === "number" ? Math.round(input.pago_dj * 100) : null;
        const esConfidencial = typeof input?.es_confidencial_staff === "boolean" ? input.es_confidencial_staff : null;

        const { data: eventId, error } = await ADMIN.rpc("elixis_agenda_evento_modificar", {
            p_dj_nombre: djNombre,
            p_venue_nombre: venue || null,
            p_fecha_inicio: fechaInicio,
            p_fecha_fin: fechaFin,
            p_accion: accion,
            p_tipo: tipo,
            p_estado: estado,
            p_notas: notas || null,
            p_tarifa_venue_cents: tarifaVenueCents,
            p_pago_dj_cents: pagoDjCents,
            p_staff_user_id: gate.userId,
            p_agent_id: "elixis",
            p_es_confidencial_staff: esConfidencial,
        });
        if (error || !eventId) {
            const detail = error?.message ?? "rpc";
            await recordActionLog("modificar_agenda_evento", target, `error:${detail}`.slice(0, 2000));
            return JSON.stringify({ error: detail.includes("dj_no_encontrado") ? "dj_no_encontrado" : (detail.includes("evento_no_encontrado") ? "evento_no_encontrado" : "evento_no_procesado") });
        }
        await recordActionLog("modificar_agenda_evento", target, `ok:${accion}:${eventId}`);
        return JSON.stringify({ ok: true, event_id: eventId, dj_nombre: djNombre, accion });
    }

    async function loadCatalogOverlay(): Promise<Record<string, number>> {
        const { data, error } = await ADMIN
            .from("platform_settings")
            .select("value")
            .eq("key", "rentals_catalog_prices")
            .maybeSingle();
        if (error || !data) return {};
        return parseCatalogOverlay(data.value);
    }

    async function runCatalogReadTool(input: Record<string, unknown>): Promise<string> {
        const overlay = await loadCatalogOverlay();
        const bucket = String(input?.bucket ?? "all").trim().toLowerCase();
        const items = mergeCatalog(overlay).filter((item) => {
            if (bucket === "talent" || bucket === "equipment") return item.bucket === bucket;
            return true;
        });
        return JSON.stringify({
            ok: true,
            brand: "Miami DJ Beat LLC",
            tax_rate: 0.07,
            deposit_rate: 0.30,
            extra_hour_sku: "dj_extra_hour",
            items,
        });
    }

    async function runClientSearchTool(input: Record<string, unknown>): Promise<string> {
        const query = String(input?.query ?? "").trim();
        if (!query || query.length < 2) {
            return JSON.stringify({ error: "query debe tener al menos 2 caracteres" });
        }
        const like = `%${query}%`;
        const { data, error } = await ADMIN
            .from("client_profiles")
            .select("user_id, full_name, company_name, email, phone, city, tier_level")
            .or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like},company_name.ilike.${like}`)
            .limit(10);
        if (error) {
            return JSON.stringify({ error: `client_profiles: ${error.message}` });
        }
        return JSON.stringify({ ok: true, count: data?.length ?? 0, clientes: data ?? [] });
    }

    /* Convierte a E.164. Misma logica que send-sft-client-sms, para que un
       numero valido alli lo sea aqui y no haya dos verdades. */
    function toE164(input: string): string | null {
        const t = (input || "").trim();
        if (!t) return null;
        const d = t.replace(/\D/g, "");
        if (d.length === 10) return `+1${d}`;
        if (d.length === 11 && d.startsWith("1")) return `+${d}`;
        if (t.startsWith("+") && d.length >= 10 && d.length <= 15) return `+${d}`;
        return null;
    }

    /* El borrador encolado en ESTE turno. La respuesta de la funcion es solo
       texto, asi que sin esto la pantalla nunca sabria que hay algo esperando
       aprobacion ni con que id despacharlo. */
    let smsPendiente: Record<string, unknown> | null = null;
    /* FASE 1 — LA FUENTE DE VERDAD. Que herramientas corrio ELIXIS en este
       turno. El navegador no tenia forma de saberlo: toolName solo vivia
       dentro del bucle para elegir handler y registrar en servidor, y la
       respuesta salia con { reply } a secas. Sin esto, cualquier animacion
       del proceso estaria ADIVINANDO lo que dibuja.
       Solo el NOMBRE y si salio bien: los argumentos llevan datos de
       clientes y no salen de aqui. */
    const herramientasUsadas: Array<{ nombre: string; ok: boolean }> = [];

    async function runSmsQueueTool(input: Record<string, unknown>): Promise<string> {
        const clienteId = String(input?.cliente_id ?? "").trim();
        const mensaje = String(input?.mensaje ?? "").trim();

        if (!UUID_RE.test(clienteId)) {
            return JSON.stringify({
                error: "cliente_id_invalido",
                detalle: "Necesito el user_id del cliente. Buscalo primero con buscar_cliente; " +
                         "no acepto telefonos dictados.",
            });
        }
        if (mensaje.length < 2) return JSON.stringify({ error: "mensaje_vacio" });
        if (mensaje.length > 1500) return JSON.stringify({ error: "mensaje_demasiado_largo" });

        /* El telefono sale de la BASE, nunca de lo que se dijo en voz alta. */
        const { data: cli, error: e1 } = await ADMIN
            .from("client_profiles")
            .select("user_id, full_name, phone")
            .eq("user_id", clienteId)
            .maybeSingle();
        if (e1) return JSON.stringify({ error: `client_profiles: ${e1.message}` });
        if (!cli) return JSON.stringify({ error: "cliente_no_encontrado" });

        const tel = toE164(String(cli.phone ?? ""));
        if (!tel) {
            return JSON.stringify({
                error: "cliente_sin_telefono_valido",
                cliente: cli.full_name,
                detalle: "Ese cliente no tiene un telefono utilizable en su ficha.",
            });
        }

        const { data, error } = await ADMIN.rpc("elixis_sms_encolar", {
            p_solicitante: gate.userId,
            p_dest_id: clienteId,
            p_nombre: String(cli.full_name ?? ""),
            p_telefono: tel,
            p_mensaje: mensaje,
        });
        if (error) return JSON.stringify({ error: `cola_sms: ${error.message}` });

        const row = Array.isArray(data) ? data[0] : data;
        const oculto = tel.slice(0, -4).replace(/\d/g, "•") + tel.slice(-4);
        const smsId = String(row?.id ?? "");

        /* ENVIO AUTONOMO (2026-08-31, orden directa del PO: "siempre que
           reconozca los limites a quien le da una informacion y a quien le
           da otras"). El destinatario ya viene DE LA FICHA (buscar_cliente +
           client_profiles), nunca de un telefono dictado -- ese candado sigue
           intacto. Lo que cambia es que ya no espera un click humano: llama
           al MISMO endpoint (elixis-sms-dispatch) que antes solo apretaba una
           persona, reusando el JWT staff/owner que ya autentico esta
           conversacion. Si esa llamada no se puede ni intentar (red caida),
           la fila queda pendiente de verdad y se cae al viejo camino manual
           como red de seguridad -- nunca se inventa un "enviado". */
        const base = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
        let despacho: Record<string, unknown> | null = null;
        if (base && smsId) {
            try {
                const dRes = await fetch(`${base}/functions/v1/elixis-sms-dispatch?id=${encodeURIComponent(smsId)}`, {
                    method: "POST",
                    headers: { Authorization: authHeader, "Content-Type": "application/json" },
                });
                despacho = await dRes.json().catch(() => null);
            } catch (_e) {
                despacho = null;
            }
        }

        if (!despacho) {
            // No se pudo ni intentar el despacho -- la fila sigue "pendiente" en
            // la base de verdad. Se deja la carta de aprobacion manual como
            // unica red de seguridad, no como flujo normal.
            smsPendiente = { id: smsId || null, destinatario: String(cli.full_name ?? ""), telefono: oculto, mensaje };
            await recordActionLog("enviar_sms", clienteId, "error:despacho_no_intentado");
            return JSON.stringify({
                ok: false,
                estado: "pendiente_de_aprobacion",
                id: smsId || null,
                destinatario: cli.full_name,
                telefono: oculto,
                mensaje,
                aviso: "No pude despachar el SMS de forma automatica (fallo de red). Quedo en cola para aprobacion manual en pantalla.",
            });
        }

        const enviado = despacho?.ok === true;
        await recordActionLog(
            "enviar_sms",
            clienteId,
            (enviado ? `ok:sid=${String(despacho?.sid ?? "")}` : `error:${String(despacho?.error ?? despacho?.detalle ?? "desconocido")}`).slice(0, 2000),
        );
        return JSON.stringify({
            ok: enviado,
            estado: enviado ? "enviado" : "fallido",
            id: smsId || null,
            destinatario: cli.full_name,
            telefono: oculto,
            mensaje,
            despacho,
        });
    }

    const PRICE_CHANGE_ROLES = new Set(["owner", "admin"]);

    async function runCatalogPriceTool(input: Record<string, unknown>): Promise<string> {
        const sku = String(input?.sku ?? "").trim();
        const nuevoPrecio = Number(input?.nuevo_precio_usd);

        if (!PRICE_CHANGE_ROLES.has(gate.role)) {
            await recordActionLog("cambiar_precio_catalogo", sku || "invalid", `error:rol_no_autorizado:${gate.role}`);
            return JSON.stringify({ error: "rol_no_autorizado", detalle: "Solo owner/admin puede cambiar precios del catalogo." });
        }
        if (!sku || sku.length > 64) {
            await recordActionLog("cambiar_precio_catalogo", sku || "invalid", "error:sku_invalido");
            return JSON.stringify({ error: "sku_invalido" });
        }
        if (!CATALOG_FALLBACK.some((item) => item.sku === sku)) {
            await recordActionLog("cambiar_precio_catalogo", sku, "error:sku_desconocido");
            return JSON.stringify({ error: "sku_desconocido", detalle: "Ese sku no existe en el catalogo oficial." });
        }
        if (!Number.isFinite(nuevoPrecio) || nuevoPrecio < 0 || nuevoPrecio > 100000) {
            await recordActionLog("cambiar_precio_catalogo", sku, "error:precio_invalido");
            return JSON.stringify({ error: "precio_invalido" });
        }

        const { data, error } = await ADMIN.rpc("platform_catalog_price_set", {
            p_sku: sku,
            p_unit_usd: nuevoPrecio,
            p_staff_user_id: gate.userId,
            p_agent_id: "elixis",
        });
        if (error || !data) {
            const detail = error?.message ?? "rpc";
            await recordActionLog("cambiar_precio_catalogo", sku, `error:${detail}`.slice(0, 2000));
            return JSON.stringify({ error: "precio_no_actualizado" });
        }
        await recordActionLog("cambiar_precio_catalogo", sku, `ok:${nuevoPrecio}`);
        return JSON.stringify({ ok: true, sku, unit_usd: nuevoPrecio });
    }

    function parseEventDate(value: unknown): string | null {
        const raw = String(value ?? "").trim();
        if (!raw) return null;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
        const ms = Date.parse(`${raw}T00:00:00Z`);
        if (!Number.isFinite(ms)) return null;
        return raw;
    }

    async function runQuoteWriteTool(input: Record<string, unknown>): Promise<string> {
        const overlay = await loadCatalogOverlay();
        const resolved = resolveQuoteLines({
            servicios: input?.servicios,
            tipo_evento: input?.tipo_evento,
            horas: input?.horas,
            overlay,
        });
        if (!resolved.ok) {
            await recordActionLog("generar_cotizacion_evento", "invalid", `error:${resolved.error}`);
            return JSON.stringify({ error: resolved.error });
        }
        const leadId = String(input?.lead_id ?? "").trim();
        if (leadId && !UUID_RE.test(leadId)) {
            await recordActionLog("generar_cotizacion_evento", leadId, "error:lead_id_invalido");
            return JSON.stringify({ error: "lead_id_invalido" });
        }
        const nota = String(input?.nota ?? "").trim();
        if (nota && nota.length > 2000) {
            await recordActionLog("generar_cotizacion_evento", leadId || "quote", "error:nota_invalida");
            return JSON.stringify({ error: "nota_invalida" });
        }
        const eventDate = parseEventDate(input?.event_date);
        if (input?.event_date != null && String(input.event_date).trim() !== "" && !eventDate) {
            await recordActionLog("generar_cotizacion_evento", leadId || "quote", "error:fecha_invalida");
            return JSON.stringify({ error: "fecha_invalida" });
        }
        const totals = computeQuoteTotals(resolved.lines);
        const buckets = bucketSums(resolved.lines);
        const { data: quoteId, error } = await ADMIN.rpc("event_quote_record", {
            p_staff_user_id: gate.userId,
            p_lines: resolved.lines,
            p_lead_id: leadId || null,
            p_event_date: eventDate,
            p_event_type: resolved.tipo_evento,
            p_hours: resolved.horas,
            p_notes: nota || null,
            p_agent_id: "elixis",
        });
        if (error || !quoteId) {
            const detail = error?.message ?? "rpc";
            await recordActionLog("generar_cotizacion_evento", leadId || "quote", `error:${detail}`.slice(0, 2000));
            return JSON.stringify({ error: "cotizacion_no_creada" });
        }
        await recordActionLog("generar_cotizacion_evento", String(quoteId), `ok:${quoteId}`);
        return JSON.stringify({
            ok: true,
            brand: "Miami DJ Beat LLC",
            quote_id: quoteId,
            tipo_evento: resolved.tipo_evento,
            horas: resolved.horas,
            horas_base: resolved.horas_base,
            horas_extra: resolved.horas_extra,
            lines: resolved.lines,
            ...buckets,
            margen_usd: null,
            ...totals,
        });
    }

    async function runFinancialTool(metrica: string): Promise<string> {
        try {
            const base = Deno.env.get("FINANCIAL_ENGINE_URL") ||
                `${Deno.env.get("SUPABASE_URL")}/functions/v1/financial-engine`;
            const key = Deno.env.get("FINANCIAL_ENGINE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
            const r = await fetch(base, {
                method: "POST",
                headers: { apikey: key, Authorization: authHeader || `Bearer ${key}`, "Content-Type": "application/json" },
                body: JSON.stringify({ action: "query", name: metrica, args: [] }),
            });
            const j = await r.json();
            if (!j || j.ok !== true) return JSON.stringify({ error: (j && j.error) || "motor no disponible" });
            const cents = typeof j.data === "number" ? j.data : null;
            return JSON.stringify(cents !== null ? { metrica, cents, usd: cents / 100 } : { metrica, data: j.data });
        } catch (e) {
            return JSON.stringify({ error: String((e as Error)?.message ?? e) });
        }
    }

    // Conversación con soporte de bloques (tool_use / tool_result).
    const convo: Array<{ role: string; content: unknown }> = [
        ...history,
        { role: "user", content: userMessage },
    ];

    // ─── AI COST GOVERNOR (Pieza B) — plan → cuota → modo → router. Founder/owner = ILIMITADO.
    // Quirúrgico: NO toca las 6 herramientas ni el flujo; solo ajusta max_tokens por modo y acumula consumo.
    let govPlan = "free";
    if (gate.role === "owner") {
        govPlan = "founder";
    } else {
        try {
            const { data: pr } = await ADMIN.from("dj_profiles").select("plan").eq("user_id", gate.userId).maybeSingle();
            if (pr?.plan) govPlan = String(pr.plan).toLowerCase();
        } catch (_) { /* default free */ }
    }
    const govUnlimited = govPlan === "founder" || govPlan === "super" || gate.role === "owner";
    let govUsedUnits = 0, govCap = 0;
    if (!govUnlimited) {
        try {
            const { data: ent } = await ADMIN.from("plan_entitlements").select("monthly_ai_capacity").eq("plan", govPlan).maybeSingle();
            if (ent && typeof ent.monthly_ai_capacity === "number") govCap = ent.monthly_ai_capacity;
        } catch (_) { /* */ }
        if (govCap > 0) {
            try {
                const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
                const { data: rows } = await ADMIN.from("ai_usage_events")
                    .select("input_tokens,output_tokens").eq("user_id", gate.userId).gte("created_at", monthStart);
                const tk = ((rows ?? []) as Array<Record<string, unknown>>).reduce(
                    (a, r) => a + (Number(r.input_tokens) || 0) + (Number(r.output_tokens) || 0), 0);
                govUsedUnits = Math.round(tk / 1000);
            } catch (_) { /* */ }
        }
    }
    const govPct = govUnlimited ? 0 : (govCap > 0 ? Math.min(100, Math.round((govUsedUnits / govCap) * 100)) : 100);
    const govMode = govUnlimited ? "FULL" : (govPct >= 100 ? "ESSENTIAL" : (govPct >= 80 ? "SAVER" : "FULL"));
    // Router: haiku ya es el modelo económico; el gobernador ajusta el techo de tokens según el modo.
    const govMaxTokens = govMode === "ESSENTIAL" ? 384 : (govMode === "SAVER" ? 640 : MAX_TOKENS);
    let usInput = 0, usOutput = 0, usToolCalls = 0; // acumuladores para el ledger de consumo (ai_usage_events)

    let reply = "";
    for (let round = 0; round < 3; round++) {
        let cRes: Response;
        try {
            cRes = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: { "x-api-key": apiKey, "anthropic-version": ANTHROPIC_VERSION, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: MODEL,
                    max_tokens: govMaxTokens, // Governor: FULL=MAX_TOKENS · SAVER=640 · ESSENTIAL=384 (founder siempre FULL)
                    // SIN temperature (2026-08-31, bug real encontrado en vivo -- primera
                    // llamada real con Sonnet 5 devolvia 502 "AI provider error" incluso
                    // para un mensaje trivial sin herramientas). Confirmado contra la
                    // referencia oficial actual de la API de Claude: en Sonnet 5, Opus 5 y
                    // Fable 5 el muestreo (temperature/top_p/top_k) esta REMOVIDO -- la API
                    // lo rechaza con 400. Haiku 4.5 si lo aceptaba, por eso nunca fallo
                    // hasta este cambio de modelo. Sin este parametro, el muestreo queda en
                    // el default del modelo -- no hace falta reemplazarlo por nada.
                    system: systemContent,
                    tools: [FINANCIAL_TOOL, LEAD_NOTE_TOOL, AGENDA_READ_TOOL, AGENDA_WRITE_TOOL, AGENDA_EVENTOS_TOOL, CATALOG_READ_TOOL, CATALOG_PRICE_TOOL, QUOTE_WRITE_TOOL, CLIENT_SEARCH_TOOL, SMS_QUEUE_TOOL, MUSIC_TOOL],
                    messages: convo,
                }),
            });
        } catch (err) {
            console.error("[elixis-chat] Anthropic fetch error:", err);
            return new Response(JSON.stringify({ error: "AI provider unreachable" }),
                { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
        }
        if (!cRes.ok) {
            const errBody = await cRes.text();
            console.error("[elixis-chat] Anthropic error", cRes.status, errBody);
            return new Response(JSON.stringify({ error: "AI provider error" }),
                { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
        }
        const data = await cRes.json();
        if (data.usage) { usInput += Number(data.usage.input_tokens) || 0; usOutput += Number(data.usage.output_tokens) || 0; }
        const blocks: Array<Record<string, unknown>> = Array.isArray(data.content) ? data.content : [];
        const text = blocks.filter((b) => b?.type === "text").map((b) => String(b.text ?? "")).join("").trim();

        if (data.stop_reason === "tool_use") {
            convo.push({ role: "assistant", content: blocks });
            usToolCalls += blocks.filter((b) => b?.type === "tool_use").length;
            const results: unknown[] = [];
            for (const b of blocks.filter((b) => b?.type === "tool_use")) {
                const toolName = String(b.name ?? "");
                const decision = approval_gate(toolGateInput(toolName));
                await recordAiKpi(decision.allowed ? "gate_allow" : "gate_deny");
                let out: string;
                if (!decision.allowed) {
                    const target = String(
                        (b.input as Record<string, unknown>)?.lead_id
                        ?? (b.input as Record<string, unknown>)?.dj_user_id
                        ?? toolName,
                    );
                    await recordActionLog(toolName || "unknown_tool", target, `denied:${decision.reason ?? "approval_required"}`);
                    out = JSON.stringify({
                        error: decision.requires_approval ? "approval_required" : "herramienta desconocida",
                        requires_approval: decision.requires_approval,
                        reason: decision.reason,
                    });
                } else if (toolName === "consultar_finanzas") {
                    out = await runFinancialTool(String((b.input as Record<string, unknown>)?.metrica ?? ""));
                    let failed = true;
                    try {
                        const parsed = JSON.parse(out) as { error?: unknown };
                        failed = parsed != null && parsed.error != null;
                    } catch {
                        failed = true;
                    }
                    await recordAiKpi(failed ? "tool_error" : "tool_ok");
                } else if (toolName === "crear_nota_lead") {
                    out = await runLeadNoteTool((b.input as Record<string, unknown>) ?? {});
                    let failed = true;
                    try {
                        const parsed = JSON.parse(out) as { error?: unknown; ok?: unknown };
                        failed = parsed == null || parsed.error != null || parsed.ok !== true;
                    } catch {
                        failed = true;
                    }
                    await recordAiKpi(failed ? "tool_error" : "tool_ok");
                } else if (toolName === "consultar_agenda_artista") {
                    out = await runAgendaReadTool((b.input as Record<string, unknown>) ?? {});
                    let failed = true;
                    try {
                        const parsed = JSON.parse(out) as { error?: unknown; ok?: unknown };
                        failed = parsed == null || parsed.error != null || parsed.ok !== true;
                    } catch {
                        failed = true;
                    }
                    await recordAiKpi(failed ? "tool_error" : "tool_ok");
                } else if (toolName === "registrar_evento_agenda") {
                    out = await runAgendaWriteTool((b.input as Record<string, unknown>) ?? {});
                    let failed = true;
                    try {
                        const parsed = JSON.parse(out) as { error?: unknown; ok?: unknown };
                        failed = parsed == null || parsed.error != null || parsed.ok !== true;
                    } catch {
                        failed = true;
                    }
                    await recordAiKpi(failed ? "tool_error" : "tool_ok");
                } else if (toolName === "modificar_agenda_evento") {
                    out = await runAgendaEventoTool((b.input as Record<string, unknown>) ?? {});
                    let failed = true;
                    try {
                        const parsed = JSON.parse(out) as { error?: unknown; ok?: unknown };
                        failed = parsed == null || parsed.error != null || parsed.ok !== true;
                    } catch {
                        failed = true;
                    }
                    await recordAiKpi(failed ? "tool_error" : "tool_ok");
                } else if (toolName === "consultar_catalogo_precios") {
                    out = await runCatalogReadTool((b.input as Record<string, unknown>) ?? {});
                    let failed = true;
                    try {
                        const parsed = JSON.parse(out) as { error?: unknown; ok?: unknown };
                        failed = parsed == null || parsed.error != null || parsed.ok !== true;
                    } catch {
                        failed = true;
                    }
                    await recordAiKpi(failed ? "tool_error" : "tool_ok");
                } else if (toolName === "cambiar_precio_catalogo") {
                    out = await runCatalogPriceTool((b.input as Record<string, unknown>) ?? {});
                    let failed = true;
                    try {
                        const parsed = JSON.parse(out) as { error?: unknown; ok?: unknown };
                        failed = parsed == null || parsed.error != null || parsed.ok !== true;
                    } catch {
                        failed = true;
                    }
                    await recordAiKpi(failed ? "tool_error" : "tool_ok");
                } else if (toolName === "consultar_musica") {
                    out = await runMusicTool((b.input as Record<string, unknown>) ?? {});
                    let failed = true;
                    try { failed = (JSON.parse(out) as { ok?: unknown })?.ok !== true; } catch { failed = true; }
                    await recordAiKpi(failed ? "tool_error" : "tool_ok");
                } else if (toolName === "buscar_cliente") {
                    out = await runClientSearchTool((b.input as Record<string, unknown>) ?? {});
                    let failed = true;
                    try {
                        const parsed = JSON.parse(out) as { error?: unknown; ok?: unknown };
                        failed = parsed == null || parsed.error != null || parsed.ok !== true;
                    } catch {
                        failed = true;
                    }
                    await recordAiKpi(failed ? "tool_error" : "tool_ok");
                } else if (toolName === "enviar_sms") {
                    out = await runSmsQueueTool((b.input as Record<string, unknown>) ?? {});
                    let failed = true;
                    try {
                        const parsed = JSON.parse(out) as { error?: unknown; ok?: unknown };
                        failed = parsed == null || parsed.error != null || parsed.ok !== true;
                    } catch {
                        failed = true;
                    }
                    await recordAiKpi(failed ? "tool_error" : "tool_ok");
                } else if (toolName === "generar_cotizacion_evento") {
                    out = await runQuoteWriteTool((b.input as Record<string, unknown>) ?? {});
                    let failed = true;
                    try {
                        const parsed = JSON.parse(out) as { error?: unknown; ok?: unknown };
                        failed = parsed == null || parsed.error != null || parsed.ok !== true;
                    } catch {
                        failed = true;
                    }
                    await recordAiKpi(failed ? "tool_error" : "tool_ok");
                } else {
                    out = JSON.stringify({ error: "herramienta desconocida", requires_approval: true });
                }
                /* Mismo criterio que ya usan las ramas para recordAiKpi: hay
                   fallo si el resultado trae `error`, o si trae `ok` y no es
                   true. Un solo punto de anotacion en vez de tocar las ocho
                   ramas, para que este cambio sea de verdad aditivo. */
                let okHerramienta: boolean;
                try {
                    const pr = JSON.parse(out) as { error?: unknown; ok?: unknown };
                    okHerramienta = pr != null && pr.error == null && (pr.ok === undefined || pr.ok === true);
                } catch {
                    okHerramienta = false;
                }
                if (toolName) herramientasUsadas.push({ nombre: toolName, ok: okHerramienta });

                results.push({ type: "tool_result", tool_use_id: b.id, content: out });
            }
            convo.push({ role: "user", content: results });
            continue; // otra vuelta: Claude responde usando el resultado del motor
        }
        reply = text;
        break;
    }

    /* ═══ CIERRE FORZADO ═══════════════════════════════════════════════════
       El bucle de arriba da TRES vueltas. Si en la tercera ELIXIS sigue
       pidiendo herramientas, se sale sin haber escrito ni una palabra y `reply`
       queda vacio: de ahi salia el «(502) Empty response from AI» que el PO
       fotografio. No era un fallo del proveedor ni una respuesta vacia — era
       quedarse sin turnos en mitad de una tarea larga. Le paso justo pidiendo
       registrar CUATRO eventos de golpe, que son varias llamadas encadenadas.

       Las herramientas YA se ejecutaron; lo unico que faltaba era contarlo. Asi
       que se pide una vuelta mas SIN herramientas: al no tener con que llamar,
       el modelo no puede hacer otra cosa que responder en texto y resumir lo
       hecho. Una sola llamada, corta y acotada.

       Si ni asi contesta, entonces si es un fallo de verdad, y se dice con esas
       palabras en vez de culpar a una «respuesta vacia». */
    if (!reply) {
        try {
            const cierre = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: { "x-api-key": apiKey, "anthropic-version": ANTHROPIC_VERSION, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: MODEL,
                    max_tokens: govMaxTokens,
                    // SIN temperature -- ver la nota completa en la primera llamada de
                    // arriba (Sonnet 5 la rechaza con 400).
                    system: systemContent,
                    /* sin `tools` a proposito: obliga a cerrar en texto */
                    messages: [
                        ...convo,
                        { role: "user", content: "Resume en texto, sin usar herramientas, que quedo hecho y que falta. Se breve y concreto." },
                    ],
                }),
            });
            if (cierre.ok) {
                const dc = await cierre.json();
                if (dc.usage) { usInput += Number(dc.usage.input_tokens) || 0; usOutput += Number(dc.usage.output_tokens) || 0; }
                const bl: Array<Record<string, unknown>> = Array.isArray(dc.content) ? dc.content : [];
                reply = bl.filter((b) => b?.type === "text").map((b) => String(b.text ?? "")).join("").trim();
            }
        } catch (errCierre) {
            console.error("[elixis-chat] cierre forzado fallo:", errCierre);
        }
    }

    if (!reply) {
        console.error("[elixis-chat] sin texto tras 3 vueltas y el cierre forzado; herramientas usadas:", herramientasUsadas.length);
        return new Response(JSON.stringify({
            error: "Me quede sin turnos antes de poder responderte. Si pediste varias cosas de golpe, pidemelas por partes.",
        }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ─── LEDGER DE CONSUMO (Pieza B) — best-effort; nunca rompe la respuesta al usuario.
    try {
        const estCents = Math.round(usInput / 10000 + usOutput / 2000); // proxy haiku (~$1/$5 Mtok); calibrar con claude-api
        await ADMIN.from("ai_usage_events").insert({
            user_id: gate.userId,
            plan: govPlan,
            model: MODEL,
            input_tokens: usInput,
            output_tokens: usOutput,
            tool_calls: usToolCalls,
            estimated_cost_cents: estCents,
        });
    } catch (e) {
        console.warn("[elixis-chat] ai_usage_events log:", (e as Error)?.message ?? e);
    }

    /* La forma anterior se conserva intacta: quien solo lea `reply` o
       `sms_pendiente` sigue funcionando igual. El campo nuevo se anade y ya. */
    const cuerpo: Record<string, unknown> = { reply };
    if (smsPendiente) cuerpo.sms_pendiente = smsPendiente;
    if (herramientasUsadas.length) cuerpo.herramientas_usadas = herramientasUsadas;
    /* EL MODO DEL GOBERNADOR, visible por fin. Se calcula desde hace tiempo
       para acortarle la cuerda a ELIXIS cuando baja el presupuesto, pero NO
       salia de aqui: el Capitan estaba siendo protegido A CIEGAS, sin ver que
       su agente iba mas escueto. Ahora lo dice la pastilla de la consola.
       Solo el modo y el porcentaje gastado -- ni cifras de gasto ni topes. */
    cuerpo.modo = govUnlimited ? "ILIMITADO" : govMode;
    cuerpo.modo_pct = govUnlimited ? 0 : govPct;
    return new Response(JSON.stringify(cuerpo),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
});
