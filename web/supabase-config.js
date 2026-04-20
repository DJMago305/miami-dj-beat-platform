// web/supabase-config.js
// IMPORTANT: anon key only (safe for browser). NEVER put service_role here.

window.MDB_SUPABASE_URL = "https://hkuvuqupbxwkiykxvqdr.supabase.co";
window.MDB_SUPABASE_ANON_KEY = "sb_publishable_IMhi16lHj2dAk51AdUOK8w_U7s89-Ff";

/**
 * Bucket público en Supabase Storage (**assets**): vídeos e imágenes bajo la misma jerarquía que `web/assets/`.
 * Si asignas "" aquí, el sitio usa solo rutas locales ./assets/... (sin Storage).
 * (con barra final). Objetos: misma ruta relativa que en web/assets (p. ej. audio/pa-small.jpg, DJ_Performance/foo.mp4).
 */
window.MDB_ASSETS_URL = "https://hkuvuqupbxwkiykxvqdr.supabase.co/storage/v1/object/public/assets/";

/**
 * Convierte ./assets/... en URL absoluta del bucket si MDB_ASSETS_URL está definido (vídeo, imagen u otro objeto).
 */
window.resolveMdAssetPublicUrl = function (path) {
    if (path == null || path === "") return path;
    if (typeof path !== "string") return path;
    var base = window.MDB_ASSETS_URL;
    if (!base || !String(base).trim()) return path;
    if (/^https?:\/\//i.test(path)) return path;
    var qIdx = path.indexOf("?");
    var query = qIdx >= 0 ? path.slice(qIdx) : "";
    var bare = qIdx >= 0 ? path.slice(0, qIdx) : path;
    var m = bare.match(/^\.\/assets\/(.+)$/);
    if (!m) return path;
    /* Identidad / placeholders: siguen en el deploy (Git), no forzar URL del bucket si aún no existen allí. */
    var rel = m[1];
    if (/^branding\//i.test(rel) || /^dj-avatar-placeholder\./i.test(rel)) return path;
    var segments = m[1].split("/").map(function (seg) {
        try {
            return encodeURIComponent(decodeURIComponent(seg));
        } catch (e) {
            return encodeURIComponent(seg);
        }
    });
    return String(base).replace(/\/?$/, "/") + segments.join("/") + query;
};

/** @deprecated Usar resolveMdAssetPublicUrl; se mantiene por compatibilidad con rentals.js y el resto del sitio. */
window.resolveMdAssetVideoUrl = window.resolveMdAssetPublicUrl;

/** Misma regla que los vídeos: rutas `./assets/...` → URL pública del bucket `assets`. */
window.resolveMdAssetImageUrl = window.resolveMdAssetPublicUrl;

(function mdjBootstrapRemoteAssets() {
    function run() {
        if (typeof window.resolveMdAssetPublicUrl !== "function") return;
        if (!window.MDB_ASSETS_URL || !String(window.MDB_ASSETS_URL).trim()) return;
        var fn = window.resolveMdAssetPublicUrl;
        document.querySelectorAll("video[src]").forEach(function (el) {
            var s = el.getAttribute("src");
            if (s && s.indexOf("./assets/") === 0) el.src = fn(s);
        });
        document.querySelectorAll("source[src]").forEach(function (el) {
            var u = el.getAttribute("src");
            if (u && u.indexOf("./assets/") === 0) el.setAttribute("src", fn(u));
        });
        document.querySelectorAll("img[src]").forEach(function (el) {
            var is = el.getAttribute("src");
            if (is && is.indexOf("./assets/") === 0) el.src = fn(is);
        });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
    else run();
})();

/** Bandeja única de contacto: formularios, mailto y notificaciones deben apuntar aquí salvo excepción documentada. */
window.MDB_OFFICIAL_CONTACT_EMAIL = "miamidjbeat@gmail.com";

/** Formulario Formspree único (action= en HTML debe coincidir). Notificaciones en panel Formspree → correo oficial. */
window.MDJ_FORMSPREE_ENDPOINT = "https://formspree.io/f/mqakvjge";

// Lazy singleton — avoids race condition with CDN async load.
// Any script can call window.getSupabaseClient() to get the initialized client.
let _supabaseClient = null;
window.getSupabaseClient = function () {
    if (_supabaseClient) return _supabaseClient;
    const factory = (window.supabase && typeof window.supabase.createClient === 'function')
        ? window.supabase.createClient
        : null;
    if (!factory) {
        console.error('[supabase-config] supabase.createClient not available yet.');
        return null;
    }
    _supabaseClient = factory(window.MDB_SUPABASE_URL, window.MDB_SUPABASE_ANON_KEY);
    return _supabaseClient;
};
