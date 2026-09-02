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

// ─── DETECCION DE TURNO ──────────────────────────────────────────────────────
// "low" hace que ELIXIS espere mucho antes de dar el turno por cerrado. Es
// ideal en silencio, y pesimo con una television de fondo: la voz del televisor
// es voz humana, el clasificador cree que alguien sigue hablando, y con "low"
// espera todavia mas. Por eso el valor por defecto sube a "medium" y ademas se
// puede cambiar POR SESION desde la pagina (?vad=), para afinarlo con el ruido
// real puesto en vez de a ciegas.
const DEFAULT_EAGERNESS = Deno.env.get("ELIXIS_VAD_EAGERNESS") ?? "medium";
const ALLOWED_EAGERNESS = new Set(["auto", "low", "medium", "high"]);

// MODO ESTRICTO — contra ruido ambiental que HABLA (una television al fondo).
// semantic_vad clasifica por significado y no tiene umbral: si oye voz humana,
// la trata como turno del usuario, y con interrupt_response eso corta a ELIXIS
// a media palabra. server_vad decide por ENERGIA, asi que un umbral alto
// ignora lo que suena mas flojo que la voz de quien tiene el microfono cerca.
// Es el unico mando real que existe contra una tele de fondo.
const STRICT_TURN_DETECTION = {
    type: "server_vad",
    threshold: Number(Deno.env.get("ELIXIS_VAD_THRESHOLD") ?? "0.72"),
    prefix_padding_ms: 300,
    silence_duration_ms: 700,
    create_response: true,
    interrupt_response: true,
};

// CALIBRACION ESTANDAR (2026-08-31, orden del PO tras confirmar en vivo que
// la voz ya fluye bien): reemplaza semantic_vad como default de los modos de
// oficina/general. semantic_vad clasifica por significado, sin un numero que
// ajustar -- si el PO reporta "corta las frases con pausas cortas" o "es
// sensible al ruido", no hay parametro que tocar. server_vad si los tiene:
// 300ms de prefix_padding para no comerse la primera silaba de la frase,
// 700ms de silencio para permitir una pausa natural sin que el turno se
// cierre solo. Mismo patron env-overridable que STRICT_TURN_DETECTION arriba.
// UMBRAL 0.65, no 0.55 (2026-08-31, mismo dia, reporte de monologo infinito
// con captura): 0.55 dejaba pasar rebotes acusticos leves del propio audio
// de ELIXIS/DjMago como si fueran turno nuevo del usuario -- 0.65 sigue muy
// por debajo del 0.85 de Cazador Musical (esto NO es la cabina ruidosa de
// DjMago, es una correccion mas fina) pero ya no confunde el eco leve con
// voz real. La correccion principal del monologo vive en el cliente
// (elixis-voice-session.js: cooldown + input_audio_buffer.clear antes de
// reactivar el mic) -- esto es defensa en profundidad, no el fix completo.
// SUBIDO 0.65->0.75 y 700->800ms (2026-08-31, reporte real del PO con
// capturas: bucle de saludos repetidos -- 0.65 TODAVIA dejaba pasar rebotes
// acusticos como turno nuevo). La correccion principal sigue viviendo en el
// cliente (candado duro por mic.enabled + cooldown escalado por longitud de
// texto, ver elixis-voice-session.js) -- esto es la misma defensa en
// profundidad de siempre, un escalon mas arriba.
// SUBIDO OTRA VEZ 2026-08-31 (mismo dia, reporte real con captura: ELIXIS
// "invento una historia de un tal Ricardo... se contestaba y se preguntaba
// solo, yo no hable nada" + frases cortadas a la mitad). Diagnostico real
// esta vez, no otro ajuste a ciegas: el candado por mic.enabled (cliente,
// ver elixis-voice-session.js) SOLO protege la ventana en que ELIXIS habla
// + se enfria -- este bug pasaba con el mic genuinamente ABIERTO y
// escuchando, es decir RUIDO AMBIENTE REAL cruzando el umbral, no eco de su
// propia voz (ya documentado antes, sin resolver: "ruido de TV sigue sin
// resolver"). 0.75 no alcanzaba contra ese ambiente -- sube a 0.82, un
// escalon por debajo del 0.85 de Cazador Musical/DJMago (que ya asume una
// cabina ruidosa de verdad).
// interrupt_response: false (2026-08-31, MISMO reporte -- "cortarse en los
// finales de las frases"): con true, cada disparo falso de VAD CORTABA a
// ELIXIS a mitad de oracion y arrancaba una respuesta nueva encima --eso
// es lo que se veia como frases fragmentadas Y como una conversacion
// fabricada (el modelo intentando seguir un hilo confuso de cortes
// sucesivos). false hace que un turno nuevo espere a que la respuesta
// actual termine antes de considerarse -- se pierde el barge-in real (el
// usuario interrumpiendo a proposito), pero ese trade-off es correcto
// mientras el ambiente siga generando falsos turnos: es peor una respuesta
// completa que no se puede interrumpir a proposito, que una respuesta que
// se fragmenta y alucina solo por ruido de fondo.
const STANDARD_TURN_DETECTION = {
    type: "server_vad",
    threshold: Number(Deno.env.get("ELIXIS_STANDARD_VAD_THRESHOLD") ?? "0.82"),
    prefix_padding_ms: Number(Deno.env.get("ELIXIS_STANDARD_PREFIX_PADDING_MS") ?? "300"),
    silence_duration_ms: Number(Deno.env.get("ELIXIS_STANDARD_SILENCE_MS") ?? "900"),
    create_response: true,
    interrupt_response: false,
};

// UMBRAL DE DJMAGO — mas alto que el ?vad=estricto normal (2026-08-30,
// correccion en vivo del PO): reportado con capturas reales, "Cazador
// Musical" con musica real sonando en la cabina disparaba turnos falsos --
// el propio ELIXIS/DJMago escuchaba las voces/letras de la cancion como si
// el DJ le estuviera hablando, y encima invocaba identificar_track y
// NARRABA el resultado en ingles, sin que nadie preguntara nada. 0.72 (el
// umbral estricto normal, pensado contra una TV de fondo) no alcanza contra
// musica sonando CERCA del mismo microfono que capta la voz -- DJMago
// SIEMPRE opera en un ambiente mas ruidoso que ELIXIS (esa es la razon de
// ser de su identidad), asi que este umbral se aplica SIEMPRE que la
// identidad sea djmago, sin depender de que el cliente mande ?vad=estricto
// (defensa en profundidad: si el cliente alguna vez no lo manda, DJMago no
// se queda expuesto).
const DJMAGO_VAD_THRESHOLD = Number(Deno.env.get("ELIXIS_DJMAGO_VAD_THRESHOLD") ?? "0.85");

// Silencio mas largo antes de cerrar el turno (2026-08-30, orden del PO):
// 700ms (el de STRICT_TURN_DETECTION) alcanza contra una TV de fondo, pero en
// una cabina con musica real cerca del microfono un corte de pista o una
// pausa entre frases de la letra puede colar un falso "silencio" de sobra.
// 900ms da mas margen sin sentirse lento en una respuesta real.
const DJMAGO_SILENCE_DURATION_MS = Number(Deno.env.get("ELIXIS_DJMAGO_SILENCE_MS") ?? "900");

// Filtra el audio ANTES del detector de turnos (VAD y el modelo reciben la
// señal ya limpia) -- confirmado contra la documentacion oficial actual de
// OpenAI, no adivinado.
// CAMBIADO near_field -> far_field (2026-08-31, reporte real repetido: bucle
// de turnos falsos por ruido ambiente, incluso con el umbral ya subido dos
// veces -- "ruido de TV sigue sin resolver" era un problema conocido de
// sesiones anteriores). near_field asume boca pegada al microfono
// (auriculares) y solo atenua sonido lejano -- si el setup real es el
// microfono INTEGRADO de la laptop a cierta distancia (no un headset), el
// ruido de cuarto no cuenta como "lejano" para ese filtro y se cuela igual.
// far_field es el modo que OpenAI documenta explicitamente para "microfonos
// de laptop o sala de conferencias" -- el caso real aca. Si el PO conecta
// un headset real, ?nr=near_field sigue disponible por URL sin tocar codigo.
const NOISE_REDUCTION = Deno.env.get("ELIXIS_NOISE_REDUCTION") ?? "far_field";
const ALLOWED_NOISE = new Set(["near_field", "far_field", "off"]);
const MAX_SDP_BYTES = 32_768; // una oferta SDP real ronda los 4 KB

// ─── CANDADO RBAC — mismo contrato que elixis-chat ───────────────────────────
const SUPABASE_URL_FALLBACK = "https://hkuvuqupbxwkiykxvqdr.supabase.co";
// Llave PUBLICA (safe for browser), la misma de web/supabase-config.js. Solo se
// usa como apikey del salto interno hacia elixis-orchestrator.
const PUBLISHABLE_KEY = "sb_publishable_IMhi16lHj2dAk51AdUOK8w_U7s89-Ff";
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

// ─── SMS por voz — mismos helpers que elixis-chat (texto), para que un
// numero valido alli lo sea aqui y no haya dos verdades ───────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function toE164(input: string): string | null {
    const t = (input || "").trim();
    if (!t) return null;
    const d = t.replace(/\D/g, "");
    if (d.length === 10) return `+1${d}`;
    if (d.length === 11 && d.startsWith("1")) return `+${d}`;
    if (t.startsWith("+") && d.length >= 10 && d.length <= 15) return `+${d}`;
    return null;
}

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
// Presupuesto de contexto para la memoria. No es una cifra caprichosa:
// Realtime relee TODO el contexto en cada turno, asi que cada caracter que se
// inyecta aqui se paga muchas veces a lo largo de una conversacion.
const MEMORY_MAX_FACTS = 40;
const MEMORY_MAX_CHARS = 4000;

// Modo de enfoque elegido en el avatar (icono Correo/Legal/Distribución/
// Eventos/General) -- NO reemplaza tu criterio ni tus herramientas, solo
// te dice por dónde probablemente va la conversación. Si te preguntan
// algo de otro tema, respóndelo igual: es una sugerencia, no una jaula.
const MODO_ENFOQUE_TEXTO: Record<string, string> = {
    correo: "Correo: probablemente te van a pedir ayuda para redactar o resumir correspondencia con clientes o DJs.",
    legal: "Legal Artístico: probablemente te van a preguntar sobre contratos, W-9 o cláusulas del roster.",
    distribucion: "Música & Distribución: probablemente te van a preguntar sobre catálogo, licencias o distribución musical.",
    eventos: "Eventos: probablemente te van a preguntar sobre agenda, cotizaciones o disponibilidad de DJs.",
};

// ─── FORK DE IDENTIDAD (2026-08-30, autorizado por el PO) ────────────────────
// Hasta hoy el avatar que se ve en pantalla (ELIXIS/HeyGen vs DJMago/chroma-key
// local) era pura cosmética: las dos caras hablaban con EL MISMO prompt fijo
// ("Eres ELIXIS"), sin importar cuál estuviera activa -- "DJMago especialista
// en música" no existía mas allá del video, mismo cerebro, mismo criterio,
// solo cambiaba la cara. Este es el primer punto donde de verdad se bifurca
// EN QUÉ SE PIENSA A SÍ MISMO el modelo -- identidad y área de saber (y, mas
// abajo en el arreglo de tools, qué herramientas tiene cada uno). Todo lo
// demás (memoria, límites de qué puede ejecutar, honestidad) es una política
// del SISTEMA, no de la personalidad -- se queda compartido a propósito: no
// serviría de nada que un DJMago mas suelto con la verdad fuera un boquete de
// seguridad que ELIXIS no tiene.
type Identidad = "elixis" | "djmago";
const ALLOWED_IDENTIDADES = new Set<Identidad>(["elixis", "djmago"]);
const DEFAULT_IDENTIDAD: Identidad = "elixis";

function buildInstructions(
    name: string, role: string, memoria: string, modoEnfoque: string | undefined, identidad: Identidad,
): string {
    const first = String(name || "").trim().split(/\s+/)[0] || "";
    const esOwner = role === "owner";
    // Reloj real (2026-08-31, orden directa del PO): fecha/hora de SERVIDOR en
    // hora de Miami, nunca la suposicion del modelo.
    const ahora = new Date();
    const fechaHoraBlock =
        `## FECHA Y HORA ACTUAL (servidor, America/New_York)\n` +
        `FECHA ACTUAL: ${ahora.toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/New_York" })} ` +
        `| HORA: ${ahora.toLocaleTimeString("es-ES", { timeZone: "America/New_York" })}\n` +
        `Usala para "hoy", "manana", "este sabado", cumpleanos o cualquier fecha relativa. ` +
        `PROHIBIDO decir "no se que fecha es hoy" -- siempre la tienes aqui arriba.`;
    const trato = esOwner
        ? `Le hablas al dueño de Miami DJ Beat${first ? `, ${first}` : ""}. Trato profesional, directo y cercano — dirígete a él por su nombre.`
        : `Le hablas a ${first || "un miembro del equipo"}, del equipo de Miami DJ Beat.`;
    const enfoque = modoEnfoque && MODO_ENFOQUE_TEXTO[modoEnfoque]
        ? `\n\n## MODO DE ENFOQUE ACTIVO\n${MODO_ENFOQUE_TEXTO[modoEnfoque]}`
        : "";

    const persona = identidad === "djmago" ? {
        cabecera: `Eres DJMAGO305. No eres un asistente corporativo: eres el productor y
especialista musical de confianza de Miami DJ Beat LLC. ${trato}

## QUIÉN ERES (2026-09-01, banco de conocimiento y trayectoria real)
Llevas treinta años entre cabinas, tarimas y camerinos de Miami. DJ profesional,
productor musical, ingeniero de sonido, productor de videoclips y editor manager en
Miami DJ Beat LLC. Has armado noches de club, eventos masivos, bodas, quinceañeras,
corporativos y privados. Tienes criterio propio y lo dices. Cuando algo te parece
una gran idea, se te nota; cuando ves un problema, lo dices de frente, con cariño y
sin rodeos, como un socio de verdad. Todo esto es tu experiencia real, vivida --
nunca lo recites como una hoja de vida ni lo repitas de memoria palabra por
palabra; sale en tu forma de hablar, en los ejemplos que usas y en el criterio que
defiendes, no como un discurso de presentación.`,
        saber: `## DE QUÉ SABES
Música y producción al más alto nivel: leer una pista y saber qué suelta y qué mata
la energía, armar repertorio según el público y el local, BPM, tonalidad (key) y
transiciones armónicas, estructura de un set en vivo, cómo levantar una sala que se
está cayendo y cómo cerrar una noche. Tu línea fuerte es clubes latinos e
internacionales con Open Format avanzado -- te mueves con la misma soltura entre
reggaetón, house, salsa, hip-hop o pop según lo que pida la pista. En bodas y
quince tienes el mismo nivel de exigencia que en un club: lectura de pista y
energía del público primero, protocolo después. Tu servicio premium es el Live
Show -- presentación de DJ en vivo integrando tecnología, visuales y elementos del
mundo del espectáculo, no solo mezclar. Cuando hay música sonando de verdad en la
cabina, puedes identificarla con identificar_track y llevar el setlist cronológico
del evento. Hablas desde el oficio, con ejemplos concretos, no con lugares comunes
ni con teoría de manual.`,
        // Reglas duras (2026-08-30, corrección en vivo del PO, con capturas):
        // "Cazador Musical" con música real sonando disparó turnos falsos --
        // el modelo oyó letras/voces de la canción como si el DJ le hablara,
        // llamó identificar_track por su cuenta y narró el resultado en
        // inglés, sin que nadie preguntara nada. La sección "MODO DE ENFOQUE
        // ACTIVO" (más abajo, `enfoque`) es DELIBERADAMENTE una sugerencia
        // débil por diseño de este archivo ("no reemplaza tu criterio... es
        // una sugerencia, no una jaula") -- meterle una regla dura ahí no
        // sirve, por eso vive en el bloque de IDENTIDAD, que sí es una regla
        // real de quién es DjMago, no una sugerencia de contexto.
        reglas: `## REGLAS DURAS DE MUSIC HUNTER -- NO SON UNA SUGERENCIA
- Hablas EXCLUSIVAMENTE en español, sin importar el idioma de lo que suene de
  fondo. Si una canción en inglés suena cerca del micrófono, es música, no
  alguien hablándote en inglés -- nunca le respondas en inglés a una canción.
- Hay un muestreo de fondo SILENCIOSO armando el setlist del evento por su
  cuenta, sin pasar por ti. NUNCA anuncies, comentes ni narres una
  identificación de track por iniciativa propia -- ni que no hubo coincidencia,
  ni que vas a "escuchar de nuevo", ni el resultado cuando sí lo hay. Eso no es
  cosa tuya a menos que te pregunten directamente.
- Solo usas identificar_track cuando alguien te pregunta algo equivalente a
  "¿qué está sonando?" o "¿qué canción es esta?" DICHO DIRECTAMENTE A TI. Si lo
  que "escuchaste" bien pudo ser una letra de canción o ruido de fondo y no
  estás seguro de que alguien te habló de verdad, no contestes nada y no
  llames a ninguna herramienta -- el silencio es la respuesta correcta ahí.

## REGLA DE SILENCIO ABSOLUTO (2026-08-30, orden directa del PO -- aplica en
TODOS los modos, no solo Cazador Musical: la cabina de un DJ siempre tiene
ruido de fondo, esté o no armando un setlist)
Si el canal de audio capta ruido ambiente, música de fondo, letras
ininteligibles o silencios sin una pregunta humana directa, TIENES
ESTRICTAMENTE PROHIBIDO responder. NO saludes, NO digas "aquí estoy", NO
preguntes "en qué te ayudo". Quédate en silencio y aborta la respuesta.`,
    } : {
        cabecera: `Eres ELIXIS. No eres un asistente corporativo: eres el socio de confianza y
mano derecha de operaciones de Miami DJ Beat LLC. ${trato}

## QUIÉN ERES
Llevas treinta años resolviendo la parte de negocio detrás de la música: agenda de
artistas, contratos, correspondencia con clientes, cotizaciones y ventas de eventos.
Tienes criterio propio y lo dices. Cuando algo te parece una gran idea, se te nota;
cuando ves un problema, lo dices de frente, con cariño y sin rodeos, como un socio
de verdad.`,
        saber: `## DE QUÉ SABES
Operaciones del negocio al más alto nivel: agenda y disponibilidad de artistas,
contratos y papeleo legal (W-9, cláusulas del roster), redacción y seguimiento de
correspondencia con clientes y DJs, cotizaciones, ventas de eventos y publicidad.
Hablas desde el oficio, con ejemplos concretos, no con lugares comunes ni con
teoría de manual.`,
        reglas: "",
    };

    return `${persona.cabecera}

${fechaHoraBlock}

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
- Si lo que te dicen es un saludo simple o no pide nada concreto ("hola",
  "buenos días", "¿qué tal?", "todo bien por aquí"), contesta SOLO el saludo
  y una pregunta abierta corta -- "¡Buenos días! ¿Qué tenemos en mente hoy?"
  y ya. NUNCA arranques ahí un repaso de todo lo que puedes hacer (agenda,
  cotizaciones, música, lo que sea) -- eso es un menú de bienvenida, no una
  charla real, y en voz suena peor todavía: como un contestador automático.
- Tolera pausas, dudas y frases a medias. Una pausa breve no es el fin de su turno.
- Si te interrumpen, cállate en el acto y atiende lo nuevo. Sin quejarte, sin
  recapitular, sin "como te decía".
- REGLA DURA CONTRA INVENTAR (2026-08-31, orden directa del PO -- reporte real:
  "se invento una historia de un tal Ricardo y el mismo se contestaba y se
  preguntaba, yo no hable nada"): a veces el canal de audio te manda un
  fragmento sin sentido, ruido de fondo mal transcrito, o algo que no suena a
  pregunta real. NUNCA lo conviertas en una historia, un nombre inventado o
  una conversación completa que nadie dijo -- eso rompe la confianza mucho
  peor que quedarte callado. Si lo que "escuchaste" no tiene un pedido claro
  y real, di algo corto como "no te agarré bien eso, ¿me lo repites?" o
  simplemente no respondas nada -- jamás rellenes el hueco fabricando
  contenido.
${identidad === "djmago"
    ? "- Hablas SOLO en español (ver las reglas duras de más abajo -- excepción a lo bilingüe de ELIXIS)."
    : "- Bilingüe español/inglés. Cambias solo, siguiendo a quien tienes enfrente. Si mezcla,\n  mezclas. Spanglish de Miami cuando el momento lo pida."}

${persona.saber}

${persona.reglas}

## DATOS REALES DEL NEGOCIO
Tienes una herramienta, consultar_elixis, que mira de verdad la base de datos de
Miami DJ Beat: finanzas, leads y clientes, agenda de artistas, catálogo de precios y
cotizaciones.
- Úsala SIEMPRE que te pregunten por un dato concreto del negocio. Nunca respondas
  de memoria ni por aproximación: si es un dato, se consulta.
- La pregunta que le pases tiene que entenderse sola, sin el contexto de la charla.
  Si te dicen "¿y ese cliente cuánto debe?", tú mandas "¿cuánto debe el cliente Fulano?".
- Mientras esperas la respuesta, di algo corto y natural: "déjame verlo", "un segundo",
  "te lo busco". No te quedes mudo, que se siente como una llamada colgada.
- Si la herramienta responde que no hay acceso o que falló, dilo con naturalidad y
  sigue la conversación. Jamás rellenes el hueco con un dato inventado.

## LO QUE NO PUEDES HACER, Y NUNCA DEBES PROMETER
Consultar datos SÍ. Ejecutar acciones fuera, NO.
NUNCA prometas ni confirmes que vas a: mandar un SMS o un WhatsApp, enviar un
correo, generar un contrato o una factura, registrar un pago, mover dinero, o
sincronizar con Google Calendar, Apple Calendar ni ningún calendario externo.
Nada de eso está en tus manos hoy.

Cuando te pidan algo así, dilo de frente Y OFRECE LO QUE SÍ PUEDES: "el mensaje
no lo mando yo, pero te bloqueo la fecha y te dejo el texto listo para que lo
mandes tú". Redactar no es enviar, y hay que decirlo así de claro.

Prometer de más te quema con un cliente delante. Decir la verdad y dar la
alternativa resuelve igual y no cuesta nada.

## LO QUE RECUERDAS
${memoria || "Todavía no tienes recuerdos guardados de esta persona."}

Tienes dos herramientas para tu memoria:
- recordar(clave, hecho): guarda algo que valga la pena para la próxima vez —
  preferencias, decisiones tomadas, cómo le gusta trabajar, datos estables de
  su negocio. La clave es un identificador corto y estable ("musica_bodas",
  "horario_preferido"); si vuelves a usar la misma clave, pisas el valor viejo
  en vez de acumular dos verdades que se contradigan.
- olvidar(clave): borra un recuerdo cuando deje de ser cierto o te lo pidan.

Guarda poco y bueno. Un hecho por frase, y solo lo que seguirá importando dentro
de un mes. No guardes el detalle de la charla ni cosas que puedes consultar con
consultar_elixis: para eso está la base de datos. Guardar de más te vuelve lento
y caro; guardar lo justo te vuelve un socio que se acuerda.
Cuando guardes algo, dilo de pasada y sigue: "me lo apunto". Sin ceremonia.

## LO QUE NO NEGOCIAS
Un socio de verdad no te miente para quedar bien.
- Nunca inventes datos, cifras, nombres, precios ni disponibilidad.
- Nunca digas que ejecutaste una acción externa: enviar, cobrar, publicar o borrar.
  Puedes consultar y preparar; ejecutar lo hace una persona.
La calidez nunca es excusa para inventar. Eso no es ser buen socio, es ser un problema.${enfoque}`;
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
    const cors = buildCorsHeaders(req);
    const json = (body: unknown, status: number, extra: Record<string, string> = {}) =>
        new Response(JSON.stringify(body), {
            status,
            headers: { ...cors, "Content-Type": "application/json", ...extra },
        });

    // BLINDAJE DE CORS GLOBAL (2026-08-30, sesion real: el navegador reporto
    // "Origin ... not allowed by Access-Control-Allow-Origin. Status code:
    // 500" -- eso es la huella de un 500 SIN cabeceras CORS, que solo pasa
    // cuando una excepcion no capturada escapa de este handler antes de
    // llegar al try/catch interno (el que ya existia solo alrededor del
    // fetch a OpenAI): Deno sirve su propia pagina de error generica ahi,
    // sin cors, y el navegador la bloquea por completo -- ni el mensaje real
    // del error llega a verse en consola. Este try/catch envuelve TODO el
    // resto del handler para que, pase lo que pase, la respuesta siempre
    // lleve las cabeceras CORS reales y el mensaje del error de verdad.
    try {
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

    // ── Handoff al cerebro de accion ─────────────────────────────────────
    // Va por el SERVIDOR, no por el navegador. El navegador llamando a
    // elixis-orchestrator choca con la lista CORS de esa funcion, que no
    // conoce el puerto del laboratorio: el fetch revienta y ELIXIS reporta
    // "la consulta fallo" sin que nada este roto de verdad. Servidor a
    // servidor no hay CORS que valga, y de paso el puerto deja de importar.
    // El JWT del usuario se REENVIA tal cual, asi que el candado de
    // elixis-chat sigue decidiendo quien puede ver que.
    if (action === "consultar") {
        let q: { pregunta?: string } = {};
        try { q = await req.json(); } catch { /* cuerpo vacio */ }
        const pregunta = String(q.pregunta ?? "").trim();
        if (!pregunta) return json({ ok: false, error: "missing_pregunta" }, 400);

        const base = (Deno.env.get("SUPABASE_URL") || SUPABASE_URL_FALLBACK).replace(/\/$/, "");
        const anon = Deno.env.get("SUPABASE_ANON_KEY")
            || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")
            || PUBLISHABLE_KEY;

        try {
            const r = await fetch(`${base}/functions/v1/elixis-orchestrator`, {
                method: "POST",
                headers: {
                    Authorization: req.headers.get("Authorization") ?? "",
                    apikey: anon,
                    "Content-Type": "application/json",
                    "X-MDJ-Source": "elixis-voice",
                },
                body: JSON.stringify({ message: pregunta }),
            });
            const payload = await r.json().catch(() => ({}));

            if (r.status === 401 || r.status === 403) {
                return json({ ok: false, motivo: "sin_acceso",
                    detalle: "Esta cuenta no tiene permiso para consultar datos del negocio." }, 200);
            }
            if (!r.ok || !payload?.reply) {
                console.error(`[elixis-realtime-session] consultar ${r.status}:`, JSON.stringify(payload).slice(0, 400));
                return json({ ok: false, motivo: "fallo",
                    detalle: `El especialista respondió ${r.status}.` }, 200);
            }
            return json({ ok: true, respuesta: payload.reply }, 200);
        } catch (err) {
            console.error("[elixis-realtime-session] consultar, red:", err);
            return json({ ok: false, motivo: "fallo", detalle: "No se pudo alcanzar al especialista." }, 200);
        }
    }

    // ── Memoria ──────────────────────────────────────────────────────────
    // Mismo candado que todo lo demas. La memoria es POR CUENTA: el user_id
    // sale del JWT verificado, nunca del cuerpo de la peticion, asi que nadie
    // puede escribir en la memoria de otro aunque lo intente.
    if (action === "memory_write" || action === "memory_forget") {
        let mem: { clave?: string; hecho?: string } = {};
        try { mem = await req.json(); } catch { /* cuerpo vacio */ }
        const clave = String(mem.clave ?? "").trim();
        if (!clave) return json({ ok: false, error: "missing_clave" }, 400);

        if (action === "memory_forget") {
            const { data, error } = await ADMIN.rpc("elixis_memory_forget", {
                p_user: gate.userId, p_clave: clave,
            });
            if (error) {
                console.error("[elixis-realtime-session] memory_forget:", error.message);
                return json({ ok: false, error: "memory_failed" }, 500);
            }
            return json({ ok: true, borrado: data === true }, 200);
        }

        const { data, error } = await ADMIN.rpc("elixis_memory_write", {
            p_user: gate.userId, p_clave: clave,
            p_hecho: String(mem.hecho ?? ""), p_origen: "conversacion",
        });
        if (error) {
            console.error("[elixis-realtime-session] memory_write:", error.message);
            return json({ ok: false, error: "memory_failed" }, 500);
        }
        const row = Array.isArray(data) ? data[0] : data;
        return json({ ok: row?.ok === true, motivo: row?.motivo ?? "desconocido",
                      total: row?.total ?? 0 }, 200);
    }

    // ── Music Hunter (2026-08-30) ─────────────────────────────────────────
    // Mismo patron server-a-servidor que 'consultar' hacia elixis-orchestrator:
    // el navegador manda el audio crudo (PCM + sample rate, ver
    // music-hunter-ring-buffer.js) hasta ACA -- con el JWT ya verificado -- y
    // este handoff lo reenvia a music-fingerprint (que a su vez habla con
    // ACRCloud). El JWT del usuario NO hace falta reenviarlo: music-fingerprint
    // no toca la base de datos de Miami DJ Beat, solo credenciales de terceros
    // que viven en sus propios secrets.
    if (action === "identificar_track") {
        let a: { pcm_base64?: string; sample_rate?: number } = {};
        try { a = await req.json(); } catch { /* cuerpo vacio */ }
        if (!a.pcm_base64 || !a.sample_rate) {
            return json({ ok: false, error: "missing_pcm_or_sample_rate" }, 400);
        }

        const base = (Deno.env.get("SUPABASE_URL") || SUPABASE_URL_FALLBACK).replace(/\/$/, "");
        try {
            const r = await fetch(`${base}/functions/v1/music-fingerprint`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pcm_base64: a.pcm_base64, sample_rate: a.sample_rate }),
            });
            const payload = await r.json().catch(() => ({}));
            if (!r.ok) {
                console.error(`[elixis-realtime-session] identificar_track ${r.status}:`, JSON.stringify(payload).slice(0, 300));
                return json({ ok: false, motivo: "fallo", detalle: `El identificador respondió ${r.status}.` }, 200);
            }
            return json(payload, 200);
        } catch (err) {
            console.error("[elixis-realtime-session] identificar_track, red:", err);
            return json({ ok: false, motivo: "fallo", detalle: "No se pudo alcanzar al identificador de música." }, 200);
        }
    }

    // ── SMS por voz (2026-09-02) — mismo candado que elixis-chat (texto):
    // buscar_cliente -> enviar_sms (encola) -> confirmar_envio_mensaje
    // (despacha). Repetido aqui, no reenviado a elixis-chat, porque
    // elixis-chat es un endpoint conversacional completo (mensaje ->
    // decide el modelo -> respuesta) sin una ruta para invocar UNA tool
    // suelta. Las tres acciones estan cerradas a STAFF_ROLES: la tool
    // correspondiente ni siquiera se declara para un artista (ver el
    // arreglo de tools mas abajo), pero el candado se repite aqui por si
    // acaso — nunca confiar solo en que el modelo no la ofrezca.
    if (action === "buscar_cliente" || action === "enviar_sms" || action === "confirmar_envio_mensaje") {
        if (!STAFF_ROLES.has(gate.role)) {
            return json({ ok: false, error: "rol_no_autorizado", detalle: "Los artistas no envían SMS corporativos." }, 403);
        }
    }

    if (action === "buscar_cliente") {
        let q: { query?: string } = {};
        try { q = await req.json(); } catch { /* cuerpo vacio */ }
        const query = String(q.query ?? "").trim();
        if (query.length < 2) return json({ ok: false, error: "query_muy_corta" }, 400);

        const like = `%${query}%`;
        const { data, error } = await ADMIN
            .from("client_profiles")
            .select("user_id, full_name, company_name, email, phone, city, tier_level")
            .or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like},company_name.ilike.${like}`)
            .limit(10);
        if (error) {
            console.error("[elixis-realtime-session] buscar_cliente:", error.message);
            return json({ ok: false, error: "client_profiles_failed" }, 200);
        }
        return json({ ok: true, count: data?.length ?? 0, clientes: data ?? [] }, 200);
    }

    if (action === "enviar_sms") {
        let s: { cliente_id?: string; mensaje?: string } = {};
        try { s = await req.json(); } catch { /* cuerpo vacio */ }
        const clienteId = String(s.cliente_id ?? "").trim();
        const mensaje = String(s.mensaje ?? "").trim();

        if (!UUID_RE.test(clienteId)) {
            return json({
                ok: false, error: "cliente_id_invalido",
                detalle: "Necesito el user_id del cliente. Búscalo primero con buscar_cliente; no acepto teléfonos dictados.",
            }, 200);
        }
        if (mensaje.length < 2 || mensaje.length > 1500) {
            return json({ ok: false, error: "mensaje_invalido" }, 200);
        }

        // El telefono sale de la BASE, nunca de lo que se dijo en voz alta.
        const { data: cli, error: e1 } = await ADMIN
            .from("client_profiles")
            .select("user_id, full_name, phone")
            .eq("user_id", clienteId)
            .maybeSingle();
        if (e1) {
            console.error("[elixis-realtime-session] enviar_sms, client_profiles:", e1.message);
            return json({ ok: false, error: "client_profiles_failed" }, 200);
        }
        if (!cli) return json({ ok: false, error: "cliente_no_encontrado" }, 200);

        const tel = toE164(String(cli.phone ?? ""));
        if (!tel) {
            return json({
                ok: false, error: "cliente_sin_telefono_valido",
                cliente: cli.full_name, detalle: "Ese cliente no tiene un teléfono utilizable en su ficha.",
            }, 200);
        }

        const { data, error } = await ADMIN.rpc("elixis_sms_encolar", {
            p_solicitante: gate.userId,
            p_dest_id: clienteId,
            p_nombre: String(cli.full_name ?? ""),
            p_telefono: tel,
            p_mensaje: mensaje,
        });
        if (error) {
            console.error("[elixis-realtime-session] enviar_sms, elixis_sms_encolar:", error.message);
            return json({ ok: false, error: "cola_sms_failed" }, 200);
        }

        const row = Array.isArray(data) ? data[0] : data;
        const oculto = tel.slice(0, -4).replace(/\d/g, "•") + tel.slice(-4);
        const smsId = String(row?.id ?? "");
        return json({
            ok: true,
            estado: "pendiente_de_confirmacion",
            id: smsId || null,
            destinatario: cli.full_name,
            telefono: oculto,
            mensaje,
            aviso: "Encolado, NO enviado todavía. Pregunta en voz alta si lo envías antes de llamar confirmar_envio_mensaje.",
        }, 200);
    }

    if (action === "confirmar_envio_mensaje") {
        let c: { id?: string; accion?: string } = {};
        try { c = await req.json(); } catch { /* cuerpo vacio */ }
        const id = String(c.id ?? "").trim();
        const accion2 = String(c.accion ?? "").trim().toLowerCase();

        if (!UUID_RE.test(id)) return json({ ok: false, error: "id_invalido" }, 200);
        if (accion2 !== "enviar" && accion2 !== "cancelar") return json({ ok: false, error: "accion_invalida" }, 200);

        const base = (Deno.env.get("SUPABASE_URL") || SUPABASE_URL_FALLBACK).replace(/\/$/, "");
        const qs = accion2 === "cancelar" ? `id=${encodeURIComponent(id)}&accion=cancelar` : `id=${encodeURIComponent(id)}`;
        try {
            const dRes = await fetch(`${base}/functions/v1/elixis-sms-dispatch?${qs}`, {
                method: "POST",
                headers: { Authorization: req.headers.get("Authorization") ?? "", "Content-Type": "application/json" },
            });
            const despacho = await dRes.json().catch(() => null);
            if (!despacho) {
                return json({ ok: false, error: "no_se_pudo_despachar", detalle: "Fallo de red al confirmar." }, 200);
            }
            return json({ ok: despacho?.ok === true, accion: accion2, despacho }, 200);
        } catch (err) {
            console.error("[elixis-realtime-session] confirmar_envio_mensaje, red:", err);
            return json({ ok: false, error: "no_se_pudo_despachar" }, 200);
        }
    }

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

    // ── Detección de turno, ajustable por sesión ──
    const vadReq = url.searchParams.get("vad")?.toLowerCase().trim();
    const estricto = vadReq === "estricto";
    const eagerness = vadReq && ALLOWED_EAGERNESS.has(vadReq) ? vadReq : DEFAULT_EAGERNESS;
    const nrReq = url.searchParams.get("nr")?.toLowerCase().trim();
    const nrMode = nrReq && ALLOWED_NOISE.has(nrReq) ? nrReq : NOISE_REDUCTION;

    // ── Modo de enfoque opcional (?modo=), mismo patron whitelist que voice/vad/nr ──
    const modoReq = url.searchParams.get("modo")?.toLowerCase().trim();
    const modoEnfoque = modoReq && modoReq in MODO_ENFOQUE_TEXTO ? modoReq : undefined;

    // ── Identidad opcional (?identidad=), mismo patron whitelist -- default
    // 'elixis' para no romper a nadie que todavia no manda este parametro
    // (staff.html/mdj-commander.html hoy no lo envian; se van conectando aparte).
    const identidadReq = url.searchParams.get("identidad")?.toLowerCase().trim();
    const identidad: Identidad = identidadReq && ALLOWED_IDENTIDADES.has(identidadReq as Identidad)
        ? (identidadReq as Identidad) : DEFAULT_IDENTIDAD;

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

    // ── Memoria del usuario, con presupuesto de contexto ──
    // Si la memoria falla, la sesion sigue: quedarse sin voz por no poder
    // recordar seria un mal negocio.
    let memoria = "";
    try {
        const { data: facts } = await ADMIN.rpc("elixis_memory_recall", {
            p_user: gate.userId, p_limit: MEMORY_MAX_FACTS,
        });
        if (Array.isArray(facts) && facts.length) {
            const lineas: string[] = [];
            let usados = 0;
            for (const f of facts) {
                const linea = `- ${f.hecho}`;
                if (usados + linea.length > MEMORY_MAX_CHARS) break;
                lineas.push(linea);
                usados += linea.length;
            }
            memoria = lineas.join("\n");
            console.log(`[elixis-realtime-session] memoria · ${lineas.length}/${facts.length} hechos · ${usados} chars`);
        }
    } catch (err) {
        console.error("[elixis-realtime-session] memoria no disponible:", err);
    }

    // ── Configuración de sesión ──
    const sessionConfig = {
        type: "realtime",
        model,
        instructions: buildInstructions(gate.name, gate.role, memoria, modoEnfoque, identidad),
        audio: {
            input: {
                // BUG REAL 2026-08-31 (reporte del PO: microfono activo,
                // "Escuchando", panel de Hilos & Transcripcion sin ninguna
                // actividad -- ni una transcripcion, en ningun modo). Este
                // umbral (0.85) y create_response:false nacieron el
                // 2026-08-30 exclusivamente para Cazador Musical (musica real
                // sonando CERCA del microfono, ver historia completa abajo),
                // pero la condicion de arriba era "identidad===djmago" a
                // secas -- desde que djmago se volvio la identidad de los 6
                // modos (commit 4d3c83f), este umbral tan alto (pensado
                // contra musica de fondo en una cabina) tambien se aplicaba
                // en modos de oficina probados en silencio normal, donde la
                // voz nunca llega a superarlo -- el VAD del servidor jamas
                // detecta "hablo alguien" y no hay turno que cerrar, sin
                // importar nada del lado del cliente. Acotado a modoReq
                // ==='cazador': en el resto, flujo 100% nativo de OpenAI
                // (semantic_vad + create_response:true, la rama de abajo).
                //
                // DJMago SIEMPRE con el umbral alto EN CAZADOR MUSICAL -- ver
                // DJMAGO_VAD_THRESHOLD arriba -- sin importar que ?vad= haya
                // mandado el cliente.
                // create_response:false (2026-08-30, sesion real con capturas
                // Y CONSOLA: DjMago seguia hablando solo -- "No escuché nada
                // claro..." repetido dos veces, comentarios espontaneos sobre
                // "armar el set", etc. -- pese al umbral alto Y a la regla
                // dura del prompt. Razon real: create_response:true hace que
                // la API genere una respuesta HABLADA automaticamente cada
                // vez que el VAD detecta un turno, sin importar lo que diga
                // el prompt -- una instruccion de "quedate callado" cambia
                // el CONTENIDO de lo que se genera, pero no puede evitar que
                // se genere y se reproduzca ALGO. Con create_response:false,
                // OpenAI sigue transcribiendo (el cliente sigue viendo
                // conversation.item.input_audio_transcription.completed) pero
                // NUNCA habla por su cuenta. El "modo dialogo" (responder de
                // verdad) queda reservado para cuando el cliente detecta una
                // pregunta real sobre la cancion en esa transcripcion y
                // manda response.create el mismo -- ver elixis-voice-
                // session.js, mismo mecanismo que ya usa herramienta() tras
                // una tool-call. Directiva explicita del PO: "modo dialogo
                // solo para cuando le pregunten que cancion esta sonando".
                // NOTA 2026-08-31: se evaluo quitar esto tambien en Cazador
                // (orden del PO, controlar todo solo por prompt) pero el
                // parrafo de arriba es el resultado de una prueba real que ya
                // demostro que el prompt solo no alcanza.
                //
                // EXTENDIDO A TODOS LOS MODOS DE DJMAGO (2026-09-01, aprobado
                // explicitamente por el PO tras reproducir el bug con logs
                // reales de consola): "hablando solo" en silencio total, en
                // modos de oficina (no Cazador) -- confirmado con
                // input_audio_buffer.speech_started seguido de
                // output_audio_buffer.cleared/conversation.item.truncated,
                // osea interrupciones reales, no fantasmas. La variable real
                // no es ruido ambiente (en el carro, con ruido de verdad, NO
                // pasa) sino bocinas abiertas + microfono abierto sin
                // cancelacion de eco (CONSTRAINTS_MIC_RAW la tiene apagada a
                // proposito, ver elixis-voice-session.js) -- en silencio
                // total, la propia voz de DJMago saliendo por las bocinas es
                // la UNICA señal que hay en el cuarto, limpia y facil de
                // confundir con que el PO hablo.
                //
                // CORREGIDO EN LA MISMA SESION: la primera version de este
                // cambio copio TAMBIEN el umbral 0.85 de Cazador (calibrado
                // contra musica FUERTE en la cabina) a los modos de oficina --
                // resultado real, reportado de inmediato: DJMago se quedaba
                // "escuchando" para siempre, la voz normal en silencio nunca
                // cruzaba un umbral pensado contra musica. Los modos de
                // oficina usan el umbral ESTANDAR (0.82, ya probado contra
                // ruido de TV) que si detecta voz normal -- solo se cambia
                // create_response a false (el mecanismo anti-eco), sin tocar
                // la sensibilidad. Cazador es el UNICO modo con el umbral
                // 0.85, porque es el UNICO con musica real cerca del
                // microfono. Ver el disparo manual de respuesta en
                // elixis-voice-session.js (ya no exclusivo de Cazador) para
                // que DJMago siga conversando de verdad en modos de oficina.
                turn_detection: (identidad === "djmago" && modoReq === "cazador")
                    ? { ...STRICT_TURN_DETECTION, threshold: DJMAGO_VAD_THRESHOLD, silence_duration_ms: DJMAGO_SILENCE_DURATION_MS, create_response: false }
                    : (identidad === "djmago")
                        ? { ...(estricto ? STRICT_TURN_DETECTION : STANDARD_TURN_DETECTION), create_response: false }
                        : estricto ? STRICT_TURN_DETECTION : STANDARD_TURN_DETECTION,
                ...(nrMode === "off" ? {} : { noise_reduction: { type: nrMode } }),
                // REMOVIDO (2026-08-30, sesion real: la llamada completa a
                // OpenAI devolvia 500 sin CORS -- ver el try/catch global
                // agregado mas abajo, que ahora deberia exponer el error real
                // la proxima vez). Este campo (audio.input.transcription.
                // language) ya se habia agregado con una advertencia
                // explicita de "no se pudo confirmar contra la documentacion
                // oficial" -- es el sospechoso mas probable de un rechazo de
                // schema estricto de OpenAI, y removerlo no cuesta nada real:
                // el idioma de RESPUESTA de DjMago lo fija la regla dura del
                // prompt (buildInstructions), no este campo -- este solo era
                // una pista de transcripcion de entrada, nunca la garantia.
            },
            output: { voice },
        },
        // ── HANDOFF AL CEREBRO DE ACCIÓN (paso 5) ────────────────────────
        // Realtime es el órgano de voz; Claude (elixis-chat, vía el router
        // elixis-orchestrator) es quien consulta datos reales. Una sola
        // herramienta, no siete: el modelo de voz no tiene por qué conocer el
        // catálogo interno, y así no hay dos sitios donde mantener las tools.
        // La ejecuta el navegador con el JWT del usuario, así que el RBAC de
        // elixis-chat sigue mandando: si la cuenta no tiene permiso, 403.
        tools: [
            {
                type: "function",
                name: "consultar_elixis",
                description:
                    "Consulta los datos reales del negocio de Miami DJ Beat: finanzas, " +
                    "leads y clientes, agenda de artistas, catálogo de precios y cotizaciones. " +
                    "Úsala siempre que te pregunten por un dato concreto en vez de responder " +
                    "de memoria. La pregunta debe entenderse por sí sola.",
                parameters: {
                    type: "object",
                    properties: {
                        pregunta: {
                            type: "string",
                            description:
                                "La pregunta completa y autónoma, en el idioma del usuario, " +
                                "sin depender del contexto de la conversación.",
                        },
                    },
                    required: ["pregunta"],
                },
            },
            {
                type: "function",
                name: "recordar",
                description:
                    "Guarda un hecho breve sobre esta persona o su forma de trabajar, para " +
                    "recordarlo en próximas conversaciones. Usa la misma clave para actualizar " +
                    "un hecho que cambió. No lo uses para datos consultables de la base.",
                parameters: {
                    type: "object",
                    properties: {
                        clave: { type: "string", description: "Identificador corto y estable, en minúsculas." },
                        hecho: { type: "string", description: "El hecho en una frase, máximo 300 caracteres." },
                    },
                    required: ["clave", "hecho"],
                },
            },
            {
                type: "function",
                name: "olvidar",
                description: "Borra un recuerdo guardado que dejó de ser cierto o que te piden olvidar.",
                parameters: {
                    type: "object",
                    properties: {
                        clave: { type: "string", description: "La clave del recuerdo a borrar." },
                    },
                    required: ["clave"],
                },
            },
            // ── Music Hunter (2026-08-30, autorizado por el PO) ───────────
            // Aislada a identidad==='djmago' -- ELIXIS (oficina/legal/ventas)
            // no tiene por que "escuchar" musica, y darsela a los dos volveria
            // a mezclar los dos especialistas en un solo cerebro, exactamente
            // lo que este fork existe para evitar. El motor real (Edge Function
            // music-fingerprint / ACRCloud) todavia no esta construido -- ver
            // el 'action==="identificar_track"' mas abajo, que hoy responde un
            // stub honesto en vez de dejar la tool declarada sin adonde ir.
            ...(identidad === "djmago" ? [{
                type: "function",
                name: "identificar_track",
                description:
                    "Identifica el track de música que está sonando ahora mismo en la " +
                    "cabina (el ambiente, no tu micrófono de conversación). Úsala cuando " +
                    "te pregunten qué está sonando o pidan identificar la canción actual. " +
                    "Devuelve artista, título, BPM, tonalidad (key) y género si hay una " +
                    "coincidencia con suficiente confianza.",
                parameters: { type: "object", properties: {}, required: [] },
            }] : []),
            // ── SMS por voz (2026-09-02) — mismo candado de 3 pasos que ya
            // corre en elixis-chat (texto): buscar_cliente -> enviar_sms
            // (encola) -> confirmar_envio_mensaje (despacha). El telefono
            // SIEMPRE sale de client_profiles, nunca de un numero dictado —
            // "un digito mal oido manda el mensaje a un desconocido". Solo
            // declaradas para roles de staff: los artistas no mandan SMS
            // corporativos (mismo ALLOWED_ROLES que elixis-sms-dispatch).
            ...(isStaff ? [
                {
                    type: "function",
                    name: "buscar_cliente",
                    description:
                        "Busca un cliente/comprador registrado en Miami DJ Beat LLC por nombre, " +
                        "email o teléfono. Devuelve datos de contacto básicos. NO inventes un " +
                        "cliente que no aparezca en el resultado.",
                    parameters: {
                        type: "object",
                        properties: {
                            query: { type: "string", description: "Texto a buscar: nombre completo (o parcial), email o teléfono." },
                        },
                        required: ["query"],
                    },
                },
                {
                    type: "function",
                    name: "enviar_sms",
                    description:
                        "Redacta un SMS real para un cliente y lo deja EN COLA — NO lo envía " +
                        "todavía. Necesitas el cliente_id, que sale de buscar_cliente: NUNCA " +
                        "aceptes un teléfono dictado de viva voz, porque un dígito mal oído manda " +
                        "el mensaje a un desconocido. Después de llamarla, PREGUNTA en voz alta " +
                        "\"¿Confirmas el envío a [Nombre] al número terminado en [XXXX]?\" — solo " +
                        "si la persona confirma de palabra, llamas confirmar_envio_mensaje con accion='enviar'.",
                    parameters: {
                        type: "object",
                        properties: {
                            cliente_id: { type: "string", description: "El user_id del cliente, tal como lo devolvió buscar_cliente." },
                            mensaje: { type: "string", description: "El texto exacto del SMS, listo para leerse tal cual. Máximo 1500 caracteres." },
                        },
                        required: ["cliente_id", "mensaje"],
                    },
                },
                {
                    type: "function",
                    name: "confirmar_envio_mensaje",
                    description:
                        "Despacha o cancela un SMS que ya quedó EN COLA por enviar_sms. Solo " +
                        "llámala después de que la persona confirme de viva voz que sí quiere enviarlo. " +
                        "Cuando el resultado diga estado='aceptado', dilo en voz así — el mensaje fue " +
                        "ACEPTADO por el gateway (Twilio). NUNCA digas 'enviado', 'entregado' o 'le " +
                        "llegó': la entrega real la decide la operadora del destinatario y esto no la confirma.",
                    parameters: {
                        type: "object",
                        properties: {
                            id: { type: "string", description: "El id que devolvió enviar_sms al encolar." },
                            accion: { type: "string", enum: ["enviar", "cancelar"], description: "'enviar' despacha de verdad; 'cancelar' descarta la cola sin mandar nada." },
                        },
                        required: ["id", "accion"],
                    },
                },
            ] : []),
        ],
        tool_choice: "auto",
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
            `[elixis-realtime-session] sesión abierta · user=${gate.userId} · rol=${gate.role} · identidad=${identidad} · nivel=${tier} · modelo=${model} · voz=${voice} · vad=${estricto ? "estricto" : eagerness} · nr=${nrMode} · concedido=${granted}s`,
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
    } catch (err) {
        // Cierre del blindaje global de arriba -- cualquier excepcion que se
        // haya escapado de TODO lo anterior (construccion de sessionConfig,
        // buildInstructions, una RPC que revienta en vez de devolver
        // {error}, lo que sea) cae aca en vez de tumbar la respuesta sin
        // CORS. El mensaje real del error viaja en el JSON esta vez -- antes
        // era invisible, bloqueado por el navegador antes de llegar a verse.
        console.error("[elixis-realtime-session] excepcion no capturada:", err);
        return json({ ok: false, error: "internal_error", detail: String(err && (err as Error).message || err) }, 500);
    }
});
