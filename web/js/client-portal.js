/**
 * Canonical portal logic lives in /web/client-portal.js (single bundle).
 * If your HTML mistakenly points here, load the real file once.
 */
(function () {
    if (typeof window.PortalApp !== 'undefined') return;
    var s = document.createElement('script');
    s.src = '../client-portal.js?v=20260417-guest-emergency';
    s.async = false;
    (document.head || document.documentElement).appendChild(s);
})();
