/**
 * LIBRO DE OPERACIONES — Artefacto del Artista (Fase 2A)
 * Espacio de escritura del artista sobre sí mismo: incidentes y su propia facturación.
 * El artista NUNCA lee lo ya enviado desde aquí — es de una sola vía por diseño
 * (Constitución del Libro de Operaciones IA, capítulo 2.2, artifact 55cf2cd5).
 * Guarda vía RPC libro_operaciones_reportar — el servidor exige la cláusula legal
 * antes del primer reporte; esta pantalla solo la muestra, no decide si se saltó.
 */

var _libroInitDone = false;
var _libroSubmitting = false;

// PENDIENTE: el Capitán define la lista cerrada de tipos de incidente antes de
// que esto se codifique como catálogo real. Placeholder de texto libre mientras
// tanto — ver comentario en la migración de la Fase 1.
var LIBRO_TIPOS_INCIDENTE_PENDIENTE = true;

function mdjLibroSb() {
    return window.getSupabaseClient ? window.getSupabaseClient() : window.supabase;
}

function mdjLibroTabClick(event) {
    if (event) event.preventDefault();
    if (typeof switchProfileTab === 'function') {
        switchProfileTab('libro');
    }
    if (!_libroInitDone) {
        _libroInitDone = true;
        mdjLibroRenderForm();
    }
}

function mdjLibroSetStatus(msg, tone) {
    var el = document.getElementById('libro-form-status');
    if (!el) return;
    if (!msg) {
        el.style.display = 'none';
        el.textContent = '';
        return;
    }
    el.style.display = 'block';
    el.textContent = msg;
    el.className = 'libro-status ' + (tone || 'info');
}

function mdjLibroRenderForm() {
    var mount = document.getElementById('tab-libro');
    if (!mount) return;

    mount.innerHTML =
        '<div class="libro-widget">' +
        '  <p class="libro-lede">Reporta un incidente o la facturación de un evento — este espacio es solo tuyo, de una sola vía: una vez guardado, no puede corregirse ni volver a leerse desde aquí.</p>' +
        '  <div class="libro-legal-notice" id="libro-legal-notice">' +
        '    <strong>Aviso legal — léelo antes de continuar:</strong>' +
        '    <p>"Todo incidente registrado en este libro puede ser utilizado como evidencia en cualquier tipo de demanda o problema legal."</p>' +
        '    <label class="libro-legal-check">' +
        '      <input type="checkbox" id="libro-acepta-aviso"> He leído y entiendo este aviso.' +
        '    </label>' +
        '  </div>' +
        '  <form id="libro-form" class="libro-form">' +
        '    <label>Tipo de incidente' +
        (LIBRO_TIPOS_INCIDENTE_PENDIENTE
            ? '      <input type="text" id="libro-tipo" placeholder="Ej. transporte, equipo, cliente…" required>' +
              '      <small class="libro-hint">Lista provisional — el catálogo cerrado está pendiente.</small>'
            : '') +
        '    </label>' +
        '    <label>Lugar<input type="text" id="libro-lugar" placeholder="Venue o dirección"></label>' +
        '    <label>Con quién se trabajó<input type="text" id="libro-con-quien" placeholder="Otros artistas, cliente, staff…"></label>' +
        '    <label>Facturación propia (USD)<input type="number" step="0.01" min="0" id="libro-monto" placeholder="Solo tu parte"></label>' +
        '    <label>Clima<input type="text" id="libro-clima" placeholder="Ej. lluvia, despejado…"></label>' +
        '    <label>Sucesos extraordinarios<textarea id="libro-sucesos" rows="2"></textarea></label>' +
        '    <label>Relato libre<textarea id="libro-relato" rows="4" required></textarea></label>' +
        '    <button type="submit" id="libro-guardar-btn">Guardar</button>' +
        '  </form>' +
        '  <div id="libro-form-status" class="libro-status" style="display:none;"></div>' +
        '</div>';

    var form = document.getElementById('libro-form');
    if (form) {
        form.addEventListener('submit', function (ev) {
            ev.preventDefault();
            mdjLibroSubmit();
        });
    }
}

async function mdjLibroSubmit() {
    if (_libroSubmitting) return;
    var sb = mdjLibroSb();
    if (!sb) {
        mdjLibroSetStatus('No se pudo conectar. Intenta de nuevo en un momento.', 'error');
        return;
    }

    var tipo = (document.getElementById('libro-tipo') || {}).value || '';
    var relato = (document.getElementById('libro-relato') || {}).value || '';
    if (!tipo.trim() || !relato.trim()) {
        mdjLibroSetStatus('Tipo de incidente y relato libre son obligatorios.', 'error');
        return;
    }

    var acepta = !!(document.getElementById('libro-acepta-aviso') || {}).checked;
    var montoRaw = (document.getElementById('libro-monto') || {}).value;
    var monto = montoRaw ? Number(montoRaw) : null;

    var btn = document.getElementById('libro-guardar-btn');
    _libroSubmitting = true;
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }
    mdjLibroSetStatus('', null);

    try {
        var res = await sb.rpc('libro_operaciones_reportar', {
            p_tipo_incidente: tipo.trim(),
            p_lugar: (document.getElementById('libro-lugar') || {}).value || null,
            p_con_quien_se_trabajo: (document.getElementById('libro-con-quien') || {}).value || null,
            p_monto_facturado_usd: (monto !== null && !isNaN(monto)) ? monto : null,
            p_clima: (document.getElementById('libro-clima') || {}).value || null,
            p_sucesos_extraordinarios: (document.getElementById('libro-sucesos') || {}).value || null,
            p_relato_libre: relato.trim(),
            p_acepta_aviso_legal: acepta
        });

        if (res.error) {
            if (String(res.error.message || '').indexOf('aviso_legal_pendiente') !== -1) {
                var notice = document.getElementById('libro-legal-notice');
                if (notice) notice.classList.add('libro-legal-notice--pending');
                mdjLibroSetStatus('Marca que leíste el aviso legal antes de guardar tu primer reporte.', 'error');
            } else {
                mdjLibroSetStatus('No se pudo guardar: ' + res.error.message, 'error');
            }
            return;
        }

        mdjLibroRenderForm();
        mdjLibroSetStatus('Reporte guardado. El formulario quedó en blanco, listo para el siguiente.', 'success');
    } catch (e) {
        mdjLibroSetStatus('No se pudo guardar. Intenta de nuevo.', 'error');
    } finally {
        _libroSubmitting = false;
    }
}

window.mdjLibroTabClick = mdjLibroTabClick;
