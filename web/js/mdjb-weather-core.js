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

// Miami Lakes, FL — referencia fija (LIVE mode puede pasar geoloc real vía ensureFresh(coords))
const LOC = { lat: 25.91, lon: -80.31, tz: 'America/New_York', name: 'Miami Lakes, FL' };
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
    const s = await r.json();
    if (!isValidState(s)) throw new Error('malformed AtmosphericState');
    return s;
  } finally { clearTimeout(to); }
}

function notify(reason) {
  for (const cb of _subs) { try { cb(_state, reason); } catch (_e) {} }
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
  async ensureFresh(coords) {
    const c0 = coords || LOC;
    // 1. hidratar de la caché compartida (otra vista pudo haber fetcheado ya)
    if (!_state) { const c = readCache(); if (c) { _state = c.state; _fetchedAt = c.fetchedAt; } }
    // 2. ¿suficientemente fresco? devolver sin red
    if (_state && isFresh(_fetchedAt)) return _state;
    // 3. dedup del fetch en vuelo
    if (_inflight) return _inflight;
    _inflight = (async () => {
      try {
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
