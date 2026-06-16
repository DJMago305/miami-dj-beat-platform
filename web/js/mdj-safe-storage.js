/**
 * mdj-safe-storage.js  v1.0 — 2026-06-16
 * Safe wrapper around localStorage that silently degrades in:
 *   - Safari Private Browsing (throws SecurityError on any access)
 *   - Storage quota exceeded (throws QuotaExceededError on setItem)
 *   - Environments without localStorage (workers, some iframes)
 *
 * Usage:
 *   mdjStorage.get('key')              → value or null
 *   mdjStorage.get('key', 'fallback')  → value or fallback
 *   mdjStorage.set('key', 'value')     → true (ok) | false (failed)
 *   mdjStorage.remove('key')           → void
 */
(function (global) {
    'use strict';

    var _available = null;

    function isAvailable() {
        if (_available !== null) { return _available; }
        try {
            var test = '__mdj_ls_test__';
            global.localStorage.setItem(test, '1');
            global.localStorage.removeItem(test);
            _available = true;
        } catch (e) {
            _available = false;
        }
        return _available;
    }

    global.mdjStorage = {
        get: function (key, fallback) {
            if (!isAvailable()) { return (fallback !== undefined) ? fallback : null; }
            try {
                var val = global.localStorage.getItem(key);
                return (val !== null) ? val : (fallback !== undefined ? fallback : null);
            } catch (e) {
                return (fallback !== undefined) ? fallback : null;
            }
        },
        set: function (key, value) {
            if (!isAvailable()) { return false; }
            try {
                global.localStorage.setItem(key, value);
                return true;
            } catch (e) {
                return false;
            }
        },
        remove: function (key) {
            if (!isAvailable()) { return; }
            try { global.localStorage.removeItem(key); } catch (e) { void e; }
        },
        getJson: function (key, fallback) {
            var raw = this.get(key);
            if (raw === null) { return (fallback !== undefined) ? fallback : null; }
            try { return JSON.parse(raw); } catch (e) { return (fallback !== undefined) ? fallback : null; }
        },
        setJson: function (key, value) {
            try { return this.set(key, JSON.stringify(value)); } catch (e) { return false; }
        }
    };

}(window));
