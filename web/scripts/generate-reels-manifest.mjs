/**
 * Lista los .mp4 en assets/eventos-venues-patrocinadores/reels/ y escribe reels-manifest.json
 * (para localhost cuando Storage no lista). Desde web/: npm run reels:manifest
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.join(__dirname, '..');
const REELS_DIR = path.join(WEB_ROOT, 'assets/eventos-venues-patrocinadores/reels');
const OUT = path.join(WEB_ROOT, 'assets/eventos-venues-patrocinadores/reels-manifest.json');

const EXT = /\.mp4$/i;

let files = [];
if (fs.existsSync(REELS_DIR)) {
  files = fs.readdirSync(REELS_DIR).filter(function (n) {
    if (!n || n.startsWith('.')) return false;
    return EXT.test(n);
  });
  files.sort(function (a, b) {
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });
}

const out = { files: files };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log('[reels-manifest]', files.length, 'reel(s) →', path.relative(WEB_ROOT, OUT));
