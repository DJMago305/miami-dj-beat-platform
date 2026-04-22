/**
 * Identidad de plataforma (browser) — fuente: public.dj_profiles (rol) + auth.users metadata.
 * Alinear con Postgres: is_staff = admin|owner|manager|seller; gestión = admin|owner|manager; seller = vendedor.
 *
 * Principals:
 * - staff   → empleo operativo en dj_profiles (admin, owner, manager, seller)
 * - buyer   → explícitamente comprador (user_type client o fila client en dj)
 * - performer → talento/artista (cualquier otro dj_profiles no comprador, o sin fila y metadata talento)
 *
 * Verdad en API (gating, no mezclar cajas): public.mdj_access_snapshot() en Supabase; tiers comerciales: public.mdj_artist_commercial_tier(uid).
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
   * @param {{ user: object, djRow: object|null, clientRow: object|null }} o
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
    var dr = dj && dj.role != null ? n(dj.role) : '';
    var hasClientRow = !!(cr && (cr.user_id != null));
    var ut = u && u.user_metadata ? n(u.user_metadata.user_type) : '';
    var appR = u && u.app_metadata ? n(u.app_metadata.role) : '';
    var isExplicitClient = ut === 'client';
    var staffInDb = !!dr && STAFF[dr] === 1;
    var managementInDb = !!dr && MANAGEMENT[dr] === 1;
    var navStaffSolo = dr === 'seller';
    var principal;
    if (staffInDb) {
      principal = 'staff';
    } else if (isExplicitClient || dr === 'client' || (appR === 'client' && !dr)) {
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
