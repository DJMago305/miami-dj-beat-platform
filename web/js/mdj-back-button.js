/* Botón «Regresar» de las páginas de servicio — UN solo script (PO 2026-09-21: las páginas no tenían forma de regresar).
 * Cada página declara su "padre" en <body data-mdj-back="./pagina.html">. El botón usa el historial si la persona viene de una página del sitio
 * (vuelve exactamente a donde estaba); si llegó directo (Google, enlace compartido) va a su padre. Sin JavaScript sigue siendo un enlace normal al padre.
 * PO 2026-09-21: SIN palabra; solo el ícono de regreso (corner-down-left, el que eligió) y al lado una casita a Inicio. Nombre accesible: clave i18n «btn-regresar» / «nav-home». Íconos Lucide. */
(function () {
  'use strict';
  function init() {
    var fb = document.body.getAttribute('data-mdj-back');
    var main = document.querySelector('main');
    if (!fb || !main || document.getElementById('mdj-back-row')) return;

    if (!document.getElementById('mdj-back-style')) {
      var st = document.createElement('style'); st.id = 'mdj-back-style';
      st.textContent =
        '#mdj-back-row{max-width:1200px;margin:0 auto 8px;padding:8px 0 0;text-align:left;position:relative;z-index:10;display:flex;gap:8px;align-items:center;}' +
        '.mdj-back-btn{display:inline-flex;align-items:center;justify-content:center;width:38px;height:34px;padding:0;border-radius:999px;border:1px solid rgba(197,160,89,.5);' +
        'background:rgba(0,0,0,.35);color:var(--gold,#c5a059);font:700 13px/1 inherit;letter-spacing:.04em;text-decoration:none;cursor:pointer;' +
        '-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);transition:background .15s,border-color .15s;}' +
        '.mdj-back-btn:hover,.mdj-back-btn:focus-visible{background:rgba(197,160,89,.18);border-color:rgba(197,160,89,.9);outline:none;}' +
        '@media (prefers-reduced-motion:reduce){.mdj-back-btn{transition:none;}}';
      document.head.appendChild(st);
    }
    var row = document.createElement('div'); row.id = 'mdj-back-row';
    var a = document.createElement('a'); a.className = 'mdj-back-btn'; a.href = fb;
    var SV = function (d) { return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
    var tr = function (k, f) { try { var v = window.i18n && window.i18n.t && window.i18n.t(k); return v && v !== k ? v : f; } catch (x) { return f; } };
    a.innerHTML = SV('<polyline points="9 10 4 15 9 20"></polyline><path d="M20 4v7a4 4 0 0 1-4 4H4"></path>');
    a.setAttribute('aria-label', tr('btn-regresar', 'Back')); a.title = a.getAttribute('aria-label');
    var h = document.createElement('a'); h.className = 'mdj-back-btn'; h.href = './index.html';
    h.innerHTML = SV('<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>');
    h.setAttribute('aria-label', tr('nav-home', 'Home')); h.title = h.getAttribute('aria-label');
    a.addEventListener('click', function (e) {
      var venimosDelSitio = false;
      try { venimosDelSitio = !!document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1; } catch (x) { void x; }
      if (venimosDelSitio) { e.preventDefault(); history.back(); }   // si no, sigue el enlace normal al padre
    });
    row.appendChild(a); row.appendChild(h);
    main.insertBefore(row, main.firstChild);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
