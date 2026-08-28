// Creates a Stripe Checkout Session for the Shopping Miami DJ Beat merch cart (one-time payment).
// Replaces the old Shopify permalink bridge (web/shop.html) — Plan A store retired 2026-08-27
// because it redirected to a frozen (HTTP 402) Shopify instance. See project memory
// "project_shop_plan_a_retired_native_shopping" for the full retirement decision.
//
// SECURITY: price is never trusted from the client cart (sessionStorage is user-writable).
// Every line is re-priced here against CATALOG before it reaches Stripe.
//
// Env: STRIPE_SECRET_KEY_MERCH — its OWN key, deliberately NOT the shared STRIPE_SECRET_KEY
// used by create-checkout/create-course-checkout/create-event-payment/etc. Those process real
// subscriptions/deposits/tips; merch needed to be testable (sk_test_) without ever putting the
// rest of the platform's live payments into test mode. Set by the PO in Test mode 2026-08-28.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const PROD_ORIGINS = ["https://miamidjbeat.com", "https://www.miamidjbeat.com"];

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

function withSessionIdTemplate(successUrl: string): string {
    if (successUrl.includes("{CHECKOUT_SESSION_ID}")) return successUrl;
    const sep = successUrl.includes("?") ? "&" : "?";
    return `${successUrl}${sep}session_id={CHECKOUT_SESSION_ID}`;
}

/** Server-side source of truth for merch pricing — mirrors merchCatalog in web/shop.html.
 *  Keep in sync manually when products/prices change there; this copy is what actually
 *  gets charged, the client-side one is only for rendering the storefront. */
type Variant = { size: string; color: string; price: number };
type Product = { id: string; title: string; variants: Variant[] };

const CATALOG: Product[] = [
    {
        id: "miami-dj-beat-tee",
        title: "Miami DJ Beat Signature Tee",
        variants: [
            { size: "S", color: "Negro", price: 34.99 }, { size: "M", color: "Negro", price: 34.99 },
            { size: "L", color: "Negro", price: 34.99 }, { size: "XL", color: "Negro", price: 34.99 },
            { size: "S", color: "Rosa", price: 34.99 }, { size: "M", color: "Rosa", price: 34.99 },
            { size: "L", color: "Rosa", price: 34.99 }, { size: "XL", color: "Rosa", price: 34.99 },
            { size: "S", color: "Blanco", price: 34.99 }, { size: "M", color: "Blanco", price: 34.99 },
            { size: "L", color: "Blanco", price: 34.99 }, { size: "XL", color: "Blanco", price: 34.99 },
            { size: "S", color: "Dorado", price: 34.99 }, { size: "M", color: "Dorado", price: 34.99 },
            { size: "L", color: "Dorado", price: 34.99 }, { size: "XL", color: "Dorado", price: 34.99 },
        ],
    },
    {
        id: "cap-gold",
        title: "Miami DJ Beat Oficial - Gorra Snapback Emblema Dorado",
        variants: [
            { size: "Unitalla", color: "Negro", price: 34.99 },
            { size: "Unitalla", color: "Blanco", price: 34.99 },
            { size: "Unitalla", color: "Plateado", price: 34.99 },
            { size: "Unitalla", color: "Dorado", price: 34.99 },
        ],
    },
    {
        id: "hoodie-black",
        title: "Miami DJ Beat – Black Gold Hoodie",
        variants: [
            { size: "S", color: "Negro", price: 59.99 }, { size: "M", color: "Negro", price: 59.99 },
            { size: "L", color: "Negro", price: 59.99 }, { size: "XL", color: "Negro", price: 59.99 },
        ],
    },
    {
        id: "sudadera-gmc",
        title: "Miami DJ Beat - Camiseta Sudadera Mangas Largas",
        variants: [
            { size: "S", color: "Negro", price: 45.00 }, { size: "M", color: "Negro", price: 45.00 },
            { size: "L", color: "Negro", price: 45.00 }, { size: "XL", color: "Negro", price: 45.00 },
            { size: "S", color: "Blanco", price: 45.00 }, { size: "M", color: "Blanco", price: 45.00 },
            { size: "L", color: "Blanco", price: 45.00 }, { size: "XL", color: "Blanco", price: 45.00 },
            { size: "S", color: "Plateado", price: 45.00 }, { size: "M", color: "Plateado", price: 45.00 },
            { size: "L", color: "Plateado", price: 45.00 }, { size: "XL", color: "Plateado", price: 45.00 },
        ],
    },
    {
        id: "cap-v2",
        title: "Miami DJ Beat - Signature Cap (Mid Profile)",
        variants: [
            { size: "Unitalla", color: "Negro", price: 29.99 },
            { size: "Unitalla", color: "Blanco", price: 29.99 },
        ],
    },
];

const VIP_PROMO_CODES = new Set(["PRO", "PREMIUM", "VIP"]);
const MIAMI_DADE_TAX_RATE = 0.07;

function norm(v: unknown): string {
    return String(v ?? "").trim().toLowerCase();
}

function priceLine(productId: string, size: string, color: string): { title: string; price: number } | null {
    const product = CATALOG.find((p) => p.id === productId);
    if (!product) return null;
    const variant = product.variants.find(
        (v) => norm(v.size) === norm(size) && norm(v.color) === norm(color),
    );
    if (!variant) return null;
    return { title: `${product.title} (${color} / ${size})`, price: variant.price };
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
    if (!checkRateLimit(`merch_checkout:${clientIp}`)) {
        return new Response(
            JSON.stringify({ ok: false, error: "Too many requests. Try again in a minute." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } },
        );
    }

    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY_MERCH");
    const SITE_URL = (Deno.env.get("SITE_URL") || "https://miamidjbeat.com").replace(/\/$/, "");

    if (!STRIPE_SECRET_KEY) {
        return new Response(JSON.stringify({ ok: false, error: "Payment system not configured" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    let body: {
        items?: { productId?: string; size?: string; color?: string; quantity?: number }[];
        promo?: string;
        customer?: { name?: string; email?: string };
        success_url?: string;
        cancel_url?: string;
    } = {};
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
        return new Response(JSON.stringify({ ok: false, error: "Cart is empty" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
    if (items.length > 40) {
        return new Response(JSON.stringify({ ok: false, error: "Too many line items" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const checkoutParams: Record<string, string> = {
        mode: "payment",
        billing_address_collection: "required",
        "shipping_address_collection[allowed_countries][0]": "US",
        "metadata[product]": "miami_dj_beat_merch",
    };

    // Stripe's price_data does not accept a negative unit_amount, so a VIP promo
    // is applied per-line (discounted unit price) instead of a separate negative
    // "discount" line — the receipt shows each item already at its VIP price.
    const promoCode = norm(body.promo).toUpperCase();
    const promoApplied = VIP_PROMO_CODES.has(promoCode);

    let lineIndex = 0;
    let subtotal = 0;
    // Compact record of what was actually charged, carried in session metadata so the
    // webhook can write merch_orders on payment confirmation without a second Stripe
    // API call. Short keys (i/s/c/q/p) to stay well under Stripe's 500-char/value cap.
    const compactItems: { i: string; s: string; c: string; q: number; p: number }[] = [];

    for (const raw of items) {
        const productId = String(raw.productId || "");
        const size = String(raw.size || "");
        const color = String(raw.color || "");
        const quantity = Math.max(1, Math.min(20, Math.floor(Number(raw.quantity) || 1)));

        const priced = priceLine(productId, size, color);
        if (!priced) {
            return new Response(
                JSON.stringify({ ok: false, error: `Producto/variante no disponible: ${productId} (${color}/${size})` }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }

        const unitPrice = promoApplied ? priced.price * 0.85 : priced.price;
        subtotal += unitPrice * quantity;
        compactItems.push({ i: productId, s: size, c: color, q: quantity, p: Math.round(unitPrice * 100) });

        checkoutParams[`line_items[${lineIndex}][price_data][currency]`] = "usd";
        checkoutParams[`line_items[${lineIndex}][price_data][unit_amount]`] = String(Math.round(unitPrice * 100));
        checkoutParams[`line_items[${lineIndex}][price_data][product_data][name]`] =
            promoApplied ? `${priced.title} — VIP -15%` : priced.title;
        checkoutParams[`line_items[${lineIndex}][quantity]`] = String(quantity);
        lineIndex++;
    }

    const tax = subtotal * MIAMI_DADE_TAX_RATE;

    checkoutParams[`line_items[${lineIndex}][price_data][currency]`] = "usd";
    checkoutParams[`line_items[${lineIndex}][price_data][unit_amount]`] = String(Math.round(tax * 100));
    checkoutParams[`line_items[${lineIndex}][price_data][product_data][name]`] = "Impuesto (Miami-Dade 7%)";
    checkoutParams[`line_items[${lineIndex}][quantity]`] = "1";
    checkoutParams["metadata[tax_cents]"] = String(Math.round(tax * 100));
    checkoutParams["metadata[subtotal_cents]"] = String(Math.round(subtotal * 100));

    // Chunk compactItems JSON across metadata[merch_items_0..N] so no single value
    // exceeds Stripe's 500-character metadata limit.
    const itemsJson = JSON.stringify(compactItems);
    const CHUNK_SIZE = 450;
    const chunks: string[] = [];
    for (let pos = 0; pos < itemsJson.length; pos += CHUNK_SIZE) {
        chunks.push(itemsJson.slice(pos, pos + CHUNK_SIZE));
    }
    checkoutParams["metadata[merch_items_chunks]"] = String(chunks.length);
    chunks.forEach((chunk, idx) => {
        checkoutParams[`metadata[merch_items_${idx}]`] = chunk;
    });

    const origin = req.headers.get("Origin");
    let successUrl = (body.success_url || "").trim();
    let cancelUrl = (body.cancel_url || "").trim();
    if (!successUrl || !cancelUrl) {
        successUrl = `${SITE_URL}/shop.html?merch_payment=success`;
        cancelUrl = `${SITE_URL}/shop.html?merch_payment=cancelled`;
    }
    if (!isAllowedRedirectUrl(successUrl, origin) || !isAllowedRedirectUrl(cancelUrl, origin)) {
        return new Response(JSON.stringify({ ok: false, error: "Invalid redirect URLs" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
    checkoutParams.success_url = withSessionIdTemplate(successUrl);
    checkoutParams.cancel_url = cancelUrl;

    const email = String(body.customer?.email || "").trim();
    if (email) checkoutParams.customer_email = email;
    const name = String(body.customer?.name || "").trim();
    if (name) checkoutParams["metadata[customer_name]"] = name;

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
        console.error("[create-merch-checkout]", session.error);
        return new Response(JSON.stringify({ ok: false, error: session.error.message || "Stripe error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ ok: true, url: session.url, session_id: session.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
});
