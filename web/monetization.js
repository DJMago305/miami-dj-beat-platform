/**
 * Miami DJ Beat — Referral capture, primera compra (descuento cliente + bono DJ), Soundfortip split.
 * Política (salvo campaña explícita de Miami DJ Beat):
 * - Cliente referido: hasta $30 de descuento solo en la primera compra con ?ref=.
 * - DJ referidor: $20 fijos si la primera compra elegible supera USD 500 (no es porcentaje).
 * Pair with web/sql/migrations/12_monetization_referral_commissions.sql
 */
(function (global) {
    'use strict';

    var REF_KEY = 'mdb_referral_dj_id';
    var REF_CODE_KEY = 'mdb_referral_code';
    var FIRST_ORDER_DONE_KEY = 'mdb_referral_first_order_done';
    var CLIENT_DISCOUNT_USED_KEY = 'mdb_client_referral_discount_used';
    var PLATFORM_TIP_BPS = 1000; // 10.00% plataforma en propinas SoundForTips

    /** Primera compra con ref: umbral para bono al DJ (centavos USD). */
    var REFERRAL_MIN_GROSS_CENTS = 50000; // $500.00

    /** Bono único al DJ referidor en esa primera compra si supera el umbral. */
    var REFERRAL_DJ_FIRST_BONUS_CENTS = 2000; // $20.00

    /** Descuento máximo al cliente en la primera compra referida (centavos). */
    var CLIENT_FIRST_REFERRAL_DISCOUNT_CENTS = 3000; // $30.00

    function isLikelyUuid(s) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s || '').trim());
    }

    function captureReferralFromQuery() {
        try {
            var q = new URLSearchParams(global.location.search);
            var ref = q.get('ref');
            if (ref && ref.length > 0) {
                ref = ref.trim();
                if (isLikelyUuid(ref)) {
                    global.localStorage.setItem(REF_KEY, ref);
                } else {
                    global.localStorage.setItem(REF_CODE_KEY, ref);
                    global.localStorage.setItem(REF_KEY, ref);
                }
            }
            var rcode = q.get('rcode');
            if (rcode && rcode.length > 0) {
                global.localStorage.setItem(REF_CODE_KEY, rcode.trim());
            }
            if (global.console && global.console.log && (ref || rcode)) {
                global.console.log(
                    '%c[MDB Monetización] Referral capturado',
                    'color:#c5a059;font-weight:800;letter-spacing:0.05em;',
                    {
                        paramRef: ref || null,
                        paramRcode: rcode || null,
                        localStorage_mdb_referral_dj_id: global.localStorage.getItem(REF_KEY),
                        localStorage_mdb_referral_code: global.localStorage.getItem(REF_CODE_KEY)
                    }
                );
            }
        } catch (e) {
            void e;
        }
    }

    function getStoredReferralDjId() {
        try {
            return global.localStorage.getItem(REF_KEY) || null;
        } catch (e) {
            return null;
        }
    }

    /** True si aún no marcamos la primera compra referida en este navegador (Edge/Stripe debe confirmar). */
    function isFirstReferralOrderPending() {
        try {
            return global.localStorage.getItem(FIRST_ORDER_DONE_KEY) !== '1';
        } catch (e) {
            return true;
        }
    }

    /**
     * Comisión al DJ referidor: $20 planos si gross >= $500 y es la primera compra atribuida.
     * @param {number} grossCents Subtotal elegible en centavos (USD).
     * @param {{ referringDjId?: string|null, isFirstReferralPurchase?: boolean }} [opts]
     */
    function referralCommissionFromGross(grossCents, opts) {
        opts = opts || {};
        var ref = opts.referringDjId != null ? opts.referringDjId : getStoredReferralDjId();
        if (!ref) return 0;
        if (opts.isFirstReferralPurchase === false) return 0;
        var g = Math.max(0, Math.floor(Number(grossCents) || 0));
        if (g < REFERRAL_MIN_GROSS_CENTS) return 0;
        return REFERRAL_DJ_FIRST_BONUS_CENTS;
    }

    /**
     * Descuento al cliente (primera compra con ref), salvo otra promo MDJ activa u opción explícita.
     * @param {{ otherPromotionOverridesReferral?: boolean }} [opts]
     */
    function clientReferralFirstPurchaseDiscountCents(opts) {
        opts = opts || {};
        if (opts.otherPromotionOverridesReferral) return 0;
        if (!getStoredReferralDjId()) return 0;
        try {
            if (global.localStorage.getItem(CLIENT_DISCOUNT_USED_KEY) === '1') return 0;
        } catch (e) {
            void e;
        }
        return CLIENT_FIRST_REFERRAL_DISCOUNT_CENTS;
    }

    function describeReferralPolicyLines() {
        return [
            'Política referidos MDJ (salvo campaña oficial distinta):',
            '- Cliente: hasta $30 de descuento solo la primera compra con enlace ?ref=.',
            '- DJ referidor: $20 si la primera compra elegible supera USD 500 (no acumulable por porcentaje).'
        ].join('\n');
    }

    /** Tip: platform 10%, artist 90% (amounts in cents, integers). */
    function soundfortipSplit(totalCents) {
        var gross = Math.max(0, Math.floor(Number(totalCents) || 0));
        var platformCents = Math.floor((gross * PLATFORM_TIP_BPS) / 10000);
        var artistCents = gross - platformCents;
        return {
            grossCents: gross,
            platformCents: platformCents,
            artistCents: artistCents,
            platformRate: PLATFORM_TIP_BPS / 10000,
            artistRate: 1 - PLATFORM_TIP_BPS / 10000
        };
    }

    /** Payload hacia checkout / Edge Function (Stripe). */
    function buildPurchaseAttributionPayload(orderRef, grossCents, options) {
        options = options || {};
        var refDj = getStoredReferralDjId();
        var firstPending =
            options.isFirstReferralPurchase !== false && isFirstReferralOrderPending();
        var commission = referralCommissionFromGross(grossCents, {
            referringDjId: refDj,
            isFirstReferralPurchase: firstPending
        });
        var clientDisc = clientReferralFirstPurchaseDiscountCents(options);
        return {
            order_ref: orderRef,
            gross_cents: Math.max(0, Math.floor(Number(grossCents) || 0)),
            referral_dj_user_id: refDj,
            referral_commission_cents: commission,
            client_referral_discount_cents: clientDisc,
            policy_version: '2026-04-11'
        };
    }

    function formatDjWalletUsd(row) {
        if (!row) return '$0.00';
        var w = row.wallet_balance;
        if (w == null || w === '') {
            w = row.rewards_balance != null ? row.rewards_balance : row.referral_credits;
        }
        var n = Number(w);
        if (isNaN(n)) return '$0.00';
        return '$' + n.toFixed(2);
    }

    function mdjClearClientStorageOnLogout() {
        try {
            global.localStorage.removeItem(REF_KEY);
            global.localStorage.removeItem(REF_CODE_KEY);
            global.localStorage.removeItem('user');
            global.localStorage.removeItem('token');
        } catch (e) {
            void e;
        }
    }

    global.mdjClearClientStorageOnLogout = mdjClearClientStorageOnLogout;

    global.MDB_MONETIZATION = {
        REF_STORAGE_KEY: REF_KEY,
        REF_CODE_STORAGE_KEY: REF_CODE_KEY,
        FIRST_ORDER_DONE_KEY: FIRST_ORDER_DONE_KEY,
        CLIENT_DISCOUNT_USED_KEY: CLIENT_DISCOUNT_USED_KEY,
        REFERRAL_MIN_GROSS_CENTS: REFERRAL_MIN_GROSS_CENTS,
        REFERRAL_DJ_FIRST_BONUS_CENTS: REFERRAL_DJ_FIRST_BONUS_CENTS,
        CLIENT_FIRST_REFERRAL_DISCOUNT_CENTS: CLIENT_FIRST_REFERRAL_DISCOUNT_CENTS,
        captureReferralFromQuery: captureReferralFromQuery,
        getStoredReferralDjId: getStoredReferralDjId,
        isFirstReferralOrderPending: isFirstReferralOrderPending,
        referralCommissionFromGross: referralCommissionFromGross,
        clientReferralFirstPurchaseDiscountCents: clientReferralFirstPurchaseDiscountCents,
        describeReferralPolicyLines: describeReferralPolicyLines,
        soundfortipSplit: soundfortipSplit,
        buildPurchaseAttributionPayload: buildPurchaseAttributionPayload,
        formatDjWalletUsd: formatDjWalletUsd,
        clearClientStorageOnLogout: mdjClearClientStorageOnLogout
    };
})(typeof window !== 'undefined' ? window : globalThis);
