/**
 * Miami DJ Beat — Artist helpers (subscription tier, onboarding).
 */
(function (global) {
    'use strict';

    function trimStr(v) {
        return v == null ? '' : String(v).trim();
    }

    function planActive(row) {
        if (!row) return false;
        var st = String(row.plan_status || 'inactive').toLowerCase();
        if (st !== 'active') return false;
        if (row.plan_expires_at) {
            try {
                return new Date(row.plan_expires_at) > new Date();
            } catch (e) {
                return false;
            }
        }
        return true;
    }

    /**
     * @param {object|null} row - dj_profiles or public_dj_profiles row
     * @returns {'lite'|'pro'|'elite'}
     */
    function getSubscriptionTier(row) {
        if (!row) return 'lite';
        var pl = String(row.plan || '').toUpperCase();
        if (pl === 'ELITE' && planActive(row)) return 'elite';
        if (global.MDB_SUBSCRIPTION && typeof global.MDB_SUBSCRIPTION.isPremiumTier === 'function') {
            if (global.MDB_SUBSCRIPTION.isPremiumTier(row)) {
                return pl === 'ELITE' ? 'elite' : 'pro';
            }
        }
        if (row.is_premium === true && planActive(row)) return 'pro';
        if ((pl === 'PRO' || pl === 'ELITE') && planActive(row)) return pl === 'ELITE' ? 'elite' : 'pro';
        return 'lite';
    }

    /**
     * Hub talent selector: category cards only (ENTRAR → dj-modal, etc.).
     * Strips any legacy injected public-DJ cards; does not load public_dj_profiles here.
     * @returns {Promise<void>}
     */
    function hydrateRentalsTalentHubCarousel() {
        var track = document.querySelector('#talent-selector-modal .talent-selector-carousel');
        if (!track || track.dataset.mdjArtistsHydrated === '1') return Promise.resolve();
        track.querySelectorAll('[data-mdj-public-dj], .mdj-rentals-public-dj').forEach(function (el) {
            el.remove();
        });
        track.dataset.mdjArtistsHydrated = '1';
        return Promise.resolve();
    }

    function getArtistRegistrationUrl() {
        return './login.html?signup=free&redirect=dj-dashboard';
    }

    function getSubscriptionPlansUrl() {
        return './jobs.html#selection-screen';
    }

    async function saveArtistOnboardingProfile(sb, opts) {
        opts = opts || {};
        if (!sb || !sb.auth) return { ok: false, error: 'no_client' };
        var sessionRes = await sb.auth.getSession();
        var session = sessionRes.data && sessionRes.data.session;
        if (!session || !session.user) return { ok: false, error: 'no_session' };
        var uid = session.user.id;

        var tier = trimStr(opts.subscription_tier).toLowerCase();
        if (tier === 'pro' || tier === 'elite') {
            try {
                sessionStorage.setItem('mdj_plan_intent', tier);
            } catch (e) {
                void e;
            }
        }

        var patch = {};
        if (opts.bio != null) patch.bio = trimStr(opts.bio) || null;
        if (opts.bio_short != null) patch.bio_short = trimStr(opts.bio_short) || null;
        var spec = trimStr(opts.specialty);
        if (spec) {
            patch.artist_specialty = spec;
            patch.roles = spec;
        }
        if (opts.hourly_rate_usd != null && opts.hourly_rate_usd !== '') {
            var n = Number(opts.hourly_rate_usd);
            if (!isNaN(n) && n >= 0) patch.hourly_rate_usd = n;
        }

        if (Object.keys(patch).length === 0) return { ok: true, skipped: true };

        var res = await sb.from('dj_profiles').update(patch).eq('user_id', uid).select('user_id');
        if (!res.error) return { ok: true, data: res.data };

        var fallback = {};
        if (patch.bio != null) fallback.bio = patch.bio;
        if (patch.bio_short != null) fallback.bio_short = patch.bio_short;
        if (patch.roles != null) fallback.roles = patch.roles;
        if (patch.hourly_rate_usd != null) fallback.hourly_rate_usd = patch.hourly_rate_usd;

        var res2 = await sb.from('dj_profiles').update(fallback).eq('user_id', uid).select('user_id');
        if (!res2.error) {
            try {
                console.warn('[MDJ_ARTISTS] saved without optional columns (run migration 20260418140000)');
            } catch (e) {
                void e;
            }
            return { ok: true, data: res2.data, partial: true };
        }
        return { ok: false, error: res2.error || res.error };
    }

    global.MDJ_ARTISTS = {
        getSubscriptionTier: getSubscriptionTier,
        hydrateRentalsTalentHubCarousel: hydrateRentalsTalentHubCarousel,
        getArtistRegistrationUrl: getArtistRegistrationUrl,
        getSubscriptionPlansUrl: getSubscriptionPlansUrl,
        saveArtistOnboardingProfile: saveArtistOnboardingProfile
    };
})(typeof window !== 'undefined' ? window : globalThis);
