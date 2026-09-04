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

  // sub.unsubscribe()/subscribe() a veces se quedan colgados sin resolver ni
  // rechazar (visto en el reporte real: el switch nunca se apagaba en vivo,
  // pero SI aparecia apagado al recargar -- la accion real si funciono, la
  // promesa de esta pestana nunca aviso). Con limite de tiempo, la interfaz
  // ya no se queda esperando para siempre: si se agota, se confia en la
  // intencion del cliente y se avisa que puede tardar en confirmarse.
  function conLimite(promesa, ms) {
    return new Promise(function (resolve) {
      var yaResolvio = false;
      var venceTimeout = setTimeout(function () {
        if (yaResolvio) return;
        yaResolvio = true;
        resolve({ __agotado: true });
      }, ms);
      promesa.then(
        function (r) { if (yaResolvio) return; yaResolvio = true; clearTimeout(venceTimeout); resolve(r); },
        function (e) { if (yaResolvio) return; yaResolvio = true; clearTimeout(venceTimeout); resolve({ __error: e }); }
      );
    });
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
        var r = await conLimite(window.MDJPush.activar(tok), 7000);
        if (r && r.__agotado) {
          // Se agoto el tiempo sin que el navegador confirme ni falle. Se
          // deja prendido (es lo que el cliente pidio) con un aviso, en vez
          // de trancar la interfaz esperando para siempre.
          casilla.checked = true;
          decir(t("push-tardando", "Esto puede tardar unos segundos en confirmarse. Si no llegan avisos, vuelve a intentarlo."), null);
          return;
        }
        if (r && r.__error) { casilla.checked = false; decir("No se pudo activar: " + ((r.__error && r.__error.message) || r.__error), "mal"); return; }
        if (!r.ok) {
          // Se devuelve el interruptor a su sitio: dejarlo marcado cuando la
          // activacion fallo es prometer avisos que no van a llegar.
          casilla.checked = false;
          decir(r.motivo, "mal");
          return;
        }
        // Se marca EXPLICITO segun lo que acaba de pasar -- no se vuelve a
        // preguntar al navegador "esta activo?" para redibujar. getSubscription()
        // justo despues de subscribe()/unsubscribe() puede devolver un estado
        // todavia no asentado en algunos navegadores; confiar en que la promesa
        // resolvio sin error ya dice que la accion funciono.
        casilla.checked = true;
        decir(t("account-pref-push-on", "Activados en este equipo. Te avisaremos de tu evento aunque no tengas la web abierta."), "ok");
      } else {
        var r2 = await conLimite(window.MDJPush.desactivar(), 7000);
        // Apagar siempre se refleja de inmediato: si sub.unsubscribe() se
        // queda colgado, no hay razon para creer que sigue activo -- el
        // reporte real confirmo que al recargar SI quedaba apagado.
        casilla.checked = false;
        if (r2 && r2.__agotado) {
          decir(t("push-tardando-off", "Puede tardar unos segundos en confirmarse del todo."), null);
        } else if (r2 && r2.__error) {
          decir("No se pudo confirmar el apagado: " + ((r2.__error && r2.__error.message) || r2.__error), "mal");
        } else {
          decir(t("account-pref-push-off", "Recibe la confirmacion de tu evento al instante, sin depender del SMS."), null);
        }
      }
    } catch (e) {
      casilla.checked = !quiere;
      decir("No se pudo cambiar: " + ((e && e.message) || e), "mal");
    } finally {
      casilla.disabled = false;
    }
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
