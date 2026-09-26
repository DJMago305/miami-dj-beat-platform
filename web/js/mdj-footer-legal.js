/* Enlace «Legal» en el pie de página — UN solo script para todo el sitio (PO 2026-09-26).
 * Los documentos legales (legal.html: Privacidad, Términos, Contrato DJ, Pro Partner, SMS) no tenían puerta pública:
 * solo el buscador del header y enlaces sueltos. El pie de página existe en 31 variantes distintas y en index.html está
 * marcado «LOCKED SECTION»; con orden expresa del PO se agrega el enlace en tiempo de ejecución, sin reescribir ninguna variante.
 * Se inserta al final del contenedor del pie, con el mismo estilo de los enlaces que ya tiene (color heredado, sin subrayado fijo). */
(function () {
  'use strict';
  function init() {
    document.querySelectorAll('footer.footer').forEach(function (f) {
      if (f.querySelector('.mdj-footer-legal')) return;
      var host = f.querySelector('.container') || f;
      var d = document.createElement('div');
      d.className = 'mdj-footer-legal';
      d.style.cssText = 'text-align:center;margin-top:10px;font-size:13px;';
      var a = document.createElement('a');
      a.href = '/legal.html';
      a.textContent = 'Legal';
      a.style.cssText = 'color:inherit;text-decoration:underline;text-underline-offset:3px;opacity:.85;';
      d.appendChild(a);
      host.appendChild(d);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
