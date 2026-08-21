// web/js/mdj-push-cliente.js
// Engancha el interruptor "Avisos en este dispositivo" de la cuenta del cliente.
//
// POR QUE ESTA SEPARADO de client-account.js: los otros tres interruptores de
// esa tarjeta son PREFERENCIAS -- se marcan y se guardan con el boton. Este no.
// El permiso lo concede el navegador, no nuestra base, y vale para ESTE equipo:
// el mismo cliente en el movil y en el portatil son dos permisos distintos.
// Mezclarlo con el guardado normal haria creer que se guardo algo que en
// realidad depende de una ventana del sistema que el cliente puede rechazar.
(function () {
  "use strict";

  var casilla, pista;

  // Mismo ayudante que usa client-account.js. La pagina es ES/EN.
  function t(clave, respaldo) {
    try {
      if (window.i18n && typeof window.i18n.t === "function") {
        var v = window.i18n.t(clave);
        if (v && v !== clave) return v;
      }
    } catch (_) {}
    return respaldo;
  }

  function decir(txt, tono) {
    if (!pista) return;
    pista.textContent = txt || "";
    // Se reutilizan los colores que la pagina ya usa; no se inventa paleta.
    pista.style.color = tono === "mal" ? "#ff8080"
                      : tono === "ok"  ? "rgba(197,160,89,0.95)"
                      : "rgba(255,255,255,0.45)";
  }

  async function token() {
    var supa = (typeof window.getSupabaseClient === "function") ? window.getSupabaseClient() : null;
    if (!supa) return null;
    var s = (await supa.auth.getSession()).data.session;
    return s ? s.access_token : null;
  }

  async function pintar() {
    if (!window.MDJPush) { decir(t("push-sin-soporte", "Este navegador no admite avisos.")); return; }

    // Si el equipo no puede recibirlos, se dice POR QUE y se deja el
    // interruptor apagado y desactivado. Un interruptor que se puede mover
    // pero no hace nada es peor que no tenerlo.
    var impedimento = window.MDJPush.porQueNoSePuede();
    if (impedimento) {
      casilla.checked = false;
      casilla.disabled = true;
      decir(impedimento);
      return;
    }

    casilla.disabled = false;
    var activo = await window.MDJPush.estaActivo();
    casilla.checked = activo;
    decir(activo
      ? t("account-pref-push-on", "Activados en este equipo. Te avisaremos de tu evento aunque no tengas la web abierta.")
      : t("account-pref-push-off", "Recibe la confirmacion de tu evento al instante, sin depender del SMS."),
      activo ? "ok" : null);
  }

  async function alCambiar() {
    var quiere = casilla.checked;
    casilla.disabled = true;

    try {
      if (quiere) {
        var tok = await token();
        if (!tok) { casilla.checked = false; decir(t("push-necesita-sesion", "Vuelve a iniciar sesion para activar los avisos."), "mal"); return; }
        var r = await window.MDJPush.activar(tok);
        if (!r.ok) {
          // Se devuelve el interruptor a su sitio: dejarlo marcado cuando la
          // activacion fallo es prometer avisos que no van a llegar.
          casilla.checked = false;
          decir(r.motivo, "mal");
          return;
        }
      } else {
        await window.MDJPush.desactivar();
      }
    } catch (e) {
      casilla.checked = !quiere;
      decir("No se pudo cambiar: " + ((e && e.message) || e), "mal");
      return;
    } finally {
      casilla.disabled = false;
    }
    await pintar();
  }

  function arrancar() {
    casilla = document.getElementById("ca-notify-push");
    pista = document.getElementById("ca-push-hint");
    if (!casilla) return;              // no estamos en esa pagina
    casilla.addEventListener("change", alCambiar);
    pintar();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", arrancar);
  } else { arrancar(); }
})();
