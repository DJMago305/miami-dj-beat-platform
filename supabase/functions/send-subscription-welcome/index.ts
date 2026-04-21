/**
 * Thank-you email after joining Miami DJ Beat (typical social-app style).
 * Auth: Bearer JWT (same user). Uses Resend like send-certificate.
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Miami DJ Beat <onboarding@miamidjbeat.com>";
const SITE_URL = (Deno.env.get("SITE_URL") || "https://www.miamidjbeat.com").replace(/\/$/, "");

const PROD_ORIGINS = ["https://miamidjbeat.com", "https://www.miamidjbeat.com"];

function corsHeaders(req: Request) {
    const origin = req.headers.get("Origin") || "";
    const allowed = PROD_ORIGINS.includes(origin) ||
        origin.startsWith("http://localhost") ||
        origin.startsWith("http://127.0.0.1");
    const o = allowed ? origin : PROD_ORIGINS[0];
    return {
        "Access-Control-Allow-Origin": o,
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        Vary: "Origin",
    };
}

function escapeHtml(s: string) {
    return String(s || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

serve(async (req) => {
    const cors = corsHeaders(req);
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
            status: 405,
            headers: { ...cors, "Content-Type": "application/json" },
        });
    }

    if (!RESEND_API_KEY) {
        return new Response(JSON.stringify({ ok: false, error: "RESEND_API_KEY not configured" }), {
            status: 503,
            headers: { ...cors, "Content-Type": "application/json" },
        });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) {
        return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
            status: 401,
            headers: { ...cors, "Content-Type": "application/json" },
        });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
    if (authErr || !user?.email) {
        return new Response(JSON.stringify({ ok: false, error: "Invalid session" }), {
            status: 401,
            headers: { ...cors, "Content-Type": "application/json" },
        });
    }

    let body: { locale?: string; account_kind?: string } = {};
    try {
        body = await req.json();
    } catch { /* empty */ }

    const locale = String(body.locale || "").toLowerCase().startsWith("es") ? "es" : "en";
    const kind = String(body.account_kind || "member").toLowerCase();
    const isClientOnly = kind === "client";

    const first = escapeHtml((user.user_metadata?.full_name as string) || user.email!.split("@")[0] || "there");

    const subject = locale === "es"
        ? "Bienvenido a Miami DJ Beat"
        : "Welcome to Miami DJ Beat";

    const linesEs = [
        `<p>Hola ${first},</p>`,
        `<p>Gracias por crear tu cuenta en <strong>Miami DJ Beat</strong>. Ya formas parte de la comunidad: eventos, talento y servicios profesionales en un solo lugar.</p>`,
        !isClientOnly
            ? `<p><strong>Siguiente paso:</strong> entra al portal <a href="${SITE_URL}/jobs.html" style="color:#c5a059">Jobs</a> para completar tu perfil de artista y elegir tu plan cuando corresponda.</p>`
            : `<p>Puedes explorar servicios, reservas y tu portal de cliente cuando quieras.</p>`,
        `<p>Si no creaste esta cuenta, ignora este mensaje o contáctanos.</p>`,
        `<p style="color:#666;font-size:13px">— El equipo de Miami DJ Beat</p>`,
    ];

    const linesEn = [
        `<p>Hi ${first},</p>`,
        `<p>Thanks for joining <strong>Miami DJ Beat</strong>. Your account is ready — events, talent, and pro services in one place.</p>`,
        !isClientOnly
            ? `<p><strong>Next step:</strong> open <a href="${SITE_URL}/jobs.html" style="color:#c5a059">Jobs</a> to finish your artist profile and choose your plan when you’re ready.</p>`
            : `<p>You can explore services, bookings, and your client portal anytime.</p>`,
        `<p>If you didn’t sign up, you can ignore this email.</p>`,
        `<p style="color:#666;font-size:13px">— The Miami DJ Beat team</p>`,
    ];

    const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;max-width:560px;color:#111">
  ${locale === "es" ? linesEs.join("\n") : linesEn.join("\n")}
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
  <p style="font-size:12px;color:#888">This is an automated message — please don’t reply directly to this email.</p>
</div>`;

    const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from: FROM_EMAIL,
            to: [user.email!],
            subject,
            html,
        }),
    });

    const out = await r.json();
    if (!r.ok) {
        return new Response(JSON.stringify({ ok: false, resend: out }), {
            status: 500,
            headers: { ...cors, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
    });
});
