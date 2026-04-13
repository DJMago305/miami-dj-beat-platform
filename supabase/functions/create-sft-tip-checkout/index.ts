// SOUNDFORTIPS: Stripe Checkout (pago con tarjeta). Tras pagar, webhook pasa la fila a status=pending.
// verify_jwt false (fan anónimo). Env: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_URL
// Deploy: supabase functions deploy create-sft-tip-checkout
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const SITE_URL = (Deno.env.get("SITE_URL") || "https://miamidjbeat.vercel.app").replace(/\/$/, "");

  if (!STRIPE_SECRET_KEY || !supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Server configuration incomplete" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: {
    dj_user_id?: string;
    sender_label?: string;
    song?: string;
    artist?: string;
    tip_usd?: number;
    poster_url?: string | null;
    client_phone?: string | null;
    client_email?: string | null;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const djId = String(body.dj_user_id ?? "").trim();
  if (!djId || !UUID_RE.test(djId)) {
    return new Response(JSON.stringify({ error: "Invalid dj_user_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sender = String(body.sender_label ?? "").trim();
  if (!sender) {
    return new Response(JSON.stringify({ error: "sender_label required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tipUsd = Number(body.tip_usd);
  if (!Number.isFinite(tipUsd) || tipUsd <= 0) {
    return new Response(JSON.stringify({ error: "Invalid tip_usd" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const amountCents = Math.round(tipUsd * 100);
  if (amountCents < 50) {
    return new Response(JSON.stringify({ error: "Minimum card tip is $0.50 USD" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const emailRaw = body.client_email != null ? String(body.client_email).trim() : "";
  const emailOk = emailRaw.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw);

  const phoneRaw =
    body.client_phone != null && String(body.client_phone).trim() !== ""
      ? String(body.client_phone).trim()
      : "";
  const phoneDigits = phoneRaw.replace(/\D/g, "");
  if (phoneRaw.length > 0 && phoneDigits.length < 7) {
    return new Response(JSON.stringify({ error: "Phone number looks incomplete" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const emailInsert: string | null = emailOk ? emailRaw : null;
  const phoneInsert: string | null = phoneDigits.length >= 7 ? phoneRaw : null;

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const { data: dj, error: djErr } = await supabaseAdmin
    .from("dj_profiles")
    .select("user_id, soundfortips_active, soundfortips_platform_fee_blocked")
    .eq("user_id", djId)
    .maybeSingle();

  if (djErr || !dj) {
    return new Response(JSON.stringify({ error: "DJ not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: planOk, error: planRpcErr } = await supabaseAdmin.rpc("dj_soundfortips_plan_ok", { uid: djId });
  if (planRpcErr || !planOk) {
    return new Response(JSON.stringify({ error: "SOUNDFORTIPS requires an active PRO plan" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (dj.soundfortips_active !== true) {
    return new Response(JSON.stringify({ error: "DJ is offline — not accepting requests" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (dj.soundfortips_platform_fee_blocked === true) {
    return new Response(
      JSON.stringify({
        error: "DJ must settle platform fee (billing card) before accepting new SoundForTips.",
      }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const song = String(body.song ?? "").slice(0, 500);
  const artist = String(body.artist ?? "").slice(0, 500);

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("soundfortips_fan_requests")
    .insert({
      dj_user_id: djId,
      sender_label: sender,
      song: String(body.song ?? "").slice(0, 2000),
      artist: String(body.artist ?? "").slice(0, 2000),
      tip_usd: Math.round(tipUsd * 100) / 100,
      poster_url: body.poster_url != null ? String(body.poster_url).slice(0, 4000) : null,
      client_phone: phoneInsert,
      client_email: emailInsert,
      status: "awaiting_payment",
      payment_channel: "stripe",
    })
    .select("id")
    .single();

  if (insErr || !inserted?.id) {
    console.error("[create-sft-tip-checkout] insert", insErr);
    return new Response(JSON.stringify({ error: "Insert failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const requestId = inserted.id as string;
  const desc = [song || "Song request", artist ? `— ${artist}` : ""].join(" ").slice(0, 450);

  const successUrl = `${SITE_URL}/dj-profile.html?id=${encodeURIComponent(djId)}&sft_tip=success`;
  const cancelUrl = `${SITE_URL}/dj-profile.html?id=${encodeURIComponent(djId)}&sft_tip=cancel`;

  const checkoutParams: Record<string, string> = {
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(amountCents),
    "line_items[0][price_data][product_data][name]": "SoundForTips™ tip",
    "line_items[0][price_data][product_data][description]": desc,
    "line_items[0][quantity]": "1",
    success_url: successUrl,
    cancel_url: cancelUrl,
    "metadata[sft_request_id]": requestId,
    "metadata[dj_user_id]": djId,
    "metadata[product]": "soundfortips_tip",
    /** Contabilidad: el cargo completo entra en la cuenta Stripe de la plataforma; fee al DJ/liquidar vía Connect si se activa. */
    "metadata[platform_fee_bps_note]": "1000",
  };

  if (emailInsert) {
    checkoutParams["customer_email"] = emailInsert;
  }

  const checkoutRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(checkoutParams).toString(),
  });

  const session = await checkoutRes.json();
  if (session.error) {
    await supabaseAdmin.from("soundfortips_fan_requests").delete().eq("id", requestId);
    return new Response(JSON.stringify({ error: session.error.message || "Stripe error" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await supabaseAdmin
    .from("soundfortips_fan_requests")
    .update({ stripe_checkout_session_id: session.id as string })
    .eq("id", requestId);

  return new Response(
    JSON.stringify({
      url: session.url as string,
      request_id: requestId,
      session_id: session.id,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
