// supabase/functions/calendar-push-important-date/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Paso 9 (sync bidireccional, Cliente): cuando el cliente guarda una fecha
// importante (cumpleaños/aniversario/otra -- columna client_profiles.important_dates,
// recurrente por mes/día, ver web/client-portal.js → portalCoiSaveImportantDate),
// esta función la empuja TAMBIÉN a su Google Calendar real, como evento de todo
// el día que se repite cada año (RRULE:FREQ=YEARLY), solo si tiene Google conectado.
//
// Paso 11 (2026-10-01): mismo flujo para Artista -- dj_profiles.important_dates
// (misma forma jsonb, agregada hoy en producción). La tabla se resuelve por
// user_id en vez de asumir client_profiles (resolverTabla, abajo): un usuario
// solo tiene fila en UNA de las dos (taxonomía de cuentas separadas), así que
// no hay ambigüedad.
//
// Dirección contraria a calendar-reconcile/calendar-sync-webhook (que son
// Google → nosotros) y sobre datos completamente distintos: no toca
// elixis_agenda_eventos para nada, escribe en el calendario PRIMARY del propio
// usuario (nunca el de cumpleaños de contactos de Google, que es de solo lectura).
// Por eso no hay riesgo de choque con la lógica de "huérfanas" de calendar-reconcile.
//
// Idempotente: si la fecha ya tiene google_event_id guardado, no la vuelve a crear.
// Si el usuario no tiene Google conectado, no es un error -- solo no hace nada
// (skipped: 'not_connected'). La fecha ya quedó guardada local de todas formas;
// esto es un plus, nunca bloquea el guardado principal.
//
// POST · Authorization: Bearer <jwt> (sesión real del cliente) · body: { entry_id }

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getServiceRoleKey } from "../_shared/service-key.ts";

const SUPABASE_URL_FALLBACK = "https://hkuvuqupbxwkiykxvqdr.supabase.co";
const SERVICE_ROLE_KEY = getServiceRoleKey() ?? "";
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || SUPABASE_URL_FALLBACK).replace(/\/$/, "");
const ADMIN = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const ALLOWED_ORIGINS = ["https://miamidjbeat.com", "https://www.miamidjbeat.com"];
const LOCALHOST = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function cors(req: Request): Record<string, string> {
    const origin = req.headers.get("origin") ?? "";
    const ok = ALLOWED_ORIGINS.includes(origin) || LOCALHOST.test(origin);
    return {
        "Access-Control-Allow-Origin": ok ? origin : ALLOWED_ORIGINS[0],
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Vary": "Origin",
    };
}

// Misma rutina que calendar-evento-editar (copiada a propósito -- mismo patrón ya
// usado en el repo para que esta función se despliegue sola, sin archivo compartido).
async function refrescarAccessToken(refreshToken: string): Promise<string | null> {
    const CLIENT_ID = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID") ?? "";
    const CLIENT_SECRET = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET") ?? "";
    if (!CLIENT_ID || !CLIENT_SECRET || !refreshToken) return null;
    try {
        const r = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refreshToken, grant_type: "refresh_token" }).toString(),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.access_token) { console.error("[calendar-push-important-date] refresh_token fallo:", r.status); return null; }
        return String(d.access_token);
    } catch (e) { console.error("[calendar-push-important-date] refresh_token red:", e); return null; }
}

// deno-lint-ignore no-explicit-any
async function refrescarDesdeVault(admin: any, secretId: string | null | undefined): Promise<string | null> {
    if (!secretId) return null;
    const { data, error } = await admin.rpc("calendar_google_leer_token", { p_secret_id: secretId });
    if (error || typeof data !== "string" || !data) { console.error("[calendar-push-important-date] no se pudo leer el token de Vault:", error?.message); return null; }
    return refrescarAccessToken(data);
}

type FechaImportante = {
    id: string; name: string; date_type: string; month: number; day: number; year: number | null;
    created_at: string; google_event_id?: string;
};

// deno-lint-ignore no-explicit-any
async function resolverTabla(admin: any, userId: string): Promise<"client_profiles" | "dj_profiles" | null> {
    const c = await admin.from("client_profiles").select("user_id").eq("user_id", userId).maybeSingle();
    if (c.data) return "client_profiles";
    const d = await admin.from("dj_profiles").select("user_id").eq("user_id", userId).maybeSingle();
    if (d.data) return "dj_profiles";
    return null;
}

function tituloPara(e: FechaImportante): string {
    if (e.date_type === "birthday") return `🎂 ${e.name} — cumpleaños`;
    if (e.date_type === "anniversary") return `🎉 ${e.name} — aniversario`;
    return e.name;
}
function pad2(n: number): string { return String(n).padStart(2, "0"); }
function sumarUnDia(fechaISO: string): string {
    const d = new Date(fechaISO + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
}

serve(async (req: Request) => {
    const h = cors(req);
    const json = (b: unknown, s: number) =>
        new Response(JSON.stringify(b), { status: s, headers: { ...h, "Content-Type": "application/json" } });

    if (req.method === "OPTIONS") return new Response("ok", { headers: h });
    if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!jwt) return json({ ok: false, error: "missing_authorization" }, 401);
    const { data: { user }, error: authErr } = await ADMIN.auth.getUser(jwt);
    if (authErr || !user?.id) return json({ ok: false, error: "invalid_session" }, 401);

    let p: { entry_id?: string; accion?: string };
    try { p = await req.json(); } catch { return json({ ok: false, error: "json_invalido" }, 400); }
    const entryId = String(p.entry_id || "");
    if (!entryId) return json({ ok: false, error: "entry_id_requerido" }, 400);

    const tabla = await resolverTabla(ADMIN, user.id);
    if (!tabla) return json({ ok: false, error: "perfil_no_encontrado" }, 404);

    const { data: perfil, error: perfilErr } = await ADMIN
        .from(tabla).select("important_dates").eq("user_id", user.id).maybeSingle();
    if (perfilErr || !perfil) return json({ ok: false, error: "perfil_no_encontrado" }, 404);

    const lista: FechaImportante[] = Array.isArray(perfil.important_dates) ? perfil.important_dates.slice() : [];
    const idx = lista.findIndex((e) => e && e.id === entryId);

    // 2026-10-01: borrar una fecha importante. El array en sí lo borra el
    // propio frontend (RLS self-update, mismo patrón que guardar) -- esta
    // función SOLO se encarga de limpiar el evento del lado de Google, si es
    // que alguna vez se empujó. Idempotente: si la fila ya no existe o nunca
    // se empujó, no es un error.
    if (p.accion === "eliminar") {
        if (idx === -1) return json({ ok: true, already: true }, 200);
        const entradaBorrar = lista[idx];
        if (!entradaBorrar.google_event_id) return json({ ok: true, skipped: "nunca_se_empujo" }, 200);
        const { data: integBorrar } = await ADMIN
            .from("user_calendar_integrations").select("google_refresh_token_secret_id")
            .eq("user_id", user.id).eq("provider", "google").eq("calendar_id", "primary").eq("status", "active").maybeSingle();
        if (!integBorrar?.google_refresh_token_secret_id) return json({ ok: true, skipped: "not_connected" }, 200);
        const tokenBorrar = await refrescarDesdeVault(ADMIN, integBorrar.google_refresh_token_secret_id);
        if (!tokenBorrar) return json({ ok: false, error: "google_token" }, 502);
        const dRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(entradaBorrar.google_event_id)}?sendUpdates=none`, {
            method: "DELETE", headers: { Authorization: `Bearer ${tokenBorrar}` },
        });
        if (!dRes.ok && dRes.status !== 404 && dRes.status !== 410) {
            console.error("[calendar-push-important-date] Google DELETE falló:", dRes.status);
            return json({ ok: false, error: "google_rechazo", status: dRes.status }, 502);
        }
        return json({ ok: true }, 200);
    }

    if (idx === -1) return json({ ok: false, error: "fecha_no_encontrada" }, 404);
    const entrada = lista[idx];

    // 2026-10-01 (Paso 10): editar una fecha ya guardada. Si nunca se había
    // empujado a Google, se crea ahora (igual que el flujo normal de abajo);
    // si ya existe allá, se actualiza ESE mismo evento (PATCH) en vez de
    // crear uno nuevo y duplicarlo. Si Google ya no tiene el evento (lo borró
    // alguien desde su propio Google), se crea uno nuevo y se reemplaza el id
    // guardado -- nunca se deja a medias.
    if (p.accion === "editar" && entrada.google_event_id) {
        const { data: integEditar } = await ADMIN
            .from("user_calendar_integrations").select("google_refresh_token_secret_id")
            .eq("user_id", user.id).eq("provider", "google").eq("calendar_id", "primary").eq("status", "active").maybeSingle();
        if (!integEditar?.google_refresh_token_secret_id) return json({ ok: true, skipped: "not_connected" }, 200);
        const tokenEditar = await refrescarDesdeVault(ADMIN, integEditar.google_refresh_token_secret_id);
        if (!tokenEditar) return json({ ok: false, error: "google_token" }, 502);

        const anioE = entrada.year || new Date().getFullYear();
        const fechaInicioE = `${anioE}-${pad2(entrada.month)}-${pad2(entrada.day)}`;
        const cuerpoE = {
            summary: tituloPara(entrada),
            start: { date: fechaInicioE },
            end: { date: sumarUnDia(fechaInicioE) },
            recurrence: ["RRULE:FREQ=YEARLY"],
        };
        const pRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(entrada.google_event_id)}?sendUpdates=none`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${tokenEditar}`, "Content-Type": "application/json" },
            body: JSON.stringify(cuerpoE),
        });
        if (pRes.ok) return json({ ok: true, google_event_id: entrada.google_event_id }, 200);
        if (pRes.status !== 404 && pRes.status !== 410) {
            console.error("[calendar-push-important-date] Google PATCH falló:", pRes.status);
            return json({ ok: false, error: "google_rechazo", status: pRes.status }, 502);
        }
        // El evento ya no existe en Google (borrado por fuera) -- se crea de
        // nuevo más abajo, como si nunca se hubiera empujado.
        entrada.google_event_id = undefined;
    }

    if (entrada.google_event_id) return json({ ok: true, already: true, google_event_id: entrada.google_event_id }, 200);

    const { data: integ } = await ADMIN
        .from("user_calendar_integrations").select("google_refresh_token_secret_id")
        .eq("user_id", user.id).eq("provider", "google").eq("calendar_id", "primary").eq("status", "active").maybeSingle();
    if (!integ?.google_refresh_token_secret_id) return json({ ok: true, skipped: "not_connected" }, 200);

    const token = await refrescarDesdeVault(ADMIN, integ.google_refresh_token_secret_id);
    if (!token) return json({ ok: false, error: "google_token", detalle: "No se pudo renovar el acceso a Google." }, 502);

    const anio = entrada.year || new Date().getFullYear();
    const fechaInicio = `${anio}-${pad2(entrada.month)}-${pad2(entrada.day)}`;
    const cuerpo = {
        summary: tituloPara(entrada),
        start: { date: fechaInicio },
        end: { date: sumarUnDia(fechaInicio) },
        recurrence: ["RRULE:FREQ=YEARLY"],
    };

    const gRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
    });
    if (!gRes.ok) {
        const txt = (await gRes.text()).slice(0, 300);
        console.error("[calendar-push-important-date] Google POST falló:", gRes.status, txt);
        return json({ ok: false, error: "google_rechazo", status: gRes.status }, 502);
    }
    const gEv = await gRes.json();
    const googleEventId = String(gEv.id || "");

    lista[idx] = { ...entrada, google_event_id: googleEventId };
    const { error: upErr } = await ADMIN.from(tabla).update({ important_dates: lista }).eq("user_id", user.id);
    if (upErr) {
        console.error("[calendar-push-important-date] no se pudo guardar google_event_id local:", upErr.message);
        return json({ ok: true, google_event_id: googleEventId, aviso: "Se creó en Google pero no se pudo guardar el vínculo local; podría duplicarse en un reintento." }, 200);
    }
    return json({ ok: true, google_event_id: googleEventId }, 200);
});
