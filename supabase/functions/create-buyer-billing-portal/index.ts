// Buyer (client_profiles) Stripe Customer Portal — manage saved cards for event payments.
// Separate from artist MDJ Pro billing (dj_profiles.stripe_customer_id).
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://www.miamidjbeat.com";

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
    const returnUrl =
      typeof body.return_url === "string" && body.return_url.trim()
        ? body.return_url.trim()
        : `${SITE_URL}/client-account.html`;

    const { data: cp } = await sb
      .from("client_profiles")
      .select("user_id, email, full_name, buyer_stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId =
      cp?.buyer_stripe_customer_id != null && String(cp.buyer_stripe_customer_id).trim() !== ""
        ? String(cp.buyer_stripe_customer_id).trim()
        : null;

    const email = (cp?.email || user.email || "").trim();

    if (!customerId && email) {
      const q = encodeURIComponent(`email:'${email.replace(/'/g, "\\'")}'`);
      const searchRes = await fetch(
        `https://api.stripe.com/v1/customers/search?query=${q}&limit=3`,
        { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } },
      );
      const searchData = await searchRes.json();
      const match = (searchData.data || []).find(
        (c: { metadata?: { mdj_buyer_user_id?: string } }) =>
          c?.metadata?.mdj_buyer_user_id === user.id,
      );
      if (match?.id) customerId = match.id;
    }

    if (!customerId) {
      const params = new URLSearchParams();
      if (email) params.set("email", email);
      params.set("metadata[mdj_buyer_user_id]", user.id);
      params.set("metadata[mdj_account_type]", "buyer");
      const name = cp?.full_name ? String(cp.full_name).trim() : "";
      if (name) params.set("name", name);

      const custRes = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      const cust = await custRes.json();
      if (cust.error) {
        return json({ ok: false, error: cust.error.message || "Customer create failed" }, 500);
      }
      customerId = cust.id as string;
      await sb
        .from("client_profiles")
        .update({ buyer_stripe_customer_id: customerId })
        .eq("user_id", user.id);
    }

    const portalParams = new URLSearchParams({
      customer: customerId!,
      return_url: returnUrl,
    });
    const portalRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: portalParams.toString(),
    });
    const portal = await portalRes.json();
    if (portal.error || !portal.url) {
      return json({ ok: false, error: portal.error?.message || "Portal session failed" }, 500);
    }

    return json({ ok: true, url: portal.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: msg }, 500);
  }
});
