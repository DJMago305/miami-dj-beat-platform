/* ══════════════════════════════════════════════════════════════════════════
   PREVUELO DE LA ESTACION · 2026-08-22
   ──────────────────────────────────────────────────────────────────────────
   QUE RESUELVE. Las paginas de estacion escriben en su HTML la barra PUBLICA
   —el juego de nueve de la vitrina—. Quien tiene sesion necesita la barra de
   su estacion, y hasta hoy ese relevo lo daba mdjb-shared-header.js DESPUES de
   preguntarle a Supabase: unas decimas en las que la barra saltaba y se
   estiraba. Eso era el «chicle». Y sin sesion el relevo no llegaba nunca.

   COMO. La sesion ya esta en el navegador: Supabase guarda su token en
   localStorage, y ese token lleva el rol dentro (app_metadata.role). Se lee de
   forma SINCRONA, sin pedirle nada a la red, en el mismo instante en que el
   navegador acaba de leer la barra y antes de pintarla. Asi el primer
   fotograma ya es el definitivo, para todos.

   POR QUE EL HTML TRAE LA PUBLICA Y NO LA DE ESTACION. Por seguridad, no por
   comodidad: si este guion fallara, un desconocido veria la barra publica
   —que es lo correcto para el— y como mucho un artista veria el relevo tarde.
   Al reves, un fallo enseñaria las rutas de trabajo a quien no tiene cuenta.
   Se falla del lado seguro.

   ESTO NO DA PERMISOS. Solo elige QUE MENU se pinta. El token no se verifica
   aqui —no se puede, ni hace falta—: quien manda de verdad sigue siendo el
   servidor con sus politicas RLS. Un curioso que se invente un token en su
   navegador vera unos rotulos, y ni un dato.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* El juego de la estacion del artista, en el mismo orden y con los mismos
     rotulos que MDJ_NAV_SLOTS_ARTISTA en mdjb-shared-header.js. Si alli cambia
     un puesto, aqui tambien: son la misma barra vista en dos momentos. */
  var ESTACION = [
    { s: 1, href: './index.html',                                  i18n: 'nav-home',       nav: 'home',      txt: 'Inicio' },
    { s: 2, href: './academia.html?mdj_nav=profile',               i18n: 'nav-academia',   nav: 'academia',  txt: 'Academia' },
    { s: 3, href: './dj-dashboard.html?mdj_nav=profile',           i18n: null,             nav: 'agenda',    txt: 'Agenda',
      id: 'mainNav-agenda-link', cls: 'mdj-agenda-mainnav' },
    { s: 4, href: './account-settings.html?mdj_nav=profile',       i18n: 'nav-config',     nav: 'config',    txt: '⚙️ CONFIG',
      id: 'mainNav-config-link', cls: 'mdj-config-mainnav' },
    { s: 5, href: './dj-tools.html?mdj_nav=profile',               i18n: 'nav-tools',      nav: 'tools',     txt: 'DJ Tools' },
    { s: 6, href: './dj-dashboard.html?tab=flow',                  i18n: null,             nav: 'flow',      txt: 'Cash Flow',
      id: 'mainNav-flow-link', cls: 'mdj-flow-mainnav' },
    { s: 7, href: './dj-profile.html?mdj_nav=profile&tab=sft',     i18n: null,             nav: 'sft',       txt: 'SoundForTips™' },
    { s: 8, href: './dj-profile.html?mdj_nav=profile',             i18n: 'nav-my-profile', nav: 'mi-portal', txt: 'MI PERFIL',
      id: 'mainNav-mi-portal-link', cls: 'mdj-mi-portal-mainnav mdj-mi-portal-gold' },
    { s: 9, href: './shop.html?mdj_nav=profile',                   i18n: 'nav-shop',       nav: 'shop',      txt: 'Shop' }
  ];


  /* El juego INTERNO, para owner / management / seller. Mismo orden y mismos
     rotulos que MDJ_NAV_SLOTS_INTERNO. Sin el, un owner recibia primero la
     barra de artista y el guion se la cambiaba despues: su propio relevo. */
  var INTERNO = [
    { s: 1, href: './index.html',                i18n: 'nav-home',       nav: 'home',      txt: 'Inicio' },
    { s: 2, href: './academia.html',             i18n: 'nav-academia',   nav: 'academia',  txt: 'Academia' },
    { s: 3, href: './staff-agenda.html',         i18n: null,             nav: 'agenda',    txt: 'Agenda' },
    { s: 4, href: './account-settings.html',     i18n: 'nav-config',     nav: 'config',    txt: '⚙️ Config',
      id: 'mainNav-config-link', cls: 'mdj-config-mainnav' },
    { s: 5, href: './dj-tools.html',             i18n: 'nav-tools',      nav: 'tools',     txt: 'DJ Tools' },
    { s: 6, href: './staff-agenda.html?tab=flow',i18n: null,             nav: 'flow',      txt: 'Cash Flow' },
    { s: 7, href: './elixis-console.html',       i18n: null,             nav: 'fenix',     txt: 'Fénix AI' },
    { s: 8, href: './account-settings.html',     i18n: 'nav-my-profile', nav: 'mi-portal', txt: 'MI PERFIL',
      id: 'mainNav-mi-portal-link', cls: 'mdj-mi-portal-mainnav mdj-mi-portal-gold' },
    { s: 9, href: './staff.html',                i18n: 'nav-staff',      nav: 'staff',     txt: 'Staff',
      cls: 'dj-tab-btn--staff-only' }
  ];

  /* Hay sesion? Se mira SOLO en localStorage y de forma sincrona. Cualquier
     duda —no hay clave, no parsea, esta caducado— cuenta como invitado. */
  function sesion() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!/^sb-.*-auth-token$/.test(k)) continue;
        var crudo = JSON.parse(localStorage.getItem(k) || 'null');
        if (!crudo || !crudo.access_token) continue;
        if (crudo.expires_at && (crudo.expires_at * 1000) < Date.now()) continue;
        /* El rol viaja DENTRO del token, en app_metadata. Se lee sin red y sin
           verificar: aqui solo elige menu, nunca da permisos. */
        var rol = '';
        try {
          var cuerpo = crudo.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
          var p = JSON.parse(decodeURIComponent(escape(atob(cuerpo))));
          rol = String((p.app_metadata && p.app_metadata.role) || '').toLowerCase().trim();
        } catch (eRol) { rol = ''; }
        var uid = '';
        try {
          var c2 = crudo.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
          uid = String(JSON.parse(decodeURIComponent(escape(atob(c2)))).sub || '');
        } catch (eUid) { uid = ''; }
        return { hay: true, rol: rol, uid: uid };
      }
    } catch (e) { /* invitado */ }
    return { hay: false, rol: '', uid: '' };
  }

  window.mdjPrevueloEstacion = function () {
    try {
      var ses = sesion();
      if (!ses.hay) return;                           /* invitado: la publica se queda */
      var nav = document.getElementById('mainNav');
      if (!nav) return;
      if (nav.querySelector('a[data-mdj-nav="sft"], a[data-mdj-nav="fenix"]')) return;

      var oficina = (ses.rol === 'owner' || ses.rol === 'management' || ses.rol === 'seller' || ses.rol === 'admin');
      var juego = oficina ? INTERNO : ESTACION;
      var html = '';
      for (var i = 0; i < juego.length; i++) {
        var p = juego[i];
        html += '<a href="' + p.href + '"' +
                (p.id ? ' id="' + p.id + '"' : '') +
                (p.cls ? ' class="' + p.cls + '"' : '') +
                (p.i18n ? ' data-i18n="' + p.i18n + '"' : '') +
                ' data-mdj-nav="' + p.nav + '" data-mdj-slot="' + p.s + '">' + p.txt + '</a>';
      }
      nav.innerHTML = html;
      if (!oficina && document.body) document.body.setAttribute('data-mdj-estacion', 'artista');
    } catch (e) { /* si algo falla, se queda la publica: el lado seguro */ }
  };

  /* ── LA FICHA DE DJ TIENE DOS CARAS ─────────────────────────────────────
     Es el escaparate PUBLICO del artista y, a la vez, la estacion de quien es
     su dueño. La regla del PO (2026-08-22): «cuando un visitante localiza un
     dj no ve la estacion de trabajo, ahi ve la barra de inicio de la pagina
     para poder entrar a chismiar o a subscribirce, pero si ve el perfil del dj
     y lo que hay en el perfil».
     Asi que aqui NO basta con tener sesion: hay que ser el DUEÑO de la ficha
     que se esta mirando. El uid propio viaja en el mismo token (campo `sub`),
     de modo que la comparacion tambien es instantanea y anterior al pintado.
     Mirando la ficha de OTRO —aunque tengas cuenta— mandas la publica. */
  window.mdjPrevueloFicha = function () {
    try {
      var ses = sesion();
      if (!ses.hay || !ses.uid) return;
      var pedido = '';
      try { pedido = new URLSearchParams(location.search).get('id') || ''; } catch (eP) { pedido = ''; }
      if (pedido && pedido !== ses.uid) return;       /* la ficha de otro: publica */
      window.mdjPrevueloEstacion();
    } catch (e) { /* si algo falla, se queda la publica */ }
  };
})();
