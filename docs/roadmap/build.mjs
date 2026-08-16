#!/usr/bin/env node
// docs/roadmap/build.mjs — Road Master Map
// Mapa raíz del ecosistema Miami DJ Beat: descubre la plataforma real desde el árbol
// del repositorio, la clasifica en capas, la explica por capítulos y ofrece rutas de
// aprendizaje separadas para Cliente, Artista y Staff, con recorrido guiado (▶).
//
//   node docs/roadmap/build.mjs          → docs/roadmap/index.html
//   node docs/roadmap/build.mjs --pdf    → además docs/roadmap/Road-Master-Map.pdf
//
// Sin dependencias, sin red. No modifica ningún archivo del producto.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const MAP = JSON.parse(readFileSync(join(HERE, "master-map.json"), "utf8"));
const IGNORE = new Set(["node_modules", ".git", ".vercel", "dist", "build", ".next", "MiamiDJBeat-MigracionV2"]);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ═══ descubrimiento ═════════════════════════════════════════════════════ */

let _tree = null;
function tree() {
    if (_tree) return _tree;
    const out = [];
    (function walk(dir) {
        let entries;
        try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
            if (IGNORE.has(e.name)) continue;
            if (e.name.startsWith(".") && e.name !== ".github") continue;
            const abs = join(dir, e.name);
            out.push({ rel: relative(ROOT, abs), dir: e.isDirectory() });
            if (e.isDirectory()) walk(abs);
        }
    })(ROOT);
    return (_tree = out);
}

const DIRWILD = "";
function globToRe(p) {
    const body = p.replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .split("**/").join(DIRWILD)
        .split("*").join("[^/]*")
        .split(DIRWILD).join("(?:.*/)?");
    return new RegExp("^" + body + "$");
}
function resolve(pattern) {
    if (!pattern.includes("*")) return existsSync(join(ROOT, pattern)) ? [pattern] : [];
    const re = globToRe(pattern);
    return tree().filter((n) => re.test(n.rel)).map((n) => n.rel);
}

function inventory() {
    const inc = new RegExp(MAP.scan.include);
    const items = [];
    for (const n of tree()) {
        const r = n.rel;
        if (n.dir) { if (/^supabase\/functions\/[^/]+$/.test(r)) items.push(r); continue; }
        if (r.startsWith("supabase/functions/") && r.split("/").length > 3) continue;
        if (r === "supabase/functions/TWILIO_SUPABASE_SETUP.md") items.push(r);
        else if (MAP.scan.roots.some((x) => r.startsWith(x + "/")) && inc.test(r)) items.push(r);
        else if (MAP.scan.extraFiles.includes(r)) items.push(r);
    }
    return [...new Set(items)].sort();
}

const RULES = MAP.classify.map(([layer, re]) => ({ layer, re: new RegExp(re) }));
const KINDS = MAP.kinds.map((k) => ({ ...k, rx: new RegExp(k.re) }));
const classify = (r) => (RULES.find((x) => x.re.test(r)) || {}).layer || null;
const kindOf = (r) => (KINDS.find((k) => k.rx.test(r)) || { id: "other" }).id;
const label = (r) =>
    r.startsWith("supabase/functions/") ? r.replace("supabase/functions/", "")
        : r.startsWith("web/") ? r.replace("web/", "")
            : r.startsWith("supabase/migrations/") ? r.replace(/^supabase\/migrations\/\d+_?/, "")
                : r.split("/").pop();

const all = inventory();
const unfiled = [];
const byLayer = Object.fromEntries(MAP.layers.map((l) => [l.id, []]));
for (const rel of all) {
    const L = classify(rel);
    if (L && byLayer[L]) byLayer[L].push({ rel, kind: kindOf(rel), label: label(rel) });
    else unfiled.push(rel);
}
const KO = { function: 0, page: 1, script: 2, config: 3, migration: 4, doc: 5, other: 6 };
const layers = MAP.layers.map((l) => {
    const items = byLayer[l.id].sort((a, b) => (KO[a.kind] - KO[b.kind]) || a.label.localeCompare(b.label));
    const counts = {};
    for (const it of items) counts[it.kind] = (counts[it.kind] || 0) + 1;
    return { ...l, items, counts, total: items.length };
});
const layerById = Object.fromEntries(layers.map((l) => [l.id, l]));
const kindTotals = Object.fromEntries(MAP.kinds.map((k) => [k.id, all.filter((r) => kindOf(r) === k.id).length]));

/* ═══ sondas ═════════════════════════════════════════════════════════════ */

function grepHits(pattern, paths) {
    const re = new RegExp(pattern), hits = [];
    for (const p of paths) {
        const abs = join(ROOT, p);
        if (!existsSync(abs)) continue;
        const files = statSync(abs).isDirectory()
            ? tree().filter((n) => !n.dir && n.rel.startsWith(p + "/")).map((n) => n.rel) : [p];
        for (const f of files) {
            if (!/\.(html|js|ts|sql|md|json|yml|yaml)$/i.test(f)) continue;
            try { if (re.test(readFileSync(join(ROOT, f), "utf8"))) hits.push(f); } catch { /* noop */ }
        }
    }
    return hits;
}
function runProbe(pr) {
    let hits = [];
    if (pr.kind === "path") for (const p of pr.patterns) hits.push(...resolve(p));
    else hits = grepHits(pr.pattern, pr.paths);
    hits = [...new Set(hits)];
    return { met: pr.expect === "absent" ? !hits.length : hits.length > 0, hits };
}
const aiRules = MAP.aiRules.map((r) => ({ ...r, ...runProbe(r.probe) }));
const integrity = MAP.integrity.map((v) => ({ ...v, ...runProbe(v.probe) }));
const openV = integrity.filter((v) => !v.met);
const aiMet = aiRules.filter((r) => r.met).length;

const git = (c, f = "—") => { try { return execSync(`git ${c}`, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return f; } };
/* ═══ TRUTH MODE — verificación por capacidad ════════════════════════════
   Cada capacidad de negocio se resuelve contra el árbol y obtiene uno de tres
   estados. Nada se declara: si no hay archivo, no hay VERIFIED.               */

function gitLog(paths, n = 3) {
    const ps = paths.filter((p) => existsSync(join(ROOT, p)));
    if (!ps.length) return [];
    const out = git(`log -n ${n} --format='%h|%cs|%s' -- ${ps.map((p) => `"${p}"`).join(" ")}`, "");
    return out === "—" || !out ? [] : out.split("\n").filter(Boolean).map((l) => {
        const parts = l.split("|");
        return { h: parts[0], d: parts[1], s: parts.slice(2).join("|") };
    });
}

const caps = (() => {
    const DRIFT_RE = new RegExp(MAP.driftPhrases, "i");
    return MAP.capabilities.map((c) => {
        const res = (a) => [...new Set((a || []).flatMap((p) => resolve(p)))];
        const impl = res(c.impl), tests = res(c.tests), docs = res(c.docs);
        const sot = c.sot && existsSync(join(ROOT, c.sot)) ? c.sot : null;
        const state = impl.length ? "verified" : docs.length ? "proposed" : "unknown";
        // Deriva documental: el documento afirma que algo no existe y el código lo desmiente.
        const drift = [];
        if (impl.length) for (const dp of docs) {
            let src; try { src = readFileSync(join(ROOT, dp), "utf8"); } catch { continue; }
            const line = src.split("\n").find((l) => DRIFT_RE.test(l));
            if (line) drift.push({ doc: dp, line: line.trim().replace(/\s+/g, " ").slice(0, 170) });
        }
        const unknowns = [...(c.unknowns || [])];
        if (impl.length && !tests.length) unknowns.push("Sin prueba ejecutable que cubra esta capacidad.");
        if (c.sot && !sot) unknowns.push(`La fuente de verdad declarada no existe en el árbol: ${c.sot}`);
        return { ...c, impl, tests, docs, sot, state, drift, unknowns, history: gitLog(impl.length ? impl : docs) };
    });
})();
const capName = Object.fromEntries(caps.map((c) => [c.id, c.name]));
const nVer = caps.filter((c) => c.state === "verified").length;
const nProp = caps.filter((c) => c.state === "proposed").length;
const nUnk = caps.filter((c) => c.state === "unknown").length;
const nDrift = caps.filter((c) => c.drift.length).length;
const nOpenQ = caps.reduce((n, c) => n + c.unknowns.length, 0);

const ctx = {
    branch: git("rev-parse --abbrev-ref HEAD"), sha: git("rev-parse --short HEAD"),
    commitDate: git("log -1 --format=%cs"), commits: git("rev-list --count HEAD", "0"),
    dirty: git("status --porcelain", "").split("\n").filter(Boolean).length,
    at: new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
};

/* ═══ gráfico: mapa de capas ═════════════════════════════════════════════ */

const kindClass = { function: "k-fn", page: "k-pg", script: "k-js", migration: "k-sql", doc: "k-doc", config: "k-cfg", other: "k-oth" };

function graphicMap() {
    const W = 1240, PAD = 22, LABEL = 0, GUT = 96;
    const IX = PAD + 16, IW = W - IX - GUT - PAD;
    const NW = 132, NH = 25, NG = 7;
    const PER = Math.floor((IW + NG) / (NW + NG));
    const HEAD = 46, GAP = 13;
    let y = 58;
    const bands = layers.map((l) => {
        const cap = PER * 2;
        const shown = l.items.slice(0, l.total > cap ? cap - 1 : cap);
        const cells = shown.length + (l.total > shown.length ? 1 : 0);
        const rows = Math.max(1, Math.ceil(cells / PER));
        const h = HEAD + rows * (NH + NG) + 10;
        const b = { ...l, shown, x: PAD, y, h, w: W - PAD * 2 - GUT };
        y += h + GAP;
        return b;
    });
    const H = y + 14;
    const bandById = Object.fromEntries(bands.map((b) => [b.id, b]));

    const bandSvg = bands.map((b) => {
        const cell = (i, txt, cls, title) => {
            const col = i % PER, row = Math.floor(i / PER);
            const nx = IX + col * (NW + NG), ny = b.y + HEAD + row * (NH + NG);
            return `<g class="node ${cls}">${title ? `<title>${esc(title)}</title>` : ""}`
                + `<rect x="${nx}" y="${ny}" width="${NW}" height="${NH}" rx="4"/>`
                + `<text x="${nx + 8}" y="${ny + 16.5}">${esc(txt.length > 21 ? txt.slice(0, 20) + "…" : txt)}</text></g>`;
        };
        const nodes = b.shown.map((it, i) => cell(i, it.label, kindClass[it.kind], it.rel)).join("")
            + (b.total > b.shown.length ? cell(b.shown.length, `+${b.total - b.shown.length} más`, "k-more") : "");
        const chips = MAP.kinds.filter((k) => b.counts[k.id]).map((k) => `${b.counts[k.id]} ${k.label.toLowerCase()}`).join(" · ");
        return `<g class="band" id="band-${b.id}">
      <rect class="band-bg" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="9"/>
      <rect class="band-edge" x="${b.x}" y="${b.y}" width="4" height="${b.h}"/>
      <text class="band-id" x="${b.x + 18}" y="${b.y + 27}">${b.id}</text>
      <text class="band-name" x="${b.x + 54}" y="${b.y + 27}">${esc(b.name)}</text>
      <text class="band-meta" x="${b.x + 18}" y="${b.y + 43}">${esc(chips)}</text>
      <text class="band-total" x="${b.x + b.w - 14}" y="${b.y + 27}" text-anchor="end">${b.total}</text>
      ${nodes}</g>`;
    }).join("");

    const LINKS = [["L1", "L4", "lead capturado"], ["L4", "L5", "evento confirmado"], ["L5", "L3", "asignación al artista"],
    ["L4", "L7", "compromiso de cobro"], ["L5", "L7", "impacto financiero"], ["L8", "L7", "ELIXIS lee el motor"]];
    const linkSvg = LINKS.map(([a, z, lbl], i) => {
        const ay = bandById[a].y + 26, zy = bandById[z].y + 26, x0 = W - PAD - GUT, bow = 22 + i * 12;
        return `<g class="link"><path d="M${x0} ${ay} C${x0 + bow} ${ay}, ${x0 + bow} ${zy}, ${x0} ${zy}" marker-end="url(#lk)"/>`
            + `<title>${a} → ${z}: ${esc(lbl)}</title></g>`;
    }).join("");

    return `<svg class="gr map" id="map" viewBox="0 0 ${W} ${H}" role="img"
   aria-label="Mapa raíz: las ${layers.length} capas de la plataforma Miami DJ Beat apiladas, con los módulos reales de cada una y los enlaces entre capas.">
  <defs><marker id="lk" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M0 0L10 5L0 10z" fill="var(--gold)" opacity=".6"/></marker></defs>
  <text class="band-meta" x="${PAD}" y="24" style="letter-spacing:1.6px">CAPAS DE LA PLATAFORMA — cada nodo es un archivo real del repositorio</text>
  <text class="band-meta" x="${W - PAD}" y="24" text-anchor="end">enlaces entre capas →</text>
  ${linkSvg}${bandSvg}
</svg>`;
}

/* ═══ gráfico: pipeline ══════════════════════════════════════════════════ */

function graphicPipeline(g, aria) {
    const PAD = 22, BW = 202, BH = 74, AR = 30, PER = 4;
    const W = PAD * 2 + PER * BW + (PER - 1) * AR;
    const rows = Math.ceil(g.steps.length / PER);
    const RH = BH + 52;
    const H = PAD * 2 + rows * BH + (rows - 1) * 52 + 8;
    let out = "";
    g.steps.forEach((s, i) => {
        const col = i % PER, row = Math.floor(i / PER);
        const x = PAD + col * (BW + AR), y = PAD + row * RH;
        const tone = s.tone ? ` p-${s.tone}` : "";
        out += `<g class="pstep${tone}">
      <rect x="${x}" y="${y}" width="${BW}" height="${BH}" rx="8"/>
      <text class="pn" x="${x + 13}" y="${y + 22}">${String(i + 1).padStart(2, "0")}</text>
      <text class="pt" x="${x + 13}" y="${y + 44}">${esc(s.t)}</text>
      <text class="ps" x="${x + 13}" y="${y + 62}">${esc(s.s)}</text></g>`;
        if (i < g.steps.length - 1) {
            if (col < PER - 1) {
                out += `<path class="parrow" d="M${x + BW + 4} ${y + BH / 2} H${x + BW + AR - 5}" marker-end="url(#pa)"/>`;
            } else {
                const ny = y + RH;
                out += `<path class="parrow wrap" d="M${x + BW / 2} ${y + BH + 4} V${y + BH + 20} H${PAD + BW / 2} V${ny - 5}" marker-end="url(#pa)"/>`;
            }
        }
    });
    return `<svg class="gr" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}">
  <defs><marker id="pa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
    <path d="M0 0L10 5L0 10z" fill="var(--mut)"/></marker></defs>${out}
</svg>`;
}

/* ═══ gráfico: roles ═════════════════════════════════════════════════════ */

function graphicRoles(g) {
    const W = 940, PAD = 22, CW = 288, CG = 19, CX = PAD, TOPW = 340;
    const out = [];
    out.push(`<g class="pstep p-core"><rect x="${(W - TOPW) / 2}" y="${PAD}" width="${TOPW}" height="66" rx="8"/>
    <text class="pt" x="${W / 2}" y="${PAD + 30}" text-anchor="middle">${esc(g.top.t)}</text>
    <text class="ps" x="${W / 2}" y="${PAD + 50}" text-anchor="middle">${esc(g.top.s)}</text></g>`);
    const colY = PAD + 66 + 44;
    g.cols.forEach((c, i) => {
        const x = CX + i * (CW + CG);
        out.push(`<path class="parrow" d="M${W / 2} ${PAD + 70} V${colY - 26} H${x + CW / 2} V${colY - 5}" marker-end="url(#pa)"/>`);
        out.push(`<g class="pstep p-${c.tone}"><rect x="${x}" y="${colY}" width="${CW}" height="78" rx="8"/>
      <text class="pt" x="${x + 15}" y="${colY + 30}">${esc(c.t)}</text>
      <text class="ps" x="${x + 15}" y="${colY + 52}">${esc(c.s)}</text>
      <text class="ps dim" x="${x + 15}" y="${colY + 68}">portal propio · navegación propia</text></g>`);
    });
    const baseY = colY + 78 + 40;
    g.cols.forEach((c, i) => {
        const x = CX + i * (CW + CG) + CW / 2;
        out.push(`<path class="parrow" d="M${x} ${colY + 82} V${baseY - 5}" marker-end="url(#pa)"/>`);
    });
    out.push(`<g class="pstep p-gate"><rect x="${PAD}" y="${baseY}" width="${W - PAD * 2}" height="62" rx="8"/>
    <text class="pt" x="${W / 2}" y="${baseY + 28}" text-anchor="middle">${esc(g.base.t)}</text>
    <text class="ps" x="${W / 2}" y="${baseY + 48}" text-anchor="middle">${esc(g.base.s)}</text></g>`);
    const H = baseY + 62 + PAD;
    return `<svg class="gr" viewBox="0 0 ${W} ${H}" role="img" aria-label="Owner arriba; debajo tres portales separados — Cliente, Artista y Staff — y bajo todos ellos las políticas RLS de la base de datos.">
  <defs><marker id="pa2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
    <path d="M0 0L10 5L0 10z" fill="var(--mut)"/></marker></defs>${out.join("")}
</svg>`.replace(/url\(#pa\)/g, "url(#pa2)");
}

/* ═══ gráfico: IA ════════════════════════════════════════════════════════ */

function graphicAi() {
    const W = 940, H = 470;
    const inputs = [["roster de artistas", "public_dj_profiles"], ["bookings próximos", "órdenes y estado"],
    ["pipeline de leads", "estado comercial"], ["residencias y tarifas", "hardcodeado hoy"], ["resumen financiero", "vía el motor"]];
    let s = `<text class="glab" x="22" y="26">CONTEXTO QUE RECIBE (lectura)</text>`;
    inputs.forEach((it, i) => {
        const y = 40 + i * 52;
        s += `<g class="pstep${i === 3 ? " p-warn" : ""}"><rect x="22" y="${y}" width="212" height="42" rx="7"/>
      <text class="pt sm" x="34" y="${y + 19}">${esc(it[0])}</text>
      <text class="ps" x="34" y="${y + 34}">${esc(it[1])}</text></g>
      <path class="parrow" d="M238 ${y + 21} H300" marker-end="url(#pa3)"/>`;
    });
    s += `<g class="pstep p-core"><rect x="304" y="96" width="252" height="128" rx="9"/>
    <text class="pt" x="430" y="132" text-anchor="middle">ELIXIS</text>
    <text class="ps" x="430" y="154" text-anchor="middle">Edge Function · lado servidor</text>
    <text class="ps" x="430" y="172" text-anchor="middle">verifica el rol contra la base</text>
    <text class="ps dim" x="430" y="196" text-anchor="middle">redacta, calcula y recomienda</text>
    <text class="ps dim" x="430" y="212" text-anchor="middle">no envía, no cobra, no muta</text></g>`;
    s += `<path class="parrow" d="M560 160 H636" marker-end="url(#pa3)"/>
  <text class="glab sm" x="566" y="152">1 tool real</text>
  <g class="pstep p-ok"><rect x="640" y="128" width="278" height="64" rx="8">
    </rect><text class="pt" x="654" y="156">financial-engine</text>
    <text class="ps" x="654" y="176">el único que calcula dinero</text></g>`;
    s += `<text class="glab" x="22" y="316">LO QUE FALTA PARA QUE PUEDA EJECUTAR</text>`;
    [["Registro de agentes", "misión, tools, permisos, memoria"], ["Gate de aprobación", "en código, no en el prompt"], ["Auditoría de acciones", "actor · acción · resultado"]]
        .forEach((it, i) => {
            const x = 22 + i * 302;
            s += `<g class="pstep p-miss"><rect x="${x}" y="330" width="286" height="62" rx="8"/>
      <text class="pt" x="${x + 14}" y="358">${esc(it[0])}</text>
      <text class="ps" x="${x + 14}" y="378">${esc(it[1])}</text></g>`;
        });
    s += `<text class="glab sm" x="22" y="424">Mientras ELIXIS no tenga ninguna herramienta de escritura, estos tres huecos son tolerables. El día que la tenga, se vuelven bloqueantes.</text>`;
    return `<svg class="gr" viewBox="0 0 ${W} ${H}" role="img" aria-label="ELIXIS recibe contexto de lectura, tiene una sola herramienta real hacia el motor financiero, y le faltan tres piezas: registro de agentes, gate de aprobación en código y auditoría de acciones.">
  <defs><marker id="pa3" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
    <path d="M0 0L10 5L0 10z" fill="var(--mut)"/></marker></defs>${s}
</svg>`;
}

function renderGraphic(name, chTitle) {
    if (name === "map") return graphicMap();
    if (name === "roles") return graphicRoles(MAP.graphics.roles);
    if (name === "ai") return graphicAi();
    const g = MAP.graphics[name];
    return g ? graphicPipeline(g, `${chTitle}: ${g.steps.map((s) => s.t).join(" → ")}`) : "";
}

/* ═══ capítulos ══════════════════════════════════════════════════════════ */

const AUD = Object.fromEntries(MAP.audiences.map((a) => [a.id, a.label]));
const chapters = MAP.chapters.map((c, i) => {
    const mods = c.modules.map((m) => ({ m, ok: existsSync(join(ROOT, m)) }));
    return { ...c, n: i + 1, mods };
});

const chapHtml = chapters.map((c) => {
    const focus = c.focus.map((f) => layerById[f]).filter(Boolean);
    return `
  <section class="chapter" id="${c.id}" data-aud="${c.audience.join(" ")}" data-focus="${c.focus.join(" ")}">
    <div class="cap-head">
      <span class="cap-n">Capítulo ${c.n}</span>
      <h2>${esc(c.title)}</h2>
      <span class="auds">${c.audience.map((a) => `<span class="aud a-${a}">${esc(AUD[a])}</span>`).join("")}</span>
    </div>
    <p class="cap-lead">${esc(c.lead)}</p>
    <figure>${renderGraphic(c.graphic, c.title)}</figure>
    <div class="cap-body">${c.body.map((p) => `<p>${p}</p>`).join("")}</div>
    ${focus.length ? `<p class="cap-focus">Capas que toca: ${focus.map((l) => `<b>${l.id}</b> ${esc(l.name)} <span class="tiny">(${l.total})</span>`).join(" &nbsp;·&nbsp; ")}</p>` : ""}
    ${c.mods.length ? `<div class="mods"><span class="mods-t">En el repositorio</span>${c.mods.map((m) => `<code class="${m.ok ? "" : "gone"}">${esc(m.m)}${m.ok ? "" : " (no existe)"}</code>`).join("")}</div>` : ""}
  </section>`;
}).join("");

/* ═══ recorrido ══════════════════════════════════════════════════════════ */

const extraStops = [
    { id: "sec-caps", aud: ["cliente", "artista", "staff"], h: "Truth mode — capacidades verificadas", b: `${nVer} verified · ${nProp} proposed · ${nUnk} unknown, con ${nOpenQ} preguntas abiertas. Pulsa cualquier tarjeta para ver su ficha de evidencia.` },
    { id: "sec-ai", aud: ["staff"], h: "Las siete reglas de la IA", b: `${aiMet} de ${aiRules.length} se cumplen hoy. Cada veredicto sale de una sonda sobre el código.` },
    { id: "sec-integrity", aud: ["staff"], h: "Lo que hay que arreglar", b: `${openV.length} verificaciones abiertas. Cuando el código cambie, estas filas cambian solas.` },
    { id: "sec-inv", aud: ["staff"], h: "El inventario completo", b: `Las ${all.length} piezas listadas por capa, incluidas las que ninguna regla logra clasificar.` },
    { id: "sec-how", aud: ["cliente", "artista", "staff"], h: "Y se actualiza solo", b: "El generador recorre el árbol otra vez y reescribe la página entera. El enlace nunca cambia." },
];
const stops = [
    ...chapters.map((c) => ({ id: c.id, aud: c.audience, h: `Capítulo ${c.n} — ${c.title}`, b: c.lead })),
    ...extraStops,
];

/* ═══ secciones de referencia ════════════════════════════════════════════ */

const aiHtml = aiRules.map((r) => `
      <div class="ai-row">
        <span class="ai-n">${r.n}</span>
        <div><p class="ai-rule">${esc(r.rule)}</p><p class="ai-note">${esc(r.note)}</p>
          <p class="tiny">sonda <code>${esc(r.probe.kind === "grep" ? r.probe.pattern : r.probe.patterns.join(" · "))}</code> → ${r.hits.length} coincidencia${r.hits.length === 1 ? "" : "s"}</p></div>
        <span class="tag ${r.met ? "t-ok" : "t-no"}">${r.met ? "CUMPLE" : "NO CUMPLE"}</span>
      </div>`).join("");

const intHtml = integrity.map((v) => `
      <article class="chk">
        <header><span class="chk-id">${esc(v.id)}</span><h3>${esc(v.title)}</h3>
          <span class="tag ${v.met ? "t-ok" : v.severity === "alta" ? "t-risk" : "t-warn"}">${v.met ? "OK" : "ABIERTO"}</span></header>
        <p>${esc(v.detail)}</p>
        <p class="tiny">sonda <code>${esc(v.probe.kind === "grep" ? v.probe.pattern : v.probe.patterns.join(" · "))}</code> — ${v.hits.length ? `${v.hits.length} coincidencia${v.hits.length === 1 ? "" : "s"}` : "sin coincidencias"}</p>
      </article>`).join("");

const invHtml = layers.map((l) => `
      <details class="inv"><summary><b>${l.id}</b> ${esc(l.name)} <span class="tiny">${l.total} piezas</span></summary>
        <ul>${l.items.map((i) => `<li class="${kindClass[i.kind]}"><code>${esc(i.rel)}</code></li>`).join("")}</ul></details>`).join("")
    + (unfiled.length ? `
      <details class="inv"><summary><b>—</b> Sin clasificar <span class="tiny">${unfiled.length} piezas</span></summary>
        <p class="tiny">No coinciden con ninguna regla de <code>master-map.json</code>. Se listan en vez de esconderse.</p>
        <ul>${unfiled.map((r) => `<li><code>${esc(r)}</code></li>`).join("")}</ul></details>` : "");


/* ═══ TRUTH MODE — grafo radial de capacidades ═══════════════════════════
   Anillo interior = las capacidades de las que más depende el resto (grado
   calculado, no elegido a mano). Anillo exterior = todo lo demás.          */

function graphicRadial() {
    const W = 1440, H = 950, CX = 720, CY = 476;
    const NW = 162, NH = 54;
    const deg = Object.fromEntries(caps.map((c) => [c.id, 0]));
    for (const c of caps) for (const d of (c.deps || [])) if (deg[d] !== undefined) deg[d]++;
    const ranked = [...caps].sort((a, b) => deg[b.id] - deg[a.id]);
    const innerIds = new Set(ranked.slice(0, 6).filter((c) => deg[c.id] > 0).map((c) => c.id));
    const inner = caps.filter((c) => innerIds.has(c.id));
    const outer = caps.filter((c) => !innerIds.has(c.id));

    const place = (arr, rx, ry, off) => arr.map((c, i) => {
        const a = off + (i / arr.length) * Math.PI * 2;
        return { ...c, x: CX + Math.cos(a) * rx, y: CY + Math.sin(a) * ry };
    });
    const nodes = [...place(inner, 300, 178, -Math.PI / 2), ...place(outer, 622, 372, -Math.PI / 2 + 0.16)];
    const at = Object.fromEntries(nodes.map((n) => [n.id, n]));

    const edges = [];
    for (const n of nodes) for (const d of (n.deps || [])) {
        const t = at[d]; if (!t) continue;
        const mx = (n.x + t.x) / 2, my = (n.y + t.y) / 2;
        const qx = mx + (CX - mx) * 0.38, qy = my + (CY - my) * 0.38;
        edges.push(`<path class="ge" d="M${n.x.toFixed(1)} ${n.y.toFixed(1)} Q${qx.toFixed(1)} ${qy.toFixed(1)} ${t.x.toFixed(1)} ${t.y.toFixed(1)}"/>`);
    }

    const wrap = (s) => {
        if (s.length <= 20) return [s];
        const w = s.split(" "); const out = ["", ""]; let i = 0;
        for (const t of w) { if (i === 0 && (out[0] + " " + t).trim().length > 20) i = 1; out[i] = (out[i] + " " + t).trim(); }
        return out[1] ? out : [out[0]];
    };

    const nodeSvg = nodes.map((n) => {
        const x = n.x - NW / 2, y = n.y - NH / 2, ls = wrap(n.name);
        const t1 = ls.length > 1
            ? `<text class="gn" x="${n.x}" y="${n.y - 5}" text-anchor="middle">${esc(ls[0])}</text><text class="gn" x="${n.x}" y="${n.y + 9}" text-anchor="middle">${esc(ls[1].length > 22 ? ls[1].slice(0, 21) + "…" : ls[1])}</text>`
            : `<text class="gn" x="${n.x}" y="${n.y + 1}" text-anchor="middle">${esc(ls[0])}</text>`;
        return `<g class="gnode g-${n.state}${n.drift.length ? " g-drift" : ""}" data-cap="${n.id}" data-layer="${n.layer}" tabindex="0" role="button" aria-label="${esc(n.name)} — ${ST[n.state]}">
      <title>${esc(n.name)} · ${ST[n.state]}${n.drift.length ? " · posible deriva" : ""}</title>
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${NW}" height="${NH}" rx="8"/>
      ${t1}
      <text class="gs" x="${n.x}" y="${n.y + 21}" text-anchor="middle">${n.layer} · ${ST[n.state]}</text>
      ${n.drift.length ? `<circle class="gdot" cx="${(x + NW - 11).toFixed(1)}" cy="${(y + 11).toFixed(1)}" r="4"/>` : ""}
    </g>`;
    }).join("");

    return `<svg class="gr radial" id="radial" viewBox="0 0 ${W} ${H}" role="img"
   aria-label="Grafo de ${caps.length} capacidades del ecosistema alrededor del núcleo de la plataforma, coloreadas por estado verificado, propuesto o desconocido.">
  <g class="gedges">${edges.join("")}</g>
  <g class="gcore"><rect x="${CX - 118}" y="${CY - 46}" width="236" height="92" rx="11"/>
    <text class="gct" x="${CX}" y="${CY - 12}" text-anchor="middle">MIAMI DJ BEAT</text>
    <text class="gct2" x="${CX}" y="${CY + 8}" text-anchor="middle">núcleo de plataforma</text>
    <text class="gs" x="${CX}" y="${CY + 30}" text-anchor="middle">${all.length} piezas · ${layers.length} capas</text></g>
  ${nodeSvg}
</svg>`;
}

/* ═══ TRUTH MODE — tarjetas, grafo e inspector ═══════════════════════════ */

const ST = { verified: "VERIFIED", proposed: "PROPOSED", unknown: "UNKNOWN" };

const capData = Object.fromEntries(caps.map((c) => [c.id, {
    name: c.name, layer: c.layer, state: c.state, sot: c.sot,
    impl: c.impl, tests: c.tests, docs: c.docs, drift: c.drift, unknowns: c.unknowns, history: c.history,
    deps: (c.deps || []).map((d) => capName[d] || d), used: (c.used || []).map((d) => capName[d] || d),
    layerName: (layerById[c.layer] || {}).name || "",
}]));

/* ═══ Marca ══════════════════════════════════════════════════════════════
   El emblema y el wordmark reales se incrustan como data URI: la CSP de un
   artifact publicado bloquea cualquier host externo. Si faltan, cae a texto. */

function dataUri(rel) {
    try { return "data:image/png;base64," + readFileSync(join(HERE, rel)).toString("base64"); }
    catch { return null; }
}
const EMBLEM = dataUri("brand/emblem.png");
const WORDMARK = dataUri("brand/wordmark.png");

/* ═══ ROADMAP — brecha, dependencias y orden de ejecución ════════════════
   El estado de cada tarea NO se escribe: se lee de la sonda que ya existe.
   El orden se calcula por dependencias (topológico) y luego por impacto.   */

const roadmap = (() => {
    const capState = Object.fromEntries(caps.map((c) => [c.id, c.state]));
    const intBy = Object.fromEntries(integrity.map((v) => [v.id, v]));
    const aiBy = Object.fromEntries(aiRules.map((r) => [r.n, r]));
    const isDone = (ref) => {
        if (!ref || ref.kind === "none") return false;               // sin sonda propia: lo cierra un humano
        if (ref.kind === "integrity") return !!(intBy[ref.id] || {}).met;
        if (ref.kind === "airule") return !!(aiBy[ref.n] || {}).met;
        if (ref.kind === "cap") return capState[ref.id] === "verified";
        if (ref.kind === "grep" && ref.probe) return runProbe(ref.probe).met;
        return false;
    };
    const items = MAP.roadmap.map((t) => ({ ...t, ok: isDone(t.ref) }));
    const by = Object.fromEntries(items.map((t) => [t.id, t]));
    for (const t of items) {
        const pend = (t.deps || []).filter((d) => by[d] && !by[d].ok);
        t.blockedBy = pend.map((d) => by[d].title);
        t.status = t.ok ? "done" : pend.length ? "blocked" : "ready";
    }
    // Orden topológico estable: profundidad de dependencias, luego impacto.
    const IMP = { alto: 0, medio: 1, bajo: 2 };
    const depth = (id, seen = new Set()) => {
        if (seen.has(id)) return 0; seen.add(id);
        const t = by[id]; if (!t || !t.deps.length) return 0;
        return 1 + Math.max(...t.deps.map((d) => depth(d, seen)));
    };
    return items
        .map((t) => ({ ...t, depth: depth(t.id) }))
        .sort((a, b) => (a.ok - b.ok) || (a.depth - b.depth) || (IMP[a.impact] - IMP[b.impact]) || a.id.localeCompare(b.id))
        .map((t, i) => ({ ...t, order: i + 1 }));
})();
const rmDone = roadmap.filter((t) => t.ok).length;
const rmReady = roadmap.filter((t) => t.status === "ready").length;
const rmBlocked = roadmap.filter((t) => t.status === "blocked").length;

const RMS = { done: "HECHO", ready: "LISTO", blocked: "BLOQUEADO" };
const rmHtml = roadmap.map((t) => `
        <article class="rmi r-${t.status}">
          <header>
            <span class="rmn">${String(t.order).padStart(2, "0")}</span>
            <span class="rmid">${esc(t.id)}</span>
            <h3>${esc(t.title)}</h3>
            <span class="tag ${t.status === "done" ? "t-ok" : t.status === "ready" ? "t-warn" : "t-no"}">${RMS[t.status]}</span>
          </header>
          <p>${esc(t.why)}</p>
          <p class="rmd"><b>Se cierra cuando:</b> ${esc(t.done)}</p>
          <p class="tiny">Impacto ${esc(t.impact)}${t.blockedBy.length ? ` · bloqueada por: ${esc(t.blockedBy.join(" · "))}` : t.ref && t.ref.kind === "none" ? " · sin sonda automática: la cierra una decisión humana" : ""}</p>
        </article>`).join("");

const capRows = caps.map((c) => `
        <button class="caprow s-${c.state}${c.drift.length ? " has-drift" : ""}" data-cap="${c.id}" data-layer="${c.layer}" type="button">
          <span class="cdot"></span>
          <span class="cname">${esc(c.name)}</span>
          <span class="clay">${c.layer}</span>
          <span class="cst">${ST[c.state]}</span>
        </button>`).join("");

const qHtml = caps.filter((c) => c.unknowns.length).map((c) => `
        <div class="qgroup">
          <button class="qhead" data-cap="${c.id}" type="button"><span class="cdot s-${c.state}"></span>${esc(c.name)} <span class="tiny">${c.unknowns.length}</span></button>
          <ul>${c.unknowns.map((u) => `<li>${esc(u)}</li>`).join("")}</ul>
        </div>`).join("");

const driftHtml = caps.filter((c) => c.drift.length).map((c) => `
        <article class="chk">
          <header><span class="chk-id">DERIVA</span><h3>${esc(c.name)}</h3><span class="tag t-risk">CONFLICTO</span></header>
          ${c.drift.map((d) => `<p>El documento <code>${esc(d.doc)}</code> contiene una afirmación de inexistencia, y la implementación de esta capacidad sí existe (${c.impl.length} archivo${c.impl.length === 1 ? "" : "s"}). Es una señal para revisar, no un veredicto: la frase puede referirse a otra parte del documento.</p><p class="tiny">“${esc(d.line)}”</p>`).join("")}
        </article>`).join("") || `<p class="sec-note">Ninguna capacidad presenta contradicción entre su documento y su código.</p>`;

const ICON = {
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    box: '<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M3 7l9 5 9-5"/><line x1="12" y1="12" x2="12" y2="22"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>',
    dollar: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    map: '<polygon points="1 6 8 3 16 6 23 3 23 18 16 21 8 18 1 21 1 6"/><line x1="8" y1="3" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="21"/>',
    branch: '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
    check: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    pulse: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
};
const svg = (k) => `<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">${ICON[k]}</svg>`;

const idx = [
    { g: "Vista" },
    { n: "01", t: "Vista general", i: "grid", tab: "mapa" },
    { n: "02", t: "Capacidades", i: "box", tab: "mapa", c: caps.length },
    { n: "03", t: "Capas del sistema", i: "layers", tab: "capas", c: layers.length },
    { g: "Dominios" },
    { n: "04", t: "Portales por rol", i: "users", tab: "capas", layer: "L3" },
    { n: "05", t: "Arquitectura financiera", i: "dollar", tab: "mapa", layer: "L7" },
    { n: "06", t: "IA y agentes", i: "cpu", tab: "mapa", layer: "L8" },
    { n: "07", t: "Identidad y seguridad", i: "shield", tab: "mapa", layer: "L2" },
    { g: "Aprendizaje" },
    { n: "08", t: "Capítulos", i: "book", tab: "capitulos", c: chapters.length },
    { n: "09", t: "Rutas de aprendizaje", i: "map", tab: "capitulos", c: MAP.audiences.length },
    { g: "Control" },
    { n: "10", t: "Roadmap", i: "branch", tab: "roadmap", c: rmReady + rmBlocked },
    { n: "11", t: "Reglas de la IA", i: "check", tab: "conflictos" },
    { n: "12", t: "Integridad", i: "pulse", tab: "conflictos", c: openV.length },
    { n: "13", t: "Conflictos", i: "alert", tab: "conflictos", c: nDrift, warn: true },
    { g: "Referencia" },
    { n: "14", t: "Preguntas abiertas", i: "help", tab: "preguntas", c: nOpenQ },
    { n: "15", t: "Evidencia", i: "db", tab: "evidencia", c: all.length },
];
const idxHtml = idx.map((i) => i.g
    ? `\n    <div class="side3-group">${esc(i.g)}</div>`
    : `\n    <button class="side3-link" data-tab="${i.tab}"${i.layer ? ` data-layer="${i.layer}"` : ""} type="button">
        ${svg(i.i)}<span class="sl-t">${esc(i.t)}</span>${i.c !== undefined ? `<span class="sl-c${i.warn && i.c ? " w" : ""}">${i.c}</span>` : ""}
      </button>`).join("");

/* ═══ página ═════════════════════════════════════════════════════════════ */

const html = `<meta charset="utf-8">
<title>Road Master Map</title>
<style>
:root{
  --ground:#f2f4f8;--panel:#fff;--panel2:#f7f8fb;--rail:#eceff4;--line:#dbdfe8;--edge:#c6ccd8;
  --ink:#131922;--soft:#4a5464;--mut:#78out;--mut:#78root;--mut:#78818f;--faint:#98a0af;
  --gold:#8a6a12;--goldf:#a8831c;--ok:#227a54;--prop:#2f6aa8;--unk:#78818f;--risk:#a5433b;--warn:#8a6a12;
  --cli:#2f6aa8;--art:#8a4f8f;--stf:#227a54;
  --fn:#2f6aa8;--pg:#8a6a12;--js:#6a5aa0;--sql:#227a54;--doc:#78818f;--cfg:#a5433b;
  --gold-a16:rgba(197,160,89,.16);--gold-a40:rgba(197,160,89,.4);--hover-a:rgba(20,26,36,.06);
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --ground:#070910;--panel:#0f131b;--panel2:#141924;--rail:#0c1017;--line:#212836;--edge:#333b4a;
  --ink:#e7eaf2;--soft:#a7b0c0;--mut:#7c8598;--faint:#5f6879;
  --gold:#c5a059;--goldf:#dbb977;--ok:#37c98f;--prop:#5c9ee6;--unk:#6b7484;--risk:#e2685c;--warn:#d4af37;
  --cli:#5c9ee6;--art:#c084c9;--stf:#37c98f;
  --fn:#5c9ee6;--pg:#d4af37;--js:#9b8ad6;--sql:#37c98f;--doc:#8891a2;--cfg:#e2685c;
  --gold-a16:rgba(197,160,89,.16);--gold-a40:rgba(197,160,89,.4);--hover-a:rgba(255,255,255,.05);
}}
:root[data-theme="dark"]{
  --ground:#070910;--panel:#0f131b;--panel2:#141924;--rail:#0c1017;--line:#212836;--edge:#333b4a;
  --ink:#e7eaf2;--soft:#a7b0c0;--mut:#7c8598;--faint:#5f6879;
  --gold:#c5a059;--goldf:#dbb977;--ok:#37c98f;--prop:#5c9ee6;--unk:#6b7484;--risk:#e2685c;--warn:#d4af37;
  --cli:#5c9ee6;--art:#c084c9;--stf:#37c98f;
  --fn:#5c9ee6;--pg:#d4af37;--js:#9b8ad6;--sql:#37c98f;--doc:#8891a2;--cfg:#e2685c;
  --gold-a16:rgba(197,160,89,.16);--gold-a40:rgba(197,160,89,.4);--hover-a:rgba(255,255,255,.05);
}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);
  font:400 14.5px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
h1,h2,h3,h4{margin:0;text-wrap:balance} p{margin:0}
code{font-family:var(--mono);font-size:.83em;color:var(--soft);background:var(--panel2);
  border:1px solid var(--line);padding:1px 5px;border-radius:3px;word-break:break-all}
.tiny{font-size:11.5px;color:var(--faint)}
button{font:inherit;cursor:pointer;border-radius:6px;border:1px solid var(--line);background:var(--panel2);color:var(--ink);padding:6px 11px}
button:hover{border-color:var(--goldf)}
button[disabled]{opacity:.4;cursor:default}
:focus-visible{outline:2px solid var(--goldf);outline-offset:2px}

/* ── barra superior ── */
.top{position:sticky;top:0;z-index:40;display:flex;align-items:center;gap:14px;flex-wrap:wrap;
  padding:11px 18px;background:var(--panel);border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:11px;padding-right:14px;border-right:1px solid var(--line)}
.brand .mk{width:35px;height:36px;display:block;flex:0 0 auto;object-fit:contain}
.brand .mk-fb{width:34px;height:34px;border-radius:7px;background:var(--gold);display:grid;place-items:center;
  font:800 13px/1 system-ui,sans-serif;color:#fff;letter-spacing:-.03em}
.brand b{display:block;font:800 15.5px/1.15 system-ui,sans-serif;letter-spacing:-.01em}
.brand .wm{display:block;height:13px;width:auto;margin-top:4px;opacity:.92}
.brand span{display:block;font-family:var(--mono);font-size:10px;color:var(--faint);letter-spacing:.09em}
.truthbadge{display:flex;align-items:center;gap:8px;padding:6px 12px;border:1px solid var(--ok);border-radius:20px;
  font:700 10px/1 system-ui,sans-serif;letter-spacing:.13em;color:var(--ok)}
.truthbadge i{width:8px;height:8px;border-radius:50%;background:var(--ok);display:block}
.kpis{display:flex;gap:8px;flex-wrap:wrap;margin-left:auto}
.kpi{padding:6px 13px;border:1px solid var(--line);border-radius:7px;background:var(--panel2);min-width:78px}
.kpi b{display:block;font-family:var(--mono);font-size:18px;line-height:1.1;font-variant-numeric:tabular-nums}
.kpi span{display:block;font:700 8.5px/1.2 system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);margin-top:3px}
.kpi.v b{color:var(--ok)} .kpi.p b{color:var(--prop)} .kpi.u b{color:var(--unk)} .kpi.c b{color:var(--risk)}
.stamp{font-family:var(--mono);font-size:10.5px;color:var(--faint);line-height:1.45;text-align:right}

/* ── shell ── */
.shell{display:grid;grid-template-columns:274px minmax(0,1fr) 384px;gap:0;align-items:start}
.railwrap{position:sticky;top:71px;max-height:calc(100vh - 71px);overflow-y:auto;overflow-x:hidden;
  padding:10px 0 44px;border-right:1px solid var(--line);background:var(--rail)}
/* Convención de barra lateral vigente del portal STAFF (Hito 1, web/staff.html):
   .staff-side3 / .side3-group / .side3-link — riel a toda altura con borde derecho,
   marca de activo por box-shadow interior, no por border-left.
   Los literales blancos del original se tokenizan para que el tema claro funcione. */
.side3-group{padding:12px 14px 12px 15px;font-size:11px;font-weight:800;letter-spacing:.13em;
  text-transform:uppercase;color:var(--gold)}
.side3-link{display:flex;align-items:center;gap:11px;width:100%;background:none;border:none;
  color:var(--soft);font-family:inherit;font-size:13.5px;text-align:left;cursor:pointer;white-space:nowrap;
  padding:9px 14px 9px 15px;border-radius:0;transition:background .15s,color .15s,box-shadow .15s}
.side3-link svg{flex:0 0 15px}
.side3-link .sl-t{flex:1 1 auto;overflow:hidden;text-overflow:ellipsis}
.side3-link .sl-c{font-family:var(--mono);font-size:10.5px;color:var(--faint)}
.side3-link .sl-c.w{color:var(--risk)}
.side3-link:hover{background:var(--hover-a);color:var(--ink)}
.side3-link[aria-current="true"]{background:var(--gold-a16);color:var(--goldf);
  box-shadow:inset 3px 0 0 #c5a059}
.main{min-width:0;padding:18px 20px 70px}
.tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px}
.tab{padding:7px 14px;font-size:13.5px}
.tab[aria-selected="true"]{background:var(--ink);color:var(--ground);border-color:var(--ink);font-weight:600}
.pane[hidden]{display:none}
.pane-h{margin-bottom:14px}
.pane-h h2{font:700 21px/1.2 system-ui,sans-serif;letter-spacing:-.017em}
.pane-h p{color:var(--soft);font-size:14px;max-width:80ch;margin-top:7px}

figure{margin:0;border:1px solid var(--line);background:var(--panel);border-radius:11px;padding:10px;overflow-x:auto}
svg.gr{display:block;width:100%;height:auto}
svg.radial{min-width:1030px} svg.map{min-width:1040px}
.legend{display:flex;flex-wrap:wrap;gap:7px 18px;margin-top:11px;font-family:var(--mono);font-size:11.5px;color:var(--mut)}
.legend i{display:inline-block;width:11px;height:11px;border-radius:3px;border:1.5px solid;margin-right:6px;vertical-align:-1px}

/* grafo radial */
.gedges .ge{fill:none;stroke:var(--edge);stroke-width:1;opacity:.5}
.gcore rect{fill:var(--panel2);stroke:var(--goldf);stroke-width:2}
.gct{font:800 16px system-ui,sans-serif;fill:var(--goldf);letter-spacing:-.01em}
.gct2{font-family:var(--mono);font-size:10.5px;fill:var(--soft)}
.gnode{cursor:pointer}
.gnode rect{fill:var(--panel);stroke:var(--line);stroke-width:1.5}
.gnode .gn{font:600 12.5px system-ui,sans-serif;fill:var(--ink)}
.gnode .gs{font-family:var(--mono);font-size:9.5px;fill:var(--faint)}
.g-verified rect{stroke:var(--ok)} .g-proposed rect{stroke:var(--prop);stroke-dasharray:6 3}
.g-unknown rect{stroke:var(--unk);stroke-dasharray:3 4} .g-unknown .gn{fill:var(--mut)}
.gdot{fill:var(--risk)}
.gnode:hover rect,.gnode:focus rect{stroke-width:2.6}
.gnode.sel rect{stroke:var(--goldf);stroke-width:2.8}
.radial.dim .gnode{opacity:.2} .radial.dim .gnode.hit{opacity:1}

/* lista de capacidades */
.caplist{display:grid;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:9px;overflow:hidden;margin-top:16px}
.caprow{display:grid;grid-template-columns:14px 1fr 34px 82px;align-items:center;gap:10px;border:0;border-radius:0;
  background:var(--panel);padding:9px 13px;text-align:left;font-size:13.5px}
.caprow:hover{background:var(--panel2)}
.caprow.sel{background:var(--panel2);box-shadow:inset 3px 0 0 var(--goldf)}
.cdot{width:9px;height:9px;border-radius:50%;background:var(--unk);display:inline-block}
.s-verified .cdot,.cdot.s-verified{background:var(--ok)} .s-proposed .cdot,.cdot.s-proposed{background:var(--prop)}
.clay{font-family:var(--mono);font-size:11px;color:var(--faint)}
.cst{font:700 9px/1 system-ui,sans-serif;letter-spacing:.11em;color:var(--mut);text-align:right}
.s-verified .cst{color:var(--ok)} .s-proposed .cst{color:var(--prop)}
.has-drift .cname::after{content:"⚠";color:var(--risk);margin-left:7px}

/* inspector */
.insp{position:sticky;top:59px;max-height:calc(100vh - 59px);overflow-y:auto;padding:18px 18px 50px;
  border-left:1px solid var(--line);background:var(--panel)}
.insp h3{font:700 18px/1.24 system-ui,sans-serif;margin:0 0 7px}
.ist{font:700 9.5px/1 system-ui,sans-serif;letter-spacing:.13em;padding:5px 8px;border:1px solid;border-radius:4px;display:inline-block}
.i-verified{color:var(--ok);border-color:var(--ok)} .i-proposed{color:var(--prop);border-color:var(--prop)} .i-unknown{color:var(--unk);border-color:var(--unk)}
.insp h4{font:700 9.5px/1 system-ui,sans-serif;letter-spacing:.13em;text-transform:uppercase;color:var(--faint);margin:19px 0 7px}
.insp ul{list-style:none;margin:0;padding:0;display:grid;gap:5px}
.insp li{font-size:12.5px;display:flex;gap:7px;align-items:baseline}
.ev{font:700 8.5px/1 system-ui,sans-serif;letter-spacing:.08em;padding:3px 5px;border-radius:3px;border:1px solid;flex:0 0 auto}
.ev-code{color:var(--fn);border-color:var(--fn)} .ev-test{color:var(--ok);border-color:var(--ok)}
.ev-doc{color:var(--doc);border-color:var(--doc)} .ev-git{color:var(--gold);border-color:var(--gold)}
.insp li.q{color:var(--soft);font-size:13px;display:block;padding-left:15px;position:relative}
.insp li.q::before{content:"?";position:absolute;left:0;color:var(--risk);font-weight:700}
.insp .none{font-size:12.5px;color:var(--faint);font-style:italic}
.insp .drift{border:1px solid var(--risk);border-radius:7px;padding:11px 12px;margin-top:8px}
.insp .drift p{font-size:12.5px;color:var(--soft)}
.insp .drift .ql{color:var(--risk);font-family:var(--mono);font-size:11.5px;margin-top:6px}
.insp .kv{display:grid;grid-template-columns:96px 1fr;gap:5px 10px;font-size:12.5px}
.insp .kv dt{color:var(--faint)} .insp .kv dd{margin:0}
.insp-x{display:none}

/* capítulos / paneles heredados */
.deck{position:sticky;top:59px;z-index:20;margin:0 0 14px;padding:10px 13px;background:var(--panel);
  border:1px solid var(--line);border-radius:10px;display:grid;gap:9px}
.deck-r1,.deck-r2{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.rt-lab{font:700 9.5px/1 system-ui,sans-serif;letter-spacing:.13em;text-transform:uppercase;color:var(--faint)}
.route[aria-pressed="true"]{background:var(--ink);color:var(--ground);border-color:var(--ink);font-weight:600}
.play{background:var(--gold);border-color:var(--gold);color:#fff;font-weight:700}
:root[data-theme="dark"] .play,:root:not([data-theme="light"]) .play{color:#070910}
@media (prefers-color-scheme:light){:root:not([data-theme="dark"]) .play{color:#fff}}
.pos{font-family:var(--mono);font-size:12px;color:var(--faint);font-variant-numeric:tabular-nums}
.cap{flex:1 1 260px;min-width:0} .cap b{display:block;font-size:13.5px} .cap span{font-size:12.5px;color:var(--soft)}
.chapter{margin:38px 0 0;scroll-margin-top:150px}
.chapter.hide{display:none}
.cap-head{display:flex;align-items:baseline;gap:13px;flex-wrap:wrap;border-bottom:1px solid var(--goldf);padding-bottom:9px}
.cap-n{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold)}
.cap-head h2{font:700 21px/1.2 system-ui,sans-serif;letter-spacing:-.015em;flex:1 1 auto}
.auds{display:flex;gap:6px}
.aud{font:700 9.5px/1 system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;padding:5px 8px;border-radius:4px;border:1px solid}
.a-cliente{color:var(--cli);border-color:var(--cli)} .a-artista{color:var(--art);border-color:var(--art)} .a-staff{color:var(--stf);border-color:var(--stf)}
.cap-lead{margin:15px 0 0;font-size:16px;max-width:78ch}
.chapter figure{margin:18px 0 0}
.cap-body{margin:18px 0 0;display:grid;gap:10px;max-width:80ch}
.cap-body p{color:var(--soft)}
.cap-focus{margin:15px 0 0;font-size:13px;color:var(--mut)} .cap-focus b{font-family:var(--mono);color:var(--gold)}
.mods{margin:11px 0 0;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.mods-t{font:700 9.5px/1 system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--faint)}
.mods code.gone{color:var(--risk);border-color:var(--risk)}
section.on>.cap-head{background:linear-gradient(90deg,var(--gold-a16),transparent)}

/* svg capas + pipelines */
.band-bg{fill:var(--panel2);stroke:var(--line)} .band-edge{fill:var(--edge)}
.band-id{font-family:var(--mono);font-size:14px;font-weight:700;fill:var(--gold)}
.band-name{font:600 15px system-ui,sans-serif;fill:var(--ink)}
.band-meta{font-family:var(--mono);font-size:10.5px;fill:var(--faint)}
.band-total{font-family:var(--mono);font-size:15px;fill:var(--mut)}
.node rect{fill:var(--panel);stroke:var(--line)} .node text{font-family:var(--mono);font-size:10.5px;fill:var(--soft)}
.k-fn rect{stroke:var(--fn)} .k-fn text{fill:var(--fn)} .k-pg rect{stroke:var(--pg)} .k-pg text{fill:var(--pg)}
.k-js rect{stroke:var(--js)} .k-js text{fill:var(--js)} .k-sql rect{stroke:var(--sql)} .k-sql text{fill:var(--sql)}
.k-doc rect{stroke:var(--doc)} .k-doc text{fill:var(--doc)} .k-cfg rect{stroke:var(--cfg)} .k-cfg text{fill:var(--cfg)}
.k-more rect{stroke:var(--line);stroke-dasharray:3 3} .k-more text{fill:var(--faint)}
.link path{fill:none;stroke:var(--gold);stroke-width:1.3;opacity:.5}
.map.spot .band{opacity:.16;transition:opacity .3s} .map.spot .band.on{opacity:1}
.band.on .band-bg{stroke:var(--goldf);stroke-width:1.8}
.pstep rect{fill:var(--panel2);stroke:var(--line);stroke-width:1.2}
.pstep .pn{font-family:var(--mono);font-size:10px;fill:var(--faint)}
.pstep .pt{font:700 14px system-ui,sans-serif;fill:var(--ink)} .pstep .pt.sm{font-size:12.5px}
.pstep .ps{font-family:var(--mono);font-size:10.5px;fill:var(--mut)} .pstep .ps.dim{fill:var(--faint)}
.p-gate rect{stroke:var(--gold);stroke-width:1.7} .p-gate .pt{fill:var(--gold)}
.p-ok rect{stroke:var(--ok);stroke-width:1.7} .p-ok .pt{fill:var(--ok)}
.p-warn rect{stroke:var(--risk);stroke-width:1.5;stroke-dasharray:5 4} .p-warn .pt{fill:var(--risk)}
.p-core rect{stroke:var(--goldf);stroke-width:2.2} .p-core .pt{fill:var(--goldf)}
.p-miss rect{stroke:var(--risk);stroke-width:1.4;stroke-dasharray:5 4;fill:none} .p-miss .pt{fill:var(--risk)}
.p-cli rect{stroke:var(--cli)} .p-cli .pt{fill:var(--cli)}
.p-art rect{stroke:var(--art)} .p-art .pt{fill:var(--art)}
.p-stf rect{stroke:var(--stf)} .p-stf .pt{fill:var(--stf)}
.parrow{fill:none;stroke:var(--mut);stroke-width:1.4} .parrow.wrap{stroke-dasharray:4 4}
.glab{font-family:var(--mono);font-size:10.5px;letter-spacing:1.4px;fill:var(--faint)} .glab.sm{letter-spacing:0}

/* conflictos / reglas / evidencia / preguntas */
.sec-head{display:flex;align-items:baseline;gap:14px;border-bottom:1px solid var(--goldf);padding-bottom:8px;margin-top:34px}
.sec-head h2{font:700 19px/1.2 system-ui,sans-serif}
.sec-head .ref{font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold)}
.sec-note{color:var(--soft);font-size:14px;max-width:80ch;margin:13px 0 18px}
.tag{font:700 9.5px/1 system-ui,sans-serif;letter-spacing:.11em;padding:5px 8px;border:1px solid var(--line);border-radius:4px;color:var(--mut);white-space:nowrap}
.t-ok{color:var(--ok);border-color:var(--ok)} .t-no{color:var(--unk)}
.t-risk{color:var(--risk);border-color:var(--risk)} .t-warn{color:var(--warn);border-color:var(--warn)}
.ai-row{display:grid;grid-template-columns:24px 1fr 100px;gap:13px;padding:13px 0;border-bottom:1px solid var(--line);align-items:start}
.ai-row:first-of-type{border-top:1px solid var(--line)}
.ai-n{font-family:var(--mono);font-size:12.5px;color:var(--faint);padding-top:3px}
.ai-rule{font-size:14px;margin-bottom:4px} .ai-note{font-size:13px;color:var(--soft);max-width:80ch;margin-bottom:4px}
.ai-row .tag{justify-self:end}
.chks{display:grid;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:9px;overflow:hidden}
.chk{background:var(--panel);padding:14px 16px;display:grid;gap:6px}
.chk header{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.chk-id{font-family:var(--mono);font-size:11.5px;color:var(--faint)}
.chk h3{font:600 14.5px/1.35 system-ui,sans-serif;flex:1 1 200px}
.chk p{font-size:13.5px;color:var(--soft);max-width:86ch}
.inv{border:1px solid var(--line);background:var(--panel);border-radius:7px;margin-bottom:6px}
.inv summary{cursor:pointer;padding:9px 13px;font-size:13.5px}
.inv summary b{font-family:var(--mono);color:var(--gold);margin-right:8px}
.inv ul{list-style:none;margin:0;padding:0 13px 12px;columns:2 320px;column-gap:24px}
.inv li{margin-bottom:4px;break-inside:avoid;font-size:12px}
.inv li.k-fn code{color:var(--fn)} .inv li.k-pg code{color:var(--pg)} .inv li.k-js code{color:var(--js)}
.inv li.k-sql code{color:var(--sql)} .inv li.k-doc code{color:var(--doc)} .inv li.k-cfg code{color:var(--cfg)}
.qgroup{border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:12px 14px;margin-bottom:7px}
.qhead{border:0;background:transparent;padding:0;font:600 14px system-ui,sans-serif;display:flex;align-items:center;gap:8px}
.qgroup ul{margin:9px 0 0;padding-left:17px;display:grid;gap:5px} .qgroup li{font-size:13px;color:var(--soft)}
.rmkpis{display:flex;gap:9px;flex-wrap:wrap;margin:14px 0 16px}
.rmk{padding:7px 13px;border:1px solid var(--line);border-radius:7px;background:var(--panel2);font-size:12.5px;color:var(--mut)}
.rmk b{font-family:var(--mono);font-size:15px;color:var(--ink);margin-right:5px}
.rmk.ready{border-color:var(--warn)} .rmk.ready b{color:var(--warn)}
.rmk.blocked b{color:var(--unk)}
.rmlist{display:grid;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:9px;overflow:hidden}
.rmi{background:var(--panel);padding:15px 17px;display:grid;gap:6px}
.rmi header{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.rmn{font-family:var(--mono);font-size:15px;color:var(--gold);font-variant-numeric:tabular-nums}
.rmid{font-family:var(--mono);font-size:11px;color:var(--faint)}
.rmi h3{font:600 15px/1.35 system-ui,sans-serif;flex:1 1 220px}
.rmi p{font-size:13.5px;color:var(--soft);max-width:86ch}
.rmi .rmd{font-size:13px;color:var(--mut)} .rmi .rmd b{color:var(--soft)}
.r-done{opacity:.62} .r-done .rmn{color:var(--ok)}
.r-ready{box-shadow:inset 3px 0 0 var(--warn)}
.r-blocked .rmn{color:var(--unk)}
.howto{margin-top:34px;padding-top:18px;border-top:1px solid var(--line);color:var(--mut);font-size:13.5px;max-width:80ch}
.howto h2{font:700 12px/1 system-ui,sans-serif;letter-spacing:.11em;text-transform:uppercase;color:var(--soft);margin-bottom:11px}
.howto p{margin-bottom:9px} .howto ol{padding-left:18px;margin:0 0 9px} .howto li{margin-bottom:5px}

@media (max-width:1180px){
  .shell{grid-template-columns:254px minmax(0,1fr)}
  .insp{position:fixed;top:0;right:0;width:min(420px,100%);height:100%;z-index:60;border-left:1px solid var(--line);
    box-shadow:-18px 0 48px -30px rgba(0,0,0,.6);max-height:none}
  .insp[hidden]{display:none} .insp-x{display:block;position:absolute;top:13px;right:14px;padding:4px 9px}
}
@media (max-width:820px){
  .shell{grid-template-columns:minmax(0,1fr)}
  .railwrap{position:static;max-height:none;border-right:0;border-bottom:1px solid var(--line);padding:8px 0}
  .insp{width:100%;top:auto;bottom:0;height:80%;border-radius:12px 12px 0 0}
  .ai-row{grid-template-columns:20px 1fr} .ai-row .tag{grid-column:2;justify-self:start} .inv ul{columns:1}
}
@media print{
  .top,.railwrap,.tabs,.deck,.insp{display:none!important}
  .shell{grid-template-columns:1fr} .pane[hidden]{display:block!important} .chapter.hide{display:block}
  body{background:#fff;color:#111} .main{padding:0}
  figure{overflow:visible;break-inside:avoid;border:none;padding:0} svg.map,svg.radial{min-width:0}
  .chk,.inv,.qgroup,.chapter{break-inside:avoid} details{page-break-inside:avoid}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>

<div class="top">
  <div class="brand">
    ${EMBLEM ? `<img class="mk" src="${EMBLEM}" alt="" width="34" height="35">` : `<span class="mk mk-fb">MDJ</span>`}
    <div><b>Road Master Map</b>
      ${WORDMARK ? `<img class="wm" src="${WORDMARK}" alt="${esc(MAP.meta.org)}">` : `<span>${esc(MAP.meta.org)}</span>`}</div>
  </div>
  <div class="truthbadge"><i></i>TRUTH MODE</div>
  <div class="kpis">
    <div class="kpi v"><b>${nVer}</b><span>Verified</span></div>
    <div class="kpi p"><b>${nProp}</b><span>Proposed</span></div>
    <div class="kpi u"><b>${nUnk}</b><span>Unknown</span></div>
    <div class="kpi c"><b>${nDrift}</b><span>Conflictos</span></div>
    <div class="kpi"><b>${nOpenQ}</b><span>Preguntas</span></div>
    <div class="kpi"><b>${all.length}</b><span>Piezas</span></div>
  </div>
  <p class="stamp">Última corrida<br>${esc(ctx.at)}<br>${esc(ctx.branch)} · ${esc(ctx.sha)}</p>
</div>

<div class="shell">

  <nav class="railwrap staff-side3" aria-label="Índice maestro">${idxHtml}
  </nav>

  <main class="main">
    <div class="tabs" role="tablist">
      <button class="tab" role="tab" data-pane="mapa" aria-selected="true">Mapa</button>
      <button class="tab" role="tab" data-pane="capas" aria-selected="false">Capas</button>
      <button class="tab" role="tab" data-pane="capitulos" aria-selected="false">Capítulos</button>
      <button class="tab" role="tab" data-pane="roadmap" aria-selected="false">Roadmap</button>
      <button class="tab" role="tab" data-pane="conflictos" aria-selected="false">Conflictos</button>
      <button class="tab" role="tab" data-pane="preguntas" aria-selected="false">Preguntas</button>
      <button class="tab" role="tab" data-pane="evidencia" aria-selected="false">Evidencia</button>
    </div>

    <section class="pane" id="pane-mapa">
      <div class="pane-h"><h2>Mapa de capacidades</h2>
        <p>Las ${caps.length} capacidades del ecosistema alrededor del núcleo. El anillo interior son aquellas de las que más depende el resto — el grado se calcula, no se elige. <b>VERIFIED</b> = hay código en el árbol. <b>PROPOSED</b> = hay documento y no código. <b>UNKNOWN</b> = ni lo uno ni lo otro. Pulsa un nodo para ver su ficha de evidencia.</p></div>
      <figure>${graphicRadial()}</figure>
      <div class="legend">
        <span><i style="border-color:var(--ok)"></i>Verified — código presente</span>
        <span><i style="border-color:var(--prop);border-style:dashed"></i>Proposed — solo documento</span>
        <span><i style="border-color:var(--unk);border-style:dashed"></i>Unknown — sin evidencia</span>
        <span><i style="border-color:var(--risk);border-radius:50%"></i>Posible deriva documental</span>
      </div>
      <div class="caplist">${capRows}
      </div>
    </section>

    <section class="pane" id="pane-capas" hidden>
      <div class="pane-h"><h2>Capas del sistema</h2>
        <p>Las ${layers.length} capas con las ${all.length} piezas reales del repositorio ubicadas en cada una. Cada nodo es un archivo; el número al final de la franja es cuántos hay.</p></div>
      <figure>${graphicMap()}</figure>
      <div class="legend">
        <span><i style="border-color:var(--fn)"></i>Edge Function</span>
        <span><i style="border-color:var(--pg)"></i>Página</span>
        <span><i style="border-color:var(--js)"></i>Módulo JS</span>
        <span><i style="border-color:var(--sql)"></i>Migración SQL</span>
        <span><i style="border-color:var(--doc)"></i>Documento</span>
        <span><i style="border-color:var(--cfg)"></i>Configuración</span>
        <span><i style="border-color:var(--line);border-style:dashed"></i>Resto de la capa</span>
      </div>
    </section>

    <section class="pane" id="pane-capitulos" hidden>
      <div class="pane-h"><h2>Capítulos</h2>
        <p>El ecosistema explicado en ${chapters.length} capítulos. Elige tu ruta y pulsa Recorrido para que se explique solo; también puedes moverte con ← →.</p></div>
      <div class="deck">
        <div class="deck-r1">
          <span class="rt-lab">Ruta</span>
          <button class="route" data-route="todo" aria-pressed="true">Completa</button>
          ${MAP.audiences.map((a) => `<button class="route" data-route="${a.id}" aria-pressed="false" title="${esc(a.blurb)}">${esc(a.label)}</button>`).join("")}
          <span class="tiny" id="routeNote">${chapters.length} capítulos</span>
        </div>
        <div class="deck-r2">
          <button class="play" id="play">▶&nbsp; Recorrido</button>
          <button id="prev" disabled aria-label="Paso anterior">←</button>
          <button id="next" disabled aria-label="Paso siguiente">→</button>
          <span class="pos" id="pos">— / ${chapters.length}</span>
          <span class="cap" id="cap"><b>Capítulos</b><span>Elige una ruta y pulsa Recorrido.</span></span>
        </div>
      </div>
      ${chapHtml}
    </section>

    <section class="pane" id="pane-roadmap" hidden>
      <div class="pane-h"><h2>Roadmap de ejecución</h2>
        <p>De lo que el árbol demuestra hoy a lo que falta, en el orden en que conviene hacerlo. El estado de cada tarea no está escrito: lo lee la misma sonda que alimenta el resto del mapa. El orden se calcula por dependencias y luego por impacto — cuando cierres una, las que dependían de ella pasan solas de BLOQUEADA a LISTA.</p></div>
      <figure>${renderGraphic("gap", "Cadena de brecha")}</figure>
      <div class="rmkpis">
        <span class="rmk"><b>${rmDone}</b> hechas</span>
        <span class="rmk ready"><b>${rmReady}</b> listas para empezar</span>
        <span class="rmk blocked"><b>${rmBlocked}</b> bloqueadas por dependencia</span>
      </div>
      <div class="rmlist">${rmHtml}
      </div>
      <div class="howto">
        <h2>El bucle</h2>
        <ol>
          <li>Arreglas el código.</li>
          <li>El hook <code>post-commit</code> regenera el mapa en cada commit (<code>~1 s</code>).</li>
          <li>La sonda de esa tarea la cierra sola y las dependientes se desbloquean.</li>
          <li>Para el PDF: <code>ROADMAP_PDF=1 git commit …</code> o <code>node docs/roadmap/build.mjs --pdf</code>.</li>
        </ol>
        <p><b>Lo único que no se automatiza:</b> republicar el Artifact. El hook deja el archivo fresco en disco; el enlace publicado se actualiza pidiéndolo.</p>
      </div>
    </section>

    <section class="pane" id="pane-conflictos" hidden>
      <div class="pane-h"><h2>Centro de conflictos</h2>
        <p>Contradicciones entre lo que los documentos afirman y lo que el código demuestra, más las sondas de integridad y las reglas de la capa de IA. Todo se recalcula en cada corrida.</p></div>

      <div class="sec-head" style="margin-top:6px"><h2>Deriva documental</h2><span class="ref">${nDrift} de ${caps.length} capacidades</span></div>
      <p class="sec-note">Se marca cuando un documento de la capacidad contiene una afirmación de inexistencia y el código de esa misma capacidad sí está en el árbol. La línea citada se muestra para que un humano juzgue.</p>
      <div class="chks">${driftHtml}</div>

      <div class="sec-head"><h2>Verificaciones de integridad</h2><span class="ref">${openV.length} abiertas de ${integrity.length}</span></div>
      <p class="sec-note">Hallazgos verificados en el código, cada uno con su sonda. Al arreglar el código, la fila se cierra sola.</p>
      <div class="chks">${intHtml}
      </div>

      <div class="sec-head"><h2>Las siete reglas de la capa de IA</h2><span class="ref">${aiMet}/${aiRules.length} cumplidas</span></div>
      <p class="sec-note">El veredicto no es una lectura mía: es lo que la sonda encuentra o no encuentra en el código.</p>
      ${aiHtml}
    </section>

    <section class="pane" id="pane-preguntas" hidden>
      <div class="pane-h"><h2>Preguntas abiertas</h2>
        <p>${nOpenQ} preguntas que este mapa no puede responder solo: unas las escribió el análisis, otras las genera la propia verificación (por ejemplo, una capacidad sin prueba ejecutable). Son el trabajo pendiente real, no una lista de deseos.</p></div>
      ${qHtml}
    </section>

    <section class="pane" id="pane-evidencia" hidden>
      <div class="pane-h"><h2>Evidencia</h2>
        <p>Las ${all.length} piezas del repositorio listadas por capa. Lo que ninguna regla logra clasificar se muestra al final en vez de esconderse.</p></div>
      ${invHtml}
      <div class="howto">
        <h2>Cómo se actualiza solo</h2>
        <p>${esc(MAP.meta.reference)}</p>
        <ol>
          <li>La taxonomía, las capacidades, los capítulos y las sondas viven en <code>docs/roadmap/master-map.json</code>.</li>
          <li><code>node docs/roadmap/build.mjs</code> recorre el árbol, clasifica cada archivo, resuelve cada sonda y reescribe <code>docs/roadmap/index.html</code>.</li>
          <li>Publicar ese mismo archivo reemplaza esta página en su URL: el enlace nunca cambia.</li>
          <li><code>node docs/roadmap/build.mjs --pdf</code> genera además <code>Road-Master-Map.pdf</code> con todo el contenido.</li>
        </ol>
        <p>Para vigilar algo nuevo se edita el JSON, nunca el HTML. Para cerrar un hallazgo se arregla el código: la sonda lo nota sola.</p>
        <p><b>Lo que esta página no puede hacer:</b> no consulta la base de datos ni responde preguntas en vivo. Un artifact publicado no puede llamar a ningún servicio, así que todo lo que ves salió del repositorio en el momento de la corrida indicada arriba.</p>
      </div>
    </section>
  </main>

  <aside class="insp" id="insp" aria-label="Inspector" tabindex="-1">
    <button class="insp-x" id="inspX" aria-label="Cerrar inspector">✕</button>
    <div id="inspBody"></div>
  </aside>

</div>

<script>
(function(){
  var CAPS = ${JSON.stringify(capData)};
  var LBL = { verified:'VERIFIED', proposed:'PROPOSED', unknown:'UNKNOWN' };
  var SUMMARY = ${JSON.stringify({ ver: nVer, prop: nProp, unk: nUnk, drift: nDrift, q: nOpenQ, pieces: all.length, layers: layers.length, at: ctx.at, branch: ctx.branch, sha: ctx.sha })};
  var insp = document.getElementById('insp'), body = document.getElementById('inspBody');
  var narrow = function(){ return matchMedia('(max-width:1180px)').matches; };
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function evList(items, kind){
    if (!items || !items.length) return '<p class="none">Sin evidencia registrada.</p>';
    return '<ul>' + items.map(function(x){
      return '<li><span class="ev ev-' + kind + '">' + kind.toUpperCase() + '</span><code>' + esc(x) + '</code></li>';
    }).join('') + '</ul>';
  }
  function overview(){
    body.innerHTML = '<h3>Estado de la plataforma</h3>'
      + '<span class="ist i-verified">TRUTH MODE</span>'
      + '<h4>Resumen</h4><dl class="kv">'
      + '<dt>Verified</dt><dd>' + SUMMARY.ver + ' capacidades con código</dd>'
      + '<dt>Proposed</dt><dd>' + SUMMARY.prop + ' con documento y sin código</dd>'
      + '<dt>Unknown</dt><dd>' + SUMMARY.unk + ' sin evidencia</dd>'
      + '<dt>Conflictos</dt><dd>' + SUMMARY.drift + ' con posible deriva</dd>'
      + '<dt>Preguntas</dt><dd>' + SUMMARY.q + ' abiertas</dd>'
      + '<dt>Piezas</dt><dd>' + SUMMARY.pieces + ' archivos en ' + SUMMARY.layers + ' capas</dd></dl>'
      + '<h4>Corrida</h4><dl class="kv">'
      + '<dt>Generado</dt><dd>' + esc(SUMMARY.at) + '</dd>'
      + '<dt>Rama</dt><dd><code>' + esc(SUMMARY.branch) + '</code></dd>'
      + '<dt>Commit</dt><dd><code>' + esc(SUMMARY.sha) + '</code></dd></dl>'
      + '<h4>Cómo leerlo</h4><p style="font-size:13px;color:var(--soft)">Pulsa cualquier nodo del mapa o cualquier fila de la lista para ver de dónde sale su estado: los archivos que lo implementan, las pruebas que lo cubren, los documentos que lo describen y los commits que lo tocaron.</p>';
  }
  function open(id){
    var c = CAPS[id]; if (!c) return;
    var h = '<h3>' + esc(c.name) + '</h3><span class="ist i-' + c.state + '">' + LBL[c.state] + '</span>'
      + '<h4>Ficha</h4><dl class="kv">'
      + '<dt>Tipo</dt><dd>Capacidad de negocio</dd>'
      + '<dt>Capa</dt><dd><code>' + c.layer + '</code> ' + esc(c.layerName) + '</dd>'
      + '<dt>Estado</dt><dd>' + (c.state === 'verified' ? 'Código presente en el árbol' : c.state === 'proposed' ? 'Documentado, sin código' : 'Sin evidencia') + '</dd>'
      + '<dt>Fuente de verdad</dt><dd>' + (c.sot ? '<code>' + esc(c.sot) + '</code>' : '<span class="none">no declarada</span>') + '</dd></dl>';
    if (c.drift && c.drift.length) {
      h += '<h4>Conflicto detectado</h4>';
      c.drift.forEach(function(d){
        h += '<div class="drift"><p>Señal, no veredicto: este documento contiene una afirmación de inexistencia mientras la implementación sí está en el árbol. Puede referirse a otra parte del documento — la línea exacta va abajo para que la juzgues.</p><p class="ql">“' + esc(d.line) + '”</p></div>';
      });
    }
    h += '<h4>Implementación (' + c.impl.length + ')</h4>' + evList(c.impl, 'code')
      + '<h4>Pruebas (' + c.tests.length + ')</h4>' + evList(c.tests, 'test')
      + '<h4>Documentos (' + c.docs.length + ')</h4>' + evList(c.docs, 'doc')
      + '<h4>Depende de</h4>' + (c.deps.length ? '<ul>' + c.deps.map(function(x){ return '<li>→ ' + esc(x) + '</li>'; }).join('') + '</ul>' : '<p class="none">Sin dependencias verificadas.</p>')
      + '<h4>Usada por</h4>' + (c.used.length ? '<ul>' + c.used.map(function(x){ return '<li>→ ' + esc(x) + '</li>'; }).join('') + '</ul>' : '<p class="none">Sin consumidores verificados.</p>')
      + '<h4>Preguntas abiertas (' + c.unknowns.length + ')</h4>'
      + (c.unknowns.length ? '<ul>' + c.unknowns.map(function(u){ return '<li class="q">' + esc(u) + '</li>'; }).join('') + '</ul>' : '<p class="none">Ninguna registrada.</p>')
      + '<h4>Historial</h4>' + (c.history.length
        ? '<ul>' + c.history.map(function(x){ return '<li><span class="ev ev-git">GIT</span><span style="font-family:var(--mono);font-size:11.5px">' + esc(x.h) + ' · ' + esc(x.d) + ' — ' + esc(x.s) + '</span></li>'; }).join('') + '</ul>'
        : '<p class="none">Sin commits que toquen estas rutas.</p>');
    body.innerHTML = h;
    insp.hidden = false; insp.scrollTop = 0;
    document.querySelectorAll('.gnode.sel, .caprow.sel').forEach(function(e){ e.classList.remove('sel'); });
    document.querySelectorAll('[data-cap="' + id + '"]').forEach(function(e){ e.classList.add('sel'); });
    if (narrow()) insp.focus();
  }
  function closeInsp(){ if (narrow()) insp.hidden = true; }

  document.querySelectorAll('[data-cap]').forEach(function(el){
    el.addEventListener('click', function(){ open(el.dataset.cap); });
    el.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(el.dataset.cap); } });
  });
  document.getElementById('inspX').addEventListener('click', closeInsp);

  /* pestañas + índice */
  var radial = document.getElementById('radial');
  function showPane(name){
    document.querySelectorAll('.pane').forEach(function(p){ p.hidden = p.id !== 'pane-' + name; });
    document.querySelectorAll('.tab').forEach(function(t){ t.setAttribute('aria-selected', String(t.dataset.pane === name)); });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function filterLayer(L){
    if (!radial) return;
    radial.classList.toggle('dim', !!L);
    radial.querySelectorAll('.gnode').forEach(function(n){ n.classList.toggle('hit', !L || n.dataset.layer === L); });
  }
  document.querySelectorAll('.tab').forEach(function(t){
    t.addEventListener('click', function(){ showPane(t.dataset.pane); filterLayer(null); });
  });
  document.querySelectorAll('.side3-link').forEach(function(b){
    b.addEventListener('click', function(){
      document.querySelectorAll('.side3-link').forEach(function(x){ x.removeAttribute('aria-current'); });
      b.setAttribute('aria-current', 'true');
      showPane(b.dataset.tab);
      filterLayer(b.dataset.layer || null);
    });
  });

  overview();
  if (narrow()) insp.hidden = true;
  addEventListener('resize', function(){ if (!narrow()) insp.hidden = false; });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeInsp(); });
})();
</script>

<script>
(function(){
  var STOPS = ${JSON.stringify(stops.filter((s) => s.id.startsWith("cap-")))};
  var play = document.getElementById('play'), prev = document.getElementById('prev'), next = document.getElementById('next');
  var pos = document.getElementById('pos'), cap = document.getElementById('cap'), note = document.getElementById('routeNote');
  var list = STOPS.slice(), i = -1, timer = null, running = false;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var IDLE = '<b>Capítulos</b><span>Elige una ruta y pulsa Recorrido.</span>';

  function applyRoute(r){
    list = STOPS.filter(function(s){ return r === 'todo' || s.aud.indexOf(r) >= 0; });
    document.querySelectorAll('.route').forEach(function(b){ b.setAttribute('aria-pressed', String(b.dataset.route === r)); });
    document.querySelectorAll('.chapter').forEach(function(el){
      el.classList.toggle('hide', !(r === 'todo' || el.dataset.aud.split(' ').indexOf(r) >= 0));
    });
    note.textContent = list.length + (list.length === 1 ? ' capítulo' : ' capítulos');
    reset();
  }
  function clearSpot(){
    document.querySelectorAll('.map').forEach(function(m){ m.classList.remove('spot'); });
    document.querySelectorAll('.band.on, .chapter.on').forEach(function(el){ el.classList.remove('on'); });
  }
  function reset(){ stop(); clearSpot(); i = -1; pos.textContent = '— / ' + list.length; cap.innerHTML = IDLE;
    prev.disabled = true; next.disabled = list.length === 0; }
  function show(n){
    clearSpot(); i = n;
    var s = list[i], el = document.getElementById(s.id);
    if (el) { el.classList.add('on'); el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }
    cap.innerHTML = '<b>' + s.h + '</b><span>' + s.b + '</span>';
    pos.textContent = (i + 1) + ' / ' + list.length;
    prev.disabled = i <= 0; next.disabled = i >= list.length - 1;
  }
  function stop(){ running = false; clearTimeout(timer); timer = null; play.textContent = '▶  Recorrido'; }
  function tick(){ if (!running) return; if (i >= list.length - 1) { stop(); return; } show(i + 1); timer = setTimeout(tick, 6000); }

  document.querySelectorAll('.route').forEach(function(b){ b.addEventListener('click', function(){ applyRoute(b.dataset.route); }); });
  play.addEventListener('click', function(){
    if (running) { stop(); return; } if (!list.length) return;
    running = true; play.textContent = '❚❚  Pausa';
    if (i >= list.length - 1) i = -1;
    show(i + 1); timer = setTimeout(tick, 6000);
  });
  prev.addEventListener('click', function(){ stop(); if (i > 0) show(i - 1); });
  next.addEventListener('click', function(){ stop(); if (i < list.length - 1) show(i + 1); });
  document.addEventListener('keydown', function(e){
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    if (document.getElementById('pane-capitulos').hidden) return;
    if (e.key === 'ArrowRight' && i < list.length - 1) { stop(); show(i + 1); }
    else if (e.key === 'ArrowLeft' && i > 0) { stop(); show(i - 1); }
  });
  applyRoute('todo');
})();
</script>
`;

const OUT = join(HERE, "index.html");
writeFileSync(OUT, html, "utf8");
console.log(`✓ ${relative(ROOT, OUT)} (${(html.length / 1024).toFixed(1)} KB)`);
console.log(`  ${all.length} piezas · ${unfiled.length} sin clasificar · ${chapters.length} capítulos`);
console.log(`  truth mode: ${nVer} verified · ${nProp} proposed · ${nUnk} unknown · ${nDrift} con deriva · ${nOpenQ} preguntas abiertas`);
console.log(`  IA ${aiMet}/${aiRules.length} · integridad ${integrity.length - openV.length}/${integrity.length}`);
for (const v of openV) console.log(`  ABIERTO ${v.id} — ${v.title}`);

if (process.argv.includes("--pdf")) {
    const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    const pdf = join(HERE, "Road-Master-Map.pdf");
    if (!existsSync(CHROME)) { console.error("✗ Chrome no encontrado; se omite el PDF."); process.exit(0); }
    execSync(`"${CHROME}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdf}" "file://${OUT}"`,
        { stdio: ["ignore", "ignore", "pipe"] });
    console.log(`✓ ${relative(ROOT, pdf)}`);
}
