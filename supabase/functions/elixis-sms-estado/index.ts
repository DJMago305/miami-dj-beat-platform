// supabase/functions/elixis-sms-estado/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// SOLO LECTURA. Le pregunta a Twilio que paso de verdad con los SMS.
//
// Por que existe: nuestra base dice "enviado" porque Twilio devolvio 200, pero
// 200 solo significa que Twilio se hizo cargo. Quien sabe si el mensaje LLEGO
// es Twilio, y esa respuesta esta detras de un inicio de sesion al que el PO
// no tiene acceso ahora mismo.
//
// Las credenciales ya viven en este proyecto para poder ENVIAR. Aqui se usan
// para PREGUNTAR. El token nunca sale del servidor: no se devuelve, no se
// registra y no viaja al navegador.
//
// Esta funcion NO PUEDE enviar nada: solo hace GET contra Twilio. No hay un
// solo POST en el archivo, y esa es la garantia -- no una promesa del prompt.
//
// GET ?sid=SMxxxx   -> estado de UN mensaje
// GET               -> los ultimos 20 mensajes + tipo de cuenta (trial o no)
// Authorization: Bearer <jwt de owner/staff>
//
// Desplegar:
//   supabase functions deploy elixis-sms-estado --project-ref hkuvuqupbxwkiykxvqdr --no-verify-jwt
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL_FALLBACK = "https://hkuvuqupbxwkiykxvqdr.supabase.co";
const ADMIN = createClient(
    Deno.env.get("SUPABASE_URL") || SUPABASE_URL_FALLBACK,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
);

// Mismo criterio que el despachador: los artistas no ven trafico corporativo.
const ALLOWED_ROLES = new Set(["owner", "admin", "manager", "seller"]);

const ALLOWED_ORIGINS = [
    "https://miamidjbeat.com",
    "https://www.miamidjbeat.com",
    "https://miamidjbeat.vercel.app",
];
const LOCALHOST = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function cors(req: Request): Record<string, string> {
    const origin = req.headers.get("origin") ?? "";
    const ok = ALLOWED_ORIGINS.includes(origin) || LOCALHOST.test(origin);
    return {
        "Access-Control-Allow-Origin": ok ? origin : ALLOWED_ORIGINS[0],
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Vary": "Origin",
    };
}

async function verifyStaff(req: Request) {
    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!jwt) return { ok: false as const, status: 401, error: "missing_authorization" };
    const { data: { user }, error } = await ADMIN.auth.getUser(jwt);
    if (error || !user?.id) return { ok: false as const, status: 401, error: "invalid_session" };
    const { data: prof } = await ADMIN
        .from("dj_profiles").select("role").eq("user_id", user.id).maybeSingle();
    const role = String(prof?.role ?? "").toLowerCase().trim();
    if (!ALLOWED_ROLES.has(role)) {
        return { ok: false as const, status: 403, error: "forbidden_not_staff", detail: role || "sin_rol" };
    }
    return { ok: true as const, userId: user.id, role };
}

// El telefono no vuelve entero: son numeros de clientes reales y esta respuesta
// va a acabar pegada en un chat o en un correo.
function enmascarar(tel: string): string {
    const t = String(tel ?? "");
    return t.length > 4 ? "****" + t.slice(-4) : t;
}

// Traduccion de los codigos que de verdad aparecen en EE.UU. Sin esto el PO
// recibe un numero y tiene que ir a buscar que significa.
const CODIGOS: Record<string, string> = {
    // 30032 es el que salio de verdad: el remitente es un 844 (gratuito) sin
    // verificar. Los gratuitos NO usan 10DLC -- usan Toll-Free Verification.
    "30032": "El numero GRATUITO (toll-free, 800/844/855/866/877/888) NO esta verificado. Desde 2023 las operadoras de EE.UU. BLOQUEAN todo SMS de un gratuito sin Toll-Free Verification. ESTE ES EL CULPABLE.",
    "30030": "El gratuito esta en periodo de gracia y limitado por volumen.",
    "30034": "El numero NO esta registrado en A2P 10DLC. Las operadoras de EE.UU. bloquean el SMS de empresa sin ese registro. ESTE ES EL CULPABLE MAS PROBABLE.",
    "30007": "La operadora lo marco como spam y lo filtro. Casi siempre es consecuencia de no tener A2P 10DLC.",
    "30003": "El telefono de destino esta apagado o fuera de servicio.",
    "30005": "El numero de destino no existe.",
    "30006": "Es un fijo, o no puede recibir SMS.",
    "21608": "Cuenta de PRUEBA: solo puede enviar a numeros verificados.",
    "21610": "El destinatario respondio STOP y esta dado de baja.",
};

function leer(estado: string, code: unknown): string {
    const c = code == null ? "" : String(code);
    if (c && CODIGOS[c]) return CODIGOS[c];
    if (c) return "Codigo " + c + " -- buscar en twilio.com/docs/api/errors/" + c;
    if (estado === "delivered") return "ENTREGADO. Llego al telefono.";
    if (estado === "sent") return "Twilio lo mando pero la operadora nunca confirmo la entrega. Suele ser bloqueo silencioso por falta de A2P 10DLC.";
    if (estado === "queued" || estado === "accepted") return "Todavia en cola dentro de Twilio.";
    if (estado === "undelivered") return "La operadora lo rechazo sin dar codigo.";
    return "Estado: " + estado;
}

serve(async (req: Request) => {
    const h = cors(req);
    const json = (b: unknown, s: number) =>
        new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...h, "Content-Type": "application/json" } });

    if (req.method === "OPTIONS") return new Response("ok", { headers: h });
    if (req.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, 405);

    const gate = await verifyStaff(req);
    if (!gate.ok) return json({ ok: false, error: gate.error, detail: gate.detail }, gate.status);

    const cuenta = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
    const token = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
    if (!cuenta || !token) return json({ ok: false, error: "faltan_credenciales_twilio" }, 503);

    const basic = "Basic " + btoa(`${cuenta}:${token}`);
    const pedir = async (ruta: string) => {
        const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cuenta}${ruta}`,
            { headers: { Authorization: basic } });
        const t = await r.text();
        if (!r.ok) throw new Error(`twilio ${r.status}: ${t.slice(0, 300)}`);
        return JSON.parse(t);
    };

    try {
        // Trial o de pago. Si dice Trial, ya no hay que buscar mas lejos.
        let tipoCuenta = "desconocido";
        let nombreCuenta = "";
        try {
            const c = await pedir(".json");
            tipoCuenta = String(c?.type ?? "desconocido");
            nombreCuenta = String(c?.friendly_name ?? "");
        } catch (_) { /* si falla, seguimos: los mensajes importan mas */ }

        const uno = (new URL(req.url)).searchParams.get("sid") ?? "";
        const rutas = /^SM[0-9a-fA-F]{32}$/.test(uno)
            ? `/Messages/${uno}.json`
            : `/Messages.json?PageSize=20`;

        const d = await pedir(rutas);
        const brutos = Array.isArray(d?.messages) ? d.messages : [d];

        const mensajes = brutos.map((m: Record<string, unknown>) => ({
            sid: m?.sid,
            fecha: m?.date_sent ?? m?.date_created,
            para: enmascarar(String(m?.to ?? "")),
            desde: m?.from,
            estado: m?.status,
            codigo_error: m?.error_code ?? null,
            que_significa: leer(String(m?.status ?? ""), m?.error_code),
        }));

        const entregados = mensajes.filter((m) => m.estado === "delivered").length;

        return json({
            ok: true,
            cuenta: { nombre: nombreCuenta, tipo: tipoCuenta },
            // El resumen primero: es lo que el PO necesita leer en un vistazo.
            resumen: tipoCuenta === "Trial"
                ? "CUENTA DE PRUEBA. Solo entrega a numeros verificados en Twilio. Esa es la causa."
                : `${entregados} de ${mensajes.length} entregados de verdad.`,
            mensajes,
        }, 200);
    } catch (err) {
        // El cuerpo de error de Twilio puede llevar rastros de la credencial.
        console.error("[elixis-sms-estado]", err);
        return json({ ok: false, error: "twilio_no_responde" }, 502);
    }
});
