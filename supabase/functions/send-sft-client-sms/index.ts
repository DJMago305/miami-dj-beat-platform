// SOUNDFORTIPS: SMS al fan (Twilio). Usa request_id → teléfono solo en servidor (tabla soundfortips_fan_requests).
// Requiere sesión del DJ (JWT). verify_jwt true.
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioFrom = Deno.env.get("TWILIO_PHONE_NUMBER");

  if (!supabaseUrl || !anonKey || !serviceKey || !sid || !twilioToken || !twilioFrom) {
    return new Response(JSON.stringify({ error: "Server configuration incomplete" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: {
    request_id?: string;
    kind?: string;
    to?: string;
    song_title?: string;
    artist?: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const kind = body.kind === "deny" ? "deny" : body.kind === "accept" ? "accept" : null;
  if (!kind) {
    return new Response(JSON.stringify({ error: "kind must be accept or deny" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabaseUser.auth.getUser();

  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const { data: dj, error: djErr } = await supabaseAdmin
    .from("dj_profiles")
    .select("user_id, stage_name, dj_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (djErr || !dj) {
    return new Response(JSON.stringify({ error: "DJ profile not found" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: planOk, error: planRpcErr } = await supabaseAdmin.rpc("dj_soundfortips_plan_ok", { uid: user.id });
  if (planRpcErr || !planOk) {
    return new Response(JSON.stringify({ error: "SOUNDFORTIPS requires an active PRO plan" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const djName = (dj.stage_name || dj.dj_name || "Tu DJ").trim();

  let phone: string | null = null;
  let song = "";
  let artist = "";
  const requestId = body.request_id != null ? String(body.request_id).trim() : "";

  if (requestId) {
    const { data: row, error: rowErr } = await supabaseAdmin
      .from("soundfortips_fan_requests")
      .select("id, dj_user_id, client_phone, song, artist, status")
      .eq("id", requestId)
      .maybeSingle();

    if (rowErr || !row || row.dj_user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (row.status !== "pending") {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "already_resolved" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    song = (row.song || "").trim() || "tu canción";
    artist = (row.artist || "").trim();
    const rawPhone = row.client_phone != null ? String(row.client_phone).trim() : "";
    phone = rawPhone ? toE164(rawPhone) : null;
  } else {
    // Compatibilidad interna: número explícito (no usar desde el perfil público del DJ)
    const legacy = toE164(String(body.to ?? ""));
    phone = legacy && E164_REGEX.test(legacy) ? legacy : null;
    song = (body.song_title || "").trim() || "tu canción";
    artist = (body.artist || "").trim();
  }

  const newStatus = kind === "accept" ? "accepted" : "denied";

  let msgBody = "";
  if (kind === "accept") {
    const extra = artist ? ` (${artist})` : "";
    msgBody =
      `Miami DJ Beat: ${djName} aceptó tu SOUNDFORTIPS. «${song}»${extra} estará sonando en pocos minutos. ¡Gracias!`;
  } else {
    msgBody =
      "Miami DJ Beat: Disculpa, esta canción no está en la playlist del DJ o no es adecuada para este evento. No se realizó ningún cargo.";
  }

  if (msgBody.length > 1500) {
    msgBody = msgBody.slice(0, 1497) + "...";
  }

  if (phone && E164_REGEX.test(phone)) {
    const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + btoa(`${sid}:${twilioToken}`),
      },
      body: new URLSearchParams({
        To: phone,
        From: twilioFrom,
        Body: msgBody,
      }).toString(),
    });

    if (!twilioRes.ok) {
      const errText = await twilioRes.text();
      console.error("[send-sft-client-sms] Twilio error:", errText);
      return new Response(JSON.stringify({ error: "SMS send failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await twilioRes.json();

    if (requestId) {
      await supabaseAdmin
        .from("soundfortips_fan_requests")
        .update({ status: newStatus })
        .eq("id", requestId)
        .eq("dj_user_id", user.id);
    }

    return new Response(JSON.stringify({ ok: true, sid: payload.sid }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Sin teléfono: igual actualizamos estado en servidor
  if (requestId) {
    await supabaseAdmin
      .from("soundfortips_fan_requests")
      .update({ status: newStatus })
      .eq("id", requestId)
      .eq("dj_user_id", user.id);
  }

  return new Response(JSON.stringify({ ok: true, skipped: true, reason: "no_phone" }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
