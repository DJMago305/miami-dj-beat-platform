/* Panel del artista · SALUD DEL PERFIL (completitud, 0–100 %).
 *  Cuatro criterios de 25 % cada uno, calculados SOLO sobre la propia fila de dj_profiles (la lee artist-data.js con auth.uid(); aquí no hay datos de nadie):
 *    1) Foto de perfil (photo_url presente y no rechazada)         2) Biografía profesional de al menos 50 caracteres
 *    3) Al menos un enlace de audio o set (SoundCloud, Mixcloud, Spotify, Apple Music, Beatport, YouTube)
 *    4) Tarifa por hora o disponibilidad horaria configurada (días recurrentes u horario)
 *  Se monta en <div id="ap-profile-health"> (dj-dashboard.html, «Resumen de cuenta»). Barra de progreso + lista de pasos; cada paso pendiente es un botón que lleva al campo.
 *  Cuenta nueva o perfil en blanco: 0 % limpio, sin excepciones. Si la lectura falla, la tarjeta se oculta (nunca un número inventado).
 *  Colores con variables --ap-ph-* (día/noche con html[data-theme="day"]). Texto con textContent. Compatible con Safari 13 (sin ?. ni ??). */
(function () {
    'use strict';
    var AP = window.ArtistPanel = window.ArtistPanel || {};

    var T = {
        es: { title: 'Salud del perfil', done: 'Completo', todo: 'Pendiente', go: 'Completar', allDone: 'Tu perfil está completo.', steps: ' de 4 pasos',
              photo: 'Foto de perfil', bio: 'Biografía profesional (mínimo 50 caracteres)', audio: 'Enlace de audio o set (SoundCloud, Mixcloud, Spotify…)', avail: 'Tarifa o disponibilidad horaria configurada',
              photoH: 'Sube una foto clara de tu cara o tu marca.', bioH: 'Cuéntales quién eres: estilo, experiencia, tipo de eventos.', audioH: 'Un enlace para que los clientes te escuchen antes de contratar.', availH: 'Tus días y horas disponibles, o tu tarifa por hora.' },
        en: { title: 'Profile health', done: 'Done', todo: 'Pending', go: 'Complete', allDone: 'Your profile is complete.', steps: ' of 4 steps',
              photo: 'Profile photo', bio: 'Professional bio (at least 50 characters)', audio: 'Audio or set link (SoundCloud, Mixcloud, Spotify…)', avail: 'Rate or working hours set up',
              photoH: 'Upload a clear photo of your face or brand.', bioH: 'Tell them who you are: style, experience, type of events.', audioH: 'A link so clients can listen before they book.', availH: 'Your available days and hours, or your hourly rate.' }
    };
    function lang() { var l = String(document.documentElement.getAttribute('lang') || 'es').toLowerCase(); return l.indexOf('en') === 0 ? 'en' : 'es'; }
    function t(k) { return T[lang()][k]; }
    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
    function txt(v) { return typeof v === 'string' ? v.replace(/^\s+|\s+$/g, '') : ''; }
    function hasKeys(o) { if (!o || typeof o !== 'object') return false; for (var k in o) { if (Object.prototype.hasOwnProperty.call(o, k)) return true; } return false; }

    /* Cada criterio devuelve true/false a partir de la fila (puede venir vacía o null). */
    var AUDIO_FIELDS = ['soundcloud_url', 'social_soundcloud', 'social_mixcloud', 'spotify_url', 'social_spotify', 'apple_music_url', 'social_apple', 'beatport_url', 'social_beatport', 'youtube_url', 'social_youtube'];
    var CHECKS = [
        { key: 'photo', go: 'photo', test: function (p) { return txt(p.photo_url).length > 0 && txt(p.photo_status).toLowerCase() !== 'rejected'; } },
        { key: 'bio', go: 'bio', test: function (p) {
            var s = [p.bio, p.bio_long, p.bio_short], i;
            for (i = 0; i < s.length; i++) { if (txt(s[i]).length >= 50) return true; }
            return false; } },
        { key: 'audio', go: 'audio', test: function (p) {
            for (var i = 0; i < AUDIO_FIELDS.length; i++) { if (txt(p[AUDIO_FIELDS[i]]).length > 0) return true; }
            return false; } },
        { key: 'avail', go: 'avail', test: function (p) {
            if (Number(p.hourly_rate_usd) > 0) return true;
            var s = p.availability_schedule;
            if (s && typeof s === 'object') {
                if (Object.prototype.toString.call(s.recurring_days) === '[object Array]' && s.recurring_days.length > 0) return true;
                if (hasKeys(s.schedule) || hasKeys(s.recurring_times)) return true;
            }
            var a = p.availability;
            return !!(a && typeof a === 'object' && (Object.prototype.toString.call(a) === '[object Array]' ? a.length > 0 : hasKeys(a))); } }
    ];

    /* → { percent, items:[{key, done, go}] }. Perfil null/vacío → 0 %. */
    function evaluate(profile) {
        var p = profile && typeof profile === 'object' ? profile : {}, items = [], done = 0, i, ok;
        for (i = 0; i < CHECKS.length; i++) {
            try { ok = !!CHECKS[i].test(p); } catch (e) { ok = false; }
            if (ok) done++;
            items.push({ key: CHECKS[i].key, done: ok, go: CHECKS[i].go });
        }
        return { percent: done * 25, done: done, items: items };
    }

    function css() {
        if (document.getElementById('ap-health-style')) return;
        var s = document.createElement('style'); s.id = 'ap-health-style';
        s.textContent =
            '#ap-profile-health{--ap-ph-bg:rgba(255,255,255,.03);--ap-ph-line:rgba(255,255,255,.1);--ap-ph-text:rgba(255,255,255,.88);--ap-ph-dim:rgba(255,255,255,.58);--ap-ph-track:rgba(255,255,255,.1);--ap-ph-fill:#c5a059;--ap-ph-ok:#7fdca0;--ap-ph-warn:#f0cc80;}' +
            'html[data-theme="day"] #ap-profile-health{--ap-ph-bg:#fff;--ap-ph-line:rgba(0,0,0,.12);--ap-ph-text:#161a22;--ap-ph-dim:rgba(0,0,0,.6);--ap-ph-track:rgba(0,0,0,.1);--ap-ph-fill:#8a6d2e;--ap-ph-ok:#1d7a44;--ap-ph-warn:#8a5a00;}' +
            '#ap-profile-health:empty{display:none;}' +
            '#ap-profile-health .aph{background:var(--ap-ph-bg);border:1px solid var(--ap-ph-line);border-radius:14px;padding:16px 18px;margin:0 0 18px;color:var(--ap-ph-text);}' +
            '#ap-profile-health .aph-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 10px;}' +
            '#ap-profile-health .aph-title{margin:0;font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;}' +
            '#ap-profile-health .aph-pct{font-size:22px;font-weight:800;color:var(--ap-ph-fill);font-variant-numeric:tabular-nums;}' +
            '#ap-profile-health .aph-bar{height:10px;border-radius:999px;background:var(--ap-ph-track);overflow:hidden;}' +
            '#ap-profile-health .aph-fill{height:100%;width:0;border-radius:999px;background:var(--ap-ph-fill);transition:width .5s ease;}' +
            '#ap-profile-health .aph-sub{margin:8px 0 12px;font-size:12px;color:var(--ap-ph-dim);}' +
            '#ap-profile-health .aph-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px;}' +
            '#ap-profile-health .aph-item{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--ap-ph-line);border-radius:10px;}' +
            '#ap-profile-health .aph-ic{flex:0 0 22px;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;border:2px solid var(--ap-ph-warn);color:var(--ap-ph-warn);}' +
            '#ap-profile-health .aph-item--done .aph-ic{border-color:var(--ap-ph-ok);color:var(--ap-ph-ok);background:transparent;}' +
            '#ap-profile-health .aph-body{flex:1;min-width:0;}' +
            '#ap-profile-health .aph-name{font-size:13px;font-weight:700;}' +
            '#ap-profile-health .aph-hint{font-size:11.5px;color:var(--ap-ph-dim);margin-top:2px;}' +
            '#ap-profile-health .aph-state{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--ap-ph-warn);}' +
            '#ap-profile-health .aph-item--done .aph-state{color:var(--ap-ph-ok);}' +
            '#ap-profile-health .aph-go{cursor:pointer;font:inherit;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ap-ph-fill);background:transparent;border:1px solid var(--ap-ph-fill);border-radius:999px;padding:6px 14px;}' +
            '#ap-profile-health .aph-go:hover{background:var(--ap-ph-fill);color:#fff;}' +
            '#ap-profile-health .aph-ok-msg{margin:12px 0 0;font-size:12.5px;font-weight:700;color:var(--ap-ph-ok);}';
        document.head.appendChild(s);
    }

    /* Lleva al campo del paso pendiente, con las mismas funciones que ya usa el panel (showPanel / openModal). Si algo no existe, no hace nada. */
    function focusField(id) {
        var node = document.getElementById(id); if (!node) return;
        try { node.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { node.scrollIntoView(); }
        setTimeout(function () { try { if (node.focus) node.focus(); } catch (e) { /* sin foco */ } }, 350);
    }
    function go(where) {
        try {
            if (where === 'bio') { if (typeof window.openModal === 'function') window.openModal('m-bio'); return; }
            if (where === 'avail') {
                if (typeof window.showPanel === 'function') window.showPanel('agenda', document.querySelector('.acct-side-link[onclick*="agenda"]'));
                setTimeout(function () { focusField('cfg-agenda-available'); }, 60); return;
            }
            if (where === 'photo') { focusField('acct-photo-hero-card'); return; }
            if (where === 'audio') { focusField('cfg-soundcloud'); return; }
        } catch (e) { /* un fallo al navegar no debe romper el panel */ }
    }

    function render(host, res) {
        css();
        while (host.firstChild) host.removeChild(host.firstChild);
        var box = el('section', 'aph'), head = el('div', 'aph-head');
        box.setAttribute('aria-label', t('title'));
        head.appendChild(el('h3', 'aph-title', t('title')));
        head.appendChild(el('span', 'aph-pct', res.percent + '%'));
        box.appendChild(head);
        var bar = el('div', 'aph-bar'), fill = el('div', 'aph-fill');
        bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', '100'); bar.setAttribute('aria-valuenow', String(res.percent));
        fill.style.width = res.percent + '%'; bar.appendChild(fill); box.appendChild(bar);
        box.appendChild(el('p', 'aph-sub', res.done + t('steps')));
        var list = el('ul', 'aph-list');
        res.items.forEach(function (it) {
            var li = el('li', 'aph-item' + (it.done ? ' aph-item--done' : ''));
            li.appendChild(el('span', 'aph-ic', it.done ? '✓' : '!'));
            var body = el('div', 'aph-body');
            body.appendChild(el('div', 'aph-name', t(it.key)));
            if (!it.done) body.appendChild(el('div', 'aph-hint', t(it.key + 'H')));
            li.appendChild(body);
            if (it.done) li.appendChild(el('span', 'aph-state', t('done')));
            else {
                var b = el('button', 'aph-go', t('go')); b.type = 'button'; b.setAttribute('data-go', it.go);
                b.addEventListener('click', function () { go(it.go); });
                li.appendChild(b);
            }
            list.appendChild(li);
        });
        box.appendChild(list);
        if (res.percent === 100) box.appendChild(el('p', 'aph-ok-msg', t('allDone')));
        host.appendChild(box);
    }

    var last = null, timer = null;
    function refresh() {
        var host = document.getElementById('ap-profile-health'); if (!host) return Promise.resolve();
        if (!AP.data || typeof AP.data.loadProfileHealth !== 'function') return Promise.resolve();
        return AP.data.loadProfileHealth().then(function (profile) {
            last = evaluate(profile); render(host, last);
        }, function () {
            while (host.firstChild) host.removeChild(host.firstChild);     /* lectura fallida: sin tarjeta, jamás un 0 % falso */
        });
    }
    function later(ms) { clearTimeout(timer); timer = setTimeout(refresh, ms || 900); }

    function start() {
        refresh();
        document.addEventListener('languageChanged', function () { var h = document.getElementById('ap-profile-health'); if (last && h) render(h, last); });
        document.addEventListener('visibilitychange', function () { if (!document.hidden) later(400); });
        /* Tras guardar (foto, biografía, enlaces, horario) el dato cambia: se vuelve a leer poco después de cualquier clic dentro de Configuración. */
        var tab = document.getElementById('tab-settings');
        if (tab) tab.addEventListener('click', function () { later(1600); });
    }
    AP.health = { evaluate: evaluate, refresh: refresh };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
