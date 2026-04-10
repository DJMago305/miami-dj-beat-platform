// supabase/functions/notify-dj-assignment/index.ts
// Notifies a DJ by email when they are assigned to a lead from the admin dashboard.
// Deploy: supabase functions deploy notify-dj-assignment
// Env vars required: RESEND_API_KEY, MANAGER_EMAIL, FROM_EMAIL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const MANAGER_EMAIL = Deno.env.get("MANAGER_EMAIL") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Miami DJ Beat <no-reply@miamidjbeat.com>";
const PORTAL_BASE = Deno.env.get("PORTAL_URL") || "https://miamidjbeat.vercel.app/client-portal.html";

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body = await req.json();

        const lead_id = (body.lead_id ?? "").trim();
        const dj_id = (body.dj_id ?? "").trim();
        const dj_name = (body.dj_name ?? "DJ").trim();
        const assigned_by = (body.assigned_by ?? "El Manager").trim();

        if (!lead_id || !dj_id) {
            return json({ ok: false, error: "lead_id and dj_id are required" }, 400);
        }

        // ── 1. Fetch lead details ─────────────────────────────────────
        const { data: lead, error: leadErr } = await sb
            .from("leads")
            .select("id, event_type, event_date, location, budget, email, phone, notes, assigned_dj_name")
            .eq("id", lead_id)
            .single();

        if (leadErr || !lead) {
            return json({ ok: false, error: "Lead not found: " + (leadErr?.message ?? "") }, 404);
        }

        // ── 2. Fetch DJ email from dj_profiles ────────────────────────
        const { data: djProfile, error: djErr } = await sb
            .from("dj_profiles")
            .select("id, dj_name, stage_name, email")
            .eq("id", dj_id)
            .single();

        // Fall back to user email via auth if dj_profiles doesn't have email directly
        let dj_email = djProfile?.email ?? "";

        if (!dj_email && djProfile) {
            // Try looking up via user_id in auth (service role can do this)
            const { data: djUser } = await sb
                .from("dj_profiles")
                .select("user_id")
                .eq("id", dj_id)
                .single();

            if (djUser?.user_id) {
                const { data: authUser } = await sb.auth.admin.getUserById(djUser.user_id);
                dj_email = authUser?.user?.email ?? "";
            }
        }

        const portalLink = `${PORTAL_BASE}?lead=${encodeURIComponent(lead_id)}&mode=manager`;
        const assignedAt = new Date().toLocaleString("es-US", {
            timeZone: "America/New_York",
            dateStyle: "full",
            timeStyle: "short",
        });

        // ── 3. Email to DJ ────────────────────────────────────────────
        if (dj_email && RESEND_API_KEY) {
            const djSubject = `🎧 Tienes un nuevo evento asignado — ${lead.event_type} · ${lead.event_date}`;
            const djHtml = buildDJEmail({
                dj_name,
                event_type: lead.event_type,
                event_date: lead.event_date,
                location: lead.location,
                budget: lead.budget,
                portal_link: portalLink,
                assigned_at: assignedAt,
            });

            await sendEmail(dj_email, djSubject, djHtml);
        }

        // ── 4. Summary email to Manager ───────────────────────────────
        if (MANAGER_EMAIL && RESEND_API_KEY) {
            const mgSubject = `✅ DJ Asignado: ${dj_name} → ${lead.event_type} (${lead.email})`;
            const mgHtml = buildManagerEmail({
                dj_name,
                client_email: lead.email,
                event_type: lead.event_type,
                event_date: lead.event_date,
                location: lead.location,
                budget: lead.budget,
                portal_link: portalLink,
                assigned_at: assignedAt,
            });

            await sendEmail(MANAGER_EMAIL, mgSubject, mgHtml);
        }

        return json({
            ok: true,
            dj_email_sent: !!dj_email,
            manager_email_sent: !!MANAGER_EMAIL,
            dj_email,
        });

    } catch (e) {
        return json({ ok: false, error: String(e) }, 500);
    }
});

// ── Email builder: DJ ─────────────────────────────────────────────────────────
function buildDJEmail(p: { dj_name: string; event_type: string; event_date: string; location: string; budget: string; portal_link: string; assigned_at: string }) {
    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; background: #0a0a0a; color: #e0e0e0; margin:0; padding:0; }
  .wrap { max-width: 600px; margin: 0 auto; padding: 32px 24px; }
  .header { background: linear-gradient(135deg, #0d1a2e, #1a2b56); border-bottom: 2px solid #c5a059;
    padding: 28px 24px; border-radius: 12px 12px 0 0; text-align: center; }
  .logo { font-size: 13px; font-weight: 800; letter-spacing: 3px; color: #c5a059; }
  .title { font-size: 24px; font-weight: 900; color: #fff; margin: 10px 0 0; }
  .subtitle { font-size: 14px; color: #999; margin-top: 6px; }
  .body { background: #111; border: 1px solid #222; border-top: none; border-radius: 0 0 12px 12px; padding: 32px; }
  .alert-box { background: rgba(197,160,89,0.08); border: 1px solid rgba(197,160,89,0.3);
    border-radius: 12px; padding: 20px 24px; margin: 20px 0; }
  .row { display: flex; justify-content: space-between; align-items: flex-start;
    padding: 10px 0; border-bottom: 1px solid #1e1e1e; gap: 12px; }
  .row:last-child { border-bottom: none; }
  .label { font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: #777; text-transform: uppercase;
    min-width: 120px; padding-top: 2px; }
  .value { font-size: 14px; color: #f0f0f0; text-align: right; word-break: break-word; }
  .value.accent { color: #c5a059; font-weight: 700; }
  .cta { display: block; margin: 28px auto 0; padding: 14px 32px; background: #c5a059;
    color: #000; font-weight: 800; font-size: 15px; text-decoration: none;
    border-radius: 50px; text-align: center; letter-spacing: 1px; width: fit-content; }
  .footer { margin-top: 24px; font-size: 11px; color: #444; text-align: center; }
</style></head>
<body><div class="wrap">
  <div class="header">
    <div class="logo">MIAMI DJ BEAT</div>
    <div class="title">🎧 Nuevo Evento Asignado</div>
    <div class="subtitle">Asignado el ${escapeHtml(p.assigned_at)}</div>
  </div>
  <div class="body">
    <p>Hola, <strong>${escapeHtml(p.dj_name)}</strong>,</p>
    <p>El equipo de Miami DJ Beat te ha asignado a un nuevo evento. Revisa los detalles a continuación y accede al portal del cliente para coordinar la logística.</p>
    <div class="alert-box">
      <div class="row">
        <span class="label">Tipo de Evento</span>
        <span class="value accent">${escapeHtml(p.event_type)}</span>
      </div>
      <div class="row">
        <span class="label">Fecha</span>
        <span class="value">${escapeHtml(p.event_date)}</span>
      </div>
      <div class="row">
        <span class="label">Ubicación</span>
        <span class="value">${escapeHtml(p.location ?? "A confirmar")}</span>
      </div>
      <div class="row">
        <span class="label">Presupuesto</span>
        <span class="value accent">${escapeHtml(p.budget ?? "A confirmar")}</span>
      </div>
    </div>
    <p style="font-size: 14px; color: #aaa;">Para ver la logística completa, los servicios contratados y coordinar con el cliente, accede al portal:</p>
    <a class="cta" href="${p.portal_link}">🚀 Ver Portal del Evento</a>
    <p style="font-size: 12px; color: #555; text-align: center; margin-top: 16px;">
      Si tienes algún conflicto de agenda, responde a este correo o contacta al manager directamente.
    </p>
  </div>
  <div class="footer">
    Miami DJ Beat LLC · Sistema automático de asignación de eventos<br>
    Este mensaje fue generado automáticamente.<br>
    Consultas: <a href="mailto:support@miamidjbeat.com" style="color:#c5a059;">support@miamidjbeat.com</a>
  </div>
</div></body></html>`;
}

// ── Email builder: Manager confirmation ──────────────────────────────────────
function buildManagerEmail(p: { dj_name: string; client_email: string; event_type: string; event_date: string; location: string; budget: string; portal_link: string; assigned_at: string }) {
    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; background: #0a0a0a; color: #e0e0e0; margin:0; padding:0; }
  .wrap { max-width: 600px; margin: 0 auto; padding: 32px 24px; }
  .header { background: linear-gradient(135deg, #0b2e1a, #1a4d2e); border-bottom: 2px solid #00cc66;
    padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
  .logo { font-size: 13px; font-weight: 800; letter-spacing: 3px; color: #00cc66; }
  .title { font-size: 22px; font-weight: 900; color: #fff; margin: 8px 0 0; }
  .body { background: #111; border: 1px solid #222; border-top: none; border-radius: 0 0 12px 12px; padding: 28px; }
  .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #1e1e1e; gap: 12px; }
  .row:last-child { border-bottom: none; }
  .label { font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: #777; text-transform: uppercase; min-width: 120px; }
  .value { font-size: 14px; color: #f0f0f0; text-align: right; }
  .value.green { color: #00cc66; font-weight: 700; }
  .cta { display: block; margin: 24px auto 0; padding: 12px 28px; background: #00cc66;
    color: #000; font-weight: 800; font-size: 14px; text-decoration: none;
    border-radius: 50px; text-align: center; width: fit-content; }
  .footer { margin-top: 20px; font-size: 11px; color: #444; text-align: center; }
</style></head>
<body><div class="wrap">
  <div class="header">
    <div class="logo">MIAMI DJ BEAT — ADMIN</div>
    <div class="title">✅ Asignación Completada</div>
  </div>
  <div class="body">
    <div class="row">
      <span class="label">DJ Asignado</span>
      <span class="value green">${escapeHtml(p.dj_name)}</span>
    </div>
    <div class="row">
      <span class="label">Cliente</span>
      <span class="value">${escapeHtml(p.client_email)}</span>
    </div>
    <div class="row">
      <span class="label">Tipo de Evento</span>
      <span class="value">${escapeHtml(p.event_type)}</span>
    </div>
    <div class="row">
      <span class="label">Fecha</span>
      <span class="value">${escapeHtml(p.event_date)}</span>
    </div>
    <div class="row">
      <span class="label">Ubicación</span>
      <span class="value">${escapeHtml(p.location ?? "—")}</span>
    </div>
    <div class="row">
      <span class="label">Asignado el</span>
      <span class="value">${escapeHtml(p.assigned_at)}</span>
    </div>
    <a class="cta" href="${p.portal_link}">Abrir Portal del Evento</a>
  </div>
  <div class="footer">Miami DJ Beat LLC · Resumen automático de asignación</div>
</div></body></html>`;
}

async function sendEmail(to: string, subject: string, html: string) {
    return fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
    });
}

function json(obj: unknown, status = 200) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

function escapeHtml(s: string): string {
    return String(s ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
