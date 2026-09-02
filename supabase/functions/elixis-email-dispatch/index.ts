// supabase/functions/elixis-email-dispatch/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mismo patrón EXACTO que elixis-sms-dispatch, para email en vez de SMS.
//
// ELIXIS solo puede ENCOLAR (tool enviar_email -> elixis_email_encolar). Esta
// función exige el JWT de un owner/staff y el id de una fila en cola. El
// email NO viaja en la petición: se lee de la fila, que a su vez lo sacó de
// la ficha del cliente (client_profiles) -- un correo dictado nunca llega
// hasta aquí. Una fila ya resuelta no se reenvía (lo garantiza
// elixis_email_cerrar).
//
// Envío autónomo (2026-09-01, orden directa del PO): elixis-chat llama esta
// función en el MISMO turno que encola, reusando el JWT staff/owner de la
// conversación -- ya no espera un clic humano. El candado real sigue siendo
// de dónde sale el destinatario, no quién aprieta el botón.
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

// Los artistas NO mandan correos corporativos. Mismo criterio que SMS: un
// mensaje desde el dominio de la empresa habla en nombre de la empresa.
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

function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

    // La fila manda. El correo y el texto salen de aqui, no de la peticion.
    const { data: fila, error: e1 } = await ADMIN
        .from("elixis_email_pending")
        .select("id, destinatario_email, destinatario_nombre, asunto, cuerpo, estado")
        .eq("id", id).maybeSingle();
    if (e1) return json({ ok: false, error: "queue_read_failed" }, 500);
    if (!fila) return json({ ok: false, error: "not_found" }, 404);
    if (fila.estado !== "pendiente") {
        return json({ ok: false, error: "already_resolved", estado: fila.estado }, 409);
    }

    if ((new URL(req.url).searchParams.get("accion") ?? "").toLowerCase() === "cancelar") {
        await ADMIN.rpc("elixis_email_cerrar", { p_id: id, p_por: gate.userId, p_estado: "cancelado" });
        return json({ ok: true, estado: "cancelado" }, 200);
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Miami DJ Beat <no-reply@miamidjbeat.com>";
    if (!RESEND_API_KEY) {
        console.error("[elixis-email-dispatch] falta RESEND_API_KEY");
        return json({ ok: false, error: "email_not_configured" }, 503);
    }

    // Respeta el opt-out real del cliente (mismo campo que ya usa
    // notify-account-profile-change: default encendido, apagado explicito lo bloquea).
    if (fila.destinatario_id) {
        const { data: prof } = await ADMIN
            .from("client_profiles").select("notify_email_bookings").eq("user_id", fila.destinatario_id).maybeSingle();
        if (prof && prof.notify_email_bookings === false) {
            await ADMIN.rpc("elixis_email_cerrar", {
                p_id: id, p_por: gate.userId, p_estado: "cancelado", p_error: "cliente_optout_email",
            });
            return json({ ok: false, error: "cliente_optout_email" }, 409);
        }
    }

    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#222;">
${escapeHtml(fila.cuerpo).split("\n").map((p) => `<p>${p}</p>`).join("\n")}
<p style="margin-top:24px;font-size:12px;color:#888;">Miami DJ Beat LLC</p>
</div>`;

    try {
        const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: FROM_EMAIL,
                to: [fila.destinatario_email],
                subject: fila.asunto,
                html,
            }),
        });
        const cuerpo = await r.json().catch(() => ({}));

        if (!r.ok) {
            const msg = String((cuerpo as Record<string, unknown>)?.message ?? r.status);
            await ADMIN.rpc("elixis_email_cerrar", {
                p_id: id, p_por: gate.userId, p_estado: "fallido", p_error: msg.slice(0, 400),
            });
            console.error(`[elixis-email-dispatch] Resend ${r.status}: ${msg.slice(0, 300)}`);
            return json({ ok: false, error: "email_failed", detalle: r.status }, 502);
        }

        const c = cuerpo as Record<string, unknown>;
        const resendId = String(c?.id ?? "");
        await ADMIN.rpc("elixis_email_cerrar", {
            p_id: id, p_por: gate.userId, p_estado: "enviado", p_resend_id: resendId,
        });
        console.log(`[elixis-email-dispatch] enviado · id=${id} · por=${gate.userId} · resend_id=${resendId}`);
        return json({
            ok: true,
            estado: "enviado",
            resend_id: resendId,
            destinatario: fila.destinatario_nombre,
        }, 200);
    } catch (err) {
        console.error("[elixis-email-dispatch] red:", err);
        await ADMIN.rpc("elixis_email_cerrar", {
            p_id: id, p_por: gate.userId, p_estado: "fallido", p_error: "network",
        });
        return json({ ok: false, error: "email_unreachable" }, 502);
    }
});
