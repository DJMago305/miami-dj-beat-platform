#!/usr/bin/env node
/* Higiene del sitio (PO 2026-09-27: «que nunca queden páginas viejas que parecen regresiones»).
 * Uso, desde la raíz del repo:  node web/scripts/check-hygiene.mjs      (sale 1 si hay errores)
 * Reglas:
 *  1. PÁGINA RETIRADA NO PUEDE EXISTIR: toda fuente de `redirects` de vercel.json que sea un .html no puede seguir como archivo,
 *     ni estar en sitemap.xml, ni estar enlazada (href/src/action o texto entre comillas «'./x.html'») desde ninguna página o script.
 *  2. PÁGINA HUÉRFANA: toda página .html de web/ debe poder alcanzarse desde el inicio, el menú o los portales (el sitemap no cuenta) (siguiendo enlaces de
 *     HTML y de los scripts que cada página carga). Si es intencional que no la enlace nadie, se declara abajo en ALLOW con su razón.
 * Al reemplazar una página: bórrala en el MISMO PR, ponle redirección 301 en vercel.json y quita su entrada del sitemap. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WEB = path.join(REPO, 'web');
const errors = [];

/* Páginas que a propósito no enlaza nadie (o solo se abren con enlace directo). Cada una lleva su razón. */
const ALLOW = {
  'certificate-template_LOCKED.html': 'plantilla de certificado bloqueada a propósito',
  'includes/site-header.html': 'fuente canónica del encabezado, se copia a cada página',
  'staff-config.html': 'se incrusta como iframe dentro de staff.html (nombre armado por código)',
  'mdj-commander.html': 'PENDIENTE DEL PO (2026-09-27): prototipo del Comandante; abre y funciona (con pantallas Radar/Decisiones/Más de demostración que staff.html no tiene); lo real ya vive en staff.html. Decidir si se archiva',
  'documents/wedding-blueprint-iris-angel-2026.html': 'documento de un evento concreto, se comparte por enlace directo',
};
const ALLOW_PREFIX = {
  'manuals/MDJPRO_Manual_Print/': 'versiones de impresión del manual (se generan/abren fuera del sitio)',
};

function walk(d, out = []) {
  for (const f of fs.readdirSync(d)) {
    if (['node_modules', 'vendor', 'assets', 'installers', 'downloads', '.git', '.worktrees'].includes(f)) continue;
    const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}
const all = walk(WEB);
const rel = (f) => path.relative(WEB, f).split(path.sep).join('/');
const pages = all.filter((f) => f.endsWith('.html')).map(rel);
const pageSet = new Set(pages);
const text = {};
// Los comentarios NO cuentan como enlace (una mención en un comentario no hace «alcanzable» a una página muerta).
const stripComments = (t) => t.replace(/<!--[\s\S]*?-->/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1');
for (const f of all.filter((f) => /\.(html|js|mjs|xml)$/.test(f))) text[rel(f)] = stripComments(fs.readFileSync(f, 'utf8'));

// ── 1. páginas retiradas ──
const retired = new Set();
for (const vf of [path.join(REPO, 'vercel.json'), path.join(WEB, 'vercel.json')]) {
  if (!fs.existsSync(vf)) continue;
  for (const r of (JSON.parse(fs.readFileSync(vf, 'utf8')).redirects || [])) {
    const m = String(r.source || '').match(/^\/([A-Za-z0-9_\-/]+\.html)$/); if (m) retired.add(m[1]);
  }
}
const sitemap = text['sitemap.xml'] || '';
for (const p of retired) {
  if (pageSet.has(p)) errors.push(`página retirada que sigue existiendo: web/${p} (tiene redirección en vercel.json; bórrala)`);
  if (sitemap.includes('/' + p + '<')) errors.push(`página retirada que sigue en sitemap.xml: ${p}`);
  const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const attr = new RegExp(`(?:href|src|action)=["'](?:\\./|/)?${esc}(?:[?#"'])`);
  const lit = new RegExp(`["'\`](?:\\./|/)?${esc}(?:[?#"'\`])`);
  for (const [f, t] of Object.entries(text)) {
    if (f === 'sitemap.xml') continue;
    if ((f.endsWith('.html') && attr.test(t)) || lit.test(t)) errors.push(`${f}: enlaza a la página retirada ${p} (apunta a su reemplazo)`);
  }
}

// ── 1b. lo que se sale de web/: generadores, scripts y Edge Functions también mandan usuarios a páginas (p. ej. el prompt del Booth
//    Assistant o el generador de perfiles de DJ). Mención suelta (sin comillas) cuenta como enlace. ──
const EXTRA_DIRS = ['tools', 'scripts', path.join('supabase', 'functions')];
const walkExtra = (d, out = []) => {
  if (!fs.existsSync(d)) return out;
  for (const f of fs.readdirSync(d)) {
    if (['node_modules', '.git', '.worktrees'].includes(f)) continue;
    const p = path.join(d, f); fs.statSync(p).isDirectory() ? walkExtra(p, out) : out.push(p);
  }
  return out;
};
const extraFiles = EXTRA_DIRS.flatMap((d) => walkExtra(path.join(REPO, d))).filter((f) => /\.(mjs|js|ts|sh|json|html|md)$/.test(f) && !/\.(test|spec)\./.test(f) && !/(sync|launchd)[^/]*\.log$/.test(f));
for (const p of retired) {
  const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const loose = new RegExp(`(^|[^A-Za-z0-9_-])/?${esc}(?![A-Za-z0-9_-])`);
  for (const f of extraFiles) {
    const t = stripComments(fs.readFileSync(f, 'utf8'));
    if (loose.test(t)) errors.push(`${path.relative(REPO, f)}: menciona la página retirada ${p} (apunta a su reemplazo)`);
  }
}

// ── 2. páginas huérfanas ──
const mention = {};
for (const [f, t] of Object.entries(text)) {
  if (f === 'sitemap.xml') continue;
  const set = new Set();
  for (const p of pages) {
    const b = path.basename(p); if (b === path.basename(f)) continue;
    const re = new RegExp('(?:^|[^A-Za-z0-9_-])' + b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z0-9_-])');
    if (re.test(t)) set.add(p);
  }
  mention[f] = set;
}
const scriptRe = /<script[^>]+src=["']([^"'?#]+)/g;
function edges(f) {
  const out = new Set(mention[f] || []);
  if (f.endsWith('.html')) { let m; scriptRe.lastIndex = 0; while ((m = scriptRe.exec(text[f]))) { const s = m[1].replace(/^\.?\//, '').replace(/^\//, ''); if (mention[s]) mention[s].forEach((x) => out.add(x)); } }
  return out;
}
const roots = ['index.html', 'staff.html', 'client-portal.html', 'dj-dashboard.html', 'dj-profile.html', 'account-settings.html', 'login.html', 'admin-dashboard.html', 'client-account.html', 'contact.html'].filter((r) => pageSet.has(r));
// (el sitemap NO cuenta como entrada: una página solo listada en el sitemap pero sin enlace en el sitio es justo lo que parece una regresión)
const seen = new Set(roots); const queue = [...roots];
while (queue.length) { const f = queue.pop(); for (const n of edges(f)) if (!seen.has(n)) { seen.add(n); queue.push(n); } }
for (const p of pages.sort()) {
  if (seen.has(p) || ALLOW[p] || Object.keys(ALLOW_PREFIX).some((x) => p.startsWith(x))) continue;
  errors.push(`página huérfana (no la alcanza el menú, el inicio ni los portales; estar en el sitemap no basta): web/${p} — bórrala o decláramela en ALLOW con su razón`);
}

if (errors.length) { console.log('ERRORES DE HIGIENE (' + errors.length + '):\n' + errors.join('\n')); process.exit(1); }
console.log('OK: sin páginas retiradas, sin páginas huérfanas. Retiradas vigiladas: ' + ([...retired].join(', ') || '(ninguna)') + '.');
