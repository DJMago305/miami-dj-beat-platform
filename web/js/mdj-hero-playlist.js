/* Fondo en video (hero) de las páginas de servicio: lista de clips con PRECARGA del siguiente (PO 2026-10-08: «precarga el siguiente video en todas»).
 * Antes cada clip se cambiaba con v.src + v.load() cuando terminaba el anterior: entre uno y otro quedaba un instante sin imagen (y, antes, salía la foto de portada).
 * Ahora hay un segundo <video> oculto que va cargando el clip SIGUIENTE mientras suena el actual; al terminar el actual se muestra el que ya está listo (sin hueco)
 * y el que acaba de terminar pasa a precargar el que sigue. Si el siguiente aún no está listo, se cambia el clip como antes (nunca se queda congelado).
 * Cómo se activa: lo hacen solas las páginas con <video data-hero-playlist="clip1,clip2,…">.
 * SOLO precarga con conexión rápida (PO 2026-10-08): sin «ahorro de datos», conexión 4g y ≥ 5 Mbps cuando el navegador lo informa (Chrome/Android), y además solo
 * cuando el primer clip ya se puede ver completo sin cortes (evento «canplaythrough», que el navegador dispara según la velocidad real de descarga; sirve también en
 * Safari/iPhone, que no informa el tipo de conexión). Si la conexión no es rápida, la página sigue como antes: un clip a la vez, sin segundo video.
 * Este script toma el control de la lista: renombra el atributo a data-hero-playlist-js para que el script de cada página no cambie de clip por su lado. */
(function () {
  'use strict';
  function init() {
    var v = document.querySelector('video[data-hero-playlist]');
    if (!v) return;
    var attr = v.getAttribute('data-hero-playlist') || '';
    var list = attr.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (list.length < 2) return;
    function fast() {                                // ¿conexión rápida? (se vuelve a evaluar cada vez que se va a precargar)
      var c = navigator.connection;
      if (!c) return true;                           // el navegador no informa (Safari): decide el evento canplaythrough
      if (c.saveData) return false;
      if (c.effectiveType && c.effectiveType !== '4g') return false;
      if (typeof c.downlink === 'number' && c.downlink > 0 && c.downlink < 5) return false;
      return true;
    }

    v.setAttribute('data-hero-playlist-js', attr);
    v.removeAttribute('data-hero-playlist');

    var cur = v, nxt = null, idx = 0, swapping = false;
    var baseOpacity = v.style.opacity || '1';

    function url(i) {
      var u = list[((i % list.length) + list.length) % list.length];
      return typeof window.resolveMdAssetPublicUrl === 'function' ? window.resolveMdAssetPublicUrl(u) : u;
    }
    function quiet(p) { if (p && p.catch) p.catch(function () { /* el navegador puede rechazar el play; se reintenta en el siguiente evento */ }); }
    function guard(el) {                             // el video oculto nunca debe quedarse reproduciendo (los scripts de la página llaman play() sobre el original)
      el.addEventListener('play', function () { if (el !== cur) { try { el.pause(); } catch (e) { void e; } } });
    }
    function wire(el) {
      guard(el);
      el.addEventListener('ended', function () { if (el === cur) advance(); });
      el.addEventListener('error', function () { if (el === cur) advance(); });   // un clip roto se salta
    }
    function makeBuffer(i) {
      var b = document.createElement('video');
      b.className = v.className;
      b.style.cssText = v.style.cssText;
      b.style.opacity = '0';
      b.muted = true; b.defaultMuted = true; b.playsInline = true; b.loop = false; b.preload = 'auto';
      b.setAttribute('muted', ''); b.setAttribute('playsinline', ''); b.setAttribute('aria-hidden', 'true'); b.tabIndex = -1;
      wire(b);
      b.src = url(i);
      cur.parentNode.insertBefore(b, cur.nextSibling);
      try { b.load(); } catch (e) { void e; }
      return b;
    }
    function clearBuffer(el) {                       // conexión lenta: el video oculto no descarga nada
      try { el.pause(); } catch (e) { void e; }
      el.removeAttribute('src');
      try { el.load(); } catch (e) { void e; }
    }
    function warm() {                                // precarga el clip que sigue, solo si la conexión es rápida
      if (!fast()) { if (nxt) clearBuffer(nxt); return; }
      if (!nxt) nxt = makeBuffer(idx + 1); else retarget(nxt, idx + 1);
    }
    function retarget(el, i) {
      try { el.pause(); } catch (e) { void e; }
      el.removeAttribute('poster');
      el.preload = 'auto';
      el.src = url(i);
      try { el.load(); } catch (e) { void e; }
    }
    function fallback() {                            // el siguiente no estaba listo: se cambia el clip en el mismo elemento, como antes
      cur.removeAttribute('poster');
      cur.src = url(idx);
      try { cur.load(); } catch (e) { void e; }
      quiet(cur.play());
      cur.addEventListener('canplaythrough', function once() { cur.removeEventListener('canplaythrough', once); warm(); });
      swapping = false;
    }
    function advance() {
      if (swapping) return;
      swapping = true;
      idx = (idx + 1) % list.length;
      var show = nxt, old = cur;
      if (show && show.getAttribute('src') && show.readyState >= 2 && !show.error) {
        cur = show;                                  // antes del play(), para que el guard lo permita
        var onPlaying = function () {
          show.removeEventListener('playing', onPlaying);
          show.style.opacity = baseOpacity;
          old.style.opacity = '0';
          nxt = old;
          warm();                                    // el que terminó precarga el que sigue (si la conexión sigue siendo rápida)
          swapping = false;
        };
        show.addEventListener('playing', onPlaying);
        var p = show.play();
        if (p && p.catch) p.catch(function () { show.removeEventListener('playing', onPlaying); cur = old; fallback(); });
      } else {
        fallback();
      }
    }

    wire(v);
    v.addEventListener('playing', function () { v.removeAttribute('poster'); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) quiet(cur.play()); });

    var started = false;
    function startBuffer() { if (started) return; started = true; warm(); }   // primer clip ya sonando y descargado sin cortes: se empieza a precargar el segundo
    if (v.readyState >= 4) startBuffer(); else v.addEventListener('canplaythrough', startBuffer, { once: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
