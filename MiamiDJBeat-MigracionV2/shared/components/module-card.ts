/** MOD-009 ModuleCard — shared design system — TICKET-MOD-009-COMPONENTS-FOUNDATION-001 */

import { freezeComponentDescriptor } from './foundation/create-descriptor';
import type { MdjComponentDescriptor, MdjThemeBinding } from './foundation/types';

export type ModuleCardProps = {
  readonly title: string;
  readonly description: string;
  readonly tag: string;
};

export type ModuleCardComponent = MdjComponentDescriptor<ModuleCardProps>;

export function createModuleCard(
  props: ModuleCardProps,
  themeBinding: MdjThemeBinding,
): ModuleCardComponent {
  return freezeComponentDescriptor({
    componentId: 'ModuleCard',
    version: '1.0.0',
    className: 'mdj-shell-module',
    attributes: Object.freeze({
      'data-mdj-component': 'ModuleCard',
    }),
    themeBinding,
    props: Object.freeze({ ...props }),
    slots: Object.freeze({
      tag: props.tag,
      title: props.title,
      description: props.description,
    }),
  });
}
