// supabase/functions/_shared/google-calendar-sync.ts
// ─────────────────────────────────────────────────────────────────────────────
// Lógica compartida de sincronización con Google Calendar, reusada por
// calendar-oauth-callback (conexión inicial + carga inicial), calendar-sync-
// webhook (notificaciones push) y calendar-channel-renew (renovación del
// canal cada ~7 días). Un solo lugar para el contrato con la API real de
// Google -- no se duplica en las 3 funciones.
//
// Calendarios que se conectan por usuario:
//   - "primary": el calendario principal del usuario.
//   - BIRTHDAYS_CALENDAR_ID: calendario especial de Google con cumpleaños/
//     aniversarios de sus contactos. Solo lectura del lado de Google (no se
//     puede crear eventos ahí), pero events.watch + events.list sí aplican.
// ─────────────────────────────────────────────────────────────────────────────

export const BIRTHDAYS_CALENDAR_ID = "addressbook#contacts@group.v.calendar.google.com";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export async function refrescarAccessToken(refreshToken: string): Promise<string | null> {
    const CLIENT_ID = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID") ?? "";
    const CLIENT_SECRET = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET") ?? "";
    if (!CLIENT_ID || !CLIENT_SECRET || !refreshToken) return null;
    try {
        const r = await fetch(GOOGLE_TOKEN_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: "refresh_token",
            }).toString(),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.access_token) {
            console.error("[google-calendar-sync] refresh_token fallo:", r.status, JSON.stringify(d).slice(0, 300));
            return null;
        }
        return String(d.access_token);
    } catch (e) {
        console.error("[google-calendar-sync] refresh_token red:", e);
        return null;
    }
}

// El refresh_token vive cifrado en Supabase Vault (user_calendar_integrations.
// google_refresh_token_secret_id); solo el service_role puede leerlo vía este RPC.
// deno-lint-ignore no-explicit-any
export async function leerRefreshToken(admin: any, secretId: string | null | undefined): Promise<string> {
    if (!secretId) return "";
    const { data, error } = await admin.rpc("calendar_google_leer_token", { p_secret_id: secretId });
    if (error) {
        console.error("[google-calendar-sync] no se pudo leer el token de Vault:", error.message);
        return "";
    }
    return typeof data === "string" ? data : "";
}

// Lee el refresh_token de Vault y lo canjea por un access_token vigente.
// deno-lint-ignore no-explicit-any
export async function accessTokenDesdeVault(admin: any, secretId: string | null | undefined): Promise<string | null> {
    return refrescarAccessToken(await leerRefreshToken(admin, secretId));
}

export type EventoGoogle = {
    id: string;
    status?: string;
    summary?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
};

export type ListarResultado =
    | { ok: true; eventos: EventoGoogle[]; nextSyncToken: string | null }
    | { ok: false; status: number };

/** events.list contra un calendario puntual (primary o cumpleaños). Sin
 *  syncToken trae todo lo futuro (carga inicial); con syncToken trae solo
 *  lo que cambió desde la última vez (igual que hace Google internamente).
 *
 *  singleEvents=true es OBLIGATORIO aquí: sin esto, un cumpleaños/aniversario
 *  recurrente (guardado como UN evento maestro con RRULE) llega con la fecha
 *  del PRIMER año que se creó -- nunca la próxima ocurrencia real, que es
 *  justo lo que se necesita para avisar. orderBy=startTime solo es válido
 *  SIN syncToken (Google lo rechaza combinado); singleEvents en cambio debe
 *  mandarse IGUAL en ambos casos, o Google invalida el syncToken (410). */
export async function listarEventosGoogle(
    accessToken: string,
    calendarId: string,
    syncToken?: string | null,
): Promise<ListarResultado> {
    const u = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
    u.searchParams.set("singleEvents", "true");
    if (syncToken) {
        u.searchParams.set("syncToken", syncToken);
    } else {
        // Ventana de 1 año hacia adelante en la carga inicial -- sin timeMax,
        // un cumpleaños recurrente expandido (singleEvents=true) devolvería
        // una ocurrencia por año hacia el futuro indefinidamente. No hay
        // manejo de nextPageToken todavía, así que se acota la ventana en vez
        // de arriesgar una respuesta gigante sin paginar.
        const ahora = new Date();
        const enUnAno = new Date(ahora);
        enUnAno.setFullYear(enUnAno.getFullYear() + 1);
        u.searchParams.set("timeMin", ahora.toISOString());
        u.searchParams.set("timeMax", enUnAno.toISOString());
        u.searchParams.set("orderBy", "startTime");
    }
    const r = await fetch(u.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!r.ok) return { ok: false, status: r.status };
    const d = await r.json();
    return { ok: true, eventos: Array.isArray(d.items) ? d.items : [], nextSyncToken: d.nextSyncToken ?? null };
}

export type CanalCreado = { channelId: string; resourceId: string; expiresAt: string | null } | null;

/** events.watch contra un calendario puntual. Devuelve null si falla --
 *  quien llama decide si eso bloquea o no (nunca revierte una conexión ya
 *  guardada, la conexión sigue "activa" aunque el canal falle). */
export async function crearCanalWatch(
    accessToken: string,
    calendarId: string,
    webhookUrl: string,
): Promise<CanalCreado> {
    try {
        const channelId = crypto.randomUUID();
        const r = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/watch`,
            {
                method: "POST",
                headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                body: JSON.stringify({ id: channelId, type: "web_hook", address: webhookUrl }),
            },
        );
        const body = await r.json().catch(() => ({}));
        if (!r.ok || !body.resourceId) {
            console.error(`[google-calendar-sync] events.watch fallo (${calendarId}):`, r.status, JSON.stringify(body).slice(0, 300));
            return null;
        }
        return {
            channelId,
            resourceId: String(body.resourceId),
            expiresAt: body.expiration ? new Date(Number(body.expiration)).toISOString() : null,
        };
    } catch (e) {
        console.error(`[google-calendar-sync] events.watch red (${calendarId}):`, e);
        return null;
    }
}

/** Cierre de buena fe de un canal viejo -- si falla no bloquea nada, solo
 *  evita basura del lado de Google. */
export async function cerrarCanalWatch(accessToken: string, channelId: string, resourceId: string): Promise<void> {
    try {
        await fetch("https://www.googleapis.com/calendar/v3/channels/stop", {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ id: channelId, resourceId }),
        });
    } catch (e) {
        console.warn("[google-calendar-sync] channels.stop fallo (no bloqueante):", e);
    }
}

// deno-lint-ignore no-explicit-any
type SupabaseAdmin = any;

/** Inserta/actualiza/cancela filas de elixis_agenda_eventos a partir de
 *  eventos reales de Google. `tipoDefault` clasifica según de qué CALENDARIO
 *  vinieron (cumpleaños vs. primary) -- misma tabla, misma taxonomía ya
 *  existente (residencia/boda/privado/cumpleanos/nota), reusada tal cual. */
export async function procesarEventosGoogle(
    ADMIN: SupabaseAdmin,
    userId: string,
    eventos: EventoGoogle[],
    tipoDefault: "cumpleanos" | "nota",
): Promise<void> {
    const { data: djProf } = await ADMIN
        .from("dj_profiles")
        .select("stage_name, dj_name, full_name")
        .eq("user_id", userId)
        .maybeSingle();
    let djNombre = String(djProf?.stage_name || djProf?.dj_name || djProf?.full_name || "").trim();
    if (!djNombre) {
        // calendar-oauth-init no distingue tipo de cuenta -- una cuenta
        // Cliente puede conectar Google Calendar con el mismo flujo que un
        // artista (2026-09-18, a pedido explícito del PO: "la lógica es la
        // misma"). Si no resolvió como DJ, se intenta como Cliente antes de
        // descartar el evento.
        const { data: clientProf } = await ADMIN
            .from("client_profiles")
            .select("full_name")
            .eq("user_id", userId)
            .maybeSingle();
        djNombre = String(clientProf?.full_name || "").trim();
    }
    if (!djNombre) {
        console.error(`[google-calendar-sync] sin dj_profiles/client_profiles.full_name para user_id=${userId}, se omiten inserciones nuevas`);
    }

    for (const ev of eventos) {
        if (!ev.id) continue;
        if (ev.status === "cancelled") {
            await ADMIN
                .from("elixis_agenda_eventos")
                .update({ estado: "cancelado", updated_at: new Date().toISOString() })
                .eq("external_event_id", ev.id)
                .eq("user_id", userId);
            continue;
        }
        const inicio = ev.start?.dateTime || ev.start?.date;
        const fin = ev.end?.dateTime || ev.end?.date;
        if (!inicio || !fin) continue;

        const { data: existente } = await ADMIN
            .from("elixis_agenda_eventos")
            .select("id")
            .eq("external_event_id", ev.id)
            .eq("user_id", userId)
            .maybeSingle();

        if (existente) {
            await ADMIN
                .from("elixis_agenda_eventos")
                .update({
                    fecha_inicio: new Date(inicio).toISOString(),
                    fecha_fin: new Date(fin).toISOString(),
                    notas: ev.summary || null,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", existente.id);
        } else if (djNombre) {
            await ADMIN.from("elixis_agenda_eventos").insert({
                user_id: userId,
                dj_nombre: djNombre,
                fecha_inicio: new Date(inicio).toISOString(),
                fecha_fin: new Date(fin).toISOString(),
                tipo: tipoDefault,
                estado: "activo",
                notas: ev.summary || null,
                agent_id: "calendar-sync",
                external_event_id: ev.id,
            });
        }
    }
}
