# atmosphere — Edge Function (Weather Reality Bridge)

Devuelve un **`AtmosphericState`** normalizado: astronomía real (sol, luna, fase,
constelaciones estacionales) + clima. El frontend (HERO WebGL) consume este contrato tal cual.

**Seguridad:** la llave del proveedor de clima vive SOLO aquí, en `Deno.env`. Nunca llega al navegador.

## Archivos
- `index.ts` — handler HTTP (valida coords, CORS con allowlist, cache 10 min).
- `state.mjs` — arma el `AtmosphericState` (astronomía real + clima).
- `weather.mjs` — **adaptador M3 (LISTO):** OpenWeather + WeatherKit, seleccionable por env.
- `astro.mjs` — sol (NOAA), fase lunar, amanecer/atardecer.
- `celestial.mjs` — posición lunar (Schlyter) + constelaciones estacionales (RA/Dec).

## Deploy (M4)
```bash
supabase functions deploy atmosphere --no-verify-jwt
```
Es endpoint público de lectura (solo coordenadas), por eso `--no-verify-jwt`.

Prueba:
```bash
curl "https://<PROYECTO>.supabase.co/functions/v1/atmosphere?lat=25.91&lon=-80.31&tz=-4&place=Miami%20Lakes"
```

En el frontend:
```js
window.MDJB_ATMO_ENDPOINT = 'https://<PROYECTO>.supabase.co/functions/v1/atmosphere';
// luego pulsar 🛰️ En vivo
```

## M3 — proveedor real (adaptador YA escrito, solo faltan las env)
`weather.mjs` ya trae ambos adaptadores, el mapeo condition→drivers y la firma JWT.
Sin env → clima sintético (`provider: "skeleton-mock"`). Con env → real (`provider: "live"`).

Elegir proveedor y poner los secretos (nunca al frontend):
```bash
# Opción A — OpenWeather (reusa tu key actual)
supabase secrets set WEATHER_PROVIDER=openweather
supabase secrets set OPENWEATHER_API_KEY=xxxxxxxx

# Opción B — Apple WeatherKit (recomendado; tu licencia Apple Dev)
supabase secrets set WEATHER_PROVIDER=weatherkit
supabase secrets set WEATHERKIT_TEAM_ID=XXXXXXXXXX
supabase secrets set WEATHERKIT_KEY_ID=YYYYYYYYYY
supabase secrets set WEATHERKIT_SERVICE_ID=com.tudominio.weather
supabase secrets set WEATHERKIT_PRIVATE_KEY="$(cat AuthKey_YYYYYYYYYY.p8)"
```
El motor y el UI NO cambian: solo cambia lo que produce `weather.mjs`.
Verificado en Node: mapeo OpenWeather/WeatherKit + firma JWT ES256.

## CORS
Editar `ALLOWED_ORIGINS` en `index.ts` con los orígenes reales de la app.
