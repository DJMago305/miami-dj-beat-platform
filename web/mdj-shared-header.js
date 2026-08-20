/**
 * Miami DJ Beat — shared top header behavior (session, cart, search, mobile, nav highlight).
 * Load after: supabase CDN, supabase-config.js, header-smart-search.js (optional), translations/i18n (optional).
 * En DOMContentLoaded: `./js/mdj-ambient-music.js` (música) y `./js/mdj-videos-force-mute.js` (vídeos mudos).
 * Omitir música: MDJ_SKIP_AMBIENT_MUSIC o data-mdj-no-ambient. Omitir mute vídeos: MDJ_SKIP_FORCE_MUTE_VIDEOS o data-mdj-no-force-mute-videos.
 *
 * OMNIPRESENCE: cuando existe `#mainHeader`, este script es el **único** dueño de ENTRAR/SALIR (y zona VIP)
 * en `#header-login-btn` / `#header-login-btn-mobile`. `checkSessionForNav()` usa `supabase.auth.getSession()`
 * al cargar y en `onAuthStateChange`. `window.doLogout` limpia sesión y envía al Home.
 */
(function () {
  'use strict';
  console.info('[Header] build 20260817-header-canonico');

  /* ══ MDJB 2026-08-16 · NORMALIZADOR DE SLOTS CANÓNICOS ══════════════════════
     #mainNav se declara a mano en 44 páginas y había derivado a 5 variantes con
     entre 0 y 12 hijos: 17 páginas con 8, una con 9, veinte con 10, cinco con 12.
     Eso es la causa real de que la barra cambie al navegar, y lo que impide una
     rejilla fija — los sobrantes caen a una segunda fila que overflow:hidden tapa.

     A partir de aquí el header GOBIERNA la barra: deja exactamente los 8 slots
     canónicos, en orden, cada uno marcado con data-mdj-slot="1..8" para que el CSS
     pueda direccionarlos por posición sin depender del HTML de cada página.

     No reescribe los <a> existentes: los reutiliza tal cual (conserva href, clases
     e ids propios de cada página) y sólo los reordena. Crea los que falten y retira
     los que no son canónicos. Idempotente: correr dos veces no cambia nada.
     Corre antes que cualquier otro pase de navegación. */
  var MDJ_NAV_SLOTS = [
    { s: 1, key: 'nav-home',     nav: 'home',      href: './index.html',   txt: 'Inicio' },
    { s: 2, key: 'nav-services', nav: 'services',  href: './rentals.html', txt: 'Servicios' },
    { s: 3, key: 'nav-rentals',  nav: 'venues',    href: './events.html',  txt: 'Eventos' },
    { s: 4, key: 'nav-shop',     nav: 'shop',      href: './shop.html',    txt: 'Shop',
      alias: ['shop'] },
    /* href = respaldo para el rol mas comun de la vitrina (artista). El destino
       real lo fija mdjResolveConfigHref() en cada pasada; ver FIX-NAV-CONFIG-01. */
    { s: 5, key: 'nav-config',   nav: 'config',    href: './account-profile.html', txt: '⚙️ CONFIG',
      id: 'mainNav-config-link', cls: 'mdj-config-mainnav mdj-mainnav-reserved-slot', reserved: true },
    { s: 6, key: 'nav-jobs',     nav: 'jobs',      href: './jobs.html',    txt: 'Trabajos' },
    { s: 7, key: 'nav-contact',  nav: 'contact',   href: './contact.html', txt: 'Contacto' },
    /* Decisión PO 2026-08-16: MI PERFIL es la etiqueta ÚNICA del slot 8 para todos
       los roles. MI PORTAL se elimina del producto. El texto nunca cambia; cambia el
       destino: cliente→su cuenta, artista→su portal, staff→staff, invitado→login. */
    { s: 8, key: 'nav-my-profile', nav: 'mi-portal', href: './login.html',  txt: 'MI PERFIL',
      id: 'mainNav-mi-portal-link', cls: 'mdj-mi-portal-mainnav mdj-mi-portal-gold',
      alias: ['mi-portal', 'header-mi-portal'], navAlias: ['my-profile', 'profile'] },
    /* Slot 9 · MRM IA — Master Road Map IA (decisión PO 2026-08-16). Visible para
       todos los roles:
       el mapa se adapta a quien entra y enseña sólo lo que a ese rol le compete. */
    { s: 9, key: 'nav-roadmap',  nav: 'roadmap',   href: './road-map.html', txt: 'MRM IA',
      id: 'mainNav-roadmap-link', cls: 'mdj-roadmap-mainnav' }
  ];

  /* ══ JUEGO INTERNO DEL SISTEMA (decisión PO 2026-08-19) ══════════════════════
     Las vistas internas no son la vitrina: no deben ofrecer Servicios, Eventos,
     Shop, Trabajos ni Contacto, sino las herramientas del sistema.

     Ni los rótulos ni las rutas se inventan: se copian de la tira que staff.html
     ya pinta para el rol owner. Las cuatro entradas que allí son conmutadores de
     vista sin URL propia (Agenda, Cash Flow, Fénix AI, Staff) apuntan aquí al
     archivo literal que ese portal carga en cada una — staff.html no admite
     enlace profundo, así que no hay forma de apuntar a la vista, solo al origen.

     MI PERFIL SE QUEDA EN EL PUESTO 8, y es deliberado: el resolvedor de su
     destino y el bloque que fija su etiqueta direccionan por número de slot.
     Moverlo al 7 —el orden que pedía la lista original— obligaría a desacoplar
     ese punto único de verdad en las once vistas a la vez. Se difiere a la fase
     de atributos semánticos (data-nav-action), ya acordada.

     Consecuencia conocida: para owner el resolvedor manda MI PERFIL a
     staff.html, el mismo destino que el puesto 9. Para artista y cliente no hay
     solape (van a su perfil o a su cuenta), y a ellos el puesto 9 ni se les
     muestra. Se acepta hasta el desacoplamiento.

     Las claves nav-agenda, nav-flow y nav-fenix NO existen en translations.js;
     esas tres entradas van sin data-i18n a propósito, para que i18n no les vacíe
     el rótulo al pasar. ════════════════════════════════════════════════════════ */
  var MDJ_NAV_SLOTS_INTERNO = [
    { s: 1, key: 'nav-home',       nav: 'home',      href: './index.html',        txt: 'Inicio' },
    { s: 2, key: 'nav-academia',   nav: 'academia',  href: './academia.html',     txt: 'Academia' },
    { s: 3, key: null,             nav: 'agenda',    href: './staff-agenda.html', txt: 'Agenda' },
    { s: 4, key: 'nav-config',     nav: 'config',    href: './account-settings.html', txt: '⚙️ Config',
      id: 'mainNav-config-link', cls: 'mdj-config-mainnav' },
    { s: 5, key: 'nav-tools',      nav: 'tools',     href: './dj-tools.html',     txt: 'DJ Tools' },
    { s: 6, key: null,             nav: 'flow',      href: './staff-agenda.html?tab=flow', txt: 'Cash Flow' },
    { s: 7, key: null,             nav: 'fenix',     href: './elixis-console.html', txt: 'Fénix AI' },
    { s: 8, key: 'nav-my-profile', nav: 'mi-portal', href: './account-settings.html', txt: 'MI PERFIL',
      id: 'mainNav-mi-portal-link', cls: 'mdj-mi-portal-mainnav mdj-mi-portal-gold',
      alias: ['mi-portal', 'header-mi-portal'], navAlias: ['my-profile', 'profile'] },
    /* Puesto 9 · STAFF. Lleva la clase del gate determinista por rol que ya usa
       la tira de owner: artista, cliente e invitado no lo ven. Sigue pendiente
       el requisito pleno de la ley RBAC —sacarlo del DOM, no solo ocultarlo. */
    { s: 9, key: 'nav-staff',      nav: 'staff',     href: './staff.html',        txt: 'Staff',
      id: 'mainNav-staff-or-profile', cls: 'mdj-staff-mainnav dj-tab-btn--staff-only' }
  ];

  /* ══ ESTACION DE TRABAJO DEL ARTISTA ═══════════════════════════════════════
     Ley constitucional PO 2026-08-20: MI PERFIL lleva a la estacion de trabajo
     PROPIA DEL ROL, nunca a la barra publica. Staff tiene la suya; el artista
     tiene ESTA, separada, y SoundForTips vive aqui. Unica salida: Log Out o
     Inicio.

     Ni un rotulo ni una ruta se inventan: se recuperan literalmente del
     #owner-tabs que ya vivia en dj-profile.html —incluidos Jobs y Shop— porque
     la orden fue recuperar lo que ya estaba pensado, no rehacerlo de cero. Se
     conserva ademas el sufijo ?mdj_nav=profile de cada enlace, que es lo que
     mantiene al artista «dentro» al saltar de pagina.

     UNICA baja respecto al set viejo: STAFF. La ley RBAC prohibe que ese puesto
     exista siquiera en el DOM de una cuenta de artista, asi que se retira por
     regla, no por criterio.

     Tres puestos no son paginas sino PESTAÑAS de la propia vista (flow, sft,
     public). No se reimplementa su logica: el puesto delega el clic en el boton
     que ya existe en #owner-tabs, que sigue en el DOM aunque este oculto. Asi la
     franja se queda congelada e intacta, como exige .cursorrules. */
  /* La tuerca lleva SELECTOR DE VARIACION (U+FE0F), igual que la barra de Inicio.
     Sin el, el sistema la dibuja como glifo de texto y no como emoji: medido a
     igual cuerpo de letra, 14.8px de ancho frente a los 22.8 de la publica. Se
     copia el glifo que ya usa la plataforma, no se inventa un tamaño. */
  var MDJ_NAV_SLOTS_ARTISTA = [
    { s: 1,  key: 'nav-home',       nav: 'home',      href: './index.html', txt: 'Inicio' },
    { s: 2,  key: 'nav-academia',   nav: 'academia',  href: './academia.html?mdj_nav=profile', txt: 'Academia' },
    { s: 3,  key: null,             nav: 'agenda',    href: './dj-dashboard.html?mdj_nav=profile', txt: 'Agenda' },
    { s: 4,  key: 'nav-config',     nav: 'config',    href: './account-settings.html?mdj_nav=profile', txt: '⚙️ Config',
      id: 'mainNav-config-link', cls: 'mdj-config-mainnav' },
    { s: 5,  key: 'nav-tools',      nav: 'tools',     href: './dj-tools.html?mdj_nav=profile', txt: 'DJ Tools' },
    { s: 6,  key: null,             nav: 'flow',      href: '#', txt: 'Cash Flow',      tab: 'flow' },
    { s: 7,  key: null,             nav: 'sft',       href: '#', txt: 'SoundForTips™',  tab: 'sft'  },
    /* MI PERFIL se queda en el puesto 8: su resolvedor de destino y el bloque que
       fija su etiqueta direccionan por numero de slot. */
    { s: 8,  key: 'nav-my-profile', nav: 'mi-portal', href: '#', txt: 'MI PERFIL',      tab: 'public',
      id: 'mainNav-mi-portal-link', cls: 'mdj-mi-portal-mainnav mdj-mi-portal-gold',
      alias: ['mi-portal', 'header-mi-portal'], navAlias: ['my-profile', 'profile'] },
    /* Trabajos NO vive aqui (orden del PO 2026-08-19): pertenece al menu de
       Inicio, la vitrina publica, donde ya ocupa su puesto 6. Shop sube del 10 al
       9, con lo que la estacion queda en NUEVE puestos y MI PERFIL no se mueve
       del 8 — que es donde su resolvedor de destino y su etiqueta lo buscan, por
       numero de slot. */
    { s: 9,  key: 'nav-shop',       nav: 'shop',      href: './shop.html?mdj_nav=profile', txt: 'Shop' }
  ];

  /* Dueño del perfil que se esta mirando. Se calcula con senales que el header
     ya tiene, sin pedirle nada a la pagina: hay sesion, no es la vista de QR, y
     o no viene ?id= —perfil propio— o el ?id= coincide con el uid propio. */
  /* EL ROSTER DEL ARTISTA, EN UN SOLO SITIO. Mismo criterio que role-guard.js:
     artist, dj y talent son la misma persona. Se mira tambien la clase porque una
     sesion puede traer el atributo sin ella. */
  function mdjEsArtistaEnVivo() {
    try {
      var b = document.body;
      if (!b) return false;
      var rol = (b.getAttribute('data-mdj-nav-role') || '').toLowerCase().trim();
      return !!(b.classList.contains('mdj-artist-nav') ||
                rol === 'artist' || rol === 'dj' || rol === 'talent');
    } catch (eArt) { return false; }
  }
  window.mdjEsArtistaEnVivo = mdjEsArtistaEnVivo;

  /* LAS VISTAS DEL PORTAL DEL ARTISTA. Lista explicita, igual que la del staff:
     son los DESTINOS DEL PROPIO RIEL, las pantallas donde el artista sigue dentro
     de su estacion de trabajo.

     index.html queda FUERA a proposito (orden del PO): Inicio es la salida a la
     vitrina publica y conserva su cabecera completa. */
  var MDJ_VISTAS_ARTISTA = {
    'dj-profile.html': 1,
    'academia.html': 1,
    'dj-dashboard.html': 1,
    'account-settings.html': 1,
    'dj-tools.html': 1
    /* shop.html NO figura: no es una vista nuestra, redirige a la tienda de
       Shopify. Comprobado en vivo — el riel sale de la plataforma por ese puesto,
       igual que por Inicio. La lista solo admite destinos que conserven la barra. */
  };

  /* UNA SOLA FUENTE DE VERDAD PARA EL MENU. Antes la estacion existia en UNA sola
     pantalla —mdjEsDuenoDelPerfil() devuelve false en cuanto la pagina no es
     dj-profile.html—, asi que en academia, dj-tools y las demas al artista le
     servian la barra publica: 9 puestos con Servicios, Eventos, Contacto y MRM IA,
     y Shop en el puesto 4 en vez del 10. Dos barras distintas para la misma
     persona, medido en vivo el 2026-08-19.

     Se exige rol de ARTISTA, no solo sesion: con «hay sesion y no es staff» un
     cliente recibiria DJ Tools, Cash Flow y SoundForTips. */
  function mdjEnPortalArtista() {
    try {
      var pagina = String(window.location.pathname || '').split('/').pop().toLowerCase();
      if (!MDJ_VISTAS_ARTISTA[pagina]) return false;
      if (new URLSearchParams(window.location.search || '').get('view') === 'public') return false;
      if (mdjEsStaffEnVivo()) return false;
      if (!mdjEsArtistaEnVivo()) return false;
      if (!String(window.__mdjNavOwnUserId || '').trim()) return false;   // sin sesion resuelta, nada
      if (pagina === 'dj-profile.html') return mdjEsDuenoDelPerfil();     // en el de otro, es visitante
      return true;
    } catch (ePortal) { return false; }
  }
  window.mdjEnPortalArtista = mdjEnPortalArtista;

  /* EL MISMO TRATO PARA EL STAFF (orden del PO 2026-08-19): mismo proceso, mismo
     diseño. Las vistas internas ya estaban declaradas en MDJ_VISTAS_INTERNAS; lo
     que faltaba era que tambien recibieran la estacion —barra arriba sola, marca
     y buscador flotando debajo— en vez de la cabecera de dos filas.

     staff.html NO entra: no tiene #mainHeader, usa su tira nativa #staff-topnav.
     Aplicarle esto exigiria rehacer esa tira, que es otro trabajo. */
  function mdjEnPortalStaff() {
    try {
      var pagina = String(window.location.pathname || '').split('/').pop().toLowerCase();
      if (!MDJ_VISTAS_INTERNAS[pagina]) return false;
      if (new URLSearchParams(window.location.search || '').get('view') === 'public') return false;
      if (!mdjEsStaffEnVivo()) return false;
      return !!String(window.__mdjNavOwnUserId || '').trim();
    } catch (eSt) { return false; }
  }
  window.mdjEnPortalStaff = mdjEnPortalStaff;

  /* Una sola puerta para el trato de estacion, sea de artista o de staff. */
  function mdjEnEstacionDeTrabajo() {
    return mdjEnPortalArtista() || mdjEnPortalStaff();
  }
  window.mdjEnEstacionDeTrabajo = mdjEnEstacionDeTrabajo;

  /* LA MARCA DEBE SEÑALAR DONDE ESTAS. Auditado puesto por puesto: index marca
     Inicio, academia marca Academia, dj-tools marca DJ Tools, la agenda marca
     Agenda y config marca CONFIG. El unico que no marcaba NADA era el propio
     perfil, donde ademas el dorado caia en Shop, que no es la pagina actual.

     El perfil no navega entre paginas sino entre pestañas internas, asi que la
     marca sigue a la pestaña visible: publica → MI PERFIL, flow → Cash Flow,
     sft → SoundForTips. Se lee el panel que esta a la vista, no la URL, porque
     dentro del perfil se conmuta sin tocar la direccion. */
  function mdjMarcarPuestoActivo() {
    try {
      var pagina = String(window.location.pathname || '').split('/').pop().toLowerCase();
      if (pagina !== 'dj-profile.html' || !mdjEnPortalArtista()) return;
      var nav = document.getElementById('mainNav');
      if (!nav) return;
      var visible = null;
      ['public', 'flow', 'sft'].forEach(function (t) {
        var p = document.getElementById('tab-' + t);
        if (p && getComputedStyle(p).display !== 'none') visible = t;
      });
      if (!visible) return;
      var puestos = nav.querySelectorAll('[data-mdj-slot]');
      for (var i = 0; i < puestos.length; i++) {
        var esteTab = puestos[i].getAttribute('data-mdj-tab');
        if (esteTab === visible) puestos[i].classList.add('active');
        else puestos[i].classList.remove('active');
      }
    } catch (eMarca) { /* noop */ }
  }
  window.mdjMarcarPuestoActivo = mdjMarcarPuestoActivo;

  /* Y que la marca acompañe al usuario cuando conmuta dentro del perfil: se
     envuelve el conmutador de la pagina en vez de duplicar su logica. */
  (function engancharConmutador() {
    var intentos = 0;
    var iv = setInterval(function () {
      if (typeof window.switchProfileTab === 'function' && !window.switchProfileTab.__mdjMarca) {
        var original = window.switchProfileTab;
        var envuelto = function () {
          /* LEY DE ESTABILIDAD VISUAL · ANTI-BRINCO.
             Medido en el perfil: con la vista desplazada a 300 y el panel corto
             entrando, el documento pasaba de 1561 a 1000 px y el navegador
             CLAMPABA el scroll de 300 a 0 en el mismo instante. Ese tiron
             involuntario es el «disparo» que reporta el PO.
             switchProfileTab no desplaza a proposito: el salto lo provoca el
             propio navegador al quedarse la pagina mas corta que la posicion
             actual. Y con el panel corto el scroll maximo es 0, asi que el
             clampeo es inevitable si no se coloca la vista ANTES.
             Se sube al inicio del area de pestañas antes de conmutar. El
             movimiento pasa a ser deliberado y previo; en el instante del cambio
             el desplazamiento involuntario es cero. No se toca el tamaño de
             ningun contenedor. */
          try {
            if (window.pageYOffset > 0) {
              /* INSTANTANEO, nunca suave. Una animacion de scroll corriendo a la
                 vez que el panel cambia de alto es precisamente la carrera que
                 produce el acordeon: el documento encoge a mitad de animacion y
                 el navegador vuelve a clampar. Colocar primero y de golpe deja
                 el cambio de contenido sin ningun movimiento pendiente. */
              window.scrollTo(0, 0);
            }
          } catch (eScroll) { void eScroll; }
          var r = original.apply(this, arguments);
          setTimeout(mdjMarcarPuestoActivo, 0);
          return r;
        };
        envuelto.__mdjMarca = true;
        window.switchProfileTab = envuelto;
        clearInterval(iv);
      }
      if (++intentos > 60) clearInterval(iv);
    }, 100);
  })();

  /* DESTINO DE UN PUESTO. Los puestos-PESTAÑA (Cash Flow, SoundForTips) traen
     href '#' porque dentro del perfil conmutan sin navegar. Fuera del perfil ese
     '#' dejaba el clic muerto: medido en dj-tools.html, pulsarlos solo añadia '#'
     a la URL. Fuera se les da destino real —el perfil con la pestaña pedida—, que
     dj-profile.html ya sabe leer de ?tab=.
     'public' queda fuera: MI PERFIL tiene su propio resolvedor, que ademas le
     añade el id del artista. */
  function mdjHrefDeSlot(def) {
    try {
      if (!def || !def.tab || def.tab === 'public') return def && def.href;
      var pagina = String(window.location.pathname || '').split('/').pop().toLowerCase();
      if (pagina === 'dj-profile.html') return def.href;
      return './dj-profile.html?mdj_nav=profile&tab=' + encodeURIComponent(def.tab);
    } catch (eH) { return def && def.href; }
  }

  function mdjEsDuenoDelPerfil() {
    try {
      var pagina = String(window.location.pathname || '').split('/').pop().toLowerCase();
      if (pagina !== 'dj-profile.html') return false;
      var q = new URLSearchParams(window.location.search || '');
      if (q.get('view') === 'public') return false;          // QR de SoundForTips: caso aparte
      /* El owner NO monta estaciones de DJ. Aunque su perfil sea «suyo», pertenece
         al edificio Staff y no debe inicializar nada del lado del catalogo de
         artistas. Esto es el cinturon; el tirante es el redirect de abajo, que se
         lo lleva de aqui. Si el redirect tardara —la sesion resuelve tarde—, esta
         linea garantiza que entretanto no se le monte la estacion equivocada. */
      if (mdjEsStaffEnVivo()) return false;
      var uid = String(window.__mdjNavOwnUserId || '').trim();
      if (!uid) return false;                                 // sin sesion no hay dueño
      var id = (q.get('id') || '').trim();
      return !id || id === uid;
    } catch (eDueno) { return false; }
  }

  /* Vistas que montan el juego interno. Lista explícita y no por rol: el owner
     también navega la vitrina pública (index, shop, contacto) y allí la barra
     debe seguir siendo la pública. Una página puede además pedirlo por su
     cuenta con <body data-mdj-contexto="interno">.

     La lista son los DESTINOS DEL PROPIO JUEGO INTERNO. Si la barra interna
     lleva a una página que a su vez pinta la vitrina pública, el usuario sale
     del portal sin haberlo pedido: es la inconsistencia que reportó el PO en
     dj-tools.html. Cada puesto debe aterrizar en una vista que conserve la
     misma barra. staff.html no entra porque no tiene #mainHeader: usa su tira
     nativa #staff-topnav, que ya es este mismo juego.

     Quedan fuera a conciencia:
       · staff-agenda.html y staff-config.html — se incrustan como iframe en el
         portal y no pintan #mainHeader; no hay barra que cambiar.
       · elixis-console.html — sin verificar en vivo. */
  var MDJ_VISTAS_INTERNAS = {
    'academia.html': 1,
    'dj-tools.html': 1
  };

  /* El juego interno exige DOS condiciones, no una: que la pagina sea interna
     Y que quien mira sea staff.

     Faltaba la segunda, y en Vista Cero se veia el fallo: un INVITADO abria
     academia.html o dj-tools.html y recibia la barra del sistema entera, con
     Staff, Agenda, Cash Flow y Fenix AI. Rutas de staff ofrecidas a quien no
     ha iniciado sesion. Ademas descuadraba la barra: 116px de sangria frente
     a los 85 del resto, o sea un brinco visible al cambiar de pantalla.

     El rol llega cuando resuelve la sesion, asi que en la primera pasada un
     owner vera el juego publico y en la siguiente el interno. Se acepta a
     proposito: es preferible que un owner note un cambio a que un invitado
     vea rutas que no le pertenecen. */
  function mdjEsStaffEnVivo() {
    var b = document.body;
    if (!b) return false;
    var rol = (b.getAttribute('data-mdj-nav-role') || '').toLowerCase().trim();
    if (rol === 'management' || rol === 'seller') return true;
    return b.classList.contains('mdj-staff-nav') && !b.classList.contains('mdj-artist-nav');
  }

  function mdjTablaDeSlots() {
    try {
      /* El artista en SU perfil recibe su estacion de trabajo. Va ANTES del
         filtro de staff: un artista no es staff, y con esa comprobacion por
         delante nunca llegaria aqui. */
      if (mdjEnPortalArtista()) return MDJ_NAV_SLOTS_ARTISTA;
      if (!mdjEsStaffEnVivo()) return MDJ_NAV_SLOTS;
      var pagina = String(window.location.pathname || '').split('/').pop().toLowerCase();
      if (MDJ_VISTAS_INTERNAS[pagina]) return MDJ_NAV_SLOTS_INTERNO;
      if (document.body && document.body.getAttribute('data-mdj-contexto') === 'interno') {
        return MDJ_NAV_SLOTS_INTERNO;
      }
    } catch (eTabla) { /* noop */ }
    return MDJ_NAV_SLOTS;
  }

  /* Señal pública para los pases propios de cada página. El bloque en linea
     "Vista Cero" que viven en dj-tools, login y services restaura la barra de
     INVITADO: quita tools / mi-portal / staff e inyecta Eventos y un segundo
     MI PERFIL. Contra el juego interno eso desmonta los puestos 5, 8 y 9, y
     como se reejecuta en siete temporizadores y dos MutationObserver, siempre
     ganaba al normalizador. Con esto puede apartarse solo, sin que haya que
     duplicar aqui la lista de vistas internas. */
  window.mdjUsaJuegoInterno = function () {
    return mdjTablaDeSlots() === MDJ_NAV_SLOTS_INTERNO;
  };

  /* ── Resolvedor ÚNICO del destino de MI PERFIL (decisión PO 2026-08-16) ──
     El texto del slot 8 nunca cambia; cambia a dónde lleva:
       owner / staff  → ./staff.html         (ahí viven Academia, DJ Tools,
                                              Staff, Cash Flow y Fénix AI)
       artista        → ./dj-profile.html?id=<uid>
       cliente        → ./client-portal.html
       invitado       → ./login.html
     Un solo punto de verdad: cambiar el destino es cambiar esta función. */
  function mdjResolveMiPerfilHref() {
    var b = document.body;
    var role = (b && b.getAttribute('data-mdj-nav-role') || '').toLowerCase().trim();
    var uid = String(window.__mdjNavOwnUserId || '').trim();
    var esStaff = role === 'management' || role === 'seller' ||
      (b && b.classList.contains('mdj-staff-nav') && !b.classList.contains('mdj-artist-nav'));
    /* DOS SENALES PARA LO MISMO, y aqui solo se escuchaba una. El artista se
       reconoce por la clase mdj-artist-nav O por data-mdj-nav-role, que trae
       'artist' | 'dj' | 'talent' segun de donde venga resuelto el rol.
       Mirando solo la clase, una sesion de artista con el atributo puesto pero
       sin la clase caia en la rama de CLIENTE: medido en vivo con djmago305
       (rol dj/PRO), CONFIG apuntaba a client-account.html y MI PERFIL a
       client-portal.html en las seis vistas. Destinos de otra categoria.
       El roster es el mismo —artist, dj y talent son la misma persona— tal y
       como ya lo trata role-guard.js. */
    var esArtista = !!(b && (b.classList.contains('mdj-artist-nav') ||
      role === 'artist' || role === 'dj' || role === 'talent'));
    /* Aterriza en la vista de perfil del portal, no en su portada. Antes caia en
       'gobernanza' y el owner no veia su ficha por ningun lado, aunque estuviera
       cargada y oculta ahi mismo. */
    if (esStaff) return './staff.html?vista=miperfil';
    if (esArtista) return uid ? './dj-profile.html?id=' + encodeURIComponent(uid) : './dj-profile.html';
    if (uid) return './client-portal.html';
    return './login.html';
  }

  /* Se normaliza CUALQUIER riel de navegación, no sólo #mainNav. En ventanas
     estrechas entra en juego #mainNav-artist, que traía DJ Tools y Staff — dos
     pestañas que la Opción A sacó del header. Si sólo se gobierna #mainNav, al
     reducir la ventana reaparecen. */
  /* CORRECCIÓN: sólo se NORMALIZA #mainNav. Al normalizar también los rieles
     alternativos, el blindaje inline les ponía display:grid y los resucitaba —
     de ahí el doble menú. Los alternativos no se normalizan: se ocultan. */
  var MDJ_RIELES = ['mainNav'];
  var MDJ_RIELES_MUERTOS = ['mainNav-artist', 'mobile-nav', 'owner-tabs'];


  /* ══ DESTINO DE MI PERFIL · RESOLUCIÓN EN EL CLIC ═══════════════════════════
     Calcularlo al cargar es inherentemente frágil: el rol y el uid llegan cuando
     la sesión resuelve, después de las primeras pasadas del header. Si el enlace
     se congela antes, apunta a dj-profile.html SIN ?id=, y el guard del perfil
     —que trata la ausencia de id como "perfil propio"— expulsa al login aunque
     la cabecera ya muestre al usuario dentro.

     Aquí se resuelve EN EL MOMENTO DEL CLIC, consultando la sesión y el rol en
     vivo. En ese instante la sesión existe con certeza, así que no hay carrera
     posible. El href estático se mantiene como respaldo para "abrir en pestaña
     nueva" y se refresca en segundo plano cuando la sesión cambia.

     Para artista se incluye SIEMPRE ?id=<uid>: con ese parámetro el guard del
     perfil hace short-circuit y no vuelve a comprobar sesión. */
  /* Estado de sesión cacheado. CONFIG debe verse en cuanto hay sesión, y su
     visibilidad no puede depender de la clase heredada mdj-mainnav-reserved-slot,
     que otros pases reponen. Se consulta en vivo y se recuerda. */
  var _mdjHaySesion = null;                       // null = aún no se sabe
  var _mdjOrigenBuscador = null;                  // hueco del buscador antes de moverlo
  var _mdjRotuloBuscador = null;                  // su rotulo original, para devolverlo
  function mdjRefrescarSesion() {
    var supa = (typeof window.getSupabaseClient === 'function') ? window.getSupabaseClient() : null;
    if (!supa) return;
    try {
      supa.auth.getSession().then(function (r) {
        var hay = !!(r && r.data && r.data.session);
        if (hay !== _mdjHaySesion) { _mdjHaySesion = hay; _mdjSlotRuns = 0; mdjAssertNavSlots(); }
      }).catch(function () {});
      if (!window.__mdjSesionHook) {
        window.__mdjSesionHook = true;
        supa.auth.onAuthStateChange(function (_e, ses) {
          _mdjHaySesion = !!ses; _mdjSlotRuns = 0;
          setTimeout(mdjAssertNavSlots, 40);
          setTimeout(mdjAssertNavSlots, 500);
        });
      }
    } catch (e) {}
  }

  async function mdjDestinoMiPerfilEnVivo() {
    var supa = (typeof window.getSupabaseClient === 'function') ? window.getSupabaseClient() : null;
    if (!supa) return './login.html';
    var ses = null;
    try { var r = await supa.auth.getSession(); ses = r && r.data ? r.data.session : null; } catch (e) {}
    if (!ses) return './login.html';
    var uid = ses.user && ses.user.id ? String(ses.user.id) : '';
    var rol = '';
    try {
      var pr = await supa.from('dj_profiles').select('role').eq('user_id', uid).maybeSingle();
      rol = String(((pr && pr.data) || {}).role || '').toLowerCase().trim();
    } catch (e) {}
    if (rol === 'owner' || rol === 'admin' || rol === 'manager' || rol === 'management' || rol === 'seller') {
      return './staff.html?vista=miperfil';
    }
    if (rol) {                                   // cualquier otro rol con perfil = artista
      return uid ? './dj-profile.html?id=' + encodeURIComponent(uid) : './dj-profile.html?view=public';
    }
    return uid ? './client-portal.html' : './login.html';
  }

  function mdjEngancharMiPerfil(el) {
    if (!el || el.__mdjPerfilHook) return;
    el.__mdjPerfilHook = true;
    el.addEventListener('click', function (ev) {
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button === 1) return;  // abrir en pestaña nueva
      ev.preventDefault();
      ev.stopPropagation();
      var previo = el.getAttribute('href');
      el.setAttribute('aria-busy', 'true');
      mdjDestinoMiPerfilEnVivo().then(function (dest) {
        el.removeAttribute('aria-busy');
        window.location.href = dest;
      }).catch(function () {
        el.removeAttribute('aria-busy');
        window.location.href = previo || './login.html';
      });
    }, true);
  }

  /* ══ DESTINO DE ⚙ CONFIG · UN SOLO PUNTO DE VERDAD ═════════════════════════
     FIX-NAV-CONFIG-01 (2026-08-19). El destino de este puesto se escribia en
     CUATRO sitios de este mismo archivo: las dos tablas de slots, una
     sobreescritura sin condicion mas abajo, y el creador del enlace cuando
     falta. Mandaba la ultima en ejecutarse —la sobreescritura—, que apuntaba a
     staff-config.html sin mirar rol ni pagina. Consecuencia: artista y cliente
     aterrizaban en territorio de owner, que ademas rebota a staff.html, y se
     quedaban sin sus ajustes.

     Misma cura que ya se aplico al puesto 8: resolvedor unico y decision EN EL
     CLIC. Lo segundo no es adorno — el rol llega cuando resuelve la sesion,
     despues de las primeras pasadas del header, asi que congelar el href al
     cargar da el destino equivocado.

     Los cuatro destinos no se inventan: son los que ya declaraba el marcado de
     cada portal (index y client-portal para cliente, academia y dj-tools para
     artista, la tabla interna para owner). */
  function mdjResolveConfigHref() {
    var b = document.body;
    var rol = (b && b.getAttribute('data-mdj-nav-role') || '').toLowerCase().trim();
    var uid = String(window.__mdjNavOwnUserId || '').trim();
    var esStaff = rol === 'management' || rol === 'seller' ||
      (b && b.classList.contains('mdj-staff-nav') && !b.classList.contains('mdj-artist-nav'));
    /* DOS SENALES PARA LO MISMO, y aqui solo se escuchaba una. El artista se
       reconoce por la clase mdj-artist-nav O por data-mdj-nav-role, que trae
       'artist' | 'dj' | 'talent' segun de donde venga resuelto el rol.
       Mirando solo la clase, una sesion de artista con el atributo puesto pero
       sin la clase caia en la rama de CLIENTE: medido en vivo con djmago305
       (rol dj/PRO), CONFIG apuntaba a client-account.html y MI PERFIL a
       client-portal.html en las seis vistas. Destinos de otra categoria.
       El roster es el mismo —artist, dj y talent son la misma persona— tal y
       como ya lo trata role-guard.js. */
    var esArtista = !!(b && (b.classList.contains('mdj-artist-nav') ||
      rol === 'artist' || rol === 'dj' || rol === 'talent'));
    if (esStaff) return './account-settings.html';
    /* Directo a account-settings: account-profile.html son 11 lineas de
       redireccion a esa misma pagina, asi que apuntar alli hacia dar un salto
       de mas a cada artista. */
    if (esArtista) return './account-settings.html';
    if (uid) return './client-account.html';
    return './login.html';
  }
  window.mdjResolveConfigHref = mdjResolveConfigHref;

  async function mdjDestinoConfigEnVivo() {
    var supa = (typeof window.getSupabaseClient === 'function') ? window.getSupabaseClient() : null;
    if (!supa) return './login.html';
    var ses = null;
    try { var r = await supa.auth.getSession(); ses = r && r.data ? r.data.session : null; } catch (e) {}
    if (!ses) return './login.html';
    var uid = ses.user && ses.user.id ? String(ses.user.id) : '';
    var rol = '';
    try {
      var pr = await supa.from('dj_profiles').select('role').eq('user_id', uid).maybeSingle();
      rol = String(((pr && pr.data) || {}).role || '').toLowerCase().trim();
    } catch (e) {}
    if (rol === 'owner' || rol === 'admin' || rol === 'manager' || rol === 'management' || rol === 'seller') {
      return './account-settings.html';
    }
    if (rol) return './account-settings.html';       // cualquier otro rol con perfil = artista
    return uid ? './client-account.html' : './login.html';
  }

  function mdjEngancharConfig(el) {
    if (!el || el.__mdjConfigHook) return;
    el.__mdjConfigHook = true;
    el.addEventListener('click', function (ev) {
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button === 1) return;   // abrir en pestaña nueva
      ev.preventDefault();
      ev.stopPropagation();
      var previo = el.getAttribute('href');
      el.setAttribute('aria-busy', 'true');
      mdjDestinoConfigEnVivo().then(function (dest) {
        el.removeAttribute('aria-busy');
        window.location.href = dest;
      }).catch(function () {
        el.removeAttribute('aria-busy');
        window.location.href = previo || './login.html';
      });
    }, true);
  }

  /* ══ PANEL PREMIUM DE LA HAMBURGUESA ═══════════════════════════════════════
     Decision PO 2026-08-20. El desplegable era una lista plana de diez enlaces
     —cero encabezados de seccion, cero iconos— y debe seguir el patron
     documentado en docs/design/premium-settings-tabs-pattern.md: filas de
     icono + etiqueta agrupadas en tarjetas, encabezado FUERA y arriba, hairline
     entre filas y ninguna bajo la ultima.

     Se construye AQUI y no en el marcado porque el panel vive en 42 paginas.
     Reescribirlo alli serian 42 copias listas para divergir — el mal que
     llevamos dias desmontando con staff-config.html y las tres variantes del
     heroe. Y se alimenta de la MISMA tabla que gobierna el riel, asi que el
     desplegable no puede quedarse con puestos distintos a la barra.

     Los iconos son SVG de trazo, con la convencion que ya usa la plataforma en
     352 sitios: viewBox 24, fill none, stroke currentColor, width 2.5, linecap
     round. No se inventa un estilo nuevo. */
  var MDJ_ICONOS_PANEL = {
    home:     'M3 11l9-8 9 8M5 10v10h14V10',
    services: 'M4 7h16M4 12h16M4 17h10',
    venues:   'M8 3v4M16 3v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
    shop:     'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0',
    /* Engranaje con dientes, NO un circulo con rayos: eso se lee como SOL, y el
       sol ya significa otra cosa en la plataforma (conmutador dia/noche). */
    config:   'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    jobs:     'M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2',
    contact:  'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM2 7l10 6 10-6',
    'mi-portal': 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    roadmap:  'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
    staff:    'M12 21.5s7.5-3.75 7.5-9.5V5.25L12 2.5 4.5 5.25V12c0 5.75 7.5 9.5 7.5 9.5z',
    academia: 'M22 9 12 4 2 9l10 5 10-5zM6 11v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5',
    agenda:   'M8 3v4M16 3v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
    tools:    'M5 21v-6M5 11V3M12 21v-9M12 8V3M19 21v-4M19 13V3M2.5 15h5M9.5 12h5M16.5 17h5',
    flow:     'M3 3v16a2 2 0 0 0 2 2h16M7 14.5l3.5-3.5 3 3L20 7M15.5 7H20v4.5',
    fenix:    'M12 2s4 3 4 7a4 4 0 0 1-8 0c0-4 4-7 4-7zM8 14c-2 2-3 4-3 6h14c0-2-1-4-3-6'
  };

  /* Que puestos van en cada grupo. El orden dentro del grupo lo marca el riel;
     esto solo dice a que tarjeta pertenece cada uno. Lo que no este listado cae
     en «Navegacion», asi que un puesto nuevo aparece solo en vez de perderse. */
  var MDJ_GRUPOS_PANEL = [
    { titulo: 'Navegación', claves: ['home', 'services', 'venues', 'shop', 'jobs', 'contact', 'academia', 'agenda', 'tools', 'flow'] },
    { titulo: 'Tu cuenta',  claves: ['config', 'mi-portal'] },
    { titulo: 'Sistema',    claves: ['roadmap', 'fenix', 'staff'] }
  ];

  function mdjIconoPanel(clave) {
    var d = MDJ_ICONOS_PANEL[clave] || MDJ_ICONOS_PANEL.home;
    return '<svg class="mdj-panel-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
           'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
           '<path d="' + d + '"/></svg>';
  }

  function mdjConstruirPanelMovil() {
    try {
      var panel = document.querySelector('#mobileMenu .mobile-nav');
      var riel = document.getElementById('mainNav');
      if (!panel || !riel) return;

      var puestos = [].slice.call(riel.querySelectorAll('a[data-mdj-slot]'));
      if (!puestos.length) return;

      /* Idempotente: si ya se construyo con estos mismos puestos, no se rehace.
         El header hace ~70 pasadas y reconstruir en cada una robaria el foco a
         quien estuviera navegando el panel con el teclado. */
      /* Otros pases inyectan enlaces sueltos en el panel DESPUES de construirlo
         —#header-artist-dashboard-mobile, por ejemplo— y quedaban fuera de las
         tarjetas, colgando bajo la ultima. Entran en la firma para que su
         aparicion dispare una reconstruccion que los absorba. */
      var sueltos = [].slice.call(panel.children).filter(function (c) {
        return c.tagName === 'A' && !c.classList.contains('mdj-panel-fila');
      });
      var firma = puestos.map(function (a) {
        return a.getAttribute('data-mdj-nav') + ':' + a.getAttribute('href');
      }).join('|') + '#' + sueltos.map(function (a) {
        return (a.id || a.textContent || '').trim();
      }).join(',');
      if (panel.getAttribute('data-mdj-panel-firma') === firma) return;

      var usados = {};
      var html = '';

      MDJ_GRUPOS_PANEL.forEach(function (grupo, i) {
        var delGrupo = puestos.filter(function (a) {
          var k = a.getAttribute('data-mdj-nav');
          if (grupo.claves.indexOf(k) === -1) return false;
          usados[k] = true;
          return true;
        });
        /* Ultimo grupo: recoge lo que no encajo en ninguno, para que un puesto
           nuevo nunca desaparezca del panel. */
        if (i === MDJ_GRUPOS_PANEL.length - 1) {
          puestos.forEach(function (a) {
            if (!usados[a.getAttribute('data-mdj-nav')]) delGrupo.push(a);
          });
          /* Los sueltos NO se absorben: duplicaban puestos que el juego canonico ya
             trae —#header-artist-dashboard-mobile es otro MI PERFIL— y absorberlos
             abria un bucle, porque el pase que los inyecta los repone tras cada
             reconstruccion. Se quedan en el DOM y se ocultan por CSS: sin guerra
             de nodos y sin duplicados. */
        }
        if (!delGrupo.length) return;

        html += '<h2 class="mdj-panel-titulo">' + grupo.titulo + '</h2>' +
                '<div class="mdj-panel-tarjeta">';
        delGrupo.forEach(function (a) {
          var k = a.getAttribute('data-mdj-nav');
          /* Sin el emoji de cabeza: el icono ya lo dice, y repetirlo deja «⚙️ CONFIG»
             con dos engranajes en la misma fila. El patron pide UN icono lider. */
          var texto = (a.textContent || '').replace('/', '')
            .replace(/^[\u2699\u2600-\u27BF\uFE0F\u2190-\u21FF\u2B00-\u2BFF]+\s*/, '').trim();
          html += '<a class="mdj-panel-fila" href="' + (a.getAttribute('href') || '#') + '"' +
                  ' data-mdj-panel-nav="' + k + '">' +
                  mdjIconoPanel(k) +
                  '<span class="mdj-panel-etiqueta">' + texto + '</span>' +
                  '<span class="mdj-panel-chevron" aria-hidden="true">›</span>' +
                  '</a>';
        });
        html += '</div>';
      });

      /* La fila de sesion va aislada en su propia mini-tarjeta al final, como
         manda el patron para las filas de salida. Se reutiliza el boton que ya
         existe en la cabecera en vez de inventar otro estado de sesion. */
      var sesion = document.getElementById('header-login-btn');
      if (sesion) {
        var esSalir = /salir|log ?out|cerrar/i.test(sesion.textContent || '');
        html += '<div class="mdj-panel-tarjeta mdj-panel-tarjeta--sola">' +
                '<a class="mdj-panel-fila' + (esSalir ? ' mdj-panel-fila--salida' : '') + '"' +
                ' href="' + (sesion.getAttribute('href') || './login.html') + '">' +
                mdjIconoPanel('mi-portal') +
                '<span class="mdj-panel-etiqueta">' + (sesion.textContent || 'Entrar').trim() + '</span>' +
                '</a></div>';
      }

      panel.innerHTML = html;
      panel.setAttribute('data-mdj-panel-firma', firma);
      panel.setAttribute('data-mdj-panel-premium', '1');
    } catch (ePanel) { /* noop */ }
  }
  window.mdjConstruirPanelMovil = mdjConstruirPanelMovil;

  /* ══ VISITANTE EN UN PERFIL AJENO · BRANDING Y BUSCADOR FLOTANTES ══════════
     Decision PO 2026-08-20. Un visitante en el perfil de un artista no recibe la
     barra de marketing completa: recibe el logo —para saber donde esta y poder
     ir al sitio— y el buscador —para explorar otros DJ sin salir del perfil—,
     los dos flotando sobre el contenido.

     Antes de esto un visitante sin sesion no tenia NINGUNA invitacion a recorrer
     el resto del sitio desde un perfil, que es donde suele aterrizar por un
     enlace o un QR compartido.

     Ni el logo ni el buscador se inventan: el logo se clona del que ya trae la
     cabecera, y el buscador se MUEVE —no se clona— porque header-smart-search.js
     se engancha por id (#header-smart-search) y un clon perderia sus escuchas.

     NO aplica a la vista de QR de SoundForTips (?view=public): esa tiene su
     propio blindaje, mas antiguo, y no se toca. */
  /* ══ EL OWNER NO ATERRIZA EN dj-profile.html ══════════════════════════════
     Decision del Capitan 2026-08-20: «El owner pertenece estrictamente al
     edificio Staff y nunca debe inicializar estaciones de DJ ni mezclarse con el
     catalogo de artistas.»

     Su MI PERFIL real ya no pasa por aqui —el resolvedor manda a staff a
     ./staff.html?vista=miperfil—, asi que un owner solo llega a dj-profile.html
     sin ?id= por accidente: navegacion manual o un enlace viejo. Se le devuelve
     a su edificio.

     SOLO su propio perfil. Con ?id=<otro-artista> NO se redirige: ahi el owner
     esta visitando a alguien, que es legitimo y no toca su estacion.

     Se usa replace y no href para no dejar el aterrizaje accidental en el
     historial: el boton «atras» devolveria al mismo sitio y rebotaria otra vez.

     Corre en cada pasada del header porque el rol llega cuando resuelve la
     sesion; antes de eso no se sabe que es owner y no se puede decidir. */
  var _mdjRedirigidoFueraDelPerfil = false;

  function mdjSacarOwnerDelPerfilAjeno() {
    try {
      if (_mdjRedirigidoFueraDelPerfil) return;
      var pagina = String(window.location.pathname || '').split('/').pop().toLowerCase();
      if (pagina !== 'dj-profile.html') return;
      var q = new URLSearchParams(window.location.search || '');
      if (q.get('view') === 'public') return;          // QR: blindaje propio, no se toca
      if (!mdjEsStaffEnVivo()) return;                 // solo staff/owner
      var uid = String(window.__mdjNavOwnUserId || '').trim();
      var id = (q.get('id') || '').trim();
      if (id && id !== uid) return;                    // visitando a otro artista: legitimo
      _mdjRedirigidoFueraDelPerfil = true;
      window.location.replace('./staff.html?vista=miperfil');
    } catch (eSacar) { /* noop */ }
  }

  function mdjEsVisitanteDePerfil() {
    try {
      var pagina = String(window.location.pathname || '').split('/').pop().toLowerCase();
      if (pagina !== 'dj-profile.html') return false;
      var q = new URLSearchParams(window.location.search || '');
      if (q.get('view') === 'public') return false;     // QR: blindaje propio

      /* SOLO SE RESPONDE CUANDO SE SABE. El montaje corre en la primera pasada
         del header, y ahi la sesion todavia no ha resuelto: __mdjNavOwnUserId
         llega vacio. Con un simple !esDueño, el DUEÑO era tratado como visitante
         y se le apagaba su propia estacion — medido, el artista en su perfil
         salia con header=none y cero puestos.
         Ante la duda no se monta nada: es preferible que el flotante aparezca una
         fraccion de segundo mas tarde a robarle la estacion a su dueño. */
      var uid = String(window.__mdjNavOwnUserId || '').trim();
      if (!uid && _mdjHaySesion !== false) return false;   // aun no se sabe
      return !mdjEsDuenoDelPerfil();
    } catch (eVis) { return false; }
  }

  /* DOS MODOS, UNA SOLA FRANJA.
     · 'visitante': la franja sustituye a la cabecera entera.
     · 'artista'  : la barra de tools se queda ARRIBA y la franja baja debajo de
       ella. Se retira .header-top (idioma, SALIR, avatar, carrito): por orden del
       PO esa fila se va, y la salida queda en la pestaña Inicio del riel. */
  function mdjMontarFranjaFlotante(modo) {
    try {
      if (document.getElementById('mdj-flotante-visitante')) return;   // ya montada

      var caja = document.createElement('div');
      caja.id = 'mdj-flotante-visitante';

      /* Logo: clonado, y envuelto en un enlace al inicio. Es tambien la salida
         del perfil hacia la cabecera completa, donde vive SALIR. */
      var logo = document.querySelector('#mainHeader .brand .logo-img-eagle');
      /* Solo el PNG, no su envoltorio: el wrapper de la cabecera arrastra una caja
         de 340x112 con margen negativo y estiraba la franja a 134px de alto. */
      var letras = document.querySelector('#mainHeader .brand .brand-letters-wrapper img');
      var casa = document.createElement('a');
      casa.href = './index.html';
      casa.className = 'mdj-flotante-marca';
      casa.setAttribute('title', 'Miami DJ Beat — ir al inicio');
      if (logo) casa.appendChild(logo.cloneNode(true));
      /* La marca es el aguila MAS el PNG de letras: con el aguila sola la franja
         no dice de quien es la casa. Se clona, no se mueve: la cabecera conserva
         la suya para cuando el dueño recupere su estacion. */
      if (letras) {
        var copiaLetras = letras.cloneNode(true);
        copiaLetras.className = 'mdj-flotante-letras';
        casa.appendChild(copiaLetras);
      }
      caja.appendChild(casa);

      /* Buscador: se MUEVE el original, con sus escuchas intactas. Se apunta de
         donde salio: si la sesion resuelve tarde y resulta que es el dueño, hay
         que devolverlo a su hueco exacto, no dejarlo colgando. */
      var envoltura = document.querySelector('#mainHeader .header-search-wrap');
      if (envoltura) {
        _mdjOrigenBuscador = { padre: envoltura.parentNode, siguiente: envoltura.nextSibling };
        /* Dentro de la franja el rotulo es solo «Search» (orden del PO): el texto
           largo «Buscar DJs, tienda, cursos, reservas…» tapaba la lupa. Se guarda
           el original porque el mismo campo vuelve a la cabecera al desmontar. */
        var campo = envoltura.querySelector('input');
        if (campo) {
          _mdjRotuloBuscador = campo.getAttribute('placeholder');
          campo.setAttribute('placeholder', 'Search');
          campo.removeAttribute('data-i18n-placeholder');   // que el pase de idioma no lo devuelva
        }
        caja.appendChild(envoltura);
      }

      caja.classList.add(modo === 'artista' ? 'mdj-franja-bajo-barra' : 'mdj-franja-sola');
      document.body.appendChild(caja);
      document.body.classList.add(modo === 'artista' ? 'mdj-perfil-estacion' : 'mdj-perfil-visitante');

      /* Se apaga EN LINEA, no solo por hoja: algun pase escribe display:flex en el
         propio elemento, y un estilo en linea gana a cualquier regla por
         especifica que sea. Medido: con la clase puesta y la regla aplicando, el
         computado seguia en flex. */
      /* Se recuerda la decision para el proximo pintado: la semilla del <head> la
         leera antes de que el navegador dibuje, y no habra salto. */
      try { if (modo === 'artista') localStorage.setItem('mdj_estacion', '1'); } catch (eLS) { void eLS; }
      var cab = document.getElementById('mainHeader');
      if (!cab) return;
      if (modo === 'artista') {
        var arriba = cab.querySelector('.header-top');
        if (arriba) arriba.style.setProperty('display', 'none', 'important');
      } else {
        cab.style.setProperty('display', 'none', 'important');
      }
    } catch (eMontar) { /* noop */ }
  }

  function mdjMontarFlotanteVisitante() {
    if (mdjEsVisitanteDePerfil()) mdjMontarFranjaFlotante('visitante');
  }
  window.mdjMontarFlotanteVisitante = mdjMontarFlotanteVisitante;
  window.mdjMontarFranjaFlotante = mdjMontarFranjaFlotante;

  /* Barra arriba, franja debajo. Mismo trato en todas las vistas de estacion
     —artista y staff—, para que no haya saltos al cambiar de pestaña. */
  function mdjArtistaEnSuPerfil() { return mdjEnEstacionDeTrabajo(); }

  /* EL MONTAJE TIENE QUE PODER DESHACERSE. La decision de «visitante» se toma con
     lo que se sabe en ese instante, y la sesion puede resolver despues: medido en
     un perfil propio, convivian data-mdj-slots="10" (o sea, el dueño ya estaba
     reconocido) con la franja de visitante puesta y la cabecera apagada. Sin esta
     vuelta atras, quien restaura sesion despacio se queda sin su estacion. */
  function mdjDesmontarFlotanteVisitante() {
    try {
      var caja = document.getElementById('mdj-flotante-visitante');
      if (!caja) return false;

      /* El buscador vuelve a su hueco exacto: es el original movido, con sus
         escuchas, no una copia. */
      var envoltura = caja.querySelector('.header-search-wrap');
      if (envoltura) {
        var campoVuelta = envoltura.querySelector('input');
        if (campoVuelta && _mdjRotuloBuscador != null) {
          campoVuelta.setAttribute('placeholder', _mdjRotuloBuscador);
          _mdjRotuloBuscador = null;
        }
        if (_mdjOrigenBuscador && _mdjOrigenBuscador.padre && _mdjOrigenBuscador.padre.isConnected) {
          _mdjOrigenBuscador.padre.insertBefore(envoltura, _mdjOrigenBuscador.siguiente || null);
        } else {
          /* Sin hueco registrado —franja de un pase anterior, u otra instancia del
             guion— el buscador NO puede irse con la franja: se devuelve a la
             cabecera aunque sea al final. Perderlo deja la pagina sin buscar. */
          var destino = document.getElementById('mainHeader');
          if (destino) destino.appendChild(envoltura);
        }
      }
      _mdjOrigenBuscador = null;

      caja.parentNode && caja.parentNode.removeChild(caja);
      document.body.classList.remove('mdj-perfil-visitante');
      document.body.classList.remove('mdj-perfil-estacion');

      /* Se retira el display:none EN LINEA que puso el montaje; la hoja vuelve a
         mandar sobre la cabecera. */
      var cab = document.getElementById('mainHeader');
      if (cab) {
        cab.style.removeProperty('display');
        var arriba = cab.querySelector('.header-top');
        if (arriba) arriba.style.removeProperty('display');
      }
      return true;
    } catch (eDesmontar) { return false; }
  }
  window.mdjDesmontarFlotanteVisitante = mdjDesmontarFlotanteVisitante;

  function mdjNormalizeMainNavSlots(idRiel) {
    var nav = document.getElementById(idRiel || 'mainNav');
    if (!nav) return false;

    function buscar(def) {
      var sel = [];
      if (def.id) sel.push('#' + def.id);
      sel.push('[data-i18n="' + def.key + '"]');
      (def.alias || []).forEach(function (a) { sel.push('[data-i18n="' + a + '"]'); });
      sel.push('[data-mdj-nav="' + def.nav + '"]');
      (def.navAlias || []).forEach(function (a) { sel.push('[data-mdj-nav="' + a + '"]'); });
      for (var i = 0; i < sel.length; i++) {
        var el = nav.querySelector(sel[i]);
        if (el && (el.tagName === 'A' || el.tagName === 'BUTTON')) return el;
      }
      return null;
    }

    function crear(def) {
      var a = document.createElement('a');
      a.setAttribute('href', mdjHrefDeSlot(def));
      /* Sin clave no se pone data-i18n: un key inexistente hace que el pase de
         i18n deje el rótulo vacío. */
      if (def.key) a.setAttribute('data-i18n', def.key);
      a.setAttribute('data-mdj-nav', def.nav);
      if (def.id) a.id = def.id;
      if (def.cls) a.className = def.cls;
      if (def.reserved) { a.setAttribute('aria-hidden', 'true'); a.setAttribute('tabindex', '-1'); }
      a.textContent = def.txt;
      return a;
    }

    /* Decisión PO: MI PERFIL es la ÚNICA etiqueta y el ÚNICO nodo del puesto 8.
       MI PORTAL desaparece del producto. Los nodos duplicados que otros pases
       crean (#mainNav-guest-mi-perfil-link, #mainNav-artist-dashboard-link) se
       RETIRAN en cada pasada: sobra el que no sea el canónico. */
    var DUPLICADOS_8 = ['mainNav-guest-mi-perfil-link', 'mainNav-artist-dashboard-link'];

    var canonicos = [];
    /* La tabla ya no es única: las vistas internas montan el juego del sistema
       en vez del público. La elección es por página, no por rol. */
    var tabla = mdjTablaDeSlots();
    /* «Interno» son las DOS estaciones, la de staff y la del artista: en ambas
       hay que reescribir los nodos reciclados del HTML viejo, o «Servicios» y
       «Eventos» reaparecen dentro de la estacion. */
    var esInterno = (tabla === MDJ_NAV_SLOTS_INTERNO || tabla === MDJ_NAV_SLOTS_ARTISTA);
    tabla.forEach(function (def) {
      var el = buscar(def) || crear(def);
      el.setAttribute('data-mdj-slot', String(def.s));
      el.setAttribute('data-mdj-nav', def.nav);          // unifica alias de clave
      /* SOLO en el juego interno se reescribe el nodo reutilizado. En el público
         se mantiene la regla histórica de esta función: conservar href, clases e
         id propios de cada página y limitarse a reordenar.
         En el interno hay que imponerlo: los nodos que se reciclan vienen del
         HTML viejo de la vitrina y, si no se reescriben, "Servicios" o "Eventos"
         reaparecen dentro del portal. */
      if (esInterno) {
        if (def.txt && (el.textContent || '').trim() !== def.txt) {
          var sepPrevio = el.querySelector(':scope > .mdj-slash');
          el.textContent = def.txt;
          if (sepPrevio) el.insertBefore(sepPrevio, el.firstChild);
        }
        if (def.href && el.tagName === 'A') el.setAttribute('href', mdjHrefDeSlot(def));
        /* Puestos que son PESTAÑA de la propia vista, no pagina. No se
           reimplementa el conmutador: se delega el clic en el boton que ya existe
           en #owner-tabs, que sigue en el DOM aunque la franja este oculta. Asi la
           franja se queda congelada e intacta —como exige .cursorrules— y no hay
           dos logicas de pestañas que puedan discrepar. */
        if (def.tab) {
          el.setAttribute('data-mdj-tab', def.tab);
          if (!el.__mdjTabHook) {
            el.__mdjTabHook = true;
            el.addEventListener('click', function (ev) {
              /* Se llama al conmutador GLOBAL de la pagina, no se simula un clic
                 sobre el boton de #owner-tabs: la franja esta oculta y ese camino
                 no conmutaba —medido, pulsarlo directamente dejaba tab-public—.
                 switchProfileTab si es global (los botones de la franja lo invocan
                 por onclick en linea) y responde: flow→tab-flow, sft→tab-sft,
                 public→tab-public. No se reimplementa nada: se usa el conmutador
                 que la pagina ya tiene, con sus propios candados de plan dentro. */
              if (typeof window.switchProfileTab !== 'function') return;  // el href manda
              ev.preventDefault();
              ev.stopPropagation();
              window.switchProfileTab(def.tab);
            }, true);
          }
        }
        if (def.cls) el.className = def.cls;
        /* Un slot reservado del juego público no puede llegar oculto al interno. */
        el.classList.remove('mdj-mainnav-reserved-slot');
        el.removeAttribute('aria-hidden');
        el.removeAttribute('tabindex');
        if (!def.key) el.removeAttribute('data-i18n');
      }
      if (def.key && !el.getAttribute('data-i18n')) el.setAttribute('data-i18n', def.key);
      canonicos.push(el);
    });

    /* Indicador de puesto activo. Solo en el juego interno: la barra pública es
       la misma vitrina en todas partes y allí no señala página. Se compara el
       archivo del href con el de la URL, así que Academia queda marcada en
       academia.html y nunca INICIO. */
    if (esInterno) {
      var aqui = String(window.location.pathname || '').split('/').pop().toLowerCase();
      canonicos.forEach(function (el) {
        var destino = String(el.getAttribute('href') || '').split('?')[0].split('/').pop().toLowerCase();
        var activo = !!destino && destino === aqui;
        el.classList.toggle('active', activo);
        if (activo) el.setAttribute('aria-current', 'page');
        else el.removeAttribute('aria-current');
      });
    }

    // Retirar todo lo que no sea canónico (DJ Tools, STAFF, booth, flow-dash…).
    /* El botón de día/noche vive dentro del riel (columna 10) y NO es un slot
       canónico: hay que exceptuarlo del barrido o el normalizador lo borra en
       cada pasada y el sol desaparece. */
    var fuera = [];
    [].slice.call(nav.querySelectorAll('a,button')).forEach(function (el) {
      if (el.id === 'mdj-daynight') return;
      if (canonicos.indexOf(el) === -1) fuera.push(el);
    });
    fuera.forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });

    // Orden canónico. appendChild mueve el nodo si ya estaba dentro: sin clonar,
    // así que no se pierden listeners ya enganchados.
    canonicos.forEach(function (el) { nav.appendChild(el); });

    // Puesto 8: un solo nodo, etiqueta fija MI PERFIL, visible también en invitado.
    // Los duplicados que crean otros pases caen con el barrido de no-canónicos.
    DUPLICADOS_8.forEach(function (id) {
      var d = document.getElementById(id);
      if (d && d.parentNode === nav && canonicos.indexOf(d) === -1) d.parentNode.removeChild(d);
    });
    [].slice.call(nav.querySelectorAll('[data-mdj-slot="8"]')).forEach(function (el) {
      el.classList.remove('mdj-mainnav-reserved-slot');
      el.removeAttribute('aria-hidden');
      el.removeAttribute('tabindex');
      el.style.removeProperty('display');
      el.style.removeProperty('visibility');
      /* La etiqueta UNICA del puesto 8 es MI PERFIL, decision PO 2026-08-16.
         Aqui se aceptaba tambien «MY PROFILE» como valida, asi que la variante
         inglesa del marcado viejo sobrevivia en rentals.html y cash-flow.html:
         dos pantallas con etiqueta distinta a las demas y, por ser mas larga,
         la barra centrada se corria 14px al pasar por ellas. Se compara
         ignorando el separador «/» que este pase puede haber insertado. */
      if ((el.textContent || '').replace('/', '').trim().toUpperCase() !== 'MI PERFIL') {
        var sepPrevio = el.querySelector(':scope > .mdj-slash');
        el.textContent = 'MI PERFIL';
        if (sepPrevio) el.insertBefore(sepPrevio, el.firstChild);
      }
    });

    // Slot 9 · MRM IA — visible para TODOS los roles, incluido invitado.
    // No es una herramienta de owner: es un mapa que se adapta a quien entra.
    // El owner ve el recorrido completo; el manager sólo lo que le compete; el
    // vendedor la parte comercial; el artista su modelo de pago y sus ventajas;
    // el cliente cómo contratar. Quien decide el alcance es la página destino
    // según el rol de la sesión, no esta barra.
    [].slice.call(nav.querySelectorAll('[data-mdj-slot="9"]')).forEach(function (el) {
      el.classList.remove('mdj-mainnav-reserved-slot');
      el.removeAttribute('aria-hidden');
      el.removeAttribute('tabindex');
    });

    // Slot 8: un solo destino, decidido por rol. Se reafirma en cada pasada para
    // que ningún pase posterior lo devuelva a la plantilla vieja.
    var destino = mdjResolveMiPerfilHref();
    [].slice.call(nav.querySelectorAll('[data-mdj-slot="8"]')).forEach(function (el) {
      if (el.tagName === 'A') el.setAttribute('href', destino);   // respaldo estático
      mdjEngancharMiPerfil(el);                                    // la verdad, en el clic
    });

    /* Blindaje final del Zero Layout Shift. Las reglas heredadas de la era flex
       colapsan los slots reservados con display:none e !important y especificidad
       392 — imposible de superar razonablemente desde una hoja. Un estilo inline
       con !important gana a cualquier hoja, así que la celda se garantiza aquí:
       el slot SIEMPRE ocupa su columna; sólo se oculta su contenido. */
    /* Opción A: una sola barra. Los rieles alternativos se ocultan inline porque
       por CSS los gana una regla más específica en algunas páginas (academia). */
    MDJ_RIELES_MUERTOS.forEach(function (id) {
      var alt = document.getElementById(id);
      if (alt && alt !== nav) alt.style.setProperty('display', 'none', 'important');
    });

    /* El panel de la hamburguesa se reconstruye desde los mismos puestos que
       acaban de fijarse, para que barra y desplegable no puedan discrepar. Es
       idempotente: solo rehace si la firma de puestos cambio. */
    mdjConstruirPanelMovil();

    /* El owner no se queda en dj-profile.html: se le devuelve a su edificio. Va
       lo primero de los pases de perfil, para que no llegue a montarse nada. */
    mdjSacarOwnerDelPerfilAjeno();

    /* Visitante en un perfil ajeno: el logo y el buscador flotantes sustituyen a
       la barra de marketing. Se monta despues del riel para poder mover el
       buscador ya inicializado. */
    if (mdjEsVisitanteDePerfil()) mdjMontarFlotanteVisitante();
    else if (mdjArtistaEnSuPerfil()) mdjMontarFranjaFlotante('artista');
    else {
      mdjDesmontarFlotanteVisitante();   /* fuera del perfil, todo vuelve a su sitio */
      /* Y si esta pagina NO es estacion para quien mira, se borra la memoria y se
         retira la marca temprana: mas vale una correccion puntual que arrastrar
         una cabecera oculta a quien le corresponde verla. */
      try {
        /* SOLO CUANDO SE SABE. En las primeras pasadas la sesion aun no ha
           resuelto y mdjEnEstacionDeTrabajo() devuelve false por falta de datos,
           no por ser falso: sin esta guarda, la limpieza borraba la semilla en
           cada carga y el acordeon volvia intacto. */
        var uidLS = String(window.__mdjNavOwnUserId || '').trim();
        /* El ROL llega despues que el uid. Con solo el uid habia una ventana en la
           que la sesion ya existia pero data-mdj-nav-role aun estaba vacio: ahi
           mdjEnEstacionDeTrabajo() decia false por falta de dato y la limpieza se
           llevaba la semilla por delante. Se exige rol resuelto. */
        var rolPuesto = document.body ? (document.body.getAttribute('data-mdj-nav-role') || '').trim() : '';
        var seSabe = (!!uidLS && !!rolPuesto) || _mdjHaySesion === false;
        if (seSabe && !mdjEnEstacionDeTrabajo() && !mdjEsVisitanteDePerfil()) {
          localStorage.removeItem('mdj_estacion');
          document.documentElement.classList.remove('mdj-estacion-previa');
        }
      } catch (eLS2) { void eLS2; }
    }
    mdjMarcarPuestoActivo();

    /* El propio riel también se blinda inline: hay reglas de la era flex que le
       devuelven display:flex, y sin display:grid las nueve columnas no existen
       aunque grid-template-columns esté declarado. Inline gana a toda hoja. */
    nav.style.setProperty('display', 'grid', 'important');
    /* REJILLA · 2026-08-18 — la anchura de las columnas YA NO SE ESCRIBE AQUÍ.
       Durante meses este archivo impuso `repeat(9, max-content) 40px` en línea y
       con !important, lo que ganaba a las cuatro reglas que header-unified.css
       declaraba para lo mismo. Resultado: cinco definiciones de la misma
       propiedad y la que mandaba era esta, la última en ejecutarse.
       Y max-content ataba el ancho al texto: medido en vivo el 2026-08-18,
       pulsar ES|EN desplazaba el último slot 85 px, y por debajo de ~1050 px
       los slots 8 y 9 desaparecían bajo overflow:hidden.
       La rejilla vive ahora en UN SOLO SITIO: header-unified.css, bloque
       «REJILLA RÍGIDA · PARIDAD BILINGÜE». Si hay que cambiar un ancho, se
       cambia allí y en ningún otro lugar. */
    /* justify-content y overflow TAMPOCO se escriben aquí. Los gobierna el
       mismo bloque de header-unified.css. En línea impedían que el media
       query de contención por debajo de 1172px pudiera cambiarlos: inline
       con !important gana también a un media query. */
    /* El padding TAMPOCO se escribe aqui. Escribirlo en linea con !important
       ganaba a la hoja y a los media queries, y dejaba la ultima pestaña
       pegada al borde de la pantalla: medido a 1703px, 0px de aire a la
       derecha. Vive en header-unified.css, como la rejilla. */
    nav.style.setProperty('grid-auto-rows', '0', 'important');
    nav.style.setProperty('align-items', 'center', 'important');

    /* ── NORMALIZACIÓN CANÓNICA DE LOS 9 PUESTOS ─────────────────────────
       Estándar inmutable (PO 2026-08-18), idéntico en TODAS las vistas:
         1 HOME · 2 SERVICES · 3 EVENTS · 4 SHOP · 5 ⚙ CONFIG ·
         6 JOBS · 7 CONTACT · 8 MI PERFIL · 9 MRM IA

       Por qué hace falta esto: el puesto 8 llega con DOS identidades según la
       página —#mainNav-mi-perfil-link con sesión y #mainNav-guest-mi-perfil-link
       sin ella— y la variante de invitado venía SIN data-mdj-slot. Sin ese
       atributo la rejilla no la coloca, su columna 8 se queda vacía y aparece
       el hueco de 170 px antes de MRM IA que se veía en login.html.
       Aquí se le pone el puesto que le toca y se fijan los destinos canónicos.
       No se crea ningún enlace: solo se etiqueta el que ya existe. */
    (function normalizarPuestos() {
      var perfil = nav.querySelector('#mainNav-mi-perfil-link, #mainNav-guest-mi-perfil-link, [data-mdj-nav="my-profile"]');
      if (perfil && !perfil.getAttribute('data-mdj-slot')) perfil.setAttribute('data-mdj-slot', '8');
      /* Aquí había un href fijo a './account-settings.html' — que es, literalmente,
         «Account Settings»: configuraciones. Corría DESPUÉS del bloque del slot 8,
         así que pisaba el destino que el resolvedor ya había puesto bien, y MI
         PERFIL llevaba a configuraciones siempre que el clic no pasara por el
         enganche: al abrir en pestaña nueva, o al pulsar antes de que se atara.
         Mismo mal que tenía CONFIG —dos escrituras, gana la última— y misma cura:
         una sola fuente de verdad. */
      if (perfil) {
        perfil.setAttribute('href', mdjResolveMiPerfilHref());   // respaldo estático
        mdjEngancharMiPerfil(perfil);                            // la verdad, en el clic
      }

      var cfg = nav.querySelector('#mainNav-config-link, [data-mdj-nav="config"]');
      if (cfg && !cfg.getAttribute('data-mdj-slot')) cfg.setAttribute('data-mdj-slot', '5');
      /* FIX-NAV-CONFIG-01: aquí había un href fijo a './staff-config.html', sin
         mirar rol ni página, que ganaba a las otras tres definiciones por ser la
         última en correr. El destino lo decide ahora el resolvedor único, y en
         el clic se reconfirma contra la sesión en vivo. */
      if (cfg) {
        cfg.setAttribute('href', mdjResolveConfigHref());   // respaldo estático
        mdjEngancharConfig(cfg);                            // la verdad, en el clic
      }
    })();

    /* ── GEOMETRÍA: LA DECIDE EL CSS, NO ESTE ARCHIVO ────────────────────
       Aquí había un bucle que escribía en cada puesto, EN LÍNEA y con
       !important, display / width / min-width / visibility / opacity /
       pointer-events. Se ha retirado por tres razones medidas:

       1. Un inline con !important gana a CUALQUIER hoja, así que ninguna regla
          de header-unified.css podía corregir un puesto — ni las que ya existían
          en el proyecto. Se diagnosticó en login.html: cuatro reglas distintas
          decían display:none para el slot 5 y el computado seguía en flex.
       2. Escribir geometría después de pintar es exactamente lo que produce el
          salto de maquetación (CLS) que esta barra debe tener en cero.
       3. La rejilla ya está declarada de fábrica en header-unified.css con sus
          nueve columnas y el grid-column de cada puesto. Duplicarla aquí creaba
          dos fuentes de verdad, y mandaba la que se ejecutaba la última.

       Este archivo se queda con lo funcional —destinos, estado activo, sesión—
       y no vuelve a tocar la geometría. Regla permanente. */

    /* Ritmo de separadores con un NODO REAL, no ::before.
       El pseudo-elemento perdía contra reglas heredadas que ponían content:none
       y no había forma razonable de ganarles: la clase se aplicaba, las reglas
       con "/" casaban, y el computado seguía en none. Un <span> dentro del propio
       enlace no depende de esa cascada y siempre se pinta.
       Regla: separador delante de toda pestaña salvo la primera y las que siguen
       a un slot oculto — así el hueco de un reservado queda limpio. */
    var enOrden = [].slice.call(nav.querySelectorAll('[data-mdj-slot]'));
    enOrden.forEach(function (el, i) {
      var previo = enOrden[i - 1];
      var previoOculto = previo && getComputedStyle(previo).opacity === '0';
      var lleva = i > 0 && !previoOculto;
      /* El separador nativo (::before) funciona en casi todas las pestañas: sólo
         MI PERFIL lo pierde contra una regla heredada. Así que el span se añade
         ÚNICAMENTE donde el pseudo no pinta nada — si no, salían dos barras. */
      var pseudo = getComputedStyle(el, '::before').content || 'none';
      var yaTieneNativo = pseudo !== 'none' && pseudo.indexOf('/') >= 0;
      var sep = el.querySelector(':scope > .mdj-slash');
      if (yaTieneNativo && sep) { sep.remove(); sep = null; }
      if (lleva && !yaTieneNativo && !sep) {
        sep = document.createElement('span');
        sep.className = 'mdj-slash';
        sep.setAttribute('aria-hidden', 'true');
        sep.textContent = '/';
        el.insertBefore(sep, el.firstChild);
      } else if (!lleva && sep) {
        sep.remove();
      }
    });

    /* El numero REAL de puestos, no un 9 fijo: la estacion del artista tiene
       diez, y el CSS de la rejilla se apoya en este atributo. */
    nav.setAttribute('data-mdj-slots', String(mdjTablaDeSlots().length));
    return true;
  }

  /* Correr una vez no basta: hay ~70 pases posteriores en este mismo archivo que
     inyectan o sustituyen nodos (SCHEDULE, Cash Flow, STAFF, DJ Tools…). El header
     sólo gobierna de verdad si REAFIRMA los 8 slots cuando alguien los altera.
     El observador se ignora a sí mismo con un candado y sólo actúa si detecta un
     nodo no canónico o un slot sin marcar — así no entra en bucle. */
  /* El observador vigila que nadie deshaga los slots. Tres protecciones contra el
     bucle infinito, porque los callbacks de MutationObserver son ASÍNCRONOS: las
     mutaciones que provoca la propia normalización llegan DESPUÉS de terminarla.
       1. El candado se libera en un setTimeout, no al salir de la función: así las
          mutaciones propias encuentran el candado todavía puesto y se descartan.
       2. Tope duro de reafirmaciones: pasado el límite, el observador se desconecta.
       3. La ventana de vigilancia se cierra a los 15 s, cuando ya corrieron todos
          los pases del header. Después la barra queda como esté. */
  var _mdjSlotLock = false, _mdjSlotRuns = 0, _mdjSlotObs = null;
  var MDJ_SLOT_MAX = 40;

  function mdjAssertNavSlots() {
    if (_mdjSlotLock) return;
    if (_mdjSlotRuns++ > MDJ_SLOT_MAX) { mdjStopWatch(); return; }
    _mdjSlotLock = true;
    try { MDJ_RIELES.forEach(function (id) { mdjNormalizeMainNavSlots(id); }); } catch (e) {}
    setTimeout(function () { _mdjSlotLock = false; }, 0);   // clave: liberar en la siguiente vuelta
  }

  function mdjStopWatch() {
    if (_mdjSlotObs) { try { _mdjSlotObs.disconnect(); } catch (e) {} _mdjSlotObs = null; }
  }

  function mdjWatchNavSlots() {
    MDJ_RIELES.forEach(mdjWatchOne);
    MDJ_RIELES_MUERTOS.forEach(mdjWatchOne);   // vigilar que no resuciten
  }
  function mdjWatchOne(idRiel) {
    var nav = document.getElementById(idRiel);
    if (!nav || nav.__mdjSlotWatch) return;
    nav.__mdjSlotWatch = true;
    try {
      _mdjSlotObs = new MutationObserver(function () {
        if (_mdjSlotLock) return;
        var hijos = [].slice.call(nav.querySelectorAll('a,button'));
        var sucio = false, prev = 0;
        for (var i = 0; i < hijos.length; i++) {
          var sl = parseInt(hijos[i].getAttribute('data-mdj-slot') || '0', 10);
          if (!sl || sl < prev) { sucio = true; break; }
          prev = sl;
        }
        if (!sucio && hijos.length < 9) sucio = true;
        if (sucio) mdjAssertNavSlots();
      });
      _mdjSlotObs.observe(nav, { childList: true });
      setTimeout(mdjStopWatch, 15000);
    } catch (e) {}
  }

  mdjAssertNavSlots();
  mdjWatchNavSlots();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { mdjAssertNavSlots(); mdjWatchNavSlots(); });
  }
  window.addEventListener('load', function () { mdjAssertNavSlots(); mdjWatchNavSlots(); });

  /* CLAVE: el destino de MI PERFIL depende del rol y del uid, y ninguno de los dos
     existe cuando corren las primeras pasadas — la sesión resuelve después. Sin
     esto, MI PERFIL quedaba apuntando a dj-profile.html SIN ?id=, el guard del
     perfil lo tomaba por "perfil propio", no encontraba sesión y expulsaba al
     login aunque la cabecera ya mostrara al usuario dentro.
     Se reafirma cuando la sesión cambia y en una segunda ventana más larga. */
  function mdjReasertarTrasSesion() {
    try {
      var supa = (typeof window.getSupabaseClient === 'function') ? window.getSupabaseClient() : null;
      if (!supa || window.__mdjSlotAuthHook) return;
      window.__mdjSlotAuthHook = true;
      supa.auth.onAuthStateChange(function () {
        _mdjSlotRuns = 0;                       // el cambio de sesión reabre el cupo
        setTimeout(mdjAssertNavSlots, 60);
        setTimeout(mdjAssertNavSlots, 400);
        setTimeout(mdjAssertNavSlots, 1200);
      });
      supa.auth.getSession().then(function () {
        _mdjSlotRuns = 0;
        mdjAssertNavSlots();
      }).catch(function () {});
    } catch (e) {}
  }
  mdjRefrescarSesion();
  var _mdjHookTries = 0;
  var _mdjHookIv = setInterval(function () {
    mdjReasertarTrasSesion();
    mdjRefrescarSesion();
    if ((window.__mdjSlotAuthHook && _mdjHaySesion !== null) || ++_mdjHookTries > 40) clearInterval(_mdjHookIv);
  }, 150);


  /* ══ MDJB 2026-08-16 · SOL / LUNA AL FINAL DE LA BARRA ══════════════════════
     Reutiliza el mismo mecanismo que ya existía en el portal STAFF: mismos iconos
     SVG, misma clave de almacenamiento (mdjStaffTheme) y el mismo data-theme en
     <html>, para que el modo elegido sea el mismo en toda la plataforma.
     Va FUERA de #mainNav a propósito: la rejilla canónica sigue teniendo 9 slots.
     El botón se ancla a la derecha del riel sin robar columna a ninguna pestaña. */
  var MDJ_SUN  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var MDJ_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

  /* P1.3 Fase A: mdjStaffTheme es compartida con staff.html — normaliza cualquier
     valor heredado ('day'/'night', pre-unificación) al estándar canónico light/dark. */
  function mdjNormalizeThemeValue(raw) {
    var v = String(raw || '').toLowerCase().trim();
    return (v === 'day' || v === 'light') ? 'light' : 'dark';
  }

  function mdjApplyTheme(modo) {
    var r = document.documentElement;
    if (modo === 'day') { r.setAttribute('data-theme', 'day'); }
    else { r.removeAttribute('data-theme'); }
    var b = document.getElementById('mdj-daynight');
    if (b) {
      b.innerHTML = (modo === 'day') ? MDJ_MOON : MDJ_SUN;
      b.setAttribute('aria-pressed', String(modo === 'day'));
      b.title = (modo === 'day') ? 'Cambiar a modo noche' : 'Cambiar a modo día';
    }
  }

  function mdjMountDayNight() {
    var nav = document.getElementById('mainNav');
    if (!nav || document.getElementById('mdj-daynight')) return;
    var riel = nav.parentNode;                 // .container del .header-nav
    if (!riel) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'mdj-daynight';
    b.className = 'mdj-daynight';
    b.setAttribute('aria-label', 'Modo día / noche');
    b.addEventListener('click', function () {
      var actual = document.documentElement.getAttribute('data-theme') === 'day' ? 'day' : 'night';
      var nuevo = actual === 'day' ? 'night' : 'day';
      try { localStorage.setItem('mdjStaffTheme', nuevo === 'day' ? 'light' : 'dark'); } catch (e) {}
      mdjApplyTheme(nuevo);
    });
    riel.appendChild(b);
    /* Reserva su carril para no solaparse con la última pestaña. */
    /* El botón está fuera del riel y anclado al contenedor, así que el padding
       del riel no lo aparta: hay que estrechar el propio riel para dejarle sitio. */
    var navEl = document.getElementById('mainNav');
    /* El sol pasa a ser el ÚLTIMO hijo del riel, no un absoluto sobre él: así la
       rejilla le da su propia columna y no puede solaparse con MRM IA. */
    if (navEl && b.parentNode !== navEl) navEl.appendChild(b);
    var guardado = '';
    try { guardado = localStorage.getItem('mdjStaffTheme') || ''; } catch (e) {}
    mdjApplyTheme(mdjNormalizeThemeValue(guardado) === 'light' ? 'day' : 'night');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mdjMountDayNight);
  } else { mdjMountDayNight(); }
  window.addEventListener('load', mdjMountDayNight);

  var MDJ_ARTIST_RAIL_VARIANT_CORE = 'mdj-artist-rail-core-v2';
  var MDJ_ARTIST_RAIL_VARIANT_FULL = 'mdj-artist-rail-full-v2';

  window.MDJ_DISABLE_MAINNAV_INFINITE = true;

  try {
    var _mdjH = document.getElementById('mainHeader');
    if (_mdjH) _mdjH.classList.add('mdj-header-unified');
  } catch (eMdjH) {
    /* ignore */
  }

  function mdjClearAuthBootMask() {
    try {
      document.body.classList.remove('mdj-nav-booting');
      document.documentElement.classList.remove('mdj-auth-resolving');
      if (window.__mdjNavBootTimeout) {
        clearTimeout(window.__mdjNavBootTimeout);
        window.__mdjNavBootTimeout = null;
      }
      if (typeof window.mdjEnsureAccountSettingsOwnerStripNav === 'function') {
        window.mdjEnsureAccountSettingsOwnerStripNav();
      }
    } catch (e) { /* ignore */ }
  }

  /** Owner Config: #owner-tabs manda; anular fila #mainNav 8-pillar tras auth / inject. */
  function mdjEnsureAccountSettingsOwnerStripNav() {
    /* MDJB nav-def 2026-08-13: account-settings usa el #mainNav estándar (igual que dj-profile,
       la página que funciona). Se elimina el "strip" especial de esta página (abuso de alcance). */
    return;
    try {
      var page = (window.location.pathname.split('/').pop() || '').toLowerCase();
      if (page !== 'account-settings.html') return;
      if (!document.body || !document.body.classList.contains('mdj-from-profile')) return;
      var bar = document.querySelector('#mainHeader .header-nav');
      if (bar) {
        bar.style.setProperty('display', 'none', 'important');
        bar.style.setProperty('visibility', 'hidden', 'important');
        bar.style.setProperty('pointer-events', 'none', 'important');
      }
      var strip = document.getElementById('owner-tabs');
      if (strip) {
        strip.style.removeProperty('visibility');
        strip.style.removeProperty('opacity');
        strip.style.removeProperty('pointer-events');
        strip.setAttribute('data-mdj-no-marquee', '1');
        var cont = strip.querySelector('.container');
        if (cont) cont.setAttribute('data-mdj-no-marquee', '1');
      }
    } catch (e) { /* noop */ }
  }
  window.mdjEnsureAccountSettingsOwnerStripNav = mdjEnsureAccountSettingsOwnerStripNav;

  /* account-settings.html: strip artista desde el primer paint (antes del auth-chain). */
  (function mdjBootAccountSettingsProfileNavEarly() {
    /* MDJB nav-def 2026-08-13: no forzar "modo perfil" ni ocultar el nav en account-settings. */
    return;
    try {
      var page = (window.location.pathname.split('/').pop() || '').toLowerCase();
      if (page !== 'account-settings.html' || !document.body) return;
      document.body.classList.add('mdj-from-profile');
      var bar = document.querySelector('#mainHeader .header-nav');
      if (bar) bar.style.setProperty('display', 'none', 'important');
    } catch (e) { /* noop */ }
  })();

  function mdjApplyAuthBootMask() {
    try {
      var hasMaybeSession = Object.keys(localStorage).some(function (k) {
        return k.indexOf('sb-') === 0 || k.indexOf('supabase') !== -1;
      });
      if (!hasMaybeSession) return;
      document.documentElement.classList.add('mdj-auth-resolving');
      document.body.classList.add('mdj-nav-booting');
      window.__mdjNavBootTimeout = setTimeout(mdjClearAuthBootMask, 2500);
    } catch (e) { /* ignore */ }
  }

  /** FIX-AUDIO-01: música ambiental exclusiva de la raíz ('/' o 'index.html'). Ninguna otra ruta la carga. */
  function mdjIsAmbientMusicRoute() {
    try {
      var path = (window.location.pathname || '').toLowerCase();
      return path === '/' || path === '' || path === '/index.html' || /\/index\.html$/.test(path);
    } catch (eRoute) {
      return false;
    }
  }

  function mdjLoadAmbientMusicScript() {
    if (!mdjIsAmbientMusicRoute()) return;
    if (typeof window !== 'undefined' && window.MDJ_SKIP_AMBIENT_MUSIC) return;
    if (document.getElementById('mdj-ambient-music-script')) return;
    try {
      if (document.documentElement && document.documentElement.getAttribute('data-mdj-no-ambient') === '1') return;
    } catch (eAmb) {
      void eAmb;
    }

    function _injectAmbientScript() {
      if (document.getElementById('mdj-ambient-music-script')) return;
      var s = document.createElement('script');
      s.id = 'mdj-ambient-music-script';
      s.src = './js/mdj-ambient-music.js?v=20260818-fix-audio-01-home-only';
      s.async = true;
      (document.head || document.documentElement).appendChild(s);
    }

    if (typeof whenSupabaseReady === 'function') {
      whenSupabaseReady(function() {
        var sb = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : (window.supabase || null);
        if (sb) {
          sb.from('platform_settings')
            .select('key, value')
            .in('key', ['ambient_opening_file', 'ambient_vol_opening', 'ambient_jungle_file', 'ambient_vol_jungle'])
            .then(function(res) {
              if (res.data) {
                res.data.forEach(function(row) {
                  if (row.key === 'ambient_opening_file' && row.value) window.MDJ_AMBIENT_OPENING_FILE = row.value;
                  if (row.key === 'ambient_jungle_file' && row.value) window.MDJ_AMBIENT_JUNGLE_FILE = row.value;
                  if (row.key === 'ambient_vol_opening' && row.value !== '') window.MDJ_AMBIENT_VOL_OPENING = parseFloat(row.value);
                  if (row.key === 'ambient_vol_jungle' && row.value !== '') window.MDJ_AMBIENT_VOL_JUNGLE = parseFloat(row.value);
                });
              }
              _injectAmbientScript();
            })
            .catch(function() {
              _injectAmbientScript();
            });
        } else {
          _injectAmbientScript();
        }
      });
    } else {
      _injectAmbientScript();
    }
  }

  function mdjLoadForceMuteVideosScript() {
    if (typeof window !== 'undefined' && window.MDJ_SKIP_FORCE_MUTE_VIDEOS) return;
    if (document.getElementById('mdj-videos-force-mute-script')) return;
    try {
      if (document.documentElement && document.documentElement.getAttribute('data-mdj-no-force-mute-videos') === '1') {
        return;
      }
    } catch (eVm) {
      void eVm;
    }
    var sv = document.createElement('script');
    sv.id = 'mdj-videos-force-mute-script';
    sv.src = './js/mdj-videos-force-mute.js?v=20260421-force-mute-1';
    sv.async = true;
    (document.head || document.documentElement).appendChild(sv);
  }

  /**
   * Auth pills marcados con `data-auth-btn`: texto **fijo** según `document.documentElement.lang`
   * (sin translations JSON). `es` → ENTRAR/SALIR; cualquier otro (p. ej. `en`) → LOGIN/LOGOUT.
   * Estado sesión: `.danger` = logout.
   */
  window.updateAuthButtons = window.updateAuthButtons || function updateAuthButtons() {
    var root = document.documentElement;
    var raw = '';
    if (root) {
      raw = String(root.getAttribute('lang') || root.lang || '').trim().toLowerCase();
    }
    var isEs = raw === 'es' || raw.indexOf('es-') === 0;
    var txtIn = isEs ? 'ENTRAR' : 'LOGIN';
    var txtOut = isEs ? 'SALIR' : 'LOGOUT';
    document.querySelectorAll('[data-auth-btn]').forEach(function (btn) {
      var logout = btn.classList.contains('danger');
      btn.textContent = logout ? txtOut : txtIn;
    });
  };

  function mdjEnsureAuthLangObserver() {
    if (window.__mdjAuthLangObs || !document.documentElement) return;
    try {
      window.__mdjAuthLangObs = new MutationObserver(function () {
        if (typeof window.updateAuthButtons === 'function') window.updateAuthButtons();
      });
      window.__mdjAuthLangObs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['lang']
      });
    } catch (err) { /* ignore */ }
  }

  mdjEnsureAuthLangObserver();

  /**
   * Contrato menú comprador (anti-regresión) — todas las cuentas client_profiles.
   * Visible: home · services · events(venues) · shop · jobs · contact · client-config · mi-portal
   */
  window.MDJ_BUYER_MAINNAV_CONTRACT = Object.freeze({
    visible: Object.freeze([
      'home',
      'services',
      'venues',
      'shop',
      'client-config',
      'jobs',
      'contact',
      'mi-portal'
    ]),
    hidden: Object.freeze(['tools', 'staff', 'my-profile', 'agenda', 'flow', 'config'])
  });

  /**
   * Comprador (TODAS las cuentas cliente / client_profiles) — no solo un usuario.
   * Fuentes: isClient, mdjClassifyPlatformIdentity principal=buyer, JWT client, fila client_profiles sin staff.
   */
  /** Recorrido comprador (Home, Services, Events, …) — no cabecera artista `mdj_nav=profile`. */
  function mdjIsBuyerJourneyPage() {
    try {
      if (document.body && document.body.classList.contains('mdj-from-profile')) return false;
      var path = (window.location.pathname || '').split('/').pop() || '';
      path = String(path).toLowerCase();
      if (path === '' || path === 'index.html' || path === 'index') return true;
      return /^(rentals|services|events|shop|jobs|client-account|client-portal|client-billing)\.html$/i.test(path);
    } catch (e) {
      return false;
    }
  }

  function mdjResolveBuyerSession(opts) {
    opts = opts || {};
    if (opts.isDjStaff || opts.isNavStaffSolo) return false;
    if (opts.isClient === true) return true;
    var idn = opts.idn;
    if (idn && idn.principal === 'buyer') return true;
    /* DB wins: si existe dj_profiles con rol no-cliente, el JWT 'client' en app_metadata no fuerza buyer session. */
    if ((opts.sessionIsExplicitClient || opts.metadataSaysClient) && !opts.hasDjProfile) return true;
    if (idn && idn.hasClientRow && !opts.hasDjProfile) return true;
    if (idn && idn.hasClientRow && (idn.dbRole === 'client' || idn.dbRole === 'cliente')) return true;
    if (opts.clientRow && !opts.hasDjProfile) return true;
    /* client_profiles en recorrido público comprador (p. ej. Wendy con dj_profiles paralelo). */
    if (opts.hasClientRow && !opts.hasDjProfile && mdjIsBuyerJourneyPage()) return true;
    try {
      var su = String(opts.settingsUrl || '');
      if (su.indexOf('client-account') !== -1 || su.indexOf('client-portal') !== -1) return true;
    } catch (e) { /* ignore */ }
    return false;
  }

  function mdjHideMainNavSlot(el) {
    if (!el) return;
    if (el.id !== 'mainNav-config-link' && el.id !== 'mainNav-mi-portal-link') {
      el.classList.add('mdj-mainnav-reserved-slot');
    }
    if (el.id === 'mainNav-mi-portal-link') {
      el.classList.add('mdj-mi-portal--guest');
    }
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('tabindex', '-1');
    el.style.removeProperty('visibility');
    el.style.removeProperty('pointer-events');
  }

  function mdjRevealMainNavSlot(el) {
    if (!el) return;
    var buyerPhantom =
      el.id === 'mainNav-config-link' || el.id === 'mainNav-mi-portal-link';
    if (!buyerPhantom) {
      el.classList.remove('mdj-mainnav-reserved-slot');
    }
    el.removeAttribute('aria-hidden');
    el.removeAttribute('tabindex');
    el.style.removeProperty('display');
    el.style.removeProperty('visibility');
    el.style.removeProperty('pointer-events');
    if (buyerPhantom) {
      el.classList.remove('mdj-mi-portal--guest', 'mdj-mi-portal--hydrating');
    }
  }

  /** Matriz fija comprador: Home · Services · Events · Shop · CONFIG · Jobs · Contact · MI PORTAL */
  function mdjApplyBuyerSessionMainNav(portalHref) {
    var nav = document.getElementById('mainNav');
    if (!nav) return;
    var compactNav = nav.getAttribute('data-mdj-compact-nav') === '1';

    ['home', 'services', 'venues', 'shop', 'jobs', 'contact'].forEach(function (key) {
      nav.querySelectorAll('a[data-mdj-nav="' + key + '"]').forEach(mdjRevealMainNavSlot);
    });

    var venues = nav.querySelector('a[data-mdj-nav="venues"]');
    if (!venues && !compactNav) {
      venues = document.createElement('a');
      venues.setAttribute('data-mdj-nav', 'venues');
      venues.setAttribute('data-i18n', 'nav-rentals');
      var afterSvc = nav.querySelector('a[data-mdj-nav="services"]');
      var beforeShop = nav.querySelector('a[data-mdj-nav="shop"]');
      if (afterSvc && afterSvc.parentNode === nav) {
        nav.insertBefore(venues, afterSvc.nextSibling);
      } else if (beforeShop && beforeShop.parentNode === nav) {
        nav.insertBefore(venues, beforeShop);
      } else {
        nav.appendChild(venues);
      }
      try {
        var es = document.documentElement && String(document.documentElement.lang || '').toLowerCase().indexOf('es') === 0;
        venues.textContent = es ? 'Eventos' : 'Events';
      } catch (eLbl) {
        venues.textContent = 'Events';
      }
    }
    if (venues) {
      venues.setAttribute('href', './events.html');
      mdjRevealMainNavSlot(venues);
    }

    ['tools', 'staff', 'my-profile', 'agenda', 'flow'].forEach(function (key) {
      nav.querySelectorAll('a[data-mdj-nav="' + key + '"]').forEach(mdjHideMainNavSlot);
    });
    mdjHideMainNavSlot(document.getElementById('mainNav-guest-mi-perfil-link'));
    mdjHideMainNavSlot(document.getElementById('mainNav-staff-or-profile'));
    mdjHideMainNavSlot(document.getElementById('mainNav-staff-link'));
    mdjApplyStaffMainNavLink(false);

    mdjApplyBuyerConfigMainNavLink(true);
    mdjEnsureMiPortalInMainNav(portalHref || './client-portal.html', null);
    mdjRevealMainNavSlot(document.getElementById('mainNav-config-link'));
    mdjRevealMainNavSlot(document.getElementById('mainNav-mi-portal-link'));

    var hdr = document.getElementById('mainHeader');
    if (hdr) {
      hdr.querySelectorAll('#mainNav a[href*="dj-tools"], #mainNav a[data-mdj-nav="tools"]').forEach(mdjHideMainNavSlot);
    }

    /* Orden comprador viene del HTML de cada página — sin appendChild/insertBefore (anti-brinco). */
    mdjInstallMainNavStaticMode();
  }

  /**
   * Matriz MDJ: PRO desbloqueado solo con **artist_pro** (`__mdjProToolsUnlocked` para `dj-tools.html`).
   * La pestaña DJ Tools **siempre** en #mainNav (misma fila que Home, Jobs, etc.); cliente/LITE ven muros en la página.
   * `window.__mdjLastNavTier` / `__mdjLastNavIsClient` (retro) para `dj-tools.html`.
   */
  function mdjApplyDjToolsNavForTier(navTier) {
    window.__mdjLastNavTier = navTier == null ? null : String(navTier);
    var pro = navTier === 'artist_pro';
    window.__mdjProToolsUnlocked = !!pro;
    var buyerNav = window.__mdjLastBuyerSession === true;
    window.__mdjLastNavIsClient = navTier === 'client_only' || buyerNav;
    document.body.classList.toggle('mdj-is-client', navTier === 'client_only' || buyerNav);
    try {
      document.body.classList.toggle('mdj-buyer-session', buyerNav);
    } catch (eBs) { void eBs; }
    var _isClient = navTier === 'client_only' || buyerNav;
    var _nav = document.getElementById('mainNav');
    /* Comprador: DJ Tools fuera del #mainNav en cualquier página (Home, Events, Services, …). */
    var _clientHideDjTools = buyerNav && !!_nav;
    var hideLink = false;
    var header = document.getElementById('mainHeader');
    if (!header) return;
    header.querySelectorAll('a[href*="dj-tools"]').forEach(function (a) {
      var inMainNav = a.closest && a.closest('#mainNav');
      if (_clientHideDjTools && inMainNav) {
        a.classList.add('mdj-mainnav-reserved-slot');
        a.setAttribute('aria-hidden', 'true');
        a.setAttribute('tabindex', '-1');
        return;
      }
      if (!hideLink) {
        a.style.removeProperty('display');
        a.style.removeProperty('visibility');
        a.style.removeProperty('pointer-events');
        a.removeAttribute('aria-hidden');
        a.removeAttribute('data-mdj-tools-suppressed');
        a.removeAttribute('tabindex');
        return;
      }
      /* #mainNav: nunca display:none (colapsa la celda 120px) — solo visibility. */
      if (inMainNav) {
        a.style.removeProperty('display');
        a.style.visibility = 'hidden';
        a.style.pointerEvents = 'none';
        a.setAttribute('aria-hidden', 'true');
        a.setAttribute('data-mdj-tools-suppressed', '1');
        a.setAttribute('tabindex', '-1');
      } else {
        a.style.display = 'none';
        a.setAttribute('aria-hidden', 'true');
        a.setAttribute('data-mdj-tools-suppressed', '1');
      }
    });
    mdjHydrateMainNavDjToolsHref();
  }

  /** Satélites artista (Jobs / Shop / DJ Tools): preserva ?mdj_nav=profile sin tocar otras queries. */
  /**
   * Producto: Events vive en events.html (acceso vía menú artista / enlaces directos).
   * Quitar pestaña Events del #mainNav público en todas las páginas con cabecera unificada.
   */
  function mdjStripPublicEventsFromMainNav() {
    try {
      /* En events.html, index.html, y páginas con nav compacto: Events permanece visible. */
      if (mdjIsGuestHomeNavPage() || mdjIsPublicHomePage() || mdjIsZeroLoginGuestNavPage()) { return; }
      if (window.__mdjLastBuyerSession === true) { return; }
      var _nav = document.getElementById('mainNav');
      if (_nav && (_nav.getAttribute('data-mdj-compact-nav') === '1' || _nav.getAttribute('data-mdj-portal-in-nav') === '1')) {
        return;
      }
      var sel =
        '#mainNav a[data-mdj-nav="venues"], ' +
        '.mobile-nav a[data-mdj-nav="venues"], ' +
        '#mobileMenu a[data-mdj-nav="venues"]';
      document.querySelectorAll(sel).forEach(function (el) {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
      mdjInstallMainNavStaticMode();
    } catch (e) {
      /* noop */
    }
  }

  /** Desactiva carrusel infinito / scroll horizontal en #mainNav (producto: riel estático). */
  function mdjDestroyMainNavInfinite() {
    try {
      var nav = document.getElementById('mainNav');
      if (nav) {
        nav.classList.remove('mdj-mainnav-infinite--on');
        nav.querySelectorAll('a.mdj-mainnav-infinite-clone').forEach(function (a) {
          a.remove();
        });
        try {
          nav.style.maxWidth = '';
        } catch (eMw) {
          void eMw;
        }
      }
      var bar = document.querySelector('#mainHeader .header-nav');
      if (bar) {
        bar.classList.remove('mdj-mainnav-infinite--ui');
        bar.querySelectorAll('.mdj-mainnav-infinite-chevron').forEach(function (b) {
          b.remove();
        });
      }
    } catch (e) {
      /* noop */
    }
  }

  function mdjInstallMainNavStaticMode() {
    window.MDJ_DISABLE_MAINNAV_INFINITE = true;
    mdjDestroyMainNavInfinite();
    window.mdjReinitMainNavInfinite = function () {
      mdjDestroyMainNavInfinite();
    };
  }

  /**
   * index.html (body.page-home): fila pública #mainNav sin recortes.
   * 7 visibles con sesión artista: Inicio · Servicios · Shop · DJ Tools · Jobs · Contacto · MI PERFIL.
   * CONFIG/Agenda/Flow/Events no van en esta fila (Events → events.html; CONFIG → perfil / fila artista).
   */
  function mdjNormalizePublicHomeMainNav() {
    if (!mdjIsPublicHomePage()) return;
    var nav = document.getElementById('mainNav');
    if (!nav) return;
    try {
      /* venues tab en Home: apuntar a la página independiente events.html (no el anchor viejo #experience). */
      nav.querySelectorAll('a[data-mdj-nav="venues"]').forEach(function (el) {
        el.setAttribute('href', './events.html');
      });
      ['agenda', 'flow'].forEach(function (key) {
        nav.querySelectorAll('a[data-mdj-nav="' + key + '"]').forEach(function (a) {
          a.classList.add('mdj-mainnav-reserved-slot');
          a.setAttribute('aria-hidden', 'true');
          a.setAttribute('tabindex', '-1');
        });
      });
      /* MI PORTAL en Home para comprador; artistas/staff usan CONFIG / MI PERFIL. */
      var _isClientHome = !!window.__mdjLastNavIsClient || window.__mdjLastBuyerSession === true;
      if (!_isClientHome) {
        nav.querySelectorAll('a[data-mdj-nav="mi-portal"]').forEach(function (a) {
          /* Decisión PO 2026-08-16: MI PERFIL es la única etiqueta del puesto 8 y se ve
             SIEMPRE, también en invitado (lleva a login.html). Este bloque venía de cuando
             había dos etiquetas y reservaba MI PORTAL a quien no fuese cliente; hoy dejaría
             el puesto canónico invisible. Se salta el slot canónico. */
          if (a.getAttribute('data-mdj-slot') === '8') return;
          a.classList.add('mdj-mainnav-reserved-slot');
          a.setAttribute('aria-hidden', 'true');
          a.setAttribute('tabindex', '-1');
        });
      }
      if (window.showMyArtisticProfileMainNav) {
        var mi = mdjEnsureGuestMiPerfilMainNavLink();
        if (mi) {
          mi.classList.remove('mdj-mainnav-reserved-slot');
          mi.removeAttribute('aria-hidden');
          mi.removeAttribute('tabindex');
          mi.style.removeProperty('display');
          mi.style.removeProperty('visibility');
          mi.style.removeProperty('pointer-events');
          var contact = nav.querySelector('a[data-mdj-nav="contact"]');
          if (contact && contact.parentNode === nav) {
            if (contact.nextSibling !== mi) {
              if (contact.nextSibling) nav.insertBefore(mi, contact.nextSibling);
              else nav.appendChild(mi);
            }
          } else if (nav.lastElementChild !== mi) {
            nav.appendChild(mi);
          }
        }
      }
      mdjInstallMainNavStaticMode();
    } catch (eHomeNav) {
      /* noop */
    }
  }

  /** Tras hidratar sesión: marcar Events activo en events.html (data-mdj-nav=venues). */
  function mdjHighlightEventsPageNav() {
    if (!mdjIsGuestHomeNavPage()) return;
    if (document.body && document.body.classList.contains('mdj-artist-header-mode')) return;
    try {
      document.querySelectorAll('#mainNav a[data-mdj-nav="venues"], .mobile-nav a[data-mdj-nav="venues"]').forEach(function (el) {
        el.classList.add('active');
      });
      document.querySelectorAll('#mainNav a[data-mdj-nav]:not([data-mdj-nav="venues"])').forEach(function (el) {
        el.classList.remove('active');
      });
    } catch (e) {
      /* noop */
    }
  }

  /** Home público (index): #mainNav guest con MI PERFIL; no sustituir por #mainNav-artist. */
  function mdjIsPublicHomePage() {
    try {
      if (document.body && document.body.classList.contains('page-home')) return true;
      var path = (window.location.pathname || '').split('/').pop() || '';
      path = String(path).toLowerCase();
      return path === '' || path === 'index.html' || path === 'index';
    } catch (e) {
      return false;
    }
  }

  /** events.html — resaltado #mainNav guest (invitado/comprador); artista usa #mainNav-artist (ART-004). */
  function mdjIsGuestHomeNavPage() {
    try {
      var path = (window.location.pathname || '').split('/').pop() || '';
      return String(path).toLowerCase() === 'events.html';
    } catch (e) {
      return false;
    }
  }

  /** 6 páginas públicas guest: Inicio · Servicios · Eventos · Shop · Trabajos · Contacto (+ CONFIG/MI PERFIL vía JS). */
  function mdjIsZeroLoginGuestNavPage() {
    try {
      if (mdjIsPublicHomePage() || mdjIsGuestHomeNavPage()) return true;
      var path = (window.location.pathname || '').split('/').pop() || '';
      path = String(path).toLowerCase();
      return /^(rentals|services|shop|jobs|contact)\.html$/i.test(path);
    } catch (e) {
      return false;
    }
  }

  function mdjArtistNavWithProfileContext(relPath) {
    try {
      var u = new URL(relPath, window.location.href);
      u.searchParams.set('mdj_nav', 'profile');
      var file = u.pathname.replace(/^.*\//, '') || '';
      return './' + file + u.search + (u.hash || '');
    } catch (e) {
      var sep = relPath.indexOf('?') >= 0 ? '&' : '?';
      return relPath + sep + 'mdj_nav=profile';
    }
  }

  /** Perfil artístico público (QR / enlace externo) — no confundir con portal operativo del artista. */
  function mdjBuildArtistPublicProfileHref() {
    var uid = window.__mdjNavOwnUserId ? String(window.__mdjNavOwnUserId) : '';
    if (uid) {
      return './dj-profile.html?id=' + encodeURIComponent(uid) + '&mdj_nav=profile';
    }
    return './dj-profile.html?mdj_nav=profile';
  }

  /** Riel artista #mainNav-artist — MI PERFIL → perfil artístico real (no Agenda ni CONFIG). */
  function mdjBuildArtistMainNavMiPerfilHref() {
    var uid = window.__mdjNavOwnUserId ? String(window.__mdjNavOwnUserId).trim() : '';
    if (uid) {
      return './dj-profile.html?id=' + encodeURIComponent(uid);
    }
    return './dj-profile.html';
  }

  /** Legacy portal href — no usar en #mainNav-artist MI PERFIL (A-1). */
  function mdjBuildArtistPortalMainNavHref() {
    var uid = window.__mdjNavOwnUserId ? String(window.__mdjNavOwnUserId).trim() : '';
    if (uid) {
      return './dj-dashboard.html?id=' + encodeURIComponent(uid);
    }
    return './dj-dashboard.html';
  }

  /** Edificio Staff: ART-007B/C no aplican — navegación interna aprobada intacta. */
  function mdjIsStaffBuildingPage() {
    try {
      var page = (window.location.pathname.split('/').pop() || '').toLowerCase();
      return page === 'admin-dashboard.html' || page === 'account-profile.html' || page === 'staff.html';
    } catch (eSb) {
      return false;
    }
  }

  /** STAFF building (#owner-tabs): Owner → dj-profile público; resto staff → account-profile. */
  function mdjApplyStaffBuildingMiPerfilLink(el) {
    if (!el || el.tagName !== 'A' || !mdjIsStaffBuildingPage()) return;
    var uid = window.__mdjNavOwnUserId ? String(window.__mdjNavOwnUserId).trim() : '';
    if (!uid) {
      try {
        uid = String(localStorage.getItem('sb-current-user-id') || '').trim();
      } catch (eUid) {
        uid = '';
      }
    }
    var idn = window.__mdjLastPlatformIdentity;
    var role = idn && idn.dbRole ? String(idn.dbRole).toLowerCase() : '';
    if (!role && window.__mdjpro && window.__mdjpro.role) {
      role = String(window.__mdjpro.role).toLowerCase();
    }
    if (role === 'owner' && uid) {
      el.href = './dj-profile.html?id=' + encodeURIComponent(uid);
    } else {
      el.href = './account-profile.html';
    }
  }

  /** Login staff entry — flag mdj_staff_entry evita cadena auth → CONFIG artista (ART-007B). */
  function mdjBuildStaffEntryLoginHref() {
    return './login.html?next=./admin-dashboard.html&mdj_staff_entry=1';
  }

  /** Riel artista #mainNav-artist — STAFF → puerta edificio staff (no CONFIG). */
  function mdjBuildArtistStaffMainNavHref() {
    var idn = window.__mdjLastPlatformIdentity;
    if (idn && idn.staffInDb) {
      if (idn.managementInDb) return './staff.html';
      return './admin-dashboard.html#staff';
    }
    return mdjBuildStaffEntryLoginHref();
  }

  /** Riel #mainNav-artist — DJ TOOLS: artista logueado → perfil; guest → página pública (ART-011). */
  function mdjBuildArtistMainNavDjToolsHref() {
    if (mdjHasActiveArtistSessionId() && mdjResolveShowMyArtisticProfileMainNav({ allowUidFallback: true })) {
      return mdjArtistNavWithProfileContext('./dj-tools.html');
    }
    return './dj-tools.html';
  }

  /**
   * ART-011B: #mainNav guest/Home — DJ TOOLS href según sesión (misma regla que #mainNav-artist).
   * Solo cuando el riel visible es #mainNav; si #mainNav-artist está activo, ART-011 manda.
   */
  function mdjHydrateMainNavDjToolsHref() {
    var nav = document.getElementById('mainNav');
    if (!nav) return;
    var el = nav.querySelector('a[data-mdj-nav="tools"]');
    if (!el) return;
    if (document.body && document.body.classList.contains('mdj-artist-header-mode')) {
      var artistNav = document.getElementById('mainNav-artist');
      if (artistNav && !artistNav.hidden) return;
    }
    try {
      el.setAttribute('href', mdjBuildArtistMainNavDjToolsHref());
    } catch (eDjToolsMainHref) {
      /* ignore */
    }
  }

  /**
   * Puente runtime: expone window.showMyArtisticProfileMainNav (consola / Home).
   * Si la variable local no existe aún, infiere artista por __mdjNavOwnUserId + __mdjLastNavTier.
   */
  function mdjResolveShowMyArtisticProfileMainNav(ctx) {
    ctx = ctx || {};
    var isClient = ctx.isClient === true || window.__mdjLastNavIsClient === true;
    var isNavStaffSolo =
      ctx.isNavStaffSolo === true ||
      !!(window.__mdjLastPlatformIdentity && window.__mdjLastPlatformIdentity.navStaffSolo);
    var navTier =
      ctx.navTier != null && ctx.navTier !== ''
        ? String(ctx.navTier)
        : window.__mdjLastNavTier != null
          ? String(window.__mdjLastNavTier)
          : '';
    var uid = window.__mdjNavOwnUserId ? String(window.__mdjNavOwnUserId).trim() : '';
    var byTier =
      !isClient && !isNavStaffSolo && (navTier === 'artist_lite' || navTier === 'artist_pro');
    var byUid = !!uid && !isClient && !isNavStaffSolo;
    var show = byTier || (byUid && ctx.allowUidFallback !== false);
    window.showMyArtisticProfileMainNav = !!show;
    return window.showMyArtisticProfileMainNav;
  }

  function mdjHasActiveArtistSessionId() {
    return !!(window.__mdjNavOwnUserId && String(window.__mdjNavOwnUserId).trim());
  }

  function mdjApplyMiPerfilNavLabel(el) {
    if (!el) return;
    el.setAttribute('data-i18n', 'nav-my-profile');
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var tx = window.i18n.t('nav-my-profile');
        if (tx) el.textContent = tx;
        else {
          var rawF = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
          el.textContent = rawF.indexOf('es') === 0 ? 'MI PERFIL' : 'MY PROFILE';
        }
      } else {
        var raw = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
        el.textContent = raw.indexOf('es') === 0 ? 'MI PERFIL' : 'MY PROFILE';
      }
    } catch (e) {
      el.textContent = 'MY PROFILE';
    }
  }

  /**
   * Markup del riel artista (#mainNav-artist): solo <a>, orden fijo en HTML (sin reorder DOM).
   * INICIO · SERVICIOS · EVENTOS · SHOP · CONFIG · TRABAJOS · DJ TOOLS · CONTACTO · MI PERFIL · STAFF
   * SCHEDULE no pertenece a esta barra (solo barra interna MI PERFIL / #owner-tabs).
   */
  function mdjArtistMainNavLinksHtml(includeMiPerfil) {
    var miPerfilCell = '';
    if (includeMiPerfil) {
      miPerfilCell =
        '<a href="' +
        mdjBuildArtistMainNavMiPerfilHref() +
        '" id="mainNav-artist-mi-perfil-link" class="mdj-artist-nav-cell" data-mdj-artist-nav="my-profile" data-i18n="nav-my-profile">MI PERFIL</a>';
    }
    var staffCell =
      '<a href="' +
      mdjBuildArtistStaffMainNavHref() +
      '" id="mainNav-artist-staff-link" class="mdj-artist-nav-cell" data-mdj-artist-nav="staff" data-i18n="nav-staff">STAFF</a>';
    return (
      '<a href="./index.html" class="mdj-artist-nav-cell" data-mdj-artist-nav="home" data-i18n="nav-home">Inicio</a>' +
      '<a href="./rentals.html" class="mdj-artist-nav-cell" data-mdj-artist-nav="services" data-i18n="nav-services">Servicios</a>' +
      '<a href="./events.html" class="mdj-artist-nav-cell" data-mdj-artist-nav="events" data-i18n="nav-rentals">Eventos</a>' +
      '<a href="./shop.html" class="mdj-artist-nav-cell" data-mdj-artist-nav="shop" data-i18n="nav-shop" style="color:var(--gold);font-weight:800;">Shop</a>' +
      '<a href="' +
      mdjArtistNavWithProfileContext('./account-settings.html') +
      '" class="mdj-artist-nav-cell" data-mdj-artist-nav="config" data-i18n="nav-config">⚙️ CONFIG</a>' +
      '<a href="./jobs.html" class="mdj-artist-nav-cell" data-mdj-artist-nav="jobs" data-i18n="nav-jobs">Trabajos</a>' +
      '<a href="' +
      mdjBuildArtistMainNavDjToolsHref() +
      '" class="mdj-artist-nav-cell" data-mdj-artist-nav="tools" data-i18n="nav-tools">DJ Tools</a>' +
      '<a href="./contact.html" class="mdj-artist-nav-cell" data-mdj-artist-nav="contact" data-i18n="nav-contact">Contacto</a>' +
      miPerfilCell +
      staffCell
    );
  }

  function mdjRefreshArtistNavHrefs(nav) {
    if (!nav) return;
    var byKey = {
      home: './index.html',
      services: './rentals.html',
      events: './events.html',
      shop: './shop.html',
      config: mdjArtistNavWithProfileContext('./account-settings.html'),
      jobs: './jobs.html',
      tools: mdjBuildArtistMainNavDjToolsHref(),
      contact: './contact.html',
      'my-profile': mdjBuildArtistMainNavMiPerfilHref(),
      staff: mdjBuildArtistStaffMainNavHref()
    };
    nav.querySelectorAll('a[data-mdj-artist-nav]').forEach(function (a) {
      var k = a.getAttribute('data-mdj-artist-nav');
      if (byKey[k]) a.setAttribute('href', byKey[k]);
    });
  }

  /** Render único del riel artista (variante core vs full con MI PERFIL). */
  function mdjRenderArtistNav(nav, includeMiPerfil) {
    if (!nav) return;
    var variant = includeMiPerfil ? MDJ_ARTIST_RAIL_VARIANT_FULL : MDJ_ARTIST_RAIL_VARIANT_CORE;
    if (nav.getAttribute('data-mdj-artist-rail-variant') !== variant) {
      nav.innerHTML = mdjArtistMainNavLinksHtml(!!includeMiPerfil);
      nav.setAttribute('data-mdj-artist-rail-variant', variant);
    }
    if (includeMiPerfil) {
      mdjApplyMiPerfilNavLabel(nav.querySelector('[data-mdj-artist-nav="my-profile"]'));
    }
    mdjRefreshArtistNavHrefs(nav);
    var staffArtistLink = nav.querySelector('[data-mdj-artist-nav="staff"]');
    if (staffArtistLink) mdjBindStaffNavClickGuard(staffArtistLink);
    try {
      if (window.i18n && typeof window.i18n.updateUI === 'function') {
        window.i18n.updateUI();
      }
    } catch (eI18nArtist) { /* ignore */ }
  }

  /**
   * Flujo único de sesión artista: #mainNav guest + riel artista (services, rentals, etc.).
   */
  function mdjApplyArtistSessionNav(show, profileHref) {
    window.showMyArtisticProfileMainNav = !!show;
    if (!show) {
      mdjApplyArtistDashboardNavChrome(false);
      var artistNavOff = document.getElementById('mainNav-artist');
      if (artistNavOff) mdjRenderArtistNav(artistNavOff, false);
      return;
    }
    var href =
      profileHref && String(profileHref).trim()
        ? mdjNormalizeArtistProfileNavHref(profileHref)
        : mdjBuildArtistPublicProfileHref();
    mdjEnsureGuestMiPerfilMainNavLink();
    mdjApplyArtistDashboardNavChrome(true, href);
    var artistNavOn = document.getElementById('mainNav-artist');
    if (artistNavOn && !artistNavOn.hidden) {
      mdjRenderArtistNav(artistNavOn, true);
    }
    if (mdjIsPublicHomePage()) {
      mdjNormalizePublicHomeMainNav();
    }
  }

  function mdjHydrateArtistSessionIdFromSupabase() {
    if (mdjHasActiveArtistSessionId()) {
      return Promise.resolve(String(window.__mdjNavOwnUserId).trim());
    }
    var sb = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
    if (!sb || !sb.auth || typeof sb.auth.getSession !== 'function') {
      return Promise.resolve('');
    }
    return sb.auth
      .getSession()
      .then(function (res) {
        var sess = res && res.data && res.data.session;
        var id = sess && sess.user && sess.user.id ? String(sess.user.id).trim() : '';
        if (!id) return '';
        var metaUt =
          sess.user && sess.user.user_metadata && sess.user.user_metadata.user_type
            ? String(sess.user.user_metadata.user_type).toLowerCase()
            : '';
        var appRole =
          sess.user && sess.user.app_metadata && sess.user.app_metadata.role
            ? String(sess.user.app_metadata.role).toLowerCase()
            : '';
        if (metaUt === 'client' || appRole === 'client') return '';
        window.__mdjNavOwnUserId = id;
        return id;
      })
      .catch(function () {
        return '';
      });
  }

  /** Autodetección global: __mdjNavOwnUserId o Supabase → MI PERFIL en todas las vistas públicas. */
  function mdjAutodetectArtistMiPerfilNav() {
    return mdjHydrateArtistSessionIdFromSupabase().then(function (id) {
      var show = mdjResolveShowMyArtisticProfileMainNav({ allowUidFallback: true });
      var href = id
        ? './dj-profile.html?id=' + encodeURIComponent(id) + '&mdj_nav=profile'
        : mdjBuildArtistPublicProfileHref();
      mdjApplyArtistSessionNav(show, href);
      if (!show) {
        mdjHideGuestMiPerfilMainNavSlot();
      }
      /* Staff: MI PERFIL destination by sub-role.
         Owner  → public manager profile (dj-profile.html?id=uid).
         Other staff (admin/manager/seller) → internal account panel. */
      var _staffIdn = window.__mdjLastPlatformIdentity;
      if (_staffIdn && _staffIdn.staffInDb) {
        var _gmpStaff = document.getElementById('mainNav-guest-mi-perfil-link');
        if (_gmpStaff) {
          var _ownUid = window.__mdjNavOwnUserId ? String(window.__mdjNavOwnUserId).trim() : '';
          var _role = String(_staffIdn.dbRole || '').toLowerCase();
          var _isOwnerDbRole = _role === 'owner' || _role === 'admin' || _role === 'manager';
          if (_isOwnerDbRole && _ownUid) {
            _gmpStaff.href = './dj-profile.html?id=' + encodeURIComponent(_ownUid);
          } else {
            _gmpStaff.href = './account-settings.html';
          }
        }
      }
      return show;
    });
  }

  function mdjBridgeArtistMiPerfilPublicNav(profileHref) {
    var show =
      !!mdjHasActiveArtistSessionId() ||
      mdjResolveShowMyArtisticProfileMainNav({ allowUidFallback: true });
    mdjApplyArtistSessionNav(show, profileHref);
  }

  function mdjBridgeHomeMiPerfilNav(profileHref) {
    return mdjBridgeArtistMiPerfilPublicNav(profileHref);
  }

  function mdjAutodetectHomeArtistSession() {
    return mdjAutodetectArtistMiPerfilNav();
  }

  function mdjBodyHasProfileNavContext() {
    try {
      if (document.body && document.body.classList.contains('mdj-from-profile')) return true;
      return new URLSearchParams(window.location.search || '').get('mdj_nav') === 'profile';
    } catch (e) {
      return false;
    }
  }

  /** Fila 2 artista (#mainNav-artist): 8 enlaces core; invitado #mainNav oculto sin CLS. */
  function mdjEnsureArtistMainNav() {
    var headerNav = document.querySelector('#mainHeader .header-nav .container');
    if (!headerNav) return null;
    var existing = document.getElementById('mainNav-artist');
    if (existing) return existing;
    var nav = document.createElement('nav');
    nav.id = 'mainNav-artist';
    nav.className = 'nav top-nav mdj-artist-mainnav';
    nav.setAttribute('aria-label', 'Navegación de artista');
    nav.hidden = true;
    nav.setAttribute('aria-hidden', 'true');
    mdjRenderArtistNav(nav, false);
    var guestNav = document.getElementById('mainNav');
    if (guestNav && guestNav.parentNode === headerNav) {
      headerNav.insertBefore(nav, guestNav.nextSibling);
    } else {
      headerNav.appendChild(nav);
    }
    return nav;
  }

  function mdjNavHighlightArtist() {
    var nav = document.getElementById('mainNav-artist');
    if (!nav || nav.hidden) return;
    var path = '';
    try {
      path = (window.location.pathname || '').split('/').pop() || '';
    } catch (e) {
      path = '';
    }
    path = String(path).toLowerCase();
    var key = '';
    if (path === 'index.html' || path === '' || path === 'index') key = 'home';
    else if (path === 'rentals.html' || path === 'services.html') key = 'services';
    else if (path === 'events.html') key = 'events';
    else if (path === 'jobs.html') key = 'jobs';
    else if (path === 'shop.html') key = 'shop';
    else if (path === 'dj-tools.html') key = 'tools';
    else if (path === 'contact.html') key = 'contact';
    else if (path === 'account-settings.html') key = 'config';
    else if (path === 'dj-dashboard.html') {
      nav.querySelectorAll('a[data-mdj-artist-nav]').forEach(function (el) {
        var k = el.getAttribute('data-mdj-artist-nav');
        el.classList.toggle('active', k === 'my-profile');
      });
      return;
    } else if (path === 'admin-dashboard.html' || path === 'account-profile.html' || path === 'staff.html') {
      nav.querySelectorAll('a[data-mdj-artist-nav]').forEach(function (el) {
        var k = el.getAttribute('data-mdj-artist-nav');
        el.classList.toggle('active', k === 'staff');
      });
      return;
    }
    nav.querySelectorAll('a[data-mdj-artist-nav]').forEach(function (el) {
      el.classList.toggle('active', !!key && el.getAttribute('data-mdj-artist-nav') === key);
    });
  }

  /**
   * Modo cabecera artista: body.mdj-artist-header-mode + #mainNav-artist (fila 2).
   * Con ?mdj_nav=profile la franja #owner-tabs manda; no duplicar fila 2 en .header-nav.
   */
  function mdjApplyArtistHeaderRow2(enabled) {
    var guestNav = document.getElementById('mainNav');
    var artistNav = mdjEnsureArtistMainNav();
    var fromProfile = mdjBodyHasProfileNavContext();

    if (enabled) {
      /* ══ LA CABECERA UNICA APLICA TAMBIEN AL ARTISTA ══════════════════════
         Esta rama venia del modelo viejo de DOS barras: apagaba #mainNav
         —aria-hidden + data-mdj-guest-nav-suppressed, que lo colapsa a 1px
         absoluto— para cederle el sitio a #mainNav-artist, la fila 2.

         Pero #mainNav-artist murio con la consolidacion de 9 puestos: esta en
         MDJ_RIELES_MUERTOS y header-unified.css le pone display:none. Con las
         dos vias apagadas a la vez, una cuenta de artista se quedaba SIN
         NINGUNA barra: medido, #mainNav con 1px de ancho y su contenido
         derramandose a X=-690 en dj-profile, account-settings, jobs y contact.
         Solo le pasaba a los artistas.

         La decision ya estaba tomada en header-unified.css:3054 — «la cabecera
         unica es SAGRADA... no puede quedar oculta en ninguna pagina». Esta
         funcion nunca se actualizo para respetarla. Ahora no apaga nada: el
         artista usa el MISMO #mainNav que el resto, con los mismos puestos y en
         la misma posicion. No hay barra especial de artista.

         La clase se conserva porque no gobierna la barra: estiliza el boton de
         sesion de la fila superior. */
      document.body.classList.add('mdj-artist-header-mode');
      if (guestNav) {
        guestNav.removeAttribute('aria-hidden');
        guestNav.removeAttribute('data-mdj-guest-nav-suppressed');
      }
      if (artistNav) {
        artistNav.hidden = true;
        artistNav.setAttribute('aria-hidden', 'true');
      }
      return;
    }

    document.body.classList.remove('mdj-artist-header-mode');
    if (guestNav) {
      guestNav.removeAttribute('aria-hidden');
      guestNav.removeAttribute('data-mdj-guest-nav-suppressed');
    }
    if (artistNav) {
      artistNav.hidden = true;
      artistNav.setAttribute('aria-hidden', 'true');
      artistNav.querySelectorAll('a[data-mdj-artist-nav]').forEach(function (el) {
        el.classList.remove('active');
      });
    }
  }

  /** MI PERFIL en #mainNav público: hueco fijo → ./dj-profile.html?mdj_nav=profile */
  function mdjEnsureGuestMiPerfilMainNavLink() {
    var nav = document.getElementById('mainNav');
    if (!nav) return null;
    /* En el juego interno el puesto 8 YA es Mi Perfil y se ve siempre, así que
       este nodo de respaldo para invitado no tiene función: solo añadía un
       segundo «MI PERFIL» al riel (academia salía con 10 puestos). El
       normalizador lo retira por DUPLICADOS_8, pero esta inyección corre
       DESPUÉS de su barrido y el duplicado sobrevivía. */
    if (mdjTablaDeSlots() === MDJ_NAV_SLOTS_INTERNO) return null;
    var el = document.getElementById('mainNav-guest-mi-perfil-link');
    var legacy = document.getElementById('mainNav-artist-dashboard-link');
    if (legacy && !el) {
      legacy.id = 'mainNav-guest-mi-perfil-link';
      el = legacy;
    }
    if (!el) {
      el = document.createElement('a');
      el.id = 'mainNav-guest-mi-perfil-link';
      el.setAttribute('data-mdj-nav', 'my-profile');
      el.setAttribute('data-i18n', 'nav-my-profile');
      el.className = 'mdj-guest-mi-perfil-mainnav mdj-mainnav-reserved-slot';
      var insBefore = mdjGetMainNavStaffAnchor();
      if (insBefore && insBefore.parentNode === nav) {
        nav.insertBefore(el, insBefore);
      } else {
        var ref = document.getElementById('mainNav-mi-portal-link');
        if (ref && ref.parentNode === nav) {
          if (ref.nextSibling) nav.insertBefore(el, ref.nextSibling);
          else nav.appendChild(el);
        } else {
          nav.appendChild(el);
        }
      }
    }
    el.href = mdjBuildArtistPublicProfileHref();
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var tx = window.i18n.t('nav-my-profile');
        if (tx) el.textContent = tx;
      } else {
        var raw = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
        el.textContent = raw.indexOf('es') === 0 ? 'MI PERFIL' : 'MY PROFILE';
      }
    } catch (eLbl) {
      el.textContent = 'MY PROFILE';
    }
    return el;
  }

  function mdjNormalizeArtistProfileNavHref(href) {
    try {
      var u = new URL(String(href).trim(), window.location.href);
      if (!u.searchParams.get('mdj_nav')) u.searchParams.set('mdj_nav', 'profile');
      var file = u.pathname.replace(/^.*\//, '') || 'dj-profile.html';
      return './' + file + u.search + (u.hash || '');
    } catch (e) {
      return mdjBuildArtistPublicProfileHref();
    }
  }

  function mdjHideGuestMiPerfilMainNavSlot() {
    var el = document.getElementById('mainNav-guest-mi-perfil-link');
    if (!el) return;
    el.classList.add('mdj-mainnav-reserved-slot');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('tabindex', '-1');
    el.style.removeProperty('display');
  }

  /** MI PERFIL en #mainNav: solo sesión artista/staff. Vista Cero (anon) no lo muestra — login es ENTRAR. */
  function mdjRevealGuestMiPerfilNavSlot() {
    var hasSession = !!(window.__mdjNavOwnUserId && String(window.__mdjNavOwnUserId).trim());
    var _idn0 = window.__mdjLastPlatformIdentity;
    var staffOk = !!( _idn0 && _idn0.staffInDb );
    var artistOk = window.showMyArtisticProfileMainNav === true;
    if (!hasSession && !staffOk && !artistOk) {
      mdjHideGuestMiPerfilMainNavSlot();
      return;
    }
    var el = document.getElementById('mainNav-guest-mi-perfil-link') || mdjEnsureGuestMiPerfilMainNavLink();
    if (!el) return;
    var _idn = window.__mdjLastPlatformIdentity;
    el.href = (_idn && _idn.staffInDb) ? './account-settings.html' : './login.html';
    el.classList.remove('mdj-mainnav-reserved-slot');
    el.removeAttribute('aria-hidden');
    el.removeAttribute('tabindex');
    el.style.removeProperty('display');
    el.style.removeProperty('visibility');
    el.style.removeProperty('pointer-events');
  }

  /** Móvil: quitar nodo duplicado. Escritorio: nunca quitar #mainNav-guest-mi-perfil-link (hueco fijo). */
  function mdjRemoveArtistDashboardNavLinks() {
    mdjHideGuestMiPerfilMainNavSlot();
    var artistNav = document.getElementById('mainNav-artist');
    if (artistNav) mdjRenderArtistNav(artistNav, false);
    var mb = document.getElementById('header-artist-dashboard-mobile');
    if (mb) mb.remove();
  }

  /** STAFF en #mainNav: el HTML usa `mainNav-staff-link` (admin) o `mainNav-staff-or-profile` (sitio unificado). */
  function mdjGetMainNavStaffAnchor() {
    return document.getElementById('mainNav-staff-link') || document.getElementById('mainNav-staff-or-profile');
  }

  /** Aplica href STAFF unificado (ART-007B) + guard — solo edificio artista. */
  function mdjApplyStaffNavHref(el) {
    if (!el || mdjIsStaffBuildingPage()) return;
    var href = mdjBuildArtistStaffMainNavHref();
    try {
      el.setAttribute('href', href);
    } catch (eH) {
      el.href = href;
    }
    try {
      if (!el.getAttribute('data-mdj-nav')) el.setAttribute('data-mdj-nav', 'staff');
    } catch (eA) { /* ignore */ }
    mdjBindStaffNavClickGuard(el);
  }

  /** Todos los nodos STAFF del edificio artista (riel, #mainNav, #owner-tabs). */
  function mdjRefreshAllStaffNavLinks() {
    if (mdjIsStaffBuildingPage()) return;
    try {
      var seen = typeof Set === 'function' ? new Set() : null;
      var sels = [
        '#mainNav-artist a[data-mdj-artist-nav="staff"]',
        '#owner-tabs a[data-mdj-nav="staff"]',
        '#mainNav-staff-or-profile',
        '#mainNav-staff-link',
        'a[data-mdj-nav="staff"]'
      ];
      sels.forEach(function (sel) {
        document.querySelectorAll(sel).forEach(function (el) {
          if (!el || el.tagName !== 'A') return;
          if (seen) {
            if (seen.has(el)) return;
            seen.add(el);
          }
          var hidden =
            el.classList.contains('mdj-mainnav-reserved-slot') &&
            el.getAttribute('aria-hidden') === 'true';
          if (hidden) {
            mdjBindStaffNavClickGuard(el);
            return;
          }
          mdjApplyStaffNavHref(el);
        });
      });
    } catch (eR) { /* ignore */ }
  }

  /** Alias histórico — mismo refresco global. */
  function mdjRefreshOwnerStripStaffLinks() {
    mdjRefreshAllStaffNavLinks();
  }

  /**
   * Capture único: cualquier STAFF usa mdjBuildArtistStaffMainNavHref al click (ART-007B).
   * Cubre owner-tabs / perfil artístico aunque un poll legacy no haya refrescado el href.
   */
  function mdjInstallGlobalStaffNavCapture() {
    if (window.__mdjStaffNavCaptureInstalled) return;
    window.__mdjStaffNavCaptureInstalled = true;
    document.addEventListener(
      'click',
      function (e) {
        if (mdjIsStaffBuildingPage()) return;
        var t =
          e.target && e.target.closest
            ? e.target.closest(
                'a[data-mdj-nav="staff"], a[data-mdj-artist-nav="staff"], #mainNav-staff-or-profile, #mainNav-staff-link'
              )
            : null;
        if (!t || t.tagName !== 'A') return;
        var href = mdjBuildArtistStaffMainNavHref();
        try {
          t.setAttribute('href', href);
        } catch (eH) {
          t.href = href;
        }
        var idn = window.__mdjLastPlatformIdentity;
        if (idn && idn.staffInDb) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        window.location.replace(mdjBuildStaffEntryLoginHref());
      },
      true
    );
  }

  /** Owner strip / main nav STAFF: block navigation for non-staff before admin-dashboard paints. */
  function mdjBindStaffNavClickGuard(el) {
    if (!el || mdjIsStaffBuildingPage() || el.dataset.mdjStaffNavBound === '1') return;
    el.dataset.mdjStaffNavBound = '1';
    el.addEventListener(
      'click',
      function (e) {
        var idn = window.__mdjLastPlatformIdentity;
        var staffOk = !!(idn && idn.staffInDb);
        if (staffOk) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        window.location.replace(mdjBuildStaffEntryLoginHref());
      },
      true
    );
  }

  /** STAFF (admin): solo staff de dj_profiles; hueco reservado con .mdj-mainnav-reserved-slot + visibility en CSS móvil. */
  function mdjApplyStaffMainNavLink(isStaff) {
    var a = mdjGetMainNavStaffAnchor();
    if (!a) return;
    if (isStaff) {
      mdjApplyStaffNavHref(a);
      a.classList.remove('mdj-mainnav-reserved-slot');
      a.style.removeProperty('visibility');
      a.style.removeProperty('pointer-events');
      a.removeAttribute('aria-hidden');
      a.removeAttribute('tabindex');
    } else {
      try {
        a.setAttribute('href', '#');
      } catch (eH2) { /* ignore */ }
      a.classList.add('mdj-mainnav-reserved-slot');
      a.style.removeProperty('visibility');
      a.style.removeProperty('pointer-events');
      a.setAttribute('aria-hidden', 'true');
      a.setAttribute('tabindex', '-1');
      mdjBindStaffNavClickGuard(a);
    }
  }

  /**
   * Crea #mainNav-config-link si falta — comprador: debe existir en HTML tras Shop; resto: antes de Jobs.
   * Sin esto, Agenda/Flujo no tienen ancla; `mdjApplyConfigMainNavLink` quedaría en no-op.
   */
  function mdjEnsureConfigMainNavNode() {
    var existing = document.getElementById('mainNav-config-link');
    if (existing) return existing;
    if (mdjIsBuyerJourneyPage()) {
      try {
        console.warn(
          '[Header] #mainNav-config-link missing on buyer journey — expected after Shop in HTML; no insertBefore.'
        );
      } catch (eWarnCfg) { /* ignore */ }
      return null;
    }
    var nav = document.getElementById('mainNav');
    if (!nav) return null;
    var a = document.createElement('a');
    a.id = 'mainNav-config-link';
    a.setAttribute('data-mdj-nav', 'config');
    a.setAttribute('data-i18n', 'nav-config');
    a.className = 'mdj-config-mainnav mdj-mainnav-reserved-slot';
    /* FIX-NAV-CONFIG-01: era la tercera definicion del mismo destino, y encima
       apuntaba a una cuarta pagina distinta. Se pide al resolvedor unico. */
    a.href = mdjResolveConfigHref();
    mdjEngancharConfig(a);
    a.setAttribute('aria-hidden', 'true');
    a.setAttribute('tabindex', '-1');
    a.textContent = '⚙️ CONFIG';
    var jobs = nav.querySelector('a[data-mdj-nav="jobs"]');
    var tools = nav.querySelector('a[data-mdj-nav="tools"]');
    if (jobs && jobs.parentNode === nav) {
      nav.insertBefore(a, jobs);
    } else if (tools && tools.parentNode === nav) {
      if (tools.nextSibling) {
        nav.insertBefore(a, tools.nextSibling);
      } else {
        nav.appendChild(a);
      }
    } else {
      nav.appendChild(a);
    }
    return a;
  }

  /**
   * #mainNav ⚙ CONFIG — misma ruta que la píldora superior (`settingsUrl`): panel artista, cuenta staff o portal cliente.
   * Sin sesión: hueco colapsado (`.mdj-mainnav-reserved-slot` + `header-unified.css`).
   */
  function mdjApplyConfigMainNavLink(show, href) {
    var a = mdjEnsureConfigMainNavNode();
    if (!a) return;
    var h = href && String(href).trim() ? String(href).trim() : './account-settings.html?mdj_nav=profile';
    a.setAttribute('href', h);
    if (show) {
      a.setAttribute('data-mdj-nav', 'config');
      a.setAttribute('data-i18n', 'nav-config');
      try {
        var txCfg = window.i18n && typeof window.i18n.t === 'function' ? String(window.i18n.t('nav-config') || '').trim() : '';
        if (txCfg) a.textContent = txCfg;
        else a.textContent = '⚙️ CONFIG';
      } catch (eCfg) {
        a.textContent = '⚙️ CONFIG';
      }
      a.classList.remove('mdj-mainnav-reserved-slot');
      a.style.removeProperty('display');
      a.style.removeProperty('visibility');
      a.style.removeProperty('pointer-events');
      a.removeAttribute('aria-hidden');
      a.removeAttribute('tabindex');
    } else {
      a.classList.add('mdj-mainnav-reserved-slot');
      a.setAttribute('aria-hidden', 'true');
      a.setAttribute('tabindex', '-1');
    }
  }

  /** Comprador: pestaña «⚙️ CONFIG» → client-account (todas las páginas con #mainNav, incl. Home y Events). */
  function mdjApplyBuyerConfigMainNavLink(show) {
    var a = mdjEnsureConfigMainNavNode();
    if (!a) return;
    if (!show) {
      mdjApplyConfigMainNavLink(false);
      return;
    }
    a.setAttribute('href', './client-account.html');
    a.setAttribute('data-mdj-nav', 'client-config');
    a.setAttribute('data-i18n', 'nav-config');
    a.style.removeProperty('display');
    a.style.removeProperty('visibility');
    a.style.removeProperty('pointer-events');
    a.removeAttribute('aria-hidden');
    a.removeAttribute('tabindex');
    try {
      var txCfg =
        window.i18n && typeof window.i18n.t === 'function'
          ? String(window.i18n.t('nav-config') || '').trim()
          : '';
      a.textContent = txCfg || '⚙️ CONFIG';
    } catch (eLbl) {
      a.textContent = '⚙️ CONFIG';
    }
  }

  /** Crea #mainNav-agenda-link antes de CONFIG: pestaña «Agenda» del panel (`?tab=dashboard`). */
  function mdjEnsureAgendaMainNavNode() {
    var existing = document.getElementById('mainNav-agenda-link');
    if (existing) return existing;
    mdjEnsureConfigMainNavNode();
    var nav = document.getElementById('mainNav');
    if (!nav) return null;
    var before =
      document.getElementById('mainNav-config-link') ||
      nav.querySelector('a.mdj-config-mainnav[data-mdj-nav="config"]') ||
      nav.querySelector('a[data-mdj-nav="config"]');
    var a = document.createElement('a');
    a.id = 'mainNav-agenda-link';
    a.setAttribute('data-mdj-nav', 'agenda');
    a.setAttribute('data-i18n', 'dash-your-profile');
    a.className = 'mdj-agenda-mainnav mdj-mainnav-reserved-slot';
    a.href = './dj-dashboard.html?tab=dashboard';
    a.setAttribute('aria-hidden', 'true');
    a.setAttribute('tabindex', '-1');
    var raw = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
    a.textContent = raw.indexOf('es') === 0 ? 'Agenda' : 'SCHEDULE';
    if (before && before.parentNode === nav) {
      nav.insertBefore(a, before);
    } else {
      nav.appendChild(a);
    }
    return a;
  }

  /**
   * Agenda (panel): `dj-dashboard?tab=dashboard` — solo artista LITE/PRO (misma regla que CONFIG social / flujo en barra).
   */
  function mdjApplyAgendaMainNavLink(show, href) {
    var a = mdjEnsureAgendaMainNavNode();
    if (!a) return;
    var h = href && String(href).trim() ? String(href).trim() : './dj-dashboard.html?tab=dashboard';
    a.setAttribute('href', h);
    if (show) {
      a.classList.remove('mdj-mainnav-reserved-slot');
      a.style.removeProperty('display');
      a.style.removeProperty('visibility');
      a.style.removeProperty('pointer-events');
      a.removeAttribute('aria-hidden');
      a.removeAttribute('tabindex');
    } else {
      a.classList.add('mdj-mainnav-reserved-slot');
      a.setAttribute('aria-hidden', 'true');
      a.setAttribute('tabindex', '-1');
    }
  }

  /** Crea #mainNav-flow-link tras CONFIG si no está en el HTML (muchas plantillas duplicadas). */
  function mdjEnsureFlowMainNavNode() {
    var existing = document.getElementById('mainNav-flow-link');
    if (existing) return existing;
    mdjEnsureConfigMainNavNode();
    var nav = document.getElementById('mainNav');
    if (!nav) return null;
    var after =
      document.getElementById('mainNav-config-link') ||
      nav.querySelector('a.mdj-config-mainnav[data-mdj-nav="config"]') ||
      nav.querySelector('a[data-mdj-nav="config"]');
    var a = document.createElement('a');
    a.id = 'mainNav-flow-link';
    a.setAttribute('data-mdj-nav', 'flow');
    a.setAttribute('data-i18n', 'flow-dash');
    a.className = 'mdj-flow-mainnav mdj-mainnav-reserved-slot';
    a.href = './dj-dashboard.html?tab=flow';
    a.setAttribute('aria-hidden', 'true');
    a.setAttribute('tabindex', '-1');
    var raw = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
    a.textContent = raw.indexOf('es') === 0 ? 'Flujo de Caja' : 'Cash Flow';
    if (after && after.parentNode === nav) {
      if (after.nextSibling) {
        nav.insertBefore(a, after.nextSibling);
      } else {
        nav.appendChild(a);
      }
    } else {
      nav.appendChild(a);
    }
    return a;
  }

  /**
   * Flujo de caja: `dj-dashboard?tab=flow` — solo cuentas con perfil de artista (LITE/PRO), no clientes puros.
   */
  function mdjApplyFlowMainNavLink(show, href) {
    var a = mdjEnsureFlowMainNavNode();
    if (!a) return;
    /* Owner en account-settings: CASH FLOW siempre apunta al generador de facturas.
       Ignorar cualquier href que venga del auth-chain (dj-dashboard?tab=flow, etc.). */
    var h = href && String(href).trim() ? String(href).trim() : './dj-dashboard.html?tab=flow';
    a.setAttribute('href', h);
    if (show) {
      a.classList.remove('mdj-mainnav-reserved-slot');
      a.style.removeProperty('display');
      a.style.removeProperty('visibility');
      a.style.removeProperty('pointer-events');
      a.removeAttribute('aria-hidden');
      a.removeAttribute('tabindex');
    } else {
      a.classList.add('mdj-mainnav-reserved-slot');
      a.setAttribute('aria-hidden', 'true');
      a.setAttribute('tabindex', '-1');
    }
  }

  /**
   * Perfil artístico público (#mainNav + móvil): solo talento LITE/PRO, sin clientes ni staff
   * (admin/manager/seller/owner). `profileHref` típico: ./dj-profile.html?id=<user_id>.
   */
  function mdjApplyArtistDashboardNavChrome(show, profileHref) {
    var nav = document.getElementById('mainNav');
    var mobileNav = document.querySelector('#mobileMenu .mobile-nav');
    var href =
      show && profileHref && String(profileHref).trim()
        ? mdjNormalizeArtistProfileNavHref(profileHref)
        : mdjBuildArtistPublicProfileHref();
    function applyLabel(el) {
      if (!el) return;
      el.setAttribute('data-i18n', 'nav-my-profile');
      try {
        if (window.i18n && typeof window.i18n.t === 'function') {
          var tx = window.i18n.t('nav-my-profile');
          if (tx) el.textContent = tx;
          else {
            var rawF = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
            el.textContent = rawF.indexOf('es') === 0 ? 'MI PERFIL' : 'MY PROFILE';
          }
        } else {
          var raw = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
          el.textContent = raw.indexOf('es') === 0 ? 'MI PERFIL' : 'MY PROFILE';
        }
      } catch (e) { /* ignore */ }
      try {
        var es = document.documentElement && String(document.documentElement.lang || '').toLowerCase().indexOf('es') === 0;
        el.setAttribute('aria-label', es ? 'Perfil artístico público' : 'My public artist profile');
      } catch (e2) { /* ignore */ }
    }
    if (!show) {
      mdjRemoveArtistDashboardNavLinks();
      return;
    }
    if (nav) {
      var el = mdjEnsureGuestMiPerfilMainNavLink();
      if (!el) return;
      el.href = href;
      el.setAttribute('data-mdj-nav', 'my-profile');
      applyLabel(el);
      el.classList.remove('mdj-mainnav-reserved-slot');
      el.style.removeProperty('display');
      el.style.removeProperty('visibility');
      el.style.removeProperty('pointer-events');
      el.removeAttribute('aria-hidden');
      el.removeAttribute('tabindex');
    }
    if (mobileNav) {
      var mb = document.getElementById('header-artist-dashboard-mobile');
      if (!mb) {
        mb = document.createElement('a');
        mb.id = 'header-artist-dashboard-mobile';
        mb.className = 'mdj-artist-dashboard-mobile';
        var refM = document.getElementById('header-mi-portal-mobile');
        if (refM && refM.parentNode === mobileNav) {
          if (refM.nextSibling) mobileNav.insertBefore(mb, refM.nextSibling);
          else mobileNav.appendChild(mb);
        } else {
          mobileNav.appendChild(mb);
        }
      }
      mb.href = href;
      mb.setAttribute('data-mdj-nav', 'my-profile');
      applyLabel(mb);
      mb.style.display = '';
    }
  }

  /** Editorial tier badge: Artistic (LITE) | Pro | Staff | Team | Owner. Buyer/client mode uses #header-client-loyalty-indicator only. */
  function mdjApplyNavTierStatusBadge(navTier, ctx) {
    ctx = ctx || {};
    var djRole = String(ctx.djRole || '').toLowerCase();
    var actions = document.querySelector('#mainHeader .header-actions');
    if (!actions) return;
    var id = 'header-tier-status-badge';
    /*
     * Cabecera unificada: la pastilla (p. ej. «Pro») vive en fila 1 con z-index sobre la marca → solapa el wordmark.
     * Misma política que dj-profile (badge solo fuera de esta franja / en panel).
     */
    var mainHdrTier = document.getElementById('mainHeader');
    if (mainHdrTier && mainHdrTier.classList && mainHdrTier.classList.contains('mdj-header-unified')) {
      var rm = document.getElementById(id);
      if (rm) rm.remove();
      return;
    }
    var el = document.getElementById(id);
    if (!navTier || navTier === 'guest') {
      if (el) el.remove();
      return;
    }
    /* Buyer mode: loyalty pill (#header-client-loyalty-indicator) already shows Client/VIP — no duplicate editorial badge. */
    if (navTier === 'client_only') {
      if (el) el.remove();
      return;
    }
    var key = '';
    if (djRole === 'owner') {
      key = 'nav-tier-status-owner';
    } else if (djRole === 'seller') {
      key = 'nav-tier-status-staff';
    } else if (djRole === 'admin' || djRole === 'manager') {
      key = 'nav-tier-status-team';
    } else if (navTier === 'artist_lite') {
      key = 'nav-tier-status-artistic';
    } else if (navTier === 'artist_pro') {
      key = 'nav-tier-status-pro';
    }
    if (!key) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement('span');
      el.id = id;
      el.className = 'header-tier-status-badge';
      el.setAttribute('role', 'status');
      var badge = document.getElementById('header-djpro-badge');
      if (badge && badge.parentNode === actions) {
        actions.insertBefore(el, badge);
      } else {
        actions.appendChild(el);
      }
    }
    el.setAttribute('data-i18n', key);
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var tx = window.i18n.t(key);
        if (tx) el.textContent = tx;
      }
    } catch (e) { /* ignore */ }
    el.style.display = 'inline-flex';
  }

  /** Oculta ENTRAR/LOGIN hasta conocer sesión (evita flash si ya hay cuenta). */
  function mdjEnsureAuthPendingCss() {
    if (document.getElementById('mdj-auth-pending-css')) return;
    var s = document.createElement('style');
    s.id = 'mdj-auth-pending-css';
    s.textContent =
      '#header-login-btn.mdj-auth-pending, #header-login-btn-mobile.mdj-auth-pending { visibility: hidden !important; }';
    document.head.appendChild(s);
  }

  function mdjSetHeaderAuthPillsPending(pending) {
    mdjEnsureAuthPendingCss();
    ['header-login-btn', 'header-login-btn-mobile'].forEach(function (id) {
      var b = document.getElementById(id);
      if (!b) return;
      if (pending) b.classList.add('mdj-auth-pending');
      else b.classList.remove('mdj-auth-pending');
    });
  }

  /**
   * Pastillas ENTRAR/SALIR: siempre `data-auth-btn` + clase danger para que updateAuthButtons()
   * no sea pisado por i18n (data-i18n en el HTML inicial).
   */
  function mdjApplyHeaderAuthPillSession(loggedIn) {
    ['header-login-btn', 'header-login-btn-mobile'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (!btn) return;
      btn.setAttribute('data-auth-btn', '');
      btn.removeAttribute('data-i18n');
      if (loggedIn) {
        btn.classList.remove('gold');
        btn.classList.add('danger');
        btn.href = '#';
        /* Estable (QA / hooks): no sustituye #header-login-btn — el CSS del sitio depende de ese id. */
        btn.setAttribute('data-mdj-logout-id', id === 'header-login-btn' ? 'btn-logout-vip' : 'btn-logout-vip-mobile');
        btn.onclick = function (e) {
          e.preventDefault();
          void window.doLogout(e);
        };
      } else {
        btn.classList.remove('danger');
        btn.classList.add('gold');
        btn.href = './login.html';
        btn.onclick = null;
        btn.removeAttribute('data-mdj-logout-id');
      }
    });
    if (typeof window.updateAuthButtons === 'function') window.updateAuthButtons();
  }

  function mdjStylesheetPresent(substr) {
    try {
      var sheets = document.styleSheets;
      for (var i = 0; i < sheets.length; i++) {
        var h = sheets[i].href || '';
        if (h.indexOf(substr) !== -1) return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  function mdjEnsureHeaderVipCss() {
    if (document.getElementById('mdj-header-vip-css')) return;
    if (mdjStylesheetPresent('mdj-header-vip.css')) return;
    var l = document.createElement('link');
    l.id = 'mdj-header-vip-css';
    l.rel = 'stylesheet';
    l.href = './mdj-header-vip.css?v=20260421-avatar-direct';
    document.head.appendChild(l);
  }

  /** Phase 1 desktop audit: guest ring, loyalty pill, ≥1200px spacing (no change <1200px layout intent). */
  function mdjEnsureDesktopAuditCss() {
    if (document.getElementById('mdj-header-desktop-audit-css')) return;
    if (mdjStylesheetPresent('mdj-header-desktop-audit.css')) return;
    var l = document.createElement('link');
    l.id = 'mdj-header-desktop-audit-css';
    l.rel = 'stylesheet';
    l.href = './mdj-header-desktop-audit.css?v=20260421-menu-static';
    document.head.appendChild(l);
  }

  function mdjClientHeaderIsVipClient(clientRow) {
    if (!clientRow) return false;
    var ev = Number(clientRow.total_events_booked);
    var lp = Number(clientRow.loyalty_points);
    var evOk = !isNaN(ev) && ev >= 2;
    var lpOk = !isNaN(lp) && lp >= 200;
    return evOk || lpOk;
  }

  /** Pastilla portal: Cliente o Cliente VIP — no en cabecera unificada (fila 1: ES/EN → LOGOUT → avatar). */
  function mdjSyncClientLoyaltyIndicator(isClientSession, clientRow) {
    var mainHdr = document.getElementById('mainHeader');
    if (mainHdr && mainHdr.classList && mainHdr.classList.contains('mdj-header-unified')) {
      var rm = document.getElementById('header-client-loyalty-indicator');
      if (rm) rm.remove();
      return;
    }
    var el = document.getElementById('header-client-loyalty-indicator');
    var actions = document.querySelector('#mainHeader .header-actions');
    if (!isClientSession) {
      if (el) {
        el.style.display = 'none';
        el.textContent = '';
        el.removeAttribute('data-i18n');
      }
      return;
    }
    if (!actions) return;
    if (!el) {
      el = document.createElement('span');
      el.id = 'header-client-loyalty-indicator';
      el.className = 'header-client-loyalty-indicator';
      el.setAttribute('role', 'status');
      var lang = actions.querySelector('.lang-switcher');
      if (lang && lang.parentNode) {
        var afterLang = lang.nextSibling;
        if (afterLang) lang.parentNode.insertBefore(el, afterLang);
        else lang.parentNode.appendChild(el);
      } else {
        actions.appendChild(el);
      }
    }
    var vip = mdjClientHeaderIsVipClient(clientRow);
    var i18nKey = vip ? 'header-client-loyalty-vip' : 'header-client-loyalty';
    el.setAttribute('data-i18n', i18nKey);
    var label = vip ? 'VIP Client' : 'Client';
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var tx = window.i18n.t(i18nKey);
        if (tx) label = tx;
      }
    } catch (e) { /* ignore */ }
    if (!window.i18n) {
      var raw = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
      var es = raw.indexOf('es') === 0;
      if (vip) label = es ? 'Cliente VIP' : 'VIP Client';
      else label = es ? 'Cliente' : 'Client';
    }
    el.textContent = label;
    el.style.display = 'inline-flex';
  }

  /** Invitado: mantiene la 8.ª celda (nav mdj-mainnav-flex en tabla) sin quitar el nodo. */
  function mdjResetMainNavPortalGuestSlot() {
    var link = document.getElementById('mainNav-mi-portal-link');
    if (!link) return;
    link.className = 'mdj-mi-portal-mainnav mdj-mi-portal-gold mdj-mi-portal--guest';
    link.href = '#';
    link.setAttribute('data-mdj-nav', 'mi-portal');
    link.setAttribute('aria-hidden', 'true');
    link.setAttribute('tabindex', '-1');
    link.style.removeProperty('display');
    link.style.pointerEvents = 'none';
    link.style.visibility = 'hidden';
    link.removeAttribute('data-i18n');
    try {
      var rawLang = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
      link.textContent = rawLang.indexOf('es') === 0 ? 'MI PORTAL' : 'MY PORTAL';
    } catch (e) {
      link.textContent = 'MY PORTAL';
    }
  }

  /**
   * Guest-only (zero-login): contrato PROD-BLOCKER-001-FIX-2 — 8 pestañas públicas.
   * Visible: Home · Services · Events · Shop · CONFIG · Jobs · Contact · MI PERFIL
   * CONFIG → ./login.html; MI PERFIL → ./login.html; ocultos: MI PORTAL · DJ TOOLS · STAFF
   * Sale si hay sesión comprador/cliente o uid activo (no toca artista/staff/owner logueados).
   */
  function mdjRevealGuestRoleEntryNav() {
    try {
      if (document.body.classList.contains('mdj-buyer-session') || document.body.classList.contains('mdj-is-client')) return;
      if (window.__mdjLastBuyerSession === true) return;
      if (window.__mdjNavOwnUserId) return;
    } catch (eGuard) { /* ignore */ }

    var nav = document.getElementById('mainNav');
    if (!nav) return;

    var venues = nav.querySelector('a[data-mdj-nav="venues"]');
    if (!venues) {
      venues = document.createElement('a');
      venues.setAttribute('data-mdj-nav', 'venues');
      venues.setAttribute('data-i18n', 'nav-rentals');
      var afterSvc = nav.querySelector('a[data-mdj-nav="services"]');
      var beforeShop = nav.querySelector('a[data-mdj-nav="shop"]');
      if (afterSvc && afterSvc.parentNode === nav) {
        nav.insertBefore(venues, afterSvc.nextSibling);
      } else if (beforeShop && beforeShop.parentNode === nav) {
        nav.insertBefore(venues, beforeShop);
      } else {
        nav.appendChild(venues);
      }
      try {
        var esVen = document.documentElement && String(document.documentElement.lang || '').toLowerCase().indexOf('es') === 0;
        venues.textContent = esVen ? 'Eventos' : 'Events';
      } catch (eVenLbl) {
        venues.textContent = 'Events';
      }
    }
    venues.setAttribute('href', './events.html');
    mdjRevealMainNavSlot(venues);

    ['home', 'services', 'shop', 'jobs', 'contact'].forEach(function (key) {
      nav.querySelectorAll('a[data-mdj-nav="' + key + '"]').forEach(mdjRevealMainNavSlot);
    });

    mdjApplyConfigMainNavLink(false);
    mdjResetMainNavPortalGuestSlot();
    mdjApplyStaffMainNavLink(false);

    nav.querySelectorAll('a[data-mdj-nav="tools"]').forEach(function (el) {
      mdjHideMainNavSlot(el);
      el.style.setProperty('display', 'none', 'important');
    });

    var miPerfil = document.getElementById('mainNav-guest-mi-perfil-link') || mdjEnsureGuestMiPerfilMainNavLink();
    if (miPerfil) {
      var contact = nav.querySelector('a[data-mdj-nav="contact"]');
      if (contact && contact.parentNode === nav && contact.nextSibling !== miPerfil) {
        if (contact.nextSibling) nav.insertBefore(miPerfil, contact.nextSibling);
        else nav.appendChild(miPerfil);
      }
      miPerfil.href = './login.html';
      mdjHideGuestMiPerfilMainNavSlot();
    }
  }

  function mdjHideMiPortalButton() {
    var el = document.getElementById('header-mi-portal-btn');
    if (el) el.style.display = 'none';
    var mob = document.getElementById('header-mi-portal-mobile');
    if (mob) mob.style.display = 'none';
    mdjResetMainNavPortalGuestSlot();
    mdjRemoveArtistDashboardNavLinks();
    mdjApplyStaffMainNavLink(false);
    var tb = document.getElementById('header-tier-status-badge');
    if (tb) tb.remove();
  }

  /** Mientras llega el perfil: oculto pero ocupa columna (tabla v2). */
  function mdjEnsureMiPortalHydratingPlaceholder() {
    var nav = document.getElementById('mainNav');
    if (!nav) return;
    var existing = document.getElementById('mainNav-mi-portal-link');
    if (existing) {
      if (!existing.classList.contains('mdj-mi-portal--guest')) return;
      existing.classList.remove('mdj-mi-portal--guest');
      existing.classList.add('mdj-mi-portal--hydrating');
      existing.removeAttribute('data-i18n');
      existing.href = '#';
      existing.setAttribute('aria-hidden', 'true');
      existing.setAttribute('tabindex', '-1');
      existing.style.removeProperty('display');
      existing.style.pointerEvents = 'none';
      existing.style.visibility = 'hidden';
      existing.textContent = 'MI PORTAL';
      return;
    }
    if (mdjIsBuyerJourneyPage()) {
      try {
        console.warn(
          '[Header] #mainNav-mi-portal-link missing on buyer journey — expected last in #mainNav HTML; no appendChild.'
        );
      } catch (eWarnMp) { /* ignore */ }
      return;
    }
    var link = document.createElement('a');
    link.id = 'mainNav-mi-portal-link';
    link.className = 'mdj-mi-portal-mainnav mdj-mi-portal-gold mdj-mi-portal--hydrating';
    link.setAttribute('data-mdj-nav', 'mi-portal');
    link.href = '#';
    link.setAttribute('aria-hidden', 'true');
    link.setAttribute('tabindex', '-1');
    link.style.removeProperty('display');
    link.style.pointerEvents = 'none';
    link.style.visibility = 'hidden';
    link.textContent = 'MI PORTAL';
    nav.appendChild(link);
  }

  /**
   * MI PORTAL en la fila inferior (#mainNav), mismo ritmo que Home/Services/…; dorado vía CSS.
   * Si existe #mainNav, no duplicamos el CTA en .header-actions (se oculta #header-mi-portal-btn).
   */
  function mdjEnsureMiPortalInMainNav(href, opts) {
    var nav = document.getElementById('mainNav');
    if (!nav) return;
    mdjEnsureHeaderVipCss();
    var link = document.getElementById('mainNav-mi-portal-link');
    if (!link) {
      if (mdjIsBuyerJourneyPage() || window.__mdjLastBuyerSession === true) {
        try {
          console.warn(
            '[Header] #mainNav-mi-portal-link missing — reveal/href skipped; fix HTML order (last visible tab).'
          );
        } catch (eWarnMp2) { /* ignore */ }
        return;
      }
      link = document.createElement('a');
      link.id = 'mainNav-mi-portal-link';
      nav.appendChild(link);
    }
    var buyerRow = window.__mdjLastBuyerSession === true;
    if (buyerRow) {
      link.classList.add('mdj-mi-portal-mainnav', 'mdj-mi-portal-gold');
      link.classList.remove('mdj-mi-portal--guest', 'mdj-mi-portal--hydrating');
    } else {
      link.className = 'mdj-mi-portal-mainnav mdj-mi-portal-gold';
      link.classList.remove('mdj-mainnav-reserved-slot', 'mdj-mi-portal--guest', 'mdj-mi-portal--hydrating');
    }
    link.href = href || './client-portal.html';
    link.style.removeProperty('display');
    link.style.removeProperty('pointer-events');
    link.style.removeProperty('visibility');
    link.removeAttribute('aria-hidden');
    link.removeAttribute('tabindex');
    var staffNav = opts && opts.variant === 'staff-settings';
    if (staffNav) {
      /* Misma etiqueta que panel artista / dj-dashboard: translations `nav-settings` → «⚙️ CONFIG». */
      link.setAttribute('data-mdj-nav', 'account-settings');
      link.setAttribute('data-i18n', 'nav-settings');
      try {
        var ns =
          window.i18n && typeof window.i18n.t === 'function' ? String(window.i18n.t('nav-settings') || '').trim() : '';
        link.textContent = ns || '⚙️ CONFIG';
      } catch (eNs) {
        link.textContent = '⚙️ CONFIG';
      }
      try {
        link.setAttribute('aria-label', mdjGetStaffAccountSettingsMenuLabel());
      } catch (eAr) { /* ignore */ }
    } else {
      var profileDest = /dj-profile\.html/i.test(String(href || '').trim());
      link.setAttribute('data-mdj-nav', 'mi-portal');
      if (profileDest) {
        mdjApplyMiPerfilNavLabel(link);
        try {
          var esProf =
            document.documentElement && String(document.documentElement.lang || '').toLowerCase().indexOf('es') === 0;
          link.setAttribute('aria-label', esProf ? 'Mi perfil' : 'My profile');
        } catch (eMpLbl) { /* ignore */ }
      } else {
        link.setAttribute('data-i18n', 'header-mi-portal');
        mdjApplyMiPortalLinkLabel(link);
      }
    }
  }

  function mdjApplyMiPortalLinkLabel(el) {
    if (!el) return;
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var tx = window.i18n.t('header-mi-portal');
        if (tx) el.textContent = tx;
      } else {
        var rawLang = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
        el.textContent = rawLang.indexOf('es') === 0 ? 'MI PORTAL' : 'MY PORTAL';
      }
    } catch (err) { /* ignore */ }
    try {
      var es = document.documentElement && String(document.documentElement.lang || '').toLowerCase().indexOf('es') === 0;
      el.setAttribute('aria-label', es ? 'Mi portal' : 'My portal');
    } catch (e2) { /* ignore */ }
  }

  /**
   * CTA dorado "MI PORTAL": solo con sesión; enlace directo al hub (cliente → portal, artista → dashboard).
   * Colocado justo antes de `.header-avatar-cart-row` (no interfiere con `.lang-switcher`).
   */
  function mdjEnsureMiPortalButton(href) {
    var actions = document.querySelector('#mainHeader .header-actions');
    if (!actions) return;
    mdjEnsureHeaderVipCss();
    var row = document.querySelector('#mainHeader .header-avatar-cart-row');
    var btn = document.getElementById('header-mi-portal-btn');
    if (!btn) {
      btn = document.createElement('a');
      btn.id = 'header-mi-portal-btn';
      btn.setAttribute('data-i18n', 'header-mi-portal');
      btn.setAttribute('aria-label', 'My portal');
      if (row && row.parentNode === actions) {
        actions.insertBefore(btn, row);
      } else {
        actions.appendChild(btn);
      }
    }
    btn.className = 'mdj-mi-portal-gold mdj-mi-portal-navlink';
    btn.href = href || './client-portal.html';
    btn.style.display = '';
    mdjApplyMiPortalLinkLabel(btn);
  }

  /**
   * Mismo destino que MI PORTAL desktop: primer ítem del menú hamburguesa (móvil).
   */
  function mdjEnsureMiPortalMobile(href, opts) {
    var nav = document.querySelector('#mobileMenu .mobile-nav');
    if (!nav) return;
    mdjEnsureHeaderVipCss();
    var btn = document.getElementById('header-mi-portal-mobile');
    if (!btn) {
      btn = document.createElement('a');
      btn.id = 'header-mi-portal-mobile';
      btn.href = href || './client-portal.html';
      nav.insertBefore(btn, nav.firstChild);
    }
    btn.className = 'mdj-mi-portal-mobile mdj-mi-portal-gold';
    btn.href = href || './client-portal.html';
    btn.style.display = '';
    var staffNav = opts && opts.variant === 'staff-settings';
    if (staffNav) {
      btn.setAttribute('data-i18n', 'nav-settings');
      try {
        var nsM =
          window.i18n && typeof window.i18n.t === 'function' ? String(window.i18n.t('nav-settings') || '').trim() : '';
        btn.textContent = nsM || '⚙️ CONFIG';
      } catch (eNsM) {
        btn.textContent = '⚙️ CONFIG';
      }
      try {
        btn.setAttribute('aria-label', mdjGetStaffAccountSettingsMenuLabel());
      } catch (eMb) { /* ignore */ }
    } else {
      var profileDestM = /dj-profile\.html/i.test(String(href || '').trim());
      if (profileDestM) {
        mdjApplyMiPerfilNavLabel(btn);
        try {
          var esProfM =
            document.documentElement && String(document.documentElement.lang || '').toLowerCase().indexOf('es') === 0;
          btn.setAttribute('aria-label', esProfM ? 'Mi perfil' : 'My profile');
        } catch (eMpLblM) { /* ignore */ }
      } else {
        btn.setAttribute('data-i18n', 'header-mi-portal');
        btn.setAttribute('aria-label', 'My portal');
        mdjApplyMiPortalLinkLabel(btn);
      }
    }
    if (nav.firstChild !== btn) {
      nav.insertBefore(btn, nav.firstChild);
    }
  }

  function mdjEscapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function mdjEscapeAttr(s) {
    return mdjEscapeHtml(s).replace(/'/g, '&#39;');
  }

  /** Cliente: "Wendy Example" → "Wendy E." */
  function mdjFormatClientShortName(fullName) {
    var parts = String(fullName || '')
      .trim()
      .split(/\s+/)
      .filter(function (x) {
        return !!x;
      });
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0];
    var first = parts[0];
    var last = parts[parts.length - 1];
    if (first === last) return first;
    return first + ' ' + last.charAt(0).toUpperCase() + '.';
  }

  /** Saludo VIP (cliente): solo primer nombre — sin @ ni apellidos. */
  function mdjVipFirstNameOnly(fullName) {
    var parts = String(fullName || '')
      .trim()
      .split(/\s+/)
      .filter(function (x) {
        return !!x;
      });
    if (!parts.length) return '';
    var w = parts[0];
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }

  /** Handle público: un solo @ visual; la BD puede traer "wendy", "@wendy" o "@@wendy". */
  function mdjVipFormatHandle(raw) {
    if (!raw || !String(raw).trim()) return '';
    var t = String(raw).trim().replace(/^@+/, '');
    if (!t) return '';
    return '@' + t;
  }

  function mdjVipMetaUsername(metaObj) {
    if (!metaObj || typeof metaObj.username !== 'string') return '';
    var t = String(metaObj.username).trim();
    if (!t) return '';
    return mdjVipFormatHandle(t);
  }

  function mdjComputeInitials(displayName, email) {
    var d = String(displayName || '').trim();
    if (d) {
      var w = d.split(/\s+/).filter(Boolean);
      if (w.length >= 2) return (w[0].charAt(0) + w[w.length - 1].charAt(0)).toUpperCase();
      if (w.length === 1 && w[0].length >= 2) return w[0].substring(0, 2).toUpperCase();
      if (w.length === 1) return w[0].charAt(0).toUpperCase();
    }
    var e = String(email || '').split('@')[0] || '';
    if (e.length >= 2) return e.substring(0, 2).toUpperCase();
    return e ? e.charAt(0).toUpperCase() : '?';
  }

  /**
   * URL pública para <img>: absoluta https o //; rutas Storage sin host → MDB_SUPABASE_URL.
   * Acepta /storage/v1/… y storage/v1/… (sin slash inicial).
   */
  function mdjNormalizeAvatarStorageUrl(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    if (/placeholder|dj-avatar-placeholder\.png/i.test(s)) return '';
    if (/^https?:\/\//i.test(s)) return s;
    if (s.indexOf('//') === 0 && s.indexOf('http') !== 0) return s;
    if (s.indexOf('data:image/') === 0 || s.indexOf('blob:') === 0) return s;
    var baseUrl =
      typeof window.MDB_SUPABASE_URL === 'string' && window.MDB_SUPABASE_URL
        ? String(window.MDB_SUPABASE_URL).replace(/\/$/, '')
        : '';
    if (!baseUrl) return s;
    if (s.indexOf('storage/v1') !== -1) {
      var path = s.indexOf('/') === 0 ? s : '/' + s.replace(/^\/+/, '');
      return baseUrl + path;
    }
    if (s.indexOf('/') === 0 && s.indexOf('/storage/') === 0) {
      return baseUrl + s;
    }
    return s;
  }

  function mdjIsRealPhotoUrl(url) {
    if (!url || !String(url).trim()) return false;
    var u = mdjNormalizeAvatarStorageUrl(url);
    if (!u) return false;
    if (/placeholder|dj-avatar-placeholder\.png/i.test(u)) return false;
    return (
      /^https?:\/\//i.test(u) ||
      u.indexOf('//') === 0 ||
      u.indexOf('data:image/') === 0 ||
      u.indexOf('blob:') === 0
    );
  }

  /** Primera URL usable para el header; artistas: dj_profiles.photo_url antes que JWT (evita 404 OAuth → iniciales). */
  function mdjPickHeaderProfilePhotoUrl(isClient, p, sessionAvatar, clientPic) {
    var dj = p && p.photo_url ? String(p.photo_url).trim() : '';
    var jwt = sessionAvatar ? String(sessionAvatar).trim() : '';
    var cli = clientPic ? String(clientPic).trim() : '';
    var order = isClient ? [cli, jwt, dj] : [dj, jwt, cli];
    for (var i = 0; i < order.length; i++) {
      var c = order[i];
      if (!c) continue;
      c = mdjNormalizeAvatarStorageUrl(c);
      var base = c.split('?')[0];
      if (mdjIsRealPhotoUrl(base)) return c;
    }
    return '';
  }

  function mdjShowFamilyWelcomeToast() {
    if (document.getElementById('mdj-family-welcome-toast')) return;
    var msg = '¡Bienvenido a la familia de Miami DJ Beat! Es un honor tenerte aquí.';
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var t = window.i18n.t('vip-welcome-family');
        if (t) msg = t;
      }
    } catch (err) { /* ignore */ }
    var div = document.createElement('div');
    div.id = 'mdj-family-welcome-toast';
    div.setAttribute('role', 'status');
    div.style.cssText =
      'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);max-width:min(520px,92vw);z-index:99999;padding:16px 22px;background:rgba(15,22,35,.97);border:1px solid rgba(197,160,89,.5);border-radius:16px;color:#e8eefc;font-size:14px;font-weight:600;box-shadow:0 14px 44px rgba(0,0,0,.55);text-align:center;line-height:1.45;';
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(function () {
      try {
        if (div.parentNode) div.parentNode.removeChild(div);
      } catch (e2) { /* ignore */ }
    }, 9000);
  }

  /** Invitación por correo (Edge opcional; falla en silencio si no está desplegada). SMS no incluido aquí. */
  function mdjTryMemberWelcomeNotify(user) {
    try {
      var sb = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
      if (!sb || !sb.functions || !user) return;
      sb.functions
        .invoke('member-welcome', {
          body: { user_id: user.id, email: user.email || null }
        })
        .catch(function () { /* optional */ });
    } catch (e) { /* ignore */ }
  }

  function mdjMaybeRunVipWelcomeProtocol(session) {
    try {
      if (sessionStorage.getItem('mdj_vip_welcome_pending') !== '1' || !session || !session.user) return;
      sessionStorage.removeItem('mdj_vip_welcome_pending');
      mdjShowFamilyWelcomeToast();
      mdjTryMemberWelcomeNotify(session.user);
    } catch (e) { /* ignore */ }
  }

  /** Menú cuenta: anclado al viewport (fixed) bajo el bloque VIP — evita stacking/scroll del header. */
  function mdjPositionAccountDropdown() {
    var menu = document.getElementById('accountMenu');
    if (!menu || !menu.classList.contains('open')) return;
    var root = document.getElementById('mdjAccountVipRoot');
    var zone = document.getElementById('header-auth-zone');
    var anchor = root || zone;
    if (!anchor) return;
    var r = anchor.getBoundingClientRect();
    var gap = 8;
    var topPx = r.bottom + gap;
    var rightPx = Math.max(8, window.innerWidth - r.right);
    menu.style.position = 'fixed';
    menu.style.top = topPx + 'px';
    menu.style.right = rightPx + 'px';
    menu.style.left = 'auto';
    menu.style.bottom = 'auto';
    menu.style.zIndex = '5000';
  }

  function mdjCloseAccountMenu() {
    var m = document.getElementById('accountMenu');
    var menubtn = document.getElementById('mdjAccountVipMenuBtn');
    var accBtn = document.getElementById('accountBtn');
    if (m) {
      m.classList.remove('open');
      m.style.position = '';
      m.style.top = '';
      m.style.right = '';
      m.style.left = '';
      m.style.bottom = '';
      m.style.zIndex = '';
    }
    if (menubtn) menubtn.setAttribute('aria-expanded', 'false');
    else if (accBtn) accBtn.setAttribute('aria-expanded', 'false');
  }

  function mdjBindVipAccountInteractionsOnce() {
    if (window.__mdjVipAcctBound) return;
    window.__mdjVipAcctBound = true;
    function mdjAccountMenuViewportSync() {
      var menu = document.getElementById('accountMenu');
      if (!menu || !menu.classList.contains('open')) return;
      mdjPositionAccountDropdown();
    }
    window.addEventListener('scroll', mdjAccountMenuViewportSync, true);
    window.addEventListener('resize', mdjAccountMenuViewportSync);
    document.addEventListener('click', function (e) {
      var menu = document.getElementById('accountMenu');
      var menubtn = document.getElementById('mdjAccountVipMenuBtn');
      var accBtn = document.getElementById('accountBtn');
      function mdjToggleAccountMenuFromTrigger() {
        if (!menu) return;
        menu.classList.toggle('open');
        var open = menu.classList.contains('open');
        if (menubtn) menubtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        else if (accBtn) accBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) {
          requestAnimationFrame(function () {
            mdjPositionAccountDropdown();
            requestAnimationFrame(mdjPositionAccountDropdown);
          });
        } else {
          menu.style.position = '';
          menu.style.top = '';
          menu.style.right = '';
          menu.style.left = '';
          menu.style.bottom = '';
          menu.style.zIndex = '';
        }
      }
      if (menubtn && menubtn.contains(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        mdjToggleAccountMenuFromTrigger();
        return;
      }
      if (menu && menu.contains(e.target) && e.target && e.target.classList && e.target.classList.contains('mdj-menu-logout')) {
        e.preventDefault();
        mdjCloseAccountMenu();
        if (typeof window.doLogout === 'function') window.doLogout(e);
        return;
      }
      mdjCloseAccountMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') mdjCloseAccountMenu();
    });
  }

  /** Etiqueta título/portal cliente (enlace directo al portal, sin menú en el avatar). */
  function mdjGetVipPortalMenuLabel() {
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var t = window.i18n.t('header-mi-portal');
        if (t) return t;
      }
    } catch (e1) { /* ignore */ }
    var lang = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
    return lang.indexOf('en') === 0 ? 'My portal' : 'Mi portal';
  }

  function mdjGetDjDashboardMenuLabel() {
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var td = window.i18n.t('dashboard-title');
        if (td) return td;
      }
    } catch (e2) { /* ignore */ }
    var lang2 = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
    return lang2.indexOf('en') === 0 ? 'DJ Dashboard' : 'Panel DJ';
  }

  /** Staff (admin / manager / seller / owner): cuenta operativa, no portal cliente ni panel artista. */
  function mdjGetStaffAccountSettingsMenuLabel() {
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var tx = window.i18n.t('nav-account-settings');
        if (tx) return tx;
      }
    } catch (eSt) { /* ignore */ }
    var lang3 = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
    return lang3.indexOf('es') === 0 ? 'Configuración de cuenta' : 'Account settings';
  }

  function mdjGetArtistPublicProfileMenuLabel() {
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var ta = window.i18n.t('jobs-after-roles-cta-artist-public');
        if (ta) return ta;
      }
    } catch (e3) { /* ignore */ }
    var lang3 = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
    return lang3.indexOf('en') === 0 ? 'Public profile' : 'Perfil público';
  }

  /**
   * Avatar circular + nombre. Cliente y artista: el bloque es un enlace directo (portal / dashboard), sin menú desplegable.
   */
  function mdjBuildAvatarSlotHtml(ctx) {
    var useInit = !!ctx.useAvatarInitials;
    var initials = ctx.avatarInitials || '?';
    var url = ctx.avatarUrl || '';
    if (useInit) {
      return (
        '<span id="mdjHeaderAvatarSlot" class="mdj-avatar-slot">' +
        '<span class="mdj-avatar-ring mdj-avatar-ring--init">' +
        '<span class="mdj-avatar-initials" aria-hidden="true">' +
        mdjEscapeHtml(initials) +
        '</span></span></span>'
      );
    }
    return (
      '<span id="mdjHeaderAvatarSlot" class="mdj-avatar-slot">' +
      '<span class="mdj-avatar-ring">' +
      '<img class="avatar mdj-header-vip-avatar" src="' +
      mdjEscapeAttr(url) +
      '" alt="" data-mdj-av-init="' +
      mdjEscapeAttr(initials) +
      '" /></span></span>'
    );
  }

  function mdjBindHeaderAvatarImgFallbackOnce() {
    var img = document.querySelector('#mdjHeaderAvatarSlot img.mdj-header-vip-avatar');
    if (!img || img.getAttribute('data-mdj-av-bound') === '1') return;
    img.setAttribute('data-mdj-av-bound', '1');
    img.addEventListener(
      'error',
      function () {
        try {
          var init = img.getAttribute('data-mdj-av-init') || '?';
          var ring = img.closest('.mdj-avatar-ring');
          if (!ring) return;
          ring.classList.add('mdj-avatar-ring--init');
          ring.innerHTML =
            '<span class="mdj-avatar-initials" aria-hidden="true">' + mdjEscapeHtml(init) + '</span>';
        } catch (e) { /* ignore */ }
      },
      { once: true }
    );
  }

  /**
   * Actualización instantánea del avatar VIP tras subir/guardar foto (dashboard / cuenta), sin recargar.
   * Sustituye iniciales por <img> si hacía falta.
   */
  window.mdjHeaderVipApplyPhotoUrl = function (url) {
    if (!url || !String(url).trim()) return;
    var raw = String(url).trim();
    var base = raw.split('?')[0];
    if (!mdjIsRealPhotoUrl(base)) return;
    var bust = raw.indexOf('?') >= 0 ? raw : raw + '?v=' + Date.now();
    var nm = document.getElementById('mdjAccountDisplayName');
    var initials = '?';
    if (nm && nm.textContent) {
      initials = mdjComputeInitials(nm.textContent, '');
    }
    var html = mdjBuildAvatarSlotHtml({
      useAvatarInitials: false,
      avatarInitials: initials,
      avatarUrl: bust
    });
    var slot = document.getElementById('mdjHeaderAvatarSlot');
    if (!slot) {
      if (typeof window.checkSessionForNav === 'function') void window.checkSessionForNav();
      return;
    }
    slot.outerHTML = html;
    mdjBindHeaderAvatarImgFallbackOnce();
    try {
      document.querySelectorAll('#mainHeader img.avatar, #navAvatarImg').forEach(function (im) {
        if (!im) return;
        if (im.closest && im.closest('#mdjAccountVipRoot')) return;
        im.src = bust;
      });
    } catch (e) { /* ignore */ }
  };

  function mdjMountOrUpdateVipAccountZone(ctx) {
    var zone = document.getElementById('header-auth-zone');
    if (!zone) return;
    mdjEnsureHeaderVipCss();
    mdjBindVipAccountInteractionsOnce();
    document.body.classList.add('mdj-logged-in-header');

    var displayName = ctx.displayName || 'Member';
    var isClient = !!ctx.isClient;
    var profileUrl = ctx.profileUrl;
    if (!profileUrl) profileUrl = isClient ? './client-portal.html' : './account-settings.html';
    var profileLabel =
      ctx.profileLabel ||
      (isClient ? mdjGetVipPortalMenuLabel() : mdjGetDjDashboardMenuLabel());
    var useAvatarInitials = !!ctx.useAvatarInitials;
    var avatarInitials = ctx.avatarInitials || '?';
    var avatarUrl = ctx.avatarUrl || '';

    var avatarSlotHtml = mdjBuildAvatarSlotHtml({
      useAvatarInitials: useAvatarInitials,
      avatarInitials: avatarInitials,
      avatarUrl: avatarUrl
    });

    /* Artista: un solo enlace al panel — sin dropdown, sin botón ▾, sin submenús. */
    if (!isClient) {
      var artistInner =
        '<a class="mdj-account-vip-trigger mdj-account-vip-direct mdj-account-vip-artist-dash" id="accountBtn" href="#" onclick="return false;" title="' +
        mdjEscapeAttr(profileLabel) +
        '">' +
        avatarSlotHtml +
        '<span class="mdj-account-display-name" id="mdjAccountDisplayName">' +
        mdjEscapeHtml(displayName) +
        '</span>' +
        '</a>';
      var rootA = document.getElementById('mdjAccountVipRoot');
      if (rootA) {
        rootA.className = 'mdj-account-vip mdj-account-vip--artist-link-only';
        rootA.innerHTML = artistInner;
      } else {
        zone.innerHTML =
          '<div class="mdj-account-vip mdj-account-vip--artist-link-only" id="mdjAccountVipRoot">' + artistInner + '</div>';
      }
      mdjBindHeaderAvatarImgFallbackOnce();
      return;
    }

    /* Cliente: mismo patrón que artista — enlace al portal, sin #accountMenu ni pestaña bajo la barra. */
    var clientInner =
      '<a class="mdj-account-vip-trigger mdj-account-vip-direct mdj-account-vip-client-portal" id="accountBtn" href="#" onclick="return false;" title="' +
      mdjEscapeAttr(profileLabel) +
      '">' +
      avatarSlotHtml +
      '<span class="mdj-account-display-name" id="mdjAccountDisplayName">' +
      mdjEscapeHtml(displayName) +
      '</span>' +
      '</a>';
    var rootClient = document.getElementById('mdjAccountVipRoot');
    if (rootClient) {
      rootClient.className = 'mdj-account-vip mdj-account-vip--direct-link-only';
      rootClient.innerHTML = clientInner;
    } else {
      zone.innerHTML =
        '<div class="mdj-account-vip mdj-account-vip--direct-link-only" id="mdjAccountVipRoot">' + clientInner + '</div>';
    }
    mdjBindHeaderAvatarImgFallbackOnce();
  }

  function mdjCountCheckoutCartUnits(parsed) {
    if (parsed == null) return 0;
    if (Array.isArray(parsed)) {
      return parsed.reduce(function (sum, line) {
        var q = line && typeof line.quantity === 'number' && line.quantity > 0 ? line.quantity : 1;
        return sum + q;
      }, 0);
    }
    if (typeof parsed === 'object') return 1;
    return 0;
  }

  window.mdjCountCheckoutCartUnits = mdjCountCheckoutCartUnits;

  window.updateHeaderCartCount = function () {
    var el = document.getElementById('header-cart-count');
    var link = document.getElementById('header-cart-link');
    if (!el) return;
    var n = 0;
    try {
      var raw = sessionStorage.getItem('mdjpro_checkout_cart');
      if (raw) n = mdjCountCheckoutCartUnits(JSON.parse(raw));
    } catch (e) { /* ignore */ }
    el.textContent = n > 0 ? String(n) : '';
    el.dataset.count = String(n);
    el.hidden = n === 0;
    if (link) {
      link.classList.toggle('has-items', n > 0);
      link.setAttribute('aria-label', n > 0 ? 'Shopping cart, ' + n + (n === 1 ? ' item' : ' items') : 'Shopping cart');
    }
  };

  /** Último segmento de ruta (index.html en /), sin slash final — compatible con /shop y /shop.html */
  function mdjNavPathLeaf() {
    var pathname = location.pathname || '/';
    var trimmed = pathname.replace(/\/+$/, '');
    if (!trimmed) return 'index.html';
    var parts = trimmed.split('/');
    var leaf = parts[parts.length - 1] || 'index.html';
    return String(leaf).toLowerCase();
  }

  /** True when URL leaf is shop (e.g. /shop.html, /shop). Shop header cart link is shown only then. */
  function mdjIsShopCartPage() {
    var leaf = mdjNavPathLeaf();
    var base = String(leaf || '').toLowerCase().replace(/\.html?$/i, '');
    return base === 'shop';
  }

  /** #header-cart-link: visible only on shop; off shop stays in layout (visibility) so the cart slot does not collapse. */
  function mdjApplyShopHeaderCartVisibility() {
    var link = document.getElementById('header-cart-link');
    if (!link) return;
    if (mdjIsShopCartPage()) {
      link.style.removeProperty('display');
      link.style.removeProperty('visibility');
      link.style.removeProperty('pointer-events');
      link.removeAttribute('aria-hidden');
      link.removeAttribute('data-mdj-shop-cart-hidden');
    } else {
      link.style.removeProperty('display');
      link.style.setProperty('visibility', 'hidden', 'important');
      link.style.setProperty('pointer-events', 'none', 'important');
      link.setAttribute('aria-hidden', 'true');
      link.setAttribute('data-mdj-shop-cart-hidden', '1');
    }
  }

  /** Rentals ships Event Cart inline; shop keeps shop cart only (blueprint). */
  function mdjIsRentalsEventCartPage() {
    try {
      if (document.body && document.body.classList && document.body.classList.contains('page-mdj-rentals')) {
        return true;
      }
    } catch (e0) {
      void e0;
    }
    var leaf = mdjNavPathLeaf();
    var b = String(leaf || '')
      .toLowerCase()
      .replace(/\.html?$/i, '');
    return b === 'rentals';
  }

  /** Last path segment of a script URL (works with absolute `src` vs relative `src` passed in). */
  function mdjScriptSrcBasename(url) {
    if (!url) return '';
    try {
      var u = String(url).split(/[#?]/)[0];
      var parts = u.split('/');
      return String(parts[parts.length - 1] || '').toLowerCase();
    } catch (eBs) {
      return '';
    }
  }

  function mdjAppendScriptOnce(src) {
    if (!src) return Promise.resolve();
    var want = mdjScriptSrcBasename(src);
    if (!want) return Promise.resolve();
    var nodes = document.getElementsByTagName('script');
    var i;
    for (i = 0; i < nodes.length; i++) {
      if (mdjScriptSrcBasename(nodes[i].src) === want) {
        return Promise.resolve();
      }
    }
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error('script ' + src));
      };
      (document.head || document.documentElement).appendChild(s);
    });
  }

  function mdjEnsureSubscriptionScriptForEventCart() {
    if (typeof window.MDB_SUBSCRIPTION === 'object' && window.MDB_SUBSCRIPTION) {
      return Promise.resolve();
    }
    return mdjAppendScriptOnce('./subscription.js?v=20260422-find-dj-rank');
  }

  /** Adapter → builder → bridge (idempotent via mdjAppendScriptOnce). */
  function mdjChainGlobalEventBuilderScripts() {
    window.MDJ_EVENT_BUILDER_V1 = true;
    return mdjEnsureSubscriptionScriptForEventCart()
      .then(function () {
        return mdjAppendScriptOnce('./js/mdj-event-builder-adapter.js?v=20260514-eb-1a');
      })
      .then(function () {
        return mdjAppendScriptOnce('./js/mdj-event-builder.js?v=20260603-eb-context-date-bar-1');
      })
      .then(function () {
        return mdjAppendScriptOnce('./js/mdj-event-builder-rentals-bridge.js?v=20260514-eb-1b1');
      });
  }

  /**
   * Event Cart global mount — single source of truth via mdj-event-cart-root-fragment.html.
   * Skips only: rentals (has its own inline cart). All other pages receive the cart via fetch().
   * Reads HTML fragment + CSS; loads adapter/builder/bridge after `MDJ_EVENT_BUILDER_V1`.
   */
  function mdjMountGlobalEventCartIfNeeded() {
    if (typeof document === 'undefined' || !document.body) return;
    if (window.MDJ_SKIP_GLOBAL_EVENT_CART) return;
    if (mdjIsRentalsEventCartPage()) return;
    if (document.getElementById('mdj-event-builder-root')) return;
    if (!document.getElementById('mainHeader')) return;
    if (window.__mdjEventCartGlobalMounting) return;
    window.__mdjEventCartGlobalMounting = true;

    var mainHeader = document.getElementById('mainHeader');
    var row = mainHeader ? mainHeader.querySelector('.header-avatar-cart-row') : null;
    var mountParent = null;
    var useSlotFallback = false;
    if (row) {
      mountParent = row;
    } else {
      var fbSel = ['.header-actions', '.topbar-actions', '.header-top'];
      var fbNode = null;
      var fi;
      for (fi = 0; fi < fbSel.length; fi++) {
        fbNode = mainHeader.querySelector(fbSel[fi]);
        if (fbNode) break;
      }
      mountParent = fbNode || mainHeader;
      useSlotFallback = true;
    }
    if (!mountParent) {
      window.__mdjEventCartGlobalMounting = false;
      return;
    }

    if (!document.getElementById('mdj-eb-header-cart-open')) {
      var shopLink = document.getElementById('header-cart-link');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'mdj-eb-header-cart-open';
      btn.className = 'header-cart-btn mdj-eb-header-cart-open';
      btn.setAttribute('title', 'Event cart');
      btn.setAttribute('aria-label', 'Open event cart');
      /* Gold hardcoded — works on every page regardless of which CSS loads */
      btn.style.cssText = 'color:rgba(212,175,55,0.95);border:1px solid rgba(197,160,89,0.42);background:rgba(255,255,255,0.08);border-radius:50%;width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;position:relative;flex-shrink:0;';
      btn.innerHTML =
        '<span aria-hidden="true">🛒</span>' +
        '<span id="mdj-eb-header-count" class="header-cart-count" hidden style="background:#c5a059;color:#0a0a0a;position:absolute;top:-2px;right:-2px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;font-size:11px;font-weight:800;line-height:18px;text-align:center;"></span>';
      if (!useSlotFallback) {
        if (shopLink && shopLink.parentNode === row) {
          if (shopLink.nextSibling) {
            row.insertBefore(btn, shopLink.nextSibling);
          } else {
            row.appendChild(btn);
          }
        } else {
          row.appendChild(btn);
        }
      } else {
        var ebSlot = mainHeader.querySelector('[data-mdj-eb-header-cart-slot="1"]');
        if (!ebSlot) {
          ebSlot = document.createElement('span');
          ebSlot.className = 'mdj-eb-header-cart-slot';
          ebSlot.setAttribute('data-mdj-eb-header-cart-slot', '1');
          ebSlot.setAttribute('style', 'display:inline-flex;align-items:center;vertical-align:middle;');
          mountParent.appendChild(ebSlot);
        } else if (!mountParent.contains(ebSlot)) {
          mountParent.appendChild(ebSlot);
        }
        ebSlot.appendChild(btn);
      }
    }

    if (!document.getElementById('mdj-event-cart-css')) {
      var lk = document.createElement('link');
      lk.id = 'mdj-event-cart-css';
      lk.rel = 'stylesheet';
      lk.href = './mdj-event-cart.css?v=20260603-cart-topbar-read-1';
      (document.head || document.documentElement).appendChild(lk);
    }

    var fragUrl = './mdj-event-cart-root-fragment.html?v=20260603-cart-topbar-read-1';
    fetch(fragUrl, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('event cart fragment ' + res.status);
        return res.text();
      })
      .then(function (html) {
        if (document.getElementById('mdj-event-builder-root')) {
          return mdjChainGlobalEventBuilderScripts();
        }
        var wrap = document.createElement('div');
        wrap.innerHTML = String(html || '').trim();
        var root = wrap.firstElementChild;
        if (!root || root.id !== 'mdj-event-builder-root') {
          throw new Error('bad event cart fragment');
        }
        document.body.appendChild(root);
        return mdjChainGlobalEventBuilderScripts();
      })
      .catch(function (err) {
        try {
          console.warn('[MDJ] Global Event Cart mount:', err && err.message ? err.message : err);
        } catch (e1) {
          void e1;
        }
      })
      .finally(function () {
        window.__mdjEventCartGlobalMounting = false;
      });
  }

  /**
   * Mapea último segmento de URL (sin .html/.htm) → `data-mdj-nav` del #mainNav.
   * Auditoría pestañas ↔ fichero/slug (mantener al añadir páginas):
   * | data-mdj-nav | Rutas / slugs reconocidos |
   * | home         | index (hash solo en rama index abajo) |
   * | services     | rentals, services, servicios |
   * | venues       | index + hash (abajo); slug suelto: eventos, events, experiencias |
   * | shop         | shop |
   * | tools        | dj-tools, djtools, djs-tools, dj_tools |
   * | jobs         | jobs, trabajos, empleos |
   * | contact      | index + hash contact; página suelta: contact, contacto |
   * | mi-portal    | client-portal, client-billing, mi-portal, portal-cliente, … |
   * | my-profile   | dj-profile cuando ?id= usuario con sesión (perfil artístico propio) |
   * | config       | account-settings (hub central de configuraciones) |
   * | flow         | dj-dashboard?tab=flow (Flujo de caja) |
   * | agenda       | dj-dashboard sin tab, o ?tab=dashboard (vista Agenda del panel) |
   * | (ninguno)    | dj-dashboard (otras ?tab=), panel-artista |
   * | courses      | courses, cursos |
   * | booth        | booth, ai-booth |
   * | staff        | admin-dashboard |
   * | home (extra) | find-dj, directory, directorio |
   */
  function mdjResolveNavKeyFromBase(base) {
    var b = String(base || '').toLowerCase().replace(/\.html?$/i, '');
    if (b === 'admin-dashboard' || b === 'admin_dashboard') return 'staff';
    if (b === 'account-settings' || b === 'account_settings') return 'config';
    if (b === 'client-account' || b === 'client_account') return 'client-config';
    if (b === 'shop') return 'shop';
    if (b === 'courses' || b === 'cursos') return 'courses';
    if (b === 'booth' || b === 'ai-booth' || b === 'ai_booth' || b === 'cabina') return 'booth';
    if (b === 'dj-tools' || b === 'djtools' || b === 'djs-tools' || b === 'dj_tools') return 'tools';
    if (b === 'jobs' || b === 'trabajos' || b === 'empleos') return 'jobs';
    if (b === 'rentals' || b === 'services' || b === 'servicios') return 'services';
    if (b === 'eventos' || b === 'events' || b === 'experiencias') return 'venues';
    if (b === 'contact' || b === 'contacto') return 'contact';
    if (b === 'find-dj' || b === 'directory' || b === 'directorio') return 'home';
    if (b === 'dj-profile' || b === 'perfil-dj' || b === 'perfil_dj') {
      try {
        var qid = (new URLSearchParams((typeof location !== 'undefined' && location.search) || '').get('id') || '').trim();
        var own = window.__mdjNavOwnUserId ? String(window.__mdjNavOwnUserId).trim() : '';
        if (qid && own && qid === own) return 'my-profile';
      } catch (eProf) { /* ignore */ }
      return '';
    }
    if (
      b === 'dj-dashboard' ||
      b === 'artist-dashboard' ||
      b === 'panel-artista' ||
      b === 'panel_artista' ||
      b === 'artistdashboard'
    ) {
      try {
        var qtab = (new URLSearchParams((typeof location !== 'undefined' && location.search) || '').get('tab') || '').trim().toLowerCase();
        if (qtab === 'settings') return 'config';
        if (qtab === 'flow') return 'flow';
        if (!qtab || qtab === 'dashboard') return 'agenda';
      } catch (eTab) { /* ignore */ }
      return '';
    }
    if (
      b === 'client-portal' ||
      b === 'client-billing' ||
      b === 'mi-portal' ||
      b === 'mi_portal' ||
      b === 'portal-cliente' ||
      b === 'portal_cliente'
    ) {
      return 'mi-portal';
    }
    return '';
  }

  function mdjNavHighlight() {
    var path = mdjNavPathLeaf();
    /** Sin .html/.htm; index.php / default → index para hash de inicio/contacto/eventos */
    var base = String(path || '')
      .toLowerCase()
      .replace(/\.html$/i, '')
      .replace(/\.htm$/i, '');
    if (base === 'index.php' || base === 'index.aspx' || base === 'default' || base === 'home') base = 'index';
    var hash = (location.hash || '').replace(/^#/, '').toLowerCase();
    var key = '';
    if (base === 'index') {
      if (hash === 'venues' || hash === 'experience' || hash === 'eventos' || hash === 'patrocinadores' || hash === 'sponsors') key = 'venues';
      else if (hash === 'services') key = 'services';
      else if (hash === 'contact' || hash === 'contacto') key = 'contact';
      else key = 'home';
    } else {
      key = mdjResolveNavKeyFromBase(base);
    }

    document.querySelectorAll('#mainNav a[data-mdj-nav], .mobile-nav a[data-mdj-nav], .mdj-eb-cart-topbar a[data-mdj-nav]').forEach(function (el) {
      el.classList.toggle('active', key && el.getAttribute('data-mdj-nav') === key);
    });
    if (document.body && document.body.classList.contains('mdj-artist-header-mode')) {
      mdjNavHighlightArtist();
    }
    mdjHighlightEventsPageNav();
  }

  window.mdjNavHighlight = mdjNavHighlight;

  window.doLogout = async function doLogout(e) {
    if (e) e.preventDefault();
    var sb = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
    if (!sb && window.supabase && window.MDB_SUPABASE_URL && window.MDB_SUPABASE_ANON_KEY) {
      try {
        sb = window.supabase.createClient(window.MDB_SUPABASE_URL, window.MDB_SUPABASE_ANON_KEY);
      } catch (e0) { /* ignore */ }
    }
    try {
      if (sb && sb.auth && typeof sb.auth.signOut === 'function') {
        try {
          await sb.auth.signOut({ scope: 'global' });
        } catch (eScope) {
          await sb.auth.signOut();
        }
      }
    } catch (err) {
      console.warn('[MDJ-SYSTEM] Supabase signOut error:', err);
    }
    if (typeof window.mdjClearClientStorageOnLogout === 'function') {
      window.mdjClearClientStorageOnLogout();
    } else {
      try {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      } catch (x) { /* ignore */ }
    }
    try {
      sessionStorage.removeItem('mdj_session');
      sessionStorage.removeItem('mdj_cart');
    } catch (x2) { /* ignore */ }
    window.location.href = './index.html';
  };

  function mdjHeaderIsUnifiedMainHeader() {
    var h = document.getElementById('mainHeader');
    return !!(h && h.classList && h.classList.contains('mdj-header-unified'));
  }

  function mdjHeaderMonetizationCtaMarkHidden(el) {
    if (!el) return;
    try {
      el.removeAttribute('data-mdj-monetization-visible');
    } catch (e) {
      void e;
    }
    /*
     * Fila 1 unificada: con sesión `.header-actions` sube por encima de la marca (z-index).
     * `display: none` sin !important pierde frente a .btn-pill / inline-flex del JS → PRO/GRATIS/DJPRO encima del wordmark.
     * Solo CTAs de escritorio + badge; `#header-subscribe-free-mobile` sigue con `display: none` normal (drawer).
     */
    var id = el.id || '';
    if (id === 'header-get-pro-btn' || id === 'header-subscribe-free-btn' || id === 'header-djpro-badge') {
      try {
        el.style.setProperty('display', 'none', 'important');
      } catch (e1) {
        el.style.display = 'none';
      }
    } else {
      el.style.display = 'none';
    }
  }

  /** Marca visible tras sesión resuelta; el atributo desactiva la regla CSS de ocultación inicial. */
  function mdjHeaderMonetizationCtaMarkVisible(el, displayVal) {
    if (!el) return;
    if (mdjHeaderIsUnifiedMainHeader()) {
      mdjHeaderMonetizationCtaMarkHidden(el);
      return;
    }
    try {
      el.setAttribute('data-mdj-monetization-visible', '1');
    } catch (e2) {
      void e2;
    }
    try {
      el.style.removeProperty('display');
    } catch (e3) {
      void e3;
    }
    el.style.display = displayVal || 'inline-flex';
  }

  /**
   * Invitado real: el HTML trae PRO + GRATIS visibles; hasta resolver `getSession()` eso aprieta la marca.
   * Ocultar en el primer tick (y al re-entrar en checkSession) y dejar que cada rama vuelva a mostrar si aplica.
   */
  function mdjHeaderHideMonetizationCtasPending() {
    mdjHeaderMonetizationCtaMarkHidden(document.getElementById('header-get-pro-btn'));
    mdjHeaderMonetizationCtaMarkHidden(document.getElementById('header-subscribe-free-btn'));
    mdjHeaderMonetizationCtaMarkHidden(document.getElementById('header-djpro-badge'));
  }

  function mdjApplyGuestHeaderAvatar() {
    var z = document.getElementById('header-auth-zone');
    if (!z) return;
    mdjEnsureDesktopAuditCss();
    var guestHtml =
      '<a class="account-btn mdj-guest-access-trigger" id="accountBtn" href="#" onclick="return false;" title="Sesión inactiva" aria-label="Sesión inactiva">' +
      '<span class="mdj-guest-access-ring" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false">' +
      '<circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.75"/>' +
      '<path d="M5 20v-1a7 7 0 0 1 14 0v1" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>' +
      '</svg></span></a>';
    z.innerHTML = guestHtml;
    window.__mdjDefaultAuthZoneHtml = guestHtml;
    z.classList.remove('session-pending');
    z.style.display = 'inline-flex';
    z.style.alignItems = 'center';
  }

  window.checkSessionForNav = window.checkSessionForNav || async function checkSessionForNav() {
    var authZone = document.getElementById('header-auth-zone');
    if (authZone && !window.__mdjDefaultAuthZoneHtml && authZone.innerHTML && authZone.innerHTML.trim()) {
      window.__mdjDefaultAuthZoneHtml = authZone.innerHTML;
    }
    /* No volver a ocultar ENTRAR/SALIR si ya estamos en sesión (danger): evita parpadeo en TOKEN_REFRESHED, i18n, etc. */
    var skipAuthPillPending = false;
    ['header-login-btn', 'header-login-btn-mobile'].forEach(function (id) {
      var pb = document.getElementById(id);
      if (pb && pb.classList.contains('danger')) skipAuthPillPending = true;
    });
    if (!skipAuthPillPending) mdjSetHeaderAuthPillsPending(true);
    mdjHeaderHideMonetizationCtasPending();
    try {
      var sb = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
      if (!sb) {
        window.__mdjNavOwnUserId = '';
        window.__mdjLastNavTier = null;
        window.__mdjProToolsUnlocked = false;
        window.__mdjLastNavIsClient = false;
        window.showMyArtisticProfileMainNav = false;
        mdjEnsureDesktopAuditCss();
        mdjHideMiPortalButton();
        mdjApplyGuestHeaderAvatar();
        mdjApplyHeaderAuthPillSession(false);
        mdjSyncClientLoyaltyIndicator(false);
        mdjApplyDjToolsNavForTier(null);
        mdjApplyArtistDashboardNavChrome(false);
        mdjApplyStaffMainNavLink(false);
        mdjApplyConfigMainNavLink(false);
        mdjApplyAgendaMainNavLink(false);
        mdjApplyFlowMainNavLink(false);
        mdjApplyNavTierStatusBadge(null);
        mdjApplyArtistHeaderRow2(false);
        mdjHideGuestMiPerfilMainNavSlot();
        mdjRevealGuestRoleEntryNav();
        /* PRO/FREE: ya ocultos vía mdjHeaderHideMonetizationCtasPending() + CSS hasta sesión. */
        return;
      }
      var res = await sb.auth.getSession();
      var session = res.data && res.data.session;
      if (session) {
        try {
          var ur = await sb.auth.getUser();
          if (ur && ur.data && ur.data.user) {
            session = Object.assign({}, session, { user: ur.data.user });
          }
        } catch (eGu) { /* ignore */ }
      }

      if (session) {
        window.__mdjNavOwnUserId =
          session.user && session.user.id ? String(session.user.id) : '';
        mdjEnsureMiPortalHydratingPlaceholder();
        var subFreeDesk = document.getElementById('header-subscribe-free-btn');
        var subFreeMob = document.getElementById('header-subscribe-free-mobile');
        mdjHeaderMonetizationCtaMarkHidden(subFreeDesk);
        mdjHeaderMonetizationCtaMarkHidden(subFreeMob);

        var getProBtn = document.getElementById('header-get-pro-btn');
        if (authZone) authZone.style.display = 'inline-flex';

        try {
          var pr = await sb.from('dj_profiles').select('role, photo_url, dj_name, stage_name, username, plan_type, plan, plan_status, plan_expires_at, is_premium, hardware_token').eq('user_id', session.user.id).maybeSingle();
          var p = pr.data;
          var djProfileErr = pr && pr.error ? pr.error : null;
          var clientRow = null;
          try {
            var cpr = await sb
              .from('client_profiles')
              .select('user_id, full_name, email, photo_url, avatar_url, username')
              .eq('user_id', session.user.id)
              .maybeSingle();
            clientRow = cpr && cpr.data ? cpr.data : null;
          } catch (cErr) { /* ignore */ }
          var hasClientRow = !!(clientRow && clientRow.user_id);
          var metaUt = session.user && session.user.user_metadata && session.user.user_metadata.user_type;
          var appRole = session.user && session.user.app_metadata && session.user.app_metadata.role;
          var djRowRole = p ? String(p.role || '').toLowerCase() : '';
          var metaUtLower = metaUt ? String(metaUt).toLowerCase() : '';
          /* Dos caminos: cuenta de usuario (cliente) ≠ artista. Si el JWT dice explícitamente client, nunca UI de DJ aunque exista dj_profiles. */
          var sessionIsExplicitClient = metaUtLower === 'client';
          var jwtArtist = sessionIsExplicitClient
            ? false
            : metaUt === 'talent' ||
              metaUt === 'dj' ||
              (appRole && String(appRole).toLowerCase() === 'artist') ||
              (appRole && /^(owner|manager|admin|staff|seller)$/i.test(String(appRole))) ||
              (!!p && djRowRole !== 'client');
          var appRoleLower = appRole ? String(appRole).toLowerCase() : '';
          var metadataSaysClient = metaUtLower === 'client' || appRoleLower === 'client';
          /* jwtArtist: no forzar «cliente» solo por tener client_profiles (muchos artistas tienen ambas filas).
           * Guard djProfileErr: si la query de dj_profiles falló (red lenta en móvil), p=null por error, no por
           * ausencia real de perfil — no clasificar como cliente en ese caso (TICKET-ROLE-REDIRECT-002). */
          var isClient = sessionIsExplicitClient
            ? true
            : (p && djRowRole === 'client') ||
              (!p && !djProfileErr && hasClientRow && !jwtArtist) ||
              (!p && !djProfileErr && metadataSaysClient && !jwtArtist);

          var viewingOwnDjProfile = false;
          try {
            var pathSeg = (window.location.pathname || '').split('/').pop() || '';
            if (/^dj-profile\.html$/i.test(pathSeg) && session.user) {
              var qidOwn = (new URLSearchParams(window.location.search || '').get('id') || '').trim();
              var _sid = String(session.user.id);
              /* Página: sin ?id= carga el propio user_id; con ?id= debe ser el tuyo. UUID case-insensitive. */
              viewingOwnDjProfile = !qidOwn || qidOwn.toLowerCase() === _sid.toLowerCase();
            }
          } catch (eOwn) { /* ignore */ }
          /*
           * En **tu** dj-profile, la pastilla «Cliente» solo si la fila DJ es rol client;
           * nunca mezclar caja de comprador (client_profiles) con artista/staff/owner.
           */
          if (viewingOwnDjProfile) {
            isClient = !!(
              p && String(p.role || '').toLowerCase().trim() === 'client'
            );
          }
          var hasDjProfile = !!(p && djRowRole !== 'client');
          var idn =
            typeof window.mdjClassifyPlatformIdentity === 'function'
              ? window.mdjClassifyPlatformIdentity({
                  user: session.user,
                  djRow: p,
                  clientRow: clientRow
                })
              : null;
          /* Staff: solo dj_profiles (mismo criterio que admin y RLS). Fallback sin mdj-identity.js puesto arriba en el HTML. */
          var isDjStaff = idn
            ? !!idn.staffInDb
            : !!p &&
                (djRowRole === 'admin' ||
                  djRowRole === 'manager' ||
                  djRowRole === 'seller' ||
                  djRowRole === 'owner');
          var isNavStaffSolo = idn ? !!idn.navStaffSolo : !!p && djRowRole === 'seller';
          try {
            window.__mdjLastPlatformIdentity = idn || {
              staffInDb: isDjStaff,
              navStaffSolo: isNavStaffSolo,
              principal: isDjStaff ? 'staff' : 'performer',
              dbRole: djRowRole
            };
          } catch (eId) { /* ignore */ }
          /*
           * client_profiles (compras / portal) no debe etiquetar como «cliente» a owner/staff/team en dj_profiles o JWT.
           * Sin esto, owner con fila cliente ve pastilla «Cliente» junto a SALIR.
           */
          if (isDjStaff) {
            isClient = false;
          }
          if (!sessionIsExplicitClient && appRoleLower === 'owner') {
            isClient = false;
          }
          var isProUser = p && (
            p.is_premium === true
            || ['PRO', 'ELITE'].includes(p.plan)
            || (['pro_monthly', 'pro_annual', 'PRO'].includes(p.plan_type) && (p.plan_status || 'active') === 'active' && (!p.plan_expires_at || new Date(p.plan_expires_at) > new Date()))
          );
          var mainHdr = document.getElementById('mainHeader');
          var unifiedHeader = !!(mainHdr && mainHdr.classList && mainHdr.classList.contains('mdj-header-unified'));
          var djproBadge = document.getElementById('header-djpro-badge');
          if (getProBtn) {
            if (unifiedHeader || isClient || isNavStaffSolo || isProUser) {
              mdjHeaderMonetizationCtaMarkHidden(getProBtn);
            } else {
              mdjHeaderMonetizationCtaMarkVisible(getProBtn, 'inline-flex');
            }
          }
          var hideHeaderProChrome =
            !!(document.body && document.body.classList && document.body.classList.contains('dj-profile'));
          if (djproBadge) {
            if (unifiedHeader || hideHeaderProChrome || !(isProUser && !isClient && !isNavStaffSolo)) {
              try {
                djproBadge.style.setProperty('display', 'none', 'important');
              } catch (eDb) {
                djproBadge.style.display = 'none';
              }
            } else {
              try {
                djproBadge.style.removeProperty('display');
              } catch (eDb2) {
                void eDb2;
              }
              djproBadge.style.display = 'inline-flex';
            }
          }
          /* Pastilla portal: Cliente | Cliente VIP — solo sesión comprador (no staff / owner). */
          mdjSyncClientLoyaltyIndicator(!!isClient && !isNavStaffSolo, clientRow);
          /* Con cuenta y sin PRO: el CTA lleva a Jobs — mismas tarjetas de abajo (LITE free o PRO de pago), no a login. */
          if (getProBtn && !isProUser && !isClient) {
            getProBtn.href = './jobs.html#selection-screen';
          }

          var meta = session.user && session.user.user_metadata ? session.user.user_metadata : {};
          var sessionAvatar =
            meta.avatar_url || meta.picture || meta.picture_url || meta.photo_url || meta.custom_avatar_url;
          var clientPic = '';
          if (clientRow) {
            clientPic = (clientRow.avatar_url || clientRow.photo_url || '').trim();
          }
          /* Artistas: si hay foto en dj_profiles, es la única fuente para el header (OAuth no pisa). Clientes: client_profiles + fallback. */
          var rawPhoto = '';
          if (!isClient && p && p.photo_url) {
            var candDj = mdjNormalizeAvatarStorageUrl(String(p.photo_url).trim());
            if (mdjIsRealPhotoUrl(candDj.split('?')[0])) rawPhoto = candDj;
          }
          if (!rawPhoto) {
            rawPhoto = mdjPickHeaderProfilePhotoUrl(isClient, p, sessionAvatar, clientPic);
          }
          rawPhoto = mdjNormalizeAvatarStorageUrl(rawPhoto);
          var hasRealPhoto = mdjIsRealPhotoUrl(rawPhoto.split('?')[0]);

          var displayName = '';
          if (isClient) {
            if (clientRow && clientRow.full_name && String(clientRow.full_name).trim()) {
              displayName = mdjVipFirstNameOnly(String(clientRow.full_name).trim());
            } else if (meta.full_name && String(meta.full_name).trim()) {
              displayName = mdjVipFirstNameOnly(String(meta.full_name).trim());
            } else if (meta.display_name && String(meta.display_name).trim()) {
              displayName = mdjVipFirstNameOnly(String(meta.display_name).trim());
            }
          } else {
            if (p) {
              var st = p.stage_name && String(p.stage_name).trim();
              var dj = p.dj_name && String(p.dj_name).trim();
              if (st) displayName = st;
              else if (dj) displayName = dj;
            }
            if (!displayName && meta.artistic_name && String(meta.artistic_name).trim()) {
              displayName = String(meta.artistic_name).trim();
            }
            if (!displayName && meta.stage_name && String(meta.stage_name).trim()) {
              displayName = String(meta.stage_name).trim();
            }
            if (!displayName && p && (p.stage_name || p.dj_name)) {
              displayName = String(p.stage_name || p.dj_name).trim();
            }
            if (!displayName && meta.full_name && String(meta.full_name).trim()) {
              displayName = mdjVipFirstNameOnly(String(meta.full_name).trim());
            }
          }
          if (!displayName && meta.display_name && String(meta.display_name).trim()) {
            displayName = mdjVipFirstNameOnly(String(meta.display_name).trim());
          }
          if (!displayName) displayName = 'Member';
          window.__mdjBoothDisplayName = displayName;

          var avatarInitials = mdjComputeInitials(displayName, session.user && session.user.email);
          var useAvatarInitials = !hasRealPhoto;

          var uid = session.user && session.user.id;
          var publicProfileUrl = uid
            ? './dj-profile.html?id=' + encodeURIComponent(uid)
            : './dj-profile.html';

          var isArtistSession =
            !isClient && (!!hasDjProfile || !!jwtArtist || (!!djProfileErr && !!jwtArtist));
          var settingsUrl;
          var settingsLabel;
          if (isClient) {
            settingsUrl = './client-account.html';
            settingsLabel = mdjGetVipPortalMenuLabel();
          } else if (isNavStaffSolo || isDjStaff || appRoleLower === 'owner') {
            /* owner / admin / manager / seller → account settings, not artist dashboard */
            settingsUrl = './account-settings.html';
            settingsLabel = mdjGetStaffAccountSettingsMenuLabel();
          } else {
            /* Artista DJ → nuevo hub de configuraciones. */
            settingsUrl = './account-settings.html?mdj_nav=profile';
            settingsLabel = mdjGetDjDashboardMenuLabel();
          }

          /** Matriz: cliente solo | artista LITE | artista PRO (incl. staff con dj_profiles: misma pastilla Talento/Dueño). */
          var navTier;
          /* MDJB nav-fix 2026-08-13: revierte regresión 97bc51c ("staff/owner → never artist rail").
             Un owner/staff que ADEMÁS tiene dj_profile ES artista → debe ver el rail de artista.
             Precedencia restaurada al baseline pre-regresión (dj_profile primero). */
          if (hasDjProfile) {
            navTier = isProUser ? 'artist_pro' : 'artist_lite';
          } else if (isClient) {
            navTier = 'client_only';
          } else if (jwtArtist || isArtistSession) {
            navTier = 'artist_lite';
          } else {
            navTier = 'client_only';
          }

          var miPortalHref = appRoleLower === 'owner'
            ? publicProfileUrl /* owner → public manager profile (dj-profile.html?id=uid) */
            : (isNavStaffSolo ? './account-settings.html' : './client-portal.html');
          var miPortalNavOpts = isNavStaffSolo ? { variant: 'staff-settings' } : null;

          var isBuyerSession = mdjResolveBuyerSession({
            isClient: isClient,
            settingsUrl: settingsUrl,
            idn: idn,
            hasClientRow: hasClientRow,
            hasDjProfile: hasDjProfile,
            clientRow: clientRow,
            isDjStaff: isDjStaff,
            isNavStaffSolo: isNavStaffSolo,
            metadataSaysClient: metadataSaysClient,
            sessionIsExplicitClient: sessionIsExplicitClient
          });
          window.__mdjLastBuyerSession = isBuyerSession;
          if (isBuyerSession) {
            isClient = true;
            mdjSyncClientLoyaltyIndicator(true, clientRow);
          }

          mdjMountOrUpdateVipAccountZone({
            displayName: displayName,
            avatarUrl: hasRealPhoto ? String(rawPhoto).trim() : '',
            useAvatarInitials: useAvatarInitials,
            avatarInitials: avatarInitials,
            profileUrl: settingsUrl,
            profileLabel: settingsLabel,
            isClient: isClient
          });
          if (hasRealPhoto && rawPhoto && typeof window.mdjHeaderVipApplyPhotoUrl === 'function') {
            window.mdjHeaderVipApplyPhotoUrl(String(rawPhoto).trim());
          }
          try {
            if (!isClient) {
              var acbFix = document.getElementById('accountBtn');
              if (acbFix) {
                acbFix.setAttribute('href', '#');
                acbFix.onclick = function () { return false; };
              }
            }
          } catch (eHref) { /* ignore */ }

          mdjApplyDjToolsNavForTier(navTier);
          if (document.body && document.body.classList && document.body.classList.contains('dj-profile')) {
            mdjApplyNavTierStatusBadge(null);
          } else {
            mdjApplyNavTierStatusBadge(navTier, { djRole: djRowRole || '' });
          }

          mdjMaybeRunVipWelcomeProtocol(session);

          if (document.getElementById('mainNav')) {
            /* Nav compacto: MY PORTAL para cliente siempre; artista/staff no usan esta fila para portal. */
            var _compactNavCheck = (function () { var _n = document.getElementById('mainNav'); return !!(_n && _n.getAttribute('data-mdj-compact-nav') === '1'); }());
            if (isBuyerSession) {
              mdjEnsureMiPortalInMainNav(miPortalHref, miPortalNavOpts);
            } else {
              /* Artista/staff: reset del placeholder MI PORTAL que se mostró durante la carga. */
              var _portalSlot = document.getElementById('mainNav-mi-portal-link');
              if (_portalSlot) {
                _portalSlot.classList.remove('mdj-mi-portal--hydrating');
                _portalSlot.classList.add('mdj-mi-portal--guest');
                _portalSlot.setAttribute('aria-hidden', 'true');
                _portalSlot.setAttribute('tabindex', '-1');
              }
            }
            var hdrDup = document.getElementById('header-mi-portal-btn');
            if (hdrDup) hdrDup.style.display = 'none';
          } else {
            mdjEnsureMiPortalButton(miPortalHref);
          }
          if (isBuyerSession) mdjEnsureMiPortalMobile(miPortalHref, miPortalNavOpts);
          var showMyArtisticProfileMainNav = mdjResolveShowMyArtisticProfileMainNav({
            isClient: isClient,
            isNavStaffSolo: isNavStaffSolo,
            navTier: navTier,
            allowUidFallback: true
          });
          mdjApplyStaffMainNavLink(!!isDjStaff);
          if (isDjStaff) {
            document.body.classList.add('mdj-staff-nav');
          } else {
            document.body.classList.remove('mdj-staff-nav');
          }
          /* MDJB nav-def 2026-08-13: señal ÚNICA y autoritativa de rol para el nav estático
             (CSS-gated). Aditivo: no cambia comportamiento; solo publica el rol ya resuelto.
             management = owner/admin/manager (híbrido artista+staff) · seller = staff solo. */
          try {
            var _mdjNavRole =
              (isClient || isBuyerSession) ? 'client'
              : isNavStaffSolo ? 'seller'
              : isDjStaff ? 'management'
              : (navTier === 'artist_lite' || navTier === 'artist_pro') ? 'artist'
              : 'guest';
            document.body.setAttribute('data-mdj-nav-role', _mdjNavRole);
          } catch (eRole) { void eRole; }
          var showArtistDashMainNav = !isClient && (navTier === 'artist_lite' || navTier === 'artist_pro');
          var onPublicHome = mdjIsPublicHomePage();
          /* Centinela nav compacto: services/events usan data-mdj-compact-nav="1" → bloquea inyección de Agenda/Flow/rail artista. */
          var isCompactNav = (function () {
            var _n = document.getElementById('mainNav');
            return !!(_n && _n.getAttribute('data-mdj-compact-nav') === '1');
          }());
          var showArtistHeaderNav =
            !mdjIsPublicHomePage() &&
            !isCompactNav &&
            !isClient &&
            !isNavStaffSolo &&
            !isDjStaff &&
            (navTier === 'artist_lite' || navTier === 'artist_pro');
          /* Inicio: ⚙️ CONFIG artista/staff; comprador → Configuraciones (client-account). */
          /* hasClientRow ya no excluye artistas (pueden tener ambas filas); isBuyerSession es la fuente correcta. */
          var showConfigOnHome =
            onPublicHome && !!window.__mdjNavOwnUserId && !isBuyerSession;
          mdjApplyAgendaMainNavLink(
            !!showArtistDashMainNav && !onPublicHome && !isCompactNav && !showArtistHeaderNav,
            './dj-dashboard.html?tab=dashboard'
          );
          if (isBuyerSession) {
            mdjApplyConfigMainNavLink(false);
            mdjApplyBuyerConfigMainNavLink(true);
          } else {
            mdjApplyConfigMainNavLink(
              (!!showArtistDashMainNav && !onPublicHome && !isCompactNav && !showArtistHeaderNav) ||
                showConfigOnHome ||
                (isCompactNav && !!window.__mdjNavOwnUserId && !showArtistDashMainNav),
              settingsUrl
            );
          }
          mdjApplyFlowMainNavLink(
            !!showArtistDashMainNav && !onPublicHome && !isCompactNav && !showArtistHeaderNav,
            './dj-dashboard.html?tab=flow'
          );
          mdjApplyArtistHeaderRow2(!!showArtistHeaderNav);
          mdjApplyArtistSessionNav(showMyArtisticProfileMainNav, publicProfileUrl);
          /* Clientes y clientes comerciales: MI PERFIL no aplica — su destino es MY PORTAL. */
          if (isBuyerSession) {
            var _clientPerfilEl = document.getElementById('mainNav-guest-mi-perfil-link');
            if (_clientPerfilEl) {
              _clientPerfilEl.classList.add('mdj-mainnav-reserved-slot');
              _clientPerfilEl.setAttribute('aria-hidden', 'true');
              _clientPerfilEl.setAttribute('tabindex', '-1');
            }
          }
          /* Owner 9-pillar: ensure MI PERFIL slot is explicitly revealed after generic activation.
             mdjApplyArtistSessionNav covers artists; for owner (staff, navTier='client_only')
             the generic path may skip revelation — this guard makes it unconditional. */
          if ((appRoleLower === 'owner' || appRoleLower === 'admin' || appRoleLower === 'manager' || isDjStaff) && window.__mdjNavOwnUserId) {
            mdjApplyConfigMainNavLink(true, settingsUrl);
            var _ownerMp = mdjEnsureGuestMiPerfilMainNavLink();
            if (_ownerMp) {
              var _staffUid = String(window.__mdjNavOwnUserId || '').trim();
              _ownerMp.href = './dj-profile.html?id=' + encodeURIComponent(_staffUid); /* owner → perfil público */
              var _staffBuyerJourneyMiPerfil =
                isDjStaff && !isBuyerSession && mdjIsBuyerJourneyPage() && !mdjIsPublicHomePage();
              if (_staffBuyerJourneyMiPerfil) {
                var _oNavBj = document.getElementById('mainNav');
                if (_oNavBj) {
                  ['shop', 'contact'].forEach(function (key) {
                    _oNavBj.querySelectorAll('a[data-mdj-nav="' + key + '"]').forEach(function (el) {
                      el.classList.remove('mdj-mainnav-reserved-slot');
                      el.removeAttribute('aria-hidden');
                      el.removeAttribute('tabindex');
                      el.style.setProperty('display', 'inline-flex', 'important');
                      el.style.setProperty('width', '100%', 'important');
                      el.style.setProperty('min-width', '0', 'important');
                      el.style.setProperty('flex', '0 0 auto', 'important');
                      el.style.setProperty('pointer-events', 'auto', 'important');
                      el.style.removeProperty('visibility');
                    });
                  });
                }
                mdjApplyMiPerfilNavLabel(_ownerMp);
                _ownerMp.classList.remove('mdj-mainnav-reserved-slot');
                _ownerMp.removeAttribute('aria-hidden');
                _ownerMp.removeAttribute('tabindex');
                _ownerMp.style.setProperty('display', 'inline-flex', 'important');
                _ownerMp.style.setProperty('width', '100%', 'important');
                _ownerMp.style.setProperty('min-width', '0', 'important');
                _ownerMp.style.setProperty('flex', '0 0 auto', 'important');
                _ownerMp.style.setProperty('pointer-events', 'auto', 'important');
                _ownerMp.style.removeProperty('visibility');
                var _oContact = _oNavBj && _oNavBj.querySelector('a[data-mdj-nav="contact"]');
                if (_oNavBj && _oContact && _oContact.parentNode === _oNavBj && _oContact.nextSibling !== _ownerMp) {
                  if (_oContact.nextSibling) _oNavBj.insertBefore(_ownerMp, _oContact.nextSibling);
                  else _oNavBj.appendChild(_ownerMp);
                }
              } else {
                _ownerMp.classList.remove('mdj-mainnav-reserved-slot');
                _ownerMp.removeAttribute('aria-hidden');
                _ownerMp.removeAttribute('tabindex');
                _ownerMp.style.setProperty('display', 'inline-flex', 'important');
                _ownerMp.style.setProperty('min-width', '0', 'important');
                _ownerMp.style.setProperty('max-width', 'none', 'important');
                _ownerMp.style.setProperty('width', '100%', 'important');
                _ownerMp.style.setProperty('flex', '0 0 auto', 'important');
                _ownerMp.style.setProperty('pointer-events', 'auto', 'important');
                _ownerMp.style.removeProperty('visibility');
                /* Position: after CONTACTO (last visible nav item for owner). */
                var _oNav = document.getElementById('mainNav');
                var _oContact = _oNav && _oNav.querySelector('a[data-mdj-nav="contact"]');
                if (_oNav && _oContact && _oContact.parentNode === _oNav && _oContact.nextSibling !== _ownerMp) {
                  if (_oContact.nextSibling) _oNav.insertBefore(_ownerMp, _oContact.nextSibling);
                  else _oNav.appendChild(_ownerMp);
                } else if (_oNav && _ownerMp.parentNode !== _oNav) {
                  _oNav.appendChild(_ownerMp);
                }
              }
            }
            if (appRoleLower === 'owner') {
              var _staffMiPerfil = document.querySelector('#owner-tabs [data-i18n="menu-account"]');
              mdjApplyStaffBuildingMiPerfilLink(_staffMiPerfil);
            }
            /* Flujo de caja: reveal at slot 5 (after SHOP, before CONFIG).
               mdjApplyFlowMainNavLink(false) runs at line ~2686 before this guard,
               so we run AFTER it and override. */
            if (window.location.pathname.indexOf('account-settings') !== -1) {
              var _oNavF = document.getElementById('mainNav');
              var _flowEl = _oNavF && (
                document.getElementById('mainNav-flow-link') ||
                _oNavF.querySelector('a[data-mdj-nav="flow"]')
              );
              if (_flowEl && _oNavF) {
                var _fUid = window.__mdjNavOwnUserId || '';
                _flowEl.href = _fUid
                  ? './dj-dashboard.html?tab=flow&id=' + encodeURIComponent(_fUid)
                  : './dj-dashboard.html?tab=flow';
                _flowEl.textContent = 'CASH FLOW';
                _flowEl.removeAttribute('data-i18n');
                _flowEl.classList.remove('mdj-mainnav-reserved-slot');
                _flowEl.removeAttribute('aria-hidden');
                _flowEl.removeAttribute('tabindex');
                _flowEl.style.removeProperty('display');
                _flowEl.style.removeProperty('visibility');
                _flowEl.style.removeProperty('pointer-events');
                var _shopEl = _oNavF.querySelector('a[data-mdj-nav="shop"]');
                if (_shopEl && _shopEl.parentNode === _oNavF && _shopEl.nextSibling !== _flowEl) {
                  _oNavF.insertBefore(_flowEl, _shopEl.nextSibling || null);
                }
              }
            }
          }
          mdjNormalizePublicHomeMainNav();
          if (isBuyerSession) {
            mdjApplyBuyerSessionMainNav(miPortalHref);
          }
          mdjNavHighlight();
          mdjHighlightEventsPageNav();
          mdjRefreshAllStaffNavLinks();
          try {
            if (window.i18n && typeof window.i18n.updateUI === 'function') window.i18n.updateUI();
          } catch (eUi) { /* ignore */ }
          mdjRefreshAllStaffNavLinks();
          if (isBuyerSession) {
            mdjInstallMainNavStaticMode();
          }
          /* i18n solo toca [data-i18n]; por si el HTML inicial trae header-mi-portal en la 8.ª celda, reforzar staff.
             Guard: no re-mostrar MI PORTAL en Home — mdjNormalizePublicHomeMainNav() ya lo ocultó (TICKET-002).
             Owner guard: miPortalHref=dj-profile.html → mdjEnsureMiPortalInMainNav sets #mainNav-mi-portal-link
             text to "MI PERFIL" creating a duplicate. Owner/admin/manager already have
             #mainNav-guest-mi-perfil-link so keep #mainNav-mi-portal-link hidden. */
          if (isDjStaff && document.getElementById('mainNav') && !mdjIsPublicHomePage()) {
            var _isOwnerLikeRole = appRoleLower === 'owner' || appRoleLower === 'admin' || appRoleLower === 'manager';
            if (_isOwnerLikeRole) {
              var _mpPortalSlot = document.getElementById('mainNav-mi-portal-link');
              if (_mpPortalSlot) {
                _mpPortalSlot.classList.add('mdj-mainnav-reserved-slot');
                _mpPortalSlot.setAttribute('aria-hidden', 'true');
                _mpPortalSlot.setAttribute('tabindex', '-1');
              }
            } else {
              mdjEnsureMiPortalInMainNav(miPortalHref, miPortalNavOpts);
              mdjEnsureMiPortalMobile(miPortalHref, miPortalNavOpts);
            }
          }

          mdjApplyHeaderAuthPillSession(true);

          var navMobile = document.getElementById('nav-my-profile-mobile');
          if (navMobile) {
            if (miPortalHref === settingsUrl) {
              navMobile.style.display = 'none';
            } else {
              navMobile.style.display = 'block';
              navMobile.href = isClient ? settingsUrl : publicProfileUrl;
              navMobile.textContent = isClient ? settingsLabel : mdjGetArtistPublicProfileMenuLabel();
            }
          }

          document.querySelectorAll('a[href="./dj-profile.html"]').forEach(function (link) {
            if (link.id === 'accountBtn') return;
            if (isClient) {
              link.href = './client-portal.html';
              if (link.getAttribute('data-i18n') === 'menu-account') {
                link.textContent = 'Mi Portal';
              }
            } else if (isArtistSession) {
              link.href = publicProfileUrl;
            } else {
              link.href = './dj-dashboard.html';
            }
          });

          var myProfileBtn = document.getElementById('nav-my-profile');
          if (myProfileBtn) {
            myProfileBtn.href = isClient ? './client-portal.html' : publicProfileUrl;
            myProfileBtn.style.display = 'inline-block';
          }
        } catch (e) {
          console.error('[MDJ-SYSTEM] Error fetching profile for nav:', e);
          try {
            mdjApplyHeaderAuthPillSession(true);
          } catch (e2) { /* ignore */ }
          mdjApplyDjToolsNavForTier(null);
          window.showMyArtisticProfileMainNav = false;
          mdjApplyArtistDashboardNavChrome(false);
          mdjApplyStaffMainNavLink(false);
          mdjApplyConfigMainNavLink(false);
          mdjApplyAgendaMainNavLink(false);
          mdjApplyFlowMainNavLink(false);
          mdjApplyNavTierStatusBadge(null);
          mdjSyncClientLoyaltyIndicator(false);
          mdjApplyArtistHeaderRow2(false);
        }
      } else {
        window.__mdjNavOwnUserId = '';
        window.__mdjLastNavTier = null;
        window.__mdjProToolsUnlocked = false;
        window.__mdjLastNavIsClient = false;
        window.__mdjLastBuyerSession = false;
        try {
          document.body.classList.remove('mdj-buyer-session');
        } catch (eBsOff) { void eBsOff; }
        window.showMyArtisticProfileMainNav = false;
        mdjHideMiPortalButton();
        document.body.classList.remove('mdj-logged-in-header');
        mdjApplyArtistHeaderRow2(false);
        mdjApplyGuestHeaderAvatar();
        mdjApplyHeaderAuthPillSession(false);
        var djproBadge = document.getElementById('header-djpro-badge');
        var getProBtn = document.getElementById('header-get-pro-btn');
        var subFreeDesk2 = document.getElementById('header-subscribe-free-btn');
        if (djproBadge) mdjHeaderMonetizationCtaMarkHidden(djproBadge);
        /* Sin sesión: desktop sin PRO/GRATIS en fila superior; drawer móvil (#header-subscribe-free-mobile) intacto. */
        mdjHeaderMonetizationCtaMarkHidden(getProBtn);
        mdjHeaderMonetizationCtaMarkHidden(subFreeDesk2);
        mdjSyncClientLoyaltyIndicator(false);
        var npmGuest = document.getElementById('nav-my-profile-mobile');
        if (npmGuest) npmGuest.style.display = 'none';
        mdjApplyDjToolsNavForTier(null);
        mdjApplyArtistDashboardNavChrome(false);
        mdjApplyStaffMainNavLink(false);
        mdjApplyConfigMainNavLink(false);
        mdjApplyAgendaMainNavLink(false);
        mdjApplyFlowMainNavLink(false);
        mdjApplyNavTierStatusBadge(null);
        mdjHideGuestMiPerfilMainNavSlot();
        mdjRevealGuestRoleEntryNav();
      }
    } catch (err) {
      console.error('[MDJ-SYSTEM] checkSessionForNav:', err);
      window.__mdjNavOwnUserId = '';
      window.__mdjLastNavTier = null;
      window.__mdjProToolsUnlocked = false;
      window.__mdjLastNavIsClient = false;
      window.__mdjLastBuyerSession = false;
      try {
        document.body.classList.remove('mdj-buyer-session');
      } catch (eBsOff2) { void eBsOff2; }
      window.showMyArtisticProfileMainNav = false;
      mdjHideMiPortalButton();
      if (authZone) authZone.style.display = 'none';
      mdjApplyHeaderAuthPillSession(false);
      mdjSyncClientLoyaltyIndicator(false);
      mdjApplyDjToolsNavForTier(null);
      mdjApplyArtistDashboardNavChrome(false);
      mdjApplyStaffMainNavLink(false);
      mdjApplyConfigMainNavLink(false);
      mdjApplyAgendaMainNavLink(false);
      mdjApplyFlowMainNavLink(false);
      mdjApplyNavTierStatusBadge(null);
      mdjApplyArtistHeaderRow2(false);
      mdjHideGuestMiPerfilMainNavSlot();
      mdjRevealGuestRoleEntryNav();
    } finally {
      mdjSetHeaderAuthPillsPending(false);
      if (authZone) authZone.classList.remove('session-pending');
      if (typeof window.updateAuthButtons === 'function') window.updateAuthButtons();
      /* BOOT MASK cleanup — Punto A: auth zone resolved */
      mdjClearAuthBootMask();
    }
  };

  function whenSupabaseReady(cb, tries) {
    tries = tries || 50;
    /* P0 · 2026-08-18 — getSupabaseClient() puede LANZAR, no solo devolver null.
       Sin este try, una excepción aquí escalaba hasta mdjInitSharedHeader() y
       abortaba el arranque completo del header. Es el punto exacto por el que,
       con el bundle de Supabase caído en Safari legacy, el DOM quedaba a medias.
       Un fallo se trata igual que «todavía no está»: se reintenta, y al agotar
       los intentos se llama al callback de todos modos para que la UI siga. */
    var listo = false;
    try {
      listo = (typeof window.getSupabaseClient === 'function') && !!window.getSupabaseClient();
    } catch (e) {
      listo = false;
    }
    if (listo) return cb();
    if (tries <= 0) return cb();
    setTimeout(function () { whenSupabaseReady(cb, tries - 1); }, 40);
  }

  function bindHeaderChrome() {
    var header = document.getElementById('mainHeader');
    if (header) {
      window.addEventListener('scroll', function () {
        if (window.scrollY > 50) header.classList.add('scrolled');
        else header.classList.remove('scrolled');
      }, { passive: true });
    }

    var mobileBtn = document.getElementById('mobileMenuBtn');
    var mobileMenu = document.getElementById('mobileMenu');
    if (mobileBtn && mobileMenu) {
      function setMobileOpen(open) {
        mobileBtn.classList.toggle('active', open);
        mobileMenu.classList.toggle('active', open);
        document.body.style.overflow = open ? 'hidden' : '';
        if (mobileBtn.hasAttribute('aria-expanded')) {
          mobileBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
      }
      mobileBtn.addEventListener('click', function () {
        setMobileOpen(!mobileMenu.classList.contains('active'));
      });
      mobileMenu.addEventListener('click', function (e) {
        if (e.target && e.target.closest && e.target.closest('a')) setMobileOpen(false);
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && mobileMenu.classList.contains('active')) setMobileOpen(false);
      });
    }

    /** #mainNav “More” — panel estilo Facebook (solo desktop ≥1001px donde .header-nav es visible) */
    (function bindNavMoreDropdown() {
      var btn = document.getElementById('mainNavMoreBtn');
      var menu = document.getElementById('mainNavMoreMenu');
      var wrap = btn && btn.closest('.nav-more-wrap');
      if (!btn || !menu || !wrap) return;

      function close() {
        btn.setAttribute('aria-expanded', 'false');
        menu.hidden = true;
        wrap.classList.remove('is-open');
      }

      function open() {
        btn.setAttribute('aria-expanded', 'true');
        menu.hidden = false;
        wrap.classList.add('is-open');
      }

      function toggle() {
        if (menu.hidden) open();
        else close();
      }

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        toggle();
      });

      menu.querySelectorAll('a[href]').forEach(function (a) {
        a.addEventListener('click', close);
      });

      document.addEventListener('click', function (e) {
        if (!wrap.contains(e.target)) close();
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') close();
      });
    })();
  }

  /* P0 · 2026-08-18 — CADA PASO DEL ARRANQUE ES INDEPENDIENTE.
     Antes, mdjInitSharedHeader() era una fila de doce llamadas sin proteger:
     si UNA lanzaba, las siguientes no se ejecutaban y el header quedaba a
     medio construir — pestañas que no aparecen, CONFIG y MI PERFIL ausentes.
     Es el modo de fallo que se ve en Safari legacy cuando el bundle de
     Supabase no parsea: mdjAutodetectArtistMiPerfilNav() toca identidad, y al
     reventar se llevaba por delante bindHeaderChrome(), mdjNavHighlight() y el
     resto de la UI, que no dependen de Supabase para nada.

     Con paso() cada llamada falla sola. El header pierde lo que dependa de la
     sesión — y muestra las pestañas públicas — pero se termina de montar.
     El error se registra una vez, en warn: si esto se traga en silencio total,
     un fallo real se vuelve invisible. */
  function mdjPasoArranqueSeguro(nombre, fn) {
    try {
      fn();
    } catch (e) {
      try {
        console.warn('[mdj-header] el paso «' + nombre + '» falló y se omitió; el resto del header continúa.', e);
      } catch (eLog) { void eLog; }
    }
  }

  window.mdjInitSharedHeader = function () {
    var paso = mdjPasoArranqueSeguro;
    /* BOOT MASK — apply before any nav mutations if prior session exists in localStorage */
    paso('bootMask', mdjApplyAuthBootMask);
    window.showMyArtisticProfileMainNav = false;
    paso('mainNavStaticMode', mdjInstallMainNavStaticMode);
    paso('guestMiPerfilLink', mdjEnsureGuestMiPerfilMainNavLink);
    paso('hideGuestMiPerfilSlot', mdjHideGuestMiPerfilMainNavSlot);
    paso('stripPublicEvents', mdjStripPublicEventsFromMainNav);
    paso('normalizePublicHome', mdjNormalizePublicHomeMainNav);
    /* Es una promesa: además del try, se le engancha un catch para que un
       rechazo asíncrono tampoco escale a unhandledrejection. */
    paso('autodetectArtistMiPerfil', function () {
      var r = mdjAutodetectArtistMiPerfilNav();
      if (r && typeof r.catch === 'function') r.catch(function (e) { void e; });
    });
    paso('hideMonetizationCtas', mdjHeaderHideMonetizationCtasPending);
    paso('shopCartVisibility', mdjApplyShopHeaderCartVisibility);
    paso('mountGlobalEventCart', mdjMountGlobalEventCartIfNeeded);
    paso('desktopAuditCss', mdjEnsureDesktopAuditCss);
    paso('authPillsPending', function () { mdjSetHeaderAuthPillsPending(true); });
    paso('authLangObserver', mdjEnsureAuthLangObserver);
    paso('updateAuthButtons', function () {
      if (typeof window.updateAuthButtons === 'function') window.updateAuthButtons();
    });
    paso('bindHeaderChrome', bindHeaderChrome);
    paso('navHighlight', mdjNavHighlight);
    window.addEventListener('hashchange', mdjNavHighlight);
    paso('updateHeaderCartCount', function () { window.updateHeaderCartCount(); });
    whenSupabaseReady(function () {
      try {
        var sb = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
        if (sb && sb.auth && typeof sb.auth.onAuthStateChange === 'function') {
          sb.auth.onAuthStateChange(function (event) {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'SIGNED_OUT') {
              if (typeof window.checkSessionForNav === 'function') window.checkSessionForNav();
            }
          });
        }
        if (typeof window.checkSessionForNav === 'function') {
          return window.checkSessionForNav().then(function () {
            return mdjAutodetectArtistMiPerfilNav();
          }).then(function () {
            /* BOOT MASK cleanup — Punto B: nav fully resolved after autodetect */
            mdjClearAuthBootMask();
            /* Owner final guard: mdjAutodetectArtistMiPerfilNav runs with show=false and
               briefly re-hides MI PERFIL via mdjRemoveArtistDashboardNavLinks. This runs
               after the full chain to guarantee the slot is always visible for the owner. */
            if (window.__mdjNavOwnUserId && window.__mdjLastPlatformIdentity &&
                window.__mdjLastPlatformIdentity.dbRole === 'owner') {
              var _mpFinal = document.getElementById('mainNav-guest-mi-perfil-link');
              if (_mpFinal) {
                _mpFinal.classList.remove('mdj-mainnav-reserved-slot');
                _mpFinal.removeAttribute('aria-hidden');
                _mpFinal.removeAttribute('tabindex');
                _mpFinal.style.setProperty('display', 'inline-flex', 'important');
                _mpFinal.style.setProperty('min-width', '0', 'important');
                _mpFinal.style.setProperty('max-width', 'none', 'important');
                _mpFinal.style.setProperty('width', '100%', 'important');
                _mpFinal.style.setProperty('flex', '0 0 auto', 'important');
                _mpFinal.style.setProperty('pointer-events', 'auto', 'important');
                _mpFinal.style.removeProperty('visibility');
                var _uid = String(window.__mdjNavOwnUserId).trim();
                _mpFinal.href = './dj-profile.html?id=' + encodeURIComponent(_uid);
              }
            }
          }).catch(function (eChain) {
            /* P2.2 failsafe: si checkSessionForNav() rechaza (ej. Supabase nunca
               resolvió — waitForSupabase() en auth.js hace throw tras 10 intentos),
               la cadena se saltaba ENTERA sin haber llamado mdjAutodetectArtistMiPerfilNav()
               — el finally de abajo solo quita la máscara de carga, revelando un menú
               a medio pintar (CONFIG/MI PERFIL/submenús podían quedar reservados/ocultos).
               Se reintenta aquí, en modo público/base — mdjAutodetectArtistMiPerfilNav()
               ya maneja sesión ausente con gracia (mdjHydrateArtistSessionIdFromSupabase
               devuelve '' de forma segura si Supabase falló). */
            console.warn('[mdj-shared-header] checkSessionForNav falló; renderizando menú base:', eChain);
            try {
              mdjAutodetectArtistMiPerfilNav().catch(function (eFallback) { void eFallback; });
            } catch (eSync) {
              void eSync;
            }
          }).finally(function () {
            /* BOOT MASK safety net — chain failed but mask must not persist */
            mdjClearAuthBootMask();
          });
        }
        return mdjAutodetectArtistMiPerfilNav().then(function () {
          /* BOOT MASK cleanup — Punto B (no-checkSession path) */
          mdjClearAuthBootMask();
          /* Owner final guard — same as checkSession path */
          if (window.__mdjNavOwnUserId && window.__mdjLastPlatformIdentity &&
              window.__mdjLastPlatformIdentity.dbRole === 'owner') {
            var _mpFinal2 = document.getElementById('mainNav-guest-mi-perfil-link');
            if (_mpFinal2) {
              _mpFinal2.classList.remove('mdj-mainnav-reserved-slot');
              _mpFinal2.removeAttribute('aria-hidden');
              _mpFinal2.removeAttribute('tabindex');
              _mpFinal2.style.setProperty('display', 'inline-flex', 'important');
              _mpFinal2.style.setProperty('min-width', '0', 'important');
              _mpFinal2.style.setProperty('max-width', 'none', 'important');
              _mpFinal2.style.setProperty('width', '100%', 'important');
              _mpFinal2.style.setProperty('flex', '0 0 auto', 'important');
              _mpFinal2.style.setProperty('pointer-events', 'auto', 'important');
              _mpFinal2.style.removeProperty('visibility');
              _mpFinal2.href = './dj-profile.html?id=' + encodeURIComponent(String(window.__mdjNavOwnUserId).trim());
            }
          }
        }).catch(function (eAuto) {
          void eAuto;
        }).finally(function () {
          mdjClearAuthBootMask();
        });
      } catch (eReady) {
        void eReady;
        /* BOOT MASK safety net — whenSupabaseReady callback threw synchronously */
        mdjClearAuthBootMask();
      }
    });
    if (window.MdjHeaderSmartSearch && typeof window.MdjHeaderSmartSearch.init === 'function') {
      window.MdjHeaderSmartSearch.init();
    }
    if (window.i18n && typeof window.i18n.updateUI === 'function') {
      window.i18n.updateUI();
    }
    mdjNavHighlight();
    if (typeof window.updateAuthButtons === 'function') window.updateAuthButtons();

    document.addEventListener('languageChanged', function () {
      if (typeof window.updateAuthButtons === 'function') window.updateAuthButtons();
      if (typeof window.checkSessionForNav === 'function') {
        void window.checkSessionForNav();
      }
      mdjNavHighlight();
    });
  };

  document.addEventListener('DOMContentLoaded', function () {
    mdjLoadForceMuteVideosScript();
    mdjLoadAmbientMusicScript();
    if (!document.getElementById('mainHeader')) return;
    if (window.MDJ_SKIP_SHARED_HEADER_INIT) return;
    window.mdjInitSharedHeader();
    setTimeout(mdjInstallMainNavStaticMode, 0);
    setTimeout(mdjInstallMainNavStaticMode, 150);
    /* 600ms call removed — caused visible CLS on Owner home nav (TICKET-002). */
    /* Owner MI PERFIL poller: home page only — avoids nav reflows on interior pages.
       Checks every 400ms for up to 10s; catches mdjAutodetectArtistMiPerfilNav re-hides. */
    (function () {
      var _path = window.location.pathname;
      var _isHome = _path === '/' || _path.endsWith('/index.html') || _path.endsWith('/');
      if (!_isHome) return; /* only needed on home — other pages don't have the re-hide race */
      var _ticks = 0, _maxTicks = 25;
      var _poll = setInterval(function () {
        _ticks++;
        if (_ticks > _maxTicks) { clearInterval(_poll); return; }
        var idn = window.__mdjLastPlatformIdentity;
        var uid = window.__mdjNavOwnUserId;
        if (!idn || idn.dbRole !== 'owner' || !uid) return;
        var _mp = document.getElementById('mainNav-guest-mi-perfil-link');
        if (!_mp) return;
        var isHidden = _mp.classList.contains('mdj-mainnav-reserved-slot') ||
                       _mp.getAttribute('aria-hidden') === 'true';
        if (!isHidden) return;
        _mp.classList.remove('mdj-mainnav-reserved-slot');
        _mp.removeAttribute('aria-hidden');
        _mp.removeAttribute('tabindex');
        _mp.style.setProperty('display', 'inline-flex', 'important');
        _mp.style.setProperty('min-width', '0', 'important');
        _mp.style.setProperty('max-width', 'none', 'important');
        _mp.style.setProperty('width', '100%', 'important');
        _mp.style.setProperty('flex', '0 0 auto', 'important');
        _mp.style.setProperty('pointer-events', 'auto', 'important');
        _mp.style.removeProperty('visibility');
        if (!_mp.getAttribute('href') || _mp.getAttribute('href') === '#' ||
            _mp.getAttribute('href').indexOf('login') !== -1) {
          _mp.href = './dj-profile.html?id=' + encodeURIComponent(String(uid).trim());
        }
      }, 400);
    }());
  });

  window.addEventListener('focus', function () {
    if (typeof window.updateHeaderCartCount === 'function') window.updateHeaderCartCount();
  });
  window.addEventListener('storage', function (e) {
    if (e.key === 'mdjpro_checkout_cart' && typeof window.updateHeaderCartCount === 'function') {
      window.updateHeaderCartCount();
    }
  });

  /** `auth.js` delega ENTRAR/SALIR + zona VIP aquí para no pisar `data-auth-btn`. */
  window.__MDJ_HEADER_SESSION_OWNER = true;
  window.mdjNormalizeAvatarStorageUrl = mdjNormalizeAvatarStorageUrl;
  window.mdjResolveShowMyArtisticProfileMainNav = mdjResolveShowMyArtisticProfileMainNav;
  window.mdjApplyArtistSessionNav = mdjApplyArtistSessionNav;
  window.mdjNormalizePublicHomeMainNav = mdjNormalizePublicHomeMainNav;
  window.mdjRenderArtistNav = mdjRenderArtistNav;
  window.mdjBridgeArtistMiPerfilPublicNav = mdjBridgeArtistMiPerfilPublicNav;
  window.mdjAutodetectArtistMiPerfilNav = mdjAutodetectArtistMiPerfilNav;
  window.mdjBridgeHomeMiPerfilNav = mdjBridgeHomeMiPerfilNav;
  window.mdjAutodetectHomeArtistSession = mdjAutodetectHomeArtistSession;
  window.mdjBuildStaffEntryLoginHref = mdjBuildStaffEntryLoginHref;
  window.mdjBuildArtistStaffMainNavHref = mdjBuildArtistStaffMainNavHref;
  window.mdjApplyStaffNavHref = mdjApplyStaffNavHref;
  window.mdjBindStaffNavClickGuard = mdjBindStaffNavClickGuard;
  window.mdjRefreshAllStaffNavLinks = mdjRefreshAllStaffNavLinks;
  window.mdjRefreshOwnerStripStaffLinks = mdjRefreshOwnerStripStaffLinks;
  window.mdjIsStaffBuildingPage = mdjIsStaffBuildingPage;
  window.mdjApplyStaffBuildingMiPerfilLink = mdjApplyStaffBuildingMiPerfilLink;
  mdjInstallGlobalStaffNavCapture();
})();

/* ── OWNER 8-PILLAR NAVIGATION — PHYSICAL DOM REORDER + CASH FLOW LOCK ──
   Polling hasta 5 s: espera a que flowLink sea inyectado por el auth-chain
   antes de bloquear el texto. Sin polling, el 500ms timeout disparaba antes
   de que el elemento existiera y el MutationObserver nunca se instalaba.
   v20260524-polling-lock */
(function () {
  if (window.location.pathname.indexOf('account-settings.html') === -1 &&
      window.location.pathname.indexOf('dj-dashboard.html') === -1) return;

  var _flowObserver = null;
  var _flowLocked   = false;

  function _lockFlowText(node) {
    if (_flowObserver) { _flowObserver.disconnect(); _flowObserver = null; }
    if (!window.MutationObserver) return;
    _flowLocked = true;
    _flowObserver = new MutationObserver(function () {
      _flowObserver.disconnect();
      /* Bloquear texto */
      if (node.textContent !== 'CASH FLOW') {
        node.textContent = 'CASH FLOW';
        node.removeAttribute('data-i18n');
      }
      /* Bloquear href: cualquier href que NO sea el tab flow del dashboard es incorrecto */
      if (node.getAttribute('href').indexOf('dj-dashboard.html?tab=flow') === -1) {
        var _uid = window.__mdjNavOwnUserId || '';
        node.setAttribute('href', _uid
          ? './dj-dashboard.html?tab=flow&id=' + encodeURIComponent(_uid)
          : './dj-dashboard.html?tab=flow');
      }
      _flowObserver.observe(node, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['href'] });
    });
    _flowObserver.observe(node, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['href'] });
  }

  /* Devuelve true cuando flowLink ya existe y fue procesado */
  function reorderOwnerMenu() {
    if (document.body && document.body.classList.contains('mdj-from-profile') &&
        window.location.pathname.indexOf('account-settings.html') !== -1) {
      if (typeof window.mdjEnsureAccountSettingsOwnerStripNav === 'function') {
        window.mdjEnsureAccountSettingsOwnerStripNav();
      }
      return true;
    }
    var nav = document.getElementById('mainNav');
    if (!nav) return false;

    /* Colapsar MI PORTAL y DJ TOOLS (guardia inline !important) */
    var miPortalEl = document.getElementById('mainNav-mi-portal-link');
    if (miPortalEl) { miPortalEl.style.setProperty('display', 'none', 'important'); }
    var toolsEl = nav.querySelector('a[data-mdj-nav="tools"]');
    if (toolsEl)  { toolsEl.style.setProperty('display', 'none', 'important'); }

    /* CASH FLOW — hardcoded en HTML; solo actualizar href y bloquear texto */
    var flowLink = document.getElementById('mainNav-flow-link') ||
                   nav.querySelector('a[data-mdj-nav="flow"]');
    if (flowLink) {
      var _flowUid = window.__mdjNavOwnUserId || (function(){ try { return localStorage.getItem('sb-current-user-id'); } catch(e) { return null; } }()) || '';
      flowLink.href = _flowUid
        ? './dj-dashboard.html?tab=flow&id=' + encodeURIComponent(_flowUid)
        : './dj-dashboard.html?tab=flow';
      flowLink.textContent = 'CASH FLOW';
      flowLink.removeAttribute('data-i18n');
      flowLink.removeAttribute('aria-hidden');
      flowLink.removeAttribute('tabindex');
      if (!_flowLocked) { _lockFlowText(flowLink); }
    }

    /* MI PERFIL — hardcoded en HTML; actualizar href con UID cuando esté disponible */
    var profileLink = document.getElementById('mainNav-guest-mi-perfil-link') ||
                      nav.querySelector('a[data-mdj-nav="profile"]');
    if (profileLink) {
      var _pUid = window.__mdjNavOwnUserId || (function(){ try { return localStorage.getItem('sb-current-user-id'); } catch(e) { return null; } }()) || '';
      profileLink.href = _pUid ? './dj-profile.html?id=' + encodeURIComponent(_pUid) : './dj-profile.html';
      profileLink.removeAttribute('aria-hidden');
      profileLink.removeAttribute('tabindex');
    }

    /* AGENDA — inyectada por mdjEnsureAgendaMainNavNode; añadir &id=<uid> para evitar redirect a admin-dashboard */
    var agendaLink = document.getElementById('mainNav-agenda-link') ||
                     nav.querySelector('a[data-mdj-nav="agenda"]');
    if (agendaLink) {
      var _agUid = window.__mdjNavOwnUserId || (function(){ try { return localStorage.getItem('sb-current-user-id'); } catch(e) { return null; } }()) || '';
      agendaLink.href = _agUid
        ? './dj-dashboard.html?tab=dashboard&id=' + encodeURIComponent(_agUid)
        : './dj-dashboard.html?tab=dashboard';
    }

    /* dj-dashboard.html: reordenar MI PERFIL para que quede después de CASH FLOW.
       El HTML de dj-dashboard pone MI PERFIL antes de AGENDA; el orden correcto es:
       ... CASH FLOW · MI PERFIL · STAFF · SOUNDFORTIPS™ */
    if (window.location.pathname.indexOf('dj-dashboard.html') !== -1) {
      if (nav && profileLink && flowLink && flowLink.parentNode === nav) {
        /* Insertar MI PERFIL justo después de CASH FLOW */
        var _afterFlow = flowLink.nextSibling;
        nav.insertBefore(profileLink, _afterFlow);
      }
    }
    /* account-settings.html: sin reordenamiento — el HTML ya define el orden correcto:
       home · services · venues · shop · flow · [tools hidden] · config · profile · [jobs/contact hidden] · staff */

    /* Retorna true solo cuando el UID está disponible.
       Cuando lo encuentra, agenda un fix de seguridad 800ms después (posterior a todo el auth-chain). */
    var _resolvedUid = window.__mdjNavOwnUserId || (function(){ try { return localStorage.getItem('sb-current-user-id'); } catch(e) { return null; } }()) || '';
    if (_resolvedUid && !window.__mdjAccountSettingsNavLocked) {
      window.__mdjAccountSettingsNavLocked = true;
      setTimeout(function () {
        var _navF = document.getElementById('mainNav');
        var _fl = _navF && (document.getElementById('mainNav-flow-link') || _navF.querySelector('a[data-mdj-nav="flow"]'));
        if (_fl) {
          var _sfUid = window.__mdjNavOwnUserId || '';
          _fl.href = _sfUid
            ? './dj-dashboard.html?tab=flow&id=' + encodeURIComponent(_sfUid)
            : './dj-dashboard.html?tab=flow';
          _fl.textContent = 'CASH FLOW';
          _fl.removeAttribute('data-i18n');
          _fl.classList.remove('mdj-mainnav-reserved-slot');
          _fl.removeAttribute('aria-hidden');
          _fl.removeAttribute('tabindex');
          _fl.style.removeProperty('display');
          _fl.style.removeProperty('visibility');
          _fl.style.removeProperty('pointer-events');
          /* Reinstalar MutationObserver si el poll terminó antes de que el elemento existiera */
          if (!_flowLocked) { _lockFlowText(_fl); }
        }
        var _uid = window.__mdjNavOwnUserId || '';
        var _pl = document.getElementById('mainNav-guest-mi-perfil-link') || (_navF && _navF.querySelector('a[data-mdj-nav="profile"]'));
        if (_pl && _uid) {
          _pl.href = './dj-profile.html?id=' + encodeURIComponent(_uid);
          _pl.classList.remove('mdj-mainnav-reserved-slot');
          _pl.removeAttribute('aria-hidden');
          _pl.removeAttribute('tabindex');
          _pl.style.removeProperty('display');
          _pl.style.removeProperty('visibility');
          _pl.style.removeProperty('pointer-events');
        }
        /* dj-dashboard.html: reordenar MI PERFIL justo después de CASH FLOW en el safety re-patch */
        if (window.location.pathname.indexOf('dj-dashboard.html') !== -1 && _fl && _pl && _fl.parentNode) {
          _fl.parentNode.insertBefore(_pl, _fl.nextSibling);
        }
        /* AGENDA safety re-patch con uid definitivo */
        var _al = document.getElementById('mainNav-agenda-link') || (_navF && _navF.querySelector('a[data-mdj-nav="agenda"]'));
        if (_al && _uid) {
          _al.href = './dj-dashboard.html?tab=dashboard&id=' + encodeURIComponent(_uid);
        }
      }, 800);
    }
    return !!_resolvedUid;
  }

  /* Polling: cada 300 ms, máximo 17 intentos (~5 s). Para cuando flowLink aparece. */
  var _polls = 0;
  function poll() {
    _polls++;
    var done = reorderOwnerMenu();
    if (!done && _polls < 17) { setTimeout(poll, 300); }
  }
  poll();
})();

/* ── OWNER-TABS REORDER — dj-dashboard.html ──────────────────────────────────────────────────
   Mueve MI PERFIL (posición 4 en el HTML) a posición 9: justo después de CASH FLOW.
   Inyecta STAFF en posición 10. Bloquea texto CASH FLOW anti-i18n con MutationObserver.
   Safety re-patch a 1 s: parchea uid definitivo y re-ejecuta el orden tras i18n.updateUI().
   v20260525-dashboard-owner-tabs-reorder-v2 */
(function () {
  if (window.location.pathname.indexOf('dj-dashboard.html') === -1) return;

  /* Early hide TRABAJOS — sync en primer tick del script (anti-flash antes de poll). */
  var _dtEarlyC = document.querySelector('#owner-tabs .container');
  if (_dtEarlyC) {
    var _dtEarlyJobs = _dtEarlyC.querySelector('[data-i18n="nav-jobs"]');
    if (_dtEarlyJobs) {
      _dtEarlyJobs.style.setProperty('display', 'none', 'important');
      _dtEarlyJobs.setAttribute('aria-hidden', 'true');
      _dtEarlyJobs.setAttribute('tabindex', '-1');
    }
  }

  var _dtObs    = null;
  var _dtLocked = false;

  function _lockDashFlowText(node) {
    if (_dtObs) { _dtObs.disconnect(); _dtObs = null; }
    if (!window.MutationObserver) return;
    _dtLocked = true;
    _dtObs = new MutationObserver(function () {
      _dtObs.disconnect();
      if (node.textContent !== 'CASH FLOW') {
        node.textContent = 'CASH FLOW';
        node.removeAttribute('data-i18n');
      }
      _dtObs.observe(node, { childList: true, characterData: true, subtree: true });
    });
    _dtObs.observe(node, { childList: true, characterData: true, subtree: true });
  }

  /** Owner strip active underline — no depende de data-i18n="flow-dash" (stripped por anti-i18n). */
  function _syncDashOwnerStripActive(tabId) {
    var container = document.querySelector('#owner-tabs .container');
    if (!container) return;
    var tab = tabId;
    if (!tab) {
      try {
        tab = new URLSearchParams(window.location.search).get('tab') || 'dashboard';
      } catch (eTab) {
        tab = 'dashboard';
      }
    }
    if (tab !== 'flow' && tab !== 'dashboard') return;

    var flowEl = container.querySelector('a[href*="tab=flow"]') ||
                 container.querySelector('[data-i18n="flow-dash"]') ||
                 container.querySelector('button[data-tab="flow"]');
    var agendaEl = container.querySelector('button[data-tab="dashboard"]');

    container.querySelectorAll('button[data-tab]').forEach(function (el) {
      el.classList.remove('active');
    });
    if (flowEl) flowEl.classList.remove('active');

    if (tab === 'flow' && flowEl) {
      flowEl.classList.add('active');
    } else if (tab === 'dashboard' && agendaEl) {
      agendaEl.classList.add('active');
    }
  }
  window.__mdjSyncDashOwnerStripActive = _syncDashOwnerStripActive;

  function _patchSwitchDashTabForStripActive() {
    var orig = window.switchDashTab;
    if (typeof orig !== 'function' || orig.__mdjStripActivePatched) return;
    function patched(tabId) {
      var out = orig.apply(this, arguments);
      _syncDashOwnerStripActive(tabId);
      return out;
    }
    patched.__mdjStripActivePatched = true;
    window.switchDashTab = patched;
  }

  function _applyDashOwnerTabs() {
    var container = document.querySelector('#owner-tabs .container');
    if (!container) return false;

    var trabajosEl = container.querySelector('[data-i18n="nav-jobs"]');
    if (trabajosEl) {
      trabajosEl.style.setProperty('display', 'none', 'important');
      trabajosEl.setAttribute('aria-hidden', 'true');
      trabajosEl.setAttribute('tabindex', '-1');
    }

    /* flowEl puede aún tener data-i18n="flow-dash" — buscar por ambos estados */
    var flowEl    = container.querySelector('[data-i18n="flow-dash"]') ||
                    container.querySelector('a[href*="tab=flow"]');
    var miPerfilEl = container.querySelector('[data-i18n="menu-account"]');
    var sftEl      = container.querySelector('[data-i18n="nav-soundfortips"]');
    if (!flowEl || !miPerfilEl) return false;

    /* ── CASH FLOW: fijar texto + eliminar data-i18n + MO ── */
    flowEl.textContent = 'CASH FLOW';
    flowEl.removeAttribute('data-i18n');
    if (!_dtLocked) { _lockDashFlowText(flowEl); }

    /* ── MI PERFIL: patch href con UID ── */
    var uid = window.__mdjNavOwnUserId || '';
    if (uid) {
      miPerfilEl.href = './dj-profile.html?id=' + encodeURIComponent(uid) + '&mdj_nav=profile';
    }

    /* ── STAFF: solo edificio artista (account-settings / dj-dashboard) ── */
    var staffEl = container.querySelector('a[data-mdj-nav="staff"]');
    if (!staffEl) {
      staffEl = document.createElement('a');
      staffEl.className = 'dj-tab-btn';
      staffEl.setAttribute('data-mdj-nav', 'staff');
      staffEl.setAttribute('data-i18n', 'nav-staff');
      staffEl.textContent = 'STAFF';
    } else {
      staffEl.textContent = 'STAFF';
      staffEl.removeAttribute('aria-hidden');
      staffEl.removeAttribute('tabindex');
      staffEl.style.removeProperty('pointer-events');
      staffEl.style.removeProperty('visibility');
      staffEl.style.removeProperty('opacity');
    }
    if (typeof window.mdjApplyStaffNavHref === 'function') {
      window.mdjApplyStaffNavHref(staffEl);
    } else if (typeof window.mdjBuildArtistStaffMainNavHref === 'function') {
      staffEl.href = window.mdjBuildArtistStaffMainNavHref();
      if (typeof window.mdjBindStaffNavClickGuard === 'function') {
        window.mdjBindStaffNavClickGuard(staffEl);
      }
    }

    /* ── REORDER: CASH FLOW · MI PERFIL · STAFF · SOUNDFORTIPS™ ── */
    if (flowEl.parentNode === container && miPerfilEl !== flowEl.nextSibling) {
      container.insertBefore(miPerfilEl, flowEl.nextSibling);
    }
    if (sftEl && sftEl.parentNode === container) {
      container.insertBefore(staffEl, sftEl);
    } else {
      container.appendChild(staffEl);
    }

    _syncDashOwnerStripActive();
    return true; /* strip listo — stop polling */
  }

  var _dtPoll = 0;
  var _dtDone = false;
  function pollDashTabs() {
    _dtPoll++;
    _dtDone = _applyDashOwnerTabs();
    if (!_dtDone && _dtPoll < 17) { setTimeout(pollDashTabs, 300); }
    if (_dtDone) {
      _patchSwitchDashTabForStripActive();
      /* Safety re-patch a 1 s: uid definitivo + re-lock texto tras i18n.updateUI() */
      setTimeout(function () {
        var c = document.querySelector('#owner-tabs .container');
        if (!c) return;
        var trabajosRep = c.querySelector('[data-i18n="nav-jobs"]');
        if (trabajosRep) {
          trabajosRep.style.setProperty('display', 'none', 'important');
          trabajosRep.setAttribute('aria-hidden', 'true');
          trabajosRep.setAttribute('tabindex', '-1');
        }
        /* Re-fijar CASH FLOW si i18n lo revirtió */
        var fl = c.querySelector('a[href*="tab=flow"]') || c.querySelector('[data-i18n="flow-dash"]');
        if (fl) {
          fl.textContent = 'CASH FLOW';
          fl.removeAttribute('data-i18n');
          if (!_dtLocked) { _lockDashFlowText(fl); }
        }
        /* Re-patch uid */
        var uid = window.__mdjNavOwnUserId || '';
        var mp = c.querySelector('[data-i18n="menu-account"]') ||
                 c.querySelector('a[href*="dj-profile.html"]');
        if (mp && uid) {
          mp.href = './dj-profile.html?id=' + encodeURIComponent(uid) + '&mdj_nav=profile';
        }
        /* Re-verificar STAFF (ART-007B tras sesión / i18n) */
        var st = c.querySelector('a[data-mdj-nav="staff"]');
        var sf = c.querySelector('[data-i18n="nav-soundfortips"]');
        if (!st) {
          st = document.createElement('a');
          st.className = 'dj-tab-btn';
          st.setAttribute('data-mdj-nav', 'staff');
          st.setAttribute('data-i18n', 'nav-staff');
          st.textContent = 'STAFF';
          if (sf && sf.parentNode === c) { c.insertBefore(st, sf); }
          else { c.appendChild(st); }
        }
        if (typeof window.mdjApplyStaffNavHref === 'function') {
          window.mdjApplyStaffNavHref(st);
        } else if (typeof window.mdjRefreshOwnerStripStaffLinks === 'function') {
          window.mdjRefreshOwnerStripStaffLinks();
        }
        _syncDashOwnerStripActive();
      }, 1000);
    }
  }
  _patchSwitchDashTabForStripActive();
  pollDashTabs();
})();

/* ── OWNER STRIP — 10 PILARES — artist pages with #owner-tabs
   dj-profile.html : #owner-tabs en HTML; CASH FLOW / MI PERFIL / SFT pueden ser <button>.
   shop.html       : #owner-tabs inyectado por mdj-profile-nav-context.js.
   Orden: INICIO · ACADEMIA · SHOP · AGENDA · CONFIG · DJ TOOLS ·
          CASH FLOW · MI PERFIL · STAFF · SOUNDFORTIPS™
   v20260605-owner-strip-10-pillars */
(function () {
  var _page = (window.location.pathname.split('/').pop() || '').toLowerCase();
  var _OWNER_STRIP_PAGES = {
    'dj-profile.html': 1,
    'shop.html': 1,
    'jobs.html': 1,
    'dj-tools.html': 1,
    'academia.html': 1,
    'courses.html': 1,
    'dj-knowledge.html': 1,
    'weather-lab.html': 1,
    'dj-dashboard.html': 1,
    'admin-dashboard.html': 1,
    'account-settings.html': 1
  };
  if (!_OWNER_STRIP_PAGES[_page]) return;

  /* ── VISUAL BLOCKER: previene pantallaso del perfil artista mientras el strip Owner carga.
     Solo actúa en dj-profile.html. Restaura visibilidad cuando el strip está listo o en 2.5s. */
  var _visualBlocked = false;
  if (window.location.pathname.indexOf('dj-profile.html') !== -1) {
    try {
      var _cachedRole = (window.__mdjpro && window.__mdjpro.role) || '';
      var _isAdminRole = /owner|manager/.test(_cachedRole);
      if (_isAdminRole || _cachedRole === '') {
        document.documentElement.style.display = 'none';
        _visualBlocked = true;
        setTimeout(function () {
          document.documentElement.style.display = '';
          _visualBlocked = false;
        }, 2500);
      }
    } catch (_e) { /* silent — nunca bloquear la página por un error */ }
  }

  var _obs    = null;
  var _locked = false;

  /** Bloquea textContent del nodo CASH FLOW contra la i18n engine. */
  function _lockCashFlowText(node) {
    if (_obs) { _obs.disconnect(); _obs = null; }
    if (!window.MutationObserver) return;
    _locked = true;
    _obs = new MutationObserver(function () {
      _obs.disconnect();
      if (node.textContent !== 'CASH FLOW') {
        node.textContent = 'CASH FLOW';
        node.removeAttribute('data-i18n');
      }
      _obs.observe(node, { childList: true, characterData: true, subtree: true });
    });
    _obs.observe(node, { childList: true, characterData: true, subtree: true });
  }

  function reorderOwnerStrip() {
    var ownerTabs = document.getElementById('owner-tabs');
    if (!ownerTabs) return false;
    var c = ownerTabs.querySelector('.container');
    if (!c) return false;

    /* Nodos críticos — data-i18n funciona en ambas páginas antes y después de i18n.updateUI() */
    var flowEl = c.querySelector('[data-i18n="flow-dash"]') ||
                 c.querySelector('a[href*="tab=flow"]') ||
                 c.querySelector('button[data-tab="flow"]') ||
                 document.getElementById('dj-tab-flow-btn');
    var sftEl  = c.querySelector('[data-i18n="nav-soundfortips"]') ||
                 document.getElementById('dj-tab-sft-btn');
    if (!flowEl || !sftEl) return false; /* strip no listo aún; poll continúa */

    /* ── CASH FLOW: texto fijo + navegación con UID ── */
    flowEl.textContent = 'CASH FLOW';
    flowEl.removeAttribute('data-i18n');

    if (flowEl.tagName === 'A') {
      /* shop.html: anchor inyectado — href actualizado con uid */
      var _uid0 = window.__mdjNavOwnUserId || (function(){ try { return localStorage.getItem('sb-current-user-id'); } catch(e) { return null; } }()) || '';
      flowEl.href = _uid0
        ? './dj-dashboard.html?tab=flow&id=' + encodeURIComponent(_uid0)
        : './dj-dashboard.html?tab=flow';
    } else {
      /* dj-profile.html: button — onclick intercepta y navega fuera del perfil */
      flowEl.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        var _uid = window.__mdjNavOwnUserId || (function(){ try { return localStorage.getItem('sb-current-user-id'); } catch(e) { return null; } }()) || '';
        window.location.href = _uid
          ? './dj-dashboard.html?tab=flow&id=' + encodeURIComponent(_uid)
          : './dj-dashboard.html?tab=flow';
      };
    }
    if (!_locked) { _lockCashFlowText(flowEl); }

    /* ── STAFF: edificio artista → ART-007B; edificio Staff → nav interna sin tocar ── */
    var staffEl = c.querySelector('a[data-mdj-nav="staff"]');
    var _staffBuildingPage = typeof window.mdjIsStaffBuildingPage === 'function'
      ? window.mdjIsStaffBuildingPage()
      : (_page === 'admin-dashboard.html' || _page === 'account-profile.html' || _page === 'staff.html');
    if (!_staffBuildingPage) {
      if (!staffEl) {
        staffEl = document.createElement('a');
        staffEl.className = 'dj-tab-btn';
        staffEl.setAttribute('data-mdj-nav', 'staff');
        staffEl.setAttribute('data-i18n', 'nav-staff');
        staffEl.textContent = 'STAFF';
      } else {
        staffEl.textContent = 'STAFF';
        staffEl.removeAttribute('aria-hidden');
        staffEl.removeAttribute('tabindex');
        staffEl.style.removeProperty('pointer-events');
        staffEl.style.removeProperty('visibility');
        staffEl.style.removeProperty('opacity');
      }
      if (typeof window.mdjApplyStaffNavHref === 'function') {
        window.mdjApplyStaffNavHref(staffEl);
      } else if (typeof window.mdjBuildArtistStaffMainNavHref === 'function') {
        staffEl.href = window.mdjBuildArtistStaffMainNavHref();
        if (typeof window.mdjBindStaffNavClickGuard === 'function') {
          window.mdjBindStaffNavClickGuard(staffEl);
        }
      }
    }

    /* ── Reorden por appendChild secuencial (data-i18n como ancla estable) ──
       Orden exacto: INICIO · ACADEMIA · SHOP · AGENDA · CONFIG · DJ TOOLS ·
                     CASH FLOW · MI PERFIL · STAFF · SOUNDFORTIPS™ */
    var initioEl   = c.querySelector('[data-i18n="nav-home"]')        || c.querySelector('a[href^="./index.html"]');
    var trabajosEl = c.querySelector('[data-i18n="nav-jobs"]');
    var shopEl     = c.querySelector('[data-i18n="nav-shop"]');
    var agendaEl   = c.querySelector('[data-i18n="dash-your-profile"]') ||
                     c.querySelector('a[href*="dj-dashboard.html"][href*="mdj_nav"]') ||
                     c.querySelector('a[href*="dj-dashboard.html"]:not([data-mdj-nav="flow"])');
    var configEl   = c.querySelector('[data-i18n="nav-settings"]');
    var academiaEl = c.querySelector('[data-i18n="nav-academia"]');
    var toolsEl    = c.querySelector('[data-i18n="nav-tools"]');
    var perfilEl   = c.querySelector('[data-i18n="menu-account"]')     || c.querySelector('button[data-tab="public"]');

    /* ── SHOP: edificio Staff → shop interno (C-2); resto → Shopify externo ── */
    if (shopEl) {
      if (_staffBuildingPage) {
        if (shopEl.tagName === 'A') {
          shopEl.href = './shop.html';
          shopEl.removeAttribute('target');
          shopEl.removeAttribute('rel');
        }
      } else {
        var _shopUrl = 'https://miami-dj-beat-store.myshopify.com/?shop_sign_in=true';
        if (shopEl.tagName === 'A') {
          shopEl.href = _shopUrl;
          shopEl.setAttribute('target', '_blank');
          shopEl.setAttribute('rel', 'noopener noreferrer');
        } else {
          shopEl.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            window.open(_shopUrl, '_blank', 'noopener,noreferrer');
          }, true);
        }
      }
    }

    /* ── MI PERFIL (owner-tabs): STAFF building — Owner → dj-profile; resto → account-profile (C-1) ── */
    if (perfilEl && _staffBuildingPage && typeof window.mdjApplyStaffBuildingMiPerfilLink === 'function') {
      window.mdjApplyStaffBuildingMiPerfilLink(perfilEl);
    }

    /* ── AGENDA: forzar href a dj-dashboard.html?tab=dashboard&id=<uid>
       Se reemplaza el href completo (incluyendo ?mdj_nav=profile si venía así)
       para garantizar que la página destino no sea redirigida por falta de parámetros. ── */
    if (agendaEl && agendaEl.tagName === 'A') {
      var _agUid = window.__mdjNavOwnUserId || (function(){ try { return localStorage.getItem('sb-current-user-id'); } catch(e) { return null; } }()) || '';
      agendaEl.href = _agUid
        ? './dj-dashboard.html?tab=dashboard&id=' + encodeURIComponent(_agUid)
        : './dj-dashboard.html?tab=dashboard';
      agendaEl.removeAttribute('data-i18n'); /* previene que i18n sobreescriba el href */
    }

    if (trabajosEl) {
      trabajosEl.style.setProperty('display', 'none', 'important');
      trabajosEl.setAttribute('aria-hidden', 'true');
      trabajosEl.setAttribute('tabindex', '-1');
    }
    [initioEl, academiaEl, shopEl, agendaEl, configEl, toolsEl,
     flowEl, perfilEl, staffEl, sftEl].forEach(function (el) {
      if (el) c.appendChild(el);
    });

    if (_page === 'dj-dashboard.html' && typeof window.__mdjSyncDashOwnerStripActive === 'function') {
      window.__mdjSyncDashOwnerStripActive();
    }

    if (_page === 'account-settings.html' && typeof window.mdjEnsureAccountSettingsOwnerStripNav === 'function') {
      window.mdjEnsureAccountSettingsOwnerStripNav();
    }

    return true; /* nodos presentes; poll detiene */
  }

  var _polls = 0;
  function pollStrip() {
    _polls++;
    var done = reorderOwnerStrip();
    if (done && _visualBlocked) {
      document.documentElement.style.display = '';
      _visualBlocked = false;
    }
    if (!done && _polls < 20) { setTimeout(pollStrip, 300); }
    /* Re-patch de seguridad: cuando el uid aún no está en el primer run,
       reintentamos el patch de AGENDA con uid una vez que el auth-chain resuelve. */
    if (done) {
      setTimeout(function () {
        var _uid = window.__mdjNavOwnUserId || (function(){ try { return localStorage.getItem('sb-current-user-id'); } catch(e) { return null; } }()) || '';
        if (!_uid) return;
        var owT = document.getElementById('owner-tabs');
        if (!owT) return;
        var cT = owT.querySelector('.container');
        if (!cT) return;
        var agEl = cT.querySelector('a[href*="dj-dashboard.html"]') ||
                   cT.querySelector('a[data-i18n="dash-your-profile"]');
        if (agEl && agEl.tagName === 'A') {
          agEl.href = './dj-dashboard.html?tab=dashboard&id=' + encodeURIComponent(_uid);
        }
        var mpEl = cT.querySelector('[data-i18n="menu-account"]');
        if (mpEl && typeof window.mdjApplyStaffBuildingMiPerfilLink === 'function') {
          window.mdjApplyStaffBuildingMiPerfilLink(mpEl);
        }
        if (typeof window.mdjRefreshAllStaffNavLinks === 'function') {
          window.mdjRefreshAllStaffNavLinks();
        } else if (typeof window.mdjRefreshOwnerStripStaffLinks === 'function') {
          window.mdjRefreshOwnerStripStaffLinks();
        }
      }, 900);
    }
  }
  pollStrip();
})();

/* ── AGENDA GUARD — dj-dashboard.html: bloquea cualquier redirect del owner a admin-dashboard.
   El redirect ocurre antes de que checkSessionForNav pueda prevenirlo (race condition).
   Este interceptor sobreescribe location.assign y el setter de location.href ANTES de que
   cualquier script async pueda disparar la navegación incorrecta.
   v20260525-agenda-guard-dj-dashboard */
(function () {
  if (window.location.pathname.indexOf('dj-dashboard.html') === -1) return;

  /* Solo actuar si el URL fue navegado desde el strip del owner (tiene ?tab=dashboard o ?mdj_nav=profile) */
  var _qs = window.location.search || '';
  var _isOwnerNav = _qs.indexOf('tab=dashboard') !== -1 || _qs.indexOf('mdj_nav=profile') !== -1;
  if (!_isOwnerNav) return;

  function _isAdminRedirect(url) {
    if (!url || typeof url !== 'string') return false;
    return url.indexOf('admin-dashboard') !== -1;
  }

  /* Interceptar location.assign */
  try {
    var _origAssign = window.location.assign.bind(window.location);
    window.location.assign = function (url) {
      if (_isAdminRedirect(url)) {
        console.warn('[MDJ-AGENDA-GUARD] Blocked redirect to:', url);
        return;
      }
      _origAssign(url);
    };
  } catch (e) { /* ignore if not overridable */ }

  /* Interceptar location.href setter via replace */
  try {
    var _origReplace = window.location.replace.bind(window.location);
    window.location.replace = function (url) {
      if (_isAdminRedirect(url)) {
        console.warn('[MDJ-AGENDA-GUARD] Blocked replace to:', url);
        return;
      }
      _origReplace(url);
    };
  } catch (e2) { /* ignore */ }

  /* Patch adicional via Object.defineProperty en window.location.href */
  try {
    var _locProto = Object.getPrototypeOf(window.location);
    var _hrefDescr = Object.getOwnPropertyDescriptor(_locProto, 'href');
    if (_hrefDescr && _hrefDescr.set) {
      Object.defineProperty(_locProto, 'href', {
        get: _hrefDescr.get,
        set: function (url) {
          if (_isAdminRedirect(String(url || ''))) {
            console.warn('[MDJ-AGENDA-GUARD] Blocked href to:', url);
            return;
          }
          _hrefDescr.set.call(this, url);
        },
        configurable: true
      });
    }
  } catch (e3) { /* ignore if not patchable */ }
})();

/* ── SHOP → Shopify externo en #mainNav (todas las páginas)
   Parcha a[data-mdj-nav="shop"] en el nav principal para evitar la cortina interna.
   La IIFE de owner strip cubre el mismo nodo en #owner-tabs independientemente.
   v20260524-shop-mainnav-external */
(function () {
  var _SHOPIFY = 'https://miami-dj-beat-store.myshopify.com/?shop_sign_in=true';

  function _patchMainNavShop() {
    var nav = document.getElementById('mainNav');
    if (!nav) return;
    nav.querySelectorAll('a[data-mdj-nav="shop"]').forEach(function (a) {
      a.href = _SHOPIFY;
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _patchMainNavShop);
  } else {
    _patchMainNavShop();
  }
})();

/* ── MDJB 2026-08-14: FÉNIX AI en la nav de STAFF (owner) — reemplaza SoundForTips ──
   SoundForTips es feature de artista; las cuentas de oficina (owner/manager/vendedor) NO la
   necesitan (trabajo de oficina). En su lugar acceden a FÉNIX AI. El candado real ya vive en
   elixis-console.html (exige sesión + userRole "owner"). Se REUTILIZA el tab existente de
   SoundForTips (no se agrega elemento nuevo → no pelea con el reorden del strip). Espera a que
   el reorden termine (Jobs oculto) para no romperlo, y es idempotente. Aislado y reversible. */
(function mdjFenixStaffNavTab(){
  function isStaff(){
    var b=document.body; if(!b) return false;
    var role=(b.getAttribute('data-mdj-nav-role')||'').toLowerCase();
    if(role==='management'||role==='seller') return true;
    return b.classList.contains('mdj-staff-nav') && !b.classList.contains('mdj-artist-nav');
  }
  function reorderDone(strip){ var j=strip.querySelector('[data-i18n="nav-jobs"]'); return !j || getComputedStyle(j).display==='none'; }
  function apply(force){
    if(!isStaff()) return false;                                     // artistas conservan SoundForTips
    var strip=document.getElementById('owner-tabs'); if(!strip) return false;
    if(!force && !reorderDone(strip)) return false;                  // esperar al reorden
    // La tira puede estar clonada: dj-owner-tabs--marquee duplica su contenido para el
    // desplazamiento continuo, y clona a ciegas. querySelector sólo alcanzaba la PRIMERA
    // copia, así que el clon se quedaba con SoundForTips y la pestaña cambiaba sola al
    // pasar el marquee. Se parchean TODAS las coincidencias.
    var sfts=[].slice.call(strip.querySelectorAll('[data-i18n="nav-soundfortips"],[data-tab="sft"]'));
    if(!sfts.length) return false;
    sfts.forEach(function(sft){
      sft.setAttribute('data-mdj-nav','fenix');
      sft.removeAttribute('data-i18n');                              // que i18n no reescriba el texto
      sft.removeAttribute('data-tab'); sft.removeAttribute('onclick');
      sft.title='FÉNIX AI — asistente del owner (acceso restringido)';
      if(sft.tagName==='A'){ sft.setAttribute('href','./elixis-console.html'); sft.removeAttribute('target'); sft.removeAttribute('rel'); }
      else { try{ sft.type='button'; }catch(e){} sft.onclick=function(ev){ if(ev){ ev.preventDefault(); ev.stopPropagation(); } window.location.href='./elixis-console.html'; }; }
      sft.innerHTML='FÉNIX AI <span class="dj-tab-lock-icon" aria-hidden="true" style="font-size:.82em;opacity:.85;margin-left:3px;">🔒</span>';
    });
    return true;
  }
  function boot(){
    // apply() es idempotente (tras parchear, el nodo deja de casar el selector), así que se
    // repasa toda la ventana en vez de parar al primer éxito: el marquee puede clonar después.
    apply(false);
    var n=0, iv=setInterval(function(){ n++; apply(n>=12); if(n>=18){ clearInterval(iv); } }, 350);
  }
  window.mdjApplyFenixStaffNavTab = function () { apply(true); };
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
})();
