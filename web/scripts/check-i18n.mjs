#!/usr/bin/env node
/* Chequeo del sistema bilingüe (PO 2026-09-27). Uso, desde la raíz del repo:  node web/scripts/check-i18n.mjs
 * ERRORES (salida 1): claves con distinto valor duplicadas · claves solo en un idioma · texto claramente inglés dentro del bloque es ·
 *   páginas con i18n.js sin js/mdj-lang-boot.js · atributo <html lang> que contradice el texto de la página · claves data-i18n que no existen.
 * AVISOS (no fallan): páginas con mucho texto sin data-i18n (no cambian con la perilla ES/EN). */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(WEB, 'translations.js'), 'utf8');
const ctx = {}; vm.createContext(ctx); vm.runInContext(src + ';this.T=translations;', ctx);
const T = ctx.T;
const errors = [], warns = [];

// 1) paridad de claves
for (const k of Object.keys(T.es)) if (!(k in T.en)) errors.push(`clave solo en es: ${k}`);
for (const k of Object.keys(T.en)) if (!(k in T.es)) errors.push(`clave solo en en: ${k}`);

// 2) duplicadas con valores distintos (la última gana en silencio)
{
  let cur = '', seen = { es: {}, en: {} };
  for (const l of src.split('\n')) {
    if (/^    es: \{/.test(l)) cur = 'es'; else if (/^    en: \{/.test(l)) cur = 'en';
    const m = l.match(/^\s{8}"([^"]+)":\s*(.*?),?\s*$/);
    if (m && cur) { if (m[1] in seen[cur] && seen[cur][m[1]] !== m[2]) errors.push(`clave duplicada con valores distintos (${cur}): ${m[1]}`); seen[cur][m[1]] = m[2]; }
  }
}

// 3) inglés dentro del bloque español
for (const k of Object.keys(T.es)) {
  const v = T.es[k];
  if (typeof v === 'string' && k in T.en && v === T.en[k] && /\b(the|and|your|our|with|from|for|to|of|in)\b/i.test(v) && /[a-z]{3}/.test(v)) errors.push(`texto en inglés en es: ${k} = ${v.slice(0, 60)}`);
}

// 4) páginas
function walk(d, out = []) { for (const f of fs.readdirSync(d)) { if (['node_modules', 'vendor', 'assets', 'installers', 'downloads'].includes(f)) continue; const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p, out) : f.endsWith('.html') && out.push(p); } return out; }
const EN = /\b(the|and|for|with|your|our|from|you|to|of|in|is|are|we|it|on|at|by)\b/gi, ES = /\b(el|la|los|las|y|para|con|tu|tus|nuestro|nuestra|de|del|en|es|un|una|que|por|su|sus|al|se)\b/gi;
for (const f of walk(WEB)) {
  const h = fs.readFileSync(f, 'utf8'); const rel = path.relative(WEB, f);
  if (!/i18n\.js/.test(h) || !/<html/i.test(h)) continue;
  if (!/mdj-lang-boot\.js/.test(h)) errors.push(`${rel}: falta js/mdj-lang-boot.js en el <head>`);
  const attr = ((h.match(/<html[^>]*lang=["']([^"']+)["']/i) || [])[1]) || null;
  const body = h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<header[\s\S]*?<\/header>/g, ' ').replace(/<footer[\s\S]*?<\/footer>/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').slice(0, 20000);
  const e = (body.match(EN) || []).length, s = (body.match(ES) || []).length;
  const det = (e + s < 8) ? '?' : (e > s * 1.25 ? 'en' : s > e * 1.25 ? 'es' : 'mixto');
  if ((det === 'en' || det === 'es') && attr !== det) errors.push(`${rel}: <html lang="${attr}"> pero el texto está en ${det}`);
  // claves data-i18n que no existen en el diccionario (se ignoran ganchos vacíos llenados por JS, comentarios, CSS y plantillas con + o ')
  const elRe = /<([a-z0-9]+)([^>]*?)\sdata-i18n(?:-hold|-aria|-title)?="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>|<([a-z0-9]+)([^>]*?)\sdata-i18n(?:-hold|-aria|-title)="([^"]+)"([^>]*)\/?>/gi;
  const noComments = h.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ');
  let em; const missing = new Set();
  while ((em = elRe.exec(noComments))) {
    const k = em[3] || em[8]; if (!k || /['+]/.test(k) || (k in T.es && k in T.en)) continue;
    const attrs = (em[2] || em[7] || '') + (em[4] || em[9] || '');
    const inner = (em[5] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const hasText = /[A-Za-zÁÉÍÓÚáéíóúñÑ]{3,}/.test(inner) || /(placeholder|aria-label|title)="[^"]*[A-Za-z]{3,}/.test(attrs);
    if (hasText) missing.add(k);
  }
  for (const k of missing) errors.push(`${rel}: la clave data-i18n "${k}" no existe en ${!(k in T.es) ? 'es' : 'en'}`);
  // texto visible sin data-i18n (aviso)
  const noKey = h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<header[\s\S]*?<\/header>/g, ' ').replace(/<footer[\s\S]*?<\/footer>/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<([a-z0-9]+)[^>]*data-i18n[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ');
  const words = (noKey.match(/[A-Za-zÁÉÍÓÚáéíóúñÑ]{4,}/g) || []).length;
  if (words > 60) warns.push(`${rel}: ~${words} palabras sin data-i18n (no cambian con la perilla ES/EN)`);
}

if (warns.length) console.log('AVISOS (' + warns.length + '):\n' + warns.sort().join('\n') + '\n');
if (errors.length) { console.log('ERRORES (' + errors.length + '):\n' + errors.join('\n')); process.exit(1); }
console.log('OK: sin errores de bilingüismo estructurales.');
