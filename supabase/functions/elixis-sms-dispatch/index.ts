// supabase/functions/elixis-sms-dispatch/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// PASO A · El unico sitio de la plataforma donde ELIXIS provoca un SMS real.
//
// Y no lo llama el: lo llama una PERSONA desde la pantalla. Esa es toda la
// idea. Si el agente tuviera una herramienta que envia, nada le impide
// llamarla dos veces en el mismo turno -- preparar, auto-confirmarse y mandar.
// La regla quedaria en el prompt, que es una recomendacion, no un candado.
//
// Aqui el candado es de verdad:
//   · ELIXIS solo puede ENCOLAR (tool enviar_sms -> elixis_sms_encolar).
//   · Esta funcion exige el JWT de un owner/staff y el id de una fila en cola.
//   · El telefono NO viaja en la peticion: se lee de la fila, que a su vez lo
//     saco de la ficha del cliente. Un numero dictado nunca llega hasta aqui.
//   · Una fila ya resuelta no se reenvia (lo garantiza elixis_sms_cerrar).
//
// POST ?id=<uuid del pendiente>   ·   Authorization: Bearer <jwt del usuario>
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL_FALLBACK = "https://hkuvuqupbxwkiykxvqdr.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ADMIN = createClient(
    Deno.env.get("SUPABASE_URL") || SUPABASE_URL_FALLBACK,
    SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
);

// Los artistas NO mandan SMS corporativos. Decision del PO, y ademas es lo
// sensato: un mensaje desde el numero de la empresa habla en nombre de la empresa.
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

serve(async (req: Request) => {
    const h = cors(req);
    const json = (b: unknown, s: number) =>
        new Response(JSON.stringify(b), { status: s, headers: { ...h, "Content-Type": "application/json" } });

    if (req.method === "OPTIONS") return new Response("ok", { headers: h });
    if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

    const gate = await verifyStaff(req);
    if (!gate.ok) return json({ ok: false, error: gate.error, detail: gate.detail }, gate.status);

    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false, error: "missing_id" }, 400);

    // La fila manda. El telefono y el texto salen de aqui, no de la peticion.
    const { data: fila, error: e1 } = await ADMIN
        .from("elixis_sms_pending")
        .select("id, telefono, mensaje, destinatario_nombre, estado")
        .eq("id", id).maybeSingle();
    if (e1) return json({ ok: false, error: "queue_read_failed" }, 500);
    if (!fila) return json({ ok: false, error: "not_found" }, 404);
    if (fila.estado !== "pendiente") {
        return json({ ok: false, error: "already_resolved", estado: fila.estado }, 409);
    }

    // Cancelar es tan valido como enviar, y no toca Twilio.
    if ((new URL(req.url).searchParams.get("accion") ?? "").toLowerCase() === "cancelar") {
        await ADMIN.rpc("elixis_sms_cerrar", { p_id: id, p_por: gate.userId, p_estado: "cancelado" });
        return json({ ok: true, estado: "cancelado" }, 200);
    }

    const sid = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
    const token = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
    const from = Deno.env.get("TWILIO_PHONE_NUMBER") ?? "";
    if (!sid || !token || !from) {
        console.error("[elixis-sms-dispatch] faltan secretos de Twilio");
        return json({ ok: false, error: "sms_not_configured" }, 503);
    }

    try {
        const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: "Basic " + btoa(`${sid}:${token}`),
            },
            body: new URLSearchParams({ To: fila.telefono, From: from, Body: fila.mensaje }).toString(),
        });
        const cuerpo = await r.json().catch(() => ({}));

        if (!r.ok) {
            const msg = String((cuerpo as Record<string, unknown>)?.message ?? r.status);
            await ADMIN.rpc("elixis_sms_cerrar", {
                p_id: id, p_por: gate.userId, p_estado: "fallido", p_error: msg.slice(0, 400),
            });
            console.error(`[elixis-sms-dispatch] Twilio ${r.status}: ${msg.slice(0, 300)}`);
            // El detalle de Twilio se queda en los logs; fuera solo un codigo.
            return json({ ok: false, error: "sms_failed", detalle: r.status }, 502);
        }

        const c = cuerpo as Record<string, unknown>;
        const twSid = String(c?.sid ?? "");
        // ACEPTADO NO ES ENTREGADO. Twilio responde 200 en cuanto se hace cargo
        // del mensaje: su `status` sale como queued/accepted, y la entrega real
        // ocurre despues. Si el numero no esta verificado (cuenta de prueba) o
        // el trafico no esta registrado en A2P 10DLC, Twilio ACEPTA y luego la
        // operadora lo descarta -- y nadie se entera.
        const estadoTw = String(c?.status ?? "");
        // Twilio devuelve error_code aunque el HTTP sea 200 cuando ya sabe que
        // fallara. Si viene, esto NO es un envio: es un fallo con buena cara.
        const errCode = c?.error_code ?? null;
        const errMsg = String(c?.error_message ?? "");

        if (errCode) {
            await ADMIN.rpc("elixis_sms_cerrar", {
                p_id: id, p_por: gate.userId, p_estado: "fallido",
                p_error: `twilio ${errCode}: ${errMsg}`.slice(0, 400), p_sid: twSid,
            });
            console.error(`[elixis-sms-dispatch] Twilio acepto con error ${errCode}: ${errMsg}`);
            return json({ ok: false, error: "sms_failed", detalle: errCode }, 502);
        }

        await ADMIN.rpc("elixis_sms_cerrar", {
            p_id: id, p_por: gate.userId, p_estado: "enviado", p_sid: twSid,
        });
        console.log(`[elixis-sms-dispatch] aceptado · id=${id} · por=${gate.userId} · sid=${twSid} · estado=${estadoTw}`);
        // Se devuelve lo que Twilio dice de verdad, para que la pantalla no
        // prometa una entrega que todavia no ha ocurrido.
        return json({
            ok: true,
            estado: "aceptado",
            estado_operadora: estadoTw || "queued",
            sid: twSid,
            destinatario: fila.destinatario_nombre,
        }, 200);
    } catch (err) {
        console.error("[elixis-sms-dispatch] red:", err);
        await ADMIN.rpc("elixis_sms_cerrar", {
            p_id: id, p_por: gate.userId, p_estado: "fallido", p_error: "network",
        });
        return json({ ok: false, error: "sms_unreachable" }, 502);
    }
});
