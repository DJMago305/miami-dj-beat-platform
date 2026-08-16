// Miami DJ Beat LLC — canonical service catalog for ELIXIS quotes.
// List prices overlay platform_settings.rentals_catalog_prices; this file is the fallback.
// Monetary math lives here and in event_quote_record. The LLM never supplies dollars.

export const TAX_RATE = 0.07;
export const DEPOSIT_RATE = 0.30;
export const EXTRA_HOUR_SKU = "dj_extra_hour";
export const EXTRA_HOUR_USD = 100;

export type QuoteBucket = "talent" | "equipment";
export type PriceSource = "catalog" | "fallback";

export type CatalogItem = {
    sku: string;
    name: string;
    unit_usd: number;
    bucket: QuoteBucket;
};

export type QuoteLineInput = {
    sku: string;
    qty?: number;
};

export type QuoteLine = {
    sku: string;
    name: string;
    qty: number;
    unit_usd: number;
    line_usd: number;
    bucket: QuoteBucket;
    price_source: PriceSource;
};

export type QuoteTotals = {
    subtotal_usd: number;
    tax_usd: number;
    deposit_usd: number;
    balance_usd: number;
    total_usd: number;
    tax_rate: number;
    deposit_rate: number;
};

export type EventTypeKey = "wedding" | "corporate" | "private" | "clubs" | "family" | "holiday";

export const EVENT_TYPE_DEFAULTS: Record<EventTypeKey, { sku: string; hours_base: number }> = {
    wedding: { sku: "dj_weddings", hours_base: 5 },
    corporate: { sku: "dj_weddings", hours_base: 5 },
    private: { sku: "dj_private", hours_base: 4 },
    clubs: { sku: "dj_clubs", hours_base: 4 },
    family: { sku: "dj_family", hours_base: 4 },
    holiday: { sku: "dj_holiday", hours_base: 5 },
};

export const CATALOG_FALLBACK: CatalogItem[] = [
    { sku: "dj_weddings", name: "Weddings & Corporate", unit_usd: 1500, bucket: "talent" },
    { sku: "dj_private", name: "Private Parties", unit_usd: 500, bucket: "talent" },
    { sku: "dj_clubs", name: "Clubs & Nightlife", unit_usd: 500, bucket: "talent" },
    { sku: "dj_family", name: "Family Events", unit_usd: 350, bucket: "talent" },
    { sku: "dj_seasonal_parties", name: "Seasonal Parties", unit_usd: 900, bucket: "talent" },
    { sku: "dj_holiday", name: "Holiday & Special Events", unit_usd: 1500, bucket: "talent" },
    { sku: EXTRA_HOUR_SKU, name: "Hora extra DJ", unit_usd: EXTRA_HOUR_USD, bucket: "talent" },
    { sku: "live_sax", name: "Live Saxophone", unit_usd: 400, bucket: "talent" },
    { sku: "live_percussion", name: "Live Percussion", unit_usd: 300, bucket: "talent" },
    { sku: "live_singer", name: "Live Singer", unit_usd: 500, bucket: "talent" },
    { sku: "mc_maestro", name: "Maestro de Ceremonias", unit_usd: 450, bucket: "talent" },
    { sku: "mc_host", name: "Club Host", unit_usd: 350, bucket: "talent" },
    { sku: "hl_robot", name: "Hora Loca Robot", unit_usd: 650, bucket: "talent" },
    { sku: "hl_brasil", name: "Hora Loca Brasil", unit_usd: 850, bucket: "talent" },
    { sku: "hl_cubana", name: "Hora Loca Cubana", unit_usd: 800, bucket: "talent" },
    { sku: "hl_character", name: "Hora Loca Character", unit_usd: 550, bucket: "talent" },
    { sku: "hl_hadas", name: "Hora Loca Hadas", unit_usd: 750, bucket: "talent" },
    { sku: "staff_bartender", name: "Bartender Pro", unit_usd: 250, bucket: "talent" },
    { sku: "staff_meseros", name: "Mesero / Waiter", unit_usd: 200, bucket: "talent" },
    { sku: "staff_chef", name: "Chef / Catering", unit_usd: 400, bucket: "talent" },
    { sku: "payaso_gif", name: "GIF / Energy", unit_usd: 250, bucket: "talent" },
    { sku: "payaso_show", name: "Clown Show", unit_usd: 350, bucket: "talent" },
    { sku: "payaso_circo", name: "Circus Acts", unit_usd: 450, bucket: "talent" },
    { sku: "payaso_santa", name: "Santa & Seasonal", unit_usd: 300, bucket: "talent" },
    { sku: "visuals_photo", name: "Photography", unit_usd: 350, bucket: "equipment" },
    { sku: "visuals_video", name: "Videography", unit_usd: 500, bucket: "equipment" },
    { sku: "visuals_drone", name: "Drone Coverage", unit_usd: 250, bucket: "equipment" },
    { sku: "visuals_booth360", name: "360 Photo Booth", unit_usd: 450, bucket: "equipment" },
    { sku: "visuals_magic_mirror", name: "Magic Mirror", unit_usd: 350, bucket: "equipment" },
    { sku: "fx_sparks", name: "Cold Sparks (x2)", unit_usd: 250, bucket: "equipment" },
    { sku: "fx_fog", name: "Fog Machine", unit_usd: 60, bucket: "equipment" },
    { sku: "fx_co2", name: "CO2 Jets (x2)", unit_usd: 300, bucket: "equipment" },
    { sku: "fx_confetti", name: "Confetti Cannon", unit_usd: 120, bucket: "equipment" },
    { sku: "moving_heads", name: "Moving Heads", unit_usd: 150, bucket: "equipment" },
    { sku: "led_video_small", name: "LED Wall (Small)", unit_usd: 500, bucket: "equipment" },
    { sku: "uplighting_pack", name: "Uplighting Pack", unit_usd: 200, bucket: "equipment" },
    { sku: "stage_small", name: "Small DJ Stage", unit_usd: 300, bucket: "equipment" },
    { sku: "stage_medium", name: "Medium Event Stage", unit_usd: 600, bucket: "equipment" },
    { sku: "stage_large", name: "Large Concert Stage", unit_usd: 1200, bucket: "equipment" },
    { sku: "truss_arch", name: "Goal Post Truss", unit_usd: 350, bucket: "equipment" },
    { sku: "truss_box_full", name: "Full Box Truss", unit_usd: 1800, bucket: "equipment" },
    { sku: "truss_ultra", name: "Ultra Truss System", unit_usd: 3500, bucket: "equipment" },
    { sku: "pa_small", name: "Small PA System", unit_usd: 150, bucket: "equipment" },
    { sku: "pa_medium", name: "Medium PA System", unit_usd: 350, bucket: "equipment" },
    { sku: "pa_large", name: "Large PA System", unit_usd: 750, bucket: "equipment" },
    { sku: "wireless_mic", name: "Wireless Mic", unit_usd: 65, bucket: "equipment" },
    { sku: "dj_monitor", name: "DJ Monitor", unit_usd: 95, bucket: "equipment" },
    { sku: "audio_mixer", name: "Audio Mixer", unit_usd: 120, bucket: "equipment" },
];

function money(n: number): number {
    return Math.round(n * 100) / 100;
}

export function parseCatalogOverlay(raw: unknown): Record<string, number> {
    let parsed: unknown = raw;
    if (typeof raw === "string") {
        try {
            parsed = JSON.parse(raw);
        } catch {
            return {};
        }
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        const sku = String(key || "").trim();
        const unit = typeof value === "number" ? value : Number(value);
        if (!sku || !Number.isFinite(unit) || unit < 0) continue;
        out[sku] = money(unit);
    }
    return out;
}

export function mergeCatalog(overlay: Record<string, number> = {}): CatalogItem[] {
    return CATALOG_FALLBACK.map((item) => {
        const over = overlay[item.sku];
        return {
            ...item,
            unit_usd: over != null ? money(over) : item.unit_usd,
        };
    });
}

export function catalogBySku(overlay: Record<string, number> = {}): Map<string, CatalogItem> {
    return new Map(mergeCatalog(overlay).map((item) => [item.sku, item]));
}

export function computeQuoteTotals(lines: Array<{ unit_usd: number; qty: number }>): QuoteTotals {
    let subtotal = 0;
    for (const line of lines) {
        subtotal += money((Number(line.unit_usd) || 0) * (Number(line.qty) || 0));
    }
    subtotal = money(subtotal);
    const tax = money(subtotal * TAX_RATE);
    const deposit = money(subtotal * DEPOSIT_RATE);
    const total = money(subtotal + tax);
    return {
        subtotal_usd: subtotal,
        tax_usd: tax,
        deposit_usd: deposit,
        balance_usd: money(subtotal - deposit),
        total_usd: total,
        tax_rate: TAX_RATE,
        deposit_rate: DEPOSIT_RATE,
    };
}

export function bucketSums(lines: QuoteLine[]): { talento_usd: number; equipo_usd: number } {
    let talento = 0;
    let equipo = 0;
    for (const line of lines) {
        if (line.bucket === "equipment") equipo += line.line_usd;
        else talento += line.line_usd;
    }
    return { talento_usd: money(talento), equipo_usd: money(equipo) };
}

function parseEventType(value: unknown): EventTypeKey | null {
    const raw = String(value ?? "").trim().toLowerCase();
    if (raw === "wedding" || raw === "corporate" || raw === "private" || raw === "clubs" || raw === "family" || raw === "holiday") {
        return raw;
    }
    return null;
}

export function resolveQuoteLines(input: {
    servicios?: unknown;
    tipo_evento?: unknown;
    horas?: unknown;
    overlay?: Record<string, number>;
}): { ok: true; lines: QuoteLine[]; tipo_evento: EventTypeKey | null; horas: number | null; horas_base: number | null; horas_extra: number }
    | { ok: false; error: string } {
    const overlay = input.overlay ?? {};
    const bySku = catalogBySku(overlay);
    const merged: QuoteLineInput[] = [];
    const seen = new Set<string>();

    const tipo = parseEventType(input.tipo_evento);
    let horas: number | null = null;
    if (input.horas != null && String(input.horas).trim() !== "") {
        const n = Number(input.horas);
        if (!Number.isFinite(n) || n < 1 || n > 16) return { ok: false, error: "horas_invalidas" };
        horas = money(n);
    }

    if (tipo) {
        const def = EVENT_TYPE_DEFAULTS[tipo];
        merged.push({ sku: def.sku, qty: 1 });
        seen.add(def.sku);
        if (horas != null && horas > def.hours_base) {
            merged.push({ sku: EXTRA_HOUR_SKU, qty: money(horas - def.hours_base) });
            seen.add(EXTRA_HOUR_SKU);
        }
    }

    const rawServicios = Array.isArray(input.servicios) ? input.servicios : [];
    if (rawServicios.length > 20) return { ok: false, error: "demasiados_servicios" };
    for (const row of rawServicios) {
        if (!row || typeof row !== "object") return { ok: false, error: "sku_invalido" };
        const sku = String((row as { sku?: unknown }).sku ?? "").trim();
        const qtyRaw = (row as { qty?: unknown }).qty;
        const qty = qtyRaw == null || String(qtyRaw).trim() === "" ? 1 : Number(qtyRaw);
        if (!sku || sku.length > 64) return { ok: false, error: "sku_invalido" };
        if (!Number.isFinite(qty) || qty <= 0 || qty > 99) return { ok: false, error: "qty_invalida" };
        if (seen.has(sku)) {
            const existing = merged.find((m) => m.sku === sku);
            if (existing) existing.qty = money((existing.qty ?? 1) + qty);
            continue;
        }
        seen.add(sku);
        merged.push({ sku, qty });
    }

    if (merged.length < 1) return { ok: false, error: "servicios_requeridos" };

    const lines: QuoteLine[] = [];
    for (const item of merged) {
        const cat = bySku.get(item.sku);
        if (!cat) return { ok: false, error: "sku_desconocido" };
        const qty = money(item.qty ?? 1);
        const unit = money(cat.unit_usd);
        lines.push({
            sku: cat.sku,
            name: cat.name,
            qty,
            unit_usd: unit,
            line_usd: money(unit * qty),
            bucket: cat.bucket,
            price_source: overlay[cat.sku] != null ? "catalog" : "fallback",
        });
    }

    const horasBase = tipo ? EVENT_TYPE_DEFAULTS[tipo].hours_base : null;
    const horasExtra = tipo && horas != null && horasBase != null ? Math.max(0, money(horas - horasBase)) : 0;
    return { ok: true, lines, tipo_evento: tipo, horas, horas_base: horasBase, horas_extra: horasExtra };
}
