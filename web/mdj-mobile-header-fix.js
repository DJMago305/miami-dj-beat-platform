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
     cambia nada en las páginas donde nunca aparece.

     TRIPLE CANDADO (2026-09-15, orden del PO): tablet ya no oculta la barra
     real (`.header-nav`/`#mainNav`, ver header-unified.css -- el umbral
     nav↔hamburguesa volvió a ser solo-teléfono). Sin este chequeo, esta
     función seguía viendo "ningún botón de hamburguesa alcanzable" en
     tablet (ninguno de los dos existe ahí a propósito, ya no hace falta) y
     montaba su FAB de todos modos -- encima de la barra real, ya visible.
     `#mainNav` es el contenido real de `.header-nav`; si tiene tamaño, la
     barra ya es alcanzable y este failsafe no debe hacer nada. */
  function isMenuReachable() {
    return elUsable(document.getElementById('mobileMenuBtn')) ||
      elUsable(document.getElementById('mdj-riel-toggle')) ||
      elUsable(document.getElementById('mainNav'));
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

      // FIX-DUP-HAMBURGER-BACKGROUND-TAB (2026-09-13, hallazgo del PO en vivo):
      // el disconnect de arriba es un reloj de pared -- si la pestaña se
      // minimiza o pasa a segundo plano justo en esa ventana, el navegador
      // frena los timers (y la resolucion real de sesion/auth, que suele
      // tardar mas bajo esa misma condicion) y el observer puede desconectarse
      // ANTES de que el header real llegue a ser alcanzable. El FAB de
      // respaldo, montado mientras tanto, se queda huerfano encima del
      // riel-toggle real una vez la pestaña vuelve a primer plano -- dos
      // hamburguesas reales simultaneas, ninguna "mal hecha".
      //
      // Sin timers nuevos: un solo listener de `visibilitychange`, permanente
      // (no depende del observer ni de sus 6000ms), que re-evalua en el
      // instante exacto en que el usuario vuelve a mirar la pestaña --
      // gratis, guiado por evento real, no por reloj.
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) mountOrRemoveFabs();
      });
    } catch (e) { /* si algo falla, el header original sigue como estaba */ }
  }

  function mountOrRemoveFabs() {
    try {
      // Reevalúa también el achicado de tablet en cada disparo de esta
      // función (observer de clases/atributos, visibilitychange) -- cubre
      // páginas donde el modo del header (estación/visitante) resuelve de
      // forma asíncrona después de la carga inicial.
      mdjTabletHeaderScale();

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

  /* FIX-TABLET-HEADER-SCALE-DOWN (2026-09-15, orden del PO): tablets deben
     ver la barra real (ya lo hacen, ver header-unified.css -- el corte
     nav↔hamburguesa volvió a ser solo-teléfono) pero ACHICADA para que 9-10
     puestos quepan sin deslizar, no a tamaño de escritorio con scroll.

     Por qué esto es JS y no CSS: se intentó primero como reglas normales en
     header-unified.css (tokens --mdj-nav-font-size/--mdj-header-unified-r1
     y r2, y selectores directos con !important sobre #mainNav > a /
     .header-top / .header-nav). Verificado exhaustivamente por consola que
     esas reglas eran las ÚNICAS activas que hacían match (sin otra regla de
     mayor especificidad ni media query compitiendo en ese rango) -- y aun
     así no se pintaban. Un estilo puesto por JS directo sobre cada elemento
     SÍ se pinta (confirmado en vivo), así que el achicado real vive aquí.

     window.innerWidth, no matchMedia: se reevalúa a mano en cada resize,
     así que un booleano simple alcanza. 601-1220px es el mismo rango que
     header-unified.css usa para el scroll de seguridad de la barra (ver
     "INTERCAMBIO NAV↔HAMBURGUESA" en ese archivo) -- mismo tramo, no un
     número nuevo. Los tres targets son #mainNav > a (tipografía), y
     .header-top / .header-nav (alto de ambas filas) -- 62/52px conservan
     la misma proporción que 84/72px de escritorio, solo más compactos. */
  function mdjTabletHeaderScale() {
    try {
      var inRange = window.innerWidth >= 601 && window.innerWidth <= 1220;
      var links = document.querySelectorAll('#mainHeader.mdj-header-unified #mainNav > a');
      for (var i = 0; i < links.length; i++) {
        if (inRange) {
          links[i].style.setProperty('font-size', '11px', 'important');
          // 0.14em de letter-spacing (tamaño de escritorio) en 8-9 puestos
          // suma varias decenas de px por sí solo -- se acorta junto con
          // la tipografía para que quepan sin deslizar.
          links[i].style.setProperty('letter-spacing', '0.02em', 'important');
        } else {
          links[i].style.removeProperty('font-size');
          links[i].style.removeProperty('letter-spacing');
        }
      }
      // FIX-NAV-AIRE-LATERAL (2026-09-15): con la tipografía de arriba ya
      // compacta, los 8-9 puestos ocupan mucho menos que el ancho real de
      // la barra en tablet/escritorio medio -- quedaba un margen negro
      // grande y parejo a cada lado en vez de aprovechado. Mismo intento
      // que con el achicado: primero como CSS normal en header-unified.css
      // (max-width + justify-content:space-evenly, mismo selector que ya
      // funciona para otras reglas de ese archivo) -- confirmado en vivo
      // que NO se pintaba, mismo patrón que el resto de esta función. Va
      // por JS directo, igual que todo lo demás aquí.
      var navContainer = document.querySelector('#mainHeader.mdj-header-unified .header-nav .container');
      var mainNavEl = document.querySelector('#mainHeader.mdj-header-unified #mainNav');
      if (navContainer) {
        if (inRange) {
          navContainer.style.setProperty('max-width', '1040px', 'important');
          navContainer.style.setProperty('margin-left', 'auto', 'important');
          navContainer.style.setProperty('margin-right', 'auto', 'important');
        } else {
          navContainer.style.removeProperty('max-width');
          navContainer.style.removeProperty('margin-left');
          navContainer.style.removeProperty('margin-right');
        }
      }
      if (mainNavEl) {
        if (inRange) {
          mainNavEl.style.setProperty('justify-content', 'space-evenly', 'important');
        } else {
          mainNavEl.style.removeProperty('justify-content');
        }
      }

      var rows = [
        [document.querySelector('#mainHeader.mdj-header-unified .header-top'), '62px'],
        [document.querySelector('#mainHeader.mdj-header-unified .header-nav'), '52px']
      ];
      for (var j = 0; j < rows.length; j++) {
        var el = rows[j][0], px = rows[j][1];
        if (!el) continue;
        if (inRange) {
          el.style.setProperty('min-height', px, 'important');
          el.style.setProperty('max-height', px, 'important');
          el.style.setProperty('height', px, 'important');
        } else {
          el.style.removeProperty('min-height');
          el.style.removeProperty('max-height');
          el.style.removeProperty('height');
        }
      }

      // FIX-TABLET-HEADER-SCALE-DOWN, parte 2 (2026-09-15, hallazgo del PO
      // en vivo): bajar el ALTO de .header-top a 62px no encogía el
      // CONTENIDO de adentro (logo 72px, wordmark 104px, botón SALIR,
      // avatar+nombre, carrito, buscador -- todos a medida de escritorio),
      // así que quedaba viéndose igual de grande dentro de una caja más
      // baja. Mismo criterio que arriba: tamaño real puesto por JS sobre
      // cada pieza, no la caja que las contiene.
      var scaleTargets = [
        ['.logo-img-eagle', {height: '38px', width: '38px'}],
        ['.brand-letters-img', {height: '58px', width: '58px'}],
        ['.brand-letters-wrapper', {height: '38px'}],
        ['#header-login-btn', {fontSize: '10px', padding: '5px 10px'}],
        ['.lang-switcher', {fontSize: '10px', height: '22px'}],
        ['.mdj-avatar-slot', {height: '30px', width: '30px'}],
        ['.mdj-account-display-name', {fontSize: '10px'}],
        ['.header-cart-btn', {height: '30px', width: '30px'}],
        ['.header-smart-search', {height: '26px', fontSize: '11px', width: '90px'}]
      ];
      for (var k = 0; k < scaleTargets.length; k++) {
        var sel = scaleTargets[k][0], props = scaleTargets[k][1];
        var els = document.querySelectorAll(sel);
        for (var m = 0; m < els.length; m++) {
          for (var prop in props) {
            if (inRange) els[m].style.setProperty(prop.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }), props[prop], 'important');
            else els[m].style.removeProperty(prop.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }));
          }
        }
      }
    } catch (e) { /* si algo falla, el header original sigue como estaba */ }
  }
  window.addEventListener('resize', mdjTabletHeaderScale);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
    document.addEventListener('DOMContentLoaded', mdjTabletHeaderScale);
  } else {
    init();
    mdjTabletHeaderScale();
  }
})();
