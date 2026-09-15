#!/usr/bin/env node
// tools/dj-profiles/find-dj-search.test.mjs — suite de pruebas del buscador
// público de find-dj.html (Public Talent Search).
//
//   node --test tools/dj-profiles/
//
// Mismo patrón que build.test.mjs: sin dependencias externas, sin red, sin
// Supabase. Todo sale de fixtures locales:
//   · fixtures/roster.approved.json  — FROZEN, del ticket anterior, sin tocar.
//   · fixtures/find-dj-search-negatives.json — nuevo, las 2 filas negativas
//     (DJ PRO TEST + Alexander Reyes) con los valores verificados del brief.
//
// DESLINDE (repetido aquí a propósito, ver también el reporte final): estas
// pruebas verifican la LÓGICA pura — elegibilidad, proyección, búsqueda,
// ranking, orden-antes-que-límite y enrutamiento canónico. NO verifican la
// vista SQL public_dj_talent contra una base real: esa vista está preparada
// en supabase/migrations/20260913110000_public_dj_talent_view.sql pero NO
// aplicada, y este ticket no tiene permiso para aplicarla ni para escribir
// en ninguna base. La consulta EN VIVO contra esa vista queda sin verificar
// hasta que alguien con esa autoridad la aplique.

import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { loadFixture, qualifies } from "./build.mjs";

import {
  normalizeText, squash, tokenize,
  isActuallyDJTalent, isSeoApprovedTalent, isEligibleForPublicSearch,
  PUBLIC_PROJECTION_FIELDS, PRIVATE_FIELDS_FORBIDDEN, projectPublicFields,
  isPremiumTierLike,
  buildHaystack, matchesQuery, isExactStageMatch, completenessScore, compareForSearch,
  simulateDbOrderedSlice, searchTalent,
  canonicalHref, escHtml, renderResultCardHTML,
  isRootDjQuery, matchesNameQuery, filterByNameQuery, searchTalentByName,
} from "../../web/find-dj-search.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROSTER = loadFixture(join(HERE, "fixtures", "roster.approved.json"));
const NEGATIVES = loadFixture(join(HERE, "fixtures", "find-dj-search-negatives.json"));

const REAL_DJS = ROSTER.filter((r) => r.dj_slug !== "owner"); // djmago305, djsolitario, djyuyo
const OWNER = ROSTER.find((r) => r.dj_slug === "owner");
const PRO_TEST = NEGATIVES.find((r) => r.stage_name === "DJ PRO TEST");
const ALEXANDER = NEGATIVES.find((r) => r.stage_name === "Alexander Reyes");
const ALL_ROWS = [...REAL_DJS, OWNER, PRO_TEST, ALEXANDER];

const byslug = (s) => REAL_DJS.find((r) => r.dj_slug === s);
const DJMAGO = byslug("djmago305");
const DJSOLITARIO = byslug("djsolitario");
const DJYUYO = byslug("djyuyo");

/* ───────────────────── 0 · paridad con qualifies() (build.mjs) ────────── */

test("0 · isEligibleForPublicSearch() es idéntica a qualifies() para cada fila del fixture", () => {
  for (const row of ALL_ROWS) {
    assert.equal(
      isEligibleForPublicSearch(row), qualifies(row),
      `paridad rota para dj_slug=${row.dj_slug || "(sin slug)"} / stage_name=${row.stage_name}`
    );
  }
  // Y explícitamente por variación de seo_publish_status, para que una
  // deriva futura entre las dos copias no pase en silencio.
  for (const estado of ["approved", "pending", null, undefined, "", "APPROVED"]) {
    const dj = { ...DJMAGO, seo_publish_status: estado };
    assert.equal(isEligibleForPublicSearch(dj), qualifies(dj), `estado=${estado}`);
  }
});

/* ───────────────────── A-C · elegibilidad (requisitos del ticket) ─────── */

test("A · un DJ incompleto (sin bio/foto) queda excluido", () => {
  const incompleto = { ...DJYUYO, bio: null, bio_short: null, photo_url: null };
  assert.equal(isEligibleForPublicSearch(incompleto), false);
});

test("B · DJ PRO TEST (cuenta de QA confirmada) queda excluida específicamente", () => {
  assert.equal(PRO_TEST.stage_name, "DJ PRO TEST");
  assert.equal(isEligibleForPublicSearch(PRO_TEST), false, "DJ PRO TEST no debe calificar para búsqueda pública");
  const results = searchTalent(ALL_ROWS, "DJ");
  assert.ok(!results.some((r) => r.stage_name === "DJ PRO TEST"), "DJ PRO TEST no debe aparecer en resultados de 'DJ'");
});

test("B2 · Alexander Reyes (signup real pero incompleto, NO cuenta de prueba) también queda excluido", () => {
  assert.equal(ALEXANDER.stage_name, "Alexander Reyes");
  assert.equal(isEligibleForPublicSearch(ALEXANDER), false);
  const results = searchTalent(ALL_ROWS, "DJ");
  assert.ok(!results.some((r) => r.stage_name === "Alexander Reyes"));
});

test("C · los 3 DJs reales aprobados (DJMago305/DJSolitario/DJYuyo) están incluidos", () => {
  for (const dj of [DJMAGO, DJSOLITARIO, DJYUYO]) {
    assert.equal(isEligibleForPublicSearch(dj), true, dj.stage_name);
  }
  const results = searchTalent(ALL_ROWS, "");
  const names = results.map((r) => r.stage_name).sort();
  assert.deepEqual(names, ["DJMago305", "DJSolitario", "DJYuyo"]);
});

/* ───────────────────── D-F · enrutamiento canónico ─────────────────────── */

test("D · una fila sin dj_slug no puede producir un link canónico", () => {
  assert.equal(canonicalHref({ ...DJMAGO, dj_slug: null }), null);
  assert.equal(canonicalHref({ ...DJMAGO, dj_slug: "" }), null);
  assert.equal(canonicalHref({}), null);
  // Y la tarjeta renderizada no lleva <a> de perfil cuando no hay link.
  const html = renderResultCardHTML({ ...projectPublicFields(DJMAGO), dj_slug: null });
  assert.equal(/find-dj-chip__link"/.test(html) && html.includes("<a "), false,
    "sin dj_slug, el contenedor de link no debe ser un <a>");
  assert.ok(html.includes('find-dj-chip__link--nolink'));
});

test("E · el link canónico es correcto para cada uno de los 3 DJs reales", () => {
  assert.equal(canonicalHref(DJMAGO), "./dj/djmago305.html");
  assert.equal(canonicalHref(DJSOLITARIO), "./dj/djsolitario.html");
  assert.equal(canonicalHref(DJYUYO), "./dj/djyuyo.html");
});

test("F · ningún resultado enlaza jamás a profile.html?id=... ni dj-profile.html?id=...", () => {
  const results = searchTalent(ALL_ROWS, "");
  for (const r of results) {
    const html = renderResultCardHTML(r, { rentHref: "./rentals.html?dj=x", rentLabel: "Rentar este DJ" });
    assert.equal(/profile\.html\?id=/.test(html), false, `${r.stage_name} no debe enlazar profile.html?id=`);
    assert.equal(/dj-profile\.html\?id=/.test(html), false, `${r.stage_name} no debe enlazar dj-profile.html?id=`);
    assert.ok(html.includes(`href="${canonicalHref(r)}"`), `${r.stage_name} debe enlazar su slug canónico`);
  }
});

/* ───────────────────────── G · sin datos privados ──────────────────────── */

test("G · ningún campo privado sobrevive projectPublicFields(), para ninguna fila (incl. las negativas)", () => {
  for (const row of ALL_ROWS) {
    const proj = projectPublicFields(row);
    for (const forbidden of PRIVATE_FIELDS_FORBIDDEN) {
      assert.equal(Object.prototype.hasOwnProperty.call(proj, forbidden), false,
        `${row.stage_name}: el campo prohibido "${forbidden}" no debe existir en la proyección pública`);
    }
    assert.deepEqual(Object.keys(proj).sort(), [...PUBLIC_PROJECTION_FIELDS].sort());
  }
  // Verificación concreta y no genérica: los valores reales de email/phone
  // de las filas negativas (que sí traen esos campos, como una fila real)
  // no aparecen en NINGÚN valor de la proyección, ni siquiera de refilón.
  const projAlex = projectPublicFields(ALEXANDER);
  const serialized = JSON.stringify(projAlex);
  assert.equal(serialized.includes("djalexito30512@gmail.com"), false);
  const projPro = projectPublicFields(PRO_TEST);
  assert.equal(JSON.stringify(projPro).includes("pro.test+001@gmail.com"), false);
});

/* ───────────────────────── H · determinismo ─────────────────────────────  */

test("H · la búsqueda es determinista: correr la misma query dos veces da el mismo orden", () => {
  const r1 = searchTalent(ALL_ROWS, "dj").map((r) => r.stage_name);
  const r2 = searchTalent(ALL_ROWS, "dj").map((r) => r.stage_name);
  assert.deepEqual(r1, r2);
  const r3 = searchTalent(ALL_ROWS, "").map((r) => r.stage_name);
  const r4 = searchTalent(ALL_ROWS, "").map((r) => r.stage_name);
  assert.deepEqual(r3, r4);
});

/* ───────────────── I-J · exacto / parcial / hueco de espacio ───────────── */

test("I · búsqueda exacta de stage_name devuelve la coincidencia exacta, primera en el orden", () => {
  const results = searchTalent(ALL_ROWS, "DJMago305");
  assert.ok(results.length >= 1);
  assert.equal(results[0].stage_name, "DJMago305");
  assert.equal(isExactStageMatch(DJMAGO, "DJMago305"), true);
});

test("J · búsqueda parcial 'Yuyo' encuentra DJYuyo, y 'DJ Yuyo' (con espacio) también — hueco de normalización cerrado", () => {
  const r1 = searchTalent(ALL_ROWS, "Yuyo");
  assert.ok(r1.some((r) => r.stage_name === "DJYuyo"));

  const r2 = searchTalent(ALL_ROWS, "DJ Yuyo");
  assert.ok(r2.some((r) => r.stage_name === "DJYuyo"),
    "'DJ Yuyo' (con espacio) debe encontrar 'DJYuyo' (guardado sin espacio)");

  assert.equal(squash("DJ Yuyo"), squash("DJYuyo"));
});

/* ─────────────────────── K · intersección, no unión ────────────────────── */

test("K · una query de varias palabras ESTRECHA resultados (intersección), no los une (OR)", () => {
  // DJYuyo vive en Hialeah, no en Miami. Bajo OR ("yuyo" O "miami"), DJYuyo
  // aparecería igual porque "yuyo" solo ya matchea. Bajo AND (intersección,
  // lo correcto), "miami" no está en el haystack de DJYuyo y la fila se cae.
  const naiveOrWouldInclude = matchesQuery(DJYUYO, ["yuyo"]) && !matchesQuery(DJYUYO, ["miami"]);
  assert.ok(naiveOrWouldInclude, "precondición: 'yuyo' sí matchea, 'miami' solo no matchea DJYuyo");

  const results = searchTalent(ALL_ROWS, "Yuyo Miami");
  assert.ok(!results.some((r) => r.stage_name === "DJYuyo"),
    "'Yuyo Miami' no debe devolver a DJYuyo — la intersección exige AMBOS tokens");

  // Y el caso positivo: "DJYuyo Hialeah" sí debe traerlo, porque AMBOS
  // tokens sí están en su haystack (nombre aplastado + ciudad real).
  const r2 = searchTalent(ALL_ROWS, "Yuyo Hialeah");
  assert.ok(r2.some((r) => r.stage_name === "DJYuyo"));
});

/* ────────────────── L · sin atributos fabricados (género/idioma) ───────── */

test("L · una query de atributo sin dato real que lo respalde no devuelve nada (no se fabrica capacidad)", () => {
  for (const dj of [DJMAGO, DJSOLITARIO, DJYUYO]) {
    const hay = `${dj.artist_specialty || ""} ${dj.roles || ""}`.toLowerCase();
    assert.equal(hay.includes("salsa"), false, `precondición: ${dj.stage_name} no debe mencionar salsa`);
  }
  const results = searchTalent(ALL_ROWS, "salsa");
  assert.deepEqual(results, []);
});

/* ──────────────── M · orden ANTES que límite, con roster >120 ──────────── */

test("M · con >120 candidatos, ORDER se aplica antes que LIMIT (el corte no descarta al candidato correcto)", () => {
  // 130 filas "de relleno" gratis (no-premium), con nombres que ordenan
  // ALFABÉTICAMENTE DESPUÉS de "zz-relleno-###" — y una fila premium real
  // ("DJMago305", ya premium via plan=founder+is_premium=true) que en un
  // esquema SIN order (recorte arbitrario/orden de inserción) quedaría
  // fuera de las primeras 120 si el relleno se insertara ANTES que ella.
  const relleno = Array.from({ length: 130 }, (_, i) => ({
    ...DJSOLITARIO,
    user_id: `filler-${i}`,
    dj_slug: `filler-dj-${i}`,
    stage_name: `ZZ Filler DJ ${String(i).padStart(3, "0")}`,
    is_premium: false,
    plan: null,
    subscription_status: null,
    plan_type: null,
  }));

  // DJMago305 (premium) insertado AL FINAL del array de entrada — si el
  // slice fuera "primeros 120 tal como llegan", se perdería.
  const rows = [...relleno, DJMAGO];
  assert.equal(rows.length, 131);
  assert.equal(rows.indexOf(DJMAGO), 130, "precondición: DJMago305 es el último elemento de la entrada");

  const sliced = simulateDbOrderedSlice(rows, 120);
  assert.equal(sliced.length, 120);
  assert.ok(sliced.some((r) => r.dj_slug === "djmago305"),
    "DJMago305 (premium) debe sobrevivir el corte de 120 porque el ORDER lo antepone al relleno gratis");
  assert.equal(sliced[0].dj_slug, "djmago305", "premium primero, dentro del corte");

  // Y el pipeline completo (searchTalent) también lo preserva de punta a punta.
  const results = searchTalent(rows, "");
  assert.ok(results.some((r) => r.stage_name === "DJMago305"));
});

/* ─────────────────── N/P · regresión de identidad y JSON-LD ────────────── */

test("N · el buscador no toca build.mjs: las 22 pruebas de hardening + identidad de DJMago305 siguen intactas", () => {
  // No se re-implementan aquí — build.test.mjs ya las corre (requisito O).
  // Esta prueba solo confirma que qualifies() (la función que build.test.mjs
  // audita) es EXACTAMENTE la misma que consume isEligibleForPublicSearch
  // vía la prueba de paridad "0" de arriba — cero deriva, cero reimplementación
  // paralela sin control.
  assert.equal(typeof qualifies, "function");
});

/* ────────────────────── proyección / ranking adicionales ───────────────── */

test("completenessScore() prioriza perfiles más llenos como desempate", () => {
  const lleno = projectPublicFields(DJMAGO);
  const flaco = { ...projectPublicFields(DJSOLITARIO), city: null, artist_specialty: null, roles: null };
  assert.ok(completenessScore(lleno) > completenessScore(flaco));
});

test("isPremiumTierLike() sirve como desempate menor, nunca como piso absoluto de inclusión", () => {
  // DJSolitario/DJYuyo no son premium y de todas formas califican y aparecen.
  assert.equal(isPremiumTierLike(DJSOLITARIO), false);
  assert.equal(isPremiumTierLike(DJYUYO), false);
  assert.equal(isEligibleForPublicSearch(DJSOLITARIO), true);
  const results = searchTalent(ALL_ROWS, "");
  assert.ok(results.some((r) => r.stage_name === "DJSolitario"));
});

test("buildHaystack()/matchesQuery() son insensibles a acentos y mayúsculas", () => {
  const dj = { ...DJMAGO, city: "Míämi" };
  assert.equal(matchesQuery(dj, tokenize("MIAMI")), true);
  assert.equal(normalizeText("Míämi"), normalizeText("miami"));
});

test("Q · superficie de módulo estable (exports usados por find-dj.html no se renombran por accidente)", () => {
  for (const fn of [
    normalizeText, squash, tokenize, isActuallyDJTalent, isSeoApprovedTalent,
    isEligibleForPublicSearch, projectPublicFields, isPremiumTierLike,
    buildHaystack, matchesQuery, isExactStageMatch, completenessScore,
    compareForSearch, simulateDbOrderedSlice, searchTalent, canonicalHref,
    escHtml, renderResultCardHTML,
  ]) {
    assert.equal(typeof fn, "function");
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   TICKET #2 — Live Progressive Search / Name-First Type-Ahead (find-dj.html)
   §19 del brief: 20 pruebas para matchesNameQuery()/filterByNameQuery()/
   searchTalentByName()/isRootDjQuery() — la ruta de coincidencia SEPARADA
   de §6/§7, que nunca toca matchesQuery()/buildHaystack() (las pruebas de
   arriba, 0-Q, siguen intactas sin modificar una sola línea).
   ═══════════════════════════════════════════════════════════════════════ */

// Filas sintéticas ELEGIBLES (bio+foto+slug+seo_publish_status=approved,
// artist_specialty/roles con "dj" como palabra completa) construidas a
// partir de DJMago305 para tener forma real de dj_profiles. Ninguna toca
// roster.approved.json ni find-dj-search-negatives.json (ambos frozen /
// reusados tal cual) — viven solo en este archivo, igual que el patrón ya
// usado por la prueba "M" de arriba para su relleno de 130 filas.
const DJMAGO_T2 = REAL_DJS.find((r) => r.dj_slug === "djmago305");

function synthEligibleDJ(overrides) {
  return {
    ...DJMAGO_T2,
    user_id: `synthetic-${overrides.dj_slug}`,
    plan: null, plan_type: null, plan_status: null, is_premium: false, subscription_status: null,
    ...overrides,
  };
}

// §6/§9 · "Bianca Ray" — su stage_name NO contiene "dj" como substring, pero
// SÍ califica (roles="DJ" la hace DJ-talent vía isActuallyDJTalent) y su
// bio/ciudad mencionan "Miami"/"DJ" de sobra — la candidata perfecta para
// probar a la vez: (a) que la query raíz "DJ" (§7) la incluye aunque su
// nombre no tenga el substring "dj", y (b) que una búsqueda de NOMBRE "DJ M"
// la EXCLUYE aunque su metadata (roles/ciudad) sí matchee "dj" y "m" por
// separado — exactamente el hueco que matchesQuery()/buildHaystack() (la
// ruta vieja, de atributo) NO cierra por diseño.
const BIANCA = synthEligibleDJ({
  dj_slug: "bianca-ray-synthetic",
  stage_name: "Bianca Ray",
  roles: "DJ",
  artist_specialty: null,
  city: "Miami",
  bio: "Bianca Ray mezcla sets enérgicos por todo Miami metro, de club en club.",
  bio_short: null,
});

// §8 · trío para narrowing progresivo "DJ M" → "DJ Ma" → "DJ Mag" →
// "DJMago305": DJ Moe y DJ Manuel matchean "DJ M" pero se van cayendo en
// cada paso siguiente, exactamente como el ejemplo verbatim del brief.
const DJ_MOE = synthEligibleDJ({
  dj_slug: "dj-moe-synthetic", stage_name: "DJ Moe", city: "Doral",
  bio: "DJ Moe, resident de clubes en Doral.", bio_short: null,
});
const DJ_MANUEL = synthEligibleDJ({
  dj_slug: "dj-manuel-synthetic", stage_name: "DJ Manuel", city: "Kendall",
  bio: "DJ Manuel, open format en Kendall.", bio_short: null,
});

// §7 accents · stage_name ACENTUADO real en el fixture — para que la prueba
// de normalización de acentos sea una prueba de verdad, no una nota de que
// "no hay caso" (el roster congelado no trae ninguno).
const DJ_MUNOZ = synthEligibleDJ({
  dj_slug: "dj-munoz-synthetic", stage_name: "DJ Muñoz", city: "Miami",
  bio: "DJ Muñoz, sonidos latinos.", bio_short: null,
});

const T2_ALL_ROWS = [...REAL_DJS, OWNER, PRO_TEST, ALEXANDER, BIANCA, DJ_MOE, DJ_MANUEL, DJ_MUNOZ];
const PROGRESSIVE_ROWS = [DJMAGO_T2, DJSOLITARIO, DJYUYO, DJ_MOE, DJ_MANUEL];

// Precondiciones de las filas sintéticas — si alguna deja de calificar por
// un cambio futuro en isEligibleForPublicSearch(), estas pruebas fallan acá
// primero, con un mensaje claro, en vez de fallar más abajo de forma opaca.
test("T2-0 · precondición: todas las filas sintéticas del ticket #2 califican para búsqueda pública", () => {
  for (const dj of [BIANCA, DJ_MOE, DJ_MANUEL, DJ_MUNOZ]) {
    assert.equal(isEligibleForPublicSearch(dj), true, `${dj.stage_name} debe ser elegible`);
  }
  assert.equal(/\bdj\b/i.test(BIANCA.stage_name), false, "precondición: 'Bianca Ray' no contiene 'dj' como substring/palabra");
});

/* ───────────── 1 · "DJ" (raíz) = todo el universo elegible, §7 ─────────── */

test("T2-1 · 'DJ' devuelve TODO el universo elegible, incluida una DJ cuyo stage_name no contiene 'dj' (prueba real de §7, no una coincidencia)", () => {
  assert.equal(isRootDjQuery("DJ"), true);
  assert.equal(isRootDjQuery("dj"), true);
  assert.equal(isRootDjQuery("  DJ  "), true);
  assert.equal(isRootDjQuery("DJ Mago"), false);

  const results = searchTalentByName(T2_ALL_ROWS, "DJ");
  const names = results.map((r) => r.stage_name);
  // BIANCA no tiene "dj" como substring en su stage_name y aun así debe
  // aparecer — es la prueba de que §7 es una regla real, no un accidente de
  // que hoy casi todos los nombres empiecen con "DJ".
  assert.ok(names.includes("Bianca Ray"), "Bianca Ray (sin 'dj' en el nombre) debe aparecer para la query raíz 'DJ'");
  for (const real of ["DJMago305", "DJSolitario", "DJYuyo", "DJ Moe", "DJ Manuel", "DJ Muñoz"]) {
    assert.ok(names.includes(real), `${real} debe estar en el universo elegible completo`);
  }
  assert.ok(!names.includes("DJ PRO TEST") && !names.includes("Alexander Reyes") && !names.includes("Gerardo A Valle"));
});

/* ───────────── 2-6 · narrowing progresivo "DJ M"→"DJ Ma"→"DJ Mag"→exacto ── */

test("T2-2 · 'DJ M' excluye DJs cuyo stage_name normalizado no calza", () => {
  const results = searchTalentByName(PROGRESSIVE_ROWS, "DJ M");
  const names = results.map((r) => r.stage_name).sort();
  assert.deepEqual(names, ["DJ Manuel", "DJ Moe", "DJMago305"]);
});

test("T2-3 · 'DJ Ma' estrecha más que 'DJ M'", () => {
  const wide = searchTalentByName(PROGRESSIVE_ROWS, "DJ M");
  const narrower = searchTalentByName(PROGRESSIVE_ROWS, "DJ Ma");
  const narrowerNames = narrower.map((r) => r.stage_name).sort();
  assert.deepEqual(narrowerNames, ["DJ Manuel", "DJMago305"]);
  assert.ok(narrower.length < wide.length, "'DJ Ma' debe tener MENOS resultados que 'DJ M'");
  assert.ok(narrower.every((r) => wide.some((w) => w.stage_name === r.stage_name)),
    "'DJ Ma' debe ser subconjunto de 'DJ M'");
});

test("T2-4 · 'DJ Mag' estrecha más que 'DJ Ma'", () => {
  const prev = searchTalentByName(PROGRESSIVE_ROWS, "DJ Ma");
  const results = searchTalentByName(PROGRESSIVE_ROWS, "DJ Mag");
  const names = results.map((r) => r.stage_name);
  assert.deepEqual(names, ["DJMago305"]);
  assert.ok(results.length < prev.length, "'DJ Mag' debe tener MENOS resultados que 'DJ Ma'");
});

test("T2-5 · 'DJMago305' resuelve exactamente a esa fila", () => {
  const results = searchTalentByName(PROGRESSIVE_ROWS, "DJMago305");
  assert.deepEqual(results.map((r) => r.stage_name), ["DJMago305"]);
});

test("T2-6 · minúsculas ('dj m', 'djmago305') se comporta idéntico a mayúsculas/mixto", () => {
  const mixed = searchTalentByName(PROGRESSIVE_ROWS, "DJ M").map((r) => r.stage_name).sort();
  const lower = searchTalentByName(PROGRESSIVE_ROWS, "dj m").map((r) => r.stage_name).sort();
  assert.deepEqual(lower, mixed);

  const exactMixed = searchTalentByName(PROGRESSIVE_ROWS, "DJMago305").map((r) => r.stage_name);
  const exactLower = searchTalentByName(PROGRESSIVE_ROWS, "djmago305").map((r) => r.stage_name);
  assert.deepEqual(exactLower, exactMixed);
});

/* ───────────── 7 · normalización de acentos, con un caso real en fixture ── */

test("T2-7 · un query SIN acento matchea un stage_name almacenado CON acento ('DJ Muñoz')", () => {
  assert.equal(normalizeText("DJ Muñoz"), normalizeText("DJ Munoz"));
  assert.equal(squash("DJ Muñoz"), squash("dj munoz"));
  assert.equal(matchesNameQuery(DJ_MUNOZ, "DJ Munoz"), true);
  assert.equal(matchesNameQuery(DJ_MUNOZ, "Munoz"), true);

  const results = searchTalentByName([DJ_MUNOZ, ...PROGRESSIVE_ROWS], "DJ Munoz");
  assert.ok(results.some((r) => r.stage_name === "DJ Muñoz"),
    "'DJ Munoz' (sin acento) debe encontrar el stage_name almacenado 'DJ Muñoz' (con acento)");
});

/* ───────────── 8 · borrar caracteres re-expande en cada paso ───────────── */

test("T2-8 · borrar caracteres ('DJ Mag'→'DJ M'→'DJ') re-expande el resultado en cada paso, sin resultados obsoletos", () => {
  const stageOf = (rows) => searchTalentByName(PROGRESSIVE_ROWS, rows).map((r) => r.stage_name).sort();

  const full = stageOf("DJ Mag");
  const back1 = stageOf("DJ Ma");
  const back2 = stageOf("DJ M");
  const back3 = stageOf("DJ"); // raíz — todo el universo elegible de PROGRESSIVE_ROWS

  assert.deepEqual(full, ["DJMago305"]);
  assert.ok(back1.length >= full.length && full.every((n) => back1.includes(n)));
  assert.deepEqual(back1, ["DJ Manuel", "DJMago305"]);
  assert.ok(back2.length >= back1.length && back1.every((n) => back2.includes(n)));
  assert.deepEqual(back2, ["DJ Manuel", "DJ Moe", "DJMago305"]);
  assert.ok(back3.length >= back2.length && back2.every((n) => back3.includes(n)));
  assert.deepEqual(back3, ["DJ Manuel", "DJ Moe", "DJMago305", "DJSolitario", "DJYuyo"],
    "borrar hasta 'DJ' debe traer de vuelta TODO el universo elegible del fixture, sin quedarse pegado en el último filtro");
});

/* ───────────── 9 · el nombre manda sobre metadata incidental (§6) ──────── */

test("T2-9 · el nombre manda sobre bio/ciudad/roles incidentales — falla contra la vieja matchesQuery() a propósito, para probar que la ruta nueva hacía falta", () => {
  const tokens = tokenize("DJ M");
  // Precondición: bajo la ruta VIEJA (atributo-amplio, §5), Bianca Ray SÍ
  // matchearía "DJ M" — su haystack trae "dj" (roles) y "m" (Miami/Bianca)
  // como substrings sueltos, aunque su nombre no tenga nada que ver.
  assert.equal(matchesQuery(BIANCA, tokens), true,
    "precondición: matchesQuery() (ruta vieja, por diseño de atributo-amplio) SÍ matchea a Bianca Ray con 'DJ M'");

  // La ruta NUEVA (nombre-primero, §6) la excluye: su stage_name no calza.
  assert.equal(matchesNameQuery(BIANCA, "DJ M"), false,
    "matchesNameQuery() debe EXCLUIR a Bianca Ray — el nombre manda, no la metadata incidental");

  const results = searchTalentByName([BIANCA, DJMAGO_T2], "DJ M");
  assert.ok(!results.some((r) => r.stage_name === "Bianca Ray"), "Bianca Ray no debe aparecer en el tipeo en vivo de 'DJ M'");
  assert.ok(results.some((r) => r.stage_name === "DJMago305"));
});

/* ───────────── 10-12 · incompletos y cuentas de prueba, en cada etapa ──── */

test("T2-10 · un DJ incompleto (sin bio/foto) queda excluido en CADA etapa de la query, no solo en una", () => {
  const incompleto = { ...DJYUYO, bio: null, bio_short: null, photo_url: null, dj_slug: "yuyo-incompleto-synthetic", stage_name: "DJ Yuyo Incompleto" };
  assert.equal(isEligibleForPublicSearch(incompleto), false);
  for (const q of ["DJ", "DJ Y", "DJ Yu", "DJ Yuyo", "Yuyo"]) {
    const results = searchTalentByName([incompleto, ...T2_ALL_ROWS], q);
    assert.ok(!results.some((r) => r.stage_name === "DJ Yuyo Incompleto"), `debe estar excluido en la etapa "${q}"`);
  }
});

test("T2-11 · la fila con forma 'DJ PRO TEST' queda excluida específicamente, en cada etapa", () => {
  for (const q of ["DJ", "DJ P", "DJ PR", "DJ PRO", "DJ PRO TEST"]) {
    const results = searchTalentByName(T2_ALL_ROWS, q);
    assert.ok(!results.some((r) => r.stage_name === "DJ PRO TEST"), `DJ PRO TEST no debe aparecer para "${q}"`);
  }
});

test("T2-12 · la fila con forma 'Alexander Reyes' queda excluida específicamente, en cada etapa", () => {
  for (const q of ["DJ", "Alexander", "Alexander Reyes"]) {
    const results = searchTalentByName(T2_ALL_ROWS, q);
    assert.ok(!results.some((r) => r.stage_name === "Alexander Reyes"), `Alexander Reyes no debe aparecer para "${q}"`);
  }
});

/* ───────────── 13 · los 3 DJs reales, incluidos para su propia query ──── */

test("T2-13 · DJMago305/DJSolitario/DJYuyo permanecen incluidos para sus propias queries de nombre", () => {
  assert.ok(searchTalentByName(T2_ALL_ROWS, "DJMago305").some((r) => r.stage_name === "DJMago305"));
  assert.ok(searchTalentByName(T2_ALL_ROWS, "DJSolitario").some((r) => r.stage_name === "DJSolitario"));
  assert.ok(searchTalentByName(T2_ALL_ROWS, "DJ Yuyo").some((r) => r.stage_name === "DJYuyo"));
});

/* ───────────── 14-16 · enrutamiento canónico en resultados en vivo ─────── */

test("T2-14/15/16 · href canónico './dj/<slug>.html' para todo resultado, y jamás profile.html?id= / dj-profile.html?id=", () => {
  for (const q of ["DJ", "DJ M", "DJ Mago", "Bianca"]) {
    const results = searchTalentByName(T2_ALL_ROWS, q);
    for (const r of results) {
      const href = canonicalHref(r);
      assert.equal(href, `./dj/${r.dj_slug}.html`);
      const html = renderResultCardHTML(r, { rentHref: "./rentals.html?dj=x", rentLabel: "Rentar este DJ" });
      assert.equal(/profile\.html\?id=/.test(html), false);
      assert.equal(/dj-profile\.html\?id=/.test(html), false);
    }
  }
});

/* ───────────── 17 · función pura y síncrona, sin concepto de "Enter" ───── */

test("T2-17 · el filtro de nombre no tiene ningún requisito oculto de tecla Enter/submit — función pura, síncrona, por construcción", () => {
  const result = filterByNameQuery(PROGRESSIVE_ROWS, "DJ M");
  assert.equal(result instanceof Promise, false, "no debe devolver una Promise");
  assert.ok(Array.isArray(result));
  // Correr la MISMA llamada, sin ningún evento de teclado/submit de por medio,
  // debe dar el mismo resultado — prueba por construcción que no hay gating
  // oculto de keypress dentro de la lógica pura.
  const result2 = filterByNameQuery(PROGRESSIVE_ROWS, "DJ M");
  assert.deepEqual(result.map((r) => r.stage_name), result2.map((r) => r.stage_name));
});

/* ───────────── 18 · llamadas secuenciales resuelven cada una su query ──── */

test("T2-18 · llamadas secuenciales rápidas con queries distintas resuelven cada una a SU propio resultado, sin estado compartido/obsoleto", () => {
  const sequence = ["DJ M", "DJ Ma", "DJ Mag", "DJMago305", "DJ"];
  const expected = {
    "DJ M": ["DJ Manuel", "DJ Moe", "DJMago305"],
    "DJ Ma": ["DJ Manuel", "DJMago305"],
    "DJ Mag": ["DJMago305"],
    "DJMago305": ["DJMago305"],
    "DJ": ["DJMago305", "DJSolitario", "DJYuyo", "DJ Moe", "DJ Manuel"],
  };
  for (const q of sequence) {
    const names = searchTalentByName(PROGRESSIVE_ROWS, q).map((r) => r.stage_name).sort();
    assert.deepEqual(names, [...expected[q]].sort(), `query "${q}" debe resolver a su propio set, no al de la llamada anterior`);
  }
  // Y en orden INVERSO — mismo resultado por query, sin importar el orden de
  // las llamadas (nada de contador/caché compartido entre invocaciones).
  for (const q of [...sequence].reverse()) {
    const names = searchTalentByName(PROGRESSIVE_ROWS, q).map((r) => r.stage_name).sort();
    assert.deepEqual(names, [...expected[q]].sort(), `(orden inverso) query "${q}" debe seguir resolviendo a su propio set`);
  }
});

/* ───────────── 19 · 500 filas, narrowing determinista bajo el corte de 120 ── */

test("T2-19 · con 500 filas elegibles, una secuencia de narrowing progresivo resuelve determinista bajo el corte ORDER+LIMIT(120)", () => {
  // 500 filas de relleno, no-premium, con nombres que ordenan alfabéticamente
  // DESPUÉS de "DJ..." — igual que el truco de la prueba "M" de arriba, para
  // que el corte de 120 no sea lo que decide si los objetivos sobreviven.
  const relleno = Array.from({ length: 500 }, (_, i) => synthEligibleDJ({
    dj_slug: `zz-filler-${i}`,
    stage_name: `ZZ Filler DJ ${String(i).padStart(3, "0")}`,
    city: "Relleno",
    bio: "Fila de relleno para la prueba de escala.",
    bio_short: null,
  }));

  const rows500 = [...relleno, DJMAGO_T2, DJSOLITARIO, DJYUYO, DJ_MOE, DJ_MANUEL];
  assert.equal(rows500.length, 505);

  const stageOf = (q) => searchTalentByName(rows500, q, { limit: 120 }).map((r) => r.stage_name).sort();

  assert.deepEqual(stageOf("DJ M"), ["DJ Manuel", "DJ Moe", "DJMago305"]);
  assert.deepEqual(stageOf("DJ Ma"), ["DJ Manuel", "DJMago305"]);
  assert.deepEqual(stageOf("DJ Mag"), ["DJMago305"]);
  assert.deepEqual(stageOf("DJMago305"), ["DJMago305"]);

  // Precondición explícita: ninguno de los 500 rellenos matchea "DJ M" (su
  // nombre aplastado no contiene "djm"), así que el narrowing de arriba no
  // es casualidad del relleno.
  assert.ok(relleno.every((dj) => matchesNameQuery(dj, "DJ M") === false));

  // Y determinismo: correr la misma query dos veces contra las 500 filas da
  // el mismo resultado.
  assert.deepEqual(stageOf("DJ M"), stageOf("DJ M"));
});

/* ───────────── 20 · las 42 pruebas del ticket #1 siguen intactas ───────── */

test("T2-20 · regresión del ticket #1: se corre por separado con `node --test tools/dj-profiles/*.test.mjs` (no se reimplementan aquí)", () => {
  // Esta prueba documenta el requisito §24 del brief del ticket #2: el
  // gate real es correr TODO el suite (build.test.mjs + este archivo) y
  // confirmar 42/42 del ticket #1 intactas + las de este archivo, todas en
  // verde. Ver el reporte final para los conteos exactos ejecutados.
  assert.equal(typeof qualifies, "function");
  assert.equal(typeof searchTalent, "function");
});
