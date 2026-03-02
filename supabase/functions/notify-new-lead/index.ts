// supabase/functions/notify-new-lead/index.ts
// Notifies the Miami DJ Beat manager when a new client lead arrives.
// Deploy: supabase functions deploy notify-new-lead
// Env vars required: RESEND_API_KEY, MANAGER_EMAIL, FROM_EMAIL
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const MANAGER_EMAIL = Deno.env.get("MANAGER_EMAIL") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Miami DJ Beat <no-reply@miamidjbeat.com>";
const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL") || "https://miamidjbeat.vercel.app/admin-dashboard.html";

// CORS helper — Supabase Edge Functions may be called from the browser
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    // Handle pre-flight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        if (!RESEND_API_KEY) {
            return new Response(
                JSON.stringify({ ok: false, error: "RESEND_API_KEY not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }
        if (!MANAGER_EMAIL) {
            return new Response(
                JSON.stringify({ ok: false, error: "MANAGER_EMAIL not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const body = await req.json();

        // ── Extract lead data ──────────────────────────────
        const lead_id = body.lead_id ?? "—";
        const event_type = body.event_type ?? "—";
        const event_date = body.event_date ?? "—";
        const location = body.location ?? "—";
        const email = body.email ?? "—";
        const phone = body.phone ?? "—";
        const budget = body.budget ?? "—";
        const referred_by = body.referred_by ?? "—";
        const submitted_at = new Date().toLocaleString("es-US", {
            timeZone: "America/New_York",
            dateStyle: "full",
            timeStyle: "short",
        });

        const dashboardLink = `${DASHBOARD_URL}?lead=${encodeURIComponent(String(lead_id))}`;

        const subject = `🎯 Nuevo Lead — ${event_type} · ${event_date}`;

        const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; background: #0a0a0a; color: #e0e0e0; margin: 0; padding: 0; }
  .wrap { max-width: 600px; margin: 0 auto; padding: 32px 24px; }
  .header { background: linear-gradient(135deg, #1a1008, #2a1a00); border-bottom: 2px solid #c5a059;
    padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
  .logo { font-size: 13px; font-weight: 800; letter-spacing: 3px; color: #c5a059; }
  .title { font-size: 22px; font-weight: 900; color: #fff; margin: 8px 0 0; }
  .body { background: #111; border: 1px solid #222; border-top: none; border-radius: 0 0 12px 12px;
    padding: 28px; }
  .row { display: flex; justify-content: space-between; align-items: flex-start;
    padding: 10px 0; border-bottom: 1px solid #1e1e1e; gap: 12px; }
  .row:last-child { border-bottom: none; }
  .label { font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: #777; text-transform: uppercase;
    min-width: 120px; padding-top: 2px; }
  .value { font-size: 14px; color: #f0f0f0; text-align: right; word-break: break-word; }
  .value.accent { color: #c5a059; font-weight: 700; }
  .cta { display: block; margin: 24px auto 0; padding: 14px 32px; background: #c5a059;
    color: #000; font-weight: 800; font-size: 15px; text-decoration: none;
    border-radius: 50px; text-align: center; letter-spacing: 1px; }
  .footer { margin-top: 20px; font-size: 11px; color: #444; text-align: center; }
  .badge { display: inline-block; padding: 4px 12px; background: rgba(197,160,89,0.15);
    border: 1px solid rgba(197,160,89,0.4); border-radius: 20px; color: #c5a059;
    font-weight: 800; font-size: 12px; letter-spacing: 1px; margin-bottom: 4px; }
</style></head>
<body><div class="wrap">
  <div class="header">
    <div class="logo">MIAMI DJ BEAT</div>
    <div class="title">🎯 Nuevo Lead Entrante</div>
    <div style="font-size:12px;color:#999;margin-top:6px;">${escapeHtml(submitted_at)}</div>
  </div>
  <div class="body">
    <div class="row">
      <span class="label">Tipo de Evento</span>
      <span class="value accent">${escapeHtml(event_type)}</span>
    </div>
    <div class="row">
      <span class="label">Fecha del Evento</span>
      <span class="value">${escapeHtml(event_date)}</span>
    </div>
    <div class="row">
      <span class="label">Ubicación</span>
      <span class="value">${escapeHtml(location)}</span>
    </div>
    <div class="row">
      <span class="label">Presupuesto</span>
      <span class="value accent">${escapeHtml(budget)}</span>
    </div>
    <div class="row">
      <span class="label">Email</span>
      <span class="value">${escapeHtml(email)}</span>
    </div>
    <div class="row">
      <span class="label">Teléfono</span>
      <span class="value">${escapeHtml(phone)}</span>
    </div>
    <div class="row">
      <span class="label">Referido por</span>
      <span class="value">${escapeHtml(referred_by)}</span>
    </div>
    <div class="row">
      <span class="label">Lead ID</span>
      <span class="value"><code style="font-size:12px;color:#999;">${escapeHtml(String(lead_id))}</code></span>
    </div>

    <a class="cta" href="${dashboardLink}">🚀 Abrir en Dashboard</a>
  </div>
  <div class="footer">
    Miami DJ Beat LLC · Sistema automático de notificación de leads<br>
    Este mensaje fue generado automáticamente — no responder.
  </div>
</div></body></html>
        `;

        const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: FROM_EMAIL,
                to: [MANAGER_EMAIL],
                subject,
                html,
            }),
        });

        const out = await r.json();
        if (!r.ok) {
            return new Response(
                JSON.stringify({ ok: false, resend: out }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ ok: true, resend: out }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (e) {
        return new Response(
            JSON.stringify({ ok: false, error: String(e) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

function escapeHtml(s: string): string {
    return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
