import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*" };

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ── Verify Stripe signature ────────────────────────────
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    // Simple HMAC verification using Web Crypto — includes timestamp replay protection (5 min window)
    async function verifyStripeSignature(payload: string, sig: string, secret: string): Promise<boolean> {
        try {
            const parts = sig.split(",").reduce((acc, part) => {
                const [k, v] = part.split("=");
                acc[k] = v;
                return acc;
            }, {} as Record<string, string>);

            const timestamp = parts.t;
            const givenSig = parts.v1;

            // ── Replay attack protection: reject events older than 5 minutes ──
            const eventAge = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
            if (eventAge > 300) {
                console.warn(`[Webhook] Rejected stale event: ${eventAge}s old`);
                return false;
            }

            const signedPayload = `${timestamp}.${payload}`;

            const key = await crypto.subtle.importKey(
                "raw",
                new TextEncoder().encode(secret),
                { name: "HMAC", hash: "SHA-256" },
                false,
                ["sign"]
            );
            const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
            const computed = Array.from(new Uint8Array(signed)).map(b => b.toString(16).padStart(2, "0")).join("");
            return computed === givenSig;
        } catch {
            return false;
        }
    }

    const isValid = await verifyStripeSignature(body, signature || "", STRIPE_WEBHOOK_SECRET);
    if (!isValid) {
        return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(body);
    console.log("Stripe webhook event:", event.type);

    // ── FASE A: Idempotency Check (Militar Guard) ───────
    const { data: alreadyProcessed } = await supabase
        .from("processed_webhooks")
        .select("event_id")
        .eq("event_id", event.id)
        .maybeSingle();

    if (alreadyProcessed) {
        console.log(`[Webhook] Duplicate event ignored: ${event.id}`);
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
            headers: { "Content-Type": "application/json" }
        });
    }

    try {
        switch (event.type) {

            // ── Payment successful ──────────────────────────────
            case "checkout.session.completed": {
                const session = event.data.object;
                const leadId = session.metadata?.lead_id;
                const userId = session.metadata?.user_id;

                // ── Branch A: Event Deposit (client paying for event) ──
                if (leadId) {
                    const amountPaid = (session.amount_total ?? 0) / 100; // cents → dollars

                    // Fetch current lead to add paid amount
                    const { data: lead } = await supabase
                        .from("leads")
                        .select("balance_paid, total_amount")
                        .eq("id", leadId)
                        .single();

                    const prevPaid = parseFloat(lead?.balance_paid ?? 0);
                    const total = parseFloat(lead?.total_amount ?? 0);
                    const newPaid = prevPaid + amountPaid;
                    const newStatus = total > 0 && newPaid >= total ? "PAID" : "PARTIAL";

                    await supabase.from("leads").update({
                        payment_status: newStatus,
                        balance_paid: newPaid,
                        stripe_session_id: session.id,
                        status: newStatus === "PAID" ? "CONFIRMED" : "MATCHED",
                    }).eq("id", leadId);

                    console.log(`✅ Event deposit paid: lead ${leadId} | $${amountPaid} | status → ${newStatus}`);
                    break;
                }

                // ── Branch B: DJ PRO Subscription ──────────────────
                const subId = session.subscription;
                const referrerId = (session.metadata?.referrer_id || "") as string;
                const referralCode = (session.metadata?.referral_code || "") as string;
                if (!userId || !subId) break;

                // Fetch subscription for period end
                const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
                const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
                    headers: { Authorization: `Bearer ${STRIPE_KEY}` }
                });
                const sub = await subRes.json();
                const renewalDate = new Date(sub.current_period_end * 1000).toISOString().split("T")[0];

                await supabase.from("dj_profiles").update({
                    plan: "PRO",
                    subscription_id: subId,
                    subscription_status: "active",
                    next_renewal: renewalDate,
                }).eq("user_id", userId);

                // ── Write to payments table for audit/history ──────────────
                await supabase.from("payments").insert({
                    user_id: userId,
                    stripe_session_id: session.id,
                    stripe_intent_id: session.payment_intent ?? null,
                    amount_cents: session.amount_total ?? 0,
                    currency: session.currency ?? "usd",
                    status: "paid",
                    plan: "PRO",
                    interval: session.metadata?.billing ?? "monthly",
                });

                // ── Audit log ─────────────────────────────────────────────
                await supabase.from("audit_log").insert({
                    user_id: userId,
                    event: "subscription_activated",
                    metadata: { plan: "PRO", sub_id: subId, billing: session.metadata?.billing },
                }).then(() => { }).catch(() => { });

                // ── Referral credit (fixed) ────────────────────────────────
                if (referrerId && referralCode) {
                    await supabase.from("referrals").insert({
                        referrer_id: referrerId,
                        referred_id: userId,
                        referral_code: referralCode,
                        discount_given: 20.00,
                        credit_earned: 10.00,
                        status: "pending",
                    }).then(() => { }).catch(() => { });

                    // Increment referrer credits via RPC
                    await supabase.rpc("increment_referral_credits", {
                        uid: referrerId,
                        amount: 10.00,
                    }).then(() => { }).catch((e: Error) => console.warn("Referral RPC:", e.message));
                }

                console.log(`✅ PRO activated for user ${userId}${referrerId ? ` | Referrer ${referrerId} +$10` : ""}`);
                break;
            }


            // ── Invoice paid → keep PRO active, update renewal ──
            case "invoice.paid": {
                const invoice = event.data.object;
                const subId = invoice.subscription;
                const periodEnd = new Date(invoice.period_end * 1000).toISOString().split("T")[0];

                await supabase.from("dj_profiles").update({
                    subscription_status: "active",
                    next_renewal: periodEnd,
                }).eq("subscription_id", subId);
                break;
            }

            // ── Payment failed ──────────────────────────────────
            case "invoice.payment_failed": {
                const invoice = event.data.object;
                await supabase.from("dj_profiles").update({
                    subscription_status: "past_due",
                }).eq("subscription_id", invoice.subscription);
                break;
            }

            // ── Subscription cancelled → downgrade to LITE ──────
            case "customer.subscription.deleted": {
                const sub = event.data.object;
                await supabase.from("dj_profiles").update({
                    plan: "LITE",
                    subscription_status: "cancelled",
                    subscription_id: null,
                    next_renewal: null,
                }).eq("subscription_id", sub.id);

                console.log(`⬇️ Downgraded to LITE: sub ${sub.id}`);
                break;
            }

            // ── Subscription updated (e.g., trial end) ──────────
            case "customer.subscription.updated": {
                const sub = event.data.object;
                await supabase.from("dj_profiles").update({
                    subscription_status: sub.status,
                }).eq("subscription_id", sub.id);
                break;
            }
        }

        // ── FASE A: Register successful processing ───────────
        await supabase.from("processed_webhooks").insert({ event_id: event.id });

        return new Response(JSON.stringify({ received: true }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (err: unknown) {
        console.error("Webhook error:", err);
        const msg = err instanceof Error ? err.message : "Unknown error";
        return new Response(JSON.stringify({ error: msg }), { status: 500 });
    }
});
