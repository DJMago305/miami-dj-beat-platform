// web/find-dj-search.mjs — Public Talent Search: lógica pura, sin red, sin
// DOM, sin Supabase. Mismo patrón que tools/dj-profiles/build.mjs: funciones
// puras que reciben datos y devuelven datos, para poder probarlas con
// `node --test` contra fixtures (ver tools/dj-profiles/find-dj-search.test.mjs).
//
// Se carga en el navegador como <script type="module" src="./find-dj-search.mjs">
// desde find-dj.html (import real, no una copia que se pueda desincronizar) y
// también con `import` directo desde Node en el test — el mismo archivo, sin
// bifurcar.
//
// Qué prueba esto y qué NO prueba:
//   · SÍ prueba: elegibilidad (traducción de qualifies() de build.mjs),
//     construcción de la proyección pública (qué campos salen), búsqueda,
//     ranking, orden-antes-que-límite, y la construcción del link canónico.
//   · NO prueba: la vista SQL real (public_dj_talent) contra una base viva —
//     esa vista está PREPARADA (supabase/migrations/…) pero NO APLICADA, y
//     este ticket no tiene permiso para aplicarla ni para escribir en
//     ninguna base. Ver el reporte final para el deslinde exacto.

/* ═══ 1) normalización ═══════════════════════════════════════════════════
   Un solo mecanismo de normalización para nombre/ciudad/especialidad:
   minúsculas, sin acentos, sin puntuación, espacios colapsados. `squash()`
   además quita TODO espacio — existe específicamente para el hueco real de
   find-dj.html: "DJ Yuyo" (con espacio, como escribiría un usuario) contra
   "DJYuyo" (como está guardado el stage_name, sin espacio). */

export function normalizeText(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // marcas diacríticas combinantes (acentos)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function squash(s) {
  return normalizeText(s).replace(/\s+/g, "");
}

export function tokenize(query) {
  const n = normalizeText(query);
  return n ? n.split(/\s+/).filter(Boolean) : [];
}

/* ═══ 2) elegibilidad — traducción exacta de qualifies() (build.mjs) ═══════
   NO es una reinvención: es la MISMA regla, reescrita para poder vivir en un
   módulo sin dependencias de Node (build.mjs importa node:fs a nivel de
   archivo, así que no se puede importar directo en el navegador). La prueba
   "0 · paridad con qualifies()" en find-dj-search.test.mjs corre esta función
   y qualifies() sobre las MISMAS filas del fixture compartido y exige
   resultado idéntico fila por fila — así cualquier deriva entre las dos
   copias rompe el suite, no pasa en silencio. */

export function isActuallyDJTalent(dj) {
  const hay = `${dj.artist_specialty || ""} ${dj.roles || ""}`.toLowerCase();
  return /\bdj\b/.test(hay);
}

export function isSeoApprovedTalent(dj) {
  return dj.seo_publish_status === "approved";
}

export function isEligibleForPublicSearch(dj) {
  if (!dj) return false;
  if (dj.dj_slug === "owner" || /\bstaff\b/i.test(dj.artist_specialty || "")) return false;
  if (!isActuallyDJTalent(dj)) return false;
  if (!isSeoApprovedTalent(dj)) return false;
  return Boolean((dj.bio || dj.bio_short) && dj.photo_url && dj.stage_name && dj.dj_slug);
}

/* ═══ 3) proyección pública — la MISMA forma que expondría la vista SQL ════
   supabase/migrations/20260913110000_public_dj_talent_view.sql (preparada,
   NO aplicada) expone exactamente este conjunto de columnas. Esta función
   simula esa proyección sobre un fixture con forma de fila completa de
   dj_profiles (incluye email/phone/etc., como una fila real) para poder
   probar en el requisito G que NINGÚN campo privado sobrevive. */

export const PUBLIC_PROJECTION_FIELDS = Object.freeze([
  "user_id", "dj_slug", "stage_name", "photo_url", "city", "roles",
  "artist_specialty", "plan", "is_premium", "bio_preview",
]);

// Campos que jamás deben sobrevivir la proyección — lista explícita para que
// el requisito G pruebe algo concreto, no una ausencia genérica.
export const PRIVATE_FIELDS_FORBIDDEN = Object.freeze([
  "phone", "email", "address", "birth_date",
  "card_brand", "card_last4", "card_holder", "card_expiry",
  "stripe_customer_id", "hardware_token", "known_devices",
  "sft_pay_zelle_instructions", "sft_pay_venmo_instructions", "sft_pay_paypal_instructions",
  "wallet_balance", "referral_credits", "security_preference", "two_factor_enabled",
  "status", "rating", "review_count", "bio", "bio_short", "full_name", "username",
]);

export function projectPublicFields(dj) {
  const out = {};
  for (const key of PUBLIC_PROJECTION_FIELDS) {
    if (key === "bio_preview") continue;
    out[key] = dj[key] ?? null;
  }
  const src = (dj.bio_short && String(dj.bio_short).trim()) || (dj.bio && String(dj.bio).trim()) || "";
  out.bio_preview = src ? src.slice(0, 160) : null;
  return out;
}

/* ═══ 4) tier / premium — traducción de isPremiumTier() (web/subscription.js)
   subscription.js es un IIFE que se cuelga de window, no un módulo — no se
   puede `import` desde Node. Se reescribe aquí con la MISMA lógica para
   poder usarla en ranking puro y en el harness de QA sin depender del DOM.
   find-dj.html sigue usando su propio tierBadgeHtml()/window.MDB_SUBSCRIPTION
   para el CHIP visible (con i18n real) — esto solo alimenta el ORDEN. */

const PRO_PLAN_TYPES = ["pro_monthly", "pro_annual", "PRO"];

function isPlanActiveLike(p) {
  if (!p) return false;
  const status = String(p.plan_status || "inactive").toLowerCase();
  if (status !== "active") return false;
  if (p.plan_expires_at) {
    const d = new Date(p.plan_expires_at);
    if (Number.isNaN(d.getTime())) return false;
    return d > new Date();
  }
  return true;
}

export function isPremiumTierLike(dj) {
  if (!dj) return false;
  if (dj.is_premium === true) return true;
  const sub = String(dj.subscription_status || "").toLowerCase();
  if (sub === "active" || sub === "trialing") return true;
  const pl = String(dj.plan || "").toUpperCase();
  if ((pl === "PRO" || pl === "ELITE") && isPlanActiveLike(dj)) return true;
  if (PRO_PLAN_TYPES.indexOf(dj.plan_type) !== -1 && isPlanActiveLike(dj)) return true;
  return false;
}

/* ═══ 5) búsqueda determinista ══════════════════════════════════════════
   Coincidencia por intersección de tokens (AND), no OR: una búsqueda de
   varias palabras ESTRECHA resultados, nunca los amplía. El haystack de
   cada fila incluye su stage_name aplastado (sin espacios) específicamente
   para que "DJ Yuyo" (dos tokens) encuentre "DJYuyo" (guardado sin espacio):
   el token "yuyo" aparece como substring de "djyuyo" en el haystack
   aplastado aunque no exista ningún espacio ahí para separarlo. */

export function buildHaystack(dj) {
  const parts = [dj.stage_name, dj.city, dj.artist_specialty, dj.roles].filter(Boolean).join(" ");
  const normalized = normalizeText(parts);
  const squashedName = dj.stage_name ? squash(dj.stage_name) : "";
  return `${normalized} ${squashedName}`.trim();
}

export function matchesQuery(dj, tokens) {
  if (!tokens || tokens.length === 0) return true; // modo directorio: sin query, todo pasa
  const hay = buildHaystack(dj);
  return tokens.every((t) => hay.includes(t));
}

export function isExactStageMatch(dj, rawQuery) {
  if (!rawQuery) return false;
  return squash(dj.stage_name) === squash(rawQuery);
}

// Completitud de perfil: cuenta cuántos campos opcionales de valor real
// están llenos. Sirve solo como desempate — nunca decide inclusión.
export function completenessScore(dj) {
  const fields = [dj.bio_preview, dj.city, dj.artist_specialty, dj.roles];
  return fields.filter((v) => v != null && String(v).trim() !== "").length;
}

/**
 * Comparador determinista. Precedencia (mayor gana, en este orden):
 *   1) coincidencia exacta de stage_name
 *   2) relevancia de atributo (cuántos tokens de la query, fuera del propio
 *      stage_name aplastado, aparecen en ciudad/especialidad/roles)
 *   3) completitud de perfil
 *   4) relevancia de área de servicio (¿algún token calza con la ciudad?)
 *   5) tier premium — SOLO como desempate menor, nunca como piso absoluto
 *   6) alfabético por stage_name — para que el orden sea 100% determinista
 *      (requisito H: correr la misma query dos veces da el mismo orden).
 * Deliberadamente NO usa `rating`/`review_count`: no existe todavía ningún
 * concepto tipo `rating_display_status` que certifique que la muestra es
 * legítima (ver corrección 17 de build.mjs, que ya eliminó la fabricación
 * de estrellas a partir del default sin reseñas) — así que la calificación
 * cruda simplemente no participa del orden.
 */
export function compareForSearch(rawQuery, tokens) {
  return function (a, b) {
    const aExact = isExactStageMatch(a, rawQuery) ? 1 : 0;
    const bExact = isExactStageMatch(b, rawQuery) ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;

    const attrTokens = tokens.filter((t) => t !== squash(rawQuery));
    const attrScore = (dj) => {
      const hayAttr = normalizeText([dj.city, dj.artist_specialty, dj.roles].filter(Boolean).join(" "));
      return attrTokens.filter((t) => hayAttr.includes(t)).length;
    };
    const aAttr = attrScore(a);
    const bAttr = attrScore(b);
    if (aAttr !== bAttr) return bAttr - aAttr;

    const aComplete = completenessScore(a);
    const bComplete = completenessScore(b);
    if (aComplete !== bComplete) return bComplete - aComplete;

    const cityToken = tokens.find((t) => a.city && normalizeText(a.city).includes(t)) ? 1 : 0;
    const cityTokenB = tokens.find((t) => b.city && normalizeText(b.city).includes(t)) ? 1 : 0;
    if (cityToken !== cityTokenB) return cityTokenB - cityToken;

    const aPremium = isPremiumTierLike(a) ? 1 : 0;
    const bPremium = isPremiumTierLike(b) ? 1 : 0;
    if (aPremium !== bPremium) return bPremium - aPremium;

    return normalizeText(a.stage_name).localeCompare(normalizeText(b.stage_name));
  };
}

/* ═══ 5b) coincidencia de NOMBRE — tipeo progresivo en vivo (find-dj.html) ══
   Ticket #2, §6: cuando la query se comporta como búsqueda de NOMBRE (el caso
   común del tipeo en vivo), NO debe mantenerse visible un DJ solo porque los
   caracteres tecleados aparecen en bio/ciudad/especialidad/otro metadato.
   matchesQuery()/buildHaystack() de arriba (§5) se DEJAN INTACTOS — siguen
   siendo la ruta de búsqueda amplia por atributo (?specialty=, ticket #1) —
   esta es una ruta de coincidencia SEPARADA, exclusivamente contra
   stage_name aplastado, para que "DJ M" excluya a un DJ cuya bio/ciudad
   mencione la letra M pero cuyo nombre no empiece/contenga "djm". */

export function isRootDjQuery(rawQuery) {
  // §7: la query literal "DJ" (normalizada/aplastada) es un COMANDO de
  // producto — "muestra todo el universo público elegible" — no una
  // exigencia de que el stage_name contenga el substring "dj". Caso especial
  // explícito: no depende de que los stage_name de hoy empiecen con "DJ"
  // (una fila futura sin ese prefijo debe seguir apareciendo para "DJ").
  return squash(rawQuery) === "dj";
}

export function matchesNameQuery(dj, rawQuery) {
  if (!dj) return false;
  const q = squash(rawQuery);
  if (!q) return true; // sin query: modo directorio, todo pasa
  if (isRootDjQuery(rawQuery)) return true; // §7 — caso especial explícito
  return squash(dj.stage_name).includes(q);
}

// Paso puro de filtrado por nombre sobre un array YA elegible/ya traído —
// es lo que el listener `input` de find-dj.html corre en cada tecla, sin red
// (estrategia de datos del ticket #2: traer una vez, filtrar en memoria).
// O(N) simple, sin async, sin concepto de "Enter" — toma la query y devuelve
// de forma síncrona (requisito 17 del ticket: la lógica no exige submit).
export function filterByNameQuery(rows, rawQuery) {
  return (rows || []).filter((dj) => matchesNameQuery(dj, rawQuery));
}

// Pipeline completo de nombre, mismo patrón que searchTalent() (§5) pero con
// la ruta de coincidencia de §6 en vez de matchesQuery(). Sirve tanto a los
// fixtures de find-dj-search.test.mjs como, en espíritu, al harness de QA —
// find-dj.html en vivo filtra sobre filas YA elegibles (ya vienen de
// public_dj_talent) y no necesita repetir isEligibleForPublicSearch/
// simulateDbOrderedSlice por tecla; esta función existe para que la MISMA
// regla se pueda probar de punta a punta contra filas crudas, igual que "M".
export function searchTalentByName(rawRows, rawQuery, { limit = 120 } = {}) {
  const eligible = (rawRows || []).filter(isEligibleForPublicSearch);
  const sliced = simulateDbOrderedSlice(eligible, limit);
  const matched = filterByNameQuery(sliced, rawQuery);
  const tokens = tokenize(rawQuery);
  const ranked = matched.slice().sort(compareForSearch(rawQuery, tokens));
  return ranked.map(projectPublicFields);
}

/* ═══ 6) orden-antes-que-límite (simula el .order().limit(120) de la vista) ═
   El defecto en producción era `.limit(120)` SIN `.order()` — con roster
   grande, cuáles 120 filas llegan es esencialmente arbitrario (orden de
   PostgREST/paginación interna), y el ranking JS solo reordena lo que ya
   sobrevivió el corte. Esta función es lo que la consulta real a Supabase
   hará en el servidor: ORDER BY premium-equivalente, luego stage_name, y
   RECIÉN DESPUÉS LIMIT — para que el corte de 120 conserve a los candidatos
   que de verdad importan. */
export function simulateDbOrderedSlice(rows, limit = 120) {
  const sorted = rows.slice().sort((a, b) => {
    const aPremium = isPremiumTierLike(a) ? 0 : 1;
    const bPremium = isPremiumTierLike(b) ? 0 : 1;
    if (aPremium !== bPremium) return aPremium - bPremium;
    return normalizeText(a.stage_name).localeCompare(normalizeText(b.stage_name));
  });
  return sorted.slice(0, limit);
}

/**
 * Pipeline completo, puro: filas crudas (forma de dj_profiles) → resultados
 * de búsqueda listos para tarjeta. Simula lo que hará la consulta real
 * contra public_dj_talent (WHERE de la vista = isEligibleForPublicSearch,
 * proyección = projectPublicFields, ORDER+LIMIT = simulateDbOrderedSlice,
 * afinado final = compareForSearch).
 */
export function searchTalent(rawRows, rawQuery, { limit = 120 } = {}) {
  const tokens = tokenize(rawQuery);
  const eligible = (rawRows || []).filter(isEligibleForPublicSearch);
  const matched = eligible.filter((dj) => matchesQuery(dj, tokens));
  const sliced = simulateDbOrderedSlice(matched, limit);
  const ranked = sliced.slice().sort(compareForSearch(rawQuery, tokens));
  return ranked.map(projectPublicFields);
}

/* ═══ 7) enrutamiento canónico ═══════════════════════════════════════════
   Nunca profile.html?id=... ni dj-profile.html?id=...: el único destino es
   la página estática canónica generada por build.mjs. Sin dj_slug, sin link
   — "no hay dato → no hay módulo", mismo principio que build.mjs ya aplica
   en toda la generación de perfiles. */
export function canonicalHref(dj) {
  const slug = dj && dj.dj_slug ? String(dj.dj_slug).trim() : "";
  return slug ? `./dj/${slug}.html` : null;
}

/* ═══ 8) tarjeta de resultado — la ÚNICA función de render, compartida entre
   find-dj.html (búsqueda real) y el arnés de QA (fixtures locales). Recibe
   los pedazos que dependen de window/i18n/CTA de reserva ya calculados por
   el llamador (esos NO se tocan — fuera de alcance de este ticket) y solo
   arma el marcado de la tarjeta. */

export function escHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderResultCardHTML(dj, { tierBadgeHtml = "", rentHref = "#", rentLabel = "" } = {}) {
  const name = escHtml(dj.stage_name || dj.dj_slug || "Artist");
  const img = escHtml(dj.photo_url || "");
  const href = canonicalHref(dj);
  const imgSrc = img || "./assets/dj-avatar-placeholder.png";
  const rawSpecialty = String(dj.artist_specialty || dj.roles || "").split(",")[0].trim();
  const specialtyTag = rawSpecialty ? escHtml(rawSpecialty.slice(0, 18)) : "";
  const cityStr = dj.city ? "📍 " + escHtml(dj.city) : "";
  const bioStr = dj.bio_preview ? escHtml(String(dj.bio_preview).slice(0, 110)) : "";
  // Sin dj_slug no hay link — nunca cae a profile.html/dj-profile.html.
  const linkOpenTag = href
    ? `<a class="find-dj-chip__link" href="${escHtml(href)}">`
    : `<div class="find-dj-chip__link find-dj-chip__link--nolink">`;
  const linkCloseTag = href ? "</a>" : "</div>";

  return (
    '<article class="find-dj-chip">' +
    linkOpenTag +
    '<div class="find-dj-chip__photo-wrap">' +
    '<img class="find-dj-chip__photo" src="' + imgSrc + '" alt="' + name + '" loading="lazy" />' +
    (specialtyTag ? '<span class="find-dj-chip__specialty-tag">' + specialtyTag + '</span>' : '') +
    '</div>' +
    '<div class="find-dj-chip__body">' +
    '<div class="find-dj-chip__name-row">' +
    '<span class="find-dj-chip__name">' + name + '</span>' +
    tierBadgeHtml +
    '</div>' +
    (cityStr ? '<span class="find-dj-chip__city">' + cityStr + '</span>' : '') +
    (bioStr ? '<p class="find-dj-chip__bio">' + bioStr + '</p>' : '') +
    '</div>' +
    linkCloseTag +
    (href
      ? '<a class="find-dj-chip__rent" href="' + escHtml(rentHref) + '">' + escHtml(rentLabel) + '</a>'
      : '') +
    '</article>'
  );
}
