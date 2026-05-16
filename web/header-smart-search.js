/**
 * Miami DJ Beat — Header smart search (PUBLIC & ACCOUNT-AWARE ONLY)
 *
 * UX: Styled like a compact “Google” bar (see styles.css: .header-search-wrap / .header-smart-search).
 *
 * Event “teaser” search (RPC `mdj_public_search_event_teasers`):
 * - Anonymous: only event type + date in results — no phone, amounts, or addresses.
 * - Click without login → privacy modal or login with redirect + lead id.
 * - Logged in + lead email matches session → client-portal.html?lead=…
 * - Logged in + not owner → wrong-account message.
 *
 * Security model for curated routes unchanged: no admin exposure; DJ discovery via find-dj.html.
 * Consultas tipo «dj» / «todos los dj» abren el directorio (find-dj) con listado completo.
 */
(function () {
  'use strict';

  /* Early: <html.mdj-header-dev-local> for localhost-only header CSS (header-unified.css / styles.css). */
  try {
    var loc = typeof location !== 'undefined' ? location : null;
    var hn = loc && loc.hostname != null ? String(loc.hostname) : '';
    var proto = loc && loc.protocol ? String(loc.protocol) : '';
    if (
      hn === 'localhost' ||
      hn === '127.0.0.1' ||
      hn === '[::1]' ||
      hn === '::1' ||
      (proto === 'file:' && hn === '')
    ) {
      if (document.documentElement) {
        document.documentElement.classList.add('mdj-header-dev-local');
      }
    }
  } catch (eMdjLocalHdr) {
    void eMdjLocalHdr;
  }

  var ROUTES = [
    { re: /\b(shop|store|tienda|gear|equipment|equipamiento|buy|comprar)\b/i, href: './shop.html' },
    { re: /\b(course|courses|curso|cursos|academia|certification|certificación|learn|aprender)\b/i, href: './courses.html' },
    { re: /\b(knowledge|biblioteca|library|cultura\s*dj|dj\s*culture)\b/i, href: './dj-knowledge.html' },
    { re: /\b(job|jobs|trabajo|trabajos|empleo|careers)\b/i, href: './jobs.html' },
    { re: /\b(rental|rentals|event\s*services|servicios\s*de\s*evento|sonido|iluminación|lighting)\b/i, href: './rentals.html' },
    { re: /\b(download|downloads|descarga|descargas|mdjpro\s*app|app)\b/i, href: './downloads.html' },
    { re: /\b(party\s*planner|planificador)\b/i, href: './party-planner.html' },
    { re: /\b(dj\s*tools|herramientas\s*dj)\b/i, href: './dj-tools.html' },
    { re: /\b(legal|privacy|privacidad|terms|términos)\b/i, href: './legal.html' },
    { re: /\b(directory|directorio|find\s*dj|talents?|talento)\b/i, href: './find-dj.html' },
    { re: /\b(login|log\s*in|entrar|sign\s*in|signin|register|registro)\b/i, href: './login.html' },
    { re: /\b(registry|registro\s*oficial)\b/i, href: './registry.html' },
    { re: /\b(contact|contacto|reserv)\b/i, href: './index.html#contact' },
    { re: /\b(services|portfolio|portafolio)\b/i, href: './rentals.html' },
    { re: /\b(eventos|venues|sponsors?|collaborators?|patrocinadores?|our\s+events|past\s+events|live\s+experience)\b/i, href: './index.html#experience' },
    { re: /\b(verify|verificar)\b/i, href: './verify.html' },
    { re: /\b(forgot\s*password|olvid[eé]\s*(la\s*)?contraseña)\b/i, href: './forgot-password.html' }
  ];

  var AVAILABILITY_INTENT = /\b(availability|disponibilidad|available|book(\s+a)?\s*dj|contratar(\s+un)?\s*dj|dj\s+para|wedding\s+dj|dj\s+boda)\b/i;

  /** Listado completo de DJs en find-dj (no confundir con “dj tools”, tienda, etc.). */
  function isDjDirectoryIntent(raw) {
    var s = String(raw || '').trim().toLowerCase();
    if (!s || s.length > 48) return false;
    if (/\b(tool|tools|tienda|shop|curso|cursos|knowledge|legal|download|verify|login)\b/i.test(s)) return false;
    if (/^(dj|djs)$/i.test(s)) return true;
    if (/^(ver|mostrar|listar|lista|buscar|todos)\s+(los\s+)?(dj|djs)\s*$/i.test(s)) return true;
    if (/^(dj|djs)\s+(disponibles?|disponible|en\s+miami|miami)\s*$/i.test(s)) return true;
    if (/\b(todos\s+los\s+dj|lista\s+de\s+dj|directorio\s+dj|busco\s+dj|necesito\s+un\s+dj)\b/i.test(s)) return true;
    return false;
  }

  function djDirectoryHref() {
    return './find-dj.html?from=header';
  }

  function renderDjDirectoryQuickLink(input) {
    removeDropdown();
    var wrap = ensureDropdownWrap(input);
    if (!wrap) return;
    var dd = document.createElement('div');
    dd.id = DROPDOWN_ID;
    dd.setAttribute('role', 'listbox');
    dd.className = 'mdj-header-event-teaser-dropdown';
    var head = t('header-search-dj-directory-head', 'DJ directory', 'Directorio de DJs');
    var btn = t('header-search-dj-directory-btn', 'Show all available DJs', 'Ver todos los DJs disponibles');
    dd.innerHTML =
      '<div class="mdj-teaser-head">' +
      portalEscape(head) +
      '</div><ul class="mdj-teaser-list">' +
      '<li><button type="button" class="mdj-teaser-row mdjs-dj-directory-go">' +
      portalEscape(btn) +
      '</button></li></ul>';
    var go = dd.querySelector('.mdjs-dj-directory-go');
    if (go) {
      go.addEventListener('click', function () {
        removeDropdown();
        navigate(djDirectoryHref());
      });
    }
    dd.addEventListener('mousedown', function (e) {
      e.preventDefault();
    });
    wrap.appendChild(dd);
  }

  var ACCOUNT_DASH = /\b(dashboard|agenda|calendar|calendario|mi\s+portal|my\s+portal|panel|control)\b/i;
  var ACCOUNT_PROFILE = /\b(my\s+profile|mi\s+perfil|perfil\s+dj|profile)\b/i;
  var ACCOUNT_SETTINGS = /\b(settings|configuración|configuration|cuenta|account\s+settings)\b/i;

  var TEASER_MIN = 2;
  var DROPDOWN_ID = 'mdj-header-event-teaser-dropdown';
  var MODAL_ID = 'mdj-header-event-private-modal';

  function getSb() {
    return typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
  }

  function normalize(q) {
    return String(q || '').trim();
  }

  function t(key, fbEn, fbEs) {
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var x = window.i18n.t(key);
        if (x) return x;
      }
    } catch (e) { /* ignore */ }
    var lang = (document.documentElement && String(document.documentElement.getAttribute('lang') || '').toLowerCase()) || 'en';
    if (lang.indexOf('es') === 0) return fbEs || fbEn;
    return fbEn;
  }

  function navigate(href) {
    if (!href || typeof href !== 'string') return;
    if (/^https?:\/\//i.test(href)) return;
    if (/^\/\/|^javascript:/i.test(href)) return;
    if (/admin-dashboard|\/admin\b/i.test(href)) return;
    window.location.href = href;
  }

  function matchPublicRoute(q) {
    var i, m;
    for (i = 0; i < ROUTES.length; i++) {
      m = ROUTES[i];
      if (m.re.test(q)) return m.href;
    }
    return null;
  }

  function publicTalentSearchUrl(q) {
    var n = normalize(q);
    if (!n) return null;
    var p = [];
    if (AVAILABILITY_INTENT.test(n)) p.push('intent=availability');
    p.push('q=' + encodeURIComponent(n));
    return './find-dj.html?' + p.join('&');
  }

  function accountDestination(kind) {
    var sb = getSb();
    if (!sb) {
      if (kind === 'settings') {
        return Promise.resolve('./login.html?next=' + encodeURIComponent('./dj-dashboard.html') + '&reason=settings');
      }
      return Promise.resolve('./client-portal.html');
    }
    return sb
      .auth.getSession()
      .then(function (res) {
        var session = res.data && res.data.session;
        if (!session) {
          if (kind === 'dash' || kind === 'profile') return './client-portal.html';
          if (kind === 'settings') {
            return './login.html?next=' + encodeURIComponent('./dj-dashboard.html') + '&reason=settings';
          }
          return './client-portal.html';
        }
        return sb
          .from('dj_profiles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle()
          .then(function (r) {
            var role = r.data && r.data.role;
            var rl = String(role || '').toLowerCase();
            var isClient = rl === 'client' || rl === 'cliente';
            if (kind === 'dash') return isClient ? './client-portal.html' : './dj-dashboard.html';
            if (kind === 'profile') return isClient ? './client-portal.html' : './dj-profile.html';
            if (kind === 'settings') return isClient ? './account-settings.html' : './dj-dashboard.html';
            return './client-portal.html';
          });
      })
      .catch(function () {
        if (kind === 'settings') {
          return './login.html?next=' + encodeURIComponent('./dj-dashboard.html') + '&reason=settings';
        }
        return './client-portal.html';
      });
  }

  function formatTeaserDate(d) {
    if (!d) return '—';
    try {
      var s = String(d).indexOf('T') >= 0 ? String(d) : String(d) + 'T12:00:00';
      var dt = new Date(s);
      if (isNaN(dt.getTime())) return String(d);
      var lang = (document.documentElement && String(document.documentElement.getAttribute('lang') || '').toLowerCase()) || 'en';
      return dt.toLocaleDateString(lang.indexOf('es') === 0 ? 'es' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return String(d);
    }
  }

  function fetchEventTeasers(q) {
    var sb = getSb();
    if (!sb || !sb.rpc) return Promise.resolve([]);
    var query = normalize(q);
    if (query.length < TEASER_MIN) return Promise.resolve([]);
    return sb
      .rpc('mdj_public_search_event_teasers', { p_query: query })
      .then(function (res) {
        if (res.error) {
          console.warn('[header-smart-search] teaser RPC:', res.error.message || res.error);
          return [];
        }
        return Array.isArray(res.data) ? res.data : [];
      })
      .catch(function (err) {
        console.warn('[header-smart-search] teaser RPC failed', err);
        return [];
      });
  }

  function removeDropdown() {
    var el = document.getElementById(DROPDOWN_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function ensureDropdownWrap(input) {
    var wrap = input.closest('.header-search-wrap');
    if (!wrap) return null;
    wrap.style.position = wrap.style.position || 'relative';
    return wrap;
  }

  function renderTeaserDropdown(input, rows) {
    removeDropdown();
    var wrap = ensureDropdownWrap(input);
    if (!wrap || !rows || !rows.length) return;

    var dd = document.createElement('div');
    dd.id = DROPDOWN_ID;
    dd.setAttribute('role', 'listbox');
    dd.className = 'mdj-header-event-teaser-dropdown';
    var title = t(
      'header-search-event-matches',
      'Events (sign in for details)',
      'Eventos (inicia sesión para ver detalles)'
    );
    var html =
      '<div class="mdj-teaser-head">' +
      portalEscape(title) +
      '</div><ul class="mdj-teaser-list">';
    rows.forEach(function (row) {
      var line = portalEscape(String(row.title || 'Event')) + ' — ' + portalEscape(formatTeaserDate(row.event_date));
      html +=
        '<li><button type="button" class="mdj-teaser-row" data-lead-id="' +
        portalEscape(String(row.id)) +
        '">' +
        line +
        '</button></li>';
    });
    html += '</ul>';
    dd.innerHTML = html;
    dd.addEventListener('mousedown', function (e) {
      e.preventDefault();
    });
    wrap.appendChild(dd);

    dd.querySelectorAll('.mdj-teaser-row').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-lead-id');
        if (id) void onTeaserPick(id);
      });
    });
  }

  function portalEscape(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function hidePrivateModal() {
    var m = document.getElementById(MODAL_ID);
    if (m && m.parentNode) m.parentNode.removeChild(m);
    try {
      document.body.style.overflow = '';
    } catch (e) { /* ignore */ }
  }

  function showModal(kind, leadId) {
    hidePrivateModal();
    var isEs = (document.documentElement && String(document.documentElement.getAttribute('lang') || '').toLowerCase().indexOf('es')) === 0;
    var title;
    var body;
    if (kind === 'login') {
      title = t(
        'header-search-event-private-title',
        'This event is private',
        'Este evento es privado'
      );
      body = t(
        'header-search-event-private-body',
        'To protect your privacy, sign in to see your event details.',
        'Para proteger tu privacidad, inicia sesión para ver los detalles de tu evento.'
      );
    } else {
      title = t(
        'header-search-event-wrong-title',
        'Different account',
        'Otra cuenta'
      );
      body = t(
        'header-search-event-wrong-body',
        'This event is not linked to your signed-in email. Open the portal with the account you used when booking.',
        'Este evento no está vinculado a tu cuenta. Inicia sesión con el correo que usaste al reservar.'
      );
    }
    var loginHref =
      './login.html?redirect=client-portal&lead=' + encodeURIComponent(leadId || '') + (isEs ? '&lang=es' : '');

    var overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.className = 'mdj-event-teaser-modal-overlay';
    overlay.innerHTML =
      '<div class="mdj-event-teaser-modal" role="dialog" aria-modal="true">' +
      '<button type="button" class="mdj-teaser-modal-close" aria-label="Close">&times;</button>' +
      '<h3 class="mdj-teaser-modal-title">' +
      portalEscape(title) +
      '</h3>' +
      '<p class="mdj-teaser-modal-body">' +
      portalEscape(body) +
      '</p>' +
      '<div class="mdj-teaser-modal-actions">' +
      (kind === 'login'
        ? '<a class="btn primary mdjs-teaser-login" href="' +
          portalEscape(loginHref) +
          '">' +
          portalEscape(t('header-search-event-login-btn', 'Sign in', 'Iniciar sesión')) +
          '</a>'
        : '<a class="btn primary mdjs-teaser-login" href="' +
          portalEscape(loginHref) +
          '">' +
          portalEscape(t('header-search-event-switch-login', 'Sign in with another account', 'Iniciar con otra cuenta')) +
          '</a>') +
      '</div></div>';

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) hidePrivateModal();
    });
    var closeBtn = overlay.querySelector('.mdj-teaser-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', hidePrivateModal);
  }

  function onTeaserPick(leadId) {
    removeDropdown();
    var sb = getSb();
    if (!sb) {
      showModal('login', leadId);
      return;
    }
    return sb.auth.getSession().then(function (res) {
      var session = res.data && res.data.session;
      if (!session || !session.user) {
        showModal('login', leadId);
        return;
      }
      var email = String(session.user.email || '').trim().toLowerCase();
      if (!email) {
        showModal('login', leadId);
        return;
      }
      return sb
        .from('leads')
        .select('id')
        .eq('id', leadId)
        .eq('email', email)
        .maybeSingle()
        .then(function (r) {
          if (r.data && r.data.id) {
            navigate('./client-portal.html?lead=' + encodeURIComponent(leadId));
            return;
          }
          showModal('wrong', leadId);
        });
    });
  }

  function resolveQuery(q) {
    var raw = normalize(q);
    if (!raw) return Promise.resolve(null);

    if (/^admin\b/i.test(raw) && raw.length < 20) {
      return Promise.resolve('./login.html');
    }

    if (isDjDirectoryIntent(raw)) {
      return Promise.resolve(djDirectoryHref());
    }

    var direct = matchPublicRoute(raw);
    if (direct) return Promise.resolve(direct);

    if (ACCOUNT_SETTINGS.test(raw)) return accountDestination('settings');
    if (ACCOUNT_DASH.test(raw)) return accountDestination('dash');
    if (ACCOUNT_PROFILE.test(raw)) return accountDestination('profile');

    return fetchEventTeasers(raw).then(function (rows) {
      if (rows && rows.length > 0) {
        return { type: 'event-teasers', rows: rows };
      }
      return publicTalentSearchUrl(raw);
    });
  }

  function attachHint(input) {
    var id = 'header-search-privacy-hint';
    if (document.getElementById(id)) return;
    var span = document.createElement('span');
    span.id = id;
    span.className = 'visually-hidden';
    span.setAttribute('aria-live', 'polite');
    span.textContent =
      'Search covers public pages, the talent directory, and event name/date teasers. Full event details require sign-in.';
    input.setAttribute('aria-describedby', id);
    if (input.parentNode) input.parentNode.appendChild(span);
  }

  function injectStyles() {
    if (document.getElementById('mdj-header-search-styles')) return;
    var st = document.createElement('style');
    st.id = 'mdj-header-search-styles';
    st.textContent =
      '.visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}' +
      '.mdj-header-event-teaser-dropdown{position:absolute;left:0;right:0;top:100%;margin-top:6px;z-index:10050;background:rgba(12,10,8,0.97);border:1px solid rgba(197,160,89,0.35);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,0.45);max-height:min(70vh,420px);overflow:auto;}' +
      '.mdj-teaser-head{padding:10px 14px 6px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(197,160,89,0.85);font-weight:800;}' +
      '.mdj-teaser-list{list-style:none;margin:0;padding:4px 6px 8px;}' +
      '.mdj-teaser-row{width:100%;text-align:left;padding:12px 12px;border:none;border-radius:10px;background:transparent;color:#f5f0e8;font-size:14px;font-weight:600;cursor:pointer;font:inherit;}' +
      '.mdj-teaser-row:hover,.mdj-teaser-row:focus{background:rgba(197,160,89,0.12);outline:none;}' +
      '.mdj-event-teaser-modal-overlay{position:fixed;inset:0;z-index:100600;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;padding:20px;}' +
      '.mdj-event-teaser-modal{max-width:420px;width:100%;background:linear-gradient(180deg,#1a1510,#0f0d0a);border:1px solid rgba(197,160,89,0.35);border-radius:18px;padding:24px 22px 20px;position:relative;color:#fff;}' +
      '.mdj-teaser-modal-close{position:absolute;top:10px;right:12px;background:none;border:none;color:rgba(255,255,255,0.55);font-size:24px;line-height:1;cursor:pointer;padding:4px;}' +
      '.mdj-teaser-modal-title{margin:0 0 12px;font-size:20px;font-weight:900;color:var(--gold,#c5a059);}' +
      '.mdj-teaser-modal-body{margin:0 0 18px;line-height:1.45;opacity:0.92;font-size:15px;}' +
      '.mdj-teaser-modal-actions .btn.primary{display:inline-block;padding:12px 20px;border-radius:999px;font-weight:800;text-decoration:none;text-align:center;}';
    document.head.appendChild(st);
  }

  function applyPlaceholder(input) {
    if (window.i18n && typeof window.i18n.t === 'function') {
      var ph = window.i18n.t('header-search-placeholder');
      if (ph) {
        input.setAttribute('placeholder', ph);
        return;
      }
    }
    var lang = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
    if (lang.indexOf('es') === 0) {
      input.setAttribute('placeholder', 'Buscar DJs, tienda, cursos, reservas…');
    } else {
      input.setAttribute('placeholder', 'Search DJs, shop, courses, booking…');
    }
  }

  var debounceTimer = null;

  function init() {
    var input = document.getElementById('header-smart-search');
    if (!input) return;

    injectStyles();
    applyPlaceholder(input);
    if (!input.dataset.mdjLangPlaceholderBound) {
      input.dataset.mdjLangPlaceholderBound = '1';
      document.addEventListener('languageChanged', function () {
        applyPlaceholder(input);
      });
    }
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute(
      'title',
      'Smart search: site pages, talent directory, or event name/date (teaser). Sign in for full event details.'
    );
    attachHint(input);

    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      resolveQuery(input.value).then(function (res) {
        if (res && res.type === 'event-teasers' && res.rows && res.rows.length) {
          if (res.rows.length === 1) {
            void onTeaserPick(res.rows[0].id);
          } else {
            renderTeaserDropdown(input, res.rows);
          }
          return;
        }
        navigate(res);
      });
    });

    input.addEventListener(
      'input',
      function () {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
          var v = normalize(input.value);
          if (v.length < TEASER_MIN) {
            removeDropdown();
            return;
          }
          if (isDjDirectoryIntent(v)) {
            renderDjDirectoryQuickLink(input);
            return;
          }
          if (matchPublicRoute(v) || ACCOUNT_SETTINGS.test(v) || ACCOUNT_DASH.test(v) || ACCOUNT_PROFILE.test(v)) {
            removeDropdown();
            return;
          }
          fetchEventTeasers(v).then(function (rows) {
            if (normalize(input.value) !== v) return;
            if (rows && rows.length) renderTeaserDropdown(input, rows);
            else removeDropdown();
          });
        }, 280);
      },
      false
    );

    document.addEventListener('click', function (ev) {
      if (!input || !ev.target) return;
      if (input.contains(ev.target)) return;
      var dd = document.getElementById(DROPDOWN_ID);
      if (dd && dd.contains(ev.target)) return;
      removeDropdown();
    });
  }

  window.MdjHeaderSmartSearch = {
    init: init,
    resolveQuery: resolveQuery,
    navigate: navigate,
    fetchEventTeasers: fetchEventTeasers,
    onTeaserPick: onTeaserPick
  };
})();
