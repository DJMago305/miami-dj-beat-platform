// supabase/functions/notify-new-signup/index.ts
// Notifica al dueño cuando se crea una cuenta nueva (cliente o artista/DJ).
// Mismo patron probado que notify-new-lead (Resend), 2026-09-30.
// Deploy: supabase functions deploy notify-new-signup
// Env vars required: RESEND_API_KEY, MANAGER_EMAIL, FROM_EMAIL
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const MANAGER_EMAIL = Deno.env.get("MANAGER_EMAIL") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Miami DJ Beat <no-reply@miamidjbeat.com>";
const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL") || "https://miamidjbeat.com/staff.html?vista=cashflow";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        if (!RESEND_API_KEY) return new Response(JSON.stringify({ ok: false, error: "RESEND_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (!MANAGER_EMAIL) return new Response(JSON.stringify({ ok: false, error: "MANAGER_EMAIL not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const body = await req.json();
        const account_type = body.account_type ?? "—"; // "client" | "dj"
        const name = body.name ?? "—";
        const email = body.email ?? "—";
        const phone = body.phone ?? "—";
        const account_id = body.account_id ?? "—";
        const created_at = new Date().toLocaleString("es-US", { timeZone: "America/New_York", dateStyle: "full", timeStyle: "short" });

        const tipoLabel = account_type === "dj" ? "Artista / DJ" : "Cliente";
        const subject = `✨ Cuenta nueva — ${tipoLabel}: ${name}`;

        const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; background: #0a0a0a; color: #e0e0e0; margin: 0; padding: 0; }
  .wrap { max-width: 600px; margin: 0 auto; padding: 32px 24px; }
  .header { background: linear-gradient(135deg, #0a1a10, #002a1a); border-bottom: 2px solid #7fdca0;
    padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
  .logo { font-size: 13px; font-weight: 800; letter-spacing: 3px; color: #7fdca0; }
  .title { font-size: 22px; font-weight: 900; color: #fff; margin: 8px 0 0; }
  .body { background: #111; border: 1px solid #222; border-top: none; border-radius: 0 0 12px 12px; padding: 28px; }
  .row { display: flex; justify-content: space-between; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid #1e1e1e; gap: 12px; }
  .row:last-child { border-bottom: none; }
  .label { font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: #777; text-transform: uppercase; min-width: 120px; padding-top: 2px; }
  .value { font-size: 14px; color: #f0f0f0; text-align: right; word-break: break-word; }
  .value.accent { color: #7fdca0; font-weight: 700; }
  .cta { display: block; margin: 24px auto 0; padding: 14px 32px; background: #7fdca0; color: #000; font-weight: 800; font-size: 15px; text-decoration: none; border-radius: 50px; text-align: center; letter-spacing: 1px; }
  .footer { margin-top: 20px; font-size: 11px; color: #444; text-align: center; }
</style></head>
<body><div class="wrap">
  <div class="header">
    <div class="logo">MIAMI DJ BEAT</div>
    <div class="title">✨ Cuenta Nueva</div>
    <div style="font-size:12px;color:#999;margin-top:6px;">${escapeHtml(created_at)}</div>
  </div>
  <div class="body">
    <div class="row"><span class="label">Tipo</span><span class="value accent">${escapeHtml(tipoLabel)}</span></div>
    <div class="row"><span class="label">Nombre</span><span class="value">${escapeHtml(name)}</span></div>
    <div class="row"><span class="label">Email</span><span class="value">${escapeHtml(email)}</span></div>
    <div class="row"><span class="label">Teléfono</span><span class="value">${escapeHtml(phone)}</span></div>
    <div class="row"><span class="label">ID de cuenta</span><span class="value"><code style="font-size:12px;color:#999;">${escapeHtml(String(account_id))}</code></span></div>
    <a class="cta" href="${DASHBOARD_URL}">📊 Abrir Cash Flow</a>
  </div>
  <div class="footer">
    Miami DJ Beat LLC · Sistema automático de notificación de cuentas nuevas<br>
    Este mensaje fue generado automáticamente — no responder.
  </div>
</div></body></html>
        `;

        const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: FROM_EMAIL, to: [MANAGER_EMAIL], subject, html }),
        });

        const out = await r.json();
        if (!r.ok) return new Response(JSON.stringify({ ok: false, resend: out }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ ok: true, resend: out }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
});

function escapeHtml(s: string): string {
    return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
