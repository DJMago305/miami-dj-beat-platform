// notify-new-device-login — email the account owner when a new device fingerprint is seen after password login.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, FROM_EMAIL
// Caller: browser with user's access_token (verify_jwt=true). Skips admin/manager staff roles.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Miami DJ Beat <no-reply@miamidjbeat.com>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function isStaffUser(user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null): boolean {
  if (!user) return true;
  const a = String(user.app_metadata?.role ?? "").toLowerCase();
  const t = String(user.user_metadata?.user_type ?? "").toLowerCase();
  return a === "admin" || a === "manager" || t === "admin" || t === "manager";
}

function escapeHtml(s: string): string {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "server_misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!jwt) {
      return new Response(JSON.stringify({ ok: false, error: "missing_authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: userErr } = await sb.auth.getUser(jwt);
    if (userErr || !user?.email) {
      return new Response(JSON.stringify({ ok: false, error: "invalid_session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isStaffUser(user)) {
      return new Response(JSON.stringify({ ok: true, skipped_staff: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: { device_label?: string; approx_tz?: string; public_ip?: string } = {};
    try {
      body = await req.json();
    } catch { /* ignore */ }

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const device = String(body.device_label ?? "Unknown device").slice(0, 120);
    const tz = String(body.approx_tz ?? "").slice(0, 120);
    const pubIp = String(body.public_ip ?? "").trim().slice(0, 45);
    const whenStr = new Date().toLocaleString("es-US", {
      timeZone: "America/New_York",
      dateStyle: "full",
      timeStyle: "short",
    });

    const subject = "🔐 Alerta de seguridad — nuevo inicio de sesión";
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head><body style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#eee;padding:24px;">
      <div style="max-width:560px;margin:0 auto;border:1px solid #333;border-radius:12px;padding:24px;">
        <h1 style="color:#c5a059;font-size:18px;">Nuevo dispositivo</h1>
        <p>Se ha iniciado sesión en tu cuenta de <strong>Miami DJ Beat</strong> desde un equipo o navegador que no habíamos registrado antes.</p>
        <ul style="line-height:1.6;">
          <li><strong>Dispositivo:</strong> ${escapeHtml(device)}</li>
          ${tz ? `<li><strong>Referencia de ubicación (zona horaria):</strong> ${escapeHtml(tz)}</li>` : ""}
          ${pubIp ? `<li><strong>IP pública (referencia):</strong> ${escapeHtml(pubIp)}</li>` : ""}
          <li><strong>Fecha (ET):</strong> ${escapeHtml(whenStr)}</li>
        </ul>
        <p>Si fuiste tú, puedes ignorar este mensaje.</p>
        <p style="color:#f87171;font-weight:700;">Si no fuiste tú, cambia tu contraseña solo en la web oficial de Miami DJ Beat (menú Entrar → «Olvidé mi contraseña»). <strong>No aceptes enlaces de recuperación</strong> que lleguen por SMS u otros canales si no los solicitaste tú.</p>
        <p style="margin-top:20px;font-size:12px;color:#888;">Miami DJ Beat LLC — aviso automático de seguridad (cola de envío / email).</p>
        <p style="font-size:12px;color:#666;border-top:1px solid #222;padding-top:12px;margin-top:16px;">
          <strong>English:</strong> A new sign-in was detected (${escapeHtml(device)}). If this was not you, reset your password only on the official Miami DJ Beat site. Do not trust recovery links sent by SMS or third parties.
        </p>
      </div></body></html>`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to: [user.email], subject, html }),
    });
    const out = await r.json();
    if (!r.ok) {
      return new Response(JSON.stringify({ ok: false, resend: out }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
