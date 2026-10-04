/* Mesas del local — pantalla del STAFF de la cuenta comercial (dueño, manager y equipo).
 * Ve en vivo, por evento, qué mesas están libres, en pago, apartadas o vendidas (en línea o a mano), quién rentó cada una, y puede
 * apartar, vender a mano y liberar. Dueño y manager además abren la venta de mesas de un evento.
 *
 * Toda la seguridad vive en la base (supabase/scripts/20261003_sala_mesas_inventario_por_evento.sql): RLS de lectura para el staff del
 * local (can_sell_venue) y funciones venue_staff_set_table / venue_event_open_tables. Esta pantalla solo las llama; aunque alguien
 * manipulara la página, la base rechaza lo que su rol no puede hacer.
 *
 * Uso:  mdjStaffTables.init({ db, box, venues: [{ id, name, role, rooms: [{ id, name }] }] })   y   mdjStaffTables.onShow()
 * Lógica pura (estados, resumen, búsqueda, plano automático) exportada para pruebas en Node (supabase/tests/commercial_tables.test.mjs).
 */
(function (root) {
    'use strict';

    // ───────────────────────── Lógica pura ─────────────────────────
    var ROLES_ABREN_VENTA = { owner: true, manager: true };

    // 'available' | 'held' (el cliente está pagando) | 'reserved' (apartada por el staff) | 'sold_online' | 'sold_manager'
    function estadoDe(r, ahora) {
        if (r.status === 'held') return (r.held_until && new Date(r.held_until).getTime() > ahora) ? 'held' : 'available';   // espera vencida = libre
        if (r.status === 'sold') return r.sold_via === 'manager' ? 'sold_manager' : 'sold_online';
        return r.status === 'reserved' ? 'reserved' : 'available';
    }
    function resumen(rows, ahora) {
        var c = { available: 0, held: 0, reserved: 0, sold_online: 0, sold_manager: 0 }, cents = { online: 0, manager: 0 };
        rows.forEach(function (r) {
            var e = estadoDe(r, ahora); c[e]++;
            if (e === 'sold_online') cents.online += Number(r.price_cents) || 0;
            if (e === 'sold_manager') cents.manager += Number(r.price_cents) || 0;
        });
        return { counts: c, cents: cents, total: rows.length, vendidas: c.sold_online + c.sold_manager };
    }
    function norm(t) { return String(t == null ? '' : t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    // Mesas que no están libres, filtradas por nombre de quien renta, de la reserva, nota o mesa (para la puerta: «¿dónde está Alicia?»).
    function buscar(rows, q, ahora) {
        var n = norm(q).trim();
        return rows.filter(function (r) {
            if (estadoDe(r, ahora) === 'available') return false;
            if (!n) return true;
            return [r.table_key, r.label, r.buyer_name, r.reservation_name, r.note, r.zone_name].some(function (x) { return norm(x).indexOf(n) >= 0; });
        });
    }
    // Plano automático (cuadrícula) cuando el evento no trae la geometría del plano: se ordena por llave y se dibuja en filas.
    function gridMaps(rows) {
        var sorted = rows.slice().sort(function (a, b) { return String(a.table_key).localeCompare(String(b.table_key), 'es', { numeric: true }); });
        var perRow = 6, tables = sorted.map(function (r, i) {
            return { id: r.table_key, t: 'round', x: 80 + (i % perRow) * 128, y: 85 + Math.floor(i / perRow) * 100, seats: r.seats || 4 };
        });
        return [{ id: 'auto', label: 'Sala', focal: null, fixed: [], zones: [], tables: tables }];
    }
    function mapsDe(eventLayout, rows) {
        var maps = eventLayout && Array.isArray(eventLayout.maps) && eventLayout.maps.length ? eventLayout.maps : null;
        return maps || gridMaps(rows);
    }
    function dinero(cents) { var v = (Number(cents) || 0) / 100; return '$' + (Math.round(v * 100) % 100 === 0 ? String(Math.round(v)) : v.toFixed(2)); }
    function codigo(id) { return id ? String(id).slice(0, 8).toUpperCase() : ''; }
    function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }


    // Alinea a la cuadrícula de 10 px dentro de [min, max] (lo usa «Armar grupo» al arrastrar mesas).
    var PASO = 10;
    function ajustar(v, min, max) { return Math.min(max, Math.max(min, Math.round(v / PASO) * PASO)); }


    // ── «Armar grupo» (lógica pura) ──
    function movible(row, ahora) { var e = estadoDe(row, ahora); return e === 'available' || e === 'reserved'; }   // vendida o con alguien pagando: no se mueve ni se suma
    // Resumen del grupo elegido: mesas, sillas y total sugerido (suma de precios de lista). `ocupadas` = claves que ya no se pueden usar.
    function grupoResumen(rows, claves, ahora) {
        var por = {}; rows.forEach(function (r) { por[r.table_key] = r; });
        var out = { mesas: 0, sillas: 0, cents: 0, ocupadas: [] };
        claves.forEach(function (k) { var r = por[k]; if (!r || !movible(r, ahora)) { out.ocupadas.push(k); return; } out.mesas++; out.sillas += r.seats || 0; out.cents += r.price_cents || 0; });
        return out;
    }
    // La arquitectura de la sala no cambia: una mesa no puede quedar encima del escenario, la barra, los baños ni las paredes/figuras que bloquean.
    // Las reglas viven en mdj-plan-shapes.js (las mismas que exige la base en venue_plano_bloquea; se prueban contra ella).
    var PS = root.mdjPlanShapes || (typeof require === 'function' ? require('./mdj-plan-shapes.js') : null);
    function bloqueaEstructura(map, x, y) { return PS ? PS.bloquea(map, x, y) : null; }
    // A qué área de venta pertenece una mesa del layout: la que dice su campo «area» o, en planos anteriores, el plano que la dibuja (null = no pertenece a ninguna).
    function areaDeMesa(layout, t) {
        if (t && t.area) return t.area;
        if (layout && Array.isArray(layout.areas)) return null;                 // con catálogo de áreas, una mesa sin área no pertenece a ninguna
        var maps = layout && Array.isArray(layout.maps) ? layout.maps : [];
        for (var i = 0; i < maps.length; i++) if ((maps[i].tables || []).some(function (g) { return g.id === t.key; })) return maps[i].id;
        return null;
    }
    // Ids de las áreas que tienen mesas en el layout de un evento (las que hoy se están vendiendo).
    function areasActivas(layout) {
        var out = {}; ((layout && Array.isArray(layout.tables)) ? layout.tables : []).forEach(function (t) { var a = areaDeMesa(layout, t); if (a) out[a] = true; });
        return out;
    }
    var core = { estadoDe: estadoDe, areaDeMesa: areaDeMesa, areasActivas: areasActivas, movible: movible, grupoResumen: grupoResumen, bloqueaEstructura: bloqueaEstructura, ajustar: ajustar, resumen: resumen, buscar: buscar, gridMaps: gridMaps, mapsDe: mapsDe, dinero: dinero, codigo: codigo, puedeAbrirVenta: function (role) { return !!ROLES_ABREN_VENTA[role]; } };
    if (typeof module !== 'undefined' && module.exports) { module.exports = core; }
    if (typeof document === 'undefined') return;

    // ───────────────────────── Pantalla ─────────────────────────
    var ETIQUETA = { available: 'Libre', held: 'En pago', reserved: 'Apartada', sold_online: 'Vendida en línea', sold_manager: 'Vendida a mano' };
    var ERRORES = {
        mesa_no_disponible: 'Esa mesa ya no está disponible. Se actualizó el plano.',
        falta_nombre_de_quien_renta: 'Escribe el nombre de quien renta.',
        no_autorizado: 'Tu rol no puede hacer esto.',
        vendida_en_linea_requiere_reembolso: 'Esa mesa se pagó en línea: para liberarla primero hay que reembolsar el pago.',
        sin_mapa: 'La sala todavía no tiene un mapa de mesas guardado.',
        mapa_invalido: 'El mapa tiene mesas repetidas, sin clave o sin precio. Corrígelo y vuelve a intentar.',
        mesa_no_existe: 'Esa mesa no existe en este evento.',
        sala_no_existe: 'Esa sala no existe.',
        mesa_no_se_puede_mover: 'Una de las mesas ya se vendió o alguien la está pagando: no se puede mover.',
        mesa_sobre_estructura: 'Ahí está la estructura de la sala (escenario, baños o barra): no se puede poner una mesa encima.',
        sin_plano: 'Este evento no tiene dibujo del plano: no se pueden mover las mesas.',
        mesa_sin_dibujo: 'Una de las mesas no está dibujada en el plano.',
        movimiento_invalido: 'No se pudo mover: revisa las mesas elegidas.',
        grupo_invalido: 'El grupo debe tener entre 1 y 40 mesas, sin repetir.',
        areas_invalidas: 'Elige al menos un área de la sala.',
        area_con_ventas: 'Esa área ya tiene mesas vendidas, apartadas o en pago: no se puede cerrar. Libéralas primero.'
    };
    function msgError(e) { var t = String((e && e.message) || ''); var k = Object.keys(ERRORES).filter(function (c) { return t.indexOf(c) >= 0; })[0]; return k ? ERRORES[k] : 'No se pudo completar. Intenta de nuevo.'; }
    function sinSql(err) { return err && (err.code === '42P01' || err.code === 'PGRST205' || /venue_event_tables|schema cache|does not exist/i.test(err.message || '')); }

    function css() {
        if (document.getElementById('ct-style')) return;
        var s = document.createElement('style'); s.id = 'ct-style';
        s.textContent = [
            '.ct-bar { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin:0 0 14px; }',
            '.ct-bar select, .ct-bar input { padding:10px 12px; border-radius:8px; border:1px solid rgba(255,255,255,.18); background:rgba(0,0,0,.35); color:#fff; font:inherit; font-size:14px; min-width:0; }',
            '.ct-bar select { max-width:100%; } .ct-bar input { flex:1 1 200px; }',
            '.ct-chips { display:flex; flex-wrap:wrap; gap:8px; margin:0 0 14px; }',
            '.ct-chip { padding:6px 12px; border-radius:999px; border:1px solid rgba(255,255,255,.18); font-size:13px; font-weight:700; color:#fff; background:rgba(255,255,255,.04); }',
            '.ct-chip i { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:7px; vertical-align:0; }',
            '.ct-grid { display:grid; grid-template-columns:minmax(0,1.6fr) minmax(250px,1fr); gap:16px; align-items:start; }',
            '@media (max-width: 860px) { .ct-grid { grid-template-columns:1fr; } }',
            '.ct-tabs { display:flex; flex-wrap:wrap; gap:8px; margin:0 0 10px; } .ct-tabs button { padding:7px 16px; border-radius:50px; border:1px solid rgba(255,255,255,.2); background:transparent; color:rgba(255,255,255,.75); font:inherit; font-weight:700; font-size:13px; cursor:pointer; } .ct-tabs button[aria-selected="true"] { border-color:var(--gold); background:rgba(197,160,89,.18); color:var(--gold); }',
            '.ct-wrap { overflow-x:auto; border-radius:14px; background:rgba(0,0,0,.35); border:1px solid rgba(255,255,255,.08); }',
            '.ct-plan { display:block; width:100%; min-width:520px; height:auto; }',
            '.ct-plan .zone { fill:rgba(255,255,255,.05); stroke:rgba(255,255,255,.28); stroke-dasharray:5 4; } .ct-plan .zone-label { fill:rgba(255,255,255,.55); font:700 12px Inter,sans-serif; letter-spacing:.12em; text-anchor:middle; }',
            '.ct-plan .zone.fac { fill:rgba(197,160,89,.14); stroke:rgba(197,160,89,.85); stroke-dasharray:none; } .ct-plan .zone-label.fac { fill:#e8c987; }',
            '.ct-plan .tbl { cursor:pointer; } .ct-plan .tbl text { fill:#fff; font:700 11px Inter,sans-serif; text-anchor:middle; pointer-events:none; } .ct-plan .tbl text.px { font-weight:600; font-size:9px; opacity:.85; }',
            '.ct-plan .tbl .shape { stroke-width:2; } .ct-plan .tbl .seat { fill:rgba(255,255,255,.3); }',
            '.ct-plan .st-available .shape { fill:rgba(0,200,120,.16); stroke:#00c878; }',
            '.ct-plan .st-held .shape { fill:rgba(255,180,0,.2); stroke:#ffb400; }',
            '.ct-plan .st-reserved .shape { fill:rgba(255,96,96,.12); stroke:#ff6060; stroke-dasharray:5 3; }',
            '.ct-plan .st-sold_online .shape, .ct-plan .st-sold_manager .shape { fill:rgba(255,96,96,.28); stroke:#ff6060; }',
            '.ct-plan .tbl.ct-sel .shape { stroke:#fcd34d; stroke-width:4; } .ct-plan .tbl.ct-dim { opacity:.25; }',
            '.ct-side { border:1px solid rgba(255,255,255,.12); border-radius:14px; padding:16px; background:rgba(255,255,255,.03); } .ct-side h3 { margin:0 0 4px; font-size:17px; color:#fff; } .ct-side small { color:rgba(255,255,255,.6); }',
            '.ct-side label { display:block; font-size:12px; font-weight:700; color:rgba(255,255,255,.55); text-transform:uppercase; letter-spacing:.04em; margin:12px 0 6px; } .ct-side input { width:100%; box-sizing:border-box; padding:10px 12px; border-radius:8px; border:1px solid rgba(255,255,255,.15); background:rgba(0,0,0,.3); color:#fff; font:inherit; font-size:14px; }',
            '.ct-btns { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; } .ct-msg { font-size:13px; margin:10px 0 0; min-height:18px; }',
            '.ct-list { margin-top:16px; } .ct-row { display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; padding:10px 0; border-bottom:1px solid rgba(255,255,255,.08); font-size:14px; cursor:pointer; } .ct-row:last-child { border-bottom:none; } .ct-row b { color:#fff; } .ct-row small { display:block; color:rgba(255,255,255,.55); }',
            '.ct-plan .tbl.ct-mov { cursor:grab; touch-action:none; } .ct-plan .tbl.ct-fijo { cursor:not-allowed; opacity:.55; } .ct-plan .tbl.ct-pick .shape { stroke:#fcd34d; stroke-width:4; fill:rgba(252,211,77,.22); } .cc-btn2.ct-on { background:rgba(197,160,89,.32); }',
            '.ct-map { margin:0 0 14px; border:1px solid rgba(255,255,255,.12); border-radius:12px; background:rgba(255,255,255,.03); } .ct-map > summary { cursor:pointer; padding:12px 16px; font-weight:700; color:#fff; font-size:14px; } .ct-map-in { padding:2px 16px 16px; }',
            '.ct-map-sum { margin:12px 0 0; padding:12px 14px; border-radius:10px; background:rgba(0,0,0,.3); border:1px solid rgba(255,255,255,.1); font-size:13px; color:rgba(255,255,255,.85); line-height:1.6; } .ct-map-sum b { color:#fff; }',
            '.ct-map-in button:disabled { opacity:.45; cursor:not-allowed; }',
            '.ct-empty { color:rgba(255,255,255,.65); line-height:1.6; padding:6px 0; } .ct-leg { display:flex; flex-wrap:wrap; gap:14px; font-size:12px; color:rgba(255,255,255,.65); margin:8px 0 0; } .ct-leg i { display:inline-block; width:10px; height:10px; border-radius:3px; margin-right:6px; }'
        ].join('\n');
        document.head.appendChild(s);
    }

    var S = { db: null, box: null, venues: [], venue: null, events: [], event: null, rows: [], mapIdx: 0, sel: null, q: '', timer: null, sinSql: false, req: 0, grupo: false, pick: {}, gname: '', gnote: '', gpeople: '', arrastrando: false, areas: {} };
    var NS = 'http://www.w3.org/2000/svg';

    function init(o) {
        css();
        S.db = o.db; S.box = o.box; S.venues = o.venues || [];
        S.venue = null; S.events = []; S.event = null; S.rows = []; S.mapIdx = 0; S.sel = null; S.q = ''; S.sinSql = false; S.req++; S.grupo = false; S.pick = {}; S.gname = ''; S.gnote = ''; S.gpeople = ''; S.areas = {};   // estado limpio en cada arranque
        if (!S.venues.length) { S.box.innerHTML = '<p class="ct-empty">Tu cuenta todavía no tiene locales vinculados.</p>'; return; }
        S.venue = S.venues[0];
        S.box.innerHTML = '';
        buildFrame();
        loadEvents();
        clearInterval(S.timer);
        S.timer = setInterval(function () { if (document.visibilityState === 'visible' && S.box.offsetParent !== null && S.event) { loadRows(true); refrescarLayout(); } }, 10000);   // en vivo, solo mientras se mira
    }
    function onShow() { if (S.event) loadRows(true); else if (S.db) loadEvents(); }

    function q$(sel) { return S.box.querySelector(sel); }
    function buildFrame() {
        var multi = S.venues.length > 1;
        S.box.innerHTML =
            '<p class="ct-empty" style="margin:0 0 12px;">Ve en vivo qué mesas se vendieron en línea, quién rentó cada una, y aparta o vende a mano. <b style="color:#fff;">Cada evento tiene su propia sala</b>: lo que vendes un día no afecta al otro.</p>' +
            '<div class="ct-bar">' + (multi ? '<select id="ct-venue" aria-label="Local"></select>' : '') + '<select id="ct-event" aria-label="Evento"></select>' +
            '<button type="button" class="cc-btn2" id="ct-open" hidden>Abrir la venta de mesas</button></div>' +
            '<div id="ct-body"></div>';
        if (multi) {
            var sv = q$('#ct-venue');
            S.venues.forEach(function (v, i) { var op = document.createElement('option'); op.value = i; op.textContent = v.name; sv.appendChild(op); });
            sv.addEventListener('change', function () { S.venue = S.venues[Number(sv.value)]; S.event = null; S.rows = []; S.sel = null; loadEvents(); });
        }
        q$('#ct-event').addEventListener('change', function () { S.event = S.events.filter(function (e) { return e.id === q$('#ct-event').value; })[0] || null; S.sel = null; S.pick = {}; S.mapIdx = 0; loadRows(false); });
        q$('#ct-open').addEventListener('click', openSales);
    }
    function body(html) { q$('#ct-body').innerHTML = html; }

    async function loadEvents() {
        var ids = (S.venue.rooms || []).map(function (r) { return r.id; }).filter(Boolean);
        var sel = q$('#ct-event'); sel.innerHTML = '';
        if (!ids.length) { body('<p class="ct-empty">Este local todavía no tiene salas.</p>'); return; }
        var r = await S.db.from('venue_events').select('id,title,event_date,status,tables_open,layout,room_id').in('room_id', ids);
        if (r.error) r = await S.db.from('venue_events').select('id,title,event_date,status,room_id').in('room_id', ids);   // sin el SQL de mesas aún no existen tables_open / layout
        if (r.error) { body('<p class="ct-empty">No se pudieron cargar los eventos. Recarga la página.</p>'); return; }
        var hoy = new Date(), hoyStr = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
        S.events = (r.data || []).filter(function (e) { return e.status === 'announced' && (!e.event_date || e.event_date >= hoyStr); })
            .sort(function (a, b) { return String(a.event_date || '9999').localeCompare(String(b.event_date || '9999')); });
        if (!S.events.length) { body('<p class="ct-empty">No hay eventos programados en este local. Cuando haya uno, aparece aquí para abrir la venta de mesas.</p>'); q$('#ct-open').hidden = true; return; }
        var roomName = {}; (S.venue.rooms || []).forEach(function (x) { roomName[x.id] = x.name; });
        S.events.forEach(function (e) {
            var op = document.createElement('option'); op.value = e.id;
            op.textContent = (e.event_date ? fechaCorta(e.event_date) + ' · ' : '') + e.title + (S.venue.rooms.length > 1 ? ' (' + (roomName[e.room_id] || 'sala') + ')' : '');
            sel.appendChild(op);
        });
        if (!S.event || !S.events.some(function (e) { return e.id === S.event.id; })) S.event = S.events[0];
        sel.value = S.event.id;
        loadRows(false);
    }
    function fechaCorta(d) { var p = String(d).split('-'); if (p.length < 3) return d; var dt = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])); return dt.toLocaleDateString('es-US', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, ''); }

    // Los planos (áreas) de la sala del evento: se leen una vez (la sala pública y la plantilla son datos públicos).
    async function ensureAreas(roomId) {
        if (!roomId || S.areas[roomId]) return;
        var r = await S.db.from('venue_rooms').select('layout').eq('id', roomId).maybeSingle();
        var lay = (r && r.data && r.data.layout) || {}, maps = Array.isArray(lay.maps) ? lay.maps : [];
        // Áreas de venta: las del catálogo de la sala (áreas libres marcadas «venta»); si no trae, cada plano es un área (salas anteriores).
        var fuente = Array.isArray(lay.areas) ? lay.areas : maps.filter(function (m) { return m && m.id; }).map(function (m) { return { id: m.id, label: m.label, siempre: m.siempre }; });
        S.areas[roomId] = fuente.filter(function (a) { return a && a.id; }).map(function (a) { return { id: a.id, label: a.label || a.id, siempre: a.siempre === true }; });
    }
    async function loadRows(silencioso) {
        if (!S.event) return;
        await ensureAreas(S.event.room_id);
        if (!S.event) return;
        var id = S.event.id, mia = ++S.req;                              // cada carga tiene su número: la respuesta vieja se descarta, ninguna se pierde
        var r = await S.db.from('venue_event_tables').select('*').eq('event_id', id).order('table_key');
        if (mia !== S.req || !S.event || S.event.id !== id) return;      // llegó otra carga más nueva, o se cambió de evento
        if (r.error) {
            S.sinSql = sinSql(r.error);
            q$('#ct-open').hidden = true;
            body(S.sinSql ? '<p class="ct-empty">La venta de mesas todavía no está activada en la base de datos. Cuando Miami DJ Beat la active, aquí verás las mesas de cada evento.</p>'
                          : '<p class="ct-empty">No se pudieron cargar las mesas. Intenta de nuevo.</p>');
            return;
        }
        S.rows = r.data || [];
        render(silencioso);
    }

    // ── Dibujo ──
    function el(name, attrs, parent, text) { var n = document.createElementNS(NS, name); Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); }); if (text != null) n.textContent = text; if (parent) parent.appendChild(n); return n; }
    function chairsFor(t) {
        var pts = [], k, seats = t.seats || 4;
        if (t.t === 'round') { var rr = seats <= 4 ? 32 : 36; for (k = 0; k < seats; k++) { var an = (Math.PI * 2 * k) / seats; pts.push([Math.cos(an) * rr, Math.sin(an) * rr]); } }
        else if (t.t === 'square') { var d = (t.w || 54) / 2 + 10; pts = [[0, -d], [0, d], [-d, 0], [d, 0]]; }
        else { var per = seats / 2, dy = (t.h || 54) / 2 + 10, w = t.w || 108; for (k = 0; k < per; k++) { var cx = -w / 2 + (w * (k + 0.5)) / per; pts.push([cx, -dy], [cx, dy]); } }
        return pts;
    }
    function zoneBox(svg, r, label, rot, kind) {
        var fac = kind === 'bano' || kind === 'barra';
        el('rect', { 'class': 'zone' + (fac ? ' fac' : ''), x: r[0], y: r[1], width: r[2], height: r[3], rx: 10 }, svg);
        var cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2, a = { 'class': 'zone-label' + (fac ? ' fac' : ''), x: cx, y: cy + 4 };
        if (rot) a.transform = 'rotate(90 ' + cx + ' ' + (cy + 4) + ')';
        el('text', a, svg, label);
    }
    function drawPlan(svg, map, byKey, ahora, qn) {
        svg.innerHTML = '';
        svg.setAttribute('viewBox', '0 0 ' + ((map.room && map.room.w) || 800) + ' ' + ((map.room && map.room.h) || 520));
        if (map.custom) { if (root.mdjPlanShapes) root.mdjPlanShapes.dibujar(svg, map.shapes, map.room); }          // arquitectura dibujada en el editor de salas
        else {
            el('path', { d: 'M 340 505 H 12 V 12 H 788 V 505 H 460', fill: 'none', stroke: 'rgba(255,255,255,0.4)', 'stroke-width': 4, 'stroke-linejoin': 'round' }, svg);
            if (map.focal && map.focal.rect) zoneBox(svg, map.focal.rect, map.focal.label || '', map.focal.rot, map.focal.k);
            (map.fixed || []).forEach(function (f) { zoneBox(svg, f.r, f.l, f.rot, f.k); });
        }
        (map.tables || []).forEach(function (t) {
            var row = byKey[t.id]; if (!row) return;                         // solo mesas que existen en el inventario
            var est = estadoDe(row, ahora), libre = movible(row, ahora), pick = S.grupo && S.pick[t.id];
            var g = el('g', { 'class': 'tbl st-' + est + (S.grupo ? (S.pick[t.id] ? ' ct-pick' : '') + (libre ? ' ct-mov' : ' ct-fijo') : (S.sel === t.id ? ' ct-sel' : '')), role: 'button', tabindex: '0', 'data-id': t.id,
                'aria-label': 'Mesa ' + row.label + ', ' + ETIQUETA[est] + (row.buyer_name ? ', ' + row.buyer_name : '') + (S.grupo && libre ? (pick ? ', en el grupo' : ', toca para sumarla al grupo o arrástrala') : '') }, svg);
            if (qn && est !== 'available' && !coincide(row, qn)) g.setAttribute('class', g.getAttribute('class') + ' ct-dim');
            chairsFor({ t: t.t, w: t.w, h: t.h, seats: row.seats }).forEach(function (c) { el('circle', { 'class': 'seat', cx: t.x + c[0], cy: t.y + c[1], r: 5 }, g); });
            if (t.t === 'round') el('circle', { 'class': 'shape', cx: t.x, cy: t.y, r: row.seats <= 4 ? 22 : 26 }, g);
            else { var w = t.w || 54, h = t.h || w; el('rect', { 'class': 'shape', x: t.x - w / 2, y: t.y - h / 2, width: w, height: h, rx: 6 }, g); }
            el('text', { x: t.x, y: t.y }, g, row.label);
            el('text', { 'class': 'px', x: t.x, y: t.y + 12 }, g, est === 'available' ? dinero(row.price_cents) : (est === 'held' ? 'en pago' : (est === 'reserved' ? 'apartada' : 'vendida')));
            function elegir() { S.sel = t.id; render(false); }
            if (S.grupo) {
                if (libre) {
                    g.addEventListener('pointerdown', function (e) { arrastrarGrupo(e, t, g, svg, map); });
                    g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar(t.id); } });
                } else {
                    g.addEventListener('click', function () { avisoGrupo('La mesa ' + row.label + ' ya ' + (est === 'held' ? 'la está pagando un cliente' : 'está vendida') + ': no se puede mover ni sumar al grupo.', true); });
                }
            } else {
                g.addEventListener('click', elegir);
                g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(); } });
            }
        });
    }
    function coincide(row, qn) { return [row.table_key, row.label, row.buyer_name, row.reservation_name, row.note, row.zone_name].some(function (x) { return norm(x).indexOf(qn) >= 0; }); }

    function render(silencioso) {
        if (silencioso && S.arrastrando) return;       // no se redibuja a mitad de un arrastre
        var ahora = Date.now(), rows = S.rows, rs = resumen(rows, ahora);
        var abre = core.puedeAbrirVenta(S.venue.role);
        var openBtn = q$('#ct-open');
        if (!rows.length) {
            openBtn.hidden = !abre;
            var as = S.areas[S.event.room_id] || [];
            body(abre ? '<p class="ct-empty">La venta de mesas de este evento todavía no está abierta. Al abrirla se crea el inventario de mesas con el mapa de la sala, y los clientes pueden empezar a comprar.</p>' +
                        (as.length > 1 ? '<div class="ct-map-sum" id="ct-open-areas"><b>Áreas que se venden en este evento</b><br>' + as.map(function (a) { return '<label style="display:inline-flex;gap:6px;align-items:center;margin:6px 16px 0 0;"><input type="checkbox" value="' + esc(a.id) + '" checked' + (a.siempre ? ' disabled' : '') + '> ' + esc(a.label) + (a.siempre ? ' <small style="color:rgba(255,255,255,.55)">(siempre abierta)</small>' : '') + '</label>'; }).join('') +
                          '<br><small style="color:rgba(255,255,255,.6);">Normalmente se venden todas juntas. Desmarca un área solo en una ocasión especial (por ejemplo, el VIP cuando se separa con una pared).</small></div>' : '')
                      : '<p class="ct-empty">La venta de mesas de este evento todavía no está abierta. Pídele al dueño o a un manager que la abra.</p>');
            return;
        }
        openBtn.hidden = true;
        var maps = mapsDe(S.event.layout, rows);
        if (S.mapIdx >= maps.length) S.mapIdx = 0;
        var keepQ = S.q;
        var chips = [['available', 'Libres'], ['held', 'En pago'], ['reserved', 'Apartadas'], ['sold_online', 'Vendidas en línea'], ['sold_manager', 'Vendidas a mano']].map(function (p) {
            var col = { available: '#00c878', held: '#ffb400', reserved: '#ff6060', sold_online: '#ff6060', sold_manager: '#ff6060' }[p[0]];
            return '<span class="ct-chip"><i style="background:' + col + '"></i>' + p[1] + ' · ' + rs.counts[p[0]] + '</span>';
        }).join('');
        var html =
            '<div class="ct-chips">' + chips + '<span class="ct-chip" style="border-color:rgba(197,160,89,.5);color:#fcd34d;">Vendido: ' + dinero(rs.cents.online + rs.cents.manager) + ' (' + dinero(rs.cents.online) + ' en línea · ' + dinero(rs.cents.manager) + ' a mano)</span></div>' +
            '<div class="ct-bar"><input type="search" id="ct-q" placeholder="Buscar por nombre de quien renta, reserva o mesa (ej. Alicia)" value="' + esc(keepQ) + '" aria-label="Buscar mesa">' +
            '<button type="button" class="cc-btn2' + (S.grupo ? ' ct-on' : '') + '" id="ct-grupo" aria-pressed="' + S.grupo + '">' + (S.grupo ? 'Salir de «Armar grupo»' : 'Armar grupo') + '</button></div>' +
            (maps.length > 1 ? '<div class="ct-tabs" role="tablist">' + maps.map(function (m, i) { return '<button type="button" role="tab" data-i="' + i + '" aria-selected="' + (i === S.mapIdx) + '">' + esc(m.label || 'Mapa') + '</button>'; }).join('') + '</div>' : '') +
            areasHtml(maps) +
            '<div class="ct-grid"><div><div class="ct-wrap"><svg class="ct-plan" id="ct-plan" viewBox="0 0 800 520" role="group" aria-label="Plano de la sala"></svg></div>' +
            '<div class="ct-leg"><span><i style="background:#00c878"></i>Libre</span><span><i style="background:#ffb400"></i>En pago (el cliente está pagando)</span><span><i style="background:#ff6060"></i>Apartada / vendida</span></div></div>' +
            '<div class="ct-side" id="ct-side"></div></div><div class="ct-list" id="ct-list"></div>';
        // No se redibuja el formulario si el staff está escribiendo en él (el refresco automático no debe borrarle lo escrito).
        var escribiendo = silencioso && S.box.contains(document.activeElement) && document.activeElement.closest && document.activeElement.closest('#ct-side');
        var sideKeep = escribiendo ? q$('#ct-side') : null, sideHtml = sideKeep ? sideKeep.innerHTML : null;
        var qKeep = silencioso && document.activeElement && document.activeElement.id === 'ct-q';
        body(html);
        if (sideKeep) q$('#ct-side').innerHTML = sideHtml;
        var byKey = {}; rows.forEach(function (r) { byKey[r.table_key] = r; });
        drawPlan(q$('#ct-plan'), maps[S.mapIdx], byKey, ahora, norm(S.q).trim());
        [].forEach.call(S.box.querySelectorAll('.ct-tabs button'), function (b) { b.addEventListener('click', function () { S.mapIdx = Number(b.dataset.i); render(false); }); });
        wireAreas();
        q$('#ct-grupo').addEventListener('click', function () { S.grupo = !S.grupo; S.pick = {}; S.sel = null; render(false); });
        var qi = q$('#ct-q');
        qi.addEventListener('input', function () { S.q = qi.value; var pos = qi.selectionStart; render(false); var n = q$('#ct-q'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* ok */ } });
        if (qKeep) { qi.focus(); try { qi.setSelectionRange(qi.value.length, qi.value.length); } catch (e) { /* ok */ } }
        if (!escribiendo) renderSide(byKey, ahora);
        renderList(rows, ahora);
    }

    function renderList(rows, ahora) {
        var lista = buscar(rows, S.q, ahora), box = q$('#ct-list');
        if (!lista.length) { box.innerHTML = '<p class="ct-empty">' + (S.q ? 'Ninguna mesa coincide con «' + esc(S.q) + '».' : 'Todavía no hay mesas apartadas ni vendidas.') + '</p>'; return; }
        box.innerHTML = '<div class="cc-sub" style="margin-top:0;border-top:none;">Mesas apartadas y vendidas</div>' + lista.map(function (r) {
            var e = estadoDe(r, ahora), quien = r.reservation_name && r.reservation_name !== r.buyer_name ? r.buyer_name + ' · «' + r.reservation_name + '»' : (r.buyer_name || '—');
            return '<div class="ct-row" data-k="' + esc(r.table_key) + '"><span><b>Mesa ' + esc(r.label) + '</b> · ' + esc(r.zone_name || '') + '<small>' + esc(quien) + (r.note ? ' — ' + esc(r.note) : '') + '</small></span><span style="text-align:right;">' + ETIQUETA[e] + '<small>' + dinero(r.price_cents) + '</small></span></div>';
        }).join('');
        [].forEach.call(box.querySelectorAll('.ct-row'), function (d) { d.addEventListener('click', function () { S.sel = d.dataset.k; render(false); }); });
    }

    function renderSide(byKey, ahora) {
        if (S.grupo) { renderSideGrupo(byKey, ahora); return; }
        var side = q$('#ct-side'), r = S.sel && byKey[S.sel];
        if (!r) { side.innerHTML = '<h3>Elige una mesa</h3><small>Toca una mesa del plano para ver su estado y apartarla o venderla.</small>'; return; }
        var est = estadoDe(r, ahora), quien = r.buyer_name || '';
        var h = '<h3>Mesa ' + esc(r.label) + '</h3><small>' + esc(r.zone_name || '') + ' · ' + r.seats + ' sillas · ' + dinero(r.price_cents) + '</small>' +
            '<p style="margin:12px 0 0;font-weight:800;color:' + (est === 'available' ? '#00c878' : (est === 'held' ? '#ffb400' : '#ff6060')) + ';">' + ETIQUETA[est] + '</p>';
        if (est === 'held') h += '<p class="ct-empty">El cliente está pagando. Se libera sola si no termina' + (r.held_until ? ' (antes de las ' + new Date(r.held_until).toLocaleTimeString('es-US', { hour: 'numeric', minute: '2-digit' }) + ')' : '') + '. Espera a que termine o venza.</p>';
        if (est === 'sold_online') h += '<p class="ct-empty"><b style="color:#fff;">' + esc(r.buyer_name || '—') + '</b>' + (r.reservation_name && r.reservation_name !== r.buyer_name ? '<br>Reserva: «' + esc(r.reservation_name) + '»' : '') + (r.order_id ? '<br>Pedido ' + esc(codigo(r.order_id)) : '') + '<br>Se pagó en línea: para devolverla hay que reembolsar el pago (pídelo al dueño).</p>';
        if (est === 'sold_manager' || est === 'reserved') h += '<p class="ct-empty"><b style="color:#fff;">' + esc(quien || '—') + '</b>' + (r.note ? '<br>' + esc(r.note) : '') + '</p>';
        if (est === 'available' || est === 'reserved' || est === 'sold_manager') {
            if (est !== 'sold_manager') h += '<label for="ct-name">Nombre de quien renta</label><input id="ct-name" type="text" maxlength="80" value="' + esc(quien) + '" autocomplete="off">' +
                '<label for="ct-note">Nota (opcional)</label><input id="ct-note" type="text" maxlength="120" value="' + esc(r.note || '') + '" autocomplete="off">';
            h += '<div class="ct-btns">';
            if (est === 'available') h += '<button type="button" class="cc-btn2" data-act="reserve">Apartar</button><button type="button" class="btn primary" data-act="sell">Vender a mano</button>';
            if (est === 'reserved') h += '<button type="button" class="btn primary" data-act="sell">Vender a mano</button><button type="button" class="cc-btn2" data-act="release">Liberar</button>';
            if (est === 'sold_manager') h += '<button type="button" class="cc-btn2" data-act="release">Liberar</button>';
            h += '</div>';
        }
        h += '<p class="ct-msg" id="ct-msg" role="status"></p>';
        side.innerHTML = h;
        [].forEach.call(side.querySelectorAll('[data-act]'), function (b) { b.addEventListener('click', function () { actuar(b.dataset.act, r); }); });
    }

    async function actuar(accion, r) {
        var msg = q$('#ct-msg'), nameI = q$('#ct-name'), noteI = q$('#ct-note');
        var name = nameI ? nameI.value.trim() : '', note = noteI ? noteI.value.trim() : '';
        if (accion === 'sell' && name.length < 1) { msg.style.color = '#ff6060'; msg.textContent = ERRORES.falta_nombre_de_quien_renta; if (nameI) nameI.focus(); return; }
        if (accion === 'release' && !confirm('¿Liberar la mesa ' + r.label + '? Volverá a estar disponible para la venta.')) return;
        [].forEach.call(S.box.querySelectorAll('[data-act]'), function (b) { b.disabled = true; });
        msg.style.color = 'rgba(255,255,255,.8)'; msg.textContent = 'Guardando…';
        var res = await S.db.rpc('venue_staff_set_table', { p_event_id: S.event.id, p_key: r.table_key, p_action: accion, p_name: name || null, p_note: note || null });
        if (res.error) {
            msg.style.color = '#ff6060'; msg.textContent = msgError(res.error);
            [].forEach.call(S.box.querySelectorAll('[data-act]'), function (b) { b.disabled = false; });
            loadRows(false); return;
        }
        S.sel = accion === 'release' ? null : r.table_key;
        await loadRows(false);
        var m2 = q$('#ct-msg'); if (m2) { m2.style.color = '#00c878'; m2.textContent = { reserve: 'Mesa apartada.', sell: 'Mesa vendida.', release: 'Mesa liberada.' }[accion] || 'Listo.'; }
    }

    // ── Armar grupo: juntar mesas libres moviéndolas en el plano de ESTE evento y venderlas con un solo nombre ──
    // La sala (paredes, escenario, baños, barra) no cambia; solo cambia dónde están las mesas ese día. Lo hace cualquiera que pueda vender (dueño, manager, equipo).
    function avisoGrupo(txt, error) { var m = q$('#ct-msg'); if (m) { m.style.color = error ? '#ff6060' : '#00c878'; m.textContent = txt; } }
    function alternar(k) { if (S.pick[k]) delete S.pick[k]; else S.pick[k] = true; render(false); }
    function arrastrarGrupo(ev, t, g, svg, map) {
        ev.preventDefault();
        var llevadas = S.pick[t.id] ? Object.keys(S.pick) : [t.id];           // si la tocada no estaba en el grupo, se mueve sola
        var geo = llevadas.map(function (k) { return (map.tables || []).filter(function (x) { return x.id === k; })[0]; }).filter(Boolean);
        var nodos = geo.map(function (x) { return svg.querySelector('[data-id="' + String(x.id).replace(/"/g, '') + '"]'); }).filter(Boolean);
        try { g.setPointerCapture(ev.pointerId); } catch (e) { /* sin captura */ }
        function pos(e) { var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; var m = svg.getScreenCTM(); return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 }; }
        var ini = pos(ev), cx = ev.clientX, cy = ev.clientY, dx = 0, dy = 0, movido = false;
        S.arrastrando = true;
        function mover(e) {
            if (!movido && Math.abs(e.clientX - cx) + Math.abs(e.clientY - cy) < 6) return;      // un toque corto no es arrastre
            movido = true; var p = pos(e);
            dx = core.ajustar(p.x - ini.x, -9999, 9999); dy = core.ajustar(p.y - ini.y, -9999, 9999);
            geo.forEach(function (x) { dx = Math.min(((map.room && map.room.w) || 800) - 26 - x.x, Math.max(26 - x.x, dx)); dy = Math.min(((map.room && map.room.h) || 520) - 26 - x.y, Math.max(26 - x.y, dy)); });   // todo el grupo dentro del plano
            nodos.forEach(function (n) { n.setAttribute('transform', 'translate(' + dx + ',' + dy + ')'); });
        }
        function soltar() {
            g.removeEventListener('pointermove', mover); g.removeEventListener('pointerup', soltar); g.removeEventListener('pointercancel', soltar); S.arrastrando = false;
            if (!movido) { alternar(t.id); return; }
            if (!(dx || dy)) { nodos.forEach(function (n) { n.removeAttribute('transform'); }); return; }
            if (!S.pick[t.id]) { S.pick = {}; S.pick[t.id] = true; }
            var moves = geo.map(function (x) { return { key: x.id, x: x.x + dx, y: x.y + dy }; });
            var choca = null; moves.forEach(function (m) { choca = choca || core.bloqueaEstructura(map, m.x, m.y); });
            if (choca) { nodos.forEach(function (n) { n.removeAttribute('transform'); }); render(false); avisoGrupo('Ahí está ' + choca + ': no se puede poner una mesa encima.', true); return; }
            moverMesas(moves);
        }
        g.addEventListener('pointermove', mover); g.addEventListener('pointerup', soltar); g.addEventListener('pointercancel', soltar);
    }
    async function moverMesas(moves) {
        avisoGrupo('Moviendo…', false);
        var res = await S.db.rpc('venue_event_move_tables', { p_event_id: S.event.id, p_moves: moves });
        if (res.error) {
            var sinFn = res.error.code === 'PGRST202' || res.error.code === '42883' || /could not find the function|schema cache/i.test(res.error.message || '');
            await refrescarLayout(true); render(false);
            avisoGrupo(sinFn ? '«Armar grupo» todavía no está activado en la base de datos.' : msgError(res.error), true); return;
        }
        await refrescarLayout(true); render(false);
        avisoGrupo(moves.length === 1 ? 'Mesa movida. Los clientes ven el cambio solo.' : moves.length + ' mesas movidas. Los clientes ven el cambio solo.', false);
    }
    // Trae el plano del evento (otro vendedor pudo haber movido mesas) y lo redibuja solo si cambió.
    async function refrescarLayout(forzar) {
        if (!S.event || S.arrastrando) return;
        var id = S.event.id, r = await S.db.from('venue_events').select('layout').eq('id', id).maybeSingle();
        if (r.error || !r.data || !S.event || S.event.id !== id || S.arrastrando) return;
        var antes = JSON.stringify((S.event.layout || {}).maps || null), despues = JSON.stringify((r.data.layout || {}).maps || null);
        S.event.layout = r.data.layout;
        if (despues !== antes && !forzar && S.rows.length) render(true);
    }
    function renderSideGrupo(byKey, ahora) {
        var side = q$('#ct-side'), rows = S.rows;
        Object.keys(S.pick).forEach(function (k) { if (!byKey[k] || !movible(byKey[k], ahora)) delete S.pick[k]; });          // si alguien la vendió mientras tanto, sale del grupo
        var claves = Object.keys(S.pick), gr = core.grupoResumen(rows, claves, ahora);
        var h = '<h3>Armar grupo</h3><small>Toca mesas libres para sumarlas, o arrástralas para juntarlas. Las vendidas o en pago no se mueven.</small>';
        if (!claves.length) {
            h += '<p class="ct-empty" style="margin-top:12px;">Todavía no hay mesas en el grupo.</p><p class="ct-msg" id="ct-msg" role="status"></p>';
            side.innerHTML = h; return;
        }
        h += '<p style="margin:12px 0 0;font-weight:800;color:#fff;">' + gr.mesas + ' ' + (gr.mesas === 1 ? 'mesa' : 'mesas') + ' · ' + gr.sillas + ' sillas</p><small>Total de lista: ' + dinero(gr.cents) + ' (' + esc(claves.map(function (k) { return byKey[k].label; }).join(', ')) + ')</small>' +
            '<label for="ct-gpeople">Personas del grupo (opcional)</label><input id="ct-gpeople" type="number" min="1" max="200" inputmode="numeric" value="' + esc(S.gpeople) + '"><p class="ct-msg" id="ct-gcap"></p>' +
            '<label for="ct-gname">Nombre de quien renta</label><input id="ct-gname" type="text" maxlength="80" autocomplete="off" value="' + esc(S.gname) + '">' +
            '<label for="ct-gnote">Nota (opcional)</label><input id="ct-gnote" type="text" maxlength="120" autocomplete="off" value="' + esc(S.gnote) + '">' +
            '<div class="ct-btns"><button type="button" class="btn primary" data-gact="sell">Vender grupo</button><button type="button" class="cc-btn2" data-gact="reserve">Apartar grupo</button><button type="button" class="cc-btn2" data-gact="clear">Quitar selección</button></div><p class="ct-msg" id="ct-msg" role="status"></p>';
        side.innerHTML = h;
        function capacidad() {
            var n = Number(q$('#ct-gpeople').value), c = q$('#ct-gcap'); S.gpeople = q$('#ct-gpeople').value;
            if (!n) { c.textContent = ''; return; }
            c.style.color = gr.sillas >= n ? '#00c878' : '#ffb400';
            c.textContent = gr.sillas >= n ? 'Alcanzan: ' + gr.sillas + ' sillas para ' + n + '.' : 'Faltan ' + (n - gr.sillas) + ' sillas: suma otra mesa.';
        }
        q$('#ct-gpeople').addEventListener('input', capacidad); capacidad();
        q$('#ct-gname').addEventListener('input', function () { S.gname = q$('#ct-gname').value; });
        q$('#ct-gnote').addEventListener('input', function () { S.gnote = q$('#ct-gnote').value; });
        [].forEach.call(side.querySelectorAll('[data-gact]'), function (b) { b.addEventListener('click', function () { grupoActuar(b.dataset.gact, claves, byKey); }); });
    }
    async function grupoActuar(accion, claves, byKey) {
        if (accion === 'clear') { S.pick = {}; render(false); return; }
        var name = (q$('#ct-gname').value || '').trim(), note = (q$('#ct-gnote').value || '').trim();
        if (accion === 'sell' && !name) { avisoGrupo(ERRORES.falta_nombre_de_quien_renta, true); q$('#ct-gname').focus(); return; }
        var etiquetas = claves.map(function (k) { return byKey[k].label; }).join(', ');
        if (accion === 'sell' && !window.confirm('¿Vender a mano las mesas ' + etiquetas + ' a nombre de «' + name + '»?')) return;
        [].forEach.call(S.box.querySelectorAll('[data-gact]'), function (b) { b.disabled = true; });
        avisoGrupo('Guardando…', false);
        var res = await S.db.rpc('venue_staff_set_tables', { p_event_id: S.event.id, p_keys: claves, p_action: accion, p_name: name || null, p_note: note || null });
        if (res.error) {
            var sinFn = res.error.code === 'PGRST202' || res.error.code === '42883' || /could not find the function|schema cache/i.test(res.error.message || '');
            await loadRows(false); avisoGrupo(sinFn ? '«Armar grupo» todavía no está activado en la base de datos.' : msgError(res.error) + ' No se vendió ninguna mesa del grupo.', true); return;
        }
        S.pick = {}; S.gname = ''; S.gnote = ''; S.gpeople = '';
        await loadRows(false);
        avisoGrupo(accion === 'sell' ? res.data + ' mesas vendidas a nombre de «' + name + '».' : res.data + ' mesas apartadas.', false);
    }

    // Áreas del evento (una sala puede tener varios planos): casi siempre se venden todas juntas; en una ocasión especial se cierra una.
    function areasHtml(mapsEvento) {
        var as = S.areas[S.event.room_id] || [];
        if (!core.puedeAbrirVenta(S.venue.role) || as.length < 2) return '';
        var activas = core.areasActivas(S.event.layout);
        return '<details class="ct-map" id="ct-areas"><summary>Áreas de este evento</summary><div class="ct-map-in"><div class="ct-map-sum" style="margin-top:6px;">' +
            as.map(function (a) { return '<label style="display:inline-flex;gap:6px;align-items:center;margin:6px 16px 0 0;"><input type="checkbox" value="' + esc(a.id) + '"' + (activas[a.id] || a.siempre ? ' checked' : '') + (a.siempre ? ' disabled' : '') + '> ' + esc(a.label) + (a.siempre ? ' <small style="color:rgba(255,255,255,.55)">(siempre abierta)</small>' : '') + '</label>'; }).join('') +
            '<br><small style="color:rgba(255,255,255,.6);">Desmarca un área para cerrarla en este evento. No se puede cerrar un área con mesas vendidas, apartadas o en pago.</small></div>' +
            '<div class="ct-btns"><button type="button" class="cc-btn2" id="ct-areas-set">Aplicar áreas</button></div><p class="ct-msg" id="ct-areas-msg" role="status"></p></div></details>';
    }
    function wireAreas() {
        var b = q$('#ct-areas-set'); if (!b) return;
        b.addEventListener('click', async function () {
            var msg = q$('#ct-areas-msg'), marcadas = [].map.call(S.box.querySelectorAll('#ct-areas input:checked'), function (i) { return i.value; }), total = (S.areas[S.event.room_id] || []).length;
            if (!marcadas.length) { msg.style.color = '#ff6060'; msg.textContent = ERRORES.areas_invalidas; return; }
            if (!window.confirm('¿Vender en este evento solo: ' + marcadas.join(', ') + '?')) return;
            b.disabled = true; msg.style.color = ''; msg.textContent = 'Guardando…';
            var res = await S.db.rpc('venue_event_open_tables', { p_event_id: S.event.id, p_maps: marcadas.length === total ? null : marcadas });
            b.disabled = false;
            if (res.error) {
                var sinFn = res.error.code === 'PGRST202' || res.error.code === '42883' || /could not find the function|schema cache/i.test(res.error.message || '');
                msg.style.color = '#ff6060'; msg.textContent = sinFn ? 'Elegir áreas todavía no está activado en la base de datos.' : msgError(res.error); return;
            }
            await loadEvents();
            var m2 = q$('#ct-areas-msg'); if (m2) { m2.style.color = '#00c878'; m2.textContent = 'Áreas actualizadas.'; }
        });
    }
    async function openSales() {
        if (!S.event) return;
        var as = S.areas[S.event.room_id] || [], marcadas = [].map.call(S.box.querySelectorAll('#ct-open-areas input:checked'), function (i) { return i.value; });
        if (as.length > 1 && S.box.querySelector('#ct-open-areas') && !marcadas.length) { body('<p class="ct-empty" style="color:#ff6060;">' + esc(ERRORES.areas_invalidas) + '</p>'); render(false); return; }
        var args = { p_event_id: S.event.id };
        if (as.length > 1 && marcadas.length && marcadas.length < as.length) args.p_maps = marcadas;      // solo si se cerró alguna: lo habitual es abrir todas
        var btn = q$('#ct-open'); btn.disabled = true; btn.textContent = 'Abriendo…';
        var res = await S.db.rpc('venue_event_open_tables', args);
        btn.disabled = false; btn.textContent = 'Abrir la venta de mesas';
        if (res.error) { body('<p class="ct-empty" style="color:#ff6060;">' + esc(msgError(res.error)) + '</p>'); btn.hidden = false; return; }
        // El evento ahora trae su mapa (copia de la sala) y tables_open: se recarga todo.
        await loadEvents();
    }

    root.mdjStaffTables = { init: init, onShow: onShow, core: core };
})(typeof window !== 'undefined' ? window : globalThis);
