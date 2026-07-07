/** MOD-009 DashboardCard — shared design system — TICKET-MOD-009-COMPONENTS-FOUNDATION-001 */

import { freezeComponentDescriptor } from './foundation/create-descriptor';
import type { MdjComponentDescriptor, MdjThemeBinding } from './foundation/types';

export type DashboardCardVariant = 'kpi-grid' | 'module-grid';

export type DashboardCardProps = {
  readonly variant: DashboardCardVariant;
  readonly region: string;
};

export type DashboardCardComponent = MdjComponentDescriptor<DashboardCardProps>;

const DASHBOARD_CARD_CLASS_NAMES: Readonly<Record<DashboardCardVariant, string>> = Object.freeze({
  'kpi-grid': 'mdj-shell-kpi-grid',
  'module-grid': 'mdj-shell-module-grid',
});

export function createDashboardCard(
  props: DashboardCardProps,
  themeBinding: MdjThemeBinding,
): DashboardCardComponent {
  return freezeComponentDescriptor({
    componentId: 'DashboardCard',
    version: '1.0.0',
    className: DASHBOARD_CARD_CLASS_NAMES[props.variant],
    attributes: Object.freeze({
      'data-mdj-component': 'DashboardCard',
      'data-mdj-shell-region': props.region,
    }),
    themeBinding,
    props: Object.freeze({ ...props }),
    slots: Object.freeze({
      region: props.region,
    }),
  });
}
