/** MOD-009 Components Foundation — unit tests — TICKET-MOD-009-COMPONENTS-FOUNDATION-001 */

import { describe, expect, it } from 'vitest';
import { getThemeDefinition } from '../../shared/theme/runtime/theme-registry';
import { tokenKeyToCssVariable } from '../../shared/theme/runtime/theme-tokens';
import {
  MDJ_COMPONENT_IDS,
  createComponentThemeBinding,
  createDashboardCard,
  createEmptyState,
  createHeroBanner,
  createKpiCard,
  createModuleCard,
  createPanel,
  createProfileCard,
  createSectionHeader,
  createStatusChip,
} from '../../shared/components/index';

const themeTokens = getThemeDefinition('mdj-dark-gold')?.tokens;
if (!themeTokens) {
  throw new Error('mdj-dark-gold theme tokens are required for component foundation tests');
}

const themeBinding = createComponentThemeBinding(themeTokens);

describe('MOD-009 Components Foundation', () => {
  it('exports nine shared MVP component factories', () => {
    expect(MDJ_COMPONENT_IDS).toHaveLength(9);
    expect(MDJ_COMPONENT_IDS).toContain('StatusChip');
    expect(MDJ_COMPONENT_IDS).toContain('EmptyState');
  });

  it('binds official theme tokens without DOM access', () => {
    expect(themeBinding[tokenKeyToCssVariable('semantic.color.accent')]).toBe('#C9A227');
    expect(themeBinding[tokenKeyToCssVariable('text.primary')]).toBe('#F5F5F7');
  });

  it('creates immutable StatusChip matching portal shell classes', () => {
    const chip = createStatusChip(
      { label: 'Theme', value: 'ready', ready: true },
      themeBinding,
    );

    expect(Object.isFrozen(chip)).toBe(true);
    expect(chip.className).toBe('mdj-shell-status-pill is-ready');
    expect(chip.attributes['data-mdj-status']).toBe('theme');
  });

  it('creates immutable KpiCard and ModuleCard descriptors', () => {
    const kpi = createKpiCard({ label: 'Orders', value: '—', hint: 'Coming soon' }, themeBinding);
    const module = createModuleCard(
      { title: 'Orders', description: 'Placeholder copy', tag: 'Commerce' },
      themeBinding,
    );

    expect(kpi.className).toBe('mdj-shell-kpi');
    expect(module.className).toBe('mdj-shell-module');
    expect(Object.isFrozen(kpi.props)).toBe(true);
    expect(Object.isFrozen(module.slots)).toBe(true);
  });

  it('creates HeroBanner, ProfileCard, and SectionHeader descriptors', () => {
    const hero = createHeroBanner(
      { eyebrow: 'Welcome', title: 'Client Dashboard', subtitle: 'Subtitle' },
      themeBinding,
    );
    const profile = createProfileCard(
      { name: 'Guest Client', role: 'Buyer', meta: 'VIP pathway' },
      themeBinding,
    );
    const section = createSectionHeader(
      { title: 'Your Client Modules', variant: 'module-grid' },
      themeBinding,
    );

    expect(hero.className).toBe('mdj-shell-hero');
    expect(profile.className).toBe('mdj-shell-profile');
    expect(section.className).toBe('mdj-shell-module-grid__title');
  });

  it('creates DashboardCard, Panel, and EmptyState descriptors', () => {
    const dashboard = createDashboardCard(
      { variant: 'kpi-grid', region: 'kpis' },
      themeBinding,
    );
    const panel = createPanel({ title: 'Runtime', variant: 'glass' }, themeBinding);
    const empty = createEmptyState(
      { title: 'No data', description: 'Nothing here yet', hint: 'Coming soon' },
      themeBinding,
    );

    expect(dashboard.className).toBe('mdj-shell-kpi-grid');
    expect(panel.className).toContain('mdj-shell-panel');
    expect(empty.className).toBe('mdj-shell-empty-state');
  });
});
