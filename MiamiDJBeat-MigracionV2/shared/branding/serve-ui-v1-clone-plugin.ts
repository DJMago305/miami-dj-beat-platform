/** V2 Priority 2 · Paso 1 — serve ui-v1-clone statics at /v1 (dev + preview). */

import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Connect, Plugin } from 'vite';

const MOUNT = '/v1';

function contentType(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.css')) return 'text/css; charset=utf-8';
  if (lower.endsWith('.js') || lower.endsWith('.mjs')) return 'application/javascript; charset=utf-8';
  if (lower.endsWith('.json')) return 'application/json; charset=utf-8';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.ico')) return 'image/x-icon';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.woff')) return 'font/woff';
  if (lower.endsWith('.woff2')) return 'font/woff2';
  if (lower.endsWith('.ttf')) return 'font/ttf';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html; charset=utf-8';
  return 'application/octet-stream';
}

function createV1StaticHandler(cloneRoot: string): Connect.NextHandleFunction {
  const root = path.resolve(cloneRoot);

  return (req, res, next) => {
    const rawUrl = req.url ?? '';
    if (!rawUrl.startsWith(`${MOUNT}/`) && rawUrl !== MOUNT) {
      next();
      return;
    }

    const urlPath = decodeURIComponent(rawUrl.split('?')[0] ?? '');
    const rel = urlPath.slice(MOUNT.length).replace(/^\/+/, '');
    if (!rel) {
      next();
      return;
    }

    const filePath = path.resolve(root, rel);
    const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
    if (filePath !== root && !filePath.startsWith(rootWithSep)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      next();
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType(filePath));
    res.setHeader('Cache-Control', 'no-cache');
    createReadStream(filePath).pipe(res);
  };
}

/**
 * Exposes `ui-v1-clone/` at `/v1/*` so logos, CSS url() assets, and images
 * resolve without duplicating the full 1.5GB tree into Vite's publicDir.
 */
export function serveUiV1ClonePlugin(cloneRoot: string): Plugin {
  const handler = createV1StaticHandler(cloneRoot);

  return {
    name: 'mdj-serve-ui-v1-clone',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}
