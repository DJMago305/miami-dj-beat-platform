// Prueba de las figuras del editor de planos: web/js/mdj-plan-shapes.js (navegador) y supabase/scripts/20261004_plano_formas.sql (base) en un Postgres REAL
// embebido (PGlite). Verifica las reglas de validación y, sobre todo, que el NAVEGADOR y la BASE respondan IGUAL a «¿cae una mesa encima de la arquitectura?»
// en cientos de puntos y figuras (rotadas, elipses, paredes, escenario…): si divergieran, la pantalla avisaría una cosa y la base exigiría otra.
// Uso:   npm i --no-save @electric-sql/pglite
//        PGLITE_FROM=/ruta/donde/instalaste/package.json node supabase/tests/plano_formas.test.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const PS = createRequire(import.meta.url)(join(here, '..', '..', 'web', 'js', 'mdj-plan-shapes.js'));
const require_ = createRequire(process.env.PGLITE_FROM || import.meta.url);
const { PGlite } = require_('@electric-sql/pglite');
const FIJAR = readFileSync(join(here, '..', 'scripts', '20261003_fijar_mapa_de_la_sala.sql'), 'utf8');
const FORMAS = readFileSync(join(here, '..', 'scripts', '20261004_plano_formas.sql'), 'utf8');
process.on('unhandledRejection', (e) => { console.error('\n❌ Error inesperado:', e && e.message ? e.message : e); process.exit(2); });
let pasadas = 0, fallidas = 0;
const ok = (c, m) => { if (c) { pasadas++; console.log('  ✔', m); } else { fallidas++; console.log('  ✘ FALLA:', m); } };

console.log('▶ Reglas del navegador (validarItem)');
const bueno = { id: 'a1', k: 'shape', sub: 'rect', x: 100, y: 100, w: 80, h: 40 };
ok(PS.validarItem(bueno) === null, 'una figura buena es válida');
const malos = [['sin id', { ...bueno, id: '' }], ['id largo', { ...bueno, id: 'x'.repeat(25) }], ['tipo raro', { ...bueno, k: 'nave' }], ['figura sin subtipo', { id: 'a', k: 'shape', x: 1, y: 1, w: 9, h: 9 }],
  ['subtipo raro', { ...bueno, sub: 'hexagono' }], ['posición fuera', { ...bueno, x: 5000 }], ['tamaño 0', { ...bueno, w: 0 }], ['tamaño gigante', { ...bueno, w: 5000 }],
  ['x como texto', { ...bueno, x: '100' }], ['giro absurdo', { ...bueno, rot: 9999 }], ['rótulo largo', { ...bueno, label: 'x'.repeat(61) }], ['bloquea como texto', { ...bueno, bloquea: 'si' }],
  ['relleno raro', { ...bueno, relleno: 'fucsia' }], ['pared sin extremo', { id: 'p', k: 'wall', x1: 1, y1: 1, x2: 2 }], ['pared gruesa', { id: 'p', k: 'wall', x1: 1, y1: 1, x2: 20, y2: 2, th: 99 }],
  ['texto vacío', { id: 't', k: 'text', x: 1, y: 1, text: '  ' }], ['texto largo', { id: 't', k: 'text', x: 1, y: 1, text: 'x'.repeat(61) }], ['texto diminuto', { id: 't', k: 'text', x: 1, y: 1, text: 'a', size: 2 }],
  ['puerta enorme', { id: 'd', k: 'door', sub: 'puerta', x: 1, y: 1, w: 999 }], ['escenario de forma rara', { id: 's', k: 'stage', shape: 'cubo', x: 1, y: 1, w: 50, h: 50 }], ['null', null], ['lista', []], ['área con 2 puntos', { id: 'p', k: 'poly', pts: [[1, 1], [5, 5]] }], ['área con 41 puntos', { id: 'p', k: 'poly', pts: Array.from({ length: 41 }, (_, i) => [i * 10, 50 + (i % 2) * 20]) }], ['área con un punto fuera', { id: 'p', k: 'poly', pts: [[1, 1], [50, 1], [50, 9999]] }], ['área con un punto mal formado', { id: 'p', k: 'poly', pts: [[1, 1], [50, 1], [50]] }], ['área sin puntos', { id: 'p', k: 'poly' }], ['área que intenta girar', { id: 'p', k: 'poly', pts: [[1, 1], [50, 1], [50, 50]], rot: 30 }], ['venta como texto', { id: 'p', k: 'poly', pts: [[1, 1], [50, 1], [50, 50]], venta: 'si' }], ['siempre como número', { id: 'p', k: 'poly', pts: [[1, 1], [50, 1], [50, 50]], siempre: 1 }], ['venta en una mesa/figura que no es área libre', { id: 'p', k: 'shape', sub: 'rect', x: 1, y: 1, w: 9, h: 9, venta: true }]];
for (const [n, f] of malos) ok(PS.validarItem(f) !== null, `rechaza: ${n}`);
ok(PS.validarItems([bueno, { ...bueno }]) !== null, 'ids repetidos en un plano se rechazan');
ok(PS.validarItems(Array.from({ length: 401 }, (_, i) => ({ ...bueno, id: 'f' + i }))) !== null, 'más de 400 figuras se rechaza');
ok(PS.validarItems(Array.from({ length: 400 }, (_, i) => ({ ...bueno, id: 'f' + i }))) === null, '400 figuras sí');
for (const f of [{ id: 'p', k: 'poly', pts: [[10, 10], [200, 10], [200, 120], [120, 120], [120, 300], [10, 300]], label: 'Terraza', relleno: 'verde', venta: true, siempre: true }, { id: 's', k: 'stage', shape: 'halfround', x: 400, y: 50, w: 240, h: 90 }, { id: 'z', k: 'zone', sub: 'barra', x: 750, y: 300, w: 58, h: 220 }, { id: 'd', k: 'door', sub: 'puerta', x: 100, y: 500, w: 44 }, { id: 'c', k: 'chair', x: 5, y: 5, w: 12 }, { id: 'p', k: 'wall', x1: 0, y1: 0, x2: 800, y2: 0 }, { id: 't', k: 'text', x: 400, y: 260, text: 'PISTA' }])
  ok(PS.validarItem(f) === null, `figura válida: ${f.k}`);

console.log('\n▶ Qué bloquea a una mesa (navegador)');
const mapa = { shapes: [
  { id: 'esc', k: 'stage', shape: 'rect', x: 400, y: 52, w: 240, h: 56 },
  { id: 'bar', k: 'zone', sub: 'barra', x: 750, y: 300, w: 58, h: 220 },
  { id: 'pis', k: 'zone', sub: 'pista', x: 400, y: 310, w: 110, h: 110 },
  { id: 'col', k: 'shape', sub: 'ellipse', x: 200, y: 250, w: 60, h: 40, bloquea: true },
  { id: 'rot', k: 'shape', sub: 'rect', x: 150, y: 400, w: 120, h: 20, rot: 45, bloquea: true },
  { id: 'dec', k: 'shape', sub: 'rect', x: 600, y: 400, w: 100, h: 100 },
  { id: 'par', k: 'wall', x1: 20, y1: 100, x2: 20, y2: 500 },
  { id: 'dia', k: 'wall', x1: 300, y1: 450, x2: 500, y2: 520, th: 10 },
  { id: 'txt', k: 'text', x: 400, y: 200, text: 'hola', bloquea: true },
  { id: 'noesc', k: 'stage', shape: 'rect', x: 650, y: 150, w: 100, h: 60, bloquea: false },
  { id: 'ele', k: 'poly', pts: [[100, 120], [180, 120], [180, 150], [130, 150], [130, 220], [100, 220]], label: 'VIP', relleno: 'gris', bloquea: true },
  { id: 'lib', k: 'poly', pts: [[620, 110], [700, 110], [660, 170]], bloquea: false }] };
ok(PS.bloquea(mapa, 400, 52) === 'el escenario', 'sobre el escenario');
ok(PS.bloquea(mapa, 400, 95) === 'el escenario' && PS.bloquea(mapa, 400, 110) === null, 'margen de 22 px del escenario');
ok(PS.bloquea(mapa, 750, 300) === 'la barra', 'sobre la barra');
ok(PS.bloquea(mapa, 400, 310) === null, 'la pista no bloquea');
ok(PS.bloquea(mapa, 200, 250) === 'una estructura de la sala', 'figura marcada «bloquea»');
ok(PS.bloquea(mapa, 600, 400) === null, 'una figura sin «bloquea» no bloquea');
ok(PS.bloquea(mapa, 20, 300) === 'una pared' && PS.bloquea(mapa, 60, 300) === null, 'una pared bloquea (margen + grosor)');
ok(PS.bloquea(mapa, 400, 485) === 'una pared', 'pared en diagonal');
ok(PS.bloquea(mapa, 400, 200) === null, 'el texto nunca bloquea');
ok(PS.bloquea(mapa, 650, 150) === null, '«bloquea: false» anula el escenario');
ok(PS.bloquea(mapa, 150, 135) === 'VIP' && PS.bloquea(mapa, 115, 190) === 'VIP', 'un área libre en L: dentro de cada brazo bloquea');
ok(PS.bloquea(mapa, 160, 190) === null, 'el hueco de la L (lejos de su borde) no bloquea');
ok(PS.bloquea(mapa, 660, 125) === null, 'un área libre sin «bloquea» no bloquea');
ok(PS.bloquea(null, 1, 1) === null && PS.bloquea({}, 1, 1) === null, 'sin figuras no bloquea');
ok(PS.bloquea({ focal: { rect: [280, 24, 240, 56], label: 'ESCENARIO / DJ' } }, 400, 50) === 'ESCENARIO / DJ', 'sigue entendiendo el formato anterior (escenario)');

console.log('\n▶ Del editor a la sala y de vuelta (aLayout / desdeLayout)');
const mesaIt = (label, over) => ({ id: 'm' + label, k: 'table', shape: 'round', x: 200, y: 300, w: 52, rot: 0, seats: 6, price: 200, label, status: 'available', ...over });
const plano = (items, over) => ({ id: 'p1', name: 'Sala', scope: 'template', room: { w: 800, h: 520 }, ref: null, items, ...over });
const estado = (items, over) => ({ venue: 'Local de prueba', maps: [plano(items, over)] });
const esc = { id: 'e', k: 'stage', shape: 'halfround', x: 400, y: 70, w: 260, h: 80, rot: 0, label: 'ESCENARIO' };
let r1 = PS.aLayout(estado([esc, { id: 'w', k: 'wall', x1: 10, y1: 10, x2: 790, y2: 10, th: 6, bloquea: true }, mesaIt('T01'), mesaIt('T02', { x: 600, y: 420, shape: 'rect', w: 108, h: 54, rot: 90, seats: 8, price: 150.5 })]));
ok(r1.ok && r1.layout.tables.length === 2, 'un plano completo se convierte (2 mesas)');
ok(r1.layout.tables[1].price_cents === 15050 && r1.layout.tables[1].seats === 8, 'el precio va en centavos y las sillas se conservan');
ok(r1.layout.maps[0].tables[1].t === 'rect' && r1.layout.maps[0].tables[1].w === 54 && r1.layout.maps[0].tables[1].h === 108, 'una mesa larga girada 90° se guarda con ancho y alto intercambiados');
ok(r1.layout.maps[0].custom === true && r1.layout.maps[0].shapes.length === 2 && r1.layout.maps[0].fixed.length === 0, 'el plano queda marcado «custom» con sus figuras y sin fijos antiguos');
ok(r1.layout.maps[0].focal.x === 400 && r1.layout.maps[0].focal.y === 70, 'el foco de precios es el escenario');
ok(r1.layout.tables[0].zone.startsWith('Zona 2') && r1.layout.tables[1].zone.startsWith('Zona 3'), 'la zona sale de la distancia al escenario (T01 a ~305 → Zona 2; T02 a ~480 → Zona 3)');
ok(!!r1.layout.builder && r1.layout.builder.maps[0].items.length === 4 && !('ref' in r1.layout.builder.maps[0]), 'guarda el dibujo de edición completo, sin la imagen de referencia');
ok(PS.validarItems(r1.layout.maps[0].shapes) === null, 'las figuras guardadas pasan la validación');
const malos2 = [['mesas con el mismo id', [mesaIt('T01'), mesaIt('T01', { x: 300 })]], ['mesa sin id', [mesaIt('  ')]], ['id de más de 20 caracteres', [mesaIt('x'.repeat(21))]], ['mesa sin precio', [mesaIt('T01', { price: 0 })]],
  ['mesa sin sillas', [mesaIt('T01', { seats: 0 })]], ['mesa con 41 sillas', [mesaIt('T01', { seats: 41 })]], ['figura inválida', [mesaIt('T01'), { id: 'x', k: 'shape', sub: 'rect', x: 1, y: 1, w: 0, h: 5 }]], ['sin mesas', [esc]]];
for (const [n, items] of malos2) ok(PS.aLayout(estado(items)).ok === false, `no guarda: ${n}`);
ok(PS.aLayout({ maps: [plano([mesaIt('T01')], { scope: 'event' })] }).ok === false, 'los planos de evento no viajan a la sala (sin plantilla no hay qué guardar)');
const dos = PS.aLayout({ maps: [plano([mesaIt('T01')], { id: 'a', name: 'A' }), plano([mesaIt('T01')], { id: 'b', name: 'B' })] });
ok(dos.ok === false && /repetido/.test(dos.errores.join(' ')), 'el mismo identificador en dos planos de la sala se rechaza');
const conSiempre = PS.aLayout(estado([mesaIt('T01')], { siempre: true }));
ok(conSiempre.ok && conSiempre.layout.maps[0].siempre === true && !('siempre' in r1.layout.maps[0]), 'un plano marcado «siempre abierta» viaja marcado (y los demás no llevan la marca)');
ok(PS.desdeLayout(conSiempre.layout).maps[0].siempre === true, 'al reabrirlo conserva la marca');
const ida = PS.desdeLayout(r1.layout);
ok(ida.venue === 'Local de prueba' && ida.maps.length === 1 && ida.maps[0].items.length === 4 && ida.maps[0].scope === 'template', 'abrir una sala con «builder» recupera el dibujo tal cual');
const vuelta = PS.aLayout({ venue: ida.venue, maps: ida.maps });
ok(vuelta.ok && JSON.stringify(vuelta.layout.tables) === JSON.stringify(r1.layout.tables), 'guardar → abrir → guardar da exactamente lo mismo');
// Sala anterior (sin «builder»): contorno fijo + escenario + fijos + mesas
const vieja = { maps: [{ id: 'sala', label: 'Sala principal', focal: { x: 400, y: 52, rect: [280, 24, 240, 56], label: 'ESCENARIO / DJ' }, artistDoor: { x: 200, side: 'top' },
  fixed: [{ r: [20, 24, 90, 56], l: 'BAÑOS', k: 'bano' }, { r: [345, 255, 110, 110], l: 'PISTA' }, { r: [722, 100, 58, 390], l: 'BARRA', k: 'barra' }],
  tables: [{ id: 'M1', t: 'square', x: 330, y: 135, w: 54, seats: 4 }, { id: 'M2', t: 'round', x: 470, y: 135, seats: 6 }] }], tables: [{ key: 'M1', seats: 4, zone: 'Zona 1', price_cents: 40000 }, { key: 'M2', seats: 6, zone: 'Zona 1', price_cents: 25000 }] };
const rec = PS.desdeLayout(vieja), it = rec.maps[0].items;
ok(it.filter((i) => i.k === 'wall').length === 5 && it.some((i) => i.k === 'door' && i.sub === 'entrada') && it.some((i) => i.k === 'door' && i.sub === 'artistas'), 'un plano anterior recupera su contorno, la entrada y la de artistas');
ok(it.some((i) => i.k === 'stage' && i.x === 400 && i.y === 52) && it.filter((i) => i.k === 'zone').map((z) => z.sub).sort().join() === 'bano,barra,pista', 'y su escenario y sus áreas (baños, pista, barra)');
ok(it.filter((i) => i.k === 'table').map((t) => `${t.label}:${t.price}:${t.seats}`).sort().join() === 'M1:400:4,M2:250:6', 'y sus mesas con su precio y sillas');
ok(PS.aLayout(rec).ok, 'un plano anterior abierto en el editor se puede volver a guardar');
ok(PS.desdeLayout(null).maps.length === 0 && PS.desdeLayout({}).maps.length === 0, 'una sala sin plano devuelve lista vacía');

console.log('\n▶ Áreas de venta (áreas libres marcadas «venta»)');
const area = (id, label, pts, extra) => ({ id, k: 'poly', pts, label, relleno: 'gris', venta: true, ...extra });
const rect4 = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const itemsMojitos = [area('salon', 'Salón principal', rect4(5, 5, 550, 275)), area('vip', 'VIP', rect4(0, 275, 550, 400)), area('terraza', 'Terraza', rect4(0, 400, 800, 520), { siempre: true }),
  { id: 'cocina', k: 'poly', pts: rect4(555, 155, 795, 400), label: 'COCINA', relleno: 'dorado' },
  mesaIt('S1', { x: 200, y: 150 }), mesaIt('S2', { x: 300, y: 150 }), mesaIt('V1', { x: 200, y: 340 }), mesaIt('V2', { x: 300, y: 340 }), mesaIt('T1', { x: 200, y: 460 })];
const am = PS.aLayout(estado(itemsMojitos));
ok(am.ok && am.layout.areas.length === 3 && am.layout.areas.map((a) => a.id).join() === 'salon,vip,terraza', 'el catálogo trae solo las áreas MARCADAS «venta» (la cocina no es de venta)');
ok(am.layout.areas[2].siempre === true && !('siempre' in am.layout.areas[0]), 'la terraza va «siempre»; las demás no llevan la marca');
const areaDe = (k) => am.layout.tables.find((x) => x.key === k).area;
ok(areaDe('S1') === 'salon' && areaDe('V1') === 'vip' && areaDe('T1') === 'terraza', 'cada mesa lleva el área en cuyo contorno está');
ok(am.avisos.length === 0, 'sin avisos si todas las mesas caen dentro de un área');
ok(am.layout.tables.find((x) => x.key === 'V1').zone === 'VIP' && am.layout.tables.find((x) => x.key === 'T1').zone === 'Terraza', 'con áreas de venta, la «zona» que ve el cliente es el nombre del área (VIP, Terraza), no una franja por distancia');
const fuera = PS.aLayout(estado([...itemsMojitos, mesaIt('X9', { x: 700, y: 250 })]));
ok(fuera.ok && !('area' in fuera.layout.tables.find((x) => x.key === 'X9')) && fuera.avisos.length === 1 && /X9/.test(fuera.avisos[0]), 'una mesa fuera de toda área de venta se guarda sin área y avisa (se venderá siempre)');
const solapadas = PS.aLayout(estado([area('a', 'A', rect4(0, 0, 400, 400)), area('b', 'B', rect4(100, 100, 300, 300)), mesaIt('M', { x: 200, y: 200 })]));
ok(solapadas.layout.tables[0].area === 'b', 'si dos áreas se solapan, gana la que está más arriba (la última)');
const sinAreas = PS.aLayout(estado([mesaIt('A1'), mesaIt('A2')]));
ok(sinAreas.ok && sinAreas.layout.areas.length === 1 && sinAreas.layout.areas[0].id === 'p1' && sinAreas.layout.tables.every((x) => x.area === 'p1'), 'un plano sin áreas de venta es UN área completa (como antes)');
const conSiempreMapa = PS.aLayout(estado([mesaIt('A1')], { siempre: true }));
ok(conSiempreMapa.layout.areas[0].siempre === true, 'y si el plano es «siempre abierto», esa área también');
const dosAreasIguales = PS.aLayout(estado([area('a', 'A', rect4(0, 0, 100, 100)), area('a', 'B', rect4(200, 0, 300, 100)), mesaIt('M', { x: 50, y: 50 })]));
ok(dosAreasIguales.ok === false, 'ids de figura repetidos se rechazan');

console.log('\n▶ La base (Postgres real)');
const db = new PGlite();
const U = { owner: '00000000-0000-0000-0000-0000000000a1', team: '00000000-0000-0000-0000-0000000000a3' };
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create table dj_profiles (user_id uuid, role text);
  create table venues (id uuid primary key default gen_random_uuid(), slug text, name text);
  create table venue_rooms (id uuid primary key default gen_random_uuid(), venue_id uuid not null references venues(id), slug text, name text, layout jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());
  create table venue_staff (venue_id uuid not null, user_id uuid not null, role text not null, primary key (venue_id, user_id));
  create function public.is_platform_admin(p_uid uuid) returns boolean language sql stable security definer set search_path to 'public' as $$ select false $$;
  create function public.venue_role(p_venue_id uuid) returns text language sql stable security definer set search_path to 'public' as $$ select role from public.venue_staff where venue_id = p_venue_id and user_id = auth.uid() $$;
  create function public.can_manage_venue_layout(p_venue_id uuid) returns boolean language sql stable security definer set search_path to 'public' as $$ select coalesce(public.venue_role(p_venue_id) in ('owner', 'manager'), false) $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on all functions in schema public to authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`);
const q = async (sql, p) => (await db.query(sql, p)).rows;
const [v] = await q(`insert into venues (slug, name) values ('mojitos', 'Mojitos') returning id`);
const [room] = await q(`insert into venue_rooms (venue_id, slug, name) values ($1, 'sala', 'Sala') returning id`, [v.id]);
await db.query(`insert into venue_staff values ($1,$2,'owner'),($1,$3,'team')`, [v.id, U.owner, U.team]);
await db.exec(FIJAR); await db.exec(FORMAS); console.log('  ✔ los scripts corren sin errores (el de formas encima del de fijar mapa)');
await db.exec(FORMAS); console.log('  ✔ y el de formas vuelve a correr (idempotente)');

// 1) El navegador y la base responden IGUAL, punto por punto.
let distintos = 0, total = 0, ejemplos = [];
for (const f of mapa.shapes) {
  const un = { shapes: [f] };
  for (let x = -40; x <= 860; x += 17) for (let y = -40; y <= 560; y += 19) {
    const js = PS.bloquea(un, x, y) !== null;
    const sql = (await q(`select public.venue_plano_bloquea($1::jsonb, $2, $3) b`, [JSON.stringify(un), x, y]))[0].b;
    total++; if (js !== sql) { distintos++; if (ejemplos.length < 5) ejemplos.push(`${f.id}@${x},${y} js=${js} sql=${sql}`); }
  }
}
ok(distintos === 0, `navegador y base coinciden en ${total} puntos sobre ${mapa.shapes.length} figuras${distintos ? ' — DIFIEREN: ' + ejemplos.join('; ') : ''}`);
const legado = { focal: { rect: [280, 24, 240, 56] }, fixed: [{ r: [20, 24, 90, 56], k: 'bano', l: 'BAÑOS' }, { r: [345, 255, 110, 110], l: 'PISTA' }] };
let dif2 = 0; for (let x = 0; x <= 800; x += 23) for (let y = 0; y <= 520; y += 23) if ((PS.bloquea(legado, x, y) !== null) !== (await q(`select public.venue_plano_bloquea($1::jsonb, $2, $3) b`, [JSON.stringify(legado), x, y]))[0].b) dif2++;
ok(dif2 === 0, 'también coinciden con el formato anterior (focal + fijos)');

// 2) Validación de figuras: la base y el navegador aceptan y rechazan lo mismo.
let difV = 0, nV = 0, ejV = [];
for (const f of [bueno, ...malos.map((m) => m[1]), mapa.shapes[0], mapa.shapes[7], { id: 'd', k: 'door', sub: 'puerta', x: 1, y: 1, w: 44, rot: 90 }]) {
  const js = PS.validarItem(f) === null, sql = (await q(`select public.venue_plano_figura_valida($1::jsonb) b`, [JSON.stringify(f)]))[0].b;
  nV++; if (js !== sql) { difV++; ejV.push(JSON.stringify(f).slice(0, 60) + ` js=${js} sql=${sql}`); }
}
ok(difV === 0, `validar una figura da lo mismo en el navegador y en la base (${nV} casos)${difV ? ' — DIFIEREN: ' + ejV.join('; ') : ''}`);

// 3) venue_room_set_layout con figuras
const mesa = (k) => ({ key: k, seats: 4, zone: 'Zona 1', price_cents: 10000 });
const base = (shapes, extra) => ({ builder: { v: 1 }, maps: [{ id: 'sala', label: 'Sala', room: { w: 800, h: 520 }, focal: { x: 400, y: 52 }, fixed: [], zones: [{ name: 'Mesas', maxD: 9999, price: 0 }], shapes, tables: [{ id: 'M1', t: 'round', x: 200, y: 300, seats: 4 }], ...extra }], tables: [mesa('M1')] });
const llama = async (uid, layout) => { await db.exec('reset role'); await db.exec('set role authenticated'); await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid]); try { return { n: (await db.query('select public.venue_room_set_layout($1, $2::jsonb) n', [room.id, JSON.stringify(layout)])).rows[0].n }; } catch (e) { return { err: String(e.message) }; } };
let r = await llama(U.owner, base(mapa.shapes)); ok(r.n === 1, 'el dueño guarda un plano con 10 figuras');
await db.exec('reset role'); const [g] = await q(`select layout -> 'maps' -> 0 -> 'shapes' -> 3 ->> 'sub' as sub, layout -> 'builder' ->> 'v' as v from venue_rooms where id = $1`, [room.id]);
ok(g.sub === 'ellipse' && g.v === '1', 'las figuras y el dibujo de edición («builder») quedan guardados tal cual');
r = await llama(U.team, base(mapa.shapes)); ok(/no_autorizado/.test(r.err || ''), 'el equipo no puede');
for (const [n, shapes] of [['figura inválida', [{ ...bueno, w: 0 }]], ['ids repetidos', [bueno, { ...bueno }]], ['figuras que no son lista', { a: 1 }], ['401 figuras', Array.from({ length: 401 }, (_, i) => ({ ...bueno, id: 'f' + i }))]]) {
  r = await llama(U.owner, base(shapes)); ok(/mapa_invalido/.test(r.err || ''), `rechaza: ${n}`);
}
r = await llama(U.owner, base([bueno], { room: { w: 100, h: 520 } })); ok(/mapa_invalido/.test(r.err || ''), 'rechaza un plano de 100 de ancho (mínimo 300)');
r = await llama(U.owner, base([bueno], { room: { w: 1600, h: 1200 } })); ok(r.n === 1, 'acepta un plano grande (1600 × 1200)');
r = await llama(U.owner, { ...base([bueno]), maps: Array.from({ length: 13 }, () => base([]).maps[0]) }); ok(/mapa_invalido/.test(r.err || ''), 'rechaza más de 12 planos');
r = await llama(U.owner, { ...base([bueno]), pesado: 'x'.repeat(1600000) }); ok(/mapa_invalido/.test(r.err || ''), 'rechaza un archivo de más de 1.5 MB');

const conAreas = (areas, tablas) => ({ maps: [{ id: 'sala', label: 'Sala', room: { w: 800, h: 520 }, focal: { x: 400, y: 52 }, fixed: [], zones: [{ name: 'Mesas', maxD: 9999, price: 0 }], shapes: [], tables: [{ id: 'M1', t: 'round', x: 200, y: 300, seats: 4 }] }], tables: tablas || [{ ...mesa('M1'), area: 'vip' }], ...(areas ? { areas } : {}) });
r = await llama(U.owner, conAreas([{ id: 'vip', label: 'VIP' }, { id: 'terraza', label: 'Terraza', siempre: true }])); ok(r.n === 1, 'la base acepta un catálogo de áreas y la mesa con su área');
for (const [n, lay] of [['mesa con un área que no existe en el catálogo', conAreas([{ id: 'terraza' }])], ['mesa con área pero sin catálogo', conAreas(null)], ['catálogo que no es lista', conAreas({ id: 'vip' })],
  ['áreas repetidas', conAreas([{ id: 'vip' }, { id: 'vip' }])], ['área sin id', conAreas([{ label: 'VIP' }])], ['siempre como texto', conAreas([{ id: 'vip', siempre: 'si' }])],
  ['más de 24 áreas', conAreas(Array.from({ length: 25 }, (_, i) => ({ id: 'a' + i })))], ['área de mesa que no es texto', conAreas([{ id: 'vip' }], [{ ...mesa('M1'), area: 5 }])]]) {
  r = await llama(U.owner, lay); ok(/mapa_invalido/.test(r.err || ''), `rechaza: ${n}`);
}
r = await llama(U.owner, base([{ id: 'v1', k: 'poly', pts: [[1, 1], [50, 1], [50, 50]], venta: true, siempre: true, label: 'VIP' }])); ok(r.n === 1, 'la base acepta un área libre con «venta» y «siempre»');
r = await llama(U.owner, base([{ id: 'v1', k: 'poly', pts: [[1, 1], [50, 1], [50, 50]], venta: 'si' }])); ok(/mapa_invalido/.test(r.err || ''), 'y rechaza «venta» que no sea sí/no');
r = await llama(U.owner, base([bueno], { siempre: true })); ok(r.n === 1, 'la base acepta «siempre»: true');
r = await llama(U.owner, base([bueno], { siempre: 'si' })); ok(/mapa_invalido/.test(r.err || ''), 'y rechaza «siempre» que no sea sí/no');
r = await llama(U.owner, { ...base([bueno]), maps: [{ id: 'sala', label: 'x' }] }); ok(r.n === 1, 'un plano sin figuras (formato anterior) sigue valiendo');
await db.exec('reset role'); const [intacto] = await q(`select layout -> 'maps' -> 0 ->> 'id' as id from venue_rooms where id = $1`, [room.id]);
ok(intacto.id === 'sala', 'tras los rechazos, lo guardado sigue igual');

console.log(`\n${fallidas ? '❌' : '✅'} ${pasadas} pasaron, ${fallidas} fallaron`);
process.exit(fallidas ? 1 : 0);
