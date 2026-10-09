#!/usr/bin/env node
// Prepara un video crudo para la cinta de testimonios de events.html y genera su entrada de la lista (reels-manifest.json).
//
// Uso (desde la raíz del repo):
//   node web/scripts/preparar-reel.mjs "<video>" --titulo-es "Revelación Gia" --titulo-en "Gia's Gender Reveal" \
//        --sub-es "Revelación de género" --sub-en "Gender reveal" [--nombre Revelacion_Gia] [--inicio 5.5] [--fin 28] \
//        [--fondo recorte|desenfoque] [--salida ~/Desktop/reels-listos] [--primero]
//
// Qué hace (cada paso nació de un defecto real que ya vimos en los reels):
//   1. HDR de iPhone (HLG, 10 bits) → color normal (SDR). Con HDR sin convertir se ve lavado o no reproduce en muchos navegadores. Usa avconvert (macOS).
//   2. Proporción: aplica el SAR (píxeles no cuadrados). Fashion Show venía vertical pero guardado «aplastado» en 1320x1080 y el navegador lo estiraba.
//   3. Tramos negros de 2 s o más: los quita (Fashion Show tenía 136 s de pantalla negra).
//   4. Deja el video en 720x1280 vertical (llenando el cuadro, sin franjas; con --fondo desenfoque deja el cuadro entero sobre fondo desenfocado),
//      30 fps, SIN audio (los reels van mudos), H.264, con faststart. Intenta que pese menos de 6 MB.
//   5. Genera reels-manifest.json (la lista de la cinta): parte de la lista EN VIVO del Storage y le agrega este video.
//
// Resultado en --salida (por defecto ~/Desktop/reels-listos): <nombre>.mp4 y reels-manifest.json.
// Luego el PO sube LOS DOS a Supabase → Storage → assets → eventos-venues-patrocinadores → reels (el manifiesto reemplaza al anterior). Sin PR.
//
// Requiere ffmpeg y ffprobe (brew install ffmpeg). Para HDR, macOS con avconvert (viene con el sistema).

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, basename, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CARPETA_REELS = 'web/assets/eventos-venues-patrocinadores/reels';
const MANIFIESTO_REPO = join(RAIZ, CARPETA_REELS, 'reels-manifest.json');
const MANIFIESTO_VIVO = 'https://hkuvuqupbxwkiykxvqdr.supabase.co/storage/v1/object/public/assets/eventos-venues-patrocinadores/reels/reels-manifest.json';
const MAX_MB = 6;
const MAX_SEG = 25;
const ANCHO = 720;
const ALTO = 1280;

// ── argumentos ───────────────────────────────────────────
const args = process.argv.slice(2);
const opt = {};
let entrada = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--primero') { opt.primero = true; continue; }
  if (a.startsWith('--')) { opt[a.slice(2)] = args[++i]; continue; }
  if (!entrada) entrada = a;
}
const salir = (msg) => { console.error('✖ ' + msg); process.exit(1); };
const tilde = (p) => (p && p.startsWith('~') ? join(homedir(), p.slice(1)) : p);

if (!entrada) salir('Falta el video. Uso: node web/scripts/preparar-reel.mjs "<video>" --titulo-es "…" --titulo-en "…" --sub-es "…" --sub-en "…"');
entrada = resolve(tilde(entrada));
if (!existsSync(entrada)) salir('No existe el archivo: ' + entrada);
for (const bin of ['ffmpeg', 'ffprobe']) {
  if (spawnSync(bin, ['-version']).status !== 0) salir(`No encuentro ${bin}. Instálalo con: brew install ffmpeg`);
}

const fondo = opt.fondo || 'recorte';
if (!['recorte', 'desenfoque'].includes(fondo)) salir('--fondo debe ser «recorte» o «desenfoque».');
const inicio = opt.inicio !== undefined ? Number(opt.inicio) : 0;
const fin = opt.fin !== undefined ? Number(opt.fin) : null;
if (Number.isNaN(inicio) || (fin !== null && Number.isNaN(fin))) salir('--inicio y --fin son segundos (por ejemplo 5.5).');

const sinAcentos = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
const nombreBase = sinAcentos(opt.nombre || basename(entrada, extname(entrada)))
  .replace(/\.mp4$/i, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
if (!nombreBase) salir('No pude armar un nombre de archivo; usa --nombre.');
const archivoFinal = nombreBase + '.mp4';
const carpetaSalida = resolve(tilde(opt.salida || join(homedir(), 'Desktop', 'reels-listos')));
mkdirSync(carpetaSalida, { recursive: true });
const rutaFinal = join(carpetaSalida, archivoFinal);
if (resolve(rutaFinal) === entrada) salir('El archivo de salida sería el mismo que el de entrada; usa --nombre.');

const temp = mkdtempSync(join(tmpdir(), 'preparar-reel-'));
const limpiar = () => rmSync(temp, { recursive: true, force: true });
process.on('exit', limpiar);

const ejecutar = (cmd, a, conSalida = false) => {
  const r = spawnSync(cmd, a, { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0 && !conSalida) salir(`${cmd} falló:\n${(r.stderr || '').split('\n').slice(-12).join('\n')}`);
  return r;
};
const sonda = (f) => JSON.parse(ejecutar('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', f]).stdout);
const mb = (f) => statSync(f).size / 1048576;

// ── 1. sonda del original ─────────────────────────────────
const info = sonda(entrada);
const v = info.streams.find((s) => s.codec_type === 'video');
if (!v) salir('El archivo no tiene video.');
const duracion = Number(info.format.duration);
const sar = v.sample_aspect_ratio && v.sample_aspect_ratio !== 'N/A' && v.sample_aspect_ratio !== '0:1' ? v.sample_aspect_ratio : '1:1';
const hdr = ['arib-std-b67', 'smpte2084'].includes(v.color_transfer);
console.log(`▶ ${basename(entrada)}: ${v.width}x${v.height}, ${duracion.toFixed(1)} s, ${mb(entrada).toFixed(1)} MB, códec ${v.codec_name}${hdr ? ', HDR (' + v.color_transfer + ')' : ''}, SAR ${sar}`);

// ── 2. HDR → SDR ─────────────────────────────────────────
let fuente = entrada;
if (hdr) {
  if (process.platform === 'darwin' && spawnSync('which', ['avconvert']).status === 0) {
    const sdr = join(temp, 'sdr.mp4');
    console.log('… HDR detectado: convirtiendo a color normal (avconvert)');
    ejecutar('avconvert', ['-s', entrada, '-p', 'Preset1920x1080', '-o', sdr, '--replace']);
    fuente = sdr;
  } else {
    console.warn('⚠ HDR detectado y no hay avconvert (solo macOS): el video puede verse lavado. Conviértelo antes a SDR.');
  }
}

// ── 3. tramos negros ─────────────────────────────────────
const dFuente = Number(sonda(fuente).format.duration);
const rn = ejecutar('ffmpeg', ['-hide_banner', '-i', fuente, '-vf', 'blackdetect=d=2:pix_th=0.05', '-an', '-f', 'null', '-'], true);
const negros = [...(rn.stderr || '').matchAll(/black_start:([\d.]+)\s+black_end:([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
const desde = Math.max(0, inicio);
const hasta = Math.min(dFuente, fin ?? dFuente);
if (hasta - desde < 1) salir('El tramo pedido dura menos de 1 s. Revisa --inicio y --fin.');
let tramos = [[desde, hasta]];
for (const [bs, be] of negros) {
  tramos = tramos.flatMap(([a, b]) => {
    if (be <= a || bs >= b) return [[a, b]];
    const r = [];
    if (bs > a) r.push([a, bs]);
    if (be < b) r.push([be, b]);
    return r;
  });
}
tramos = tramos.filter(([a, b]) => b - a >= 0.5);
if (!tramos.length) salir('Todo el tramo elegido es pantalla negra.');
if (negros.length) {
  const quitado = negros.reduce((t, [a, b]) => t + (b - a), 0);
  console.log(`… pantalla negra detectada y quitada: ${negros.map(([a, b]) => `${a.toFixed(1)}–${b.toFixed(1)} s`).join(', ')} (${quitado.toFixed(0)} s)`);
}

// ── 4. filtro y compresión ───────────────────────────────
const n = tramos.length;
const partes = [];
if (n === 1) {
  partes.push(`[0:v]trim=start=${tramos[0][0]}:end=${tramos[0][1]},setpts=PTS-STARTPTS[c]`);
} else {
  partes.push(`[0:v]split=${n}${tramos.map((_, i) => `[s${i}]`).join('')}`);
  tramos.forEach(([a, b], i) => partes.push(`[s${i}]trim=start=${a}:end=${b},setpts=PTS-STARTPTS[t${i}]`));
  partes.push(`${tramos.map((_, i) => `[t${i}]`).join('')}concat=n=${n}:v=1:a=0[c]`);
}
const comun = `[c]fps=30,scale='trunc(iw*sar/2)*2':ih,setsar=1`;
if (fondo === 'recorte') {
  partes.push(`${comun},scale=${ANCHO}:${ALTO}:force_original_aspect_ratio=increase:flags=lanczos,crop=${ANCHO}:${ALTO},setsar=1,format=yuv420p[v]`);
} else {
  partes.push(`${comun},split[x][y]`);
  partes.push(`[x]scale=${ANCHO}:${ALTO}:force_original_aspect_ratio=increase,crop=${ANCHO}:${ALTO},boxblur=28:3,eq=brightness=-0.10[bg]`);
  partes.push(`[y]scale=${ANCHO}:${ALTO}:force_original_aspect_ratio=decrease:flags=lanczos[fg]`);
  partes.push(`[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,format=yuv420p[v]`);
}
const filtro = partes.join(';');

let crf = opt.crf ? Number(opt.crf) : 29;
let intento = 0;
const salidaTemp = join(temp, 'salida.mp4');
for (;;) {
  intento++;
  console.log(`… comprimiendo (CRF ${crf})`);
  ejecutar('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', fuente, '-filter_complex', filtro, '-map', '[v]', '-an',
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', String(crf), '-maxrate', '1400k', '-bufsize', '2800k',
    '-r', '30', '-movflags', '+faststart', '-metadata', 'title=', salidaTemp]);
  if (mb(salidaTemp) <= MAX_MB || crf >= 36 || opt.crf) break;
  crf += 2;
}
ejecutar('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', salidaTemp, '-c', 'copy', '-movflags', '+faststart', rutaFinal]);

// ── 5. verificación del resultado ────────────────────────
const so = sonda(rutaFinal);
const vo = so.streams.find((s) => s.codec_type === 'video');
const dur = Number(so.format.duration);
const pesoMb = mb(rutaFinal);
const rv = ejecutar('ffmpeg', ['-hide_banner', '-i', rutaFinal, '-vf', 'blackdetect=d=1.5:pix_th=0.05', '-an', '-f', 'null', '-'], true);
const negroRestante = /black_start/.test(rv.stderr || '');
const sarOk = !vo.sample_aspect_ratio || ['N/A', '1:1'].includes(vo.sample_aspect_ratio) || Math.abs(eval(vo.sample_aspect_ratio.replace(':', '/')) - 1) < 0.005;
console.log('');
console.log(`✔ ${archivoFinal}: ${vo.width}x${vo.height}, ${dur.toFixed(1)} s, ${pesoMb.toFixed(1)} MB, sin audio: ${so.streams.every((s) => s.codec_type !== 'audio') ? 'sí' : 'NO'}`);
const avisos = [];
if (vo.width !== ANCHO || vo.height !== ALTO) avisos.push(`Tamaño inesperado ${vo.width}x${vo.height}.`);
if (!sarOk) avisos.push(`Proporción de píxeles rara (SAR ${vo.sample_aspect_ratio}): el navegador podría estirarlo.`);
if (negroRestante) avisos.push('Todavía hay tramos negros de más de 1.5 s: usa --inicio/--fin para cortarlos.');
if (pesoMb > MAX_MB) avisos.push(`Pesa ${pesoMb.toFixed(1)} MB (ideal < ${MAX_MB} MB): acórtalo con --fin o --inicio.`);
if (dur > MAX_SEG) avisos.push(`Dura ${dur.toFixed(0)} s (ideal < ${MAX_SEG} s en una tarjeta): considera --fin.`);
avisos.forEach((a) => console.warn('⚠ ' + a));

// ── 6. lista (manifest) ──────────────────────────────────
const vacio = (t) => !t || !String(t).trim();
if (vacio(opt['titulo-es']) && vacio(opt['titulo-en'])) {
  console.warn('⚠ No diste --titulo-es / --titulo-en: uso el nombre del archivo. Corrígelo en la lista.');
}
const titulo = (opt['titulo-es'] || opt['titulo-en'] || nombreBase.replace(/_/g, ' ')).trim();
const entradaLista = {
  file: archivoFinal,
  title: { es: (opt['titulo-es'] || opt['titulo-en'] || titulo).trim(), en: (opt['titulo-en'] || opt['titulo-es'] || titulo).trim() },
  subtitle: { es: (opt['sub-es'] || opt['sub-en'] || '').trim(), en: (opt['sub-en'] || opt['sub-es'] || '').trim() },
};

let base = null;
let origenBase = '';
try {
  const r = await fetch(MANIFIESTO_VIVO, { cache: 'no-store' });
  if (r.ok) { base = await r.json(); origenBase = 'la lista en vivo del Storage'; }
} catch { /* sin red: se usa la copia del repo */ }
if (!base && existsSync(MANIFIESTO_REPO)) { base = JSON.parse(readFileSync(MANIFIESTO_REPO, 'utf8')); origenBase = 'la copia del repo'; }
if (!base || !Array.isArray(base.reels)) base = { version: 1, reels: [] };
const previo = base.reels.findIndex((e) => e.file === archivoFinal);
if (previo >= 0) {
  base.reels[previo] = entradaLista;
  console.warn(`⚠ ${archivoFinal} ya estaba en la lista: se reemplazó su entrada. Si ya existe en Storage, usa otro nombre (--nombre …_v2) para que la caché no sirva el viejo.`);
} else if (opt.primero) {
  base.reels.unshift(entradaLista);
} else {
  base.reels.push(entradaLista);
}
const rutaLista = join(carpetaSalida, 'reels-manifest.json');
writeFileSync(rutaLista, JSON.stringify(base, null, 2) + '\n');
console.log(`✔ reels-manifest.json: ${base.reels.length} videos (partió de ${origenBase || 'una lista vacía'}; este queda ${opt.primero ? 'primero' : 'al final'}).`);

console.log(`
Siguiente paso (lo haces tú, sin PR):
  1. Mira ${rutaFinal} en QuickTime.
  2. Supabase → Storage → assets → eventos-venues-patrocinadores → reels → sube LOS DOS:
       • ${archivoFinal}
       • reels-manifest.json   (reemplaza al anterior)
  3. Recarga events.html: la tarjeta aparece sola.`);
