import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

/** TICKET-V2-RUNTIME-SCAFFOLD-001 — lint scaffold (no business modules yet) */
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'eslint.config.js',
    ],
  },
  eslint.configs.recommended,
  {
    files: [
      'bootstrap/**/*.ts',
      'shared/runtime/**/*.ts',
      'shared/config/runtime/**/*.ts',
      'shared/events/runtime/**/*.ts',
      'shared/logging/runtime/**/*.ts',
      'shared/errors/runtime/**/*.ts',
      'shared/session/runtime/**/*.ts',
      'client/**/*.ts',
      'artist/**/*.ts',
      'staff/**/*.ts',
      'tests/**/*.ts',
    ],
    extends: [...tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['vite.config.ts', 'vitest.config.ts', 'playwright.config.ts'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
      },
    },
  },
);
