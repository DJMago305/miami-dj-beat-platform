/** MOD-010 Client Dashboard — MOD-009 descriptor mount — TICKET-MOD-010-CLIENT-DASHBOARD-MVP-001 */

import type { MdjComponentDescriptor } from '../shared/components/foundation/types';

function applyThemeBinding(element: HTMLElement, themeBinding: MdjComponentDescriptor['themeBinding']): void {
  for (const [cssVar, value] of Object.entries(themeBinding)) {
    if (value) {
      element.style.setProperty(cssVar, value);
    }
  }
}

function applyAttributes(element: HTMLElement, attributes: MdjComponentDescriptor['attributes']): void {
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }
}

export function mountComponentDescriptor(descriptor: MdjComponentDescriptor): HTMLElement {
  const root = document.createElement(
    descriptor.componentId === 'KpiCard' || descriptor.componentId === 'ModuleCard'
      ? 'article'
      : descriptor.componentId === 'SectionHeader'
        ? 'h2'
        : 'section',
  );

  root.className = descriptor.className;
  applyAttributes(root, descriptor.attributes);
  applyThemeBinding(root, descriptor.themeBinding);

  switch (descriptor.componentId) {
    case 'HeroBanner': {
      const eyebrow = document.createElement('p');
      eyebrow.className = descriptor.slots.eyebrowClassName ?? 'mdj-shell-hero__eyebrow';
      eyebrow.textContent = descriptor.slots.eyebrow;

      const title = document.createElement('h1');
      title.className = descriptor.slots.titleClassName ?? 'mdj-shell-hero__title';
      title.textContent = descriptor.slots.title;

      const subtitle = document.createElement('p');
      subtitle.className = descriptor.slots.subtitleClassName ?? 'mdj-shell-hero__subtitle';
      subtitle.textContent = descriptor.slots.subtitle;

      root.append(eyebrow, title, subtitle);
      break;
    }
    case 'KpiCard': {
      const label = document.createElement('p');
      label.className = 'mdj-shell-kpi__label';
      label.textContent = descriptor.slots.label;

      const value = document.createElement('p');
      value.className = 'mdj-shell-kpi__value';
      value.textContent = descriptor.slots.value;

      const hint = document.createElement('p');
      hint.className = 'mdj-shell-kpi__hint';
      hint.textContent = descriptor.slots.hint;

      root.append(label, value, hint);
      break;
    }
    case 'ModuleCard': {
      const tag = document.createElement('span');
      tag.className = 'mdj-shell-module__tag';
      tag.textContent = descriptor.slots.tag;

      const title = document.createElement('h3');
      title.className = 'mdj-shell-module__title';
      title.textContent = descriptor.slots.title;

      const description = document.createElement('p');
      description.className = 'mdj-shell-module__description';
      description.textContent = descriptor.slots.description;

      root.append(tag, title, description);
      break;
    }
    case 'SectionHeader': {
      root.textContent = descriptor.slots.title;
      break;
    }
    case 'Panel': {
      const title = document.createElement('p');
      title.className = 'mdj-client-panel__title';
      title.textContent = descriptor.slots.title;
      root.append(title);
      break;
    }
    case 'EmptyState': {
      const title = document.createElement('p');
      title.className = descriptor.slots.titleClassName ?? 'mdj-shell-empty-state__title';
      title.textContent = descriptor.slots.title;

      const description = document.createElement('p');
      description.className =
        descriptor.slots.descriptionClassName ?? 'mdj-shell-empty-state__description';
      description.textContent = descriptor.slots.description;

      const hint = document.createElement('p');
      hint.className = descriptor.slots.hintClassName ?? 'mdj-shell-empty-state__hint';
      hint.textContent = descriptor.slots.hint;

      root.append(title, description, hint);
      break;
    }
    default:
      root.textContent = descriptor.slots.title ?? descriptor.componentId;
      break;
  }

  return root;
}
