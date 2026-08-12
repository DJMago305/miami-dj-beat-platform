/**
 * celestial.ts — AstronomyEngine · Phase A.
 * Ported verbatim (logic unchanged) from web/weather-experience/js/celestial.js.
 * Real celestial mechanics: given date+time+location, computes which named
 * constellations are above the horizon and where (altitude/azimuth), from
 * real star catalog positions (RA/Dec J2000).
 */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const clamp = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x));
const norm360 = (d: number): number => ((d % 360) + 360) % 360;
const norm24 = (h: number): number => ((h % 24) + 24) % 24;

// ---- Greenwich Mean Sidereal Time (hours) ----
export function gmstHours(date: Date): number {
  const JD = date.getTime() / 86400000 + 2440587.5;
  const D = JD - 2451545.0;
  const T = D / 36525;
  const gmst = 280.46061837 + 360.98564736629 * D + 0.000387933 * T * T - (T * T * T) / 38710000;
  return norm24(norm360(gmst) / 15);
}

// Local Sidereal Time (hours) for an east-positive longitude in degrees
export function lstHours(date: Date, lonDeg: number): number {
  return norm24(gmstHours(date) + lonDeg / 15);
}

export type AltAz = { readonly alt: number; readonly az: number };

// ---- horizontal coords of a star from its RA(h)/Dec(deg) ----
export function altAz(raH: number, decDeg: number, lst: number, latDeg: number): AltAz {
  const H = (lst - raH) * 15; // hour angle (deg)
  const Hr = H * RAD;
  const dr = decDeg * RAD;
  const lr = latDeg * RAD;
  const sinAlt = Math.sin(dr) * Math.sin(lr) + Math.cos(dr) * Math.cos(lr) * Math.cos(Hr);
  const alt = Math.asin(clamp(sinAlt, -1, 1));
  const cosAz =
    (Math.sin(dr) - Math.sin(alt) * Math.sin(lr)) / (Math.cos(alt) * Math.cos(lr));
  let az = Math.acos(clamp(cosAz, -1, 1)) * DEG;
  if (Math.sin(Hr) > 0) az = 360 - az; // east/west disambiguation
  return { alt: alt * DEG, az };
}

type CatalogStar = { readonly id: string; readonly ra: number; readonly dec: number; readonly tint?: readonly number[] };

// ---- real star catalogs (RA hours, Dec degrees, J2000) ----
const ORION: readonly CatalogStar[] = [
  { id: 'betelgeuse', ra: 5.9195, dec: 7.407, tint: [1.0, 0.66, 0.48] }, // red supergiant
  { id: 'bellatrix', ra: 5.4188, dec: 6.35, tint: [0.9, 0.93, 1.0] },
  { id: 'mintaka', ra: 5.5334, dec: -0.299, tint: [0.9, 0.93, 1.0] }, // belt
  { id: 'alnilam', ra: 5.6036, dec: -1.202, tint: [0.9, 0.93, 1.0] }, // belt
  { id: 'alnitak', ra: 5.6793, dec: -1.943, tint: [0.9, 0.93, 1.0] }, // belt
  { id: 'saiph', ra: 5.7959, dec: -9.67, tint: [0.9, 0.93, 1.0] },
  { id: 'rigel', ra: 5.2423, dec: -8.202, tint: [0.74, 0.84, 1.0] }, // blue
];
const BIG_DIPPER: readonly CatalogStar[] = [
  { id: 'dubhe', ra: 11.0621, dec: 61.751 },
  { id: 'merak', ra: 11.0307, dec: 56.383 },
  { id: 'phecda', ra: 11.8972, dec: 53.695 },
  { id: 'megrez', ra: 12.257, dec: 57.033 },
  { id: 'alioth', ra: 12.9004, dec: 55.96 },
  { id: 'mizar', ra: 13.3987, dec: 54.925 },
  { id: 'alkaid', ra: 13.7923, dec: 49.313 },
];
const CATALOG: Readonly<Record<string, readonly CatalogStar[]>> = { orion: ORION, bigDipper: BIG_DIPPER };

export type ConstellationStarView = {
  readonly id: string;
  readonly alt: number;
  readonly az: number;
  readonly tint?: readonly number[];
};

export type ConstellationView = {
  readonly up: boolean;
  readonly altCentroid: number;
  readonly azCentroid: number;
  readonly starsAbove: number;
  readonly stars: readonly ConstellationStarView[];
};

// ---- visibility of every catalogued constellation ----
export function constellations(
  date: Date,
  latDeg: number,
  lonDeg: number,
  sunAltDeg: number,
): Record<string, ConstellationView> {
  const lst = lstHours(date, lonDeg);
  const night = sunAltDeg < -6; // civil twilight or darker
  const out: Record<string, ConstellationView> = {};
  for (const [name, stars] of Object.entries(CATALOG)) {
    const pts = stars.map((s) => ({ id: s.id, tint: s.tint, ...altAz(s.ra, s.dec, lst, latDeg) }));
    const above = pts.filter((p) => p.alt > 0);
    const altC = pts.reduce((a, p) => a + p.alt, 0) / pts.length;
    const azC = circularMeanDeg(pts.map((p) => p.az));
    out[name] = {
      up: night && altC > 8 && above.length >= Math.ceil(stars.length * 0.7), // mostly above + clear of horizon murk
      altCentroid: +altC.toFixed(2),
      azCentroid: +azC.toFixed(1),
      starsAbove: above.length,
      stars: pts.map((p) => ({ id: p.id, alt: +p.alt.toFixed(2), az: +p.az.toFixed(1), tint: p.tint })),
    };
  }
  return out;
}

function circularMeanDeg(arr: readonly number[]): number {
  let x = 0;
  let y = 0;
  for (const a of arr) {
    x += Math.cos(a * RAD);
    y += Math.sin(a * RAD);
  }
  return norm360(Math.atan2(y, x) * DEG);
}

// ---- Moon: real geocentric position (Schlyter, low precision ~2') → RA/Dec ----
const sind = (d: number): number => Math.sin(d * RAD);
const cosd = (d: number): number => Math.cos(d * RAD);

export type MoonEquatorial = { readonly raH: number; readonly decDeg: number; readonly eclLon: number };

export function moonEquatorial(date: Date): MoonEquatorial {
  const d = date.getTime() / 86400000 + 2440587.5 - 2451543.5; // days since 1999-12-31 00:00 UT
  // Moon orbital elements
  const N = 125.1228 - 0.0529538083 * d;
  const i = 5.1454;
  const w = 318.0634 + 0.1643573223 * d;
  const a = 60.2666;
  const e = 0.0549;
  const M = norm360(115.3654 + 13.0649929509 * d);
  // eccentric & true anomaly
  let E = M + DEG * e * sind(M) * (1 + e * cosd(M));
  E = E - (E - DEG * e * sind(E) - M) / (1 - e * cosd(E)); // one Newton step
  const xv = a * (cosd(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * sind(E);
  const v = norm360(Math.atan2(yv, xv) * DEG);
  const r = Math.hypot(xv, yv);
  // ecliptic position
  const xh = r * (cosd(N) * cosd(v + w) - sind(N) * sind(v + w) * cosd(i));
  const yh = r * (sind(N) * cosd(v + w) + cosd(N) * sind(v + w) * cosd(i));
  const zh = r * (sind(v + w) * sind(i));
  let lon = Math.atan2(yh, xh) * DEG;
  let lat = Math.atan2(zh, Math.hypot(xh, yh)) * DEG;
  // main perturbations (need Sun + Moon mean longitudes)
  const Ms = norm360(356.047 + 0.9856002585 * d);
  const ws = 282.9404 + 4.70935e-5 * d;
  const Ls = norm360(Ms + ws);
  const Lm = norm360(N + w + M);
  const Dm = norm360(Lm - Ls);
  const F = norm360(Lm - N);
  lon +=
    -1.274 * sind(M - 2 * Dm) +
    0.658 * sind(2 * Dm) -
    0.186 * sind(Ms) -
    0.059 * sind(2 * M - 2 * Dm) -
    0.057 * sind(M - 2 * Dm + Ms) +
    0.053 * sind(M + 2 * Dm) +
    0.046 * sind(2 * Dm - Ms) +
    0.041 * sind(M - Ms) -
    0.035 * sind(Dm) -
    0.031 * sind(M + Ms) -
    0.015 * sind(2 * F - 2 * Dm) +
    0.011 * sind(M - 4 * Dm);
  lat +=
    -0.173 * sind(F - 2 * Dm) -
    0.055 * sind(M - F - 2 * Dm) -
    0.046 * sind(M + F - 2 * Dm) +
    0.033 * sind(F + 2 * Dm) +
    0.017 * sind(2 * M + F);
  // ecliptic -> equatorial
  const ecl = 23.4393 - 3.563e-7 * d;
  const xg = cosd(lon) * cosd(lat);
  const yg = sind(lon) * cosd(lat);
  const zg = sind(lat);
  const xe = xg;
  const ye = yg * cosd(ecl) - zg * sind(ecl);
  const ze = yg * sind(ecl) + zg * cosd(ecl);
  const raH = norm24((Math.atan2(ye, xe) * DEG) / 15);
  const decDeg = Math.atan2(ze, Math.hypot(xe, ye)) * DEG;
  return { raH, decDeg, eclLon: norm360(lon) };
}

export function moonAltAz(date: Date, latDeg: number, lonDeg: number): AltAz {
  const { raH, decDeg } = moonEquatorial(date);
  return altAz(raH, decDeg, lstHours(date, lonDeg), latDeg);
}
