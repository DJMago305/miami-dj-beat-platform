// atmosphere — Edge Function: real astronomy + a normalized AtmosphericState.
// Deploy: supabase functions deploy atmosphere --no-verify-jwt
// Env (for M3): the weather provider's API key/credentials — read ONLY here via
//   Deno.env.get(...). They must NEVER be sent to the browser.
//
// M1 SKELETON: REAL sun/moon/constellations astronomy + SYNTHETIC weather.
// M3: plug a real provider (WeatherKit / OpenWeather) into state.mjs (replace SYNTH).
//
// GET /atmosphere?lat=25.91&lon=-80.31&tz=-4&place=Miami%20Lakes
//   lat, lon  required (validated + clamped)
//   tz        optional local UTC offset in hours (default: derived from lon)
//   place     optional human name (until reverse-geocoding lands with the provider)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { buildState } from "./state.mjs";
import { fetchWeather } from "./weather.mjs";       // real provider (WeatherKit/OpenWeather) via env; SYNTH if unset
import { reverseGeocode } from "./geocode.mjs";     // lat/lon -> place name (server-side; key stays in Deno.env)

// Lock CORS to the app's own origins (never "*").
const ALLOWED_ORIGINS = [
  "https://miamidjbeat.com",
  "https://www.miamidjbeat.com",
  "https://miamidjbeat.vercel.app",
  "http://localhost:8080",
  "http://localhost:3000",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:8200",
];

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization",
    "Vary": "Origin",
  };
}

const num = (v: string | null, a: number, b: number): number | null => {
  if (v === null) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : null;
};
const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "content-type": "application/json" } });

serve(async (req: Request) => {
  const h = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: h });

  const u = new URL(req.url);
  const lat = num(u.searchParams.get("lat"), -90, 90);
  const lon = num(u.searchParams.get("lon"), -180, 180);
  if (lat === null || lon === null) {
    return json({ error: "Parámetros lat y lon son obligatorios (grados decimales)." }, 400, h);
  }
  const tz = num(u.searchParams.get("tz"), -14, 14) ?? Math.round(lon / 15);

  try {
    // explicit ?place wins; otherwise reverse-geocode server-side (null -> "lat, lon")
    const place = u.searchParams.get("place") || (await reverseGeocode(lat, lon)) || undefined;
    const weather = await fetchWeather(lat, lon);   // real provider via env, else synthetic
    const state = buildState(lat, lon, tz, new Date(), place, weather);
    return json(state, 200, { ...h, "Cache-Control": "public, max-age=600" }); // 10-min cache hint
  } catch (err) {
    return json({ error: "Fallo al construir el estado atmosférico.", detail: String(err) }, 500, h);
  }
});
