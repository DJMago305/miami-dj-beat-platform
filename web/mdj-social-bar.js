/**
 * Barra lateral global: correo, tel, SMS, WhatsApp + IG / FB / TikTok.
 * Mismo aspecto en todo el sitio. Requiere body; usa correo de supabase-config si existe.
 */
(function () {
    function injectMdjSocialBar() {
        if (document.getElementById('mdj-social-sticky-bar')) {
            return;
        }
        const MDJ_OFFICIAL_EMAIL = window.MDB_OFFICIAL_CONTACT_EMAIL || 'miamidjbeat@gmail.com';
        const socialHTML = `
    <style>
        .social-sticky-bar {
            position: fixed;
            right: 14px;
            top: 50%;
            transform: translateY(-50%);
            background: linear-gradient(
                165deg,
                rgba(197, 160, 89, 0.22) 0%,
                rgba(197, 160, 89, 0.38) 50%,
                rgba(197, 160, 89, 0.48) 100%
            );
            backdrop-filter: blur(28px) saturate(1.25);
            -webkit-backdrop-filter: blur(28px) saturate(1.25);
            border: 1px solid rgba(197, 160, 89, 0.32);
            border-radius: 22px;
            padding: 12px 9px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            z-index: 8000;
            box-shadow:
                0 4px 18px rgba(0, 0, 0, 0.18),
                inset 0 1px 0 rgba(255, 255, 255, 0.22);
        }
        .social-sticky-bar .mdj-sticky-chip {
            flex-shrink: 0;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            text-decoration: none;
            color: #fff;
            transition: transform 0.26s cubic-bezier(0.34, 1.45, 0.64, 1), box-shadow 0.26s ease, filter 0.26s ease;
            box-shadow:
                0 3px 10px rgba(0, 0, 0, 0.32),
                0 0 0 1px rgba(255, 255, 255, 0.1) inset;
        }
        .social-sticky-bar .mdj-sticky-chip:hover {
            transform: scale(1.18) translateX(-4px);
            filter: brightness(1.08);
            box-shadow:
                0 10px 26px rgba(0, 0, 0, 0.42),
                0 0 0 1px rgba(255, 255, 255, 0.22) inset,
                0 0 22px rgba(255, 255, 255, 0.1);
        }
        .social-sticky-bar .mdj-sticky-chip:active {
            transform: scale(1.08) translateX(-2px);
        }
        .social-sticky-bar .mdj-sticky-chip svg {
            width: 19px;
            height: 19px;
            display: block;
            filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.22));
        }
        .social-sticky-bar .mdj-chip-mail {
            background: linear-gradient(145deg, #5b9cf5 0%, #2d6cdf 55%, #1a5fbf 100%);
        }
        .social-sticky-bar .mdj-chip-phone {
            background: linear-gradient(145deg, #5cdb95 0%, #27ae60 100%);
        }
        .social-sticky-bar .mdj-chip-sms {
            background: linear-gradient(145deg, #64b5ff 0%, #1976d2 100%);
        }
        .social-sticky-bar .mdj-chip-wa-small {
            background: linear-gradient(180deg, #2fe676 0%, #25d366 50%, #1da851 100%);
            box-shadow:
                0 3px 12px rgba(37, 211, 102, 0.38),
                0 0 0 1px rgba(255, 255, 255, 0.12) inset;
        }
        .social-sticky-bar .mdj-chip-wa-small:hover {
            box-shadow:
                0 5px 18px rgba(37, 211, 102, 0.48),
                0 0 0 1px rgba(255, 255, 255, 0.18) inset;
        }
        .social-sticky-bar .mdj-chip-ig {
            background: radial-gradient(circle at 30% 100%, #fdc468 0%, transparent 55%),
                radial-gradient(circle at 80% 20%, #d62976 0%, transparent 50%),
                linear-gradient(210deg, #f58529 0%, #dd2a7b 35%, #8134af 70%, #515bd4 100%);
        }
        .social-sticky-bar .mdj-chip-fb {
            background: #1877f2;
        }
        .social-sticky-bar .mdj-chip-tt {
            background: linear-gradient(145deg, #121212 0%, #010101 100%);
            box-shadow:
                0 4px 14px rgba(0, 0, 0, 0.5),
                0 0 0 1px rgba(255, 45, 85, 0.35),
                0 0 0 2px rgba(0, 242, 234, 0.2) inset;
        }
        .social-sticky-bar .mdj-chip-tt svg {
            filter: none;
            width: 21px;
            height: 21px;
        }
        .social-sticky-bar .social-sticky-divider {
            width: 28px;
            height: 0;
            margin: 2px 0 0;
            border: none;
            border-top: 1px solid rgba(80, 64, 40, 0.28);
            box-shadow: 0 1px 0 rgba(255, 255, 255, 0.25);
            opacity: 1;
        }
        /* Tablet + móvil: ocultar al hacer scroll, reaparecer al parar (ver initSocialBarScrollHide) */
        @media (max-width: 1024px) {
            .social-sticky-bar {
                transition: transform 0.38s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.28s ease;
                will-change: transform;
            }
            .social-sticky-bar.social-sticky-bar--scroll-hidden {
                pointer-events: none;
                opacity: 0.92;
            }
        }
        @media (min-width: 769px) and (max-width: 1024px) {
            .social-sticky-bar.social-sticky-bar--scroll-hidden {
                transform: translateY(-50%) translateX(calc(100% + 32px));
            }
        }
        @media (max-width: 768px) {
            .social-sticky-bar {
                top: auto;
                bottom: calc(max(12px, env(safe-area-inset-bottom, 0px)) + 76px);
                transform: none;
                right: 10px;
                padding: 10px 7px;
                gap: 8px;
                border-radius: 18px;
                max-height: calc(100vh - 120px);
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
            }
            .social-sticky-bar.social-sticky-bar--scroll-hidden {
                transform: translateX(calc(100% + 36px));
            }
            .social-sticky-bar .mdj-sticky-chip {
                width: 36px;
                height: 36px;
            }
            .social-sticky-bar .mdj-sticky-chip svg {
                width: 17px;
                height: 17px;
            }
            .social-sticky-bar .mdj-chip-tt svg {
                width: 18px;
                height: 18px;
            }
            .social-sticky-bar .social-sticky-divider {
                width: 24px;
            }
        }
    </style>

    <div class="social-sticky-bar" id="mdj-social-sticky-bar">
        <a class="mdj-sticky-chip mdj-chip-mail" href="mailto:${MDJ_OFFICIAL_EMAIL}?subject=Consulta%20Miami%20DJ%20Beat" aria-label="Correo oficial Miami DJ Beat" title="Correo oficial · ${MDJ_OFFICIAL_EMAIL}">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="currentColor" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5L4 8V6l8 5 8-5v2z"/></svg>
        </a>
        <a class="mdj-sticky-chip mdj-chip-phone" href="tel:+13056071780" aria-label="Llamar" title="Llamar · (305) 607-1780">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="currentColor" d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
        </a>
        <a class="mdj-sticky-chip mdj-chip-sms" href="sms:+13056071780?body=Hola%20Miami%20DJ%20Beat%2C%20" aria-label="SMS" title="Mensaje SMS · (305) 607-1780">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="currentColor" d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
        </a>
        <a class="mdj-sticky-chip mdj-chip-wa-small" href="https://wa.me/13056071780?text=Hola,%20quisiera%20m%C3%A1s%20informaci%C3%B3n" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" title="WhatsApp · (305) 607-1780">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
        </a>
        <hr class="social-sticky-divider" />
        <a class="mdj-sticky-chip mdj-chip-ig" href="https://instagram.com/miamidjbeat" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.204-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
        </a>
        <a class="mdj-sticky-chip mdj-chip-fb" href="https://facebook.com/miamidjbeat" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.397 20.997v-8.196h2.765l.411-3.209h-3.176V7.548c0-.926.258-1.56 1.557-1.56h1.682V3.127A22.131 22.131 0 0 0 14.201 3c-2.444 0-4.122 1.492-4.122 4.231v2.355H7.332v3.209h2.753v8.202h3.312z"/></svg>
        </a>
        <a class="mdj-sticky-chip mdj-chip-tt" href="https://tiktok.com/@miamidjbeat" target="_blank" rel="noopener noreferrer" aria-label="TikTok">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="#25F4EE" d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/><path fill="#FE2C55" d="M15.37 2v2.44a4.83 4.83 0 0 0 3.77 4.25 4.85 4.85 0 0 0 1 .1v3.4a8.16 8.16 0 0 1-4.77-1.52v7A6.34 6.34 0 0 1 5 20.1a6.33 6.33 0 0 1 3.13-5.48 2.93 2.93 0 0 0-.88-.13 2.89 2.89 0 0 0-2.31 4.64 2.89 2.89 0 0 0 5.2-1.74V2h3.23z"/></svg>
        </a>
    </div>
    `;
        document.body.insertAdjacentHTML('beforeend', socialHTML);
        initSocialBarScrollHide();
    }

    /** Móvil y tablet (≤1024px): esconde la barra a la derecha mientras hay scroll; vuelve al parar. */
    function initSocialBarScrollHide() {
        const bar = document.getElementById('mdj-social-sticky-bar');
        if (!bar) return;

        const mq = window.matchMedia('(max-width: 1024px)');
        let idleTimer = null;
        const IDLE_MS = 200;

        function showBar() {
            bar.classList.remove('social-sticky-bar--scroll-hidden');
        }

        function hideBar() {
            bar.classList.add('social-sticky-bar--scroll-hidden');
        }

        function onScroll() {
            if (!mq.matches) {
                showBar();
                return;
            }
            hideBar();
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = setTimeout(function () {
                idleTimer = null;
                showBar();
            }, IDLE_MS);
        }

        function onResize() {
            if (!mq.matches) showBar();
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onResize, { passive: true });
        if (typeof mq.addEventListener === 'function') {
            mq.addEventListener('change', onResize);
        } else if (typeof mq.addListener === 'function') {
            mq.addListener(onResize);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectMdjSocialBar);
    } else {
        injectMdjSocialBar();
    }
})();
