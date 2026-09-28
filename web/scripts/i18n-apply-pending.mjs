#!/usr/bin/env node
/* i18n-apply-pending.mjs — Pieza 2 del ticket de auto-traducción con IA
 * (docs/tickets/2026-09-27-auto-traduccion-ia-bio-y-ui.md).
 *
 * Mueve claves YA REVISADAS por un humano de web/translations.pending.json
 * (propuestas por i18n-translate-missing.mjs) a web/translations.js. Nunca
 * corre sola ni se dispara automáticamente — siempre necesita que alguien
 * pase --keys explícito (o --all, para aceptar todo el archivo de golpe,
 * uso previsto solo cuando un humano ya revisó cada línea a mano).
 *
 * No comitea ni hace push por su cuenta (regla #1 de CLAUDE.md: cero PRs
 * automáticos) — solo escribe los 2 archivos locales; el commit lo hace
 * quien corre el script.
 *
 * Uso:
 *   node web/scripts/i18n-apply-pending.mjs --keys clave1,clave2
 *   node web/scripts/i18n-apply-pending.mjs --all
 *   node web/scripts/i18n-apply-pending.mjs --list          (solo muestra lo pendiente, no escribe nada)
 *
 * Serializa cada valor con JSON.stringify — sintaxis JS válida garantizada
 * por construcción sin importar comillas/HTML dentro del texto (evita la
 * trampa ya documentada en memoria feedback_translations_js_quote_escaping_gotcha
 * de raíz, en vez de recordar hacerlo bien cada vez a mano).
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRANSLATIONS_PATH = path.join(WEB, 'translations.js');
const PENDING_PATH = path.join(WEB, 'translations.pending.json');

const args = process.argv.slice(2);
const listOnly = args.includes('--list');
const applyAll = args.includes('--all');
const keysArg = args.find((a) => a.startsWith('--keys='));
const requestedKeys = keysArg ? keysArg.slice('--keys='.length).split(',').map((s) => s.trim()).filter(Boolean) : null;

function loadPending() {
  if (!fs.existsSync(PENDING_PATH)) return {};
  return JSON.parse(fs.readFileSync(PENDING_PATH, 'utf8'));
}

function insertBeforeClosingBrace(lines, closingLineIndex, key, value) {
  const indent = '        '; // 8 espacios — mismo indentado que el resto de las claves del archivo.
  const serialized = `${indent}${JSON.stringify(key)}: ${JSON.stringify(value)},`;
  // La última propiedad real de cada bloque (es/en) no lleva coma final
  // (JS válido, pero rompe si se inserta algo después sin agregarla) — se
  // repara la línea anterior ANTES de insertar la nueva, no se asume nunca
  // que ya la tiene.
  const prevIdx = closingLineIndex - 1;
  const prevLine = lines[prevIdx];
  if (prevIdx >= 0 && prevLine !== undefined && /[^,{\s]\s*$/.test(prevLine)) {
    lines[prevIdx] = prevLine.replace(/\s*$/, '') + ',';
  }
  lines.splice(closingLineIndex, 0, serialized);
  return closingLineIndex + 1; // nuevo índice de la línea de cierre, para la próxima inserción en el mismo bloque.
}

function findBlockBounds(lines) {
  // Localiza las líneas exactas "    es: {" / "    },"(cierre de es) / "    en: {" / "    }"(cierre de en, última propiedad, sin coma).
  const esOpen = lines.findIndex((l) => l === '    es: {');
  if (esOpen === -1) throw new Error('No se encontró "    es: {" en translations.js — estructura inesperada, no se toca nada.');
  let esClose = -1;
  for (let i = esOpen + 1; i < lines.length; i++) {
    if (lines[i] === '    },') { esClose = i; break; }
  }
  if (esClose === -1) throw new Error('No se encontró el cierre de "es" ("    },") — estructura inesperada.');
  const enOpen = lines.findIndex((l, i) => i > esClose && l === '    en: {');
  if (enOpen === -1) throw new Error('No se encontró "    en: {" tras el cierre de "es" — estructura inesperada.');
  let enClose = -1;
  for (let i = enOpen + 1; i < lines.length; i++) {
    if (lines[i] === '    }') { enClose = i; break; }
  }
  if (enClose === -1) throw new Error('No se encontró el cierre de "en" ("    }") — estructura inesperada.');
  return { esClose, enClose };
}

function main() {
  const pending = loadPending();
  const keys = Object.keys(pending);

  if (listOnly || (!applyAll && !requestedKeys)) {
    if (!keys.length) { console.log('translations.pending.json está vacío — nada pendiente de revisar.'); return; }
    console.log(`${keys.length} propuesta(s) pendiente(s):\n`);
    for (const k of keys) {
      const p = pending[k];
      console.log(`  [${k}] falta en "${p.missing_in}"\n    fuente (${p.source_lang}): ${p.source_text}\n    propuesta: ${p.proposed_text}\n`);
    }
    console.log('Para aplicar: node web/scripts/i18n-apply-pending.mjs --keys=' + keys.slice(0, 3).join(',') + (keys.length > 3 ? ',...' : '') + '  (o --all)');
    return;
  }

  const toApply = applyAll ? keys : requestedKeys.filter((k) => {
    if (!(k in pending)) { console.warn(`[aviso] "${k}" no está en translations.pending.json — se ignora.`); return false; }
    return true;
  });
  if (!toApply.length) { console.log('Nada que aplicar.'); return; }

  const src = fs.readFileSync(TRANSLATIONS_PATH, 'utf8');
  const lines = src.split('\n');
  let { esClose, enClose } = findBlockBounds(lines);

  let appliedEs = 0, appliedEn = 0;
  for (const k of toApply) {
    const p = pending[k];
    if (p.missing_in === 'en') {
      enClose = insertBeforeClosingBrace(lines, enClose, k, p.proposed_text);
      appliedEn++;
    } else if (p.missing_in === 'es') {
      esClose = insertBeforeClosingBrace(lines, esClose, k, p.proposed_text);
      // insertar en es corre ANTES del bloque en en el archivo — desplaza
      // enClose hacia abajo en 1 línea por cada inserción en es.
      enClose++;
      appliedEs++;
    } else {
      console.warn(`[aviso] "${k}" tiene missing_in="${p.missing_in}" inesperado — se ignora.`);
      continue;
    }
    delete pending[k];
  }

  fs.writeFileSync(TRANSLATIONS_PATH, lines.join('\n'));
  fs.writeFileSync(PENDING_PATH, JSON.stringify(pending, null, 2) + '\n');

  // Auto-verificación — si esto falla, el propio Node revienta con el error
  // real de sintaxis antes de que nadie comitee nada roto.
  execFileSync(process.execPath, ['--check', TRANSLATIONS_PATH], { stdio: 'inherit' });

  console.log(`\nAplicadas ${appliedEs + appliedEn} clave(s) (${appliedEs} a es, ${appliedEn} a en). node --check: OK. Quedan ${Object.keys(pending).length} pendiente(s) en translations.pending.json.`);
  console.log('Nada se comiteó — revisa el diff (`git diff web/translations.js`) y comitea tú mismo cuando estés conforme.');
}

main();
