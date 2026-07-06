/**
 * Miami DJ Beat — shared top header behavior (session, cart, search, mobile, nav highlight).
 * Load after: supabase CDN, supabase-config.js, header-smart-search.js (optional), translations/i18n (optional).
 * En DOMContentLoaded: `./js/mdj-ambient-music.js` (música) y `./js/mdj-videos-force-mute.js` (vídeos mudos).
 * Omitir música: MDJ_SKIP_AMBIENT_MUSIC o data-mdj-no-ambient. Omitir mute vídeos: MDJ_SKIP_FORCE_MUTE_VIDEOS o data-mdj-no-force-mute-videos.
 *
 * OMNIPRESENCE: cuando existe `#mainHeader`, este script es el **único** dueño de ENTRAR/SALIR (y zona VIP)
 * en `#header-login-btn` / `#header-login-btn-mobile`. `checkSessionForNav()` usa `supabase.auth.getSession()`
 * al cargar y en `onAuthStateChange`. `window.doLogout` limpia sesión y envía al Home.
 */
(function () {
  'use strict';
  console.info('[Header] build 20260603-buyer-nav-html-only');

  var MDJ_ARTIST_RAIL_VARIANT_CORE = 'mdj-artist-rail-core-v2';
  var MDJ_ARTIST_RAIL_VARIANT_FULL = 'mdj-artist-rail-full-v2';

  window.MDJ_DISABLE_MAINNAV_INFINITE = true;

  try {
    var _mdjH = document.getElementById('mainHeader');
    if (_mdjH) _mdjH.classList.add('mdj-header-unified');
  } catch (eMdjH) {
    /* ignore */
  }

  function mdjClearAuthBootMask() {
    try {
      document.body.classList.remove('mdj-nav-booting');
      document.documentElement.classList.remove('mdj-auth-resolving');
      if (window.__mdjNavBootTimeout) {
        clearTimeout(window.__mdjNavBootTimeout);
        window.__mdjNavBootTimeout = null;
      }
      if (typeof window.mdjEnsureAccountSettingsOwnerStripNav === 'function') {
        window.mdjEnsureAccountSettingsOwnerStripNav();
      }
    } catch (e) { /* ignore */ }
  }

  /** Owner Config: #owner-tabs manda; anular fila #mainNav 8-pillar tras auth / inject. */
  function mdjEnsureAccountSettingsOwnerStripNav() {
    try {
      var page = (window.location.pathname.split('/').pop() || '').toLowerCase();
      if (page !== 'account-settings.html') return;
      if (!document.body || !document.body.classList.contains('mdj-from-profile')) return;
      var bar = document.querySelector('#mainHeader .header-nav');
      if (bar) {
        bar.style.setProperty('display', 'none', 'important');
        bar.style.setProperty('visibility', 'hidden', 'important');
        bar.style.setProperty('pointer-events', 'none', 'important');
      }
      var strip = document.getElementById('owner-tabs');
      if (strip) {
        strip.style.removeProperty('visibility');
        strip.style.removeProperty('opacity');
        strip.style.removeProperty('pointer-events');
        strip.setAttribute('data-mdj-no-marquee', '1');
        var cont = strip.querySelector('.container');
        if (cont) cont.setAttribute('data-mdj-no-marquee', '1');
      }
    } catch (e) { /* noop */ }
  }
  window.mdjEnsureAccountSettingsOwnerStripNav = mdjEnsureAccountSettingsOwnerStripNav;

  /* account-settings.html: strip artista desde el primer paint (antes del auth-chain). */
  (function mdjBootAccountSettingsProfileNavEarly() {
    try {
      var page = (window.location.pathname.split('/').pop() || '').toLowerCase();
      if (page !== 'account-settings.html' || !document.body) return;
      document.body.classList.add('mdj-from-profile');
      var bar = document.querySelector('#mainHeader .header-nav');
      if (bar) bar.style.setProperty('display', 'none', 'important');
    } catch (e) { /* noop */ }
  })();

  function mdjApplyAuthBootMask() {
    try {
      var hasMaybeSession = Object.keys(localStorage).some(function (k) {
        return k.indexOf('sb-') === 0 || k.indexOf('supabase') !== -1;
      });
      if (!hasMaybeSession) return;
      document.documentElement.classList.add('mdj-auth-resolving');
      document.body.classList.add('mdj-nav-booting');
      window.__mdjNavBootTimeout = setTimeout(mdjClearAuthBootMask, 2500);
    } catch (e) { /* ignore */ }
  }

  function mdjLoadAmbientMusicScript() {
    if (typeof window !== 'undefined' && window.MDJ_SKIP_AMBIENT_MUSIC) return;
    if (document.getElementById('mdj-ambient-music-script')) return;
    try {
      if (document.documentElement && document.documentElement.getAttribute('data-mdj-no-ambient') === '1') return;
    } catch (eAmb) {
      void eAmb;
    }

    function _injectAmbientScript() {
      if (document.getElementById('mdj-ambient-music-script')) return;
      var s = document.createElement('script');
      s.id = 'mdj-ambient-music-script';
      s.src = './js/mdj-ambient-music.js?v=20260513-cash-flow-no-ambient';
      s.async = true;
      (document.head || document.documentElement).appendChild(s);
    }

    if (typeof whenSupabaseReady === 'function') {
      whenSupabaseReady(function() {
        var sb = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : (window.supabase || null);
        if (sb) {
          sb.from('platform_settings')
            .select('key, value')
            .in('key', ['ambient_opening_file', 'ambient_vol_opening', 'ambient_jungle_file', 'ambient_vol_jungle'])
            .then(function(res) {
              if (res.data) {
                res.data.forEach(function(row) {
                  if (row.key === 'ambient_opening_file' && row.value) window.MDJ_AMBIENT_OPENING_FILE = row.value;
                  if (row.key === 'ambient_jungle_file' && row.value) window.MDJ_AMBIENT_JUNGLE_FILE = row.value;
                  if (row.key === 'ambient_vol_opening' && row.value !== '') window.MDJ_AMBIENT_VOL_OPENING = parseFloat(row.value);
                  if (row.key === 'ambient_vol_jungle' && row.value !== '') window.MDJ_AMBIENT_VOL_JUNGLE = parseFloat(row.value);
                });
              }
              _injectAmbientScript();
            })
            .catch(function() {
              _injectAmbientScript();
            });
        } else {
          _injectAmbientScript();
        }
      });
    } else {
      _injectAmbientScript();
    }
  }

  function mdjLoadForceMuteVideosScript() {
    if (typeof window !== 'undefined' && window.MDJ_SKIP_FORCE_MUTE_VIDEOS) return;
    if (document.getElementById('mdj-videos-force-mute-script')) return;
    try {
      if (document.documentElement && document.documentElement.getAttribute('data-mdj-no-force-mute-videos') === '1') {
        return;
      }
    } catch (eVm) {
      void eVm;
    }
    var sv = document.createElement('script');
    sv.id = 'mdj-videos-force-mute-script';
    sv.src = './js/mdj-videos-force-mute.js?v=20260421-force-mute-1';
    sv.async = true;
    (document.head || document.documentElement).appendChild(sv);
  }

  /**
   * Auth pills marcados con `data-auth-btn`: texto **fijo** según `document.documentElement.lang`
   * (sin translations JSON). `es` → ENTRAR/SALIR; cualquier otro (p. ej. `en`) → LOGIN/LOGOUT.
   * Estado sesión: `.danger` = logout.
   */
  window.updateAuthButtons = window.updateAuthButtons || function updateAuthButtons() {
    var root = document.documentElement;
    var raw = '';
    if (root) {
      raw = String(root.getAttribute('lang') || root.lang || '').trim().toLowerCase();
    }
    var isEs = raw === 'es' || raw.indexOf('es-') === 0;
    var txtIn = isEs ? 'ENTRAR' : 'LOGIN';
    var txtOut = isEs ? 'SALIR' : 'LOGOUT';
    document.querySelectorAll('[data-auth-btn]').forEach(function (btn) {
      var logout = btn.classList.contains('danger');
      btn.textContent = logout ? txtOut : txtIn;
    });
  };

  function mdjEnsureAuthLangObserver() {
    if (window.__mdjAuthLangObs || !document.documentElement) return;
    try {
      window.__mdjAuthLangObs = new MutationObserver(function () {
        if (typeof window.updateAuthButtons === 'function') window.updateAuthButtons();
      });
      window.__mdjAuthLangObs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['lang']
      });
    } catch (err) { /* ignore */ }
  }

  mdjEnsureAuthLangObserver();

  /**
   * Contrato menú comprador (anti-regresión) — todas las cuentas client_profiles.
   * Visible: home · services · events(venues) · shop · jobs · contact · client-config · mi-portal
   */
  window.MDJ_BUYER_MAINNAV_CONTRACT = Object.freeze({
    visible: Object.freeze([
      'home',
      'services',
      'venues',
      'shop',
      'client-config',
      'jobs',
      'contact',
      'mi-portal'
    ]),
    hidden: Object.freeze(['tools', 'staff', 'my-profile', 'agenda', 'flow', 'config'])
  });

  /**
   * Comprador (TODAS las cuentas cliente / client_profiles) — no solo un usuario.
   * Fuentes: isClient, mdjClassifyPlatformIdentity principal=buyer, JWT client, fila client_profiles sin staff.
   */
  /** Recorrido comprador (Home, Services, Events, …) — no cabecera artista `mdj_nav=profile`. */
  function mdjIsBuyerJourneyPage() {
    try {
      if (document.body && document.body.classList.contains('mdj-from-profile')) return false;
      var path = (window.location.pathname || '').split('/').pop() || '';
      path = String(path).toLowerCase();
      if (path === '' || path === 'index.html' || path === 'index') return true;
      return /^(rentals|services|events|shop|jobs|client-account|client-portal|client-billing)\.html$/i.test(path);
    } catch (e) {
      return false;
    }
  }

  function mdjResolveBuyerSession(opts) {
    opts = opts || {};
    if (opts.isDjStaff || opts.isNavStaffSolo) return false;
    if (opts.isClient === true) return true;
    var idn = opts.idn;
    if (idn && idn.principal === 'buyer') return true;
    /* DB wins: si existe dj_profiles con rol no-cliente, el JWT 'client' en app_metadata no fuerza buyer session. */
    if ((opts.sessionIsExplicitClient || opts.metadataSaysClient) && !opts.hasDjProfile) return true;
    if (idn && idn.hasClientRow && !opts.hasDjProfile) return true;
    if (idn && idn.hasClientRow && (idn.dbRole === 'client' || idn.dbRole === 'cliente')) return true;
    if (opts.clientRow && !opts.hasDjProfile) return true;
    /* client_profiles en recorrido público comprador (p. ej. Wendy con dj_profiles paralelo). */
    if (opts.hasClientRow && !opts.hasDjProfile && mdjIsBuyerJourneyPage()) return true;
    try {
      var su = String(opts.settingsUrl || '');
      if (su.indexOf('client-account') !== -1 || su.indexOf('client-portal') !== -1) return true;
    } catch (e) { /* ignore */ }
    return false;
  }

  function mdjHideMainNavSlot(el) {
    if (!el) return;
    if (el.id !== 'mainNav-config-link' && el.id !== 'mainNav-mi-portal-link') {
      el.classList.add('mdj-mainnav-reserved-slot');
    }
    if (el.id === 'mainNav-mi-portal-link') {
      el.classList.add('mdj-mi-portal--guest');
    }
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('tabindex', '-1');
    el.style.removeProperty('visibility');
    el.style.removeProperty('pointer-events');
  }

  function mdjRevealMainNavSlot(el) {
    if (!el) return;
    var buyerPhantom =
      el.id === 'mainNav-config-link' || el.id === 'mainNav-mi-portal-link';
    if (!buyerPhantom) {
      el.classList.remove('mdj-mainnav-reserved-slot');
    }
    el.removeAttribute('aria-hidden');
    el.removeAttribute('tabindex');
    el.style.removeProperty('display');
    el.style.removeProperty('visibility');
    el.style.removeProperty('pointer-events');
    if (buyerPhantom) {
      el.classList.remove('mdj-mi-portal--guest', 'mdj-mi-portal--hydrating');
    }
  }

  /** Matriz fija comprador: Home · Services · Events · Shop · CONFIG · Jobs · Contact · MI PORTAL */
  function mdjApplyBuyerSessionMainNav(portalHref) {
    var nav = document.getElementById('mainNav');
    if (!nav) return;
    var compactNav = nav.getAttribute('data-mdj-compact-nav') === '1';

    ['home', 'services', 'venues', 'shop', 'jobs', 'contact'].forEach(function (key) {
      nav.querySelectorAll('a[data-mdj-nav="' + key + '"]').forEach(mdjRevealMainNavSlot);
    });

    var venues = nav.querySelector('a[data-mdj-nav="venues"]');
    if (!venues && !compactNav) {
      venues = document.createElement('a');
      venues.setAttribute('data-mdj-nav', 'venues');
      venues.setAttribute('data-i18n', 'nav-rentals');
      var afterSvc = nav.querySelector('a[data-mdj-nav="services"]');
      var beforeShop = nav.querySelector('a[data-mdj-nav="shop"]');
      if (afterSvc && afterSvc.parentNode === nav) {
        nav.insertBefore(venues, afterSvc.nextSibling);
      } else if (beforeShop && beforeShop.parentNode === nav) {
        nav.insertBefore(venues, beforeShop);
      } else {
        nav.appendChild(venues);
      }
      try {
        var es = document.documentElement && String(document.documentElement.lang || '').toLowerCase().indexOf('es') === 0;
        venues.textContent = es ? 'Eventos' : 'Events';
      } catch (eLbl) {
        venues.textContent = 'Events';
      }
    }
    if (venues) {
      venues.setAttribute('href', './events.html');
      mdjRevealMainNavSlot(venues);
    }

    ['tools', 'staff', 'my-profile', 'agenda', 'flow'].forEach(function (key) {
      nav.querySelectorAll('a[data-mdj-nav="' + key + '"]').forEach(mdjHideMainNavSlot);
    });
    mdjHideMainNavSlot(document.getElementById('mainNav-guest-mi-perfil-link'));
    mdjHideMainNavSlot(document.getElementById('mainNav-staff-or-profile'));
    mdjHideMainNavSlot(document.getElementById('mainNav-staff-link'));
    mdjApplyStaffMainNavLink(false);

    mdjApplyBuyerConfigMainNavLink(true);
    mdjEnsureMiPortalInMainNav(portalHref || './client-portal.html', null);
    mdjRevealMainNavSlot(document.getElementById('mainNav-config-link'));
    mdjRevealMainNavSlot(document.getElementById('mainNav-mi-portal-link'));

    var hdr = document.getElementById('mainHeader');
    if (hdr) {
      hdr.querySelectorAll('#mainNav a[href*="dj-tools"], #mainNav a[data-mdj-nav="tools"]').forEach(mdjHideMainNavSlot);
    }

    /* Orden comprador viene del HTML de cada página — sin appendChild/insertBefore (anti-brinco). */
    mdjInstallMainNavStaticMode();
  }

  /**
   * Matriz MDJ: PRO desbloqueado solo con **artist_pro** (`__mdjProToolsUnlocked` para `dj-tools.html`).
   * La pestaña DJ Tools **siempre** en #mainNav (misma fila que Home, Jobs, etc.); cliente/LITE ven muros en la página.
   * `window.__mdjLastNavTier` / `__mdjLastNavIsClient` (retro) para `dj-tools.html`.
   */
  function mdjApplyDjToolsNavForTier(navTier) {
    window.__mdjLastNavTier = navTier == null ? null : String(navTier);
    var pro = navTier === 'artist_pro';
    window.__mdjProToolsUnlocked = !!pro;
    var buyerNav = window.__mdjLastBuyerSession === true;
    window.__mdjLastNavIsClient = navTier === 'client_only' || buyerNav;
    document.body.classList.toggle('mdj-is-client', navTier === 'client_only' || buyerNav);
    try {
      document.body.classList.toggle('mdj-buyer-session', buyerNav);
    } catch (eBs) { void eBs; }
    var _isClient = navTier === 'client_only' || buyerNav;
    var _nav = document.getElementById('mainNav');
    /* Comprador: DJ Tools fuera del #mainNav en cualquier página (Home, Events, Services, …). */
    var _clientHideDjTools = buyerNav && !!_nav;
    var hideLink = false;
    var header = document.getElementById('mainHeader');
    if (!header) return;
    header.querySelectorAll('a[href*="dj-tools"]').forEach(function (a) {
      var inMainNav = a.closest && a.closest('#mainNav');
      if (_clientHideDjTools && inMainNav) {
        a.classList.add('mdj-mainnav-reserved-slot');
        a.setAttribute('aria-hidden', 'true');
        a.setAttribute('tabindex', '-1');
        return;
      }
      if (!hideLink) {
        a.style.removeProperty('display');
        a.style.removeProperty('visibility');
        a.style.removeProperty('pointer-events');
        a.removeAttribute('aria-hidden');
        a.removeAttribute('data-mdj-tools-suppressed');
        a.removeAttribute('tabindex');
        return;
      }
      /* #mainNav: nunca display:none (colapsa la celda 120px) — solo visibility. */
      if (inMainNav) {
        a.style.removeProperty('display');
        a.style.visibility = 'hidden';
        a.style.pointerEvents = 'none';
        a.setAttribute('aria-hidden', 'true');
        a.setAttribute('data-mdj-tools-suppressed', '1');
        a.setAttribute('tabindex', '-1');
      } else {
        a.style.display = 'none';
        a.setAttribute('aria-hidden', 'true');
        a.setAttribute('data-mdj-tools-suppressed', '1');
      }
    });
    mdjHydrateMainNavDjToolsHref();
  }

  /** Satélites artista (Jobs / Shop / DJ Tools): preserva ?mdj_nav=profile sin tocar otras queries. */
  /**
   * Producto: Events vive en events.html (acceso vía menú artista / enlaces directos).
   * Quitar pestaña Events del #mainNav público en todas las páginas con cabecera unificada.
   */
  function mdjStripPublicEventsFromMainNav() {
    try {
      /* En events.html, index.html, y páginas con nav compacto: Events permanece visible. */
      if (mdjIsGuestHomeNavPage() || mdjIsPublicHomePage() || mdjIsZeroLoginGuestNavPage()) { return; }
      if (window.__mdjLastBuyerSession === true) { return; }
      var _nav = document.getElementById('mainNav');
      if (_nav && (_nav.getAttribute('data-mdj-compact-nav') === '1' || _nav.getAttribute('data-mdj-portal-in-nav') === '1')) {
        return;
      }
      var sel =
        '#mainNav a[data-mdj-nav="venues"], ' +
        '.mobile-nav a[data-mdj-nav="venues"], ' +
        '#mobileMenu a[data-mdj-nav="venues"]';
      document.querySelectorAll(sel).forEach(function (el) {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
      mdjInstallMainNavStaticMode();
    } catch (e) {
      /* noop */
    }
  }

  /** Desactiva carrusel infinito / scroll horizontal en #mainNav (producto: riel estático). */
  function mdjDestroyMainNavInfinite() {
    try {
      var nav = document.getElementById('mainNav');
      if (nav) {
        nav.classList.remove('mdj-mainnav-infinite--on');
        nav.querySelectorAll('a.mdj-mainnav-infinite-clone').forEach(function (a) {
          a.remove();
        });
        try {
          nav.style.maxWidth = '';
        } catch (eMw) {
          void eMw;
        }
      }
      var bar = document.querySelector('#mainHeader .header-nav');
      if (bar) {
        bar.classList.remove('mdj-mainnav-infinite--ui');
        bar.querySelectorAll('.mdj-mainnav-infinite-chevron').forEach(function (b) {
          b.remove();
        });
      }
    } catch (e) {
      /* noop */
    }
  }

  function mdjInstallMainNavStaticMode() {
    window.MDJ_DISABLE_MAINNAV_INFINITE = true;
    mdjDestroyMainNavInfinite();
    window.mdjReinitMainNavInfinite = function () {
      mdjDestroyMainNavInfinite();
    };
  }

  /**
   * index.html (body.page-home): fila pública #mainNav sin recortes.
   * 7 visibles con sesión artista: Inicio · Servicios · Shop · DJ Tools · Jobs · Contacto · MI PERFIL.
   * CONFIG/Agenda/Flow/Events no van en esta fila (Events → events.html; CONFIG → perfil / fila artista).
   */
  function mdjNormalizePublicHomeMainNav() {
    if (!mdjIsPublicHomePage()) return;
    var nav = document.getElementById('mainNav');
    if (!nav) return;
    try {
      /* venues tab en Home: apuntar a la página independiente events.html (no el anchor viejo #experience). */
      nav.querySelectorAll('a[data-mdj-nav="venues"]').forEach(function (el) {
        el.setAttribute('href', './events.html');
      });
      ['agenda', 'flow'].forEach(function (key) {
        nav.querySelectorAll('a[data-mdj-nav="' + key + '"]').forEach(function (a) {
          a.classList.add('mdj-mainnav-reserved-slot');
          a.setAttribute('aria-hidden', 'true');
          a.setAttribute('tabindex', '-1');
        });
      });
      /* MI PORTAL en Home para comprador; artistas/staff usan CONFIG / MI PERFIL. */
      var _isClientHome = !!window.__mdjLastNavIsClient || window.__mdjLastBuyerSession === true;
      if (!_isClientHome) {
        nav.querySelectorAll('a[data-mdj-nav="mi-portal"]').forEach(function (a) {
          a.classList.add('mdj-mainnav-reserved-slot');
          a.setAttribute('aria-hidden', 'true');
          a.setAttribute('tabindex', '-1');
        });
      }
      if (window.showMyArtisticProfileMainNav) {
        var mi = mdjEnsureGuestMiPerfilMainNavLink();
        if (mi) {
          mi.classList.remove('mdj-mainnav-reserved-slot');
          mi.removeAttribute('aria-hidden');
          mi.removeAttribute('tabindex');
          mi.style.removeProperty('display');
          mi.style.removeProperty('visibility');
          mi.style.removeProperty('pointer-events');
          var contact = nav.querySelector('a[data-mdj-nav="contact"]');
          if (contact && contact.parentNode === nav) {
            if (contact.nextSibling !== mi) {
              if (contact.nextSibling) nav.insertBefore(mi, contact.nextSibling);
              else nav.appendChild(mi);
            }
          } else if (nav.lastElementChild !== mi) {
            nav.appendChild(mi);
          }
        }
      }
      mdjInstallMainNavStaticMode();
    } catch (eHomeNav) {
      /* noop */
    }
  }

  /** Tras hidratar sesión: marcar Events activo en events.html (data-mdj-nav=venues). */
  function mdjHighlightEventsPageNav() {
    if (!mdjIsGuestHomeNavPage()) return;
    if (document.body && document.body.classList.contains('mdj-artist-header-mode')) return;
    try {
      document.querySelectorAll('#mainNav a[data-mdj-nav="venues"], .mobile-nav a[data-mdj-nav="venues"]').forEach(function (el) {
        el.classList.add('active');
      });
      document.querySelectorAll('#mainNav a[data-mdj-nav]:not([data-mdj-nav="venues"])').forEach(function (el) {
        el.classList.remove('active');
      });
    } catch (e) {
      /* noop */
    }
  }

  /** Home público (index): #mainNav guest con MI PERFIL; no sustituir por #mainNav-artist. */
  function mdjIsPublicHomePage() {
    try {
      if (document.body && document.body.classList.contains('page-home')) return true;
      var path = (window.location.pathname || '').split('/').pop() || '';
      path = String(path).toLowerCase();
      return path === '' || path === 'index.html' || path === 'index';
    } catch (e) {
      return false;
    }
  }

  /** events.html — resaltado #mainNav guest (invitado/comprador); artista usa #mainNav-artist (ART-004). */
  function mdjIsGuestHomeNavPage() {
    try {
      var path = (window.location.pathname || '').split('/').pop() || '';
      return String(path).toLowerCase() === 'events.html';
    } catch (e) {
      return false;
    }
  }

  /** 6 páginas públicas guest: Inicio · Servicios · Eventos · Shop · Trabajos · Contacto (+ CONFIG/MI PERFIL vía JS). */
  function mdjIsZeroLoginGuestNavPage() {
    try {
      if (mdjIsPublicHomePage() || mdjIsGuestHomeNavPage()) return true;
      var path = (window.location.pathname || '').split('/').pop() || '';
      path = String(path).toLowerCase();
      return /^(rentals|services|shop|jobs|contact)\.html$/i.test(path);
    } catch (e) {
      return false;
    }
  }

  function mdjArtistNavWithProfileContext(relPath) {
    try {
      var u = new URL(relPath, window.location.href);
      u.searchParams.set('mdj_nav', 'profile');
      var file = u.pathname.replace(/^.*\//, '') || '';
      return './' + file + u.search + (u.hash || '');
    } catch (e) {
      var sep = relPath.indexOf('?') >= 0 ? '&' : '?';
      return relPath + sep + 'mdj_nav=profile';
    }
  }

  /** Perfil artístico público (QR / enlace externo) — no confundir con portal operativo del artista. */
  function mdjBuildArtistPublicProfileHref() {
    var uid = window.__mdjNavOwnUserId ? String(window.__mdjNavOwnUserId) : '';
    if (uid) {
      return './dj-profile.html?id=' + encodeURIComponent(uid) + '&mdj_nav=profile';
    }
    return './dj-profile.html?mdj_nav=profile';
  }

  /** Riel artista #mainNav-artist — MI PERFIL → perfil artístico real (no Agenda ni CONFIG). */
  function mdjBuildArtistMainNavMiPerfilHref() {
    var uid = window.__mdjNavOwnUserId ? String(window.__mdjNavOwnUserId).trim() : '';
    if (uid) {
      return './dj-profile.html?id=' + encodeURIComponent(uid);
    }
    return './dj-profile.html';
  }

  /** Legacy portal href — no usar en #mainNav-artist MI PERFIL (A-1). */
  function mdjBuildArtistPortalMainNavHref() {
    var uid = window.__mdjNavOwnUserId ? String(window.__mdjNavOwnUserId).trim() : '';
    if (uid) {
      return './dj-dashboard.html?id=' + encodeURIComponent(uid);
    }
    return './dj-dashboard.html';
  }

  /** Edificio Staff: ART-007B/C no aplican — navegación interna aprobada intacta. */
  function mdjIsStaffBuildingPage() {
    try {
      var page = (window.location.pathname.split('/').pop() || '').toLowerCase();
      return page === 'admin-dashboard.html' || page === 'account-profile.html';
    } catch (eSb) {
      return false;
    }
  }

  /** Login staff entry — flag mdj_staff_entry evita cadena auth → CONFIG artista (ART-007B). */
  function mdjBuildStaffEntryLoginHref() {
    return './login.html?next=./admin-dashboard.html&mdj_staff_entry=1';
  }

  /** Riel artista #mainNav-artist — STAFF → puerta edificio staff (no CONFIG). */
  function mdjBuildArtistStaffMainNavHref() {
    var idn = window.__mdjLastPlatformIdentity;
    if (idn && idn.staffInDb) {
      return './admin-dashboard.html';
    }
    return mdjBuildStaffEntryLoginHref();
  }

  /** Riel #mainNav-artist — DJ TOOLS: artista logueado → perfil; guest → página pública (ART-011). */
  function mdjBuildArtistMainNavDjToolsHref() {
    if (mdjHasActiveArtistSessionId() && mdjResolveShowMyArtisticProfileMainNav({ allowUidFallback: true })) {
      return mdjArtistNavWithProfileContext('./dj-tools.html');
    }
    return './dj-tools.html';
  }

  /**
   * ART-011B: #mainNav guest/Home — DJ TOOLS href según sesión (misma regla que #mainNav-artist).
   * Solo cuando el riel visible es #mainNav; si #mainNav-artist está activo, ART-011 manda.
   */
  function mdjHydrateMainNavDjToolsHref() {
    var nav = document.getElementById('mainNav');
    if (!nav) return;
    var el = nav.querySelector('a[data-mdj-nav="tools"]');
    if (!el) return;
    if (document.body && document.body.classList.contains('mdj-artist-header-mode')) {
      var artistNav = document.getElementById('mainNav-artist');
      if (artistNav && !artistNav.hidden) return;
    }
    try {
      el.setAttribute('href', mdjBuildArtistMainNavDjToolsHref());
    } catch (eDjToolsMainHref) {
      /* ignore */
    }
  }

  /**
   * Puente runtime: expone window.showMyArtisticProfileMainNav (consola / Home).
   * Si la variable local no existe aún, infiere artista por __mdjNavOwnUserId + __mdjLastNavTier.
   */
  function mdjResolveShowMyArtisticProfileMainNav(ctx) {
    ctx = ctx || {};
    var isClient = ctx.isClient === true || window.__mdjLastNavIsClient === true;
    var isNavStaffSolo =
      ctx.isNavStaffSolo === true ||
      !!(window.__mdjLastPlatformIdentity && window.__mdjLastPlatformIdentity.navStaffSolo);
    var navTier =
      ctx.navTier != null && ctx.navTier !== ''
        ? String(ctx.navTier)
        : window.__mdjLastNavTier != null
          ? String(window.__mdjLastNavTier)
          : '';
    var uid = window.__mdjNavOwnUserId ? String(window.__mdjNavOwnUserId).trim() : '';
    var byTier =
      !isClient && !isNavStaffSolo && (navTier === 'artist_lite' || navTier === 'artist_pro');
    var byUid = !!uid && !isClient && !isNavStaffSolo;
    var show = byTier || (byUid && ctx.allowUidFallback !== false);
    window.showMyArtisticProfileMainNav = !!show;
    return window.showMyArtisticProfileMainNav;
  }

  function mdjHasActiveArtistSessionId() {
    return !!(window.__mdjNavOwnUserId && String(window.__mdjNavOwnUserId).trim());
  }

  function mdjApplyMiPerfilNavLabel(el) {
    if (!el) return;
    el.setAttribute('data-i18n', 'nav-my-profile');
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var tx = window.i18n.t('nav-my-profile');
        if (tx) el.textContent = tx;
        else {
          var rawF = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
          el.textContent = rawF.indexOf('es') === 0 ? 'MI PERFIL' : 'MY PROFILE';
        }
      } else {
        var raw = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
        el.textContent = raw.indexOf('es') === 0 ? 'MI PERFIL' : 'MY PROFILE';
      }
    } catch (e) {
      el.textContent = 'MY PROFILE';
    }
  }

  /**
   * Markup del riel artista (#mainNav-artist): solo <a>, orden fijo en HTML (sin reorder DOM).
   * INICIO · SERVICIOS · EVENTOS · SHOP · CONFIG · TRABAJOS · DJ TOOLS · CONTACTO · MI PERFIL · STAFF
   * SCHEDULE no pertenece a esta barra (solo barra interna MI PERFIL / #owner-tabs).
   */
  function mdjArtistMainNavLinksHtml(includeMiPerfil) {
    var miPerfilCell = '';
    if (includeMiPerfil) {
      miPerfilCell =
        '<a href="' +
        mdjBuildArtistMainNavMiPerfilHref() +
        '" id="mainNav-artist-mi-perfil-link" class="mdj-artist-nav-cell" data-mdj-artist-nav="my-profile" data-i18n="nav-my-profile">MI PERFIL</a>';
    }
    var staffCell =
      '<a href="' +
      mdjBuildArtistStaffMainNavHref() +
      '" id="mainNav-artist-staff-link" class="mdj-artist-nav-cell" data-mdj-artist-nav="staff" data-i18n="nav-staff">STAFF</a>';
    return (
      '<a href="./index.html" class="mdj-artist-nav-cell" data-mdj-artist-nav="home" data-i18n="nav-home">Inicio</a>' +
      '<a href="./rentals.html" class="mdj-artist-nav-cell" data-mdj-artist-nav="services" data-i18n="nav-services">Servicios</a>' +
      '<a href="./events.html" class="mdj-artist-nav-cell" data-mdj-artist-nav="events" data-i18n="nav-rentals">Eventos</a>' +
      '<a href="./shop.html" class="mdj-artist-nav-cell" data-mdj-artist-nav="shop" data-i18n="nav-shop" style="color:var(--gold);font-weight:800;">Shop</a>' +
      '<a href="' +
      mdjArtistNavWithProfileContext('./account-settings.html') +
      '" class="mdj-artist-nav-cell" data-mdj-artist-nav="config" data-i18n="nav-config">⚙️ CONFIG</a>' +
      '<a href="./jobs.html" class="mdj-artist-nav-cell" data-mdj-artist-nav="jobs" data-i18n="nav-jobs">Trabajos</a>' +
      '<a href="' +
      mdjBuildArtistMainNavDjToolsHref() +
      '" class="mdj-artist-nav-cell" data-mdj-artist-nav="tools" data-i18n="nav-tools">DJ Tools</a>' +
      '<a href="./contact.html" class="mdj-artist-nav-cell" data-mdj-artist-nav="contact" data-i18n="nav-contact">Contacto</a>' +
      miPerfilCell +
      staffCell
    );
  }

  function mdjRefreshArtistNavHrefs(nav) {
    if (!nav) return;
    var byKey = {
      home: './index.html',
      services: './rentals.html',
      events: './events.html',
      shop: './shop.html',
      config: mdjArtistNavWithProfileContext('./account-settings.html'),
      jobs: './jobs.html',
      tools: mdjBuildArtistMainNavDjToolsHref(),
      contact: './contact.html',
      'my-profile': mdjBuildArtistMainNavMiPerfilHref(),
      staff: mdjBuildArtistStaffMainNavHref()
    };
    nav.querySelectorAll('a[data-mdj-artist-nav]').forEach(function (a) {
      var k = a.getAttribute('data-mdj-artist-nav');
      if (byKey[k]) a.setAttribute('href', byKey[k]);
    });
  }

  /** Render único del riel artista (variante core vs full con MI PERFIL). */
  function mdjRenderArtistNav(nav, includeMiPerfil) {
    if (!nav) return;
    var variant = includeMiPerfil ? MDJ_ARTIST_RAIL_VARIANT_FULL : MDJ_ARTIST_RAIL_VARIANT_CORE;
    if (nav.getAttribute('data-mdj-artist-rail-variant') !== variant) {
      nav.innerHTML = mdjArtistMainNavLinksHtml(!!includeMiPerfil);
      nav.setAttribute('data-mdj-artist-rail-variant', variant);
    }
    if (includeMiPerfil) {
      mdjApplyMiPerfilNavLabel(nav.querySelector('[data-mdj-artist-nav="my-profile"]'));
    }
    mdjRefreshArtistNavHrefs(nav);
    var staffArtistLink = nav.querySelector('[data-mdj-artist-nav="staff"]');
    if (staffArtistLink) mdjBindStaffNavClickGuard(staffArtistLink);
    try {
      if (window.i18n && typeof window.i18n.updateUI === 'function') {
        window.i18n.updateUI();
      }
    } catch (eI18nArtist) { /* ignore */ }
  }

  /**
   * Flujo único de sesión artista: #mainNav guest + riel artista (services, rentals, etc.).
   */
  function mdjApplyArtistSessionNav(show, profileHref) {
    window.showMyArtisticProfileMainNav = !!show;
    if (!show) {
      mdjApplyArtistDashboardNavChrome(false);
      var artistNavOff = document.getElementById('mainNav-artist');
      if (artistNavOff) mdjRenderArtistNav(artistNavOff, false);
      return;
    }
    var href =
      profileHref && String(profileHref).trim()
        ? mdjNormalizeArtistProfileNavHref(profileHref)
        : mdjBuildArtistPublicProfileHref();
    mdjEnsureGuestMiPerfilMainNavLink();
    mdjApplyArtistDashboardNavChrome(true, href);
    var artistNavOn = document.getElementById('mainNav-artist');
    if (artistNavOn && !artistNavOn.hidden) {
      mdjRenderArtistNav(artistNavOn, true);
    }
    if (mdjIsPublicHomePage()) {
      mdjNormalizePublicHomeMainNav();
    }
  }

  function mdjHydrateArtistSessionIdFromSupabase() {
    if (mdjHasActiveArtistSessionId()) {
      return Promise.resolve(String(window.__mdjNavOwnUserId).trim());
    }
    var sb = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
    if (!sb || !sb.auth || typeof sb.auth.getSession !== 'function') {
      return Promise.resolve('');
    }
    return sb.auth
      .getSession()
      .then(function (res) {
        var sess = res && res.data && res.data.session;
        var id = sess && sess.user && sess.user.id ? String(sess.user.id).trim() : '';
        if (!id) return '';
        var metaUt =
          sess.user && sess.user.user_metadata && sess.user.user_metadata.user_type
            ? String(sess.user.user_metadata.user_type).toLowerCase()
            : '';
        var appRole =
          sess.user && sess.user.app_metadata && sess.user.app_metadata.role
            ? String(sess.user.app_metadata.role).toLowerCase()
            : '';
        if (metaUt === 'client' || appRole === 'client') return '';
        window.__mdjNavOwnUserId = id;
        return id;
      })
      .catch(function () {
        return '';
      });
  }

  /** Autodetección global: __mdjNavOwnUserId o Supabase → MI PERFIL en todas las vistas públicas. */
  function mdjAutodetectArtistMiPerfilNav() {
    return mdjHydrateArtistSessionIdFromSupabase().then(function (id) {
      var show = mdjResolveShowMyArtisticProfileMainNav({ allowUidFallback: true });
      var href = id
        ? './dj-profile.html?id=' + encodeURIComponent(id) + '&mdj_nav=profile'
        : mdjBuildArtistPublicProfileHref();
      mdjApplyArtistSessionNav(show, href);
      if (!show) {
        mdjRevealGuestMiPerfilNavSlot();
      }
      /* Staff: MI PERFIL destination by sub-role.
         Owner  → public manager profile (dj-profile.html?id=uid).
         Other staff (admin/manager/seller) → internal account panel. */
      var _staffIdn = window.__mdjLastPlatformIdentity;
      if (_staffIdn && _staffIdn.staffInDb) {
        var _gmpStaff = document.getElementById('mainNav-guest-mi-perfil-link');
        if (_gmpStaff) {
          var _ownUid = window.__mdjNavOwnUserId ? String(window.__mdjNavOwnUserId).trim() : '';
          var _role = String(_staffIdn.dbRole || '').toLowerCase();
          var _isOwnerDbRole = _role === 'owner' || _role === 'admin' || _role === 'manager';
          if (_isOwnerDbRole && _ownUid) {
            _gmpStaff.href = './dj-profile.html?id=' + encodeURIComponent(_ownUid);
          } else {
            _gmpStaff.href = './account-settings.html';
          }
        }
      }
      return show;
    });
  }

  function mdjBridgeArtistMiPerfilPublicNav(profileHref) {
    var show =
      !!mdjHasActiveArtistSessionId() ||
      mdjResolveShowMyArtisticProfileMainNav({ allowUidFallback: true });
    mdjApplyArtistSessionNav(show, profileHref);
  }

  function mdjBridgeHomeMiPerfilNav(profileHref) {
    return mdjBridgeArtistMiPerfilPublicNav(profileHref);
  }

  function mdjAutodetectHomeArtistSession() {
    return mdjAutodetectArtistMiPerfilNav();
  }

  function mdjBodyHasProfileNavContext() {
    try {
      if (document.body && document.body.classList.contains('mdj-from-profile')) return true;
      return new URLSearchParams(window.location.search || '').get('mdj_nav') === 'profile';
    } catch (e) {
      return false;
    }
  }

  /** Fila 2 artista (#mainNav-artist): 8 enlaces core; invitado #mainNav oculto sin CLS. */
  function mdjEnsureArtistMainNav() {
    var headerNav = document.querySelector('#mainHeader .header-nav .container');
    if (!headerNav) return null;
    var existing = document.getElementById('mainNav-artist');
    if (existing) return existing;
    var nav = document.createElement('nav');
    nav.id = 'mainNav-artist';
    nav.className = 'nav top-nav mdj-artist-mainnav';
    nav.setAttribute('aria-label', 'Navegación de artista');
    nav.hidden = true;
    nav.setAttribute('aria-hidden', 'true');
    mdjRenderArtistNav(nav, false);
    var guestNav = document.getElementById('mainNav');
    if (guestNav && guestNav.parentNode === headerNav) {
      headerNav.insertBefore(nav, guestNav.nextSibling);
    } else {
      headerNav.appendChild(nav);
    }
    return nav;
  }

  function mdjNavHighlightArtist() {
    var nav = document.getElementById('mainNav-artist');
    if (!nav || nav.hidden) return;
    var path = '';
    try {
      path = (window.location.pathname || '').split('/').pop() || '';
    } catch (e) {
      path = '';
    }
    path = String(path).toLowerCase();
    var key = '';
    if (path === 'index.html' || path === '' || path === 'index') key = 'home';
    else if (path === 'rentals.html' || path === 'services.html') key = 'services';
    else if (path === 'events.html') key = 'events';
    else if (path === 'jobs.html') key = 'jobs';
    else if (path === 'shop.html') key = 'shop';
    else if (path === 'dj-tools.html') key = 'tools';
    else if (path === 'contact.html') key = 'contact';
    else if (path === 'account-settings.html') key = 'config';
    else if (path === 'dj-dashboard.html') {
      nav.querySelectorAll('a[data-mdj-artist-nav]').forEach(function (el) {
        var k = el.getAttribute('data-mdj-artist-nav');
        el.classList.toggle('active', k === 'my-profile');
      });
      return;
    } else if (path === 'admin-dashboard.html' || path === 'account-profile.html') {
      nav.querySelectorAll('a[data-mdj-artist-nav]').forEach(function (el) {
        var k = el.getAttribute('data-mdj-artist-nav');
        el.classList.toggle('active', k === 'staff');
      });
      return;
    }
    nav.querySelectorAll('a[data-mdj-artist-nav]').forEach(function (el) {
      el.classList.toggle('active', !!key && el.getAttribute('data-mdj-artist-nav') === key);
    });
  }

  /**
   * Modo cabecera artista: body.mdj-artist-header-mode + #mainNav-artist (fila 2).
   * Con ?mdj_nav=profile la franja #owner-tabs manda; no duplicar fila 2 en .header-nav.
   */
  function mdjApplyArtistHeaderRow2(enabled) {
    var guestNav = document.getElementById('mainNav');
    var artistNav = mdjEnsureArtistMainNav();
    var fromProfile = mdjBodyHasProfileNavContext();

    if (enabled) {
      document.body.classList.add('mdj-artist-header-mode');
      if (!fromProfile) {
        if (guestNav) {
          guestNav.setAttribute('aria-hidden', 'true');
          guestNav.setAttribute('data-mdj-guest-nav-suppressed', '1');
        }
        if (artistNav) {
          artistNav.hidden = false;
          artistNav.removeAttribute('aria-hidden');
          mdjRenderArtistNav(artistNav, !!window.showMyArtisticProfileMainNav);
        }
        mdjNavHighlightArtist();
      } else {
        if (guestNav) {
          guestNav.setAttribute('aria-hidden', 'true');
          guestNav.setAttribute('data-mdj-guest-nav-suppressed', '1');
        }
        if (artistNav) {
          artistNav.hidden = true;
          artistNav.setAttribute('aria-hidden', 'true');
        }
      }
      return;
    }

    document.body.classList.remove('mdj-artist-header-mode');
    if (guestNav) {
      guestNav.removeAttribute('aria-hidden');
      guestNav.removeAttribute('data-mdj-guest-nav-suppressed');
    }
    if (artistNav) {
      artistNav.hidden = true;
      artistNav.setAttribute('aria-hidden', 'true');
      artistNav.querySelectorAll('a[data-mdj-artist-nav]').forEach(function (el) {
        el.classList.remove('active');
      });
    }
  }

  /** MI PERFIL en #mainNav público: hueco fijo → ./dj-profile.html?mdj_nav=profile */
  function mdjEnsureGuestMiPerfilMainNavLink() {
    var nav = document.getElementById('mainNav');
    if (!nav) return null;
    var el = document.getElementById('mainNav-guest-mi-perfil-link');
    var legacy = document.getElementById('mainNav-artist-dashboard-link');
    if (legacy && !el) {
      legacy.id = 'mainNav-guest-mi-perfil-link';
      el = legacy;
    }
    if (!el) {
      el = document.createElement('a');
      el.id = 'mainNav-guest-mi-perfil-link';
      el.setAttribute('data-mdj-nav', 'my-profile');
      el.setAttribute('data-i18n', 'nav-my-profile');
      el.className = 'mdj-guest-mi-perfil-mainnav mdj-mainnav-reserved-slot';
      var insBefore = mdjGetMainNavStaffAnchor();
      if (insBefore && insBefore.parentNode === nav) {
        nav.insertBefore(el, insBefore);
      } else {
        var ref = document.getElementById('mainNav-mi-portal-link');
        if (ref && ref.parentNode === nav) {
          if (ref.nextSibling) nav.insertBefore(el, ref.nextSibling);
          else nav.appendChild(el);
        } else {
          nav.appendChild(el);
        }
      }
    }
    el.href = mdjBuildArtistPublicProfileHref();
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var tx = window.i18n.t('nav-my-profile');
        if (tx) el.textContent = tx;
      } else {
        var raw = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
        el.textContent = raw.indexOf('es') === 0 ? 'MI PERFIL' : 'MY PROFILE';
      }
    } catch (eLbl) {
      el.textContent = 'MY PROFILE';
    }
    return el;
  }

  function mdjNormalizeArtistProfileNavHref(href) {
    try {
      var u = new URL(String(href).trim(), window.location.href);
      if (!u.searchParams.get('mdj_nav')) u.searchParams.set('mdj_nav', 'profile');
      var file = u.pathname.replace(/^.*\//, '') || 'dj-profile.html';
      return './' + file + u.search + (u.hash || '');
    } catch (e) {
      return mdjBuildArtistPublicProfileHref();
    }
  }

  function mdjHideGuestMiPerfilMainNavSlot() {
    var el = document.getElementById('mainNav-guest-mi-perfil-link');
    if (!el) return;
    el.classList.add('mdj-mainnav-reserved-slot');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('tabindex', '-1');
    el.style.removeProperty('display');
  }

  /** Guest state: MI PERFIL is the sole desktop nav login entry. Call after every guest-state finalization. */
  function mdjRevealGuestMiPerfilNavSlot() {
    var el = document.getElementById('mainNav-guest-mi-perfil-link') || mdjEnsureGuestMiPerfilMainNavLink();
    if (!el) return;
    var _idn = window.__mdjLastPlatformIdentity;
    el.href = (_idn && _idn.staffInDb) ? './account-settings.html' : './login.html';
    el.classList.remove('mdj-mainnav-reserved-slot');
    el.removeAttribute('aria-hidden');
    el.removeAttribute('tabindex');
    el.style.removeProperty('display');
    el.style.removeProperty('visibility');
    el.style.removeProperty('pointer-events');
  }

  /** Móvil: quitar nodo duplicado. Escritorio: nunca quitar #mainNav-guest-mi-perfil-link (hueco fijo). */
  function mdjRemoveArtistDashboardNavLinks() {
    mdjHideGuestMiPerfilMainNavSlot();
    var artistNav = document.getElementById('mainNav-artist');
    if (artistNav) mdjRenderArtistNav(artistNav, false);
    var mb = document.getElementById('header-artist-dashboard-mobile');
    if (mb) mb.remove();
  }

  /** STAFF en #mainNav: el HTML usa `mainNav-staff-link` (admin) o `mainNav-staff-or-profile` (sitio unificado). */
  function mdjGetMainNavStaffAnchor() {
    return document.getElementById('mainNav-staff-link') || document.getElementById('mainNav-staff-or-profile');
  }

  /** Aplica href STAFF unificado (ART-007B) + guard — solo edificio artista. */
  function mdjApplyStaffNavHref(el) {
    if (!el || mdjIsStaffBuildingPage()) return;
    var href = mdjBuildArtistStaffMainNavHref();
    try {
      el.setAttribute('href', href);
    } catch (eH) {
      el.href = href;
    }
    try {
      if (!el.getAttribute('data-mdj-nav')) el.setAttribute('data-mdj-nav', 'staff');
    } catch (eA) { /* ignore */ }
    mdjBindStaffNavClickGuard(el);
  }

  /** Todos los nodos STAFF del edificio artista (riel, #mainNav, #owner-tabs). */
  function mdjRefreshAllStaffNavLinks() {
    if (mdjIsStaffBuildingPage()) return;
    try {
      var seen = typeof Set === 'function' ? new Set() : null;
      var sels = [
        '#mainNav-artist a[data-mdj-artist-nav="staff"]',
        '#owner-tabs a[data-mdj-nav="staff"]',
        '#mainNav-staff-or-profile',
        '#mainNav-staff-link',
        'a[data-mdj-nav="staff"]'
      ];
      sels.forEach(function (sel) {
        document.querySelectorAll(sel).forEach(function (el) {
          if (!el || el.tagName !== 'A') return;
          if (seen) {
            if (seen.has(el)) return;
            seen.add(el);
          }
          var hidden =
            el.classList.contains('mdj-mainnav-reserved-slot') &&
            el.getAttribute('aria-hidden') === 'true';
          if (hidden) {
            mdjBindStaffNavClickGuard(el);
            return;
          }
          mdjApplyStaffNavHref(el);
        });
      });
    } catch (eR) { /* ignore */ }
  }

  /** Alias histórico — mismo refresco global. */
  function mdjRefreshOwnerStripStaffLinks() {
    mdjRefreshAllStaffNavLinks();
  }

  /**
   * Capture único: cualquier STAFF usa mdjBuildArtistStaffMainNavHref al click (ART-007B).
   * Cubre owner-tabs / perfil artístico aunque un poll legacy no haya refrescado el href.
   */
  function mdjInstallGlobalStaffNavCapture() {
    if (window.__mdjStaffNavCaptureInstalled) return;
    window.__mdjStaffNavCaptureInstalled = true;
    document.addEventListener(
      'click',
      function (e) {
        if (mdjIsStaffBuildingPage()) return;
        var t =
          e.target && e.target.closest
            ? e.target.closest(
                'a[data-mdj-nav="staff"], a[data-mdj-artist-nav="staff"], #mainNav-staff-or-profile, #mainNav-staff-link'
              )
            : null;
        if (!t || t.tagName !== 'A') return;
        var href = mdjBuildArtistStaffMainNavHref();
        try {
          t.setAttribute('href', href);
        } catch (eH) {
          t.href = href;
        }
        var idn = window.__mdjLastPlatformIdentity;
        if (idn && idn.staffInDb) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        window.location.replace(mdjBuildStaffEntryLoginHref());
      },
      true
    );
  }

  /** Owner strip / main nav STAFF: block navigation for non-staff before admin-dashboard paints. */
  function mdjBindStaffNavClickGuard(el) {
    if (!el || mdjIsStaffBuildingPage() || el.dataset.mdjStaffNavBound === '1') return;
    el.dataset.mdjStaffNavBound = '1';
    el.addEventListener(
      'click',
      function (e) {
        var idn = window.__mdjLastPlatformIdentity;
        var staffOk = !!(idn && idn.staffInDb);
        if (staffOk) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        window.location.replace(mdjBuildStaffEntryLoginHref());
      },
      true
    );
  }

  /** STAFF (admin): solo staff de dj_profiles; hueco reservado con .mdj-mainnav-reserved-slot + visibility en CSS móvil. */
  function mdjApplyStaffMainNavLink(isStaff) {
    var a = mdjGetMainNavStaffAnchor();
    if (!a) return;
    if (isStaff) {
      mdjApplyStaffNavHref(a);
      a.classList.remove('mdj-mainnav-reserved-slot');
      a.style.removeProperty('visibility');
      a.style.removeProperty('pointer-events');
      a.removeAttribute('aria-hidden');
      a.removeAttribute('tabindex');
    } else {
      try {
        a.setAttribute('href', '#');
      } catch (eH2) { /* ignore */ }
      a.classList.add('mdj-mainnav-reserved-slot');
      a.style.removeProperty('visibility');
      a.style.removeProperty('pointer-events');
      a.setAttribute('aria-hidden', 'true');
      a.setAttribute('tabindex', '-1');
      mdjBindStaffNavClickGuard(a);
    }
  }

  /**
   * Crea #mainNav-config-link si falta — comprador: debe existir en HTML tras Shop; resto: antes de Jobs.
   * Sin esto, Agenda/Flujo no tienen ancla; `mdjApplyConfigMainNavLink` quedaría en no-op.
   */
  function mdjEnsureConfigMainNavNode() {
    var existing = document.getElementById('mainNav-config-link');
    if (existing) return existing;
    if (mdjIsBuyerJourneyPage()) {
      try {
        console.warn(
          '[Header] #mainNav-config-link missing on buyer journey — expected after Shop in HTML; no insertBefore.'
        );
      } catch (eWarnCfg) { /* ignore */ }
      return null;
    }
    var nav = document.getElementById('mainNav');
    if (!nav) return null;
    var a = document.createElement('a');
    a.id = 'mainNav-config-link';
    a.setAttribute('data-mdj-nav', 'config');
    a.setAttribute('data-i18n', 'nav-config');
    a.className = 'mdj-config-mainnav mdj-mainnav-reserved-slot';
    a.href = './account-settings.html?mdj_nav=profile';
    a.setAttribute('aria-hidden', 'true');
    a.setAttribute('tabindex', '-1');
    a.textContent = '⚙️ CONFIG';
    var jobs = nav.querySelector('a[data-mdj-nav="jobs"]');
    var tools = nav.querySelector('a[data-mdj-nav="tools"]');
    if (jobs && jobs.parentNode === nav) {
      nav.insertBefore(a, jobs);
    } else if (tools && tools.parentNode === nav) {
      if (tools.nextSibling) {
        nav.insertBefore(a, tools.nextSibling);
      } else {
        nav.appendChild(a);
      }
    } else {
      nav.appendChild(a);
    }
    return a;
  }

  /**
   * #mainNav ⚙ CONFIG — misma ruta que la píldora superior (`settingsUrl`): panel artista, cuenta staff o portal cliente.
   * Sin sesión: hueco colapsado (`.mdj-mainnav-reserved-slot` + `header-unified.css`).
   */
  function mdjApplyConfigMainNavLink(show, href) {
    var a = mdjEnsureConfigMainNavNode();
    if (!a) return;
    var h = href && String(href).trim() ? String(href).trim() : './account-settings.html?mdj_nav=profile';
    a.setAttribute('href', h);
    if (show) {
      a.setAttribute('data-mdj-nav', 'config');
      a.setAttribute('data-i18n', 'nav-config');
      try {
        var txCfg = window.i18n && typeof window.i18n.t === 'function' ? String(window.i18n.t('nav-config') || '').trim() : '';
        if (txCfg) a.textContent = txCfg;
        else a.textContent = '⚙️ CONFIG';
      } catch (eCfg) {
        a.textContent = '⚙️ CONFIG';
      }
      a.classList.remove('mdj-mainnav-reserved-slot');
      a.style.removeProperty('display');
      a.style.removeProperty('visibility');
      a.style.removeProperty('pointer-events');
      a.removeAttribute('aria-hidden');
      a.removeAttribute('tabindex');
    } else {
      a.classList.add('mdj-mainnav-reserved-slot');
      a.setAttribute('aria-hidden', 'true');
      a.setAttribute('tabindex', '-1');
    }
  }

  /** Comprador: pestaña «⚙️ CONFIG» → client-account (todas las páginas con #mainNav, incl. Home y Events). */
  function mdjApplyBuyerConfigMainNavLink(show) {
    var a = mdjEnsureConfigMainNavNode();
    if (!a) return;
    if (!show) {
      mdjApplyConfigMainNavLink(false);
      return;
    }
    a.setAttribute('href', './client-account.html');
    a.setAttribute('data-mdj-nav', 'client-config');
    a.setAttribute('data-i18n', 'nav-config');
    a.style.removeProperty('display');
    a.style.removeProperty('visibility');
    a.style.removeProperty('pointer-events');
    a.removeAttribute('aria-hidden');
    a.removeAttribute('tabindex');
    try {
      var txCfg =
        window.i18n && typeof window.i18n.t === 'function'
          ? String(window.i18n.t('nav-config') || '').trim()
          : '';
      a.textContent = txCfg || '⚙️ CONFIG';
    } catch (eLbl) {
      a.textContent = '⚙️ CONFIG';
    }
  }

  /** Crea #mainNav-agenda-link antes de CONFIG: pestaña «Agenda» del panel (`?tab=dashboard`). */
  function mdjEnsureAgendaMainNavNode() {
    var existing = document.getElementById('mainNav-agenda-link');
    if (existing) return existing;
    mdjEnsureConfigMainNavNode();
    var nav = document.getElementById('mainNav');
    if (!nav) return null;
    var before =
      document.getElementById('mainNav-config-link') ||
      nav.querySelector('a.mdj-config-mainnav[data-mdj-nav="config"]') ||
      nav.querySelector('a[data-mdj-nav="config"]');
    var a = document.createElement('a');
    a.id = 'mainNav-agenda-link';
    a.setAttribute('data-mdj-nav', 'agenda');
    a.setAttribute('data-i18n', 'dash-your-profile');
    a.className = 'mdj-agenda-mainnav mdj-mainnav-reserved-slot';
    a.href = './dj-dashboard.html?tab=dashboard';
    a.setAttribute('aria-hidden', 'true');
    a.setAttribute('tabindex', '-1');
    var raw = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
    a.textContent = raw.indexOf('es') === 0 ? 'Agenda' : 'SCHEDULE';
    if (before && before.parentNode === nav) {
      nav.insertBefore(a, before);
    } else {
      nav.appendChild(a);
    }
    return a;
  }

  /**
   * Agenda (panel): `dj-dashboard?tab=dashboard` — solo artista LITE/PRO (misma regla que CONFIG social / flujo en barra).
   */
  function mdjApplyAgendaMainNavLink(show, href) {
    var a = mdjEnsureAgendaMainNavNode();
    if (!a) return;
    var h = href && String(href).trim() ? String(href).trim() : './dj-dashboard.html?tab=dashboard';
    a.setAttribute('href', h);
    if (show) {
      a.classList.remove('mdj-mainnav-reserved-slot');
      a.style.removeProperty('display');
      a.style.removeProperty('visibility');
      a.style.removeProperty('pointer-events');
      a.removeAttribute('aria-hidden');
      a.removeAttribute('tabindex');
    } else {
      a.classList.add('mdj-mainnav-reserved-slot');
      a.setAttribute('aria-hidden', 'true');
      a.setAttribute('tabindex', '-1');
    }
  }

  /** Crea #mainNav-flow-link tras CONFIG si no está en el HTML (muchas plantillas duplicadas). */
  function mdjEnsureFlowMainNavNode() {
    var existing = document.getElementById('mainNav-flow-link');
    if (existing) return existing;
    mdjEnsureConfigMainNavNode();
    var nav = document.getElementById('mainNav');
    if (!nav) return null;
    var after =
      document.getElementById('mainNav-config-link') ||
      nav.querySelector('a.mdj-config-mainnav[data-mdj-nav="config"]') ||
      nav.querySelector('a[data-mdj-nav="config"]');
    var a = document.createElement('a');
    a.id = 'mainNav-flow-link';
    a.setAttribute('data-mdj-nav', 'flow');
    a.setAttribute('data-i18n', 'flow-dash');
    a.className = 'mdj-flow-mainnav mdj-mainnav-reserved-slot';
    a.href = './dj-dashboard.html?tab=flow';
    a.setAttribute('aria-hidden', 'true');
    a.setAttribute('tabindex', '-1');
    var raw = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
    a.textContent = raw.indexOf('es') === 0 ? 'Flujo de Caja' : 'Cash Flow';
    if (after && after.parentNode === nav) {
      if (after.nextSibling) {
        nav.insertBefore(a, after.nextSibling);
      } else {
        nav.appendChild(a);
      }
    } else {
      nav.appendChild(a);
    }
    return a;
  }

  /**
   * Flujo de caja: `dj-dashboard?tab=flow` — solo cuentas con perfil de artista (LITE/PRO), no clientes puros.
   */
  function mdjApplyFlowMainNavLink(show, href) {
    var a = mdjEnsureFlowMainNavNode();
    if (!a) return;
    /* Owner en account-settings: CASH FLOW siempre apunta al generador de facturas.
       Ignorar cualquier href que venga del auth-chain (dj-dashboard?tab=flow, etc.). */
    var h = href && String(href).trim() ? String(href).trim() : './dj-dashboard.html?tab=flow';
    a.setAttribute('href', h);
    if (show) {
      a.classList.remove('mdj-mainnav-reserved-slot');
      a.style.removeProperty('display');
      a.style.removeProperty('visibility');
      a.style.removeProperty('pointer-events');
      a.removeAttribute('aria-hidden');
      a.removeAttribute('tabindex');
    } else {
      a.classList.add('mdj-mainnav-reserved-slot');
      a.setAttribute('aria-hidden', 'true');
      a.setAttribute('tabindex', '-1');
    }
  }

  /**
   * Perfil artístico público (#mainNav + móvil): solo talento LITE/PRO, sin clientes ni staff
   * (admin/manager/seller/owner). `profileHref` típico: ./dj-profile.html?id=<user_id>.
   */
  function mdjApplyArtistDashboardNavChrome(show, profileHref) {
    var nav = document.getElementById('mainNav');
    var mobileNav = document.querySelector('#mobileMenu .mobile-nav');
    var href =
      show && profileHref && String(profileHref).trim()
        ? mdjNormalizeArtistProfileNavHref(profileHref)
        : mdjBuildArtistPublicProfileHref();
    function applyLabel(el) {
      if (!el) return;
      el.setAttribute('data-i18n', 'nav-my-profile');
      try {
        if (window.i18n && typeof window.i18n.t === 'function') {
          var tx = window.i18n.t('nav-my-profile');
          if (tx) el.textContent = tx;
          else {
            var rawF = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
            el.textContent = rawF.indexOf('es') === 0 ? 'MI PERFIL' : 'MY PROFILE';
          }
        } else {
          var raw = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
          el.textContent = raw.indexOf('es') === 0 ? 'MI PERFIL' : 'MY PROFILE';
        }
      } catch (e) { /* ignore */ }
      try {
        var es = document.documentElement && String(document.documentElement.lang || '').toLowerCase().indexOf('es') === 0;
        el.setAttribute('aria-label', es ? 'Perfil artístico público' : 'My public artist profile');
      } catch (e2) { /* ignore */ }
    }
    if (!show) {
      mdjRemoveArtistDashboardNavLinks();
      return;
    }
    if (nav) {
      var el = mdjEnsureGuestMiPerfilMainNavLink();
      if (!el) return;
      el.href = href;
      el.setAttribute('data-mdj-nav', 'my-profile');
      applyLabel(el);
      el.classList.remove('mdj-mainnav-reserved-slot');
      el.style.removeProperty('display');
      el.style.removeProperty('visibility');
      el.style.removeProperty('pointer-events');
      el.removeAttribute('aria-hidden');
      el.removeAttribute('tabindex');
    }
    if (mobileNav) {
      var mb = document.getElementById('header-artist-dashboard-mobile');
      if (!mb) {
        mb = document.createElement('a');
        mb.id = 'header-artist-dashboard-mobile';
        mb.className = 'mdj-artist-dashboard-mobile';
        var refM = document.getElementById('header-mi-portal-mobile');
        if (refM && refM.parentNode === mobileNav) {
          if (refM.nextSibling) mobileNav.insertBefore(mb, refM.nextSibling);
          else mobileNav.appendChild(mb);
        } else {
          mobileNav.appendChild(mb);
        }
      }
      mb.href = href;
      mb.setAttribute('data-mdj-nav', 'my-profile');
      applyLabel(mb);
      mb.style.display = '';
    }
  }

  /** Editorial tier badge: Artistic (LITE) | Pro | Staff | Team | Owner. Buyer/client mode uses #header-client-loyalty-indicator only. */
  function mdjApplyNavTierStatusBadge(navTier, ctx) {
    ctx = ctx || {};
    var djRole = String(ctx.djRole || '').toLowerCase();
    var actions = document.querySelector('#mainHeader .header-actions');
    if (!actions) return;
    var id = 'header-tier-status-badge';
    /*
     * Cabecera unificada: la pastilla (p. ej. «Pro») vive en fila 1 con z-index sobre la marca → solapa el wordmark.
     * Misma política que dj-profile (badge solo fuera de esta franja / en panel).
     */
    var mainHdrTier = document.getElementById('mainHeader');
    if (mainHdrTier && mainHdrTier.classList && mainHdrTier.classList.contains('mdj-header-unified')) {
      var rm = document.getElementById(id);
      if (rm) rm.remove();
      return;
    }
    var el = document.getElementById(id);
    if (!navTier || navTier === 'guest') {
      if (el) el.remove();
      return;
    }
    /* Buyer mode: loyalty pill (#header-client-loyalty-indicator) already shows Client/VIP — no duplicate editorial badge. */
    if (navTier === 'client_only') {
      if (el) el.remove();
      return;
    }
    var key = '';
    if (djRole === 'owner') {
      key = 'nav-tier-status-owner';
    } else if (djRole === 'seller') {
      key = 'nav-tier-status-staff';
    } else if (djRole === 'admin' || djRole === 'manager') {
      key = 'nav-tier-status-team';
    } else if (navTier === 'artist_lite') {
      key = 'nav-tier-status-artistic';
    } else if (navTier === 'artist_pro') {
      key = 'nav-tier-status-pro';
    }
    if (!key) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement('span');
      el.id = id;
      el.className = 'header-tier-status-badge';
      el.setAttribute('role', 'status');
      var badge = document.getElementById('header-djpro-badge');
      if (badge && badge.parentNode === actions) {
        actions.insertBefore(el, badge);
      } else {
        actions.appendChild(el);
      }
    }
    el.setAttribute('data-i18n', key);
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var tx = window.i18n.t(key);
        if (tx) el.textContent = tx;
      }
    } catch (e) { /* ignore */ }
    el.style.display = 'inline-flex';
  }

  /** Oculta ENTRAR/LOGIN hasta conocer sesión (evita flash si ya hay cuenta). */
  function mdjEnsureAuthPendingCss() {
    if (document.getElementById('mdj-auth-pending-css')) return;
    var s = document.createElement('style');
    s.id = 'mdj-auth-pending-css';
    s.textContent =
      '#header-login-btn.mdj-auth-pending, #header-login-btn-mobile.mdj-auth-pending { visibility: hidden !important; }';
    document.head.appendChild(s);
  }

  function mdjSetHeaderAuthPillsPending(pending) {
    mdjEnsureAuthPendingCss();
    ['header-login-btn', 'header-login-btn-mobile'].forEach(function (id) {
      var b = document.getElementById(id);
      if (!b) return;
      if (pending) b.classList.add('mdj-auth-pending');
      else b.classList.remove('mdj-auth-pending');
    });
  }

  /**
   * Pastillas ENTRAR/SALIR: siempre `data-auth-btn` + clase danger para que updateAuthButtons()
   * no sea pisado por i18n (data-i18n en el HTML inicial).
   */
  function mdjApplyHeaderAuthPillSession(loggedIn) {
    ['header-login-btn', 'header-login-btn-mobile'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (!btn) return;
      btn.setAttribute('data-auth-btn', '');
      btn.removeAttribute('data-i18n');
      if (loggedIn) {
        btn.classList.remove('gold');
        btn.classList.add('danger');
        btn.href = '#';
        /* Estable (QA / hooks): no sustituye #header-login-btn — el CSS del sitio depende de ese id. */
        btn.setAttribute('data-mdj-logout-id', id === 'header-login-btn' ? 'btn-logout-vip' : 'btn-logout-vip-mobile');
        btn.onclick = function (e) {
          e.preventDefault();
          void window.doLogout(e);
        };
      } else {
        btn.classList.remove('danger');
        btn.classList.add('gold');
        btn.href = './login.html';
        btn.onclick = null;
        btn.removeAttribute('data-mdj-logout-id');
      }
    });
    if (typeof window.updateAuthButtons === 'function') window.updateAuthButtons();
  }

  function mdjStylesheetPresent(substr) {
    try {
      var sheets = document.styleSheets;
      for (var i = 0; i < sheets.length; i++) {
        var h = sheets[i].href || '';
        if (h.indexOf(substr) !== -1) return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  function mdjEnsureHeaderVipCss() {
    if (document.getElementById('mdj-header-vip-css')) return;
    if (mdjStylesheetPresent('mdj-header-vip.css')) return;
    var l = document.createElement('link');
    l.id = 'mdj-header-vip-css';
    l.rel = 'stylesheet';
    l.href = './mdj-header-vip.css?v=20260421-avatar-direct';
    document.head.appendChild(l);
  }

  /** Phase 1 desktop audit: guest ring, loyalty pill, ≥1200px spacing (no change <1200px layout intent). */
  function mdjEnsureDesktopAuditCss() {
    if (document.getElementById('mdj-header-desktop-audit-css')) return;
    if (mdjStylesheetPresent('mdj-header-desktop-audit.css')) return;
    var l = document.createElement('link');
    l.id = 'mdj-header-desktop-audit-css';
    l.rel = 'stylesheet';
    l.href = './mdj-header-desktop-audit.css?v=20260421-menu-static';
    document.head.appendChild(l);
  }

  function mdjClientHeaderIsVipClient(clientRow) {
    if (!clientRow) return false;
    var ev = Number(clientRow.total_events_booked);
    var lp = Number(clientRow.loyalty_points);
    var evOk = !isNaN(ev) && ev >= 2;
    var lpOk = !isNaN(lp) && lp >= 200;
    return evOk || lpOk;
  }

  /** Pastilla portal: Cliente o Cliente VIP — no en cabecera unificada (fila 1: ES/EN → LOGOUT → avatar). */
  function mdjSyncClientLoyaltyIndicator(isClientSession, clientRow) {
    var mainHdr = document.getElementById('mainHeader');
    if (mainHdr && mainHdr.classList && mainHdr.classList.contains('mdj-header-unified')) {
      var rm = document.getElementById('header-client-loyalty-indicator');
      if (rm) rm.remove();
      return;
    }
    var el = document.getElementById('header-client-loyalty-indicator');
    var actions = document.querySelector('#mainHeader .header-actions');
    if (!isClientSession) {
      if (el) {
        el.style.display = 'none';
        el.textContent = '';
        el.removeAttribute('data-i18n');
      }
      return;
    }
    if (!actions) return;
    if (!el) {
      el = document.createElement('span');
      el.id = 'header-client-loyalty-indicator';
      el.className = 'header-client-loyalty-indicator';
      el.setAttribute('role', 'status');
      var lang = actions.querySelector('.lang-switcher');
      if (lang && lang.parentNode) {
        var afterLang = lang.nextSibling;
        if (afterLang) lang.parentNode.insertBefore(el, afterLang);
        else lang.parentNode.appendChild(el);
      } else {
        actions.appendChild(el);
      }
    }
    var vip = mdjClientHeaderIsVipClient(clientRow);
    var i18nKey = vip ? 'header-client-loyalty-vip' : 'header-client-loyalty';
    el.setAttribute('data-i18n', i18nKey);
    var label = vip ? 'VIP Client' : 'Client';
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var tx = window.i18n.t(i18nKey);
        if (tx) label = tx;
      }
    } catch (e) { /* ignore */ }
    if (!window.i18n) {
      var raw = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
      var es = raw.indexOf('es') === 0;
      if (vip) label = es ? 'Cliente VIP' : 'VIP Client';
      else label = es ? 'Cliente' : 'Client';
    }
    el.textContent = label;
    el.style.display = 'inline-flex';
  }

  /** Invitado: mantiene la 8.ª celda (nav mdj-mainnav-flex en tabla) sin quitar el nodo. */
  function mdjResetMainNavPortalGuestSlot() {
    var link = document.getElementById('mainNav-mi-portal-link');
    if (!link) return;
    link.className = 'mdj-mi-portal-mainnav mdj-mi-portal-gold mdj-mi-portal--guest';
    link.href = '#';
    link.setAttribute('data-mdj-nav', 'mi-portal');
    link.setAttribute('aria-hidden', 'true');
    link.setAttribute('tabindex', '-1');
    link.style.removeProperty('display');
    link.style.pointerEvents = 'none';
    link.style.visibility = 'hidden';
    link.removeAttribute('data-i18n');
    try {
      var rawLang = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
      link.textContent = rawLang.indexOf('es') === 0 ? 'MI PORTAL' : 'MY PORTAL';
    } catch (e) {
      link.textContent = 'MY PORTAL';
    }
  }

  /**
   * Guest-only (zero-login): contrato PROD-BLOCKER-001-FIX-2 — 8 pestañas públicas.
   * Visible: Home · Services · Events · Shop · CONFIG · Jobs · Contact · MI PERFIL
   * CONFIG → ./login.html; MI PERFIL → ./login.html; ocultos: MI PORTAL · DJ TOOLS · STAFF
   * Sale si hay sesión comprador/cliente o uid activo (no toca artista/staff/owner logueados).
   */
  function mdjRevealGuestRoleEntryNav() {
    try {
      if (document.body.classList.contains('mdj-buyer-session') || document.body.classList.contains('mdj-is-client')) return;
      if (window.__mdjLastBuyerSession === true) return;
      if (window.__mdjNavOwnUserId) return;
    } catch (eGuard) { /* ignore */ }

    var nav = document.getElementById('mainNav');
    if (!nav) return;

    var venues = nav.querySelector('a[data-mdj-nav="venues"]');
    if (!venues) {
      venues = document.createElement('a');
      venues.setAttribute('data-mdj-nav', 'venues');
      venues.setAttribute('data-i18n', 'nav-rentals');
      var afterSvc = nav.querySelector('a[data-mdj-nav="services"]');
      var beforeShop = nav.querySelector('a[data-mdj-nav="shop"]');
      if (afterSvc && afterSvc.parentNode === nav) {
        nav.insertBefore(venues, afterSvc.nextSibling);
      } else if (beforeShop && beforeShop.parentNode === nav) {
        nav.insertBefore(venues, beforeShop);
      } else {
        nav.appendChild(venues);
      }
      try {
        var esVen = document.documentElement && String(document.documentElement.lang || '').toLowerCase().indexOf('es') === 0;
        venues.textContent = esVen ? 'Eventos' : 'Events';
      } catch (eVenLbl) {
        venues.textContent = 'Events';
      }
    }
    venues.setAttribute('href', './events.html');
    mdjRevealMainNavSlot(venues);

    ['home', 'services', 'shop', 'jobs', 'contact'].forEach(function (key) {
      nav.querySelectorAll('a[data-mdj-nav="' + key + '"]').forEach(mdjRevealMainNavSlot);
    });

    mdjApplyConfigMainNavLink(true, './login.html');
    mdjResetMainNavPortalGuestSlot();
    mdjApplyStaffMainNavLink(false);

    nav.querySelectorAll('a[data-mdj-nav="tools"]').forEach(function (el) {
      mdjHideMainNavSlot(el);
      el.style.setProperty('display', 'none', 'important');
    });

    var miPerfil = document.getElementById('mainNav-guest-mi-perfil-link') || mdjEnsureGuestMiPerfilMainNavLink();
    if (miPerfil) {
      var contact = nav.querySelector('a[data-mdj-nav="contact"]');
      if (contact && contact.parentNode === nav && contact.nextSibling !== miPerfil) {
        if (contact.nextSibling) nav.insertBefore(miPerfil, contact.nextSibling);
        else nav.appendChild(miPerfil);
      }
      miPerfil.href = './login.html';
    }
  }

  function mdjHideMiPortalButton() {
    var el = document.getElementById('header-mi-portal-btn');
    if (el) el.style.display = 'none';
    var mob = document.getElementById('header-mi-portal-mobile');
    if (mob) mob.style.display = 'none';
    mdjResetMainNavPortalGuestSlot();
    mdjRemoveArtistDashboardNavLinks();
    mdjApplyStaffMainNavLink(false);
    var tb = document.getElementById('header-tier-status-badge');
    if (tb) tb.remove();
  }

  /** Mientras llega el perfil: oculto pero ocupa columna (tabla v2). */
  function mdjEnsureMiPortalHydratingPlaceholder() {
    var nav = document.getElementById('mainNav');
    if (!nav) return;
    var existing = document.getElementById('mainNav-mi-portal-link');
    if (existing) {
      if (!existing.classList.contains('mdj-mi-portal--guest')) return;
      existing.classList.remove('mdj-mi-portal--guest');
      existing.classList.add('mdj-mi-portal--hydrating');
      existing.removeAttribute('data-i18n');
      existing.href = '#';
      existing.setAttribute('aria-hidden', 'true');
      existing.setAttribute('tabindex', '-1');
      existing.style.removeProperty('display');
      existing.style.pointerEvents = 'none';
      existing.style.visibility = 'hidden';
      existing.textContent = 'MI PORTAL';
      return;
    }
    if (mdjIsBuyerJourneyPage()) {
      try {
        console.warn(
          '[Header] #mainNav-mi-portal-link missing on buyer journey — expected last in #mainNav HTML; no appendChild.'
        );
      } catch (eWarnMp) { /* ignore */ }
      return;
    }
    var link = document.createElement('a');
    link.id = 'mainNav-mi-portal-link';
    link.className = 'mdj-mi-portal-mainnav mdj-mi-portal-gold mdj-mi-portal--hydrating';
    link.setAttribute('data-mdj-nav', 'mi-portal');
    link.href = '#';
    link.setAttribute('aria-hidden', 'true');
    link.setAttribute('tabindex', '-1');
    link.style.removeProperty('display');
    link.style.pointerEvents = 'none';
    link.style.visibility = 'hidden';
    link.textContent = 'MI PORTAL';
    nav.appendChild(link);
  }

  /**
   * MI PORTAL en la fila inferior (#mainNav), mismo ritmo que Home/Services/…; dorado vía CSS.
   * Si existe #mainNav, no duplicamos el CTA en .header-actions (se oculta #header-mi-portal-btn).
   */
  function mdjEnsureMiPortalInMainNav(href, opts) {
    var nav = document.getElementById('mainNav');
    if (!nav) return;
    mdjEnsureHeaderVipCss();
    var link = document.getElementById('mainNav-mi-portal-link');
    if (!link) {
      if (mdjIsBuyerJourneyPage() || window.__mdjLastBuyerSession === true) {
        try {
          console.warn(
            '[Header] #mainNav-mi-portal-link missing — reveal/href skipped; fix HTML order (last visible tab).'
          );
        } catch (eWarnMp2) { /* ignore */ }
        return;
      }
      link = document.createElement('a');
      link.id = 'mainNav-mi-portal-link';
      nav.appendChild(link);
    }
    var buyerRow = window.__mdjLastBuyerSession === true;
    if (buyerRow) {
      link.classList.add('mdj-mi-portal-mainnav', 'mdj-mi-portal-gold');
      link.classList.remove('mdj-mi-portal--guest', 'mdj-mi-portal--hydrating');
    } else {
      link.className = 'mdj-mi-portal-mainnav mdj-mi-portal-gold';
      link.classList.remove('mdj-mainnav-reserved-slot', 'mdj-mi-portal--guest', 'mdj-mi-portal--hydrating');
    }
    link.href = href || './client-portal.html';
    link.style.removeProperty('display');
    link.style.removeProperty('pointer-events');
    link.style.removeProperty('visibility');
    link.removeAttribute('aria-hidden');
    link.removeAttribute('tabindex');
    var staffNav = opts && opts.variant === 'staff-settings';
    if (staffNav) {
      /* Misma etiqueta que panel artista / dj-dashboard: translations `nav-settings` → «⚙️ CONFIG». */
      link.setAttribute('data-mdj-nav', 'account-settings');
      link.setAttribute('data-i18n', 'nav-settings');
      try {
        var ns =
          window.i18n && typeof window.i18n.t === 'function' ? String(window.i18n.t('nav-settings') || '').trim() : '';
        link.textContent = ns || '⚙️ CONFIG';
      } catch (eNs) {
        link.textContent = '⚙️ CONFIG';
      }
      try {
        link.setAttribute('aria-label', mdjGetStaffAccountSettingsMenuLabel());
      } catch (eAr) { /* ignore */ }
    } else {
      var profileDest = /dj-profile\.html/i.test(String(href || '').trim());
      link.setAttribute('data-mdj-nav', 'mi-portal');
      if (profileDest) {
        mdjApplyMiPerfilNavLabel(link);
        try {
          var esProf =
            document.documentElement && String(document.documentElement.lang || '').toLowerCase().indexOf('es') === 0;
          link.setAttribute('aria-label', esProf ? 'Mi perfil' : 'My profile');
        } catch (eMpLbl) { /* ignore */ }
      } else {
        link.setAttribute('data-i18n', 'header-mi-portal');
        mdjApplyMiPortalLinkLabel(link);
      }
    }
  }

  function mdjApplyMiPortalLinkLabel(el) {
    if (!el) return;
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var tx = window.i18n.t('header-mi-portal');
        if (tx) el.textContent = tx;
      } else {
        var rawLang = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
        el.textContent = rawLang.indexOf('es') === 0 ? 'MI PORTAL' : 'MY PORTAL';
      }
    } catch (err) { /* ignore */ }
    try {
      var es = document.documentElement && String(document.documentElement.lang || '').toLowerCase().indexOf('es') === 0;
      el.setAttribute('aria-label', es ? 'Mi portal' : 'My portal');
    } catch (e2) { /* ignore */ }
  }

  /**
   * CTA dorado "MI PORTAL": solo con sesión; enlace directo al hub (cliente → portal, artista → dashboard).
   * Colocado justo antes de `.header-avatar-cart-row` (no interfiere con `.lang-switcher`).
   */
  function mdjEnsureMiPortalButton(href) {
    var actions = document.querySelector('#mainHeader .header-actions');
    if (!actions) return;
    mdjEnsureHeaderVipCss();
    var row = document.querySelector('#mainHeader .header-avatar-cart-row');
    var btn = document.getElementById('header-mi-portal-btn');
    if (!btn) {
      btn = document.createElement('a');
      btn.id = 'header-mi-portal-btn';
      btn.setAttribute('data-i18n', 'header-mi-portal');
      btn.setAttribute('aria-label', 'My portal');
      if (row && row.parentNode === actions) {
        actions.insertBefore(btn, row);
      } else {
        actions.appendChild(btn);
      }
    }
    btn.className = 'mdj-mi-portal-gold mdj-mi-portal-navlink';
    btn.href = href || './client-portal.html';
    btn.style.display = '';
    mdjApplyMiPortalLinkLabel(btn);
  }

  /**
   * Mismo destino que MI PORTAL desktop: primer ítem del menú hamburguesa (móvil).
   */
  function mdjEnsureMiPortalMobile(href, opts) {
    var nav = document.querySelector('#mobileMenu .mobile-nav');
    if (!nav) return;
    mdjEnsureHeaderVipCss();
    var btn = document.getElementById('header-mi-portal-mobile');
    if (!btn) {
      btn = document.createElement('a');
      btn.id = 'header-mi-portal-mobile';
      btn.href = href || './client-portal.html';
      nav.insertBefore(btn, nav.firstChild);
    }
    btn.className = 'mdj-mi-portal-mobile mdj-mi-portal-gold';
    btn.href = href || './client-portal.html';
    btn.style.display = '';
    var staffNav = opts && opts.variant === 'staff-settings';
    if (staffNav) {
      btn.setAttribute('data-i18n', 'nav-settings');
      try {
        var nsM =
          window.i18n && typeof window.i18n.t === 'function' ? String(window.i18n.t('nav-settings') || '').trim() : '';
        btn.textContent = nsM || '⚙️ CONFIG';
      } catch (eNsM) {
        btn.textContent = '⚙️ CONFIG';
      }
      try {
        btn.setAttribute('aria-label', mdjGetStaffAccountSettingsMenuLabel());
      } catch (eMb) { /* ignore */ }
    } else {
      var profileDestM = /dj-profile\.html/i.test(String(href || '').trim());
      if (profileDestM) {
        mdjApplyMiPerfilNavLabel(btn);
        try {
          var esProfM =
            document.documentElement && String(document.documentElement.lang || '').toLowerCase().indexOf('es') === 0;
          btn.setAttribute('aria-label', esProfM ? 'Mi perfil' : 'My profile');
        } catch (eMpLblM) { /* ignore */ }
      } else {
        btn.setAttribute('data-i18n', 'header-mi-portal');
        btn.setAttribute('aria-label', 'My portal');
        mdjApplyMiPortalLinkLabel(btn);
      }
    }
    if (nav.firstChild !== btn) {
      nav.insertBefore(btn, nav.firstChild);
    }
  }

  function mdjEscapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function mdjEscapeAttr(s) {
    return mdjEscapeHtml(s).replace(/'/g, '&#39;');
  }

  /** Cliente: "Wendy Example" → "Wendy E." */
  function mdjFormatClientShortName(fullName) {
    var parts = String(fullName || '')
      .trim()
      .split(/\s+/)
      .filter(function (x) {
        return !!x;
      });
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0];
    var first = parts[0];
    var last = parts[parts.length - 1];
    if (first === last) return first;
    return first + ' ' + last.charAt(0).toUpperCase() + '.';
  }

  /** Saludo VIP (cliente): solo primer nombre — sin @ ni apellidos. */
  function mdjVipFirstNameOnly(fullName) {
    var parts = String(fullName || '')
      .trim()
      .split(/\s+/)
      .filter(function (x) {
        return !!x;
      });
    if (!parts.length) return '';
    var w = parts[0];
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }

  /** Handle público: un solo @ visual; la BD puede traer "wendy", "@wendy" o "@@wendy". */
  function mdjVipFormatHandle(raw) {
    if (!raw || !String(raw).trim()) return '';
    var t = String(raw).trim().replace(/^@+/, '');
    if (!t) return '';
    return '@' + t;
  }

  function mdjVipMetaUsername(metaObj) {
    if (!metaObj || typeof metaObj.username !== 'string') return '';
    var t = String(metaObj.username).trim();
    if (!t) return '';
    return mdjVipFormatHandle(t);
  }

  function mdjComputeInitials(displayName, email) {
    var d = String(displayName || '').trim();
    if (d) {
      var w = d.split(/\s+/).filter(Boolean);
      if (w.length >= 2) return (w[0].charAt(0) + w[w.length - 1].charAt(0)).toUpperCase();
      if (w.length === 1 && w[0].length >= 2) return w[0].substring(0, 2).toUpperCase();
      if (w.length === 1) return w[0].charAt(0).toUpperCase();
    }
    var e = String(email || '').split('@')[0] || '';
    if (e.length >= 2) return e.substring(0, 2).toUpperCase();
    return e ? e.charAt(0).toUpperCase() : '?';
  }

  /**
   * URL pública para <img>: absoluta https o //; rutas Storage sin host → MDB_SUPABASE_URL.
   * Acepta /storage/v1/… y storage/v1/… (sin slash inicial).
   */
  function mdjNormalizeAvatarStorageUrl(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    if (/placeholder|dj-avatar-placeholder\.png/i.test(s)) return '';
    if (/^https?:\/\//i.test(s)) return s;
    if (s.indexOf('//') === 0 && s.indexOf('http') !== 0) return s;
    if (s.indexOf('data:image/') === 0 || s.indexOf('blob:') === 0) return s;
    var baseUrl =
      typeof window.MDB_SUPABASE_URL === 'string' && window.MDB_SUPABASE_URL
        ? String(window.MDB_SUPABASE_URL).replace(/\/$/, '')
        : '';
    if (!baseUrl) return s;
    if (s.indexOf('storage/v1') !== -1) {
      var path = s.indexOf('/') === 0 ? s : '/' + s.replace(/^\/+/, '');
      return baseUrl + path;
    }
    if (s.indexOf('/') === 0 && s.indexOf('/storage/') === 0) {
      return baseUrl + s;
    }
    return s;
  }

  function mdjIsRealPhotoUrl(url) {
    if (!url || !String(url).trim()) return false;
    var u = mdjNormalizeAvatarStorageUrl(url);
    if (!u) return false;
    if (/placeholder|dj-avatar-placeholder\.png/i.test(u)) return false;
    return (
      /^https?:\/\//i.test(u) ||
      u.indexOf('//') === 0 ||
      u.indexOf('data:image/') === 0 ||
      u.indexOf('blob:') === 0
    );
  }

  /** Primera URL usable para el header; artistas: dj_profiles.photo_url antes que JWT (evita 404 OAuth → iniciales). */
  function mdjPickHeaderProfilePhotoUrl(isClient, p, sessionAvatar, clientPic) {
    var dj = p && p.photo_url ? String(p.photo_url).trim() : '';
    var jwt = sessionAvatar ? String(sessionAvatar).trim() : '';
    var cli = clientPic ? String(clientPic).trim() : '';
    var order = isClient ? [cli, jwt, dj] : [dj, jwt, cli];
    for (var i = 0; i < order.length; i++) {
      var c = order[i];
      if (!c) continue;
      c = mdjNormalizeAvatarStorageUrl(c);
      var base = c.split('?')[0];
      if (mdjIsRealPhotoUrl(base)) return c;
    }
    return '';
  }

  function mdjShowFamilyWelcomeToast() {
    if (document.getElementById('mdj-family-welcome-toast')) return;
    var msg = '¡Bienvenido a la familia de Miami DJ Beat! Es un honor tenerte aquí.';
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var t = window.i18n.t('vip-welcome-family');
        if (t) msg = t;
      }
    } catch (err) { /* ignore */ }
    var div = document.createElement('div');
    div.id = 'mdj-family-welcome-toast';
    div.setAttribute('role', 'status');
    div.style.cssText =
      'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);max-width:min(520px,92vw);z-index:99999;padding:16px 22px;background:rgba(15,22,35,.97);border:1px solid rgba(197,160,89,.5);border-radius:16px;color:#e8eefc;font-size:14px;font-weight:600;box-shadow:0 14px 44px rgba(0,0,0,.55);text-align:center;line-height:1.45;';
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(function () {
      try {
        if (div.parentNode) div.parentNode.removeChild(div);
      } catch (e2) { /* ignore */ }
    }, 9000);
  }

  /** Invitación por correo (Edge opcional; falla en silencio si no está desplegada). SMS no incluido aquí. */
  function mdjTryMemberWelcomeNotify(user) {
    try {
      var sb = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
      if (!sb || !sb.functions || !user) return;
      sb.functions
        .invoke('member-welcome', {
          body: { user_id: user.id, email: user.email || null }
        })
        .catch(function () { /* optional */ });
    } catch (e) { /* ignore */ }
  }

  function mdjMaybeRunVipWelcomeProtocol(session) {
    try {
      if (sessionStorage.getItem('mdj_vip_welcome_pending') !== '1' || !session || !session.user) return;
      sessionStorage.removeItem('mdj_vip_welcome_pending');
      mdjShowFamilyWelcomeToast();
      mdjTryMemberWelcomeNotify(session.user);
    } catch (e) { /* ignore */ }
  }

  /** Menú cuenta: anclado al viewport (fixed) bajo el bloque VIP — evita stacking/scroll del header. */
  function mdjPositionAccountDropdown() {
    var menu = document.getElementById('accountMenu');
    if (!menu || !menu.classList.contains('open')) return;
    var root = document.getElementById('mdjAccountVipRoot');
    var zone = document.getElementById('header-auth-zone');
    var anchor = root || zone;
    if (!anchor) return;
    var r = anchor.getBoundingClientRect();
    var gap = 8;
    var topPx = r.bottom + gap;
    var rightPx = Math.max(8, window.innerWidth - r.right);
    menu.style.position = 'fixed';
    menu.style.top = topPx + 'px';
    menu.style.right = rightPx + 'px';
    menu.style.left = 'auto';
    menu.style.bottom = 'auto';
    menu.style.zIndex = '5000';
  }

  function mdjCloseAccountMenu() {
    var m = document.getElementById('accountMenu');
    var menubtn = document.getElementById('mdjAccountVipMenuBtn');
    var accBtn = document.getElementById('accountBtn');
    if (m) {
      m.classList.remove('open');
      m.style.position = '';
      m.style.top = '';
      m.style.right = '';
      m.style.left = '';
      m.style.bottom = '';
      m.style.zIndex = '';
    }
    if (menubtn) menubtn.setAttribute('aria-expanded', 'false');
    else if (accBtn) accBtn.setAttribute('aria-expanded', 'false');
  }

  function mdjBindVipAccountInteractionsOnce() {
    if (window.__mdjVipAcctBound) return;
    window.__mdjVipAcctBound = true;
    function mdjAccountMenuViewportSync() {
      var menu = document.getElementById('accountMenu');
      if (!menu || !menu.classList.contains('open')) return;
      mdjPositionAccountDropdown();
    }
    window.addEventListener('scroll', mdjAccountMenuViewportSync, true);
    window.addEventListener('resize', mdjAccountMenuViewportSync);
    document.addEventListener('click', function (e) {
      var menu = document.getElementById('accountMenu');
      var menubtn = document.getElementById('mdjAccountVipMenuBtn');
      var accBtn = document.getElementById('accountBtn');
      function mdjToggleAccountMenuFromTrigger() {
        if (!menu) return;
        menu.classList.toggle('open');
        var open = menu.classList.contains('open');
        if (menubtn) menubtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        else if (accBtn) accBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) {
          requestAnimationFrame(function () {
            mdjPositionAccountDropdown();
            requestAnimationFrame(mdjPositionAccountDropdown);
          });
        } else {
          menu.style.position = '';
          menu.style.top = '';
          menu.style.right = '';
          menu.style.left = '';
          menu.style.bottom = '';
          menu.style.zIndex = '';
        }
      }
      if (menubtn && menubtn.contains(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        mdjToggleAccountMenuFromTrigger();
        return;
      }
      if (menu && menu.contains(e.target) && e.target && e.target.classList && e.target.classList.contains('mdj-menu-logout')) {
        e.preventDefault();
        mdjCloseAccountMenu();
        if (typeof window.doLogout === 'function') window.doLogout(e);
        return;
      }
      mdjCloseAccountMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') mdjCloseAccountMenu();
    });
  }

  /** Etiqueta título/portal cliente (enlace directo al portal, sin menú en el avatar). */
  function mdjGetVipPortalMenuLabel() {
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var t = window.i18n.t('header-mi-portal');
        if (t) return t;
      }
    } catch (e1) { /* ignore */ }
    var lang = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
    return lang.indexOf('en') === 0 ? 'My portal' : 'Mi portal';
  }

  function mdjGetDjDashboardMenuLabel() {
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var td = window.i18n.t('dashboard-title');
        if (td) return td;
      }
    } catch (e2) { /* ignore */ }
    var lang2 = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
    return lang2.indexOf('en') === 0 ? 'DJ Dashboard' : 'Panel DJ';
  }

  /** Staff (admin / manager / seller / owner): cuenta operativa, no portal cliente ni panel artista. */
  function mdjGetStaffAccountSettingsMenuLabel() {
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var tx = window.i18n.t('nav-account-settings');
        if (tx) return tx;
      }
    } catch (eSt) { /* ignore */ }
    var lang3 = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
    return lang3.indexOf('es') === 0 ? 'Configuración de cuenta' : 'Account settings';
  }

  function mdjGetArtistPublicProfileMenuLabel() {
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var ta = window.i18n.t('jobs-after-roles-cta-artist-public');
        if (ta) return ta;
      }
    } catch (e3) { /* ignore */ }
    var lang3 = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
    return lang3.indexOf('en') === 0 ? 'Public profile' : 'Perfil público';
  }

  /**
   * Avatar circular + nombre. Cliente y artista: el bloque es un enlace directo (portal / dashboard), sin menú desplegable.
   */
  function mdjBuildAvatarSlotHtml(ctx) {
    var useInit = !!ctx.useAvatarInitials;
    var initials = ctx.avatarInitials || '?';
    var url = ctx.avatarUrl || '';
    if (useInit) {
      return (
        '<span id="mdjHeaderAvatarSlot" class="mdj-avatar-slot">' +
        '<span class="mdj-avatar-ring mdj-avatar-ring--init">' +
        '<span class="mdj-avatar-initials" aria-hidden="true">' +
        mdjEscapeHtml(initials) +
        '</span></span></span>'
      );
    }
    return (
      '<span id="mdjHeaderAvatarSlot" class="mdj-avatar-slot">' +
      '<span class="mdj-avatar-ring">' +
      '<img class="avatar mdj-header-vip-avatar" src="' +
      mdjEscapeAttr(url) +
      '" alt="" data-mdj-av-init="' +
      mdjEscapeAttr(initials) +
      '" /></span></span>'
    );
  }

  function mdjBindHeaderAvatarImgFallbackOnce() {
    var img = document.querySelector('#mdjHeaderAvatarSlot img.mdj-header-vip-avatar');
    if (!img || img.getAttribute('data-mdj-av-bound') === '1') return;
    img.setAttribute('data-mdj-av-bound', '1');
    img.addEventListener(
      'error',
      function () {
        try {
          var init = img.getAttribute('data-mdj-av-init') || '?';
          var ring = img.closest('.mdj-avatar-ring');
          if (!ring) return;
          ring.classList.add('mdj-avatar-ring--init');
          ring.innerHTML =
            '<span class="mdj-avatar-initials" aria-hidden="true">' + mdjEscapeHtml(init) + '</span>';
        } catch (e) { /* ignore */ }
      },
      { once: true }
    );
  }

  /**
   * Actualización instantánea del avatar VIP tras subir/guardar foto (dashboard / cuenta), sin recargar.
   * Sustituye iniciales por <img> si hacía falta.
   */
  window.mdjHeaderVipApplyPhotoUrl = function (url) {
    if (!url || !String(url).trim()) return;
    var raw = String(url).trim();
    var base = raw.split('?')[0];
    if (!mdjIsRealPhotoUrl(base)) return;
    var bust = raw.indexOf('?') >= 0 ? raw : raw + '?v=' + Date.now();
    var nm = document.getElementById('mdjAccountDisplayName');
    var initials = '?';
    if (nm && nm.textContent) {
      initials = mdjComputeInitials(nm.textContent, '');
    }
    var html = mdjBuildAvatarSlotHtml({
      useAvatarInitials: false,
      avatarInitials: initials,
      avatarUrl: bust
    });
    var slot = document.getElementById('mdjHeaderAvatarSlot');
    if (!slot) {
      if (typeof window.checkSessionForNav === 'function') void window.checkSessionForNav();
      return;
    }
    slot.outerHTML = html;
    mdjBindHeaderAvatarImgFallbackOnce();
    try {
      document.querySelectorAll('#mainHeader img.avatar, #navAvatarImg').forEach(function (im) {
        if (!im) return;
        if (im.closest && im.closest('#mdjAccountVipRoot')) return;
        im.src = bust;
      });
    } catch (e) { /* ignore */ }
  };

  function mdjMountOrUpdateVipAccountZone(ctx) {
    var zone = document.getElementById('header-auth-zone');
    if (!zone) return;
    mdjEnsureHeaderVipCss();
    mdjBindVipAccountInteractionsOnce();
    document.body.classList.add('mdj-logged-in-header');

    var displayName = ctx.displayName || 'Member';
    var isClient = !!ctx.isClient;
    var profileUrl = ctx.profileUrl;
    if (!profileUrl) profileUrl = isClient ? './client-portal.html' : './account-settings.html';
    var profileLabel =
      ctx.profileLabel ||
      (isClient ? mdjGetVipPortalMenuLabel() : mdjGetDjDashboardMenuLabel());
    var useAvatarInitials = !!ctx.useAvatarInitials;
    var avatarInitials = ctx.avatarInitials || '?';
    var avatarUrl = ctx.avatarUrl || '';

    var avatarSlotHtml = mdjBuildAvatarSlotHtml({
      useAvatarInitials: useAvatarInitials,
      avatarInitials: avatarInitials,
      avatarUrl: avatarUrl
    });

    /* Artista: un solo enlace al panel — sin dropdown, sin botón ▾, sin submenús. */
    if (!isClient) {
      var artistInner =
        '<a class="mdj-account-vip-trigger mdj-account-vip-direct mdj-account-vip-artist-dash" id="accountBtn" href="#" onclick="return false;" title="' +
        mdjEscapeAttr(profileLabel) +
        '">' +
        avatarSlotHtml +
        '<span class="mdj-account-display-name" id="mdjAccountDisplayName">' +
        mdjEscapeHtml(displayName) +
        '</span>' +
        '</a>';
      var rootA = document.getElementById('mdjAccountVipRoot');
      if (rootA) {
        rootA.className = 'mdj-account-vip mdj-account-vip--artist-link-only';
        rootA.innerHTML = artistInner;
      } else {
        zone.innerHTML =
          '<div class="mdj-account-vip mdj-account-vip--artist-link-only" id="mdjAccountVipRoot">' + artistInner + '</div>';
      }
      mdjBindHeaderAvatarImgFallbackOnce();
      return;
    }

    /* Cliente: mismo patrón que artista — enlace al portal, sin #accountMenu ni pestaña bajo la barra. */
    var clientInner =
      '<a class="mdj-account-vip-trigger mdj-account-vip-direct mdj-account-vip-client-portal" id="accountBtn" href="#" onclick="return false;" title="' +
      mdjEscapeAttr(profileLabel) +
      '">' +
      avatarSlotHtml +
      '<span class="mdj-account-display-name" id="mdjAccountDisplayName">' +
      mdjEscapeHtml(displayName) +
      '</span>' +
      '</a>';
    var rootClient = document.getElementById('mdjAccountVipRoot');
    if (rootClient) {
      rootClient.className = 'mdj-account-vip mdj-account-vip--direct-link-only';
      rootClient.innerHTML = clientInner;
    } else {
      zone.innerHTML =
        '<div class="mdj-account-vip mdj-account-vip--direct-link-only" id="mdjAccountVipRoot">' + clientInner + '</div>';
    }
    mdjBindHeaderAvatarImgFallbackOnce();
  }

  function mdjCountCheckoutCartUnits(parsed) {
    if (parsed == null) return 0;
    if (Array.isArray(parsed)) {
      return parsed.reduce(function (sum, line) {
        var q = line && typeof line.quantity === 'number' && line.quantity > 0 ? line.quantity : 1;
        return sum + q;
      }, 0);
    }
    if (typeof parsed === 'object') return 1;
    return 0;
  }

  window.mdjCountCheckoutCartUnits = mdjCountCheckoutCartUnits;

  window.updateHeaderCartCount = function () {
    var el = document.getElementById('header-cart-count');
    var link = document.getElementById('header-cart-link');
    if (!el) return;
    var n = 0;
    try {
      var raw = sessionStorage.getItem('mdjpro_checkout_cart');
      if (raw) n = mdjCountCheckoutCartUnits(JSON.parse(raw));
    } catch (e) { /* ignore */ }
    el.textContent = n > 0 ? String(n) : '';
    el.dataset.count = String(n);
    el.hidden = n === 0;
    if (link) {
      link.classList.toggle('has-items', n > 0);
      link.setAttribute('aria-label', n > 0 ? 'Shopping cart, ' + n + (n === 1 ? ' item' : ' items') : 'Shopping cart');
    }
  };

  /** Último segmento de ruta (index.html en /), sin slash final — compatible con /shop y /shop.html */
  function mdjNavPathLeaf() {
    var pathname = location.pathname || '/';
    var trimmed = pathname.replace(/\/+$/, '');
    if (!trimmed) return 'index.html';
    var parts = trimmed.split('/');
    var leaf = parts[parts.length - 1] || 'index.html';
    return String(leaf).toLowerCase();
  }

  /** True when URL leaf is shop (e.g. /shop.html, /shop). Shop header cart link is shown only then. */
  function mdjIsShopCartPage() {
    var leaf = mdjNavPathLeaf();
    var base = String(leaf || '').toLowerCase().replace(/\.html?$/i, '');
    return base === 'shop';
  }

  /** #header-cart-link: visible only on shop; off shop stays in layout (visibility) so the cart slot does not collapse. */
  function mdjApplyShopHeaderCartVisibility() {
    var link = document.getElementById('header-cart-link');
    if (!link) return;
    if (mdjIsShopCartPage()) {
      link.style.removeProperty('display');
      link.style.removeProperty('visibility');
      link.style.removeProperty('pointer-events');
      link.removeAttribute('aria-hidden');
      link.removeAttribute('data-mdj-shop-cart-hidden');
    } else {
      link.style.removeProperty('display');
      link.style.setProperty('visibility', 'hidden', 'important');
      link.style.setProperty('pointer-events', 'none', 'important');
      link.setAttribute('aria-hidden', 'true');
      link.setAttribute('data-mdj-shop-cart-hidden', '1');
    }
  }

  /** Rentals ships Event Cart inline; shop keeps shop cart only (blueprint). */
  function mdjIsRentalsEventCartPage() {
    try {
      if (document.body && document.body.classList && document.body.classList.contains('page-mdj-rentals')) {
        return true;
      }
    } catch (e0) {
      void e0;
    }
    var leaf = mdjNavPathLeaf();
    var b = String(leaf || '')
      .toLowerCase()
      .replace(/\.html?$/i, '');
    return b === 'rentals';
  }

  /** Last path segment of a script URL (works with absolute `src` vs relative `src` passed in). */
  function mdjScriptSrcBasename(url) {
    if (!url) return '';
    try {
      var u = String(url).split(/[#?]/)[0];
      var parts = u.split('/');
      return String(parts[parts.length - 1] || '').toLowerCase();
    } catch (eBs) {
      return '';
    }
  }

  function mdjAppendScriptOnce(src) {
    if (!src) return Promise.resolve();
    var want = mdjScriptSrcBasename(src);
    if (!want) return Promise.resolve();
    var nodes = document.getElementsByTagName('script');
    var i;
    for (i = 0; i < nodes.length; i++) {
      if (mdjScriptSrcBasename(nodes[i].src) === want) {
        return Promise.resolve();
      }
    }
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error('script ' + src));
      };
      (document.head || document.documentElement).appendChild(s);
    });
  }

  function mdjEnsureSubscriptionScriptForEventCart() {
    if (typeof window.MDB_SUBSCRIPTION === 'object' && window.MDB_SUBSCRIPTION) {
      return Promise.resolve();
    }
    return mdjAppendScriptOnce('./subscription.js?v=20260422-find-dj-rank');
  }

  /** Adapter → builder → bridge (idempotent via mdjAppendScriptOnce). */
  function mdjChainGlobalEventBuilderScripts() {
    window.MDJ_EVENT_BUILDER_V1 = true;
    return mdjEnsureSubscriptionScriptForEventCart()
      .then(function () {
        return mdjAppendScriptOnce('./js/mdj-event-builder-adapter.js?v=20260514-eb-1a');
      })
      .then(function () {
        return mdjAppendScriptOnce('./js/mdj-event-builder.js?v=20260603-eb-context-date-bar-1');
      })
      .then(function () {
        return mdjAppendScriptOnce('./js/mdj-event-builder-rentals-bridge.js?v=20260514-eb-1b1');
      });
  }

  /**
   * Event Cart global mount — single source of truth via mdj-event-cart-root-fragment.html.
   * Skips only: rentals (has its own inline cart). All other pages receive the cart via fetch().
   * Reads HTML fragment + CSS; loads adapter/builder/bridge after `MDJ_EVENT_BUILDER_V1`.
   */
  function mdjMountGlobalEventCartIfNeeded() {
    if (typeof document === 'undefined' || !document.body) return;
    if (window.MDJ_SKIP_GLOBAL_EVENT_CART) return;
    if (mdjIsRentalsEventCartPage()) return;
    if (document.getElementById('mdj-event-builder-root')) return;
    if (!document.getElementById('mainHeader')) return;
    if (window.__mdjEventCartGlobalMounting) return;
    window.__mdjEventCartGlobalMounting = true;

    var mainHeader = document.getElementById('mainHeader');
    var row = mainHeader ? mainHeader.querySelector('.header-avatar-cart-row') : null;
    var mountParent = null;
    var useSlotFallback = false;
    if (row) {
      mountParent = row;
    } else {
      var fbSel = ['.header-actions', '.topbar-actions', '.header-top'];
      var fbNode = null;
      var fi;
      for (fi = 0; fi < fbSel.length; fi++) {
        fbNode = mainHeader.querySelector(fbSel[fi]);
        if (fbNode) break;
      }
      mountParent = fbNode || mainHeader;
      useSlotFallback = true;
    }
    if (!mountParent) {
      window.__mdjEventCartGlobalMounting = false;
      return;
    }

    if (!document.getElementById('mdj-eb-header-cart-open')) {
      var shopLink = document.getElementById('header-cart-link');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'mdj-eb-header-cart-open';
      btn.className = 'header-cart-btn mdj-eb-header-cart-open';
      btn.setAttribute('title', 'Event cart');
      btn.setAttribute('aria-label', 'Open event cart');
      /* Gold hardcoded — works on every page regardless of which CSS loads */
      btn.style.cssText = 'color:rgba(212,175,55,0.95);border:1px solid rgba(197,160,89,0.42);background:rgba(255,255,255,0.08);border-radius:50%;width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;position:relative;flex-shrink:0;';
      btn.innerHTML =
        '<span aria-hidden="true">🛒</span>' +
        '<span id="mdj-eb-header-count" class="header-cart-count" hidden style="background:#c5a059;color:#0a0a0a;position:absolute;top:-2px;right:-2px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;font-size:11px;font-weight:800;line-height:18px;text-align:center;"></span>';
      if (!useSlotFallback) {
        if (shopLink && shopLink.parentNode === row) {
          if (shopLink.nextSibling) {
            row.insertBefore(btn, shopLink.nextSibling);
          } else {
            row.appendChild(btn);
          }
        } else {
          row.appendChild(btn);
        }
      } else {
        var ebSlot = mainHeader.querySelector('[data-mdj-eb-header-cart-slot="1"]');
        if (!ebSlot) {
          ebSlot = document.createElement('span');
          ebSlot.className = 'mdj-eb-header-cart-slot';
          ebSlot.setAttribute('data-mdj-eb-header-cart-slot', '1');
          ebSlot.setAttribute('style', 'display:inline-flex;align-items:center;vertical-align:middle;');
          mountParent.appendChild(ebSlot);
        } else if (!mountParent.contains(ebSlot)) {
          mountParent.appendChild(ebSlot);
        }
        ebSlot.appendChild(btn);
      }
    }

    if (!document.getElementById('mdj-event-cart-css')) {
      var lk = document.createElement('link');
      lk.id = 'mdj-event-cart-css';
      lk.rel = 'stylesheet';
      lk.href = './mdj-event-cart.css?v=20260603-cart-topbar-read-1';
      (document.head || document.documentElement).appendChild(lk);
    }

    var fragUrl = './mdj-event-cart-root-fragment.html?v=20260603-cart-topbar-read-1';
    fetch(fragUrl, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('event cart fragment ' + res.status);
        return res.text();
      })
      .then(function (html) {
        if (document.getElementById('mdj-event-builder-root')) {
          return mdjChainGlobalEventBuilderScripts();
        }
        var wrap = document.createElement('div');
        wrap.innerHTML = String(html || '').trim();
        var root = wrap.firstElementChild;
        if (!root || root.id !== 'mdj-event-builder-root') {
          throw new Error('bad event cart fragment');
        }
        document.body.appendChild(root);
        return mdjChainGlobalEventBuilderScripts();
      })
      .catch(function (err) {
        try {
          console.warn('[MDJ] Global Event Cart mount:', err && err.message ? err.message : err);
        } catch (e1) {
          void e1;
        }
      })
      .finally(function () {
        window.__mdjEventCartGlobalMounting = false;
      });
  }

  /**
   * Mapea último segmento de URL (sin .html/.htm) → `data-mdj-nav` del #mainNav.
   * Auditoría pestañas ↔ fichero/slug (mantener al añadir páginas):
   * | data-mdj-nav | Rutas / slugs reconocidos |
   * | home         | index (hash solo en rama index abajo) |
   * | services     | rentals, services, servicios |
   * | venues       | index + hash (abajo); slug suelto: eventos, events, experiencias |
   * | shop         | shop |
   * | tools        | dj-tools, djtools, djs-tools, dj_tools |
   * | jobs         | jobs, trabajos, empleos |
   * | contact      | index + hash contact; página suelta: contact, contacto |
   * | mi-portal    | client-portal, client-billing, mi-portal, portal-cliente, … |
   * | my-profile   | dj-profile cuando ?id= usuario con sesión (perfil artístico propio) |
   * | config       | account-settings (hub central de configuraciones) |
   * | flow         | dj-dashboard?tab=flow (Flujo de caja) |
   * | agenda       | dj-dashboard sin tab, o ?tab=dashboard (vista Agenda del panel) |
   * | (ninguno)    | dj-dashboard (otras ?tab=), panel-artista |
   * | courses      | courses, cursos |
   * | booth        | booth, ai-booth |
   * | staff        | admin-dashboard |
   * | home (extra) | find-dj, directory, directorio |
   */
  function mdjResolveNavKeyFromBase(base) {
    var b = String(base || '').toLowerCase().replace(/\.html?$/i, '');
    if (b === 'admin-dashboard' || b === 'admin_dashboard') return 'staff';
    if (b === 'account-settings' || b === 'account_settings') return 'config';
    if (b === 'client-account' || b === 'client_account') return 'client-config';
    if (b === 'shop') return 'shop';
    if (b === 'courses' || b === 'cursos') return 'courses';
    if (b === 'booth' || b === 'ai-booth' || b === 'ai_booth' || b === 'cabina') return 'booth';
    if (b === 'dj-tools' || b === 'djtools' || b === 'djs-tools' || b === 'dj_tools') return 'tools';
    if (b === 'jobs' || b === 'trabajos' || b === 'empleos') return 'jobs';
    if (b === 'rentals' || b === 'services' || b === 'servicios') return 'services';
    if (b === 'eventos' || b === 'events' || b === 'experiencias') return 'venues';
    if (b === 'contact' || b === 'contacto') return 'contact';
    if (b === 'find-dj' || b === 'directory' || b === 'directorio') return 'home';
    if (b === 'dj-profile' || b === 'perfil-dj' || b === 'perfil_dj') {
      try {
        var qid = (new URLSearchParams((typeof location !== 'undefined' && location.search) || '').get('id') || '').trim();
        var own = window.__mdjNavOwnUserId ? String(window.__mdjNavOwnUserId).trim() : '';
        if (qid && own && qid === own) return 'my-profile';
      } catch (eProf) { /* ignore */ }
      return '';
    }
    if (
      b === 'dj-dashboard' ||
      b === 'artist-dashboard' ||
      b === 'panel-artista' ||
      b === 'panel_artista' ||
      b === 'artistdashboard'
    ) {
      try {
        var qtab = (new URLSearchParams((typeof location !== 'undefined' && location.search) || '').get('tab') || '').trim().toLowerCase();
        if (qtab === 'settings') return 'config';
        if (qtab === 'flow') return 'flow';
        if (!qtab || qtab === 'dashboard') return 'agenda';
      } catch (eTab) { /* ignore */ }
      return '';
    }
    if (
      b === 'client-portal' ||
      b === 'client-billing' ||
      b === 'mi-portal' ||
      b === 'mi_portal' ||
      b === 'portal-cliente' ||
      b === 'portal_cliente'
    ) {
      return 'mi-portal';
    }
    return '';
  }

  function mdjNavHighlight() {
    var path = mdjNavPathLeaf();
    /** Sin .html/.htm; index.php / default → index para hash de inicio/contacto/eventos */
    var base = String(path || '')
      .toLowerCase()
      .replace(/\.html$/i, '')
      .replace(/\.htm$/i, '');
    if (base === 'index.php' || base === 'index.aspx' || base === 'default' || base === 'home') base = 'index';
    var hash = (location.hash || '').replace(/^#/, '').toLowerCase();
    var key = '';
    if (base === 'index') {
      if (hash === 'venues' || hash === 'experience' || hash === 'eventos' || hash === 'patrocinadores' || hash === 'sponsors') key = 'venues';
      else if (hash === 'services') key = 'services';
      else if (hash === 'contact' || hash === 'contacto') key = 'contact';
      else key = 'home';
    } else {
      key = mdjResolveNavKeyFromBase(base);
    }

    document.querySelectorAll('#mainNav a[data-mdj-nav], .mobile-nav a[data-mdj-nav], .mdj-eb-cart-topbar a[data-mdj-nav]').forEach(function (el) {
      el.classList.toggle('active', key && el.getAttribute('data-mdj-nav') === key);
    });
    if (document.body && document.body.classList.contains('mdj-artist-header-mode')) {
      mdjNavHighlightArtist();
    }
    mdjHighlightEventsPageNav();
  }

  window.mdjNavHighlight = mdjNavHighlight;

  window.doLogout = async function doLogout(e) {
    if (e) e.preventDefault();
    var sb = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
    if (!sb && window.supabase && window.MDB_SUPABASE_URL && window.MDB_SUPABASE_ANON_KEY) {
      try {
        sb = window.supabase.createClient(window.MDB_SUPABASE_URL, window.MDB_SUPABASE_ANON_KEY);
      } catch (e0) { /* ignore */ }
    }
    try {
      if (sb && sb.auth && typeof sb.auth.signOut === 'function') {
        try {
          await sb.auth.signOut({ scope: 'global' });
        } catch (eScope) {
          await sb.auth.signOut();
        }
      }
    } catch (err) {
      console.warn('[MDJ-SYSTEM] Supabase signOut error:', err);
    }
    if (typeof window.mdjClearClientStorageOnLogout === 'function') {
      window.mdjClearClientStorageOnLogout();
    } else {
      try {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      } catch (x) { /* ignore */ }
    }
    try {
      sessionStorage.removeItem('mdj_session');
      sessionStorage.removeItem('mdj_cart');
    } catch (x2) { /* ignore */ }
    window.location.href = './index.html';
  };

  function mdjHeaderIsUnifiedMainHeader() {
    var h = document.getElementById('mainHeader');
    return !!(h && h.classList && h.classList.contains('mdj-header-unified'));
  }

  function mdjHeaderMonetizationCtaMarkHidden(el) {
    if (!el) return;
    try {
      el.removeAttribute('data-mdj-monetization-visible');
    } catch (e) {
      void e;
    }
    /*
     * Fila 1 unificada: con sesión `.header-actions` sube por encima de la marca (z-index).
     * `display: none` sin !important pierde frente a .btn-pill / inline-flex del JS → PRO/GRATIS/DJPRO encima del wordmark.
     * Solo CTAs de escritorio + badge; `#header-subscribe-free-mobile` sigue con `display: none` normal (drawer).
     */
    var id = el.id || '';
    if (id === 'header-get-pro-btn' || id === 'header-subscribe-free-btn' || id === 'header-djpro-badge') {
      try {
        el.style.setProperty('display', 'none', 'important');
      } catch (e1) {
        el.style.display = 'none';
      }
    } else {
      el.style.display = 'none';
    }
  }

  /** Marca visible tras sesión resuelta; el atributo desactiva la regla CSS de ocultación inicial. */
  function mdjHeaderMonetizationCtaMarkVisible(el, displayVal) {
    if (!el) return;
    if (mdjHeaderIsUnifiedMainHeader()) {
      mdjHeaderMonetizationCtaMarkHidden(el);
      return;
    }
    try {
      el.setAttribute('data-mdj-monetization-visible', '1');
    } catch (e2) {
      void e2;
    }
    try {
      el.style.removeProperty('display');
    } catch (e3) {
      void e3;
    }
    el.style.display = displayVal || 'inline-flex';
  }

  /**
   * Invitado real: el HTML trae PRO + GRATIS visibles; hasta resolver `getSession()` eso aprieta la marca.
   * Ocultar en el primer tick (y al re-entrar en checkSession) y dejar que cada rama vuelva a mostrar si aplica.
   */
  function mdjHeaderHideMonetizationCtasPending() {
    mdjHeaderMonetizationCtaMarkHidden(document.getElementById('header-get-pro-btn'));
    mdjHeaderMonetizationCtaMarkHidden(document.getElementById('header-subscribe-free-btn'));
    mdjHeaderMonetizationCtaMarkHidden(document.getElementById('header-djpro-badge'));
  }

  function mdjApplyGuestHeaderAvatar() {
    var z = document.getElementById('header-auth-zone');
    if (!z) return;
    mdjEnsureDesktopAuditCss();
    var guestHtml =
      '<a class="account-btn mdj-guest-access-trigger" id="accountBtn" href="#" onclick="return false;" title="Sesión inactiva" aria-label="Sesión inactiva">' +
      '<span class="mdj-guest-access-ring" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false">' +
      '<circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.75"/>' +
      '<path d="M5 20v-1a7 7 0 0 1 14 0v1" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>' +
      '</svg></span></a>';
    z.innerHTML = guestHtml;
    window.__mdjDefaultAuthZoneHtml = guestHtml;
    z.classList.remove('session-pending');
    z.style.display = 'inline-flex';
    z.style.alignItems = 'center';
  }

  window.checkSessionForNav = window.checkSessionForNav || async function checkSessionForNav() {
    var authZone = document.getElementById('header-auth-zone');
    if (authZone && !window.__mdjDefaultAuthZoneHtml && authZone.innerHTML && authZone.innerHTML.trim()) {
      window.__mdjDefaultAuthZoneHtml = authZone.innerHTML;
    }
    /* No volver a ocultar ENTRAR/SALIR si ya estamos en sesión (danger): evita parpadeo en TOKEN_REFRESHED, i18n, etc. */
    var skipAuthPillPending = false;
    ['header-login-btn', 'header-login-btn-mobile'].forEach(function (id) {
      var pb = document.getElementById(id);
      if (pb && pb.classList.contains('danger')) skipAuthPillPending = true;
    });
    if (!skipAuthPillPending) mdjSetHeaderAuthPillsPending(true);
    mdjHeaderHideMonetizationCtasPending();
    try {
      var sb = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
      if (!sb) {
        window.__mdjNavOwnUserId = '';
        window.__mdjLastNavTier = null;
        window.__mdjProToolsUnlocked = false;
        window.__mdjLastNavIsClient = false;
        window.showMyArtisticProfileMainNav = false;
        mdjEnsureDesktopAuditCss();
        mdjHideMiPortalButton();
        mdjApplyGuestHeaderAvatar();
        mdjApplyHeaderAuthPillSession(false);
        mdjSyncClientLoyaltyIndicator(false);
        mdjApplyDjToolsNavForTier(null);
        mdjApplyArtistDashboardNavChrome(false);
        mdjApplyStaffMainNavLink(false);
        mdjApplyConfigMainNavLink(false);
        mdjApplyAgendaMainNavLink(false);
        mdjApplyFlowMainNavLink(false);
        mdjApplyNavTierStatusBadge(null);
        mdjApplyArtistHeaderRow2(false);
        mdjRevealGuestMiPerfilNavSlot();
        mdjRevealGuestRoleEntryNav();
        /* PRO/FREE: ya ocultos vía mdjHeaderHideMonetizationCtasPending() + CSS hasta sesión. */
        return;
      }
      var res = await sb.auth.getSession();
      var session = res.data && res.data.session;
      if (session) {
        try {
          var ur = await sb.auth.getUser();
          if (ur && ur.data && ur.data.user) {
            session = Object.assign({}, session, { user: ur.data.user });
          }
        } catch (eGu) { /* ignore */ }
      }

      if (session) {
        window.__mdjNavOwnUserId =
          session.user && session.user.id ? String(session.user.id) : '';
        mdjEnsureMiPortalHydratingPlaceholder();
        var subFreeDesk = document.getElementById('header-subscribe-free-btn');
        var subFreeMob = document.getElementById('header-subscribe-free-mobile');
        mdjHeaderMonetizationCtaMarkHidden(subFreeDesk);
        mdjHeaderMonetizationCtaMarkHidden(subFreeMob);

        var getProBtn = document.getElementById('header-get-pro-btn');
        if (authZone) authZone.style.display = 'inline-flex';

        try {
          var pr = await sb.from('dj_profiles').select('role, photo_url, dj_name, stage_name, username, plan_type, plan, plan_status, plan_expires_at, is_premium, hardware_token').eq('user_id', session.user.id).maybeSingle();
          var p = pr.data;
          var djProfileErr = pr && pr.error ? pr.error : null;
          var clientRow = null;
          try {
            var cpr = await sb
              .from('client_profiles')
              .select('user_id, full_name, email, photo_url, avatar_url, username')
              .eq('user_id', session.user.id)
              .maybeSingle();
            clientRow = cpr && cpr.data ? cpr.data : null;
          } catch (cErr) { /* ignore */ }
          var hasClientRow = !!(clientRow && clientRow.user_id);
          var metaUt = session.user && session.user.user_metadata && session.user.user_metadata.user_type;
          var appRole = session.user && session.user.app_metadata && session.user.app_metadata.role;
          var djRowRole = p ? String(p.role || '').toLowerCase() : '';
          var metaUtLower = metaUt ? String(metaUt).toLowerCase() : '';
          /* Dos caminos: cuenta de usuario (cliente) ≠ artista. Si el JWT dice explícitamente client, nunca UI de DJ aunque exista dj_profiles. */
          var sessionIsExplicitClient = metaUtLower === 'client';
          var jwtArtist = sessionIsExplicitClient
            ? false
            : metaUt === 'talent' ||
              metaUt === 'dj' ||
              (appRole && String(appRole).toLowerCase() === 'artist') ||
              (appRole && /^(owner|manager|admin|staff|seller)$/i.test(String(appRole))) ||
              (!!p && djRowRole !== 'client');
          var appRoleLower = appRole ? String(appRole).toLowerCase() : '';
          var metadataSaysClient = metaUtLower === 'client' || appRoleLower === 'client';
          /* jwtArtist: no forzar «cliente» solo por tener client_profiles (muchos artistas tienen ambas filas).
           * Guard djProfileErr: si la query de dj_profiles falló (red lenta en móvil), p=null por error, no por
           * ausencia real de perfil — no clasificar como cliente en ese caso (TICKET-ROLE-REDIRECT-002). */
          var isClient = sessionIsExplicitClient
            ? true
            : (p && djRowRole === 'client') ||
              (!p && !djProfileErr && hasClientRow && !jwtArtist) ||
              (!p && !djProfileErr && metadataSaysClient && !jwtArtist);

          var viewingOwnDjProfile = false;
          try {
            var pathSeg = (window.location.pathname || '').split('/').pop() || '';
            if (/^dj-profile\.html$/i.test(pathSeg) && session.user) {
              var qidOwn = (new URLSearchParams(window.location.search || '').get('id') || '').trim();
              var _sid = String(session.user.id);
              /* Página: sin ?id= carga el propio user_id; con ?id= debe ser el tuyo. UUID case-insensitive. */
              viewingOwnDjProfile = !qidOwn || qidOwn.toLowerCase() === _sid.toLowerCase();
            }
          } catch (eOwn) { /* ignore */ }
          /*
           * En **tu** dj-profile, la pastilla «Cliente» solo si la fila DJ es rol client;
           * nunca mezclar caja de comprador (client_profiles) con artista/staff/owner.
           */
          if (viewingOwnDjProfile) {
            isClient = !!(
              p && String(p.role || '').toLowerCase().trim() === 'client'
            );
          }
          var hasDjProfile = !!(p && djRowRole !== 'client');
          var idn =
            typeof window.mdjClassifyPlatformIdentity === 'function'
              ? window.mdjClassifyPlatformIdentity({
                  user: session.user,
                  djRow: p,
                  clientRow: clientRow
                })
              : null;
          /* Staff: solo dj_profiles (mismo criterio que admin y RLS). Fallback sin mdj-identity.js puesto arriba en el HTML. */
          var isDjStaff = idn
            ? !!idn.staffInDb
            : !!p &&
                (djRowRole === 'admin' ||
                  djRowRole === 'manager' ||
                  djRowRole === 'seller' ||
                  djRowRole === 'owner');
          var isNavStaffSolo = idn ? !!idn.navStaffSolo : !!p && djRowRole === 'seller';
          try {
            window.__mdjLastPlatformIdentity = idn || {
              staffInDb: isDjStaff,
              navStaffSolo: isNavStaffSolo,
              principal: isDjStaff ? 'staff' : 'performer',
              dbRole: djRowRole
            };
          } catch (eId) { /* ignore */ }
          /*
           * client_profiles (compras / portal) no debe etiquetar como «cliente» a owner/staff/team en dj_profiles o JWT.
           * Sin esto, owner con fila cliente ve pastilla «Cliente» junto a SALIR.
           */
          if (isDjStaff) {
            isClient = false;
          }
          if (!sessionIsExplicitClient && appRoleLower === 'owner') {
            isClient = false;
          }
          var isProUser = p && (
            p.is_premium === true
            || ['PRO', 'ELITE'].includes(p.plan)
            || (['pro_monthly', 'pro_annual', 'PRO'].includes(p.plan_type) && (p.plan_status || 'active') === 'active' && (!p.plan_expires_at || new Date(p.plan_expires_at) > new Date()))
          );
          var mainHdr = document.getElementById('mainHeader');
          var unifiedHeader = !!(mainHdr && mainHdr.classList && mainHdr.classList.contains('mdj-header-unified'));
          var djproBadge = document.getElementById('header-djpro-badge');
          if (getProBtn) {
            if (unifiedHeader || isClient || isNavStaffSolo || isProUser) {
              mdjHeaderMonetizationCtaMarkHidden(getProBtn);
            } else {
              mdjHeaderMonetizationCtaMarkVisible(getProBtn, 'inline-flex');
            }
          }
          var hideHeaderProChrome =
            !!(document.body && document.body.classList && document.body.classList.contains('dj-profile'));
          if (djproBadge) {
            if (unifiedHeader || hideHeaderProChrome || !(isProUser && !isClient && !isNavStaffSolo)) {
              try {
                djproBadge.style.setProperty('display', 'none', 'important');
              } catch (eDb) {
                djproBadge.style.display = 'none';
              }
            } else {
              try {
                djproBadge.style.removeProperty('display');
              } catch (eDb2) {
                void eDb2;
              }
              djproBadge.style.display = 'inline-flex';
            }
          }
          /* Pastilla portal: Cliente | Cliente VIP — solo sesión comprador (no staff / owner). */
          mdjSyncClientLoyaltyIndicator(!!isClient && !isNavStaffSolo, clientRow);
          /* Con cuenta y sin PRO: el CTA lleva a Jobs — mismas tarjetas de abajo (LITE free o PRO de pago), no a login. */
          if (getProBtn && !isProUser && !isClient) {
            getProBtn.href = './jobs.html#selection-screen';
          }

          var meta = session.user && session.user.user_metadata ? session.user.user_metadata : {};
          var sessionAvatar =
            meta.avatar_url || meta.picture || meta.picture_url || meta.photo_url || meta.custom_avatar_url;
          var clientPic = '';
          if (clientRow) {
            clientPic = (clientRow.avatar_url || clientRow.photo_url || '').trim();
          }
          /* Artistas: si hay foto en dj_profiles, es la única fuente para el header (OAuth no pisa). Clientes: client_profiles + fallback. */
          var rawPhoto = '';
          if (!isClient && p && p.photo_url) {
            var candDj = mdjNormalizeAvatarStorageUrl(String(p.photo_url).trim());
            if (mdjIsRealPhotoUrl(candDj.split('?')[0])) rawPhoto = candDj;
          }
          if (!rawPhoto) {
            rawPhoto = mdjPickHeaderProfilePhotoUrl(isClient, p, sessionAvatar, clientPic);
          }
          rawPhoto = mdjNormalizeAvatarStorageUrl(rawPhoto);
          var hasRealPhoto = mdjIsRealPhotoUrl(rawPhoto.split('?')[0]);

          var displayName = '';
          if (isClient) {
            if (clientRow && clientRow.full_name && String(clientRow.full_name).trim()) {
              displayName = mdjVipFirstNameOnly(String(clientRow.full_name).trim());
            } else if (meta.full_name && String(meta.full_name).trim()) {
              displayName = mdjVipFirstNameOnly(String(meta.full_name).trim());
            } else if (meta.display_name && String(meta.display_name).trim()) {
              displayName = mdjVipFirstNameOnly(String(meta.display_name).trim());
            }
          } else {
            if (p) {
              var st = p.stage_name && String(p.stage_name).trim();
              var dj = p.dj_name && String(p.dj_name).trim();
              if (st) displayName = st;
              else if (dj) displayName = dj;
            }
            if (!displayName && meta.artistic_name && String(meta.artistic_name).trim()) {
              displayName = String(meta.artistic_name).trim();
            }
            if (!displayName && meta.stage_name && String(meta.stage_name).trim()) {
              displayName = String(meta.stage_name).trim();
            }
            if (!displayName && p && (p.stage_name || p.dj_name)) {
              displayName = String(p.stage_name || p.dj_name).trim();
            }
            if (!displayName && meta.full_name && String(meta.full_name).trim()) {
              displayName = mdjVipFirstNameOnly(String(meta.full_name).trim());
            }
          }
          if (!displayName && meta.display_name && String(meta.display_name).trim()) {
            displayName = mdjVipFirstNameOnly(String(meta.display_name).trim());
          }
          if (!displayName) displayName = 'Member';
          window.__mdjBoothDisplayName = displayName;

          var avatarInitials = mdjComputeInitials(displayName, session.user && session.user.email);
          var useAvatarInitials = !hasRealPhoto;

          var uid = session.user && session.user.id;
          var publicProfileUrl = uid
            ? './dj-profile.html?id=' + encodeURIComponent(uid)
            : './dj-profile.html';

          var isArtistSession =
            !isClient && (!!hasDjProfile || !!jwtArtist || (!!djProfileErr && !!jwtArtist));
          var settingsUrl;
          var settingsLabel;
          if (isClient) {
            settingsUrl = './client-account.html';
            settingsLabel = mdjGetVipPortalMenuLabel();
          } else if (isNavStaffSolo || isDjStaff || appRoleLower === 'owner') {
            /* owner / admin / manager / seller → account settings, not artist dashboard */
            settingsUrl = './account-settings.html';
            settingsLabel = mdjGetStaffAccountSettingsMenuLabel();
          } else {
            /* Artista DJ → nuevo hub de configuraciones. */
            settingsUrl = './account-settings.html?mdj_nav=profile';
            settingsLabel = mdjGetDjDashboardMenuLabel();
          }

          /** Matriz: cliente solo | artista LITE | artista PRO (incl. staff con dj_profiles: misma pastilla Talento/Dueño). */
          var navTier;
          if (isDjStaff || appRoleLower === 'owner') {
            navTier = 'client_only'; /* staff/owner → never artist rail, even if dj_profiles row exists */
          } else if (hasDjProfile) {
            navTier = isProUser ? 'artist_pro' : 'artist_lite';
          } else if (isClient) {
            navTier = 'client_only';
          } else if (jwtArtist || isArtistSession) {
            navTier = 'artist_lite';
          } else {
            navTier = 'client_only';
          }

          var miPortalHref = appRoleLower === 'owner'
            ? publicProfileUrl /* owner → public manager profile (dj-profile.html?id=uid) */
            : (isNavStaffSolo ? './account-settings.html' : './client-portal.html');
          var miPortalNavOpts = isNavStaffSolo ? { variant: 'staff-settings' } : null;

          var isBuyerSession = mdjResolveBuyerSession({
            isClient: isClient,
            settingsUrl: settingsUrl,
            idn: idn,
            hasClientRow: hasClientRow,
            hasDjProfile: hasDjProfile,
            clientRow: clientRow,
            isDjStaff: isDjStaff,
            isNavStaffSolo: isNavStaffSolo,
            metadataSaysClient: metadataSaysClient,
            sessionIsExplicitClient: sessionIsExplicitClient
          });
          window.__mdjLastBuyerSession = isBuyerSession;
          if (isBuyerSession) {
            isClient = true;
            mdjSyncClientLoyaltyIndicator(true, clientRow);
          }

          mdjMountOrUpdateVipAccountZone({
            displayName: displayName,
            avatarUrl: hasRealPhoto ? String(rawPhoto).trim() : '',
            useAvatarInitials: useAvatarInitials,
            avatarInitials: avatarInitials,
            profileUrl: settingsUrl,
            profileLabel: settingsLabel,
            isClient: isClient
          });
          if (hasRealPhoto && rawPhoto && typeof window.mdjHeaderVipApplyPhotoUrl === 'function') {
            window.mdjHeaderVipApplyPhotoUrl(String(rawPhoto).trim());
          }
          try {
            if (!isClient) {
              var acbFix = document.getElementById('accountBtn');
              if (acbFix) {
                acbFix.setAttribute('href', '#');
                acbFix.onclick = function () { return false; };
              }
            }
          } catch (eHref) { /* ignore */ }

          mdjApplyDjToolsNavForTier(navTier);
          if (document.body && document.body.classList && document.body.classList.contains('dj-profile')) {
            mdjApplyNavTierStatusBadge(null);
          } else {
            mdjApplyNavTierStatusBadge(navTier, { djRole: djRowRole || '' });
          }

          mdjMaybeRunVipWelcomeProtocol(session);

          if (document.getElementById('mainNav')) {
            /* Nav compacto: MY PORTAL para cliente siempre; artista/staff no usan esta fila para portal. */
            var _compactNavCheck = (function () { var _n = document.getElementById('mainNav'); return !!(_n && _n.getAttribute('data-mdj-compact-nav') === '1'); }());
            if (isBuyerSession) {
              mdjEnsureMiPortalInMainNav(miPortalHref, miPortalNavOpts);
            } else {
              /* Artista/staff: reset del placeholder MI PORTAL que se mostró durante la carga. */
              var _portalSlot = document.getElementById('mainNav-mi-portal-link');
              if (_portalSlot) {
                _portalSlot.classList.remove('mdj-mi-portal--hydrating');
                _portalSlot.classList.add('mdj-mi-portal--guest');
                _portalSlot.setAttribute('aria-hidden', 'true');
                _portalSlot.setAttribute('tabindex', '-1');
              }
            }
            var hdrDup = document.getElementById('header-mi-portal-btn');
            if (hdrDup) hdrDup.style.display = 'none';
          } else {
            mdjEnsureMiPortalButton(miPortalHref);
          }
          if (isBuyerSession) mdjEnsureMiPortalMobile(miPortalHref, miPortalNavOpts);
          var showMyArtisticProfileMainNav = mdjResolveShowMyArtisticProfileMainNav({
            isClient: isClient,
            isNavStaffSolo: isNavStaffSolo,
            navTier: navTier,
            allowUidFallback: true
          });
          mdjApplyStaffMainNavLink(!!isDjStaff);
          if (isDjStaff) {
            document.body.classList.add('mdj-staff-nav');
          } else {
            document.body.classList.remove('mdj-staff-nav');
          }
          var showArtistDashMainNav = !isClient && (navTier === 'artist_lite' || navTier === 'artist_pro');
          var onPublicHome = mdjIsPublicHomePage();
          /* Centinela nav compacto: services/events usan data-mdj-compact-nav="1" → bloquea inyección de Agenda/Flow/rail artista. */
          var isCompactNav = (function () {
            var _n = document.getElementById('mainNav');
            return !!(_n && _n.getAttribute('data-mdj-compact-nav') === '1');
          }());
          var showArtistHeaderNav =
            !mdjIsPublicHomePage() &&
            !isCompactNav &&
            !isClient &&
            !isNavStaffSolo &&
            !isDjStaff &&
            (navTier === 'artist_lite' || navTier === 'artist_pro');
          /* Inicio: ⚙️ CONFIG artista/staff; comprador → Configuraciones (client-account). */
          /* hasClientRow ya no excluye artistas (pueden tener ambas filas); isBuyerSession es la fuente correcta. */
          var showConfigOnHome =
            onPublicHome && !!window.__mdjNavOwnUserId && !isBuyerSession;
          mdjApplyAgendaMainNavLink(
            !!showArtistDashMainNav && !onPublicHome && !isCompactNav && !showArtistHeaderNav,
            './dj-dashboard.html?tab=dashboard'
          );
          if (isBuyerSession) {
            mdjApplyConfigMainNavLink(false);
            mdjApplyBuyerConfigMainNavLink(true);
          } else {
            mdjApplyConfigMainNavLink(
              (!!showArtistDashMainNav && !onPublicHome && !isCompactNav && !showArtistHeaderNav) ||
                showConfigOnHome ||
                (isCompactNav && !!window.__mdjNavOwnUserId && !showArtistDashMainNav),
              settingsUrl
            );
          }
          mdjApplyFlowMainNavLink(
            !!showArtistDashMainNav && !onPublicHome && !isCompactNav && !showArtistHeaderNav,
            './dj-dashboard.html?tab=flow'
          );
          mdjApplyArtistHeaderRow2(!!showArtistHeaderNav);
          mdjApplyArtistSessionNav(showMyArtisticProfileMainNav, publicProfileUrl);
          /* Clientes y clientes comerciales: MI PERFIL no aplica — su destino es MY PORTAL. */
          if (isBuyerSession) {
            var _clientPerfilEl = document.getElementById('mainNav-guest-mi-perfil-link');
            if (_clientPerfilEl) {
              _clientPerfilEl.classList.add('mdj-mainnav-reserved-slot');
              _clientPerfilEl.setAttribute('aria-hidden', 'true');
              _clientPerfilEl.setAttribute('tabindex', '-1');
            }
          }
          /* Owner 9-pillar: ensure MI PERFIL slot is explicitly revealed after generic activation.
             mdjApplyArtistSessionNav covers artists; for owner (staff, navTier='client_only')
             the generic path may skip revelation — this guard makes it unconditional. */
          if ((appRoleLower === 'owner' || appRoleLower === 'admin' || appRoleLower === 'manager' || isDjStaff) && window.__mdjNavOwnUserId) {
            mdjApplyConfigMainNavLink(true, settingsUrl);
            var _ownerMp = mdjEnsureGuestMiPerfilMainNavLink();
            if (_ownerMp) {
              var _staffUid = String(window.__mdjNavOwnUserId || '').trim();
              _ownerMp.href = './dj-profile.html?id=' + encodeURIComponent(_staffUid); /* owner → perfil público */
              var _staffBuyerJourneyMiPerfil =
                isDjStaff && !isBuyerSession && mdjIsBuyerJourneyPage() && !mdjIsPublicHomePage();
              if (_staffBuyerJourneyMiPerfil) {
                var _oNavBj = document.getElementById('mainNav');
                if (_oNavBj) {
                  ['shop', 'contact'].forEach(function (key) {
                    _oNavBj.querySelectorAll('a[data-mdj-nav="' + key + '"]').forEach(function (el) {
                      el.classList.remove('mdj-mainnav-reserved-slot');
                      el.removeAttribute('aria-hidden');
                      el.removeAttribute('tabindex');
                      el.style.setProperty('display', 'inline-flex', 'important');
                      el.style.setProperty('width', 'auto', 'important');
                      el.style.setProperty('min-width', 'max-content', 'important');
                      el.style.setProperty('flex', '0 0 auto', 'important');
                      el.style.setProperty('pointer-events', 'auto', 'important');
                      el.style.removeProperty('visibility');
                    });
                  });
                }
                mdjApplyMiPerfilNavLabel(_ownerMp);
                _ownerMp.classList.remove('mdj-mainnav-reserved-slot');
                _ownerMp.removeAttribute('aria-hidden');
                _ownerMp.removeAttribute('tabindex');
                _ownerMp.style.setProperty('display', 'inline-flex', 'important');
                _ownerMp.style.setProperty('width', 'auto', 'important');
                _ownerMp.style.setProperty('min-width', 'max-content', 'important');
                _ownerMp.style.setProperty('flex', '0 0 auto', 'important');
                _ownerMp.style.setProperty('pointer-events', 'auto', 'important');
                _ownerMp.style.removeProperty('visibility');
                var _oContact = _oNavBj && _oNavBj.querySelector('a[data-mdj-nav="contact"]');
                if (_oNavBj && _oContact && _oContact.parentNode === _oNavBj && _oContact.nextSibling !== _ownerMp) {
                  if (_oContact.nextSibling) _oNavBj.insertBefore(_ownerMp, _oContact.nextSibling);
                  else _oNavBj.appendChild(_ownerMp);
                }
              } else {
                _ownerMp.classList.remove('mdj-mainnav-reserved-slot');
                _ownerMp.removeAttribute('aria-hidden');
                _ownerMp.removeAttribute('tabindex');
                _ownerMp.style.setProperty('display', 'inline-flex', 'important');
                _ownerMp.style.setProperty('min-width', 'max-content', 'important');
                _ownerMp.style.setProperty('max-width', 'none', 'important');
                _ownerMp.style.setProperty('width', 'auto', 'important');
                _ownerMp.style.setProperty('flex', '0 0 auto', 'important');
                _ownerMp.style.setProperty('pointer-events', 'auto', 'important');
                _ownerMp.style.removeProperty('visibility');
                /* Position: after CONTACTO (last visible nav item for owner). */
                var _oNav = document.getElementById('mainNav');
                var _oContact = _oNav && _oNav.querySelector('a[data-mdj-nav="contact"]');
                if (_oNav && _oContact && _oContact.parentNode === _oNav && _oContact.nextSibling !== _ownerMp) {
                  if (_oContact.nextSibling) _oNav.insertBefore(_ownerMp, _oContact.nextSibling);
                  else _oNav.appendChild(_ownerMp);
                } else if (_oNav && _ownerMp.parentNode !== _oNav) {
                  _oNav.appendChild(_ownerMp);
                }
              }
            }
            /* Flujo de caja: reveal at slot 5 (after SHOP, before CONFIG).
               mdjApplyFlowMainNavLink(false) runs at line ~2686 before this guard,
               so we run AFTER it and override. */
            if (window.location.pathname.indexOf('account-settings') !== -1) {
              var _oNavF = document.getElementById('mainNav');
              var _flowEl = _oNavF && (
                document.getElementById('mainNav-flow-link') ||
                _oNavF.querySelector('a[data-mdj-nav="flow"]')
              );
              if (_flowEl && _oNavF) {
                var _fUid = window.__mdjNavOwnUserId || '';
                _flowEl.href = _fUid
                  ? './dj-dashboard.html?tab=flow&id=' + encodeURIComponent(_fUid)
                  : './dj-dashboard.html?tab=flow';
                _flowEl.textContent = 'CASH FLOW';
                _flowEl.removeAttribute('data-i18n');
                _flowEl.classList.remove('mdj-mainnav-reserved-slot');
                _flowEl.removeAttribute('aria-hidden');
                _flowEl.removeAttribute('tabindex');
                _flowEl.style.removeProperty('display');
                _flowEl.style.removeProperty('visibility');
                _flowEl.style.removeProperty('pointer-events');
                var _shopEl = _oNavF.querySelector('a[data-mdj-nav="shop"]');
                if (_shopEl && _shopEl.parentNode === _oNavF && _shopEl.nextSibling !== _flowEl) {
                  _oNavF.insertBefore(_flowEl, _shopEl.nextSibling || null);
                }
              }
            }
          }
          mdjNormalizePublicHomeMainNav();
          if (isBuyerSession) {
            mdjApplyBuyerSessionMainNav(miPortalHref);
          }
          mdjNavHighlight();
          mdjHighlightEventsPageNav();
          mdjRefreshAllStaffNavLinks();
          try {
            if (window.i18n && typeof window.i18n.updateUI === 'function') window.i18n.updateUI();
          } catch (eUi) { /* ignore */ }
          mdjRefreshAllStaffNavLinks();
          if (isBuyerSession) {
            mdjInstallMainNavStaticMode();
          }
          /* i18n solo toca [data-i18n]; por si el HTML inicial trae header-mi-portal en la 8.ª celda, reforzar staff.
             Guard: no re-mostrar MI PORTAL en Home — mdjNormalizePublicHomeMainNav() ya lo ocultó (TICKET-002).
             Owner guard: miPortalHref=dj-profile.html → mdjEnsureMiPortalInMainNav sets #mainNav-mi-portal-link
             text to "MI PERFIL" creating a duplicate. Owner/admin/manager already have
             #mainNav-guest-mi-perfil-link so keep #mainNav-mi-portal-link hidden. */
          if (isDjStaff && document.getElementById('mainNav') && !mdjIsPublicHomePage()) {
            var _isOwnerLikeRole = appRoleLower === 'owner' || appRoleLower === 'admin' || appRoleLower === 'manager';
            if (_isOwnerLikeRole) {
              var _mpPortalSlot = document.getElementById('mainNav-mi-portal-link');
              if (_mpPortalSlot) {
                _mpPortalSlot.classList.add('mdj-mainnav-reserved-slot');
                _mpPortalSlot.setAttribute('aria-hidden', 'true');
                _mpPortalSlot.setAttribute('tabindex', '-1');
              }
            } else {
              mdjEnsureMiPortalInMainNav(miPortalHref, miPortalNavOpts);
              mdjEnsureMiPortalMobile(miPortalHref, miPortalNavOpts);
            }
          }

          mdjApplyHeaderAuthPillSession(true);

          var navMobile = document.getElementById('nav-my-profile-mobile');
          if (navMobile) {
            if (miPortalHref === settingsUrl) {
              navMobile.style.display = 'none';
            } else {
              navMobile.style.display = 'block';
              navMobile.href = isClient ? settingsUrl : publicProfileUrl;
              navMobile.textContent = isClient ? settingsLabel : mdjGetArtistPublicProfileMenuLabel();
            }
          }

          document.querySelectorAll('a[href="./dj-profile.html"]').forEach(function (link) {
            if (link.id === 'accountBtn') return;
            if (isClient) {
              link.href = './client-portal.html';
              if (link.getAttribute('data-i18n') === 'menu-account') {
                link.textContent = 'Mi Portal';
              }
            } else if (isArtistSession) {
              link.href = publicProfileUrl;
            } else {
              link.href = './dj-dashboard.html';
            }
          });

          var myProfileBtn = document.getElementById('nav-my-profile');
          if (myProfileBtn) {
            myProfileBtn.href = isClient ? './client-portal.html' : publicProfileUrl;
            myProfileBtn.style.display = 'inline-block';
          }
        } catch (e) {
          console.error('[MDJ-SYSTEM] Error fetching profile for nav:', e);
          try {
            mdjApplyHeaderAuthPillSession(true);
          } catch (e2) { /* ignore */ }
          mdjApplyDjToolsNavForTier(null);
          window.showMyArtisticProfileMainNav = false;
          mdjApplyArtistDashboardNavChrome(false);
          mdjApplyStaffMainNavLink(false);
          mdjApplyConfigMainNavLink(false);
          mdjApplyAgendaMainNavLink(false);
          mdjApplyFlowMainNavLink(false);
          mdjApplyNavTierStatusBadge(null);
          mdjSyncClientLoyaltyIndicator(false);
          mdjApplyArtistHeaderRow2(false);
        }
      } else {
        window.__mdjNavOwnUserId = '';
        window.__mdjLastNavTier = null;
        window.__mdjProToolsUnlocked = false;
        window.__mdjLastNavIsClient = false;
        window.__mdjLastBuyerSession = false;
        try {
          document.body.classList.remove('mdj-buyer-session');
        } catch (eBsOff) { void eBsOff; }
        window.showMyArtisticProfileMainNav = false;
        mdjHideMiPortalButton();
        document.body.classList.remove('mdj-logged-in-header');
        mdjApplyArtistHeaderRow2(false);
        mdjApplyGuestHeaderAvatar();
        mdjApplyHeaderAuthPillSession(false);
        var djproBadge = document.getElementById('header-djpro-badge');
        var getProBtn = document.getElementById('header-get-pro-btn');
        var subFreeDesk2 = document.getElementById('header-subscribe-free-btn');
        if (djproBadge) mdjHeaderMonetizationCtaMarkHidden(djproBadge);
        /* Sin sesión: desktop sin PRO/GRATIS en fila superior; drawer móvil (#header-subscribe-free-mobile) intacto. */
        mdjHeaderMonetizationCtaMarkHidden(getProBtn);
        mdjHeaderMonetizationCtaMarkHidden(subFreeDesk2);
        mdjSyncClientLoyaltyIndicator(false);
        var npmGuest = document.getElementById('nav-my-profile-mobile');
        if (npmGuest) npmGuest.style.display = 'none';
        mdjApplyDjToolsNavForTier(null);
        mdjApplyArtistDashboardNavChrome(false);
        mdjApplyStaffMainNavLink(false);
        mdjApplyConfigMainNavLink(false);
        mdjApplyAgendaMainNavLink(false);
        mdjApplyFlowMainNavLink(false);
        mdjApplyNavTierStatusBadge(null);
        mdjRevealGuestMiPerfilNavSlot();
        mdjRevealGuestRoleEntryNav();
      }
    } catch (err) {
      console.error('[MDJ-SYSTEM] checkSessionForNav:', err);
      window.__mdjNavOwnUserId = '';
      window.__mdjLastNavTier = null;
      window.__mdjProToolsUnlocked = false;
      window.__mdjLastNavIsClient = false;
      window.__mdjLastBuyerSession = false;
      try {
        document.body.classList.remove('mdj-buyer-session');
      } catch (eBsOff2) { void eBsOff2; }
      window.showMyArtisticProfileMainNav = false;
      mdjHideMiPortalButton();
      if (authZone) authZone.style.display = 'none';
      mdjApplyHeaderAuthPillSession(false);
      mdjSyncClientLoyaltyIndicator(false);
      mdjApplyDjToolsNavForTier(null);
      mdjApplyArtistDashboardNavChrome(false);
      mdjApplyStaffMainNavLink(false);
      mdjApplyConfigMainNavLink(false);
      mdjApplyAgendaMainNavLink(false);
      mdjApplyFlowMainNavLink(false);
      mdjApplyNavTierStatusBadge(null);
      mdjApplyArtistHeaderRow2(false);
      mdjRevealGuestMiPerfilNavSlot();
      mdjRevealGuestRoleEntryNav();
    } finally {
      mdjSetHeaderAuthPillsPending(false);
      if (authZone) authZone.classList.remove('session-pending');
      if (typeof window.updateAuthButtons === 'function') window.updateAuthButtons();
      /* BOOT MASK cleanup — Punto A: auth zone resolved */
      mdjClearAuthBootMask();
    }
  };

  function whenSupabaseReady(cb, tries) {
    tries = tries || 50;
    if (typeof window.getSupabaseClient === 'function' && window.getSupabaseClient()) return cb();
    if (tries <= 0) return cb();
    setTimeout(function () { whenSupabaseReady(cb, tries - 1); }, 40);
  }

  function bindHeaderChrome() {
    var header = document.getElementById('mainHeader');
    if (header) {
      window.addEventListener('scroll', function () {
        if (window.scrollY > 50) header.classList.add('scrolled');
        else header.classList.remove('scrolled');
      }, { passive: true });
    }

    var mobileBtn = document.getElementById('mobileMenuBtn');
    var mobileMenu = document.getElementById('mobileMenu');
    if (mobileBtn && mobileMenu) {
      function setMobileOpen(open) {
        mobileBtn.classList.toggle('active', open);
        mobileMenu.classList.toggle('active', open);
        document.body.style.overflow = open ? 'hidden' : '';
        if (mobileBtn.hasAttribute('aria-expanded')) {
          mobileBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
      }
      mobileBtn.addEventListener('click', function () {
        setMobileOpen(!mobileMenu.classList.contains('active'));
      });
      mobileMenu.addEventListener('click', function (e) {
        if (e.target && e.target.closest && e.target.closest('a')) setMobileOpen(false);
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && mobileMenu.classList.contains('active')) setMobileOpen(false);
      });
    }

    /** #mainNav “More” — panel estilo Facebook (solo desktop ≥1001px donde .header-nav es visible) */
    (function bindNavMoreDropdown() {
      var btn = document.getElementById('mainNavMoreBtn');
      var menu = document.getElementById('mainNavMoreMenu');
      var wrap = btn && btn.closest('.nav-more-wrap');
      if (!btn || !menu || !wrap) return;

      function close() {
        btn.setAttribute('aria-expanded', 'false');
        menu.hidden = true;
        wrap.classList.remove('is-open');
      }

      function open() {
        btn.setAttribute('aria-expanded', 'true');
        menu.hidden = false;
        wrap.classList.add('is-open');
      }

      function toggle() {
        if (menu.hidden) open();
        else close();
      }

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        toggle();
      });

      menu.querySelectorAll('a[href]').forEach(function (a) {
        a.addEventListener('click', close);
      });

      document.addEventListener('click', function (e) {
        if (!wrap.contains(e.target)) close();
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') close();
      });
    })();
  }

  window.mdjInitSharedHeader = function () {
    /* BOOT MASK — apply before any nav mutations if prior session exists in localStorage */
    mdjApplyAuthBootMask();
    window.showMyArtisticProfileMainNav = false;
    mdjInstallMainNavStaticMode();
    mdjEnsureGuestMiPerfilMainNavLink();
    mdjHideGuestMiPerfilMainNavSlot();
    mdjStripPublicEventsFromMainNav();
    mdjNormalizePublicHomeMainNav();
    void mdjAutodetectArtistMiPerfilNav();
    mdjHeaderHideMonetizationCtasPending();
    mdjApplyShopHeaderCartVisibility();
    try {
      mdjMountGlobalEventCartIfNeeded();
    } catch (eCartEarly) {
      void eCartEarly;
    }
    mdjEnsureDesktopAuditCss();
    mdjSetHeaderAuthPillsPending(true);
    mdjEnsureAuthLangObserver();
    if (typeof window.updateAuthButtons === 'function') window.updateAuthButtons();
    bindHeaderChrome();
    mdjNavHighlight();
    window.addEventListener('hashchange', mdjNavHighlight);
    window.updateHeaderCartCount();
    whenSupabaseReady(function () {
      try {
        var sb = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
        if (sb && sb.auth && typeof sb.auth.onAuthStateChange === 'function') {
          sb.auth.onAuthStateChange(function (event) {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'SIGNED_OUT') {
              if (typeof window.checkSessionForNav === 'function') window.checkSessionForNav();
            }
          });
        }
        if (typeof window.checkSessionForNav === 'function') {
          return window.checkSessionForNav().then(function () {
            return mdjAutodetectArtistMiPerfilNav();
          }).then(function () {
            /* BOOT MASK cleanup — Punto B: nav fully resolved after autodetect */
            mdjClearAuthBootMask();
            /* Owner final guard: mdjAutodetectArtistMiPerfilNav runs with show=false and
               briefly re-hides MI PERFIL via mdjRemoveArtistDashboardNavLinks. This runs
               after the full chain to guarantee the slot is always visible for the owner. */
            if (window.__mdjNavOwnUserId && window.__mdjLastPlatformIdentity &&
                window.__mdjLastPlatformIdentity.dbRole === 'owner') {
              var _mpFinal = document.getElementById('mainNav-guest-mi-perfil-link');
              if (_mpFinal) {
                _mpFinal.classList.remove('mdj-mainnav-reserved-slot');
                _mpFinal.removeAttribute('aria-hidden');
                _mpFinal.removeAttribute('tabindex');
                _mpFinal.style.setProperty('display', 'inline-flex', 'important');
                _mpFinal.style.setProperty('min-width', 'max-content', 'important');
                _mpFinal.style.setProperty('max-width', 'none', 'important');
                _mpFinal.style.setProperty('width', 'auto', 'important');
                _mpFinal.style.setProperty('flex', '0 0 auto', 'important');
                _mpFinal.style.setProperty('pointer-events', 'auto', 'important');
                _mpFinal.style.removeProperty('visibility');
                var _uid = String(window.__mdjNavOwnUserId).trim();
                _mpFinal.href = './dj-profile.html?id=' + encodeURIComponent(_uid);
              }
            }
          }).catch(function (eChain) {
            void eChain;
          }).finally(function () {
            /* BOOT MASK safety net — chain failed but mask must not persist */
            mdjClearAuthBootMask();
          });
        }
        return mdjAutodetectArtistMiPerfilNav().then(function () {
          /* BOOT MASK cleanup — Punto B (no-checkSession path) */
          mdjClearAuthBootMask();
          /* Owner final guard — same as checkSession path */
          if (window.__mdjNavOwnUserId && window.__mdjLastPlatformIdentity &&
              window.__mdjLastPlatformIdentity.dbRole === 'owner') {
            var _mpFinal2 = document.getElementById('mainNav-guest-mi-perfil-link');
            if (_mpFinal2) {
              _mpFinal2.classList.remove('mdj-mainnav-reserved-slot');
              _mpFinal2.removeAttribute('aria-hidden');
              _mpFinal2.removeAttribute('tabindex');
              _mpFinal2.style.setProperty('display', 'inline-flex', 'important');
              _mpFinal2.style.setProperty('min-width', 'max-content', 'important');
              _mpFinal2.style.setProperty('max-width', 'none', 'important');
              _mpFinal2.style.setProperty('width', 'auto', 'important');
              _mpFinal2.style.setProperty('flex', '0 0 auto', 'important');
              _mpFinal2.style.setProperty('pointer-events', 'auto', 'important');
              _mpFinal2.style.removeProperty('visibility');
              _mpFinal2.href = './dj-profile.html?id=' + encodeURIComponent(String(window.__mdjNavOwnUserId).trim());
            }
          }
        }).catch(function (eAuto) {
          void eAuto;
        }).finally(function () {
          mdjClearAuthBootMask();
        });
      } catch (eReady) {
        void eReady;
        /* BOOT MASK safety net — whenSupabaseReady callback threw synchronously */
        mdjClearAuthBootMask();
      }
    });
    if (window.MdjHeaderSmartSearch && typeof window.MdjHeaderSmartSearch.init === 'function') {
      window.MdjHeaderSmartSearch.init();
    }
    if (window.i18n && typeof window.i18n.updateUI === 'function') {
      window.i18n.updateUI();
    }
    mdjNavHighlight();
    if (typeof window.updateAuthButtons === 'function') window.updateAuthButtons();

    document.addEventListener('languageChanged', function () {
      if (typeof window.updateAuthButtons === 'function') window.updateAuthButtons();
      if (typeof window.checkSessionForNav === 'function') {
        void window.checkSessionForNav();
      }
      mdjNavHighlight();
    });
  };

  document.addEventListener('DOMContentLoaded', function () {
    mdjLoadForceMuteVideosScript();
    mdjLoadAmbientMusicScript();
    if (!document.getElementById('mainHeader')) return;
    if (window.MDJ_SKIP_SHARED_HEADER_INIT) return;
    window.mdjInitSharedHeader();
    setTimeout(mdjInstallMainNavStaticMode, 0);
    setTimeout(mdjInstallMainNavStaticMode, 150);
    /* 600ms call removed — caused visible CLS on Owner home nav (TICKET-002). */
    /* Owner MI PERFIL poller: home page only — avoids nav reflows on interior pages.
       Checks every 400ms for up to 10s; catches mdjAutodetectArtistMiPerfilNav re-hides. */
    (function () {
      var _path = window.location.pathname;
      var _isHome = _path === '/' || _path.endsWith('/index.html') || _path.endsWith('/');
      if (!_isHome) return; /* only needed on home — other pages don't have the re-hide race */
      var _ticks = 0, _maxTicks = 25;
      var _poll = setInterval(function () {
        _ticks++;
        if (_ticks > _maxTicks) { clearInterval(_poll); return; }
        var idn = window.__mdjLastPlatformIdentity;
        var uid = window.__mdjNavOwnUserId;
        if (!idn || idn.dbRole !== 'owner' || !uid) return;
        var _mp = document.getElementById('mainNav-guest-mi-perfil-link');
        if (!_mp) return;
        var isHidden = _mp.classList.contains('mdj-mainnav-reserved-slot') ||
                       _mp.getAttribute('aria-hidden') === 'true';
        if (!isHidden) return;
        _mp.classList.remove('mdj-mainnav-reserved-slot');
        _mp.removeAttribute('aria-hidden');
        _mp.removeAttribute('tabindex');
        _mp.style.setProperty('display', 'inline-flex', 'important');
        _mp.style.setProperty('min-width', 'max-content', 'important');
        _mp.style.setProperty('max-width', 'none', 'important');
        _mp.style.setProperty('width', 'auto', 'important');
        _mp.style.setProperty('flex', '0 0 auto', 'important');
        _mp.style.setProperty('pointer-events', 'auto', 'important');
        _mp.style.removeProperty('visibility');
        if (!_mp.getAttribute('href') || _mp.getAttribute('href') === '#' ||
            _mp.getAttribute('href').indexOf('login') !== -1) {
          _mp.href = './dj-profile.html?id=' + encodeURIComponent(String(uid).trim());
        }
      }, 400);
    }());
  });

  window.addEventListener('focus', function () {
    if (typeof window.updateHeaderCartCount === 'function') window.updateHeaderCartCount();
  });
  window.addEventListener('storage', function (e) {
    if (e.key === 'mdjpro_checkout_cart' && typeof window.updateHeaderCartCount === 'function') {
      window.updateHeaderCartCount();
    }
  });

  /** `auth.js` delega ENTRAR/SALIR + zona VIP aquí para no pisar `data-auth-btn`. */
  window.__MDJ_HEADER_SESSION_OWNER = true;
  window.mdjNormalizeAvatarStorageUrl = mdjNormalizeAvatarStorageUrl;
  window.mdjResolveShowMyArtisticProfileMainNav = mdjResolveShowMyArtisticProfileMainNav;
  window.mdjApplyArtistSessionNav = mdjApplyArtistSessionNav;
  window.mdjNormalizePublicHomeMainNav = mdjNormalizePublicHomeMainNav;
  window.mdjRenderArtistNav = mdjRenderArtistNav;
  window.mdjBridgeArtistMiPerfilPublicNav = mdjBridgeArtistMiPerfilPublicNav;
  window.mdjAutodetectArtistMiPerfilNav = mdjAutodetectArtistMiPerfilNav;
  window.mdjBridgeHomeMiPerfilNav = mdjBridgeHomeMiPerfilNav;
  window.mdjAutodetectHomeArtistSession = mdjAutodetectHomeArtistSession;
  window.mdjBuildStaffEntryLoginHref = mdjBuildStaffEntryLoginHref;
  window.mdjBuildArtistStaffMainNavHref = mdjBuildArtistStaffMainNavHref;
  window.mdjApplyStaffNavHref = mdjApplyStaffNavHref;
  window.mdjBindStaffNavClickGuard = mdjBindStaffNavClickGuard;
  window.mdjRefreshAllStaffNavLinks = mdjRefreshAllStaffNavLinks;
  window.mdjRefreshOwnerStripStaffLinks = mdjRefreshOwnerStripStaffLinks;
  window.mdjIsStaffBuildingPage = mdjIsStaffBuildingPage;
  mdjInstallGlobalStaffNavCapture();
})();

/* ── OWNER 8-PILLAR NAVIGATION — PHYSICAL DOM REORDER + CASH FLOW LOCK ──
   Polling hasta 5 s: espera a que flowLink sea inyectado por el auth-chain
   antes de bloquear el texto. Sin polling, el 500ms timeout disparaba antes
   de que el elemento existiera y el MutationObserver nunca se instalaba.
   v20260524-polling-lock */
(function () {
  if (window.location.pathname.indexOf('account-settings.html') === -1 &&
      window.location.pathname.indexOf('dj-dashboard.html') === -1) return;

  var _flowObserver = null;
  var _flowLocked   = false;

  function _lockFlowText(node) {
    if (_flowObserver) { _flowObserver.disconnect(); _flowObserver = null; }
    if (!window.MutationObserver) return;
    _flowLocked = true;
    _flowObserver = new MutationObserver(function () {
      _flowObserver.disconnect();
      /* Bloquear texto */
      if (node.textContent !== 'CASH FLOW') {
        node.textContent = 'CASH FLOW';
        node.removeAttribute('data-i18n');
      }
      /* Bloquear href: cualquier href que NO sea el tab flow del dashboard es incorrecto */
      if (node.getAttribute('href').indexOf('dj-dashboard.html?tab=flow') === -1) {
        var _uid = window.__mdjNavOwnUserId || '';
        node.setAttribute('href', _uid
          ? './dj-dashboard.html?tab=flow&id=' + encodeURIComponent(_uid)
          : './dj-dashboard.html?tab=flow');
      }
      _flowObserver.observe(node, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['href'] });
    });
    _flowObserver.observe(node, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['href'] });
  }

  /* Devuelve true cuando flowLink ya existe y fue procesado */
  function reorderOwnerMenu() {
    if (document.body && document.body.classList.contains('mdj-from-profile') &&
        window.location.pathname.indexOf('account-settings.html') !== -1) {
      if (typeof window.mdjEnsureAccountSettingsOwnerStripNav === 'function') {
        window.mdjEnsureAccountSettingsOwnerStripNav();
      }
      return true;
    }
    var nav = document.getElementById('mainNav');
    if (!nav) return false;

    /* Colapsar MI PORTAL y DJ TOOLS (guardia inline !important) */
    var miPortalEl = document.getElementById('mainNav-mi-portal-link');
    if (miPortalEl) { miPortalEl.style.setProperty('display', 'none', 'important'); }
    var toolsEl = nav.querySelector('a[data-mdj-nav="tools"]');
    if (toolsEl)  { toolsEl.style.setProperty('display', 'none', 'important'); }

    /* CASH FLOW — hardcoded en HTML; solo actualizar href y bloquear texto */
    var flowLink = document.getElementById('mainNav-flow-link') ||
                   nav.querySelector('a[data-mdj-nav="flow"]');
    if (flowLink) {
      var _flowUid = window.__mdjNavOwnUserId || (function(){ try { return localStorage.getItem('sb-current-user-id'); } catch(e) { return null; } }()) || '';
      flowLink.href = _flowUid
        ? './dj-dashboard.html?tab=flow&id=' + encodeURIComponent(_flowUid)
        : './dj-dashboard.html?tab=flow';
      flowLink.textContent = 'CASH FLOW';
      flowLink.removeAttribute('data-i18n');
      flowLink.removeAttribute('aria-hidden');
      flowLink.removeAttribute('tabindex');
      if (!_flowLocked) { _lockFlowText(flowLink); }
    }

    /* MI PERFIL — hardcoded en HTML; actualizar href con UID cuando esté disponible */
    var profileLink = document.getElementById('mainNav-guest-mi-perfil-link') ||
                      nav.querySelector('a[data-mdj-nav="profile"]');
    if (profileLink) {
      var _pUid = window.__mdjNavOwnUserId || (function(){ try { return localStorage.getItem('sb-current-user-id'); } catch(e) { return null; } }()) || '';
      profileLink.href = _pUid ? './dj-profile.html?id=' + encodeURIComponent(_pUid) : './dj-profile.html';
      profileLink.removeAttribute('aria-hidden');
      profileLink.removeAttribute('tabindex');
    }

    /* AGENDA — inyectada por mdjEnsureAgendaMainNavNode; añadir &id=<uid> para evitar redirect a admin-dashboard */
    var agendaLink = document.getElementById('mainNav-agenda-link') ||
                     nav.querySelector('a[data-mdj-nav="agenda"]');
    if (agendaLink) {
      var _agUid = window.__mdjNavOwnUserId || (function(){ try { return localStorage.getItem('sb-current-user-id'); } catch(e) { return null; } }()) || '';
      agendaLink.href = _agUid
        ? './dj-dashboard.html?tab=dashboard&id=' + encodeURIComponent(_agUid)
        : './dj-dashboard.html?tab=dashboard';
    }

    /* dj-dashboard.html: reordenar MI PERFIL para que quede después de CASH FLOW.
       El HTML de dj-dashboard pone MI PERFIL antes de AGENDA; el orden correcto es:
       ... CASH FLOW · MI PERFIL · STAFF · SOUNDFORTIPS™ */
    if (window.location.pathname.indexOf('dj-dashboard.html') !== -1) {
      if (nav && profileLink && flowLink && flowLink.parentNode === nav) {
        /* Insertar MI PERFIL justo después de CASH FLOW */
        var _afterFlow = flowLink.nextSibling;
        nav.insertBefore(profileLink, _afterFlow);
      }
    }
    /* account-settings.html: sin reordenamiento — el HTML ya define el orden correcto:
       home · services · venues · shop · flow · [tools hidden] · config · profile · [jobs/contact hidden] · staff */

    /* Retorna true solo cuando el UID está disponible.
       Cuando lo encuentra, agenda un fix de seguridad 800ms después (posterior a todo el auth-chain). */
    var _resolvedUid = window.__mdjNavOwnUserId || (function(){ try { return localStorage.getItem('sb-current-user-id'); } catch(e) { return null; } }()) || '';
    if (_resolvedUid && !window.__mdjAccountSettingsNavLocked) {
      window.__mdjAccountSettingsNavLocked = true;
      setTimeout(function () {
        var _navF = document.getElementById('mainNav');
        var _fl = _navF && (document.getElementById('mainNav-flow-link') || _navF.querySelector('a[data-mdj-nav="flow"]'));
        if (_fl) {
          var _sfUid = window.__mdjNavOwnUserId || '';
          _fl.href = _sfUid
            ? './dj-dashboard.html?tab=flow&id=' + encodeURIComponent(_sfUid)
            : './dj-dashboard.html?tab=flow';
          _fl.textContent = 'CASH FLOW';
          _fl.removeAttribute('data-i18n');
          _fl.classList.remove('mdj-mainnav-reserved-slot');
          _fl.removeAttribute('aria-hidden');
          _fl.removeAttribute('tabindex');
          _fl.style.removeProperty('display');
          _fl.style.removeProperty('visibility');
          _fl.style.removeProperty('pointer-events');
          /* Reinstalar MutationObserver si el poll terminó antes de que el elemento existiera */
          if (!_flowLocked) { _lockFlowText(_fl); }
        }
        var _uid = window.__mdjNavOwnUserId || '';
        var _pl = document.getElementById('mainNav-guest-mi-perfil-link') || (_navF && _navF.querySelector('a[data-mdj-nav="profile"]'));
        if (_pl && _uid) {
          _pl.href = './dj-profile.html?id=' + encodeURIComponent(_uid);
          _pl.classList.remove('mdj-mainnav-reserved-slot');
          _pl.removeAttribute('aria-hidden');
          _pl.removeAttribute('tabindex');
          _pl.style.removeProperty('display');
          _pl.style.removeProperty('visibility');
          _pl.style.removeProperty('pointer-events');
        }
        /* dj-dashboard.html: reordenar MI PERFIL justo después de CASH FLOW en el safety re-patch */
        if (window.location.pathname.indexOf('dj-dashboard.html') !== -1 && _fl && _pl && _fl.parentNode) {
          _fl.parentNode.insertBefore(_pl, _fl.nextSibling);
        }
        /* AGENDA safety re-patch con uid definitivo */
        var _al = document.getElementById('mainNav-agenda-link') || (_navF && _navF.querySelector('a[data-mdj-nav="agenda"]'));
        if (_al && _uid) {
          _al.href = './dj-dashboard.html?tab=dashboard&id=' + encodeURIComponent(_uid);
        }
      }, 800);
    }
    return !!_resolvedUid;
  }

  /* Polling: cada 300 ms, máximo 17 intentos (~5 s). Para cuando flowLink aparece. */
  var _polls = 0;
  function poll() {
    _polls++;
    var done = reorderOwnerMenu();
    if (!done && _polls < 17) { setTimeout(poll, 300); }
  }
  poll();
})();

/* ── OWNER-TABS REORDER — dj-dashboard.html ──────────────────────────────────────────────────
   Mueve MI PERFIL (posición 4 en el HTML) a posición 9: justo después de CASH FLOW.
   Inyecta STAFF en posición 10. Bloquea texto CASH FLOW anti-i18n con MutationObserver.
   Safety re-patch a 1 s: parchea uid definitivo y re-ejecuta el orden tras i18n.updateUI().
   v20260525-dashboard-owner-tabs-reorder-v2 */
(function () {
  if (window.location.pathname.indexOf('dj-dashboard.html') === -1) return;

  /* Early hide TRABAJOS — sync en primer tick del script (anti-flash antes de poll). */
  var _dtEarlyC = document.querySelector('#owner-tabs .container');
  if (_dtEarlyC) {
    var _dtEarlyJobs = _dtEarlyC.querySelector('[data-i18n="nav-jobs"]');
    if (_dtEarlyJobs) {
      _dtEarlyJobs.style.setProperty('display', 'none', 'important');
      _dtEarlyJobs.setAttribute('aria-hidden', 'true');
      _dtEarlyJobs.setAttribute('tabindex', '-1');
    }
  }

  var _dtObs    = null;
  var _dtLocked = false;

  function _lockDashFlowText(node) {
    if (_dtObs) { _dtObs.disconnect(); _dtObs = null; }
    if (!window.MutationObserver) return;
    _dtLocked = true;
    _dtObs = new MutationObserver(function () {
      _dtObs.disconnect();
      if (node.textContent !== 'CASH FLOW') {
        node.textContent = 'CASH FLOW';
        node.removeAttribute('data-i18n');
      }
      _dtObs.observe(node, { childList: true, characterData: true, subtree: true });
    });
    _dtObs.observe(node, { childList: true, characterData: true, subtree: true });
  }

  /** Owner strip active underline — no depende de data-i18n="flow-dash" (stripped por anti-i18n). */
  function _syncDashOwnerStripActive(tabId) {
    var container = document.querySelector('#owner-tabs .container');
    if (!container) return;
    var tab = tabId;
    if (!tab) {
      try {
        tab = new URLSearchParams(window.location.search).get('tab') || 'dashboard';
      } catch (eTab) {
        tab = 'dashboard';
      }
    }
    if (tab !== 'flow' && tab !== 'dashboard') return;

    var flowEl = container.querySelector('a[href*="tab=flow"]') ||
                 container.querySelector('[data-i18n="flow-dash"]') ||
                 container.querySelector('button[data-tab="flow"]');
    var agendaEl = container.querySelector('button[data-tab="dashboard"]');

    container.querySelectorAll('button[data-tab]').forEach(function (el) {
      el.classList.remove('active');
    });
    if (flowEl) flowEl.classList.remove('active');

    if (tab === 'flow' && flowEl) {
      flowEl.classList.add('active');
    } else if (tab === 'dashboard' && agendaEl) {
      agendaEl.classList.add('active');
    }
  }
  window.__mdjSyncDashOwnerStripActive = _syncDashOwnerStripActive;

  function _patchSwitchDashTabForStripActive() {
    var orig = window.switchDashTab;
    if (typeof orig !== 'function' || orig.__mdjStripActivePatched) return;
    function patched(tabId) {
      var out = orig.apply(this, arguments);
      _syncDashOwnerStripActive(tabId);
      return out;
    }
    patched.__mdjStripActivePatched = true;
    window.switchDashTab = patched;
  }

  function _applyDashOwnerTabs() {
    var container = document.querySelector('#owner-tabs .container');
    if (!container) return false;

    var trabajosEl = container.querySelector('[data-i18n="nav-jobs"]');
    if (trabajosEl) {
      trabajosEl.style.setProperty('display', 'none', 'important');
      trabajosEl.setAttribute('aria-hidden', 'true');
      trabajosEl.setAttribute('tabindex', '-1');
    }

    /* flowEl puede aún tener data-i18n="flow-dash" — buscar por ambos estados */
    var flowEl    = container.querySelector('[data-i18n="flow-dash"]') ||
                    container.querySelector('a[href*="tab=flow"]');
    var miPerfilEl = container.querySelector('[data-i18n="menu-account"]');
    var sftEl      = container.querySelector('[data-i18n="nav-soundfortips"]');
    if (!flowEl || !miPerfilEl) return false;

    /* ── CASH FLOW: fijar texto + eliminar data-i18n + MO ── */
    flowEl.textContent = 'CASH FLOW';
    flowEl.removeAttribute('data-i18n');
    if (!_dtLocked) { _lockDashFlowText(flowEl); }

    /* ── MI PERFIL: patch href con UID ── */
    var uid = window.__mdjNavOwnUserId || '';
    if (uid) {
      miPerfilEl.href = './dj-profile.html?id=' + encodeURIComponent(uid) + '&mdj_nav=profile';
    }

    /* ── STAFF: solo edificio artista (account-settings / dj-dashboard) ── */
    var staffEl = container.querySelector('a[data-mdj-nav="staff"]');
    if (!staffEl) {
      staffEl = document.createElement('a');
      staffEl.className = 'dj-tab-btn';
      staffEl.setAttribute('data-mdj-nav', 'staff');
      staffEl.setAttribute('data-i18n', 'nav-staff');
      staffEl.textContent = 'STAFF';
    } else {
      staffEl.textContent = 'STAFF';
      staffEl.removeAttribute('aria-hidden');
      staffEl.removeAttribute('tabindex');
      staffEl.style.removeProperty('pointer-events');
      staffEl.style.removeProperty('visibility');
      staffEl.style.removeProperty('opacity');
    }
    if (typeof window.mdjApplyStaffNavHref === 'function') {
      window.mdjApplyStaffNavHref(staffEl);
    } else if (typeof window.mdjBuildArtistStaffMainNavHref === 'function') {
      staffEl.href = window.mdjBuildArtistStaffMainNavHref();
      if (typeof window.mdjBindStaffNavClickGuard === 'function') {
        window.mdjBindStaffNavClickGuard(staffEl);
      }
    }

    /* ── REORDER: CASH FLOW · MI PERFIL · STAFF · SOUNDFORTIPS™ ── */
    if (flowEl.parentNode === container && miPerfilEl !== flowEl.nextSibling) {
      container.insertBefore(miPerfilEl, flowEl.nextSibling);
    }
    if (sftEl && sftEl.parentNode === container) {
      container.insertBefore(staffEl, sftEl);
    } else {
      container.appendChild(staffEl);
    }

    _syncDashOwnerStripActive();
    return true; /* strip listo — stop polling */
  }

  var _dtPoll = 0;
  var _dtDone = false;
  function pollDashTabs() {
    _dtPoll++;
    _dtDone = _applyDashOwnerTabs();
    if (!_dtDone && _dtPoll < 17) { setTimeout(pollDashTabs, 300); }
    if (_dtDone) {
      _patchSwitchDashTabForStripActive();
      /* Safety re-patch a 1 s: uid definitivo + re-lock texto tras i18n.updateUI() */
      setTimeout(function () {
        var c = document.querySelector('#owner-tabs .container');
        if (!c) return;
        var trabajosRep = c.querySelector('[data-i18n="nav-jobs"]');
        if (trabajosRep) {
          trabajosRep.style.setProperty('display', 'none', 'important');
          trabajosRep.setAttribute('aria-hidden', 'true');
          trabajosRep.setAttribute('tabindex', '-1');
        }
        /* Re-fijar CASH FLOW si i18n lo revirtió */
        var fl = c.querySelector('a[href*="tab=flow"]') || c.querySelector('[data-i18n="flow-dash"]');
        if (fl) {
          fl.textContent = 'CASH FLOW';
          fl.removeAttribute('data-i18n');
          if (!_dtLocked) { _lockDashFlowText(fl); }
        }
        /* Re-patch uid */
        var uid = window.__mdjNavOwnUserId || '';
        var mp = c.querySelector('[data-i18n="menu-account"]') ||
                 c.querySelector('a[href*="dj-profile.html"]');
        if (mp && uid) {
          mp.href = './dj-profile.html?id=' + encodeURIComponent(uid) + '&mdj_nav=profile';
        }
        /* Re-verificar STAFF (ART-007B tras sesión / i18n) */
        var st = c.querySelector('a[data-mdj-nav="staff"]');
        var sf = c.querySelector('[data-i18n="nav-soundfortips"]');
        if (!st) {
          st = document.createElement('a');
          st.className = 'dj-tab-btn';
          st.setAttribute('data-mdj-nav', 'staff');
          st.setAttribute('data-i18n', 'nav-staff');
          st.textContent = 'STAFF';
          if (sf && sf.parentNode === c) { c.insertBefore(st, sf); }
          else { c.appendChild(st); }
        }
        if (typeof window.mdjApplyStaffNavHref === 'function') {
          window.mdjApplyStaffNavHref(st);
        } else if (typeof window.mdjRefreshOwnerStripStaffLinks === 'function') {
          window.mdjRefreshOwnerStripStaffLinks();
        }
        _syncDashOwnerStripActive();
      }, 1000);
    }
  }
  _patchSwitchDashTabForStripActive();
  pollDashTabs();
})();

/* ── OWNER STRIP — 10 PILARES — artist pages with #owner-tabs
   dj-profile.html : #owner-tabs en HTML; CASH FLOW / MI PERFIL / SFT pueden ser <button>.
   shop.html       : #owner-tabs inyectado por mdj-profile-nav-context.js.
   Orden: INICIO · ACADEMIA · SHOP · AGENDA · CONFIG · DJ TOOLS ·
          CASH FLOW · MI PERFIL · STAFF · SOUNDFORTIPS™
   v20260605-owner-strip-10-pillars */
(function () {
  var _page = (window.location.pathname.split('/').pop() || '').toLowerCase();
  var _OWNER_STRIP_PAGES = {
    'dj-profile.html': 1,
    'shop.html': 1,
    'jobs.html': 1,
    'dj-tools.html': 1,
    'academia.html': 1,
    'courses.html': 1,
    'dj-knowledge.html': 1,
    'weather-lab.html': 1,
    'dj-dashboard.html': 1,
    'admin-dashboard.html': 1,
    'account-settings.html': 1
  };
  if (!_OWNER_STRIP_PAGES[_page]) return;

  /* ── VISUAL BLOCKER: previene pantallaso del perfil artista mientras el strip Owner carga.
     Solo actúa en dj-profile.html. Restaura visibilidad cuando el strip está listo o en 2.5s. */
  var _visualBlocked = false;
  if (window.location.pathname.indexOf('dj-profile.html') !== -1) {
    try {
      var _cachedRole = (window.__mdjpro && window.__mdjpro.role) || '';
      var _isAdminRole = /owner|manager/.test(_cachedRole);
      if (_isAdminRole || _cachedRole === '') {
        document.documentElement.style.display = 'none';
        _visualBlocked = true;
        setTimeout(function () {
          document.documentElement.style.display = '';
          _visualBlocked = false;
        }, 2500);
      }
    } catch (_e) { /* silent — nunca bloquear la página por un error */ }
  }

  var _obs    = null;
  var _locked = false;

  /** Bloquea textContent del nodo CASH FLOW contra la i18n engine. */
  function _lockCashFlowText(node) {
    if (_obs) { _obs.disconnect(); _obs = null; }
    if (!window.MutationObserver) return;
    _locked = true;
    _obs = new MutationObserver(function () {
      _obs.disconnect();
      if (node.textContent !== 'CASH FLOW') {
        node.textContent = 'CASH FLOW';
        node.removeAttribute('data-i18n');
      }
      _obs.observe(node, { childList: true, characterData: true, subtree: true });
    });
    _obs.observe(node, { childList: true, characterData: true, subtree: true });
  }

  function reorderOwnerStrip() {
    var ownerTabs = document.getElementById('owner-tabs');
    if (!ownerTabs) return false;
    var c = ownerTabs.querySelector('.container');
    if (!c) return false;

    /* Nodos críticos — data-i18n funciona en ambas páginas antes y después de i18n.updateUI() */
    var flowEl = c.querySelector('[data-i18n="flow-dash"]') ||
                 c.querySelector('a[href*="tab=flow"]') ||
                 c.querySelector('button[data-tab="flow"]') ||
                 document.getElementById('dj-tab-flow-btn');
    var sftEl  = c.querySelector('[data-i18n="nav-soundfortips"]') ||
                 document.getElementById('dj-tab-sft-btn');
    if (!flowEl || !sftEl) return false; /* strip no listo aún; poll continúa */

    /* ── CASH FLOW: texto fijo + navegación con UID ── */
    flowEl.textContent = 'CASH FLOW';
    flowEl.removeAttribute('data-i18n');

    if (flowEl.tagName === 'A') {
      /* shop.html: anchor inyectado — href actualizado con uid */
      var _uid0 = window.__mdjNavOwnUserId || (function(){ try { return localStorage.getItem('sb-current-user-id'); } catch(e) { return null; } }()) || '';
      flowEl.href = _uid0
        ? './dj-dashboard.html?tab=flow&id=' + encodeURIComponent(_uid0)
        : './dj-dashboard.html?tab=flow';
    } else {
      /* dj-profile.html: button — onclick intercepta y navega fuera del perfil */
      flowEl.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        var _uid = window.__mdjNavOwnUserId || (function(){ try { return localStorage.getItem('sb-current-user-id'); } catch(e) { return null; } }()) || '';
        window.location.href = _uid
          ? './dj-dashboard.html?tab=flow&id=' + encodeURIComponent(_uid)
          : './dj-dashboard.html?tab=flow';
      };
    }
    if (!_locked) { _lockCashFlowText(flowEl); }

    /* ── STAFF: edificio artista → ART-007B; edificio Staff → nav interna sin tocar ── */
    var staffEl = c.querySelector('a[data-mdj-nav="staff"]');
    var _staffBuildingPage = _page === 'admin-dashboard.html' || _page === 'account-profile.html';
    if (!_staffBuildingPage) {
      if (!staffEl) {
        staffEl = document.createElement('a');
        staffEl.className = 'dj-tab-btn';
        staffEl.setAttribute('data-mdj-nav', 'staff');
        staffEl.setAttribute('data-i18n', 'nav-staff');
        staffEl.textContent = 'STAFF';
      } else {
        staffEl.textContent = 'STAFF';
        staffEl.removeAttribute('aria-hidden');
        staffEl.removeAttribute('tabindex');
        staffEl.style.removeProperty('pointer-events');
        staffEl.style.removeProperty('visibility');
        staffEl.style.removeProperty('opacity');
      }
      if (typeof window.mdjApplyStaffNavHref === 'function') {
        window.mdjApplyStaffNavHref(staffEl);
      } else if (typeof window.mdjBuildArtistStaffMainNavHref === 'function') {
        staffEl.href = window.mdjBuildArtistStaffMainNavHref();
        if (typeof window.mdjBindStaffNavClickGuard === 'function') {
          window.mdjBindStaffNavClickGuard(staffEl);
        }
      }
    }

    /* ── Reorden por appendChild secuencial (data-i18n como ancla estable) ──
       Orden exacto: INICIO · ACADEMIA · SHOP · AGENDA · CONFIG · DJ TOOLS ·
                     CASH FLOW · MI PERFIL · STAFF · SOUNDFORTIPS™ */
    var initioEl   = c.querySelector('[data-i18n="nav-home"]')        || c.querySelector('a[href^="./index.html"]');
    var trabajosEl = c.querySelector('[data-i18n="nav-jobs"]');
    var shopEl     = c.querySelector('[data-i18n="nav-shop"]');
    var agendaEl   = c.querySelector('[data-i18n="dash-your-profile"]') ||
                     c.querySelector('a[href*="dj-dashboard.html"][href*="mdj_nav"]') ||
                     c.querySelector('a[href*="dj-dashboard.html"]:not([data-mdj-nav="flow"])');
    var configEl   = c.querySelector('[data-i18n="nav-settings"]');
    var academiaEl = c.querySelector('[data-i18n="nav-academia"]');
    var toolsEl    = c.querySelector('[data-i18n="nav-tools"]');
    var perfilEl   = c.querySelector('[data-i18n="menu-account"]')     || c.querySelector('button[data-tab="public"]');

    /* ── SHOP: edificio Staff → shop interno (C-2); resto → Shopify externo ── */
    if (shopEl) {
      if (_staffBuildingPage) {
        if (shopEl.tagName === 'A') {
          shopEl.href = './shop.html';
          shopEl.removeAttribute('target');
          shopEl.removeAttribute('rel');
        }
      } else {
        var _shopUrl = 'https://miami-dj-beat-store.myshopify.com/?shop_sign_in=true';
        if (shopEl.tagName === 'A') {
          shopEl.href = _shopUrl;
          shopEl.setAttribute('target', '_blank');
          shopEl.setAttribute('rel', 'noopener noreferrer');
        } else {
          shopEl.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            window.open(_shopUrl, '_blank', 'noopener,noreferrer');
          }, true);
        }
      }
    }

    /* ── MI PERFIL (owner-tabs): edificio Staff → account-profile (C-1) ── */
    if (perfilEl && perfilEl.tagName === 'A' && _staffBuildingPage) {
      perfilEl.href = './account-profile.html';
    }

    /* ── AGENDA: forzar href a dj-dashboard.html?tab=dashboard&id=<uid>
       Se reemplaza el href completo (incluyendo ?mdj_nav=profile si venía así)
       para garantizar que la página destino no sea redirigida por falta de parámetros. ── */
    if (agendaEl && agendaEl.tagName === 'A') {
      var _agUid = window.__mdjNavOwnUserId || (function(){ try { return localStorage.getItem('sb-current-user-id'); } catch(e) { return null; } }()) || '';
      agendaEl.href = _agUid
        ? './dj-dashboard.html?tab=dashboard&id=' + encodeURIComponent(_agUid)
        : './dj-dashboard.html?tab=dashboard';
      agendaEl.removeAttribute('data-i18n'); /* previene que i18n sobreescriba el href */
    }

    if (trabajosEl) {
      trabajosEl.style.setProperty('display', 'none', 'important');
      trabajosEl.setAttribute('aria-hidden', 'true');
      trabajosEl.setAttribute('tabindex', '-1');
    }
    [initioEl, academiaEl, shopEl, agendaEl, configEl, toolsEl,
     flowEl, perfilEl, staffEl, sftEl].forEach(function (el) {
      if (el) c.appendChild(el);
    });

    if (_page === 'dj-dashboard.html' && typeof window.__mdjSyncDashOwnerStripActive === 'function') {
      window.__mdjSyncDashOwnerStripActive();
    }

    if (_page === 'account-settings.html' && typeof window.mdjEnsureAccountSettingsOwnerStripNav === 'function') {
      window.mdjEnsureAccountSettingsOwnerStripNav();
    }

    return true; /* nodos presentes; poll detiene */
  }

  var _polls = 0;
  function pollStrip() {
    _polls++;
    var done = reorderOwnerStrip();
    if (done && _visualBlocked) {
      document.documentElement.style.display = '';
      _visualBlocked = false;
    }
    if (!done && _polls < 20) { setTimeout(pollStrip, 300); }
    /* Re-patch de seguridad: cuando el uid aún no está en el primer run,
       reintentamos el patch de AGENDA con uid una vez que el auth-chain resuelve. */
    if (done) {
      setTimeout(function () {
        var _uid = window.__mdjNavOwnUserId || (function(){ try { return localStorage.getItem('sb-current-user-id'); } catch(e) { return null; } }()) || '';
        if (!_uid) return;
        var owT = document.getElementById('owner-tabs');
        if (!owT) return;
        var cT = owT.querySelector('.container');
        if (!cT) return;
        var agEl = cT.querySelector('a[href*="dj-dashboard.html"]') ||
                   cT.querySelector('a[data-i18n="dash-your-profile"]');
        if (agEl && agEl.tagName === 'A') {
          agEl.href = './dj-dashboard.html?tab=dashboard&id=' + encodeURIComponent(_uid);
        }
        if (typeof window.mdjRefreshAllStaffNavLinks === 'function') {
          window.mdjRefreshAllStaffNavLinks();
        } else if (typeof window.mdjRefreshOwnerStripStaffLinks === 'function') {
          window.mdjRefreshOwnerStripStaffLinks();
        }
      }, 900);
    }
  }
  pollStrip();
})();

/* ── AGENDA GUARD — dj-dashboard.html: bloquea cualquier redirect del owner a admin-dashboard.
   El redirect ocurre antes de que checkSessionForNav pueda prevenirlo (race condition).
   Este interceptor sobreescribe location.assign y el setter de location.href ANTES de que
   cualquier script async pueda disparar la navegación incorrecta.
   v20260525-agenda-guard-dj-dashboard */
(function () {
  if (window.location.pathname.indexOf('dj-dashboard.html') === -1) return;

  /* Solo actuar si el URL fue navegado desde el strip del owner (tiene ?tab=dashboard o ?mdj_nav=profile) */
  var _qs = window.location.search || '';
  var _isOwnerNav = _qs.indexOf('tab=dashboard') !== -1 || _qs.indexOf('mdj_nav=profile') !== -1;
  if (!_isOwnerNav) return;

  function _isAdminRedirect(url) {
    if (!url || typeof url !== 'string') return false;
    return url.indexOf('admin-dashboard') !== -1;
  }

  /* Interceptar location.assign */
  try {
    var _origAssign = window.location.assign.bind(window.location);
    window.location.assign = function (url) {
      if (_isAdminRedirect(url)) {
        console.warn('[MDJ-AGENDA-GUARD] Blocked redirect to:', url);
        return;
      }
      _origAssign(url);
    };
  } catch (e) { /* ignore if not overridable */ }

  /* Interceptar location.href setter via replace */
  try {
    var _origReplace = window.location.replace.bind(window.location);
    window.location.replace = function (url) {
      if (_isAdminRedirect(url)) {
        console.warn('[MDJ-AGENDA-GUARD] Blocked replace to:', url);
        return;
      }
      _origReplace(url);
    };
  } catch (e2) { /* ignore */ }

  /* Patch adicional via Object.defineProperty en window.location.href */
  try {
    var _locProto = Object.getPrototypeOf(window.location);
    var _hrefDescr = Object.getOwnPropertyDescriptor(_locProto, 'href');
    if (_hrefDescr && _hrefDescr.set) {
      Object.defineProperty(_locProto, 'href', {
        get: _hrefDescr.get,
        set: function (url) {
          if (_isAdminRedirect(String(url || ''))) {
            console.warn('[MDJ-AGENDA-GUARD] Blocked href to:', url);
            return;
          }
          _hrefDescr.set.call(this, url);
        },
        configurable: true
      });
    }
  } catch (e3) { /* ignore if not patchable */ }
})();

/* ── SHOP → Shopify externo en #mainNav (todas las páginas)
   Parcha a[data-mdj-nav="shop"] en el nav principal para evitar la cortina interna.
   La IIFE de owner strip cubre el mismo nodo en #owner-tabs independientemente.
   v20260524-shop-mainnav-external */
(function () {
  var _SHOPIFY = 'https://miami-dj-beat-store.myshopify.com/?shop_sign_in=true';

  function _patchMainNavShop() {
    var nav = document.getElementById('mainNav');
    if (!nav) return;
    nav.querySelectorAll('a[data-mdj-nav="shop"]').forEach(function (a) {
      a.href = _SHOPIFY;
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _patchMainNavShop);
  } else {
    _patchMainNavShop();
  }
})();
