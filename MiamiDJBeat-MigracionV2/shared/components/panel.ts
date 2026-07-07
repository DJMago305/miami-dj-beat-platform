/** MOD-009 Panel — shared design system — TICKET-MOD-009-COMPONENTS-FOUNDATION-001 */

import { freezeComponentDescriptor } from './foundation/create-descriptor';
import type { MdjComponentDescriptor, MdjThemeBinding } from './foundation/types';

export type PanelVariant = 'glass' | 'elevated';

export type PanelProps = {
  readonly title: string;
  readonly variant: PanelVariant;
};

export type PanelComponent = MdjComponentDescriptor<PanelProps>;

const PANEL_CLASS_NAMES: Readonly<Record<PanelVariant, string>> = Object.freeze({
  glass: 'mdj-shell-panel mdj-shell-panel--glass',
  elevated: 'mdj-shell-panel mdj-shell-panel--elevated',
});

export function createPanel(props: PanelProps, themeBinding: MdjThemeBinding): PanelComponent {
  return freezeComponentDescriptor({
    componentId: 'Panel',
    version: '1.0.0',
    className: PANEL_CLASS_NAMES[props.variant],
    attributes: Object.freeze({
      'data-mdj-component': 'Panel',
      'data-mdj-panel-variant': props.variant,
    }),
    themeBinding,
    props: Object.freeze({ ...props }),
    slots: Object.freeze({
      title: props.title,
    }),
  });
}
