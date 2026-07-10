/**
 * Node ESM resolve hook for @mdj/* aliases + .ts extension resolution.
 * TICKET-V2-BOOTSTRAP-RUNTIME-P0-001
 */
import { existsSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const rootDir = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');

const aliasMap = {
  '@mdj/shared/config': resolvePath(rootDir, 'shared/config/runtime/index.ts'),
  '@mdj/shared/events': resolvePath(rootDir, 'shared/events/runtime/index.ts'),
  '@mdj/shared/logging': resolvePath(rootDir, 'shared/logging/runtime/index.ts'),
  '@mdj/shared/errors': resolvePath(rootDir, 'shared/errors/runtime/index.ts'),
  '@mdj/shared/session': resolvePath(rootDir, 'shared/session/runtime/index.ts'),
  '@mdj/shared/theme': resolvePath(rootDir, 'shared/theme/runtime/index.ts'),
  '@mdj/bootstrap': resolvePath(rootDir, 'bootstrap/index.ts'),
  '@mdj/bootstrap/boot': resolvePath(rootDir, 'bootstrap/boot.ts'),
  '@mdj/shared': resolvePath(rootDir, 'shared/runtime/index.ts'),
  '@mdj/shared/index': resolvePath(rootDir, 'shared/runtime/index.ts'),
};

export async function resolve(specifier, context, nextResolve) {
  const mapped = aliasMap[specifier];
  if (mapped) {
    return {
      url: pathToFileURL(mapped).href,
      shortCircuit: true,
    };
  }

  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ERR_UNSUPPORTED_DIR_IMPORT' &&
      typeof error.url === 'string'
    ) {
      const indexCandidate = resolvePath(fileURLToPath(error.url), 'index.ts');
      if (existsSync(indexCandidate)) {
        return {
          url: pathToFileURL(indexCandidate).href,
          shortCircuit: true,
        };
      }
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ERR_MODULE_NOT_FOUND' &&
      !specifier.endsWith('.ts') &&
      !specifier.endsWith('.js')
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    throw error;
  }
}
