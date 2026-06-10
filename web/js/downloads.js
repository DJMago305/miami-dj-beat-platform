/**
 * MDJPRO downloads — .pkg installer + Pro handoff (solo tras .pkg publicado).
 */

function mdbSupabaseFnUrl(name) {
    if (typeof window.mdbSupabaseFunctionUrl === 'function') {
        return window.mdbSupabaseFunctionUrl(name);
    }
    var o = typeof window.mdbSupabaseOrigin === 'function' ? window.mdbSupabaseOrigin() : '';
    return o ? o + '/functions/v1/' + String(name).replace(/^\//, '') : '';
}

function pageUrl(relativePath) {
    try {
        return new URL(relativePath, window.location.href).href;
    } catch (e) {
        return relativePath;
    }
}

function triggerBlobDownload(filename, blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 15000);
}

function normalizeDisplayVersion(version) {
    var v = String(version || '').trim();
    if (!v) return 'V.1.0.0';
    if (/^V\./i.test(v)) return v.charAt(0).toUpperCase() + v.slice(1);
    if (/^v/i.test(v)) return 'V.' + v.slice(1).replace(/^\./, '');
    return 'V.' + v.replace(/^v\.?/i, '');
}

function buildPkgDownloadFilename(appName, version) {
    var app = String(appName || 'MDJPRO').trim() || 'MDJPRO';
    var ver = normalizeDisplayVersion(version);
    return app + ' ' + ver + '.pkg';
}

function formatByteSize(bytes) {
    if (!bytes || bytes <= 0) return '—';
    if (bytes >= 1024 * 1024 * 1024) {
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }
    if (bytes >= 1024 * 1024) {
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
    return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

async function pkgContentLength(pkgUrl) {
    if (!pkgUrl || pkgUrl === '#') return 0;
    try {
        var res = await fetch(pkgUrl, { method: 'HEAD', cache: 'no-store' });
        if (!res.ok) return 0;
        var len = parseInt(res.headers.get('content-length') || '0', 10);
        return isNaN(len) ? 0 : len;
    } catch (e) {
        return 0;
    }
}

async function triggerPkgDownload(pkgUrl, filename) {
    if (!pkgUrl || pkgUrl === '#') return false;
    var name = filename || 'MDJPRO V.2.1.0.pkg';
    try {
        var res = await fetch(pkgUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error('pkg fetch ' + res.status);
        var blob = await res.blob();
        triggerBlobDownload(name, blob);
        return true;
    } catch (e) {
        console.warn('[downloads] blob pkg download failed, fallback link:', e);
        var a = document.createElement('a');
        a.href = pkgUrl;
        a.rel = 'noopener';
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        return true;
    }
}

async function pkgUrlIsReachable(pkgUrl) {
    if (!pkgUrl || pkgUrl === '#') return false;
    try {
        var res = await fetch(pkgUrl, { method: 'HEAD', cache: 'no-store' });
        return res.ok;
    } catch (e) {
        return false;
    }
}

async function resolveMacInstallerPkgUrl(fallbackFromJson, catalog) {
    var remote = (typeof window.MDB_INSTALLER_MAC_PKG_URL === 'string' && window.MDB_INSTALLER_MAC_PKG_URL)
        ? window.MDB_INSTALLER_MAC_PKG_URL
        : fallbackFromJson;
    var app = (catalog && catalog.app) || 'MDJPRO';
    var version = (catalog && catalog.version) || 'V.2.1.0';
    var filename = buildPkgDownloadFilename(app, version);
    var localVersioned = pageUrl('./installers/' + encodeURIComponent(filename));
    var localLegacy = pageUrl('./installers/MDJPRO_Installer.pkg');

    if (await pkgUrlIsReachable(localVersioned)) {
        return { url: localVersioned, filename: filename, source: 'local' };
    }
    if (await pkgUrlIsReachable(localLegacy)) {
        return { url: localLegacy, filename: filename, source: 'local' };
    }
    if (await pkgUrlIsReachable(remote)) {
        return { url: remote, filename: filename, source: 'remote' };
    }
    return { url: remote || fallbackFromJson, filename: filename, source: 'missing' };
}

function saveInstallHandoffFile(payload) {
    if (!payload || !payload.handoff_token) return;
    var body = {
        version: 1,
        product: 'MDJPRO',
        handoff_token: payload.handoff_token,
        email: payload.email || '',
        stage_name: payload.stage_name || '',
        license_display: payload.license_display || '',
        expires_at: payload.expires_at || null,
        created_at: new Date().toISOString()
    };
    var blob = new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' });
    triggerBlobDownload('MDJPRO-Install.mdjhandoff', blob);
}

async function maybeIssueProInstallHandoff(session) {
    if (!session || !session.access_token) return null;

    var sb = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
    if (!sb) return null;

    try {
        var snapRes = await sb.rpc('mdjpro_license_snapshot');
        var snap = snapRes && snapRes.data;
        if (snapRes.error || !snap || snap.ok !== true) return null;
        var eff = snap.effective || {};
        if (eff.effective_premium !== true) return null;
    } catch (e) {
        console.warn('[downloads] mdjpro_license_snapshot:', e);
        return null;
    }

    var url = mdbSupabaseFnUrl('mdjpro-install-handoff');
    if (!url) return null;

    try {
        var res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + session.access_token,
                apikey: window.MDB_SUPABASE_ANON_KEY || ''
            },
            body: '{}'
        });
        var data = await res.json().catch(function () { return null; });
        if (!res.ok || !data || data.ok !== true) {
            console.warn('[downloads] install handoff rejected:', data && data.reason ? data.reason : res.status);
            return null;
        }
        saveInstallHandoffFile(data);
        return data;
    } catch (err) {
        console.warn('[downloads] install handoff fetch failed:', err);
        return null;
    }
}

function downloadsPageLocale() {
    var active = document.querySelector('.lang-btn.active');
    var lang = active && active.getAttribute('data-lang');
    if (lang === 'es' || lang === 'en') return lang;
    return 'en';
}

function formatReleaseDate(isoDate, locale) {
    if (!isoDate) return '';
    try {
        var d = new Date(isoDate + 'T12:00:00');
        return d.toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (e) {
        return isoDate;
    }
}

function formatPlatformLabel(platform) {
    var p = String(platform || 'mac').trim().toLowerCase();
    if (p === 'mac' || p === 'macos') return 'Mac';
    if (p === 'win' || p === 'windows') return 'Windows';
    return p.charAt(0).toUpperCase() + p.slice(1);
}

function mergeDownloadsCatalog(base, override) {
    if (!override || typeof override !== 'object') return base;
    var merged = Object.assign({}, base || {});
    if (override.version) merged.version = override.version;
    if (override.released) merged.released = override.released;
    if (override.platform) merged.platform = override.platform;
    if (override.releaseNotes) {
        merged.releaseNotes = merged.releaseNotes || {};
        if (override.releaseNotes.title) {
            merged.releaseNotes.title = Object.assign({}, merged.releaseNotes.title || {}, override.releaseNotes.title);
        }
        if (override.releaseNotes.items) {
            merged.releaseNotes.items = Object.assign({}, merged.releaseNotes.items || {}, override.releaseNotes.items);
        }
    }
    return merged;
}

async function fetchMdjproDownloadsOverride() {
    var sb = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
    if (!sb) return null;
    try {
        var res = await sb.from('platform_settings')
            .select('value')
            .eq('key', 'mdjpro_downloads_catalog')
            .maybeSingle();
        if (res.error || !res.data || !res.data.value) return null;
        return JSON.parse(res.data.value);
    } catch (e) {
        console.warn('[downloads] mdjpro_downloads_catalog:', e);
        return null;
    }
}

function renderReleaseNotes(catalog) {
    var wrap = document.getElementById('dl-release-notes');
    var titleEl = document.getElementById('release-notes-title');
    var dateEl = document.getElementById('release-notes-date');
    var listEl = document.getElementById('release-notes-list');
    if (!wrap || !titleEl || !listEl || !catalog) return;

    var notes = catalog.releaseNotes || {};
    var locale = downloadsPageLocale();
    var items = (notes.items && notes.items[locale]) || catalog.changelog || [];
    if (!items.length) {
        wrap.hidden = true;
        return;
    }

    var title = (notes.title && notes.title[locale]) ||
        ((locale === 'es' ? 'NOVEDADES EN ' : "WHAT'S NEW IN ") +
            (catalog.app || 'MDJPRO') + ' ' + normalizeDisplayVersion(catalog.version));

    titleEl.textContent = String(title).toUpperCase();
    if (dateEl) {
        var dateLabel = formatReleaseDate(catalog.released, locale);
        dateEl.textContent = dateLabel
            ? (locale === 'es' ? 'Publicado: ' : 'Released: ') + dateLabel
            : '';
        dateEl.style.display = dateLabel ? '' : 'none';
    }

    listEl.innerHTML = '';
    items.forEach(function (line) {
        var li = document.createElement('li');
        li.textContent = String(line);
        listEl.appendChild(li);
    });
    wrap.hidden = false;
}

var _downloadsCatalogCache = null;

async function loadDownloadData() {
    try {
        var response = await fetch(pageUrl('./data/downloads.json?v=20260609-dl-catalog'));
        var base = await response.json();
        var override = await fetchMdjproDownloadsOverride();
        var data = mergeDownloadsCatalog(base, override);
        _downloadsCatalogCache = data;

        var displayVersion = normalizeDisplayVersion(data.version);
        var versionEl = document.getElementById('app-version');
        if (versionEl) {
            versionEl.textContent = (data.app || 'MDJPRO') + ' ' + displayVersion;
        }

        var platformEl = document.getElementById('app-platform');
        if (platformEl) {
            platformEl.textContent = formatPlatformLabel(data.platform);
        }

        renderReleaseNotes(data);

        var sizeEl = document.getElementById('app-size');
        var btn = document.getElementById('download-btn');
        if (!btn) return;

        var pkgMeta = await resolveMacInstallerPkgUrl(data.url, data);
        btn.href = pkgMeta.url;
        btn.setAttribute('data-pkg-source', pkgMeta.source);
        btn.setAttribute('download', pkgMeta.filename);

        if (sizeEl) {
            var bytes = await pkgContentLength(pkgMeta.url);
            sizeEl.textContent = bytes > 0 ? formatByteSize(bytes) : (data.size || '—');
            sizeEl.setAttribute('data-bytes', bytes > 0 ? String(bytes) : '');
        }

        btn.addEventListener('click', async function (ev) {
            ev.preventDefault();

            var liveMeta = await resolveMacInstallerPkgUrl(data.url, data);
            btn.href = liveMeta.url;
            btn.setAttribute('data-pkg-source', liveMeta.source);
            btn.setAttribute('download', liveMeta.filename);

            /* Solo .pkg (cajita amarilla). Local web/installers/ o Supabase Storage installers/MDJPRO_Installer.pkg */
            if (liveMeta.source === 'missing') {
                var loc = downloadsPageLocale();
                var msg = loc === 'es'
                    ? 'Instalador no publicado. Sube MDJPRO_Installer.pkg al bucket Supabase «installers» o colócalo en web/installers/.'
                    : 'Installer not published. Upload MDJPRO_Installer.pkg to Supabase bucket «installers» or place it in web/installers/.';
                console.error('[downloads] pkg missing:', liveMeta.url);
                window.alert(msg);
                return;
            }
            await triggerPkgDownload(liveMeta.url, liveMeta.filename);

            /* Handoff Pro: solo después del .pkg, nunca solo la "hoja" en Descargas. */
            if (liveMeta.source === 'missing') return;

            var sb = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
            if (!sb) return;

            try {
                var sessRes = await sb.auth.getSession();
                var session = sessRes && sessRes.data && sessRes.data.session;
                if (session) {
                    window.setTimeout(function () {
                        maybeIssueProInstallHandoff(session);
                    }, 2500);
                }
            } catch (e) {
                console.warn('[downloads] handoff on click:', e);
            }
        });
    } catch (error) {
        console.error('Error loading download data:', error);
    }
}

document.addEventListener('DOMContentLoaded', loadDownloadData);

document.addEventListener('click', function (ev) {
    var btn = ev.target && ev.target.closest && ev.target.closest('.lang-btn');
    if (!btn || !_downloadsCatalogCache) return;
    window.setTimeout(function () {
        renderReleaseNotes(_downloadsCatalogCache);
    }, 80);
});
