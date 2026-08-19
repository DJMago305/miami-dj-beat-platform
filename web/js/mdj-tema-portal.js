/* ═══════════════════════════════════════════════════════════════════════════
   CONMUTADOR DÍA / NOCHE DE LA TIRA DEL PORTAL
   ---------------------------------------------------------------------------
   Solo cablea el botón que cierra la tira. NO define un tema nuevo: reutiliza
   el mismo atributo data-theme en <html> y la misma clave de almacenamiento que
   ya usa el resto de la plataforma, para que el modo elegido se respete al
   navegar entre páginas.

   Si la página ya trae su propio applyTheme() —staff.html lo tiene— se llama a
   ese y no se duplica la lógica: dos mecanismos escribiendo el mismo atributo
   acaban peleándose, y el usuario ve el tema parpadear.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var CLAVE = 'mdj-theme';

  function actual() {
    return document.documentElement.getAttribute('data-theme') === 'day' ? 'day' : 'night';
  }

  function pintarIcono() {
    /* Sol cuando está en noche (lo que vas a activar) y luna cuando está en
       día: el icono anuncia el destino, no el estado — es la convención que
       espera quien lo pulsa. */
    var sol = actual() === 'night';
    var botones = document.querySelectorAll('[data-mdj-tema-toggle]');
    for (var i = 0; i < botones.length; i++) botones[i].textContent = sol ? '☀️' : '🌙';
  }

  function alternar() {
    var destino = actual() === 'day' ? 'night' : 'day';
    if (typeof window.applyTheme === 'function') {
      window.applyTheme(destino, true);           // la página manda si ya sabe
    } else {
      document.documentElement.setAttribute('data-theme', destino);
      try { localStorage.setItem(CLAVE, destino); } catch (e) { void e; }
    }
    pintarIcono();
  }

  /* Delegado en document: la tira de staff.html se pinta por JS DESPUÉS de que
     corra este archivo, así que enganchar botón a botón se perdería los que aún
     no existen. */
  document.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest && ev.target.closest('[data-mdj-tema-toggle]');
    if (!b) return;
    ev.preventDefault();
    alternar();
  });

  pintarIcono();
  document.addEventListener('DOMContentLoaded', pintarIcono);
})();
