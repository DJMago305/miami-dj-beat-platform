// mdjb-weather-core.js — MDJ_WeatherHub · Fuente Única de Verdad (SSOT) del clima
// ─────────────────────────────────────────────────────────────────────────────
// UN solo fetch + UN solo cálculo astronómico para todo el ecosistema MDJB
// (dashboard, perfil DJ, staff-agenda, motor WebGL). Los consumidores se
// suscriben; no fetchean por su cuenta. TICKET-WEATHER-01.
//
// Pilares:
//  A. SSOT       — caché compartida en localStorage (mismo origen, cross-iframe)
//                  con TTL de 12 min + dedup de fetch en vuelo.
//  B. Offline    — la astronomía es matemática PURA local (astro.js/celestial.js):
//                  el sol/luna nunca se congela ni queda en blanco sin red.
//  C. LERP-ready — expone getAstro(date) para que el motor interpole hacia el
//                  target fresco en vez de saltar (anti-snap; el LERP vive en el
//                  bucle rAF del motor, este hub le da el objetivo).
//
// Uso:
//   import { MDJ_WeatherHub } from './js/mdjb-weather-core.js';
//   MDJ_WeatherHub.subscribe((state, reason) => render(state));
//   MDJ_WeatherHub.ensureFresh();                 // dispara/reutiliza el fetch compartido
//   const astro = MDJ_WeatherHub.getAstro();      // sol/luna locales, siempre disponible
// También queda en window.MDJ_WeatherHub para páginas no-módulo.

import { solarPosition, moonPhase, moonPhaseName, fmtLocal, dayTFromLocalHour } from '../weather-experience/js/astro.js';
import { constellations, moonAltAz } from '../weather-experience/js/celestial.js';

// Miami Lakes, FL — BASE CORPORATIVA (fallback si el GPS se niega/offline/timeout)
const LOC = { lat: 25.9115, lon: -80.3012, tz: 'America/New_York', name: 'Miami Lakes, FL' };
const TTL_MS = 12 * 60 * 1000;     // caché compartida 12 min (rango 10-15 del ticket)
const LS_KEY = 'mdjb:weather:v1';  // clave de localStorage (compartida entre iframes del mismo origen)

const ENDPOINT = () => (typeof window !== 'undefined' && window.MDJB_ATMO_ENDPOINT) || '';

let _state = null;      // última AtmosphericState conocida (de caché o fetch)
let _fetchedAt = 0;     // epoch ms del último fetch exitoso
let _inflight = null;   // promesa de fetch en vuelo (dedup dentro de este documento)
const _subs = new Set();

// ── Validación de forma (mismo patrón que hero.js: no cachear datos corruptos) ──
function isValidState(s) {
  return !!(s && s.condition && typeof s.condition.temp === 'string' && s.condition.label
    && s.time && typeof s.time.dayT === 'number'
    && s.drivers && typeof s.drivers.cloud === 'number'
    && s.metrics && s.location && Array.isArray(s.hourly) && s.hourly.length && s.sky);
}

// ── B. Astronomía PURA local — siempre disponible, sin red ──
function astroAt(date = new Date(), lat = LOC.lat, lon = LOC.lon) {
  const sun = solarPosition(date, lat, lon);
  const phase = moonPhase(date);
  const moon = moonAltAz(date, lat, lon);
  const tzOffH = -date.getTimezoneOffset() / 60;                     // offset local real
  const localHour = ((date.getUTCHours() + tzOffH + date.getUTCMinutes() / 60) % 24 + 24) % 24;
  return {
    date,
    dayT: dayTFromLocalHour(localHour),        // 0=medianoche .25=alba .5=mediodía .75=ocaso
    sunElevNorm: sun.sunElevNorm,              // -1..1 (convención uSun del motor)
    sunElevationDeg: sun.elevationDeg,
    sunAzimuthDeg: sun.azimuthDeg,
    moonPhase: phase,
    moonPhaseName: moonPhaseName(phase),
    moonAltDeg: moon.alt,
    moonAzDeg: moon.az,
    sunrise: fmtLocal(sun.sunriseUTCmin, tzOffH),
    sunset: fmtLocal(sun.sunsetUTCmin, tzOffH),
    constellations: constellations(date, lat, lon, sun.elevationDeg),
  };
}

// ── A. Caché compartida en localStorage (cross-iframe, mismo origen) ──
function readCache() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || !o.state || !o.fetchedAt || !isValidState(o.state)) return null;
    return o;
  } catch (_e) { return null; }
}
function writeCache(state) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ state, fetchedAt: Date.now() })); } catch (_e) {}
}
const isFresh = (fetchedAt) => (Date.now() - fetchedAt) < TTL_MS;

// ── OWM → AtmosphericState (Opción B, PO 2026-08-25) ──────────────────────────
// Si la Edge Function devuelve OpenWeather CRUDO (weather+main+clouds), el hub lo
// transforma aquí al contrato. El tiempo (time.dayT) sale de nuestro astro LOCAL
// (SSOT astronómico), no de OWM. Si ya viene como AtmosphericState, pasa igual.
function owmGlyph(id) {
  const g = Math.floor((id || 800) / 100);
  if (g === 2) return '⛈️'; if (g === 3 || g === 5) return '🌧️';
  if (g === 6) return '🌨️'; if (g === 7) return '🌫️';
  return id === 800 ? '☀️' : '⛅';
}
function owmDrivers(id, cloudsAll, rain, windSpeed) {
  id = id || 800; const g = Math.floor(id / 100);
  const cloud = Math.max(0, Math.min(1, (cloudsAll || 0) / 100));
  let storm = 0, rn = 0, snow = 0, fog = 0;
  if (g === 2) { storm = 0.9; rn = 1; }                 // tormenta
  else if (g === 3) { rn = 0.4; }                       // llovizna
  else if (g === 5) { rn = id === 500 ? 0.45 : id === 501 ? 0.7 : 1; }  // lluvia ligera/mod/fuerte
  else if (g === 6) { snow = 0.8; }                     // nieve
  else if (g === 7) { fog = 0.7; }                      // niebla/bruma
  const rmm = (rain && (rain['1h'] != null ? rain['1h'] : (rain['3h'] != null ? rain['3h'] / 3 : 0))) || 0;
  if (rmm > 0) rn = Math.max(rn, Math.min(1, rmm / 3));
  const wind = Math.max(0, Math.min(1, (windSpeed || 0) / 25));   // mph → 0..1 (25mph=1)
  return { cloud, storm, wind, rain: rn, snow, fog };
}
function fmtHourLbl(h) { h = ((h % 24) + 24) % 24; const ap = h < 12 ? 'am' : 'pm'; let x = h % 12; if (x === 0) x = 12; return x + ap; }
function buildHourly(temp, id) {
  const g = owmGlyph(id), h0 = new Date().getHours(), out = [];
  for (let i = 0; i < 6; i++) out.push({ h: i === 0 ? 'Ahora' : fmtHourLbl(h0 + i * 2), glyph: g, t: (temp + Math.round(Math.sin(i * 0.9) * 2)) + '°' });
  return out;
}
const _DIRS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
function windDirLabel(deg) { return deg == null ? '' : _DIRS[Math.round(((deg % 360) / 22.5)) % 16]; }
function owmKey(id) {   // wxKey del motor (para glyphs/escena) desde el código OWM
  const g = Math.floor((id || 800) / 100);
  if (g === 2) return 'storm'; if (g === 3 || g === 5) return 'rain'; if (g === 6) return 'snow';
  if (g === 7) return 'fog'; return id === 800 ? 'clear' : id === 801 || id === 802 ? 'cloudy' : 'overcast';
}
// El shape debe CLONAR exactamente lo que renderUI de hero.js consume (condition.feels,
// condition.hi='Máx: X°', metrics.windMph/windDir/uv/uvLabel/uvHot). UV no viene en OWM
// /weather → se estima del sol (SSOT astronómico local).
function owmToState(o) {
  const m = o.main || {}, w = (o.weather && o.weather[0]) || {}, wind = o.wind || {}, clouds = o.clouds || {}, coord = o.coord || {};
  const a = astroAt();
  const temp = Math.round(m.temp != null ? m.temp : 0);
  const hi = Math.round(m.temp_max != null ? m.temp_max : temp);
  const lo = Math.round(m.temp_min != null ? m.temp_min : temp);
  const feels = Math.round(m.feels_like != null ? m.feels_like : temp);
  const uvVal = Math.max(0, Math.round((a.sunElevNorm || 0) * 11));   // estimado por elevación solar
  const uvLbl = uvVal === 0 ? '—' : uvVal < 3 ? 'Bajo' : uvVal < 6 ? 'Moderado' : uvVal < 8 ? 'Alto' : 'Muy Alto';
  return {
    condition: { key: owmKey(w.id), label: w.description || '—', temp: temp + '°', feels: feels + '°', feelsHot: feels >= 90, hi: 'Máx: ' + hi + '°', lo: 'Mín: ' + lo + '°' },
    time: { dayT: a.dayT },
    drivers: owmDrivers(w.id, clouds.all, o.rain, wind.speed),
    metrics: {
      humidity: (m.humidity != null ? m.humidity : 0) + '%',
      windMph: Math.round(wind.speed || 0) + ' mph', windDir: windDirLabel(wind.deg),
      vis: Math.round((o.visibility || 10000) / 1609.34) + ' mi',
      pressure: ((m.pressure || 1013) * 0.02953).toFixed(2) + ' inHg',
      uv: String(uvVal), uvLabel: uvLbl, uvHot: uvVal >= 6,
    },
    location: { name: o.name ? (o.name + ', FL') : 'Miami Lakes, FL', short: o.name || 'Miami Lakes', lat: coord.lat, lon: coord.lon, tz: 'America/New_York' },
    hourly: buildHourly(temp, w.id),
    sky: { base: 1 },
    // EVENTO DE HOY: por defecto sin gig (la página anfitriona lo sobrescribe vía
    // postMessage si hay evento real). renderUI lee s.event.* → debe existir o lanza.
    event: { lead: 'Día sin evento en agenda.', start: 'Sin horario', end: 'Sin horario', buffer: '—', loc: o.name || 'Miami Lakes', sunset: '◔ ' + a.sunset, logi: '' },
  };
}
function normalize(raw) {
  // OWM crudo = tiene weather[]+main+clouds y NO tiene drivers → transformar
  if (raw && Array.isArray(raw.weather) && raw.main && raw.clouds && !raw.drivers) return owmToState(raw);
  return raw;
}

// ── Fetch al Edge Function (mismo endpoint que el motor; 8s cap, nunca cuelga) ──
async function doFetch(coords) {
  const ep = ENDPOINT();
  if (!ep) throw new Error('no endpoint configured');
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 8000);
  try {
    const url = ep + '?lat=' + coords.lat.toFixed(4) + '&lon=' + coords.lon.toFixed(4) + '&tz=' + coords.tz;
    const r = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    if (!r.ok) throw new Error('http ' + r.status);
    const s = normalize(await r.json());               // OWM crudo → AtmosphericState (Opción B)
    if (!isValidState(s)) throw new Error('malformed AtmosphericState');
    return s;
  } finally { clearTimeout(to); }
}

function notify(reason) {
  for (const cb of _subs) { try { cb(_state, reason); } catch (_e) {} }
}

// ── Geolocalización dinámica: GPS real del usuario → fallback a la base corporativa ──
// Si el usuario autoriza GPS: coords precisas (la zona real: Hialeah/Kendall/Doral/etc.,
// la ciudad la resuelve el Edge Function desde lat/lon). Si niega/offline/timeout: Miami Lakes.
let _coordsCache = null, _coordsAt = 0;
function getCoords() {
  const tz = -new Date().getTimezoneOffset() / 60;
  const fb = { lat: LOC.lat, lon: LOC.lon, tz };                 // base corporativa (Miami Lakes)
  // reutiliza la última ubicación por 10 min (no re-pedir GPS en cada refresh)
  if (_coordsCache && (Date.now() - _coordsAt) < 600000) return Promise.resolve(_coordsCache);
  return new Promise((res) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { _coordsCache = fb; _coordsAt = Date.now(); return res(fb); }
    let done = false;
    const finish = (c) => { if (done) return; done = true; clearTimeout(to); _coordsCache = c; _coordsAt = Date.now(); res(c); };
    const to = setTimeout(() => finish(fb), 6000);               // timeout → fallback
    try {
      navigator.geolocation.getCurrentPosition(
        (p) => finish({ lat: p.coords.latitude, lon: p.coords.longitude, tz }),   // GPS OK
        () => finish(fb),                                                          // negado/error → fallback
        { timeout: 6000, maximumAge: 600000 }
      );
    } catch (_e) { finish(fb); }
  });
}

// ── API pública ──
const MDJ_WeatherHub = {
  LOC,
  TTL_MS,

  // Estado de clima actual (puede ser null en arranque frío sin red — usar getAstro para el cielo).
  getState() { return _state; },

  // B: astronomía local siempre disponible (offline + targets del LERP del motor).
  getAstro(date, lat, lon) { return astroAt(date || new Date(), lat, lon); },

  // Suscripción pasiva: cb(state, reason). reason ∈ 'init'|'live'|'offline'|'storage'.
  subscribe(cb) {
    _subs.add(cb);
    if (_state) { try { cb(_state, 'init'); } catch (_e) {} }
    return () => _subs.delete(cb);
  },

  // Devuelve estado fresco-o-cacheado. Dedup dentro del documento; cross-view por caché.
  // NUNCA lanza a los consumidores y NUNCA deja el cielo en blanco (resiliencia offline).
  getCoords,                                        // GPS dinámico → fallback base corporativa

  async ensureFresh(coords) {
    // 1. hidratar de la caché compartida (otra vista pudo haber fetcheado ya)
    if (!_state) { const c = readCache(); if (c) { _state = c.state; _fetchedAt = c.fetchedAt; } }
    // 2. ¿fresco? avisar a los suscriptores y devolver — SIN geolocalizar ni red.
    if (_state && isFresh(_fetchedAt)) { notify('live'); return _state; }
    // 3. dedup del fetch en vuelo
    if (_inflight) return _inflight;
    _inflight = (async () => {
      try {
        const c0 = coords || await getCoords();      // geoloc (GPS→fallback) solo para el fetch real
        const s = await doFetch(c0);
        _state = s; _fetchedAt = Date.now();
        writeCache(s);           // publica a las otras vistas (dispara 'storage' allá)
        notify('live');
        return s;
      } catch (_e) {
        // Offline/fallo de API: conservar la última caché, avisar 'offline', jamás lanzar.
        notify('offline');
        return _state;           // puede ser null en frío sin red → el consumidor sigue con getAstro()
      } finally { _inflight = null; }
    })();
    return _inflight;
  },

  // Fuerza expiración (para pruebas de reconexión).
  _expire() { _fetchedAt = 0; },
};

// ── Broadcast cross-iframe: si otra vista escribe datos frescos, adoptarlos + avisar ──
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LS_KEY && e.newValue) {
      try {
        const o = JSON.parse(e.newValue);
        if (o && o.state && isValidState(o.state)) {
          _state = o.state; _fetchedAt = o.fetchedAt; notify('storage');
        }
      } catch (_e) {}
    }
  });
  window.MDJ_WeatherHub = MDJ_WeatherHub;   // acceso para páginas no-módulo
}

export { MDJ_WeatherHub, astroAt, isValidState };
export default MDJ_WeatherHub;
