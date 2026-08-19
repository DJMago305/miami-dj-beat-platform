/* ═══════════════════════════════════════════════════════════════════════════
   TIRA DE NAVEGACIÓN EXCLUSIVA DEL PORTAL OWNER/STAFF
   ---------------------------------------------------------------------------
   POR QUÉ ESTO ES UN SCRIPT Y NO MARCADO. Se intentó por CSS y falló, y se
   intentó como HTML pegado tras <body> y también falló. Las causas, medidas y
   no supuestas:

     · #mainNav lo gobierna mdj-shared-header.js, que BARRE los nodos que no
       reconoce. Cualquier cosa inyectada ahí acaba borrada.
     · En estas páginas el contexto de artista (body.mdj-from-profile) deja
       #mainNav en display:none, y #owner-tabs también quedaba oculto: las dos
       navegaciones candidatas estaban apagadas a la vez.
     · staff.html y admin-dashboard.html ejecutan document.write, que ARRASA el
       documento entero. El marcado escrito antes en el HTML no sobrevive.

   Un script que corre al final y que además REPONE la tira si desaparece es lo
   único que aguanta las tres cosas. Los estilos van EN LÍNEA a propósito:
   ninguna hoja compartida puede pisarlos, que era el otro modo de fallo.

   No toca #mainNav ni #owner-tabs. No oculta nada de nadie. Solo añade.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var ID = 'mdj-owner-strip';

  /* Destinos: los tres que el PO autorizó cambiar (CONFIG, MI PERFIL, MRM IA)
     más los originales intactos del resto. No se inventa ningún enrutado. */
  var ENLACES = [
    ['ACADEMIA',  './academia.html?mdj_nav=profile'],
    ['AGENDA',    './dj-dashboard.html?mdj_nav=profile'],
    ['⚙ CONFIG', './staff-config.html'],
    ['DJ TOOLS',  './dj-tools.html?mdj_nav=profile'],
    ['CASH FLOW', './dj-dashboard.html?tab=flow&mdj_nav=profile'],
    ['MI PERFIL', './account-settings.html'],
    ['STAFF',     './admin-dashboard.html'],
    ['FÉNIX AI', './elixis-console.html']
  ];

  var ESTILO_ENLACE =
    'display:inline-block;padding:10px 13px;color:#f4f6fb;text-decoration:none;' +
    'font:600 12px/1 Inter,system-ui,-apple-system,sans-serif;letter-spacing:.11em;' +
    'white-space:nowrap;';

  var ESTILO_MRM =
    'display:inline-block;padding:9px 15px;margin-left:8px;color:#73d9ff;' +
    'text-decoration:none;font:800 12px/1 Inter,system-ui,-apple-system,sans-serif;' +
    'letter-spacing:.11em;white-space:nowrap;border:1px solid rgba(115,217,255,.5);' +
    'border-radius:999px;';

  var ESTILO_BARRA =
    'display:block!important;visibility:visible!important;opacity:1!important;' +
    'position:relative;z-index:99999;width:100%;box-sizing:border-box;' +
    'background:#0a0f1d;border-bottom:1px solid rgba(197,160,89,.35);' +
    'padding:6px clamp(10px,2vw,28px);text-align:left;overflow-x:auto;' +
    'white-space:nowrap;';

  function construir() {
    var nav = document.createElement('nav');
    nav.id = ID;
    nav.setAttribute('aria-label', 'Navegación del portal Staff/Owner');
    nav.setAttribute('style', ESTILO_BARRA);

    var aqui = (location.pathname.split('/').pop() || '').toLowerCase();

    for (var i = 0; i < ENLACES.length; i++) {
      var a = document.createElement('a');
      a.href = ENLACES[i][1];
      a.textContent = ENLACES[i][0];
      var st = ESTILO_ENLACE;
      /* La pestaña de la página actual se marca en dorado. Se compara solo el
         nombre de archivo: los parámetros de consulta cambian y compararlos
         enteros haría que nunca coincidiera nada. */
      var destino = ENLACES[i][1].split('?')[0].replace('./', '').toLowerCase();
      if (destino && destino === aqui) st += 'color:#c5a059;';
      a.setAttribute('style', st);
      nav.appendChild(a);
    }

    var mrm = document.createElement('a');
    mrm.href = './neural-matrix-3d.html';
    mrm.textContent = 'MRM IA ☀️';
    mrm.setAttribute('style', ESTILO_MRM);
    nav.appendChild(mrm);

    return nav;
  }

  function poner() {
    if (!document.body) return;
    if (document.getElementById(ID)) return;
    document.body.insertBefore(construir(), document.body.firstChild);
  }

  poner();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', poner);
  }
  window.addEventListener('load', poner);

  /* REPOSICIÓN. document.write y los reescritores de body borran el documento
     entero; el gate de autenticación puede repintar al resolverse la sesión.
     Se comprueba durante los primeros 15 segundos —que es cuando ocurre todo
     eso— y luego se deja de mirar: un intervalo eterno sería una fuga. */
  var intentos = 0;
  var reloj = setInterval(function () {
    poner();
    if (++intentos >= 30) clearInterval(reloj);
  }, 500);
})();
