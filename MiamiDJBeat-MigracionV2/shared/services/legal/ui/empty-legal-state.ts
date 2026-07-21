/** EmptyLegalState — LC-4 — TICKET-V2-LEGAL-CENTER-UI-SHELL-001 */

export type EmptyLegalStateProps = {
  readonly title: string;
  readonly description: string;
  readonly hint?: string;
};

export function createEmptyLegalState(props: EmptyLegalStateProps): HTMLElement {
  const root = document.createElement('div');
  root.className = 'mdj-legal-empty-state';
  root.dataset.mdjLegalEmptyState = 'true';

  const title = document.createElement('p');
  title.className = 'mdj-legal-empty-state__title';
  title.textContent = props.title;

  const description = document.createElement('p');
  description.className = 'mdj-legal-empty-state__description';
  description.textContent = props.description;

  root.append(title, description);

  if (props.hint) {
    const hint = document.createElement('p');
    hint.className = 'mdj-legal-empty-state__hint';
    hint.textContent = props.hint;
    root.append(hint);
  }

  return root;
}
