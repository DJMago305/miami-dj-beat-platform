// supabase/functions/residency-schedule-manage/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Ticket "eliminar/reasignar residencias directo en el calendario" (PO
// 2026-09-17). residency_schedule_modificar() (SQL RPC) ya existe pero es
// EXECUTE solo service_role -- el navegador no puede llamarla directo. Esta
// función es el punto de entrada real desde
// web/calendario-operacional-inteligente.html: valida que quien llama es
// staff/owner con su JWT real, ejecuta la escritura con el cliente ADMIN, y
// deja huella en audit_log (mdj_auditar) de quién hizo qué -- exactamente lo
// que pidió el PO para poder investigar después.
//
// Acciones:
//   crear                → nueva regla de residencia (residency_schedule_modificar accion:'crear')
//   reasignar_dj_siempre → cambia el DJ de la regla completa, de ahora en
//                          adelante (residency_schedule_modificar accion:'actualizar')
//   reasignar_dj_una_vez → excepción puntual: SOLO esa fecha cambia de DJ,
//                          la regla no se toca (residency_schedule_exceptions,
//                          tabla nueva -- no existía forma de esto antes)
//   desactivar           → apaga la regla completa (soft-delete, igual que el
//                          resto de la app -- nunca DELETE real)
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";

const ADMIN = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
});

// ─── CORS (mismo patrón que elixis-realtime-session/index.ts) ────────────────
const ALLOWED_ORIGINS = [
    "https://miamidjbeat.com",
    "https://www.miamidjbeat.com",
    "https://miamidjbeat.vercel.app",
    "http://localhost:8080",
    "http://localhost:3000",
    "http://127.0.0.1:8080",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
];
const LOCALHOST_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
function corsHeaders(req: Request): Record<string, string> {
    const origin = req.headers.get("origin") ?? "";
    const isAllowed = ALLOWED_ORIGINS.includes(origin) || LOCALHOST_ORIGIN.test(origin);
    return {
        "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Vary": "Origin",
    };
}
function json(req: Request, body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
}

// ─── Staff gate (mismo patrón que elixis-realtime-session/index.ts) ──────────
const STAFF_ROLES = new Set(["owner", "admin", "manager", "seller"]);
type Gate =
    | { ok: true; userId: string; jwt: string; name: string }
    | { ok: false; status: number; error: string };

async function verifyStaff(req: Request): Promise<Gate> {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!jwt) return { ok: false, status: 401, error: "missing_authorization" };

    const { data: { user }, error } = await ADMIN.auth.getUser(jwt);
    if (error || !user?.id) return { ok: false, status: 401, error: "invalid_session" };

    const { data: prof } = await ADMIN
        .from("dj_profiles")
        .select("role,stage_name,dj_name,full_name")
        .eq("user_id", user.id)
        .maybeSingle();

    const role = String(prof?.role ?? "").toLowerCase().trim();
    if (!STAFF_ROLES.has(role)) return { ok: false, status: 403, error: "forbidden_not_staff" };

    const name = String(prof?.stage_name || prof?.dj_name || prof?.full_name || "").trim();
    return { ok: true, userId: user.id, jwt, name };
}

// mdj_auditar necesita auth.uid() real -- eso solo resuelve si el request
// corre CON el JWT del staff que llamó, no con el service_role (que no tiene
// usuario). Por eso un cliente aparte, solo para auditar.
function userClientFor(jwt: string) {
    return createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

async function auditar(jwt: string, accion: string, recursoId: string | null, detalle: string, antes?: unknown, despues?: unknown) {
    try {
        await userClientFor(jwt).rpc("mdj_auditar", {
            p_accion: accion,
            p_recurso_tabla: "residency_schedule",
            p_recurso_id: recursoId,
            p_antes: antes ?? null,
            p_despues: despues ?? null,
            p_origen: "web",
            p_resultado: "ok",
            p_detalle: detalle,
        });
    } catch (e) {
        // Auditar nunca debe tumbar la acción real -- si falla, se registra en
        // logs de la función pero la escritura de negocio ya se hizo.
        console.error("[residency-schedule-manage] mdj_auditar fallo (no bloqueante):", e);
    }
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
    if (req.method !== "POST") return json(req, { ok: false, error: "method_not_allowed" }, 405);

    const gate = await verifyStaff(req);
    if (!gate.ok) return json(req, { ok: false, error: gate.error }, gate.status);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").trim();

    // ── crear: nueva regla de residencia (permanente, o serie acotada si
    // trae fecha_inicio/fecha_fin -- ver 20260918150000_residency_schedule_
    // series_acotada.sql) ──
    if (action === "crear") {
        const { dia_semana, turno, venue, dj_nombre, hora_inicio, hora_fin, venue_pay_usd, dj_pay_usd, notas, fecha_inicio, fecha_fin, nombre_serie } = body;
        const { data, error } = await ADMIN.rpc("residency_schedule_modificar", {
            p_accion: "crear",
            p_dia_semana: dia_semana,
            p_turno: turno,
            p_venue: venue,
            p_dj_nombre: dj_nombre || "DJMago305",
            p_hora_inicio: hora_inicio,
            p_hora_fin: hora_fin,
            p_venue_pay_usd: venue_pay_usd ?? null,
            p_dj_pay_usd: dj_pay_usd ?? null,
            p_notas: notas ?? null,
            p_staff_user_id: gate.userId,
            p_fecha_inicio: fecha_inicio ?? null,
            p_fecha_fin: fecha_fin ?? null,
            p_nombre_serie: nombre_serie ?? null,
        });
        if (error) return json(req, { ok: false, error: "crear_failed", detail: error.message }, 400);
        const etiqueta = nombre_serie ? `serie "${nombre_serie}" (${fecha_inicio}→${fecha_fin})` : "residencia permanente";
        await auditar(gate.jwt, "residencia.creada", data as string, `${gate.name || gate.userId} creó ${etiqueta}: ${venue} (${turno}, día ${dia_semana})`, null, body);
        return json(req, { ok: true, id: data });
    }

    // ── desactivar: apaga la regla completa (soft-delete, nunca DELETE real) ──
    if (action === "desactivar") {
        const { dia_semana, turno, venue } = body;
        const { data, error } = await ADMIN.rpc("residency_schedule_modificar", {
            p_accion: "desactivar",
            p_dia_semana: dia_semana,
            p_turno: turno,
            p_venue: venue,
            p_staff_user_id: gate.userId,
        });
        if (error) return json(req, { ok: false, error: "desactivar_failed", detail: error.message }, 400);
        await auditar(gate.jwt, "residencia.desactivada", data as string, `${gate.name || gate.userId} desactivó residencia ${venue} (${turno}, día ${dia_semana})`);
        return json(req, { ok: true, id: data });
    }

    // ── reasignar_dj_siempre: cambia la regla completa de ahora en adelante ──
    if (action === "reasignar_dj_siempre") {
        const { dia_semana, turno, venue, dj_nombre } = body;
        if (!dj_nombre || !String(dj_nombre).trim()) {
            return json(req, { ok: false, error: "dj_nombre_requerido" }, 400);
        }
        const { data, error } = await ADMIN.rpc("residency_schedule_modificar", {
            p_accion: "actualizar",
            p_dia_semana: dia_semana,
            p_turno: turno,
            p_venue: venue,
            p_dj_nombre: dj_nombre,
            p_staff_user_id: gate.userId,
        });
        if (error) return json(req, { ok: false, error: "reasignar_failed", detail: error.message }, 400);
        await auditar(gate.jwt, "residencia.dj_reasignado_siempre", data as string,
            `${gate.name || gate.userId} reasignó el DJ de ${venue} (${turno}, día ${dia_semana}) a "${dj_nombre}" -- esta y todas las futuras`);
        return json(req, { ok: true, id: data });
    }

    // ── reasignar_dj_una_vez: excepción puntual, la regla NO se toca ──
    if (action === "reasignar_dj_una_vez") {
        const { residency_id, exception_date, dj_nombre, dj_id, notas } = body;
        if (!residency_id || !exception_date || !dj_nombre || !String(dj_nombre).trim()) {
            return json(req, { ok: false, error: "campos_requeridos" }, 400);
        }
        const { data, error } = await ADMIN
            .from("residency_schedule_exceptions")
            .upsert(
                {
                    residency_id,
                    exception_date,
                    dj_name: String(dj_nombre).trim(),
                    dj_id: dj_id || null,
                    notes: notas || null,
                    created_by: gate.userId,
                },
                { onConflict: "residency_id,exception_date" },
            )
            .select("id")
            .maybeSingle();
        if (error) return json(req, { ok: false, error: "excepcion_failed", detail: error.message }, 400);
        await auditar(gate.jwt, "residencia.dj_reasignado_una_vez", String(data?.id ?? residency_id),
            `${gate.name || gate.userId} reasignó el DJ de la residencia ${residency_id} SOLO para ${exception_date} a "${dj_nombre}"`, null, body);
        return json(req, { ok: true, id: data?.id });
    }

    // ── eliminar_una_vez: SOLO esa fecha desaparece del calendario, la regla sigue viva ──
    if (action === "eliminar_una_vez") {
        const { residency_id, exception_date, notas } = body;
        if (!residency_id || !exception_date) {
            return json(req, { ok: false, error: "campos_requeridos" }, 400);
        }
        const { data, error } = await ADMIN
            .from("residency_schedule_exceptions")
            .upsert(
                {
                    residency_id,
                    exception_date,
                    skip: true,
                    dj_name: null,
                    dj_id: null,
                    notes: notas || null,
                    created_by: gate.userId,
                },
                { onConflict: "residency_id,exception_date" },
            )
            .select("id")
            .maybeSingle();
        if (error) return json(req, { ok: false, error: "excepcion_failed", detail: error.message }, 400);
        await auditar(gate.jwt, "residencia.fecha_eliminada", String(data?.id ?? residency_id),
            `${gate.name || gate.userId} eliminó SOLO la fecha ${exception_date} de la residencia ${residency_id}`, null, body);
        return json(req, { ok: true, id: data?.id });
    }

    return json(req, { ok: false, error: "accion_desconocida" }, 400);
});
