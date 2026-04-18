/**
 * Miami DJ Beat — shared top header behavior (session, cart, search, mobile, nav highlight).
 * Load after: supabase CDN, supabase-config.js, header-smart-search.js (optional), translations/i18n (optional).
 *
 * OMNIPRESENCE: cuando existe `#mainHeader`, este script es el **único** dueño de ENTRAR/SALIR (y zona VIP)
 * en `#header-login-btn` / `#header-login-btn-mobile`. `checkSessionForNav()` usa `supabase.auth.getSession()`
 * al cargar y en `onAuthStateChange`. `window.doLogout` limpia sesión y envía al Home.
 */
(function () {
  'use strict';

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
   * DJ Tools en `#mainHeader`: oculto para cuentas **cliente** (no artistas).
   * `window.__mdjLastNavIsClient` lo reutiliza `dj-tools.html` para bloquear acceso directo por URL.
   */
  function mdjApplyDjToolsNavForClientSession(isClient) {
    window.__mdjLastNavIsClient = !!isClient;
    var header = document.getElementById('mainHeader');
    if (!header) return;
    header.querySelectorAll('a[href*="dj-tools"]').forEach(function (a) {
      if (!isClient) {
        a.style.removeProperty('display');
        a.removeAttribute('aria-hidden');
        a.removeAttribute('data-mdj-tools-suppressed');
        return;
      }
      a.style.display = 'none';
      a.setAttribute('aria-hidden', 'true');
      a.setAttribute('data-mdj-tools-suppressed', '1');
    });
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

  function mdjEnsureHeaderVipCss() {
    if (document.getElementById('mdj-header-vip-css')) return;
    var l = document.createElement('link');
    l.id = 'mdj-header-vip-css';
    l.rel = 'stylesheet';
    l.href = './mdj-header-vip.css?v=20260418-AVATAR-FREEZE';
    document.head.appendChild(l);
  }

  /** Phase 1 desktop audit: guest ring, loyalty pill, ≥1200px spacing (no change <1200px layout intent). */
  function mdjEnsureDesktopAuditCss() {
    if (document.getElementById('mdj-header-desktop-audit-css')) return;
    var l = document.createElement('link');
    l.id = 'mdj-header-desktop-audit-css';
    l.rel = 'stylesheet';
    l.href = './mdj-header-desktop-audit.css?v=20260414-MAC-DESKTOP-SYNC';
    document.head.appendChild(l);
  }

  function mdjSyncClientLoyaltyIndicator(isClientSession) {
    var el = document.getElementById('header-client-loyalty-indicator');
    var actions = document.querySelector('#mainHeader .header-actions');
    if (!isClientSession) {
      if (el) {
        el.style.display = 'none';
        el.textContent = '';
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
    var label = 'Returning client';
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var tx = window.i18n.t('header-client-loyalty');
        if (tx) label = tx;
      }
    } catch (e) { /* ignore */ }
    if (!window.i18n) {
      var raw = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
      if (raw.indexOf('es') === 0) label = 'Cliente recurrente';
    }
    el.textContent = label;
    el.style.display = 'inline-flex';
  }

  function mdjHideMiPortalButton() {
    var el = document.getElementById('header-mi-portal-btn');
    if (el) el.style.display = 'none';
    var mob = document.getElementById('header-mi-portal-mobile');
    if (mob) mob.style.display = 'none';
    var navL = document.getElementById('mainNav-mi-portal-link');
    if (navL) navL.style.display = 'none';
  }

  /**
   * MI PORTAL en la fila inferior (#mainNav), mismo ritmo que Home/Services/…; dorado vía CSS.
   * Si existe #mainNav, no duplicamos el CTA en .header-actions (se oculta #header-mi-portal-btn).
   */
  function mdjEnsureMiPortalInMainNav(href) {
    var nav = document.getElementById('mainNav');
    if (!nav) return;
    mdjEnsureHeaderVipCss();
    var link = document.getElementById('mainNav-mi-portal-link');
    if (!link) {
      link = document.createElement('a');
      link.id = 'mainNav-mi-portal-link';
      link.setAttribute('data-i18n', 'header-mi-portal');
      link.setAttribute('data-mdj-nav', 'mi-portal');
      nav.appendChild(link);
    }
    link.className = 'mdj-mi-portal-mainnav mdj-mi-portal-gold';
    link.href = href || './client-portal.html';
    link.style.display = '';
    mdjApplyMiPortalLinkLabel(link);
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
  function mdjEnsureMiPortalMobile(href) {
    var nav = document.querySelector('#mobileMenu .mobile-nav');
    if (!nav) return;
    mdjEnsureHeaderVipCss();
    var btn = document.getElementById('header-mi-portal-mobile');
    if (!btn) {
      btn = document.createElement('a');
      btn.id = 'header-mi-portal-mobile';
      btn.setAttribute('data-i18n', 'header-mi-portal');
      btn.setAttribute('aria-label', 'My portal');
      btn.href = href || './client-portal.html';
      nav.insertBefore(btn, nav.firstChild);
    }
    btn.className = 'mdj-mi-portal-mobile mdj-mi-portal-gold';
    btn.href = href || './client-portal.html';
    btn.style.display = '';
    mdjApplyMiPortalLinkLabel(btn);
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

  function mdjIsRealPhotoUrl(url) {
    if (!url || !String(url).trim()) return false;
    var u = String(url).trim();
    if (/placeholder|dj-avatar-placeholder\.png/i.test(u)) return false;
    return /^https?:\/\//i.test(u) || u.indexOf('data:image/') === 0;
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

  function mdjCloseAccountMenu() {
    var m = document.getElementById('accountMenu');
    var tr = document.getElementById('mdjAccountVipTrigger');
    if (m) m.classList.remove('open');
    if (tr) tr.setAttribute('aria-expanded', 'false');
  }

  function mdjBindVipAccountInteractionsOnce() {
    if (window.__mdjVipAcctBound) return;
    window.__mdjVipAcctBound = true;
    document.addEventListener('click', function (e) {
      var menu = document.getElementById('accountMenu');
      var tr = document.getElementById('mdjAccountVipTrigger');
      if (tr && tr.contains(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        if (!menu) return;
        menu.classList.toggle('open');
        tr.setAttribute('aria-expanded', menu.classList.contains('open') ? 'true' : 'false');
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

  function mdjGetBillingMenuLabel() {
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var t = window.i18n.t('client-menu-billing');
        if (t) return t;
      }
    } catch (err) { /* ignore */ }
    var lang = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
    return lang.indexOf('en') === 0 ? 'Payment methods & billing' : 'Métodos de Pago y Facturación';
  }

  function mdjGetAccountSettingsLabel() {
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var t2 = window.i18n.t('client-menu-account-settings');
        if (t2) return t2;
      }
    } catch (err2) { /* ignore */ }
    var lang2 = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
    return lang2.indexOf('en') === 0 ? 'Account settings' : 'Ajustes de cuenta';
  }

  /** Primer ítem del menú VIP (cliente): acceso rápido a foto/datos — mismo destino que Ajustes, etiqueta corta. */
  function mdjGetVipProfileShortcutLabel() {
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var tp = window.i18n.t('client-menu-profile-shortcut');
        if (tp) return tp;
      }
    } catch (e0) { /* ignore */ }
    var langP = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
    return langP.indexOf('en') === 0 ? 'My profile' : 'Mi perfil';
  }

  function mdjGetLogoutLabel() {
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var t3 = window.i18n.t('client-menu-logout');
        if (t3) return t3;
      }
    } catch (err3) { /* ignore */ }
    var lang3 = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
    return lang3.indexOf('en') === 0 ? 'Log out' : 'Cerrar sesión';
  }

  /**
   * Avatar circular + nombre (misma línea); clic abre #accountMenu.
   * Cliente: sin enlaces de artista; incluye facturación.
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
   * Actualización instantánea del avatar VIP tras subir/guardar foto (account-settings), sin recargar.
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
    if (!profileUrl) profileUrl = isClient ? './account-settings.html' : './client-portal.html';
    var showDjDash = !!ctx.showDjDashboard;
    var profileLabel =
      ctx.profileLabel ||
      (isClient ? mdjGetVipProfileShortcutLabel() : !ctx.hasDjProfile ? 'Mi cuenta' : 'Mi perfil');
    var useAvatarInitials = !!ctx.useAvatarInitials;
    var avatarInitials = ctx.avatarInitials || '?';
    var avatarUrl = ctx.avatarUrl || '';

    var menuHtml = '';
    menuHtml += '<a id="accountBtn" class="mdj-menu-item mdj-menu-profile" href="' + mdjEscapeAttr(profileUrl) + '">' + mdjEscapeHtml(profileLabel) + '</a>';
    if (isClient) {
      menuHtml += '<a class="mdj-menu-item" href="./client-billing.html">' + mdjEscapeHtml(mdjGetBillingMenuLabel()) + '</a>';
    }
    if (showDjDash) {
      menuHtml += '<a class="mdj-menu-item" href="./dj-dashboard.html">DJ Dashboard</a>';
    }
    /* Cliente: el primer ítem ya va a account-settings; no duplicar. */
    if (!isClient) {
      menuHtml += '<a class="mdj-menu-item" href="./account-settings.html">' + mdjEscapeHtml(mdjGetAccountSettingsLabel()) + '</a>';
    }
    menuHtml += '<button type="button" class="mdj-menu-item mdj-menu-logout">' + mdjEscapeHtml(mdjGetLogoutLabel()) + '</button>';

    var avatarSlotHtml = mdjBuildAvatarSlotHtml({
      useAvatarInitials: useAvatarInitials,
      avatarInitials: avatarInitials,
      avatarUrl: avatarUrl
    });

    var root = document.getElementById('mdjAccountVipRoot');
    if (root) {
      var slot = document.getElementById('mdjHeaderAvatarSlot');
      if (slot) {
        slot.outerHTML = avatarSlotHtml;
      } else {
        var trg = document.getElementById('mdjAccountVipTrigger');
        var nmEl = document.getElementById('mdjAccountDisplayName');
        if (trg && nmEl) {
          var ph = document.createElement('div');
          ph.innerHTML = avatarSlotHtml;
          var newSlot = ph.firstElementChild;
          if (newSlot) trg.insertBefore(newSlot, nmEl);
        }
      }
      var nm = document.getElementById('mdjAccountDisplayName');
      if (nm) nm.textContent = displayName;
      var ab = document.getElementById('accountBtn');
      if (ab) {
        ab.href = profileUrl;
        ab.textContent = profileLabel;
      }
      var menu = document.getElementById('accountMenu');
      if (menu) menu.innerHTML = menuHtml;
      mdjBindHeaderAvatarImgFallbackOnce();
      return;
    }

    zone.innerHTML =
      '<div class="mdj-account-vip" id="mdjAccountVipRoot">' +
      '<button type="button" class="mdj-account-vip-trigger" id="mdjAccountVipTrigger" aria-expanded="false" aria-haspopup="true">' +
      avatarSlotHtml +
      '<span class="mdj-account-display-name" id="mdjAccountDisplayName">' +
      mdjEscapeHtml(displayName) +
      '</span>' +
      '</button>' +
      '<nav id="accountMenu" class="mdj-account-dropdown" role="menu">' +
      menuHtml +
      '</nav>' +
      '</div>';
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

  function mdjNavHighlight() {
    var path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    var hash = (location.hash || '').replace(/^#/, '').toLowerCase();
    var key = '';
    if (path === 'index.html' || path === '') {
      if (hash === 'services') key = 'services';
      else if (hash === 'contact') key = 'contact';
      else key = 'home';
    } else if (path === 'shop.html') key = 'shop';
    else if (path === 'courses.html') key = 'courses';
    else if (path === 'dj-tools.html') key = 'tools';
    else if (path === 'jobs.html') key = 'jobs';
    else if (path === 'rentals.html') key = 'rentals';
    else if (path === 'find-dj.html') key = 'home';
    else if (path === 'dj-profile.html') key = 'flow';
    else if (path === 'dj-dashboard.html') key = 'mi-portal';
    else if (path === 'client-portal.html' || path === 'client-billing.html') key = 'mi-portal';

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
    mdjSetHeaderAuthPillsPending(true);
    try {
      var sb = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
      if (!sb) {
        mdjEnsureDesktopAuditCss();
        mdjHideMiPortalButton();
        mdjApplyGuestHeaderAvatar();
        mdjApplyHeaderAuthPillSession(false);
        mdjSyncClientLoyaltyIndicator(false);
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
        var subFreeDesk = document.getElementById('header-subscribe-free-btn');
        var subFreeMob = document.getElementById('header-subscribe-free-mobile');
        if (subFreeDesk) subFreeDesk.style.display = 'none';
        if (subFreeMob) subFreeMob.style.display = 'none';

        var getProBtn = document.getElementById('header-get-pro-btn');
        if (authZone) authZone.style.display = 'block';

        try {
          var pr = await sb.from('dj_profiles').select('role, photo_url, dj_name, stage_name, username, plan_type, plan, plan_status, plan_expires_at, is_premium, hardware_token').eq('user_id', session.user.id).maybeSingle();
          var p = pr.data;
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
          var jwtArtist = metaUt === 'talent' || metaUt === 'dj' || (appRole && String(appRole).toLowerCase() === 'artist');
          var metaUtLower = metaUt ? String(metaUt).toLowerCase() : '';
          var appRoleLower = appRole ? String(appRole).toLowerCase() : '';
          var metadataSaysClient = metaUtLower === 'client' || appRoleLower === 'client';
          var isClient =
            (p && String(p.role || '').toLowerCase() === 'client') ||
            (!p && hasClientRow) ||
            (!p && metadataSaysClient && !jwtArtist);
          var isProUser = p && (
            p.is_premium === true
            || ['PRO', 'ELITE'].includes(p.plan)
            || (['pro_monthly', 'pro_annual', 'PRO'].includes(p.plan_type) && (p.plan_status || 'active') === 'active' && (!p.plan_expires_at || new Date(p.plan_expires_at) > new Date()))
          );
          var djproBadge = document.getElementById('header-djpro-badge');
          if (getProBtn) {
            if (isClient) {
              getProBtn.style.display = 'none';
            } else {
              getProBtn.style.display = isProUser ? 'none' : '';
            }
          }
          if (djproBadge) djproBadge.style.display = isProUser && !isClient ? 'inline-flex' : 'none';
          mdjSyncClientLoyaltyIndicator(!!isClient);
          /* Con cuenta y sin PRO: el CTA lleva a Jobs — mismas tarjetas de abajo (LITE free o PRO de pago), no a login. */
          if (getProBtn && !isProUser && !isClient) {
            getProBtn.href = './jobs.html#selection-screen';
          }

          var meta = session.user && session.user.user_metadata ? session.user.user_metadata : {};
          var sessionAvatar = meta.avatar_url || meta.picture || meta.picture_url;
          var clientPic = '';
          if (clientRow) {
            clientPic = (clientRow.avatar_url || clientRow.photo_url || '').trim();
          }
          /* Misma jerarquía que el resumen de cuenta: clientes → client_profiles; artistas → dj_profiles.photo_url antes que OAuth JWT (si el JWT 404, el <img> cae a iniciales aunque Storage sea válido). */
          var rawPhoto = mdjPickHeaderProfilePhotoUrl(isClient, p, sessionAvatar, clientPic);
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
          var profileUrl;
          var profileText;
          if (isClient) {
            profileUrl = './account-settings.html';
            profileText = mdjGetVipProfileShortcutLabel();
          } else if (!p && !jwtArtist) {
            profileUrl = './account-settings.html';
            profileText = 'Mi cuenta';
          } else {
            profileUrl = uid
              ? './dj-profile.html?id=' + encodeURIComponent(uid)
              : './dj-profile.html';
            profileText = 'Mi perfil';
          }

          var hasDjProfile = !!(p && String(p.role || '').toLowerCase() !== 'client');
          var showDjDashboard = !!(hasDjProfile && !isClient);

          var miPortalHref = './client-portal.html';
          if (isClient) {
            miPortalHref = './client-portal.html';
          } else if (hasDjProfile) {
            miPortalHref = './dj-dashboard.html';
          } else if (!p && !jwtArtist) {
            miPortalHref = './account-settings.html';
          } else {
            miPortalHref = profileUrl;
          }

          mdjMountOrUpdateVipAccountZone({
            displayName: displayName,
            avatarUrl: hasRealPhoto ? String(rawPhoto).trim() : '',
            useAvatarInitials: useAvatarInitials,
            avatarInitials: avatarInitials,
            profileUrl: profileUrl,
            profileLabel: profileText,
            isClient: isClient,
            showDjDashboard: showDjDashboard,
            hasDjProfile: hasDjProfile
          });
          if (hasRealPhoto && rawPhoto && typeof window.mdjHeaderVipApplyPhotoUrl === 'function') {
            window.mdjHeaderVipApplyPhotoUrl(String(rawPhoto).trim());
          }

          mdjApplyDjToolsNavForClientSession(isClient);

          mdjMaybeRunVipWelcomeProtocol(session);

          if (document.getElementById('mainNav')) {
            mdjEnsureMiPortalInMainNav(miPortalHref);
            var hdrDup = document.getElementById('header-mi-portal-btn');
            if (hdrDup) hdrDup.style.display = 'none';
          } else {
            mdjEnsureMiPortalButton(miPortalHref);
          }
          mdjEnsureMiPortalMobile(miPortalHref);
          mdjNavHighlight();

          mdjApplyHeaderAuthPillSession(true);

          var navMobile = document.getElementById('nav-my-profile-mobile');
          if (navMobile) {
            if (miPortalHref === profileUrl) {
              navMobile.style.display = 'none';
            } else {
              navMobile.style.display = 'block';
              navMobile.href = profileUrl;
              navMobile.textContent = profileText;
            }
          }

          document.querySelectorAll('a[href="./dj-profile.html"]').forEach(function (link) {
            if (link.id === 'accountBtn') return;
            if (isClient) {
              link.href = './client-portal.html';
              if (link.getAttribute('data-i18n') === 'menu-account') {
                link.textContent = 'Mi Portal';
              }
            } else if (!p && !jwtArtist) {
              link.href = './account-settings.html';
            }
          });

          var myProfileBtn = document.getElementById('nav-my-profile');
          if (myProfileBtn) {
            myProfileBtn.href = profileUrl;
            myProfileBtn.style.display = 'inline-block';
          }
        } catch (e) {
          console.error('[MDJ-SYSTEM] Error fetching profile for nav:', e);
          try {
            mdjApplyHeaderAuthPillSession(true);
          } catch (e2) { /* ignore */ }
          mdjApplyDjToolsNavForClientSession(false);
          mdjSyncClientLoyaltyIndicator(false);
        }
      } else {
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
        mdjApplyDjToolsNavForClientSession(false);
      }
    } catch (err) {
      console.error('[MDJ-SYSTEM] checkSessionForNav:', err);
      mdjHideMiPortalButton();
      if (authZone) authZone.style.display = 'none';
      mdjApplyHeaderAuthPillSession(false);
      mdjSyncClientLoyaltyIndicator(false);
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

    /** #mainNav “More” — panel estilo Facebook (solo desktop ≥1001px donde .header-bottom es visible) */
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
    if (typeof window.updateAuthButtons === 'function') window.updateAuthButtons();

    document.addEventListener('languageChanged', function () {
      if (typeof window.updateAuthButtons === 'function') window.updateAuthButtons();
      if (typeof window.checkSessionForNav === 'function') {
        void window.checkSessionForNav();
      }
    });
  };

  document.addEventListener('DOMContentLoaded', function () {
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
})();
