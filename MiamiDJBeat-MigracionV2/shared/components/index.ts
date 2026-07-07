/** MOD-009 Components Foundation — public API — TICKET-MOD-009-COMPONENTS-FOUNDATION-001 */

import type { MdjComponentId } from './foundation/types';

export {
  MDJ_COMPONENT_FOUNDATION_VERSION,
  type MdjComponentDescriptor,
  type MdjComponentFactory,
  type MdjComponentId,
  type MdjThemeBinding,
} from './foundation/types';

export {
  COMPONENT_THEME_TOKEN_KEYS,
  createComponentThemeBinding,
  resolveComponentThemeBindingFromRegistry,
  type ComponentThemeTokenKey,
} from './foundation/theme-binding';

export { freezeComponentDescriptor, slugifyAttributeValue } from './foundation/create-descriptor';

export {
  createDashboardCard,
  type DashboardCardComponent,
  type DashboardCardProps,
  type DashboardCardVariant,
} from './dashboard-card';

export {
  createSectionHeader,
  type SectionHeaderComponent,
  type SectionHeaderProps,
  type SectionHeaderVariant,
} from './section-header';

export {
  createHeroBanner,
  type HeroBannerComponent,
  type HeroBannerProps,
} from './hero-banner';

export { createKpiCard, type KpiCardComponent, type KpiCardProps } from './kpi-card';

export {
  createModuleCard,
  type ModuleCardComponent,
  type ModuleCardProps,
} from './module-card';

export {
  createStatusChip,
  type StatusChipComponent,
  type StatusChipProps,
} from './status-chip';

export {
  createProfileCard,
  type ProfileCardComponent,
  type ProfileCardProps,
} from './profile-card';

export { createPanel, type PanelComponent, type PanelProps, type PanelVariant } from './panel';

export {
  createEmptyState,
  type EmptyStateComponent,
  type EmptyStateProps,
} from './empty-state';

export const MDJ_COMPONENT_FACTORY_CATALOG = Object.freeze({
  DashboardCard: 'createDashboardCard',
  SectionHeader: 'createSectionHeader',
  HeroBanner: 'createHeroBanner',
  KpiCard: 'createKpiCard',
  ModuleCard: 'createModuleCard',
  StatusChip: 'createStatusChip',
  ProfileCard: 'createProfileCard',
  Panel: 'createPanel',
  EmptyState: 'createEmptyState',
} as const);

export const MDJ_COMPONENT_IDS = Object.freeze([
  'DashboardCard',
  'SectionHeader',
  'HeroBanner',
  'KpiCard',
  'ModuleCard',
  'StatusChip',
  'ProfileCard',
  'Panel',
  'EmptyState',
] as const satisfies readonly MdjComponentId[]);
