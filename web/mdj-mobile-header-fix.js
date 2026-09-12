/* ══════════════════════════════════════════════════════════════════════════
   PARCHE DE HEADER MÓVIL — botón de menú, marca y el propio panel SIEMPRE
   visibles/alcanzables en móvil, en cualquier página que use el header
   canónico (#mainHeader / .header-top / #mobileMenu / #mobileMenuBtn).
   ──────────────────────────────────────────────────────────────────────────
   ORIGEN: encontrado y arreglado primero en dj-profile.html (PR #246, #248,
   #251), a pedido del PO en su sesión real de iPhone. Extraído a script
   compartido para aplicarlo al resto del sitio sin duplicar ~90 líneas por
   archivo — un solo <script src> por página basta.

   TRES BUGS REALES QUE ESTO RESUELVE, LOS TRES CONFIRMADOS EN VIVO:

   1) El botón de menú (#mobileMenuBtn) vive dentro de .header-top, que
      queda display:none en varios modos (visitante persistente, o el
      parpadeo .mdj-estacion-previa antes de resolver sesión) — el botón
      real quedaba invisible/inalcanzable aunque existiera en el DOM.

   2) La marca (logo+wordmark) tiene el mismo problema: vive en el mismo
      .header-top oculto, y ni la franja flotante (#mdj-flotante-visitante)
      es una fuente confiable — su clon se oculta a propósito en algunos
      modos (ver header-unified.css) y en otros depende de timing.

   3) EL MÁS GRAVE: #mobileMenu (el panel que se despliega) TAMBIÉN vive
      dentro de .header-top → #mainHeader. Cuando ese ancestro está
      display:none, el menú se queda invisible AUNQUE tenga la clase
      .active — un ancestro oculto oculta todo su contenido sin importar
      el estado propio del hijo. Confirmado midiendo
      getBoundingClientRect(): {0,0,0,0} con .active ya puesta. El botón
      podía estar "funcionando" (activando la clase) sin que el menú
      resultante se pintara nunca en pantalla.

   SOLUCIÓN: mover el nodo REAL de #mobileMenu a document.body (no una
   copia — se preserva toda su lógica/contenido/listeners ya cableados por
   mdjb-shared-header.js), y montar un botón + una marca independientes,
   también en document.body, inmunes a cualquier regla que oculte
   #mainHeader/.header-top. El botón reenvía el clic al #mobileMenuBtn real
   si existe (para no duplicar lógica de apertura), o si no existe,
   alterna la clase .active directamente.

   ESCRITORIO/TABLET INTACTOS A PROPÓSITO: los dos elementos nuevos solo se
   muestran vía CSS en @media(max-width:768px) — en pantallas más anchas
   quedan display:none y el header original de escritorio sigue
   exactamente igual. Mover #mobileMenu en el DOM no cambia su
   comportamiento en escritorio: ahí nunca se abre (no hay affordance para
   ello), solo existe para el caso móvil que este parche corrige.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* El botón y la marca son un FAILSAFE — solo deben existir cuando el header
     real (#mainHeader/.header-top) está genuinamente inalcanzable (los 3 modos
     descritos arriba). Si el header real ya se ve normal (la mayoría de las
     páginas públicas, sin gating de sesión), montar el duplicado fijo encima
     solo produce una marca+menú superpuestos sobre los reales — confirmado en
     vivo en las páginas GEO/SEO (rentals/weddings/corporate/latin-dj/
     florida-keys/events), donde el header nunca se oculta. */
  function elUsable(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  /* Doble candado real (2026-09-07, hallazgo del PO en vivo): en páginas de
     "estación" bajo 1150px, mdjb-shared-header.js YA monta su propio botón de
     respaldo (#mdj-riel-toggle, hijo de #mainHeader, abre #mainNav) cuando
     .header-top queda oculto. Esta función nunca sabía de su existencia, así
     que en esas páginas montaba TAMBIÉN su propio FAB de menú encima del
     riel-toggle -- dos hamburguesas dibujadas una sobre otra, ambas reales,
     ninguna "mal hecha". El riel-toggle existe siempre en el DOM pero mide
     0x0 (display:none) fuera de esa condición, así que este chequeo no
     cambia nada en las páginas donde nunca aparece. */
  function isMenuReachable() {
    return elUsable(document.getElementById('mobileMenuBtn')) ||
      elUsable(document.getElementById('mdj-riel-toggle'));
  }

  function isBrandReachable() {
    return elUsable(document.querySelector('#mainHeader .brand'));
  }

  function init() {
    try {
      // 1) Mover el panel real fuera de cualquier ancestro que pueda ocultarlo.
      var realMenu = document.getElementById('mobileMenu');
      if (realMenu && realMenu.parentElement !== document.body) {
        document.body.appendChild(realMenu);
      }

      // 2) Inyectar el CSS una sola vez (idempotente si el script se carga dos veces).
      if (!document.getElementById('mdj-mobile-header-fix-style')) {
        var style = document.createElement('style');
        style.id = 'mdj-mobile-header-fix-style';
        style.textContent = [
          '.mdj-mobile-menu-fab{display:none;position:fixed;top:14px;right:14px;height:44px;width:44px;z-index:12500;border-radius:50%;background:rgba(10,10,10,.72);border:1px solid rgba(197,160,89,.4);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);flex-direction:column;align-items:center;justify-content:center;gap:5px;cursor:pointer;padding:0;}',
          '.mdj-mobile-menu-fab span{width:20px;height:2px;background:var(--gold,#c5a059);border-radius:10px;}',
          '.mdj-mobile-brand-fab{display:none;position:fixed;top:14px;left:14px;height:44px;z-index:12500;align-items:center;gap:6px;overflow:visible;text-decoration:none;filter:drop-shadow(0 2px 6px rgba(0,0,0,.6));}',
          '.mdj-mobile-brand-fab img{height:44px;width:auto;display:block;}',
          /* El PNG de letras trae mucho relleno transparente en su propio lienzo
             (1920x1920) — el texto real ocupa una franja pequeña. El header real
             de escritorio ya resuelve esto mostrando la imagen a 276px dentro de
             una caja de 85px con overflow:visible (styles.css) — misma
             proporción (~3.2x) aplicada aquí. */
          '.mdj-mobile-brand-fab-letras{height:140px !important;width:auto !important;}',
          '@media (max-width:768px){.mdj-mobile-menu-fab{display:flex;}.mdj-mobile-brand-fab{display:flex;}}'
        ].join('\n');
        document.head.appendChild(style);
      }

      mountOrRemoveFabs();
      // FIX-DUP-HAMBURGER-BOOT-MASK (hallazgo del PO en vivo, sesión real):
      // el "boot mask" de auth (mdjApplyAuthBootMask, mdjb-shared-header.js)
      // resuelve de forma asincrónica (getSession + autodetect de nav), y
      // puede tardar bajo latencia real de red. Temporizadores ciegos
      // (setTimeout a intervalos fijos) no son deterministas: si el mask
      // sigue activo justo en el instante de cada chequeo, este script monta
      // su FAB de respaldo y no hay garantía de que un reintento posterior
      // vuelva a revisar a tiempo — dos hamburguesas reales simultáneas.
      //
      // Reemplazado por un MutationObserver: reacciona al cambio real de
      // clases/atributos del header (ej. cuando mdj-nav-booting/
      // mdj-auth-resolving se quitan, o cuando mdj-riel-toggle cambia de
      // display) en vez de adivinar cuánto tarda. Se desconecta solo a los
      // 6000ms como límite defensivo, para no dejar un observer corriendo
      // indefinidamente en cada página.
      var mdjMobileFixObserver = new MutationObserver(function () {
        mountOrRemoveFabs();
      });
      mdjMobileFixObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'style'],
        subtree: true,
        childList: true
      });
      setTimeout(function () { mdjMobileFixObserver.disconnect(); }, 6000);
    } catch (e) { /* si algo falla, el header original sigue como estaba */ }
  }

  function mountOrRemoveFabs() {
    try {
      // 3) Botón de menú independiente -- solo si NINGÚN mecanismo real
      //    (hamburguesa vieja o riel-toggle de estación) es alcanzable.
      if (isMenuReachable()) {
        var existingFab = document.getElementById('mdjMobileMenuFab');
        if (existingFab) existingFab.parentNode.removeChild(existingFab);
      } else if (!document.getElementById('mdjMobileMenuFab')) {
        var fab = document.createElement('button');
        fab.type = 'button';
        fab.id = 'mdjMobileMenuFab';
        fab.className = 'mdj-mobile-menu-fab';
        fab.setAttribute('aria-label', 'Menú');
        fab.setAttribute('aria-controls', 'mobileMenu');
        fab.setAttribute('aria-expanded', 'false');
        fab.innerHTML = '<span></span><span></span><span></span>';
        fab.addEventListener('click', function () {
          var real = document.getElementById('mobileMenuBtn');
          if (real) { real.click(); return; }
          var menu = document.getElementById('mobileMenu');
          if (menu) menu.classList.toggle('active');
        });
        document.body.appendChild(fab);
      }

      // 4) Marca independiente -- criterio propio (el riel-toggle no resuelve
      //    la visibilidad del logo, solo la del menú).
      if (isBrandReachable()) {
        var existingBrand = document.getElementById('mdjMobileBrandFab');
        if (existingBrand) existingBrand.parentNode.removeChild(existingBrand);
      } else if (!document.getElementById('mdjMobileBrandFab')) {
        var brand = document.createElement('a');
        brand.id = 'mdjMobileBrandFab';
        brand.className = 'mdj-mobile-brand-fab';
        brand.href = './index.html';
        brand.setAttribute('aria-label', 'Miami DJ Beat — ir al inicio');
        brand.innerHTML =
          '<img src="./assets/branding/logo-transparent.png" alt="Miami DJ Beat Logo">' +
          '<img src="./assets/branding/logo-transparent Letras.png" alt="Miami DJ Beat" class="mdj-mobile-brand-fab-letras">';
        document.body.appendChild(brand);
      }
    } catch (e) { /* si algo falla, el header original sigue como estaba */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
