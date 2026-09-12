// web/supabase-config.js
// IMPORTANT: anon key only (safe for browser). NEVER put service_role here.
// Un solo origen de proyecto → Storage y Edge Functions se derivan de MDB_SUPABASE_URL.

/**
 * FIX-REVEALTEXT-BLUR-02 (2026-09-09): marca `mdj-legacy-gpu` en <html> para
 * navegadores viejos (misma sonda de sintaxis moderna que ya usa el sitio,
 * ej. documents/event-blueprint-editor.html) -- reusada aqui como proxy de
 * "GPU/motor limitado", no de sintaxis en si. Contraparte de
 * FIX-REVEALTEXT-BLUR-01 (2026-09-08, quito el blur ANIMADO del titulo de
 * index.html): las tarjetas "Consultar Disponibilidad" de rentals.html/
 * services.html (`.glass-card`) tienen `backdrop-filter: blur(20px)`
 * PERMANENTE mientras se animan con opacity/transform (`revealText`) al
 * cargar -- misma combinacion de riesgo (confirmada real en iMac 2011,
 * Radeon HD 6970M) que deja el elemento atascado en opacity:0 (invisible)
 * en vez de completar la animacion, de forma intermitente entre recargas.
 * Ver `.mdj-legacy-gpu .glass-card` en styles.css.
 */
(function mdjLegacyGpuDetect() {
    try {
        var modernSyntaxOk = true;
        try { new Function('return (null)?.x ?? 1;'); } catch (eDetect) { modernSyntaxOk = false; }
        if (!modernSyntaxOk && document.documentElement) {
            document.documentElement.classList.add('mdj-legacy-gpu');
        }
    } catch (eOuter) { void eOuter; }
})();

/**
 * FIX-AUTH-LEGACY: polyfill de crypto.randomUUID() para Safari/WebKit < 15.4.
 * GoTrueClient (auth interno de supabase-js) lo usa al generar el estado del
 * flujo PKCE — sin él, createClient()/signIn* lanzan TypeError y el usuario
 * ve "Supabase no disponible" aunque el bundle sí haya cargado y parseado.
 * Debe correr ANTES de instanciar cualquier cliente, de ahí que viva al
 * inicio de este archivo (único punto de entrada de getSupabaseClient()).
 */
(function mdjCryptoRandomUUIDPolyfill() {
    try {
        if (typeof window === 'undefined') return;
        if (!window.crypto) window.crypto = {};
        if (typeof window.crypto.randomUUID === 'function') return;
        window.crypto.randomUUID = function () {
            var hasSubtleRandom = window.crypto && typeof window.crypto.getRandomValues === 'function';
            var bytes = new Uint8Array(16);
            if (hasSubtleRandom) {
                window.crypto.getRandomValues(bytes);
            } else {
                for (var i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
            }
            bytes[6] = (bytes[6] & 0x0f) | 0x40;
            bytes[8] = (bytes[8] & 0x3f) | 0x80;
            var hex = [];
            for (var j = 0; j < 256; j++) hex[j] = (j < 16 ? '0' : '') + j.toString(16);
            var b = bytes;
            return hex[b[0]] + hex[b[1]] + hex[b[2]] + hex[b[3]] + '-' +
                hex[b[4]] + hex[b[5]] + '-' + hex[b[6]] + hex[b[7]] + '-' +
                hex[b[8]] + hex[b[9]] + '-' +
                hex[b[10]] + hex[b[11]] + hex[b[12]] + hex[b[13]] + hex[b[14]] + hex[b[15]];
        };
    } catch (ePoly) {
        void ePoly;
    }
})();

/**
 * FIX-AUTH-LEGACY: adaptador de storage seguro para GoTrueClient. Safari en
 * modo privado / lockdown puede lanzar SecurityError con solo TOCAR
 * localStorage (no solo al llenarse la cuota) — createClient() lo prueba al
 * construirse. Se sondea una vez; si falla, todo el sitio usa un Map en
 * memoria para esa pestaña (la sesión no persiste entre recargas, pero el
 * login dentro de la misma pestaña sigue funcionando en vez de romperse).
 */
function mdjSafeAuthStorage() {
    try {
        var probeKey = '__mdj_storage_probe__';
        window.localStorage.setItem(probeKey, '1');
        window.localStorage.removeItem(probeKey);
        return window.localStorage;
    } catch (eProbe) {
        void eProbe;
        var mem = {};
        return {
            getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
            setItem: function (k, v) { mem[k] = String(v); },
            removeItem: function (k) { delete mem[k]; }
        };
    }
}

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
    /* FIX-CORPORATE-STORAGE-01 (2026-09-08): corporate_featured.png/tipo06-corporate.png
       se movieron a esta carpeta el 2026-09-03 (ver assets/corporate/LEEME.txt) y nunca
       se re-subieron al bucket de Storage -- <img> normal (no <picture>) confirmado roto
       en TODO navegador, no solo Safari 13 (naturalWidth:0 incluso en Chrome). */
    if (/^corporate\/fotos\//i.test(rel)) return path;
    var segments = m[1].split("/").map(function (seg) {
        try {
            return encodeURIComponent(decodeURIComponent(seg));
        } catch (e) {
            return encodeURIComponent(seg);
        }
    });
    return String(base).replace(/\/?$/, "/") + segments.join("/") + query;
};

/**
 * FIX-VIDEO-PRELOAD-RACE-01 (2026-09-09): resuelve <source data-src="./assets/...">
 * a la URL real de Supabase recien en DOMContentLoaded, cuando MDB_ASSETS_URL ya
 * esta listo. Antes, estas etiquetas tenian la ruta relativa directo en `src` --
 * el parser/preloader del navegador la descarga de inmediato con
 * preload="metadata"/"auto" (esto es comportamiento normal de HTML5 video, no un
 * bug de Safari), muchisimo antes de que cualquier JS corra, cayendo siempre en
 * el propio dominio (miamidjbeat.com/assets/... = 404) en vez del bucket. `data-src`
 * no dispara fetch del navegador -- solo un atributo real `src` lo hace.
 *
 * FIX-VIDEO-EAGER-LOAD-CRASH-01 (2026-09-09): la primera version de este fix
 * resolvia y cargaba TODOS los data-src de golpe en DOMContentLoaded -- eso
 * arreglo la URL, pero en rentals.html/services.html hay ~10 <video> compartiendo
 * la pagina (varios modales ocultos + el catalogo dinamico). Antes, con la URL
 * mala, cada uno fallaba al instante (404) sin gastar memoria real. Ahora que la
 * URL es correcta, todos intentaban descargar y decodificar en paralelo apenas
 * cargaba la pagina -- confirmado real en Mac vieja: "A problem repeatedly
 * occurred" (crash reincidente, peor que el crash unico original). Se cambia a
 * IntersectionObserver: cada <video> solo se resuelve/carga cuando su elemento
 * realmente entra en el viewport -- que para uno dentro de un modal con
 * `display:none` no pasa hasta que ese modal se abre de verdad. El hero visible
 * de una landing (club-dj.html, etc.) intersecta de inmediato, mismo
 * comportamiento que antes.
 */
var mdjVideoLazyLoadObserver = null;
var mdjResolveOneVideoSource = null;

function mdjResolveDeferredVideoSources() {
    try {
        var sources = document.querySelectorAll("source[data-src]");
        if (!sources.length) return;

        mdjResolveOneVideoSource = function (source) {
            if (source.dataset.mdjSrcResolved === "1") return;
            source.dataset.mdjSrcResolved = "1";
            var resolved = window.resolveMdAssetPublicUrl(source.getAttribute("data-src"));
            source.setAttribute("src", resolved);
            var videoEl = source.closest("video");
            if (!videoEl) return;
            videoEl.load();
            /* mdjActivateVideo en vez de dejar el autoplay nativo solo: asi este video
               tambien entra en la exclusion mutua (un solo video reproduciendose a la
               vez en toda la pestaña), no solo los que llaman .play() explicito desde
               rentals.js. */
            if (typeof window.mdjActivateVideo === "function") {
                window.mdjActivateVideo(videoEl);
            }
        };

        if (typeof IntersectionObserver !== "function") {
            /* Sin soporte: mejor cargar todo que dejar el hero visible sin video. */
            sources.forEach(mdjResolveOneVideoSource);
            return;
        }

        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var target = entry.target;
                io.unobserve(target);
                var source = target.tagName === "SOURCE" ? target : target.querySelector("source[data-src]");
                if (source) mdjResolveOneVideoSource(source);
            });
        }, { rootMargin: "250px" });
        mdjVideoLazyLoadObserver = io;

        sources.forEach(function (source) {
            io.observe(source.closest("video") || source);
        });
    } catch (eDeferredSrc) { void eDeferredSrc; }
}
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mdjResolveDeferredVideoSources);
} else {
    mdjResolveDeferredVideoSources();
}

/**
 * TICKET-VIDEO-LIFECYCLE-01 (2026-09-09), a pedido explicito del PO: la web debe
 * ser ligera en CUALQUIER hardware (no solo Mac vieja) -- un solo video activo a
 * la vez en toda la pestaña (exclusion mutua real, un solo decoder trabajando),
 * y al cerrar el modal que lo contiene, el video se pausa, resetea y DESCARGA
 * (no solo se pausa) para no dejar memoria de decoder ocupada sin necesidad.
 */

/** Resuelve de inmediato el <source data-src> de `videoEl` si el IntersectionObserver
 * todavia no le tocaba el turno (ej. se activa por codigo antes de que el navegador
 * termine de calcular que ya es visible) -- evita la carrera src-no-listo-todavia. */
window.mdjEnsureVideoResolved = function (videoEl) {
    if (!videoEl) return false;
    try {
        var source = videoEl.querySelector("source[data-src]");
        if (source && source.dataset.mdjSrcResolved !== "1" && typeof mdjResolveOneVideoSource === "function") {
            if (mdjVideoLazyLoadObserver) mdjVideoLazyLoadObserver.unobserve(videoEl);
            mdjResolveOneVideoSource(source);
            return true; /* recien se resolvio/llamo .load() ahora mismo */
        }
    } catch (eEnsure) { void eEnsure; }
    return false;
};

/** Reproduce `videoEl` y pausa cualquier otro que estuviera activo. Usar en vez de videoEl.play() directo. */
window.mdjActivateVideo = function (videoEl) {
    if (!videoEl) return;
    window.mdjEnsureVideoResolved(videoEl);
    try {
        if (window.mdjActiveVideoEl && window.mdjActiveVideoEl !== videoEl) {
            window.mdjActiveVideoEl.pause();
        }
    } catch (eDeactivate) { void eDeactivate; }
    window.mdjActiveVideoEl = videoEl;
    videoEl.play().catch(function () { /* autoplay bloqueado o video sin src todavia: ignorar */ });
    /* Un .load() (propio o de quien resolvio el data-src momentos antes) puede dejar
       el elemento en un estado que rechaza el .play() de arriba en silencio -- red de
       seguridad: reintentar una vez que el navegador confirme datos reales, sin costo
       si ya estaba reproduciendo (.play() sobre un video en marcha es un no-op). */
    videoEl.addEventListener("loadeddata", function retryPlay() {
        if (window.mdjActiveVideoEl === videoEl) {
            videoEl.play().catch(function () { /* ignorar */ });
        }
    }, { once: true });
};

/** Pausa y resetea `videoEl` sin descargarlo (para cuando otro video toma el foco dentro del mismo modal). */
window.mdjDeactivateVideo = function (videoEl) {
    if (!videoEl) return;
    try {
        videoEl.pause();
        videoEl.currentTime = 0;
    } catch (ePause) { void ePause; }
    if (window.mdjActiveVideoEl === videoEl) window.mdjActiveVideoEl = null;
};

/** Descarga por completo `videoEl` (vuelve a data-src, libera el buffer decodificado) -- llamar al cerrar su modal. */
window.mdjUnloadVideo = function (videoEl) {
    if (!videoEl) return;
    window.mdjDeactivateVideo(videoEl);
    try {
        var source = videoEl.querySelector("source[data-src]");
        if (source && source.hasAttribute("src")) {
            source.removeAttribute("src");
            delete source.dataset.mdjSrcResolved;
            videoEl.removeAttribute("src");
            videoEl.load();
            if (mdjVideoLazyLoadObserver) mdjVideoLazyLoadObserver.observe(videoEl);
        }
    } catch (eUnload) { void eUnload; }
};

/** Descarga TODOS los <video data-src> dentro de `container` (modal que se acaba de cerrar). */
window.mdjUnloadVideosIn = function (container) {
    if (!container || !container.querySelectorAll) return;
    try {
        container.querySelectorAll("video").forEach(window.mdjUnloadVideo);
    } catch (eUnloadAll) { void eUnloadAll; }
};

/** @deprecated Usar resolveMdAssetPublicUrl; se mantiene por compatibilidad con rentals.js y el resto del sitio. */
window.resolveMdAssetVideoUrl = window.resolveMdAssetPublicUrl;

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
            /* FIX-PICTURE-FALLBACK-01 (2026-09-08): el <img> de respaldo dentro de
               un <picture> (patron Safari-13/.webp, ver quinceanera.html y demas)
               debe quedarse en la ruta relativa servida por Vercel/Git -- reescribirlo
               al bucket de Storage rompe el fallback en cualquier navegador que caiga
               a este <img> (sin soporte .webp), porque esos archivos nunca se suben
               a Storage, solo viven en el repo. El <source srcset> de al lado nunca
               pasa por aqui (esta funcion no toca srcset), asi que los navegadores
               con soporte .webp jamas veian este bug -- por eso pasó inadvertido. */
            if (el.closest("picture")) return;
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
function mdjResolveSupabaseLib() {
    return (typeof window.supabase !== 'undefined' &&
        window.supabase &&
        typeof window.supabase.createClient === 'function')
        ? window.supabase
        : null;
}
window.__mdbSupabaseLib = mdjResolveSupabaseLib();

/**
 * P2.1 — Failsafe Safari/WebKit legacy: en algunos motores el CDN no define
 * window.supabase a tiempo (o nunca). Antes, getSupabaseClient() no reintentaba
 * nada por sí sola — el único reintento vivía en llamadores externos (ej.
 * waitForSupabase() en auth.js, 10 intentos), y CADA intento de CADA uno de
 * los ~87 llamadores de getSupabaseClient() en el sitio repetía el mismo
 * console.error sin freno: con varios pollers activos a la vez en la misma
 * carga de página, eso escalaba a miles de líneas.
 *
 * El reintento vive aquí, UNA sola vez, en segundo plano: máximo 5 intentos
 * de 200ms (~1s). getSupabaseClient() sigue siendo SÍNCRONA (no puede
 * volverse async sin tocar los ~87 llamadores existentes) — mientras el
 * reintento sigue en curso, simplemente devuelve null en silencio. El
 * console.error solo se emite UNA vez, si los 5 intentos se agotan.
 */
var _supabaseInitAttempts = 0;
var _supabaseInitMaxAttempts = 5;
var _supabaseInitDelayMs = 200;
window.__mdbSupabaseInitFailed = false;

function mdjTrySupabaseInit() {
    window.__mdbSupabaseLib = mdjResolveSupabaseLib();
    if (window.__mdbSupabaseLib) return; // listo, no hace falta seguir
    _supabaseInitAttempts++;
    if (_supabaseInitAttempts >= _supabaseInitMaxAttempts) {
        window.__mdbSupabaseInitFailed = true;
        console.error(
            '[supabase-config] @supabase/supabase-js no definió window.supabase tras ' +
            _supabaseInitAttempts + ' intentos (~' + (_supabaseInitAttempts * _supabaseInitDelayMs) +
            'ms). Probable incompatibilidad del motor JS (Safari/WebKit antiguo) con el bundle del CDN.'
        );
        return;
    }
    setTimeout(mdjTrySupabaseInit, _supabaseInitDelayMs);
}
if (!window.__mdbSupabaseLib) {
    setTimeout(mdjTrySupabaseInit, _supabaseInitDelayMs);
}

// Singleton — mismo cliente para todo el sitio. getSupabaseClient() debe poder llamarse tras cargar el CDN en <head>.
let _supabaseClient = null;
window.getSupabaseClient = function () {
    if (_supabaseClient) return _supabaseClient;
    var lib = window.__mdbSupabaseLib || mdjResolveSupabaseLib();
    if (!lib || typeof lib.createClient !== 'function') {
        // Sin spam: si el reintento de arriba sigue en curso, null es el estado
        // normal y esperado; el único console.error vive en mdjTrySupabaseInit,
        // una vez, cuando los 5 intentos se agotan de verdad.
        return null;
    }
    // FIX-AUTH-LEGACY: createClient() puede lanzar en motores viejos (storage
    // bloqueado, crypto.randomUUID ausente sin el polyfill de arriba, etc.) —
    // antes esa excepción escapaba sin capturar a cada uno de los ~87
    // llamadores de getSupabaseClient() en el sitio.
    try {
        _supabaseClient = lib.createClient(window.MDB_SUPABASE_URL, window.MDB_SUPABASE_ANON_KEY, {
            auth: { storage: mdjSafeAuthStorage() }
        });
    } catch (eCreate) {
        console.error('[supabase-config] createClient() falló (motor legacy):', eCreate);
        return null;
    }
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
