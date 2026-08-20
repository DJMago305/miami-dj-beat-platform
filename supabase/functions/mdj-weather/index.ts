// supabase/functions/mdj-weather/index.ts
// Puente al tiempo — la clave de OpenWeather se queda SOLO en el servidor.
//
// Por que existe: la clave vivia incrustada en cuatro archivos de web/, que se
// sirven publicos. Cualquiera que abriera la pagina la veia. Meterla en una
// variable del navegador (window.OPENWEATHER_API_KEY) la habria sacado de git
// pero NO de la vista: todo lo que llega al navegador es legible. La unica
// forma de protegerla de verdad es que nunca salga de aqui.
//
// Molde: booth-tts, que hace lo mismo con la clave de ElevenLabs.
//
// Desplegar:
//   supabase secrets set OPENWEATHER_API_KEY=...
//   supabase functions deploy mdj-weather --no-verify-jwt
//
// Env:
//   OPENWEATHER_API_KEY  (obligatoria) — nunca en el frontend
//
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// ── CORS ──────────────────────────────────────────────────────────────────────
// Se copia el patron de elixis-realtime-session, NO el de las funciones viejas:
// una lista de puertos fijos ya nos costo tres rondas perdidas esta semana
// (8128, 8131...). Un localhost con cualquier puerto entra. No amplia la
// superficie real: una pagina atacante no puede servirse desde el localhost de
// la victima.
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

// ── Tope por IP ───────────────────────────────────────────────────────────────
// El tiempo no cambia cada segundo: 30 por minuto sobra de largo y protege la
// cuota si alguien decide martillear el puente.
const _ventana = new Map<string, number[]>();
const TOPE = 30;
const VENTANA_MS = 60_000;

function pasado_de_vueltas(req: Request): boolean {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
        ?? req.headers.get("x-real-ip") ?? "desconocida";
    const ahora = Date.now();
    const golpes = (_ventana.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
    golpes.push(ahora);
    _ventana.set(ip, golpes);
    return golpes.length > TOPE;
}

function json(cuerpo: unknown, estado: number, req: Request): Response {
    return new Response(JSON.stringify(cuerpo), {
        status: estado,
        headers: { ...cors(req), "Content-Type": "application/json" },
    });
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
    if (req.method !== "GET" && req.method !== "POST") {
        return json({ error: "metodo_no_permitido" }, 405, req);
    }
    if (pasado_de_vueltas(req)) {
        return json({ error: "demasiadas_peticiones" }, 429, req);
    }

    const clave = Deno.env.get("OPENWEATHER_API_KEY") ?? "";
    if (!clave) {
        console.error("[mdj-weather] Falta OPENWEATHER_API_KEY");
        return json({ error: "sin_clave_configurada" }, 503, req);
    }

    // Los parametros llegan por query. Nada de cuerpos ni de estado: es una
    // lectura publica de meteorologia.
    const u = new URL(req.url);

    // GEOCODIFICADOR. event-weather.js lo usa para buscar por nombre de ciudad;
    // no lleva coordenadas, asi que se atiende antes de exigirlas.
    if (u.searchParams.get("recurso") === "geo") {
        const q = (u.searchParams.get("q") ?? "").trim();
        if (!q || q.length > 120) return json({ error: "consulta_invalida" }, 400, req);
        const g = new URL("https://api.openweathermap.org/geo/1.0/direct");
        g.searchParams.set("q", q);
        g.searchParams.set("limit", "1");
        g.searchParams.set("appid", clave);
        try {
            const r = await fetch(g.toString());
            const t = await r.text();
            if (!r.ok) {
                console.error("[mdj-weather] geo", r.status, t.slice(0, 200));
                return json({ error: "proveedor_fallo", estado: r.status }, 502, req);
            }
            return new Response(t, {
                status: 200,
                headers: { ...cors(req), "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" },
            });
        } catch (err) {
            console.error("[mdj-weather] geo red:", err);
            return json({ error: "proveedor_inalcanzable" }, 502, req);
        }
    }

    const lat = Number(u.searchParams.get("lat"));
    const lon = Number(u.searchParams.get("lon"));
    // Se VALIDAN antes de reenviarlos: sin esto, el puente reenvia a OpenWeather
    // lo que le manden, y eso es un proxy abierto con la clave de otro.
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return json({ error: "coordenadas_invalidas" }, 400, req);
    }
    const units = u.searchParams.get("units") === "metric" ? "metric" : "imperial";
    const lang = /^[a-z]{2}$/.test(u.searchParams.get("lang") ?? "") ? u.searchParams.get("lang")! : "es";
    // Lista blanca de recursos. No se acepta una ruta arbitraria: sin esto,
    // el puente reenvia lo que le manden y se convierte en un proxy abierto.
    const recurso = u.searchParams.get("recurso") === "forecast" ? "forecast" : "weather";

    const destino = new URL(`https://api.openweathermap.org/data/2.5/${recurso}`);
    destino.searchParams.set("lat", String(lat));
    destino.searchParams.set("lon", String(lon));
    destino.searchParams.set("units", units);
    destino.searchParams.set("lang", lang);
    destino.searchParams.set("appid", clave);

    try {
        const res = await fetch(destino.toString());
        const texto = await res.text();
        if (!res.ok) {
            // El cuerpo de OpenWeather puede llevar la clave en el mensaje de
            // error, asi que NO se reenvia tal cual: solo el codigo.
            console.error("[mdj-weather] OpenWeather", res.status, texto.slice(0, 200));
            return json({ error: "proveedor_fallo", estado: res.status }, 502, req);
        }
        return new Response(texto, {
            status: 200,
            headers: {
                ...cors(req),
                "Content-Type": "application/json",
                // El tiempo se cachea 10 min: menos cuota gastada y respuesta
                // instantanea al volver a la pagina.
                "Cache-Control": "public, max-age=600",
            },
        });
    } catch (err) {
        console.error("[mdj-weather] Error de red:", err);
        return json({ error: "proveedor_inalcanzable" }, 502, req);
    }
});
