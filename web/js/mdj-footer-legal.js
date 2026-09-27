/* Franja legal del pie de página — UN solo script para todo el sitio (PO 2026-09-26).
 * Los documentos legales (legal.html: Privacidad, Términos, Contrato DJ, Pro Partner, SMS) no tenían puerta pública.
 * El pie existe en 31 variantes y en index.html está marcado «LOCKED SECTION»; con orden expresa del PO se agrega en
 * tiempo de ejecución, sin reescribir ninguna variante. Patrón de Apple / Airbnb: los enlaces legales van en la MISMA línea
 * del copyright, separados por puntos: «© 2026 … · Privacy Policy · Terms · SMS Terms · Legal». «Legal» abre el índice completo
 * (donde también están el Contrato DJ y la Política Pro Partner, que dependen del rol). Bilingüe: sigue el idioma del sitio. */
(function () {
  'use strict';
  var LINKS = [
    { href: '/legal.html?doc=PRIVACY_POLICY.md', en: 'Privacy Policy', es: 'Privacidad' },
    { href: '/legal.html?doc=CLIENT_TERMS.md', en: 'Terms', es: 'Términos' },
    { href: '/legal.html?doc=SMS_TERMS.md', en: 'SMS Terms', es: 'Términos de SMS' },
    { href: '/legal.html', en: 'Legal', es: 'Legal' }
  ];

  // Misma preferencia que usa i18n.js (localStorage «mdjpro_lang», por defecto inglés): <html lang> puede estar sin corregir al cargar.
  function lang() {
    var v = null;
    try { v = localStorage.getItem('mdjpro_lang'); } catch (e) { /* sin almacenamiento */ }
    return String(v || 'en').toLowerCase().indexOf('es') === 0 ? 'es' : 'en';
  }

  // Elemento que contiene la línea del copyright (el más profundo que tenga «©» en su propio texto).
  function copyrightHost(footer) {
    var w = document.createTreeWalker(footer, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = w.nextNode())) {
      if (n.nodeValue.indexOf('©') !== -1 && n.parentElement) return n.parentElement;
    }
    return null;
  }

  function fill(box) {
    var l = lang();
    box.textContent = '';
    LINKS.forEach(function (it, i) {
      if (i > 0 || !box.dataset.solo) {
        var sep = document.createElement('span');
        sep.textContent = ' · ';
        sep.setAttribute('aria-hidden', 'true');
        box.appendChild(sep);
      }
      var a = document.createElement('a');
      a.href = it.href;
      a.textContent = it[l];
      a.style.cssText = 'color:inherit;text-decoration:none;opacity:.85;white-space:nowrap;';
      a.addEventListener('mouseenter', function () { a.style.textDecoration = 'underline'; a.style.opacity = '1'; });
      a.addEventListener('mouseleave', function () { a.style.textDecoration = 'none'; a.style.opacity = '.85'; });
      box.appendChild(a);
    });
  }

  function inject(f) {
    if (f.querySelector('.mdj-footer-legal')) return;
    var box = document.createElement('span');
    box.className = 'mdj-footer-legal';
    var host = copyrightHost(f);
    if (host) {
      host.appendChild(box);          // misma línea del copyright
    } else {                          // pie sin línea de copyright: franja propia centrada
      box.dataset.solo = '1';
      box.style.cssText = 'display:block;text-align:center;margin-top:10px;font-size:13px;';
      (f.querySelector('.container') || f).appendChild(box);
    }
    fill(box);
  }

  function injectAll() {
    document.querySelectorAll('footer.footer').forEach(inject);
  }

  function init() {
    injectAll();
    // Otros scripts (i18n.js con innerHTML, pies que se reconstruyen) pueden borrar o reemplazar el pie: se vuelve a poner
    // la franja si desaparece. Se vigila el body un rato tras cargar la página (un solo chequeo cada 50 ms como máximo).
    var pend = false;
    var obs = new MutationObserver(function () {
      if (pend) return;
      pend = true;
      setTimeout(function () { pend = false; injectAll(); }, 50);   // setTimeout y no requestAnimationFrame: este se pausa en pestañas en segundo plano
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { obs.disconnect(); }, 15000);
  }

  function relabel() {
    document.querySelectorAll('.mdj-footer-legal').forEach(fill);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  document.addEventListener('languageChanged', function () { setTimeout(function () { injectAll(); relabel(); }, 60); });
})();
