/* Matrix financiero (Owner) · «Ganamos / Pagamos» con datos REALES de la empresa.
 * Lee UNA función de solo lectura, get_business_cash_summary (solo Owner/Admin; filtra dentro de la base), que suma lo que ya existe: residencias, agenda de eventos, libro de los DJ,
 * cobros de Stripe y, cuando Teller se conecte, el banco. No escribe nada. Los pagos a DJs son DEVENGADOS (lo que se les debe por turnos y eventos ya ocurridos); lo realmente pagado
 * lo dirá el banco. Sin cifras inventadas: lo que no existe sale en 0 con su razón. Texto con textContent. Compatible con Safari 13 (sin ??, sin ?.). */
(function () {
    'use strict';
    var USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    var sbRef = null;

    function money(c) { return USD.format((Number(c) || 0) / 100); }
    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
    function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    /* UNA sola fuente de rango: la barra de arriba del Matrix (Hoy, Semana, Mes, Trimestre, Año, 5 años, Personalizado) y su interruptor «vs período anterior». La página la publica en
       window.mdjBfiRangeInfo() y avisa con el evento «mdjbfi:range»; estos bloques solo la leen. */
    function rng() {
        var r = typeof window.mdjBfiRangeInfo === 'function' ? window.mdjBfiRangeInfo() : null;
        if (r) return r;
        var t = new Date(), f = new Date(t.getTime() - 29 * 864e5);
        return { id: 'month', label: 'Mes', days: 30, from: ymd(f), to: ymd(t), compare: false };
    }
    function shift(day, n) { var p = String(day).split('-'), d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + n); return ymd(d); }
    function daysBetween(a, b) { var x = String(a).split('-'), y = String(b).split('-'); return Math.round((new Date(Number(y[0]), Number(y[1]) - 1, Number(y[2])) - new Date(Number(x[0]), Number(x[1]) - 1, Number(x[2]))) / 864e5) + 1; }
    function dayYear(d, withYear) { return dayLabel(d) + (withYear ? ' ' + String(d).slice(0, 4) : ''); }
    function rangeText(r) { if (r.incomplete) return 'Personalizado: elige las dos fechas'; var y = String(r.from).slice(0, 4) !== String(r.to).slice(0, 4); return r.label + ' · ' + dayYear(r.from, y) + ' al ' + dayYear(r.to, y) + (r.compare ? ' · vs período anterior' : ''); }

    function css() {
        if (document.getElementById('bcr-style')) return;
        var s = document.createElement('style'); s.id = 'bcr-style';
        s.textContent =
            '#bcr-root{margin:0;padding:12px 16px 14px;border-bottom:1px solid var(--line);background:var(--surface);}' +
            '#bcr-root .bcr-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px;}' +
            '#bcr-root .bcr-title{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--gold-strong);display:flex;align-items:center;gap:8px;}' +
            '#bcr-root .bcr-pill{font-size:9.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#2fa866;border:1px solid rgba(47,168,102,.5);border-radius:999px;padding:2px 8px;}' +
            '#bcr-root .bcr-ranges{display:flex;gap:4px;}' +
            '#bcr-root .bcr-ranges button{background:transparent;border:1px solid var(--line);color:var(--text-2);font-size:11px;border-radius:7px;padding:3px 10px;cursor:pointer;}' +
            '#bcr-root .bcr-ranges button.on{background:color-mix(in srgb,var(--gold) 18%,transparent);color:var(--gold-strong);border-color:var(--gold);font-weight:700;}' +
            '#bcr-root .bcr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;}' +
            '#bcr-root .bcr-card{border:1px solid var(--line);background:var(--surface-2);border-radius:10px;padding:9px 13px;}' +
            '#bcr-root .bcr-lab{font-size:10.5px;color:var(--text-muted);margin-bottom:3px;}' +
            '#bcr-root .bcr-val{font-size:20px;font-weight:800;color:var(--text);font-variant-numeric:tabular-nums;}' +
            '#bcr-root .bcr-val.pos{color:#2fa866;}#bcr-root .bcr-val.neg{color:#e5484d;}' +
            '#bcr-root .bcr-sub{font-size:10px;color:var(--text-muted);margin-top:2px;line-height:1.35;}' +
            '#bcr-root .bcr-months{margin-top:10px;display:grid;gap:5px;}' +
            '#bcr-root .bcr-m{display:grid;grid-template-columns:70px 1fr 96px 96px;align-items:center;gap:10px;font-size:11px;color:var(--text-2);}' +
            '#bcr-root .bcr-track{background:var(--surface-raised);border-radius:5px;height:8px;overflow:hidden;position:relative;}' +
            '#bcr-root .bcr-fill{height:100%;background:var(--gold);border-radius:5px;}' +
            '#bcr-root .bcr-num{text-align:right;font-variant-numeric:tabular-nums;}' +
            '#bcr-root .bcr-note{margin-top:8px;font-size:10.5px;color:var(--text-muted);}' +
            '#bcr-root .bcr-dl{font-weight:700;}#bcr-root .bcr-dl.pos{color:#2fa866;}#bcr-root .bcr-dl.neg{color:#e5484d;}#bcr-root .bcr-rt{font-size:10.5px;color:var(--text-muted);}' +
            '#bcr-root .bcr-seo{margin-top:18px;padding-top:14px;border-top:1px solid var(--line);}' +
            '#bcr-root .bcr-seo-chart{margin-top:10px;}';
        document.head.appendChild(s);
    }

    function card(label, value, sub, tone, dl) {
        var c = el('div', 'bcr-card'); c.appendChild(el('div', 'bcr-lab', label)); c.appendChild(el('div', 'bcr-val' + (tone ? ' ' + tone : ''), value));
        if (sub) c.appendChild(el('div', 'bcr-sub', sub));
        if (dl) c.appendChild(el('div', 'bcr-sub bcr-dl' + (dl.c ? ' ' + dl.c : ''), dl.t));
        return c;
    }
    function monthLabel(m) { var p = String(m).split('-'); return new Date(Number(p[0]), Number(p[1]) - 1, 1).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }); }

    function paint(root, d, pv, pvComplete) {
        var body = root.querySelector('.bcr-body'); while (body.firstChild) body.removeChild(body.firstChild);
        var r = d.residencias, e = d.eventos, l = d.libro_djs, st = d.stripe, b = d.banco, grid = el('div', 'bcr-grid');
        function dm(cur, prev) { return pv ? delta(cur / 100, prev / 100, pvComplete, false, true) : null; }
        grid.appendChild(card('Ganamos', money(d.ganamos_cents), 'Residencias ' + money(r.ingreso_cents) + ' · Eventos ' + money(e.ingreso_cents) + ' · Stripe ' + money(st.cobrado_cents), 'pos', pv ? dm(d.ganamos_cents, pv.ganamos_cents) : null));
        grid.appendChild(card('Pagamos', money(d.pagamos_cents), 'DJs en residencia ' + money(r.pago_djs_cents) + ' · Eventos ' + money(e.pago_djs_cents) + ' · Libro ' + money(l.pago_cents), '', pv ? dm(d.pagamos_cents, pv.pagamos_cents) : null));
        grid.appendChild(card('Neto', money(d.neto_cents), 'Ganamos − Pagamos (devengado)', d.neto_cents >= 0 ? 'pos' : 'neg', pv ? dm(d.neto_cents, pv.neto_cents) : null));
        grid.appendChild(card('Por liberar a DJs', money(l.pendiente_cents), 'Pagos pendientes del libro de los DJ'));
        var cb = d.cobros;
        if (cb) {
            var parts = []; if (cb.acreditado_cents) parts.push(money(cb.acreditado_cents) + ' acreditado'); if (cb.por_acreditar_cents) parts.push(money(cb.por_acreditar_cents) + ' por acreditar');
            grid.appendChild(card('Cobrado', money(cb.total_cents), cb.cobros ? cb.cobros + (cb.cobros === 1 ? ' cobro' : ' cobros') + (parts.length ? ' · ' + parts.join(' · ') : '') : 'Sin cobros registrados en el rango', '', pv && pv.cobros ? delta(cb.total_cents / 100, pv.cobros.total_cents / 100, pvComplete, false, true) : null));
            var rr = rng(), pc;
            if (!cb.first_day) pc = ['—', 'Sin cobros registrados todavía'];
            else if (rr.from < cb.first_day) pc = ['—', 'Los cobros registrados empiezan el ' + dayLabel(cb.first_day) + '; faltan los anteriores para calcularlo'];
            else { var pcv = d.ganamos_cents - cb.total_cents; pc = pcv >= 0 ? [money(pcv), 'Devengado − cobrado del rango'] : [money(0), 'Cobrado supera lo devengado en ' + money(-pcv) + ' (incluye turnos de fechas anteriores)']; }
            grid.appendChild(card('Por cobrar', pc[0], pc[1]));
        }
        grid.appendChild(card('Eventos', e.hechos + (e.hechos === 1 ? ' hecho · ' : ' hechos · ') + e.pendientes + (e.pendientes === 1 ? ' pendiente' : ' pendientes'), e.sin_ingreso_registrado > 0 ? e.sin_ingreso_registrado + (e.sin_ingreso_registrado === 1 ? ' evento hecho sin ingreso registrado' : ' eventos hechos sin ingreso registrado') + ': falta la tarifa del local' : 'Todos con ingreso registrado'));
        grid.appendChild(card('Turnos de residencia', String(r.turnos), 'Margen ' + money(r.margen_cents) + ' · turnos de DJMago305 = ingreso de la empresa', '', pv ? delta(r.turnos, pv.residencias.turnos, pvComplete) : null));
        grid.appendChild(card('Banco (Teller)', b.conectado ? money(b.entradas_cents - b.salidas_cents) : 'Sin conectar', b.conectado ? 'Entradas ' + money(b.entradas_cents) + ' · Salidas ' + money(b.salidas_cents) : 'Esperando credenciales de Teller: cuando lleguen, aquí aparece lo realmente cobrado y pagado'));
        body.appendChild(grid);
        var months = r.por_mes || [];
        if (months.length) {
            var max = 1; months.forEach(function (m) { if (m.ingreso_cents > max) max = m.ingreso_cents; });
            var box = el('div', 'bcr-months');
            months.forEach(function (m) {
                var row = el('div', 'bcr-m'), tr = el('div', 'bcr-track'), f = el('div', 'bcr-fill');
                f.style.width = Math.max(3, Math.round(m.ingreso_cents / max * 100)) + '%'; tr.appendChild(f);
                row.appendChild(el('span', null, monthLabel(m.month))); row.appendChild(tr);
                row.appendChild(el('span', 'bcr-num', '+' + money(m.ingreso_cents))); row.appendChild(el('span', 'bcr-num', '−' + money(m.pago_cents)));
                box.appendChild(row);
            });
            body.appendChild(box);
        }
        body.appendChild(el('div', 'bcr-note', 'Residencias: según las tarifas de cada turno ya ocurrido (devengado, no cobrado). Pagos a DJs: lo que se les debe; el pago real lo confirmará el banco. Sin cifras estimadas.'));
    }

    function msg(root, text) { var body = root.querySelector('.bcr-body'); while (body.firstChild) body.removeChild(body.firstChild); body.appendChild(el('div', 'bcr-note', text)); }

    function load(root) {
        var r = rng(), box = root.querySelector('.bcr-rt'); if (box) box.textContent = rangeText(r);
        if (r.incomplete) { msg(root, 'Elige las dos fechas del rango personalizado (arriba) para ver ganamos y pagamos.'); return; }
        msg(root, 'Cargando…');
        function ask(f, t) { return sbRef.rpc('get_business_cash_summary', { p_from: f, p_to: t }); }
        var len = daysBetween(r.from, r.to), pTo = shift(r.from, -1), pFrom = shift(pTo, -(len - 1));
        var pReq = r.compare ? ask(pFrom, pTo) : Promise.resolve(null);
        Promise.all([ask(r.from, r.to), pReq]).then(function (rs) {
            var res = rs[0], pres = rs[1];
            if (res && res.error) { msg(root, /does not exist|Could not find|PGRST202/i.test(res.error.message || '') ? 'Pendiente de activar en la base de datos (función get_business_cash_summary).' : 'No se pudo leer: ' + (res.error.message || 'error')); return; }
            if (!res || !res.data) { msg(root, 'Sin respuesta.'); return; }
            var pv = pres && !pres.error && pres.data ? pres.data : null;
            var first = res.data.first_day;            /* primer día con dato real: si el período anterior empieza antes, está incompleto y no se calcula el porcentaje */
            paint(root, res.data, pv, !!first && pFrom >= first);
        }, function (e) { msg(root, 'No se pudo leer: ' + (e && e.message ? e.message : 'error')); });
    }

    function mount(sb) {
        sbRef = sb; css();
        var root = document.getElementById('bcr-root'); if (!root || root.getAttribute('data-ready')) return;
        root.setAttribute('data-ready', '1');
        var head = el('div', 'bcr-head'), title = el('div', 'bcr-title', 'Ganamos y pagamos'); title.appendChild(el('span', 'bcr-pill', 'Datos reales'));
        head.appendChild(title); head.appendChild(el('div', 'bcr-rt', '')); root.appendChild(head); root.appendChild(el('div', 'bcr-body'));
        root.style.display = 'block'; load(root); mountSeo(root);
        window.addEventListener('mdjbfi:range', function () { load(root); var sx = root.querySelector('.bcr-seo'); if (sx) loadSeo(sx); });
    }

    /* Disposición: la columna lateral del Matrix llega hasta el menú de arriba y TODO lo demás (banner, botón del motor, «Ganamos y pagamos») va en la columna derecha, encima de la barra
       de pestañas del Matrix. Se mueven los nodos que ya existen (no se borra nada). */
    function dock() {
        var main = document.querySelector('.main'), top = main && main.querySelector('.topbar'); if (!main || !top) return;
        ['.target-state-banner', '#mdjBfiImportBar', '#bcr-root'].forEach(function (sel) { var n = document.querySelector(sel); if (n && n.parentNode !== main) main.insertBefore(n, top); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', dock); else dock();

    /* ===== Tráfico del sitio (SEO): GA4 + Search Console reales, vía la función de solo lectura get_business_seo_summary (Owner/Admin). Instantánea por día cargada en la tabla
       seo_daily_metrics: se muestra con la fecha del último dato. Compara el período actual con el inmediatamente anterior del mismo largo; si el anterior está incompleto, lo dice
       y no calcula porcentaje. ===== */
    var seoCache = null;
    function num(n) { return (Number(n) || 0).toLocaleString('en-US'); }
    function dayLabel(d) { var p = String(d).split('-'); return Number(p[2]) + ' ' + ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][Number(p[1]) - 1]; }
    function delta(cur, prev, complete, lowerIsBetter, isMoney) {
        if (!complete) return { t: 'Período anterior incompleto', c: '' };
        if (!(prev > 0)) return { t: 'Sin dato anterior', c: '' };
        var pc = (cur - prev) / prev * 100, up = pc >= 0, good = lowerIsBetter ? !up : up, shown = isMoney ? USD.format(prev) : num(prev);
        return { t: (up ? '↑ ' : '↓ ') + Math.abs(pc).toFixed(1) + '% vs período anterior (' + shown + ')', c: good ? 'pos' : 'neg' };
    }
    function seoCard(label, value, d) { return card(label, value, null, '', d); }
    function paintSeo(box, d) {
        var body = box.querySelector('.bcr-seo-body'); while (body.firstChild) body.removeChild(body.firstChild);
        if (d.empty) { body.appendChild(el('div', 'bcr-note', 'Todavía no hay datos de tráfico cargados.')); return; }
        var cur = d.current, prv = d.previous, complete = d.previous_days_with_data >= d.length_days, cmp = !!rng().compare;
        var grid = el('div', 'bcr-grid');
        function sc(label, value, a, b, lower) { return cmp ? seoCard(label, value, delta(a, b, complete, lower)) : card(label, value, null, '', null); }
        grid.appendChild(sc('Sesiones', num(cur.sessions), cur.sessions, prv.sessions));
        grid.appendChild(sc('Visitas nuevas', num(cur.new_users), cur.new_users, prv.new_users));
        grid.appendChild(sc('Páginas vistas', num(cur.pageviews), cur.pageviews, prv.pageviews));
        grid.appendChild(sc('Impresiones en Google', num(cur.impressions), cur.impressions, prv.impressions));
        grid.appendChild(sc('Clics desde Google', num(cur.clicks), cur.clicks, prv.clicks));
        grid.appendChild(sc('Posición promedio', cur.position == null ? '—' : String(cur.position), cur.position || 0, prv.position || 0, true));
        body.appendChild(grid);
        var host = el('div', 'bcr-seo-chart'); body.appendChild(host);
        var cache = {}; (d.daily || []).forEach(function (r) { cache[r.day] = r; });
        var dayList = []; var t = new Date(d.from + 'T12:00:00'), end = new Date(d.to + 'T12:00:00');
        while (t <= end) { dayList.push(t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0')); t = new Date(t.getTime() + 864e5); }
        var len = dayList.length;
        var prevList = dayList.map(function (x) { var q = new Date(new Date(x + 'T12:00:00').getTime() - len * 864e5); return q.getFullYear() + '-' + String(q.getMonth() + 1).padStart(2, '0') + '-' + String(q.getDate()).padStart(2, '0'); });
        function col(list, f) { return list.map(function (x) { var r = cache[x]; return r && r[f] != null ? Number(r[f]) : null; }); }
        if (typeof window.mdjBfiChart === 'function' && typeof Chart !== 'undefined') {
            try {
                window.mdjBfiChart(host, col(dayList, 'sessions'), { height: 190, color: 'var(--gold)', unit: 'count', label: 'Sesiones (período actual)', pointLabels: dayList.map(dayLabel),
                    prev: cmp && d.previous_days_with_data > 0 ? col(prevList, 'sessions') : null,
                    lines: [{ label: 'Impresiones en Google', data: col(dayList, 'impressions'), color: '#a855f7', dash: [6, 4], axis: 'y' },
                            { label: 'Clics desde Google', data: col(dayList, 'clicks'), color: 'var(--good)', bar: true, axis: 'y1' }] });
            } catch (e) { /* sin gráfica si Chart.js no cargó; las tarjetas quedan */ }
        }
        var when = d.updated_at ? new Date(d.updated_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
        body.appendChild(el('div', 'bcr-note', 'Fuente: ' + (d.source || 'GA4 + Search Console') + ' · datos del ' + dayLabel(d.from) + ' al ' + dayLabel(d.to) + (when ? ' (cargados el ' + when + ')' : '') +
            ((complete || !cmp) ? '' : ' · el período anterior solo tiene ' + d.previous_days_with_data + ' de ' + d.length_days + ' días con dato, por eso no se calcula el porcentaje') + '.'));
    }
    function loadSeo(box) {
        var body = box.querySelector('.bcr-seo-body'), r = rng(); while (body.firstChild) body.removeChild(body.firstChild);
        if (r.incomplete) { body.appendChild(el('div', 'bcr-note', 'Elige las dos fechas del rango personalizado (arriba).')); return; }
        body.appendChild(el('div', 'bcr-note', 'Cargando…'));
        var args = r.custom ? { p_days: null, p_from: r.from, p_to: r.to } : { p_days: r.days, p_from: null, p_to: null };
        /* Si la base todavía tiene la versión anterior de la función (solo p_days), los rangos preestablecidos siguen funcionando con ella. */
        sbRef.rpc('get_business_seo_summary', args).then(function (res0) {
            if (res0 && res0.error && !r.custom && /PGRST202|Could not find/i.test(res0.error.message || '')) return sbRef.rpc('get_business_seo_summary', { p_days: r.days });
            return res0;
        }).then(function (res) {
            while (body.firstChild) body.removeChild(body.firstChild);
            if (res && res.error) { body.appendChild(el('div', 'bcr-note', /does not exist|Could not find|PGRST202|Could not choose/i.test(res.error.message || '') ? 'Pendiente de activar en la base de datos (función get_business_seo_summary con rango).' : 'No se pudo leer: ' + (res.error.message || 'error'))); return; }
            seoCache = res && res.data; if (!seoCache) { body.appendChild(el('div', 'bcr-note', 'Sin respuesta.')); return; }
            if (seoCache.out_of_range) { body.appendChild(el('div', 'bcr-note', 'Ese rango queda fuera de los datos de tráfico cargados (' + dayLabel(seoCache.first_day) + ' al ' + dayLabel(seoCache.last_day) + ').')); return; }
            paintSeo(box, seoCache);
        }, function (e) { while (body.firstChild) body.removeChild(body.firstChild); body.appendChild(el('div', 'bcr-note', 'No se pudo leer: ' + (e && e.message ? e.message : 'error'))); });
    }
    function mountSeo(root) {
        var box = el('div', 'bcr-seo');
        var head = el('div', 'bcr-head'), title = el('div', 'bcr-title', 'Tráfico del sitio'); title.appendChild(el('span', 'bcr-pill', 'Datos reales'));
        head.appendChild(title); box.appendChild(head); box.appendChild(el('div', 'bcr-seo-body')); root.appendChild(box); loadSeo(box);
        /* al cambiar día/noche se redibuja con los colores del tema (sin volver a pedir datos) */
        try { new MutationObserver(function () { if (seoCache) setTimeout(function () { paintSeo(box, seoCache); }, 80); }).observe(document.body, { attributes: true, attributeFilter: ['data-mode'] }); } catch (e) { /* sin observador */ }
    }

    window.mdjBcrMount = mount;
})();
