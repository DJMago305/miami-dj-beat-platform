/** MOD-009 KpiCard — shared design system — TICKET-MOD-009-COMPONENTS-FOUNDATION-001 */

import { freezeComponentDescriptor } from './foundation/create-descriptor';
import type { MdjComponentDescriptor, MdjThemeBinding } from './foundation/types';

export type KpiCardProps = {
  readonly label: string;
  readonly value: string;
  readonly hint: string;
};

export type KpiCardComponent = MdjComponentDescriptor<KpiCardProps>;

export function createKpiCard(
  props: KpiCardProps,
  themeBinding: MdjThemeBinding,
): KpiCardComponent {
  return freezeComponentDescriptor({
    componentId: 'KpiCard',
    version: '1.0.0',
    className: 'mdj-shell-kpi',
    attributes: Object.freeze({
      'data-mdj-component': 'KpiCard',
    }),
    themeBinding,
    props: Object.freeze({ ...props }),
    slots: Object.freeze({
      label: props.label,
      value: props.value,
      hint: props.hint,
    }),
  });
}
