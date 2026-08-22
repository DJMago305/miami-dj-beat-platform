/**
 * Ejecutar en <head> (sin defer) para que los estilos .mdj-compat-* apliquen en el primer paint.
 * mdjb-shared-header.js repite la misma lógica al cargar (idempotente: solo añade clases).
 */
(function () {
  try {
    var html = document.documentElement;
    if (html.getAttribute('data-mdj-compat-boot') === '1') return;
    html.setAttribute('data-mdj-compat-boot', '1');
    var ua = typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent : '';
    var isSafari = /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Android/.test(ua);
    var vm = /Version\/(\d+)/.exec(ua);
    if (isSafari && vm) {
      var sv = parseInt(vm[1], 10);
      if (!isNaN(sv) && sv < 17) html.classList.add('mdj-compat-oldsafari');
    }
    var hc = typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : 0;
    if (hc > 0 && hc <= 4) html.classList.add('mdj-compat-lowcpu');
    if (typeof CSS === 'undefined' || !CSS.supports || !CSS.supports('aspect-ratio', '1 / 1')) {
      html.classList.add('mdj-compat-no-aspect');
    }
  } catch (e) {
    void e;
  }
})();
