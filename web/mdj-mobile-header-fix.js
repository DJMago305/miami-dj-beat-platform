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

      // 3) Botón de menú independiente.
      if (!document.getElementById('mdjMobileMenuFab')) {
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

      // 4) Marca independiente.
      if (!document.getElementById('mdjMobileBrandFab')) {
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
