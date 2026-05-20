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

/** Captura un PaymentIntent autorizado (capture_method=manual) → cobra la tarjeta al aceptar. */
async function stripeCapturePaymentIntent(pi: string): Promise<{ ok: boolean; err?: string }> {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) return { ok: false, err: "STRIPE_SECRET_KEY missing" };
  const res = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(pi)}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  const j = await res.json();
  if (!res.ok) {
    const msg = String(j.error?.message ?? JSON.stringify(j));
    if (msg.includes("already been captured") || msg.includes("already captured")) return { ok: true };
    return { ok: false, err: msg };
  }
  return { ok: true };
}

/** Cancela un PaymentIntent no capturado (libera la reserva sin cargo ni reembolso) → al rechazar. */
async function stripeCancelPaymentIntent(pi: string): Promise<{ ok: boolean; err?: string }> {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) return { ok: false, err: "STRIPE_SECRET_KEY missing" };
  const res = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(pi)}/cancel`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  const j = await res.json();
  if (!res.ok) {
    const msg = String(j.error?.message ?? JSON.stringify(j));
    if (msg.includes("already canceled") || msg.includes("already cancelled")) return { ok: true };
    return { ok: false, err: msg };
  }
  return { ok: true };
}

/** Fallback: reembolso si el PI ya fue capturado antes de llegar aquí (migración de filas antiguas). */
async function stripeRefundPaymentIntent(pi: string): Promise<{ ok: boolean; err?: string }> {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) return { ok: false, err: "STRIPE_SECRET_KEY missing" };
  const res = await fetch("https://api.stripe.com/v1/refunds", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ payment_intent: pi }).toString(),
  });
  const j = await res.json();
  if (!res.ok) {
    const msg = String(j.error?.message ?? JSON.stringify(j));
    if (msg.includes("already been refunded") || msg.includes("Already refunded")) return { ok: true };
    return { ok: false, err: msg };
  }
  return { ok: true };
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
  let paymentChannel: string | null = null;
  let stripePaymentIntentId: string | null = null;
  const requestId = body.request_id != null ? String(body.request_id).trim() : "";
  /** When RPC accept_my_soundfortips_request ran first, avoid double UPDATE; SMS still sends. */
  let skipStatusUpdate = false;

  if (requestId) {
    const { data: row, error: rowErr } = await supabaseAdmin
      .from("soundfortips_fan_requests")
      .select("id, dj_user_id, client_phone, song, artist, status, payment_channel, stripe_payment_intent_id")
      .eq("id", requestId)
      .maybeSingle();

    if (rowErr || !row || row.dj_user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /** RPC accept_* / deny_* ya actualizó fila: seguimos para SMS sin segundo UPDATE (Cash Flow ya coherente). */
    if (row.status !== "pending") {
      if (kind === "accept" && row.status === "accepted") {
        skipStatusUpdate = true;
      } else if (kind === "deny" && row.status === "denied") {
        skipStatusUpdate = true;
      } else {
        return new Response(JSON.stringify({ ok: true, skipped: true, reason: "already_resolved" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    paymentChannel = row.payment_channel != null ? String(row.payment_channel) : null;
    stripePaymentIntentId = row.stripe_payment_intent_id != null ? String(row.stripe_payment_intent_id).trim() : null;

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

  if (!skipStatusUpdate && paymentChannel === "stripe" && stripePaymentIntentId) {
    if (kind === "accept") {
      /** Captura la autorización → cobra la tarjeta del fan ahora que el DJ aceptó. */
      const cap = await stripeCapturePaymentIntent(stripePaymentIntentId);
      if (!cap.ok) {
        console.error("[send-sft-client-sms] Stripe capture:", cap.err);
        return new Response(JSON.stringify({ error: cap.err ?? "Capture failed" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (kind === "deny") {
      /** Cancela la autorización → libera la reserva sin cargo ni reembolso.
       *  Fallback a refund si el PI ya estaba capturado (filas anteriores al cambio de modelo). */
      const cancel = await stripeCancelPaymentIntent(stripePaymentIntentId);
      if (!cancel.ok) {
        console.warn("[send-sft-client-sms] Cancel failed, attempting refund fallback:", cancel.err);
        const ref = await stripeRefundPaymentIntent(stripePaymentIntentId);
        if (!ref.ok) {
          console.error("[send-sft-client-sms] Stripe refund fallback:", ref.err);
          return new Response(JSON.stringify({ error: ref.err ?? "Cancel/refund failed" }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }
  }

  const newStatus = kind === "accept" ? "accepted" : "denied";

  const SITE_URL = (Deno.env.get("SITE_URL") || "https://miamidjbeat.com").replace(/\/$/, "");
  const profileLink = `${SITE_URL}/dj-profile.html?id=${encodeURIComponent(user.id)}&view=public`;

  let msgBody = "";
  if (kind === "accept") {
    const extra = artist ? ` (${artist})` : "";
    msgBody =
      `Miami DJ Beat: ${djName} aceptó tu SOUNDFORTIPS. «${song}»${extra} estará sonando en pocos minutos. ¡Gracias!`;
  } else {
    msgBody =
      paymentChannel === "stripe"
        ? `Miami DJ Beat: el DJ no pudo reproducir tu petición. Tu tarjeta no fue cobrada. ¿Prueba con otra canción? ${profileLink}`
        : `Miami DJ Beat: El DJ no puede tocar esta canción. Opciones: 1) Pide otra canción → ${profileLink}  2) Cancelar → muestra este mensaje al DJ para que devuelva tu ${paymentChannel === "manual" ? "Zelle/Venmo/PayPal" : "pago"}.`;
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

    if (requestId && !skipStatusUpdate) {
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

  // Sin teléfono: igual actualizamos estado en servidor (salvo si ya estaba accepted vía RPC)
  if (requestId && !skipStatusUpdate) {
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
