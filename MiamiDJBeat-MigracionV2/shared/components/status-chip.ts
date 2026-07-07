/** MOD-009 StatusChip — shared design system — TICKET-MOD-009-COMPONENTS-FOUNDATION-001 */

import { freezeComponentDescriptor, slugifyAttributeValue } from './foundation/create-descriptor';
import type { MdjComponentDescriptor, MdjThemeBinding } from './foundation/types';

export type StatusChipProps = {
  readonly label: string;
  readonly value: string;
  readonly ready: boolean;
};

export type StatusChipComponent = MdjComponentDescriptor<StatusChipProps>;

export function createStatusChip(
  props: StatusChipProps,
  themeBinding: MdjThemeBinding,
): StatusChipComponent {
  return freezeComponentDescriptor({
    componentId: 'StatusChip',
    version: '1.0.0',
    className: `mdj-shell-status-pill${props.ready ? ' is-ready' : ' is-pending'}`,
    attributes: Object.freeze({
      'data-mdj-component': 'StatusChip',
      'data-mdj-status': slugifyAttributeValue(props.label),
    }),
    themeBinding,
    props: Object.freeze({ ...props }),
    slots: Object.freeze({
      label: props.label,
      value: props.value,
    }),
  });
}
