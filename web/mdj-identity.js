/**
 * Identidad de plataforma (browser) — fuente: public.dj_profiles (rol) + auth.users metadata.
 * Alinear con Postgres: is_staff = admin|owner|manager|seller; gestión = admin|owner|manager; seller = vendedor.
 *
 * Principals:
 * - staff   → empleo operativo en dj_profiles (admin, owner, manager, seller)
 * - buyer   → explícitamente comprador (user_type client o fila client en dj)
 * - performer → talento/artista (cualquier otro dj_profiles no comprador, o sin fila y metadata talento)
 *
 * Verdad en API: public.mdj_access_snapshot() (incl. mdjb_id: MDJB-...-C|A|S|M); tiers: public.mdj_artist_commercial_tier(uid). Refresco código: mdjb_ensure_mine().
 */
(function (g) {
  'use strict';

  var STAFF = { admin: 1, owner: 1, manager: 1, seller: 1 };
  var MANAGEMENT = { admin: 1, owner: 1, manager: 1 };

  function n(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .trim();
  }

  /**
   * @param {{ user: object, djRow: object|null, clientRow: object|null, djRowError: * }} o
   *   djRowError: opcional -- pasar el error (si lo hay) de la consulta a
   *   dj_profiles, NO solo `djRow == null`. Distingue "no tiene fila" (real)
   *   de "la consulta falló" (degradado, p.ej. red lenta) -- ver nota 2026-10-02.
   * @returns {{
   *   dbRole: string,
   *   staffInDb: boolean,
   *   managementInDb: boolean,
   *   navStaffSolo: boolean,
   *   isExplicitClient: boolean,
   *   principal: 'buyer'|'performer'|'staff',
   *   billing: { artist: string, buyer: string, isBuyerVip: boolean, isArtistPro: function }
   * }}
   */
  function mdjClassifyPlatformIdentity(o) {
    o = o || {};
    var u = o.user;
    var dj = o.djRow;
    var cr = o.clientRow;
    var djErr = !!o.djRowError;
    var dr = dj && dj.role != null ? n(dj.role) : '';
    var hasClientRow = !!(cr && (cr.user_id != null));
    var appR = u && u.app_metadata ? n(u.app_metadata.role) : '';
    var ut = (!appR && u && u.user_metadata) ? n(u.user_metadata.user_type) : ''; /* user_type lo escribe el usuario: solo sin rol de servidor */
    var isExplicitClient = ut === 'client';
    /* 2026-10-02: dos arreglos que vivían SOLO duplicados dentro de
       mdjb-shared-header.js, consolidados aquí para que dejen de poder
       desincronizarse entre los ~4 lugares que reimplementan esta misma
       jerarquía (ver docs/tickets/2026-10-01-TICKET-plantilla-cliente-separada-de-artista.md):
       1) Si la consulta a dj_profiles FALLÓ (djRowError, no solo "sin fila"),
          no hay que asumir que la persona no tiene rol de staff/artista --
          TICKET-ROLE-REDIRECT-002 (red lenta clasificaba mal). Guard abajo:
          `!djErr` en la rama de "solo por client_profiles".
       2) Si el JWT (app_metadata.role) YA dice owner/admin/manager/seller,
          pero no llegó ninguna fila real de dj_profiles (ausente o la
          consulta falló), igual se trata como staff -- NUNCA pisa una fila
          dj_profiles real con otro rol: `dr` siempre manda primero si existe. */
    var appRStaffLike = appR === 'owner' || appR === 'admin' || appR === 'manager' || appR === 'seller';
    var staffDegradedFallback = !dr && appRStaffLike && !isExplicitClient;
    var staffInDb = (!!dr && STAFF[dr] === 1) || staffDegradedFallback;
    var managementInDb = (!!dr && MANAGEMENT[dr] === 1) || staffDegradedFallback;
    var navStaffSolo = dr === 'seller';
    var principal;
    /* Orden: staff en DB (o JWT staff degradado); luego comprador SOLO por columna role en dj_profiles;
       luego cualquier otro dr = artista. No dejar que user_type client en JWT pise a un dj_profiles con
       rol de artista (p. ej. dj) — “sancocho” típico. */
    if (staffInDb) {
      principal = 'staff';
    } else if (dr === 'client' || dr === 'cliente') {
      principal = 'buyer';
    } else if (dr) {
      principal = 'performer';
    } else if (isExplicitClient || (appR === 'client' && !dr)) {
      principal = 'buyer';
    } else if (hasClientRow && !dj && !djErr) {
      principal = 'buyer';
    } else {
      principal = 'performer';
    }
    var buyerTier = (cr && cr.buyer_billing_tier != null) ? String(cr.buyer_billing_tier).toLowerCase() : 'none';
    var isBuyerVip = buyerTier === 'vip';
    return {
      dbRole: dr,
      staffInDb: staffInDb,
      managementInDb: managementInDb,
      navStaffSolo: navStaffSolo,
      isExplicitClient: isExplicitClient,
      hasClientRow: hasClientRow,
      principal: principal,
      djRowError: djErr,
      billing: {
        artist: 'dj_profiles',
        buyer: 'client_profiles',
        isBuyerVip: isBuyerVip,
        isArtistPro: function () {
          if (!dj) return false;
          if (g.MDB_SUBSCRIPTION && typeof g.MDB_SUBSCRIPTION.isPremiumTier === 'function') {
            return g.MDB_SUBSCRIPTION.isPremiumTier(dj);
          }
          if (dj.is_premium === true) return true;
          var s = (dj.subscription_status || '').toLowerCase();
          return s === 'active' || s === 'trialing';
        }
      }
    };
  }

  g.mdjClassifyPlatformIdentity = mdjClassifyPlatformIdentity;

  /* ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   * RESOLVEDOR ÚNICO DE «EDIFICIO» (H3): a qué esqueleto pertenece una sesión → { kind, role, source }.
   *   kind: 'staff_full' (owner/admin/manager) | 'staff_seller' | 'artist' | 'buyer' (cliente) | 'unknown'   (mismo vocabulario que public.mdj_access_snapshot().profile_kind)
   *   source: 'jwt' | 'snapshot' | 'none'
   * Orden de decisión:
   *   1) app_metadata.role (el JWT lo fija el SERVIDOR; el usuario no puede editarlo) cuando es de staff o de artista: decisión SIN red.
   *   2) Si el JWT no lo decide (cliente o sin rol): RPC mdj_access_snapshot() con tiempo límite — la base manda (fila de dj_profiles / client_profiles).
   *      Un cliente de JWT al que la base reconoce como staff o artista deja de pasar por cliente.
   *   3) Sin respuesta (red lenta, error, perfil aún sin crear): rol de servidor 'client' → buyer; si no, unknown (la guarda de cada página decide; NUNCA se asume staff).
   * La RPC tiene un efecto (genera el código MDJB una vez por cuenta): por eso no se llama cuando el JWT ya decide.
   * Compatible con Safari 13 (sin ?. ni ??).
   * ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── */
  function accessKindFromJwt(user) {
    var appR = user && user.app_metadata ? n(user.app_metadata.role) : '';
    if (appR === 'owner' || appR === 'admin' || appR === 'manager') return { kind: 'staff_full', role: appR, source: 'jwt' };
    if (appR === 'seller') return { kind: 'staff_seller', role: 'seller', source: 'jwt' };
    if (appR === 'artist' || appR === 'dj' || appR === 'talent') return { kind: 'artist', role: 'artist', source: 'jwt' };
    return null;
  }
  function accessKindFromSnapshot(snap) {
    if (!snap || snap.ok !== true) return null;
    var pk = n(snap.profile_kind), role = n(snap.role);
    if (pk === 'staff_full') return { kind: 'staff_full', role: role || 'admin', source: 'snapshot' };
    if (pk === 'staff_seller') return { kind: 'staff_seller', role: 'seller', source: 'snapshot' };
    if (pk === 'artist') return { kind: 'artist', role: 'artist', source: 'snapshot' };
    if (pk === 'buyer') return { kind: 'buyer', role: 'client', source: 'snapshot' };
    return null;                                              /* 'unknown' (sin filas todavía): no decide */
  }
  function mdjResolveAccessKind(db, user, opts) {
    var ms = (opts && opts.timeoutMs) || 2500;
    var viaJwt = accessKindFromJwt(user);
    if (viaJwt) return Promise.resolve(viaJwt);
    function fallback() {
      var appR = user && user.app_metadata ? n(user.app_metadata.role) : '';
      return appR === 'client' ? { kind: 'buyer', role: 'client', source: 'jwt' } : { kind: 'unknown', role: '', source: 'none' };
    }
    if (!db || typeof db.rpc !== 'function') return Promise.resolve(fallback());
    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () { if (!done) { done = true; resolve(fallback()); } }, ms);
      try {
        Promise.resolve(db.rpc('mdj_access_snapshot')).then(function (r) {
          if (done) return; done = true; clearTimeout(timer);
          resolve(accessKindFromSnapshot(r && !r.error ? r.data : null) || fallback());
        }, function () { if (done) return; done = true; clearTimeout(timer); resolve(fallback()); });
      } catch (e) { if (!done) { done = true; clearTimeout(timer); resolve(fallback()); } }
    });
  }
  /* TABLA CANÓNICA DE DESTINOS (decisión del PO, 2026-10-06): a dónde va cada edificio tras iniciar sesión o cuando una página no es suya.
     La usan el login (auth.js → mdjPerformPostAuthRedirect) y role-guard.js; ya no hay otra tabla de «hogares» en esos dos lugares.
       staff (owner, admin, manager, seller) → su ficha dentro de Staff        artista (artist, dj, talent) → su estación
       cliente                                → su portal                      cuenta sin perfil / incompleta → account-profile (que redirige a Configuración) */
  var BUILDING_HOME = Object.freeze({
    staff:    './staff.html?vista=miperfil',
    artist:   './dj-dashboard.html',
    buyer:    './client-portal.html',
    fallback: './account-profile.html'
  });
  function mdjBuildingHome(kind) {
    var k = n(kind);
    if (k === 'staff_full' || k === 'staff_seller' || k === 'staff') return BUILDING_HOME.staff;
    if (k === 'artist') return BUILDING_HOME.artist;
    if (k === 'buyer') return BUILDING_HOME.buyer;
    return BUILDING_HOME.fallback;
  }
  /* Igual que mdjBuildingHome pero a partir de un ROL suelto (JWT / dj_profiles.role / data-mdj-nav-role): para las cabeceras, que muchas veces saben el rol y no la sesión. */
  function mdjBuildingHomeForRole(role) {
    var r = n(role);
    if (r === 'owner' || r === 'admin' || r === 'manager' || r === 'management' || r === 'seller' || r === 'staff') return BUILDING_HOME.staff;
    if (r === 'artist' || r === 'dj' || r === 'talent') return BUILDING_HOME.artist;
    if (r === 'client' || r === 'cliente' || r === 'buyer') return BUILDING_HOME.buyer;
    return BUILDING_HOME.fallback;
  }
  g.MDJ_BUILDING_HOME = BUILDING_HOME;
  g.mdjBuildingHome = mdjBuildingHome;
  g.mdjBuildingHomeForRole = mdjBuildingHomeForRole;
  g.mdjResolveAccessKind = mdjResolveAccessKind;
  g.mdjAccessKindFromSnapshot = accessKindFromSnapshot;
  g.mdjAccessKindFromJwt = accessKindFromJwt;
})(typeof window !== 'undefined' ? window : global);
