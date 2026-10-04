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


    // ── Editor visual del plano (lógica pura: se prueba en Node) ──
    var ED_W = 800, ED_H = 520, ED_MARGEN = 26, ED_PASO = 10;
    function planoVacio() {
        return { id: 'sala', label: 'Sala', focal: { x: 400, y: 52, rect: [280, 24, 240, 56], label: 'ESCENARIO / DJ' }, fixed: [], zones: [{ name: 'Mesas', maxD: 9999, price: 0 }], tables: [] };
    }
    function siguienteClave(usadas) {   // «M1», «M2»… la primera que no esté en uso
        var n = 1; while (usadas['M' + n]) n++; return 'M' + n;
    }
    function ajustar(v, min, max) { return Math.min(max, Math.max(min, Math.round(v / ED_PASO) * ED_PASO)); }
    function lugarLibre(mesas) {         // un punto libre del plano para una mesa nueva (no encima de otra)
        var ocupado = function (x, y) { return mesas.some(function (m) { return Math.abs(m.x - x) < 56 && Math.abs(m.y - y) < 56; }); };
        for (var y = 160; y <= ED_H - ED_MARGEN - 40; y += 70) for (var x = 100; x <= ED_W - 100; x += 70) if (!ocupado(x, y)) return { x: x, y: y };
        return { x: 400, y: 300 };
    }
    var FORMAS = { round: { nombre: 'Redonda' }, square: { nombre: 'Cuadrada', w: 54 }, rect: { nombre: 'Larga', w: 108, h: 54 } };
    // Une el dibujo (maps[].tables con x/y/forma) con los datos de venta (meta[clave]: etiqueta, sillas, zona, precio) y arma el layout que guarda la base:
    // maps = geometría para dibujar (lo lee la página pública); tables = inventario (lo lee la base). La clave de la mesa es el id del dibujo.
    function construirMapa(base, maps, meta) {
        var out = {}, k; for (k in (base || {})) out[k] = base[k];
        var tablas = [];
        out.maps = (maps || []).map(function (m) {
            var c = {}, kk; for (kk in m) c[kk] = m[kk];
            if (!c.focal) c.focal = planoVacio().focal;
            if (!Array.isArray(c.fixed)) c.fixed = [];
            if (!Array.isArray(c.zones) || !c.zones.length) c.zones = [{ name: 'Mesas', maxD: 9999, price: 0 }];   // la página pública exige al menos una zona
            c.tables = (m.tables || []).map(function (g) {
                var d = meta[g.id] || {}, o = { id: g.id, t: g.t, x: g.x, y: g.y, seats: d.seats };
                if (g.w) o.w = g.w; if (g.h) o.h = g.h;
                tablas.push({ key: g.id, label: d.label || g.id, seats: d.seats, zone: d.zone || 'Mesas', price_cents: d.price_cents });
                return o;
            });
            return c;
        });
        out.tables = tablas;
        return out;
    }


    // ── «Armar grupo» (lógica pura) ──
    function movible(row, ahora) { var e = estadoDe(row, ahora); return e === 'available' || e === 'reserved'; }   // vendida o con alguien pagando: no se mueve ni se suma
    // Resumen del grupo elegido: mesas, sillas y total sugerido (suma de precios de lista). `ocupadas` = claves que ya no se pueden usar.
    function grupoResumen(rows, claves, ahora) {
        var por = {}; rows.forEach(function (r) { por[r.table_key] = r; });
        var out = { mesas: 0, sillas: 0, cents: 0, ocupadas: [] };
        claves.forEach(function (k) { var r = por[k]; if (!r || !movible(r, ahora)) { out.ocupadas.push(k); return; } out.mesas++; out.sillas += r.seats || 0; out.cents += r.price_cents || 0; });
        return out;
    }
    // La arquitectura de la sala no cambia: una mesa no puede quedar encima del escenario ni de los elementos fijos «bano» / «barra» (la pista no cuenta).
    // Mismo cálculo (margen de 22 px) que venue_plano_bloquea en la base, que es quien lo exige de verdad.
    function bloqueaEstructura(map, x, y) {
        function dentro(r) { return Array.isArray(r) && r.length === 4 && x >= r[0] - 22 && x <= r[0] + r[2] + 22 && y >= r[1] - 22 && y <= r[1] + r[3] + 22; }
        if (map && map.focal && dentro(map.focal.rect)) return map.focal.label || 'el escenario';
        var hit = ((map && map.fixed) || []).filter(function (f) { return (f.k === 'bano' || f.k === 'barra') && dentro(f.r); })[0];
        return hit ? (hit.l || 'una estructura de la sala') : null;
    }

    // Revisa el archivo de mapa ANTES de mandarlo a la base (mismas reglas que venue_room_set_layout; la base vuelve a revisar, esto es para avisar bien).
    // Acepta {tables:[...], maps?:[...]} o una lista de mesas sola. Devuelve { ok, errores[], avisos[], mesas, sillas, zonas[{nombre,mesas,min,max}], precioMin, precioMax, layout }.
    function validarMapa(input) {
        var out = { ok: false, errores: [], avisos: [], mesas: 0, sillas: 0, zonas: [], precioMin: null, precioMax: null, layout: null };
        var obj = input;
        if (typeof input === 'string') { try { obj = JSON.parse(input); } catch (e) { out.errores.push('El archivo no es un JSON válido.'); return out; } }
        if (Array.isArray(obj)) obj = { tables: obj };
        if (!obj || typeof obj !== 'object' || !Array.isArray(obj.tables)) { out.errores.push('Falta la lista «tables» con las mesas.'); return out; }
        var t = obj.tables, claves = {}, zonas = {}, ent = function (n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; };
        if (t.length < 1 || t.length > 300) out.errores.push('El mapa debe tener entre 1 y 300 mesas (tiene ' + t.length + ').');
        if (obj.maps !== undefined && !Array.isArray(obj.maps)) out.errores.push('«maps» (el dibujo del plano) debe ser una lista.');
        t.forEach(function (m, i) {
            var n = 'Mesa #' + (i + 1), e = [];
            if (!m || typeof m !== 'object' || Array.isArray(m)) { out.errores.push(n + ': no es una mesa válida.'); return; }
            if (typeof m.key !== 'string' || !m.key.trim()) e.push('falta la clave («key»)');
            else if (m.key.length > 20) e.push('la clave tiene más de 20 caracteres');
            else if (claves[m.key]) e.push('la clave «' + m.key + '» está repetida');
            else claves[m.key] = true;
            if (!ent(m.price_cents) || m.price_cents < 0 || m.price_cents > 1000000) e.push('el precio («price_cents», en centavos) debe ser un entero de 0 a 1000000');
            if (m.seats !== undefined && (!ent(m.seats) || m.seats < 1 || m.seats > 40)) e.push('las sillas («seats») deben ser un entero de 1 a 40');
            if (e.length) { out.errores.push((typeof m.key === 'string' && m.key.trim() ? 'Mesa ' + m.key : n) + ': ' + e.join('; ') + '.'); return; }
            out.mesas++; out.sillas += (m.seats === undefined ? 4 : m.seats);
            var z = (typeof m.zone === 'string' && m.zone.trim()) ? m.zone.trim() : 'Sin zona', zz = zonas[z] || (zonas[z] = { nombre: z, mesas: 0, min: Infinity, max: -Infinity });
            zz.mesas++; zz.min = Math.min(zz.min, m.price_cents); zz.max = Math.max(zz.max, m.price_cents);
            out.precioMin = out.precioMin === null ? m.price_cents : Math.min(out.precioMin, m.price_cents);
            out.precioMax = out.precioMax === null ? m.price_cents : Math.max(out.precioMax, m.price_cents);
        });
        out.zonas = Object.keys(zonas).map(function (k) { return zonas[k]; });
        if (obj.maps === undefined || !obj.maps.length) out.avisos.push('El archivo no trae el dibujo del plano («maps»): la página pública usa el plano de muestra y solo dibuja las mesas M1 a M36.');
        out.ok = out.errores.length === 0;
        if (out.ok) out.layout = obj;
        return out;
    }

    var core = { estadoDe: estadoDe, movible: movible, grupoResumen: grupoResumen, bloqueaEstructura: bloqueaEstructura, validarMapa: validarMapa, planoVacio: planoVacio, siguienteClave: siguienteClave, lugarLibre: lugarLibre, ajustar: ajustar, construirMapa: construirMapa, FORMAS: FORMAS, resumen: resumen, buscar: buscar, gridMaps: gridMaps, mapsDe: mapsDe, dinero: dinero, codigo: codigo, puedeAbrirVenta: function (role) { return !!ROLES_ABREN_VENTA[role]; } };
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
        grupo_invalido: 'El grupo debe tener entre 1 y 40 mesas, sin repetir.'
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
            '.ct-map-in input[type=file] { color:rgba(255,255,255,.8); font-size:13px; max-width:100%; } .ct-map-in select { padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,.18); background:rgba(0,0,0,.35); color:#fff; font:inherit; font-size:14px; }',
            '.ct-map-sum { margin:12px 0 0; padding:12px 14px; border-radius:10px; background:rgba(0,0,0,.3); border:1px solid rgba(255,255,255,.1); font-size:13px; color:rgba(255,255,255,.85); line-height:1.6; } .ct-map-sum b { color:#fff; }',
            '.ct-ed-tools { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin:12px 0 10px; } .ct-ed-tools .cc-btn2 { display:inline-flex; align-items:center; gap:6px; } .ct-ed-tools select { padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,.18); background:rgba(0,0,0,.35); color:#fff; font:inherit; font-size:13px; }',
            '.ct-ed-hint { display:inline-flex; align-items:center; gap:6px; font-size:12px; color:rgba(255,255,255,.6); } .ct-ed-grid { display:grid; grid-template-columns:minmax(0,1.7fr) minmax(220px,1fr); gap:14px; align-items:start; } @media (max-width: 860px) { .ct-ed-grid { grid-template-columns:1fr; } }',
            '.ct-step { display:flex; align-items:center; gap:8px; } .ct-step .cc-btn2 { padding:7px 12px; display:inline-flex; } #ed-svg { user-select:none; -webkit-user-select:none; } #ed-svg .tbl:focus { outline:none; } #ed-svg .tbl:focus-visible .shape { stroke:#fcd34d; stroke-width:4; }',
            '.ct-map-in button:disabled { opacity:.45; cursor:not-allowed; }',
            '.ct-map-err { color:#ff9a9a; } .ct-map-warn { color:#ffd27a; } .ct-map-ok { color:#00c878; }',
            '.ct-empty { color:rgba(255,255,255,.65); line-height:1.6; padding:6px 0; } .ct-leg { display:flex; flex-wrap:wrap; gap:14px; font-size:12px; color:rgba(255,255,255,.65); margin:8px 0 0; } .ct-leg i { display:inline-block; width:10px; height:10px; border-radius:3px; margin-right:6px; }'
        ].join('\n');
        document.head.appendChild(s);
    }

    var S = { db: null, box: null, venues: [], venue: null, events: [], event: null, rows: [], mapIdx: 0, sel: null, q: '', timer: null, sinSql: false, req: 0, grupo: false, pick: {}, gname: '', gnote: '', gpeople: '', arrastrando: false };
    var NS = 'http://www.w3.org/2000/svg';

    function init(o) {
        css();
        S.db = o.db; S.box = o.box; S.venues = o.venues || [];
        S.venue = null; S.events = []; S.event = null; S.rows = []; S.mapIdx = 0; S.sel = null; S.q = ''; S.sinSql = false; S.req++; S.grupo = false; S.pick = {}; S.gname = ''; S.gnote = ''; S.gpeople = '';   // estado limpio en cada arranque
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
            '<div id="ct-mapbox"></div><div id="ct-body"></div>';
        if (multi) {
            var sv = q$('#ct-venue');
            S.venues.forEach(function (v, i) { var op = document.createElement('option'); op.value = i; op.textContent = v.name; sv.appendChild(op); });
            sv.addEventListener('change', function () { S.venue = S.venues[Number(sv.value)]; S.event = null; S.rows = []; S.sel = null; buildMapPanel(); loadEvents(); });
        }
        q$('#ct-event').addEventListener('change', function () { S.event = S.events.filter(function (e) { return e.id === q$('#ct-event').value; })[0] || null; S.sel = null; S.pick = {}; S.mapIdx = 0; loadRows(false); });
        q$('#ct-open').addEventListener('click', openSales);
        buildMapPanel();
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

    async function loadRows(silencioso) {
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
        el('path', { d: 'M 340 505 H 12 V 12 H 788 V 505 H 460', fill: 'none', stroke: 'rgba(255,255,255,0.4)', 'stroke-width': 4, 'stroke-linejoin': 'round' }, svg);
        if (map.focal && map.focal.rect) zoneBox(svg, map.focal.rect, map.focal.label || '', map.focal.rot, map.focal.k);
        (map.fixed || []).forEach(function (f) { zoneBox(svg, f.r, f.l, f.rot, f.k); });
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
            body(abre ? '<p class="ct-empty">La venta de mesas de este evento todavía no está abierta. Al abrirla se crea el inventario de mesas con el mapa de la sala, y los clientes pueden empezar a comprar.</p>'
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
            geo.forEach(function (x) { dx = Math.min(774 - x.x, Math.max(26 - x.x, dx)); dy = Math.min(494 - x.y, Math.max(26 - x.y, dy)); });   // todo el grupo dentro del plano
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

    async function openSales() {
        if (!S.event) return;
        var btn = q$('#ct-open'); btn.disabled = true; btn.textContent = 'Abriendo…';
        var res = await S.db.rpc('venue_event_open_tables', { p_event_id: S.event.id });
        btn.disabled = false; btn.textContent = 'Abrir la venta de mesas';
        if (res.error) { body('<p class="ct-empty" style="color:#ff6060;">' + esc(msgError(res.error)) + '</p>'); btn.hidden = false; return; }
        // El evento ahora trae su mapa (copia de la sala) y tables_open: se recarga todo.
        await loadEvents();
    }

    // ── Mapa de la sala: fijar la plantilla de mesas desde un archivo (solo dueño y manager; la base lo vuelve a exigir) ──
    var MAPA_EJEMPLO = { tables: [
        { key: 'M1', label: 'M1', seats: 4, zone: 'Zona 1 · Frente al escenario', price_cents: 40000 },
        { key: 'M2', label: 'M2', seats: 4, zone: 'Zona 1 · Frente al escenario', price_cents: 40000 },
        { key: 'M3', label: 'M3', seats: 6, zone: 'Zona 2 · Centro', price_cents: 25000 } ] };
    var _mapa = null;   // resultado de validarMapa del archivo elegido
    function buildMapPanel() {
        var box = q$('#ct-mapbox'); if (!box) return;
        _mapa = null;
        if (!core.puedeAbrirVenta(S.venue && S.venue.role) || !(S.venue.rooms || []).length) { box.innerHTML = ''; return; }
        var rooms = S.venue.rooms;
        box.innerHTML = '<details class="ct-map" id="ct-map"><summary>Mapa de la sala</summary><div class="ct-map-in">' +
            (rooms.length > 1 ? '<label for="ct-map-room" style="display:block;font-size:12px;font-weight:700;color:rgba(255,255,255,.55);margin:6px 0;">SALA</label><select id="ct-map-room">' + rooms.map(function (r, i) { return '<option value="' + i + '">' + esc(r.name) + '</option>'; }).join('') + '</select>' : '') +
            '<p class="ct-empty" id="ct-map-now" style="margin:8px 0 0;">Cargando el mapa actual…</p>' +
            '<div class="ct-btns"><button type="button" class="cc-btn2" id="ct-ed-open">Editar el plano</button></div><div id="ct-ed"></div>' +
            '<p class="ct-empty" style="margin:16px 0 0;">O sube un archivo con las mesas:</p>' +
            '<div class="ct-btns" style="align-items:center;margin-top:6px;"><input type="file" id="ct-map-file" accept=".json,application/json" aria-label="Archivo del mapa (.json)">' +
            '<button type="button" class="cc-btn2" id="ct-map-sample">Descargar archivo de ejemplo</button></div>' +
            '<div id="ct-map-prev"></div>' +
            '<div class="ct-btns"><button type="button" class="cc-btn2" id="ct-map-set" disabled>Fijar el mapa</button></div><p class="ct-msg" id="ct-map-msg"></p></div></details>';
        var det = q$('#ct-map'), cargado = false;
        det.addEventListener('toggle', function () { if (det.open && !cargado) { cargado = true; mapaActual(); } });
        var sr = q$('#ct-map-room'); if (sr) sr.addEventListener('change', function () { mapaActual(); });
        q$('#ct-ed-open').addEventListener('click', abrirEditor);
        q$('#ct-map-file').addEventListener('change', onMapaArchivo);
        q$('#ct-map-set').addEventListener('click', fijarMapa);
        q$('#ct-map-sample').addEventListener('click', function () {
            var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(MAPA_EJEMPLO, null, 2)], { type: 'application/json' }));
            a.download = 'mapa-de-la-sala-ejemplo.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        });
    }
    function salaElegida() { var sr = q$('#ct-map-room'); return (S.venue.rooms || [])[sr ? Number(sr.value) : 0]; }
    async function mapaActual() {
        var now = q$('#ct-map-now'), room = salaElegida(); if (!now || !room) return;
        var r = await S.db.from('venue_rooms').select('layout').eq('id', room.id).maybeSingle();
        var n = r && r.data && r.data.layout && Array.isArray(r.data.layout.tables) ? r.data.layout.tables.length : 0;
        now.innerHTML = r && r.error ? 'No se pudo leer el mapa actual.' : (n ? 'Mapa actual de <b style="color:#fff;">' + esc(room.name) + '</b>: ' + n + ' mesas.' : '<b style="color:#fff;">' + esc(room.name) + '</b> todavía no tiene un mapa guardado.');
        now.dataset.n = String(n);
    }
    function onMapaArchivo(ev) {
        var f = ev.target.files && ev.target.files[0], prev = q$('#ct-map-prev'), btn = q$('#ct-map-set'); btn.disabled = true; _mapa = null; q$('#ct-map-msg').textContent = '';
        if (!f) { prev.innerHTML = ''; return; }
        if (f.size > 1024 * 1024) { prev.innerHTML = '<p class="ct-map-sum ct-map-err">El archivo pesa más de 1 MB.</p>'; return; }
        var rd = new FileReader();
        rd.onload = function () {
            var v = core.validarMapa(String(rd.result || ''));
            var h = '<div class="ct-map-sum">';
            if (v.errores.length) {
                h += '<b class="ct-map-err">No se puede fijar este archivo:</b><br>' + v.errores.slice(0, 8).map(function (m) { return '· ' + esc(m); }).join('<br>') + (v.errores.length > 8 ? '<br>… y ' + (v.errores.length - 8) + ' más.' : '');
            } else {
                h += '<b class="ct-map-ok">Archivo válido:</b> <b>' + v.mesas + '</b> mesas · ' + v.sillas + ' sillas · de ' + dinero(v.precioMin) + ' a ' + dinero(v.precioMax) + '<br>' +
                    v.zonas.map(function (z) { return '· ' + esc(z.nombre) + ': ' + z.mesas + ' mesas, ' + (z.min === z.max ? dinero(z.min) : dinero(z.min) + ' a ' + dinero(z.max)); }).join('<br>');
                v.avisos.forEach(function (a) { h += '<br><span class="ct-map-warn">' + esc(a) + '</span>'; });
                _mapa = v; btn.disabled = false;
            }
            prev.innerHTML = h + '</div>';
        };
        rd.onerror = function () { prev.innerHTML = '<p class="ct-map-sum ct-map-err">No se pudo leer el archivo.</p>'; };
        rd.readAsText(f);
    }
    async function fijarMapa() {
        if (!_mapa || !_mapa.layout) return;
        var ok = await enviarMapa(salaElegida(), _mapa.layout, _mapa.mesas, q$('#ct-map-set'), q$('#ct-map-msg'));
        if (ok) { _mapa = null; q$('#ct-map-file').value = ''; q$('#ct-map-prev').innerHTML = ''; }
    }
    // Manda el mapa a la base (la función vuelve a validar todo y exige dueño/manager). Devuelve true si quedó guardado.
    async function enviarMapa(room, layout, mesas, btn, msg) {
        if (!room) return false;
        var antes = Number((q$('#ct-map-now') || {}).dataset ? q$('#ct-map-now').dataset.n : 0) || 0;
        if (!window.confirm('Vas a reemplazar el mapa de «' + room.name + '»' + (antes ? ' (hoy tiene ' + antes + ' mesas)' : '') + ' por uno de ' + mesas + ' mesas. Las ventas ya abiertas conservan su mapa. ¿Continuar?')) return false;
        btn.disabled = true; msg.style.color = ''; msg.textContent = 'Guardando…';
        var res = await S.db.rpc('venue_room_set_layout', { p_room_id: room.id, p_layout: layout });
        if (res.error) {
            var sinFn = res.error.code === 'PGRST202' || res.error.code === '42883' || /could not find the function|schema cache/i.test(res.error.message || '');
            msg.style.color = '#ff6060'; msg.textContent = sinFn ? 'Fijar el mapa todavía no está activado en la base de datos.' : msgError(res.error);
            btn.disabled = false; return false;
        }
        msg.style.color = '#00c878'; msg.textContent = 'Mapa fijado: ' + res.data + ' mesas. Los eventos con la venta ya abierta conservan su mapa; los demás lo toman al abrir la venta.';
        btn.disabled = false; mapaActual(); return true;
    }

    // ── Editor visual del plano: + agrega una mesa, − quita la elegida, y se arrastra con el mouse (o el dedo) para ubicarla ──
    var ICONO = {
        mas: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
        menos: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/></svg>',
        mover: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/></svg>'
    };
    var E = null;   // { room, base, maps, meta, mapIdx, sel }
    async function abrirEditor() {
        var room = salaElegida(), box = q$('#ct-ed'); if (!room || !box) return;
        box.innerHTML = '<p class="ct-empty">Cargando el plano…</p>';
        var r = await S.db.from('venue_rooms').select('layout').eq('id', room.id).maybeSingle();
        if (r.error) { box.innerHTML = '<p class="ct-empty" style="color:#ff6060;">No se pudo leer el plano actual.</p>'; return; }
        var lay = (r.data && r.data.layout) || {}, base = {}, k; for (k in lay) if (k !== 'maps' && k !== 'tables') base[k] = lay[k];
        var maps = (Array.isArray(lay.maps) && lay.maps.length ? JSON.parse(JSON.stringify(lay.maps)) : [core.planoVacio()]), meta = {};
        (Array.isArray(lay.tables) ? lay.tables : []).forEach(function (t) { meta[t.key] = { label: t.label || t.key, seats: t.seats || 4, zone: t.zone || 'Mesas', price_cents: t.price_cents || 0 }; });
        maps.forEach(function (m) { (m.tables || []).forEach(function (g) { if (!meta[g.id]) meta[g.id] = { label: g.id, seats: g.seats || 4, zone: 'Mesas', price_cents: 0 }; }); });
        E = { room: room, base: base, maps: maps, meta: meta, mapIdx: 0, sel: null };
        edFrame();
    }
    function edFrame() {
        var box = q$('#ct-ed');
        box.innerHTML =
            '<div class="ct-ed-tools"><button type="button" class="cc-btn2" id="ed-add" aria-label="Agregar una mesa">' + ICONO.mas + ' Mesa</button>' +
            '<button type="button" class="cc-btn2" id="ed-del" aria-label="Quitar la mesa elegida" disabled>' + ICONO.menos + ' Quitar</button>' +
            '<select id="ed-shape" aria-label="Forma de la mesa nueva"><option value="round">Redonda</option><option value="square">Cuadrada</option><option value="rect">Larga</option></select>' +
            '<span class="ct-ed-hint">' + ICONO.mover + ' Arrastra una mesa para moverla</span></div>' +
            '<div class="ct-tabs" id="ed-tabs"></div>' +
            '<div class="ct-ed-grid"><div class="ct-wrap"><svg id="ed-svg" class="ct-plan" viewBox="0 0 ' + 800 + ' ' + 520 + '" role="group" aria-label="Plano de la sala"></svg></div><div class="ct-side" id="ed-side"></div></div>' +
            '<div class="ct-btns"><button type="button" class="cc-btn2" id="ed-save">Guardar y fijar el mapa</button><button type="button" class="cc-btn2" id="ed-cancel">Cancelar</button></div><p class="ct-msg" id="ed-msg"></p>';
        q$('#ed-add').addEventListener('click', edAgregar);
        q$('#ed-del').addEventListener('click', edQuitar);
        q$('#ed-save').addEventListener('click', edGuardar);
        q$('#ed-cancel').addEventListener('click', function () { E = null; q$('#ct-ed').innerHTML = ''; });
        edTabs(); edDibujar(); edPanel();
    }
    function edMapa() { return E.maps[E.mapIdx]; }
    function edTabs() {
        var t = q$('#ed-tabs'); t.innerHTML = '';
        if (E.maps.length < 2) return;
        E.maps.forEach(function (m, i) { var b = document.createElement('button'); b.type = 'button'; b.textContent = m.label || ('Plano ' + (i + 1)); b.setAttribute('aria-selected', i === E.mapIdx ? 'true' : 'false'); b.addEventListener('click', function () { E.mapIdx = i; E.sel = null; edTabs(); edDibujar(); edPanel(); }); t.appendChild(b); });
    }
    function edDibujar() {
        var svg = q$('#ed-svg'), m = edMapa(); svg.innerHTML = '';
        el('path', { d: 'M 340 505 H 12 V 12 H 788 V 505 H 460', fill: 'none', stroke: 'rgba(255,255,255,0.4)', 'stroke-width': 4, 'stroke-linejoin': 'round' }, svg);
        if (m.focal && m.focal.rect) zoneBox(svg, m.focal.rect, m.focal.label || '', m.focal.rot, m.focal.k);
        (m.fixed || []).forEach(function (f) { zoneBox(svg, f.r, f.l, f.rot, f.k); });
        (m.tables || []).forEach(function (g) {
            var d = E.meta[g.id] || { seats: 4, label: g.id, price_cents: 0 };
            var gr = el('g', { 'class': 'tbl st-available' + (E.sel === g.id ? ' ct-sel' : ''), transform: 'translate(' + g.x + ',' + g.y + ')', role: 'button', tabindex: '0', 'data-id': g.id,
                'aria-label': 'Mesa ' + d.label + ', ' + d.seats + ' sillas. Arrástrala para moverla.', style: 'cursor:move;touch-action:none;' }, svg);
            chairsFor({ t: g.t, w: g.w, h: g.h, seats: d.seats }).forEach(function (c) { el('circle', { 'class': 'seat', cx: c[0], cy: c[1], r: 5 }, gr); });
            if (g.t === 'round') el('circle', { 'class': 'shape', cx: 0, cy: 0, r: d.seats <= 4 ? 22 : 26 }, gr);
            else { var w = g.w || 54, h = g.h || w; el('rect', { 'class': 'shape', x: -w / 2, y: -h / 2, width: w, height: h, rx: 6 }, gr); }
            el('text', { x: 0, y: 0 }, gr, d.label);
            el('text', { 'class': 'px', x: 0, y: 12 }, gr, d.price_cents ? dinero(d.price_cents) : 'sin precio');
            gr.addEventListener('pointerdown', function (ev) { edArrastrar(ev, g, gr); });
            gr.addEventListener('keydown', function (ev) {
                var dx = ev.key === 'ArrowRight' ? ED_PASO : ev.key === 'ArrowLeft' ? -ED_PASO : 0, dy = ev.key === 'ArrowDown' ? ED_PASO : ev.key === 'ArrowUp' ? -ED_PASO : 0;
                if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); edElegir(g.id); }
                if (dx || dy) { ev.preventDefault(); g.x = core.ajustar(g.x + dx, 26, 774); g.y = core.ajustar(g.y + dy, 26, 494); edElegir(g.id); }
            });
        });
        q$('#ed-del').disabled = !E.sel;
    }
    function edElegir(id) { E.sel = id; edDibujar(); edPanel(); var n = q$('#ed-svg [data-id="' + id.replace(/"/g, '') + '"]'); if (n && n.focus) n.focus({ preventScroll: true }); }
    function edArrastrar(ev, g, gr) {
        ev.preventDefault();
        var svg = q$('#ed-svg'), movido = false;
        if (E.sel !== g.id) { E.sel = g.id; q$('#ed-del').disabled = false; Array.prototype.forEach.call(svg.querySelectorAll('.tbl'), function (n) { n.classList.toggle('ct-sel', n === gr); }); edPanel(); }
        try { gr.setPointerCapture(ev.pointerId); } catch (e) { /* sin captura */ }
        function pos(e) { var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; var m = svg.getScreenCTM(); return m ? pt.matrixTransform(m.inverse()) : { x: g.x, y: g.y }; }
        var ini = pos(ev), x0 = g.x, y0 = g.y;
        function mover(e) {
            var p = pos(e), nx = core.ajustar(x0 + p.x - ini.x, 26, 774), ny = core.ajustar(y0 + p.y - ini.y, 26, 494);
            if (nx !== g.x || ny !== g.y) { g.x = nx; g.y = ny; movido = true; gr.setAttribute('transform', 'translate(' + nx + ',' + ny + ')'); }
        }
        function soltar() { gr.removeEventListener('pointermove', mover); gr.removeEventListener('pointerup', soltar); gr.removeEventListener('pointercancel', soltar); if (movido) edPanel(); }
        gr.addEventListener('pointermove', mover); gr.addEventListener('pointerup', soltar); gr.addEventListener('pointercancel', soltar);
    }
    function edAgregar() {
        var usadas = {}; Object.keys(E.meta).forEach(function (k) { usadas[k] = true; });
        if (Object.keys(usadas).length >= 300) { q$('#ed-msg').style.color = '#ff6060'; q$('#ed-msg').textContent = 'Máximo 300 mesas.'; return; }
        var key = core.siguienteClave(usadas), forma = q$('#ed-shape').value, f = core.FORMAS[forma] || core.FORMAS.round, m = edMapa(), p = core.lugarLibre(m.tables || []);
        var ref = E.sel && E.meta[E.sel] ? E.meta[E.sel] : null;
        var g = { id: key, t: forma, x: p.x, y: p.y, seats: forma === 'rect' ? 8 : 4 }; if (f.w) g.w = f.w; if (f.h) g.h = f.h;
        (m.tables = m.tables || []).push(g);
        E.meta[key] = { label: key, seats: g.seats, zone: ref ? ref.zone : 'Mesas', price_cents: ref ? ref.price_cents : 0 };   // hereda zona y precio de la elegida
        q$('#ed-msg').textContent = '';
        edElegir(key);
    }
    function edQuitar() {
        if (!E.sel) return;
        var m = edMapa(); m.tables = (m.tables || []).filter(function (g) { return g.id !== E.sel; }); delete E.meta[E.sel]; E.sel = null;
        edDibujar(); edPanel();
    }
    function edPanel() {
        var side = q$('#ed-side'), d = E.sel && E.meta[E.sel], m = edMapa(), n = (m.tables || []).length;
        if (!d) { side.innerHTML = '<h3>Plano</h3><small>' + n + ' mesas en este plano.</small><p class="ct-empty" style="margin-top:12px;">Toca una mesa para editar sus sillas, zona y precio, o pulsa + para agregar una.</p>'; return; }
        var zonas = {}; Object.keys(E.meta).forEach(function (k) { zonas[E.meta[k].zone] = true; });
        side.innerHTML = '<h3>Mesa ' + esc(d.label) + '</h3><small>Los cambios se guardan al pulsar «Guardar y fijar el mapa».</small>' +
            '<label for="ed-key">Clave</label><input id="ed-key" maxlength="20" value="' + esc(E.sel) + '">' +
            '<label>Sillas</label><div class="ct-step"><button type="button" class="cc-btn2" id="ed-seat-menos" aria-label="Quitar una silla">' + ICONO.menos + '</button><b id="ed-seats" style="min-width:34px;text-align:center;color:#fff;font-size:17px;">' + d.seats + '</b><button type="button" class="cc-btn2" id="ed-seat-mas" aria-label="Agregar una silla">' + ICONO.mas + '</button></div>' +
            '<label for="ed-zone">Zona</label><input id="ed-zone" list="ed-zonas" maxlength="60" value="' + esc(d.zone) + '"><datalist id="ed-zonas">' + Object.keys(zonas).map(function (z) { return '<option value="' + esc(z) + '">'; }).join('') + '</datalist>' +
            '<label for="ed-price">Precio por mesa (USD)</label><input id="ed-price" type="number" min="0" max="10000" step="1" inputmode="decimal" value="' + (d.price_cents ? d.price_cents / 100 : '') + '" placeholder="0">' +
            '<div class="ct-btns"><button type="button" class="cc-btn2" id="ed-zone-all">Mismo precio a toda la zona</button></div>';
        q$('#ed-seat-menos').addEventListener('click', function () { cambiaSillas(-1); });
        q$('#ed-seat-mas').addEventListener('click', function () { cambiaSillas(1); });
        q$('#ed-zone').addEventListener('input', function () { d.zone = q$('#ed-zone').value.trim() || 'Mesas'; });
        q$('#ed-price').addEventListener('input', function () { var v = Number(q$('#ed-price').value); d.price_cents = isFinite(v) && v > 0 ? Math.round(v * 100) : 0; edDibujar(); });
        q$('#ed-zone-all').addEventListener('click', function () { Object.keys(E.meta).forEach(function (k) { if (E.meta[k].zone === d.zone) E.meta[k].price_cents = d.price_cents; }); edDibujar(); q$('#ed-msg').style.color = '#00c878'; q$('#ed-msg').textContent = 'Listo: todas las mesas de «' + d.zone + '» cuestan ' + dinero(d.price_cents) + '.'; });
        q$('#ed-key').addEventListener('change', function () { renombrar(q$('#ed-key').value.trim()); });
    }
    function cambiaSillas(dx) { var d = E.meta[E.sel]; d.seats = Math.min(40, Math.max(1, d.seats + dx)); var g = (edMapa().tables || []).filter(function (x) { return x.id === E.sel; })[0]; if (g) g.seats = d.seats; edDibujar(); q$('#ed-seats').textContent = d.seats; }
    function renombrar(nueva) {
        var msg = q$('#ed-msg'), vieja = E.sel;
        if (!nueva || nueva === vieja) { q$('#ed-key').value = vieja; return; }
        if (nueva.length > 20 || E.meta[nueva]) { msg.style.color = '#ff6060'; msg.textContent = nueva.length > 20 ? 'La clave puede tener máximo 20 caracteres.' : 'Ya existe una mesa «' + nueva + '».'; q$('#ed-key').value = vieja; return; }
        E.meta[nueva] = E.meta[vieja]; delete E.meta[vieja]; E.meta[nueva].label = (E.meta[nueva].label === vieja ? nueva : E.meta[nueva].label);
        E.maps.forEach(function (mp) { (mp.tables || []).forEach(function (g) { if (g.id === vieja) g.id = nueva; }); });
        msg.textContent = ''; E.sel = nueva; edDibujar(); edPanel();
    }
    async function edGuardar() {
        var msg = q$('#ed-msg'), btn = q$('#ed-save'); msg.style.color = '#ff6060';
        var sinPrecio = []; E.maps.forEach(function (mp) { (mp.tables || []).forEach(function (g) { if (!E.meta[g.id].price_cents) sinPrecio.push(E.meta[g.id].label); }); });
        if (sinPrecio.length) { msg.textContent = 'Falta el precio de: ' + sinPrecio.slice(0, 8).join(', ') + (sinPrecio.length > 8 ? '…' : '') + '.'; return; }
        var layout = core.construirMapa(E.base, E.maps, E.meta), v = core.validarMapa(layout);
        if (!v.ok) { msg.textContent = v.errores.slice(0, 3).join(' '); return; }
        if (await enviarMapa(E.room, layout, v.mesas, btn, msg)) { E = null; q$('#ct-ed').innerHTML = '<p class="ct-map-sum ct-map-ok">Plano fijado: ' + v.mesas + ' mesas (de ' + dinero(v.precioMin) + ' a ' + dinero(v.precioMax) + '). Los eventos con la venta ya abierta conservan su mapa; los demás lo toman al abrir la venta.</p>'; }
    }

    root.mdjStaffTables = { init: init, onShow: onShow, core: core };
})(typeof window !== 'undefined' ? window : globalThis);
