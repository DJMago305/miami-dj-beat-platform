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
  console.info('[Header] build 202605131450-client-cols-fix');

  try {
    var _mdjH = document.getElementById('mainHeader');
    if (_mdjH) _mdjH.classList.add('mdj-header-unified');
  } catch (eMdjH) {
    /* ignore */
  }

  function mdjLoadAmbientMusicScript() {
    if (typeof window !== 'undefined' && window.MDJ_SKIP_AMBIENT_MUSIC) return;
    if (document.getElementById('mdj-ambient-music-script')) return;
    try {
      if (document.documentElement && document.documentElement.getAttribute('data-mdj-no-ambient') === '1') return;
    } catch (eAmb) {
      void eAmb;
    }
    var s = document.createElement('script');
    s.id = 'mdj-ambient-music-script';
    s.src = './js/mdj-ambient-music.js?v=20260513-cash-flow-no-ambient';
    s.async = true;
    (document.head || document.documentElement).appendChild(s);
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
   * Matriz MDJ: PRO desbloqueado solo con **artist_pro** (`__mdjProToolsUnlocked` para `dj-tools.html`).
   * La pestaña DJ Tools **siempre** en #mainNav (misma fila que Home, Jobs, etc.); cliente/LITE ven muros en la página.
   * `window.__mdjLastNavTier` / `__mdjLastNavIsClient` (retro) para `dj-tools.html`.
   */
  function mdjApplyDjToolsNavForTier(navTier) {
    window.__mdjLastNavTier = navTier == null ? null : String(navTier);
    var pro = navTier === 'artist_pro';
    window.__mdjProToolsUnlocked = !!pro;
    window.__mdjLastNavIsClient = navTier === 'client_only';
    var hideLink = false;
    var header = document.getElementById('mainHeader');
    if (!header) return;
    header.querySelectorAll('a[href*="dj-tools"]').forEach(function (a) {
      var inMainNav = a.closest && a.closest('#mainNav');
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
  }

  function mdjHideArtistDashboardMainNavSlot() {
    var el = document.getElementById('mainNav-artist-dashboard-link');
    if (!el) return;
    el.classList.add('mdj-mainnav-reserved-slot');
    el.style.removeProperty('display');
  }

  /** Móvil: quitar nodo duplicado. Escritorio: nunca quitar #mainNav-artist-dashboard-link (hueco fijo). */
  function mdjRemoveArtistDashboardNavLinks() {
    mdjHideArtistDashboardMainNavSlot();
    var mb = document.getElementById('header-artist-dashboard-mobile');
    if (mb) mb.remove();
  }

  /** STAFF en #mainNav: el HTML usa `mainNav-staff-link` (admin) o `mainNav-staff-or-profile` (sitio unificado). */
  function mdjGetMainNavStaffAnchor() {
    return document.getElementById('mainNav-staff-link') || document.getElementById('mainNav-staff-or-profile');
  }

  /** STAFF (admin): solo staff de dj_profiles; hueco reservado con .mdj-mainnav-reserved-slot + visibility en CSS móvil. */
  function mdjApplyStaffMainNavLink(isStaff) {
    var a = mdjGetMainNavStaffAnchor();
    if (!a) return;
    if (isStaff) {
      /* Plantilla unificada: placeholder `#`; sin esto el enlace STAFF no abre el back-office. */
      try {
        var cur = String(a.getAttribute('href') || '').trim();
        if (!cur || cur === '#') a.setAttribute('href', './admin-dashboard.html');
      } catch (eH) { /* ignore */ }
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
    }
  }

  /**
   * Crea #mainNav-config-link si el HTML (p. ej. plantilla antigua) no lo trae — misma colación que el sitio: tras DJ Tools, antes de Jobs.
   * Sin esto, Agenda/Flujo no tienen ancla; `mdjApplyConfigMainNavLink` quedaría en no-op.
   */
  function mdjEnsureConfigMainNavNode() {
    var existing = document.getElementById('mainNav-config-link');
    if (existing) return existing;
    var nav = document.getElementById('mainNav');
    if (!nav) return null;
    var a = document.createElement('a');
    a.id = 'mainNav-config-link';
    a.setAttribute('data-mdj-nav', 'config');
    a.setAttribute('data-i18n', 'nav-config');
    a.className = 'mdj-config-mainnav mdj-mainnav-reserved-slot';
    a.href = './dj-dashboard.html?tab=settings';
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
    var h = href && String(href).trim() ? String(href).trim() : './dj-dashboard.html?tab=settings';
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
        ? String(profileHref).trim()
        : './dj-profile.html';
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
    if (!profileHref || !String(profileHref).trim()) {
      mdjRemoveArtistDashboardNavLinks();
      return;
    }
    if (nav) {
      var el = document.getElementById('mainNav-artist-dashboard-link');
      if (!el) {
        el = document.createElement('a');
        el.id = 'mainNav-artist-dashboard-link';
        el.setAttribute('data-mdj-nav', 'my-profile');
        el.className = 'mdj-artist-dash-mainnav';
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

  /** Badge editorial: comprador (solo cliente) | Artistic (artista LITE) | City owner (PRO) | Staff | Owners. */
  function mdjApplyNavTierStatusBadge(navTier, ctx) {
    ctx = ctx || {};
    var djRole = String(ctx.djRole || '').toLowerCase();
    var actions = document.querySelector('#mainHeader .header-actions');
    if (!actions) return;
    var id = 'header-tier-status-badge';
    var el = document.getElementById(id);
    if (!navTier || navTier === 'guest') {
      if (el) el.remove();
      return;
    }
    /* client_only: pastilla «Cliente» / VIP ya en mdjSyncClientLoyaltyIndicator — no duplicar «El Comprador». */
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

  /** Pastilla portal: Cliente o Cliente VIP (eventos / puntos alineados con lealtad en client-portal). */
  function mdjSyncClientLoyaltyIndicator(isClientSession, clientRow) {
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
      if (lang && lang.parentNode === actions) {
        if (lang.nextSibling) actions.insertBefore(el, lang.nextSibling);
        else actions.appendChild(el);
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
      link = document.createElement('a');
      link.id = 'mainNav-mi-portal-link';
      nav.appendChild(link);
    }
    link.className = 'mdj-mi-portal-mainnav mdj-mi-portal-gold';
    link.href = href || './client-portal.html';
    link.style.display = '';
    link.style.pointerEvents = '';
    link.style.visibility = '';
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
      link.setAttribute('data-mdj-nav', 'mi-portal');
      link.setAttribute('data-i18n', 'header-mi-portal');
      mdjApplyMiPortalLinkLabel(link);
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
      btn.setAttribute('data-i18n', 'header-mi-portal');
      btn.setAttribute('aria-label', 'My portal');
      mdjApplyMiPortalLinkLabel(btn);
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
    if (!profileUrl) profileUrl = isClient ? './client-portal.html' : './dj-dashboard.html?tab=settings';
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
        '<a class="mdj-account-vip-trigger mdj-account-vip-direct mdj-account-vip-artist-dash" id="accountBtn" href="' +
        mdjEscapeAttr(profileUrl) +
        '" title="' +
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
      '<a class="mdj-account-vip-trigger mdj-account-vip-direct mdj-account-vip-client-portal" id="accountBtn" href="' +
      mdjEscapeAttr(profileUrl) +
      '" title="' +
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
   * | config       | dj-dashboard?tab=settings, account-settings (misma ruta que ⚙ CONFIG) |
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

    document.querySelectorAll('#mainNav a[data-mdj-nav], .mobile-nav a[data-mdj-nav]').forEach(function (el) {
      el.classList.toggle('active', key && el.getAttribute('data-mdj-nav') === key);
    });
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

  function mdjApplyGuestHeaderAvatar() {
    var z = document.getElementById('header-auth-zone');
    if (!z) return;
    mdjEnsureDesktopAuditCss();
    var guestHtml =
      '<a class="account-btn mdj-guest-access-trigger" id="accountBtn" href="./login.html" title="Log in" aria-label="Log in">' +
      '<span class="mdj-guest-access-ring" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false">' +
      '<path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" stroke="currentColor" stroke-width="1.75"/>' +
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
    try {
      var sb = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
      if (!sb) {
        window.__mdjNavOwnUserId = '';
        window.__mdjLastNavTier = null;
        window.__mdjProToolsUnlocked = false;
        window.__mdjLastNavIsClient = false;
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
        var gp0 = document.getElementById('header-get-pro-btn');
        var sfd0 = document.getElementById('header-subscribe-free-btn');
        var sfm0 = document.getElementById('header-subscribe-free-mobile');
        if (gp0) gp0.style.display = 'none';
        if (sfd0) sfd0.style.display = 'none';
        if (sfm0) sfm0.style.display = 'none';
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
        if (subFreeDesk) subFreeDesk.style.display = 'none';
        if (subFreeMob) subFreeMob.style.display = 'none';

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
              (!!p && djRowRole !== 'client');
          var appRoleLower = appRole ? String(appRole).toLowerCase() : '';
          var metadataSaysClient = metaUtLower === 'client' || appRoleLower === 'client';
          /* jwtArtist: no forzar «cliente» solo por tener client_profiles (muchos artistas tienen ambas filas). */
          var isClient = sessionIsExplicitClient
            ? true
            : (p && djRowRole === 'client') ||
              (!p && hasClientRow && !jwtArtist) ||
              (!p && metadataSaysClient && !jwtArtist);

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
          var djproBadge = document.getElementById('header-djpro-badge');
          if (getProBtn) {
            if (isClient || isNavStaffSolo) {
              getProBtn.style.display = 'none';
            } else {
              getProBtn.style.display = isProUser ? 'none' : 'inline-flex';
            }
          }
          if (djproBadge) djproBadge.style.display = isProUser && !isClient && !isNavStaffSolo ? 'inline-flex' : 'none';
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
            settingsUrl = './client-portal.html';
            settingsLabel = mdjGetVipPortalMenuLabel();
          } else if (isNavStaffSolo) {
            settingsUrl = './account-settings.html';
            settingsLabel = mdjGetStaffAccountSettingsMenuLabel();
          } else {
            /* ?tab=settings: el tab por defecto «dashboard» en la UI es «Agenda» (clima/eventos); CONFIG = panel de control. */
            settingsUrl = './dj-dashboard.html?tab=settings';
            settingsLabel = mdjGetDjDashboardMenuLabel();
          }

          /** Matriz: cliente solo | artista LITE | artista PRO (incl. staff con dj_profiles: misma pastilla Talento/Dueño). */
          var navTier;
          if (hasDjProfile) {
            navTier = isProUser ? 'artist_pro' : 'artist_lite';
          } else if (isClient) {
            navTier = 'client_only';
          } else if (jwtArtist || isArtistSession) {
            navTier = 'artist_lite';
          } else {
            navTier = 'client_only';
          }

          var miPortalHref = isNavStaffSolo ? './account-settings.html' : './client-portal.html';
          var miPortalNavOpts = isNavStaffSolo ? { variant: 'staff-settings' } : null;

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
              if (acbFix) acbFix.setAttribute('href', settingsUrl);
            }
          } catch (eHref) { /* ignore */ }

          mdjApplyDjToolsNavForTier(navTier);
          mdjApplyNavTierStatusBadge(navTier, { djRole: djRowRole || '' });

          mdjMaybeRunVipWelcomeProtocol(session);

          if (document.getElementById('mainNav')) {
            mdjEnsureMiPortalInMainNav(miPortalHref, miPortalNavOpts);
            var hdrDup = document.getElementById('header-mi-portal-btn');
            if (hdrDup) hdrDup.style.display = 'none';
          } else {
            mdjEnsureMiPortalButton(miPortalHref);
          }
          mdjEnsureMiPortalMobile(miPortalHref, miPortalNavOpts);
          var showMyArtisticProfileMainNav =
            !isClient &&
            !isNavStaffSolo &&
            (navTier === 'artist_lite' || navTier === 'artist_pro');
          mdjApplyArtistDashboardNavChrome(showMyArtisticProfileMainNav, publicProfileUrl);
          mdjApplyStaffMainNavLink(!!isDjStaff);
          var showArtistDashMainNav = !isClient && (navTier === 'artist_lite' || navTier === 'artist_pro');
          mdjApplyAgendaMainNavLink(!!showArtistDashMainNav, './dj-dashboard.html?tab=dashboard');
          mdjApplyConfigMainNavLink(true, settingsUrl);
          mdjApplyFlowMainNavLink(!!showArtistDashMainNav, './dj-dashboard.html?tab=flow');
          mdjNavHighlight();
          try {
            if (window.i18n && typeof window.i18n.updateUI === 'function') window.i18n.updateUI();
          } catch (eUi) { /* ignore */ }
          /* i18n solo toca [data-i18n]; por si el HTML inicial trae header-mi-portal en la 8.ª celda, reforzar staff. */
          if (isDjStaff && document.getElementById('mainNav')) {
            mdjEnsureMiPortalInMainNav(miPortalHref, miPortalNavOpts);
            mdjEnsureMiPortalMobile(miPortalHref, miPortalNavOpts);
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
          mdjApplyArtistDashboardNavChrome(false);
          mdjApplyStaffMainNavLink(false);
          mdjApplyConfigMainNavLink(false);
          mdjApplyAgendaMainNavLink(false);
          mdjApplyFlowMainNavLink(false);
          mdjApplyNavTierStatusBadge(null);
          mdjSyncClientLoyaltyIndicator(false);
        }
      } else {
        window.__mdjNavOwnUserId = '';
        window.__mdjLastNavTier = null;
        window.__mdjProToolsUnlocked = false;
        window.__mdjLastNavIsClient = false;
        mdjHideMiPortalButton();
        document.body.classList.remove('mdj-logged-in-header');
        mdjApplyGuestHeaderAvatar();
        mdjApplyHeaderAuthPillSession(false);
        var djproBadge = document.getElementById('header-djpro-badge');
        var getProBtn = document.getElementById('header-get-pro-btn');
        var subFreeDesk2 = document.getElementById('header-subscribe-free-btn');
        var subFreeMob2 = document.getElementById('header-subscribe-free-mobile');
        if (djproBadge) djproBadge.style.display = 'none';
        /* Sin sesión: no mostrar CTA de monetización ni “gratis” hasta login (Fase 1 auditoría). */
        if (getProBtn) getProBtn.style.display = 'none';
        if (subFreeDesk2) subFreeDesk2.style.display = 'none';
        if (subFreeMob2) subFreeMob2.style.display = 'none';
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
      }
    } catch (err) {
      console.error('[MDJ-SYSTEM] checkSessionForNav:', err);
      window.__mdjNavOwnUserId = '';
      window.__mdjLastNavTier = null;
      window.__mdjProToolsUnlocked = false;
      window.__mdjLastNavIsClient = false;
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
    } finally {
      mdjSetHeaderAuthPillsPending(false);
      if (authZone) authZone.classList.remove('session-pending');
      if (typeof window.updateAuthButtons === 'function') window.updateAuthButtons();
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
    mdjEnsureDesktopAuditCss();
    mdjSetHeaderAuthPillsPending(true);
    mdjEnsureAuthLangObserver();
    if (typeof window.updateAuthButtons === 'function') window.updateAuthButtons();
    bindHeaderChrome();
    mdjNavHighlight();
    window.addEventListener('hashchange', mdjNavHighlight);
    window.updateHeaderCartCount();
    whenSupabaseReady(function () {
      var sb = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
      if (sb && sb.auth && typeof sb.auth.onAuthStateChange === 'function') {
        sb.auth.onAuthStateChange(function (event) {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'SIGNED_OUT') {
            if (typeof window.checkSessionForNav === 'function') window.checkSessionForNav();
          }
        });
      }
      if (typeof window.checkSessionForNav === 'function') {
        return window.checkSessionForNav();
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
})();
