// supabase/functions/_shared/apple-calendar-sync.ts
// ─────────────────────────────────────────────────────────────────────────────
// Lógica compartida de sincronización con Apple/iCloud Calendar vía CalDAV
// (RFC 4791 + RFC 4918/WebDAV). Contraparte de google-calendar-sync.ts, pero
// el protocolo es completamente distinto: no hay OAuth, no hay JSON, no hay
// webhooks de Google. Todo es XML sobre HTTP con Basic Auth (Apple ID +
// contraseña específica de aplicación).
//
// Flujo de descubrimiento CalDAV (estándar, en 3 pasos):
//   1. PROPFIND a https://caldav.icloud.com/ → current-user-principal
//      (icloud.com casi siempre responde 301 a un host específico del
//      usuario, ej. https://p03-caldav.icloud.com/ -- se sigue A MANO,
//      nunca con redirect:'follow' de fetch, porque el comportamiento de
//      fetch al redirigir métodos no-GET/POST como PROPFIND no está
//      garantizado igual en todos los runtimes).
//   2. PROPFIND al principal → calendar-home-set.
//   3. PROPFIND (Depth:1) al home-set → lista de calendarios reales, cada
//      uno con su displayname y si soporta VEVENT.
//
// LIMITACIÓN CONOCIDA (documentada a propósito, no oculta): un evento con
// RRULE (recurrente) se trae con su fecha maestra original, no con cada
// ocurrencia futura expandida -- exactamente el mismo problema que tuvo
// Google antes de agregar singleEvents=true. Expandir RRULE del lado
// cliente es una mejora pendiente, no construida todavía. Para cumpleaños
// de un año a otro esto significa que puede faltar la próxima ocurrencia
// si el evento maestro ya venció -- a revisar antes de dar esto por
// completo en producción.
//
// Tampoco existe aquí un equivalente a calendar-sync-webhook: iCloud CalDAV
// no ofrece push notifications como Google. La resincronización periódica
// (poll) es trabajo pendiente aparte (candidato: extender el cron de
// calendar-channel-renew o crear uno nuevo) -- calendar-caldav-connect solo
// hace la conexión inicial + primera carga de eventos.

export type CalDAVCredenciales = { username: string; password: string };

export type CalendarioDescubierto = {
    href: string; // path relativo, ej. "/123456/calendars/home/"
    displayName: string;
    esCumpleanos: boolean;
};

export type EventoAppleCalendar = {
    uid: string;
    summary: string | null;
    dtstart: string | null; // ISO 8601
    dtend: string | null; // ISO 8601
    cancelado: boolean;
    tieneRecurrencia: boolean; // RRULE presente -- ver limitación arriba
};

function basicAuthHeader(cred: CalDAVCredenciales): string {
    return "Basic " + btoa(`${cred.username}:${cred.password}`);
}

/** Extrae el primer valor de texto de una etiqueta XML sin importar el
 *  prefijo de namespace (D:href, d:href, href a secas, etc. -- distintos
 *  servidores CalDAV usan prefijos distintos, y a veces ninguno). */
function extraerTexto(xml: string, tagLocal: string): string | null {
    const re = new RegExp(`<[^:>\\s/]*:?${tagLocal}[^>]*>([\\s\\S]*?)<\\/[^:>\\s/]*:?${tagLocal}>`, "i");
    const m = xml.match(re);
    return m ? m[1].trim() : null;
}

/** Como extraerTexto pero devuelve TODOS los bloques <response>...</response>
 *  de un multistatus -- cada uno es un recurso (calendario o evento). */
function extraerBloques(xml: string, tagLocal: string): string[] {
    const re = new RegExp(`<[^:>\\s/]*:?${tagLocal}[^>]*>([\\s\\S]*?)<\\/[^:>\\s/]*:?${tagLocal}>`, "gi");
    const out: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) out.push(m[1]);
    return out;
}

function unescapeXml(s: string): string {
    return s
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

async function propfind(
    url: string,
    cred: CalDAVCredenciales,
    body: string,
    depth: "0" | "1",
): Promise<{ ok: true; status: number; body: string; url: string } | { ok: false; status: number; url: string }> {
    let destino = url;
    for (let saltos = 0; saltos < 4; saltos++) {
        const r = await fetch(destino, {
            method: "PROPFIND",
            redirect: "manual",
            headers: {
                Authorization: basicAuthHeader(cred),
                "Content-Type": "application/xml; charset=utf-8",
                Depth: depth,
            },
            body,
        });
        if (r.status === 301 || r.status === 302 || r.status === 307 || r.status === 308) {
            const loc = r.headers.get("Location");
            if (!loc) return { ok: false, status: r.status, url: destino };
            // iCloud a veces redirige a un path relativo -- resolverlo contra
            // la URL actual, no asumir que siempre es absoluto.
            destino = new URL(loc, destino).toString();
            continue;
        }
        if (r.status === 207 || r.status === 200) {
            return { ok: true, status: r.status, body: await r.text(), url: destino };
        }
        return { ok: false, status: r.status, url: destino };
    }
    return { ok: false, status: 310, url: destino }; // demasiadas redirecciones
}

/** Paso 1: valida las credenciales Y descubre el host real + principal URL.
 *  Un 401 aquí significa credenciales inválidas (Apple ID o contraseña de
 *  aplicación incorrecta/revocada) -- se distingue de un error de red. */
export async function descubrirPrincipal(
    cred: CalDAVCredenciales,
): Promise<
    | { ok: true; hostBase: string; principalHref: string }
    | { ok: false; error: "credenciales_invalidas" | "respuesta_inesperada" | "red"; status?: number }
> {
    const body = `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:">
  <D:prop><D:current-user-principal/></D:prop>
</D:propfind>`;
    try {
        const primerIntento = await fetch("https://caldav.icloud.com/", {
            method: "PROPFIND",
            redirect: "manual",
            headers: { Authorization: basicAuthHeader(cred), "Content-Type": "application/xml; charset=utf-8", Depth: "0" },
            body,
        });
        if (primerIntento.status === 401) return { ok: false, error: "credenciales_invalidas" };

        const r = await propfind("https://caldav.icloud.com/", cred, body, "0");
        if (!r.ok) {
            if (r.status === 401) return { ok: false, error: "credenciales_invalidas" };
            return { ok: false, error: "red", status: r.status };
        }
        const principalHref = extraerTexto(r.body, "href");
        if (!principalHref) return { ok: false, error: "respuesta_inesperada" };
        const hostBase = new URL(r.url).origin;
        return { ok: true, hostBase, principalHref };
    } catch (e) {
        console.error("[apple-calendar-sync] descubrirPrincipal red:", e);
        return { ok: false, error: "red" };
    }
}

/** Paso 2: del principal, el calendar-home-set (dónde viven los calendarios). */
export async function descubrirCalendarHome(
    hostBase: string,
    principalHref: string,
    cred: CalDAVCredenciales,
): Promise<{ ok: true; homeHref: string } | { ok: false; error: string }> {
    const body = `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><C:calendar-home-set/></D:prop>
</D:propfind>`;
    const url = new URL(principalHref, hostBase).toString();
    const r = await propfind(url, cred, body, "0");
    if (!r.ok) return { ok: false, error: `propfind_home_fallo_${r.status}` };
    const homeBlock = extraerTexto(r.body, "calendar-home-set");
    if (!homeBlock) return { ok: false, error: "sin_calendar_home_set" };
    const homeHref = extraerTexto(homeBlock, "href");
    if (!homeHref) return { ok: false, error: "sin_href_en_home_set" };
    return { ok: true, homeHref };
}

/** Paso 3: lista los calendarios reales dentro del home-set y marca cuál
 *  parece ser el de cumpleaños (por nombre -- CalDAV no da un flag propio
 *  para esto, así que se infiere del displayname, igual de indirecto que
 *  hacerlo por color en otros clientes). */
export async function listarCalendarios(
    hostBase: string,
    homeHref: string,
    cred: CalDAVCredenciales,
): Promise<{ ok: true; calendarios: CalendarioDescubierto[] } | { ok: false; error: string }> {
    const body = `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:displayname/>
    <D:resourcetype/>
    <C:supported-calendar-component-set/>
  </D:prop>
</D:propfind>`;
    const url = new URL(homeHref, hostBase).toString();
    const r = await propfind(url, cred, body, "1");
    if (!r.ok) return { ok: false, error: `propfind_list_fallo_${r.status}` };

    const respuestas = extraerBloques(r.body, "response");
    const calendarios: CalendarioDescubierto[] = [];
    for (const bloque of respuestas) {
        const href = extraerTexto(bloque, "href");
        if (!href) continue;
        const resourceType = extraerTexto(bloque, "resourcetype") || "";
        const esColeccionCalendario = /calendar/i.test(resourceType);
        if (!esColeccionCalendario) continue;
        const compSet = extraerTexto(bloque, "supported-calendar-component-set") || "";
        const soportaVEVENT = /VEVENT/i.test(compSet) || compSet === ""; // algunos servidores omiten esta prop
        if (!soportaVEVENT) continue;
        const displayName = (extraerTexto(bloque, "displayname") || "").trim();
        const nombreNormalizado = displayName
            .toLowerCase()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, ""); // quita acentos: "cumpleaños" -> "cumpleanos"
        const esCumpleanos = nombreNormalizado.includes("birthday") || nombreNormalizado.includes("cumplea");
        calendarios.push({ href, displayName, esCumpleanos });
    }
    if (calendarios.length === 0) return { ok: false, error: "sin_calendarios" };
    return { ok: true, calendarios };
}

/** Parsea un bloque VEVENT de iCalendar (RFC 5545) a lo mínimo necesario.
 *  No es un parser completo -- solo extrae UID/SUMMARY/DTSTART/DTEND/STATUS/
 *  RRULE, que es todo lo que procesarEventosApple necesita. Desdobla líneas
 *  plegadas (folding: una línea que continúa en la siguiente empieza con
 *  espacio o tab, por RFC 5545 §3.1). */
function parseVEvent(bloqueIcs: string): EventoAppleCalendar | null {
    const desplegado = bloqueIcs.replace(/\r?\n[ \t]/g, "");
    const lineas = desplegado.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    let uid: string | null = null;
    let summary: string | null = null;
    let dtstart: string | null = null;
    let dtend: string | null = null;
    let status: string | null = null;
    let tieneRecurrencia = false;

    for (const linea of lineas) {
        const idx = linea.indexOf(":");
        if (idx === -1) continue;
        const clavePart = linea.slice(0, idx); // ej. "DTSTART;VALUE=DATE" o "DTSTART;TZID=America/New_York"
        const valor = linea.slice(idx + 1);
        const clave = clavePart.split(";")[0].toUpperCase();

        if (clave === "UID") uid = valor;
        else if (clave === "SUMMARY") summary = valor;
        else if (clave === "STATUS") status = valor.toUpperCase();
        else if (clave === "RRULE") tieneRecurrencia = true;
        else if (clave === "DTSTART") dtstart = parseIcsFecha(clavePart, valor);
        else if (clave === "DTEND") dtend = parseIcsFecha(clavePart, valor);
    }

    if (!uid) return null;
    return {
        uid,
        summary,
        dtstart,
        dtend,
        cancelado: status === "CANCELLED",
        tieneRecurrencia,
    };
}

/** DTSTART/DTEND en iCalendar vienen como "20260925" (VALUE=DATE, todo el
 *  día -- caso típico de cumpleaños) o "20260925T190000Z"/con TZID. Se
 *  normaliza a ISO 8601 en ambos casos; para VALUE=DATE se usa medianoche
 *  UTC igual que el resto de la plataforma trata los eventos de un día. */
function parseIcsFecha(clavePart: string, valor: string): string | null {
    const esFechaSola = /VALUE=DATE\b/i.test(clavePart) || /^\d{8}$/.test(valor);
    if (esFechaSola) {
        const y = valor.slice(0, 4), mo = valor.slice(4, 6), d = valor.slice(6, 8);
        return `${y}-${mo}-${d}T00:00:00.000Z`;
    }
    const m = valor.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
    if (!m) return null;
    const [, y, mo, d, h, mi, s, z] = m;
    // Sin Z, la fecha viene en la zona del TZID del calendario -- convertir
    // con precisión exigiría una tabla de zonas horarias completa. Se toma
    // como UTC (limitación conocida, igual de acotada que el resto del
    // parser -- documentada arriba, no oculta).
    return `${y}-${mo}-${d}T${h}:${mi}:${s}.000Z${z ? "" : ""}`;
}

/** REPORT calendar-query: trae los VEVENT de un calendario dentro de un
 *  rango de fechas. Apple evalúa el rango contra RRULE del lado servidor
 *  (por eso igual conviene mandar el filtro), pero el bloque VEVENT que
 *  regresa para un evento recurrente es el maestro -- ver limitación de
 *  RRULE arriba. */
export async function listarEventosCalDAV(
    hostBase: string,
    calendarioHref: string,
    cred: CalDAVCredenciales,
    rangoInicio: Date,
    rangoFin: Date,
): Promise<{ ok: true; eventos: EventoAppleCalendar[] } | { ok: false; error: string }> {
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const body = `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${fmt(rangoInicio)}" end="${fmt(rangoFin)}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;

    const url = new URL(calendarioHref, hostBase).toString();
    let r: Awaited<ReturnType<typeof fetch>>;
    try {
        r = await fetch(url, {
            method: "REPORT",
            headers: {
                Authorization: basicAuthHeader(cred),
                "Content-Type": "application/xml; charset=utf-8",
                Depth: "1",
            },
            body,
        });
    } catch (e) {
        console.error("[apple-calendar-sync] listarEventosCalDAV red:", e);
        return { ok: false, error: "red" };
    }
    if (!r.ok) return { ok: false, error: `report_fallo_${r.status}` };
    const xml = await r.text();

    const bloquesRespuesta = extraerBloques(xml, "response");
    const eventos: EventoAppleCalendar[] = [];
    for (const bloque of bloquesRespuesta) {
        const calData = extraerTexto(bloque, "calendar-data");
        if (!calData) continue;
        const ics = unescapeXml(calData);
        const vevents = extraerBloques(ics, "VEVENT").length
            ? ics.split(/BEGIN:VEVENT/i).slice(1).map((s) => s.split(/END:VEVENT/i)[0])
            : [];
        for (const veventTexto of vevents) {
            const ev = parseVEvent(veventTexto);
            if (ev) eventos.push(ev);
        }
    }
    return { ok: true, eventos };
}

// deno-lint-ignore no-explicit-any
type SupabaseAdmin = any;

/** Mismo patrón exacto que procesarEventosGoogle en google-calendar-sync.ts
 *  -- misma tabla (elixis_agenda_eventos), misma resolución de dj_nombre,
 *  mismo criterio de upsert por external_event_id. Se duplica el bloque de
 *  resolución de nombre en vez de compartir un helper, siguiendo el mismo
 *  patrón ya usado (un archivo autocontenido por proveedor). */
export async function procesarEventosApple(
    ADMIN: SupabaseAdmin,
    userId: string,
    eventos: EventoAppleCalendar[],
    tipoDefault: "cumpleanos" | "nota",
): Promise<void> {
    const { data: djProf } = await ADMIN
        .from("dj_profiles")
        .select("stage_name, dj_name, full_name")
        .eq("user_id", userId)
        .maybeSingle();
    let djNombre = String(djProf?.stage_name || djProf?.dj_name || djProf?.full_name || "").trim();
    if (!djNombre) {
        const { data: clientProf } = await ADMIN
            .from("client_profiles")
            .select("full_name")
            .eq("user_id", userId)
            .maybeSingle();
        djNombre = String(clientProf?.full_name || "").trim();
    }
    if (!djNombre) {
        console.error(`[apple-calendar-sync] sin dj_profiles/client_profiles.full_name para user_id=${userId}, se omiten inserciones nuevas`);
    }

    for (const ev of eventos) {
        if (ev.cancelado) {
            await ADMIN
                .from("elixis_agenda_eventos")
                .update({ estado: "cancelado", updated_at: new Date().toISOString() })
                .eq("external_event_id", ev.uid)
                .eq("user_id", userId);
            continue;
        }
        if (!ev.dtstart || !ev.dtend) continue;

        const { data: existente } = await ADMIN
            .from("elixis_agenda_eventos")
            .select("id")
            .eq("external_event_id", ev.uid)
            .eq("user_id", userId)
            .maybeSingle();

        if (existente) {
            await ADMIN
                .from("elixis_agenda_eventos")
                .update({
                    fecha_inicio: ev.dtstart,
                    fecha_fin: ev.dtend,
                    notas: ev.summary || null,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", existente.id);
        } else if (djNombre) {
            await ADMIN.from("elixis_agenda_eventos").insert({
                user_id: userId,
                dj_nombre: djNombre,
                fecha_inicio: ev.dtstart,
                fecha_fin: ev.dtend,
                tipo: tipoDefault,
                estado: "activo",
                notas: ev.summary || null,
                agent_id: "calendar-sync",
                external_event_id: ev.uid,
            });
        }
    }
}
