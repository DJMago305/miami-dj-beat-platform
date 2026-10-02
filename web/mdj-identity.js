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
})(typeof window !== 'undefined' ? window : global);
