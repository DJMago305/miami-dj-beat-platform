// web/js/dj-avisos.js
// Panel "Notificaciones" del DJ: lista los avisos de sus eventos (asignado, movido,
// cancelado, reasignado) que escribe la base de datos, y deja activar el aviso
// al dispositivo (push) con el mismo MDJPush que usa el portal del cliente.
(function () {
  "use strict";

  var TIPOS = {
    evento_asignado:   { icono: "🎧", color: "#22c55e" },
    evento_movido:     { icono: "🔄", color: "#f0cc80" },
    evento_cancelado:  { icono: "🚫", color: "#ef4444" },
    evento_reasignado: { icono: "↪️", color: "#94a3b8" },
    evento_recordatorio_24h: { icono: "⏰", color: "#f0cc80" },
    evento_recordatorio_2h:  { icono: "⏰", color: "#f0cc80" },
    cancelacion_urgente:   { icono: "🚨", color: "#ff2d55" },
    cancelacion_recibida:  { icono: "📨", color: "#94a3b8" },
    cancelacion_resuelta:  { icono: "✅", color: "#22c55e" }
  };

  function supa() {
    return (typeof window.getSupabaseClient === "function") ? window.getSupabaseClient() : null;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function cuando(iso) {
    try {
      return new Date(iso).toLocaleString("es-US", {
        timeZone: "America/New_York", day: "numeric", month: "short", hour: "numeric", minute: "2-digit"
      });
    } catch (_) { return ""; }
  }

  // ── Campanita: cuenta los avisos de eventos sin leer ──
  async function contarNoLeidos() {
    var s = supa(); if (!s) return 0;
    try {
      var r = await s.from("dj_notifications").select("id", { count: "exact", head: true }).eq("read", false);
      return Number(r.count) || 0;
    } catch (_) { return 0; }
  }
  window.MDJDjAvisosNoLeidos = contarNoLeidos;

  // ── Lista ──
  async function cargarLista() {
    var caja = document.getElementById("dj-avisos-lista");
    if (!caja) return;
    var s = supa();
    if (!s) { caja.textContent = "Sin conexión."; return; }
    var r = await s.from("dj_notifications")
      .select("id, created_at, title, message, type, read")
      .order("created_at", { ascending: false }).limit(30);
    if (r.error) { caja.textContent = "No se pudieron cargar los avisos."; return; }
    var filas = r.data || [];
    if (!filas.length) {
      caja.innerHTML = '<div style="font-size:12px;color:rgba(255,255,255,0.4);padding:6px 0;">Todavía no tienes avisos. Cuando te asignen, muevan o cancelen un evento, aparecerá aquí.</div>';
      return;
    }
    caja.innerHTML = filas.map(function (n) {
      var t = TIPOS[n.type] || { icono: "🔔", color: "#c5a059" };
      return '<div style="display:flex;gap:12px;padding:12px 0;border-top:1px solid rgba(255,255,255,0.08);' + (n.read ? "opacity:.6;" : "") + '">' +
        '<div style="font-size:18px;line-height:1.2;">' + t.icono + '</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:13px;font-weight:800;color:' + t.color + ';">' + esc(n.title) + (n.read ? "" : ' <span style="font-size:9px;background:#ef4444;color:#fff;border-radius:99px;padding:2px 6px;vertical-align:middle;">NUEVO</span>') + '</div>' +
          '<div style="font-size:12px;color:rgba(255,255,255,0.75);line-height:1.45;margin-top:2px;">' + esc(n.message) + '</div>' +
          '<div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:4px;">' + esc(cuando(n.created_at)) + '</div>' +
        '</div></div>';
    }).join("");
  }

  async function marcarLeidos() {
    var s = supa(); if (!s) return;
    try { await s.rpc("dj_marcar_avisos_leidos"); } catch (_) {}
    var badge = document.getElementById("notif-unread-badge");
    if (badge) badge.style.display = "none";
    var bell = document.getElementById("notif-bell-icon");
    if (bell) { bell.setAttribute("stroke", "currentColor"); bell.style.filter = ""; }
  }

  // ── Avisos en este dispositivo ──
  function decir(txt, tono) {
    var p = document.getElementById("dj-push-pista");
    if (!p) return;
    p.textContent = txt || "";
    p.style.color = tono === "mal" ? "#ff8080" : tono === "ok" ? "rgba(197,160,89,0.95)" : "rgba(255,255,255,0.45)";
  }
  async function token() {
    var s = supa(); if (!s) return null;
    var ses = (await s.auth.getSession()).data.session;
    return ses ? ses.access_token : null;
  }
  async function pintarPush() {
    var c = document.getElementById("dj-push-toggle");
    if (!c) return;
    if (!window.MDJPush) { decir("Este navegador no admite avisos."); c.disabled = true; return; }
    var imp = window.MDJPush.porQueNoSePuede();
    if (imp) { c.checked = false; c.disabled = true; decir(imp); return; }
    c.disabled = false;
    var activo = await window.MDJPush.estaActivo();
    c.checked = activo;
    decir(activo ? "Activados en este equipo. Te avisaremos de tus eventos aunque no tengas la web abierta."
                 : "Recibe al instante cuando te asignen, muevan o cancelen un evento.", activo ? "ok" : null);
  }
  async function alCambiarPush() {
    var c = document.getElementById("dj-push-toggle");
    var quiere = c.checked;
    c.disabled = true;
    try {
      if (quiere) {
        var tok = await token();
        if (!tok) { c.checked = false; decir("Vuelve a iniciar sesión para activar los avisos.", "mal"); return; }
        var r = await window.MDJPush.activar(tok);
        if (!r || !r.ok) { c.checked = false; decir((r && r.motivo) || "No se pudo activar.", "mal"); return; }
        c.checked = true;
        decir("Activados en este equipo. Te avisaremos de tus eventos aunque no tengas la web abierta.", "ok");
      } else {
        await window.MDJPush.desactivar();
        c.checked = false;
        decir("Avisos apagados en este equipo.");
      }
    } catch (e) {
      c.checked = !quiere;
      decir("No se pudo cambiar: " + ((e && e.message) || e), "mal");
    } finally {
      c.disabled = false;
    }
  }

  // Se llama al abrir el panel Notificaciones.
  window.MDJDjAvisosAbrir = async function () {
    pintarPush();
    await cargarLista();
    await marcarLeidos();
  };

  document.addEventListener("DOMContentLoaded", function () {
    var c = document.getElementById("dj-push-toggle");
    if (c) c.addEventListener("change", alCambiarPush);
  });
})();
