// web/js/mdj-push.js
// Pide permiso al cliente y registra su dispositivo para recibir avisos.
//
// POR QUE EXISTE: el SMS de la plataforma lleva bloqueado desde marzo por las
// operadoras de EE.UU. (error 30032). Esto no pasa por operadoras, no cuesta
// nada por mensaje y no depende de ningun tramite.
//
// LO QUE NO HACE: llegar a un desconocido. El push exige que la persona haya
// dicho que si primero. Para el primer contacto sigue haciendo falta SMS.
(function () {
  "use strict";

  // La clave PUBLICA de VAPID. Va en la pagina a proposito: identifica al
  // remitente y esta pensada para ser publica. La privada vive en el servidor
  // y nunca baja al navegador.
  var VAPID_PUBLICA = window.MDJ_VAPID_PUBLIC || "";

  var FN = "https://hkuvuqupbxwkiykxvqdr.supabase.co/functions/v1/mdj-push-suscribir";

  function b64ToU8(base64) {
    var s = (base64 + "=".repeat((4 - base64.length % 4) % 4))
      .replace(/-/g, "+").replace(/_/g, "/");
    var raw = atob(s);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  // iOS es el caso raro: hasta 16.4 no habia push en web, y AUN HOY solo
  // funciona si el cliente anadio el sitio a la pantalla de inicio. Si no se
  // detecta esto, el boton falla sin explicacion y parece un bug nuestro.
  function esIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }
  function enPantallaDeInicio() {
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
  }

  // Estos textos los lee el CLIENTE, no un tecnico. La plataforma es ES/EN y
  // un cliente en ingles con un iPhone estaba leyendo instrucciones en espanol.
  function t(clave, respaldo) {
    try {
      if (window.i18n && typeof window.i18n.t === "function") {
        var v = window.i18n.t(clave);
        if (v && v !== clave) return v;
      }
    } catch (_) {}
    return respaldo;
  }

  function porQueNoSePuede() {
    if (!("serviceWorker" in navigator)) return t("push-sin-soporte", "Este navegador no admite avisos.");
    if (!("PushManager" in window)) {
      if (esIOS()) return t("push-ios-viejo", "En iPhone hace falta iOS 16.4 o mas nuevo.");
      return t("push-sin-soporte", "Este navegador no admite avisos.");
    }
    if (esIOS() && !enPantallaDeInicio()) {
      return t("push-ios-pantalla-inicio", "En iPhone: toca Compartir y luego \u00ABAnadir a pantalla de inicio\u00BB. Desde ahi ya puedes activar los avisos.");
    }
    if (!VAPID_PUBLICA) return t("push-sin-clave", "Los avisos no estan configurados todavia.");
    if (Notification.permission === "denied") {
      return t("push-bloqueado", "Bloqueaste los avisos para este sitio. Hay que reactivarlos en los ajustes del navegador.");
    }
    return null;
  }

  async function activar(tokenDeSesion) {
    var impedimento = porQueNoSePuede();
    if (impedimento) return { ok: false, motivo: impedimento };

    var permiso = await Notification.requestPermission();
    if (permiso !== "granted") return { ok: false, motivo: t("push-sin-permiso", "No diste permiso para recibir avisos.") };

    var reg = await navigator.serviceWorker.register("/sw-push.js", { scope: "/" });
    await navigator.serviceWorker.ready;

    // Si ya estaba suscrito se reutiliza el buzon; volver a crearlo generaria
    // un endpoint nuevo y el cliente acabaria recibiendo cada aviso dos veces.
    var sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,               // obligatorio: nada de push silencioso
        applicationServerKey: b64ToU8(VAPID_PUBLICA),
      });
    }

    var j = sub.toJSON();
    var r = await fetch(FN, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tokenDeSesion },
      body: JSON.stringify({
        endpoint: j.endpoint,
        p256dh: j.keys && j.keys.p256dh,
        auth: j.keys && j.keys.auth,
        agente: navigator.userAgent.slice(0, 200),
      }),
    });
    if (!r.ok) return { ok: false, motivo: t("push-no-guardado", "No se pudo registrar este dispositivo.") + " (" + r.status + ")" };
    return { ok: true };
  }

  async function desactivar() {
    var reg = await navigator.serviceWorker.getRegistration("/sw-push.js");
    if (!reg) return { ok: true };
    var sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    return { ok: true };
  }

  async function estaActivo() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    var reg = await navigator.serviceWorker.getRegistration("/sw-push.js");
    if (!reg) return false;
    return !!(await reg.pushManager.getSubscription());
  }

  window.MDJPush = {
    activar: activar,
    desactivar: desactivar,
    estaActivo: estaActivo,
    porQueNoSePuede: porQueNoSePuede,
  };
})();
