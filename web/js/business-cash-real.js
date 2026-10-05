/* Matrix financiero (Owner) · «Ganamos / Pagamos» con datos REALES de la empresa.
 * Lee UNA función de solo lectura, get_business_cash_summary (solo Owner/Admin; filtra dentro de la base), que suma lo que ya existe: residencias, agenda de eventos, libro de los DJ,
 * cobros de Stripe y, cuando Teller se conecte, el banco. No escribe nada. Los pagos a DJs son DEVENGADOS (lo que se les debe por turnos y eventos ya ocurridos); lo realmente pagado
 * lo dirá el banco. Sin cifras inventadas: lo que no existe sale en 0 con su razón. Texto con textContent. Compatible con Safari 13 (sin ??, sin ?.). */
(function () {
    'use strict';
    var USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    var range = 'mes', sbRef = null;
    var RANGES = [['mes', 'Mes'], ['trim', 'Trimestre'], ['anio', 'Año'], ['todo', 'Todo']];

    function money(c) { return USD.format((Number(c) || 0) / 100); }
    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
    function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    function from() {
        var n = new Date();
        if (range === 'mes') return ymd(new Date(n.getFullYear(), n.getMonth(), 1));
        if (range === 'trim') return ymd(new Date(n.getFullYear(), n.getMonth() - 2, 1));
        if (range === 'anio') return ymd(new Date(n.getFullYear(), 0, 1));
        return null;
    }

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
            '#bcr-root .bcr-note{margin-top:8px;font-size:10.5px;color:var(--text-muted);}';
        document.head.appendChild(s);
    }

    function card(label, value, sub, tone) {
        var c = el('div', 'bcr-card'); c.appendChild(el('div', 'bcr-lab', label)); c.appendChild(el('div', 'bcr-val' + (tone ? ' ' + tone : ''), value));
        if (sub) c.appendChild(el('div', 'bcr-sub', sub)); return c;
    }
    function monthLabel(m) { var p = String(m).split('-'); return new Date(Number(p[0]), Number(p[1]) - 1, 1).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }); }

    function paint(root, d) {
        var body = root.querySelector('.bcr-body'); while (body.firstChild) body.removeChild(body.firstChild);
        var r = d.residencias, e = d.eventos, l = d.libro_djs, st = d.stripe, b = d.banco, grid = el('div', 'bcr-grid');
        grid.appendChild(card('Ganamos', money(d.ganamos_cents), 'Residencias ' + money(r.ingreso_cents) + ' · Eventos ' + money(e.ingreso_cents) + ' · Stripe ' + money(st.cobrado_cents), 'pos'));
        grid.appendChild(card('Pagamos', money(d.pagamos_cents), 'DJs en residencia ' + money(r.pago_djs_cents) + ' · Eventos ' + money(e.pago_djs_cents) + ' · Libro ' + money(l.pago_cents)));
        grid.appendChild(card('Neto', money(d.neto_cents), 'Ganamos − Pagamos (devengado)', d.neto_cents >= 0 ? 'pos' : 'neg'));
        grid.appendChild(card('Por liberar a DJs', money(l.pendiente_cents), 'Pagos pendientes del libro de los DJ'));
        grid.appendChild(card('Eventos', e.hechos + (e.hechos === 1 ? ' hecho · ' : ' hechos · ') + e.pendientes + (e.pendientes === 1 ? ' pendiente' : ' pendientes'), e.sin_ingreso_registrado > 0 ? e.sin_ingreso_registrado + (e.sin_ingreso_registrado === 1 ? ' evento hecho sin ingreso registrado' : ' eventos hechos sin ingreso registrado') + ': falta la tarifa del local' : 'Todos con ingreso registrado'));
        grid.appendChild(card('Turnos de residencia', String(r.turnos), 'Margen ' + money(r.margen_cents) + ' · turnos de DJMago305 = ingreso de la empresa'));
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
        msg(root, 'Cargando…');
        var args = { p_from: from(), p_to: null };
        sbRef.rpc('get_business_cash_summary', args).then(function (res) {
            if (res && res.error) { msg(root, /does not exist|Could not find|PGRST202/i.test(res.error.message || '') ? 'Pendiente de activar en la base de datos (función get_business_cash_summary).' : 'No se pudo leer: ' + (res.error.message || 'error')); return; }
            if (!res || !res.data) { msg(root, 'Sin respuesta.'); return; }
            paint(root, res.data);
        }, function (e) { msg(root, 'No se pudo leer: ' + (e && e.message ? e.message : 'error')); });
    }

    function mount(sb) {
        sbRef = sb; css();
        var root = document.getElementById('bcr-root'); if (!root || root.getAttribute('data-ready')) return;
        root.setAttribute('data-ready', '1');
        var head = el('div', 'bcr-head'), title = el('div', 'bcr-title', 'Ganamos y pagamos'); title.appendChild(el('span', 'bcr-pill', 'Datos reales'));
        var rg = el('div', 'bcr-ranges');
        RANGES.forEach(function (x) {
            var bt = el('button', x[0] === range ? 'on' : '', x[1]); bt.type = 'button';
            bt.addEventListener('click', function () { range = x[0]; var all = rg.querySelectorAll('button'); for (var i = 0; i < all.length; i++) all[i].className = ''; bt.className = 'on'; load(root); });
            rg.appendChild(bt);
        });
        head.appendChild(title); head.appendChild(rg); root.appendChild(head); root.appendChild(el('div', 'bcr-body'));
        root.style.display = 'block'; load(root);
    }

    /* Disposición: la columna lateral del Matrix llega hasta el menú de arriba y TODO lo demás (banner, botón del motor, «Ganamos y pagamos») va en la columna derecha, encima de la barra
       de pestañas del Matrix. Se mueven los nodos que ya existen (no se borra nada). */
    function dock() {
        var main = document.querySelector('.main'), top = main && main.querySelector('.topbar'); if (!main || !top) return;
        ['.target-state-banner', '#mdjBfiImportBar', '#bcr-root'].forEach(function (sel) { var n = document.querySelector(sel); if (n && n.parentNode !== main) main.insertBefore(n, top); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', dock); else dock();

    window.mdjBcrMount = mount;
})();
