import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = dirname(fileURLToPath(import.meta.url));

/** TICKET-V2-RUNTIME-SCAFFOLD-001 — unit tests (scaffold only) */
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    passWithNoTests: false,
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
