// web/supabase-config.js
// IMPORTANT: anon key only (safe for browser). NEVER put service_role here.
// Un solo origen de proyecto → Storage y Edge Functions se derivan de MDB_SUPABASE_URL.

/** Earliest auth boot mask — before paint of nav / owner-tabs on logged-in navigation. */
(function mdjAuthBootEarly() {
    try {
        if (typeof localStorage === 'undefined') return;
        var maybeSession = Object.keys(localStorage).some(function (k) {
            return k.indexOf('sb-') === 0 || k.indexOf('supabase') !== -1;
        });
        if (maybeSession && document.documentElement) {
            document.documentElement.classList.add('mdj-auth-resolving');
        }
    } catch (e) { /* ignore */ }
})();

(function mdjSupabaseEnv() {
    /* Project ref: …kxvqdr — debe coincidir con Supabase Dashboard → Settings → API (no confundir con …kvxqdr). */
    var B = "https://hkuvuqupbxwkiykxvqdr.supabase.co".replace(/\/$/, "");
    window.MDB_SUPABASE_URL = B;
    window.MDB_SUPABASE_ANON_KEY = "sb_publishable_IMhi16lHj2dAk51AdUOK8w_U7s89-Ff";
    /* Vídeos/imágenes: subidos al bucket público `assets` en Supabase (misma jerarquía que web/assets/). Fuente de verdad en producción. */
    window.MDB_ASSETS_URL = B + "/storage/v1/object/public/assets/";
    /**
     * Vacío: reels y galería (vía manifiesto) resuelven al bucket `assets` bajo eventos-venues-patrocinadores/…
     * La galería cuando lista Storage en `venue-photo-gallery.js` usa el bucket dedicado explícitamente.
     */
    window.MDB_EVENTOS_VENUES_URL = "";
})();

/** Origen del proyecto Supabase sin barra final (invoke Edge Functions, etc.). */
window.mdbSupabaseOrigin = function () {
    return window.MDB_SUPABASE_URL ? String(window.MDB_SUPABASE_URL).replace(/\/$/, "") : "";
};

/**
 * URL de una Edge Function por nombre (sin slash inicial).
 * Ej.: mdbSupabaseFunctionUrl('create-event-payment')
 */
window.mdbSupabaseFunctionUrl = function (name) {
    if (name == null || name === "") return "";
    var o = window.mdbSupabaseOrigin();
    if (!o) return "";
    var n = String(name).replace(/^\//, "");
    return o + "/functions/v1/" + n;
};

/**
 * Headers for browser fetch() → Edge Functions using the anon publishable key (public checkout paths).
 */
window.mdjSupabaseAnonInvokeHeaders = function () {
    var k = typeof window.MDB_SUPABASE_ANON_KEY === "string" ? window.MDB_SUPABASE_ANON_KEY : "";
    var h = { "Content-Type": "application/json" };
    if (!k) return h;
    h.Authorization = "Bearer " + k;
    h.apikey = k;
    return h;
};

/* Public artist profile + referral QR. dj-profile.html (LOCKED) reads this
   in mdjBuildPublicFanProfileUrl / buildMiamiPublicQrUrl — do not edit that file. */
window.MDB_QR_PROFILE_PATH = "/profile.html";

window.mdjFanPublicProfileUrl = function (djUserId, opts) {
    try {
        if (!djUserId) return "";
        var o = opts || {};
        var path = (typeof window.MDB_QR_PROFILE_PATH === "string" && window.MDB_QR_PROFILE_PATH.trim())
            ? window.MDB_QR_PROFILE_PATH.trim()
            : "/profile.html";
        if (path.charAt(0) === "/") path = path.slice(1);
        var u = new URL(path, window.location.href);
        var id = String(djUserId);
        u.searchParams.set("id", id);
        u.searchParams.set("ref", id);
        if (o.sftOpen) u.searchParams.set("sft_open", "1");
        if (o.sftDebug) u.searchParams.set("sft_debug", "1");
        return u.href;
    } catch (_) {
        return "";
    }
};

/** Instalador MDJPRO macOS (Storage público `installers/`). */
window.MDB_INSTALLER_MAC_PKG_URL =
    window.mdbSupabaseOrigin() + "/storage/v1/object/public/installers/MDJPRO_Installer.pkg";

(function mdjInstallerMacLinks() {
    function apply() {
        var u = window.MDB_INSTALLER_MAC_PKG_URL;
        if (!u) return;
        document.querySelectorAll('a[data-mdj-installer-mac="1"]').forEach(function (a) {
            a.setAttribute("href", u);
        });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
    else apply();
})();

/**
 * Resuelve ./assets/eventos-venues-patrocinadores/... → URL pública.
 * Con MDB_EVENTOS_VENUES_URL: bucket dedicado. Sin él: resolveMdAssetPublicUrl (prefijo eventos-venues-patrocinadores/ en bucket assets).
 */
window.resolveEventosVenuesPublicUrl = function (path) {
    if (path == null || path === "") return path;
    if (typeof path !== "string") return path;
    if (/^https?:\/\//i.test(path)) return path;
    /* Desarrollo local: los reels suelen estar solo en web/assets/…; sin esto el <video> pide Storage y falla hasta subir el .mp4 */
    try {
        if (typeof location !== "undefined" && location.hostname) {
            var h = String(location.hostname).toLowerCase();
            if (h === "localhost" || h === "127.0.0.1") return path;
        }
    } catch (e) { /* noop */ }
    if (window.MDJ_VENUE_REELS_FORCE_LOCAL === true) return path;
    var qIdx = path.indexOf("?");
    var query = qIdx >= 0 ? path.slice(qIdx) : "";
    var bare = qIdx >= 0 ? path.slice(0, qIdx) : path;
    var m = bare.match(/^\.\/assets\/eventos-venues-patrocinadores\/(.+)$/);
    if (!m) return path;
    var key = m[1];
    var dedicated = window.MDB_EVENTOS_VENUES_URL;
    if (dedicated && String(dedicated).trim()) {
        var segments = key.split("/").map(function (seg) {
            try {
                return encodeURIComponent(decodeURIComponent(seg));
            } catch (e) {
                return encodeURIComponent(seg);
            }
        });
        return String(dedicated).replace(/\/?$/, "/") + segments.join("/") + query;
    }
    if (typeof window.resolveMdAssetPublicUrl === "function") {
        return window.resolveMdAssetPublicUrl(path);
    }
    return path;
};

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
    // HARD BLOCK — cualquier cosa que contenga /weather/
    if (path && path.includes('/weather/')) return path;

    var rel = m[1];

    // fallback adicional por seguridad
    if (rel && rel.toLowerCase().startsWith('weather/')) return path;
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
        /* data-mdj-src: el navegador no pide el .mp4 en el origen hasta tener la URL de Storage (evita 404 en Vercel). */
        document.querySelectorAll("source[data-mdj-src]").forEach(function (el) {
            var s = el.getAttribute("data-mdj-src");
            if (s && s.indexOf("./assets/") === 0) {
                el.setAttribute("src", fn(s));
                el.removeAttribute("data-mdj-src");
            }
        });
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
            if (is && /weather\//i.test(is)) return;
            if (is && is.indexOf("./assets/") === 0) el.src = fn(is);
        });
        var hero = document.getElementById("home-hero-video");
        if (hero) {
            try {
                hero.load();
            } catch (e) {
                void e;
            }
        }
    }
    run();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
})();

/** Bandeja única de contacto: formularios, mailto y notificaciones deben apuntar aquí salvo excepción documentada. */
window.MDB_OFFICIAL_CONTACT_EMAIL = "miamidjbeat@gmail.com";

/** Formulario Formspree único (action= en HTML debe coincidir). Notificaciones en panel Formspree → correo oficial. */
window.MDJ_FORMSPREE_ENDPOINT = "https://formspree.io/f/mqakvjge";

(function mdjValidateSupabaseEnv() {
    var u = window.MDB_SUPABASE_URL;
    var k = window.MDB_SUPABASE_ANON_KEY;
    if (!u || !String(u).trim() || !k || !String(k).trim()) {
        console.error('[supabase-config] MDB_SUPABASE_URL o MDB_SUPABASE_ANON_KEY vacíos o indefinidos.');
    }
})();

/**
 * Namespace del bundle UMD `@supabase/supabase-js` (tiene .createClient).
 * En consola, window.supabase suele ser ESTO; la instancia devuelta por createClient es la que tiene .from / .auth / .rpc.
 */
window.__mdbSupabaseLib =
    typeof window.supabase !== 'undefined' &&
    window.supabase &&
    typeof window.supabase.createClient === 'function'
        ? window.supabase
        : null;

// Singleton — mismo cliente para todo el sitio. getSupabaseClient() debe poder llamarse tras cargar el CDN en <head>.
let _supabaseClient = null;
window.getSupabaseClient = function () {
    if (_supabaseClient) return _supabaseClient;
    var lib = window.__mdbSupabaseLib || window.supabase;
    if (!lib || typeof lib.createClient !== 'function') {
        console.error('[supabase-config] supabase.createClient no disponible (¿CDN @supabase/supabase-js antes de este archivo?)');
        return null;
    }
    _supabaseClient = lib.createClient(window.MDB_SUPABASE_URL, window.MDB_SUPABASE_ANON_KEY);
    return _supabaseClient;
};

/** Crea el cliente en cuanto termina este archivo, antes de scripts del body (Flow, agenda-engine, etc.). */
(function mdjEagerSupabaseClient() {
    try {
        if (typeof window.getSupabaseClient === 'function') {
            window.getSupabaseClient();
        }
    } catch (e) {
        console.error('[supabase-config] Inicialización eager falló:', e);
    }
})();
