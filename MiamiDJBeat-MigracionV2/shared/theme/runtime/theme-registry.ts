/** MOD-007 Theme Manager — theme registry — TICKET-MOD-007-THEME-REGISTRY-001 */

import { ThemeError } from './errors';
import type { ThemeDefinition, ThemeId, ThemeMode, ThemeTokenMap } from './types';
import {
  DEFAULT_DARK_THEME_ID,
  DEFAULT_LIGHT_THEME_ID,
  THEME_ID_FORMAT,
  THEME_REGISTRY_VERSION,
} from './types';

type ThemeSeed = {
  readonly id: ThemeId;
  readonly mode: ThemeMode;
  readonly description: string;
  readonly tokens: Readonly<Record<string, string>>;
};

function freezeTokenMap(tokens: Readonly<Record<string, string>>): ThemeTokenMap {
  for (const [key, value] of Object.entries(tokens)) {
    if (value.trim().length === 0) {
      throw new ThemeError(
        'THEME_NOT_REGISTERED',
        `Theme token "${key}" must not be empty during registry build`,
      );
    }
  }

  return Object.freeze({ ...tokens });
}

function buildDarkGoldTokens(): Readonly<Record<string, string>> {
  return {
    'brand.gold.primary': '#C9A227',
    'brand.gold.muted': '#9A7B1C',
    'brand.bg.deep': '#0A0A0C',
    'brand.glass.blur': '12px',
    'brand.glass.surface': 'rgba(18, 18, 22, 0.72)',
    'brand.glow.gold': '0 0 24px rgba(201, 162, 39, 0.28)',
    'semantic.color.bg.primary': '#0A0A0C',
    'semantic.color.text.primary': '#F5F5F7',
    'semantic.color.accent': '#C9A227',
    'semantic.color.border.subtle': 'rgba(201, 162, 39, 0.22)',
    'surface.base': '#121216',
    'surface.elevated': 'rgba(24, 24, 30, 0.88)',
    'surface.overlay': 'rgba(0, 0, 0, 0.62)',
    'text.primary': '#F5F5F7',
    'text.secondary': '#B8B8C2',
    'text.on-accent': '#0A0A0C',
    'border.default': 'rgba(255, 255, 255, 0.12)',
    'border.focus': '#C9A227',
    'shadow.sm': '0 2px 8px rgba(0, 0, 0, 0.35)',
    'shadow.gold-glow': '0 0 20px rgba(201, 162, 39, 0.24)',
    'motion.duration.fast': '150ms',
    'motion.duration.normal': '250ms',
    'motion.duration.slow': '400ms',
    'motion.ease.standard': 'cubic-bezier(0.4, 0, 0.2, 1)',
    'motion.reduce.enabled': '0',
    'spacing.xs': '0.25rem',
    'spacing.sm': '0.5rem',
    'spacing.md': '1rem',
    'spacing.lg': '1.5rem',
    'spacing.xl': '2rem',
    'radius.sm': '0.375rem',
    'radius.md': '0.625rem',
    'radius.lg': '1rem',
    'radius.full': '9999px',
    'z-index.dropdown': '1000',
    'z-index.modal': '1200',
    'z-index.overlay': '1100',
    'status.success': '#2ECC71',
    'status.warning': '#F1C40F',
    'status.error': '#E74C3C',
    'status.info': '#3498DB',
    'portal.client.accent': '#C9A227',
    'portal.artist.accent': '#C9A227',
    'portal.staff.accent': '#C9A227',
  };
}

function buildHighContrastTokens(): Readonly<Record<string, string>> {
  return {
    ...buildDarkGoldTokens(),
    'brand.gold.primary': '#E0C040',
    'brand.gold.muted': '#B8941F',
    'brand.bg.deep': '#000000',
    'brand.glass.surface': 'rgba(0, 0, 0, 0.92)',
    'semantic.color.bg.primary': '#000000',
    'semantic.color.text.primary': '#FFFFFF',
    'semantic.color.accent': '#E0C040',
    'semantic.color.border.subtle': 'rgba(224, 192, 64, 0.45)',
    'surface.base': '#000000',
    'surface.elevated': '#111111',
    'surface.overlay': 'rgba(0, 0, 0, 0.78)',
    'text.primary': '#FFFFFF',
    'text.secondary': '#E6E6E6',
    'text.on-accent': '#000000',
    'border.default': 'rgba(255, 255, 255, 0.28)',
    'border.focus': '#FFFFFF',
    'shadow.sm': '0 2px 10px rgba(0, 0, 0, 0.65)',
    'shadow.gold-glow': '0 0 16px rgba(224, 192, 64, 0.45)',
  };
}

function buildLightTokens(): Readonly<Record<string, string>> {
  return {
    'brand.gold.primary': '#A8871F',
    'brand.gold.muted': '#8A7018',
    'brand.bg.deep': '#F5F5F7',
    'brand.glass.blur': '10px',
    'brand.glass.surface': 'rgba(255, 255, 255, 0.82)',
    'brand.glow.gold': '0 0 18px rgba(168, 135, 31, 0.18)',
    'semantic.color.bg.primary': '#F5F5F7',
    'semantic.color.text.primary': '#1A1A1A',
    'semantic.color.accent': '#A8871F',
    'semantic.color.border.subtle': 'rgba(168, 135, 31, 0.24)',
    'surface.base': '#FFFFFF',
    'surface.elevated': 'rgba(255, 255, 255, 0.94)',
    'surface.overlay': 'rgba(26, 26, 26, 0.42)',
    'text.primary': '#1A1A1A',
    'text.secondary': '#4A4A52',
    'text.on-accent': '#FFFFFF',
    'border.default': 'rgba(26, 26, 26, 0.12)',
    'border.focus': '#A8871F',
    'shadow.sm': '0 2px 8px rgba(26, 26, 26, 0.12)',
    'shadow.gold-glow': '0 0 16px rgba(168, 135, 31, 0.16)',
    'motion.duration.fast': '150ms',
    'motion.duration.normal': '250ms',
    'motion.duration.slow': '400ms',
    'motion.ease.standard': 'cubic-bezier(0.4, 0, 0.2, 1)',
    'motion.reduce.enabled': '0',
    'spacing.xs': '0.25rem',
    'spacing.sm': '0.5rem',
    'spacing.md': '1rem',
    'spacing.lg': '1.5rem',
    'spacing.xl': '2rem',
    'radius.sm': '0.375rem',
    'radius.md': '0.625rem',
    'radius.lg': '1rem',
    'radius.full': '9999px',
    'z-index.dropdown': '1000',
    'z-index.modal': '1200',
    'z-index.overlay': '1100',
    'status.success': '#1E8449',
    'status.warning': '#B7950B',
    'status.error': '#C0392B',
    'status.info': '#2471A3',
    'portal.client.accent': '#A8871F',
    'portal.artist.accent': '#A8871F',
    'portal.staff.accent': '#A8871F',
  };
}

/** Official theme catalog — TOKEN-CONTRACT.md v1.0 (3 themes). */
const THEME_SEEDS: readonly ThemeSeed[] = [
  {
    id: 'mdj-dark-gold',
    mode: 'dark',
    description: 'Default brand — Dark · Gold · Premium · Glass',
    tokens: buildDarkGoldTokens(),
  },
  {
    id: 'mdj-dark-gold-high-contrast',
    mode: 'dark',
    description: 'Accessibility fallback — high contrast dark gold',
    tokens: buildHighContrastTokens(),
  },
  {
    id: 'mdj-light',
    mode: 'light',
    description: 'Light theme — ADR optional, registry complete',
    tokens: buildLightTokens(),
  },
];

function buildDefinition(seed: ThemeSeed): ThemeDefinition {
  assertThemeIdFormat(seed.id);

  const definition: ThemeDefinition = Object.freeze({
    id: seed.id,
    mode: seed.mode,
    version: THEME_REGISTRY_VERSION,
    description: seed.description,
    tokens: freezeTokenMap(seed.tokens),
  });

  return definition;
}

function buildRegistry(): ReadonlyMap<string, ThemeDefinition> {
  const entries = THEME_SEEDS.map((seed) => {
    const definition = buildDefinition(seed);
    return [definition.id, definition] as const;
  });

  const map = new Map<string, ThemeDefinition>(entries);
  return Object.freeze(map);
}

export const THEME_REGISTRY: ReadonlyMap<string, ThemeDefinition> = buildRegistry();

export const THEME_COUNT = THEME_REGISTRY.size;

export function isValidThemeIdFormat(id: string): boolean {
  return THEME_ID_FORMAT.test(id);
}

export function assertThemeIdFormat(id: string): asserts id is ThemeId {
  if (!isValidThemeIdFormat(id)) {
    throw new ThemeError('THEME_INVALID_ID', `Invalid theme id format: "${id}"`);
  }
}

export function isRegisteredTheme(id: string): id is ThemeId {
  if (!isValidThemeIdFormat(id)) {
    return false;
  }
  return THEME_REGISTRY.has(id);
}

export function getThemeDefinition(id: string): ThemeDefinition | undefined {
  if (!isRegisteredTheme(id)) {
    return undefined;
  }
  return THEME_REGISTRY.get(id);
}

export function assertThemeRegistered(id: string): ThemeDefinition {
  assertThemeIdFormat(id);

  const definition = THEME_REGISTRY.get(id);
  if (!definition) {
    throw new ThemeError('THEME_NOT_REGISTERED', `Theme not registered: "${id}"`);
  }

  return definition;
}

export function listThemes(): readonly ThemeDefinition[] {
  return Object.freeze([...THEME_REGISTRY.values()]);
}

export function listThemesByMode(mode: ThemeMode): readonly ThemeDefinition[] {
  const matches = [...THEME_REGISTRY.values()].filter((definition) => definition.mode === mode);
  return Object.freeze(matches);
}

export function getDefaultThemeIdForMode(mode: ThemeMode): ThemeId {
  if (mode === 'light') {
    return DEFAULT_LIGHT_THEME_ID;
  }
  return DEFAULT_DARK_THEME_ID;
}
