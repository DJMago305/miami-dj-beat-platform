// SOUNDFORTIPS: cobra a la tarjeta Stripe del DJ la comisión de plataforma (10%) sobre tips manuales ya aceptados y no liquidados.
// verify_jwt true. Env: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Mínimo Stripe ~$0.50: por debajo se acumula en dj_profiles.sft_manual_fee_pending_cents.
// Deploy: supabase functions deploy settle-sft-manual-platform-fee

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_FEE_BPS = 1000; // 10.00%
const MIN_CHARGE_CENTS = 50; // Stripe típico mínimo para charge en USD

async function stripeGet(path: string, key: string): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const json = (await res.json()) as Record<string, unknown>;
  return { ok: res.ok, json };
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

  const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!STRIPE_SECRET_KEY || !supabaseUrl || !anonKey || !serviceKey) {
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

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const djId = user.id;
  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const { data: planOk, error: planErr } = await supabaseAdmin.rpc("dj_soundfortips_plan_ok", { uid: djId });
  if (planErr || !planOk) {
    return new Response(JSON.stringify({ error: "SOUNDFORTIPS requires PRO" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: profile, error: profErr } = await supabaseAdmin
    .from("dj_profiles")
    .select("user_id, stripe_customer_id, sft_manual_fee_pending_cents, soundfortips_platform_fee_blocked")
    .eq("user_id", djId)
    .maybeSingle();

  if (profErr || !profile) {
    return new Response(JSON.stringify({ error: "Profile not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const pendingPrev = Math.max(0, Math.floor(Number(profile.sft_manual_fee_pending_cents) || 0));

  const { data: rows, error: rowsErr } = await supabaseAdmin
    .from("soundfortips_fan_requests")
    .select("id, tip_usd")
    .eq("dj_user_id", djId)
    .eq("payment_channel", "manual")
    .eq("status", "accepted")
    .is("manual_platform_fee_settled_at", null);

  if (rowsErr) {
    console.error("[settle-sft-manual-platform-fee] select", rowsErr);
    return new Response(JSON.stringify({ error: "Query failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let grossCents = 0;
  const rowIds: string[] = [];
  for (const r of rows || []) {
    const tip = Number((r as { tip_usd?: unknown }).tip_usd) || 0;
    grossCents += Math.round(tip * 100);
    rowIds.push(String((r as { id: string }).id));
  }

  const feeFromTips = Math.floor((grossCents * PLATFORM_FEE_BPS) / 10000);
  const totalFeeCents = pendingPrev + feeFromTips;

  if (rowIds.length === 0 && pendingPrev === 0) {
    return new Response(
      JSON.stringify({
        ok: true,
        charged: false,
        message: "Nothing to settle",
        fee_cents: 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (totalFeeCents < MIN_CHARGE_CENTS) {
    await supabaseAdmin
      .from("dj_profiles")
      .update({
        sft_manual_fee_pending_cents: totalFeeCents,
        sft_platform_fee_last_error: null,
      })
      .eq("user_id", djId);

    return new Response(
      JSON.stringify({
        ok: true,
        charged: false,
        accumulated_cents: totalFeeCents,
        reason: "below_minimum",
        min_cents: MIN_CHARGE_CENTS,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const customerId = profile.stripe_customer_id != null
    ? String(profile.stripe_customer_id).trim()
    : "";

  if (!customerId) {
    await supabaseAdmin
      .from("dj_profiles")
      .update({
        sft_manual_fee_pending_cents: totalFeeCents,
        sft_platform_fee_last_error: "No Stripe customer on file — add a card under subscription billing first.",
      })
      .eq("user_id", djId);

    return new Response(
      JSON.stringify({
        ok: false,
        charged: false,
        needs_stripe_customer: true,
        fee_cents: totalFeeCents,
        message: "Link a card via PRO subscription billing so we can collect the platform fee on manual tips.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let pmId: string | null = null;
  const custRes = await stripeGet(
    `customers/${encodeURIComponent(customerId)}?expand[]=invoice_settings.default_payment_method`,
    STRIPE_SECRET_KEY,
  );
  if (custRes.ok) {
    const dpm = custRes.json.invoice_settings as Record<string, unknown> | undefined;
    const dm = dpm?.default_payment_method;
    if (typeof dm === "string") pmId = dm;
    else if (dm && typeof dm === "object" && (dm as { id?: string }).id) {
      pmId = (dm as { id: string }).id;
    }
  }

  if (!pmId) {
    const pmList = await stripeGet(
      `customers/${encodeURIComponent(customerId)}/payment_methods?type=card&limit=3`,
      STRIPE_SECRET_KEY,
    );
    const listData = pmList.json.data as unknown[] | undefined;
    if (Array.isArray(listData) && listData.length > 0) {
      const first = listData[0] as { id?: string };
      if (first?.id) pmId = first.id;
    }
  }

  if (!pmId) {
    await supabaseAdmin
      .from("dj_profiles")
      .update({
        sft_manual_fee_pending_cents: totalFeeCents,
        sft_platform_fee_last_error: "No saved card — update payment method in billing.",
      })
      .eq("user_id", djId);

    return new Response(
      JSON.stringify({
        ok: false,
        charged: false,
        needs_payment_method: true,
        fee_cents: totalFeeCents,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const idempotencyKey = `sft-manual-fee-${djId}-${rowIds.join("-").slice(0, 80)}-${totalFeeCents}`;

  const piBody: Record<string, string> = {
    amount: String(totalFeeCents),
    currency: "usd",
    customer: customerId,
    payment_method: pmId,
    confirm: "true",
    off_session: "true",
    "metadata[product]": "soundfortips_manual_platform_fee",
    "metadata[dj_user_id]": djId,
    description: `Miami DJ Beat — SoundForTips platform fee (${PLATFORM_FEE_BPS / 100}%) on manual tips`,
  };

  const piRes = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": idempotencyKey.slice(0, 120),
    },
    body: new URLSearchParams(piBody).toString(),
  });
  const piJson = (await piRes.json()) as Record<string, unknown>;

  if (!piRes.ok) {
    const msg = String((piJson.error as { message?: string })?.message ?? JSON.stringify(piJson));
    await supabaseAdmin
      .from("dj_profiles")
      .update({
        soundfortips_platform_fee_blocked: true,
        sft_platform_fee_last_error: msg.slice(0, 500),
      })
      .eq("user_id", djId);

    return new Response(
      JSON.stringify({
        ok: false,
        charged: false,
        blocked: true,
        stripe_error: msg,
        fee_cents: totalFeeCents,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const nowIso = new Date().toISOString();
  const piId = String(piJson.id ?? "");

  if (rowIds.length > 0) {
    const up = await supabaseAdmin
      .from("soundfortips_fan_requests")
      .update({ manual_platform_fee_settled_at: nowIso })
      .in("id", rowIds)
      .eq("dj_user_id", djId);
    if (up.error) {
      console.error("[settle-sft-manual-platform-fee] mark settled after charge", up.error);
      await supabaseAdmin
        .from("dj_profiles")
        .update({
          sft_platform_fee_last_error: `Charge ok (${piId}) but DB mark failed — contact support.`,
        })
        .eq("user_id", djId);
      return new Response(
        JSON.stringify({
          ok: false,
          charged: true,
          partial: true,
          payment_intent_id: piId,
          fee_cents: totalFeeCents,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  await supabaseAdmin
    .from("dj_profiles")
    .update({
      sft_manual_fee_pending_cents: 0,
      soundfortips_platform_fee_blocked: false,
      sft_platform_fee_last_error: null,
    })
    .eq("user_id", djId);

  return new Response(
    JSON.stringify({
      ok: true,
      charged: true,
      fee_cents: totalFeeCents,
      payment_intent_id: piId,
      rows_settled: rowIds.length,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
