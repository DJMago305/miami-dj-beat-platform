/** MOD-009 Components Foundation — theme token binding — TICKET-MOD-009-COMPONENTS-FOUNDATION-001 */

import { tokenKeyToCssVariable } from '../../theme/runtime/theme-tokens';
import type { ThemeTokenMap } from '../../theme/runtime/types';
import type { MdjThemeBinding } from './types';

const COMPONENT_THEME_TOKEN_KEYS = Object.freeze([
  'brand.gold.primary',
  'brand.gold.muted',
  'brand.bg.deep',
  'brand.glass.surface',
  'semantic.color.bg.primary',
  'semantic.color.text.primary',
  'semantic.color.accent',
  'semantic.color.border.subtle',
  'surface.base',
  'surface.elevated',
  'text.primary',
  'text.secondary',
  'border.default',
  'status.success',
  'status.warning',
  'status.error',
] as const);

export { COMPONENT_THEME_TOKEN_KEYS };

export type ComponentThemeTokenKey = (typeof COMPONENT_THEME_TOKEN_KEYS)[number];

export function createComponentThemeBinding(tokens: ThemeTokenMap): MdjThemeBinding {
  const binding: Record<string, string> = {};

  for (const key of COMPONENT_THEME_TOKEN_KEYS) {
    binding[tokenKeyToCssVariable(key)] = tokens[key] ?? '';
  }

  return Object.freeze(binding);
}

export function resolveComponentThemeBindingFromRegistry(
  tokens: ThemeTokenMap,
): MdjThemeBinding {
  if (Object.keys(tokens).length === 0) {
    throw new Error('ThemeTokenMap must not be empty for component theme binding');
  }

  return createComponentThemeBinding(tokens);
}
