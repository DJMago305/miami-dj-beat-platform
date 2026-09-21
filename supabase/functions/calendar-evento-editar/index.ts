// supabase/functions/calendar-evento-editar/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Edita un evento de elixis_agenda_eventos (título / fecha / hora) desde la
// palomita azul del calendario.
//
//  · Evento sincronizado de Google (agent_id = 'calendar-sync', tipo 'nota'):
//    el cambio se manda PRIMERO a Google (events.patch) y solo si Google lo
//    acepta se actualiza la copia local. Así Google sigue siendo la fuente de
//    verdad y un re-sync no pisa la edición. Si Google falla, NO se toca nada
//    local (las dos agendas nunca quedan distintas).
//  · Cumpleaños de contactos (tipo 'cumpleanos'): el calendario de Google es de
//    SOLO LECTURA (las fechas salen del contacto) -- se rechaza.
//  · Evento creado por ELIXIS u otro origen: solo se actualiza la fila local.
//
// Permiso (validado aquí, en el servidor): staff (owner/admin/manager/seller)
// edita cualquiera; el resto solo filas propias (user_id = auth.uid()).
//
// POST · Authorization: Bearer <jwt> · body:
//   { id, titulo?, fecha?: "YYYY-MM-DD", inicio_iso?, fin_iso? }
//   - eventos de todo el día: fecha (la duración se conserva)
//   - eventos con hora: inicio_iso + fin_iso

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL_FALLBACK = "https://hkuvuqupbxwkiykxvqdr.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
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


// Misma rutina que refrescarAccessToken de _shared/google-calendar-sync.ts (copiada para
// que esta función se despliegue sola, sin archivo compartido).
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
        if (!r.ok || !d.access_token) { console.error("[calendar-evento-editar] refresh_token fallo:", r.status); return null; }
        return String(d.access_token);
    } catch (e) { console.error("[calendar-evento-editar] refresh_token red:", e); return null; }
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const STAFF_ROLES = ["owner", "admin", "manager", "seller"];

function sumarDias(fecha: string, dias: number): string {
    const d = new Date(fecha + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().slice(0, 10);
}
function diasEntre(a: string, b: string): number {
    return Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86400000);
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

    let p: { id?: string; titulo?: string; fecha?: string; inicio_iso?: string; fin_iso?: string };
    try { p = await req.json(); } catch { return json({ ok: false, error: "json_invalido" }, 400); }

    const id = String(p.id || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false, error: "id_invalido" }, 400);
    const titulo = p.titulo !== undefined ? String(p.titulo).trim() : undefined;
    if (titulo !== undefined && (titulo.length === 0 || titulo.length > 200)) return json({ ok: false, error: "titulo_invalido" }, 400);
    const fecha = p.fecha !== undefined ? String(p.fecha) : undefined;
    if (fecha !== undefined && (!FECHA_RE.test(fecha) || isNaN(new Date(fecha + "T00:00:00Z").getTime()))) return json({ ok: false, error: "fecha_invalida" }, 400);
    const inicioIso = p.inicio_iso ? new Date(p.inicio_iso) : null;
    const finIso = p.fin_iso ? new Date(p.fin_iso) : null;
    if ((inicioIso && isNaN(inicioIso.getTime())) || (finIso && isNaN(finIso.getTime()))) return json({ ok: false, error: "hora_invalida" }, 400);
    if (inicioIso && finIso && finIso <= inicioIso) return json({ ok: false, error: "fin_antes_de_inicio" }, 400);
    if (titulo === undefined && fecha === undefined && !inicioIso) return json({ ok: false, error: "nada_que_cambiar" }, 400);

    const { data: fila, error: filaErr } = await ADMIN
        .from("elixis_agenda_eventos")
        .select("id,user_id,tipo,estado,agent_id,external_event_id,fecha_inicio,fecha_fin,notas")
        .eq("id", id).maybeSingle();
    if (filaErr || !fila) return json({ ok: false, error: "no_encontrado" }, 404);
    if (fila.estado !== "activo") return json({ ok: false, error: "evento_no_activo" }, 409);

    const { data: perfilStaff } = await ADMIN
        .from("dj_profiles").select("role").eq("user_id", user.id).maybeSingle();
    const esStaff = STAFF_ROLES.includes(String(perfilStaff?.role || "").toLowerCase());
    if (!esStaff && fila.user_id !== user.id) return json({ ok: false, error: "forbidden" }, 403);

    const esGoogle = fila.agent_id === "calendar-sync" && !!fila.external_event_id;
    let nuevoInicio: string | null = null;
    let nuevoFin: string | null = null;

    if (esGoogle) {
        if (fila.tipo === "cumpleanos") {
            return json({ ok: false, error: "cumpleanos_solo_lectura", detalle: "Los cumpleaños salen del contacto en Google; corrígelo en el contacto. Aquí solo se puede quitar de la agenda." }, 422);
        }
        const { data: integ } = await ADMIN
            .from("user_calendar_integrations")
            .select("refresh_token")
            .eq("user_id", fila.user_id).eq("provider", "google").eq("calendar_id", "primary").eq("status", "active")
            .maybeSingle();
        if (!integ?.refresh_token) return json({ ok: false, error: "google_no_conectado", detalle: "Esa cuenta ya no tiene Google Calendar conectado." }, 409);
        const token = await refrescarAccessToken(integ.refresh_token);
        if (!token) return json({ ok: false, error: "google_token", detalle: "No se pudo renovar el acceso a Google; reconecta Google Calendar." }, 502);

        const base = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(fila.external_event_id)}`;
        const gRes = await fetch(base, { headers: { Authorization: `Bearer ${token}` } });
        if (!gRes.ok) return json({ ok: false, error: "google_lectura", status: gRes.status }, 502);
        const gEv = await gRes.json();

        const cuerpo: Record<string, unknown> = {};
        if (titulo !== undefined) cuerpo.summary = titulo;

        if (gEv.start?.date) {
            // Evento de todo el día: se mueve por fecha y se conserva la duración.
            if (fecha !== undefined) {
                const dur = Math.max(1, diasEntre(gEv.start.date, gEv.end?.date || sumarDias(gEv.start.date, 1)));
                cuerpo.start = { date: fecha };
                cuerpo.end = { date: sumarDias(fecha, dur) };
                nuevoInicio = new Date(fecha + "T00:00:00Z").toISOString();
                nuevoFin = new Date(sumarDias(fecha, dur) + "T00:00:00Z").toISOString();
            }
        } else if (inicioIso) {
            const fin = finIso || new Date(inicioIso.getTime() + (new Date(fila.fecha_fin).getTime() - new Date(fila.fecha_inicio).getTime()));
            cuerpo.start = { dateTime: inicioIso.toISOString(), ...(gEv.start?.timeZone ? { timeZone: gEv.start.timeZone } : {}) };
            cuerpo.end = { dateTime: fin.toISOString(), ...(gEv.end?.timeZone ? { timeZone: gEv.end.timeZone } : {}) };
            nuevoInicio = inicioIso.toISOString();
            nuevoFin = fin.toISOString();
        }

        const pRes = await fetch(base + "?sendUpdates=none", {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(cuerpo),
        });
        if (!pRes.ok) {
            const txt = (await pRes.text()).slice(0, 300);
            console.error("[calendar-evento-editar] Google PATCH falló:", pRes.status, txt);
            return json({ ok: false, error: "google_rechazo", status: pRes.status, detalle: "Google no aceptó el cambio; no se modificó nada." }, 502);
        }
    } else {
        // Evento propio de Miami DJ Beat / ELIXIS: solo la fila local.
        if (inicioIso) {
            const fin = finIso || new Date(inicioIso.getTime() + (new Date(fila.fecha_fin).getTime() - new Date(fila.fecha_inicio).getTime()));
            nuevoInicio = inicioIso.toISOString();
            nuevoFin = fin.toISOString();
        } else if (fecha !== undefined) {
            const durMs = new Date(fila.fecha_fin).getTime() - new Date(fila.fecha_inicio).getTime();
            nuevoInicio = new Date(fecha + "T00:00:00Z").toISOString();
            nuevoFin = new Date(new Date(nuevoInicio).getTime() + (durMs > 0 ? durMs : 86400000)).toISOString();
        }
    }

    const cambios: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (titulo !== undefined) cambios.notas = titulo;
    if (nuevoInicio) { cambios.fecha_inicio = nuevoInicio; cambios.fecha_fin = nuevoFin; }
    const { error: upErr } = await ADMIN.from("elixis_agenda_eventos").update(cambios).eq("id", id);
    if (upErr) {
        console.error("[calendar-evento-editar] update local falló:", upErr.message);
        return json({ ok: false, error: "no_se_pudo_guardar_local", detalle: esGoogle ? "Google SÍ se actualizó; la copia local se corregirá en el próximo sync." : undefined }, 500);
    }
    return json({ ok: true, google: esGoogle, fecha_inicio: nuevoInicio, fecha_fin: nuevoFin }, 200);
});
