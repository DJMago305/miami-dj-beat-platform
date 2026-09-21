// supabase/functions/calendar-caldav-connect/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Conecta Apple/iCloud Calendar vía CalDAV. A diferencia de Google
// (calendar-oauth-init/callback, un redirect de 2 pasos), esto es UN solo
// POST autenticado: el usuario ya está logueado en la app y pega su Apple ID
// + contraseña específica de aplicación directamente en un formulario de
// Miami DJ Beat (no hay redirect a Apple -- Apple no lo ofrece para CalDAV).
//
// POST · Authorization: Bearer <jwt del usuario> · body: { appleId, appSpecificPassword }
//
// La contraseña NUNCA se guarda en texto plano: se cifra con Supabase Vault
// vía los wrappers de supabase/scripts/20260920_calendar_caldav_vault_wrappers.sql
// (calendar_caldav_guardar_password), a diferencia del token de Google que
// hoy sí queda en texto plano en user_calendar_integrations (gap conocido,
// pendiente aparte -- no se corrige aquí de paso, eso sería tocar código
// ajeno al ticket).
//
// Solo backend: esta función NO tiene todavía un formulario real que la
// llame desde account-settings.html -- eso es el siguiente paso, no este.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
    descubrirPrincipal,
    descubrirCalendarHome,
    listarCalendarios,
    listarEventosCalDAV,
    procesarEventosApple,
} from "../_shared/apple-calendar-sync.ts";

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

// Formato real de Apple: 4 grupos de 4 letras minúsculas separados por
// guiones, ej. "abcd-efgh-ijkl-mnop". Se valida ANTES de gastar una llamada
// de red a Apple con algo que obviamente no es una contraseña de aplicación.
const APP_PASSWORD_RE = /^[a-z]{4}-[a-z]{4}-[a-z]{4}-[a-z]{4}$/i;

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

    let payload: { appleId?: string; appSpecificPassword?: string };
    try {
        payload = await req.json();
    } catch {
        return json({ ok: false, error: "json_invalido" }, 400);
    }

    const appleId = String(payload.appleId || "").trim().toLowerCase();
    const appSpecificPassword = String(payload.appSpecificPassword || "").trim();

    if (!appleId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(appleId)) {
        return json({ ok: false, error: "apple_id_invalido" }, 400);
    }
    if (!APP_PASSWORD_RE.test(appSpecificPassword)) {
        return json({
            ok: false,
            error: "formato_password_invalido",
            detalle: "Debe ser la contraseña específica de aplicación de Apple (formato xxxx-xxxx-xxxx-xxxx), generada en appleid.apple.com -- no tu contraseña normal de Apple ID.",
        }, 400);
    }

    const cred = { username: appleId, password: appSpecificPassword };

    // Paso 1: valida credenciales + descubre el host real del usuario.
    const principal = await descubrirPrincipal(cred);
    if (!principal.ok) {
        if (principal.error === "credenciales_invalidas") {
            return json({ ok: false, error: "credenciales_invalidas", detalle: "Apple rechazó el Apple ID o la contraseña de aplicación." }, 401);
        }
        console.error("[calendar-caldav-connect] descubrirPrincipal fallo:", principal.error, principal.status);
        return json({ ok: false, error: "apple_no_disponible", detalle: principal.error }, 502);
    }

    // Paso 2: calendar-home-set.
    const home = await descubrirCalendarHome(principal.hostBase, principal.principalHref, cred);
    if (!home.ok) {
        console.error("[calendar-caldav-connect] descubrirCalendarHome fallo:", home.error);
        return json({ ok: false, error: "apple_no_disponible", detalle: home.error }, 502);
    }

    // Paso 3: calendarios reales del usuario.
    const listado = await listarCalendarios(principal.hostBase, home.homeHref, cred);
    if (!listado.ok) {
        console.error("[calendar-caldav-connect] listarCalendarios fallo:", listado.error);
        return json({ ok: false, error: "apple_no_disponible", detalle: listado.error }, 502);
    }

    // Misma convención de 2 calendarios que Google: el primero que NO es de
    // cumpleaños se toma como "principal" (tipo nota); el de cumpleaños, si
    // existe, se conecta aparte (tipo cumpleanos). Selección de más de un
    // calendario "normal" a la vez queda para una versión futura con UI.
    const calCumpleanos = listado.calendarios.find((c) => c.esCumpleanos) || null;
    const calPrincipal = listado.calendarios.find((c) => !c.esCumpleanos) || listado.calendarios[0];

    // Guarda la contraseña UNA sola vez en Vault (reutilizada por ambas filas
    // de calendario -- es la misma cuenta de Apple).
    const { data: secretId, error: vaultErr } = await ADMIN.rpc("calendar_caldav_guardar_password", {
        p_password: appSpecificPassword,
        p_nombre: `caldav_${user.id}_${Date.now()}`,
    });
    if (vaultErr || !secretId) {
        console.error("[calendar-caldav-connect] Vault guardar_password fallo:", vaultErr?.message);
        return json({ ok: false, error: "no_se_pudo_guardar_credencial" }, 500);
    }

    const calendariosAConectar: { cal: typeof calPrincipal; tipo: "cumpleanos" | "nota" }[] = [
        { cal: calPrincipal, tipo: "nota" },
    ];
    if (calCumpleanos && calCumpleanos.href !== calPrincipal.href) {
        calendariosAConectar.push({ cal: calCumpleanos, tipo: "cumpleanos" });
    }

    const resultados: Record<string, unknown>[] = [];
    for (const { cal, tipo } of calendariosAConectar) {
        const { error: upsertErr } = await ADMIN
            .from("user_calendar_integrations")
            .upsert({
                user_id: user.id,
                provider: "apple",
                calendar_id: cal.href,
                caldav_username: appleId,
                caldav_password_secret_id: secretId,
                caldav_principal_url: principal.principalHref,
                caldav_calendar_url: cal.href,
                status: "active",
                last_synced_at: null,
                updated_at: new Date().toISOString(),
            }, { onConflict: "user_id,provider,calendar_id" });

        if (upsertErr) {
            console.error(`[calendar-caldav-connect] upsert fallo (${cal.href}):`, upsertErr.message);
            resultados.push({ calendario: cal.displayName, ok: false, error: upsertErr.message });
            continue;
        }

        // Carga inicial: mismo criterio de ventana que Google (1 año hacia
        // adelante desde ahora).
        const ahora = new Date();
        const enUnAno = new Date(ahora);
        enUnAno.setFullYear(enUnAno.getFullYear() + 1);

        const eventosRes = await listarEventosCalDAV(principal.hostBase, cal.href, cred, ahora, enUnAno);
        if (eventosRes.ok) {
            await procesarEventosApple(ADMIN, user.id, eventosRes.eventos, tipo);
            await ADMIN
                .from("user_calendar_integrations")
                .update({ last_synced_at: new Date().toISOString() })
                .eq("user_id", user.id)
                .eq("provider", "apple")
                .eq("calendar_id", cal.href);
            resultados.push({ calendario: cal.displayName, ok: true, eventos: eventosRes.eventos.length });
        } else {
            console.error(`[calendar-caldav-connect] carga inicial fallo (${cal.href}):`, eventosRes.error);
            resultados.push({ calendario: cal.displayName, ok: false, error: eventosRes.error });
        }
    }

    console.log(`[calendar-caldav-connect] conectado · user=${user.id} · calendarios=${calendariosAConectar.length}`);
    return json({ ok: true, calendarios: resultados }, 200);
});
