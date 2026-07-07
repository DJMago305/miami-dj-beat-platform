/** MOD-009 ProfileCard — shared design system — TICKET-MOD-009-COMPONENTS-FOUNDATION-001 */

import { freezeComponentDescriptor } from './foundation/create-descriptor';
import type { MdjComponentDescriptor, MdjThemeBinding } from './foundation/types';

export type ProfileCardProps = {
  readonly name: string;
  readonly role: string;
  readonly meta: string;
};

export type ProfileCardComponent = MdjComponentDescriptor<ProfileCardProps>;

export function createProfileCard(
  props: ProfileCardProps,
  themeBinding: MdjThemeBinding,
): ProfileCardComponent {
  return freezeComponentDescriptor({
    componentId: 'ProfileCard',
    version: '1.0.0',
    className: 'mdj-shell-profile',
    attributes: Object.freeze({
      'data-mdj-component': 'ProfileCard',
      'data-mdj-shell-region': 'profile',
    }),
    themeBinding,
    props: Object.freeze({ ...props }),
    slots: Object.freeze({
      name: props.name,
      role: props.role,
      meta: props.meta,
      nameClassName: 'mdj-shell-profile__name',
      roleClassName: 'mdj-shell-profile__role',
      metaClassName: 'mdj-shell-profile__meta',
    }),
  });
}
