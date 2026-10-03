// Crea una Stripe Checkout Session para COMPRAR MESAS de un evento de una sala (Sala de mesas, fase 2).
// *** PREPARADA, NO DESPLEGADA (2026-10-03). *** Depende del SQL supabase/scripts/20261003_sala_mesas_inventario_por_evento.sql
// (hay que aplicarlo primero) y de la rama «venue_table» del webhook (stripe-webhook/index.ts).
//
// Mismo patrón que create-venue-ticket-checkout: 100 % anónima, límite por IP, y el precio se lee SIEMPRE de la base
// (venue_event_tables.price_cents) — nunca de lo que mande el navegador.
//
// Regla del PO (2026-10-03): cada evento vende SUS mesas por separado (el inventario es por mesa Y evento).
// Regla de producto (PO, 2026-10-02): comprar es simple — elegir mesa, poner el nombre de QUIEN RENTA y pagar. Es lo único obligatorio;
// el nombre de la reserva («Team Alicia») es opcional y por defecto es el de quien renta.
//
// Anti-sobreventa: la reserva temporal la toma la función SQL venue_event_hold_tables (todo o nada, atómica), al pasar a pagar
// (igual que Ticketmaster: elegir mesas en el plano NO las reserva; el reloj arranca en «Comprar»). Si una mesa ya no está
// libre responde 409 «mesa_no_disponible» y NO se toma ninguna. La reserva dura 35 min y la sesión de Stripe vence a los ~31
// (Stripe no admite menos de 30), así una sesión pagada siempre encuentra su reserva viva; si la sesión vence o se cancela, el
// webhook libera las mesas (checkout.session.expired).
//
// Env: STRIPE_SECRET_KEY_VENUE — la MISMA clave separada que usa la taquilla (hoy de PRUEBA). Con dinero real no se activa sin la
// orden expresa del PO.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getServiceRoleKey } from "../_shared/service-key.ts";

const PROD_ORIGINS = ["https://miamidjbeat.com", "https://www.miamidjbeat.com"];

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 6;
const WINDOW_MS = 60_000;
const SESSION_SECONDS = 1900; // ~31 min (Stripe exige al menos 30); la reserva de la base dura 35 min
const HOLD_MINUTES = 35;       // reserva al pasar a pagar (como Ticketmaster: el reloj arranca en «Comprar», no al elegir la mesa)

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

/** Valida y normaliza el cuerpo. Devuelve el error en español o los datos limpios. Exportada para pruebas. */
export function validarCuerpo(body: Record<string, unknown>):
    | { error: string }
    | { eventId: string; keys: string[]; renterName: string; reservationName: string; email: string; holdToken: string | null } {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const eventId = String(body.event_id || "");
    if (!uuid.test(eventId)) return { error: "evento_invalido" };
    const rawKeys = Array.isArray(body.table_keys) ? body.table_keys : [];
    const keys = [...new Set(rawKeys.map((k) => String(k ?? "").trim()).filter((k) => k !== ""))];
    if (keys.length === 0) return { error: "sin_mesas" };
    if (keys.length > 12) return { error: "demasiadas_mesas" };
    if (keys.some((k) => k.length > 24 || /[,]/.test(k))) return { error: "mesa_invalida" };
    const renterName = String(body.renter_name || "").replace(/\s+/g, " ").trim();
    if (renterName.length < 2) return { error: "falta_nombre_de_quien_renta" };
    if (renterName.length > 80) return { error: "nombre_demasiado_largo" };
    const reservationName = String(body.reservation_name || "").replace(/\s+/g, " ").trim().slice(0, 80);
    const email = String(body.customer_email || "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "correo_invalido" };
    const holdToken = body.hold_token ? String(body.hold_token) : null;
    if (holdToken && !uuid.test(holdToken)) return { error: "token_invalido" };
    return { eventId, keys, renterName, reservationName, email, holdToken };
}

function json(status: number, obj: Record<string, unknown>, extra: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json", ...extra } });
}

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(`venue_table:${clientIp}`)) return json(429, { ok: false, error: "demasiadas_solicitudes" }, { "Retry-After": "60" });

    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY_VENUE");
    const SITE_URL = (Deno.env.get("SITE_URL") || "https://miamidjbeat.com").replace(/\/$/, "");
    if (!STRIPE_SECRET_KEY) return json(500, { ok: false, error: "pagos_no_configurados" });

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { return json(400, { ok: false, error: "json_invalido" }); }

    // Acción «release»: el cliente canceló el pago. Se expira la sesión de Stripe (así no se puede pagar DESPUÉS de soltar las mesas)
    // y se liberan las mesas en espera de ese token. El token es un secreto de quien hizo la reserva; si ya se pagó, las mesas están
    // vendidas y soltar no las toca (solo afecta las que siguen «en espera»).
    if (body.action === "release") {
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const token = String(body.hold_token || "");
        if (!uuidRe.test(token)) return json(400, { ok: false, error: "token_invalido" });
        const sid = String(body.session_id || "");
        if (/^cs_[A-Za-z0-9_]+$/.test(sid)) {
            try {
                const auth = { Authorization: `Bearer ${STRIPE_SECRET_KEY}` };
                const g = await (await fetch(`https://api.stripe.com/v1/checkout/sessions/${sid}`, { headers: auth })).json();
                if (g?.metadata?.hold_token === token && g?.status === "open") {
                    await fetch(`https://api.stripe.com/v1/checkout/sessions/${sid}/expire`, { method: "POST", headers: auth });
                }
            } catch (e) { console.error("[create-venue-table-checkout] expirar sesión:", e); }
        }
        const sb = createClient(Deno.env.get("SUPABASE_URL")!, getServiceRoleKey()!);
        const { data: liberadas, error: relErr } = await sb.rpc("venue_event_release_tables", { p_hold_token: token });
        if (relErr) { console.error("[create-venue-table-checkout] release:", relErr.message); return json(500, { ok: false, error: "no_se_pudo_liberar" }); }
        return json(200, { ok: true, released: liberadas ?? 0 });
    }

    const v = validarCuerpo(body);
    if ("error" in v) return json(400, { ok: false, error: v.error });

    const origin = req.headers.get("Origin");
    let successUrl = String(body.success_url || "").trim();
    let cancelUrl = String(body.cancel_url || "").trim();
    if (!successUrl || !cancelUrl) {
        successUrl = `${SITE_URL}/venue-room.html?table_payment=success`;
        cancelUrl = `${SITE_URL}/venue-room.html?table_payment=cancelled`;
    }
    if (!isAllowedRedirectUrl(successUrl, origin) || !isAllowedRedirectUrl(cancelUrl, origin)) {
        return json(400, { ok: false, error: "urls_de_redireccion_invalidas" });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, getServiceRoleKey()!);

    // 1) Reserva temporal, todo o nada, en la base (el precio total sale de aquí).
    const { data: hold, error: holdErr } = await supabase.rpc("venue_event_hold_tables", {
        p_event_id: v.eventId, p_keys: v.keys, p_hold_token: v.holdToken, p_minutes: HOLD_MINUTES, p_ip: clientIp === "unknown" ? null : clientIp,
    });
    if (holdErr || !hold || !hold[0]) {
        const msg = String(holdErr?.message || "");
        if (msg.includes("mesa_no_disponible")) return json(409, { ok: false, error: "mesa_no_disponible" });
        if (msg.includes("evento_sin_venta_de_mesas")) return json(409, { ok: false, error: "evento_sin_venta_de_mesas" });
        if (msg.includes("demasiados_apartados")) return json(429, { ok: false, error: "demasiados_apartados" });
        if (msg.includes("demasiadas_mesas") || msg.includes("sin_mesas")) return json(400, { ok: false, error: msg.includes("sin_mesas") ? "sin_mesas" : "demasiadas_mesas" });
        console.error("[create-venue-table-checkout] hold:", msg);
        return json(500, { ok: false, error: "no_se_pudo_reservar" });
    }
    const holdToken = String(hold[0].hold_token);
    const totalCents = Number(hold[0].total_cents);

    const soltar = async () => { await supabase.rpc("venue_event_release_tables", { p_hold_token: holdToken }); };

    // 2) Etiqueta y precio REALES de cada mesa reservada + datos del evento para el nombre del producto.
    const [{ data: rows, error: rowsErr }, { data: ev }] = await Promise.all([
        supabase.from("venue_event_tables").select("table_key, label, zone_name, price_cents")
            .eq("event_id", v.eventId).eq("hold_token", holdToken).eq("status", "held").order("table_key"),
        supabase.from("venue_events").select("title, event_date").eq("id", v.eventId).maybeSingle(),
    ]);
    if (rowsErr || !rows || rows.length !== v.keys.length) {
        await soltar();
        console.error("[create-venue-table-checkout] filas:", rowsErr?.message, rows?.length, v.keys.length);
        return json(500, { ok: false, error: "no_se_pudo_leer_las_mesas" });
    }
    const subtotal = rows.reduce((a: number, r: { price_cents: number }) => a + Number(r.price_cents), 0);
    if (subtotal !== totalCents || subtotal <= 0) {
        await soltar();
        return json(500, { ok: false, error: "total_inconsistente" });
    }

    // 3) Sesión de Stripe: una línea por mesa, precio de la base, vence a los ~31 min.
    const evTitle = String(ev?.title || "Evento");
    const params: Record<string, string> = {
        mode: "payment",
        expires_at: String(Math.floor(Date.now() / 1000) + SESSION_SECONDS),
        "metadata[product]": "venue_table",
        "metadata[event_id]": v.eventId,
        "metadata[hold_token]": holdToken,
        "metadata[renter_name]": v.renterName,
        "metadata[reservation_name]": v.reservationName || v.renterName,
        "metadata[table_keys]": v.keys.join(","),
        "metadata[subtotal_cents]": String(subtotal),
    };
    const compactItems: { id: string; label: string; qty: number; price_cents: number }[] = [];
    rows.forEach((r: { table_key: string; label: string; zone_name: string | null; price_cents: number }, i: number) => {
        const label = `Mesa ${r.label}` + (r.zone_name ? ` · ${r.zone_name}` : "");
        compactItems.push({ id: r.table_key, label, qty: 1, price_cents: Number(r.price_cents) });
        params[`line_items[${i}][price_data][currency]`] = "usd";
        params[`line_items[${i}][price_data][unit_amount]`] = String(r.price_cents);
        params[`line_items[${i}][price_data][product_data][name]`] = `${label} — ${evTitle}`;
        params[`line_items[${i}][quantity]`] = "1";
    });
    // Mismo esquema por trozos que las entradas (metadata de Stripe: 500 caracteres por valor), para que el webhook lo lea igual.
    const itemsJson = JSON.stringify(compactItems);
    const CHUNK_SIZE = 450;
    for (let pos = 0, idx = 0; pos < itemsJson.length; pos += CHUNK_SIZE, idx++) params[`metadata[ticket_items_${idx}]`] = itemsJson.slice(pos, pos + CHUNK_SIZE);
    params["metadata[ticket_items_chunks]"] = String(Math.max(1, Math.ceil(itemsJson.length / CHUNK_SIZE)));
    params.success_url = withSessionIdTemplate(successUrl);
    params.cancel_url = cancelUrl;
    if (v.email) params.customer_email = v.email;

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params).toString(),
    });
    const session = await stripeRes.json();
    if (session.error) {
        await soltar();   // si Stripe falla, las mesas vuelven a estar libres al instante
        console.error("[create-venue-table-checkout] stripe:", session.error);
        return json(500, { ok: false, error: session.error.message || "error_de_stripe" });
    }

    return json(200, { ok: true, url: session.url, session_id: session.id, hold_token: holdToken, held_until: hold[0].held_until });
});
