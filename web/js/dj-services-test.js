/* dj-services-test.js — piloto aislado.
   Compatibilidad estricta: 0 uso de "?.", 0 uso de "??", 0 class fields.
   Click-to-play unico: nunca se dispara video por mouseenter/hover, y solo
   existe UNA instancia de <video> en toda la pagina, reutilizada por cada
   boton "Ver Video Demo". */

(function () {
    'use strict';

    function bindDemoPlayers() {
        var hero = document.getElementById('dst-hero');
        var video = document.getElementById('dst-player-video');
        var closeBtn = document.getElementById('dst-player-close');
        var buttons = document.querySelectorAll('.dst-demo-play-btn, .dst-demo-cta');

        if (!hero || !video) return;

        function stopAndHide() {
            try {
                video.pause();
                video.removeAttribute('src');
                video.load();
            } catch (e) {
                /* ignore */
            }
            video.classList.remove('is-active');
            if (closeBtn) closeBtn.classList.remove('is-active');
        }

        function playDemo(src) {
            /* Una sola instancia: siempre el mismo <video>, nunca se crean nodos nuevos.
               Vive dentro del mismo hero -- reemplaza la foto de fondo en el lugar,
               nunca se abre como ventana aparte. */
            video.pause();
            video.setAttribute('src', src);
            video.load();
            video.classList.add('is-active');
            if (closeBtn) closeBtn.classList.add('is-active');
            video.play().catch(function () {
                /* autoplay bloqueado tras un clic real es raro, pero no rompe nada si pasa */
            });
        }

        for (var i = 0; i < buttons.length; i++) {
            (function (btn) {
                btn.addEventListener('click', function (e) {
                    e.preventDefault();
                    var src = btn.getAttribute('data-demo-src');
                    if (!src) return;
                    playDemo(src);
                    hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
            })(buttons[i]);
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', function () {
                stopAndHide();
            });
        }
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
