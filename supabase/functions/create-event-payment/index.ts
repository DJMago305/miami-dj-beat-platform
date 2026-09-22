// supabase/functions/create-event-payment/index.ts
// Creates a Stripe Checkout session for a client to pay their event deposit or final balance.
// Called from client-portal.js (payDepositStripe).
// EL SERVIDOR CALCULA SIEMPRE EL MONTO (decisión del PO, 2026-09-21): el navegador ya no manda amount_cents ni
// deposit_required_usd. Manda { lead_id, kind: "deposit" | "balance", coupon_code? }.
//   deposit → leads.deposit_required_usd si el staff lo fijó; si no, 50 % del total con mínimo $150 (lo que muestra la pantalla).
//   balance → todo lo que falta por pagar (total_amount − balance_paid).
//   cupón   → resta del total ANTES del impuesto (7 %), un cupón por evento, no se suma al crédito de referido,
//             solo en el depósito. Se RESERVA aquí (discount_reserve); el uso se gasta cuando Stripe confirma (stripe-webhook).
//   { quote: true } calcula y devuelve los montos sin crear sesión ni reservar (para mostrar el número real en pantalla).
// Env vars: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_URL
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://miamidjbeat.vercel.app";
const TAX_RATE = 0.07; // igual que computePortalCartTotals() en client-portal.js
const DEPOSIT_RATE = 0.50; // depósito de reserva: 50 % del total (decisión del PO, 2026-09-21)
const MIN_DEPOSIT_CENTS = 15000; // depósito mínimo $150

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
        const kind = String(body.kind ?? "deposit").toLowerCase();
        const couponCode = String(body.coupon_code ?? "").trim();
        const quoteOnly = body.quote === true;
        const description = (body.description ?? "").toString().trim().slice(0, 120);

        if (!lead_id) return json({ ok: false, error: "lead_id requerido" }, 400);
        if (kind !== "deposit" && kind !== "balance") return json({ ok: false, error: "kind debe ser deposit o balance" }, 400);
        if (!STRIPE_SECRET_KEY) return json({ ok: false, error: "STRIPE_SECRET_KEY no configurado" }, 500);

        // ── Fetch lead (incluye caja de cobro: lead + enlace a client_profiles) ─
        const { data: lead, error: leadErr } = await sb
            .from("leads")
            .select(
                "id, email, event_type, event_date, location, assigned_dj_name, contact_person, stripe_customer_id, client_user_id, total_amount, balance_paid, deposit_required_usd, total_aprobado_usd, status",
            )
            .eq("id", lead_id)
            .single();

        if (leadErr || !lead) {
            return json({ ok: false, error: "Lead no encontrado" }, 404);
        }

        // Un evento cancelado o ya completado no se cobra: el cobro se crearía sobre algo que ya no existe.
        const leadStatus = String(lead.status ?? "").toUpperCase();
        if (leadStatus === "CANCELLED" || leadStatus === "COMPLETED") {
            return json({ ok: false, code: "evento_no_cobrable", error: leadStatus === "CANCELLED" ? "El evento está cancelado" : "El evento ya está completado" }, 409);
        }

        const clientEmail = (lead.email ?? "").trim();
        const eventLabel = `${lead.event_type ?? "Evento"} — ${lead.event_date ?? ""}`;

        // ── Monto: lo decide el servidor ──────────────────────────
        const totalCents = Math.round((parseFloat(String(lead.total_amount ?? 0)) || 0) * 100);
        const paidCents = Math.round((parseFloat(String(lead.balance_paid ?? 0)) || 0) * 100);
        const remainingCents = totalCents - paidCents;
        if (totalCents <= 0) return json({ ok: false, error: "El evento no tiene un total definido" }, 400);
        if (remainingCents <= 0) return json({ ok: false, error: "El evento ya está pagado" }, 409);

        // El total lo arma el navegador y no es de confianza: solo se cobra un total que el staff (o el servidor) aprobó.
        // La aprobación está atada al monto; si alguien cambió total_amount después, ya no coincide y no se cobra.
        const approvedUsd = lead.total_aprobado_usd != null ? parseFloat(String(lead.total_aprobado_usd)) : NaN;
        const totalApproved = isFinite(approvedUsd) && Math.abs(Math.round(approvedUsd * 100) - totalCents) === 0;
        if (!totalApproved && !quoteOnly) {
            return json({
                ok: false, code: "total_pendiente_aprobacion",
                error: "El total de este evento está pendiente de aprobación del equipo. Te avisaremos cuando puedas pagar.",
            }, 409);
        }

        let chargeCents = 0;
        let discountCents = 0;
        let couponApplied: { code: string; label: string } | null = null;
        let reserveCode = "";

        if (kind === "balance") {
            if (couponCode) return json({ ok: false, error: "Los cupones aplican solo al depósito" }, 400);
            chargeCents = remainingCents;
        } else {
            if (paidCents > 0) return json({ ok: false, error: "El depósito ya fue pagado; usa kind=balance" }, 409);
            let effectiveTotalCents = totalCents;

            if (couponCode) {
                // Un cupón por evento y no se suma al crédito de referido (que ya viene dentro de total_amount).
                if (lead.client_user_id) {
                    const { data: cpRef } = await sb.from("client_profiles")
                        .select("source_ref, discount_eligible").eq("user_id", String(lead.client_user_id)).maybeSingle();
                    if (cpRef?.source_ref && cpRef?.discount_eligible !== false) {
                        return json({ ok: false, error: "Este evento ya tiene el crédito de referido; no se combina con cupones" }, 409);
                    }
                }
                // El cupón resta del total ANTES del impuesto.
                const preTaxCents = Math.round(totalCents / (1 + TAX_RATE));
                const rpcName = quoteOnly ? "mdj_validate_discount_code" : "discount_reserve";
                const rpcArgs = quoteOnly
                    ? { p_code: couponCode, p_order_cents: preTaxCents }
                    : { p_code: couponCode, p_lead_id: lead_id, p_order_cents: preTaxCents };
                const { data: dr, error: drErr } = await sb.rpc(rpcName, rpcArgs);
                if (drErr) return json({ ok: false, error: `Cupón: ${drErr.message}` }, 500);
                const okC = quoteOnly ? dr?.valid === true : dr?.ok === true;
                if (!okC) return json({ ok: false, error: String(dr?.error ?? "Cupón no válido") }, 422);
                discountCents = Number(dr.discount_cents) || 0;
                couponApplied = { code: String(dr.code), label: String(dr.label ?? dr.code) };
                reserveCode = couponCode;
                effectiveTotalCents = Math.round((preTaxCents - discountCents) * (1 + TAX_RATE));
            }

            const depOverride = parseFloat(String(lead.deposit_required_usd ?? ""));
            const baseDeposit = isFinite(depOverride) && depOverride > 0
                ? Math.round(depOverride * 100)
                : Math.max(Math.round(effectiveTotalCents * DEPOSIT_RATE), MIN_DEPOSIT_CENTS);
            chargeCents = Math.min(baseDeposit, effectiveTotalCents - paidCents);
        }

        if (chargeCents < 50) return json({ ok: false, error: "Monto por debajo del mínimo de Stripe" }, 400);
        const payDescription = description ||
            (kind === "balance" ? "Saldo final — Miami DJ Beat" : "Depósito de Reserva — Miami DJ Beat");

        if (quoteOnly) {
            return json({
                ok: true, quote: true, kind, total_approved: totalApproved, amount_cents: chargeCents, discount_cents: discountCents,
                coupon: couponApplied, total_cents: totalCents, remaining_cents: remainingCents,
            });
        }

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

        // ── Create Stripe Checkout Session (one-time payment) ──
        const checkoutParams: Record<string, string> = {
            mode: "payment",
            billing_address_collection: "auto",
            "line_items[0][price_data][currency]": "usd",
            "line_items[0][price_data][unit_amount]": String(chargeCents),
            "line_items[0][price_data][product_data][name]": payDescription,
            "line_items[0][price_data][product_data][description]": eventLabel,
            "line_items[0][quantity]": "1",
            success_url: `${SITE_URL}/client-portal.html?lead=${lead_id}&payment=success`,
            cancel_url: `${SITE_URL}/client-portal.html?lead=${lead_id}&payment=cancelled`,
            "metadata[lead_id]": lead_id,
            "metadata[account_lane]": "buyer",
            "metadata[product_line]": kind === "balance" ? "event_balance" : "event_deposit",
            "metadata[payment_kind]": kind,
            "metadata[discount_cents]": String(discountCents),
            "metadata[coupon_code]": couponApplied?.code ?? "",
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
        if (session.error) {
            if (reserveCode) {
                // No se llegó a abrir el pago: devolver el cupo del cupón de inmediato.
                await sb.from("discount_redemptions").update({ status: "released", released_at: new Date().toISOString() })
                    .eq("lead_id", lead_id).eq("status", "reserved").is("stripe_session_id", null);
            }
            throw new Error(session.error.message);
        }
        if (reserveCode) {
            // Idempotente: misma reserva, ahora atada a la sesión para que el webhook la confirme o la libere.
            await sb.rpc("discount_reserve", {
                p_code: reserveCode, p_lead_id: lead_id,
                p_order_cents: Math.round(totalCents / (1 + TAX_RATE)), p_stripe_session_id: session.id,
            });
        }

        // ── Update lead: mark payment as pending ───────────────
        await sb.from("leads").update({
            stripe_session_id: session.id,
            payment_status: "PENDING",
        }).eq("id", lead_id);

        return json({ ok: true, url: session.url, session_id: session.id, amount_cents: chargeCents, discount_cents: discountCents });

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
