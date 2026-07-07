/** MOD-009 SectionHeader — shared design system — TICKET-MOD-009-COMPONENTS-FOUNDATION-001 */

import { freezeComponentDescriptor } from './foundation/create-descriptor';
import type { MdjComponentDescriptor, MdjThemeBinding } from './foundation/types';

export type SectionHeaderVariant = 'navigation' | 'module-grid';

export type SectionHeaderProps = {
  readonly title: string;
  readonly variant: SectionHeaderVariant;
};

export type SectionHeaderComponent = MdjComponentDescriptor<SectionHeaderProps>;

const SECTION_HEADER_CLASS_NAMES: Readonly<Record<SectionHeaderVariant, string>> = Object.freeze({
  navigation: 'mdj-shell-nav__title',
  'module-grid': 'mdj-shell-module-grid__title',
});

export function createSectionHeader(
  props: SectionHeaderProps,
  themeBinding: MdjThemeBinding,
): SectionHeaderComponent {
  return freezeComponentDescriptor({
    componentId: 'SectionHeader',
    version: '1.0.0',
    className: SECTION_HEADER_CLASS_NAMES[props.variant],
    attributes: Object.freeze({
      'data-mdj-component': 'SectionHeader',
      'data-mdj-section-variant': props.variant,
    }),
    themeBinding,
    props: Object.freeze({ ...props }),
    slots: Object.freeze({
      title: props.title,
    }),
  });
}
