/** V2 Priority 2 — V1 site header mount + lab chrome cleanup (visual parity). */

export { MDJ_V1_ASSET_BASE, mountV1SiteHeader, buildV1SiteHeaderHtml } from './mount-v1-site-header';
export type { V1BrandShellPortal } from './mount-v1-site-header';

import { mountV1SiteHeader, type V1BrandShellPortal } from './mount-v1-site-header';

/**
 * Ensures the real V1 `#mainHeader` is mounted and marks the dashboard main host.
 * No longer injects a mini brand strip (that broke logo sizing / alignment).
 */
export function applyV1BrandShell(mainRegion: HTMLElement, portal: V1BrandShellPortal): HTMLElement {
  mainRegion.classList.add('mdj-v2-v1-shell-host');
  mainRegion.dataset.mdjV1Brand = portal;
  return mountV1SiteHeader(portal);
}

/** Body / html classes + real V1 header for lab portals. */
export function applyV1LabDocumentClasses(portal: V1BrandShellPortal): void {
  document.documentElement.classList.add('notranslate');
  document.body.classList.add('notranslate', 'mdj-v2-lab', `mdj-v2-lab--${portal}`);
  /* Buyer-session flags unlock V1 #mainNav “MI PORTAL” reveal CSS on all lab portals. */
  document.body.classList.add('mdj-is-client', 'mdj-buyer-session');
  if (portal === 'client') {
    document.body.classList.add('mdj-buyer-journey-page');
  }
  mountV1SiteHeader(portal);
}
