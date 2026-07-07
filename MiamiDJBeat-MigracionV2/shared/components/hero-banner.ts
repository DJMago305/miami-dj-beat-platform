/** MOD-009 HeroBanner — shared design system — TICKET-MOD-009-COMPONENTS-FOUNDATION-001 */

import { freezeComponentDescriptor } from './foundation/create-descriptor';
import type { MdjComponentDescriptor, MdjThemeBinding } from './foundation/types';

export type HeroBannerProps = {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
};

export type HeroBannerComponent = MdjComponentDescriptor<HeroBannerProps>;

export function createHeroBanner(
  props: HeroBannerProps,
  themeBinding: MdjThemeBinding,
): HeroBannerComponent {
  return freezeComponentDescriptor({
    componentId: 'HeroBanner',
    version: '1.0.0',
    className: 'mdj-shell-hero',
    attributes: Object.freeze({
      'data-mdj-component': 'HeroBanner',
      'data-mdj-shell-region': 'hero',
    }),
    themeBinding,
    props: Object.freeze({ ...props }),
    slots: Object.freeze({
      eyebrow: props.eyebrow,
      title: props.title,
      subtitle: props.subtitle,
      eyebrowClassName: 'mdj-shell-hero__eyebrow',
      titleClassName: 'mdj-shell-hero__title',
      subtitleClassName: 'mdj-shell-hero__subtitle',
    }),
  });
}
