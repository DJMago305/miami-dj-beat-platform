#!/usr/bin/env node
/* i18n-translate-missing.mjs — Pieza 2 del ticket de auto-traducción con IA
 * (docs/tickets/2026-09-27-auto-traduccion-ia-bio-y-ui.md).
 *
 * Regla obligatoria del ticket (mismo patrón que ELIXIS y la Pieza 1): el
 * modelo PROPONE, nunca publica directo. Este script NUNCA escribe en
 * web/translations.js — solo lee de ahí y escribe propuestas en
 * web/translations.pending.json, para que un humano las revise y las mueva
 * a mano (o con i18n-apply-pending.mjs) a translations.js.
 *
 * Alcance de esta pieza (2026-09-28): claves que existen en UN idioma y
 * faltan en el otro (el "hueco de paridad" que check-i18n.mjs ya detecta
 * como "clave solo en es"/"clave solo en en" — el caso real de esta sesión,
 * ej. PR de las 81 claves de club-dj/mc-dj/festival-dj). Claves usadas con
 * data-i18n que no existen en NINGÚN lado (texto nuevo escrito directo en
 * el HTML) quedan fuera de esta pieza — check-i18n.mjs ya las reporta por
 * separado, con el texto fuente inline en cada página, no en un solo lugar.
 *
 * Uso:
 *   ANTHROPIC_API_KEY=sk-... node web/scripts/i18n-translate-missing.mjs
 *   node web/scripts/i18n-translate-missing.mjs --dry-run   (sin llamar a la API, solo prueba el detector + el archivo de salida)
 *
 * Nunca corre sola en segundo plano ni se dispara automáticamente al hacer
 * push — es un paso manual (local o site-hygiene.yml con workflow_dispatch,
 * decisión aparte del PO: agregar el secret ANTHROPIC_API_KEY a GitHub
 * Actions no es algo que este script haga por su cuenta).
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRANSLATIONS_PATH = path.join(WEB, 'translations.js');
const PENDING_PATH = path.join(WEB, 'translations.pending.json');
const DRY_RUN = process.argv.includes('--dry-run');
const MODEL = 'claude-haiku-4-5-20251001';

// Nombres propios / marca que NUNCA se traducen (regla del ticket, tomada
// de lo ya aprendido a mano esta sesión — memorias
// feedback_never_invent_product_names / reference_brand_name /
// reference_djmago305_branding_authorized_use).
const PROPER_NOUNS = [
  'DJMago305', 'DJSolitario', 'DJYuyo', 'ELIXIS', 'FÉNIX', 'MDJPRO',
  'Serato', 'Rekordbox', 'Miami DJ Beat', 'Miami DJ Beat LLC', 'MDJB',
  'Baila Con Micho', 'Open Format',
];

function loadTranslations() {
  const src = fs.readFileSync(TRANSLATIONS_PATH, 'utf8');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(src + ';this.T=translations;', ctx);
  return ctx.T;
}

function findParityGaps(T) {
  const onlyEs = Object.keys(T.es).filter((k) => !(k in T.en));
  const onlyEn = Object.keys(T.en).filter((k) => !(k in T.es));
  return { onlyEs, onlyEn };
}

async function translateText(text, direction) {
  if (DRY_RUN) return `[DRY-RUN ${direction}] ${text}`;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY no está definida — no se hace ninguna llamada real sin ella. Usa --dry-run para probar sin API.');
  }
  const targetLang = direction === 'es->en' ? 'English' : 'Spanish';
  const system =
    `You translate short UI strings for a DJ booking platform (Miami DJ Beat) into ${targetLang}. ` +
    `Keep these proper nouns/brand terms EXACTLY as written, never translate or alter them: ${PROPER_NOUNS.join(', ')}. ` +
    `If the text contains HTML tags or attributes, preserve them exactly — translate only the visible text. ` +
    `Never invent new product names or feature names that are not already in the source text. ` +
    `Reply with ONLY the translated string, no preamble, no surrounding quotes.`;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 512, system, messages: [{ role: 'user', content: String(text) }] }),
  });
  if (!r.ok) throw new Error(`Anthropic error ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const blocks = Array.isArray(j.content) ? j.content : [];
  return blocks.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
}

async function main() {
  const T = loadTranslations();
  const { onlyEs, onlyEn } = findParityGaps(T);

  if (!onlyEs.length && !onlyEn.length) {
    console.log('OK: sin huecos de paridad (toda clave de un idioma existe en el otro) — nada que proponer.');
    return;
  }

  const pending = fs.existsSync(PENDING_PATH) ? JSON.parse(fs.readFileSync(PENDING_PATH, 'utf8')) : {};
  const generatedAt = new Date().toISOString();
  let added = 0;
  let skipped = 0;

  for (const k of onlyEs) {
    if (pending[k]) { skipped++; continue; }
    const proposed = await translateText(T.es[k], 'es->en');
    pending[k] = { missing_in: 'en', source_lang: 'es', source_text: T.es[k], proposed_text: proposed, generated_at: generatedAt, model: DRY_RUN ? 'dry-run' : MODEL };
    added++;
  }
  for (const k of onlyEn) {
    if (pending[k]) { skipped++; continue; }
    const proposed = await translateText(T.en[k], 'en->es');
    pending[k] = { missing_in: 'es', source_lang: 'en', source_text: T.en[k], proposed_text: proposed, generated_at: generatedAt, model: DRY_RUN ? 'dry-run' : MODEL };
    added++;
  }

  fs.writeFileSync(PENDING_PATH, JSON.stringify(pending, null, 2) + '\n');
  console.log(
    `Listo: ${added} propuesta(s) nueva(s), ${skipped} ya existían en ${path.relative(WEB, PENDING_PATH)}. ` +
    `NADA se escribió en translations.js — revisión humana requerida (ver i18n-apply-pending.mjs).`
  );
}

main().catch((e) => {
  console.error('[i18n-translate-missing] ' + e.message);
  process.exit(1);
});
