/**
 * astro.ts — deterministic astronomy for the Weather Reality Bridge.
 * Ported verbatim (logic unchanged) from web/weather-experience/js/astro.js —
 * same module the Supabase Edge Function `atmosphere` uses server-side, so
 * this lab's hero and any future backend stay a single source of truth.
 * Pure functions, zero dependencies.
 */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const clamp = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x));

export type SolarPosition = {
  readonly elevationDeg: number;
  readonly sunElevNorm: number;
  readonly azimuthDeg: number;
  readonly declDeg: number;
  readonly sunriseUTCmin: number;
  readonly sunsetUTCmin: number;
};

// ---- Sun: elevation, azimuth, sunrise/sunset for a date + location ----
export function solarPosition(date: Date, lat: number, lon: number): SolarPosition {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const doy = Math.floor((date.getTime() - start) / 86400000);
  const utcH = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;

  const g = ((2 * Math.PI) / 365) * (doy - 1 + (utcH - 12) / 24); // fractional year (rad)
  const eqtime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g)); // minutes
  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g); // solar declination (rad)

  const tst = ((utcH * 60 + eqtime + 4 * lon) % 1440 + 1440) % 1440; // true solar time (min)
  const ha = tst / 4 - 180; // hour angle (deg)
  const haR = ha * RAD;
  const latR = lat * RAD;

  const cosZen = clamp(
    Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(haR),
    -1,
    1,
  );
  const zen = Math.acos(cosZen);
  const elevation = 90 - zen * DEG; // degrees above horizon

  let az =
    DEG *
    Math.acos(
      clamp(
        (Math.sin(latR) * Math.cos(zen) - Math.sin(decl)) / (Math.cos(latR) * Math.sin(zen)),
        -1,
        1,
      ),
    );
  az = ha > 0 ? (az + 180) % 360 : (540 - az) % 360; // 0=N, 90=E, 180=S, 270=W

  // sunrise/sunset hour angle at -0.833 deg (refraction + solar radius)
  const cosH0 = clamp(
    Math.cos(90.833 * RAD) / (Math.cos(latR) * Math.cos(decl)) - Math.tan(latR) * Math.tan(decl),
    -1,
    1,
  );
  const h0 = Math.acos(cosH0) * DEG;
  const sunriseUTCmin = 720 - 4 * (lon + h0) - eqtime; // UTC minutes past midnight
  const sunsetUTCmin = 720 - 4 * (lon - h0) - eqtime;

  return {
    elevationDeg: elevation,
    sunElevNorm: Math.sin(elevation * RAD), // -1..1, matches the engine's uSun convention (1 = zenith)
    azimuthDeg: az,
    declDeg: decl * DEG,
    sunriseUTCmin,
    sunsetUTCmin,
  };
}

// ---- Moon: illuminated phase 0..1 (0/1 = new, 0.5 = full) ----
const SYNODIC = 29.530588853;
const KNOWN_NEW = Date.UTC(2000, 0, 6, 18, 14);
export function moonPhase(date: Date): number {
  let d = ((date.getTime() - KNOWN_NEW) / 86400000) % SYNODIC;
  if (d < 0) d += SYNODIC;
  return d / SYNODIC;
}

export function moonPhaseName(p: number): string {
  const names = [
    'Luna nueva',
    'Creciente',
    'Cuarto creciente',
    'Gibosa creciente',
    'Luna llena',
    'Gibosa menguante',
    'Cuarto menguante',
    'Menguante',
  ];
  return names[Math.round(p * 8) % 8];
}

// ---- format UTC-minutes to a local h:mm AM/PM string ----
export function fmtLocal(utcMin: number, tzOffsetHours: number): string {
  const m = (((utcMin + tzOffsetHours * 60) % 1440) + 1440) % 1440;
  let h = Math.floor(m / 60);
  let min = Math.round(m % 60);
  if (min === 60) {
    min = 0;
    h = (h + 1) % 24;
  }
  const ap = h < 12 ? 'AM' : 'PM';
  let x = h % 12;
  if (x === 0) x = 12;
  return `${x}:${String(min).padStart(2, '0')} ${ap}`;
}

// ---- dayT (0..1) for the engine: 0=midnight, .25=sunrise, .5=noon, .75=sunset ----
export function dayTFromLocalHour(localHour: number): number {
  return (((localHour / 24) % 1) + 1) % 1;
}
