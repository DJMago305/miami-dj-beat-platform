import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS: production + any localhost for dev ──────────────────────────────────
const PROD_ORIGINS = ["https://miamidjbeat.com", "https://www.miamidjbeat.com"];

function getCorsHeaders(req: Request) {
    const origin = req.headers.get("Origin") || "";
    const isAllowed = PROD_ORIGINS.includes(origin) ||
        origin.startsWith("http://localhost") ||
        origin.startsWith("http://127.0.0.1");
    const allowed = isAllowed ? origin : PROD_ORIGINS[0];
    return {
        "Access-Control-Allow-Origin": allowed,
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Vary": "Origin",
    };
}

// ── In-memory rate limiter: 10 requests / 60s per user ───────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;

function checkRateLimit(key: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(key);
    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
        return true;  // allowed
    }
    if (entry.count >= RATE_LIMIT) return false;  // blocked
    entry.count++;
    return true;
}

// Cleanup old entries every 5 min to prevent memory leak in long-running isolates
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of rateLimitMap.entries()) {
        if (now > v.resetAt) rateLimitMap.delete(k);
    }
}, 300_000);

serve(async (req) => {
    const corsHeaders = getCorsHeaders(req);
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        // ── JWT validation: use service role + explicit getUser(jwt) ────────────
        const authHeader = req.headers.get("Authorization") ?? "";
        const jwt = authHeader.replace("Bearer ", "").trim();
        console.log("[DEBUG] Auth header present:", !!authHeader, "| JWT length:", jwt.length, "| JWT prefix:", jwt.slice(0, 15));

        if (!jwt) {
            console.log("[DEBUG] No JWT received");
            return new Response(JSON.stringify({ error: "No authorization token" }), { status: 401, headers: corsHeaders });
        }

        const adminAuth = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        const { data: { user }, error: authError } = await adminAuth.auth.getUser(jwt);
        console.log("[DEBUG] getUser result:", user ? "USER_OK uid=" + user.id.slice(0, 8) : "NULL", "error:", authError?.message ?? "none");
        if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized", detail: authError?.message }), { status: 401, headers: corsHeaders });

        // ── Rate limiting: 10 checkout attempts per user per minute ──────────
        if (!checkRateLimit(`checkout:${user.id}`)) {
            return new Response(
                JSON.stringify({ error: "Too many requests. Wait a minute and try again." }),
                { status: 429, headers: { ...corsHeaders, "Retry-After": "60" } }
            );
        }

        // Parse body early so it's available for audit log
        const body = req.headers.get("content-type")?.includes("application/json")
            ? await req.json()
            : {};

        // ── Audit: log checkout attempt ───────────────────────────────────────
        adminAuth.from("audit_log").insert({
            user_id: user.id,
            event: "checkout_attempt",
            metadata: { billing: body.billing, ref: body.ref },
            user_agent: req.headers.get("user-agent")?.substring(0, 200) ?? "",
            ip: req.headers.get("x-forwarded-for") ?? "",
        }).then(() => { }).catch(() => { }); // non-blocking, best-effort


        const billing = body.billing || "monthly"; // "monthly" | "annual"
        const referralCode = (body.ref || "").trim().toUpperCase();

        const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
        const STRIPE_PRICE_MONTHLY = Deno.env.get("STRIPE_PRICE_MONTHLY")!;
        const STRIPE_PRICE_ANNUAL = Deno.env.get("STRIPE_PRICE_ANNUAL")!;
        const SITE_URL = Deno.env.get("SITE_URL") || "http://localhost:3000";

        const priceId = billing === "annual" ? STRIPE_PRICE_ANNUAL : STRIPE_PRICE_MONTHLY;

        // ── Get or create Stripe Customer ─────────────────────
        const { data: profile } = await adminAuth
            .from("dj_profiles")
            .select("stripe_customer_id, full_name")
            .eq("user_id", user.id)
            .single();

        let customerId = profile?.stripe_customer_id;

        if (!customerId) {
            const customerRes = await fetch("https://api.stripe.com/v1/customers", {
                method: "POST",
                headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    email: user.email!,
                    name: profile?.full_name || user.email!,
                    "metadata[user_id]": user.id,
                }),
            });
            const customer = await customerRes.json();
            customerId = customer.id;
            await adminAuth.from("dj_profiles").update({ stripe_customer_id: customerId }).eq("user_id", user.id);
        }

        // ── Referral code validation ───────────────────────────
        let referrerId: string | null = null;
        let discountCouponId: string | null = null;

        if (referralCode) {
            const { data: referrer } = await adminAuth
                .from("dj_profiles")
                .select("user_id")
                .eq("referral_code", referralCode)
                .neq("user_id", user.id) // can't self-refer
                .single();

            if (referrer) {
                referrerId = referrer.user_id;
                // Create a one-time $20 Stripe coupon for this subscriber
                const couponRes = await fetch("https://api.stripe.com/v1/coupons", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
                    body: new URLSearchParams({
                        amount_off: "2000",   // $20.00 in cents
                        currency: "usd",
                        duration: "once",
                        name: `Referral: ${referralCode}`,
                        max_redemptions: "1",
                    }),
                });
                const coupon = await couponRes.json();
                discountCouponId = coupon.id;
            }
        }

        // ── Create Checkout Session ────────────────────────────
        const checkoutParams: Record<string, string> = {
            customer: customerId,
            mode: "subscription",
            "line_items[0][price]": priceId,
            "line_items[0][quantity]": "1",
            success_url: `${SITE_URL}/dj-dashboard.html?payment=success&ref=${referralCode}`,
            cancel_url: `${SITE_URL}/jobs.html?payment=cancelled`,
            "metadata[user_id]": user.id,
            "metadata[billing]": billing,
            "metadata[referral_code]": referralCode,
            "metadata[referrer_id]": referrerId || "",
            "subscription_data[metadata][user_id]": user.id,
            allow_promotion_codes: "true",
        };

        if (discountCouponId) {
            checkoutParams["discounts[0][coupon]"] = discountCouponId;
        }

        const checkoutRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
            method: "POST",
            headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams(checkoutParams),
        });

        const session = await checkoutRes.json();
        if (session.error) throw new Error(session.error.message);

        return new Response(JSON.stringify({ url: session.url }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
