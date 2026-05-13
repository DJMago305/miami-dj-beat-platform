/**
 * Regenera reels-manifest.json cada vez que cambia algo en reels/ (añadir, borrar o renombrar .mp4).
 * Uso desde web/: npm run reels:watch
 * Deja este proceso corriendo mientras desarrollas; recarga el navegador para ver la cola nueva.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.join(__dirname, '..');
const REELS_DIR = path.join(WEB_ROOT, 'assets/eventos-venues-patrocinadores/reels');
const GENERATOR = path.join(__dirname, 'generate-reels-manifest.mjs');

function runManifest() {
  var proc = spawn(process.execPath, [GENERATOR], {
    cwd: WEB_ROOT,
    stdio: 'inherit',
    env: process.env
  });
  proc.on('error', function (err) {
    console.error('[reels:watch]', err.message);
  });
}

function debounce(fn, ms) {
  var t = null;
  return function () {
    clearTimeout(t);
    t = setTimeout(fn, ms);
  };
}

fs.mkdirSync(REELS_DIR, { recursive: true });
console.log('[reels:watch] Generación inicial…');
runManifest();

var fire = debounce(function () {
  console.log('[reels:watch] Cambio en reels/ → regenerando manifiesto…');
  runManifest();
}, 450);

try {
  var watcher = fs.watch(REELS_DIR, { recursive: false }, function (evt, filename) {
    void evt;
    void filename;
    fire();
  });
  watcher.on('error', function (err) {
    console.error('[reels:watch] Error del watcher:', err && err.message ? err.message : err);
  });
} catch (e) {
  console.error('[reels:watch] No se pudo observar la carpeta:', e.message);
  process.exit(1);
}

console.log('[reels:watch] Observando:', REELS_DIR);
console.log('[reels:watch] Cada .mp4 nuevo entra en la cola (tras recargar la página). Ctrl+C para salir.');
