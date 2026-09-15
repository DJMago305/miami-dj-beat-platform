#!/usr/bin/env node
// tools/dj-profiles/build.mjs — Perfiles públicos de DJ (SEO/GEO/AEO)
//
// Genera una página estática real por cada DJ elegible en web/dj/<slug>.html
// — título, meta, canonical y JSON-LD Person horneados en el HTML (no dependen
// de JS para que Google/Siri/ChatGPT los lean), a diferencia de profile.html
// (que sigue existiendo tal cual, sin tocar — es la vista interactiva en vivo,
// enlazada desde aquí para quien quiera más detalle/disponibilidad real).
//
// Elegibilidad: requiere bio_short + photo_url reales (ninguna página pobre,
// por regla explícita del informe SEO). Un DJ sin esos dos campos queda fuera
// hasta que complete su perfil — y entra solo, sin tocar este script, la
// próxima vez que se corra.
//
// Orden: cuentas de pago/graduadas primero, gratis después (mismo criterio
// que ya usa find-dj.html vía MDB_SUBSCRIPTION.searchRankScore), y dentro de
// cada grupo, alfabético.
//
//   node tools/dj-profiles/build.mjs          → genera web/dj/*.html + actualiza sitemap.xml
//   node tools/dj-profiles/build.mjs --dry-run → solo imprime el PLAN, no escribe nada
//   node tools/dj-profiles/build.mjs --dry-run --reconcile → además muestra qué borraría
//   MDJB_FIXTURE=<ruta.json> node ... --dry-run → corre contra un fixture local, sin red
//   MDJB_OUTPUT_DIR=<ruta> node ...            → redirige TODA escritura (perfiles,
//     directorio.html, equipo.html, sitemap.xml, slug-manifest) a esa carpeta en vez
//     de web/ — para validar una corrida REAL sin tocar jamás el sitio publicado.
//
// Sin dependencias externas — usa fetch nativo (Node 18+). No modifica
// profile.html, directory.html, find-dj.html ni ninguna tabla de Supabase.
//
// ── Contrato de seguridad (Master Correction Order) ────────────────────────
// 1. La SALIDA APROBADA es la especificación. Los 3 perfiles en vivo
//    (djmago305 / djsolitario / djyuyo) + directorio.html + equipo.html son
//    trabajo cerrado: este generador CONVERGE hacia ellos, nunca al revés.
// 2. PLAN → VALIDATE → WRITE: nada toca el disco hasta que todas las
//    validaciones pasen (colisión de slug, roster vacío, ownership, ancla de
//    identidad). Los borrados ocurren al final y solo con --reconcile.
// 3. --dry-run ⇒ CERO escrituras en disco. El script nunca escribe en la base
//    de datos (solo SELECT vía PostgREST).

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join, dirname, basename, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const WEB = join(ROOT, "web");

// MDJB_OUTPUT_DIR — override de validación local, mismo patrón que MDJB_FIXTURE
// (Corrección de la orden "FINAL LOCAL VALIDATION"): redirige TODA escritura
// (perfiles, directorio, equipo.html, sitemap.xml, slug-manifest) a un
// directorio scratch aislado, para poder correr una generación REAL sin tocar
// jamás web/. Sin esta variable el comportamiento es idéntico al de siempre.
const OUTPUT_DIR_OVERRIDE = process.env.MDJB_OUTPUT_DIR || null;
const OUTPUT_BASE = OUTPUT_DIR_OVERRIDE
  ? (isAbsolute(OUTPUT_DIR_OVERRIDE) ? OUTPUT_DIR_OVERRIDE : join(ROOT, OUTPUT_DIR_OVERRIDE))
  : WEB;
const OUT_DIR = join(OUTPUT_BASE, "dj");
const SITEMAP = join(OUTPUT_BASE, "sitemap.xml");
const EQUIPO_PATH = join(OUTPUT_BASE, "equipo.html");
const SLUG_MANIFEST = OUTPUT_DIR_OVERRIDE
  ? join(OUTPUT_BASE, ".slug-manifest.json")
  : join(HERE, ".slug-manifest.json");

/* ═══ 0) origen canónico — fuente única de verdad ═══════════════════════════
   Corrección 2: TODA URL absoluta que emite este generador (canonical, Person
   url, @id, JSON-LD, <loc> del sitemap, og:url) sale de aquí. El sitio vive en
   www.miamidjbeat.com; emitir el host pelado partía la señal de canonical en
   dos hosts distintos. No se toca ningún otro archivo del repo: esto solo
   gobierna lo que ESTE generador escribe. */
export const SITE_ORIGIN = "https://www.miamidjbeat.com";
export const ORG_ID = `${SITE_ORIGIN}/#organization`;
export const ORG_NODE = Object.freeze({
  "@type": "EntertainmentBusiness",
  "@id": ORG_ID,
  name: "Miami DJ Beat LLC",
  url: `${SITE_ORIGIN}/`,
});

/* ═══ 0b) identidad de persona — resultado cerrado, horneado en el código ═══
   Person Identity Normalization (trabajo aprobado y ya en producción): el
   humano detrás de djmago305 y de la fila `owner` es UNA sola entidad, con un
   @id compartido. Es un mapa EXPLÍCITO por slug a propósito, no una regla
   derivada de `full_name`: derivarlo de full_name le daría @id/alternateName
   también a djsolitario y djyuyo, que en la salida aprobada NO lo llevan —
   eso sería una regresión contra la especificación. */
export const PERSON_IDENTITY = Object.freeze({
  djmago305: {
    personId: `${SITE_ORIGIN}/dj/djmago305.html#gerardo-a-valle`,
    name: "Gerardo A Valle",
    alternateName: "DJMago305",
    jobTitle: ["Fundador & Propietario", "DJ"],
    identityLine: "Gerardo A Valle, conocido profesionalmente como DJMago305.",
  },
  owner: {
    personId: `${SITE_ORIGIN}/dj/djmago305.html#gerardo-a-valle`,
    name: "Gerardo A Valle",
    alternateName: "DJMago305",
  },
});

/* ═══ 0c) ancla de identidad ════════════════════════════════════════════════
   Corrección 11: djmago305.html es la página de identidad del fundador. Si la
   reconciliación llegara a calcularla como candidata a borrado por CUALQUIER
   motivo, se aborta la corrida entera. Nunca se borra automáticamente. */
export const IDENTITY_ANCHOR_SLUG = "djmago305";

/* ═══ 0d) aggregateRating en JSON-LD ════════════════════════════════════════
   Corrección 1 y corrección 17 se cruzan aquí, y la corrección 1 (converger a
   la salida aprobada) manda:
     · La salida aprobada NO lleva aggregateRating en NINGUNO de los 3 — se
       quitó en un commit previo, a propósito.
     · djmago305 sí tiene review_count=2, así que la regla "review_count > 0"
       de la corrección 17, sola, lo volvería a emitir → regresión.
   Resolución: la insignia ★ visible se rige por review_count > 0 (corrección
   17, que elimina el ★ 1 (0) fabricado de djsolitario/djyuyo), y el
   aggregateRating de JSON-LD queda apagado por este interruptor. Un solo
   cambio de línea lo reactiva si el PO lo decide; hasta entonces la salida
   aprobada es la ley. */
export const EMIT_AGGREGATE_RATING_JSONLD = false;

/* ═══ 0e) flags e entorno ══════════════════════════════════════════════════ */

const ARGV = process.argv.slice(2);
export const DRY_RUN = ARGV.includes("--dry-run");
export const RECONCILE = ARGV.includes("--reconcile");
// Corrección 14: no se habilita hoy. Existe solo como punto de entrada
// documentado para un futuro caso legítimo de roster vacío.
export const ALLOW_EMPTY_ROSTER = ARGV.includes("--allow-empty-roster");

// Valores de PRODUCCIÓN. Siguen aquí SOLO como conveniencia de --dry-run
// (lectura pura, sin efectos). Corrección 3: una corrida REAL que no declare
// entorno aborta antes de cualquier fetch — nunca cae en silencio a PROD.
const PROD_SUPABASE_URL = "https://hkuvuqupbxwkiykxvqdr.supabase.co";
const PROD_SUPABASE_ANON_KEY = "sb_publishable_IMhi16lHj2dAk51AdUOK8w_U7s89-Ff";

export function maskKey(key) {
  if (!key) return "(ausente)";
  const m = String(key).match(/^(sb_[a-z]+_|eyJ)/);
  return m ? `${m[1]}… (presente, ${String(key).length} chars)` : `(presente, ${String(key).length} chars)`;
}

export function projectRefFromUrl(url) {
  const m = String(url || "").match(/^https:\/\/([a-z0-9]+)\.supabase\.co/);
  return m ? m[1] : "(desconocido)";
}

/**
 * Corrección 3 — resuelve el entorno de forma EXPLÍCITA.
 * Devuelve { env, url, key, source, fixture } o { abort: "<motivo>" }.
 * En modo REAL (sin --dry-run) exige MDJB_ENV o SUPABASE_URL+SUPABASE_ANON_KEY.
 */
export function resolveEnvironment(env = process.env, { dryRun = DRY_RUN } = {}) {
  const fixture = env.MDJB_FIXTURE || null;
  if (fixture) {
    return { env: "FIXTURE", url: null, key: null, source: "MDJB_FIXTURE", fixture };
  }
  const declared = (env.MDJB_ENV || "").trim().toUpperCase();
  const url = env.SUPABASE_URL || null;
  const key = env.SUPABASE_ANON_KEY || null;

  if (url && key) {
    return { env: declared || (url === PROD_SUPABASE_URL ? "PROD" : "TEST"), url, key, source: "SUPABASE_URL/SUPABASE_ANON_KEY", fixture: null };
  }
  if (declared === "PROD") {
    return { env: "PROD", url: PROD_SUPABASE_URL, key: PROD_SUPABASE_ANON_KEY, source: "MDJB_ENV=PROD", fixture: null };
  }
  if (declared === "TEST") {
    return { abort: "MDJB_ENV=TEST exige SUPABASE_URL y SUPABASE_ANON_KEY explícitos (no hay valores TEST horneados: dj_profiles en TEST es otra tabla, ver corrección 4)." };
  }
  if (!dryRun) {
    return { abort: "modo REAL sin entorno declarado. Exporta MDJB_ENV=PROD (o SUPABASE_URL + SUPABASE_ANON_KEY) antes de correr sin --dry-run." };
  }
  // --dry-run sin declarar nada: lectura pura, se permite, pero se anuncia.
  return { env: "PROD", url: PROD_SUPABASE_URL, key: PROD_SUPABASE_ANON_KEY, source: "default de --dry-run (solo lectura)", fixture: null };
}

export function printEnvironmentBanner(resolved, { dryRun = DRY_RUN, outDir = OUT_DIR, log = console.log } = {}) {
  log(`ENVIRONMENT: ${resolved.env}`);
  log(`SUPABASE PROJECT REF: ${resolved.fixture ? "(ninguno — fixture local)" : projectRefFromUrl(resolved.url)}`);
  log(`SUPABASE KEY: ${resolved.fixture ? "(ninguna — fixture local)" : maskKey(resolved.key)}`);
  log(`ENV SOURCE: ${resolved.source}`);
  log(`MODE: ${dryRun ? "DRY-RUN" : "REAL"}`);
  log(`OUTPUT TARGET: ${outDir}`);
}

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* titleCaseCity — dj_profiles.city llega tal cual lo escribió el DJ ("homestead",
   "MIAMI", "miami beach"): confirmado contra un caso real (DJSolitario). Antes
   pasaba inadvertido porque el <title> ignoraba `city` y siempre decía "Miami";
   ahora que el título usa la ciudad real (decisión SEO: cada perfil compite por
   su propia ciudad en vez de canibalizar "Miami" entre sí), el formato sí es
   visible en <title>/og:title, no solo en el texto de la página. Normaliza a
   Title Case; no traduce ni corrige el nombre, solo la capitalización. */
const titleCaseCity = (s) =>
  String(s ?? "").trim().replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

/* Corrección 16 — escJy estaba definido pero NUNCA se invocaba en el camino de
   serialización de JSON-LD: un valor con `</script>` dentro (bio, nombre, URL
   social) cerraba el bloque y podía inyectar HTML ejecutable. Se escapa TODO
   `<` del JSON serializado: en JSON.stringify los únicos `<` posibles viven
   dentro de strings, y `<` es un escape JSON válido, así que el objeto
   que parsea el rastreador es idéntico — solo deja de existir la secuencia de
   cierre. Verificado: ninguno de los 3 archivos aprobados contiene `<` en su
   JSON-LD, así que esto es byte-idéntico contra la salida aprobada. */
export const escJs = (s) => String(s ?? "").replace(/</g, "\\u003C");
export const jsonLd = (obj) => escJs(JSON.stringify(obj));

/* ═══ 1) traer datos reales, solo lectura ═══════════════════════════════ */

export const FETCH_COLUMNS = [
  "user_id", "dj_slug", "stage_name", "full_name", "photo_url", "background_url",
  "bio", "bio_short", "bio_en", "city", "roles", "artist_specialty", "plan", "plan_type",
  "plan_status", "is_premium", "available", "rating", "review_count", "is_resident",
  // Corrección 5 — compuerta editorial. La columna todavía NO existe en la
  // base: la migración que la crea está preparada en supabase/migrations/ y
  // NO se ha aplicado. Hasta que se aplique y se rellenen las 3 filas buenas,
  // esta condición sola dejaría a TODO el mundo inelegible — por eso la
  // migración + backfill debe aterrizar ANTES de apuntar esto a PROD real.
  "seo_publish_status",
  "instagram_url", "facebook_url", "tiktok_url", "youtube_url", "soundcloud_url",
  "apple_music_url", "spotify_url", "beatport_url", "website_url",
];

/* Corrección 4 — adaptador de fixture local.
   `dj_profiles` en el proyecto de PRUEBA es OTRA tabla (stub de identidad V2,
   5 columnas, sin relación con perfiles de DJ): leerla como si fuera data de
   perfiles sería falso, y escribirla está prohibido. Por eso la estrategia de
   pruebas es un fixture JSON local — cero red, cero base de datos, cero
   cambios de esquema. Es lo que usa build.test.mjs. */
export function loadFixture(path) {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const rows = Array.isArray(raw) ? raw : raw.rows;
  if (!Array.isArray(rows)) throw new Error(`Fixture inválido (se esperaba un array o {rows:[...]}): ${path}`);
  return rows;
}

export async function fetchDJs(resolved) {
  if (resolved.fixture) return loadFixture(resolved.fixture);
  const cols = FETCH_COLUMNS.join(",");
  const res = await fetch(`${resolved.url}/rest/v1/public_dj_profiles?select=${cols}`, {
    headers: { apikey: resolved.key, Authorization: `Bearer ${resolved.key}` },
  });
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export function isPaid(dj) {
  const t = `${dj.plan || ""} ${dj.plan_type || ""}`.toLowerCase();
  return /pro|founder|premium/.test(t) || dj.is_premium === true;
}

// public_dj_profiles mezcla todo el talento de "Entretenimiento y Talento"
// (bartenders, músicos, staff, etc.), no solo DJs — este generador es
// específicamente para el punto 4/5 del informe SEO ("perfiles públicos de
// DJs"), así que solo entra quien tenga un rol de DJ real. El resto de
// categorías (Hora Loca, MC, Payasos, Músicos...) ya tiene su propia puerta
// pública en services.html → "Entretenimiento y Talento" y no se toca aquí.
export function isActuallyDJ(dj) {
  const hay = `${dj.artist_specialty || ""} ${dj.roles || ""}`.toLowerCase();
  return /\bdj\b/.test(hay);
}

/* Corrección 5 — compuerta editorial `seo_publish_status`.
   FALLA CERRADA: solo el literal 'approved' publica. Ausente, null, 'pending'
   o cualquier otro valor ⇒ NO elegible. Es deliberado: una columna que aún no
   existe deja a todos fuera antes que publicar a alguien sin aprobación. */
export function isSeoApproved(dj) {
  return dj.seo_publish_status === "approved";
}

export function qualifies(dj) {
  // Owner es una cuenta separada de DJ (regla del proyecto: Owner nunca es
  // "artista") — excluida aunque tenga foto/bio, junto con cualquier fila
  // marcada Staff en vez de un rol de talento real.
  if (dj.dj_slug === "owner" || /\bstaff\b/i.test(dj.artist_specialty || "")) return false;
  if (!isActuallyDJ(dj)) return false;
  if (!isSeoApproved(dj)) return false;
  return Boolean((dj.bio || dj.bio_short) && dj.photo_url && dj.stage_name && dj.dj_slug);
}

// Ninguna reserva debe saltarse la plataforma: si un bio trae un teléfono
// personal suelto (pasó con un caso real de bartender), se quita antes de
// publicar. Toda conversión pasa por el CTA de Consultar Disponibilidad.
function stripPhoneNumbers(text) {
  return String(text || "").replace(/\+?\d[\d\s().-]{7,}\d/g, "").replace(/[ \t]{2,}/g, " ").trim();
}

/* ═══ 2) mapear especialidad → páginas de servicio existentes ══════════ */

const SERVICE_MAP = [
  { re: /quince/i, href: "./quinceanera.html", label: "Quinceañera DJ" },
  { re: /wedding|boda/i, href: "./weddings.html", label: "Wedding DJ" },
  { re: /corporate|corporativo/i, href: "./corporate.html", label: "Corporate DJ" },
  { re: /latin|open.?format/i, href: "./latin-dj.html", label: "Latin & Open Format DJ" },
  { re: /keys|cayos/i, href: "./florida-keys.html", label: "Florida Keys DJ" },
];

function relatedServices(dj) {
  const hay = `${dj.artist_specialty || ""} ${dj.roles || ""}`;
  const hits = SERVICE_MAP.filter((s) => s.re.test(hay));
  return hits.length ? hits : [{ href: "./services.html", label: "Servicios" }];
}

// Copiados literales de SOCIAL_ICONS en dj-profile.html (línea ~4589) — no
// se inventan íconos nuevos, mismo banco que ya usa la vista real.
const SOCIAL_SVG = {
  instagram_url: { label: "Instagram", svg: '<svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>' },
  facebook_url: { label: "Facebook", svg: '<svg viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>' },
  tiktok_url: { label: "TikTok", svg: '<svg viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.78a4.85 4.85 0 0 1-1.01-.09z"/></svg>' },
  youtube_url: { label: "YouTube", svg: '<svg viewBox="0 0 24 24"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.6 5.8a3 3 0 0 0 2.1 2.1C4.5 20.5 12 20.5 12 20.5s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.5 15.5v-7l6.5 3.5-6.5 3.5z"/></svg>' },
  soundcloud_url: { label: "SoundCloud", svg: '<svg viewBox="0 0 24 24"><path d="M12 7c-2.8 0-5.1 2.3-5.1 5.1 0 .2 0 .5.1.7-1.1.2-2 .8-2.6 1.7-.5 0-1 .2-1.4.5-.5.4-.9 1-.9 1.7 0 1.2 1 2.3 2.3 2.3h12.3C18.2 19 20 17.2 20 15c0-1.8-1.2-3.3-2.8-3.8-.2-2.3-2.1-4.2-4.4-4.2-.3 0-.5 0-.8.1zM10.8 19h-1.2v-7.6h1.2V19zm2.4 0h-1.2v-9.6h1.2V19zm2.4 0h-1.2v-7.6h1.2V19z" fill="currentColor"/></svg>' },
  apple_music_url: { label: "Apple Music", svg: '<svg viewBox="0 0 361 361"><path d="M254.5,55c-0.87,0.08-8.6,1.45-9.53,1.64l-107,21.59l-0.04,0.01c-2.79,0.59-4.98,1.58-6.67,3 c-2.04,1.71-3.17,4.13-3.6,6.95c-0.09,0.6-0.24,1.82-0.24,3.62c0,0,0,109.32,0,133.92c0,3.13-0.25,6.17-2.37,8.76 c-2.12,2.59-4.74,3.37-7.81,3.99c-2.33,0.47-4.66,0.94-6.99,1.41c-8.84,1.78-14.59,2.99-19.8,5.01 c-4.98,1.93-8.71,4.39-11.68,7.51c-5.89,6.17-8.28,14.54-7.46,22.38c0.7,6.69,3.71,13.09,8.88,17.82 c3.49,3.2,7.85,5.63,12.99,6.66c5.33,1.07,11.01,0.7,19.31-0.98c4.42-0.89,8.56-2.28,12.5-4.61c3.9-2.3,7.24-5.37,9.85-9.11 c2.62-3.75,4.31-7.92,5.24-12.35c0.96-4.57,1.19-8.7,1.19-13.26l0-116.15c0-6.22,1.76-7.86,6.78-9.08c0,0,88.94-17.94,93.09-18.75 c5.79-1.11,8.52,0.54,8.52,6.61l0,79.29c0,3.14-0.03,6.32-2.17,8.92c-2.12,2.59-4.74,3.37-7.81,3.99 c-2.33,0.47-4.66,0.94-6.99,1.41c-8.84,1.78-14.59,2.99-19.8,5.01c-4.98,1.93-8.71,4.39-11.68,7.51 c-5.89,6.17-8.49,14.54-7.67,22.38c0.7,6.69,3.92,13.09,9.09,17.82c3.49,3.2,7.85,5.56,12.99,6.6c5.33,1.07,11.01,0.69,19.31-0.98 c4.42-0.89,8.56-2.22,12.5-4.55c3.9-2.3,7.24-5.37,9.85-9.11c2.62-3.75,4.31-7.92,5.24-12.35c0.96-4.57,1-8.7,1-13.26V64.46 C263.54,58.3,260.29,54.5,254.5,55z" fill="currentColor" transform="scale(1.1) translate(-20, -20)"/></svg>' },
  // Spotify/Beatport — glyph oficial tomado de simple-icons (cdn.jsdelivr.net/npm/simple-icons),
  // no reconstruido de memoria: la columna spotify_url ya existía en FETCH_COLUMNS pero
  // nunca tuvo ícono; beatport_url es campo nuevo (ver migración 20260913130000).
  spotify_url: { label: "Spotify", svg: '<svg viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" fill="currentColor"/></svg>' },
  beatport_url: { label: "Beatport", svg: '<svg viewBox="0 0 24 24"><path d="M21.429 17.055a7.114 7.114 0 0 1-.794 3.246 6.917 6.917 0 0 1-2.181 2.492 6.698 6.698 0 0 1-3.063 1.163 6.653 6.653 0 0 1-3.239-.434 6.796 6.796 0 0 1-2.668-1.932 7.03 7.03 0 0 1-1.481-2.983 7.124 7.124 0 0 1 .049-3.345 7.015 7.015 0 0 1 1.566-2.937l-4.626 4.73-2.421-2.479 5.201-5.265a3.791 3.791 0 0 0 1.066-2.675V0h3.41v6.613a7.172 7.172 0 0 1-.519 2.794 7.02 7.02 0 0 1-1.559 2.353l-.153.156a6.768 6.768 0 0 1 3.49-1.725 6.687 6.687 0 0 1 3.845.5 6.873 6.873 0 0 1 2.959 2.564 7.118 7.118 0 0 1 1.118 3.8Zm-3.089 0a3.89 3.89 0 0 0-.611-2.133 3.752 3.752 0 0 0-1.666-1.424 3.65 3.65 0 0 0-2.158-.233 3.704 3.704 0 0 0-1.92 1.037 3.852 3.852 0 0 0-1.031 1.955 3.908 3.908 0 0 0 .205 2.213c.282.7.76 1.299 1.374 1.721a3.672 3.672 0 0 0 2.076.647 3.637 3.637 0 0 0 2.635-1.096c.347-.351.622-.77.81-1.231.188-.461.285-.956.286-1.456Z" fill="currentColor"/></svg>' },
};

/* ═══ 3) plantilla ═══════════════════════════════════════════════════════ */

// Header/footer/scripts idénticos a los del resto del sitio (copiados
// literales de weddings.html, solo el timestamp de cache-bust cambia) —
// compartidos entre renderPage() y renderIndexPage() para no duplicar el
// bloque dos veces.
const HEADER_HTML = `  <header class="header mdj-header-unified" id="mainHeader">
    <div class="header-top">
      <div class="container">
        <div class="brand">
          <picture>
            <source srcset="./assets/branding/logo-transparent.webp" type="image/webp">
            <img src="./assets/branding/logo-transparent-fallback.png" alt="Miami DJ Beat Logo" class="logo-img-eagle" width="256" height="256">
          </picture>
          <div class="brand-letters-wrapper">
            <picture>
              <source srcset="./assets/branding/logo-transparent-letras.webp" type="image/webp">
              <img src="./assets/branding/logo-transparent-letras.png" alt="Miami DJ Beat Letters" class="brand-letters-img" width="384" height="384">
            </picture>
          </div>
        </div>

        <div class="header-actions">
          <a href="./login.html?plan=pro" class="btn-pill gold" id="header-get-pro-btn" data-i18n="btn-get-pro">Get PRO</a>
          <a href="./login.html?signup=free" class="btn-pill" id="header-subscribe-free-btn" data-i18n="btn-subscribe-free">Suscripción gratis</a>
          <span id="header-djpro-badge" class="header-djpro-badge" style="display: none;" aria-label="DJPRO">DJPRO</span>
          <div class="mdj-header-r1-auth-cluster">

            <div class="lang-switcher">
            <span class="lang-btn" data-lang="es">ES</span>
            <span class="lang-pipe">|</span>
            <span class="lang-btn active" data-lang="en">EN</span>
          </div>

            <a href="./login.html" id="header-login-btn" class="btn-pill gold" data-i18n="btn-login">Log in</a>

            <div class="account session-pending" id="header-auth-zone" style="display: none;">
              <a class="account-btn" id="accountBtn" href="./dj-profile.html" title="Mi perfil" aria-label="Mi perfil">
                <img class="avatar" src="./assets/dj-avatar-placeholder.png" alt="" />
              </a>
            </div>

          </div>

          <div class="header-avatar-cart-row" aria-label="Account and cart">
<a href="./shop.html" id="header-cart-link" class="header-cart-btn" title="Cart" aria-label="Shopping cart">
              <span aria-hidden="true">🛒</span>
              <span id="header-cart-count" class="header-cart-count" hidden></span>
            </a>
          </div>
          <div class="header-search-wrap">
            <input type="search" id="header-smart-search" class="header-smart-search"
              placeholder="Search DJs, gear, services…" autocomplete="off" enterkeyhint="search" />
          </div>
        </div>

        <button class="mobile-menu-btn" id="mobileMenuBtn" type="button" aria-label="Menu">
          <span></span>
          <span></span>
          <span></span>
        </button>

        <div class="mobile-overlay" id="mobileMenu">
          <nav class="mobile-nav">
            <a href="./index.html" data-i18n="nav-home" data-mdj-nav="home">Home</a>
            <a href="./rentals.html" data-i18n="nav-services" data-mdj-nav="services">Services</a>
            <a href="./events.html" data-i18n="nav-rentals" data-mdj-nav="venues">Events</a>
            <a href="./shop.html" style="color:#c5a059;font-weight:800;" data-mdj-nav="shop">Shop</a>
            <a href="./dj-tools.html" data-i18n="nav-tools" data-mdj-nav="tools">DJ Tools</a>
            <a href="./jobs.html" data-i18n="nav-jobs" data-mdj-nav="jobs">Jobs</a>
            <a href="./contact.html" data-i18n="nav-contact" data-mdj-nav="contact">Contacto</a>
            <a href="./login.html?signup=free" id="header-subscribe-free-mobile" data-i18n="btn-subscribe-free"
              style="color:rgba(255,255,255,0.88); font-weight:800;">Suscripción gratis</a>
            <a href="./login.html" id="header-login-btn-mobile" data-i18n="btn-login"
              style="color:var(--gold); font-weight:800;">Entrar</a>
            <a href="./dj-profile.html" id="nav-my-profile-mobile"
              style="display:none; color:var(--gold); font-weight:900;" data-i18n="menu-account">MY PROFILE</a>
          </nav>
        </div>
      </div>
    </div>
    <div class="header-nav">
      <div class="container">
        <nav class="nav top-nav mdj-mainnav-flex" id="mainNav">
    <a href="./index.html" data-i18n="nav-home" data-mdj-nav="home" data-mdj-slot="1">Inicio</a>
    <a href="./rentals.html" data-i18n="nav-services" data-mdj-nav="services" data-mdj-slot="2">Servicios</a>
    <a href="./events.html" data-i18n="nav-rentals" data-mdj-nav="venues" data-mdj-slot="3">Eventos</a>
    <a href="./shop.html" style="color:var(--gold);font-weight:800;" data-i18n="nav-shop" data-mdj-nav="shop" data-mdj-slot="4">Shop</a>
    <a href="./client-account.html" id="mainNav-config-link" class="mdj-config-mainnav mdj-mainnav-reserved-slot" data-mdj-nav="config" data-i18n="nav-config" data-mdj-slot="5" aria-hidden="true" tabindex="-1">⚙️ CONFIG</a>
    <a href="./jobs.html" data-i18n="nav-jobs" data-mdj-nav="jobs" data-mdj-slot="6">Trabajos</a>
    <a href="./contact.html" data-i18n="nav-contact" data-mdj-nav="contact" data-mdj-slot="7">Contacto</a>
    <a id="mainNav-mi-portal-link" class="mdj-mi-portal-mainnav mdj-mi-portal-gold mdj-mi-portal--guest" href="./client-portal.html" data-mdj-nav="mi-portal" data-mdj-slot="8" aria-hidden="true" tabindex="-1">MI PERFIL</a>
  </nav>

      </div>
    </div>
  </header>`;

const FOOTER_AND_SCRIPTS_HTML = `  <footer class="footer">
    <div class="container" style="text-align:center;padding:24px 16px;">
      <div class="mdjb-footer-services" style="margin-bottom:14px;font-size:13px;color:rgba(255,255,255,0.6);">
        <a href="./events.html" style="color:inherit;text-decoration:none;">Event Production</a> ·
        <a href="./rentals.html" style="color:inherit;text-decoration:none;">DJ Equipment Rental</a> ·
        <a href="./weddings.html" style="color:inherit;text-decoration:none;">Wedding DJ</a> ·
        <a href="./quinceanera.html" style="color:inherit;text-decoration:none;">Quinceañera DJ</a> ·
        <a href="./corporate.html" style="color:inherit;text-decoration:none;">Corporate Events</a> ·
        <a href="./latin-dj.html" style="color:inherit;text-decoration:none;">Latin &amp; Open-Format DJ</a> ·
        <a href="./florida-keys.html" style="color:inherit;text-decoration:none;">Florida Keys Destination DJ</a> ·
        <a href="./dj/directorio.html" style="color:inherit;text-decoration:none;">Directorio de DJs</a> ·
        <a href="./equipo.html" style="color:inherit;text-decoration:none;">Nuestro Equipo</a>
      </div>
      <div>© 2026 Miami DJ Beat LLC.</div>
    </div>
  </footer>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3"></script>
  <script>
  (function () {
      var mdjLibAusente = !(window.supabase && typeof window.supabase.createClient === 'function');
      if (mdjLibAusente) {
          document.write('<script src="./vendor/supabase-js-2.112.3.legacy.js?v=20260818-safari-legacy"><\\/script>');
      }
  })();
  </script>
  <script src="./supabase-config.js?v=20260904-dj-profiles"></script>
  <script src="./translations.js?v=20260904-dj-profiles"></script>
  <script src="./i18n.js?v=20260904-dj-profiles"></script>
  <script src="./header-smart-search.js?v=20260904-dj-profiles"></script>
  <script src="./mdj-identity.js?v=20260904-dj-profiles"></script>
  <script src="./auth.js?v=20260904-dj-profiles"></script>
  <script src="./mdjb-shared-header.js?v=20260904-dj-profiles"></script>
  <script src="./mdj-mainnav-infinite.js?v=20260904-dj-profiles"></script>
  <script src="./mdj-mobile-header-fix.js?v=20260904-dj-profiles"></script>
`;

/* Corrección 18 — OG/Twitter. Todos los valores salen de data que el
   generador YA tiene (metaDesc, canonical, photo_url/background_url). No se
   inventa ni se pide nada nuevo. */
export function socialMetaTags({ title, description, image, url, type }) {
  return [
    `  <meta property="og:type" content="${esc(type)}" />`,
    `  <meta property="og:title" content="${esc(title)}" />`,
    `  <meta property="og:description" content="${description}" />`,
    `  <meta property="og:url" content="${esc(url)}" />`,
    `  <meta property="og:image" content="${esc(image)}" />`,
    `  <meta name="twitter:card" content="summary_large_image" />`,
    `  <meta name="twitter:title" content="${esc(title)}" />`,
    `  <meta name="twitter:description" content="${description}" />`,
    `  <meta name="twitter:image" content="${esc(image)}" />`,
  ].join("\n");
}

export const SITE_OG_IMAGE = `${SITE_ORIGIN}/assets/branding/logo-transparent-fallback.png`;

/* La salida aprobada normaliza la localidad en el dato estructurado
   ("homestead" en pantalla → "Homestead" en addressLocality) y la deja cruda
   en el texto visible. Se reproduce exactamente eso: sin efecto sobre "Miami"
   ni "Hialeah", que ya vienen capitalizados. */
export function titleCaseLocality(city) {
  return String(city || "").replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
}

export function renderPage(dj) {
  const name = dj.stage_name;
  const bio = stripPhoneNumbers(dj.bio || dj.bio_short || "");
  const bioParas = bio.split(/\n{2,}/).filter(Boolean);
  // Bilingüe real cuando existe bio_en: i18n.js ya pone lang="es"/"en" en
  // <html> al cambiar el switch (verificado en i18n.js) — se aprovecha ESE
  // atributo con CSS en vez de inventar un mecanismo de idioma nuevo. Si no
  // hay bio_en (caso real: DJSolitario, Owner), se muestra el único bio
  // disponible sin importar el idioma activo — no se inventa traducción.
  const bioEn = stripPhoneNumbers(dj.bio_en || "");
  const bioEnParas = bioEn ? bioEn.split(/\n{2,}/).filter(Boolean) : null;
  const city = titleCaseCity(dj.city) || "Miami";
  const specialtyTags = (dj.artist_specialty || dj.roles || "")
    .split(/[·,]/).map((s) => s.trim()).filter(Boolean).slice(0, 8);
  const services = relatedServices(dj);
  const title = `${esc(name)} — DJ en ${esc(city)} | Miami DJ Beat`;
  // Colapsar saltos de línea del bio ANTES de cortar a 155 caracteres — un
  // \n crudo dentro de content="..." rompía la etiqueta en un caso real
  // (DJSolitario, bio con salto de línea propio).
  const bioFlat = bio.replace(/\s+/g, " ").trim();
  const metaDesc = esc(bioFlat.slice(0, 155).trim() + (bioFlat.length > 155 ? "…" : ""));
  const canonical = `${SITE_ORIGIN}/dj/${dj.dj_slug}.html`;

  const sameAs = [dj.instagram_url, dj.facebook_url, dj.tiktok_url, dj.youtube_url, dj.soundcloud_url, dj.apple_music_url, dj.spotify_url, dj.beatport_url]
    .filter(Boolean);

  const socialLinks = Object.keys(SOCIAL_SVG)
    .filter((field) => dj[field])
    .map((field) => ({ href: dj[field], ...SOCIAL_SVG[field] }));

  // Corrección 17 — se elimina la fabricación Math.max(1, review_count || 1),
  // que convertía "0 reseñas" en "1 reseña". La compuerta ahora es estricta:
  // sin reseñas reales no hay estrella visible ni dato estructurado. El
  // default de la base (rating 1.0 / review_count 0) por sí solo ya no
  // produce ninguna calificación. No se toca el default de la base.
  const reviewCount = Number(dj.review_count) || 0;
  const hasRealRating = reviewCount > 0 && Number(dj.rating) > 0;

  const identity = PERSON_IDENTITY[dj.dj_slug] || null;

  const personLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    ...(identity?.personId ? { "@id": identity.personId } : {}),
    name: identity?.name || name,
    ...(identity?.alternateName ? { alternateName: identity.alternateName } : {}),
    jobTitle: identity?.jobTitle || "DJ",
    image: dj.photo_url,
    description: bio,
    address: { "@type": "PostalAddress", addressLocality: titleCaseLocality(city), addressRegion: "FL", addressCountry: "US" },
    worksFor: ORG_NODE,
    url: canonical,
    ...(sameAs.length ? { sameAs } : {}),
    ...(EMIT_AGGREGATE_RATING_JSONLD && hasRealRating ? {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: dj.rating,
        reviewCount,
      },
    } : {}),
  };

  // og:image — se prefiere el banner apaisado cuando existe (mejor tarjeta de
  // compartir); photo_url es el respaldo garantizado, porque tener foto es
  // requisito de elegibilidad.
  const ogImage = dj.background_url || dj.photo_url;

  // Corrección quirúrgica (2026-09-13): se descartó la página nueva
  // dj-availability.html — el PO identificó que el componente de
  // disponibilidad ya existe, aprobado y en vivo, dentro de dj-profile.html
  // (acordeón AVAILABILITY, ?view=public). En vez de duplicar UI, este botón
  // reutiliza el mismo destino que "Perfil Artístico" (liveProfileHref) —
  // check_dj_availability() ahora vive conectado ahí mismo.
  const bookingHref = `./dj-profile.html?id=${encodeURIComponent(dj.user_id)}&view=public`;
  // Enlaza directo a la vista pública real (dj-profile.html?view=public) en
  // vez de pasar por profile.html — esa página ahora es solo un redirect de
  // compatibilidad para links/QR viejos, no la fuente de verdad.
  const liveProfileHref = `./dj-profile.html?id=${encodeURIComponent(dj.user_id)}&view=public`;

  return `<!doctype html>
<html lang="es">

<head>
  <meta charset="utf-8" />
  <base href="/" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <link rel="canonical" href="${canonical}" />
  <meta name="description" content="${metaDesc}" />
${socialMetaTags({ title, description: metaDesc, image: ogImage, url: canonical, type: "profile" })}
  <script type="application/ld+json">${jsonLd(personLd)}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Outfit:wght@300;400;500;600;700&display=optional" rel="stylesheet" />
  <link rel="stylesheet" href="./styles.css?v=20260904-dj-profiles" />
  <link rel="stylesheet" href="./header-unified.css?v=20260902-cortinas" />
  <link rel="stylesheet" href="./mdj-assistant.css?v=20260306-1" />
  <style>
    .djp-hero{max-width:1100px;margin:40px auto;padding:0 20px;display:grid;grid-template-columns:260px 1fr;gap:36px;align-items:start;}
    @media (max-width:760px){.djp-hero{grid-template-columns:1fr;text-align:center;}}
    .djp-photo{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:16px;border:1px solid rgba(197,160,89,0.35);}
    .djp-name{font-family:"Cormorant Garamond",serif;font-size:2.6rem;color:#c5a059;margin:0 0 6px;}
    .djp-meta{color:rgba(255,255,255,0.65);margin-bottom:14px;}
    .djp-tags{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0;}
    .djp-tag{font-size:12px;padding:4px 10px;border:1px solid rgba(197,160,89,0.35);border-radius:999px;color:#e8c987;}
    .djp-bio p{line-height:1.7;color:rgba(255,255,255,0.85);margin:0 0 14px;}
    .djp-bio-en{display:none;}
    html[lang="en"] .djp-bio-es{display:none;}
    html[lang="en"] .djp-bio-en{display:block;}
    .djp-cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:20px;}
    .djp-btn{display:inline-block;padding:12px 22px;border-radius:999px;font-weight:700;text-decoration:none;}
    .djp-btn.gold{background:#c5a059;color:#0b0f18;}
    .djp-btn.ghost{border:1px solid rgba(197,160,89,0.4);color:#e8c987;}
    .djp-social{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;}
    .djp-social a{width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;color:#fff;text-decoration:none;transition:all 0.2s ease;}
    .djp-social a:hover{background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.3);transform:translateY(-2px);}
    .djp-social svg{width:18px;height:18px;fill:currentColor;}
    .djp-services{max-width:1100px;margin:10px auto 50px;padding:0 20px;}
    .djp-services h2{font-family:"Cormorant Garamond",serif;color:#c5a059;font-size:1.6rem;font-weight:600;max-width:700px;}
    .djp-contact-row{display:flex;flex-wrap:wrap;gap:20px;margin:12px 0 22px;}
    .djp-contact-row a{color:#e8c987;text-decoration:none;font-size:15px;font-weight:600;}
    .djp-contact-row a:hover{text-decoration:underline;}
    .djp-services .row{display:flex;flex-wrap:wrap;gap:10px;}
    .djp-services a{padding:10px 16px;border:1px solid rgba(197,160,89,0.3);border-radius:10px;color:#e8c987;text-decoration:none;font-size:14px;}
  </style>
</head>

<body class="notranslate page-dj-profile">
${HEADER_HTML}

  <main>
    <div class="djp-hero">
      <img class="djp-photo" src="${esc(dj.photo_url)}" alt="${esc(name)} — DJ en ${esc(city)}, Miami DJ Beat" loading="eager" fetchpriority="high" />
      <div>
        <h1 class="djp-name">${esc(name)}</h1>
        <div class="djp-meta">📍 ${esc(city)}${dj.is_resident ? " · DJ Residente" : ""}${hasRealRating ? ` · ★ ${esc(dj.rating)} (${esc(reviewCount)})` : ""}</div>
        ${identity?.identityLine ? `<p class="djp-identity" style="color:rgba(255,255,255,0.55);font-size:14px;margin:0 0 10px;">${esc(identity.identityLine)}</p>\n        ` : ""}${specialtyTags.length ? `<div class="djp-tags">${specialtyTags.map((t) => `<span class="djp-tag">${esc(t)}</span>`).join("")}</div>` : ""}
        <div class="djp-bio djp-bio-es">${bioParas.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
        ${bioEnParas ? `<div class="djp-bio djp-bio-en">${bioEnParas.map((p) => `<p>${esc(p)}</p>`).join("")}</div>` : ""}
        <div class="djp-cta">
          <a class="djp-btn gold" href="${bookingHref}">Consultar Disponibilidad</a>
          <a class="djp-btn ghost" href="${liveProfileHref}">Perfil Artístico</a>
        </div>
        ${socialLinks.length ? `<div class="djp-social">${socialLinks.map((s) => `<a href="${esc(s.href)}" target="_blank" rel="noopener noreferrer" title="${s.label}" aria-label="${s.label}">${s.svg}</a>`).join("")}</div>` : ""}
      </div>
    </div>

    <div class="djp-services">
      <h2>Comunícate con nosotros y pregunta por ${esc(name)} — o cualquiera de tus DJs favoritos de nuestra plataforma</h2>
      <div class="djp-contact-row">
        <a href="tel:+13056071780">📞 (305) 607-1780</a>
        <a href="mailto:miamidjbeat@gmail.com">✉️ miamidjbeat@gmail.com</a>
      </div>
      <div class="row">
        ${services.map((s) => `<a href="${s.href}">${esc(s.label)}</a>`).join("")}
        <a href="./dj/directorio.html">Ver todos los DJs</a>
      </div>
    </div>
  </main>

${FOOTER_AND_SCRIPTS_HTML}
</body>
</html>
`;
}

/* ═══ 3b) índice estático — enlazado interno real, no dependiente de JS ═══
   find-dj.html/directory.html renderizan por JS: un rastreador que no
   ejecuta JS nunca ve esos <a href>. Este índice es HTML plano, con links
   reales horneados, para que Google/Siri/ChatGPT puedan descubrir cada
   perfil por enlace interno y no solo por el sitemap. */

const INDEX_TITLE = "Directorio de DJs en Miami | Miami DJ Beat";
const INDEX_CANONICAL = `${SITE_ORIGIN}/dj/directorio.html`;
const INDEX_DESC = "DJs profesionales de Miami DJ Beat — bodas, quinceañeras, eventos corporativos y Latin/Open Format. Perfiles reales, disponibilidad y contacto directo.";

export function renderIndexPage(djs) {
  const cards = djs.map((dj) => {
    const city = titleCaseCity(dj.city) || "Miami";
    const bio = stripPhoneNumbers(dj.bio || dj.bio_short || "").slice(0, 140);
    return `
      <a class="djidx-card" href="./dj/${dj.dj_slug}.html">
        <img src="${esc(dj.photo_url)}" alt="${esc(dj.stage_name)}" loading="lazy" />
        <div>
          <h2>${esc(dj.stage_name)}</h2>
          <p class="djidx-city">📍 ${esc(city)}${isPaid(dj) ? " · PRO" : ""}</p>
          <p class="djidx-bio">${esc(bio)}${bio.length >= 140 ? "…" : ""}</p>
        </div>
      </a>`;
  }).join("");

  return `<!doctype html>
<html lang="es">

<head>
  <meta charset="utf-8" />
  <base href="/" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${INDEX_TITLE}</title>
  <link rel="canonical" href="${INDEX_CANONICAL}" />
  <meta name="description" content="${INDEX_DESC}" />
${socialMetaTags({ title: INDEX_TITLE, description: INDEX_DESC, image: SITE_OG_IMAGE, url: INDEX_CANONICAL, type: "website" })}
  <script type="application/ld+json">${jsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: djs.map((dj, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_ORIGIN}/dj/${dj.dj_slug}.html`,
      name: dj.stage_name,
    })),
  })}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Outfit:wght@300;400;500;600;700&display=optional" rel="stylesheet" />
  <link rel="stylesheet" href="./styles.css?v=20260904-dj-profiles" />
  <link rel="stylesheet" href="./header-unified.css?v=20260902-cortinas" />
  <link rel="stylesheet" href="./mdj-assistant.css?v=20260306-1" />
  <style>
    .djidx-wrap{max-width:1100px;margin:40px auto;padding:0 20px;}
    .djidx-wrap h1{font-family:"Cormorant Garamond",serif;color:#c5a059;font-size:2.4rem;margin-bottom:6px;}
    .djidx-wrap>p{color:rgba(255,255,255,0.65);margin-bottom:28px;}
    .djidx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px;}
    .djidx-card{display:flex;gap:14px;padding:14px;border:1px solid rgba(197,160,89,0.25);border-radius:14px;text-decoration:none;color:inherit;}
    .djidx-card img{width:72px;height:72px;border-radius:10px;object-fit:cover;flex-shrink:0;}
    .djidx-card h2{font-size:1.1rem;margin:0 0 4px;color:#e8c987;}
    .djidx-city{font-size:12px;color:rgba(255,255,255,0.55);margin:0 0 6px;}
    .djidx-bio{font-size:13px;color:rgba(255,255,255,0.7);margin:0;line-height:1.5;}
  </style>
</head>

<body class="notranslate page-dj-index">
${HEADER_HTML}

  <main>
    <div class="djidx-wrap">
      <h1>Directorio de DJs</h1>
      <p>DJs profesionales de Miami DJ Beat, con disponibilidad real y reserva directa.</p>
      <p style="font-size:14px;color:rgba(255,255,255,0.6);">¿Buscas por disponibilidad, ciudad o especialidad? <a href="../find-dj.html" style="color:var(--gold);">Explora todos los DJs de la plataforma</a> · ¿Quieres verificar una credencial? <a href="../directory.html" style="color:var(--gold);">Directorio de certificación</a></p>
      <div class="djidx-grid">${cards}</div>
    </div>
  </main>

${FOOTER_AND_SCRIPTS_HTML}
</body>
</html>
`;
}

/* ═══ 3c) equipo — página corporativa "Sobre Nosotros" ══════════════════
   Propósito distinto al de los perfiles de DJ: no es "reserva a esta
   persona", es autoridad/confianza para Google (señales E-E-A-T) y para que
   ChatGPT/Siri puedan responder "quién está detrás de Miami DJ Beat". Usa
   las mismas filas de public_dj_profiles marcadas artist_specialty="Staff"
   (Owner/Managers/Vendedores) — hoy solo existe el Owner, el resto entra
   solo cuando se den de alta esas cuentas, mismo patrón que los DJs. */

const STAFF_TITLE_BY_SLUG = {
  owner: "Fundador &amp; Propietario",
};

/* Corrección 19 — AISLAMIENTO DELIBERADO.
   `seo_publish_status` es una compuerta del camino de DJs y NO se añade aquí.
   equipo.html es una página corporativa de autoridad (E-E-A-T), no un perfil
   reservable: su inclusión no depende de ninguna aprobación editorial de DJ.
   Ningún valor de dj.seo_publish_status puede alterar esta función. */
export function qualifiesStaff(dj) {
  return Boolean(/\bstaff\b/i.test(dj.artist_specialty || "") && (dj.bio || dj.bio_short) && dj.photo_url && dj.stage_name && dj.dj_slug);
}

const TEAM_TITLE = "Equipo — Miami DJ Beat LLC";
const TEAM_CANONICAL = `${SITE_ORIGIN}/equipo.html`;
const TEAM_DESC = "Conoce al equipo detrás de Miami DJ Beat LLC — fundador, dirección y el equipo que impulsa la plataforma de DJs y producción de eventos en Miami.";

export function renderTeamPage(staff) {
  const cards = staff.map((s) => {
    const bio = stripPhoneNumbers(s.bio || s.bio_short || "");
    const bioParas = bio.split(/\n{2,}/).filter(Boolean);
    const title = STAFF_TITLE_BY_SLUG[s.dj_slug] || "Equipo Miami DJ Beat";
    const socialLinks = [
      s.instagram_url && { href: s.instagram_url, label: "Instagram" },
      s.facebook_url && { href: s.facebook_url, label: "Facebook" },
      s.tiktok_url && { href: s.tiktok_url, label: "TikTok" },
      s.youtube_url && { href: s.youtube_url, label: "YouTube" },
      s.linkedin_url && { href: s.linkedin_url, label: "LinkedIn" },
    ].filter(Boolean);
    return `
      <article class="team-card">
        <img class="team-photo" src="${esc(s.photo_url)}" alt="${esc(s.stage_name)} — ${title.replace(/&amp;/g, "&")}, Miami DJ Beat LLC" loading="lazy" />
        <div>
          <h2>${esc(s.stage_name)}</h2>
          <p class="team-title">${title}</p>
          <div class="team-bio">${bioParas.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
          ${socialLinks.length ? `<div class="team-social">${socialLinks.map((l) => `<a href="${esc(l.href)}" target="_blank" rel="noopener noreferrer">${l.label}</a>`).join("")}</div>` : ""}
        </div>
      </article>`;
  }).join("");

  // Person Identity Normalization: la fila `owner` y la fila `djmago305` son
  // la MISMA persona, así que comparten @id. Sin eso, el grafo declaraba dos
  // entidades distintas para un solo humano.
  const personLd = staff.map((s) => {
    const identity = PERSON_IDENTITY[s.dj_slug] || null;
    return {
      "@type": "Person",
      ...(identity?.personId ? { "@id": identity.personId } : {}),
      name: identity?.name || s.stage_name,
      ...(identity?.alternateName ? { alternateName: identity.alternateName } : {}),
      jobTitle: (STAFF_TITLE_BY_SLUG[s.dj_slug] || "Equipo Miami DJ Beat").replace(/&amp;/g, "&"),
      image: s.photo_url,
      worksFor: ORG_NODE,
    };
  });

  return `<!doctype html>
<html lang="es">

<head>
  <meta charset="utf-8" />
  <base href="/" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${TEAM_TITLE}</title>
  <link rel="canonical" href="${TEAM_CANONICAL}" />
  <meta name="description" content="${TEAM_DESC}" />
${socialMetaTags({ title: TEAM_TITLE, description: TEAM_DESC, image: staff[0]?.photo_url || SITE_OG_IMAGE, url: TEAM_CANONICAL, type: "website" })}
  <script type="application/ld+json">${jsonLd({ "@context": "https://schema.org", "@graph": personLd })}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Outfit:wght@300;400;500;600;700&display=optional" rel="stylesheet" />
  <link rel="stylesheet" href="./styles.css?v=20260904-dj-profiles" />
  <link rel="stylesheet" href="./header-unified.css?v=20260902-cortinas" />
  <link rel="stylesheet" href="./mdj-assistant.css?v=20260306-1" />
  <style>
    .team-wrap{max-width:1000px;margin:40px auto;padding:0 20px;}
    .team-wrap h1{font-family:"Cormorant Garamond",serif;color:#c5a059;font-size:2.4rem;margin-bottom:6px;}
    .team-wrap>p{color:rgba(255,255,255,0.65);margin-bottom:28px;}
    .team-card{display:grid;grid-template-columns:220px 1fr;gap:28px;padding:24px 0;border-top:1px solid rgba(197,160,89,0.2);}
    .team-card:first-of-type{border-top:none;}
    @media (max-width:640px){.team-card{grid-template-columns:1fr;text-align:center;}}
    .team-photo{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:14px;border:1px solid rgba(197,160,89,0.35);}
    .team-card h2{font-family:"Cormorant Garamond",serif;color:#e8c987;font-size:1.6rem;margin:0 0 2px;}
    .team-title{color:#c5a059;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;margin:0 0 12px;}
    .team-bio p{line-height:1.7;color:rgba(255,255,255,0.85);margin:0 0 12px;}
    .team-social{display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;}
    .team-social a{color:rgba(255,255,255,0.6);text-decoration:none;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.2);}
  </style>
</head>

<body class="notranslate page-team">
${HEADER_HTML}

  <main>
    <div class="team-wrap">
      <h1>Nuestro Equipo</h1>
      <p>Las personas detrás de Miami DJ Beat LLC.</p>
      ${cards}
    </div>
  </main>

${FOOTER_AND_SCRIPTS_HTML}
</body>
</html>
`;
}


/* ═══ 4) sitemap — namespace acotado ════════════════════════════════════════
   Corrección 13. El host pasa a www (corrección 2) y se añade capacidad de
   REMOCIÓN, pero estrictamente acotada a páginas individuales de DJ:
       ^https://www\.miamidjbeat\.com/dj/[a-z0-9-]+\.html$
   con /dj/directorio.html excluido a mano (encaja en el patrón pero NO es un
   perfil), y sin tocar jamás /equipo.html ni nada fuera de /dj/. */

const ORIGIN_RE_SRC = SITE_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const DJ_PAGE_LOC_RE = new RegExp(`^${ORIGIN_RE_SRC}/dj/[a-z0-9-]+\\.html$`);
export const SITEMAP_PROTECTED_LOCS = Object.freeze([
  `${SITE_ORIGIN}/dj/directorio.html`,
  `${SITE_ORIGIN}/equipo.html`,
]);

/** Solo una página individual de DJ puede salir del sitemap por esta vía. */
export function isRemovableSitemapLoc(loc) {
  if (SITEMAP_PROTECTED_LOCS.includes(loc)) return false;
  return DJ_PAGE_LOC_RE.test(loc);
}

export function readSitemapLocs(xml) {
  return [...String(xml).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

/** Pase de diagnóstico: detecta (NO corrige en silencio) duplicados y www/no-www. */
export function diagnoseSitemap(xml) {
  const locs = readSitemapLocs(xml);
  const seen = new Set();
  const duplicates = [];
  const hostMismatch = [];
  for (const loc of locs) {
    if (seen.has(loc)) duplicates.push(loc); else seen.add(loc);
    if (/^https?:\/\/miamidjbeat\.com\//.test(loc)) hostMismatch.push(loc);
  }
  // Mismo path servido bajo www y sin www = señal de canonical partida.
  const byPath = new Map();
  for (const loc of locs) {
    const m = loc.match(/^https?:\/\/(?:www\.)?miamidjbeat\.com(\/.*)$/);
    if (!m) continue;
    byPath.set(m[1], (byPath.get(m[1]) || 0) + 1);
  }
  const duplicatePaths = [...byPath.entries()].filter(([, n]) => n > 1).map(([p]) => p);
  return { duplicates, hostMismatch, duplicatePaths };
}

/**
 * Calcula el sitemap nuevo EN MEMORIA. No escribe nada — quien escribe es
 * main(), y solo después de que todas las validaciones pasaron.
 */
export function planSitemap(xml, { addPaths = [], removeLocs = [] } = {}) {
  let out = String(xml);
  const present = new Set(readSitemapLocs(out));
  const added = [];
  const removed = [];
  const refused = [];

  for (const loc of removeLocs) {
    if (!isRemovableSitemapLoc(loc)) { refused.push(loc); continue; }
    if (!present.has(loc)) continue;
    const locRe = loc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\n?[ \\t]*<url>(?:(?!<\\/url>)[\\s\\S])*?<loc>${locRe}<\\/loc>[\\s\\S]*?<\\/url>`, "g");
    const next = out.replace(re, "");
    if (next !== out) { out = next; removed.push(loc); present.delete(loc); }
  }

  for (const { path, priority } of addPaths) {
    const loc = `${SITE_ORIGIN}/${path}`;
    if (present.has(loc)) continue;
    const entry = `  <url>\n    <loc>${loc}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;
    out = out.replace("</urlset>", `${entry}</urlset>`);
    present.add(loc);
    added.push(loc);
  }

  return { xml: out, added, removed, refused, diagnostics: diagnoseSitemap(xml) };
}

/* ═══ 5) propiedad de archivos generados — falla cerrada ════════════════════
   Corrección 10. Marcador de propiedad = lo que YA existe y es exclusivo de
   renderPage(): body class="notranslate page-dj-profile" + un <link rel=
   canonical> cuyo slug coincide con el nombre del archivo. No se inventa
   maquinaria nueva de marcado. Cualquier archivo que no pase AMBAS pruebas es
   ajeno: se registra [SKIP-UNOWNED] y NUNCA se toca.
   directorio.html queda excluido por nombre, siempre y en todo caso. */

export const MANAGED_BODY_MARKER = '<body class="notranslate page-dj-profile">';

export function isManagedProfileFile(filename, html) {
  if (filename === "directorio.html") return false;
  if (!filename.endsWith(".html")) return false;
  if (!String(html).includes(MANAGED_BODY_MARKER)) return false;
  const slug = basename(filename, ".html");
  const m = String(html).match(/<link rel="canonical" href="([^"]+)"\s*\/?>/);
  if (!m) return false;
  // Se acepta también el host pelado como seguridad de transición: los
  // archivos legados escritos antes de la corrección 2 siguen siendo NUESTROS
  // y no deben aparecer como ajenos en la primera regeneración controlada.
  return m[1] === `${SITE_ORIGIN}/dj/${slug}.html` || m[1] === `https://miamidjbeat.com/dj/${slug}.html`;
}

/* ═══ 6) manifiesto de slugs — rename vs. baja real ═════════════════════════
   Corrección 9. Sin identidad persistida, un DJ que cambia de slug es
   indistinguible de un DJ dado de baja, y el reconciliador borraría la página
   vieja en silencio. El manifiesto guarda { user_id: slug } de cada corrida.
   Falta de manifiesto (primera corrida) = sin historia, todo es nuevo. */

export function readSlugManifest(path = SLUG_MANIFEST) {
  if (!existsSync(path)) return { slugs: {}, ok: true, existed: false };
  try {
    const j = JSON.parse(readFileSync(path, "utf8"));
    const slugs = (j && typeof j === "object" && j.slugs && typeof j.slugs === "object") ? j.slugs : {};
    return { slugs, ok: true, existed: true };
  } catch {
    // Manifiesto ilegible: se sigue adelante, pero ok:false BLOQUEA cualquier
    // borrado — sin historia confiable no se borra nada.
    return { slugs: {}, ok: false, existed: true };
  }
}

export function buildSlugManifest(desired) {
  const slugs = {};
  for (const dj of desired) slugs[dj.user_id] = dj.dj_slug;
  return { generated_at: new Date().toISOString(), slugs };
}

/* ═══ 7) PLAN — todo se calcula y valida en memoria, antes de tocar disco ═══
   Corrección 15. Función pura: recibe filas + archivos ya leídos, devuelve el
   plan completo. Si ok === false, main() no escribe absolutamente nada. */

export function planGeneration({
  rows,
  existingFiles = [],
  manifest = { slugs: {}, ok: true, existed: false },
  reconcile = false,
  allowEmptyRoster = false,
} = {}) {
  const errors = [];
  const notes = [];

  const desired = rows.filter(qualifies);
  const skipped = rows.filter((d) => !qualifies(d));
  const staff = rows.filter(qualifiesStaff);

  desired.sort((a, b) => {
    const pa = isPaid(a) ? 0 : 1;
    const pb = isPaid(b) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return (a.stage_name || "").localeCompare(b.stage_name || "");
  });

  /* — corrección 8: colisión de slug ⇒ ABORTO TOTAL, no se escribe nada.
       No se auto-resuelve con un sufijo numérico ni se deja que el orden
       decida un ganador en silencio: dos DJs reclamando la misma URL es un
       conflicto humano, no algo que un script deba zanjar. */
  const bySlug = new Map();
  for (const dj of desired) {
    if (!bySlug.has(dj.dj_slug)) bySlug.set(dj.dj_slug, []);
    bySlug.get(dj.dj_slug).push(dj);
  }
  const collisions = [...bySlug.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([slug, list]) => ({ slug, count: list.length, names: list.map((d) => d.stage_name || d.user_id) }));
  for (const c of collisions) {
    errors.push(`[COLLISION] ${c.slug} appears ${c.count} times (dj_names: ${c.names.join(", ")})`);
  }

  /* — corrección 14: roster vacío ⇒ ABORTO antes de sobrescribir directorio/
       equipo/sitemap con un roster en blanco. Hoy no existe ningún escenario
       legítimo de cero DJs. Si algún día lo hubiera, la puerta de entrada es
       --allow-empty-roster (definido pero NO habilitado en este ticket). */
  const rosterSafetyAbort = desired.length === 0 && !allowEmptyRoster;
  if (rosterSafetyAbort) {
    errors.push(`[ROSTER-SAFETY-ABORT] fetched ${rows.length} rows, ${desired.length} elegibles — refusing to overwrite existing directory/team pages with an empty roster`);
  }

  /* — corrección 10/12: clasificación de archivos en disco. */
  const managed = [];
  const unowned = [];
  for (const f of existingFiles) {
    if (f.filename === "directorio.html") continue; // nunca candidato, jamás
    if (isManagedProfileFile(f.filename, f.html)) managed.push(basename(f.filename, ".html"));
    else unowned.push(f.filename);
  }

  const desiredSlugs = new Set(desired.map((d) => d.dj_slug));
  const managedSet = new Set(managed);
  const create = desired.filter((d) => !managedSet.has(d.dj_slug)).map((d) => d.dj_slug);
  const keep = desired.filter((d) => managedSet.has(d.dj_slug)).map((d) => d.dj_slug);
  const stale = managed.filter((s) => !desiredSlugs.has(s));

  /* — corrección 9/12: se parte `stale` por CAUSA, cruzándolo con el
       manifiesto. Mismo user_id con slug distinto = RENAME (no se borra, se
       marca para revisión humana; nada de redirects especulativos).
       user_id que ya no está en el set deseado = baja real. */
  const slugToUser = new Map();
  for (const [userId, slug] of Object.entries(manifest.slugs || {})) slugToUser.set(slug, userId);
  const desiredByUser = new Map(desired.map((d) => [d.user_id, d.dj_slug]));

  const renameCandidates = [];
  const staleRemovable = [];
  for (const oldSlug of stale) {
    const userId = slugToUser.get(oldSlug);
    const newSlug = userId ? desiredByUser.get(userId) : undefined;
    if (userId && newSlug && newSlug !== oldSlug) {
      renameCandidates.push({ user_id: userId, old: oldSlug, new: newSlug });
      notes.push(`[RENAME-CANDIDATE] user_id=${userId} old=${oldSlug} new=${newSlug}`);
    } else {
      staleRemovable.push(oldSlug);
    }
  }

  /* — corrección 11: ancla de identidad. Si djmago305 aparece como borrable
       por el motivo que sea, se aborta la corrida entera. */
  if (staleRemovable.includes(IDENTITY_ANCHOR_SLUG)) {
    errors.push(`[IDENTITY-ANCHOR-ABORT] ${IDENTITY_ANCHOR_SLUG}.html is protected and cannot be automatically removed — manual review required`);
  }

  if (reconcile && !manifest.ok) {
    errors.push("[MANIFEST-UNREADABLE] .slug-manifest.json no se pudo leer — se rechaza --reconcile: sin historia confiable no se borra nada.");
  }

  const sitemapAdd = [
    { path: "dj/directorio.html", priority: "0.8" },
    { path: "equipo.html", priority: "0.6" },
    ...desired.map((d) => ({ path: `dj/${d.dj_slug}.html`, priority: "0.7" })),
  ];
  // Solo se propone quitar del sitemap lo que de verdad se va a borrar.
  const sitemapRemove = (reconcile ? staleRemovable : []).map((s) => `${SITE_ORIGIN}/dj/${s}.html`);

  return {
    ok: errors.length === 0,
    errors, notes,
    rows, desired, skipped, staff,
    managed, unowned, create, keep, stale, staleRemovable, renameCandidates, collisions,
    rosterSafetyAbort, sitemapAdd, sitemapRemove,
  };
}

/** Lee web/dj/*.html del disco en la forma que planGeneration() espera. */
export function readExistingProfileFiles(dir = OUT_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".html"))
    .map((f) => ({ filename: f, html: readFileSync(join(dir, f), "utf8") }));
}

/* ═══ 8) reporte — corrección 20 ════════════════════════════════════════════ */

export function printPlan(plan, { reconcile = false, log = console.log } = {}) {
  log(`\nTotal filas en public_dj_profiles: ${plan.rows.length}`);
  log(`Elegibles (bio + foto + seo_publish_status='approved'): ${plan.desired.length}`);
  plan.desired.forEach((d, i) => log(`  ${i + 1}. ${d.dj_slug}  (${isPaid(d) ? "PAGO" : "gratis"})  — ${d.stage_name}`));

  if (plan.skipped.length) {
    log(`\nNo elegibles (sin página): ${plan.skipped.length}`);
    plan.skipped.forEach((d) => {
      const falta = [];
      if (!d.bio && !d.bio_short) falta.push("bio");
      if (!d.photo_url) falta.push("foto");
      if (!isSeoApproved(d)) falta.push(`seo_publish_status=${d.seo_publish_status ?? "null"}`);
      if (!isActuallyDJ(d)) falta.push("rol DJ");
      log(`  - ${d.dj_slug || d.user_id}: falta ${falta.join(", ") || "(otro requisito)"}`);
    });
  }

  log(`\nCREATE (${plan.create.length}): ${plan.create.join(", ") || "—"}`);
  log(`KEEP (${plan.keep.length}): ${plan.keep.join(", ") || "—"}`);
  if (reconcile) {
    log(`REMOVE (${plan.staleRemovable.length}): ${plan.staleRemovable.join(", ") || "—"}`);
  } else {
    log(`REMOVE (0 — sin --reconcile): se BORRARÍA ${plan.staleRemovable.length}: ${plan.staleRemovable.join(", ") || "—"}`);
  }
  plan.unowned.forEach((f) => log(`[SKIP-UNOWNED] ${f}`));
  plan.collisions.forEach((c) => log(`[COLLISION] ${c.slug} appears ${c.count} times (dj_names: ${c.names.join(", ")})`));
  plan.renameCandidates.forEach((r) => log(`[RENAME-CANDIDATE] user_id=${r.user_id} old=${r.old} new=${r.new}`));
  if (plan.rosterSafetyAbort) log(`[ROSTER-SAFETY-ABORT] fetched 0 elegibles — no se sobrescribe directorio/equipo/sitemap`);
  plan.errors.forEach((e) => log(`[ERROR] ${e}`));

  log(`\nStaff elegible (equipo.html): ${plan.staff.length}`);
  plan.staff.forEach((s) => log(`  - ${s.dj_slug} — ${s.stage_name}`));
}

/* ═══ main — PLAN → VALIDATE → WRITE ═══════════════════════════════════════ */

export async function main() {
  const resolved = resolveEnvironment(process.env, { dryRun: DRY_RUN });
  if (resolved.abort) {
    console.error("ENVIRONMENT: (no declarado)");
    console.error(`MODE: ${DRY_RUN ? "DRY-RUN" : "REAL"}`);
    console.error(`[ERROR] ABORT — ${resolved.abort}`);
    process.exitCode = 2;
    return;
  }
  printEnvironmentBanner(resolved, { dryRun: DRY_RUN, outDir: OUT_DIR });

  const rows = await fetchDJs(resolved);

  const plan = planGeneration({
    rows,
    existingFiles: readExistingProfileFiles(OUT_DIR),
    manifest: readSlugManifest(),
    reconcile: RECONCILE,
    allowEmptyRoster: ALLOW_EMPTY_ROSTER,
  });

  const sitemapXmlBefore = existsSync(SITEMAP) ? readFileSync(SITEMAP, "utf8") : "";
  const sitemapPlan = sitemapXmlBefore
    ? planSitemap(sitemapXmlBefore, { addPaths: plan.sitemapAdd, removeLocs: plan.sitemapRemove })
    : { xml: "", added: [], removed: [], refused: [], diagnostics: { duplicates: [], hostMismatch: [], duplicatePaths: [] } };

  printPlan(plan, { reconcile: RECONCILE });
  sitemapPlan.added.forEach((l) => console.log(`[SITEMAP ADD] ${l}`));
  sitemapPlan.removed.forEach((l) => console.log(`[SITEMAP REMOVE] ${l}`));
  sitemapPlan.refused.forEach((l) => console.log(`[SITEMAP SKIP-PROTECTED] ${l}`));
  const diag = sitemapPlan.diagnostics;
  diag.hostMismatch.forEach((l) => console.log(`[SITEMAP DIAG] host sin www (no se corrige solo): ${l}`));
  diag.duplicates.forEach((l) => console.log(`[SITEMAP DIAG] <loc> duplicado: ${l}`));
  diag.duplicatePaths.forEach((p) => console.log(`[SITEMAP DIAG] mismo path bajo www y sin www: ${p}`));

  // ── VALIDATE ──────────────────────────────────────────────────────────────
  if (!plan.ok) {
    console.error(`\nRESUMEN: ABORTADO — ${plan.errors.length} error(es) de validación. CERO archivos escritos.`);
    process.exitCode = 1;
    return;
  }

  if (DRY_RUN) {
    console.log(`\nRESUMEN: --dry-run — ${plan.create.length} a crear, ${plan.keep.length} a actualizar, ${plan.staleRemovable.length} borrable(s)${RECONCILE ? "" : " (sin --reconcile)"}, ${sitemapPlan.added.length} alta(s) de sitemap, ${sitemapPlan.removed.length} baja(s) de sitemap. CERO archivos escritos.`);
    return;
  }

  // ── WRITE ─────────────────────────────────────────────────────────────────
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  for (const dj of plan.desired) {
    const profilePath = join(OUT_DIR, `${dj.dj_slug}.html`);
    writeFileSync(profilePath, renderPage(dj), "utf8");
    console.log(`✓ ${OUTPUT_DIR_OVERRIDE ? profilePath : `web/dj/${dj.dj_slug}.html`}`);
  }

  const directorioPath = join(OUT_DIR, "directorio.html");
  writeFileSync(directorioPath, renderIndexPage(plan.desired), "utf8");
  console.log(`✓ ${OUTPUT_DIR_OVERRIDE ? directorioPath : "web/dj/directorio.html"} (${plan.desired.length} perfiles listados)`);

  writeFileSync(EQUIPO_PATH, renderTeamPage(plan.staff), "utf8");
  console.log(`✓ ${OUTPUT_DIR_OVERRIDE ? EQUIPO_PATH : "web/equipo.html"} (${plan.staff.length} miembros listados)`);

  if (sitemapXmlBefore && (sitemapPlan.added.length || sitemapPlan.removed.length)) {
    writeFileSync(SITEMAP, sitemapPlan.xml, "utf8");
    console.log(`✓ ${OUTPUT_DIR_OVERRIDE ? SITEMAP : "web/sitemap.xml"} (+${sitemapPlan.added.length} / -${sitemapPlan.removed.length})`);
  }

  writeFileSync(SLUG_MANIFEST, `${JSON.stringify(buildSlugManifest(plan.desired), null, 2)}\n`, "utf8");
  console.log(`✓ ${OUTPUT_DIR_OVERRIDE ? SLUG_MANIFEST : "tools/dj-profiles/.slug-manifest.json"} (${plan.desired.length} entradas)`);

  // Los borrados van AL FINAL, después de que todas las altas/actualizaciones
  // salieron bien, y solo sobre stale-removable (nunca rename-candidate, nunca
  // unowned, nunca directorio.html, nunca el ancla de identidad).
  if (RECONCILE) {
    for (const slug of plan.staleRemovable) {
      const removePath = join(OUT_DIR, `${slug}.html`);
      unlinkSync(removePath);
      console.log(`✗ REMOVE ${OUTPUT_DIR_OVERRIDE ? removePath : `web/dj/${slug}.html`}`);
    }
  }

  console.log(`\nRESUMEN: ${plan.create.length} creada(s), ${plan.keep.length} actualizada(s), ${RECONCILE ? plan.staleRemovable.length : 0} borrada(s), sitemap +${sitemapPlan.added.length}/-${sitemapPlan.removed.length}.`);
}

// Solo se ejecuta si se invoca como script; importarlo desde las pruebas no
// dispara ninguna corrida.
const INVOKED_DIRECTLY = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (INVOKED_DIRECTLY) {
  main().catch((e) => {
    console.error(`[ERROR] ${e && e.message ? e.message : e}`);
    process.exit(1);
  });
}
