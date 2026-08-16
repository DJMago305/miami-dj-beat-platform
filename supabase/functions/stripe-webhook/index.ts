import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*" };

type MdjproAutoIssueOutcome =
    | { outcome: "issued"; licenseId: string; maskedKey?: string; last4?: string }
    | { outcome: "already_exists"; licenseId: string; last4?: string }
    | { outcome: "skipped"; reason: string; licenseId?: string; planSource?: string; status?: string }
    | { outcome: "error"; reason: string };

/**
 * Auto-issue MDJPRO license after Artist PRO checkout.
 * Pre-check is mandatory: mdjpro_issue_license rotates keys when a row already exists.
 */
async function mdjproAutoIssueArtistProLicense(
    supabase: SupabaseClient,
    userId: string,
    subId: string,
): Promise<MdjproAutoIssueOutcome> {
    const uidShort = userId.slice(0, 8);

    const { data: existing, error: fetchErr } = await supabase
        .from("mdjpro_license_keys")
        .select("id, status, plan_source, key_last4, mdb_stripe_subscription_id")
        .eq("user_id", userId)
        .maybeSingle();

    if (fetchErr) {
        console.error(`[MDJPRO] license pre-check failed | user=${uidShort} | reason=${fetchErr.message}`);
        return { outcome: "error", reason: fetchErr.message };
    }

    if (existing) {
        const planSource = String(existing.plan_source || "");
        const status = String(existing.status || "");

        if (planSource === "miamidjbeat_pro" && status === "active") {
            if (subId && !existing.mdb_stripe_subscription_id) {
                await supabase
                    .from("mdjpro_license_keys")
                    .update({ mdb_stripe_subscription_id: subId })
                    .eq("id", existing.id);
            }

            await supabase.from("mdjpro_license_events").insert({
                license_id: existing.id,
                event_type: "auto_issue_skipped",
                source: "stripe-webhook",
                payload: {
                    user_id: userId,
                    reason: "already_exists",
                    plan_source: planSource,
                    stripe_subscription_id: subId,
                },
            }).then(() => { }).catch((e: Error) => {
                console.warn(`[MDJPRO] auto_issue_skipped event insert: ${e.message}`);
            });

            console.log(
                `[MDJPRO] license already exists | user=${uidShort} | license_id=${existing.id}` +
                (existing.key_last4 ? ` | last4=${existing.key_last4}` : ""),
            );
            return {
                outcome: "already_exists",
                licenseId: existing.id,
                last4: existing.key_last4 || undefined,
            };
        }

        await supabase.from("mdjpro_license_events").insert({
            license_id: existing.id,
            event_type: "auto_issue_skipped",
            source: "stripe-webhook",
            payload: {
                user_id: userId,
                reason: "existing_row_other_source",
                plan_source: planSource,
                status,
                stripe_subscription_id: subId,
            },
        }).then(() => { }).catch((e: Error) => {
            console.warn(`[MDJPRO] auto_issue_skipped event insert: ${e.message}`);
        });

        console.log(
            `[MDJPRO] skip auto-issue | user=${uidShort} | existing plan_source=${planSource} status=${status}`,
        );
        return {
            outcome: "skipped",
            reason: "existing_row_other_source",
            licenseId: existing.id,
            planSource,
            status,
        };
    }

    const { data, error } = await supabase.rpc("mdjpro_issue_license", {
        p_uid: userId,
        p_plan_source: "miamidjbeat_pro",
    });

    if (error) {
        console.error(`[MDJPRO] issue failed | user=${uidShort} | reason=${error.message}`);
        return { outcome: "error", reason: error.message };
    }

    const result = data as Record<string, unknown> | null;
    if (!result || result.ok !== true) {
        const reason = result && typeof result.reason === "string" ? result.reason : "unknown";
        console.error(`[MDJPRO] issue rejected | user=${uidShort} | reason=${reason}`);
        return { outcome: "error", reason };
    }

    const licenseId = String(result.license_id || "");
    const maskedKey = typeof result.masked_key === "string" ? result.masked_key : undefined;
    const last4FromMask = maskedKey && maskedKey.length >= 4 ? maskedKey.slice(-4) : undefined;

    console.log(
        `[MDJPRO] license issued | user=${uidShort} | license_id=${licenseId}` +
        (maskedKey ? ` | masked_key=${maskedKey}` : "") +
        (last4FromMask && !maskedKey ? ` | last4=${last4FromMask}` : ""),
    );

    return {
        outcome: "issued",
        licenseId,
        maskedKey,
        last4: last4FromMask,
    };
}

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
                const quoteSource = String(session.metadata?.source ?? "") === "quote";

                // ── Branch Q: Miami DJ Beat LLC quote deposit (additive; before generic lead) ──
                if (quoteSource) {
                    const amountPaid = (session.amount_total ?? 0) / 100;
                    const eboId = String(session.metadata?.ebo_id ?? "").trim();
                    const quoteId = String(session.metadata?.quote_id ?? "").trim();
                    const piRaw = session.payment_intent;
                    const piId = typeof piRaw === "string"
                        ? piRaw
                        : (piRaw && typeof piRaw === "object" && "id" in piRaw ? String((piRaw as { id: string }).id) : null);

                    if (eboId) {
                        const { data: ebo } = await supabase
                            .from("event_builder_orders")
                            .select("amount_paid_usd, deposit_usd, total_usd")
                            .eq("id", eboId)
                            .maybeSingle();
                        const prevEbo = parseFloat(String(ebo?.amount_paid_usd ?? 0));
                        const newEboPaid = prevEbo + amountPaid;
                        const eboTotal = parseFloat(String(ebo?.total_usd ?? 0));
                        const eboPayStatus = eboTotal > 0 && newEboPaid >= eboTotal ? "paid_full" : "deposit_paid";
                        await supabase.from("event_builder_orders").update({
                            amount_paid_usd: newEboPaid,
                            payment_status: eboPayStatus,
                            stripe_pi_id: piId,
                        }).eq("id", eboId);
                    }

                    if (leadId) {
                        const { data: lead } = await supabase
                            .from("leads")
                            .select("balance_paid, total_amount, staff_invoice_id")
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
                        if (lead?.staff_invoice_id && newStatus === "PAID") {
                            await supabase
                                .from("mdj_staff_manual_invoices")
                                .update({ status: "paid" })
                                .eq("id", lead.staff_invoice_id);
                        }
                    }

                    try {
                        await supabase.rpc("agent_action_log_write", {
                            p_actor: "stripe-webhook",
                            p_action: "quote_deposit_paid",
                            p_target: quoteId || eboId || "quote",
                            p_result: `ok:${eboId}:${amountPaid}`,
                            p_agent_id: "quote-checkout",
                        });
                    } catch (auditErr) {
                        console.error("[Webhook] quote audit:", auditErr);
                    }
                    console.log(`✅ Quote deposit paid: quote ${quoteId} | ebo ${eboId} | $${amountPaid}`);
                    break;
                }

                // ── Branch A: Event Deposit (client paying for event) ──
                if (leadId) {
                    const amountPaid = (session.amount_total ?? 0) / 100; // cents → dollars

                    // Fetch current lead to add paid amount
                    const { data: lead } = await supabase
                        .from("leads")
                        .select("balance_paid, total_amount, staff_invoice_id")
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

                    if (lead?.staff_invoice_id && newStatus === "PAID") {
                        await supabase
                            .from("mdj_staff_manual_invoices")
                            .update({ status: "paid" })
                            .eq("id", lead.staff_invoice_id);
                    }

                    console.log(`✅ Event deposit paid: lead ${leadId} | $${amountPaid} | status → ${newStatus}`);
                    break;
                }

                // ── SOUNDFORTIPS: card tip (Checkout) → DJ queue after payment ──
                if (session.metadata?.product === "soundfortips_tip" && session.metadata?.sft_request_id) {
                    const sftRid = String(session.metadata.sft_request_id).trim();
                    const piRaw = session.payment_intent;
                    const piId = typeof piRaw === "string" ? piRaw : (piRaw && typeof piRaw === "object" && "id" in piRaw ? String((piRaw as { id: string }).id) : null);
                    const { error: sftUpdErr } = await supabase
                        .from("soundfortips_fan_requests")
                        .update({
                            stripe_payment_intent_id: piId,
                            status: "paid_pending_acceptance",
                        })
                        .eq("id", sftRid)
                        .eq("status", "pending_payment");

                    if (sftUpdErr) {
                        console.error("[Webhook] soundfortips_fan_requests:", sftUpdErr.message);
                    } else {
                        console.log(`✅ SoundForTips card paid → paid_pending_acceptance DJ queue: ${sftRid}`);
                    }
                    break;
                }

                // ── Branch: DJ Professional Course (one-time, Stripe Checkout) ──
                if (session.metadata?.product === "miami_dj_course") {
                    const email =
                        (session.customer_details?.email as string | undefined) ||
                        (session.customer_email as string | undefined) ||
                        "unknown";
                    const { error: cpErr } = await supabase.from("course_purchases").insert({
                        stripe_session_id: session.id,
                        stripe_payment_intent: (session.payment_intent as string) ?? null,
                        customer_email: email,
                        amount_cents: session.amount_total ?? 0,
                        currency: session.currency ?? "usd",
                        product: "dj_professional_course",
                    });
                    if (cpErr) console.error("[Webhook] course_purchases:", cpErr.message);
                    else console.log(`✅ Course purchase: ${session.id} | ${email} | $${((session.amount_total ?? 0) / 100).toFixed(2)}`);
                    break;
                }

                // ── Branch B: MDJ Pro (artista) — metadata product_line; default legacy = artist
                const subId = session.subscription;
                const referrerId = (session.metadata?.referrer_id || "") as string;
                const referralCode = (session.metadata?.referral_code || "") as string;
                if (!userId || !subId) break;
                const productLine = (session.metadata?.product_line as string | undefined) || "mdj_artist_pro";

                // ── MDJPRO App standalone — does NOT grant MDJ Platform PRO ──
                if (productLine === "mdjpro_app") {
                    console.log(
                        `[Webhook] mdjpro_app checkout | user=${userId} | subId=${subId} — issuing MDJPRO license (plan_source=manual)`,
                    );
                    // SECURITY WALL: intentionally no dj_profiles.plan update here.
                    // App-only purchase does not grant MDJ Platform PRO Artist tier.
                    const licenseResult = await supabase.rpc("mdjpro_issue_license", {
                        p_uid: userId,
                        p_plan_source: "manual",
                    });
                    if (licenseResult.error) {
                        console.error(
                            `[Webhook] mdjpro_issue_license error | user=${userId}`,
                            licenseResult.error,
                        );
                    } else {
                        const lr = licenseResult.data as { ok?: boolean; reason?: string } | null;
                        if (lr?.ok === false) {
                            console.warn(
                                `[Webhook] mdjpro_issue_license not ok | user=${userId} | reason=${lr.reason}`,
                            );
                        } else {
                            console.log(
                                `[Webhook] mdjpro_issue_license success | user=${userId}`,
                            );
                        }
                    }
                    break;
                }

                if (productLine !== "mdj_artist_pro") {
                    console.log(
                        `[Webhook] checkout session subscription: unknown product_line=${productLine}, skip — implement separately`,
                    );
                    break;
                }

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

                const mdjproOutcome = await mdjproAutoIssueArtistProLicense(
                    supabase,
                    userId as string,
                    subId as string,
                );
                console.log(`[Webhook] mdjpro auto-issue: ${mdjproOutcome.outcome}`);

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

                const { data: paidProfile } = await supabase
                    .from("dj_profiles")
                    .select("user_id")
                    .eq("subscription_id", subId)
                    .maybeSingle();

                await supabase.from("dj_profiles").update({
                    subscription_status: "active",
                    next_renewal: periodEnd,
                }).eq("subscription_id", subId);

                if (paidProfile?.user_id) {
                    const restore = await supabase.rpc("mdjpro_apply_subscription_restored", {
                        p_uid: paidProfile.user_id,
                    });
                    console.log(`[MDJPRO] subscription restored | user=${String(paidProfile.user_id).slice(0, 8)} | ok=${restore.error ? "error" : "ok"}`);
                }
                break;
            }

            // ── Payment failed → pause MDJPRO (heartbeat blocks; leases kept until cancel) ──
            case "invoice.payment_failed": {
                const invoice = event.data.object;
                const subId = invoice.subscription;

                const { data: pastProfile } = await supabase
                    .from("dj_profiles")
                    .select("user_id")
                    .eq("subscription_id", subId)
                    .maybeSingle();

                await supabase.from("dj_profiles").update({
                    subscription_status: "past_due",
                }).eq("subscription_id", subId);

                if (pastProfile?.user_id) {
                    const lapse = await supabase.rpc("mdjpro_apply_subscription_lapse", {
                        p_uid: pastProfile.user_id,
                        p_mode: "pause",
                    });
                    console.log(`[MDJPRO] subscription paused | user=${String(pastProfile.user_id).slice(0, 8)} | ok=${lapse.error ? "error" : "ok"}`);
                }
                break;
            }

            // ── Subscription cancelled → downgrade to LITE + revoke MDJPRO device leases ──
            case "customer.subscription.deleted": {
                const sub = event.data.object;

                const { data: cancelledProfile } = await supabase
                    .from("dj_profiles")
                    .select("user_id")
                    .eq("subscription_id", sub.id)
                    .maybeSingle();

                await supabase.from("dj_profiles").update({
                    plan: "LITE",
                    subscription_status: "cancelled",
                    subscription_id: null,
                    next_renewal: null,
                }).eq("subscription_id", sub.id);

                if (cancelledProfile?.user_id) {
                    const lapse = await supabase.rpc("mdjpro_apply_subscription_lapse", {
                        p_uid: cancelledProfile.user_id,
                        p_mode: "revoke",
                    });
                    console.log(`[MDJPRO] subscription revoked | user=${String(cancelledProfile.user_id).slice(0, 8)} | ok=${lapse.error ? "error" : "ok"}`);
                }

                console.log(`⬇️ Downgraded to LITE: sub ${sub.id}`);
                break;
            }

            // ── Subscription updated (e.g., trial end, past_due recovery) ──────────
            case "customer.subscription.updated": {
                const sub = event.data.object;

                const { data: updatedProfile } = await supabase
                    .from("dj_profiles")
                    .select("user_id")
                    .eq("subscription_id", sub.id)
                    .maybeSingle();

                await supabase.from("dj_profiles").update({
                    subscription_status: sub.status,
                }).eq("subscription_id", sub.id);

                if (updatedProfile?.user_id) {
                    const st = String(sub.status || "").toLowerCase();
                    if (st === "active" || st === "trialing") {
                        await supabase.rpc("mdjpro_apply_subscription_restored", {
                            p_uid: updatedProfile.user_id,
                        });
                    } else if (st === "past_due" || st === "unpaid") {
                        await supabase.rpc("mdjpro_apply_subscription_lapse", {
                            p_uid: updatedProfile.user_id,
                            p_mode: "pause",
                        });
                    } else if (st === "canceled" || st === "cancelled" || st === "incomplete_expired") {
                        await supabase.rpc("mdjpro_apply_subscription_lapse", {
                            p_uid: updatedProfile.user_id,
                            p_mode: "revoke",
                        });
                    }
                }
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
