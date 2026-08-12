/**
 * MOD-208 — hash-driven sidebar router for the Staff portal, mirroring the
 * REAL production mechanism (ui-v1-clone/admin-dashboard.html's
 * `.side-link` anchors + `window.addEventListener('hashchange', ...)`
 * toggling section display, defaulting to 'leads' when the hash is empty)
 * — same `hidden` attribute primitive as the Artist/Client tab controllers
 * (MOD-206/MOD-207), driven by the sidebar's native anchor hashes instead
 * of a synthetic button bar. No router library.
 */

export type StaffSidebarRouterParts = {
  /** Keyed by panel id (matches a `.side-link[href="#id"]`). */
  readonly panels: Readonly<Record<string, HTMLElement>>;
};

function resolveTargetId(panels: Readonly<Record<string, HTMLElement>>, defaultId: string): string {
  const hash = window.location.hash.replace('#', '');
  return hash && panels[hash] ? hash : defaultId;
}

/**
 * Wires `sidebar`'s `.side-link[href="#id"]` anchors to show/hide the
 * matching panel and toggle `.active` on the link. Native anchor clicks
 * already update `location.hash`, so `hashchange` alone (plus one call on
 * init to sync whatever hash is present on load) covers clicks, browser
 * back/forward, and direct links — same effective coverage as the real
 * site's click-handler + hashchange pair, without duplicating the toggle
 * logic in two places.
 */
export function wireStaffSidebarRouter(
  sidebar: HTMLElement,
  panels: Readonly<Record<string, HTMLElement>>,
  defaultId: string,
): void {
  const applyHash = (): void => {
    const targetId = resolveTargetId(panels, defaultId);

    for (const link of sidebar.querySelectorAll<HTMLAnchorElement>('.side-link')) {
      const href = link.getAttribute('href') ?? '';
      if (!href.startsWith('#')) continue;
      link.classList.toggle('active', href.slice(1) === targetId);
    }

    for (const [id, panel] of Object.entries(panels)) {
      panel.hidden = id !== targetId;
    }
  };

  window.addEventListener('hashchange', applyHash);
  applyHash();
}
