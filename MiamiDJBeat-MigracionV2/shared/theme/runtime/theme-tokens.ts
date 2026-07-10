/** MOD-007 Theme Manager — token application — TICKET-MOD-007-THEME-INTEGRATION-001 */

import type { ThemeTokenMap } from './types';

export function tokenKeyToCssVariable(tokenKey: string): string {
  return `--mdj-${tokenKey.replace(/\./g, '-')}`;
}

/** Applies registry tokens as CSS custom properties on :root — no layout or visual scaffold changes. */
export function applyThemeTokensToRoot(tokens: ThemeTokenMap): readonly string[] {
  const root = document.documentElement;
  const applied: string[] = [];

  for (const [key, value] of Object.entries(tokens)) {
    const cssVar = tokenKeyToCssVariable(key);
    root.style.setProperty(cssVar, value);
    applied.push(cssVar);
  }

  return Object.freeze(applied);
}
