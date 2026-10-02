// supabase/functions/submit-cart-checkout/index.ts
// Fase 4 (checkout público): aprueba automáticamente el total de un lead recién
// creado desde el carrito público de rentals.html — SOLO si cada línea tiene un
// sku real y activo en service_catalog. Nunca confía en el precio que manda el
// navegador (mdj_catalog_precios_vigentes ya es la fuente única de verdad, ver
// docs/plan-dinero-de-leads-dueno-servidor.md §3 B2 punto 4).
//
// Recibe { lead_id, cart_lines: [{ sku, quantity }] }.
//   - Todas las líneas con precio fijo vigente → recalcula total = subtotal×1.07
//     (mismo TAX_RATE que create-event-payment/computePortalCartTotals) y aprueba
//     escribiendo total_amount = total_aprobado_usd (mismo patrón que usa el
//     servidor en INSERT dentro de leads_proteger_columnas_de_dinero — el cliente
//     nunca puede aprobar su propio total, ver Capa B1).
//   - Alguna línea sin sku de catálogo o sin precio fijo (Call para cotización,
//     paquete temático) → no se aprueba nada; el lead queda pendiente de revisión
//     de staff, igual que hoy con un total sin aprobar.
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEYS)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getServiceRoleKey } from "../_shared/service-key.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = getServiceRoleKey();
const TAX_RATE = 0.07; // igual que create-event-payment / computePortalCartTotals()

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const body = await req.json();
        const lead_id = String(body.lead_id ?? "").trim();
        const cartLinesRaw = Array.isArray(body.cart_lines) ? body.cart_lines : [];

        if (!lead_id) return json({ ok: false, error: "lead_id requerido" }, 400);
        if (!cartLinesRaw.length) return json({ ok: false, error: "cart_lines vacío" }, 400);

        const { data: lead, error: leadErr } = await sb
            .from("leads")
            .select("id, status")
            .eq("id", lead_id)
            .single();
        if (leadErr || !lead) return json({ ok: false, error: "Lead no encontrado" }, 404);

        const leadStatus = String(lead.status ?? "").toUpperCase();
        if (leadStatus === "CANCELLED" || leadStatus === "COMPLETED") {
            return json({ ok: false, error: "El evento ya no acepta cambios" }, 409);
        }

        const lines = cartLinesRaw
            .map((l: Record<string, unknown>) => ({
                sku: String(l?.sku ?? l?.catalog_sku ?? "").trim(),
                quantity: Math.max(1, parseInt(String(l?.quantity ?? "1"), 10) || 1),
            }))
            .filter((l) => l.sku);

        if (!lines.length) {
            return json({ ok: true, approved: false, reason: "sin_sku_catalogo" });
        }

        const skus = Array.from(new Set(lines.map((l) => l.sku)));
        const { data: catalogRows, error: catErr } = await sb.rpc("mdj_catalog_precios_vigentes", { p_skus: skus });
        if (catErr) return json({ ok: false, error: `Catálogo: ${catErr.message}` }, 500);

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

        const { error: updErr } = await sb
            .from("leads")
            .update({
                total_amount: totalUsd,
                total_aprobado_usd: totalUsd,
                total_aprobado_at: new Date().toISOString(),
            })
            .eq("id", lead_id);

        if (updErr) return json({ ok: false, error: `No se pudo aprobar el total: ${updErr.message}` }, 500);

        return json({ ok: true, approved: true, total_amount: totalUsd });
    } catch (e) {
        return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
    }
});

function json(obj: unknown, status = 200) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}
