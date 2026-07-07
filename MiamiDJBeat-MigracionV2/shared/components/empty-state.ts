/** MOD-009 EmptyState — shared design system — TICKET-MOD-009-COMPONENTS-FOUNDATION-001 */

import { freezeComponentDescriptor } from './foundation/create-descriptor';
import type { MdjComponentDescriptor, MdjThemeBinding } from './foundation/types';

export type EmptyStateProps = {
  readonly title: string;
  readonly description: string;
  readonly hint: string;
};

export type EmptyStateComponent = MdjComponentDescriptor<EmptyStateProps>;

export function createEmptyState(
  props: EmptyStateProps,
  themeBinding: MdjThemeBinding,
): EmptyStateComponent {
  return freezeComponentDescriptor({
    componentId: 'EmptyState',
    version: '1.0.0',
    className: 'mdj-shell-empty-state',
    attributes: Object.freeze({
      'data-mdj-component': 'EmptyState',
    }),
    themeBinding,
    props: Object.freeze({ ...props }),
    slots: Object.freeze({
      title: props.title,
      description: props.description,
      hint: props.hint,
      titleClassName: 'mdj-shell-empty-state__title',
      descriptionClassName: 'mdj-shell-empty-state__description',
      hintClassName: 'mdj-shell-empty-state__hint',
    }),
  });
}
