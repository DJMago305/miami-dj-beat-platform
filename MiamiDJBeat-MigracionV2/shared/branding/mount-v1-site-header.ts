/**
 * V2 lab — lift & shift of ui-v1-clone `#mainHeader` (index / client-portal).
 * Asset paths remapped to `/v1/...`. Visual-only; no auth/i18n wiring.
 */

import {
  MDJ_V1_ASSET_EAGLE,
  MDJ_V1_ASSET_LETTERS,
} from './v1-lab-assets';
import { getLabPortalIdentity } from './lab-portal-identity-ssot';

export const MDJ_V1_ASSET_BASE = '/v1';

export type V1BrandShellPortal = 'client' | 'artist' | 'staff';

const HEADER_HOST_ID = 'mdj-v2-v1-site-header-host';

/** Exact structural clone of V1 `#mainHeader` with `/v1` asset + nav hrefs. */
export function buildV1SiteHeaderHtml(portal: V1BrandShellPortal): string {
  const eagle = MDJ_V1_ASSET_EAGLE;
  const letters = MDJ_V1_ASSET_LETTERS;
  const identity = getLabPortalIdentity(portal);
  const avatar = identity.photoUrl;
  const session = { displayName: identity.displayName, profileHref: `/${portal}/` };
  const avatarFit = 'cover';
  const avatarPos = 'center 18%';
  const avatarBg = '';

  const miPortalActive = portal === 'client' ? ' active' : '';
  const homeActive = portal !== 'client' ? ' active' : '';

  return `
<header class="header mdj-header-unified" id="mainHeader" data-mdj-v2-v1-header="1">
  <div class="header-top">
    <div class="container">
      <div class="brand">
        <img src="${eagle}" alt="Miami DJ Beat Logo" class="logo-img-eagle" width="80" height="80" decoding="async" />
        <div class="brand-letters-wrapper">
          <img src="${letters}" alt="Miami DJ Beat Letters" class="brand-letters-img" decoding="async" />
        </div>
      </div>

      <div class="header-actions">
        <span id="header-djpro-badge" class="header-djpro-badge" style="display: none;" aria-label="DJPRO">DJPRO</span>
        <div class="mdj-header-r1-auth-cluster">
          <div class="lang-switcher">
            <span class="lang-btn" data-lang="es">ES</span>
            <span class="lang-pipe">|</span>
            <span class="lang-btn active" data-lang="en">EN</span>
          </div>
          <div class="account" id="header-auth-zone">
            <div class="mdj-account-vip mdj-account-vip--artist-link-only" id="mdjAccountVipRoot">
              <a class="mdj-account-vip-trigger mdj-account-vip-direct account-btn" id="accountBtn" href="${session.profileHref}" title="Mi perfil" aria-label="Mi perfil">
                <img class="avatar" src="${avatar}" alt="" width="40" height="40" decoding="async" style="object-fit:${avatarFit};object-position:${avatarPos};${avatarBg}" />
                <span class="mdj-account-display-name" id="mdjAccountDisplayName">${session.displayName}</span>
              </a>
            </div>
          </div>
        </div>
        <div class="header-avatar-cart-row" aria-label="Cuenta y carrito">
          <a href="${MDJ_V1_ASSET_BASE}/shop.html" id="header-cart-link" class="header-cart-btn" title="Carrito" aria-label="Carrito de compras">
            <span aria-hidden="true">🛒</span>
            <span id="header-cart-count" class="header-cart-count" hidden></span>
          </a>
        </div>
        <div class="header-search-wrap">
          <input type="search" id="header-smart-search" class="header-smart-search"
            placeholder="Buscar DJs, tienda, cursos, reservas…" autocomplete="off" enterkeyhint="search" />
        </div>
      </div>

      <button class="mobile-menu-btn" id="mobileMenuBtn" type="button" aria-label="Menú" aria-controls="mobileMenu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>

      <div class="mobile-overlay" id="mobileMenu">
        <nav class="mobile-nav">
          <a href="${MDJ_V1_ASSET_BASE}/index.html" class="${homeActive.trim()}" data-i18n="nav-home" data-mdj-nav="home">Inicio</a>
          <a href="${MDJ_V1_ASSET_BASE}/rentals.html" data-i18n="nav-services" data-mdj-nav="services">Servicios</a>
          <a href="${MDJ_V1_ASSET_BASE}/events.html" data-i18n="nav-rentals" data-mdj-nav="venues">Eventos</a>
          <a href="${MDJ_V1_ASSET_BASE}/shop.html" style="color:#c5a059;font-weight:800;" data-i18n="nav-shop" data-mdj-nav="shop">Shop</a>
          <a href="${MDJ_V1_ASSET_BASE}/dj-tools.html" data-i18n="nav-tools" data-mdj-nav="tools">DJ Tools</a>
          <a href="${MDJ_V1_ASSET_BASE}/jobs.html" data-i18n="nav-jobs" data-mdj-nav="jobs">Trabajos</a>
          <a href="${MDJ_V1_ASSET_BASE}/contact.html" data-i18n="nav-contact" data-mdj-nav="contact">Contacto</a>
          <a href="${session.profileHref}" id="nav-my-profile-mobile" style="color:var(--gold); font-weight:900;" data-i18n="menu-account">MI PERFIL</a>
        </nav>
      </div>
    </div>
  </div>
  <div class="header-nav">
    <div class="container">
      <nav class="nav top-nav mdj-mainnav-flex" id="mainNav" aria-label="Navegación principal">
        <a href="${MDJ_V1_ASSET_BASE}/index.html" class="${homeActive.trim()}" data-i18n="nav-home" data-mdj-nav="home">Inicio</a>
        <a href="${MDJ_V1_ASSET_BASE}/rentals.html" data-i18n="nav-services" data-mdj-nav="services">Servicios</a>
        <a href="${MDJ_V1_ASSET_BASE}/events.html" data-i18n="nav-rentals" data-mdj-nav="venues">Eventos</a>
        <a href="${MDJ_V1_ASSET_BASE}/shop.html" style="color:var(--gold);font-weight:800;" data-i18n="nav-shop" data-mdj-nav="shop">Shop</a>
        <a href="${MDJ_V1_ASSET_BASE}/client-account.html" id="mainNav-config-link" class="mdj-config-mainnav" data-mdj-nav="config" data-i18n="nav-config" aria-hidden="false" tabindex="0">⚙️ CONFIG</a>
        <a href="${MDJ_V1_ASSET_BASE}/jobs.html" data-i18n="nav-jobs" data-mdj-nav="jobs">Trabajos</a>
        <a href="${MDJ_V1_ASSET_BASE}/contact.html" data-i18n="nav-contact" data-mdj-nav="contact">Contacto</a>
        <a id="mainNav-mi-portal-link" class="mdj-mi-portal-mainnav mdj-mi-portal-gold${miPortalActive}" href="/client/" data-mdj-nav="mi-portal" aria-hidden="false" tabindex="0">MI PORTAL</a>
      </nav>
    </div>
  </div>
</header>
`.trim();
}

function wireMobileMenu(header: HTMLElement): void {
  const btn = header.querySelector<HTMLButtonElement>('#mobileMenuBtn');
  const overlay = header.querySelector<HTMLElement>('#mobileMenu');
  if (!btn || !overlay) return;
  btn.addEventListener('click', () => {
    const open = overlay.classList.toggle('active');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('menu-open', open);
  });
}

/**
 * Mounts the real V1 site header once (before `#app`). Idempotent.
 */
export function mountV1SiteHeader(portal: V1BrandShellPortal): HTMLElement {
  const existing = document.getElementById('mainHeader');
  if (existing?.dataset.mdjV2V1Header === '1') {
    /* Rebind SSOT identity when portal changes (SPA/HMR) — no stale avatar. */
    if (existing.dataset.mdjV2Portal !== portal) {
      const host = document.getElementById(HEADER_HOST_ID);
      if (host) {
        host.innerHTML = buildV1SiteHeaderHtml(portal);
        const header = host.querySelector<HTMLElement>('#mainHeader');
        if (header) {
          header.dataset.mdjV2Portal = portal;
          document.body.classList.add('mdj-logged-in-header');
          wireMobileMenu(header);
          revealLabMainNavTabs(header);
          return header;
        }
      }
    }
    existing.dataset.mdjV2Portal = portal;
    document.body.classList.add('mdj-logged-in-header');
    /* Nuke any leftover guest CTAs from earlier mounts / HMR. */
    existing.querySelectorAll('#header-login-btn, #header-get-pro-btn, #header-subscribe-free-btn, .mdj-v2-lab-guest-cta').forEach((el) => {
      el.remove();
    });
    revealLabMainNavTabs(existing);
    return existing;
  }

  let host = document.getElementById(HEADER_HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = HEADER_HOST_ID;
    host.className = 'mdj-v2-v1-site-header-host';
    const app = document.getElementById('app');
    if (app?.parentNode) {
      app.parentNode.insertBefore(host, app);
    } else {
      document.body.prepend(host);
    }
  }

  host.innerHTML = buildV1SiteHeaderHtml(portal);
  const header = host.querySelector<HTMLElement>('#mainHeader');
  if (!header) {
    throw new Error('V1 site header mount failed — #mainHeader missing');
  }
  header.dataset.mdjV2Portal = portal;
  document.body.classList.add('mdj-logged-in-header');
  wireMobileMenu(header);
  revealLabMainNavTabs(header);
  return header;
}

/** Lab-only: force production-visible tabs (auth JS not loaded). */
function revealLabMainNavTabs(header: HTMLElement): void {
  const miPortal = header.querySelector<HTMLElement>('#mainNav-mi-portal-link');
  if (miPortal) {
    miPortal.classList.remove('mdj-mi-portal--guest', 'mdj-mi-portal--hydrating', 'mdj-mainnav-reserved-slot');
    miPortal.setAttribute('aria-hidden', 'false');
    miPortal.tabIndex = 0;
    miPortal.style.setProperty('display', 'inline-flex', 'important');
    miPortal.style.setProperty('visibility', 'visible', 'important');
    miPortal.style.setProperty('opacity', '1', 'important');
    miPortal.style.setProperty('pointer-events', 'auto', 'important');
    miPortal.style.setProperty('max-width', 'none', 'important');
    miPortal.style.setProperty('width', 'auto', 'important');
    miPortal.style.setProperty('min-width', 'max-content', 'important');
    miPortal.style.setProperty('flex', '0 0 auto', 'important');
  }

  const config = header.querySelector<HTMLElement>('#mainNav-config-link');
  if (config) {
    config.classList.remove('mdj-mainnav-reserved-slot');
    config.setAttribute('aria-hidden', 'false');
    config.tabIndex = 0;
    config.style.setProperty('display', 'inline-flex', 'important');
    config.style.setProperty('visibility', 'visible', 'important');
    config.style.setProperty('opacity', '1', 'important');
    config.style.setProperty('pointer-events', 'auto', 'important');
    config.style.setProperty('max-width', 'none', 'important');
    config.style.setProperty('width', 'auto', 'important');
    config.style.setProperty('min-width', 'max-content', 'important');
    config.style.setProperty('flex', '0 0 auto', 'important');
  }
}
