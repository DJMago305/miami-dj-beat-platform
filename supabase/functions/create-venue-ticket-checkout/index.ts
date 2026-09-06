// Crea una Stripe Checkout Session para la compra de entradas de una sala
// (Modulo de Salas/QR/Taquilla, docs/ESTADO_MAESTRO.md ~1321). Mismo patron
// que create-merch-checkout: 100% anonima, rate-limit por IP, y el precio se
// re-lee SIEMPRE de la base de datos -- nunca se confia en lo que manda el
// cliente (podria abrir las devtools y mandar cualquier numero).
//
// Env: STRIPE_SECRET_KEY_VENUE -- su PROPIA clave, deliberadamente separada
// de STRIPE_SECRET_KEY (create-checkout/create-event-payment/etc). Este es
// un flujo de cobro nuevo sin probar todavia; usar una clave de prueba propia
// evita meter el resto de los pagos reales de la plataforma en modo test,
// mismo criterio que ya se aplico a create-merch-checkout el 2026-08-28.
// Una vez validado en vivo por el PO, se puede apuntar a la clave compartida.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
            try { return u.origin === new URL(originHeader).origin; } catch { /* ignore */ }
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

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") {
        return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
            status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(`venue_ticket:${clientIp}`)) {
        return new Response(JSON.stringify({ ok: false, error: "demasiadas_solicitudes" }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
        });
    }

    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY_VENUE");
    const SITE_URL = (Deno.env.get("SITE_URL") || "https://miamidjbeat.com").replace(/\/$/, "");
    if (!STRIPE_SECRET_KEY) {
        return new Response(JSON.stringify({ ok: false, error: "pagos_no_configurados" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    let body: {
        event_id?: string;
        items?: { ticket_type_id?: string; quantity?: number }[];
        customer_email?: string;
        success_url?: string;
        cancel_url?: string;
    } = {};
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ ok: false, error: "json_invalido" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const eventId = String(body.event_id || "");
    const items = Array.isArray(body.items) ? body.items : [];
    if (!eventId || items.length === 0) {
        return new Response(JSON.stringify({ ok: false, error: "carrito_vacio_o_sin_evento" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
    if (items.length > 20) {
        return new Response(JSON.stringify({ ok: false, error: "demasiadas_lineas" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Re-precio server-side: se leen los tipos de entrada REALES del evento,
    // nunca el precio que manda el cliente.
    const { data: realTypes, error: typesErr } = await supabase
        .from("venue_ticket_types")
        .select("id, label, zone_label, price_cents, quantity_available, quantity_sold, active")
        .eq("event_id", eventId)
        .eq("active", true);

    if (typesErr || !realTypes) {
        return new Response(JSON.stringify({ ok: false, error: "no_se_pudo_leer_tipos_de_entrada" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const checkoutParams: Record<string, string> = {
        mode: "payment",
        "metadata[product]": "venue_ticket",
        "metadata[event_id]": eventId,
    };

    let lineIndex = 0;
    let subtotalCents = 0;
    const compactItems: { id: string; label: string; qty: number; price_cents: number }[] = [];

    for (const raw of items) {
        const ticketTypeId = String(raw.ticket_type_id || "");
        const quantity = Math.max(1, Math.min(20, Math.floor(Number(raw.quantity) || 1)));
        const real = realTypes.find((t) => t.id === ticketTypeId);
        if (!real) {
            return new Response(JSON.stringify({ ok: false, error: `tipo_de_entrada_no_disponible:${ticketTypeId}` }), {
                status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
        if (real.quantity_available !== null) {
            const remaining = real.quantity_available - (real.quantity_sold || 0);
            if (quantity > remaining) {
                return new Response(JSON.stringify({ ok: false, error: `sin_disponibilidad:${real.label}` }), {
                    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
        }

        subtotalCents += real.price_cents * quantity;
        compactItems.push({ id: real.id, label: real.label, qty: quantity, price_cents: real.price_cents });

        checkoutParams[`line_items[${lineIndex}][price_data][currency]`] = "usd";
        checkoutParams[`line_items[${lineIndex}][price_data][unit_amount]`] = String(real.price_cents);
        checkoutParams[`line_items[${lineIndex}][price_data][product_data][name]`] =
            real.label + (real.zone_label ? ` · ${real.zone_label}` : "");
        checkoutParams[`line_items[${lineIndex}][quantity]`] = String(quantity);
        lineIndex++;
    }

    checkoutParams["metadata[subtotal_cents]"] = String(subtotalCents);
    const itemsJson = JSON.stringify(compactItems);
    const CHUNK_SIZE = 450;
    for (let pos = 0, idx = 0; pos < itemsJson.length; pos += CHUNK_SIZE, idx++) {
        checkoutParams[`metadata[ticket_items_${idx}]`] = itemsJson.slice(pos, pos + CHUNK_SIZE);
    }
    checkoutParams["metadata[ticket_items_chunks]"] = String(Math.max(1, Math.ceil(itemsJson.length / CHUNK_SIZE)));

    const origin = req.headers.get("Origin");
    let successUrl = (body.success_url || "").trim();
    let cancelUrl = (body.cancel_url || "").trim();
    if (!successUrl || !cancelUrl) {
        successUrl = `${SITE_URL}/venue-room.html?ticket_payment=success`;
        cancelUrl = `${SITE_URL}/venue-room.html?ticket_payment=cancelled`;
    }
    if (!isAllowedRedirectUrl(successUrl, origin) || !isAllowedRedirectUrl(cancelUrl, origin)) {
        return new Response(JSON.stringify({ ok: false, error: "urls_de_redireccion_invalidas" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
    checkoutParams.success_url = withSessionIdTemplate(successUrl);
    checkoutParams.cancel_url = cancelUrl;

    const email = String(body.customer_email || "").trim();
    if (email) checkoutParams.customer_email = email;

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
        console.error("[create-venue-ticket-checkout]", session.error);
        return new Response(JSON.stringify({ ok: false, error: session.error.message || "error_de_stripe" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ ok: true, url: session.url, session_id: session.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
});
