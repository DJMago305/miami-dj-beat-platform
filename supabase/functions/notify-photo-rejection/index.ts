// supabase/functions/notify-photo-rejection/index.ts
// Called by the Admin Dashboard to reject a DJ's profile photo and notify them by email.
// Deploy: supabase functions deploy notify-photo-rejection
// Env vars required: RESEND_API_KEY, FROM_EMAIL, ADMIN_PASS, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PASS = Deno.env.get("ADMIN_PASS")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Miami DJ Beat <no-reply@miamidjbeat.com>";

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

        // ── Auth ───────────────────────────────────────────────────
        const pass = (body.pass ?? "").trim();
        if (!pass || pass !== ADMIN_PASS) {
            return json({ ok: false, error: "Unauthorized" }, 401);
        }

        const user_id = (body.user_id ?? "").trim();
        const dj_email = (body.dj_email ?? "").trim();
        const dj_name = (body.dj_name ?? "DJ").trim();
        const reason = (body.reason ?? "Publicidad, número de teléfono o branding detectado").trim();

        if (!user_id || !dj_email) {
            return json({ ok: false, error: "user_id and dj_email are required" }, 400);
        }

        // ── 1. Clear photo + mark rejected in dj_profiles ─────────
        const { error: dbError } = await sb
            .from("dj_profiles")
            .update({
                photo_url: null,
                photo_status: "rejected",
                photo_rejected_reason: reason,
            })
            .eq("user_id", user_id);

        if (dbError) {
            return json({ ok: false, error: dbError.message }, 500);
        }

        // ── 2. Send rejection email via Resend ─────────────────────
        if (!RESEND_API_KEY) {
            return json({ ok: true, warning: "DB updated but RESEND_API_KEY not set — email not sent." });
        }

        const subject = "⚠️ Tu foto de perfil no cumple nuestros Términos — Miami DJ Beat";

        const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; background: #0a0a0a; color: #e0e0e0; margin:0; padding:0; }
  .wrap { max-width: 600px; margin: 0 auto; padding: 32px 24px; }
  .header { background: linear-gradient(135deg,#1a1008,#2a1a00); border-bottom: 2px solid #c5a059;
    padding: 28px 24px; border-radius: 12px 12px 0 0; text-align: center; }
  .logo  { font-size:13px; font-weight:800; letter-spacing:3px; color:#c5a059; }
  .title { font-size:22px; font-weight:900; color:#fff; margin:8px 0 0; }
  .body  { background:#111; border:1px solid #222; border-top:none; border-radius:0 0 12px 12px; padding:32px; }
  .alert { background:rgba(255,60,60,0.08); border:1px solid rgba(255,60,60,0.3); border-radius:12px;
    padding:20px; margin:20px 0; }
  .alert-title { color:#ff5555; font-weight:800; font-size:15px; margin-bottom:6px; }
  .reason-box { background:rgba(255,255,255,0.04); border-left:3px solid #c5a059;
    padding:12px 16px; border-radius:0 8px 8px 0; margin:20px 0; font-size:14px; color:#e0e0e0; }
  .steps { padding-left:20px; color:#ccc; font-size:14px; line-height:1.9; }
  .cta { display:block; margin:28px auto 0; padding:14px 32px; background:#c5a059;
    color:#000; font-weight:800; font-size:15px; text-decoration:none;
    border-radius:50px; text-align:center; letter-spacing:1px; width:fit-content; }
  .footer { margin-top:20px; font-size:11px; color:#444; text-align:center; }
  .policy { font-size:12px; color:#666; margin-top:24px; line-height:1.6; }
</style></head>
<body><div class="wrap">
  <div class="header">
    <div class="logo">MIAMI DJ BEAT</div>
    <div class="title">⚠️ Foto de Perfil Eliminada</div>
    <div style="font-size:13px;color:#999;margin-top:6px;">Notificación Automática del Sistema</div>
  </div>
  <div class="body">
    <p>Hola, <strong>${escapeHtml(dj_name)}</strong>,</p>
    <p>Hemos detectado que tu foto de perfil en la plataforma <strong>no cumple con nuestros Términos de Uso</strong> y ha sido eliminada automáticamente.</p>

    <div class="alert">
      <div class="alert-title">🚫 Motivo de la eliminación</div>
      <p style="margin:0; font-size:14px; color:#ffaaaa;">${escapeHtml(reason)}</p>
    </div>

    <div class="reason-box">
      <strong style="color:#c5a059;">POLÍTICA DE IMAGEN — Miami DJ Beat</strong><br>
      Las fotos de perfil deben ser limpias y profesionales. <strong>Está estrictamente prohibido</strong>
      incluir: nombres, marcas comerciales, logos, números de teléfono, URLs, texto promocional
      ni ningún tipo de publicidad o branding externo.
    </div>

    <p style="font-size:14px; margin:20px 0 10px;">Para restaurar tu perfil, por favor:</p>
    <ol class="steps">
      <li>Inicia sesión en tu cuenta en <a href="https://miamidjbeat.vercel.app" style="color:#c5a059;">miamidjbeat.vercel.app</a></li>
      <li>Ve a tu <strong>Dashboard de DJ</strong></li>
      <li>Sube una nueva foto limpia — solo tu imagen profesional, sin texto ni marcas</li>
    </ol>

    <a class="cta" href="https://miamidjbeat.vercel.app/dj-dashboard.html">Actualizar mi Foto</a>

    <p class="policy">
      El incumplimiento reiterado de esta política puede resultar en la suspensión temporal
      o permanente de tu cuenta según lo establecido en el Artículo 4 de nuestros
      <a href="https://miamidjbeat.vercel.app/legal.html" style="color:#c5a059;">Términos y Condiciones</a>.
    </p>
  </div>
  <div class="footer">
    Miami DJ Beat LLC · Sistema automatizado de moderación de contenido<br>
    Este mensaje fue generado automáticamente — no responder directamente.<br>
    Consultas: <a href="mailto:support@miamidjbeat.com" style="color:#c5a059;">support@miamidjbeat.com</a>
  </div>
</div></body></html>`;

        const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ from: FROM_EMAIL, to: [dj_email], subject, html }),
        });

        const out = await r.json();
        if (!r.ok) {
            return json({ ok: false, db: "updated", resend: out }, 500);
        }

        return json({ ok: true, message: "Photo rejected and DJ notified by email.", resend: out });

    } catch (e) {
        return json({ ok: false, error: String(e) }, 500);
    }
});

function json(obj: unknown, status = 200) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

function escapeHtml(s: string): string {
    return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
