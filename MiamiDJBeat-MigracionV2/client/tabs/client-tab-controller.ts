/**
 * MOD-207 — lightweight tab controller for the Client portal, mirroring the
 * REAL production pattern (ui-v1-clone/client-account.html's `.ca-panel` +
 * `.is-active` toggle) and the same mechanism already ported for Artist
 * (artist/tabs/artist-tab-controller.ts). No router library.
 */

export type ClientTabDefinition = {
  readonly id: string;
  readonly label: string;
};

export type ClientTabControllerParts = {
  readonly tabBar: HTMLElement;
  /** Keyed by tab id. Append each tab's content into its panel. */
  readonly panels: Readonly<Record<string, HTMLElement>>;
};

/**
 * Builds the tab bar + one hidden `<section>` panel per tab (first tab
 * starts visible). Call `wireClientTabController(tabBar, panels)` once the
 * bar is in the document to make clicks switch panels.
 */
export function createClientTabController(
  tabs: readonly ClientTabDefinition[],
): ClientTabControllerParts {
  const tabBar = document.createElement('nav');
  tabBar.className = 'mdj-client-tabs';
  tabBar.setAttribute('role', 'tablist');
  tabBar.setAttribute('aria-label', 'Secciones del portal de cliente');

  const panels: Record<string, HTMLElement> = {};

  tabs.forEach((tab, index) => {
    const isFirst = index === 0;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mdj-client-tabs__btn';
    button.textContent = tab.label;
    button.dataset.tab = tab.id;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', isFirst ? 'true' : 'false');
    button.classList.toggle('is-active', isFirst);
    tabBar.append(button);

    const panel = document.createElement('section');
    panel.className = 'mdj-client-tab-panel';
    panel.dataset.tabPanel = tab.id;
    panel.setAttribute('role', 'tabpanel');
    if (!isFirst) panel.hidden = true;
    panels[tab.id] = panel;
  });

  return { tabBar, panels: Object.freeze(panels) };
}

/**
 * Delegated click handler: toggles `hidden` + `.is-active` across the tab
 * bar's buttons and the sibling panels — same pattern as
 * wireArtistTabController.
 */
export function wireClientTabController(
  tabBar: HTMLElement,
  panels: Readonly<Record<string, HTMLElement>>,
): void {
  tabBar.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest<HTMLButtonElement>('[data-tab]');
    if (!button || !tabBar.contains(button)) return;

    const tabId = button.dataset.tab;
    if (!tabId || !panels[tabId]) return;

    for (const btn of tabBar.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
      const isActive = btn.dataset.tab === tabId;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    }
    for (const [id, panel] of Object.entries(panels)) {
      panel.hidden = id !== tabId;
    }
  });
}
