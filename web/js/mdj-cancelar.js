// web/js/mdj-cancelar.js
// Diálogo COMPARTIDO de cancelación con MOTIVO OBLIGATORIO: «Cancelar / no puedo asistir» (DJ/artista) y «Cancelar mi evento» (cliente).
// No cancela por su cuenta ni se quita solo de la agenda: registra una solicitud
// (RPC solicitar_cancelacion) y el staff recibe una alerta URGENTE. El staff decide.
(function () {
  "use strict";

  var MOTIVOS = [
    ["emergencia_salud", "Emergencia o salud"],
    ["conflicto_agenda", "Conflicto de agenda"],
    ["cliente_pidio", "El cliente pidió cancelar"],
    ["pago_o_lugar", "Problema con el pago o el lugar"],
    ["otro", "Otro"]
  ];
  var MIN = 10;

  function supa() {
    return (typeof window.getSupabaseClient === "function") ? window.getSupabaseClient() : null;
  }

  function mensajeDeError(r) {
    var e = r && r.error;
    if (e === "motivo_obligatorio") return "Explica el motivo (mínimo " + MIN + " caracteres).";
    if (e === "forbidden") return "No tienes permiso para pedir la cancelación de este evento.";
    if (e === "evento_ya_cerrado") return "Este evento ya está cerrado.";
    if (e === "no_session") return "Vuelve a iniciar sesión para continuar.";
    return "No se pudo enviar la solicitud. Inténtalo de nuevo o llama al equipo.";
  }

  // opciones: { leadId, residencyId, fecha, titulo }  → devuelve Promise<boolean> (true = solicitud enviada)
  window.MDJCancelarEvento = function (leadId, titulo, opciones) {
    opciones = opciones || {};
    return new Promise(function (resolve) {
      var fondo = document.createElement("div");
      fondo.setAttribute("role", "dialog");
      fondo.setAttribute("aria-modal", "true");
      fondo.style.cssText = "position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;padding:16px;";
      var caja = document.createElement("div");
      caja.style.cssText = "max-width:440px;width:100%;max-height:92vh;overflow:auto;background:#121212;border:1px solid rgba(197,160,89,0.5);border-radius:14px;padding:22px;color:#fff;font-family:inherit;";

      var h = document.createElement("div");
      h.style.cssText = "font-size:17px;font-weight:900;margin-bottom:4px;";
      h.textContent = opciones.titulo || "Cancelar / no puedo asistir";
      var ev = document.createElement("div");
      ev.style.cssText = "font-size:13px;color:#c5a059;font-weight:700;margin-bottom:12px;";
      ev.textContent = titulo || "Evento";
      var aviso = document.createElement("div");
      aviso.style.cssText = "font-size:12px;line-height:1.5;color:rgba(255,255,255,0.7);background:rgba(255,255,255,0.05);border-radius:8px;padding:10px 12px;margin-bottom:14px;";
      aviso.textContent = opciones.aviso || "Esto NO cancela el evento del cliente. El equipo recibe una alerta urgente y lo revisa de inmediato. Hasta que te confirmemos, sigues asignado a este evento.";

      var l1 = document.createElement("label");
      l1.style.cssText = "display:block;font-size:11px;font-weight:800;letter-spacing:.06em;color:rgba(255,255,255,0.55);margin-bottom:5px;";
      l1.textContent = "MOTIVO";
      var sel = document.createElement("select");
      sel.style.cssText = "width:100%;padding:10px;border-radius:8px;background:#1b1b1b;color:#fff;border:1px solid rgba(255,255,255,0.2);font-size:14px;margin-bottom:12px;";
      MOTIVOS.forEach(function (m) {
        var o = document.createElement("option"); o.value = m[0]; o.textContent = (opciones.etiquetas && opciones.etiquetas[m[0]]) || m[1]; sel.appendChild(o);
      });
      var l2 = document.createElement("label");
      l2.style.cssText = l1.style.cssText;
      l2.textContent = "EXPLICA QUÉ PASÓ (OBLIGATORIO)";
      var ta = document.createElement("textarea");
      ta.rows = 4;
      ta.placeholder = "Cuéntale al equipo qué pasó y si hay algo que puedan hacer para resolverlo.";
      ta.style.cssText = "width:100%;box-sizing:border-box;padding:10px;border-radius:8px;background:#1b1b1b;color:#fff;border:1px solid rgba(255,255,255,0.2);font-size:14px;font-family:inherit;resize:vertical;";
      var cont = document.createElement("div");
      cont.style.cssText = "font-size:11px;color:rgba(255,255,255,0.45);margin:4px 0 10px;text-align:right;";
      var err = document.createElement("div");
      err.style.cssText = "font-size:12px;color:#ff8080;min-height:16px;margin-bottom:8px;";

      var fila = document.createElement("div");
      fila.style.cssText = "display:flex;gap:10px;justify-content:flex-end;";
      function boton(etq, estilo) {
        var b = document.createElement("button");
        b.type = "button"; b.textContent = etq;
        b.style.cssText = "padding:10px 16px;border-radius:8px;font-size:13px;font-weight:800;cursor:pointer;" + estilo;
        return b;
      }
      var bNo = boton("Volver", "background:transparent;border:1px solid rgba(255,255,255,0.25);color:#fff;");
      var bSi = boton("Enviar solicitud", "background:rgba(220,60,60,0.85);border:1px solid rgba(220,60,60,0.9);color:#fff;");
      fila.appendChild(bNo); fila.appendChild(bSi);

      [h, ev, aviso, l1, sel, l2, ta, cont, err, fila].forEach(function (n) { caja.appendChild(n); });
      fondo.appendChild(caja);

      function cuenta() {
        var n = ta.value.trim().length;
        cont.textContent = n < MIN ? (n + " / mínimo " + MIN) : (n + " caracteres");
        bSi.style.opacity = n < MIN ? "0.5" : "1";
      }
      ta.addEventListener("input", cuenta);
      cuenta();

      function cerrar(v) {
        document.removeEventListener("keydown", tecla);
        fondo.remove();
        resolve(v);
      }
      function tecla(e) { if (e.key === "Escape") cerrar(false); }
      bNo.addEventListener("click", function () { cerrar(false); });
      fondo.addEventListener("click", function (e) { if (e.target === fondo) cerrar(false); });

      bSi.addEventListener("click", async function () {
        err.textContent = "";
        if (ta.value.trim().length < MIN) { err.textContent = "Explica el motivo (mínimo " + MIN + " caracteres)."; ta.focus(); return; }
        var s = supa();
        if (!s) { err.textContent = "Sin conexión. Inténtalo de nuevo."; return; }
        bSi.disabled = true; bNo.disabled = true; bSi.textContent = "Enviando…";
        try {
          var r = await s.rpc("solicitar_cancelacion", {
            p_lead: leadId || null,
            p_residency: opciones.residencyId || null,
            p_fecha: opciones.fecha || null,
            p_categoria: sel.value,
            p_detalle: ta.value.trim()
          });
          if (r.error) throw r.error;
          var d = r.data || {};
          if (!d.ok) { err.textContent = mensajeDeError(d); bSi.disabled = false; bNo.disabled = false; bSi.textContent = "Enviar solicitud"; return; }
          // Confirmación dentro del mismo diálogo
          caja.innerHTML = "";
          var ok = document.createElement("div");
          ok.style.cssText = "text-align:center;padding:8px 4px;";
          ok.innerHTML = '<div style="font-size:34px;margin-bottom:8px;">📨</div>' +
            '<div style="font-size:16px;font-weight:900;margin-bottom:8px;"></div>' +
            '<div style="font-size:13px;line-height:1.5;color:rgba(255,255,255,0.75);margin-bottom:16px;"></div>';
          ok.children[1].textContent = d.ya_existia ? "Ya tenías una solicitud abierta" : "Solicitud enviada";
          ok.children[2].textContent = opciones.confirmacion || "El equipo la está revisando con urgencia. Hasta que te confirmemos, sigues asignado a este evento.";
          var bOk = boton("Entendido", "background:rgba(197,160,89,0.9);border:1px solid #c5a059;color:#000;");
          bOk.addEventListener("click", function () { cerrar(true); });
          ok.appendChild(bOk); caja.appendChild(ok);
          bOk.focus();
        } catch (e) {
          err.textContent = "No se pudo enviar: " + ((e && e.message) || e);
          bSi.disabled = false; bNo.disabled = false; bSi.textContent = "Enviar solicitud";
        }
      });

      document.addEventListener("keydown", tecla);
      document.body.appendChild(fondo);
      ta.focus();
    });
  };
})();
