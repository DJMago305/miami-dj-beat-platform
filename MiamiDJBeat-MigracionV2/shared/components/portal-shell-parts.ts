/** MOD-008 Portal Shell — status pill — TICKET-MOD-008-PORTAL-SHELL-001 */

export type ShellStatusPillInput = {
  readonly label: string;
  readonly value: string;
  readonly ready: boolean;
};

export function createShellStatusPill(input: ShellStatusPillInput): HTMLSpanElement {
  const pill = document.createElement('span');
  pill.className = `mdj-shell-status-pill${input.ready ? ' is-ready' : ' is-pending'}`;
  pill.dataset.mdjStatus = input.label.toLowerCase().replace(/\s+/g, '-');

  const label = document.createElement('span');
  label.className = 'mdj-shell-status-pill__label';
  label.textContent = input.label;

  const value = document.createElement('span');
  value.className = 'mdj-shell-status-pill__value';
  value.textContent = input.value;

  pill.append(label, value);
  return pill;
}

export function createShellKpiCard(input: {
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}): HTMLElement {
  const card = document.createElement('article');
  card.className = 'mdj-shell-kpi';

  const label = document.createElement('p');
  label.className = 'mdj-shell-kpi__label';
  label.textContent = input.label;

  const value = document.createElement('p');
  value.className = 'mdj-shell-kpi__value';
  value.textContent = input.value;

  const hint = document.createElement('p');
  hint.className = 'mdj-shell-kpi__hint';
  hint.textContent = input.hint;

  card.append(label, value, hint);
  return card;
}

export function createShellModuleCard(input: {
  readonly title: string;
  readonly description: string;
  readonly tag: string;
}): HTMLElement {
  const card = document.createElement('article');
  card.className = 'mdj-shell-module';

  const tag = document.createElement('span');
  tag.className = 'mdj-shell-module__tag';
  tag.textContent = input.tag;

  const title = document.createElement('h3');
  title.className = 'mdj-shell-module__title';
  title.textContent = input.title;

  const description = document.createElement('p');
  description.className = 'mdj-shell-module__description';
  description.textContent = input.description;

  card.append(tag, title, description);
  return card;
}
