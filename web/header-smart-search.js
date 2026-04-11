/**
 * Miami DJ Beat — Header smart search (PUBLIC & ACCOUNT-AWARE ONLY)
 *
 * UX: Styled like a compact “Google” bar (see styles.css: .header-search-wrap / .header-smart-search).
 * Placeholder is set here so it stays short in all languages and does not fight the magnifier icon.
 *
 * “Intelligent” behavior (no private data):
 * - Keywords / intents route to curated pages (shop, courses, jobs, rentals, legal, etc.).
 * - Session + dj_profiles.role only choose dashboard vs client portal vs profile vs settings — no PII in UI.
 * - Talent / availability-style queries go to find-dj.html with q= / intent=.
 * - Admin routes are never exposed from this box.
 *
 * Security model:
 * - No indexing of private tables, emails, phones, contracts, or “secret” fields.
 * - Suggestions and routing use a curated allowlist of public URLs + safe intent rules.
 * - DJ name / availability queries are delegated to find-dj.html → public_dj_profiles (RLS/public view).
 * - Account-aware routes (dashboard, profile, settings) use Supabase session + role ONLY to pick
 *   the correct page; no private data is surfaced in the search UI or autocomplete.
 * - Admin and internal tools are never linked from this module.
 */
(function () {
  'use strict';

  /** Curated public destinations (keywords matched with word boundaries where needed). */
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
    { re: /\b(services|portfolio|portafolio)\b/i, href: './index.html#services' },
    { re: /\b(verify|verificar)\b/i, href: './verify.html' },
    { re: /\b(forgot\s*password|olvid[eé]\s*(la\s*)?contraseña)\b/i, href: './forgot-password.html' }
  ];

  var AVAILABILITY_INTENT = /\b(availability|disponibilidad|available|book(\s+a)?\s*dj|contratar(\s+un)?\s*dj|dj\s+para|wedding\s+dj|dj\s+boda)\b/i;

  var ACCOUNT_DASH = /\b(dashboard|agenda|calendar|calendario|mi\s+portal|my\s+portal|panel|control)\b/i;
  var ACCOUNT_PROFILE = /\b(my\s+profile|mi\s+perfil|perfil\s+dj|profile)\b/i;
  var ACCOUNT_SETTINGS = /\b(settings|configuración|configuration|cuenta|account\s+settings)\b/i;

  function getSb() {
    return typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
  }

  function normalize(q) {
    return String(q || '').trim();
  }

  /**
   * Block navigation to admin or unknown protocols; only same-site relative paths.
   */
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

  /**
   * Uses only session + dj_profiles.role — no private fields exposed.
   */
  function accountDestination(kind) {
    var sb = getSb();
    if (!sb) return Promise.resolve('./login.html');
    return sb
      .auth.getSession()
      .then(function (res) {
        var session = res.data && res.data.session;
        if (!session) return './login.html';
        return sb
          .from('dj_profiles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle()
          .then(function (r) {
            var role = r.data && r.data.role;
            var isClient = role === 'client';
            if (kind === 'dash') return isClient ? './client-portal.html' : './dj-dashboard.html';
            if (kind === 'profile') return isClient ? './client-portal.html' : './dj-profile.html';
            if (kind === 'settings') return './account-settings.html';
            return './login.html';
          });
      })
      .catch(function () {
        return './login.html';
      });
  }

  function resolveQuery(q) {
    var raw = normalize(q);
    if (!raw) return Promise.resolve(null);

    if (/^admin\b/i.test(raw) && raw.length < 20) {
      return Promise.resolve('./login.html');
    }

    var direct = matchPublicRoute(raw);
    if (direct) return Promise.resolve(direct);

    if (ACCOUNT_SETTINGS.test(raw)) return accountDestination('settings');
    if (ACCOUNT_DASH.test(raw)) return accountDestination('dash');
    if (ACCOUNT_PROFILE.test(raw)) return accountDestination('profile');

    return Promise.resolve(publicTalentSearchUrl(raw));
  }

  function attachHint(input) {
    var id = 'header-search-privacy-hint';
    if (document.getElementById(id)) return;
    var span = document.createElement('span');
    span.id = id;
    span.className = 'visually-hidden';
    span.setAttribute(
      'aria-live',
      'polite'
    );
    span.textContent =
      'Search covers public pages and the talent directory only. Private account details are not searchable from here.';
    input.setAttribute('aria-describedby', id);
    if (input.parentNode) input.parentNode.appendChild(span);
  }

  function injectStyles() {
    if (document.getElementById('mdj-header-search-styles')) return;
    var st = document.createElement('style');
    st.id = 'mdj-header-search-styles';
    st.textContent =
      '.visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}';
    document.head.appendChild(st);
  }

  function applyPlaceholder(input) {
    var lang = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
    if (lang.indexOf('es') === 0) {
      input.setAttribute('placeholder', 'Buscar DJs, tienda, cursos, reservas…');
    } else {
      input.setAttribute('placeholder', 'Search DJs, shop, courses, booking…');
    }
  }

  function init() {
    var input = document.getElementById('header-smart-search');
    if (!input) return;

    injectStyles();
    applyPlaceholder(input);
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute(
      'title',
      'Smart search: type pages (shop, courses, jobs…) or a DJ query. Public routing only; no private data.'
    );
    attachHint(input);

    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      resolveQuery(input.value).then(navigate);
    });
  }

  window.MdjHeaderSmartSearch = {
    init: init,
    resolveQuery: resolveQuery,
    navigate: navigate
  };
})();
