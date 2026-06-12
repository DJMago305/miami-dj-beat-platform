/**
 * MDJB Academy — media catalog hydrator
 * Reads web/data/academy-media.json (export box → Supabase academy_media_assets).
 * HTML keeps data-academy-media / data-academy-hero-video keys; paths live in the JSON caja.
 */
(function () {
    'use strict';

    var CATALOG_URL = './data/academy-media.json';

    function resolveEntry(catalog, key) {
        if (!catalog || !key) return null;
        var parts = String(key).split('.');
        var node = catalog;
        for (var i = 0; i < parts.length; i++) {
            node = node && node[parts[i]];
        }
        if (!node || typeof node !== 'object') return null;
        return node.image_url || node.image_path || null;
    }

    function storagePublicUrl(relativePath) {
        var base = typeof window.MDB_ASSETS_URL === 'string' ? window.MDB_ASSETS_URL : '';
        if (!base || !relativePath) return null;
        return base + String(relativePath).split('/').map(encodeURIComponent).join('/');
    }

    function resolveHeroVideo(entry) {
        if (!entry || typeof entry !== 'object') return null;
        if (entry.video_url) return entry.video_url;
        var fromStorage = storagePublicUrl(entry.storage_path);
        if (fromStorage) return fromStorage;
        return entry.video_path || null;
    }

    function withVersion(src, version) {
        if (!src || !version) return src;
        var sep = src.indexOf('?') >= 0 ? '&' : '?';
        return src + sep + 'v=' + encodeURIComponent(version);
    }

    function hydrateFromCatalog(catalog) {
        var version = catalog.version || '';

        document.querySelectorAll('[data-academy-media]').forEach(function (el) {
            var key = el.getAttribute('data-academy-media');
            var src = resolveEntry(catalog, key);
            if (!src) return;
            el.src = withVersion(src, version);
        });

        document.querySelectorAll('[data-academy-hero-video]').forEach(function (el) {
            var key = el.getAttribute('data-academy-hero-video') || 'hero_video';
            var parts = String(key).split('.');
            var entry = catalog;
            for (var i = 0; i < parts.length; i++) {
                entry = entry && entry[parts[i]];
            }
            if (!entry || typeof entry !== 'object') {
                entry = catalog.hero_video;
            }
            var src = resolveHeroVideo(entry);
            if (!src) return;
            el.src = withVersion(src, version);
            var video = el.closest('video');
            if (video && typeof video.load === 'function') {
                if (catalog.hero_video && catalog.hero_video.poster_url) {
                    video.poster = withVersion(catalog.hero_video.poster_url, version);
                }
                video.load();
            }
        });
        document.querySelectorAll('[data-academy-media-bg]').forEach(function (el) {
            var key = el.getAttribute('data-academy-media-bg');
            var src = resolveEntry(catalog, key);
            if (!src) return;
            src = withVersion(src, version);
            el.style.backgroundImage =
                'linear-gradient(rgba(0,0,0,0.72),rgba(0,0,0,0.82)),url("' + src + '")';
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
        });
    }

    function loadCatalog() {
        var bust = CATALOG_URL + (CATALOG_URL.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
        return fetch(bust).then(function (res) {
            if (!res.ok) throw new Error('academy-media.json HTTP ' + res.status);
            return res.json();
        });
    }

    function shouldLoad() {
        return document.querySelector('[data-academy-media], [data-academy-hero-video], [data-academy-media-bg]');
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (!shouldLoad()) return;
        loadCatalog()
            .then(hydrateFromCatalog)
            .catch(function (err) {
                console.warn('[academy-media-loader]', err);
            });
    });
})();
