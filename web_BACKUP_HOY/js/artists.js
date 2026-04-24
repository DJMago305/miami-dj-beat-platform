/**
 * Miami DJ Beat — Artist roster helpers (public hub + subscription truth).
 * Uses `public_dj_profiles` (same security model as find-dj.html) and MDB_SUBSCRIPTION for tiers.
 */
(function (global) {
    'use strict';

    function trimStr(v) {
        return v == null ? '' : String(v).trim();
    }

    function isRealPhotoUrl(url) {
        var u = trimStr(url);
        if (!u) return false;
        if (/placeholder|dj-avatar-placeholder\.png/i.test(u)) return false;
        return /^https?:\/\//i.test(u) || u.indexOf('data:image/') === 0;
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

    function rowHasListingPrice(row) {
        if (!row || typeof row !== 'object') return false;
        var keys = [
            'hourly_rate_usd',
            'starting_price_usd',
            'base_rate_usd',
            'min_booking_usd',
            'rate_floor_usd',
            'booking_base_usd'
        ];
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (row[k] == null) continue;
            var n = Number(row[k]);
            if (!isNaN(n) && n > 0) return true;
        }
        return false;
    }

    /**
     * Minimum viable public listing for Rentals talent hub (bio, photo, roles/equipment, commercial signal).
     * @param {object|null} row
     */
    function isProfileCompleteForRentalsHub(row) {
        if (!row) return false;
        var name = trimStr(row.stage_name);
        if (name.length < 2) return false;
        if (!isRealPhotoUrl(row.photo_url)) return false;
        var bio = trimStr(row.bio_short);
        if (bio.length < 24) return false;
        var roles = trimStr(row.roles);
        if (roles.length < 2) return false;

        var tier = getSubscriptionTier(row);
        if (tier === 'pro' || tier === 'elite') return true;
        if (rowHasListingPrice(row)) return true;
        /* LITE: allow long-form list copy when no rate columns are exposed on the public view. */
        if (bio.length >= 80) return true;
        return false;
    }

    /**
     * @returns {Promise<Array<object>>}
     */
    async function fetchPublicProfilesForHub(sb) {
        if (!sb || !sb.from) return [];
        var selFull =
            'user_id, dj_slug, stage_name, photo_url, bio_short, city, roles, artist_specialty, plan, plan_type, plan_status, plan_expires_at, is_premium, subscription_status, hourly_rate_usd, starting_price_usd, base_rate_usd, min_booking_usd, rate_floor_usd, booking_base_usd';
        var selMid =
            'user_id, dj_slug, stage_name, photo_url, bio_short, city, roles, artist_specialty, plan, plan_type, plan_status, plan_expires_at, is_premium, subscription_status, hourly_rate_usd';
        var selMin = 'dj_slug, stage_name, photo_url, bio_short, city, roles, plan, plan_type, plan_status, plan_expires_at, is_premium, subscription_status';

        var res = await sb.from('public_dj_profiles').select(selFull).eq('available', true).limit(160);
        if (res.error) res = await sb.from('public_dj_profiles').select(selMid).eq('available', true).limit(160);
        if (res.error) res = await sb.from('public_dj_profiles').select(selMin).eq('available', true).limit(160);

        var raw = (res && res.data) || [];
        if (res && res.error) {
            try {
                console.warn('[MDJ_ARTISTS] public_dj_profiles:', res.error.message || res.error);
            } catch (e) {
                void e;
            }
        }

        var filtered = raw.filter(isProfileCompleteForRentalsHub);
        if (global.MDB_SUBSCRIPTION && typeof global.MDB_SUBSCRIPTION.searchRankScore === 'function') {
            filtered.sort(function (a, b) {
                return global.MDB_SUBSCRIPTION.searchRankScore(b) - global.MDB_SUBSCRIPTION.searchRankScore(a);
            });
        }
        return filtered.slice(0, 12);
    }

    function escapeAttr(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;');
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function whenSupabaseReady(cb, tries) {
        tries = tries || 50;
        var sb = typeof global.getSupabaseClient === 'function' ? global.getSupabaseClient() : null;
        if (sb) return cb(sb);
        if (tries <= 0) return cb(null);
        setTimeout(function () {
            whenSupabaseReady(cb, tries - 1);
        }, 40);
    }

    /**
     * Append vetted DJ cards into the talent hub track (call before infinite carousel init).
     * @returns {Promise<void>}
     */
    function hydrateRentalsTalentHubCarousel() {
        var track = document.querySelector('#talent-selector-modal .talent-selector-carousel');
        if (!track || track.dataset.mdjArtistsHydrated === '1') return Promise.resolve();

        return new Promise(function (resolve) {
            whenSupabaseReady(function (sb) {
                if (!sb) {
                    try {
                        console.warn('[MDJ_ARTISTS] Supabase client not ready; skip hub artists');
                    } catch (e) {
                        void e;
                    }
                    track.dataset.mdjArtistsHydrated = '1';
                    resolve();
                    return;
                }
                void doHydrate(track, sb, resolve);
            });
        });
    }

    function doHydrate(track, sb, resolve) {

        fetchPublicProfilesForHub(sb)
            .then(function (rows) {
                if (!rows.length) {
                    track.dataset.mdjArtistsHydrated = '1';
                    resolve();
                    return;
                }

                rows.forEach(function (row) {
            var uid = trimStr(row.user_id);
            var slug = trimStr(row.dj_slug);
            var href = uid
                ? './dj-profile.html?id=' + encodeURIComponent(uid)
                : slug
                  ? './find-dj.html?q=' + encodeURIComponent(slug)
                  : './find-dj.html';
            var title = trimStr(row.stage_name) || 'DJ';
            var bio = trimStr(row.bio_short).slice(0, 140);
            var tier = getSubscriptionTier(row);
            var badge =
                tier === 'elite'
                    ? '<span style="display:inline-block;margin:6px 0 0;font-size:9px;font-weight:800;letter-spacing:0.12em;color:rgba(197,160,89,0.95);text-transform:uppercase;">ELITE</span>'
                    : tier === 'pro'
                      ? '<span style="display:inline-block;margin:6px 0 0;font-size:9px;font-weight:800;letter-spacing:0.12em;color:rgba(197,160,89,0.85);text-transform:uppercase;">PRO</span>'
                      : '';

            var card = document.createElement('a');
            card.className = 'talent-cat-card hero-glass-card mdj-rentals-public-dj';
            card.href = href;
            card.setAttribute('tabindex', '0');
            card.setAttribute('data-mdj-public-dj', '1');
            card.setAttribute('data-talent-hero-src', './assets/DJ_Performance/weddings_quinces.mp4');
            card.innerHTML =
                '<div class="hero-card-emoji" aria-hidden="true">🎧</div>' +
                '<h3 class="hero-card-title">' +
                escapeHtml(title) +
                '</h3>' +
                badge +
                '<p class="hero-card-text">' +
                escapeHtml(bio) +
                '</p>' +
                '<span class="mdj-talent-card-enter">Profile</span>';
                    track.appendChild(card);
                });

                track.dataset.mdjArtistsHydrated = '1';
                resolve();
            })
            .catch(function (err) {
                try {
                    console.warn('[MDJ_ARTISTS] fetchPublicProfilesForHub', err && err.message ? err.message : err);
                } catch (e2) {
                    void e2;
                }
                track.dataset.mdjArtistsHydrated = '1';
                resolve();
            });
    }

    /**
     * Registro de artista: URL canónica (signup talent + redirect al dashboard).
     */
    function getArtistRegistrationUrl() {
        return './login.html?signup=free&redirect=dj-dashboard';
    }

    /**
     * Pro/Elite: la verdad de cobro sigue en Stripe/checkout; esto enlaza al flujo de planes en Jobs.
     */
    function getSubscriptionPlansUrl() {
        return './jobs.html#selection-screen';
    }

    /**
     * Guarda bio, especialidad, precio/hora en `public.dj_profiles` (sesión artista).
     * `subscription_tier` solo guarda intención en sessionStorage; no activa cobro.
     * @param sb Supabase client from getSupabaseClient()
     * @param opts bio, bio_short, specialty, hourly_rate_usd, subscription_tier (intent only)
     */
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
        isProfileCompleteForRentalsHub: isProfileCompleteForRentalsHub,
        fetchPublicProfilesForHub: fetchPublicProfilesForHub,
        hydrateRentalsTalentHubCarousel: hydrateRentalsTalentHubCarousel,
        getArtistRegistrationUrl: getArtistRegistrationUrl,
        getSubscriptionPlansUrl: getSubscriptionPlansUrl,
        saveArtistOnboardingProfile: saveArtistOnboardingProfile
    };
})(typeof window !== 'undefined' ? window : globalThis);
