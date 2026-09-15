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
      // FIX-NAV-TABLET-LEGIBLE (2026-09-15, orden del PO): la vuelta anterior
      // (11px sin padding) dejaba los puestos "enanos" en el centro de una
      // barra grande -- el problema no era el ANCHO de la barra, era que el
      // CONTENIDO se achicó demasiado. Se pidió 13-14px + padding real --
      // medido en vivo, 14px+8px/14px SÍ se ve legible pero ya no cabe sin
      // scroll en la página de 9 puestos (dj-profile.html, con
      // "SoundForTips™") ni siquiera en la de 8 (index.html): se salían de
      // los 972px disponibles a 1024px de ventana, cortando "MI PERFIL"/
      // "AGENTE.IA" sin ningún indicio visual de que hay más al deslizar.
      // 12px + 5px/5px fue el tamaño MÁS GRANDE que cabía entero en la
      // medición puntual de ese momento (972px de contenido en 972px
      // disponibles, dj-profile.html a 1024px).
      // FIX-NAV-TABLET-ADAPTATIVO (2026-09-15, tarde -- reporte del PO): un
      // valor fijo calculado en UN solo motor de renderizado se rompe en
      // cuanto la fuente real mide distinto en otro navegador -- el PO vio
      // ítems cortados en su Chrome real pese a la medición exacta aquí.
      // Se reemplaza por un ajuste que SE MIDE a sí mismo: prueba 13, 12,
      // 11 y 10px en orden y usa el primero que quepa entero
      // (scrollWidth<=clientWidth) en el ancho real de ESE navegador --
      // deja de depender de que el kerning coincida con esta sesión de
      // prueba. Con 10px como piso, si aun así no cupiera, la red de
      // scroll horizontal de header-unified.css (601-1220px) sigue como
      // último recurso.
      var links = document.querySelectorAll('#mainHeader.mdj-header-unified #mainNav > a');
      var navEl = document.getElementById('mainNav');

      // FIX-NAV-AIRE-LATERAL, vuelta 2 (2026-09-15, orden del PO): "alinear
      // el ancho máximo de la barra exactamente con el ancho del Hero" -- en
      // vez de adivinar un número fijo (1040px, que no correspondía a nada
      // real de la página), se MIDE el ancho real de .dj-hero en cada
      // reevaluación y se usa ESE valor. Como .dj-hero es full-bleed en la
      // mayoría de anchos (mismo ancho que el viewport), esto normalmente
      // no recorta nada -- que es correcto: el defecto real no era que la
      // barra fuera "demasiado ancha", era la tipografía enana de arriba.
      // Se mantiene la lógica por si en algún contexto (owner-tabs, sft-
      // client-view, etc.) el hero SÍ tuviera un ancho distinto al del
      // viewport -- ahí la barra lo seguiría en vez de quedar descuadrada.
      // ORDEN CRÍTICO (2026-09-15, tarde -- BUG real encontrado en vivo):
      // este bloque debe correr ANTES del loop de ajuste de fuente de
      // abajo, no después. Con el orden viejo, el loop medía clientWidth
      // contra el ancho SIN restringir (contenedor a su max-width por
      // defecto, más ancho que el Hero) en la primera pasada -- a 13px eso
      // "cabía" ahí y el loop paraba ahí mismo; al aplicarse DESPUÉS el
      // max-width real (angostando el contenedor), 13px ya no cabía y
      // quedaba atascado sin volver a recalcular. Medido en vivo: con el
      // orden viejo, sampleFontSize quedaba en 13px con overflow real
      // (scrollWidth 1010 vs clientWidth 972).
      var navContainer = document.querySelector('#mainHeader.mdj-header-unified .header-nav .container');
      var heroEl = document.querySelector('.dj-hero');
      if (navContainer) {
        // GUARDA (2026-09-15, tarde -- BUG real encontrado en vivo con el
        // gancho de document.fonts.ready): si .dj-hero todavía no tiene
        // ancho real (0px -- datos del perfil aún cargando en ese
        // instante), heroW salía 0 y max-width:0px COLAPSABA #mainNav
        // entero (medido: clientWidth caía a ~8px). Sin un ancho de Hero
        // sano, no se toca el max-width.
        var heroW = heroEl ? Math.round(heroEl.getBoundingClientRect().width) : 0;
        if (inRange && heroEl && heroW > 0) {
          navContainer.style.setProperty('max-width', heroW + 'px', 'important');
          navContainer.style.setProperty('margin-left', 'auto', 'important');
          navContainer.style.setProperty('margin-right', 'auto', 'important');
        } else {
          navContainer.style.removeProperty('max-width');
          navContainer.style.removeProperty('margin-left');
          navContainer.style.removeProperty('margin-right');
        }
      }

      // FIX-NAV-TABLET-FILA-UNICA (2026-09-15, madrugada -- ORDEN
      // PRIORITARIA del PO, revierte FIX-NAV-TABLET-REACOMODO): wrap a 2
      // líneas se veía bien en la medición inicial, pero los propios
      // timers de reintento (300/800/1500/3000/6000ms, más abajo) volvían
      // a correr después y en alguna vuelta dejaban la barra partida en
      // "pirámide" -- confirmado en vivo por el PO esperando la ráfaga
      // completa. QUEDA PROHIBIDO EL WRAP. Se vuelve al sistema anterior,
      // ya estable: loop de tamaños decrecientes (13→12→11→10px, el
      // primero que quepa entero) + scroll horizontal táctil con
      // degradado como red de seguridad para el caso extremo (768px
      // vertical, que no cabe ni a 6px de fuente) -- nunca una segunda
      // fila, nunca hamburguesa. mdjb-shared-header.js fija
      // flex-wrap:nowrap inline e incondicional (su fuente de verdad) --
      // header-unified.css ya no intenta ponerle wrap.
      if (inRange && navEl && links.length) {
        void navEl.offsetWidth;
        var fitSizes = [13, 12, 11, 10];
        for (var s = 0; s < fitSizes.length; s++) {
          for (var i = 0; i < links.length; i++) {
            links[i].style.setProperty('font-size', fitSizes[s] + 'px', 'important');
            links[i].style.setProperty('padding', '4px 3px', 'important');
            links[i].style.removeProperty('letter-spacing');
          }
          void navEl.offsetWidth;
          if (navEl.scrollWidth <= navEl.clientWidth || s === fitSizes.length - 1) break;
        }
        navEl.classList.toggle('mdj-nav-scrollable', navEl.scrollWidth > navEl.clientWidth);
      } else {
        if (navEl) navEl.classList.remove('mdj-nav-scrollable');
        for (var i2 = 0; i2 < links.length; i2++) {
          links[i2].style.removeProperty('font-size');
          links[i2].style.removeProperty('padding');
          links[i2].style.removeProperty('letter-spacing');
        }
      }

      // FIX-NAV-TABLET-COMPACTO (2026-09-15, tarde -- orden del PO):
      // "espacio muerto vertical" en la franja de navegación. .header-top
      // baja a 62px -- vale para el logo/marca en modo visitante, ya
      // escalado aparte más abajo en scaleTargets. .header-nav baja a
      // 38px (dentro del rango 34-38px pedido) -- fija SIEMPRE una sola
      // línea, así que un alto fijo es seguro (no hay caso de 2 líneas
      // que recortar).
      var rows = [
        [document.querySelector('#mainHeader.mdj-header-unified .header-top'), '62px'],
        [document.querySelector('#mainHeader.mdj-header-unified .header-nav'), '38px']
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

  // FIX-NAV-TABLET-FONT-RACE (2026-09-15, tarde -- BUG real encontrado en
  // vivo): la llamada de mdjTabletHeaderScale en DOMContentLoaded/init
  // puede correr ANTES de que Inter (la fuente real de #mainNav > a, peso
  // 700) termine de cargar -- document.fonts confirmaba "Inter 700
  // unloaded" en ese instante. El loop de ajuste de fuente mide contra el
  // ancho de la fuente de RESPALDO (más angosta), decide que un tamaño más
  // grande "cabe", y nada vuelve a medir cuando Inter real entra y el
  // texto se ensancha -- el cambio de fuente no dispara 'resize'.
  // Confirmado en vivo en dj-profile.html: sin este gancho, el tamaño
  // quedaba atascado con overflow real (scrollWidth > clientWidth); con
  // este gancho, decae al tamaño correcto en cuanto la fuente real está
  // lista.
  if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
    document.fonts.ready.then(mdjTabletHeaderScale).catch(function () {});
  }

  // FIX-NAV-TABLET-HERO-RESIZE (2026-09-15, tarde -- BUG real encontrado en
  // vivo, dj-profile.html): ni el gancho de fuentes de arriba alcanza -- si
  // document.fonts.ready resuelve ANTES de que datos async (perfil) den a
  // .dj-hero su ancho real, la guarda de heroW deja el contenedor SIN
  // restringir en ese momento, el loop de ajuste de fuente mide contra ese
  // ancho de sobra y "cabe" a un tamaño mayor, y nada vuelve a medir cuando
  // el Hero después sí toma su ancho real y lo angosta. En vez de adivinar
  // el punto exacto donde termina de cargar cada página, se observa
  // .dj-hero directamente (cuando existe -- no todas las páginas que usan
  // este script lo tienen, de ahí el chequeo): cualquier cambio real de su
  // tamaño vuelve a llamar a mdjTabletHeaderScale().
  if (typeof ResizeObserver === 'function') {
    var heroForObserve = document.querySelector('.dj-hero');
    if (heroForObserve) {
      new ResizeObserver(function () { mdjTabletHeaderScale(); }).observe(heroForObserve);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
    document.addEventListener('DOMContentLoaded', mdjTabletHeaderScale);
  } else {
    init();
    mdjTabletHeaderScale();
  }

  // FIX-NAV-TABLET-RETRY-NET (2026-09-15, tarde -- BUG real encontrado en
  // vivo en dj-profile.html): con trazas de consola, ni fonts.ready ni el
  // ResizeObserver disparan siempre a tiempo -- páginas con varias ramas
  // async (perfil, clima, geolocalización, etc.) no garantizan pasar por
  // un único punto donde el Hero ya tenga su ancho final. Llamar a
  // mdjTabletHeaderScale() a mano en cualquier momento SIEMPRE corrige de
  // inmediato (confirmado en vivo) -- es barata e idempotente, así que en
  // vez de perseguir el evento exacto correcto en cada página que use este
  // script, se reintenta unas pocas veces a intervalos crecientes. Red de
  // seguridad, no sustituye los ganchos de arriba.
  [300, 800, 1500, 3000, 6000].forEach(function (ms) {
    setTimeout(mdjTabletHeaderScale, ms);
  });
})();
