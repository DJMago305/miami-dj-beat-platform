/**
 * MDJ Building Resolver — v1.0.0 (Foundation Layer)
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for user building resolution.
 *
 * PHASE 1 — Pure data layer.
 * - Zero DOM mutations
 * - Zero routing changes
 * - Zero visual side-effects
 * - Does NOT replace existing logic yet (Phases 2–5 will wire this in)
 *
 * Public API (window):
 *   mdjResolveBuilding(opts)            → building result object (sync, given data)
 *   mdjResolveBuildingFromSession()     → Promise<building result> (async, fetches from Supabase)
 *   MDJ_BUILDING                        → cached result of last async resolution
 *   MDJ_BUILDING_ROUTES                 → frozen routing contract
 *   MDJ_BUILDING_NAV_MATRIX             → frozen nav matrix per building
 *
 * Priority order (MUST match Postgres is_staff / is_staff_management):
 *   1. owner        — app_metadata.role = 'owner' (supremo)
 *   2. staff        — staffInDb (admin | manager | seller)
 *   3. client       — explicit client role or dj_profiles.role = 'client'
 *   4. artist       — has dj_profiles row with non-client role
 *   5. client       — fallback: has client_profiles row
 *   6. guest        — authenticated but no profile resolved
 *   (no session)    — guest
 *
 * Depends on: mdj-identity.js (mdjClassifyPlatformIdentity) if loaded.
 * Load order:  supabase-config.js → mdj-identity.js → mdj-building-resolver.js
 * ─────────────────────────────────────────────────────────────────────────────
 */
(function (g) {
  'use strict';

  /* ── Internal helpers ─────────────────────────────────────────────── */

  function _n(s) {
    return String(s == null ? '' : s).toLowerCase().trim();
  }

  var _STAFF_ROLES      = { admin: 1, owner: 1, manager: 1, seller: 1 };
  var _MANAGEMENT_ROLES = { admin: 1, owner: 1, manager: 1 };

  function _isStaffRole(r)      { return !!r && _STAFF_ROLES[r] === 1; }
  function _isManagementRole(r) { return !!r && _MANAGEMENT_ROLES[r] === 1; }

  /* ── BUILDING_ROUTES — Routing contract ───────────────────────────── */
  /**
   * Canonical destination per building × route slot.
   * Consumers: mdjb-shared-header.js (Phases 2-3), role-guard.js (Phase 3), auth.js (Phase 3).
   * NO consumer in Phase 1 — exposed for inspection only.
   */
  var BUILDING_ROUTES = Object.freeze({
    owner: Object.freeze({
      home:      './account-profile.html',
      profile:   './account-profile.html',
      settings:  './account-settings.html',
      portal:    './account-profile.html',
      dashboard: './admin-dashboard.html',
      login_redirect: './account-profile.html'
    }),
    staff: Object.freeze({
      home:      './admin-dashboard.html',
      profile:   './account-profile.html',
      settings:  './account-settings.html',
      portal:    './account-settings.html',
      dashboard: './admin-dashboard.html',
      login_redirect: './admin-dashboard.html'
    }),
    artist: Object.freeze({
      home:      './dj-profile.html',
      profile:   './dj-profile.html',
      settings:  './dj-dashboard.html?tab=settings',
      portal:    './dj-profile.html',
      dashboard: './dj-dashboard.html',
      login_redirect: './dj-profile.html'
    }),
    client: Object.freeze({
      home:      './client-portal.html',
      profile:   './client-portal.html',
      settings:  './client-account.html',
      portal:    './client-portal.html',
      dashboard: './client-portal.html',
      login_redirect: './client-portal.html'
    }),
    guest: Object.freeze({
      home:      './index.html',
      profile:   './login.html',
      settings:  './login.html',
      portal:    './login.html',
      dashboard: './login.html',
      login_redirect: './index.html'
    })
  });

  /* ── BUILDING_NAV_MATRIX — Tab sets per building ─────────────────── */
  /**
   * Each entry: { key, labelKey, href, optional }
   *   key       — machine identifier
   *   labelKey  — translations.js key for i18n label
   *   href      — default destination (may be overridden by context)
   *   optional  — true = shown only when feature is operationally active
   *
   * Phase 1: data-only. Phase 2 will drive DOM from this matrix.
   */
  var BUILDING_NAV_MATRIX = Object.freeze({

    /* OWNER: back-office + personal account, never artist rail */
    owner: Object.freeze([
      { key: 'home',    labelKey: 'nav-home',     href: './index.html',                      optional: false },
      { key: 'profile', labelKey: 'nav-my-profile',href: './account-profile.html',           optional: false },
      { key: 'config',  labelKey: 'nav-config',   href: './account-settings.html',           optional: false },
      { key: 'staff',   labelKey: 'nav-staff',    href: './admin-dashboard.html',            optional: false },
      { key: 'flow',    labelKey: 'nav-flow',      href: './dj-dashboard.html?tab=flow',     optional: true  },
      { key: 'jobs',    labelKey: 'nav-jobs',      href: './jobs.html',                      optional: false },
      { key: 'agenda',  labelKey: 'nav-agenda',    href: './dj-dashboard.html?tab=dashboard',optional: true  },
      { key: 'tools',   labelKey: 'nav-tools',     href: './dj-tools.html',                  optional: true  },
      { key: 'contact', labelKey: 'nav-contact',   href: './index.html#contact',             optional: false }
    ]),

    /* STAFF (admin/manager/seller): operational nav, no artist tabs */
    staff: Object.freeze([
      { key: 'home',    labelKey: 'nav-home',      href: './index.html',           optional: false },
      { key: 'profile', labelKey: 'nav-my-profile', href: './account-profile.html',optional: false },
      { key: 'config',  labelKey: 'nav-config',    href: './account-settings.html',optional: false },
      { key: 'staff',   labelKey: 'nav-staff',     href: './admin-dashboard.html', optional: false },
      { key: 'jobs',    labelKey: 'nav-jobs',       href: './jobs.html',           optional: false },
      { key: 'contact', labelKey: 'nav-contact',    href: './index.html#contact',  optional: false }
    ]),

    /* ARTIST (LITE/PRO): full artist rail; SFT and Academia gated by tier */
    artist: Object.freeze([
      { key: 'home',     labelKey: 'nav-home',         href: './index.html',                      optional: false },
      { key: 'profile',  labelKey: 'nav-my-profile',   href: './dj-profile.html',                 optional: false },
      { key: 'agenda',   labelKey: 'nav-agenda',       href: './dj-dashboard.html?tab=dashboard', optional: false },
      { key: 'tools',    labelKey: 'nav-tools',        href: './dj-tools.html',                   optional: false },
      { key: 'academia', labelKey: 'nav-academia',     href: './academia.html',                   optional: false },
      { key: 'sft',      labelKey: 'nav-soundfortips', href: './dj-profile.html#tab-sft',         optional: true  },
      { key: 'config',   labelKey: 'nav-config',       href: './dj-dashboard.html?tab=settings',  optional: false },
      { key: 'contact',  labelKey: 'nav-contact',      href: './index.html#contact',              optional: false }
    ]),

    /* CLIENT: todas las cuentas comprador — misma fila #mainNav en Home, Events, Services, … */
    client: Object.freeze([
      { key: 'home',     labelKey: 'nav-home',            href: './index.html',           optional: false },
      { key: 'services', labelKey: 'nav-services',        href: './rentals.html',         optional: false },
      { key: 'events',   labelKey: 'nav-rentals',         href: './events.html',          optional: false },
      { key: 'shop',     labelKey: 'nav-shop',            href: './shop.html',            optional: false },
      { key: 'jobs',     labelKey: 'nav-jobs',            href: './jobs.html',            optional: false },
      { key: 'contact',  labelKey: 'nav-contact',         href: './index.html#contact',   optional: false },
      { key: 'settings', labelKey: 'nav-client-settings', href: './client-account.html',  optional: false },
      { key: 'portal',   labelKey: 'header-mi-portal',    href: './client-portal.html',   optional: false }
    ]),

    /* GUEST: public site, no account tabs */
    guest: Object.freeze([
      { key: 'home',     labelKey: 'nav-home',     href: './index.html',         optional: false },
      { key: 'services', labelKey: 'nav-services', href: './rentals.html',       optional: false },
      { key: 'events',   labelKey: 'nav-rentals',  href: './events.html',        optional: false },
      { key: 'shop',     labelKey: 'nav-shop',     href: './shop.html',          optional: false },
      { key: 'tools',    labelKey: 'nav-tools',    href: './dj-tools.html',      optional: false },
      { key: 'jobs',     labelKey: 'nav-jobs',     href: './jobs.html',          optional: false },
      { key: 'contact',  labelKey: 'nav-contact',  href: './index.html#contact', optional: false }
    ])
  });

  /* ── navTier mapping — backward compat with mdjb-shared-header.js ─── */
  var BUILDING_NAV_TIER = Object.freeze({
    owner:  'client_only',
    staff:  'client_only',
    artist: 'artist_lite', /* upgraded → artist_pro when isProUser */
    client: 'client_only',
    guest:  'client_only'
  });

  /* ── _buildResult — internal shape factory ────────────────────────── */
  function _buildResult(building, role, flags) {
    flags = flags || {};
    var routes  = BUILDING_ROUTES[building]     || BUILDING_ROUTES.guest;
    var matrix  = BUILDING_NAV_MATRIX[building] || BUILDING_NAV_MATRIX.guest;
    var navTier = (building === 'artist' && flags.isProUser)
      ? 'artist_pro'
      : (BUILDING_NAV_TIER[building] || 'client_only');

    return Object.freeze({
      /* Core identity */
      building:      building,
      role:          _n(role) || 'unknown',
      /* Convenience booleans */
      isOwner:       building === 'owner',
      isStaff:       building === 'owner' || building === 'staff',
      isManagement:  !!flags.isManagement,
      isStaffSolo:   !!flags.isStaffSolo,   /* seller only */
      isArtist:      building === 'artist',
      isClient:      building === 'client',
      isGuest:       building === 'guest',
      isProUser:     !!flags.isProUser,
      /* Nav / routing */
      navTier:       navTier,
      routes:        routes,
      navMatrix:     matrix,
      /* Audit */
      resolvedAt:    Date.now()
    });
  }

  /* ── mdjResolveBuilding — synchronous resolver ────────────────────── */
  /**
   * Resolves user building synchronously from pre-fetched data.
   *
   * @param {object} opts
   * @param {object|null} opts.session     - Supabase session (auth.getSession result)
   * @param {object|null} opts.djRow       - dj_profiles row { role, plan, plan_type, ... }
   * @param {object|null} opts.clientRow   - client_profiles row { user_id, buyer_billing_tier }
   * @returns {Readonly<object>} building result
   */
  function mdjResolveBuilding(opts) {
    opts = opts || {};
    var session   = opts.session   || null;
    var djRow     = opts.djRow     || null;
    var clientRow = opts.clientRow || null;

    /* ── No session → guest ─────────────────────────────────────────── */
    if (!session || !session.user) {
      return _buildResult('guest', null, {});
    }

    var user     = session.user;
    var appRole  = _n((user.app_metadata  && user.app_metadata.role)  || '');
    var userType = _n((user.user_metadata && user.user_metadata.user_type) || '');

    /* ── Consume mdjClassifyPlatformIdentity (mdj-identity.js) ─────── */
    var idn = null;
    if (typeof g.mdjClassifyPlatformIdentity === 'function') {
      try {
        idn = g.mdjClassifyPlatformIdentity({ user: user, djRow: djRow, clientRow: clientRow });
      } catch (e) { /* fallback to manual extraction below */ }
    }

    var dbRole        = idn ? idn.dbRole        : _n((djRow && djRow.role) || '');
    var staffInDb     = idn ? idn.staffInDb      : _isStaffRole(dbRole);
    var managementInDb= idn ? idn.managementInDb : _isManagementRole(dbRole);
    var navStaffSolo  = idn ? idn.navStaffSolo   : (dbRole === 'seller');
    var isExplicitClient = idn ? idn.isExplicitClient : (userType === 'client');
    var hasClientRow  = idn ? idn.hasClientRow   : !!(clientRow && clientRow.user_id);
    var principal     = idn ? idn.principal      : null;

    /* PRO user detection for artist tier upgrade */
    var isProUser = !!(djRow && (
      djRow.is_premium === true ||
      ['PRO', 'ELITE'].indexOf(djRow.plan) >= 0 ||
      (['pro_monthly', 'pro_annual', 'PRO'].indexOf(djRow.plan_type) >= 0 &&
        (_n(djRow.plan_status || 'active') === 'active') &&
        (!djRow.plan_expires_at || new Date(djRow.plan_expires_at) > new Date()))
    ));

    /* ── Priority 1: Owner ──────────────────────────────────────────── */
    if (appRole === 'owner') {
      return _buildResult('owner', 'owner', {
        isManagement: managementInDb || true,
        isStaffSolo:  false,
        isProUser:    false
      });
    }

    /* ── Priority 2: Staff (admin / manager / seller) ───────────────── */
    if (staffInDb || principal === 'staff') {
      return _buildResult('staff', dbRole || appRole, {
        isManagement: managementInDb,
        isStaffSolo:  navStaffSolo,
        isProUser:    false
      });
    }

    /* ── Priority 3: Explicit client (dj_profiles.role = 'client') ─── */
    if (
      isExplicitClient ||
      dbRole === 'client' ||
      dbRole === 'cliente'
    ) {
      return _buildResult('client', 'client', {
        isManagement: false,
        isStaffSolo:  false,
        isProUser:    false
      });
    }

    /* ── Priority 4: Artist (has dj_profiles row, non-client role) ─── */
    var hasDjProfile = !!(djRow && dbRole !== 'client' && dbRole !== 'cliente');
    if (hasDjProfile || principal === 'performer') {
      return _buildResult('artist', dbRole || 'artist', {
        isManagement: false,
        isStaffSolo:  false,
        isProUser:    isProUser
      });
    }

    /* ── Priority 5: Client (has client_profiles row) ─────────────── */
    if (hasClientRow) {
      return _buildResult('client', 'client', {
        isManagement: false,
        isStaffSolo:  false,
        isProUser:    false
      });
    }

    /* ── Priority 6: Authenticated guest (no profile resolved) ─────── */
    return _buildResult('guest', appRole || 'authenticated', {});
  }

  /* ── mdjResolveBuildingFromSession — async convenience ───────────── */
  /**
   * Fetches session + profiles from Supabase, resolves building, caches in
   * window.MDJ_BUILDING. Safe to call multiple times — returns cached result
   * unless forceRefresh = true.
   *
   * @param {boolean} [forceRefresh=false]
   * @returns {Promise<Readonly<object>|null>}
   */
  async function mdjResolveBuildingFromSession(forceRefresh) {
    if (!forceRefresh && g.MDJ_BUILDING) return g.MDJ_BUILDING;

    try {
      var db = g.getSupabaseClient && g.getSupabaseClient();
      if (!db) {
        console.warn('[MDJ-BUILDING-RESOLVER] Supabase client not ready.');
        return null;
      }

      /* Prefer getUser (server-fresh) over getSession (cache) for role accuracy */
      var sessionRes = await db.auth.getSession();
      var session    = sessionRes && sessionRes.data && sessionRes.data.session;

      if (!session) {
        g.MDJ_BUILDING = _buildResult('guest', null, {});
        return g.MDJ_BUILDING;
      }

      /* Enrich session.user with live server data (avoids stale JWT) */
      try {
        var userRes = await db.auth.getUser();
        if (userRes && userRes.data && userRes.data.user) {
          session = Object.assign({}, session, { user: userRes.data.user });
        }
      } catch (euErr) { /* non-fatal — proceed with cached user */ }

      var djRow     = null;
      var clientRow = null;

      try {
        var r1 = await db
          .from('dj_profiles')
          .select('role, plan, plan_type, plan_status, plan_expires_at, is_premium')
          .eq('user_id', session.user.id)
          .maybeSingle();
        djRow = r1 && r1.data ? r1.data : null;
      } catch (e1) { /* non-fatal */ }

      try {
        var r2 = await db
          .from('client_profiles')
          .select('user_id, buyer_billing_tier')
          .eq('user_id', session.user.id)
          .maybeSingle();
        clientRow = r2 && r2.data ? r2.data : null;
      } catch (e2) { /* non-fatal */ }

      g.MDJ_BUILDING = mdjResolveBuilding({ session: session, djRow: djRow, clientRow: clientRow });
      return g.MDJ_BUILDING;

    } catch (err) {
      console.warn('[MDJ-BUILDING-RESOLVER] Resolution failed:', err);
      return null;
    }
  }

  /* ── Expose public API ─────────────────────────────────────────────── */
  g.MDJ_BUILDING_ROUTES     = BUILDING_ROUTES;
  g.MDJ_BUILDING_NAV_MATRIX = BUILDING_NAV_MATRIX;
  g.MDJ_BUILDING            = null;   /* populated after mdjResolveBuildingFromSession() */
  g.mdjResolveBuilding      = mdjResolveBuilding;
  g.mdjResolveBuildingFromSession = mdjResolveBuildingFromSession;

})(typeof window !== 'undefined' ? window : global);
