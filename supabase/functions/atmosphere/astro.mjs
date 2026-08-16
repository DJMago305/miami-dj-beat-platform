// astro.mjs — deterministic astronomy for the Weather Reality Bridge.
// Pure functions, zero dependencies. Runs in Deno (Edge Function) and Node.
// Sun position via the simplified NOAA solar algorithm; moon phase via synodic month.

const RAD = Math.PI / 180, DEG = 180 / Math.PI;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ---- Sun: elevation, azimuth, sunrise/sunset for a date + location ----
export function solarPosition(date, lat, lon) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const doy = Math.floor((date.getTime() - start) / 86400000);
  const utcH = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;

  const g = (2 * Math.PI / 365) * (doy - 1 + (utcH - 12) / 24);           // fractional year (rad)
  const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
    - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));           // minutes
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g)
    - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
    - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);            // solar declination (rad)

  const tst = ((utcH * 60) + eqtime + 4 * lon) % 1440;                    // true solar time (min)
  const ha = (tst / 4) - 180;                                            // hour angle (deg)
  const haR = ha * RAD, latR = lat * RAD;

  const cosZen = clamp(Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(haR), -1, 1);
  const zen = Math.acos(cosZen);
  const elevation = 90 - zen * DEG;                                       // degrees above horizon

  let az = DEG * Math.acos(clamp((Math.sin(latR) * Math.cos(zen) - Math.sin(decl)) / (Math.cos(latR) * Math.sin(zen)), -1, 1));
  az = ha > 0 ? (az + 180) % 360 : (540 - az) % 360;                     // 0=N, 90=E, 180=S, 270=W

  // sunrise/sunset hour angle at -0.833 deg (refraction + solar radius)
  const cosH0 = clamp((Math.cos(90.833 * RAD) / (Math.cos(latR) * Math.cos(decl))) - Math.tan(latR) * Math.tan(decl), -1, 1);
  const h0 = Math.acos(cosH0) * DEG;
  const sunriseUTCmin = 720 - 4 * (lon + h0) - eqtime;                    // UTC minutes past midnight
  const sunsetUTCmin  = 720 - 4 * (lon - h0) - eqtime;

  return {
    elevationDeg: elevation,
    sunElevNorm: Math.sin(elevation * RAD),   // -1..1, matches the engine's uSun convention (1 = zenith)
    azimuthDeg: az,
    declDeg: decl * DEG,
    sunriseUTCmin, sunsetUTCmin,
  };
}

// ---- Moon: illuminated phase 0..1 (0/1 = new, 0.5 = full) ----
const SYNODIC = 29.530588853;
const KNOWN_NEW = Date.UTC(2000, 0, 6, 18, 14);
export function moonPhase(date) {
  let d = ((date.getTime() - KNOWN_NEW) / 86400000) % SYNODIC;
  if (d < 0) d += SYNODIC;
  return d / SYNODIC;
}
export function moonPhaseName(p) {
  const names = ['Luna nueva','Creciente','Cuarto creciente','Gibosa creciente','Luna llena','Gibosa menguante','Cuarto menguante','Menguante'];
  return names[Math.round(p * 8) % 8];
}

// ---- format UTC-minutes to a local h:mm AM/PM string ----
export function fmtLocal(utcMin, tzOffsetHours) {
  let m = ((utcMin + tzOffsetHours * 60) % 1440 + 1440) % 1440;
  let h = Math.floor(m / 60), min = Math.round(m % 60);
  if (min === 60) { min = 0; h = (h + 1) % 24; }
  const ap = h < 12 ? 'AM' : 'PM';
  let x = h % 12; if (x === 0) x = 12;
  return `${x}:${String(min).padStart(2, '0')} ${ap}`;
}

// ---- dayT (0..1) for the engine: 0=midnight, .25=sunrise, .5=noon, .75=sunset ----
export function dayTFromLocalHour(localHour) { return ((localHour / 24) % 1 + 1) % 1; }

// ---- self-test (node astro.mjs) ----
if (typeof process !== 'undefined' && process.argv && import.meta.url === `file://${process.argv[1]}`) {
  const lat = 25.91, lon = -80.31, tz = -4; // Miami Lakes, EDT
  for (const iso of ['2026-08-11T20:00:00Z', '2026-08-12T02:00:00Z', '2026-08-11T10:00:00Z']) {
    const d = new Date(iso);
    const s = solarPosition(d, lat, lon);
    console.log(`${iso}  elev=${s.elevationDeg.toFixed(1)}°  norm=${s.sunElevNorm.toFixed(3)}  az=${s.azimuthDeg.toFixed(0)}°  sunrise=${fmtLocal(s.sunriseUTCmin, tz)}  sunset=${fmtLocal(s.sunsetUTCmin, tz)}`);
  }
  const p = moonPhase(new Date('2026-08-11T20:00:00Z'));
  console.log(`moonPhase=${p.toFixed(3)} (${moonPhaseName(p)})`);
}
