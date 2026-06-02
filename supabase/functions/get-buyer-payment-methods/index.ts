// List or detach buyer (client_profiles) saved card payment methods via Stripe.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function resolveBuyerCustomerId(userId: string, cp: {
  email?: string | null;
  buyer_stripe_customer_id?: string | null;
} | null) {
  let customerId =
    cp?.buyer_stripe_customer_id != null && String(cp.buyer_stripe_customer_id).trim() !== ""
      ? String(cp.buyer_stripe_customer_id).trim()
      : null;

  const email = (cp?.email || "").trim();
  if (!customerId && email) {
    const q = encodeURIComponent(`email:'${email.replace(/'/g, "\\'")}'`);
    const searchRes = await fetch(
      `https://api.stripe.com/v1/customers/search?query=${q}&limit=3`,
      { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } },
    );
    const searchData = await searchRes.json();
    const match = (searchData.data || []).find(
      (c: { metadata?: { mdj_buyer_user_id?: string } }) =>
        c?.metadata?.mdj_buyer_user_id === userId,
    );
    if (match?.id) customerId = match.id;
  }
  return customerId;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!STRIPE_SECRET_KEY) return json({ ok: false, error: "STRIPE_SECRET_KEY not configured" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ ok: false, error: "Unauthorized" }, 401);

    const { data: userData, error: userErr } = await sb.auth.getUser(jwt);
    const user = userData?.user;
    if (userErr || !user) return json({ ok: false, error: "Invalid session" }, 401);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = typeof body.action === "string" ? body.action.trim() : "list";

    const { data: cp } = await sb
      .from("client_profiles")
      .select("user_id, email, buyer_stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const customerId = await resolveBuyerCustomerId(user.id, cp);
    if (!customerId) {
      if (action === "detach") return json({ ok: false, error: "No billing profile" }, 400);
      return json({ ok: true, cards: [] });
    }

    if (action === "detach") {
      const pmId = typeof body.payment_method_id === "string" ? body.payment_method_id.trim() : "";
      if (!pmId || !pmId.startsWith("pm_")) {
        return json({ ok: false, error: "Invalid payment_method_id" }, 400);
      }
      const detachRes = await fetch(`https://api.stripe.com/v1/payment_methods/${pmId}/detach`, {
        method: "POST",
        headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
      });
      const detachData = await detachRes.json();
      if (detachData.error) {
        return json({ ok: false, error: detachData.error.message || "Detach failed" }, 400);
      }
      return json({ ok: true });
    }

    const listRes = await fetch(
      `https://api.stripe.com/v1/payment_methods?customer=${encodeURIComponent(customerId)}&type=card`,
      { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } },
    );
    const listData = await listRes.json();
    if (listData.error) {
      return json({ ok: false, error: listData.error.message || "List failed" }, 500);
    }

    const cards = (listData.data || []).map((pm: {
      id: string;
      card?: { brand?: string; last4?: string; exp_month?: number; exp_year?: number };
    }) => ({
      id: pm.id,
      brand: pm.card?.brand || "card",
      last4: pm.card?.last4 || "",
      exp_month: pm.card?.exp_month,
      exp_year: pm.card?.exp_year,
    }));

    return json({ ok: true, cards });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: msg }, 500);
  }
});
