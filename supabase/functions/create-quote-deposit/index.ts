// Miami DJ Beat LLC — staff-only Stripe Checkout for a converted quote deposit (30% of subtotal).
// Amounts come from the database. The client never supplies dollars.
// Env: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_URL

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SITE_URL = (Deno.env.get("SITE_URL") || "https://miamidjbeat.com").replace(/\/$/, "");
const ALLOWED_ROLES = new Set(["owner", "admin", "manager", "seller"]);

const ADMIN = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
});

const ALLOWED_ORIGINS = [
    "https://miamidjbeat.com",
    "https://www.miamidjbeat.com",
    "https://miamidjbeat.vercel.app",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
];

function cors(req: Request): Record<string, string> {
    const origin = req.headers.get("origin") ?? "";
    const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        "Access-Control-Allow-Origin": allowed,
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Vary": "Origin",
    };
}

function json(headers: Record<string, string>, obj: unknown, status = 200) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { ...headers, "Content-Type": "application/json" },
    });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function verifyStaff(req: Request): Promise<{ ok: true; userId: string } | { ok: false; status: number; error: string }> {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!jwt) return { ok: false, status: 401, error: "missing_authorization" };
    const { data: { user }, error } = await ADMIN.auth.getUser(jwt);
    if (error || !user?.id) return { ok: false, status: 401, error: "invalid_session" };
    const { data: prof } = await ADMIN
        .from("dj_profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
    const role = String(prof?.role ?? "").toLowerCase().trim();
    if (!ALLOWED_ROLES.has(role)) return { ok: false, status: 403, error: "forbidden_not_staff" };
    return { ok: true, userId: user.id };
}

async function audit(actor: string, action: string, target: string, result: string): Promise<void> {
    try {
        await ADMIN.rpc("agent_action_log_write", {
            p_actor: actor.slice(0, 128),
            p_action: action.slice(0, 128),
            p_target: target.slice(0, 512),
            p_result: result.slice(0, 2000),
            p_agent_id: "quote-checkout",
        });
    } catch (e) {
        console.error("[create-quote-deposit] audit error:", e);
    }
}

serve(async (req) => {
    const headers = cors(req);
    if (req.method === "OPTIONS") return new Response("ok", { headers });
    if (req.method !== "POST") return json(headers, { ok: false, error: "method_not_allowed" }, 405);
    if (!STRIPE_SECRET_KEY) return json(headers, { ok: false, error: "stripe_unconfigured" }, 500);

    const gate = await verifyStaff(req);
    if (!gate.ok) return json(headers, { ok: false, error: gate.error }, gate.status);

    let body: { quote_id?: unknown; lead_id?: unknown };
    try {
        body = await req.json();
    } catch {
        return json(headers, { ok: false, error: "invalid_json" }, 400);
    }

    const quoteId = String(body.quote_id ?? "").trim();
    const leadId = String(body.lead_id ?? "").trim();
    if (!UUID_RE.test(quoteId) || !UUID_RE.test(leadId)) {
        await audit(gate.userId, "create-quote-deposit", quoteId || "invalid", "error:ids_invalidos");
        return json(headers, { ok: false, error: "ids_invalidos" }, 400);
    }

    const { data: converted, error: convErr } = await ADMIN.rpc("event_quote_convert_to_order", {
        p_quote_id: quoteId,
        p_lead_id: leadId,
    });
    if (convErr || !converted || converted.ok !== true) {
        const detail = convErr?.message ?? "convert";
        await audit(gate.userId, "create-quote-deposit", quoteId, `error:${detail}`.slice(0, 2000));
        return json(headers, { ok: false, error: "convert_failed", detail }, 400);
    }

    const eboId = String(converted.ebo_id ?? "");
    const depositUsd = Number(converted.deposit_usd);
    if (!UUID_RE.test(eboId) || !Number.isFinite(depositUsd) || depositUsd <= 0) {
        await audit(gate.userId, "create-quote-deposit", quoteId, "error:deposito_invalido");
        return json(headers, { ok: false, error: "deposito_invalido" }, 500);
    }
    const amountCents = Math.round(depositUsd * 100);
    if (amountCents < 50) {
        await audit(gate.userId, "create-quote-deposit", quoteId, "error:deposito_minimo");
        return json(headers, { ok: false, error: "deposito_minimo" }, 400);
    }

    const { data: lead, error: leadErr } = await ADMIN
        .from("leads")
        .select("id, email, event_type, event_date, contact_person, stripe_customer_id, client_user_id")
        .eq("id", leadId)
        .maybeSingle();
    if (leadErr || !lead) {
        await audit(gate.userId, "create-quote-deposit", quoteId, "error:lead_not_found");
        return json(headers, { ok: false, error: "lead_not_found" }, 404);
    }

    const clientEmail = String(lead.email ?? "").trim();
    let customerId = String(lead.stripe_customer_id ?? "").trim() || null;
    const clientUid = lead.client_user_id != null ? String(lead.client_user_id) : "";
    if (!customerId && clientUid) {
        const { data: cp } = await ADMIN
            .from("client_profiles")
            .select("buyer_stripe_customer_id")
            .eq("user_id", clientUid)
            .maybeSingle();
        const b = cp?.buyer_stripe_customer_id;
        if (b != null && String(b).trim() !== "") customerId = String(b).trim();
    }
    if (!customerId && !clientEmail) {
        await audit(gate.userId, "create-quote-deposit", quoteId, "error:falta_email_lead");
        return json(headers, { ok: false, error: "falta_email_lead" }, 400);
    }

    const eventLabel = `${lead.event_type ?? "Evento"} — ${lead.event_date ?? ""}`;
    const checkoutParams: Record<string, string> = {
        mode: "payment",
        billing_address_collection: "auto",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": String(amountCents),
        "line_items[0][price_data][product_data][name]": "Depósito 30% — Miami DJ Beat LLC",
        "line_items[0][price_data][product_data][description]": eventLabel,
        "line_items[0][quantity]": "1",
        success_url: `${SITE_URL}/quote.html?id=${quoteId}&payment=success`,
        cancel_url: `${SITE_URL}/quote.html?id=${quoteId}&payment=cancelled`,
        "metadata[quote_id]": quoteId,
        "metadata[ebo_id]": eboId,
        "metadata[lead_id]": leadId,
        "metadata[account_lane]": "buyer",
        "metadata[product_line]": "event_deposit",
        "metadata[source]": "quote",
    };
    if (customerId) checkoutParams.customer = customerId;
    else checkoutParams.customer_email = clientEmail;

    const checkoutRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(checkoutParams).toString(),
    });
    const session = await checkoutRes.json();
    if (session.error || !session.url) {
        const msg = String(session.error?.message ?? "stripe_session");
        await audit(gate.userId, "create-quote-deposit", quoteId, `error:${msg}`.slice(0, 2000));
        return json(headers, { ok: false, error: "stripe_session" }, 502);
    }

    await ADMIN.from("leads").update({
        stripe_session_id: session.id,
        payment_status: "PENDING",
        deposit_required_usd: depositUsd,
    }).eq("id", leadId);

    await audit(gate.userId, "create-quote-deposit", quoteId, `ok:${eboId}:${session.id}`);
    return json(headers, {
        ok: true,
        url: session.url,
        session_id: session.id,
        quote_id: quoteId,
        ebo_id: eboId,
        deposit_usd: depositUsd,
    });
});
