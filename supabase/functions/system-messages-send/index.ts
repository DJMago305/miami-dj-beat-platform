// supabase/functions/system-messages-send/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mensajes del Sistema — Fase 1, envío 1-a-1 desde Staff.
//
// Distinto de elixis-sms-dispatch a propósito: ese despacha lo que ELIXIS (la
// IA) dejó en cola para que un humano lo apruebe. Aquí el humano YA ES quien
// decide en el momento (un miembro de staff logueado) -- no hace falta cola de
// aprobación, solo confirmar que su rol puede enviar (owner/admin/manager/seller).
// Requiere sesión real de staff (JWT). verify_jwt true.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

function toE164(input: string): string | null {
  const t = (input || "").trim();
  if (!t) return null;
  const d = t.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  if (t.startsWith("+") && d.length >= 10 && d.length <= 15) return `+${d}`;
  return null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioFrom = Deno.env.get("TWILIO_PHONE_NUMBER");

  if (!supabaseUrl || !anonKey || !serviceKey || !sid || !twilioToken || !twilioFrom) {
    return json({ error: "Server configuration incomplete" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization" }, 401);

  let body: { telefono?: string; destinatario_nombre?: string; destinatario_id?: string; cuerpo?: string; media_url?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const telefono = toE164(body.telefono ?? "");
  const cuerpoCrudo = (body.cuerpo ?? "").trim();
  // MMS (2026-09-23, pedido del PO: "es un chat, poder mandar fotos y video"):
  // media_url viene del bucket `avatars/staff-uploads/system-messages/...`
  // (mismo bucket público que ya usa la foto de Network, ver uploadNetworkPhoto
  // en staff-admin.html) -- se sube desde el navegador ANTES de llamar aquí.
  // Con adjunto, el cuerpo de texto es opcional (una foto sola es un mensaje válido).
  const mediaUrl = (body.media_url ?? "").trim() || null;
  if (!telefono || !E164_REGEX.test(telefono)) return json({ error: "Telefono invalido" }, 400);
  if (!mediaUrl && (cuerpoCrudo.length < 1 || cuerpoCrudo.length > 1500)) return json({ error: "Mensaje vacio o demasiado largo" }, 400);
  if (mediaUrl && cuerpoCrudo.length > 1500) return json({ error: "Mensaje demasiado largo" }, 400);

  const supabaseUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
  if (userErr || !user) return json({ error: "Unauthorized" }, 401);

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const { data: perfil, error: perfilErr } = await supabaseAdmin
    .from("dj_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const rol = String(perfil?.role ?? "").toLowerCase();
  if (perfilErr || !["owner", "admin", "manager", "seller"].includes(rol)) {
    return json({ error: "forbidden" }, 403);
  }

  // El telefono del cliente/artista no muestra el nombre de la empresa (no
  // existe CNAM para SMS) -- se antepone la marca, salvo que ya la traiga.
  // Con una foto/video sin texto, no hace falta anteponer nada a una cadena vacía.
  const cuerpo = !cuerpoCrudo ? "" : (/^miami dj beat/i.test(cuerpoCrudo) ? cuerpoCrudo : `MIAMI DJ BEAT LLC: ${cuerpoCrudo}`);

  const twilioParams = new URLSearchParams({ To: telefono, From: twilioFrom });
  if (cuerpo) twilioParams.set("Body", cuerpo);
  if (mediaUrl) twilioParams.set("MediaUrl", mediaUrl);

  const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(`${sid}:${twilioToken}`),
    },
    body: twilioParams.toString(),
  });
  const twilioPayload = await twilioRes.json().catch(() => ({}));

  const estado = twilioRes.ok ? "enviado" : "fallido";
  const twilioSid = twilioRes.ok ? String((twilioPayload as Record<string, unknown>).sid ?? "") : null;
  const errorMsg = twilioRes.ok ? null : String((twilioPayload as Record<string, unknown>).message ?? twilioRes.status);

  await supabaseAdmin.from("system_messages").insert({
    direccion: "saliente",
    telefono,
    destinatario_id: body.destinatario_id || null,
    destinatario_nombre: body.destinatario_nombre || null,
    cuerpo,
    media_url: mediaUrl,
    estado,
    twilio_sid: twilioSid,
    error: errorMsg,
    enviado_por: user.id,
  });

  if (!twilioRes.ok) return json({ error: errorMsg }, 502);
  return json({ ok: true, sid: twilioSid });
});
