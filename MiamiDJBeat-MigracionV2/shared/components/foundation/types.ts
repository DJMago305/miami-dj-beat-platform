/** MOD-009 Components Foundation — core types — TICKET-MOD-009-COMPONENTS-FOUNDATION-001 */

export const MDJ_COMPONENT_FOUNDATION_VERSION = '1.0.0' as const;

export type MdjComponentId =
  | 'DashboardCard'
  | 'SectionHeader'
  | 'HeroBanner'
  | 'KpiCard'
  | 'ModuleCard'
  | 'StatusChip'
  | 'ProfileCard'
  | 'Panel'
  | 'EmptyState';

export type MdjThemeBinding = Readonly<Record<string, string>>;

export type MdjComponentDescriptor<TProps extends object = object> = Readonly<{
  readonly componentId: MdjComponentId;
  readonly version: typeof MDJ_COMPONENT_FOUNDATION_VERSION;
  readonly className: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly themeBinding: MdjThemeBinding;
  readonly props: Readonly<TProps>;
  readonly slots: Readonly<Record<string, string>>;
}>;

export type MdjComponentFactory<TProps extends object> = (
  props: TProps,
  themeBinding: MdjThemeBinding,
) => MdjComponentDescriptor<TProps>;
