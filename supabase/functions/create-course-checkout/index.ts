// Creates a Stripe Checkout Session for the DJ Professional Course (one-time).
// Env: STRIPE_SECRET_KEY, optional COURSE_PRICE_CENTS (default 19700), SITE_URL (fallback redirects)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const PROD_ORIGINS = ["https://miamidjbeat.com", "https://www.miamidjbeat.com"];

/** Public checkout — same CORS model as create-event-payment (any origin can POST; redirects validated below). */
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 8;
const WINDOW_MS = 60_000;

function checkRateLimit(key: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(key);
    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
        return true;
    }
    if (entry.count >= RATE_LIMIT) return false;
    entry.count++;
    return true;
}

function isAllowedRedirectUrl(urlStr: string, originHeader: string | null): boolean {
    try {
        const u = new URL(urlStr);
        if (PROD_ORIGINS.includes(u.origin)) return true;
        if (u.origin.startsWith("http://localhost") || u.origin.startsWith("http://127.0.0.1")) return true;
        if (originHeader) {
            try {
                return u.origin === new URL(originHeader).origin;
            } catch {
                /* ignore */
            }
        }
        return false;
    } catch {
        return false;
    }
}

/** Stripe replaces {CHECKOUT_SESSION_ID} in success_url */
function withSessionIdTemplate(successUrl: string): string {
    if (successUrl.includes("{CHECKOUT_SESSION_ID}")) return successUrl;
    const sep = successUrl.includes("?") ? "&" : "?";
    return `${successUrl}${sep}session_id={CHECKOUT_SESSION_ID}`;
}

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") {
        return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const clientIp =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("cf-connecting-ip") ||
        "unknown";
    if (!checkRateLimit(`course_checkout:${clientIp}`)) {
        return new Response(
            JSON.stringify({ ok: false, error: "Too many requests. Try again in a minute." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } },
        );
    }

    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    const SITE_URL = (Deno.env.get("SITE_URL") || "https://miamidjbeat.com").replace(/\/$/, "");
    const COURSE_PRICE_CENTS = parseInt(Deno.env.get("COURSE_PRICE_CENTS") || "19700", 10);

    if (!STRIPE_SECRET_KEY) {
        return new Response(JSON.stringify({ ok: false, error: "Payment system not configured" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    let body: { success_url?: string; cancel_url?: string } = {};
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const origin = req.headers.get("Origin");
    let successUrl = (body.success_url || "").trim();
    let cancelUrl = (body.cancel_url || "").trim();

    if (!successUrl || !cancelUrl) {
        // Vercel serves this repo with Root Directory = web/, so public paths are /courses.html (no /web/ prefix).
        successUrl = `${SITE_URL}/courses.html?course_payment=success`;
        cancelUrl = `${SITE_URL}/courses.html?course_payment=cancelled`;
    }

    if (!isAllowedRedirectUrl(successUrl, origin) || !isAllowedRedirectUrl(cancelUrl, origin)) {
        return new Response(JSON.stringify({ ok: false, error: "Invalid redirect URLs" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const checkoutParams: Record<string, string> = {
        mode: "payment",
        billing_address_collection: "auto",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": String(COURSE_PRICE_CENTS),
        "line_items[0][price_data][product_data][name]": "MDJPRO — Curso DJ Profesional (acceso de por vida)",
        "line_items[0][price_data][product_data][description]": "Certificación Miami DJ Beat — 12 módulos",
        "line_items[0][quantity]": "1",
        success_url: withSessionIdTemplate(successUrl),
        cancel_url: cancelUrl,
        "metadata[product]": "miami_dj_course",
    };

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
        console.error("[create-course-checkout]", session.error);
        return new Response(JSON.stringify({ ok: false, error: session.error.message || "Stripe error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ ok: true, url: session.url, session_id: session.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
});
