/* Figuras de la arquitectura de una sala. UN solo dibujo para los tres lugares donde se ve el plano: el editor de salas (venue-floor-builder.html),
 * la pantalla Mesas del staff y la página pública de la sala. Lo que dibuja el dueño es exactamente lo que ve el cliente.
 * También trae las reglas puras (validar, medir, saber si una mesa cae encima) que se prueban en Node (supabase/tests/plano_formas.test.mjs).
 *
 * Una figura («item») usa las convenciones del editor: (x, y) es el CENTRO, rot son grados, todo en el plano (por defecto 800 × 520).
 *   { id, k:'stage', shape:'rect'|'halfround'|'corner'|'oval'|'trapezoid', x, y, w, h, rot?, label? }            escenario
 *   { id, k:'zone',  sub:'barra'|'bano'|'pista'|'otro', x, y, w, h, rot?, label? }                              área (no vendible)
 *   { id, k:'door',  sub:'entrada'|'artistas'|'exit'|'puerta', x, y, w, rot?, label? }                         puerta (la «puerta» dibuja el arco de apertura)
 *   { id, k:'shape', sub:'rect'|'ellipse'|'triangle', x, y, w, h, rot?, label?, relleno?, bloquea? }           figura geométrica libre
 *   { id, k:'wall',  x1, y1, x2, y2, th?, bloquea? }                                                           pared (línea con dos extremos)
 *   { id, k:'text',  x, y, text, size?, rot? }                                                                 texto libre
 *   { id, k:'chair', x, y, w }                                                                                 silla suelta
 * bloquea: las mesas no pueden quedar encima (lo exige la base). Por defecto lo son el escenario, la barra y los baños; también las paredes.
 */
(function (root) {
    'use strict';

    var KINDS = { stage: 1, zone: 1, door: 1, shape: 1, wall: 1, text: 1, chair: 1 };
    var SUBS = { zone: { barra: 1, bano: 1, pista: 1, otro: 1 }, door: { entrada: 1, artistas: 1, exit: 1, puerta: 1 }, shape: { rect: 1, ellipse: 1, triangle: 1 } };
    var STAGE_SHAPES = { rect: 1, halfround: 1, corner: 1, oval: 1, trapezoid: 1 };
    var RELLENOS = { ninguno: 'none', gris: 'rgba(255,255,255,0.10)', dorado: 'rgba(197,160,89,0.22)', verde: 'rgba(0,200,120,0.18)', rojo: 'rgba(255,96,96,0.18)' };
    var MARGEN = 22;                                   // alrededor de una estructura donde no cabe el centro de una mesa
    var LIM = { min: -100, max: 1700, maxFiguras: 400, maxTexto: 60, maxLado: 1700 };
    var COLOR = 'rgba(255,255,255,0.55)', DORADO = 'rgba(197,160,89,0.85)';

    function num(v) { return typeof v === 'number' && isFinite(v); }
    function pos(v) { return num(v) && v >= LIM.min && v <= LIM.max; }

    // null si la figura es válida; si no, el motivo en español. Mismas reglas que venue_room_set_layout en la base.
    function validarItem(it) {
        if (!it || typeof it !== 'object' || Array.isArray(it)) return 'no es una figura';
        if (typeof it.id !== 'string' || !it.id || it.id.length > 24) return 'falta el id';
        if (!KINDS[it.k]) return 'tipo desconocido';
        if (it.k === 'wall') {
            if (![it.x1, it.y1, it.x2, it.y2].every(pos)) return 'los extremos de la pared están fuera del plano';
            if (it.th !== undefined && (!num(it.th) || it.th < 1 || it.th > 40)) return 'el grosor de la pared no es válido';
        } else {
            if (!pos(it.x) || !pos(it.y)) return 'la posición está fuera del plano';
            if (it.k === 'door' || it.k === 'chair') { if (!num(it.w) || it.w < 4 || it.w > 400) return 'el tamaño no es válido'; }
            else if (it.k !== 'text') { if (!num(it.w) || !num(it.h) || it.w < 4 || it.h < 4 || it.w > LIM.maxLado || it.h > LIM.maxLado) return 'el tamaño no es válido'; }
        }
        if (it.rot !== undefined && (!num(it.rot) || it.rot < -360 || it.rot > 720)) return 'el giro no es válido';
        if (it.k === 'stage' && it.shape !== undefined && !STAGE_SHAPES[it.shape]) return 'forma de escenario desconocida';
        if (SUBS[it.k] && it.sub !== undefined && !SUBS[it.k][it.sub]) return 'subtipo desconocido';
        if (it.k === 'shape' && it.sub === undefined) return 'falta el tipo de figura';
        if (it.k === 'text') {
            if (typeof it.text !== 'string' || !it.text.trim()) return 'el texto está vacío';
            if (it.size !== undefined && (!num(it.size) || it.size < 8 || it.size > 80)) return 'el tamaño del texto no es válido';
        }
        if (it.label !== undefined && (typeof it.label !== 'string' || it.label.length > LIM.maxTexto)) return 'el rótulo es demasiado largo';
        if (it.text !== undefined && (typeof it.text !== 'string' || it.text.length > LIM.maxTexto)) return 'el texto es demasiado largo';
        if (it.bloquea !== undefined && typeof it.bloquea !== 'boolean') return '«bloquea» debe ser sí o no';
        if (it.relleno !== undefined && !RELLENOS[it.relleno]) return 'relleno desconocido';
        return null;
    }
    function validarItems(lista) {
        if (!Array.isArray(lista)) return 'las figuras deben ser una lista';
        if (lista.length > LIM.maxFiguras) return 'máximo ' + LIM.maxFiguras + ' figuras por plano';
        var vistos = {};
        for (var i = 0; i < lista.length; i++) {
            var e = validarItem(lista[i]); if (e) return 'Figura #' + (i + 1) + ': ' + e + '.';
            if (vistos[lista[i].id]) return 'Figura #' + (i + 1) + ': el id «' + lista[i].id + '» está repetido.';
            vistos[lista[i].id] = true;
        }
        return null;
    }

    function distSegmento(px, py, x1, y1, x2, y2) {
        var dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
        var t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
        var cx = x1 + t * dx, cy = y1 + t * dy;
        return Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
    }
    // Por defecto bloquean el escenario, la barra, los baños y las paredes; «bloquea» explícito manda.
    function esEstructura(it) {
        if (it.bloquea === true) return true;
        if (it.bloquea === false) return false;
        return it.k === 'stage' || it.k === 'wall' || (it.k === 'zone' && (it.sub === 'barra' || it.sub === 'bano'));
    }
    function nombreDe(it) {
        return it.label || it.text || (it.k === 'stage' ? 'el escenario' : it.k === 'wall' ? 'una pared' : it.sub === 'bano' ? 'los baños' : it.sub === 'barra' ? 'la barra' : 'una estructura de la sala');
    }
    // ¿Cae el centro (x, y) de una mesa sobre una estructura? Devuelve su nombre o null. Mismo cálculo (margen de 22 px) que venue_plano_bloquea en la
    // base, que es quien lo exige de verdad. Además de las figuras (map.shapes) respeta el formato anterior: escenario (focal) y fijos «bano»/«barra».
    function bloquea(map, x, y) {
        if (!map) return null;
        function dentro(r) { return Array.isArray(r) && r.length === 4 && x >= r[0] - MARGEN && x <= r[0] + r[2] + MARGEN && y >= r[1] - MARGEN && y <= r[1] + r[3] + MARGEN; }
        if (map.focal && dentro(map.focal.rect)) return map.focal.label || 'el escenario';
        var f = (map.fixed || []).filter(function (q) { return (q.k === 'bano' || q.k === 'barra') && dentro(q.r); })[0];
        if (f) return f.l || 'una estructura de la sala';
        var hit = null;
        (Array.isArray(map.shapes) ? map.shapes : []).forEach(function (it) {
            if (hit || !esEstructura(it)) return;
            if (it.k === 'wall') { if (distSegmento(x, y, it.x1, it.y1, it.x2, it.y2) <= MARGEN + (it.th || 6) / 2) hit = nombreDe(it); return; }
            if (it.k === 'text' || it.k === 'chair') return;
            var a = (it.rot || 0) * Math.PI / 180, dx = x - it.x, dy = y - it.y;
            var lx = dx * Math.cos(a) + dy * Math.sin(a), ly = -dx * Math.sin(a) + dy * Math.cos(a);        // el punto, en el sistema de la figura (sin giro)
            if (it.k === 'door') { var r = it.w; if (Math.abs(lx) <= r / 2 + MARGEN && Math.abs(ly) <= 3.5 + MARGEN) hit = nombreDe(it); return; }
            var ellipse = it.k === 'shape' ? it.sub === 'ellipse' : (it.k === 'stage' && it.shape === 'oval');
            if (ellipse) { var ea = it.w / 2 + MARGEN, eb = it.h / 2 + MARGEN; if ((lx * lx) / (ea * ea) + (ly * ly) / (eb * eb) <= 1) hit = nombreDe(it); }
            else if (Math.abs(lx) <= it.w / 2 + MARGEN && Math.abs(ly) <= it.h / 2 + MARGEN) hit = nombreDe(it);
        });
        return hit;
    }

    // Cuánto mide la caja que ocupa una figura, sin giro: [ancho, alto] (para el recuadro de selección y las manijas).
    function medida(it) {
        if (it.k === 'door') return [it.w, 14];
        if (it.k === 'chair') return [it.w + 6, it.w + 6];
        if (it.k === 'text') { var s = it.size || 16; return [Math.max(24, (it.text || '').length * s * 0.62), s * 1.5]; }
        if (it.k === 'wall') return [Math.abs(it.x2 - it.x1) + (it.th || 6), Math.abs(it.y2 - it.y1) + (it.th || 6)];
        return [it.w, it.h];
    }


    // ───────────────────────── Del editor a la sala y de vuelta ─────────────────────────
    // El editor trabaja con «planos» ({ id, name, scope, room:{w,h}, items:[…], zonePrice }); la sala guarda un layout con tres cosas:
    //   builder → el dibujo de edición completo (para volver a abrirlo igual)         maps[i].shapes → la arquitectura (la dibujan el staff y la página pública)
    //   maps[i].tables → dónde está cada mesa (geometría)                              tables → el inventario que vende la base (clave, sillas, zona, precio)
    var FORMA_MESA = { round: 'round', vip: 'round', hightop: 'round', square: 'square', rect: 'rect' };
    var CAMPOS = ['id', 'k', 'sub', 'shape', 'x', 'y', 'w', 'h', 'x1', 'y1', 'x2', 'y2', 'th', 'rot', 'label', 'text', 'size', 'relleno', 'bloquea'];
    function limpia(it) {
        var o = {};
        CAMPOS.forEach(function (c) { if (it[c] !== undefined && it[c] !== null && it[c] !== '') o[c] = typeof it[c] === 'number' ? Math.round(it[c] * 10) / 10 : it[c]; });
        if (!o.rot) delete o.rot;
        return o;
    }
    function zonaDe(mapa, mesa, escenario) {
        if (!escenario) return 'Mesas';
        var zp = mapa.zonePrice || { r1: 230, r2: 330 }, d = Math.sqrt(Math.pow(mesa.x - escenario.x, 2) + Math.pow(mesa.y - escenario.y, 2));
        return d < zp.r1 ? 'Zona 1 · Frente al escenario' : d < zp.r2 ? 'Zona 2 · Intermedia' : 'Zona 3 · Fondo';
    }
    // Devuelve { ok, errores[], layout }. Solo viajan los planos de PLANTILLA (los de evento se quedan en el editor).
    function aLayout(estado) {
        var out = { ok: false, errores: [], layout: null }, planos = ((estado && estado.maps) || []).filter(function (m) { return m.scope === 'template'; });
        if (!planos.length) { out.errores.push('No hay planos de plantilla para guardar.'); return out; }
        var vistas = {}, sinPrecio = [], inventario = [], maps = [];
        planos.forEach(function (m) {
            var mesas = m.items.filter(function (i) { return i.k === 'table'; }), esc = m.items.filter(function (i) { return i.k === 'stage'; })[0] || null, geo = [];
            mesas.forEach(function (t) {
                var label = String(t.label || '').trim();
                if (!label) { out.errores.push('Hay una mesa sin identificador en «' + m.name + '».'); return; }
                if (label.length > 20) { out.errores.push('La mesa «' + label + '» tiene un identificador de más de 20 caracteres.'); return; }
                if (vistas[label]) { out.errores.push('El identificador «' + label + '» está repetido (en toda la sala cada mesa lleva uno distinto).'); return; }
                vistas[label] = true;
                var seats = Math.round(t.seats || 0);
                if (seats < 1 || seats > 40) { out.errores.push('La mesa «' + label + '» debe tener entre 1 y 40 sillas.'); return; }
                if (!(t.price > 0)) { sinPrecio.push(label); return; }
                inventario.push({ key: label, label: label, seats: seats, zone: zonaDe(m, t, esc), price_cents: Math.round(t.price * 100) });
                var forma = FORMA_MESA[t.shape] || 'round', g = { id: label, t: forma, x: Math.round(t.x), y: Math.round(t.y), seats: seats };
                if (forma !== 'round') { var w = t.w || 54, h = t.h || (forma === 'square' ? w : 54), girada = ((t.rot || 0) % 180) === 90; g.w = Math.round(girada ? h : w); if (forma === 'rect') g.h = Math.round(girada ? w : h); }
                geo.push(g);
            });
            var formas = m.items.filter(function (i) { return i.k !== 'table'; }).map(limpia);
            var e = validarItems(formas); if (e) out.errores.push('Plano «' + m.name + '»: ' + e);
            var room = m.room || { w: 800, h: 520 };
            maps.push({ id: m.id, label: m.name, custom: true, room: { w: Math.round(room.w), h: Math.round(room.h) }, focal: { x: Math.round(esc ? esc.x : room.w / 2), y: Math.round(esc ? esc.y : 52) },
                fixed: [], zones: [{ name: 'Mesas', maxD: 9999, price: 0 }], shapes: formas, tables: geo });
        });
        if (sinPrecio.length) out.errores.push('Falta el precio de: ' + sinPrecio.slice(0, 10).join(', ') + (sinPrecio.length > 10 ? '… (' + sinPrecio.length + ' mesas)' : '') + '.');
        if (!inventario.length && !out.errores.length) out.errores.push('El plano no tiene mesas.');
        if (inventario.length > 300) out.errores.push('Máximo 300 mesas por sala.');
        if (out.errores.length) return out;
        var builder = { v: 1, venue: estado.venue || '', maps: planos.map(function (m) { var c = JSON.parse(JSON.stringify(m)); delete c.ref; return c; }) };
        out.layout = { builder: builder, maps: maps, tables: inventario }; out.ok = true;
        return out;
    }
    var _n = 0;
    function nuevoId() { _n++; return 'i' + Date.now().toString(36).slice(-4) + _n.toString(36) + Math.random().toString(36).slice(2, 5); }
    // Convierte lo guardado en una sala a planos del editor. Si trae el dibujo de edición («builder»), lo recupera tal cual; si es un plano anterior
    // (mapa de ejemplo, SQL del PO…), lo reconstruye: paredes y entrada del contorno, escenario, áreas fijas y mesas.
    function desdeLayout(layout) {
        var out = { venue: '', maps: [] };
        if (!layout || typeof layout !== 'object') return out;
        if (layout.builder && Array.isArray(layout.builder.maps) && layout.builder.maps.length) {
            out.venue = layout.builder.venue || '';
            out.maps = JSON.parse(JSON.stringify(layout.builder.maps)).map(function (m) { m.scope = 'template'; m.ref = m.ref || null; m.room = m.room || { w: 800, h: 520 }; m.items = m.items || []; return m; });
            return out;
        }
        var meta = {}; (Array.isArray(layout.tables) ? layout.tables : []).forEach(function (t) { meta[t.key] = t; });
        (Array.isArray(layout.maps) ? layout.maps : []).forEach(function (mp) {
            var m = { id: nuevoId(), scope: 'template', name: mp.label || 'Plano', room: mp.room || { w: 800, h: 520 }, items: [], ref: null };
            if (!mp.custom) {
                [[340, 505, 12, 505], [12, 505, 12, 12], [12, 12, 788, 12], [788, 12, 788, 505], [788, 505, 460, 505]].forEach(function (s) { m.items.push({ id: nuevoId(), k: 'wall', x1: s[0], y1: s[1], x2: s[2], y2: s[3], th: 5, bloquea: true }); });
                m.items.push({ id: nuevoId(), k: 'door', sub: 'entrada', x: 400, y: 505, w: 120, rot: 0, label: 'ENTRADA' });
                if (mp.artistDoor) m.items.push({ id: nuevoId(), k: 'door', sub: 'artistas', x: mp.artistDoor.x, y: 12, w: 60, rot: 0, label: 'ARTISTAS' });
            }
            if (mp.focal && Array.isArray(mp.focal.rect)) { var r = mp.focal.rect; m.items.push({ id: nuevoId(), k: 'stage', shape: 'rect', x: r[0] + r[2] / 2, y: r[1] + r[3] / 2, w: r[2], h: r[3], rot: 0, label: mp.focal.label || 'ESCENARIO' }); }
            (mp.fixed || []).forEach(function (f) {
                if (!Array.isArray(f.r)) return;
                var sub = f.k === 'bano' ? 'bano' : f.k === 'barra' ? 'barra' : /pista/i.test(f.l || '') ? 'pista' : 'otro';
                m.items.push({ id: nuevoId(), k: 'zone', sub: sub, x: f.r[0] + f.r[2] / 2, y: f.r[1] + f.r[3] / 2, w: f.r[2], h: f.r[3], rot: 0, label: f.l || '' });
            });
            (Array.isArray(mp.shapes) ? mp.shapes : []).forEach(function (s) { m.items.push(JSON.parse(JSON.stringify(s))); });
            (mp.tables || []).forEach(function (t) {
                var d = meta[t.id] || {}, forma = t.t === 'round' ? 'round' : t.t === 'square' ? 'square' : 'rect', w = t.w || (forma === 'round' ? 52 : 54);
                var it = { id: nuevoId(), k: 'table', shape: forma, x: t.x, y: t.y, w: w, rot: 0, label: t.id, seats: d.seats || t.seats || 4, price: d.price_cents ? d.price_cents / 100 : 0, status: 'available' };
                if (forma !== 'round') it.h = t.h || (forma === 'square' ? w : 54);
                m.items.push(it);
            });
            out.maps.push(m);
        });
        return out;
    }

    var core = { KINDS: KINDS, SUBS: SUBS, STAGE_SHAPES: STAGE_SHAPES, RELLENOS: RELLENOS, MARGEN: MARGEN, LIM: LIM, validarItem: validarItem, validarItems: validarItems,
        distSegmento: distSegmento, esEstructura: esEstructura, bloquea: bloquea, medida: medida, aLayout: aLayout, desdeLayout: desdeLayout, limpia: limpia };
    if (typeof module !== 'undefined' && module.exports) module.exports = core;
    root.mdjPlanShapes = core;
    if (typeof document === 'undefined') return;

    // ───────────────────────── Dibujo (SVG) ─────────────────────────
    var NS = 'http://www.w3.org/2000/svg';
    function el(name, attrs, parent, text) {
        var n = document.createElementNS(NS, name);
        Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
        if (text != null) n.textContent = text;
        if (parent) parent.appendChild(n);
        return n;
    }
    function stagePath(shape, w, h) {
        var x0 = -w / 2, y0 = -h / 2, x1 = w / 2, y1 = h / 2;
        if (shape === 'halfround') { var ry = Math.min(h * 0.65, h); return 'M ' + x0 + ' ' + y0 + ' H ' + x1 + ' V ' + (y1 - ry) + ' A ' + (w / 2) + ' ' + ry + ' 0 0 1 ' + x0 + ' ' + (y1 - ry) + ' Z'; }
        if (shape === 'corner') return 'M ' + x0 + ' ' + y0 + ' H ' + x1 + ' A ' + w + ' ' + h + ' 0 0 1 ' + x0 + ' ' + y1 + ' Z';
        if (shape === 'trapezoid') return 'M ' + x0 + ' ' + y0 + ' H ' + x1 + ' L ' + (w * 0.35) + ' ' + y1 + ' H ' + (-w * 0.35) + ' Z';
        return null;
    }
    function rotulo(parent, texto, rot, y, size) {
        var t = el('text', { x: 0, y: y == null ? 4 : y, 'text-anchor': 'middle', fill: 'rgba(255,255,255,0.8)', 'font-size': size || 12, 'font-weight': 800, 'font-family': 'Inter, sans-serif', 'letter-spacing': '0.06em', 'pointer-events': 'none' }, parent, texto);
        t.setAttribute('transform', 'rotate(' + (-(rot || 0)) + ')');       // el rótulo se queda derecho aunque la figura gire
        return t;
    }
    // Dibuja UNA figura dentro de `parent` y devuelve su grupo (con data-id). Lo usan el editor y el visor.
    function dibujarItem(parent, it) {
        if (validarItem(it)) return null;                                    // una figura mal formada no rompe el plano: se omite
        var g, fill, borde;
        if (it.k === 'wall') {
            g = el('g', { 'data-id': it.id, 'class': 'ps ps-wall' }, parent);
            el('line', { x1: it.x1, y1: it.y1, x2: it.x2, y2: it.y2, stroke: COLOR, 'stroke-width': it.th || 6, 'stroke-linecap': 'round', 'class': 'body' }, g);
            return g;
        }
        g = el('g', { 'data-id': it.id, 'class': 'ps ps-' + it.k, transform: 'translate(' + it.x + ' ' + it.y + ') rotate(' + (it.rot || 0) + ')' }, parent);
        if (it.k === 'stage') {
            var d = stagePath(it.shape, it.w, it.h), a = { 'class': 'body', fill: RELLENOS.dorado, stroke: DORADO, 'stroke-width': 2 };
            if (d) el('path', Object.assign({ d: d }, a), g);
            else if (it.shape === 'oval') el('ellipse', Object.assign({ rx: it.w / 2, ry: it.h / 2 }, a), g);
            else el('rect', Object.assign({ x: -it.w / 2, y: -it.h / 2, width: it.w, height: it.h, rx: 8 }, a), g);
            rotulo(g, it.label || 'ESCENARIO', it.rot);
        } else if (it.k === 'zone') {
            var fac = it.sub === 'barra' || it.sub === 'bano';
            el('rect', { 'class': 'body', x: -it.w / 2, y: -it.h / 2, width: it.w, height: it.h, rx: 10, fill: fac ? RELLENOS.dorado : RELLENOS.gris, stroke: fac ? DORADO : COLOR, 'stroke-width': 2, 'stroke-dasharray': fac ? 'none' : '6 4' }, g);
            var tz = rotulo(g, it.label || '', it.rot);
            if (it.h > it.w * 1.6) tz.setAttribute('transform', 'rotate(90)');
        } else if (it.k === 'door') {
            var ex = it.sub === 'exit', col = ex ? '#00c878' : '#c5a059';
            if (it.sub === 'puerta') {                                          // hoja + arco de apertura (la bisagra queda a la izquierda)
                el('path', { d: 'M ' + (it.w / 2) + ' 0 A ' + it.w + ' ' + it.w + ' 0 0 0 ' + (-it.w / 2) + ' ' + (-it.w), fill: 'none', stroke: 'rgba(255,255,255,0.3)', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }, g);
                el('line', { x1: -it.w / 2, y1: 0, x2: -it.w / 2, y2: -it.w, stroke: col, 'stroke-width': 4, 'stroke-linecap': 'round', 'class': 'body' }, g);
                el('line', { x1: -it.w / 2, y1: 0, x2: it.w / 2, y2: 0, stroke: col, 'stroke-width': 3, 'stroke-linecap': 'round', 'class': 'body' }, g);
            } else el('rect', { 'class': 'body', x: -it.w / 2, y: -3.5, width: it.w, height: 7, rx: 2, fill: col }, g);
            if (it.label) rotulo(g, it.label, it.rot, it.sub === 'puerta' ? 16 : -10, 10);
        } else if (it.k === 'shape') {
            fill = RELLENOS[it.relleno] || RELLENOS.ninguno; borde = COLOR;
            var at = { 'class': 'body', fill: fill, stroke: borde, 'stroke-width': 2, 'stroke-dasharray': it.relleno ? 'none' : '6 4' };
            if (it.sub === 'ellipse') el('ellipse', Object.assign({ rx: it.w / 2, ry: it.h / 2 }, at), g);
            else if (it.sub === 'triangle') el('path', Object.assign({ d: 'M 0 ' + (-it.h / 2) + ' L ' + (it.w / 2) + ' ' + (it.h / 2) + ' L ' + (-it.w / 2) + ' ' + (it.h / 2) + ' Z', 'stroke-linejoin': 'round' }, at), g);
            else el('rect', Object.assign({ x: -it.w / 2, y: -it.h / 2, width: it.w, height: it.h, rx: 6 }, at), g);
            if (it.label) rotulo(g, it.label, it.rot);
        } else if (it.k === 'text') {
            el('text', { 'class': 'body', x: 0, y: (it.size || 16) * 0.35, 'text-anchor': 'middle', fill: 'rgba(255,255,255,0.92)', 'font-size': it.size || 16, 'font-weight': 700, 'font-family': 'Inter, sans-serif' }, g, it.text);
        } else if (it.k === 'chair') {
            el('circle', { 'class': 'body', r: it.w / 2, fill: 'rgba(255,255,255,0.3)' }, g);
        }
        return g;
    }
    // Visor: dibuja la lista en orden (la última queda encima).
    function dibujar(parent, items) { (Array.isArray(items) ? items : []).forEach(function (it) { dibujarItem(parent, it); }); }
    core.dibujarItem = dibujarItem; core.dibujar = dibujar; core.stagePath = stagePath;
})(typeof window !== 'undefined' ? window : globalThis);
