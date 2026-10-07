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
    function precioTxt(r) { return r && r.price_cents === 0 ? 'Cortesía' : dinero(r && r.price_cents); }
    function dinero(cents) { var v = (Number(cents) || 0) / 100; return '$' + (Math.round(v * 100) % 100 === 0 ? String(Math.round(v)) : v.toFixed(2)); }
    // Tamaño REAL de cada mueble (radio del cuerpo en px del plano). Es la misma tabla que usa la base (venue_mesa_radio) para que nada se pise:
    // taburete 13 · mesa cóctel (1-2 sillas) 24 · mesa estándar (3-6) 36 · mesa familiar / VIP (7 o más) 48 · cuadrada 27 · rectangular 54.
    function radioDe(t, seats, w, h, r) {
        if (t === 'round' && r) return Number(r);                              // tamaño propio de la mesa redonda (24 chica · 36 mediana · 48 grande)
        if (t === 'stool') return 13;
        if (t === 'square') return (w || 54) / 2;
        if (t === 'rect') return Math.max(w || 108, h || 54) / 2;
        var n = seats || 4; return n <= 2 ? 24 : (n <= 6 ? 36 : 48);
    }
    function geoT(key) {
        var maps = mapsDe(S.event && S.event.layout, S.rows);
        for (var i = 0; i < maps.length; i++) { var ts = maps[i].tables || []; for (var j = 0; j < ts.length; j++) if (ts[j].id === key) return ts[j].t; }
        return '';
    }
    function geoObj(key) {
        var maps = mapsDe(S.event && S.event.layout, S.rows);
        for (var i = 0; i < maps.length; i++) { var ts = maps[i].tables || []; for (var j = 0; j < ts.length; j++) if (ts[j].id === key) return ts[j]; }
        return null;
    }
    function esTaburete(key) { return geoT(key) === 'stool'; }
    function sumaLados(c) { return (Number(c.t) || 0) + (Number(c.b) || 0) + (Number(c.l) || 0) + (Number(c.r) || 0); }
    function partePar(n) { n = Math.max(1, Math.min(12, Number(n) || 4)); return { t: Math.ceil(n / 2), b: Math.floor(n / 2), l: 0, r: 0 }; }       // reparto por omisión de una mesa larga: mitad por cada lado largo
    function parteCuadrada(n) { n = Math.max(1, Math.min(4, Number(n) || 4)); return { t: 1, b: n >= 2 ? 1 : 0, l: n >= 3 ? 1 : 0, r: n >= 4 ? 1 : 0 }; }      // 1 arriba · 2 arriba y abajo · 3 +izquierda · 4 los cuatro lados
    function chairsDe(key, seats) { var g = geoObj(key), c = g && g.chairs; return (c && sumaLados(c) === seats) ? { t: c.t, b: c.b, l: c.l, r: c.r } : (g && g.t === 'square' ? parteCuadrada(seats) : partePar(seats)); }
    function ladosHtml(cfg, forma) {
        var cuad = forma === 'square';
        function fila(k, titulo) { return '<div class="ct-lado"><span>' + titulo + '</span><span class="ct-lado-c"><button type="button" data-lado="' + k + '" data-d="-1" aria-label="Menos">−</button><b data-v="' + k + '">' + cfg[k] + '</b><button type="button" data-lado="' + k + '" data-d="1" aria-label="Más">+</button></span></div>'; }
        return '<div class="ct-lados">' + (cuad ? fila('t', 'Lado de arriba') + fila('b', 'Lado de abajo') + fila('l', 'Lado izquierdo') + fila('r', 'Lado derecho') : fila('t', 'Lado largo de arriba') + fila('b', 'Lado largo de abajo') + fila('l', 'Cabecera izquierda') + fila('r', 'Cabecera derecha')) + '<div class="ct-lado-total">Total: <b data-total>' + sumaLados(cfg) + '</b> ' + (sumaLados(cfg) === 1 ? 'silla' : 'sillas') + '</div></div>';
    }
    function ladosBind(root, cfg, cambio, forma) {      // rectangular: largos 0-6, cabeceras 0-1, de 1 a 14 sillas · cuadrada: 0-1 por lado, de 1 a 4
        [].forEach.call(root.querySelectorAll('[data-lado]'), function (b) {
            b.addEventListener('click', function () {
                var k = b.dataset.lado, max = (forma !== 'square' && (k === 't' || k === 'b')) ? 6 : 1, v = Math.max(0, Math.min(max, (Number(cfg[k]) || 0) + Number(b.dataset.d)));
                var antes = cfg[k]; cfg[k] = v; if (sumaLados(cfg) < 1) cfg[k] = antes;
                [].forEach.call(root.querySelectorAll('[data-v]'), function (n) { n.textContent = cfg[n.dataset.v]; });
                var tt = root.querySelector('[data-total]'); if (tt) { tt.textContent = sumaLados(cfg); }
                if (cambio) cambio();
            });
        });
    }
    // Sillas que existen de verdad por forma: redonda 2-10 · cuadrada 2 o 4 (una por lado) · rectangular 4-10 en pares (mitad por cada lado largo).
    function sillasPermitidas(forma, actual) {
        var l = forma === 'square' ? [2, 4] : (forma === 'rect' ? [4, 6, 8, 10] : [2, 4, 6, 8, 10]);
        if (actual && l.indexOf(actual) < 0) { l = l.concat([actual]).sort(function (a, b) { return a - b; }); }
        return l;
    }
    function nombreMueble(key, label) { return (esTaburete(key) ? 'Taburete ' : 'Mesa ') + label; }
    // Mobiliario de la terraza (T01…T12): figuras chicas con rótulo T + número. No son inventario de venta (la terraza se renta completa): solo se numeran y se mueven.
    function esMuebleShape(it) { return !!it && it.k === 'shape' && /^T[0-9]{1,3}$/.test(String(it.label || '')) && (it.w || 999) <= 120 && (it.h || 999) <= 120; }
    // Catálogo de mobiliario del «Agregar»: cada tipo con su tamaño y sus sillas permitidas.
    var CATALOGO = [
        { id: 'cocktail', shape: 'round', nombre: 'Mesa cóctel', sub: '2 sillas', seats: [2] },
        { id: 'standard', shape: 'round', nombre: 'Mesa estándar', sub: '4 o 6 sillas', seats: [4, 6] },
        { id: 'high', shape: 'round', nombre: 'Mesa alta', sub: '3 o 4 sillas altas', seats: [3, 4], radio: 24 },
        { id: 'family', shape: 'round', nombre: 'Mesa familiar / VIP', sub: '8 o 10 sillas', seats: [8, 10] },
        { id: 'stool', shape: 'stool', nombre: '🍸 Taburete de barra', sub: '1 silla', seats: [1] },
        { id: 'square', shape: 'square', nombre: 'Cuadrada', sub: 'sillas por lado', seats: null },
        { id: 'rect', shape: 'rect', nombre: 'Rectangular', sub: 'sillas por lado', seats: null }
    ];
    function tipoDe(id) { return CATALOGO.filter(function (c) { return c.id === id; })[0] || CATALOGO[1]; }
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
        mesa_no_se_puede_mover: 'Una de las mesas ya se vendió o alguien la está pagando: no se puede mover ni girar.',
        giro_invalido: 'Ese giro no es válido.',
        solo_cuadradas_y_rectangulares: 'Las sillas por lado solo se eligen en mesas cuadradas y rectangulares.',
        solo_redondas: 'El tamaño solo se cambia en mesas redondas.',
        tamano_invalido: 'Ese tamaño no es válido.',
        mesa_sobre_estructura: 'Ahí está la estructura de la sala (escenario, baños, pared o barra): no se puede poner el mueble encima ni tan pegado.',
        sin_plano: 'Este evento no tiene dibujo del plano: no se pueden mover las mesas.',
        mesa_sin_dibujo: 'Una de las mesas no está dibujada en el plano.',
        movimiento_invalido: 'No se pudo mover: revisa las mesas elegidas.',
        grupo_invalido: 'El grupo debe tener entre 1 y 40 mesas, sin repetir.',
        areas_invalidas: 'Elige al menos un área de la sala.',
        area_con_ventas: 'Esa área ya tiene mesas vendidas, apartadas o en pago: no se puede cerrar. Libéralas primero.',
        sillas_invalidas: 'Las sillas deben ser entre 1 y 40.',
        precio_invalido: 'El precio debe estar entre $0 y $10,000.',
        forma_invalida: 'Elige una forma de mesa válida.',
        fuera_del_plano: 'Ese punto queda fuera del plano.',
        mesa_encima: 'Ahí ya hay un mueble (cada uno ocupa su tamaño real): elige un lugar libre del plano.',
        taburete_una_silla: 'Un taburete es de una sola silla: no se puede cambiar.',
        no_es_mueble: 'Eso es parte de la estructura de la sala (escenario, pared, barra, baños…): no se mueve.',
        mueble_no_existe: 'Ese mueble ya no está en el plano.',
        plano_invalido: 'No se encontró ese plano en el evento.',
        demasiadas_mesas: 'Este evento ya tiene el máximo de mesas.',
        mesa_no_se_puede_editar: 'Esa mesa ya se vendió o alguien la está pagando: no se puede cambiar.',
        mesa_no_se_puede_quitar: 'Solo se pueden quitar mesas libres (no apartadas, vendidas ni en pago).',
        ultima_mesa: 'No se puede quitar la última mesa del evento.',
        sin_cambios: 'No cambiaste nada.',
        telefono_invalido: 'El teléfono no es válido (solo números, +, espacios, guiones y paréntesis).',
        correo_invalido: 'El correo no es válido.',
        metodo_invalido: 'Elige cómo se registra el pago.',
        importe_invalido: 'El importe no es válido para ese método de pago.',
        mesa_con_ingresos: 'Alguien de esa mesa ya entró: no se puede liberar ni cambiar la reserva.',
        personas_invalidas: 'Las personas deben ser entre 1 y las sillas de la mesa.',
        tipo_invalido: 'Elige el tipo de reserva.',
        hora_invalida: 'Elige una hora límite válida.',
        hora_pasada: 'Esa hora límite ya pasó: elige una más tarde.',
        evento_sin_fecha: 'Este evento no tiene fecha para apartar mesas.',
        sin_mapa_dia: 'La sala todavía no tiene plano.',
        titulo_invalido: 'El nombre del evento debe tener entre 3 y 120 caracteres.',
        fecha_invalida: 'Elige un día desde hoy hasta dentro de 2 años.',
        evento_duplicado: 'Ya existe un evento con ese nombre y ese día en esta sala.',
        demasiados_eventos: 'Esta sala ya tiene demasiados eventos activos. Quita alguno antes de crear otro.',
        evento_con_ventas: 'Este evento ya tiene mesas vendidas, apartadas o en pago, o pedidos: no se puede quitar. Libera las mesas primero (si hubo pagos en línea, hace falta el reembolso).',
        ya_cancelado: 'Ese evento ya estaba quitado.'
    };
    // Las funciones nuevas devuelven {ok:false, error} (validaciones) o lanzan error (permisos): los dos caminos dan el mismo mensaje.
    function msgRes(res) {
        if (res.error) { var sinFn = res.error.code === 'PGRST202' || res.error.code === '42883' || /could not find the function|schema cache/i.test(res.error.message || ''); return sinFn ? 'Esta opción todavía no está activada en la base de datos.' : msgError(res.error); }
        if (res.data && res.data.ok === false) return ERRORES[res.data.error] || 'No se pudo completar. Intenta de nuevo.';
        return '';
    }
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
            '.ct-grid { display:grid; grid-template-columns:minmax(0,2.5fr) minmax(280px,1fr); gap:16px; align-items:start; }',
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
            '.ct-side select { width:100%; box-sizing:border-box; padding:10px 12px; border-radius:8px; border:1px solid rgba(255,255,255,.15); background:rgba(0,0,0,.3); color:#fff; font:inherit; font-size:14px; }',
            '.ct-plan.ct-adding { cursor:crosshair; } .ct-plan.ct-adding .tbl { opacity:.8; } .ct-plan.ct-adding .tbl.ghost { pointer-events:none; } .ct-edit { margin-top:16px; padding-top:4px; border-top:1px solid rgba(255,255,255,.1); }',
            '.ct-modal-bg { position:fixed; inset:0; z-index:100000; background:rgba(0,0,0,.72); display:flex; align-items:flex-start; justify-content:center; padding:4vh 14px; overflow:auto; }',
            '.ct-modal { width:100%; max-width:680px; background:#0f1424; border:1px solid rgba(197,160,89,.4); border-radius:18px; padding:22px; box-shadow:0 24px 80px rgba(0,0,0,.6); color:#fff; }',
            '.ct-modal h3 { margin:0 0 4px; font-size:20px; color:#fcd34d; } .ct-modal label { display:block; font-size:12px; font-weight:700; color:rgba(255,255,255,.6); text-transform:uppercase; letter-spacing:.04em; margin:14px 0 6px; }',
            '.ct-modal input[type=text], .ct-modal input[type=tel], .ct-modal input[type=email], .ct-modal input[type=number], .ct-modal select, .ct-modal input[type=search] { width:100%; box-sizing:border-box; padding:11px 12px; border-radius:8px; border:1px solid rgba(255,255,255,.18); background:rgba(0,0,0,.35); color:#fff; font:inherit; font-size:15px; }',
            '.ct-modal .ct-two { display:grid; grid-template-columns:1fr 1fr; gap:12px; } @media (max-width:560px) { .ct-modal .ct-two { grid-template-columns:1fr; } }',
            '.ct-pick { max-height:200px; overflow:auto; border:1px solid rgba(255,255,255,.14); border-radius:10px; background:rgba(0,0,0,.25); } .ct-pick label { display:flex; gap:10px; align-items:center; margin:0; padding:9px 12px; border-bottom:1px solid rgba(255,255,255,.06); text-transform:none; letter-spacing:0; font-size:14px; font-weight:600; color:#fff; cursor:pointer; } .ct-pick label:last-child { border-bottom:none; } .ct-pick small { margin-left:auto; color:rgba(255,255,255,.6); white-space:nowrap; }',
            '.ct-sum { margin:10px 0 0; padding:10px 12px; border-radius:10px; background:rgba(197,160,89,.1); border:1px solid rgba(197,160,89,.3); font-size:14px; } .ct-sum b { color:#fcd34d; }',
            '.ct-modal .ct-actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:18px; } .ct-linkbox { display:flex; gap:8px; margin-top:12px; } .ct-linkbox input { flex:1 1 auto; min-width:0; }',
            '.ct-plan .tbl.ct-overdue .shape { stroke:#ff9f1a; stroke-width:4; animation:ctpulse 1.3s ease-in-out infinite; } @keyframes ctpulse { 50% { fill:rgba(255,159,26,.45); } }',
            '.ct-alerta { margin:12px 0 0; padding:12px 14px; border-radius:10px; background:rgba(255,159,26,.14); border:1px solid #ff9f1a; color:#ffd199; font-weight:700; font-size:14px; line-height:1.5; } .ct-ok { margin:12px 0 0; padding:10px 14px; border-radius:10px; background:rgba(0,200,120,.12); border:1px solid rgba(0,200,120,.5); color:#bff0d1; font-size:14px; } .ct-btns .ct-liberar { background:#b3261e; border-color:#b3261e; color:#fff; }',
            '.ct-pm { display:inline-flex; align-items:center; flex:none; } .ct-circ { width:36px; height:36px; border-radius:50%; border:2px solid #c5a059; background:#161a2a; color:#fcd34d; font:inherit; font-size:22px; font-weight:800; line-height:1; cursor:pointer; padding:0; display:inline-flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,.45); position:relative; z-index:2; } .ct-circ:hover:not(:disabled) { background:#c5a059; color:#111; z-index:3; } .ct-circ-minus { margin-left:-12px; z-index:1; border-color:#8b94a8; color:#c9d0e0; } .ct-circ-minus:hover:not(:disabled) { background:#b3261e; border-color:#b3261e; color:#fff; } .ct-circ:disabled { opacity:.4; cursor:not-allowed; }',
            '.ct-toolbar { margin:0 0 8px; } .ct-toolbar select { flex:1 1 240px; max-width:340px; } .ct-toolbar input[type=search] { margin-left:auto; flex:0 1 300px; min-width:180px; } .ct-toolbar button { white-space:nowrap; }',
            '.ct-fs-bar { display:none; } body.ct-fs-lock { overflow:hidden !important; }',
            '.venue-map-fullscreen { position:fixed !important; inset:0 !important; width:100vw !important; height:100vh !important; z-index:99999 !important; background:#080c14 !important; padding:20px !important; display:flex !important; flex-direction:column !important; overflow:hidden !important; box-sizing:border-box; }',
            '.venue-map-fullscreen .ct-fs-bar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin:0 0 12px; padding:10px 14px; border-radius:12px; background:rgba(15,20,36,.92); border:1px solid rgba(197,160,89,.35); color:#fff; } .venue-map-fullscreen .ct-fs-bar b { font-size:16px; }',
            '.venue-map-fullscreen .ct-grid { display:block !important; position:relative; flex:1 1 auto; min-height:0; } .venue-map-fullscreen .ct-grid > div:first-child { height:100%; display:flex; flex-direction:column; min-height:0; }',
            '.venue-map-fullscreen .ct-wrap { flex:1 1 auto; min-height:0; overflow:auto; } .venue-map-fullscreen .ct-plan { min-width:0 !important; max-width:none !important; margin:0 auto; }',
            '.venue-map-fullscreen .ct-side { position:absolute; top:10px; right:10px; width:min(340px,38vw); max-height:calc(100% - 20px); overflow:auto; z-index:3; background:rgba(12,17,27,.86); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); box-shadow:0 12px 40px rgba(0,0,0,.5); }',
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


    function css2() {
        if (document.getElementById('ct-style2')) return;
        var s2 = document.createElement('style'); s2.id = 'ct-style2';
        s2.textContent = [
            '#cc-p-mesas .cc-card { padding:20px 22px 18px; } #cc-p-mesas .cc-card > h2 { display:none; }',
            '#cc-tables-box { --ct-line:rgba(255,255,255,.1); --ct-gold:#d4af37; --ct-gold2:#f3d98a; --ct-ok:#2fd37f; --ct-warn:#ffb020; --ct-bad:#ff5d5d; font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }',
            /* encabezado */
            '.ct-head { display:flex; align-items:center; justify-content:space-between; gap:18px; flex-wrap:wrap; margin:0 0 14px; }',
            '.ct-title { display:flex; align-items:center; gap:14px; min-width:0; } .ct-badge { width:46px; height:46px; flex:none; border-radius:14px; display:grid; place-items:center; color:#1b1507; background:linear-gradient(145deg,#f3d98a,#c39a2c 55%,#8a6d1f); box-shadow:0 8px 22px rgba(212,175,55,.3), inset 0 1px 0 rgba(255,255,255,.5); } .ct-badge { font-size:24px; }',
            '.ct-title h3 { margin:0; font:700 24px/1.1 "Playfair Display",Georgia,serif; color:#fff; letter-spacing:.2px; } .ct-title small { display:block; margin-top:5px; color:rgba(255,255,255,.55); font-size:11.5px; font-weight:600; letter-spacing:.16em; text-transform:uppercase; }',
            '.ct-stats { display:flex; gap:10px; flex-wrap:wrap; } .ct-stat { min-width:96px; padding:9px 14px; border-radius:14px; background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.02)); border:1px solid var(--ct-line); text-align:left; font:inherit; color:inherit; } .ct-stat b { display:block; font-size:21px; line-height:1.1; color:#fff; font-variant-numeric:tabular-nums; } .ct-stat span { display:block; margin-top:3px; font-size:10.5px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:rgba(255,255,255,.55); }',
            '.ct-stat.ok b { color:var(--ct-ok); } .ct-stat.bad b { color:var(--ct-bad); } .ct-stat.warn { border-color:rgba(255,176,32,.55); background:rgba(255,176,32,.1); cursor:pointer; } .ct-stat.warn b { color:var(--ct-warn); } .ct-stat.gold b { color:var(--ct-gold2); }',
            /* barra de herramientas */
            '.ct-toolbar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:10px; margin:0 0 14px; border-radius:18px; background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02)); border:1px solid var(--ct-line); box-shadow:0 10px 30px rgba(0,0,0,.25); }',
            '.ct-toolbar select { height:44px; flex:1 1 250px; max-width:360px; padding:0 14px; border-radius:12px; border:1px solid var(--ct-line); background:#0d1220; color:#fff; font:600 14px Inter,system-ui,sans-serif; }',
            '.ct-toolbar input[type=search] { height:44px; margin-left:auto; flex:0 1 300px; min-width:190px; padding:0 14px; border-radius:12px; border:1px solid var(--ct-line); background:#0d1220; color:#fff; font:500 14px Inter,system-ui,sans-serif; } .ct-toolbar input[type=search]:focus, .ct-toolbar select:focus { outline:none; border-color:var(--ct-gold); box-shadow:0 0 0 3px rgba(212,175,55,.18); }',
            '.ct-mapbar { position:relative; z-index:3; display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:44px; margin:-2px 0 8px; } .ct-hint { color:#f3d98a; font-size:13px; font-weight:600; letter-spacing:.02em; } .ct-tools { display:inline-flex; gap:8px; margin-left:auto; }',
            '.ct-tool { width:44px; height:44px; border-radius:12px; border:1px solid rgba(255,255,255,.18); background:rgba(10,14,24,.82); color:#fff; font-size:21px; line-height:1; cursor:pointer; display:grid; place-items:center; transition:background .15s, border-color .15s, transform .12s; box-shadow:0 6px 16px rgba(0,0,0,.35); } .ct-tool:hover { background:rgba(255,255,255,.14); border-color:rgba(255,255,255,.34); transform:translateY(-1px); } .ct-tool.on { background:rgba(212,175,55,.26); border-color:#d4af37; box-shadow:0 0 0 3px rgba(212,175,55,.18); }',
            '.venue-map-fullscreen .ct-tool#ct-full { display:none; } .ct-btn.icon { font-size:19px; }',
            '.ct-zoom { display:none; } .venue-map-fullscreen .ct-zoom { display:flex; flex-direction:column; position:absolute; left:34px; bottom:78px; z-index:6; border-radius:12px; overflow:hidden; border:1px solid rgba(255,255,255,.22); background:rgba(14,19,32,.94); box-shadow:0 8px 22px rgba(0,0,0,.5); } .ct-zoom button { width:46px; height:42px; border:0; background:transparent; color:#fff; font:600 22px Inter,system-ui,sans-serif; line-height:1; cursor:pointer; padding:0; } .ct-zoom button + button { border-top:1px solid rgba(255,255,255,.14); } .ct-zoom button:hover { background:rgba(255,255,255,.12); } .ct-zoom #ct-z-reset { font-size:11px; font-weight:700; color:#cdd5e6; letter-spacing:.02em; }',
            '.venue-map-fullscreen .ct-fs-bar .ct-tool { width:38px; height:38px; font-size:19px; box-shadow:none; }',
            '.ct-btn[hidden], .ct-tool[hidden], .ct-pm[hidden], .ct-sep[hidden] { display:none !important; }',
            '.ct-lados { display:flex; flex-direction:column; gap:8px; margin:6px 0 4px; } .ct-lado { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 12px; border-radius:11px; border:1px solid var(--ct-line); background:rgba(255,255,255,.04); color:#e8ecf5; font:600 13px Inter,sans-serif; } .ct-lado-c { display:inline-flex; align-items:center; gap:10px; } .ct-lado-c button { width:34px; height:34px; border-radius:9px; border:1px solid var(--ct-line); background:rgba(255,255,255,.08); color:#fff; font:700 18px Inter,sans-serif; cursor:pointer; padding:0; } .ct-lado-c button:hover { background:rgba(255,255,255,.16); } .ct-lado-c b { min-width:18px; text-align:center; font-size:16px; } .ct-lado-total { text-align:right; color:#f3d98a; font:700 12px Inter,sans-serif; padding:2px 4px; }',
            '.ct-rot { margin-top:14px; } .ct-rot label { display:block; margin-bottom:6px; }',
            '.ct-plan .ct-mueble { cursor:grab; touch-action:none; } .ct-plan .ct-mueble:hover .body { stroke:#fcd34d; }',
            '.ct-btn.ct-cancel-ev { background:transparent; border-color:#b3261e; color:#ff8a80; margin-left:6px; } .ct-btn.ct-cancel-ev:hover:not(:disabled) { background:#b3261e; color:#fff; } .ct-btn.ct-del { background:#b3261e; border-color:#b3261e; color:#fff; font-weight:800; padding:12px 14px; } .ct-btn.ct-del:hover:not(:disabled) { background:#d32f2f; } .ct-danger-zone { margin-top:14px; padding-top:12px; border-top:1px dashed rgba(179,38,30,.55); } .ct-plan .tbl.stool text { font-size:8.5px; font-weight:800; } .ct-plan .tbl.stool text.px { font-size:9px; }',
            '.ct-sep { width:1px; height:28px; background:var(--ct-line); margin:0 2px; flex:none; }',
            '.ct-btn { height:44px; padding:0 16px; border-radius:12px; display:inline-flex; align-items:center; gap:9px; font:600 13.5px Inter,system-ui,sans-serif; letter-spacing:.01em; color:#fff; background:rgba(255,255,255,.06); border:1px solid var(--ct-line); cursor:pointer; white-space:nowrap; transition:background .15s, border-color .15s, transform .12s, box-shadow .15s; } .ct-btn svg { width:18px; height:18px; flex:none; }',
            '.ct-btn:hover:not(:disabled) { background:rgba(255,255,255,.12); border-color:rgba(255,255,255,.24); transform:translateY(-1px); }',
            '.ct-btn.gold { color:#17120a; font-weight:800; background:linear-gradient(180deg,#f1d27a,#c9a032); border-color:#d9b84a; box-shadow:0 8px 22px rgba(212,175,55,.3), inset 0 1px 0 rgba(255,255,255,.45); } .ct-btn.gold:hover:not(:disabled) { background:linear-gradient(180deg,#f6dc8c,#d3aa3a); }',
            '.ct-btn.on { color:var(--ct-gold2); background:rgba(212,175,55,.16); border-color:var(--ct-gold); } .ct-btn.danger { background:#b3261e; border-color:#b3261e; color:#fff; } .ct-btn.block { width:100%; justify-content:center; }',
            '.ct-btn:disabled { opacity:.4; cursor:not-allowed; transform:none; } .ct-btn.icon { width:44px; padding:0; justify-content:center; }',
            '.ct-pm { display:inline-flex; align-items:center; flex:none; } .ct-circ { width:38px; height:38px; } ',
            /* lienzo */
            '.ct-canvas .ct-wrap { position:relative; border-radius:22px; border:1px solid rgba(255,255,255,.12); padding:12px; background:radial-gradient(1100px 520px at 25% -10%,rgba(212,175,55,.09),transparent 62%),radial-gradient(900px 500px at 100% 100%,rgba(70,100,180,.08),transparent 60%),#090d17; box-shadow:inset 0 0 70px rgba(0,0,0,.55), 0 22px 60px rgba(0,0,0,.4); }',
            '.ct-canvas .ct-wrap::before { content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none; background-image:radial-gradient(rgba(255,255,255,.07) 1px,transparent 1.2px); background-size:24px 24px; } .ct-canvas .ct-plan { position:relative; }',
            '.ct-leg { display:flex; flex-wrap:wrap; gap:8px 18px; margin:12px 4px 0; font-size:12.5px; font-weight:600; color:rgba(255,255,255,.7); } .ct-leg span { display:inline-flex; align-items:center; gap:7px; } .ct-leg i { width:11px; height:11px; border-radius:50%; margin:0; box-shadow:0 0 8px currentColor; }',
            /* mesas */
            '.ct-plan .tbl { cursor:pointer; transition:filter .15s; } .ct-plan .tbl .shape { stroke-width:3; filter:drop-shadow(0 5px 6px rgba(0,0,0,.6)); transition:filter .15s; } .ct-plan .tbl:hover .shape { filter:drop-shadow(0 0 9px rgba(255,255,255,.35)) drop-shadow(0 5px 6px rgba(0,0,0,.6)); }',
            '.ct-plan .tbl .ring { fill:none; stroke:rgba(255,255,255,.09); stroke-width:1.5; pointer-events:none; } .ct-plan .tbl .seat { stroke:none; }',
            '.ct-plan .tbl text { font:800 15px Inter,system-ui,sans-serif; fill:#fff; text-anchor:middle; pointer-events:none; } .ct-plan .tbl text.px { font-weight:700; font-size:11.5px; fill:#f3d98a; letter-spacing:.02em; }',
            '.ct-plan .st-available .shape { fill:url(#ctg-ok); stroke:#2fd37f; } .ct-plan .st-available .seat { fill:rgba(47,211,127,.55); }',
            '.ct-plan .st-tpl .shape { fill:url(#ctg-tpl); stroke:rgba(212,175,55,.85); stroke-width:2.5; } .ct-plan .st-tpl .seat { fill:rgba(212,175,55,.45); }',
            '.ct-plan .st-held .shape, .ct-plan .st-reserved .shape { fill:url(#ctg-res); stroke:#ffb020; } .ct-plan .st-reserved .shape { stroke-dasharray:8 5; } .ct-plan .st-held .seat, .ct-plan .st-reserved .seat { fill:rgba(255,176,32,.6); } .ct-plan .st-held text.px, .ct-plan .st-reserved text.px { fill:#ffd28a; font-size:10px; letter-spacing:.08em; }',
            '.ct-plan .st-sold_online .shape, .ct-plan .st-sold_manager .shape { fill:url(#ctg-sold); stroke:#ff5d5d; stroke-dasharray:none; } .ct-plan .st-sold_online .seat, .ct-plan .st-sold_manager .seat { fill:rgba(255,93,93,.5); } .ct-plan .st-sold_online text.px, .ct-plan .st-sold_manager text.px { fill:#ff9a9a; font-size:10px; letter-spacing:.08em; }',
            '.ct-plan .tbl.ct-sel .shape { stroke:#f3d98a; stroke-width:4.5; filter:drop-shadow(0 0 12px rgba(243,217,138,.9)) drop-shadow(0 5px 6px rgba(0,0,0,.6)); }',
            '.ct-plan .tbl.ct-overdue .shape { stroke:#ff9f1a; stroke-width:4.5; stroke-dasharray:none; animation:ctpulse 1.3s ease-in-out infinite; } .ct-plan .tbl.ct-overdue text.px { fill:#ffb347; }',
            '.ct-plan .ghost { pointer-events:none; opacity:.7; } .ct-plan .ghost .shape { stroke-dasharray:7 5; stroke:#f3d98a; fill:rgba(243,217,138,.14); }',
            /* panel lateral */
            '.ct-side { border-radius:20px; padding:0; overflow:hidden; background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02)); border:1px solid var(--ct-line); box-shadow:0 14px 40px rgba(0,0,0,.3); }',
            '.ct-sd-head { display:flex; align-items:center; gap:14px; padding:18px 18px 14px; border-bottom:1px solid var(--ct-line); background:linear-gradient(180deg,rgba(212,175,55,.08),transparent); } .ct-sd-badge { width:54px; height:54px; flex:none; border-radius:50%; display:grid; place-items:center; font:800 16px Inter,sans-serif; color:#fff; background:radial-gradient(circle at 35% 30%,#2c5a4a,#10241e); border:3px solid #2fd37f; box-shadow:0 6px 16px rgba(0,0,0,.45); }',
            '.ct-sd-badge.res { background:radial-gradient(circle at 35% 30%,#5a4720,#251c0a); border-color:#ffb020; } .ct-sd-badge.sold { background:radial-gradient(circle at 35% 30%,#6a2a30,#2a1015); border-color:#ff5d5d; } .ct-sd-badge.tpl { background:radial-gradient(circle at 35% 30%,#3a3f55,#171a28); border-color:rgba(212,175,55,.85); }',
            '.ct-sd-head h3 { margin:0; font:800 19px/1.15 Inter,sans-serif; color:#fff; } .ct-sd-head small { display:block; margin-top:4px; color:rgba(255,255,255,.6); font-size:12.5px; }',
            '.ct-sd-body { padding:14px 18px 18px; } .ct-pills { display:flex; flex-wrap:wrap; gap:8px; margin:0 0 12px; } .ct-pill { padding:5px 11px; border-radius:999px; background:rgba(255,255,255,.07); border:1px solid var(--ct-line); font-size:12.5px; font-weight:600; color:#e8ecf5; } .ct-pill.gold { color:var(--ct-gold2); border-color:rgba(212,175,55,.4); background:rgba(212,175,55,.1); }',
            '.ct-state { display:inline-flex; align-items:center; gap:8px; padding:6px 12px; border-radius:999px; font-size:12.5px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; margin:0 0 12px; } .ct-state i { width:9px; height:9px; border-radius:50%; background:currentColor; box-shadow:0 0 8px currentColor; } .ct-state.ok { color:var(--ct-ok); background:rgba(47,211,127,.12); } .ct-state.res { color:var(--ct-warn); background:rgba(255,176,32,.12); } .ct-state.sold { color:var(--ct-bad); background:rgba(255,93,93,.12); }',
            '.ct-sd-body .ct-btns { display:grid; gap:9px; margin:12px 0 0; } .ct-sd-empty { padding:34px 22px; text-align:center; color:rgba(255,255,255,.6); font-size:14px; line-height:1.55; } .ct-sd-empty svg { width:54px; height:54px; margin:0 auto 12px; display:block; color:var(--ct-gold); opacity:.8; } .ct-sd-empty b { color:#fff; display:block; font-size:16px; margin-bottom:4px; }',
            '.ct-edit { margin-top:16px; padding-top:14px; border-top:1px solid var(--ct-line); } .ct-edit > b { display:block; font-size:11.5px; letter-spacing:.14em; text-transform:uppercase; color:rgba(255,255,255,.55); margin-bottom:6px; } .ct-side label { font-size:11.5px; letter-spacing:.1em; } .ct-side input, .ct-side select { height:42px; border-radius:11px; background:#0d1220; border:1px solid var(--ct-line); }',
            '.ct-side input:focus, .ct-side select:focus { outline:none; border-color:var(--ct-gold); box-shadow:0 0 0 3px rgba(212,175,55,.18); } .ct-two2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; }',
            /* crear mesa */
            '.ct-shapes { display:grid; grid-template-columns:repeat(3,1fr); gap:9px; margin:6px 0 4px; } .ct-shape-card { padding:12px 6px 9px; border-radius:14px; border:1.5px solid var(--ct-line); background:rgba(255,255,255,.04); color:#cdd5e6; font:600 12px Inter,sans-serif; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:7px; transition:all .15s; } .ct-shape-card svg { width:54px; height:42px; } .ct-shape-card:hover { background:rgba(255,255,255,.09); } .ct-shape-card.sel { border-color:var(--ct-gold); background:rgba(212,175,55,.14); color:var(--ct-gold2); box-shadow:0 0 0 3px rgba(212,175,55,.14); }',
            '.ct-seg { display:flex; gap:8px; margin:6px 0 4px; } .ct-segb { flex:1; height:42px; border-radius:11px; border:1.5px solid var(--ct-line); background:rgba(255,255,255,.05); color:#fff; font:800 17px Inter,sans-serif; cursor:pointer; } .ct-segb.sel { border-color:var(--ct-gold); background:rgba(212,175,55,.16); color:var(--ct-gold2); } .ct-fixed { margin:6px 0 4px; padding:11px 14px; border-radius:11px; border:1px dashed var(--ct-line); color:#fff; font:800 15px Inter,sans-serif; } .ct-fixed small { font-weight:500; color:rgba(255,255,255,.55); } .ct-shape-card small { font-weight:500; font-size:10.5px; opacity:.7; margin-top:-4px; }',
            '.ct-step { display:grid; grid-template-columns:44px 1fr 44px; gap:8px; align-items:center; } .ct-step button { height:42px; border-radius:11px; border:1px solid var(--ct-line); background:rgba(255,255,255,.07); color:#fff; font:700 20px Inter,sans-serif; cursor:pointer; } .ct-step button:hover { background:rgba(255,255,255,.14); } .ct-step input { text-align:center; font-weight:800; font-size:17px; }',
            '.ct-price { position:relative; } .ct-price span { position:absolute; left:14px; top:50%; transform:translateY(-50%); color:var(--ct-gold2); font-weight:800; } .ct-side .ct-price input { padding-left:30px; }',
            '.ct-tip { margin:14px 0 0; padding:11px 13px; border-radius:12px; background:rgba(212,175,55,.1); border:1px dashed rgba(212,175,55,.5); color:#f3e3b0; font-size:13px; line-height:1.5; }',
            /* pantalla completa y ventanas */
            '.venue-map-fullscreen .ct-fs-bar .ct-btn { height:38px; } .ct-modal { border-radius:22px; background:linear-gradient(180deg,#141a2e,#0d1220); border:1px solid rgba(212,175,55,.45); } .ct-modal .btn.primary, .ct-modal .ct-btn.gold { height:44px; padding:0 20px; border-radius:12px; font-weight:800; color:#17120a; background:linear-gradient(180deg,#f1d27a,#c9a032); border:1px solid #d9b84a; cursor:pointer; } .ct-modal .cc-btn2 { height:44px; border-radius:12px; padding:0 18px; }',
            '@media (max-width:820px) { .ct-title h3 { font-size:20px; } .ct-stat { min-width:80px; } .ct-sep { display:none; } .ct-toolbar input[type=search] { margin-left:0; flex:1 1 100%; } }'
        ].join('\n');
        document.head.appendChild(s2);
    }

    var S = { db: null, box: null, venues: [], venue: null, events: [], event: null, rows: [], mapIdx: 0, sel: null, q: '', timer: null, sinSql: false, req: 0, grupo: false, pick: {}, gname: '', gnote: '', gpeople: '', arrastrando: false, areas: {}, arrivals: {}, operacion: [], templates: [], opts: null, want: null, agregar: false, fs: false, zoom: 1, addCfg: { kind: 'standard', shape: 'round', seats: 4, price: '', prices: {}, chairs: { t: 2, b: 2, l: 0, r: 0 }, chairsSq: { t: 1, b: 1, l: 0, r: 0 } }, chEdit: null };
    var NS = 'http://www.w3.org/2000/svg';

    // AUTORIZACIONES DEL OWNER: «vender» (venta telefónica, apartar, liberar) y «diseñar la sala» (mover, agregar, editar, quitar mesas; abrir la venta) son interruptores por persona.
    // La base los exige de todos modos; aquí solo se deciden qué botones se dibujan. Sin los datos nuevos (SQL sin aplicar) se usa el permiso por rol de antes.
    function puedeEditar() { return S.venue && S.venue.canEdit !== undefined ? !!S.venue.canEdit : core.puedeAbrirVenta(S.venue.role); }
    function puedeVender() { return S.venue && S.venue.canSell !== undefined ? !!S.venue.canSell : true; }

    function init(o) {
        css(); css2();
        S.db = o.db; S.box = o.box; S.venues = o.venues || [];
        S.venue = null; S.events = []; S.event = null; S.rows = []; S.mapIdx = 0; S.sel = null; S.q = ''; S.sinSql = false; S.req++; S.grupo = false; S.pick = {}; S.gname = ''; S.gnote = ''; S.gpeople = ''; S.areas = {}; S.agregar = false;   // estado limpio en cada arranque
        if (!S.venues.length) { S.box.innerHTML = '<p class="ct-empty">Tu cuenta todavía no tiene locales vinculados.</p>'; return; }
        S.venue = S.venues[0];
        S.box.innerHTML = '';
        buildFrame();
        loadEvents();
        clearInterval(S.timer);
        S.timer = setInterval(function () { if (document.visibilityState === 'visible' && S.box.offsetParent !== null && S.event && !S.event.template) { loadRows(true); refrescarLayout(); } }, 10000);   // en vivo, solo mientras se mira
    }
    function onShow() { if (S.event) loadRows(true); else if (S.db) loadEvents(); }

    function q$(sel) { return S.box.querySelector(sel); }
    function shapeIcon(t) {   // miniatura de la forma de mesa para el selector de «Crear mesa»
        var c = 'fill="#1b3a30" stroke="#2fd37f" stroke-width="2.4"', ch = 'fill="#2fd37f" fill-opacity=".6"';
        if (t === 'round') return '<svg viewBox="0 0 54 42"><circle cx="27" cy="21" r="10" ' + c + '/><rect x="23" y="2" width="8" height="5" rx="2" ' + ch + '/><rect x="23" y="35" width="8" height="5" rx="2" ' + ch + '/><rect x="6" y="18.5" width="5" height="8" rx="2" ' + ch + '/><rect x="43" y="18.5" width="5" height="8" rx="2" ' + ch + '/></svg>';
        if (t === 'square') return '<svg viewBox="0 0 54 42"><rect x="18" y="12" width="18" height="18" rx="4" ' + c + '/><rect x="23" y="2" width="8" height="5" rx="2" ' + ch + '/><rect x="23" y="35" width="8" height="5" rx="2" ' + ch + '/><rect x="9" y="17" width="5" height="8" rx="2" ' + ch + '/><rect x="40" y="17" width="5" height="8" rx="2" ' + ch + '/></svg>';
        return '<svg viewBox="0 0 54 42"><rect x="11" y="13" width="32" height="16" rx="4" ' + c + '/><rect x="14" y="4" width="8" height="5" rx="2" ' + ch + '/><rect x="32" y="4" width="8" height="5" rx="2" ' + ch + '/><rect x="14" y="33" width="8" height="5" rx="2" ' + ch + '/><rect x="32" y="33" width="8" height="5" rx="2" ' + ch + '/></svg>';
    }
    function kindIcon(id) {   // miniatura a escala relativa: el tamaño del círculo y de las sillas sigue al tamaño real del mueble
        if (id === 'square' || id === 'rect') return shapeIcon(id);
        var c = 'fill="#1b3a30" stroke="#2fd37f" stroke-width="2.4"', ch = 'fill="#2fd37f" fill-opacity=".6"', cfg = { cocktail: [6, 2], standard: [9, 6], high: [6, 4], family: [12.5, 10], stool: [5, 0] }[id] || [9, 6];
        var r = cfg[0], n = cfg[1], out = '<svg viewBox="0 0 54 42"><circle cx="27" cy="21" r="' + r + '" ' + c + '/>';
        for (var k = 0; k < n; k++) { var an = (Math.PI * 2 * k) / n - Math.PI / 2, rr = r + 6.5, cx = 27 + Math.cos(an) * rr, cy = 21 + Math.sin(an) * rr; out += '<rect x="' + (cx - 3) + '" y="' + (cy - 2.2) + '" width="6" height="4.4" rx="1.8" transform="rotate(' + (an * 180 / Math.PI + 90).toFixed(1) + ' ' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ')" ' + ch + '/>'; }
        return out + '</svg>';
    }
    function buildFrame() {
        var multi = S.venues.length > 1;
        // UNA sola fila de herramientas sobre el mapa (fija: se crea una vez y render() solo muestra/oculta lo que corresponde).
        S.box.innerHTML =
            '<div class="ct-head"><div class="ct-title"><div class="ct-badge">🏛️</div><div><h3 id="ct-title-name">Mapa maestro</h3><small id="ct-title-sub">Plano de la sala</small></div></div><div class="ct-stats" id="ct-stats"></div></div>' +
            '<div class="ct-toolbar" id="ct-toolbar">' + (multi ? '<select id="ct-venue" aria-label="Local"></select>' : '') + '<select id="ct-event" aria-label="Evento o plantilla"></select>' +
            '<span class="ct-pm" id="ct-pm" hidden><button type="button" class="ct-circ" id="ct-ev-plus" aria-label="Crear nuevo evento" title="Crear nuevo evento">+</button></span>' +
            '<button type="button" class="ct-btn ct-cancel-ev" id="ct-ev-minus" title="Cancelar este evento (solo si no tiene ventas)" hidden>Cancelar evento</button>' +
            '<span class="ct-sep"></span>' +
            '<button type="button" class="ct-btn gold" id="ct-manual" hidden>+ Reserva telefónica / Venta manual</button>' +
            '<button type="button" class="ct-btn gold icon" id="ct-open-day" title="Abrir operación de hoy" aria-label="Abrir operación de hoy" hidden>▶</button>' +
            '<button type="button" class="ct-btn" id="ct-open" hidden>Abrir la venta de mesas</button><span class="ct-msg" id="ct-day-msg" role="status"></span>' +
            '<input type="search" id="ct-q" list="ct-q-list" placeholder="Buscar evento, reserva o mesa…" aria-label="Buscar evento, reserva o mesa" autocomplete="off"><datalist id="ct-q-list"></datalist></div>' +
            '<div id="ct-body"></div>';
        if (multi) {
            var sv = q$('#ct-venue');
            S.venues.forEach(function (v, i) { var op = document.createElement('option'); op.value = i; op.textContent = v.name; sv.appendChild(op); });
            sv.addEventListener('change', function () { S.venue = S.venues[Number(sv.value)]; S.event = null; S.rows = []; S.sel = null; loadEvents(); });
        }
        q$('#ct-event').addEventListener('change', function () { elegirEvento(q$('#ct-event').value); });
        q$('#ct-open').addEventListener('click', openSales);
        q$('#ct-ev-plus').addEventListener('click', abrirCrearEvento);
        q$('#ct-ev-minus').addEventListener('click', quitarEvento);
        q$('#ct-open-day').addEventListener('click', abrirOperacion);
        q$('#ct-manual').addEventListener('click', function () { abrirVentaManual(S.sel && S.rows.some(function (x) { return x.table_key === S.sel && movible(x, Date.now()); }) ? [S.sel] : []); });
        // Buscador del extremo derecho: escribir el nombre de un evento (o elegirlo de la lista) abre ese evento; si no, filtra las mesas por titular, reserva o mesa.
        var qi = q$('#ct-q');
        qi.addEventListener('input', function () {
            var v = norm(qi.value).trim(), hallado = v ? (S.opts || []).filter(function (e) { return norm(etiquetaOpcion(e)) === v || (!e.template && norm(e.title) === v); })[0] : null;
            if (hallado) { qi.value = ''; S.q = ''; q$('#ct-event').value = hallado.id; elegirEvento(hallado.id); return; }
            S.q = qi.value; if (S.rows.length) render(false);
        });
    }
    function elegirEvento(id) {
        S.event = (S.opts || S.events).filter(function (e) { return e.id === id; })[0] || null;
        S.sel = null; S.pick = {}; S.mapIdx = 0; S.agregar = false; S.grupo = false; loadRows(false);
    }
    function etiquetaOpcion(e) { var o = q$('#ct-event') && [].filter.call(q$('#ct-event').options, function (x) { return x.value === e.id; })[0]; return o ? o.textContent : (e.title || ''); }
    // Título de la sección: «<Local> · Mapa maestro» (o «Master Map» en inglés).
    function pintarTitulo() {
        if (!S.venue) return;
        var en = /^en/i.test(document.documentElement.lang || ''), h = q$('#ct-title-name'), sub = q$('#ct-title-sub');
        if (h) h.textContent = (S.venue.name || '') + ' · ' + (en ? 'Master Map' : 'Mapa maestro');
        if (sub) sub.textContent = S.event ? (S.event.template ? (en ? 'Base floor plan' : 'Plano base de la sala') + ' · ' + (S.event.room_name || '') : (S.event.title || '') + (S.event.event_date ? ' · ' + fechaCorta(S.event.event_date) + (S.event.event_time ? ' ' + horaSola(S.event.event_time) : '') : '')) : (en ? 'Floor plan' : 'Plano de la sala');
        var h2 = document.querySelector('#cc-p-mesas h2'); if (h2) h2.textContent = (S.venue.name ? S.venue.name + ' · ' : '') + (en ? 'Master Map' : 'Mapa maestro');
    }
    // Muestra u oculta cada botón de la fila según el permiso y lo que se está viendo (plantilla o evento).
    function syncToolbar(o) {
        function mostrar(id, v) { var n = q$('#' + id); if (n) n.hidden = !v; return n; }
        var m = mostrar('ct-manual', o.vender && o.plan); if (m) { m.disabled = !!o.tpl; m.title = o.tpl ? 'La venta se registra dentro de un evento o de la operación de hoy.' : ''; }
        var od = mostrar('ct-open-day', o.tpl && (puedeVender() || puedeEditar())); if (od) od.disabled = false;
        mostrar('ct-q', true);
        var pm = mostrar('ct-pm', puedeEditar() && (S.venue.rooms || []).length > 0);
        var mi = q$('#ct-ev-minus'); if (mi) { mi.hidden = !(puedeEditar() && (S.venue.rooms || []).length > 0 && S.event && !S.event.template); mi.title = 'Cancelar este evento (solo si no tiene ventas, mesas apartadas ni pedidos). No borra mesas.'; }
        mostrar('ct-open', false);
    }
    function body(html) { q$('#ct-body').innerHTML = html; }

    // PLANTILLA MAESTRA: el plano base de cada sala (venue_rooms.layout) se muestra SIEMPRE, haya o no eventos. Es solo lectura: lo dibuja Miami DJ Beat; mover, agregar o vender se hace dentro de un evento.
    function filasDePlantilla(layout) {
        return ((layout && Array.isArray(layout.tables)) ? layout.tables : []).map(function (t) {
            return { id: 'tpl-' + t.key, table_key: t.key, label: t.label || t.key, seats: t.seats || 4, zone_name: t.zone || null, price_cents: t.price_cents || 0, status: 'available', held_until: null, buyer_name: null, reservation_name: null, note: null, order_id: null, sold_via: null };
        });
    }
    async function loadEvents() {
        var ids = (S.venue.rooms || []).map(function (r) { return r.id; }).filter(Boolean);
        var sel = q$('#ct-event'); sel.innerHTML = '';
        if (!ids.length) { syncToolbar({ tpl: false, abre: false, vender: false, plan: false }); body('<p class="ct-empty">Este local todavía no tiene salas.</p>'); return; }
        var roomName = {}; (S.venue.rooms || []).forEach(function (x) { roomName[x.id] = x.name; });
        var rl = await S.db.from('venue_rooms').select('id,name,layout').in('id', ids);
        S.templates = ((rl && rl.data) || []).filter(function (x) { return x.layout && Array.isArray(x.layout.tables) && x.layout.tables.length; }).map(function (x) {
            return { id: 'tpl:' + x.id, template: true, room_id: x.id, title: 'Plantilla maestra', layout: x.layout, room_name: x.name };
        });
        var r = await S.db.from('venue_events').select('id,title,event_date,event_time,status,tables_open,layout,room_id').in('room_id', ids);
        if (r.error) r = await S.db.from('venue_events').select('id,title,event_date,status,tables_open,layout,room_id').in('room_id', ids);   // sin el SQL de la hora aún no existe event_time
        if (r.error) r = await S.db.from('venue_events').select('id,title,event_date,status,room_id').in('room_id', ids);   // sin el SQL de mesas aún no existen tables_open / layout
        if (r.error) { syncToolbar({ tpl: false, abre: false, vender: false, plan: false }); body('<p class="ct-empty">No se pudieron cargar los eventos. Recarga la página.</p>'); return; }
        var hoyStr = diaNegocio();       // el día de negocio va de las 6:00 a las 6:00 (hora de Miami): hasta las 6 a. m. «hoy» sigue siendo el día anterior
        S.events = (r.data || []).filter(function (e) { return (e.status === 'announced' || e.status === 'operation') && (!e.event_date || e.event_date >= hoyStr); })
            .sort(function (a, b) { return String(a.event_date || '9999').localeCompare(String(b.event_date || '9999')) || (a.status === 'operation' ? -1 : 1); });
        S.operacion = S.events.filter(function (e) { return e.status === 'operation' && e.event_date === hoyStr; });      // «Operación de hoy» ya abierta, por sala
        S.opts = S.templates.concat(S.events);
        if (!S.opts.length) { syncToolbar({ tpl: false, abre: false, vender: false, plan: false }); body('<p class="ct-empty">Esta sala todavía no tiene un plano de mesas. Miami DJ Beat lo dibuja y después aparece aquí.</p>'); q$('#ct-open').hidden = true; return; }
        S.templates.forEach(function (t) {
            var op = document.createElement('option'); op.value = t.id;
            op.textContent = '🏛️ Plantilla maestra (' + (S.venue.name || 'sala') + (S.venue.rooms.length > 1 ? ' · ' + (roomName[t.room_id] || 'sala') : '') + ')';
            sel.appendChild(op);
        });
        S.events.forEach(function (e) {
            var op = document.createElement('option'); op.value = e.id;
            op.textContent = (e.status === 'operation' ? '🕘 ' : '') + (e.event_date ? fechaCorta(e.event_date) + (e.event_time ? ' ' + horaSola(e.event_time) : '') + ' · ' : '') + e.title + (S.venue.rooms.length > 1 ? ' (' + (roomName[e.room_id] || 'sala') + ')' : '');
            sel.appendChild(op);
        });
        var dl = q$('#ct-q-list'); if (dl) dl.innerHTML = S.events.map(function (e) { return '<option value="' + esc(e.title) + '">' + esc(e.event_date ? fechaCorta(e.event_date) : '') + '</option>'; }).join('');
        pintarTitulo();
        if (S.want) { var deseado = S.events.filter(function (e) { return e.id === S.want; })[0]; if (deseado) S.event = deseado; S.want = null; }   // «Ver mapa» desde Resumen
        if (!S.event || !S.opts.some(function (e) { return e.id === S.event.id; })) S.event = S.operacion[0] || S.opts[0];   // sin elección: la operación de hoy si ya está abierta; si no, la plantilla maestra (el plano siempre se ve)
        else if (S.event.template) S.event = S.opts.filter(function (e) { return e.id === S.event.id; })[0];              // refresca el dibujo de la plantilla
        sel.value = S.event.id;
        loadRows(false);
    }
    async function abrirOperacion() {
        var b = q$('#ct-open-day'), m = q$('#ct-day-msg'); if (!b || !S.event || !S.event.template) return;
        b.disabled = true; if (m) { m.style.color = 'rgba(255,255,255,.8)'; m.textContent = 'Abriendo…'; }
        var res = await S.db.rpc('venue_open_day', { p_room_id: S.event.room_id });
        if (res.error || !res.data || !res.data.ok) {
            b.disabled = false; var t = String((res.error && res.error.message) || '');
            if (m) { m.style.color = '#ff6060'; m.textContent = /no_autorizado/.test(t) ? 'Tu cuenta no puede abrir la operación del día.' : (/venue_open_day/.test(t) && /exist|find|schema/i.test(t) ? 'Falta aplicar el SQL de la operación diaria.' : (/sin_mapa/.test(t) ? ERRORES.sin_mapa : 'No se pudo abrir. Intenta de nuevo.')); }
            return;
        }
        S.want = res.data.event_id; await loadEvents();
    }
    // Deja elegido un evento concreto (desde «Resumen» → «Mapa y mesas»). Si aún no está cargado (recién creado), se recarga la lista y se elige al llegar.
    function selectEvent(id) {
        S.want = id;
        if (!S.db || !S.box || !S.venue) return;
        var sel = S.box.querySelector('#ct-event'), hallado = S.events.filter(function (e) { return e.id === id; })[0];
        if (hallado && sel) { S.want = null; S.event = hallado; sel.value = id; S.sel = null; S.pick = {}; S.mapIdx = 0; loadRows(false); }
        else loadEvents();
    }
    function diaNegocio() { try { return new Date(Date.now() - 6 * 3600 * 1000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); } catch (e) { return new Date().toISOString().slice(0, 10); } }
    function horaSola(t) { var m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); if (!m) return ''; var h = Number(m[1]), ap = h >= 12 ? 'p. m.' : 'a. m.'; h = h % 12; if (h === 0) h = 12; return h + ':' + m[2] + ' ' + ap; }
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
        if (S.event.template) { S.rows = filasDePlantilla(S.event.layout); render(silencioso); return; }   // el taller sigue en su modo (agregar / mover) tras cada cambio   // la plantilla no tiene inventario: es el dibujo base
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
        S.arrivals = {};                                                  // quién de las mesas apartadas ya ingresó (para «Tolerancia vencida»); si la función aún no existe, se sigue sin esa alerta
        if (S.rows.some(function (x) { return x.order_id && x.status === 'reserved'; })) {
            try { var ar = await S.db.rpc('venue_event_table_arrivals', { p_event_id: id }); if (mia !== S.req || !S.event || S.event.id !== id) return; if (ar && !ar.error && Array.isArray(ar.data)) ar.data.forEach(function (a) { S.arrivals[a.table_key] = a; }); } catch (eA) { /* sin alerta */ }
        }
        render(silencioso);
    }

    // ── Dibujo ──
    function el(name, attrs, parent, text) { var n = document.createElementNS(NS, name); Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); }); if (text != null) n.textContent = text; if (parent) parent.appendChild(n); return n; }
    function chairsFor(t) {
        var pts = [], k, seats = t.seats || 4;
        if (t.t === 'stool') return pts;                                                                   // el taburete ES la silla: no lleva sillas alrededor
        if (t.t === 'round') { var rr = radioDe('round', seats, null, null, t.r) + 10; for (k = 0; k < seats; k++) { var an = (Math.PI * 2 * k) / seats; pts.push([Math.cos(an) * rr, Math.sin(an) * rr]); } }
        else if (t.t === 'square') {
            var d = (t.w || 54) / 2 + 10;
            if (t.chairs && sumaLados(t.chairs) === seats) { if (t.chairs.t) pts.push([0, -d]); if (t.chairs.b) pts.push([0, d]); if (t.chairs.l) pts.push([-d, 0]); if (t.chairs.r) pts.push([d, 0]); }
            else if (seats <= 4) pts = [[0, -d], [0, d], [-d, 0], [d, 0]].slice(0, seats);                       // 1 arriba · 2 arriba y abajo · 3 +izquierda · 4 los cuatro lados
            else { var lado = d * 2, per = lado * 4; for (k = 0; k < seats; k++) { var sp = ((k + 0.5) * per) / seats, q = Math.floor(sp / lado), u = sp - q * lado - d; pts.push(q === 0 ? [u, -d] : (q === 1 ? [d, u] : (q === 2 ? [-u, d] : [-d, -u]))); } }
        }
        else {
            var w = t.w || 108, dy = (t.h || 54) / 2 + 10, ch = t.chairs && sumaLados(t.chairs) === seats ? t.chairs : partePar(seats);
            for (k = 0; k < ch.t; k++) pts.push([-w / 2 + (w * (k + 0.5)) / ch.t, -dy]);
            for (k = 0; k < ch.b; k++) pts.push([-w / 2 + (w * (k + 0.5)) / ch.b, dy]);
            if (ch.l) pts.push([-(w / 2 + 10), 0]);
            if (ch.r) pts.push([w / 2 + 10, 0]);
        }
        return pts;
    }
    function zoneBox(svg, r, label, rot, kind) {
        var fac = kind === 'bano' || kind === 'barra';
        el('rect', { 'class': 'zone' + (fac ? ' fac' : ''), x: r[0], y: r[1], width: r[2], height: r[3], rx: 10 }, svg);
        var cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2, a = { 'class': 'zone-label' + (fac ? ' fac' : ''), x: cx, y: cy + 4 };
        if (rot) a.transform = 'rotate(90 ' + cx + ' ' + (cy + 4) + ')';
        el('text', a, svg, label);
    }
    // Una mesa vista desde arriba: sillas orientadas hacia la mesa + tablero con relieve. Sirve para el plano y para la vista previa de «Crear mesa».
    function mesaSVG(g0, t) {
        var g = g0, seats = t.seats || 4, cs = chairsFor({ t: t.t, w: t.w, h: t.h, seats: seats, chairs: t.chairs, r: t.r });
        if (t.rot) g = el('g', { transform: 'rotate(' + Number(t.rot) + ' ' + t.x + ' ' + t.y + ')' }, g0);        // giro de la mesa con sus sillas
        cs.forEach(function (c) {
            var ang = Math.atan2(c[1], c[0]) * 180 / Math.PI - 90, cx = t.x + c[0], cy = t.y + c[1];
            el('rect', { 'class': 'seat', x: cx - 7, y: cy - 5, width: 14, height: 10, rx: 3.5, transform: 'rotate(' + ang.toFixed(1) + ' ' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ')' }, g);
        });
        if (t.t === 'stool') { el('circle', { 'class': 'shape', cx: t.x, cy: t.y, r: 13 }, g); el('circle', { 'class': 'ring', cx: t.x, cy: t.y, r: 8 }, g); }
        else if (t.t === 'round') { var r = radioDe('round', seats, null, null, t.r); el('circle', { 'class': 'shape', cx: t.x, cy: t.y, r: r }, g); el('circle', { 'class': 'ring', cx: t.x, cy: t.y, r: r - 6 }, g); }
        else { var w = t.w || 54, h = t.h || w; el('rect', { 'class': 'shape', x: t.x - w / 2, y: t.y - h / 2, width: w, height: h, rx: 9 }, g); el('rect', { 'class': 'ring', x: t.x - w / 2 + 5, y: t.y - h / 2 + 5, width: w - 10, height: h - 10, rx: 5 }, g); }
    }
    function drawPlan(svg, map, byKey, ahora, qn) {
        svg.innerHTML = '';
        svg.setAttribute('viewBox', '0 0 ' + ((map.room && map.room.w) || 800) + ' ' + ((map.room && map.room.h) || 520));
        if (map.custom) {
            if (root.mdjPlanShapes) root.mdjPlanShapes.dibujar(svg, map.shapes, map.room);          // arquitectura dibujada en el editor de salas
            if (S.grupo && puedeEditar() && Array.isArray(map.shapes)) map.shapes.forEach(function (it) {             // en «Mover mobiliario» las mesas de la terraza (T01…) también se arrastran
                if (!esMuebleShape(it)) return;
                var n = svg.querySelector('[data-id="' + String(it.id).replace(/"/g, '') + '"]'); if (!n) return;
                n.setAttribute('class', (n.getAttribute('class') || '') + ' ct-mueble'); n.style.pointerEvents = 'all';
                n.addEventListener('pointerdown', function (e) { arrastrarMueble(e, it, n, svg, map); });
            });
        }
        else {
            el('path', { d: 'M 340 505 H 12 V 12 H 788 V 505 H 460', fill: 'none', stroke: 'rgba(255,255,255,0.4)', 'stroke-width': 4, 'stroke-linejoin': 'round' }, svg);
            if (map.focal && map.focal.rect) zoneBox(svg, map.focal.rect, map.focal.label || '', map.focal.rot, map.focal.k);
            (map.fixed || []).forEach(function (f) { zoneBox(svg, f.r, f.l, f.rot, f.k); });
        }
        // Degradados de las mesas (relieve): se definen una vez por dibujo.
        var defs = el('defs', {}, svg);
        [['ctg-ok', '#2c5a4a', '#0f221c'], ['ctg-tpl', '#3b4058', '#161a28'], ['ctg-res', '#5e4a20', '#251b09'], ['ctg-sold', '#6e2c33', '#2a1015']].forEach(function (d) {
            var gr = el('radialGradient', { id: d[0], cx: '35%', cy: '28%', r: '85%' }, defs); el('stop', { offset: '0', 'stop-color': d[1] }, gr); el('stop', { offset: '1', 'stop-color': d[2] }, gr);
        });
        (map.tables || []).forEach(function (t) {
            var row = byKey[t.id]; if (!row) return;                         // solo mesas que existen en el inventario
            var est = estadoDe(row, ahora), libre = movible(row, ahora), pick = S.grupo && S.pick[t.id], tplv = !!(S.event && S.event.template);
            var g = el('g', { 'class': 'tbl' + (t.t === 'stool' ? ' stool' : '') + ' st-' + (tplv ? 'tpl' : est) + (S.grupo ? (S.pick[t.id] ? ' ct-pick' : '') + (libre ? ' ct-mov' : ' ct-fijo') : (S.sel === t.id ? ' ct-sel' : '')), role: 'button', tabindex: '0', 'data-id': t.id,
                'aria-label': (t.t === 'stool' ? 'Taburete ' : 'Mesa ') + row.label + ', ' + ETIQUETA[est] + (row.buyer_name ? ', ' + row.buyer_name : '') + (S.grupo && libre ? (pick ? ', en el grupo' : ', toca para sumarla al grupo o arrástrala') : '') }, svg);
            if (qn && est !== 'available' && !coincide(row, qn)) g.setAttribute('class', g.getAttribute('class') + ' ct-dim');
            var venc = vencida(row, ahora); if (venc) g.setAttribute('class', g.getAttribute('class') + ' ct-overdue');
            mesaSVG(g, { t: t.t, x: t.x, y: t.y, w: t.w, h: t.h, seats: row.seats, rot: t.rot, chairs: t.chairs, r: t.r });
            var esT = t.t === 'stool';
            el('text', { x: t.x, y: t.y + (esT ? 3 : 0) }, g, row.label);
            if (!esT) el('text', { 'class': 'px', x: t.x, y: t.y + (esT ? 31 : 15) }, g, tplv || est === 'available' ? precioTxt(row) : (est === 'held' ? 'EN PAGO' : (est === 'reserved' ? (venc ? 'VENCIDA' : 'APARTADA') : 'VENDIDA')));
            function elegir(e) { if (e && e.stopPropagation) e.stopPropagation(); S.agregar = false; S.sel = t.id; render(false); }       // en «Agregar», tocar un mueble ya puesto lo elige: ahí está «Eliminar»
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
    // Reserva con hora límite ya pasada y nadie de esa mesa ha ingresado: «Tolerancia vencida» (el personal decide liberarla).
    function vencida(row, ahora) {
        if (!row || row.status !== 'reserved' || !row.arrive_by || new Date(row.arrive_by).getTime() >= ahora) return false;
        var a = S.arrivals[row.table_key];
        return !(a && a.inside > 0);
    }
    function coincide(row, qn) { return [row.table_key, row.label, row.buyer_name, row.reservation_name, row.note, row.zone_name].some(function (x) { return norm(x).indexOf(qn) >= 0; }); }

    // Botonera de solo emoji sobre el lienzo (esquina superior derecha, donde todo el mundo busca esos controles). El nombre aparece solo al pasar el cursor.
    function toolsHtml(abre, conFull) {
        return (abre ? '<button type="button" class="ct-tool' + (S.grupo ? ' on' : '') + '" id="ct-grupo" title="Mover mobiliario" aria-label="Mover mobiliario" aria-pressed="' + !!S.grupo + '">🗺️</button>' +
                       '<button type="button" class="ct-tool' + (S.agregar ? ' on' : '') + '" id="ct-add" title="Agregar mesa o taburete" aria-label="Agregar mesa o taburete" aria-pressed="' + !!S.agregar + '">🪑</button>' : '') +
            (conFull ? '<button type="button" class="ct-tool" id="ct-full" title="Pantalla completa" aria-label="Pantalla completa">⛶</button>' : '');
    }
    function mapbar(abre) {
        var pista = S.agregar ? 'Toca el plano donde va el mueble nuevo · para editar o eliminar uno, tócalo' : (S.grupo ? 'Arrastra las mesas y el mobiliario para moverlos' : '');
        // en pantalla completa las herramientas viven en la barra de arriba (el panel flotante de la derecha las taparía)
        return '<div class="ct-mapbar"><span class="ct-hint">' + esc(pista) + '</span><span class="ct-tools">' + (S.fs ? '' : toolsHtml(abre, true)) + '</span></div>';
    }
    function render(silencioso) {
        if (silencioso && S.arrastrando) return;       // no se redibuja a mitad de un arrastre
        var ahora = Date.now(), rows = S.rows, rs = resumen(rows, ahora);
        var tpl = !!(S.event && S.event.template);                 // plantilla maestra: el plano base, solo lectura
        var abre = puedeEditar();
        var openBtn = q$('#ct-open');
        if (!rows.length) {
            syncToolbar({ tpl: false, abre: false, vender: false, plan: false });
            openBtn.hidden = !abre;
            var as = S.areas[S.event.room_id] || [];
            body(abre ? '<p class="ct-empty">La venta de mesas de este evento todavía no está abierta. Al abrirla se crea el inventario de mesas con el mapa de la sala, y los clientes pueden empezar a comprar.</p>' +
                        (as.length > 1 ? '<div class="ct-map-sum" id="ct-open-areas"><b>Áreas que se venden en este evento</b><br>' + as.map(function (a) { return '<label style="display:inline-flex;gap:6px;align-items:center;margin:6px 16px 0 0;"><input type="checkbox" value="' + esc(a.id) + '" checked' + (a.siempre ? ' disabled' : '') + '> ' + esc(a.label) + (a.siempre ? ' <small style="color:rgba(255,255,255,.55)">(siempre abierta)</small>' : '') + '</label>'; }).join('') +
                          '<br><small style="color:rgba(255,255,255,.6);">Normalmente se venden todas juntas. Desmarca un área solo en una ocasión especial (por ejemplo, el VIP cuando se separa con una pared).</small></div>' : '')
                      : '<p class="ct-empty">La venta de mesas de este evento todavía no está abierta. Pídele al dueño o a un manager que la abra.</p>');
            return;
        }
        syncToolbar({ tpl: tpl, abre: abre, vender: puedeVender(), plan: true });
        var maps = mapsDe(S.event.layout, rows);
        if (S.mapIdx >= maps.length) S.mapIdx = 0;
        // Cifras del encabezado (en la plantilla: mesas y sillas; en un evento: libres, apartadas, vendidas y lo vendido).
        function stat(cls, n, t, id) { return '<' + (id ? 'button type="button" id="' + id + '"' : 'div') + ' class="ct-stat ' + cls + '"><b>' + n + '</b><span>' + t + '</span></' + (id ? 'button' : 'div') + '>'; }
        var statsHtml;
        if (tpl) statsHtml = stat('gold', rows.length, 'Mesas') + stat('', rows.reduce(function (n, r) { return n + (r.seats || 0); }, 0), 'Sillas') + stat('', (S.event.layout && Array.isArray(S.event.layout.maps)) ? S.event.layout.maps.length : 1, 'Planos');
        else {
            var nVenc = rows.filter(function (x) { return vencida(x, ahora); }).length;
            statsHtml = stat('ok', rs.counts.available, 'Libres') + stat('warn2', rs.counts.reserved + rs.counts.held, 'Apartadas') + stat('bad', rs.counts.sold_online + rs.counts.sold_manager, 'Vendidas') + stat('gold', dinero(rs.cents.online + rs.cents.manager), 'Vendido') +
                (nVenc ? stat('warn', nVenc, '⚠ Tolerancia vencida', 'ct-venc') : '');
        }
        q$('#ct-stats').innerHTML = statsHtml;
        var titulo = tpl ? 'Plantilla maestra · ' + (S.event.room_name || '') : (S.event.title || 'Evento') + (S.event.event_date ? ' · ' + fechaCorta(S.event.event_date) + (S.event.event_time ? ' ' + horaSola(S.event.event_time) : '') : '');
        var html =
            (maps.length > 1 ? '<div class="ct-tabs" role="tablist">' + maps.map(function (m, i) { return '<button type="button" role="tab" data-i="' + i + '" aria-selected="' + (i === S.mapIdx) + '">' + esc(m.label || 'Mapa') + '</button>'; }).join('') + '</div>' : '') +
            areasHtml(maps) +
            '<div id="venue-canvas-wrap" class="ct-canvas' + (S.fs ? ' venue-map-fullscreen' : '') + '">' +
            '<div class="ct-fs-bar"><b>' + esc(titulo) + '</b><span style="flex:1"></span>' + (S.fs ? toolsHtml(abre, false) : '') + '<button type="button" class="ct-btn gold" id="ct-fs-exit">✕ Salir de Pantalla Completa</button></div>' +
            '<div class="ct-zoom" role="group" aria-label="Zoom del plano"><button type="button" id="ct-z-in" aria-label="Acercar" title="Acercar (+)">+</button><button type="button" id="ct-z-reset" title="Restablecer (0)" aria-label="Restablecer zoom">100%</button><button type="button" id="ct-z-out" aria-label="Alejar" title="Alejar (−)">−</button></div>' +
            '<div class="ct-grid"><div><div class="ct-wrap">' + mapbar(abre) + '<svg class="ct-plan" id="ct-plan" viewBox="0 0 800 520" role="group" aria-label="Plano de la sala"></svg></div>' +
            (tpl ? '<div class="ct-leg"><span style="color:#d4af37"><i style="background:#d4af37"></i><b style="color:#e8ecf5;font-weight:600">Mesa del plano base</b></span></div></div>' : '<div class="ct-leg"><span style="color:#2fd37f"><i style="background:#2fd37f"></i><b style="color:#e8ecf5;font-weight:600">Libre</b></span><span style="color:#ffb020"><i style="background:#ffb020"></i><b style="color:#e8ecf5;font-weight:600">Apartada / en pago</b></span><span style="color:#ff5d5d"><i style="background:#ff5d5d"></i><b style="color:#e8ecf5;font-weight:600">Vendida</b></span></div></div>') +
            '<div class="ct-side" id="ct-side"></div></div></div><div class="ct-list" id="ct-list"></div>';
        // No se redibuja el formulario si el staff está escribiendo en él (el refresco automático no debe borrarle lo escrito).
        var escribiendo = silencioso && S.box.contains(document.activeElement) && document.activeElement.closest && document.activeElement.closest('#ct-side');
        var sideKeep = escribiendo ? q$('#ct-side') : null, sideHtml = sideKeep ? sideKeep.innerHTML : null;
        body(html);
        if (sideKeep) q$('#ct-side').innerHTML = sideHtml;
        var byKey = {}; rows.forEach(function (r) { byKey[r.table_key] = r; });
        drawPlan(q$('#ct-plan'), maps[S.mapIdx], byKey, ahora, norm(S.q).trim());
        [].forEach.call(S.box.querySelectorAll('.ct-tabs button'), function (b) { b.addEventListener('click', function () { S.mapIdx = Number(b.dataset.i); render(false); }); });
        wireAreas();
        var cv = q$('#ct-venc'); if (cv) cv.addEventListener('click', function () { var p = rows.filter(function (x) { return vencida(x, Date.now()); })[0]; if (p) { S.sel = p.table_key; render(false); } });
        pintarTitulo();
        var tg = q$('#ct-grupo'); if (tg) tg.addEventListener('click', function () { S.grupo = !S.grupo; S.agregar = false; S.pick = {}; S.sel = null; render(false); });
        var ta = q$('#ct-add'); if (ta) ta.addEventListener('click', function () { S.agregar = !S.agregar; S.grupo = false; S.pick = {}; S.sel = null; render(false); });
        var tf = q$('#ct-full'); if (tf) tf.addEventListener('click', function () { S.fs = true; S.zoom = 1; render(false); });
        q$('#ct-fs-exit').addEventListener('click', salirFs);
        q$('#ct-z-in').addEventListener('click', function () { zoomPor(1.25); });
        q$('#ct-z-out').addEventListener('click', function () { zoomPor(0.8); });
        q$('#ct-z-reset').addEventListener('click', function () { zoomPor(0); });
        var wrapZ = q$('#ct-plan') && q$('#ct-plan').parentNode;            // Ctrl/⌘ + rueda y el pellizco del trackpad acercan o alejan (la rueda sola sigue desplazando)
        if (wrapZ) wrapZ.addEventListener('wheel', function (e) { if (!S.fs || !(e.ctrlKey || e.metaKey)) return; e.preventDefault(); zoomPor(e.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });
        var plan = q$('#ct-plan');
        if (S.agregar && plan) {
            plan.setAttribute('class', 'ct-plan ct-adding');
            var mapaActual = maps[S.mapIdx];
            function puntoDe(e) { var pt = plan.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; var m = plan.getScreenCTM(); if (!m) return null; var p = pt.matrixTransform(m.inverse()), w = (mapaActual.room && mapaActual.room.w) || 800, h = (mapaActual.room && mapaActual.room.h) || 520; return { x: core.ajustar(p.x, 26, w - 26), y: core.ajustar(p.y, 26, h - 26) }; }
            plan.addEventListener('click', function (e) { var p = puntoDe(e); if (p) agregarEn(mapaActual, p.x, p.y); });
            plan.addEventListener('pointermove', function (e) {              // vista previa: la mesa fantasma sigue al cursor (con la forma y las sillas elegidas)
                var p = puntoDe(e); if (!p) return; var gh = plan.querySelector('#ct-ghost'); if (gh) plan.removeChild(gh);
                var sh = S.addCfg.shape, gg = el('g', { id: 'ct-ghost', 'class': 'tbl ghost st-tpl' }, plan);
                mesaSVG(gg, { t: sh, x: p.x, y: p.y, w: sh === 'rect' ? 108 : (sh === 'square' ? 54 : undefined), h: sh === 'rect' ? 54 : undefined, seats: sh === 'stool' ? 1 : (sh === 'rect' ? sumaLados(S.addCfg.chairs) : (sh === 'square' ? sumaLados(S.addCfg.chairsSq) : Math.max(1, Math.min(40, Number(S.addCfg.seats) || 4)))), chairs: sh === 'rect' ? S.addCfg.chairs : (sh === 'square' ? S.addCfg.chairsSq : undefined), r: tipoDe(S.addCfg.kind).radio });
            });
            plan.addEventListener('pointerleave', function () { var gh = plan.querySelector('#ct-ghost'); if (gh) plan.removeChild(gh); });
        }
        document.body.classList.toggle('ct-fs-lock', !!S.fs);
        aplicarZoom();
        if (!escribiendo) renderSide(byKey, ahora);
        if (tpl) q$('#ct-list').innerHTML = ''; else renderList(rows, ahora);
    }
    // ── Pantalla completa del plano: el contenedor del mapa (#venue-canvas-wrap) pasa a cubrir toda la ventana; el panel de la mesa flota sobre el lateral derecho.
    //    El zoom cambia el TAMAÑO del dibujo (el viewBox no cambia), así que arrastrar y tocar mesas siguen calculando bien dónde está el cursor (getScreenCTM).
    function salirFs() { if (!S.fs) return; S.fs = false; S.zoom = 1; render(false); document.body.classList.remove('ct-fs-lock'); }
    // Cambia el zoom (factor 0 = restablecer) y conserva el centro de lo que se está mirando.
    function zoomPor(f) {
        var wrap = q$('#ct-plan') && q$('#ct-plan').parentNode, rx = 0.5, ry = 0.5;
        if (wrap && wrap.scrollWidth > 0 && wrap.scrollHeight > 0) { rx = (wrap.scrollLeft + wrap.clientWidth / 2) / wrap.scrollWidth; ry = (wrap.scrollTop + wrap.clientHeight / 2) / wrap.scrollHeight; }
        S.zoom = f === 0 ? 1 : Math.max(0.5, Math.min(4, S.zoom * f));
        aplicarZoom();
        if (wrap && f !== 0) { var fijar = function () { wrap.scrollLeft = rx * wrap.scrollWidth - wrap.clientWidth / 2; wrap.scrollTop = ry * wrap.scrollHeight - wrap.clientHeight / 2; }; fijar(); if (window.requestAnimationFrame) window.requestAnimationFrame(function () { window.requestAnimationFrame(fijar); }); }
    }
    function aplicarZoom() {
        var svg = q$('#ct-plan'), wrap = q$('#ct-plan') && q$('#ct-plan').parentNode; if (!svg || !wrap) return;
        var zb = q$('#ct-z-reset'); if (zb) zb.textContent = Math.round(S.zoom * 100) + '%';
        if (!S.fs) { svg.style.width = ''; svg.style.height = ''; return; }
        function ajusta() {
            var vb = svg.viewBox && svg.viewBox.baseVal, asp = vb && vb.height ? vb.width / vb.height : 1.54;
            var fit = Math.max(200, Math.min(wrap.clientWidth - 2, (wrap.clientHeight - 2) * asp));       // «Restablecer» = el plano entero cabe en pantalla
            svg.style.width = Math.round(fit * S.zoom) + 'px'; svg.style.height = 'auto';
        }
        ajusta(); if (window.requestAnimationFrame) window.requestAnimationFrame(ajusta);
    }
    document.addEventListener('keydown', function (e) { if (e.key !== 'Escape' || !S.fs || document.getElementById('ct-modal-bg')) return; salirFs(); });
    // Atajos de teclado: «+» / «−» / «0» (zoom, en pantalla completa) y «Borrar» (elimina la mesa elegida, con confirmación). Nunca mientras se escribe en un campo.
    document.addEventListener('keydown', function (e) {
        if (!S.box || S.box.offsetParent === null || document.getElementById('ct-modal-bg') || e.ctrlKey || e.metaKey || e.altKey) return;
        var t = e.target, tag = t && t.tagName ? t.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable)) return;
        var k = e.key;
        if (S.fs && (k === '+' || k === '=' || k === '-' || k === '_' || k === '0')) { e.preventDefault(); zoomPor(k === '+' || k === '=' ? 1.25 : (k === '0' ? 0 : 0.8)); return; }
        if ((k === 'r' || k === 'R') && S.sel && !S.agregar && !S.grupo && puedeEditar() && !esTaburete(S.sel)) {
            var rr = S.rows.filter(function (x) { return x.table_key === S.sel; })[0];
            if (rr && (esPlantilla() || estadoDe(rr, Date.now()) === 'available' || estadoDe(rr, Date.now()) === 'reserved')) { e.preventDefault(); girarMesa(rr, e.shiftKey ? -90 : 90); }
            return;
        }
        if ((k === 'Delete' || k === 'Backspace') && S.sel && !S.agregar && !S.grupo && puedeEditar()) {
            var r = S.rows.filter(function (x) { return x.table_key === S.sel; })[0]; if (!r) return;
            if (esPlantilla() || estadoDe(r, Date.now()) === 'available') { e.preventDefault(); editarMesa('remove', r); }
        }
    });
    window.addEventListener('resize', function () { if (S.fs) aplicarZoom(); });

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
        if (S.agregar) { renderSideAgregar(); return; }
        var side = q$('#ct-side'), r = S.sel && byKey[S.sel], tp = esPlantilla();
        if (!r) { side.innerHTML = '<div class="ct-sd-empty"><div style="font-size:44px;line-height:1;margin-bottom:12px">🪑</div><b>Elige una mesa</b>Toca una mesa del plano para ver sus datos' + (puedeEditar() ? ' y editarla.' : '.') + '</div><p class="ct-msg" id="ct-msg" role="status" style="padding:0 18px 14px"></p>'; return; }
        var est = estadoDe(r, ahora), quien = r.buyer_name || '';
        var clase = tp ? 'tpl' : (est === 'available' ? '' : (est === 'held' || est === 'reserved' ? 'res' : 'sold'));
        var pillEstado = tp ? '<span class="ct-state" style="color:#d4af37;background:rgba(212,175,55,.12)"><i></i>Plano base</span>'
            : '<span class="ct-state ' + (est === 'available' ? 'ok' : (est === 'held' || est === 'reserved' ? 'res' : 'sold')) + '"><i></i>' + ETIQUETA[est] + '</span>';
        var esT = esTaburete(r.table_key);
        var h = '<div class="ct-sd-head"><div class="ct-sd-badge ' + clase + '">' + esc(r.label) + '</div><div><h3>' + (esT ? 'Taburete ' : 'Mesa ') + esc(r.label) + '</h3><small>' + esc(r.zone_name || 'Sala') + (esT ? ' · 1 asiento' : '') + '</small></div></div><div class="ct-sd-body">' +
            '<div class="ct-pills"><span class="ct-pill">' + (esT ? '1 asiento' : r.seats + ' sillas') + '</span><span class="ct-pill gold">' + esc(precioTxt(r)) + (tp ? ' sugerido' : '') + '</span></div>' + pillEstado;
        if (est === 'held') h += '<p class="ct-empty">El cliente está pagando. Se libera sola si no termina' + (r.held_until ? ' (antes de las ' + new Date(r.held_until).toLocaleTimeString('es-US', { hour: 'numeric', minute: '2-digit' }) + ')' : '') + '. Espera a que termine o venza.</p>';
        if (est === 'sold_online') h += '<p class="ct-empty"><b style="color:#fff;">' + esc(r.buyer_name || '—') + '</b>' + (r.reservation_name && r.reservation_name !== r.buyer_name ? '<br>Reserva: «' + esc(r.reservation_name) + '»' : '') + (r.order_id ? '<br>Pedido ' + esc(codigo(r.order_id)) : '') + '<br>Se pagó en línea: para devolverla hay que reembolsar el pago (pídelo al dueño).</p>';
        if (est === 'sold_manager' || est === 'reserved') h += '<p class="ct-empty"><b style="color:#fff;">' + esc(quien || '—') + '</b>' + (r.note ? '<br>' + esc(r.note) : '') + '</p>';
        var conOrden = est === 'reserved' && !!r.order_id;                      // reserva directa: lleva pases QR y hora límite
        var venc = false;
        if (conOrden) {
            var arr = S.arrivals[r.table_key], dentro = arr ? arr.inside : 0, pases = arr ? arr.passes : 0; venc = vencida(r, ahora);
            if (r.arrive_by) {
                if (venc) h += '<div class="ct-alerta">⚠ Tolerancia vencida: la hora límite era las ' + esc(hora12(r.arrive_by)) + ' y nadie de esta mesa ha ingresado. Puedes liberar la mesa para reabrirla ahora.</div>';
                else if (dentro > 0) h += '<div class="ct-ok">Ya ingresaron ' + dentro + (pases ? ' de ' + pases : '') + '.</div>';
                else h += '<p class="ct-empty" style="margin:10px 0 0">Llega antes de las <b style="color:#fff">' + esc(hora12(r.arrive_by)) + '</b>.</p>';
            }
        }
        if (!tp && puedeVender() && (est === 'available' || est === 'reserved' || est === 'sold_manager')) {
            if (est === 'reserved' && !conOrden) h += '<label for="ct-name">Nombre de quien renta</label><input id="ct-name" type="text" maxlength="80" value="' + esc(quien) + '" autocomplete="off">' +
                '<label for="ct-note">Nota (opcional)</label><input id="ct-note" type="text" maxlength="120" value="' + esc(r.note || '') + '" autocomplete="off">';
            h += '<div class="ct-btns">';
            if (est === 'available') h += '<button type="button" class="ct-btn gold block" data-act="reserve">Apartar mesa</button><button type="button" class="ct-btn block" data-act="sell">Vender a mano</button>';
            if (est === 'reserved') h += '<button type="button" class="ct-btn block' + (conOrden && venc ? ' danger' : '') + '" data-act="release">Liberar mesa</button><button type="button" class="ct-btn block" data-act="sell">Vender a mano</button>' + (conOrden ? '<button type="button" class="ct-btn block" data-act="copylink">Copiar enlace de los pases</button>' : '');
            if (est === 'sold_manager') h += (r.order_id ? '<button type="button" class="ct-btn block" data-act="copylink">Copiar enlace de los pases</button>' : '') + '<button type="button" class="ct-btn block" data-act="release">Liberar</button>';
            h += '</div>';
        }
        // Editar sillas y precio, o eliminar el mueble: el dueño y quien el dueño autorizó a diseñar la sala. En la plantilla vale para los eventos que se creen después.
        if (puedeEditar() && (tp || est === 'available' || est === 'reserved')) {
            var formaG = geoT(r.table_key), esRect = formaG === 'rect' || formaG === 'square';
            h += '<div class="ct-edit"><b>' + (esT ? 'Editar taburete' : 'Editar mesa') + '</b><div class="ct-two2">' +
                (esT || esRect ? '' : '<div><label for="ct-e-seats">Sillas</label><select id="ct-e-seats">' + sillasPermitidas(geoT(r.table_key), r.seats).map(function (n) { return '<option value="' + n + '"' + (n === r.seats ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></div>') +
                '<div><label for="ct-e-price">' + (tp ? 'Precio sugerido' : 'Precio') + ' (USD)</label><input id="ct-e-price" type="number" min="0" max="10000" step="0.01" inputmode="decimal" value="' + esc(String((r.price_cents || 0) / 100)) + '"></div></div>' +
                (esRect ? '<label style="margin-top:12px">Sillas por lado</label>' + ladosHtml((S.chEdit = { key: r.table_key, c: chairsDe(r.table_key, r.seats) }).c, formaG) : '') +
                '<div class="ct-btns"><button type="button" class="ct-btn gold block" data-edit="save">Guardar cambios</button>' + (esT ? '<button type="button" class="ct-btn block" data-edit="courtesy">Marcar cortesía ($0)</button>' : '') + '</div>';
            if (formaG === 'round') {
                var rAct = geoObj(r.table_key) && geoObj(r.table_key).r ? Number(geoObj(r.table_key).r) : radioDe('round', r.seats);
                h += '<div class="ct-rot"><label>Tamaño de la mesa</label><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">' + [[24, 'Chica'], [36, 'Mediana'], [48, 'Grande']].map(function (z) { return '<button type="button" class="ct-btn block' + (rAct === z[0] ? ' on' : '') + '" data-size="' + z[0] + '">' + z[1] + '</button>'; }).join('') + '</div></div>';
            }
            if (!esT) h += '<div class="ct-rot"><label>Girar la mesa con sus sillas' + (r.table_key && giroDe(r.table_key) ? ' · ' + giroDe(r.table_key) + '°' : '') + '</label><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px"><button type="button" class="ct-btn block" data-rot="-15">−15°</button><button type="button" class="ct-btn block" data-rot="15">+15°</button><button type="button" class="ct-btn block" data-rot="90">+90°</button></div><div class="ct-tip" style="margin-top:6px">También con la tecla R (Mayús + R gira al otro lado).</div></div>';
            if (tp || est === 'available') h += '<div class="ct-danger-zone"><button type="button" class="ct-btn ct-del block" data-edit="remove">🗑️ ' + (esT ? 'Eliminar taburete seleccionado' : 'Eliminar mesa seleccionada') + '</button></div>';
            h += '</div>';
        }
        h += '<p class="ct-msg" id="ct-msg" role="status"></p></div>';
        side.innerHTML = h;
        [].forEach.call(side.querySelectorAll('[data-act]'), function (b) { b.addEventListener('click', function () { actuar(b.dataset.act, r); }); });
        [].forEach.call(side.querySelectorAll('[data-edit]'), function (b) { b.addEventListener('click', function () { editarMesa(b.dataset.edit, r); }); });
        if (S.chEdit && S.chEdit.key === r.table_key && (geoT(r.table_key) === 'rect' || geoT(r.table_key) === 'square')) ladosBind(side, S.chEdit.c, null, geoT(r.table_key));
        [].forEach.call(side.querySelectorAll('[data-size]'), function (b) { b.addEventListener('click', function () { tamanoMesa(r, Number(b.dataset.size)); }); });
        [].forEach.call(side.querySelectorAll('[data-rot]'), function (b) { b.addEventListener('click', function () { girarMesa(r, Number(b.dataset.rot)); }); });
    }
    function giroDe(key) {
        var maps = mapsDe(S.event && S.event.layout, S.rows);
        for (var i = 0; i < maps.length; i++) { var ts = maps[i].tables || []; for (var j = 0; j < ts.length; j++) if (ts[j].id === key) return ((Number(ts[j].rot) || 0) % 360 + 360) % 360; }
        return 0;
    }
    async function tamanoMesa(r, radio) {
        var tp = esPlantilla(), pred = radioDe('round', r.seats), arg = radio === pred ? null : radio;      // el tamaño de siempre no se guarda: se quita el dato
        var res = tp ? await S.db.rpc('venue_room_set_size', { p_room_id: S.event.room_id, p_key: r.table_key, p_radius: arg }) : await S.db.rpc('venue_event_set_size', { p_event_id: S.event.id, p_key: r.table_key, p_radius: arg });
        var m = q$('#ct-msg');
        if (res.error) { var sinFn = res.error.code === 'PGRST202' || res.error.code === '42883' || /could not find the function|schema cache/i.test(res.error.message || ''); if (m) { m.style.color = '#ff6060'; m.textContent = sinFn ? 'El tamaño de la mesa todavía no está activado en la base de datos.' : msgError(res.error); } return; }
        if (res.data && res.data.ok === false) { if (m) { m.style.color = '#ff6060'; m.textContent = ERRORES[res.data.error] || 'No se pudo cambiar el tamaño.'; } return; }
        await recargarLayout(); await loadRows(false);
    }
    async function girarMesa(r, delta) {
        var nuevo = (giroDe(r.table_key) + delta + 360) % 360, tp = esPlantilla();
        var res = tp ? await S.db.rpc('venue_room_rotate_table', { p_room_id: S.event.room_id, p_key: r.table_key, p_rot: nuevo }) : await S.db.rpc('venue_event_rotate_table', { p_event_id: S.event.id, p_key: r.table_key, p_rot: nuevo });
        if (res.error) {
            var sinFn = res.error.code === 'PGRST202' || res.error.code === '42883' || /could not find the function|schema cache/i.test(res.error.message || '');
            var m = q$('#ct-msg'); if (m) { m.style.color = '#ff6060'; m.textContent = sinFn ? 'Girar mesas todavía no está activado en la base de datos.' : msgError(res.error); } return;
        }
        await recargarLayout(); await loadRows(false);
    }

    // ── «+ Reserva telefónica / Venta manual»: vende una o varias mesas por teléfono o en persona, crea la orden y emite los pases QR (venue_staff_sell_tables_manual) ──
    var METODOS = [['cash', 'Efectivo'], ['zelle', 'Zelle'], ['card_terminal', 'Terminal física'], ['door', 'Por cobrar en puerta'], ['courtesy', 'Cortesía']];
    function enlacePases(orderId) { return 'https://www.miamidjbeat.com/t/' + String(orderId).toLowerCase(); }
    function enlaceVer(orderId) { return /^(localhost|127\.|\[::1\])/.test(location.hostname) ? location.origin + '/t.html?id=' + String(orderId).toLowerCase() : enlacePases(orderId); }
    function copiar(txt) {
        function viejo() { try { var ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'; document.body.appendChild(ta); ta.select(); var okc = document.execCommand('copy'); document.body.removeChild(ta); return okc; } catch (e) { return false; } }
        if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt).then(function () { return true; }, function () { return viejo(); });
        return Promise.resolve(viejo());
    }
    function cerrarVentaManual() { var m = document.getElementById('ct-modal-bg'); if (m) m.parentNode.removeChild(m); document.removeEventListener('keydown', escVentaManual, true); }
    function escVentaManual(e) { if (e.key === 'Escape') { e.stopPropagation(); cerrarVentaManual(); } }
    function abrirVentaManual(preKeys, preName, preNote) {
        cerrarVentaManual();
        var ahora = Date.now(), libres = S.rows.filter(function (r) { return movible(r, ahora); }).sort(function (a, b) { return String(a.table_key).localeCompare(String(b.table_key), 'es', { numeric: true }); });
        var elegidas = {}; (preKeys || []).forEach(function (k) { if (libres.some(function (r) { return r.table_key === k; })) elegidas[k] = true; });
        var bg = document.createElement('div'); bg.id = 'ct-modal-bg'; bg.className = 'ct-modal-bg';
        bg.innerHTML = '<div class="ct-modal" role="dialog" aria-modal="true" aria-label="Reserva telefónica o venta manual"><div id="ct-m-body"></div></div>';
        document.body.appendChild(bg);
        bg.addEventListener('mousedown', function (e) { if (e.target === bg) cerrarVentaManual(); });
        document.addEventListener('keydown', escVentaManual, true);
        var body = bg.querySelector('#ct-m-body');
        function total() { return libres.reduce(function (n, r) { return n + (elegidas[r.table_key] ? r.price_cents : 0); }, 0); }
        function vistaForm() {
            body.innerHTML = '<h3>Reserva telefónica / Venta manual</h3><small style="color:rgba(255,255,255,.6)">Registra la venta, emite los pases QR al instante y compártelos. Solo el nombre de quien renta es obligatorio.</small>' +
                '<label>Mesas y taburetes disponibles</label>' + (libres.length ? '<input type="search" id="ct-m-q" placeholder="Buscar mesa o taburete…" style="margin-bottom:8px" aria-label="Buscar mesa o taburete"><div class="ct-pick" id="ct-m-pick"></div>' : '<p class="ct-empty">No hay mesas ni taburetes libres en este evento.</p>') +
                '<div class="ct-sum" id="ct-m-sum"></div>' +
                '<div class="ct-two"><div><label for="ct-m-name">Nombre del titular *</label><input type="text" id="ct-m-name" maxlength="80" autocomplete="off"></div><div><label for="ct-m-phone">Teléfono (opcional)</label><input type="tel" id="ct-m-phone" maxlength="30" autocomplete="off"></div></div>' +
                '<label for="ct-m-email">Correo (opcional)</label><input type="email" id="ct-m-email" maxlength="120" autocomplete="off">' +
                '<div class="ct-two"><div><label for="ct-m-method">Cómo se registra</label><select id="ct-m-method">' + METODOS.map(function (m) { return '<option value="' + m[0] + '">' + m[1] + '</option>'; }).join('') + '</select></div>' +
                '<div><label for="ct-m-amount">Importe cobrado (USD)</label><input type="number" id="ct-m-amount" min="0" step="0.01" inputmode="decimal"></div></div><p class="ct-msg" id="ct-m-hint" style="margin:6px 0 0"></p>' +
                '<label for="ct-m-note">Nota (opcional)</label><input type="text" id="ct-m-note" maxlength="200" autocomplete="off">' +
                '<p class="ct-msg" id="ct-m-msg" role="status"></p><div class="ct-actions"><button type="button" class="btn primary" id="ct-m-go">Registrar y emitir pases</button><button type="button" class="cc-btn2" id="ct-m-cancel">Cancelar</button></div>';
            var nameI = body.querySelector('#ct-m-name'), methodI = body.querySelector('#ct-m-method'), amountI = body.querySelector('#ct-m-amount'), hint = body.querySelector('#ct-m-hint'), amountTouched = false;
            if (preName) nameI.value = preName; if (preNote) body.querySelector('#ct-m-note').value = preNote;
            function pintaPick() {
                var q = norm((body.querySelector('#ct-m-q') || {}).value || ''), box = body.querySelector('#ct-m-pick'); if (!box) return;
                box.innerHTML = libres.filter(function (r) { return !q || norm(r.table_key + ' ' + r.label + ' ' + (r.zone_name || '')).indexOf(q) >= 0 || elegidas[r.table_key]; }).map(function (r) {
                    return '<label><input type="checkbox" value="' + esc(r.table_key) + '"' + (elegidas[r.table_key] ? ' checked' : '') + '> ' + esc(nombreMueble(r.table_key, r.label)) + (r.zone_name ? ' · ' + esc(r.zone_name) : '') + (est2(r) === 'reserved' ? ' (apartada)' : '') + '<small>' + r.seats + (r.seats === 1 ? ' silla' : ' sillas') + ' · ' + esc(precioTxt(r)) + '</small></label>';
                }).join('') || '<p class="ct-empty" style="padding:10px 12px;">Ninguna mesa coincide.</p>';
                [].forEach.call(box.querySelectorAll('input[type=checkbox]'), function (c) { c.addEventListener('change', function () { if (c.checked) elegidas[c.value] = true; else delete elegidas[c.value]; sync(); }); });
            }
            function est2(r) { return estadoDe(r, Date.now()); }
            function sync() {
                var n = Object.keys(elegidas).length, lista = total(), met = methodI.value, sillas = libres.reduce(function (a, r) { return a + (elegidas[r.table_key] ? r.seats : 0); }, 0);
                body.querySelector('#ct-m-sum').innerHTML = n ? '<b>' + n + '</b> ' + (n === 1 ? 'mesa o taburete' : 'mesas o taburetes') + ' · <b>' + sillas + '</b> ' + (sillas === 1 ? 'silla' : 'sillas') + ' · precio de lista <b>' + dinero(lista) + '</b> · se emitirán <b>' + sillas + '</b> pases QR' : 'Elige al menos una mesa.';
                if (met === 'door' || met === 'courtesy') { amountI.value = '0'; amountI.disabled = true; hint.style.color = 'rgba(255,255,255,.7)'; hint.textContent = met === 'door' ? 'Queda por cobrar ' + dinero(lista) + ' en la puerta.' : 'Cortesía: no se cobra nada.'; }
                else { amountI.disabled = false; if (!amountTouched) amountI.value = String(lista / 100); var c = Math.round(Number(amountI.value || 0) * 100); hint.style.color = c < lista ? '#ffb400' : 'rgba(255,255,255,.7)'; hint.textContent = c < lista && c > 0 ? 'Quedan por cobrar ' + dinero(lista - c) + '.' : (c > lista ? 'Cobras ' + dinero(c - lista) + ' más que el precio de lista.' : ''); }
            }
            pintaPick(); sync();
            var qI = body.querySelector('#ct-m-q'); if (qI) qI.addEventListener('input', pintaPick);
            methodI.addEventListener('change', function () { amountTouched = false; sync(); });
            amountI.addEventListener('input', function () { amountTouched = true; sync(); });
            body.querySelector('#ct-m-cancel').addEventListener('click', cerrarVentaManual);
            body.querySelector('#ct-m-go').addEventListener('click', enviar);
            nameI.focus();
            async function enviar() {
                var msg = body.querySelector('#ct-m-msg'), keys = Object.keys(elegidas), met = methodI.value, nombre = nameI.value.trim();
                function err(t) { msg.style.color = '#ff6060'; msg.textContent = t; }
                if (!keys.length) return err('Elige al menos una mesa.');
                if (!nombre) { nameI.focus(); return err(ERRORES.falta_nombre_de_quien_renta); }
                var cents = Math.round(Number(amountI.value || 0) * 100);
                if ((met === 'cash' || met === 'zelle' || met === 'card_terminal') && !(cents > 0)) return err('Pon el importe cobrado, o elige «Por cobrar en puerta» o «Cortesía».');
                var go = body.querySelector('#ct-m-go'); go.disabled = true; msg.style.color = 'rgba(255,255,255,.8)'; msg.textContent = 'Registrando…';
                var res = await S.db.rpc('venue_staff_sell_tables_manual', { p_event_id: S.event.id, p_keys: keys, p_holder_name: nombre, p_phone: body.querySelector('#ct-m-phone').value.trim() || null, p_email: body.querySelector('#ct-m-email').value.trim() || null, p_method: met, p_amount_cents: (met === 'door' || met === 'courtesy') ? 0 : cents, p_note: body.querySelector('#ct-m-note').value.trim() || null });
                var e = msgRes(res);
                if (e) { go.disabled = false; err(e); if (res.error && /mesa_no_disponible/.test(res.error.message || '')) loadRows(false); return; }
                S.pick = {}; S.gname = ''; S.gnote = ''; S.gpeople = ''; S.sel = null;
                loadRows(false);
                vistaListo(res.data, nombre, body.querySelector('#ct-m-phone').value.trim());
            }
        }
        function vistaListo(d, nombre, tel) {
            var estado = d.status === 'manual_pending_payment' ? 'Por cobrar en puerta: ' + dinero(d.balance_due_cents) : (d.status === 'comp_manual' ? 'Cortesía' : 'Cobrado ' + dinero(d.paid_cents) + (d.balance_due_cents > 0 ? ' · pendiente ' + dinero(d.balance_due_cents) : ''));
            vistaPases(body, { titulo: 'Venta registrada', orderId: d.order_id, code: d.code, nombre: nombre, tel: tel, resumen: d.tables + ' ' + (d.tables === 1 ? 'mesa' : 'mesas') + ' · <b>' + d.passes + '</b> pases QR emitidos · ' + esc(estado), onOtra: function () { cerrarVentaManual(); abrirVentaManual([]); } });
        }
        vistaForm();
    }

    // ── «+» CREAR NUEVO EVENTO: nombre, día (con año) y hora; nace con el plano de la sala y la venta de mesas abierta (venue_event_create). Quien lo puede: el dueño y quien diseña la sala. ──
    function abrirCrearEvento() {
        if (!puedeEditar()) return;
        var salas = (S.venue.rooms || []);
        if (!salas.length) return;
        cerrarVentaManual();
        var hoyN = diaNegocio();
        var bg = document.createElement('div'); bg.id = 'ct-modal-bg'; bg.className = 'ct-modal-bg';
        bg.innerHTML = '<div class="ct-modal" role="dialog" aria-modal="true" aria-label="Crear nuevo evento"><div id="ct-m-body"></div></div>';
        document.body.appendChild(bg);
        bg.addEventListener('mousedown', function (e) { if (e.target === bg) cerrarVentaManual(); });
        document.addEventListener('keydown', escVentaManual, true);
        var body = bg.querySelector('#ct-m-body');
        body.innerHTML = '<h3>Crear nuevo evento</h3><small style="color:rgba(255,255,255,.6)">Nace con el plano de la sala y la venta de mesas abierta.</small>' +
            (salas.length > 1 ? '<label for="ct-n-room">Sala</label><select id="ct-n-room">' + salas.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + '</option>'; }).join('') + '</select>' : '') +
            '<label for="ct-n-name">Nombre del evento *</label><input type="text" id="ct-n-name" maxlength="120" autocomplete="off" placeholder="Ej. Concierto Ruddy La Scala">' +
            '<div class="ct-two"><div><label for="ct-n-date">Día del evento (día, mes y año) *</label><input type="date" id="ct-n-date" min="' + esc(hoyN) + '"></div><div><label for="ct-n-time">Hora</label><input type="time" id="ct-n-time" value="21:00"></div></div>' +
            '<p class="ct-msg" id="ct-m-msg" role="status"></p><div class="ct-actions"><button type="button" class="btn primary" id="ct-n-go">Crear evento</button><button type="button" class="cc-btn2" id="ct-n-cancel">Cancelar</button></div>';
        body.querySelector('#ct-n-cancel').addEventListener('click', cerrarVentaManual);
        body.querySelector('#ct-n-name').focus();
        body.querySelector('#ct-n-go').addEventListener('click', async function () {
            var msg = body.querySelector('#ct-m-msg'), go = this, nombre = body.querySelector('#ct-n-name').value.trim(), dia = body.querySelector('#ct-n-date').value, hora = body.querySelector('#ct-n-time').value;
            function err(t) { msg.style.color = '#ff6060'; msg.textContent = t; }
            if (nombre.length < 3) { body.querySelector('#ct-n-name').focus(); return err(ERRORES.titulo_invalido); }
            if (!dia) return err('Elige el día del evento.');
            go.disabled = true; msg.style.color = 'rgba(255,255,255,.8)'; msg.textContent = 'Creando…';
            var room = body.querySelector('#ct-n-room') ? body.querySelector('#ct-n-room').value : salas[0].id;
            var res = await S.db.rpc('venue_event_create', { p_room_id: room, p_title: nombre, p_event_date: dia, p_open: true, p_event_time: hora || null });
            if (res.error && (res.error.code === 'PGRST202' || res.error.code === '42883' || /could not find the function|schema cache/i.test(res.error.message || ''))) {      // el SQL de la hora aún no está aplicado: se crea sin hora
                res = await S.db.rpc('venue_event_create', { p_room_id: room, p_title: nombre, p_event_date: dia, p_open: true });
            }
            var e = msgRes(res);
            if (!e && res.data && res.data.ok === false) e = ERRORES[res.data.error] || 'No se pudo crear el evento.';
            if (e) { go.disabled = false; return err(/sin_mapa/.test((res.error && res.error.message) || '') ? ERRORES.sin_mapa : e); }
            cerrarVentaManual();
            S.want = res.data.event_id; await loadEvents();
            try { document.dispatchEvent(new CustomEvent('mdj:eventos-cambiaron')); } catch (x) { /* ok */ }
        });
    }
    // ── «Cancelar evento»: cancela la FECHA elegida (solo si no tiene ventas): venue_event_cancel. No borra mesas. ──
    async function quitarEvento() {
        var ev = S.event; if (!ev || ev.template || !puedeEditar()) return;
        if (!window.confirm('¿Cancelar el evento «' + (ev.title || 'sin nombre') + '»?\n\nSe cancela la fecha completa (las mesas del plano base NO se borran). Solo se puede si no tiene ventas, mesas apartadas ni pedidos.')) return;
        var mi = q$('#ct-ev-minus'); if (mi) mi.disabled = true;
        var res = await S.db.rpc('venue_event_cancel', { p_event_id: ev.id });
        var e = msgRes(res);
        if (!e && res.data && res.data.ok === false) e = ERRORES[res.data.error] || 'No se pudo cancelar el evento.';
        if (e) { if (mi) mi.disabled = false; var dm = q$('#ct-day-msg'); if (dm) { dm.style.color = '#ff6060'; dm.textContent = e; } window.alert(e); return; }
        S.event = null; S.sel = null; await loadEvents();
        try { document.dispatchEvent(new CustomEvent('mdj:eventos-cambiaron')); } catch (x) { /* ok */ }
    }

    // ── Agregar / editar / quitar mesas de ESTE evento (el plano de la sala no cambia) ──
    function precioComun() {
        var cuenta = {}, mejor = '', n = 0;
        S.rows.forEach(function (r) { var k = r.price_cents; cuenta[k] = (cuenta[k] || 0) + 1; if (cuenta[k] > n) { n = cuenta[k]; mejor = k; } });
        return mejor === '' ? '' : String(mejor / 100);
    }
    function tipo0(c) { return tipoDe(c.kind); }
    function precioInicial(kind) { return kind === 'stool' ? '0' : precioComun(); }       // el taburete nace en $0 (sin evento no hay precio; cortesía hasta que se fije)
    function ponerTipo(id) {
        var c = S.addCfg, t = tipoDe(id);
        c.prices[c.kind] = c.price;                                             // cada tipo recuerda su precio (un taburete no cuesta como una mesa)
        c.kind = t.id; c.shape = t.shape;
        if (t.id === 'rect') { c.seats = sumaLados(c.chairs); c.prices = c.prices || {}; }
        if (t.id === 'square') { c.seats = sumaLados(c.chairsSq); c.prices = c.prices || {}; }
        c.seats = t.seats ? (t.seats.indexOf(Number(c.seats)) >= 0 ? Number(c.seats) : t.seats[0]) : (Number(c.seats) >= 1 && Number(c.seats) <= 40 ? Number(c.seats) : 4);
        c.price = c.prices[t.id] !== undefined ? c.prices[t.id] : precioInicial(t.id);
    }
    function renderSideAgregar() {
        var side = q$('#ct-side'), c = S.addCfg, tp = esPlantilla(), t = tipoDe(c.kind);
        if (c.price === '' && t.id !== 'stool') c.price = precioComun();
        if (c.price === '' && t.id === 'stool') c.price = '0';
        var sillas;
        if (t.seats && t.seats.length > 1) sillas = '<label>Sillas</label><div class="ct-seg" id="ct-seg">' + t.seats.map(function (n) { return '<button type="button" class="ct-segb' + (Number(c.seats) === n ? ' sel' : '') + '" data-n="' + n + '">' + n + '</button>'; }).join('') + '</div>';
        else if (t.seats) sillas = '<label>Sillas</label><div class="ct-fixed">' + t.seats[0] + (t.seats[0] === 1 ? ' silla' : ' sillas') + ' <small>(fija en este tipo)</small></div>';
        else if (t.id === 'rect') sillas = '<label>Sillas por lado</label>' + ladosHtml(c.chairs, 'rect');
        else if (t.id === 'square') sillas = '<label>Sillas por lado</label>' + ladosHtml(c.chairsSq, 'square');
        else sillas = '<label for="ct-a-seats">Sillas</label><div class="ct-step"><button type="button" id="ct-a-minus" aria-label="Menos sillas">−</button><input id="ct-a-seats" type="number" min="1" max="40" inputmode="numeric" value="' + esc(c.seats) + '"><button type="button" id="ct-a-plus" aria-label="Más sillas">+</button></div>';
        side.innerHTML = '<div class="ct-sd-head"><div class="ct-sd-badge tpl" style="font-size:24px">🪑</div><div><h3>Agregar al plano</h3><small>' + (tp ? 'Al plano base de la sala' : 'A este evento') + '</small></div></div><div class="ct-sd-body">' +
            '<label>Tipo de mueble</label><div class="ct-shapes" id="ct-shapes">' + CATALOGO.map(function (k) { return '<button type="button" class="ct-shape-card' + (c.kind === k.id ? ' sel' : '') + '" data-kind="' + k.id + '">' + kindIcon(k.id) + k.nombre + '<small>' + k.sub + '</small></button>'; }).join('') + '</div>' +
            sillas +
            '<label for="ct-a-price">' + (tp ? 'Precio sugerido' : 'Precio') + ' (USD)' + (t.id === 'stool' ? ' · $0 = cortesía' : '') + '</label><div class="ct-price"><span>$</span><input id="ct-a-price" type="number" min="0" max="10000" step="0.01" inputmode="decimal" value="' + esc(c.price) + '"></div>' +
            '<div class="ct-tip">Cada mueble se dibuja a su <b>tamaño real</b>' + (t.id === 'stool' ? ' y puede ir pegado a la barra' : '') + '. Mueve el cursor sobre el plano para ver dónde caería y <b>toca</b> para colocarlo.</div><p class="ct-msg" id="ct-msg" role="status"></p></div>';
        [].forEach.call(side.querySelectorAll('[data-kind]'), function (b) { b.addEventListener('click', function () { ponerTipo(b.dataset.kind); renderSideAgregar(); }); });
        [].forEach.call(side.querySelectorAll('.ct-segb'), function (b) { b.addEventListener('click', function () { c.seats = Number(b.dataset.n); [].forEach.call(side.querySelectorAll('.ct-segb'), function (x) { x.classList.toggle('sel', x === b); }); }); });
        if (t.id === 'rect') { c.seats = sumaLados(c.chairs); ladosBind(side, c.chairs, function () { c.seats = sumaLados(c.chairs); }, 'rect'); }
        if (t.id === 'square') { c.seats = sumaLados(c.chairsSq); ladosBind(side, c.chairsSq, function () { c.seats = sumaLados(c.chairsSq); }, 'square'); }
        var si = q$('#ct-a-seats');
        if (si) {
            si.addEventListener('input', function () { c.seats = si.value; });
            q$('#ct-a-minus').addEventListener('click', function () { var v = Math.max(1, (Number(si.value) || 4) - 1); si.value = v; c.seats = v; });
            q$('#ct-a-plus').addEventListener('click', function () { var v = Math.min(40, (Number(si.value) || 4) + 1); si.value = v; c.seats = v; });
        }
        q$('#ct-a-price').addEventListener('input', function () { c.price = this.value; });
    }
    async function agregarEn(map, x, y) {
        var c = S.addCfg, tipo = tipo0(c), seats = tipo.id === 'stool' ? 1 : (tipo.id === 'rect' ? sumaLados(c.chairs) : (tipo.id === 'square' ? sumaLados(c.chairsSq) : Number(c.seats))), precio = Math.round(Number(c.price) * 100);
        if (tipo.id === 'stool' && String(c.price).trim() === '') { c.price = '0'; precio = 0; }
        if (!(seats >= 1 && seats <= 40) || Math.round(seats) !== seats || (tipo.seats && tipo.seats.indexOf(seats) < 0)) { avisoGrupo(ERRORES.sillas_invalidas, true); return; }
        if (c.price === '' || !isFinite(precio) || precio < 0 || precio > 1000000) { avisoGrupo(ERRORES.precio_invalido, true); return; }
        if (!map || !map.id || map.id === 'auto') { avisoGrupo(ERRORES.sin_plano, true); return; }
        avisoGrupo('Agregando…', false);
        var tp = esPlantilla();
        var extra = tipo.radio ? { p_radius: tipo.radio } : {};            // la mesa alta es una redonda chica (radio 24)
        var res = tp ? await S.db.rpc('venue_room_add_table', Object.assign({ p_room_id: S.event.room_id, p_map_id: map.id, p_x: x, p_y: y, p_seats: seats, p_price_cents: precio, p_shape: c.shape }, extra))
                     : await S.db.rpc('venue_event_add_table', Object.assign({ p_event_id: S.event.id, p_map_id: map.id, p_x: x, p_y: y, p_seats: seats, p_price_cents: precio, p_shape: c.shape }, extra));
        if (res.error && tipo.radio && (res.error.code === 'PGRST202' || res.error.code === '42883' || /could not find the function|schema cache/i.test(res.error.message || ''))) { avisoGrupo('La mesa alta (tamaño chico) todavía no está activada en la base de datos.', true); return; }
        var err = msgRes(res);
        if (err) { avisoGrupo(err, true); return; }
        if (tipo.id === 'rect' || tipo.id === 'square') {                                                            // si el reparto no es el de siempre, se guarda por lados
            var ch = tipo.id === 'rect' ? c.chairs : c.chairsSq, par = tipo.id === 'rect' ? partePar(seats) : parteCuadrada(seats);
            if (ch.t !== par.t || ch.b !== par.b || ch.l !== par.l || ch.r !== par.r) {
                var rc = tp ? await S.db.rpc('venue_room_set_chairs', { p_room_id: S.event.room_id, p_key: res.data.key, p_top: ch.t, p_bottom: ch.b, p_left: ch.l, p_right: ch.r })
                            : await S.db.rpc('venue_event_set_chairs', { p_event_id: S.event.id, p_key: res.data.key, p_top: ch.t, p_bottom: ch.b, p_left: ch.l, p_right: ch.r });
                if (rc.error) { var sinF = rc.error.code === 'PGRST202' || rc.error.code === '42883' || /could not find the function|schema cache/i.test(rc.error.message || ''); await recargarLayout(); await loadRows(false); avisoGrupo(sinF ? 'La mesa se agregó con las sillas repartidas mitad y mitad: elegir las sillas por lado todavía no está activado en la base de datos.' : msgError(rc.error), true); return; }
            }
        }
        await recargarLayout(); await loadRows(false);
        avisoGrupo((tipo.id === 'stool' ? 'Taburete ' : 'Mesa ') + res.data.key + ' agregado. Toca otro lugar para otro o pulsa 🪑 para terminar.', false);
    }
    // Mesa rectangular: el precio y las sillas por lado (largos arriba/abajo y cabeceras) se guardan por separado.
    async function guardarRect(r) {
        var msg = q$('#ct-msg'), pI = q$('#ct-e-price'), precio = Math.round(Number(pI.value) * 100), ch = S.chEdit.c, orig = chairsDe(r.table_key, r.seats), tp = esPlantilla();
        function err(t) { msg.style.color = '#ff6060'; msg.textContent = t; }
        if (pI.value === '' || !isFinite(precio) || precio < 0 || precio > 1000000) return err(ERRORES.precio_invalido);
        var cambioSillas = ch.t !== orig.t || ch.b !== orig.b || ch.l !== orig.l || ch.r !== orig.r, cambioPrecio = precio !== r.price_cents;
        if (!cambioSillas && !cambioPrecio) return err(ERRORES.sin_cambios);
        [].forEach.call(S.box.querySelectorAll('[data-edit]'), function (b) { b.disabled = true; });
        msg.style.color = 'rgba(255,255,255,.8)'; msg.textContent = 'Guardando…';
        function sinFn(e) { return e.code === 'PGRST202' || e.code === '42883' || /could not find the function|schema cache/i.test(e.message || ''); }
        var fallo = null;
        if (cambioPrecio) {
            var a = tp ? { p_room_id: S.event.room_id, p_key: r.table_key, p_seats: null, p_price_cents: precio } : { p_event_id: S.event.id, p_key: r.table_key, p_seats: null, p_price_cents: precio };
            var rp = await S.db.rpc(tp ? 'venue_room_edit_table' : 'venue_event_edit_table', a); fallo = msgRes(rp);
        }
        if (!fallo && cambioSillas) {
            var rs = tp ? await S.db.rpc('venue_room_set_chairs', { p_room_id: S.event.room_id, p_key: r.table_key, p_top: ch.t, p_bottom: ch.b, p_left: ch.l, p_right: ch.r })
                        : await S.db.rpc('venue_event_set_chairs', { p_event_id: S.event.id, p_key: r.table_key, p_top: ch.t, p_bottom: ch.b, p_left: ch.l, p_right: ch.r });
            if (rs.error && sinFn(rs.error)) fallo = 'Elegir las sillas por lado todavía no está activado en la base de datos.'; else fallo = msgRes(rs);
            if (!fallo && rs.data && rs.data.ok === false) fallo = ERRORES[rs.data.error] || 'No se pudo guardar.';
        }
        if (fallo) { err(fallo); [].forEach.call(S.box.querySelectorAll('[data-edit]'), function (b) { b.disabled = false; }); loadRows(false); return; }
        await recargarLayout(); await loadRows(false);
        var m2 = q$('#ct-msg'); if (m2) { m2.style.color = '#00c878'; m2.textContent = nombreMueble(r.table_key, r.label) + ' actualizada.'; }
    }
    async function editarMesa(accion, r) {
        var msg = q$('#ct-msg');
        if (accion === 'remove') {
            var nm = nombreMueble(r.table_key, r.label);
            if (!window.confirm(esPlantilla() ? '¿Eliminar ' + nm + ' del plano base de la sala?\n\nSolo se elimina ese mueble. Los eventos que ya existen no cambian.' : '¿Eliminar ' + nm + ' de este evento?\n\nSolo se elimina ese mueble, solo de este evento.')) return;
            [].forEach.call(S.box.querySelectorAll('[data-edit]'), function (b) { b.disabled = true; });
            msg.style.color = 'rgba(255,255,255,.8)'; msg.textContent = 'Quitando…';
            var rr = esPlantilla() ? await S.db.rpc('venue_room_remove_table', { p_room_id: S.event.room_id, p_key: r.table_key }) : await S.db.rpc('venue_event_remove_table', { p_event_id: S.event.id, p_key: r.table_key });
            var er = msgRes(rr);
            if (er) { msg.style.color = '#ff6060'; msg.textContent = er; [].forEach.call(S.box.querySelectorAll('[data-edit]'), function (b) { b.disabled = false; }); loadRows(false); return; }
            S.sel = null; await recargarLayout(); await loadRows(false);
            var m3 = q$('#ct-msg'); if (m3) { m3.style.color = '#00c878'; m3.textContent = nm + ' eliminado.'; }
            return;
        }
        if (accion === 'courtesy') { var pc = q$('#ct-e-price'); if (pc) pc.value = '0'; }
        if ((geoT(r.table_key) === 'rect' || geoT(r.table_key) === 'square') && S.chEdit && S.chEdit.key === r.table_key) { return guardarRect(r); }
        var sI = q$('#ct-e-seats'), pI = q$('#ct-e-price'), seats = sI ? Number(sI.value) : r.seats, precio = Math.round(Number(pI.value) * 100);
        var args = esPlantilla() ? { p_room_id: S.event.room_id, p_key: r.table_key, p_seats: null, p_price_cents: null } : { p_event_id: S.event.id, p_key: r.table_key, p_seats: null, p_price_cents: null };
        if (!(seats >= 1 && seats <= 40) || Math.round(seats) !== seats) { msg.style.color = '#ff6060'; msg.textContent = ERRORES.sillas_invalidas; return; }
        if (pI.value === '' || !isFinite(precio) || precio < 0 || precio > 1000000) { msg.style.color = '#ff6060'; msg.textContent = ERRORES.precio_invalido; return; }
        if (seats !== r.seats) args.p_seats = seats;
        if (precio !== r.price_cents) args.p_price_cents = precio;
        if (args.p_seats === null && args.p_price_cents === null) { msg.style.color = '#ff6060'; msg.textContent = ERRORES.sin_cambios; return; }
        [].forEach.call(S.box.querySelectorAll('[data-edit]'), function (b) { b.disabled = true; });
        msg.style.color = 'rgba(255,255,255,.8)'; msg.textContent = 'Guardando…';
        var res = await S.db.rpc(esPlantilla() ? 'venue_room_edit_table' : 'venue_event_edit_table', args);
        var err = msgRes(res);
        if (err) { msg.style.color = '#ff6060'; msg.textContent = err; [].forEach.call(S.box.querySelectorAll('[data-edit]'), function (b) { b.disabled = false; }); loadRows(false); return; }
        await recargarLayout(); await loadRows(false);
        var m2 = q$('#ct-msg'); if (m2) { m2.style.color = '#00c878'; m2.textContent = nombreMueble(r.table_key, r.label) + ' actualizado.'; }
    }

    async function actuar(accion, r) {
        var msg = q$('#ct-msg'), nameI = q$('#ct-name'), noteI = q$('#ct-note');
        var name = nameI ? nameI.value.trim() : '', note = noteI ? noteI.value.trim() : '';
        if (accion === 'copylink') { copiar(enlacePases(r.order_id)).then(function (okc) { var m0 = q$('#ct-msg'); if (m0) { m0.style.color = okc ? '#00c878' : '#ff6060'; m0.textContent = okc ? 'Enlace de los pases copiado.' : 'No se pudo copiar: ' + enlacePases(r.order_id); } }); return; }
        if (accion === 'reserve') { abrirReserva(r.table_key); return; }                              // apartar = reserva directa con hora límite y pases
        if (accion === 'sell') { abrirVentaManual([r.table_key], name); return; }                 // venta a mano = orden + pases QR (no solo marcar la mesa)
        if (accion === 'release' && !confirm('¿Liberar la mesa ' + r.label + '? Volverá a estar disponible para la venta' + (r.order_id ? ' y se anulan sus pases QR.' : '.'))) return;
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
    function arrastrarMueble(ev, it, n, svg, map) {
        ev.preventDefault();
        var base = n.getAttribute('transform') || '';
        try { n.setPointerCapture(ev.pointerId); } catch (e) { /* sin captura */ }
        function pos(e) { var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; var m = svg.getScreenCTM(); return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 }; }
        var ini = pos(ev), cx = ev.clientX, cy = ev.clientY, dx = 0, dy = 0, movido = false, W = (map.room && map.room.w) || 800, H = (map.room && map.room.h) || 520, mw = (it.w || 54) / 2, mh = (it.h || 54) / 2;
        S.arrastrando = true;
        function mover(e) {
            if (!movido && Math.abs(e.clientX - cx) + Math.abs(e.clientY - cy) < 6) return;
            movido = true; var p = pos(e);
            dx = Math.min(W - mw - it.x, Math.max(mw - it.x, p.x - ini.x)); dy = Math.min(H - mh - it.y, Math.max(mh - it.y, p.y - ini.y));
            n.setAttribute('transform', 'translate(' + dx + ',' + dy + ') ' + base);
        }
        function soltar() {
            n.removeEventListener('pointermove', mover); n.removeEventListener('pointerup', soltar); n.removeEventListener('pointercancel', soltar); S.arrastrando = false;
            if (!movido || !(dx || dy)) { n.setAttribute('transform', base); return; }
            moverMuebles([{ id: it.id, x: Math.round(it.x + dx), y: Math.round(it.y + dy) }]);
        }
        n.addEventListener('pointermove', mover); n.addEventListener('pointerup', soltar); n.addEventListener('pointercancel', soltar);
    }
    async function moverMuebles(moves) {
        avisoGrupo('Moviendo…', false);
        var tp = esPlantilla();
        var res = tp ? await S.db.rpc('venue_room_move_shapes', { p_room_id: S.event.room_id, p_moves: moves }) : await S.db.rpc('venue_event_move_shapes', { p_event_id: S.event.id, p_moves: moves });
        if (res.error) {
            var sinFn = res.error.code === 'PGRST202' || res.error.code === '42883' || /could not find the function|schema cache/i.test(res.error.message || '');
            await recargarLayout(); if (tp) await loadRows(false); else render(false);
            avisoGrupo(sinFn ? 'Mover las mesas de la terraza todavía no está activado en la base de datos.' : msgError(res.error), true); return;
        }
        await recargarLayout(); if (tp) await loadRows(false); else render(false);
        avisoGrupo('Mesa de la terraza movida.', false);
    }
    // TALLER DE MONTAJE: la plantilla maestra (plano base de la sala) se arma directamente aquí, sin elegir ni crear un evento. Los cambios valen para los eventos que se creen después.
    function esPlantilla() { return !!(S.event && S.event.template); }
    async function recargarLayout() {
        if (!esPlantilla()) { await refrescarLayout(true); return; }
        var r = await S.db.from('venue_rooms').select('layout').eq('id', S.event.room_id).maybeSingle();
        if (r && r.data && r.data.layout) { S.event.layout = r.data.layout; (S.templates || []).forEach(function (t) { if (t.id === S.event.id) t.layout = r.data.layout; }); }
    }
    async function moverMesas(moves) {
        avisoGrupo('Moviendo…', false);
        var tp = esPlantilla();
        var res = tp ? await S.db.rpc('venue_room_move_tables', { p_room_id: S.event.room_id, p_moves: moves }) : await S.db.rpc('venue_event_move_tables', { p_event_id: S.event.id, p_moves: moves });
        if (res.error) {
            var sinFn = res.error.code === 'PGRST202' || res.error.code === '42883' || /could not find the function|schema cache/i.test(res.error.message || '');
            await recargarLayout(); if (tp) await loadRows(false); else render(false);
            avisoGrupo(sinFn ? 'Mover mesas todavía no está activado en la base de datos.' : msgError(res.error), true); return;
        }
        await recargarLayout(); if (tp) await loadRows(false); else render(false);
        avisoGrupo(moves.length === 1 ? 'Mesa movida.' : moves.length + ' mesas movidas.', false);
    }
    // Trae el plano del evento (otro vendedor pudo haber movido mesas) y lo redibuja solo si cambió.
    async function refrescarLayout(forzar) {
        if (!S.event || S.event.template || S.arrastrando) return;
        var id = S.event.id, r = await S.db.from('venue_events').select('layout').eq('id', id).maybeSingle();
        if (r.error || !r.data || !S.event || S.event.id !== id || S.arrastrando) return;
        var antes = JSON.stringify((S.event.layout || {}).maps || null), despues = JSON.stringify((r.data.layout || {}).maps || null);
        S.event.layout = r.data.layout;
        if (despues !== antes && !forzar && S.rows.length) render(true);
    }
    function renderSideGrupo(byKey, ahora) {
        var side = q$('#ct-side'), rows = S.rows;
        if (esPlantilla()) {      // taller: mover el mobiliario del plano base (arrastrar); no hay ventas aquí
            side.innerHTML = '<div class="ct-sd-head"><div class="ct-sd-badge tpl" style="font-size:24px">🗺️</div><div><h3>Mover mobiliario</h3><small>Plano base de la sala</small></div></div><div class="ct-sd-body"><div class="ct-tip" style="margin-top:0">Arrastra las mesas y el mobiliario (también las mesas T01… de la terraza) por el plano. Toca una mesa para editar sus sillas y su precio, o eliminarla.</div><p class="ct-msg" id="ct-msg" role="status"></p></div>';
            return;
        }
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
            '<div class="ct-btns">' + (puedeVender() ? '<button type="button" class="ct-btn gold block" data-gact="sell">Vender grupo</button><button type="button" class="ct-btn block" data-gact="reserve">Apartar grupo</button>' : '') + '<button type="button" class="ct-btn block" data-gact="clear">Quitar selección</button></div><p class="ct-msg" id="ct-msg" role="status"></p>';
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
        if (accion === 'sell') { abrirVentaManual(claves, name, note); return; }                   // vender el grupo = una orden con todos los pases
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
        if (S.event.template || !puedeEditar() || as.length < 2) return '';
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

    root.mdjStaffTables = { init: init, onShow: onShow, selectEvent: selectEvent, crearEvento: abrirCrearEvento, core: core };
})(typeof window !== 'undefined' ? window : globalThis);
