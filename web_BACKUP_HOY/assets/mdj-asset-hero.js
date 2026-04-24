/**
 * Hero background preview: cards with data-hero-src drive #mdj-bg-focus; no inline card video.
 */
(function () {
    var ambient = document.getElementById('mdj-bg-ambient');
    var focus = document.getElementById('mdj-bg-focus');
    if (!ambient || !focus) return;

    var cards = document.querySelectorAll('[data-mdj-adn-card][data-hero-src]');
    var activeEl = null;
    var coarsePointer = window.matchMedia('(hover: none)').matches;

    function clearFocus() {
        focus.classList.remove('is-visible');
        ambient.classList.remove('is-dimmed');
        try {
            focus.pause();
            focus.removeAttribute('src');
            focus.load();
        } catch (e) { /* ignore */ }
        activeEl = null;
    }

    function applyFocus(url) {
        if (!url) return;
        focus.muted = true;
        focus.setAttribute('src', url);
        focus.load();
        focus.play().then(function () {
            focus.classList.add('is-visible');
            ambient.classList.add('is-dimmed');
        }).catch(function () {
            clearFocus();
        });
    }

    focus.addEventListener('error', function () {
        clearFocus();
    });

    cards.forEach(function (card) {
        var url = card.getAttribute('data-hero-src');
        if (!url) return;

        card.addEventListener('mouseenter', function () {
            if (coarsePointer) return;
            activeEl = card;
            applyFocus(url);
        });
        card.addEventListener('mouseleave', function () {
            if (coarsePointer) return;
            if (activeEl === card) clearFocus();
        });

        card.setAttribute('tabindex', '0');
        card.addEventListener('focusin', function () {
            activeEl = card;
            applyFocus(url);
        });
        card.addEventListener('focusout', function () {
            if (activeEl === card) clearFocus();
        });

        if (coarsePointer) {
            card.addEventListener('click', function () {
                if (activeEl === card && focus.classList.contains('is-visible')) {
                    clearFocus();
                } else {
                    activeEl = card;
                    applyFocus(url);
                }
            });
        }
    });
})();
