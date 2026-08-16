/* ══════════════════════════════════════════════════════════════════════════
   MDJ REFERRAL TRACKING — ecosistema "todo enlazado" (PO 2026-08-16)
   Capta y PERSISTE el origen del visitante en vistas públicas NUEVAS (p.ej. profile.html),
   ALINEADO al sistema NATIVO ya existente (index.html / login.html / dj-profile.html).
   Contrato: ?ref=<user_id del referidor>  (igual que index.html: "?ref=DJ_UUID").
   Llave SSOT: localStorage['mdb_referral_dj_id'] — la MISMA que leen auth.js + monetization.js.
   Regla de atribución (decisión PO): ÚLTIMO-TOQUE pre-registro — el último ref recibido antes
   del signup gana (sobrescribe). Al registrarse, auth.js sella source_ref (queda inmutable).
   Cookie espejo (90d) SOLO para durabilidad. Autocontenido, sin dependencias, sin backend.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  var LS_KEY = 'mdb_referral_dj_id';   // llave NATIVA (SSOT del ecosistema)
  var CK_KEY = 'mdj_ref';              // cookie espejo (durabilidad 90d)
  var DAYS = 90;

  function setCookie(v) {
    try {
      var d = new Date();
      d.setTime(d.getTime() + DAYS * 864e5);
      document.cookie = CK_KEY + '=' + encodeURIComponent(v) +
        ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
    } catch (e) {}
  }
  function getCookie() {
    try {
      var m = document.cookie.match(new RegExp('(?:^|; )' + CK_KEY + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : '';
    } catch (e) { return ''; }
  }

  /* ── Captura: ?ref= o ?ref_id= (de un QR o link del ecosistema) ── */
  try {
    var qp = new URLSearchParams(location.search);
    var ref = (qp.get('ref') || qp.get('ref_id') || '').trim();
    if (ref) {
      ref = ref.slice(0, 64); // tope defensivo
      // ÚLTIMO-TOQUE: sobrescribe la llave nativa (mismo comportamiento que index.html/login.html).
      try { localStorage.setItem(LS_KEY, ref); } catch (e) {}
      setCookie(ref);
    }
  } catch (e) {}

  /* ── API pública ── */
  // Leer el ref persistido (para propagar a Entrar/Crear Cuenta; auth.js ya lee la llave nativa).
  window.mdjGetRef = function () {
    try { var v = localStorage.getItem(LS_KEY); if (v && String(v).trim()) return String(v).trim(); } catch (e) {}
    return getCookie() || '';
  };
  // Propagar el ref a un href (Entrar/Crear Cuenta y links del ecosistema).
  window.mdjAppendRef = function (url) {
    try {
      var r = window.mdjGetRef();
      if (!r) return url;
      return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'ref=' + encodeURIComponent(r);
    } catch (e) { return url; }
  };
})();
