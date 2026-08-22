/**
 * LIBRO DE OPERACIONES — Reporte corto del cliente (satisfacción / incidente)
 * Estilo "¿cómo salió tu pedido?": corto, estructurado, nunca una carta larga.
 * Guarda vía RPC libro_operaciones_reportar_cliente — el servidor valida que
 * el evento sea del cliente que reporta; esta pantalla solo lo recolecta.
 */

var _mdjLibroClienteRating = 0;
var _mdjLibroClienteLeadId = null;
var _mdjLibroClienteSubmitting = false;
var _mdjLibroClienteDjPublicUrl = null;   // resuelto al abrir; enlaza a las estrellas públicas del DJ

function mdjLibroClienteSb() {
    return window.getSupabaseClient ? window.getSupabaseClient() : window.supabase;
}

function mdjLibroClienteAbrir(leadId) {
    _mdjLibroClienteLeadId = leadId;
    _mdjLibroClienteRating = 0;
    _mdjLibroClienteDjPublicUrl = null;
    mdjLibroClienteRenderModal();
    mdjLibroClienteResolverDj(leadId);
}

// El reporte del libro es privado (staff). Esto NO lo escribe — solo arma el
// enlace a la calificación PÚBLICA del DJ ya existente (dj_public_reviews),
// estilo "califica tu pedido" de una plataforma de compras.
async function mdjLibroClienteResolverDj(leadId) {
    var sb = mdjLibroClienteSb();
    if (!sb || !leadId) return;
    try {
        var leadRes = await sb.from('leads').select('assigned_dj_id').eq('id', leadId).maybeSingle();
        var djProfileId = leadRes && leadRes.data ? leadRes.data.assigned_dj_id : null;
        if (!djProfileId) return;

        var djRes = await sb.from('dj_profiles').select('user_id,stage_name,dj_name').eq('id', djProfileId).maybeSingle();
        var dj = djRes && djRes.data;
        if (!dj || !dj.user_id) return;

        _mdjLibroClienteDjPublicUrl = './dj-profile.html?id=' + encodeURIComponent(dj.user_id) + '&view=public#pub-rate-card';
        var nombre = (dj.stage_name || dj.dj_name || 'tu DJ');
        var slot = document.getElementById('mdj-libro-cliente-rate-dj-slot');
        if (slot) {
            slot.innerHTML =
                '<a href="' + _mdjLibroClienteDjPublicUrl + '" target="_blank" rel="noopener" ' +
                'style="display:inline-block;margin-top:10px;color:#c99f4c;font-size:12.5px;text-decoration:underline;">' +
                'Calificar públicamente a ' + mdjLibroClienteEsc(nombre) + ' →</a>';
        }
    } catch (e) { /* silencioso — el enlace es un extra, no bloquea el reporte */ }
}

function mdjLibroClienteEsc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
}

function mdjLibroClienteCerrar() {
    var overlay = document.getElementById('mdj-libro-cliente-overlay');
    if (overlay) overlay.remove();
}

function mdjLibroClienteRenderModal() {
    mdjLibroClienteCerrar();

    var overlay = document.createElement('div');
    overlay.id = 'mdj-libro-cliente-overlay';
    overlay.style.cssText =
        'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';

    overlay.innerHTML =
        '<div style="background:#151519;border:1px solid rgba(201,159,76,.3);border-radius:14px;padding:26px 28px;max-width:420px;width:100%;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">' +
        '  <h3 style="margin:0 0 6px;font-size:18px;">¿Cómo salió tu evento?</h3>' +
        '  <p style="margin:0 0 18px;font-size:13px;color:rgba(255,255,255,.55);">Un reporte corto — sin cartas largas.</p>' +
        '  <div id="mdj-libro-cliente-stars" style="font-size:28px;letter-spacing:6px;margin-bottom:16px;cursor:pointer;">☆☆☆☆☆</div>' +
        '  <label style="display:block;font-size:12.5px;color:rgba(255,255,255,.6);margin-bottom:6px;">Tipo</label>' +
        '  <select id="mdj-libro-cliente-tipo" style="width:100%;margin-bottom:14px;background:#1c1c22;border:1px solid rgba(201,159,76,.4);border-radius:8px;padding:9px 10px;color:#fff;">' +
        '    <option value="satisfaccion">Satisfacción</option>' +
        '    <option value="incidente">Incidente</option>' +
        '  </select>' +
        '  <label style="display:block;font-size:12.5px;color:rgba(255,255,255,.6);margin-bottom:6px;">Nota breve (opcional, máx. 280)</label>' +
        '  <textarea id="mdj-libro-cliente-nota" rows="3" maxlength="280" style="width:100%;background:#1c1c22;border:1px solid rgba(201,159,76,.4);border-radius:8px;padding:9px 10px;color:#fff;font-family:inherit;font-size:14px;"></textarea>' +
        '  <div id="mdj-libro-cliente-count" style="text-align:right;font-size:11px;color:rgba(255,255,255,.4);margin:4px 0 14px;">0 / 280</div>' +
        '  <div id="mdj-libro-cliente-status" style="font-size:13px;margin-bottom:10px;display:none;"></div>' +
        '  <div id="mdj-libro-cliente-rate-dj-slot"></div>' +
        '  <div style="display:flex;gap:10px;justify-content:flex-end;">' +
        '    <button id="mdj-libro-cliente-cancelar" style="background:none;border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.7);padding:9px 16px;border-radius:8px;cursor:pointer;">Cancelar</button>' +
        '    <button id="mdj-libro-cliente-enviar" style="background:#c99f4c;color:#100c02;border:none;font-weight:700;padding:9px 18px;border-radius:8px;cursor:pointer;">Enviar</button>' +
        '  </div>' +
        '</div>';

    document.body.appendChild(overlay);

    var starsEl = document.getElementById('mdj-libro-cliente-stars');
    starsEl.addEventListener('click', function (ev) {
        var rect = starsEl.getBoundingClientRect();
        var relative = (ev.clientX - rect.left) / rect.width;
        _mdjLibroClienteRating = Math.max(1, Math.min(5, Math.ceil(relative * 5)));
        mdjLibroClientePintarEstrellas();
    });

    var notaEl = document.getElementById('mdj-libro-cliente-nota');
    var countEl = document.getElementById('mdj-libro-cliente-count');
    notaEl.addEventListener('input', function () {
        countEl.textContent = notaEl.value.length + ' / 280';
    });

    document.getElementById('mdj-libro-cliente-cancelar').addEventListener('click', mdjLibroClienteCerrar);
    document.getElementById('mdj-libro-cliente-enviar').addEventListener('click', mdjLibroClienteEnviar);
    overlay.addEventListener('click', function (ev) {
        if (ev.target === overlay) mdjLibroClienteCerrar();
    });
}

function mdjLibroClientePintarEstrellas() {
    var el = document.getElementById('mdj-libro-cliente-stars');
    if (!el) return;
    var s = '';
    for (var i = 1; i <= 5; i++) s += (i <= _mdjLibroClienteRating ? '★' : '☆');
    el.textContent = s;
    el.style.color = _mdjLibroClienteRating > 0 ? '#c99f4c' : '#fff';
}

async function mdjLibroClienteEnviar() {
    if (_mdjLibroClienteSubmitting) return;
    var sb = mdjLibroClienteSb();
    var statusEl = document.getElementById('mdj-libro-cliente-status');
    var tipo = document.getElementById('mdj-libro-cliente-tipo').value;
    var nota = document.getElementById('mdj-libro-cliente-nota').value.trim();

    if (!sb || !_mdjLibroClienteLeadId) {
        return;
    }
    if (tipo === 'satisfaccion' && _mdjLibroClienteRating === 0) {
        statusEl.style.display = 'block';
        statusEl.style.color = '#c1595a';
        statusEl.textContent = 'Elige cuántas estrellas quieres darle.';
        return;
    }

    _mdjLibroClienteSubmitting = true;
    var btn = document.getElementById('mdj-libro-cliente-enviar');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }

    try {
        var res = await sb.rpc('libro_operaciones_reportar_cliente', {
            p_lead_id: _mdjLibroClienteLeadId,
            p_tipo: tipo,
            p_calificacion: _mdjLibroClienteRating || null,
            p_nota: nota || null
        });

        if (res.error) {
            statusEl.style.display = 'block';
            statusEl.style.color = '#c1595a';
            statusEl.textContent = 'No se pudo enviar: ' + res.error.message;
            if (btn) { btn.disabled = false; btn.textContent = 'Enviar'; }
            _mdjLibroClienteSubmitting = false;
            return;
        }

        statusEl.style.display = 'block';
        statusEl.style.color = '#5fae82';
        statusEl.textContent = _mdjLibroClienteDjPublicUrl
            ? '¡Gracias! Tu reporte quedó guardado. ¿Quieres calificar también en su perfil público?'
            : '¡Gracias! Tu reporte quedó guardado.';
        if (btn) btn.style.display = 'none';
        document.getElementById('mdj-libro-cliente-cancelar').textContent = 'Cerrar';
        if (!_mdjLibroClienteDjPublicUrl) {
            setTimeout(mdjLibroClienteCerrar, 1400);
        }
    } catch (e) {
        statusEl.style.display = 'block';
        statusEl.style.color = '#c1595a';
        statusEl.textContent = 'No se pudo enviar. Intenta de nuevo.';
        if (btn) { btn.disabled = false; btn.textContent = 'Enviar'; }
    } finally {
        _mdjLibroClienteSubmitting = false;
    }
}

window.mdjLibroClienteAbrir = mdjLibroClienteAbrir;
