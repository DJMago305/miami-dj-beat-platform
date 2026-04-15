/**
 * Miami DJ Beat — shared top header behavior (session, cart, search, mobile, nav highlight).
 * Load after: supabase CDN, supabase-config.js, header-smart-search.js (optional), translations/i18n (optional).
 */
(function () {
  'use strict';

  /** Header login / logout copy — aligned with document.lang + i18n.currentLang (no layout/CSS changes). */
  function mdjHeaderAuthLabel(key) {
    if (window.i18n && typeof window.i18n.t === 'function') {
      var s = window.i18n.t(key);
      if (s) return s;
    }
    var es = (document.documentElement && document.documentElement.lang === 'es')
      || (window.i18n && window.i18n.currentLang === 'es');
    if (key === 'btn-logout') return es ? 'SALIR' : 'LOGOUT';
    return es ? 'ENTRAR' : 'LOGIN';
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
    else if (path === 'dj-dashboard.html') key = 'home';
    else if (path === 'client-portal.html') key = 'home';

    document.querySelectorAll('#mainNav a[data-mdj-nav], .mobile-nav a[data-mdj-nav]').forEach(function (el) {
      el.classList.toggle('active', key && el.getAttribute('data-mdj-nav') === key);
    });
  }

  window.mdjNavHighlight = mdjNavHighlight;

  window.doLogout = window.doLogout || async function doLogout(e) {
    if (e) e.preventDefault();
    try {
      var sb = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
      if (sb) await sb.auth.signOut();
    } catch (err) {
      console.warn('Supabase signOut error:', err);
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
    window.location.reload();
  };

  window.checkSessionForNav = window.checkSessionForNav || async function checkSessionForNav() {
    var authZone = document.getElementById('header-auth-zone');
    try {
      var sb = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
      if (!sb) {
        if (authZone) authZone.style.display = 'none';
        return;
      }
      var res = await sb.auth.getSession();
      var session = res.data && res.data.session;

      if (session) {
        var subFreeDesk = document.getElementById('header-subscribe-free-btn');
        var subFreeMob = document.getElementById('header-subscribe-free-mobile');
        if (subFreeDesk) subFreeDesk.style.display = 'none';
        if (subFreeMob) subFreeMob.style.display = 'none';

        var loginBtnMobile = document.getElementById('header-login-btn-mobile');
        var getProBtn = document.getElementById('header-get-pro-btn');
        if (loginBtnMobile) loginBtnMobile.textContent = 'Mi Perfil';
        if (authZone) authZone.style.display = 'block';

        try {
          var pr = await sb.from('dj_profiles').select('role, photo_url, plan_type, plan, plan_status, plan_expires_at, is_premium, hardware_token').eq('user_id', session.user.id).maybeSingle();
          var p = pr.data;
          // Clientes solo tienen client_profiles; si no hay fila en dj_profiles debemos detectarlos o el avatar apunta a dj-profile y esa página expulsa al home.
          var hasClientRow = false;
          if (!p) {
            try {
              var cpr = await sb.from('client_profiles').select('user_id').eq('user_id', session.user.id).maybeSingle();
              hasClientRow = !!(cpr && cpr.data && cpr.data.user_id);
            } catch (cErr) { /* ignore */ }
          }
          var metaUt = session.user && session.user.user_metadata && session.user.user_metadata.user_type;
          var appRole = session.user && session.user.app_metadata && session.user.app_metadata.role;
          var jwtArtist = metaUt === 'talent' || metaUt === 'dj' || (appRole && String(appRole).toLowerCase() === 'artist');
          var isClient = (p && p.role === 'client') || (!p && hasClientRow);
          var isProUser = p && (
            p.is_premium === true
            || ['PRO', 'ELITE'].includes(p.plan)
            || (['pro_monthly', 'pro_annual', 'PRO'].includes(p.plan_type) && (p.plan_status || 'active') === 'active' && (!p.plan_expires_at || new Date(p.plan_expires_at) > new Date()))
          );
          var djproBadge = document.getElementById('header-djpro-badge');
          if (getProBtn) getProBtn.style.display = isProUser ? 'none' : '';
          if (djproBadge) djproBadge.style.display = isProUser ? 'inline-flex' : 'none';
          /* Con cuenta y sin PRO: el CTA lleva a Jobs — mismas tarjetas de abajo (LITE free o PRO de pago), no a login. */
          if (getProBtn && !isProUser && !isClient) {
            getProBtn.href = './jobs.html#selection-screen';
          }

          var sessionAvatar = session.user && session.user.user_metadata && session.user.user_metadata.avatar_url;
          var finalAvatar = sessionAvatar || (p && p.photo_url);
          if (finalAvatar) {
            document.querySelectorAll('.avatar, #accountBtn .avatar').forEach(function (img) { img.src = finalAvatar; });
          }

          var uid = session.user && session.user.id;
          var profileUrl;
          var profileText;
          if (isClient) {
            profileUrl = './client-portal.html';
            profileText = 'Mi Portal';
          } else if (!p && !jwtArtist) {
            // Sesión sin fila en dj_profiles y sin señal JWT de artista: evitar dj-profile (expulsa al home). Cuenta / ajustes.
            profileUrl = './account-settings.html';
            profileText = 'Mi cuenta';
          } else {
            profileUrl = uid
              ? './dj-profile.html?id=' + encodeURIComponent(uid)
              : './dj-profile.html';
            profileText = 'Mi perfil';
          }

          var accountBtnEl = document.getElementById('accountBtn');
          if (accountBtnEl && accountBtnEl.tagName === 'A') {
            accountBtnEl.href = profileUrl;
            var accLabel = isClient ? 'Mi Portal' : (!p && !jwtArtist ? 'Mi cuenta' : 'Mi perfil');
            accountBtnEl.setAttribute('title', accLabel);
            accountBtnEl.setAttribute('aria-label', accLabel);
          }

          ['header-login-btn', 'header-login-btn-mobile'].forEach(function (id) {
            var btn = document.getElementById(id);
            if (btn) {
              btn.setAttribute('data-i18n', 'btn-logout');
              btn.textContent = mdjHeaderAuthLabel('btn-logout');
              btn.classList.remove('gold');
              btn.classList.add('danger');
              btn.href = '#';
              btn.onclick = function (e) { e.preventDefault(); window.doLogout(); };
            }
          });

          var navMobile = document.getElementById('nav-my-profile-mobile');
          if (navMobile) {
            navMobile.style.display = 'block';
            navMobile.href = profileUrl;
            navMobile.textContent = profileText;
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

          var mobileProfileBtn = document.getElementById('nav-my-profile-mobile');
          if (mobileProfileBtn) {
            mobileProfileBtn.href = profileUrl;
            mobileProfileBtn.style.display = 'block';
          }
        } catch (e) { console.error('Error fetching profile for nav:', e); }
      } else {
        if (authZone) authZone.style.display = 'none';
        var djproBadge = document.getElementById('header-djpro-badge');
        var getProBtn = document.getElementById('header-get-pro-btn');
        var subFreeDesk2 = document.getElementById('header-subscribe-free-btn');
        var subFreeMob2 = document.getElementById('header-subscribe-free-mobile');
        if (djproBadge) djproBadge.style.display = 'none';
        /* PRO: solo tras tener cuenta; primero alta / login (no invitar a plan=pro en frío). */
        if (getProBtn) getProBtn.style.display = 'none';
        if (subFreeDesk2) subFreeDesk2.style.display = '';
        if (subFreeMob2) subFreeMob2.style.display = '';
      }
    } catch (err) {
      console.error('checkSessionForNav:', err);
      if (authZone) authZone.style.display = 'none';
    } finally {
      if (authZone) authZone.classList.remove('session-pending');
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
      mobileMenu.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () {
          setMobileOpen(false);
        });
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && mobileMenu.classList.contains('active')) setMobileOpen(false);
      });
    }

    document.addEventListener('click', function () {
      var m = document.getElementById('accountMenu');
      if (m) m.classList.remove('open');
    });

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

    document.addEventListener('languageChanged', function () {
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
})();
