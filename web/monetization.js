/**
 * Miami DJ Beat — Referral capture, commissions (10%), Soundfortip split (10% / 90%).
 * Pair with web/sql/migrations/12_monetization_referral_commissions.sql
 */
(function (global) {
    'use strict';

    var REF_KEY = 'mdb_referral_dj_id';
    var REF_CODE_KEY = 'mdb_referral_code';
    var PLATFORM_TIP_BPS = 1000; // 10.00%
    var REFERRAL_FIRST_PURCHASE_BPS = 1000; // 10% to referring DJ

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

    /** First purchase via referral: 10% commission to DJ (cents). */
    function referralCommissionFromGross(grossCents) {
        var g = Math.max(0, Math.floor(Number(grossCents) || 0));
        return Math.floor((g * REFERRAL_FIRST_PURCHASE_BPS) / 10000);
    }

    /** Payload for checkout / Edge Function (extend when Stripe is wired). */
    function buildPurchaseAttributionPayload(orderRef, grossCents) {
        var refDj = getStoredReferralDjId();
        return {
            order_ref: orderRef,
            gross_cents: grossCents,
            referral_dj_user_id: refDj,
            referral_commission_cents: refDj ? referralCommissionFromGross(grossCents) : 0
        };
    }

    /** Saldo retirable: prioriza wallet_balance (migración), luego rewards/referral credits. */
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

    /** Logout seguro: quita ref persistente (?ref=BOSS305, rcode) y tokens locales legados. */
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
        captureReferralFromQuery: captureReferralFromQuery,
        getStoredReferralDjId: getStoredReferralDjId,
        soundfortipSplit: soundfortipSplit,
        referralCommissionFromGross: referralCommissionFromGross,
        buildPurchaseAttributionPayload: buildPurchaseAttributionPayload,
        formatDjWalletUsd: formatDjWalletUsd,
        clearClientStorageOnLogout: mdjClearClientStorageOnLogout
    };
})(typeof window !== 'undefined' ? window : globalThis);
