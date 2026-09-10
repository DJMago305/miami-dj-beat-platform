/* dj-services-test.js — piloto aislado.
   Compatibilidad estricta: 0 uso de "?.", 0 uso de "??", 0 class fields.
   Click-to-play manual (miniaturas de abajo) + reproductor automatico de
   "capitulos" en el hero: un solo <video>, nunca en loop de si mismo -- al
   terminar, pasa al siguiente demo de la lista, nunca dos a la vez. */

(function () {
    'use strict';

    /* Mismo orden que las miniaturas de abajo. */
    var PLAYLIST = [
        'https://hkuvuqupbxwkiykxvqdr.supabase.co/storage/v1/object/public/assets/DJ_Performance/weddings_quinces.mp4',
        'https://hkuvuqupbxwkiykxvqdr.supabase.co/storage/v1/object/public/assets/DJ_Performance/private_parties.mp4',
        'https://hkuvuqupbxwkiykxvqdr.supabase.co/storage/v1/object/public/assets/DJ_Performance/clubs_nightlife.mp4',
        'https://hkuvuqupbxwkiykxvqdr.supabase.co/storage/v1/object/public/assets/DJ_Performance/kids_family.mp4',
        'https://hkuvuqupbxwkiykxvqdr.supabase.co/storage/v1/object/public/assets/DJ_Performance/Halloween.mp4',
        'https://hkuvuqupbxwkiykxvqdr.supabase.co/storage/v1/object/public/assets/DJ_Performance/holiday_special_events.mp4'
    ];

    function bindDemoPlayers() {
        var hero = document.getElementById('dst-hero');
        var video = document.getElementById('dst-player-video');
        var closeBtn = document.getElementById('dst-player-close');
        var buttons = document.querySelectorAll('.dst-demo-play-btn, .dst-demo-cta');
        var currentIndex = -1;

        if (!hero || !video) return;

        function stopAndHide() {
            try {
                video.pause();
                video.removeAttribute('src');
                video.load();
            } catch (e) {
                /* ignore */
            }
            currentIndex = -1;
            video.classList.remove('is-active');
            if (closeBtn) closeBtn.classList.remove('is-active');
        }

        function playIndex(i) {
            /* Una sola instancia: siempre el mismo <video>, nunca se crean nodos
               nuevos. Vive dentro del mismo hero -- reemplaza la foto de fondo
               en el lugar, nunca se abre como ventana aparte. Sin loop: al
               terminar (evento 'ended', ver abajo) pasa al siguiente capitulo. */
            currentIndex = i % PLAYLIST.length;
            video.pause();
            video.setAttribute('src', PLAYLIST[currentIndex]);
            video.load();
            video.classList.add('is-active');
            if (closeBtn) closeBtn.classList.add('is-active');
            video.play().catch(function () {
                /* autoplay bloqueado (solo puede pasar en el primer arranque
                   automatico, nunca tras un clic real) -- no rompe nada si pasa. */
            });
        }

        /* Capitulos automaticos: al terminar un demo, pasa al siguiente sin
           repetir el mismo (loop quitado del <video> a proposito). */
        video.addEventListener('ended', function () {
            if (currentIndex < 0) return;
            playIndex(currentIndex + 1);
        });

        for (var i = 0; i < buttons.length; i++) {
            (function (btn) {
                btn.addEventListener('click', function (e) {
                    e.preventDefault();
                    /* Indice real por URL (data-demo-src), no por posicion --
                       cada tarjeta tiene 2 botones (miniatura + "Watch Demo"),
                       un indice por conteo secuencial mapearia mal. */
                    var src = btn.getAttribute('data-demo-src');
                    var idx = PLAYLIST.indexOf(src);
                    if (idx < 0) return;
                    playIndex(idx);
                    hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
            })(buttons[i]);
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', function () {
                stopAndHide();
            });
        }

        /* Arranque automatico SOLO en navegadores modernos -- en WebKit legado
           (window.dstIsLegacySafari) nada se reproduce sin un clic explicito,
           tal como pedia el ticket original para esta pagina. */
        if (!window.dstIsLegacySafari) {
            playIndex(pickStartIndex());
        }
    }

    /** Elige el primer video del hero segun una señal real, no siempre el
     * mismo. Prioridad:
     * 1) Parametro de URL (?vibe=wedding en un anuncio/campaña que ya sabe
     *    que evento busca el visitante) -- coincidencia real, no adivinada.
     * 2) Sin esa señal: rota por dia+hora, para que dos visitas en momentos
     *    distintos no siempre arranquen en el mismo demo. Esto es logica
     *    simple basada en datos reales disponibles (URL, reloj) -- no es
     *    "IA", y no se presenta como tal. */
    function pickStartIndex() {
        try {
            var qs = window.location.search.replace(/^\?/, '');
            var pairs = qs.length ? qs.split('&') : [];
            var vibe = '';
            for (var p = 0; p < pairs.length; p++) {
                var kv = pairs[p].split('=');
                if (kv[0] === 'vibe' || kv[0] === 'intent' || kv[0] === 'event') {
                    vibe = decodeURIComponent(kv[1] || '').toLowerCase();
                    break;
                }
            }
            var MAP = {
                wedding: 0, weddings: 0, corporate: 0,
                private: 1, party: 1, parties: 1,
                club: 2, clubs: 2, nightlife: 2,
                family: 3, kids: 3,
                halloween: 4, seasonal: 4,
                holiday: 5
            };
            if (vibe && Object.prototype.hasOwnProperty.call(MAP, vibe)) {
                return MAP[vibe];
            }
        } catch (e) { /* ignore */ }
        var d = new Date();
        return (d.getDate() + d.getHours()) % PLAYLIST.length;
    }

    function bindBookButtons() {
        var buttons = document.querySelectorAll('.dst-pkg-book');
        for (var i = 0; i < buttons.length; i++) {
            (function (btn) {
                btn.addEventListener('click', function () {
                    var card = btn.closest ? btn.closest('.dst-pkg-card') : null;
                    var nameEl = card ? card.querySelector('.dst-pkg-name') : null;
                    var name = nameEl ? nameEl.textContent : '';
                    var url = './contact.html';
                    if (name) url += '?subject=' + encodeURIComponent('DJ Package: ' + name);
                    window.location.href = url;
                });
            })(buttons[i]);
        }
    }

    function init() {
        bindDemoPlayers();
        bindBookButtons();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
