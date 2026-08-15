// celestial.mjs — AstronomyEngine · Phase A
// Real celestial mechanics: given date+time+location, computes which named
// constellations are above the horizon and where (altitude/azimuth), from real
// star catalog positions (RA/Dec J2000). Pure JS — runs in Deno + Node.
// This is what makes constellations appear in their REAL seasons & positions.

const RAD = Math.PI / 180, DEG = 180 / Math.PI;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const norm360 = (d) => ((d % 360) + 360) % 360;
const norm24 = (h) => ((h % 24) + 24) % 24;

// ---- Greenwich Mean Sidereal Time (hours) ----
export function gmstHours(date) {
  const JD = date.getTime() / 86400000 + 2440587.5;
  const D = JD - 2451545.0, T = D / 36525;
  let gmst = 280.46061837 + 360.98564736629 * D + 0.000387933 * T * T - (T * T * T) / 38710000;
  return norm24(norm360(gmst) / 15);
}
// Local Sidereal Time (hours) for an east-positive longitude in degrees
export function lstHours(date, lonDeg) { return norm24(gmstHours(date) + lonDeg / 15); }

// ---- horizontal coords of a star from its RA(h)/Dec(deg) ----
export function altAz(raH, decDeg, lst, latDeg) {
  const H = (lst - raH) * 15;                        // hour angle (deg)
  const Hr = H * RAD, dr = decDeg * RAD, lr = latDeg * RAD;
  const sinAlt = Math.sin(dr) * Math.sin(lr) + Math.cos(dr) * Math.cos(lr) * Math.cos(Hr);
  const alt = Math.asin(clamp(sinAlt, -1, 1));
  const cosAz = (Math.sin(dr) - Math.sin(alt) * Math.sin(lr)) / (Math.cos(alt) * Math.cos(lr));
  let az = Math.acos(clamp(cosAz, -1, 1)) * DEG;
  if (Math.sin(Hr) > 0) az = 360 - az;               // east/west disambiguation
  return { alt: alt * DEG, az };
}

// ---- real star catalogs (RA hours, Dec degrees, J2000) ----
const ORION = [
  { id: 'betelgeuse', ra: 5.9195, dec:  7.407, tint: [1.0, 0.66, 0.48] },  // red supergiant
  { id: 'bellatrix',  ra: 5.4188, dec:  6.350, tint: [0.9, 0.93, 1.0] },
  { id: 'mintaka',    ra: 5.5334, dec: -0.299, tint: [0.9, 0.93, 1.0] },   // belt
  { id: 'alnilam',    ra: 5.6036, dec: -1.202, tint: [0.9, 0.93, 1.0] },   // belt
  { id: 'alnitak',    ra: 5.6793, dec: -1.943, tint: [0.9, 0.93, 1.0] },   // belt
  { id: 'saiph',      ra: 5.7959, dec: -9.670, tint: [0.9, 0.93, 1.0] },
  { id: 'rigel',      ra: 5.2423, dec: -8.202, tint: [0.74, 0.84, 1.0] },  // blue
];
const BIG_DIPPER = [
  { id: 'dubhe',  ra: 11.0621, dec: 61.751 },
  { id: 'merak',  ra: 11.0307, dec: 56.383 },
  { id: 'phecda', ra: 11.8972, dec: 53.695 },
  { id: 'megrez', ra: 12.2570, dec: 57.033 },
  { id: 'alioth', ra: 12.9004, dec: 55.960 },
  { id: 'mizar',  ra: 13.3987, dec: 54.925 },
  { id: 'alkaid', ra: 13.7923, dec: 49.313 },
];
const CATALOG = { orion: ORION, bigDipper: BIG_DIPPER };

// ---- visibility of every catalogued constellation ----
export function constellations(date, latDeg, lonDeg, sunAltDeg) {
  const lst = lstHours(date, lonDeg);
  const night = sunAltDeg < -6;                       // civil twilight or darker
  const out = {};
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

function circularMeanDeg(arr) {
  let x = 0, y = 0;
  for (const a of arr) { x += Math.cos(a * RAD); y += Math.sin(a * RAD); }
  return norm360(Math.atan2(y, x) * DEG);
}

// ---- Moon: real geocentric position (Schlyter, low precision ~2') → RA/Dec ----
const sind = (d) => Math.sin(d * RAD), cosd = (d) => Math.cos(d * RAD);
export function moonEquatorial(date) {
  const d = date.getTime() / 86400000 + 2440587.5 - 2451543.5;   // days since 1999-12-31 00:00 UT
  // Moon orbital elements
  const N = 125.1228 - 0.0529538083 * d, i = 5.1454;
  const w = 318.0634 + 0.1643573223 * d, a = 60.2666, e = 0.054900;
  const M = norm360(115.3654 + 13.0649929509 * d);
  // eccentric & true anomaly
  let E = M + DEG * e * sind(M) * (1 + e * cosd(M));
  E = E - (E - DEG * e * sind(E) - M) / (1 - e * cosd(E));       // one Newton step
  const xv = a * (cosd(E) - e), yv = a * Math.sqrt(1 - e * e) * sind(E);
  const v = norm360(Math.atan2(yv, xv) * DEG), r = Math.hypot(xv, yv);
  // ecliptic position
  let xh = r * (cosd(N) * cosd(v + w) - sind(N) * sind(v + w) * cosd(i));
  let yh = r * (sind(N) * cosd(v + w) + cosd(N) * sind(v + w) * cosd(i));
  let zh = r * (sind(v + w) * sind(i));
  let lon = Math.atan2(yh, xh) * DEG, lat = Math.atan2(zh, Math.hypot(xh, yh)) * DEG;
  // main perturbations (need Sun + Moon mean longitudes)
  const Ms = norm360(356.0470 + 0.9856002585 * d), ws = 282.9404 + 4.70935e-5 * d;
  const Ls = norm360(Ms + ws), Lm = norm360(N + w + M), Dm = norm360(Lm - Ls), F = norm360(Lm - N);
  lon += -1.274 * sind(M - 2 * Dm) + 0.658 * sind(2 * Dm) - 0.186 * sind(Ms)
       - 0.059 * sind(2 * M - 2 * Dm) - 0.057 * sind(M - 2 * Dm + Ms) + 0.053 * sind(M + 2 * Dm)
       + 0.046 * sind(2 * Dm - Ms) + 0.041 * sind(M - Ms) - 0.035 * sind(Dm)
       - 0.031 * sind(M + Ms) - 0.015 * sind(2 * F - 2 * Dm) + 0.011 * sind(M - 4 * Dm);
  lat += -0.173 * sind(F - 2 * Dm) - 0.055 * sind(M - F - 2 * Dm) - 0.046 * sind(M + F - 2 * Dm)
       + 0.033 * sind(F + 2 * Dm) + 0.017 * sind(2 * M + F);
  // ecliptic -> equatorial
  const ecl = 23.4393 - 3.563e-7 * d;
  const xg = cosd(lon) * cosd(lat), yg = sind(lon) * cosd(lat), zg = sind(lat);
  const xe = xg, ye = yg * cosd(ecl) - zg * sind(ecl), ze = yg * sind(ecl) + zg * cosd(ecl);
  const raH = norm24(Math.atan2(ye, xe) * DEG / 15);
  const decDeg = Math.atan2(ze, Math.hypot(xe, ye)) * DEG;
  return { raH, decDeg, eclLon: norm360(lon) };
}
export function moonAltAz(date, latDeg, lonDeg) {
  const { raH, decDeg } = moonEquatorial(date);
  return altAz(raH, decDeg, lstHours(date, lonDeg), latDeg);
}

// ---- self-test: node celestial.mjs ----
if (typeof process !== 'undefined' && process.argv && import.meta.url === `file://${process.argv[1]}`) {
  const lat = 25.91, lon = -80.31;
  const cases = [
    ['Ago 11 2026, 9pm EDT (verano)',  '2026-08-12T01:00:00Z', 5],   // Orion should be DOWN
    ['Ago 11 2026, 5am EDT (pre-alba)','2026-08-11T09:00:00Z', -12], // Orion rising
    ['Ene 15 2026, 9pm EST (invierno)','2026-01-16T02:00:00Z', -30], // Orion should be HIGH
    ['Abr 15 2026, 9pm EDT',           '2026-04-16T01:00:00Z', -20], // Big Dipper high
  ];
  for (const [label, iso, sunAlt] of cases) {
    const c = constellations(new Date(iso), lat, lon, sunAlt);
    console.log(`\n${label}`);
    console.log(`  Orión:     ${c.orion.up ? 'VISIBLE ✅' : 'no visible'}  alt=${c.orion.altCentroid}°  az=${c.orion.azCentroid}°  (${c.orion.starsAbove}/7 estrellas)`);
    console.log(`  Osa Mayor: ${c.bigDipper.up ? 'VISIBLE ✅' : 'no visible'}  alt=${c.bigDipper.altCentroid}°  az=${c.bigDipper.azCentroid}°  (${c.bigDipper.starsAbove}/7)`);
  }
}
