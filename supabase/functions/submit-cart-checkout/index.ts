// supabase/functions/submit-cart-checkout/index.ts
// Fase 4 (checkout público): aprueba automáticamente el total de un lead recién
// creado desde el carrito público de rentals.html — SOLO si cada línea tiene un
// sku real y activo en service_catalog. Nunca confía en el precio que manda el
// navegador (mdj_catalog_precios_vigentes ya es la fuente única de verdad, ver
// docs/plan-dinero-de-leads-dueno-servidor.md §3 B2 punto 4).
//
// Recibe { lead_id, cart_lines: [{ sku, quantity }] } con el token de SESIÓN del usuario
// (Authorization: Bearer <access_token>), no con la clave pública.
//   - Todas las líneas con precio fijo vigente → recalcula total = subtotal×1.07
//     (mismo TAX_RATE que create-event-payment/computePortalCartTotals) y aprueba
//     escribiendo total_amount = total_aprobado_usd (mismo patrón que usa el
//     servidor en INSERT dentro de leads_proteger_columnas_de_dinero — el cliente
//     nunca puede aprobar su propio total, ver Capa B1).
//   - Alguna línea sin sku de catálogo o sin precio fijo (Call para cotización,
//     paquete temático) → no se aprueba nada; el lead queda pendiente de revisión
//     de staff, igual que hoy con un total sin aprobar.
//
// Endurecida tras la auditoría del 2026-10-02 (docs/tickets/2026-10-02-URGENTE-submit-cart-checkout-sin-autenticacion.md):
//   1. Exige sesión: valida el JWT con auth.getUser y rechaza la clave pública.
//   2. Solo el dueño del lead (leads.client_user_id = usuario) puede aprobarlo; para cualquier
//      otro caso responde igual que si el lead no existiera (no revela ids ajenos).
//   3. Solo aprueba un lead sin total aprobado (monto 0 o NULL), sin pagos, sin estado de pago avanzado y
//      reciente (30 min): nunca sobrescribe un total aprobado ni pagado.
//   4. La escritura es atómica y condicional (IS NULL + dueño): si el lead cambió entre la
//      lectura y la escritura, no escribe y responde 409.
//   5. Topes: 100 líneas y 500 unidades por línea.
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEYS)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getServiceRoleKey } from "../_shared/service-key.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = getServiceRoleKey();
const TAX_RATE = 0.07; // igual que create-event-payment / computePortalCartTotals()
const MAX_LINES = 100;
const MAX_QTY_PER_LINE = 500;
const LEAD_FRESH_MS = 30 * 60 * 1000;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type LeadRow = {
    id: string;
    status: string | null;
    client_user_id: string | null;
    total_aprobado_usd: number | string | null;
    balance_paid: number | string | null;
    payment_status: string | null;
    created_at: string | null;
};
type Decision = { ok: true } | { ok: false; status: number; error: string };

function decidirAcceso(lead: LeadRow | null, userId: string, nowMs: number): Decision {
    if (!lead || !lead.client_user_id || lead.client_user_id !== userId) {
        return { ok: false, status: 404, error: "Lead no encontrado" };
    }
    const status = String(lead.status ?? "").toUpperCase();
    if (status === "CANCELLED" || status === "COMPLETED") {
        return { ok: false, status: 409, error: "El evento ya no acepta cambios" };
    }
    if (Number(lead.total_aprobado_usd ?? 0) > 0) {
        return { ok: false, status: 409, error: "El total de este evento ya fue aprobado" };
    }
    if (Number(lead.balance_paid ?? 0) > 0) {
        return { ok: false, status: 409, error: "Este evento ya tiene pagos registrados" };
    }
    const pago = String(lead.payment_status ?? "").toUpperCase();
    if (pago !== "UNPAID" && pago !== "PENDING") {
        return { ok: false, status: 409, error: "Este evento ya tiene un pago en curso" };
    }
    const creado = lead.created_at ? Date.parse(lead.created_at) : NaN;
    if (!Number.isFinite(creado) || nowMs - creado > LEAD_FRESH_MS) {
        return { ok: false, status: 409, error: "La solicitud expiró; nuestro equipo la revisará" };
    }
    return { ok: true };
}

function normalizarLineas(raw: unknown): { lines: Array<{ sku: string; quantity: number }>; error?: string } {
    const arr = Array.isArray(raw) ? raw : [];
    if (arr.length > MAX_LINES) return { lines: [], error: "Demasiadas líneas en el carrito" };
    const lines = arr
        .map((l: Record<string, unknown>) => ({
            sku: String(l?.sku ?? l?.catalog_sku ?? "").trim(),
            quantity: Math.min(MAX_QTY_PER_LINE, Math.max(1, parseInt(String(l?.quantity ?? "1"), 10) || 1)),
        }))
        .filter((l) => l.sku);
    return { lines };
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ ok: false, error: "Método no permitido" }, 405);

    try {
        const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
        if (!token) return json({ ok: false, error: "Sesión requerida" }, 401);
        const { data: authData, error: authErr } = await sb.auth.getUser(token);
        const user = authData?.user;
        if (authErr || !user) return json({ ok: false, error: "Sesión inválida" }, 401);

        const body = await req.json();
        const lead_id = String(body.lead_id ?? "").trim();
        if (!lead_id) return json({ ok: false, error: "lead_id requerido" }, 400);
        if (!Array.isArray(body.cart_lines) || !body.cart_lines.length) {
            return json({ ok: false, error: "cart_lines vacío" }, 400);
        }

        const norm = normalizarLineas(body.cart_lines);
        if (norm.error) return json({ ok: false, error: norm.error }, 400);
        const lines = norm.lines;

        const { data: lead, error: leadErr } = await sb
            .from("leads")
            .select("id, status, client_user_id, total_aprobado_usd, balance_paid, payment_status, created_at")
            .eq("id", lead_id)
            .maybeSingle();
        if (leadErr) return json({ ok: false, error: "No se pudo leer el evento" }, 500);

        const acceso = decidirAcceso((lead as LeadRow | null) ?? null, user.id, Date.now());
        if (!acceso.ok) return json({ ok: false, error: acceso.error }, acceso.status);

        if (!lines.length) {
            return json({ ok: true, approved: false, reason: "sin_sku_catalogo" });
        }

        const skus = Array.from(new Set(lines.map((l) => l.sku)));
        const { data: catalogRows, error: catErr } = await sb.rpc("mdj_catalog_precios_vigentes", { p_skus: skus });
        if (catErr) return json({ ok: false, error: "No se pudo consultar el catálogo" }, 500);

        const priceBySku = new Map<string, number | null>();
        for (const row of (catalogRows ?? []) as Array<{ sku: string; activo: boolean; precio_efectivo_usd: number | null }>) {
            priceBySku.set(row.sku, row.activo && row.precio_efectivo_usd != null ? Number(row.precio_efectivo_usd) : null);
        }

        let subtotalCents = 0;
        for (const line of lines) {
            const price = priceBySku.get(line.sku);
            if (price == null) {
                return json({ ok: true, approved: false, reason: "linea_sin_precio_fijo", sku: line.sku });
            }
            subtotalCents += Math.round(price * 100) * line.quantity;
        }

        const totalUsd = Math.round(subtotalCents * (1 + TAX_RATE)) / 100;
        if (totalUsd <= 0) return json({ ok: true, approved: false, reason: "total_vacio" });

        // Escritura atómica y condicional: solo si sigue siendo del usuario, sin total aprobado (un lead nuevo trae
        // 0 o NULL), sin pagos y con estado de pago UNPAID/PENDING; un pago que entre entre la lectura y esta
        // escritura también la frena. Una sola .or(): varias encadenadas tienen semántica ambigua en PostgREST.
        const { data: updated, error: updErr } = await sb
            .from("leads")
            .update({
                total_amount: totalUsd,
                total_aprobado_usd: totalUsd,
                total_aprobado_at: new Date().toISOString(),
            })
            .eq("id", lead_id)
            .eq("client_user_id", user.id)
            .or("total_aprobado_usd.is.null,total_aprobado_usd.eq.0")
            .eq("balance_paid", 0)
            .in("payment_status", ["UNPAID", "PENDING"])
            .select("id");

        if (updErr) {
            console.error("[submit-cart-checkout] update error:", updErr.message);
            return json({ ok: false, error: "No se pudo aprobar el total" }, 500);
        }
        if (!updated || updated.length === 0) {
            return json({ ok: false, error: "El total ya no se puede aprobar; nuestro equipo lo revisará" }, 409);
        }

        return json({ ok: true, approved: true, total_amount: totalUsd });
    } catch (e) {
        console.error("[submit-cart-checkout] error:", e);
        return json({ ok: false, error: "Error interno" }, 500);
    }
});

function json(obj: unknown, status = 200) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}
