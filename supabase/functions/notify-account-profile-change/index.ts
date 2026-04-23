/**
 * Transactional email: user saved account settings (profile / address / prefs).
 * Respects client_profiles.notify_email_bookings (default on).
 * Auth: Bearer user JWT. Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, FROM_EMAIL, optional SITE_URL
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Miami DJ Beat <no-reply@miamidjbeat.com>";
const SITE_URL = (Deno.env.get("SITE_URL") || "https://www.miamidjbeat.com").replace(/\/$/, "");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(s: string): string {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json({ ok: false, error: "server_misconfigured" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!jwt) return json({ ok: false, error: "missing_authorization" }, 401);

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: { user }, error: userErr } = await sb.auth.getUser(jwt);
    if (userErr || !user?.email) return json({ ok: false, error: "invalid_session" }, 401);

    let body: { locale?: string; reason?: string } = {};
    try {
      body = await req.json();
    } catch { /* empty */ }

    const { data: prof } = await sb
      .from("client_profiles")
      .select("notify_email_bookings, language_preference")
      .eq("user_id", user.id)
      .maybeSingle();

    if (prof && prof.notify_email_bookings === false) {
      return json({ ok: true, skipped: "email_bookings_disabled" });
    }

    if (!RESEND_API_KEY) {
      return json({ ok: true, skipped: "resend_not_configured" });
    }

    const langPref = String(prof?.language_preference || "").toLowerCase();
    const localeBody = String(body.locale || "").toLowerCase();
    const es = localeBody.startsWith("es") || (!localeBody && langPref === "es");
    const reason = String(body.reason || "profile_save").slice(0, 64);

    const settingsUrl = `${SITE_URL}/account-settings.html`;
    const whenStr = new Date().toLocaleString(es ? "es-US" : "en-US", {
      timeZone: "America/New_York",
      dateStyle: "full",
      timeStyle: "short",
    });

    const subject = es
      ? "Tu cuenta Miami DJ Beat — cambios guardados"
      : "Your Miami DJ Beat account — changes saved";

    const introEs =
      "Se guardaron cambios en tu <strong>configuración de cuenta</strong> (perfil, dirección o preferencias de avisos).";
    const introEn =
      "Changes were saved in your <strong>account settings</strong> (profile, address, or notification preferences).";

    const pwdEs = reason === "password_change"
      ? "<p><strong>Contraseña:</strong> se actualizó tu contraseña de acceso.</p>"
      : "";
    const pwdEn = reason === "password_change"
      ? "<p><strong>Password:</strong> your sign-in password was updated.</p>"
      : "";

    const html = `<!DOCTYPE html><html lang="${es ? "es" : "en"}"><head><meta charset="UTF-8"></head>
<body style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#eee;padding:24px;">
  <div style="max-width:560px;margin:0 auto;border:1px solid #333;border-radius:12px;padding:24px;">
    <h1 style="color:#c5a059;font-size:18px;">${escapeHtml(subject)}</h1>
    <p>${es ? introEs : introEn}</p>
    ${es ? pwdEs : pwdEn}
    <p style="font-size:14px;color:#ccc;"><strong>${es ? "Fecha (ET):" : "Time (ET):"}</strong> ${escapeHtml(whenStr)}</p>
    <p style="margin-top:18px;"><a href="${escapeHtml(settingsUrl)}" style="color:#c5a059;font-weight:700;">${es ? "Abrir configuración de cuenta" : "Open account settings"}</a></p>
    <p style="color:#f87171;font-size:14px;margin-top:20px;">${es
      ? "Si <strong>no</strong> hiciste este cambio, cambia tu contraseña de inmediato desde la web oficial."
      : "If you <strong>did not</strong> make this change, reset your password immediately on the official site."}</p>
    <p style="margin-top:20px;font-size:12px;color:#888;">Miami DJ Beat LLC — ${es ? "aviso automático" : "automated notice"}</p>
    <p style="font-size:12px;color:#666;border-top:1px solid #222;padding-top:12px;margin-top:16px;">
      ${es
      ? "<strong>English:</strong> Your account settings were updated. If this was not you, secure your password on the official site."
      : "<strong>Español:</strong> Se actualizó tu configuración. Si no fuiste tú, protege tu contraseña en el sitio oficial."}
    </p>
  </div>
</body></html>`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [user.email],
        subject,
        html,
      }),
    });
    const out = await r.json();
    if (!r.ok) {
      return json({ ok: false, resend: out }, 500);
    }
    return json({ ok: true, resend_id: out?.id ?? null });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
