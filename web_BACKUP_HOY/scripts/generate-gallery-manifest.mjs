/**
 * Escanea assets/eventos-venues-patrocinadores/galeria/ y escribe gallery-manifest.json
 * con todos los archivos de imagen. Ejecutar tras añadir o quitar fotos en esa carpeta:
 *   npm run gallery:manifest
 *   (desde el directorio web/)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.join(__dirname, '..');
const GALERIA = path.join(WEB_ROOT, 'assets/eventos-venues-patrocinadores/galeria');
const OUT = path.join(WEB_ROOT, 'assets/eventos-venues-patrocinadores/gallery-manifest.json');

const EXT = /\.(jpe?g|png|webp|gif|avif)$/i;

let existing = {};
if (fs.existsSync(OUT)) {
  try {
    existing = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  } catch {
    /* noop */
  }
}

let files = [];
if (fs.existsSync(GALERIA)) {
  files = fs.readdirSync(GALERIA).filter(function (n) {
    if (!n || n.startsWith('.')) return false;
    return EXT.test(n);
  });
  files.sort(function (a, b) {
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });
}

const out = {
  intervalMs: typeof existing.intervalMs === 'number' ? existing.intervalMs : 6000,
  transitionMs: typeof existing.transitionMs === 'number' ? existing.transitionMs : 1000,
  images: files
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log('[gallery-manifest]', files.length, 'imagen(es) →', path.relative(WEB_ROOT, OUT));
