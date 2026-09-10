/* dj-services-test.js — piloto aislado.
   Compatibilidad estricta: 0 uso de "?.", 0 uso de "??", 0 class fields.
   Click-to-play unico: nunca se dispara video por mouseenter/hover, y solo
   existe UNA instancia de <video> en toda la pagina, reutilizada por cada
   boton "Ver Video Demo". */

(function () {
    'use strict';

    function bindDemoPlayers() {
        var playerWrap = document.getElementById('dst-player-wrap');
        var playerFrame = document.getElementById('dst-player-frame');
        var video = document.getElementById('dst-player-video');
        var caption = document.getElementById('dst-player-caption-text');
        var closeBtn = document.getElementById('dst-player-close');
        var buttons = document.querySelectorAll('.dst-demo-play-btn, .dst-demo-cta');

        if (!playerWrap || !video) return;

        function stopAndHide() {
            try {
                video.pause();
                video.removeAttribute('src');
                video.load();
            } catch (e) {
                /* ignore */
            }
            playerWrap.classList.remove('is-active');
        }

        function playDemo(src, title) {
            /* Una sola instancia: siempre el mismo <video>, nunca se crean nodos nuevos. */
            video.pause();
            video.setAttribute('src', src);
            video.load();
            playerWrap.classList.add('is-active');
            if (caption) caption.textContent = title || '';
            /* Overlay fijo: no desplaza ni hace scroll a ninguna parte de la pagina. */
            video.play().catch(function () {
                /* autoplay bloqueado tras un clic real es raro, pero no rompe nada si pasa */
            });
        }

        for (var i = 0; i < buttons.length; i++) {
            (function (btn) {
                btn.addEventListener('click', function (e) {
                    e.preventDefault();
                    var src = btn.getAttribute('data-demo-src');
                    var title = btn.getAttribute('data-demo-title');
                    if (!src) return;
                    playDemo(src, title);
                });
            })(buttons[i]);
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', function () {
                stopAndHide();
            });
        }

        /* Clic en el fondo oscuro (fuera del modal) tambien cierra. */
        playerWrap.addEventListener('click', function (e) {
            if (e.target === playerWrap) stopAndHide();
        });
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
