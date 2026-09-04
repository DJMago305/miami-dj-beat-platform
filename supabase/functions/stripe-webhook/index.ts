import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*" };

type MdjproAutoIssueOutcome =
    | { outcome: "issued"; licenseId: string; maskedKey?: string; last4?: string }
    | { outcome: "already_exists"; licenseId: string; last4?: string }
    | { outcome: "skipped"; reason: string; licenseId?: string; planSource?: string; status?: string }
    | { outcome: "error"; reason: string };

/**
 * Resuelve a QUIÉN pertenece una suscripción de Stripe para los eventos de
 * morosidad.
 *
 * Existe por un agujero real: las ramas de impago buscan al usuario en
 * dj_profiles.subscription_id, y el comprador INDEPENDIENTE no tiene esa fila
 * — el SECURITY WALL del checkout mdjpro_app impide escribirla a propósito,
 * porque comprar la app no otorga Artist PRO. Consecuencia: un standalone que
 * dejaba de pagar conservaba el acceso para siempre.
 *
 * La licencia standalone sí guarda su stripe_subscription_id, así que ese es el
 * segundo sitio donde mirar. Primero dj_profiles (canal artista, el camino
 * habitual) y solo si no hay nada, la tabla de licencias.
 */
async function mdjproUsuarioDeSuscripcion(
    supabase: SupabaseClient,
    subId: string | null | undefined,
    uidPerfil: string | null | undefined,
): Promise<string | null> {
    if (uidPerfil) return uidPerfil;
    if (!subId) return null;
    const { data, error } = await supabase
        .from("mdjpro_license_keys")
        .select("user_id")
        .eq("stripe_subscription_id", subId)
        .maybeSingle();
    if (error) {
        console.error(`[MDJPRO] no se pudo resolver el dueño de ${subId}: ${error.message}`);
        return null;
    }
    return (data?.user_id as string | undefined) ?? null;
}

/**
 * Pieza 2 del diseño de calendario de cliente (docs/diseno-calendario-cliente-fase2.md):
 * cuando un lead pasa a CONFIRMED (pago completo), el reflejo en el calendario del
 * cliente ya es automático -- client-portal.js lee `leads` fresco en cada carga.
 * Lo que faltaba era la ALERTA. Reutiliza infraestructura existente en vez de crear
 * un canal nuevo: inserta en event_reminders_queue (registro auditable) y en
 * portal_messages con sender_role de staff, para que notify-portal-message dispare
 * el correo real al cliente solo.
 */
async function notifyClientBookingConfirmed(
    supabase: SupabaseClient,
    leadId: string,
    clientUserId: string | null | undefined,
    eventType: string | null | undefined,
    eventDate: string | null | undefined,
): Promise<void> {
    if (!clientUserId) return;

    try {
        await supabase.from("event_reminders_queue").insert({
            client_user_id: clientUserId,
            event_id: leadId,
            reminder_type: "booking_confirmed",
            status: "sent",
            scheduled_for: new Date().toISOString(),
            sent_at: new Date().toISOString(),
        });
    } catch (qErr) {
        console.error("[Webhook] event_reminders_queue insert failed:", qErr);
    }

    try {
        const { data: owner } = await supabase
            .from("dj_profiles")
            .select("user_id")
            .eq("role", "owner")
            .limit(1)
            .maybeSingle();
        const senderId = owner?.user_id as string | undefined;
        if (!senderId) return;
        const label = [eventType, eventDate].filter(Boolean).join(" · ");
        const body = `¡Tu evento quedó confirmado! 🎉 ${label ? label + " ya" : "Ya"} está en tu calendario del Portal — puedes verlo cuando quieras.`;
        await supabase.from("portal_messages").insert({
            lead_id: leadId,
            sender_id: senderId,
            sender_role: "owner",
            body,
            is_read: false,
        });
    } catch (mErr) {
        console.error("[Webhook] portal_messages booking_confirmed insert failed:", mErr);
    }
}

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
    // Separate test-mode endpoint for Shopping Miami DJ Beat (create-merch-checkout runs on
    // STRIPE_SECRET_KEY_MERCH, a sk_test_ key) — Stripe issues its own signing secret per
    // endpoint, so a test-mode checkout.session.completed never matches the live secret above.
    // Optional: absent in prod until the PO sets up the merch test webhook.
    const STRIPE_WEBHOOK_SECRET_MERCH = Deno.env.get("STRIPE_WEBHOOK_SECRET_MERCH") || "";
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

    const matchedLive = await verifyStripeSignature(body, signature || "", STRIPE_WEBHOOK_SECRET);
    const matchedMerch = !!STRIPE_WEBHOOK_SECRET_MERCH && (await verifyStripeSignature(body, signature || "", STRIPE_WEBHOOK_SECRET_MERCH));
    const isValid = matchedLive || matchedMerch;
    if (!isValid) {
        console.error(
            `[Webhook] Invalid signature | hasSigHeader=${!!signature} | merchSecretConfigured=${!!STRIPE_WEBHOOK_SECRET_MERCH} | merchSecretLen=${STRIPE_WEBHOOK_SECRET_MERCH.length}`,
        );
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
                            .select("balance_paid, total_amount, staff_invoice_id, client_user_id, event_type, event_date")
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
                        if (newStatus === "PAID") {
                            await notifyClientBookingConfirmed(supabase, leadId, lead?.client_user_id, lead?.event_type, lead?.event_date);
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
                        .select("balance_paid, total_amount, staff_invoice_id, client_user_id, event_type, event_date")
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

                    if (newStatus === "PAID") {
                        await notifyClientBookingConfirmed(supabase, leadId, lead?.client_user_id, lead?.event_type, lead?.event_date);
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

                // ── Branch: Shopping Miami DJ Beat (merch, one-time Stripe Checkout) ──
                // Escribe merch_orders SOLO aquí, con el pago ya confirmado — nunca antes.
                // El carrito viaja re-precificado en metadata[merch_items_N] (chunkeado por
                // el límite de 500 chars/valor de Stripe, ver create-merch-checkout) para no
                // necesitar otra llamada a la API de Stripe a buscar los line items.
                if (session.metadata?.product === "miami_dj_beat_merch") {
                    const chunkCount = parseInt(String(session.metadata?.merch_items_chunks || "0"), 10) || 0;
                    let itemsJson = "";
                    for (let idx = 0; idx < chunkCount; idx++) {
                        itemsJson += String(session.metadata?.[`merch_items_${idx}`] || "");
                    }
                    let items: unknown[] = [];
                    try {
                        items = itemsJson ? JSON.parse(itemsJson) : [];
                    } catch (e) {
                        console.error("[Webhook] merch_orders: no se pudo parsear merch_items metadata", e);
                    }

                    const shipping = (session as { shipping_details?: unknown }).shipping_details ?? null;
                    const { error: moErr } = await supabase.from("merch_orders").insert({
                        stripe_session_id: session.id,
                        stripe_payment_intent_id: (session.payment_intent as string) ?? null,
                        items,
                        subtotal_cents: parseInt(String(session.metadata?.subtotal_cents || "0"), 10) || 0,
                        tax_cents: parseInt(String(session.metadata?.tax_cents || "0"), 10) || 0,
                        total_cents: session.amount_total ?? 0,
                        currency: session.currency ?? "usd",
                        customer_name: (session.customer_details?.name as string | undefined) ?? null,
                        customer_email: (session.customer_details?.email as string | undefined) ?? null,
                        customer_phone: (session.customer_details?.phone as string | undefined) ?? null,
                        shipping_address: shipping,
                        status: "paid_pending_fulfillment",
                    });
                    if (moErr) {
                        console.error("[Webhook] merch_orders insert:", moErr.message);
                    } else {
                        console.log(`✅ Merch order paid: ${session.id} | $${((session.amount_total ?? 0) / 100).toFixed(2)}`);
                        // Aviso a staff — mismo Resend/env ya usado por notify-new-lead.
                        // Si el correo falla, el pedido ya quedó registrado igual (no bloquea).
                        try {
                            const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
                            const MANAGER_EMAIL = Deno.env.get("MANAGER_EMAIL") ?? "";
                            const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Miami DJ Beat <no-reply@miamidjbeat.com>";
                            if (RESEND_API_KEY && MANAGER_EMAIL) {
                                const amountStr = `$${((session.amount_total ?? 0) / 100).toFixed(2)}`;
                                const custName = (session.customer_details?.name as string | undefined) || "—";
                                const custEmail = (session.customer_details?.email as string | undefined) || "—";
                                const itemsSummary = (items as { i?: string; s?: string; c?: string; q?: number }[])
                                    .map((it) => `${it.q ?? 1}× ${it.i ?? "?"} (${it.c ?? "?"}/${it.s ?? "?"})`)
                                    .join("<br>");
                                await fetch("https://api.resend.com/emails", {
                                    method: "POST",
                                    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        from: FROM_EMAIL,
                                        to: [MANAGER_EMAIL],
                                        subject: `🛍️ Nuevo pedido Shopping Miami DJ Beat — ${amountStr}`,
                                        html: `<h2>Nuevo pedido pagado</h2>
<p><b>Cliente:</b> ${custName} (${custEmail})</p>
<p><b>Total:</b> ${amountStr}</p>
<p><b>Artículos:</b><br>${itemsSummary || "—"}</p>
<p><a href="https://miamidjbeat.com/staff.html?vista=merch-orders">Abrir pedidos pendientes →</a></p>`,
                                    }),
                                });
                            }
                        } catch (notifyErr) {
                            console.error("[Webhook] merch order notify email failed:", notifyErr);
                        }
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

                // ── Branch: Merch de la tienda (Checkout, create-merch-checkout) ──
                // merch_orders YA EXISTE (creada en una sesion anterior, junto con
                // create-merch-checkout) -- 2026-09-01: se encontro con una fila real
                // de una compra de prueba (2026-08-28) antes de tocar nada. Se usa el
                // esquema REAL de esa tabla (subtotal_cents/tax_cents/total_cents/
                // status con su propio DEFAULT), no uno inventado de cero.
                if (session.metadata?.product === "miami_dj_beat_merch") {
                    // create-merch-checkout parte el carrito en trozos de <=450
                    // caracteres (metadata[merch_items_N]) porque Stripe limita cada
                    // valor de metadata a 500 caracteres -- se reensamblan aqui.
                    const chunkCount = Number(session.metadata?.merch_items_chunks ?? 0);
                    let itemsJson = "";
                    for (let i = 0; i < chunkCount; i++) {
                        itemsJson += String(session.metadata?.[`merch_items_${i}`] ?? "");
                    }
                    let items: unknown = [];
                    try {
                        items = itemsJson ? JSON.parse(itemsJson) : [];
                    } catch (parseErr) {
                        console.error("[Webhook] merch_orders: items de metadata invalidos:", parseErr);
                    }

                    // shipping_details se movio a collected_information.shipping_details
                    // en la API "basil" de Stripe (2025-03-31) -- se revisan los dos
                    // nombres de campo porque esta funcion no fija Stripe-Version y no
                    // hay forma de saber cual usa la cuenta sin probarlo en vivo.
                    const shipping =
                        (session as { collected_information?: { shipping_details?: unknown } }).collected_information?.shipping_details
                        ?? (session as { shipping_details?: unknown }).shipping_details
                        ?? null;

                    const email =
                        (session.customer_details?.email as string | undefined) ||
                        (session.customer_email as string | undefined) ||
                        null;

                    const { error: merchErr } = await supabase.from("merch_orders").upsert({
                        stripe_session_id: session.id,
                        stripe_payment_intent_id: (session.payment_intent as string) ?? null,
                        customer_email: email,
                        customer_name: (session.metadata?.customer_name as string | undefined) || session.customer_details?.name || null,
                        customer_phone: session.customer_details?.phone || null,
                        shipping_address: shipping,
                        items,
                        subtotal_cents: Number(session.metadata?.subtotal_cents ?? 0),
                        tax_cents: Number(session.metadata?.tax_cents ?? 0),
                        total_cents: session.amount_total ?? 0,
                        currency: session.currency ?? "usd",
                        // status: SIN fijar -- se deja el DEFAULT real de la tabla
                        // ('paid_pending_fulfillment'), igual que la fila existente.
                    }, { onConflict: "stripe_session_id" });

                    if (merchErr) {
                        console.error("[Webhook] merch_orders:", merchErr.message);
                    } else {
                        console.log(`✅ Merch order: ${session.id} | ${email} | $${((session.amount_total ?? 0) / 100).toFixed(2)}`);
                    }
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
                    // ── CANAL 1 · RENTA INDEPENDIENTE ($19.99/mes) ───────────
                    // Antes emitía con plan_source="manual" como parche, y ESO
                    // NO FUNCIONABA: 'manual' no activa nada. Ni
                    // _mdjpro_standalone_active (exige 'mdjpro_standalone') ni
                    // _mdjpro_miamidjbeat_pro_active (exige plan PRO en
                    // dj_profiles, que aquí NO se toca a propósito). Resultado:
                    // effective_premium=false y la puerta marcaba la licencia
                    // SUSPENDIDA. El cliente pagaba y el Library Wizard seguía
                    // cerrado — recibía una clave que no servía.
                    //
                    // Ahora se emite con su plan_source real y se le entrega la
                    // suscripción de Stripe, que es lo que la función usa como
                    // prueba de pago (no puede usar effective_status: sería
                    // circular). Con eso quedan además ligados el kill-switch y
                    // la caducidad al periodo facturado.
                    const STRIPE_KEY_APP = Deno.env.get("STRIPE_SECRET_KEY")!;
                    let periodEndIso: string | null = null;
                    let customerId: string | null =
                        typeof session.customer === "string" ? session.customer : null;
                    try {
                        const r = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
                            headers: { Authorization: `Bearer ${STRIPE_KEY_APP}` },
                        });
                        const s = await r.json();
                        if (s?.current_period_end) {
                            periodEndIso = new Date(s.current_period_end * 1000).toISOString();
                        }
                        if (!customerId && typeof s?.customer === "string") customerId = s.customer;
                    } catch (e) {
                        // Si Stripe no responde, se emite igual: dejar sin licencia a
                        // quien ya pagó es peor que emitirla sin fecha de caducidad.
                        // El heartbeat y el kill-switch siguen gobernando el acceso.
                        console.error(`[Webhook] mdjpro_app: no se pudo leer la suscripción ${subId}`, e);
                    }

                    console.log(
                        `[Webhook] mdjpro_app checkout | user=${userId} | subId=${subId} — issuing MDJPRO license (plan_source=mdjpro_standalone)`,
                    );
                    // SECURITY WALL: intentionally no dj_profiles.plan update here.
                    // App-only purchase does not grant MDJ Platform PRO Artist tier.
                    const licenseResult = await supabase.rpc("mdjpro_issue_license", {
                        p_uid: userId,
                        p_plan_source: "mdjpro_standalone",
                        p_stripe_subscription_id: subId,
                        p_stripe_customer_id: customerId,
                        p_period_end: periodEndIso,
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

                const uidPagado = await mdjproUsuarioDeSuscripcion(supabase, subId, paidProfile?.user_id);
                if (uidPagado) {
                    const restore = await supabase.rpc("mdjpro_apply_subscription_restored", {
                        p_uid: uidPagado,
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

                const uidMoroso = await mdjproUsuarioDeSuscripcion(supabase, subId, pastProfile?.user_id);
                if (uidMoroso) {
                    const lapse = await supabase.rpc("mdjpro_apply_subscription_lapse", {
                        p_uid: uidMoroso,
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

                const uidCancelado = await mdjproUsuarioDeSuscripcion(supabase, sub.id, cancelledProfile?.user_id);
                if (uidCancelado) {
                    const lapse = await supabase.rpc("mdjpro_apply_subscription_lapse", {
                        p_uid: uidCancelado,
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

                /* Misma resolución que en las otras tres ramas: sin esto un
                   standalone cuyo estado cambie por 'subscription.updated'
                   —fin de prueba, recuperación de past_due— se quedaría fuera
                   del kill-switch y reabriría la fuga por otra puerta. */
                const uidActualizado = await mdjproUsuarioDeSuscripcion(supabase, sub.id, updatedProfile?.user_id);
                if (uidActualizado) {
                    const st = String(sub.status || "").toLowerCase();
                    if (st === "active" || st === "trialing") {
                        await supabase.rpc("mdjpro_apply_subscription_restored", {
                            p_uid: uidActualizado,
                        });
                    } else if (st === "past_due" || st === "unpaid") {
                        await supabase.rpc("mdjpro_apply_subscription_lapse", {
                            p_uid: uidActualizado,
                            p_mode: "pause",
                        });
                    } else if (st === "canceled" || st === "cancelled" || st === "incomplete_expired") {
                        await supabase.rpc("mdjpro_apply_subscription_lapse", {
                            p_uid: uidActualizado,
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
