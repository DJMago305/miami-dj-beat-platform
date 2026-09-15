#!/usr/bin/env node
// tools/dj-profiles/build.test.mjs — suite de pruebas del generador de
// perfiles públicos de DJ.
//
//   node --test tools/dj-profiles/
//
// Sin dependencias externas: usa el runner y el assert nativos de Node.
//
// REGLA DE LA SUITE: ninguna prueba toca la red ni Supabase. Todo sale del
// fixture local fixtures/roster.approved.json (corrección 4), que a su vez fue
// reconstruido desde la SALIDA APROBADA en origin/main — por eso sirve de
// baseline de regresión real y no de data inventada.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import {
  SITE_ORIGIN, ORG_ID, PERSON_IDENTITY, IDENTITY_ANCHOR_SLUG,
  qualifies, qualifiesStaff, isActuallyDJ, isSeoApproved, isPaid,
  renderPage, renderIndexPage, renderTeamPage,
  planGeneration, planSitemap, isManagedProfileFile, isRemovableSitemapLoc,
  resolveEnvironment, loadFixture, readSitemapLocs,
} from "./build.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const WEB = join(ROOT, "web");
const FIXTURE = join(HERE, "fixtures", "roster.approved.json");

const ROWS = loadFixture(FIXTURE);
const byslug = (s) => structuredClone(ROWS.find((r) => r.dj_slug === s));
const DJ = () => byslug("djmago305");
const OWNER = () => byslug("owner");

/** Extrae el objeto JSON-LD de un HTML renderizado. */
function ld(html, index = 0) {
  const all = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  return JSON.parse(all[index][1]);
}

/** Archivo "en disco" sintético para las pruebas de propiedad/reconciliación. */
function managedFile(slug) {
  return { filename: `${slug}.html`, html: renderPage({ ...DJ(), dj_slug: slug }) };
}

/* ───────────────────────────── 1-5 · elegibilidad ─────────────────────── */

test("1 · perfil completo con seo_publish_status='approved' califica", () => {
  const dj = DJ();
  assert.equal(dj.seo_publish_status, "approved");
  assert.equal(qualifies(dj), true);
});

test("2 · perfil completo con seo_publish_status='pending' NO califica", () => {
  const dj = { ...DJ(), seo_publish_status: "pending" };
  assert.equal(qualifies(dj), false);
});

test("3 · seo_publish_status ausente/null FALLA CERRADA (no califica)", () => {
  const sinCampo = { ...DJ() };
  delete sinCampo.seo_publish_status;
  assert.equal(qualifies(sinCampo), false, "ausente debe fallar cerrada");
  assert.equal(qualifies({ ...DJ(), seo_publish_status: null }), false, "null debe fallar cerrada");
  assert.equal(qualifies({ ...DJ(), seo_publish_status: "" }), false);
  assert.equal(qualifies({ ...DJ(), seo_publish_status: "APPROVED" }), false, "solo el literal exacto publica");
  assert.equal(qualifies({ ...DJ(), seo_publish_status: true }), false);
});

test("4 · quien no es DJ real queda excluido sin importar los demás campos", () => {
  const bartender = { ...DJ(), artist_specialty: "Bartender", roles: "bartender", seo_publish_status: "approved" };
  assert.equal(isActuallyDJ(bartender), false);
  assert.equal(qualifies(bartender), false);
  // …incluso con bio, foto, stage_name y slug perfectos.
  assert.ok(bartender.bio && bartender.photo_url && bartender.stage_name && bartender.dj_slug);
});

test("5 · la exclusión de owner/staff se conserva y no la altera el campo nuevo", () => {
  const owner = OWNER();
  assert.equal(qualifies(owner), false, "la fila owner nunca es un perfil de DJ");
  assert.equal(qualifies({ ...owner, seo_publish_status: "approved" }), false);
  assert.equal(qualifies({ ...owner, seo_publish_status: "pending" }), false);
  // El slug literal "owner" también queda fuera aunque no diga Staff.
  assert.equal(qualifies({ ...DJ(), dj_slug: "owner" }), false);
  // …y un DJ marcado Staff tampoco entra.
  assert.equal(qualifies({ ...DJ(), artist_specialty: "DJ · Staff" }), false);
});

/* ───────────────────── 6-7 · abortos de validación ────────────────────── */

test("6 · slug duplicado aborta la generación entera (cero escrituras)", () => {
  const a = DJ();
  const b = { ...byslug("djyuyo"), dj_slug: "djmago305" };
  const plan = planGeneration({ rows: [a, b], existingFiles: [] });
  assert.equal(plan.ok, false, "el plan debe quedar inválido");
  assert.equal(plan.collisions.length, 1);
  assert.equal(plan.collisions[0].slug, "djmago305");
  assert.equal(plan.collisions[0].count, 2);
  assert.match(plan.errors.join("\n"), /\[COLLISION\] djmago305 appears 2 times \(dj_names: /);
  // ok:false es precisamente la compuerta que impide que main() escriba nada.
});

test("7 · roster vacío aborta antes de tocar directorio/equipo/sitemap", () => {
  const plan = planGeneration({ rows: [], existingFiles: [] });
  assert.equal(plan.ok, false);
  assert.equal(plan.rosterSafetyAbort, true);
  assert.match(plan.errors.join("\n"), /\[ROSTER-SAFETY-ABORT\]/);
  assert.match(plan.errors.join("\n"), /refusing to overwrite existing directory\/team pages with an empty roster/);
  // Un roster que solo trae filas no elegibles cuenta igual como vacío.
  const soloPending = planGeneration({ rows: [{ ...DJ(), seo_publish_status: "pending" }], existingFiles: [] });
  assert.equal(soloPending.rosterSafetyAbort, true);
  // La única puerta de salida es el flag, hoy NO habilitado.
  const optIn = planGeneration({ rows: [], existingFiles: [], allowEmptyRoster: true });
  assert.equal(optIn.rosterSafetyAbort, false);
});

/* ──────────────── 8-11 · propiedad, stale, rename, ancla ──────────────── */

test("8 · un archivo ajeno en web/dj/ nunca es candidato a borrado", () => {
  const ajeno = { filename: "landing-promo.html", html: "<!doctype html><body class=\"otra-cosa\">hola</body>" };
  assert.equal(isManagedProfileFile(ajeno.filename, ajeno.html), false);
  const plan = planGeneration({ rows: [DJ()], existingFiles: [ajeno] });
  assert.ok(plan.unowned.includes("landing-promo.html"), "debe salir como SKIP-UNOWNED");
  assert.ok(!plan.stale.includes("landing-promo"));
  assert.ok(!plan.staleRemovable.includes("landing-promo"));
  // Un archivo con el body correcto pero canonical de OTRO slug tampoco es nuestro.
  const canonicalAjeno = { filename: "impostor.html", html: renderPage(DJ()) };
  assert.equal(isManagedProfileFile(canonicalAjeno.filename, canonicalAjeno.html), false);
});

test("9 · directorio.html jamás se trata como perfil stale ni como borrable", () => {
  assert.equal(isManagedProfileFile("directorio.html", renderPage(DJ())), false,
    "ni siquiera con el marcador de propiedad completo");
  const plan = planGeneration({
    rows: [DJ()],
    existingFiles: [managedFile("djmago305"), { filename: "directorio.html", html: renderIndexPage([DJ()]) }],
  });
  assert.ok(!plan.stale.includes("directorio"));
  assert.ok(!plan.staleRemovable.includes("directorio"));
  assert.ok(!plan.unowned.includes("directorio.html"), "tampoco se lista como ajeno: se ignora por completo");
  // Y su URL está protegida en el sitemap.
  assert.equal(isRemovableSitemapLoc(`${SITE_ORIGIN}/dj/directorio.html`), false);
  assert.equal(isRemovableSitemapLoc(`${SITE_ORIGIN}/equipo.html`), false);
});

test("10 · un archivo gestionado fuera del set deseado se clasifica como stale, y se parte por causa", () => {
  const rows = [DJ()];
  const files = [managedFile("djmago305"), managedFile("djretirado")];

  // Sin historia en el manifiesto ⇒ baja real.
  const sinManifiesto = planGeneration({ rows, existingFiles: files });
  assert.deepEqual(sinManifiesto.stale, ["djretirado"]);
  assert.deepEqual(sinManifiesto.staleRemovable, ["djretirado"]);
  assert.equal(sinManifiesto.renameCandidates.length, 0);

  // Con el manifiesto apuntando a un user_id que sigue deseado con OTRO slug ⇒ rename.
  const conRename = planGeneration({
    rows, existingFiles: files,
    manifest: { slugs: { [DJ().user_id]: "djretirado" }, ok: true, existed: true },
  });
  assert.deepEqual(conRename.stale, ["djretirado"]);
  assert.deepEqual(conRename.staleRemovable, [], "un rename NO es borrable");
  assert.equal(conRename.renameCandidates.length, 1);
  assert.deepEqual(conRename.renameCandidates[0], { user_id: DJ().user_id, old: "djretirado", new: "djmago305" });

  // Un user_id que ya no aparece en el set deseado sí es baja real.
  const bajaReal = planGeneration({
    rows, existingFiles: files,
    manifest: { slugs: { "uuid-de-alguien-que-se-fue": "djretirado" }, ok: true, existed: true },
  });
  assert.deepEqual(bajaReal.staleRemovable, ["djretirado"]);
});

test("11 · un rename-candidate no borra el archivo viejo en silencio", () => {
  const rows = [DJ()];
  const plan = planGeneration({
    rows,
    existingFiles: [managedFile("djmago305"), managedFile("nombre-viejo")],
    manifest: { slugs: { [DJ().user_id]: "nombre-viejo" }, ok: true, existed: true },
    reconcile: true,
  });
  assert.equal(plan.ok, true);
  assert.ok(!plan.staleRemovable.includes("nombre-viejo"), "nunca entra a la lista que --reconcile borra");
  assert.equal(plan.renameCandidates[0].old, "nombre-viejo");
  assert.match(plan.notes.join("\n"), /\[RENAME-CANDIDATE\] user_id=.+ old=nombre-viejo new=djmago305/);
  // No se propone ninguna baja de sitemap por un rename.
  assert.deepEqual(plan.sitemapRemove, []);

  // — ancla de identidad (corrección 11) —
  // Los 3 archivos EN VIVO deben reconocerse como propios, no como ajenos.
  for (const slug of ["djmago305", "djsolitario", "djyuyo"]) {
    const live = readFileSync(join(WEB, "dj", `${slug}.html`), "utf8");
    assert.equal(isManagedProfileFile(`${slug}.html`, live), true,
      `${slug}.html en vivo debe reconocerse como archivo gestionado`);
  }
  // Si djmago305 llegara a calcularse como borrable, se aborta todo.
  const anclaEnRiesgo = planGeneration({
    rows: [byslug("djyuyo")],
    existingFiles: [managedFile(IDENTITY_ANCHOR_SLUG), managedFile("djyuyo")],
    reconcile: true,
  });
  assert.equal(anclaEnRiesgo.ok, false);
  assert.match(anclaEnRiesgo.errors.join("\n"),
    /\[IDENTITY-ANCHOR-ABORT\] djmago305\.html is protected and cannot be automatically removed — manual review required/);
});

/* ─────────────────────── 12-14 · canonical y sitemap ──────────────────── */

test("12 · canonical, Person.url y <loc> del sitemap usan www de forma consistente", () => {
  const html = renderPage(DJ());
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)[1];
  assert.equal(canonical, "https://www.miamidjbeat.com/dj/djmago305.html");
  assert.equal(ld(html).url, canonical);
  assert.equal(ld(html)["@id"].startsWith(`${SITE_ORIGIN}/`), true);
  assert.equal(html.match(/<meta property="og:url" content="([^"]+)"/)[1], canonical);

  // Ningún host pelado en NINGUNA de las 3 plantillas.
  const bareHost = /https:\/\/miamidjbeat\.com/;
  for (const out of [html, renderIndexPage([DJ()]), renderTeamPage([OWNER()])]) {
    assert.equal(bareHost.test(out), false, "el generador no debe emitir el host sin www");
  }
  const { xml } = planSitemap("<urlset>\n</urlset>", { addPaths: [{ path: "dj/djmago305.html", priority: "0.7" }] });
  for (const loc of readSitemapLocs(xml)) assert.ok(loc.startsWith(`${SITE_ORIGIN}/`), loc);
});

test("13 · el alta de sitemap usa específicamente el host www", () => {
  const { xml, added } = planSitemap("<urlset>\n</urlset>", {
    addPaths: [{ path: "dj/djyuyo.html", priority: "0.7" }, { path: "equipo.html", priority: "0.6" }],
  });
  assert.deepEqual(added, [`${SITE_ORIGIN}/dj/djyuyo.html`, `${SITE_ORIGIN}/equipo.html`]);
  assert.ok(xml.includes("<loc>https://www.miamidjbeat.com/dj/djyuyo.html</loc>"));
  assert.equal(/<loc>https:\/\/miamidjbeat\.com\//.test(xml), false);
});

test("14 · no se duplica una URL que el sitemap ya tiene (con www)", () => {
  const base = `<urlset>
  <url>
    <loc>${SITE_ORIGIN}/dj/djmago305.html</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>`;
  const { xml, added } = planSitemap(base, { addPaths: [{ path: "dj/djmago305.html", priority: "0.7" }] });
  assert.deepEqual(added, [], "no debe agregar nada");
  const locs = readSitemapLocs(xml);
  assert.equal(locs.filter((l) => l === `${SITE_ORIGIN}/dj/djmago305.html`).length, 1);

  // El sitemap REAL del repo tampoco gana entradas al replanear.
  const real = readFileSync(join(WEB, "sitemap.xml"), "utf8");
  const replan = planSitemap(real, {
    addPaths: [
      { path: "dj/directorio.html", priority: "0.8" },
      { path: "equipo.html", priority: "0.6" },
      { path: "dj/djmago305.html", priority: "0.7" },
      { path: "dj/djsolitario.html", priority: "0.7" },
      { path: "dj/djyuyo.html", priority: "0.7" },
    ],
  });
  assert.deepEqual(replan.added, [], "los 5 ya están en el sitemap en vivo, con www");
  assert.equal(replan.xml, real, "replanear no debe cambiar un solo byte");
});

/* ──────────────────── 15-16 · escape JSON-LD y ratings ────────────────── */

test("15 · un valor con </script> no puede cerrar el bloque JSON-LD", () => {
  const veneno = "</script><script>alert(1)</script>";
  const dj = { ...DJ(), bio: `Bio ${veneno} fin`, stage_name: `Nombre ${veneno}`, instagram_url: `https://x.test/${veneno}` };
  const html = renderPage(dj);

  const bloque = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  assert.equal(bloque.includes("</script"), false, "el JSON-LD no debe contener una etiqueta de cierre real");
  assert.equal(bloque.toLowerCase().includes("<script"), false);
  // El objeto sigue siendo JSON válido y conserva el valor original al parsear.
  const obj = JSON.parse(bloque);
  assert.ok(obj.description.includes(veneno), "el dato real se preserva, solo cambia su codificación");
  // Y no aparece un <script> ejecutable inyectado en la página.
  assert.equal(/<script>alert\(1\)<\/script>/.test(html), false);

  // Mismo blindaje en las otras dos plantillas.
  const idx = renderIndexPage([dj]).match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  assert.equal(idx.includes("</script"), false);
  const team = renderTeamPage([{ ...OWNER(), stage_name: `Equipo ${veneno}` }])
    .match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  assert.equal(team.includes("</script"), false);
});

test("16 · review_count=0 (incl. el default rating=1.0) no produce estrella ni aggregateRating", () => {
  const porDefecto = { ...DJ(), rating: 1.0, review_count: 0 };
  const html = renderPage(porDefecto);
  assert.equal(/★/.test(html), false, "no debe haber estrella visible");
  assert.equal(html.includes("(0)"), false);
  assert.equal("aggregateRating" in ld(html), false);

  for (const rc of [null, undefined, 0, "0"]) {
    const h = renderPage({ ...DJ(), rating: 5, review_count: rc });
    assert.equal(/★/.test(h), false, `review_count=${rc} no debe pintar estrella`);
    assert.equal("aggregateRating" in ld(h), false);
  }

  // Con reseñas reales la insignia visible sí vuelve (djmago305 en vivo: ★ 5 (2)).
  const conResenas = renderPage({ ...DJ(), rating: 5, review_count: 2 });
  assert.ok(conResenas.includes("★ 5 (2)"));
  // …pero el aggregateRating de JSON-LD sigue apagado para converger a la
  // salida aprobada, que no lo lleva en ninguno de los 3 (ver corrección 1).
  assert.equal("aggregateRating" in ld(conResenas), false);
  for (const slug of ["djmago305", "djsolitario", "djyuyo"]) {
    const live = readFileSync(join(WEB, "dj", `${slug}.html`), "utf8");
    assert.equal("aggregateRating" in ld(live), false, `${slug} en vivo no lleva aggregateRating`);
  }
});

/* ───────────────────────── 17 · --dry-run sin escrituras ──────────────── */

test("17 · --dry-run no escribe un solo archivo", () => {
  const vigilados = [
    ...readdirSync(join(WEB, "dj")).map((f) => join(WEB, "dj", f)),
    join(WEB, "equipo.html"),
    join(WEB, "sitemap.xml"),
    join(HERE, ".slug-manifest.json"),
  ].filter(existsSync);

  const antes = vigilados.map((p) => [p, readFileSync(p, "utf8"), statSync(p).mtimeMs]);

  const salida = execFileSync(process.execPath, [join(HERE, "build.mjs"), "--dry-run"], {
    env: { ...process.env, MDJB_FIXTURE: FIXTURE },
    encoding: "utf8",
  });

  assert.match(salida, /MODE: DRY-RUN/);
  assert.match(salida, /CERO archivos escritos/);
  for (const [p, contenido, mtime] of antes) {
    assert.equal(readFileSync(p, "utf8"), contenido, `${p} cambió de contenido en --dry-run`);
    assert.equal(statSync(p).mtimeMs, mtime, `${p} fue reescrito en --dry-run`);
  }
  assert.equal(existsSync(join(HERE, ".slug-manifest.json")), antes.some(([p]) => p.endsWith(".slug-manifest.json")),
    "--dry-run no debe crear el manifiesto");
});

/* ─────────────── 18-20 · regresión de identidad y organización ────────── */

test("18 · el bloque Person generado para djmago305 coincide con el archivo en vivo", () => {
  const vivo = ld(readFileSync(join(WEB, "dj", "djmago305.html"), "utf8"));
  const generado = ld(renderPage(DJ()));

  assert.equal(generado["@id"], vivo["@id"]);
  assert.equal(generado["@id"], "https://www.miamidjbeat.com/dj/djmago305.html#gerardo-a-valle");
  assert.equal(generado.name, vivo.name);
  assert.equal(generado.name, "Gerardo A Valle");
  assert.equal(generado.alternateName, vivo.alternateName);
  assert.equal(generado.alternateName, "DJMago305");
  assert.deepEqual(generado.jobTitle, vivo.jobTitle);
  assert.deepEqual(generado.jobTitle, ["Fundador & Propietario", "DJ"]);
  assert.deepEqual(generado.worksFor, vivo.worksFor);
  assert.deepEqual(generado.address, vivo.address);
  assert.equal(generado.url, vivo.url);
  assert.deepEqual(generado.sameAs, vivo.sameAs);
  assert.equal(generado.description, vivo.description, "la descripción no se trunca");
  assert.deepEqual(Object.keys(generado), Object.keys(vivo), "mismo conjunto y orden de claves");

  // La línea de identidad visible también se conserva.
  assert.ok(renderPage(DJ()).includes("Gerardo A Valle, conocido profesionalmente como DJMago305."));
});

test("19 · el @id de Organization se preserva exacto en worksFor", () => {
  const esperado = {
    "@type": "EntertainmentBusiness",
    "@id": "https://www.miamidjbeat.com/#organization",
    name: "Miami DJ Beat LLC",
    url: "https://www.miamidjbeat.com/",
  };
  assert.equal(ORG_ID, esperado["@id"]);
  for (const slug of ["djmago305", "djsolitario", "djyuyo"]) {
    assert.deepEqual(ld(renderPage(byslug(slug))).worksFor, esperado, slug);
    assert.deepEqual(ld(readFileSync(join(WEB, "dj", `${slug}.html`), "utf8")).worksFor, esperado, `${slug} en vivo`);
  }
  assert.deepEqual(ld(renderTeamPage([OWNER()]))["@graph"][0].worksFor, esperado);
});

test("20 · el @id de Person es por-DJ: solo djmago305 lo lleva", () => {
  const conId = ld(renderPage(DJ()));
  assert.equal(conId["@id"], PERSON_IDENTITY.djmago305.personId);

  for (const slug of ["djsolitario", "djyuyo"]) {
    const generado = ld(renderPage(byslug(slug)));
    const vivo = ld(readFileSync(join(WEB, "dj", `${slug}.html`), "utf8"));
    assert.equal("@id" in generado, false, `${slug} NO debe recibir @id`);
    assert.equal("@id" in vivo, false, `${slug} en vivo no tiene @id`);
    assert.equal("alternateName" in generado, false, `${slug} NO debe recibir alternateName`);
    assert.equal(generado.name, vivo.name);
    assert.equal(generado.jobTitle, "DJ");
    assert.equal(vivo.jobTitle, "DJ");
  }

  // equipo.html comparte el @id: owner y djmago305 son la misma persona.
  const team = ld(renderTeamPage([OWNER()]))["@graph"][0];
  const teamVivo = ld(readFileSync(join(WEB, "equipo.html"), "utf8"))["@graph"][0];
  assert.equal(team["@id"], PERSON_IDENTITY.djmago305.personId);
  assert.equal(team["@id"], teamVivo["@id"]);
  assert.equal(team.name, teamVivo.name);
  assert.equal(team.alternateName, teamVivo.alternateName);
  assert.equal(team.jobTitle, teamVivo.jobTitle);
  assert.deepEqual(Object.keys(team), Object.keys(teamVivo));
});

/* ──────────────── 21-22 · aislamiento de equipo y entorno ─────────────── */

test("21 · qualifiesStaff()/equipo.html no se ven afectados por seo_publish_status", () => {
  const owner = OWNER();
  for (const estado of ["approved", "pending", null, undefined, "", "rechazado"]) {
    const fila = { ...owner, seo_publish_status: estado };
    assert.equal(qualifiesStaff(fila), true, `staff debe calificar con seo_publish_status=${estado}`);
    const plan = planGeneration({ rows: [DJ(), fila], existingFiles: [] });
    assert.equal(plan.staff.length, 1, `equipo debe listar 1 miembro con seo_publish_status=${estado}`);
    assert.equal(plan.staff[0].dj_slug, "owner");
  }
  // Y el HTML de equipo sale idéntico sea cual sea el valor del campo.
  const a = renderTeamPage([{ ...owner, seo_publish_status: "approved" }]);
  const b = renderTeamPage([{ ...owner, seo_publish_status: "pending" }]);
  assert.equal(a, b);

  // Tampoco el estado de un DJ cambia la página de equipo.
  const conDjPendiente = planGeneration({ rows: [{ ...DJ(), seo_publish_status: "pending" }, owner], existingFiles: [], allowEmptyRoster: true });
  assert.equal(conDjPendiente.staff.length, 1);
});

test("22 · modo REAL sin entorno declarado aborta ANTES de cualquier fetch", () => {
  // Se comprueba sobre resolveEnvironment(), que es la compuerta que main()
  // consulta antes de llamar a fetchDJs(). A propósito NO se lanza el script
  // en modo real ni siquiera para probar el aborto: la orden lo prohíbe.
  const sinEntorno = resolveEnvironment({}, { dryRun: false });
  assert.ok(sinEntorno.abort, "debe devolver abort");
  assert.match(sinEntorno.abort, /modo REAL sin entorno declarado/);
  assert.equal(sinEntorno.url, undefined, "no debe entregar ninguna URL para consultar");

  // TEST sin credenciales explícitas también aborta (no hay valores TEST horneados).
  const testSinCreds = resolveEnvironment({ MDJB_ENV: "TEST" }, { dryRun: false });
  assert.ok(testSinCreds.abort);

  // Declarar PROD explícitamente sí resuelve, y la clave nunca se expone entera.
  const prod = resolveEnvironment({ MDJB_ENV: "PROD" }, { dryRun: false });
  assert.equal(prod.abort, undefined);
  assert.equal(prod.env, "PROD");

  // --dry-run sin declarar nada se permite (lectura pura) pero se anuncia.
  const dry = resolveEnvironment({}, { dryRun: true });
  assert.equal(dry.abort, undefined);
  assert.match(dry.source, /dry-run/);

  // El fixture local nunca resuelve a ningún proyecto de Supabase.
  const fix = resolveEnvironment({ MDJB_FIXTURE: FIXTURE }, { dryRun: false });
  assert.equal(fix.env, "FIXTURE");
  assert.equal(fix.url, null);
  assert.equal(fix.key, null);
});
