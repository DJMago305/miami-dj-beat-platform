// Registra un signup de lista de espera para el Modulo de Salas/QR/Taquilla
// (docs/ESTADO_MAESTRO.md ~linea 1321). Anonima a proposito: quien escanea el
// QR de una sala sin fecha confirmada no tiene cuenta -- mismo criterio de
// verify_jwt=false + rate-limit por IP que create-merch-checkout, sin usar
// una politica RLS de insert publico directo (mas facil de saturar con spam).
//
// Escribe en venue_waitlist_signups con el service-role -- esa tabla no tiene
// policy de insert publico a proposito (ver migracion 20260905120000).
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: corsHeaders });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    if (!checkRateLimit(ip)) {
        return new Response(JSON.stringify({ error: "demasiadas_solicitudes" }), { status: 429, headers: corsHeaders });
    }

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ error: "cuerpo_invalido" }), { status: 400, headers: corsHeaders });
    }

    const email = String(body?.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
        return new Response(JSON.stringify({ error: "email_invalido" }), { status: 400, headers: corsHeaders });
    }
    const name = body?.name ? String(body.name).trim().slice(0, 200) : null;
    const phone = body?.phone ? String(body.phone).trim().slice(0, 40) : null;
    const eventId = body?.event_id ? String(body.event_id) : null;
    const venueId = body?.venue_id ? String(body.venue_id) : null;
    const roomId = body?.room_id ? String(body.room_id) : null;

    if (!eventId && !venueId && !roomId) {
        return new Response(JSON.stringify({ error: "falta_referencia_event_venue_o_room" }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error } = await supabase.from("venue_waitlist_signups").insert({
        event_id: eventId,
        venue_id: venueId,
        room_id: roomId,
        name,
        email,
        phone,
    });

    if (error) {
        console.error("[venue-waitlist-signup] insert failed:", error);
        return new Response(JSON.stringify({ error: "no_se_pudo_registrar" }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
});
