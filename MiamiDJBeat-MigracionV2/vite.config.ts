import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const rootDir = dirname(fileURLToPath(import.meta.url));

/** TICKET-V2-RUNTIME-SCAFFOLD-001 — Vite 6 MPA (client · artist · staff) */
export default defineConfig({
  root: '.',
  envPrefix: 'MDJ_V2_',
  server: {
    port: 5173,
    strictPort: true,
    open: false,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        client: resolve(rootDir, 'client/index.html'),
        artist: resolve(rootDir, 'artist/index.html'),
        staff: resolve(rootDir, 'staff/index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@mdj/shared/config': resolve(rootDir, 'shared/config/runtime'),
      '@mdj/shared/events': resolve(rootDir, 'shared/events/runtime'),
      '@mdj/shared/logging': resolve(rootDir, 'shared/logging/runtime'),
      '@mdj/shared/errors': resolve(rootDir, 'shared/errors/runtime'),
      '@mdj/shared/session': resolve(rootDir, 'shared/session/runtime'),
      '@mdj/shared/theme': resolve(rootDir, 'shared/theme/runtime'),
      '@mdj/bootstrap': resolve(rootDir, 'bootstrap'),
      '@mdj/shared': resolve(rootDir, 'shared/runtime'),
    },
  },
});
