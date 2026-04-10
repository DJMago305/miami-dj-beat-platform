// supabase/functions/create-event-payment/index.ts
// Creates a Stripe Checkout session for a client to pay their event deposit.
// Called from client-portal.html when the client clicks "Pagar Depósito".
// Env vars: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_URL
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://miamidjbeat.vercel.app";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const body = await req.json();

        const lead_id = (body.lead_id ?? "").trim();
        const amount_cents = parseInt(body.amount_cents ?? "15000", 10); // default $150
        const description = (body.description ?? "Depósito de Reserva — Miami DJ Beat").trim();

        if (!lead_id) return json({ ok: false, error: "lead_id requerido" }, 400);
        if (!STRIPE_SECRET_KEY) return json({ ok: false, error: "STRIPE_SECRET_KEY no configurado" }, 500);

        // ── Fetch lead details ─────────────────────────────────
        const { data: lead, error: leadErr } = await sb
            .from("leads")
            .select("id, email, event_type, event_date, location, assigned_dj_name, contact_person")
            .eq("id", lead_id)
            .single();

        if (leadErr || !lead) {
            return json({ ok: false, error: "Lead no encontrado" }, 404);
        }

        const clientEmail = lead.email ?? "";
        const eventLabel = `${lead.event_type ?? "Evento"} — ${lead.event_date ?? ""}`;

        // ── Get or create Stripe Customer for this client ──────
        let customerId: string | null = null;

        // Check if we have a stripe_customer_id stored on the lead
        const { data: leadFull } = await sb
            .from("leads")
            .select("stripe_customer_id")
            .eq("id", lead_id)
            .single();

        customerId = leadFull?.stripe_customer_id ?? null;

        if (!customerId && clientEmail) {
            // Search existing Stripe customer by email
            const searchRes = await fetch(
                `https://api.stripe.com/v1/customers/search?query=email:'${encodeURIComponent(clientEmail)}'&limit=1`,
                { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } }
            );
            const searchData = await searchRes.json();
            if (searchData.data && searchData.data.length > 0) {
                customerId = searchData.data[0].id;
            }
        }

        if (!customerId && clientEmail) {
            // Create new Stripe customer
            const custRes = await fetch("https://api.stripe.com/v1/customers", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    email: clientEmail,
                    name: lead.contact_person ?? clientEmail,
                    "metadata[lead_id]": lead_id,
                }).toString(),
            });
            const cust = await custRes.json();
            customerId = cust.id;

            // Save stripe_customer_id to lead
            if (customerId) {
                await sb.from("leads").update({ stripe_customer_id: customerId }).eq("id", lead_id);
            }
        }

        // ── Create Stripe Checkout Session (one-time payment) ──
        const checkoutParams: Record<string, string> = {
            mode: "payment",
            "line_items[0][price_data][currency]": "usd",
            "line_items[0][price_data][unit_amount]": String(amount_cents),
            "line_items[0][price_data][product_data][name]": description,
            "line_items[0][price_data][product_data][description]": eventLabel,
            "line_items[0][quantity]": "1",
            success_url: `${SITE_URL}/client-portal.html?lead=${lead_id}&payment=success`,
            cancel_url: `${SITE_URL}/client-portal.html?lead=${lead_id}&payment=cancelled`,
            "metadata[lead_id]": lead_id,
            "metadata[event_type]": lead.event_type ?? "",
            "metadata[event_date]": lead.event_date ?? "",
        };

        if (customerId) {
            checkoutParams["customer"] = customerId;
        } else if (clientEmail) {
            checkoutParams["customer_email"] = clientEmail;
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
        if (session.error) throw new Error(session.error.message);

        // ── Update lead: mark payment as pending ───────────────
        await sb.from("leads").update({
            stripe_session_id: session.id,
            payment_status: "PENDING",
        }).eq("id", lead_id);

        return json({ ok: true, url: session.url, session_id: session.id });

    } catch (e) {
        return json({ ok: false, error: String(e) }, 500);
    }
});

function json(obj: unknown, status = 200) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}
