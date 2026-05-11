/**
 * Fuerza todos los <video> del sitio a ir mudos (muted + volume 0), para no mezclar con la música ambiental.
 * Excepción opt-in: video[data-mdj-allow-audio="1"] (no usar salvo caso muy concreto).
 *
 * Cubre vídeos añadidos después por JS (MutationObserver). Desactivar: window.MDJ_SKIP_FORCE_MUTE_VIDEOS = true
 * antes de cargar mdj-shared-header, o data-mdj-no-force-mute-videos="1" en <html>.
 */
(function () {
  'use strict';

  if (window.__MDJ_FORCE_MUTE_VIDEOS_BOOTED) return;
  window.__MDJ_FORCE_MUTE_VIDEOS_BOOTED = true;

  if (typeof window !== 'undefined' && window.MDJ_SKIP_FORCE_MUTE_VIDEOS) return;
  try {
    if (document.documentElement && document.documentElement.getAttribute('data-mdj-no-force-mute-videos') === '1') {
      return;
    }
  } catch (e) {
    void e;
  }

  function allowAudio(el) {
    try {
      return el && el.getAttribute && el.getAttribute('data-mdj-allow-audio') === '1';
    } catch (e) {
      return false;
    }
  }

  function silence(el) {
    if (!el || el.nodeType !== 1 || el.nodeName !== 'VIDEO' || allowAudio(el)) return;
    try {
      el.muted = true;
      el.defaultMuted = true;
      el.volume = 0;
      el.setAttribute('muted', '');
    } catch (e) {
      void e;
    }
  }

  function scanUnder(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('video').forEach(silence);
  }

  function boot() {
    scanUnder(document);
    var root = document.body;
    if (!root) return;
    var mo = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        m.addedNodes &&
          m.addedNodes.forEach(function (n) {
            if (n.nodeType !== 1) return;
            if (n.nodeName === 'VIDEO') silence(n);
            scanUnder(n);
          });
      });
    });
    mo.observe(root, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
