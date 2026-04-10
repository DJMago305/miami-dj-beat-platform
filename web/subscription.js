/**
 * Miami DJ Beat — Subscription & tier helpers (client-side).
 * DB source of truth: dj_profiles.is_premium, plan_type, plan_status, subscription_status.
 * Pair with web/sql/migrations/10_subscription_hwid_wallet.sql
 */
(function (global) {
    'use strict';

    var PRO_PLAN_TYPES = ['pro_monthly', 'pro_annual', 'PRO'];

    function isPlanActive(p) {
        if (!p) return false;
        var status = (p.plan_status || 'inactive').toLowerCase();
        if (status !== 'active') return false;
        if (p.plan_expires_at) {
            try {
                return new Date(p.plan_expires_at) > new Date();
            } catch (e) {
                return false;
            }
        }
        return true;
    }

    /**
     * Premium = explicit is_premium OR active PRO subscription fields.
     * @param {object|null} row - dj_profiles row
     */
    function isPremiumTier(row) {
        if (!row) return false;
        if (row.is_premium === true) return true;
        var sub = (row.subscription_status || '').toLowerCase();
        if (sub === 'active' || sub === 'trialing') return true;
        if (PRO_PLAN_TYPES.indexOf(row.plan_type) !== -1 && isPlanActive(row)) return true;
        return false;
    }

    /**
     * Free tier: not premium (limited profile / tools in UI).
     */
    function isFreeTier(row) {
        return !isPremiumTier(row);
    }

    /**
     * Sort key for search: higher = show first. Premium first, then alphabetical tie-break.
     * @param {object} row - dj_profiles row with dj_name or stage_name
     */
    function searchRankScore(row) {
        var base = isPremiumTier(row) ? 1e9 : 0;
        var name = (row.stage_name || row.dj_name || '').toLowerCase();
        var tie = 0;
        for (var i = 0; i < Math.min(name.length, 8); i++) {
            tie = (tie * 31 + name.charCodeAt(i)) >>> 0;
        }
        return base + (tie % 100000);
    }

    /**
     * Label for header CTA: "Obtener PRO" vs "Plan Pro".
     */
    function proButtonLabel(row, i18nGetPro, i18nPlanPro) {
        var getPro = i18nGetPro || 'Obtener PRO';
        var planPro = i18nPlanPro || 'Plan Pro';
        return isPremiumTier(row) ? planPro : getPro;
    }

    /**
     * Generate a new hardware activation token (call from Edge Function after payment;
     * browser should not persist raw secret — this is for server-side or admin tools).
     */
    function generateActivationToken() {
        var a = new Uint8Array(16);
        if (global.crypto && global.crypto.getRandomValues) {
            global.crypto.getRandomValues(a);
        } else {
            for (var i = 0; i < 16; i++) a[i] = Math.floor(Math.random() * 256);
        }
        var hex = Array.prototype.map.call(a, function (b) {
            return ('0' + b.toString(16)).slice(-2);
        }).join('');
        return 'MDB-' + hex.toUpperCase();
    }

    /**
     * Lee hardware_token del perfil (Supabase). Solo UI; la verdad sigue en la fila dj_profiles.
     */
    function getHardwareActivationTokenFromProfile(row) {
        if (!row) return null;
        var t = row.hardware_token;
        if (t == null || String(t).trim() === '') return null;
        return String(t).trim();
    }

    global.MDB_SUBSCRIPTION = {
        isPremiumTier: isPremiumTier,
        isFreeTier: isFreeTier,
        searchRankScore: searchRankScore,
        proButtonLabel: proButtonLabel,
        generateActivationToken: generateActivationToken,
        getHardwareActivationTokenFromProfile: getHardwareActivationTokenFromProfile,
        PRO_PLAN_TYPES: PRO_PLAN_TYPES
    };
})(typeof window !== 'undefined' ? window : globalThis);
