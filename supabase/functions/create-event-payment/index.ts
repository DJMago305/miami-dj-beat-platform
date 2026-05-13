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

        // ── Fetch lead (incluye caja de cobro: lead + enlace a client_profiles) ─
        const { data: lead, error: leadErr } = await sb
            .from("leads")
            .select(
                "id, email, event_type, event_date, location, assigned_dj_name, contact_person, stripe_customer_id, client_user_id",
            )
            .eq("id", lead_id)
            .single();

        if (leadErr || !lead) {
            return json({ ok: false, error: "Lead no encontrado" }, 404);
        }

        const clientEmail = (lead.email ?? "").trim();
        const eventLabel = `${lead.event_type ?? "Evento"} — ${lead.event_date ?? ""}`;

        /** Caja **comprador** (portales / eventos). NUNCA reutilizar el customer del artista (Pro en dj_profiles). */
        let customerId: string | null =
            lead.stripe_customer_id != null && String(lead.stripe_customer_id).trim() !== ""
                ? String(lead.stripe_customer_id).trim()
                : null;

        const clientUid = lead.client_user_id != null ? String(lead.client_user_id) : "";
        if (!customerId && clientUid) {
            const { data: cp } = await sb
                .from("client_profiles")
                .select("buyer_stripe_customer_id")
                .eq("user_id", clientUid)
                .maybeSingle();
            const b = cp?.buyer_stripe_customer_id;
            if (b != null && String(b).trim() !== "") {
                customerId = String(b).trim();
            }
        }

        if (!customerId) {
            const q = encodeURIComponent(`metadata['mdj_lead_id']:'${lead_id}'`);
            const searchRes = await fetch(
                `https://api.stripe.com/v1/customers/search?query=${q}&limit=1`,
                { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } },
            );
            const searchData = await searchRes.json();
            if (searchData.data?.length) {
                customerId = searchData.data[0].id;
            }
        }

        if (!customerId) {
            if (!clientEmail) {
                return json(
                    { ok: false, error: "Falta email en el lead para cobrar o crear cliente Stripe (comprador)" },
                    400,
                );
            }
            const newCustBody = new URLSearchParams({
                email: clientEmail,
                name: (lead.contact_person as string) || clientEmail,
                "metadata[mdj_lead_id]": lead_id,
                "metadata[account_lane]": "buyer",
                "metadata[product_line]": "event_deposit",
            });
            if (clientUid) newCustBody.set("metadata[client_user_id]", clientUid);
            const custRes = await fetch("https://api.stripe.com/v1/customers", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: newCustBody.toString(),
            });
            const cust = await custRes.json();
            if (cust.error) {
                return json({ ok: false, error: `Stripe: ${cust.error.message ?? "customer create"}` }, 500);
            }
            customerId = cust.id as string;
        }

        if (customerId) {
            await sb.from("leads").update({ stripe_customer_id: customerId }).eq("id", lead_id);
        }
        if (customerId && clientUid) {
            await sb.from("client_profiles").update({ buyer_stripe_customer_id: customerId }).eq("user_id", clientUid);
        }

        const depositRequiredUsd = body.deposit_required_usd != null
            ? parseFloat(String(body.deposit_required_usd))
            : null;
        if (depositRequiredUsd != null && isFinite(depositRequiredUsd) && depositRequiredUsd > 0) {
            await sb.from("leads").update({ deposit_required_usd: depositRequiredUsd }).eq("id", lead_id);
        }

        // ── Create Stripe Checkout Session (one-time payment) ──
        const checkoutParams: Record<string, string> = {
            mode: "payment",
            billing_address_collection: "auto",
            "line_items[0][price_data][currency]": "usd",
            "line_items[0][price_data][unit_amount]": String(amount_cents),
            "line_items[0][price_data][product_data][name]": description,
            "line_items[0][price_data][product_data][description]": eventLabel,
            "line_items[0][quantity]": "1",
            success_url: `${SITE_URL}/client-portal.html?lead=${lead_id}&payment=success`,
            cancel_url: `${SITE_URL}/client-portal.html?lead=${lead_id}&payment=cancelled`,
            "metadata[lead_id]": lead_id,
            "metadata[account_lane]": "buyer",
            "metadata[product_line]": "event_deposit",
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
