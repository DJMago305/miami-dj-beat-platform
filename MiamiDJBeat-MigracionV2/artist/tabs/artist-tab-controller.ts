/**
 * MOD-206 — lightweight tab controller for the Artist portal, mirroring the
 * REAL production pattern (ui-v1-clone/dj-profile.html's `.dj-panel` +
 * `switchProfileTab()`: hidden-attribute toggle, one panel visible at a
 * time) instead of a single long scroll. No router library — this is the
 * same mechanism the real site already uses, just re-implemented in TS.
 */

export type ArtistTabDefinition = {
  readonly id: string;
  readonly label: string;
};

export type ArtistTabControllerParts = {
  readonly tabBar: HTMLElement;
  /** Keyed by tab id. Append each tab's content into its panel. */
  readonly panels: Readonly<Record<string, HTMLElement>>;
};

/**
 * Builds the tab bar + one hidden `<section>` panel per tab (first tab
 * starts visible). Call `wireArtistTabController(tabBar)` once the bar is
 * in the document to make clicks switch panels.
 */
export function createArtistTabController(
  tabs: readonly ArtistTabDefinition[],
): ArtistTabControllerParts {
  const tabBar = document.createElement('nav');
  tabBar.className = 'mdj-artist-tabs';
  tabBar.setAttribute('role', 'tablist');
  tabBar.setAttribute('aria-label', 'Secciones del portal de artista');

  const panels: Record<string, HTMLElement> = {};

  tabs.forEach((tab, index) => {
    const isFirst = index === 0;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mdj-artist-tabs__btn';
    button.textContent = tab.label;
    button.dataset.tab = tab.id;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', isFirst ? 'true' : 'false');
    button.classList.toggle('is-active', isFirst);
    tabBar.append(button);

    const panel = document.createElement('section');
    panel.className = 'mdj-artist-tab-panel';
    panel.dataset.tabPanel = tab.id;
    panel.setAttribute('role', 'tabpanel');
    if (!isFirst) panel.hidden = true;
    panels[tab.id] = panel;
  });

  return { tabBar, panels: Object.freeze(panels) };
}

/**
 * Delegated click handler: toggles `hidden` + `.is-active` across the tab
 * bar's buttons and the sibling panels (same real pattern as
 * switchProfileTab() in ui-v1-clone/dj-profile.html — one visible panel,
 * no scroll).
 */
export function wireArtistTabController(
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
