// Registra petición SOUNDFORTIPS: PII solo en servidor (promos / SMS). verify_jwt false (fan anónimo).
// Deploy: supabase functions deploy register-sft-fan-request
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
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

  const emailRaw = body.client_email != null ? String(body.client_email).trim() : "";
  const emailOk = emailRaw.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw);
  if (emailRaw.length > 0 && !emailOk) {
    return new Response(JSON.stringify({ error: "Invalid email format" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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
    .select("user_id")
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
      status: "pending",
    })
    .select("id")
    .single();

  if (insErr || !inserted?.id) {
    console.error("[register-sft-fan-request]", insErr);
    return new Response(JSON.stringify({ error: "Insert failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ request_id: inserted.id }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
