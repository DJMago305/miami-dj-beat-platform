// supabase/functions/mdj-weatherkit/index.ts
// Puente a Apple WeatherKit — la clave privada (.p8) se queda SOLO en el servidor.
// Mismo criterio que mdj-weather (OpenWeatherMap): la clave nunca sale al navegador.
//
// Por que existe: OpenWeatherMap gratis (mdj-weather) es una FOTO del momento --
// reporta DESPUES de que algo ya esta pasando. WeatherKit (incluido gratis en la
// membresia de Apple Developer, 500,000 consultas/mes) trae el mismo radar/modelo
// que usa la app Weather de Apple -- lo que el PO confirmo hoy que SI detecta
// tormentas que OpenWeatherMap gratis no ve.
//
// Autenticacion: WeatherKit exige un JWT firmado ES256 con la clave privada de
// Apple Developer (Certificates, Identifiers & Profiles → Keys → WeatherKit).
// Header: {alg:"ES256", kid:<Key ID>, id:"<Team ID>.<sub>"}. Payload:
// {iss:<Team ID>, sub:<mismo valor que en id>, iat, exp}. NO hay SDK oficial de
// Apple para esto en Deno -- se firma a mano con Web Crypto (crypto.subtle),
// que para ECDSA P-256 ya devuelve la firma en formato "raw" (r||s de 32+32
// bytes), el mismo que exige JWS -- no hace falta des-DER-ificar nada.
//
// Desplegar:
//   supabase secrets set APPLE_TEAM_ID=... APPLE_WEATHERKIT_KEY_ID=... APPLE_WEATHERKIT_PRIVATE_KEY="$(cat AuthKey_XXXX.p8)"
//   supabase functions deploy mdj-weatherkit --no-verify-jwt
//
// Env:
//   APPLE_TEAM_ID              (obligatoria) — ej. 567MMHH2B9
//   APPLE_WEATHERKIT_KEY_ID    (obligatoria) — ej. PZYLR3HYJQ
//   APPLE_WEATHERKIT_PRIVATE_KEY (obligatoria) — el .p8 completo, con las líneas BEGIN/END
//   APPLE_WEATHERKIT_SUB       (opcional) — si Apple exige un Service ID/Bundle ID
//                              distinto del Team ID como "sub"; por defecto usa el Team ID.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const ALLOWED_ORIGINS = [
    "https://miamidjbeat.com",
    "https://www.miamidjbeat.com",
    "https://miamidjbeat.vercel.app",
];
const LOCALHOST_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function cors(req: Request): Record<string, string> {
    const origin = req.headers.get("origin") ?? "";
    const ok = ALLOWED_ORIGINS.includes(origin) || LOCALHOST_ORIGIN.test(origin);
    return {
        "Access-Control-Allow-Origin": ok ? origin : ALLOWED_ORIGINS[0],
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Vary": "Origin",
    };
}
function json(cuerpo: unknown, estado: number, req: Request): Response {
    return new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...cors(req), "Content-Type": "application/json" } });
}

// ── Tope por IP (mismo criterio que mdj-weather) ────────────────────────────
const _ventana = new Map<string, number[]>();
function pasado_de_vueltas(req: Request): boolean {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "desconocida";
    const ahora = Date.now();
    const golpes = (_ventana.get(ip) ?? []).filter((t) => ahora - t < 60_000);
    golpes.push(ahora);
    _ventana.set(ip, golpes);
    return golpes.length > 30;
}

function b64url(bytes: Uint8Array): string {
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlFromString(s: string): string {
    return b64url(new TextEncoder().encode(s));
}
function pemToDer(pem: string): ArrayBuffer {
    const b64 = pem.replace(/-----BEGIN [^-]+-----/, "").replace(/-----END [^-]+-----/, "").replace(/\s+/g, "");
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
}

// ── JWT firmado ES256, cacheado en memoria (dura hasta 55 min -- Apple acepta hasta 1h) ──
let _tokenCache: { token: string; exp: number } | null = null;
async function firmarJWT(): Promise<string> {
    if (_tokenCache && _tokenCache.exp - 60 > Math.floor(Date.now() / 1000)) return _tokenCache.token;

    const teamId = Deno.env.get("APPLE_TEAM_ID") ?? "";
    const keyId = Deno.env.get("APPLE_WEATHERKIT_KEY_ID") ?? "";
    const pem = Deno.env.get("APPLE_WEATHERKIT_PRIVATE_KEY") ?? "";
    const sub = Deno.env.get("APPLE_WEATHERKIT_SUB") || teamId;
    if (!teamId || !keyId || !pem) throw new Error("faltan credenciales de WeatherKit (APPLE_TEAM_ID/APPLE_WEATHERKIT_KEY_ID/APPLE_WEATHERKIT_PRIVATE_KEY)");

    const key = await crypto.subtle.importKey(
        "pkcs8",
        pemToDer(pem),
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"],
    );

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600; // Apple acepta hasta 1h; se recachea antes de que expire
    const header = { alg: "ES256", kid: keyId, id: `${teamId}.${sub}`, typ: "JWT" };
    const payload = { iss: teamId, sub, iat: now, exp };
    const signingInput = `${b64urlFromString(JSON.stringify(header))}.${b64urlFromString(JSON.stringify(payload))}`;

    const sigBuf = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        key,
        new TextEncoder().encode(signingInput),
    );
    // Web Crypto para ECDSA ya entrega la firma en formato "raw" (r||s, IEEE P1363) --
    // exactamente lo que JWS/ES256 exige. Node.js hace lo contrario (DER) -- Deno no.
    const token = `${signingInput}.${b64url(new Uint8Array(sigBuf))}`;
    _tokenCache = { token, exp };
    return token;
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
    if (req.method !== "GET") return json({ error: "metodo_no_permitido" }, 405, req);
    if (pasado_de_vueltas(req)) return json({ error: "demasiadas_peticiones" }, 429, req);

    const u = new URL(req.url);
    const lat = Number(u.searchParams.get("lat"));
    const lon = Number(u.searchParams.get("lon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return json({ error: "coordenadas_invalidas" }, 400, req);
    }
    const lang = /^[a-z]{2}(-[A-Z]{2})?$/.test(u.searchParams.get("lang") ?? "") ? u.searchParams.get("lang")! : "es-US";
    // dataSets: currentWeather (obligatorio para esto) + forecastNextHour (el "minutely"
    // de WeatherKit) + weatherAlerts (avisos oficiales) -- las dos piezas que OWM gratis no trae.
    const dataSets = u.searchParams.get("dataSets") || "currentWeather,forecastNextHour,weatherAlerts";

    let jwt: string;
    try {
        jwt = await firmarJWT();
    } catch (err) {
        console.error("[mdj-weatherkit] firma JWT:", err);
        return json({ error: "credenciales_incompletas", detalle: String((err as Error)?.message || err) }, 503, req);
    }

    const destino = new URL(`https://weatherkit.apple.com/api/v1/weather/${lang}/${lat}/${lon}`);
    destino.searchParams.set("dataSets", dataSets);
    destino.searchParams.set("timezone", u.searchParams.get("tz") || "America/New_York");

    try {
        const res = await fetch(destino.toString(), { headers: { Authorization: `Bearer ${jwt}` } });
        const texto = await res.text();
        if (!res.ok) {
            // El cuerpo de error de Apple es texto plano, sin secretos -- se reenvia
            // tal cual para poder diagnosticar (a diferencia de OpenWeather, que a
            // veces mete la clave en el mensaje de error).
            console.error("[mdj-weatherkit] Apple", res.status, texto.slice(0, 500));
            return json({ error: "proveedor_fallo", estado: res.status, detalle: texto.slice(0, 500) }, 502, req);
        }
        return new Response(texto, { status: 200, headers: { ...cors(req), "Content-Type": "application/json", "Cache-Control": "public, max-age=600" } });
    } catch (err) {
        console.error("[mdj-weatherkit] Error de red:", err);
        return json({ error: "proveedor_inalcanzable" }, 502, req);
    }
});
