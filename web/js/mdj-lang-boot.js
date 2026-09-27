/* Arranque de idioma — se carga en el <head> de cada página con selector ES/EN (PO 2026-09-27: «tiene que cambiar desde arriba en la perilla ES/EN»).
 * El idioma lo manda SOLO la perilla del header (guardado en localStorage «mdjpro_lang», por defecto inglés; sin detección del navegador).
 * Problema que resuelve: cada página trae su texto original en un idioma y i18n.js lo cambia al terminar de cargar (el diccionario pesa
 * ~650 KB), así que quien tenía guardado otro idioma veía primero la página en el idioma equivocado y luego un salto.
 * Aquí: (1) se lee el idioma con el que está escrita la página (el atributo lang del HTML, que ahora dice la verdad) y el guardado;
 * (2) <html lang> queda en el idioma guardado antes de pintar; (3) SOLO si no coinciden se oculta el body hasta que i18n.js termine de
 * traducir (i18n.js quita la clase mdj-i18n-pending); si coinciden no se oculta nada, así no se retrasa el primer pintado.
 * Salvavidas: a los 2,5 s se muestra igual, pase lo que pase. */
(function () {
  'use strict';
  try {
    var h = document.documentElement;
    var inline = String(h.getAttribute('lang') || 'en').toLowerCase().indexOf('es') === 0 ? 'es' : 'en';
    var stored = 'en';
    try { stored = String(localStorage.getItem('mdjpro_lang') || 'en').toLowerCase().indexOf('es') === 0 ? 'es' : 'en'; } catch (e) { /* sin almacenamiento: inglés */ }
    h.setAttribute('data-mdj-inline-lang', inline);
    h.setAttribute('lang', stored);
    if (stored !== inline) {
      h.classList.add('mdj-i18n-pending');
      var st = document.createElement('style');
      st.textContent = 'html.mdj-i18n-pending body{visibility:hidden!important}';
      (document.head || h).appendChild(st);
      setTimeout(function () { h.classList.remove('mdj-i18n-pending'); }, 2500);
    }
  } catch (e) { /* nunca romper la página */ }
})();
