// Prueba de supabase/scripts/20261003_mesas_armar_grupo.sql («Armar grupo»: mover mesas del evento + vender/apartar varias de golpe) en un Postgres
// REAL embebido (PGlite), con el esquema, roles y permisos del local copiados de la prueba de inventario. Sin tocar producción.
// Uso:   npm i --no-save @electric-sql/pglite
//        PGLITE_FROM=/ruta/donde/instalaste/package.json node supabase/tests/mesas_armar_grupo.test.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require_ = createRequire(process.env.PGLITE_FROM || import.meta.url);
const { PGlite } = require_('@electric-sql/pglite');
const here = dirname(fileURLToPath(import.meta.url));
const MIGRACION = readFileSync(join(here, '..', 'scripts', '20261003_sala_mesas_inventario_por_evento.sql'), 'utf8');
const GRUPO = readFileSync(join(here, '..', 'scripts', '20261003_mesas_armar_grupo.sql'), 'utf8');
const FORMAS = readFileSync(join(here, '..', 'scripts', '20261004_plano_formas.sql'), 'utf8');

process.on('unhandledRejection', (e) => { console.error('\n❌ Error inesperado:', e && e.message ? e.message : e); process.exit(2); });
const db = new PGlite();
const U = { owner: '00000000-0000-0000-0000-0000000000a1', manager: '00000000-0000-0000-0000-0000000000a2', team: '00000000-0000-0000-0000-0000000000a3',
            otro: '00000000-0000-0000-0000-0000000000b1', admin: '00000000-0000-0000-0000-0000000000c1', ajeno: '00000000-0000-0000-0000-0000000000d1' };
let pasadas = 0, fallidas = 0;
const ok = (c, m) => { if (c) { pasadas++; console.log('  ✔', m); } else { fallidas++; console.log('  ✘ FALLA:', m); } };
async function como(role, uid) { await db.exec('reset role'); if (role) await db.exec(`set role ${role}`); await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid || '']); }
async function q(sql, params) { return (await db.query(sql, params)).rows; }
async function su(sql, params) { await db.exec('reset role'); return (await db.query(sql, params)).rows; }   // verificación fuera de RLS
async function falla(sql, params, fragmento) { try { await db.query(sql, params); return false; } catch (e) { return fragmento ? String(e.message).includes(fragmento) : true; } }

// ───────── Esquema mínimo + funciones de permisos (copia de producción) ─────────
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create table dj_profiles (user_id uuid, role text);
  create table venues (id uuid primary key default gen_random_uuid(), slug text, name text);
  create table venue_rooms (id uuid primary key default gen_random_uuid(), venue_id uuid not null references venues(id), slug text, name text,
                            layout jsonb not null default '{}'::jsonb, layout_mode text not null default 'tickets', updated_at timestamptz not null default now());
  create table venue_events (id uuid primary key default gen_random_uuid(), room_id uuid references venue_rooms(id), title text not null, event_date date,
                             status text not null check (status in ('waitlist','announced','sold_out','completed','cancelled')),
                             created_at timestamptz not null default now(), updated_at timestamptz not null default now());
  create table venue_staff (venue_id uuid not null, user_id uuid not null, role text not null check (role in ('owner','manager','team')), primary key (venue_id, user_id));
  create table venue_ticket_orders (id uuid primary key default gen_random_uuid(), event_id uuid, stripe_session_id text unique, items jsonb not null default '[]'::jsonb,
                                    customer_name text, status text not null default 'paid_pending_fulfillment', total_cents integer not null default 0);
  create function public.is_platform_admin(p_uid uuid) returns boolean language sql stable security definer set search_path to 'public'
    as $$ select exists (select 1 from public.dj_profiles d where d.user_id = p_uid and lower(trim(coalesce(d.role, ''))) in ('admin', 'owner')) $$;
  create function public.venue_role(p_venue_id uuid) returns text language sql stable security definer set search_path to 'public'
    as $$ select role from public.venue_staff where venue_id = p_venue_id and user_id = auth.uid() $$;
  create function public.can_sell_venue(p_venue_id uuid) returns boolean language sql stable security definer set search_path to 'public'
    as $$ select coalesce(public.venue_role(p_venue_id) in ('owner', 'manager', 'team'), false) $$;
  create function public.can_manage_venue_layout(p_venue_id uuid) returns boolean language sql stable security definer set search_path to 'public'
    as $$ select coalesce(public.venue_role(p_venue_id) in ('owner', 'manager'), false) $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant all on all tables in schema public to service_role;                          -- como en Supabase: service_role tiene todo
  alter default privileges in schema public grant all on tables to service_role;     -- …y en las tablas nuevas
  grant execute on all functions in schema public to authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`);

// ───────── Datos de prueba ─────────
const [venue] = await q(`insert into venues (slug, name) values ('mojitos-calle-8', 'Mojitos Calle 8') returning id`);
const [otroLocal] = await q(`insert into venues (slug, name) values ('otro-local', 'Otro Local') returning id`);
const [room] = await q(`insert into venue_rooms (venue_id, slug, name) values ($1, 'sala-principal', 'Sala Principal') returning id`, [venue.id]);
const [roomOtro] = await q(`insert into venue_rooms (venue_id, slug, name) values ($1, 'sala', 'Sala') returning id`, [otroLocal.id]);
await db.query(`insert into venue_staff values ($1,$2,'owner'),($1,$3,'manager'),($1,$4,'team'),($5,$6,'owner')`, [venue.id, U.owner, U.manager, U.team, otroLocal.id, U.ajeno]);
await db.query(`insert into dj_profiles values ($1, 'admin')`, [U.admin]);
const [evMie] = await q(`insert into venue_events (room_id, title, event_date, status) values ($1, 'Noche de Salsa', current_date + 4, 'announced') returning id`, [room.id]);
const [evJue] = await q(`insert into venue_events (room_id, title, event_date, status) values ($1, 'One Hit Wonder', current_date + 5, 'announced') returning id`, [room.id]);
const [evPasado] = await q(`insert into venue_events (room_id, title, event_date, status) values ($1, 'Pasado', current_date - 3, 'announced') returning id`, [room.id]);
const [evEspera] = await q(`insert into venue_events (room_id, title, event_date, status) values ($1, 'Sin fecha', null, 'waitlist') returning id`, [room.id]);
const MAPA = { maps: [{ id: 'sala' }], tables: [
  { key: 'M1', label: 'M1', seats: 4, zone: 'Zona 1', price_cents: 40000 }, { key: 'M2', seats: 4, zone: 'Zona 1', price_cents: 40000 },
  { key: 'M3', label: 'M3', seats: 8, zone: 'Zona 2', price_cents: 25000 }, { key: 'M4', label: 'M4', seats: 6, zone: 'Zona 3', price_cents: 15000 } ] };


console.log('\n▶ Aplicando el inventario y el SQL de «armar grupo»…');
await db.exec(MIGRACION);
await db.exec(GRUPO); console.log('  ✔ corre sin errores');
await db.exec(GRUPO); console.log('  ✔ y vuelve a correr (idempotente)');
await db.exec(FORMAS); console.log('  ✔ y el de figuras del editor de planos encima (amplía venue_plano_bloquea)');

// Plano con geometría (escenario, baños, barra, pista) y 6 mesas; la plantilla de la sala lleva el mismo.
const PLANO = { maps: [{ id: 'sala', label: 'Sala', focal: { x: 400, y: 52, rect: [280, 24, 240, 56], label: 'ESCENARIO / DJ' },
  fixed: [{ r: [20, 24, 90, 56], l: 'BAÑOS', k: 'bano' }, { r: [345, 255, 110, 110], l: 'PISTA' }, { r: [722, 100, 58, 390], l: 'BARRA', k: 'barra' }],
  zones: [{ name: 'Mesas', maxD: 9999, price: 100 }],
  tables: [1, 2, 3, 4, 5, 6].map((n) => ({ id: 'M' + n, t: 'round', x: 100 + n * 60, y: 200, seats: 4 })) }],
  tables: [1, 2, 3, 4, 5, 6].map((n) => ({ key: 'M' + n, label: 'M' + n, seats: 4, zone: 'Zona 1', price_cents: 10000 })) };
await su(`update venue_rooms set layout = $2::jsonb where id = $1`, [room.id, JSON.stringify(PLANO)]);
await como('authenticated', U.owner);
await db.query(`select public.venue_event_open_tables($1)`, [evMie.id]);   // miércoles: abre con el plano
await db.query(`select public.venue_event_open_tables($1)`, [evJue.id]);   // jueves: abre con el MISMO plano (su propia copia)
await como(null);
const posicion = async (ev, key) => (await su(`select (t ->> 'x')::int x, (t ->> 'y')::int y from venue_events e, jsonb_array_elements(e.layout -> 'maps' -> 0 -> 'tables') t where e.id = $1 and t ->> 'id' = $2`, [ev, key]))[0];
const mover = async (ev, moves) => { try { return { n: (await db.query(`select public.venue_event_move_tables($1, $2::jsonb) n`, [ev, JSON.stringify(moves)])).rows[0].n }; } catch (e) { return { err: String(e.message) }; } };

console.log('\n▶ Mover mesas en el plano de UN evento');
await como('authenticated', U.team);
let r = await mover(evMie.id, [{ key: 'M1', x: 300, y: 400 }, { key: 'M2', x: 360, y: 400 }]);
ok(r.n === 2, 'el EQUIPO (vendedor) puede mover mesas: 2 movidas');
let p1 = await posicion(evMie.id, 'M1'); ok(p1.x === 300 && p1.y === 400, 'la mesa M1 quedó en el sitio nuevo (300,400)');
const pOtro = await posicion(evJue.id, 'M1'); ok(pOtro.x === 160 && pOtro.y === 200, 'el JUEVES conserva su disposición: cada evento tiene su propio plano');
const [pl] = await su(`select layout -> 'maps' -> 0 -> 'tables' -> 0 ->> 'x' as x from venue_rooms where id = $1`, [room.id]);
ok(pl.x === '160', 'la plantilla de la SALA no cambia al mover mesas de un evento');
const [intacto] = await su(`select (layout -> 'maps' -> 0 -> 'fixed') = $2::jsonb as igual, (layout -> 'maps' -> 0 -> 'focal') = $3::jsonb as igual2 from venue_events where id = $1`, [evMie.id, JSON.stringify(PLANO.maps[0].fixed), JSON.stringify(PLANO.maps[0].focal)]);
ok(intacto.igual && intacto.igual2, 'la arquitectura (escenario, baños, barra, pista) queda exactamente igual');
await como('authenticated', U.manager); r = await mover(evMie.id, [{ key: 'M3', x: 420, y: 400 }]); ok(r.n === 1, 'el manager también');
await como('authenticated', U.owner);   r = await mover(evMie.id, [{ key: 'M4', x: 480, y: 400 }]); ok(r.n === 1, 'el dueño también');
await como('authenticated', U.admin);   r = await mover(evMie.id, [{ key: 'M5', x: 540, y: 400 }]); ok(r.n === 1, 'el admin de la plataforma también');
await como('authenticated', U.ajeno);   r = await mover(evMie.id, [{ key: 'M6', x: 10, y: 10 }]); ok(/no_autorizado/.test(r.err || ''), 'el dueño de OTRO local no puede');
await como('anon', '');                 r = await mover(evMie.id, [{ key: 'M6', x: 10, y: 10 }]); ok(/permission denied/.test(r.err || ''), 'sin sesión: permiso denegado');

console.log('\n▶ La arquitectura no se toca y las mesas ocupadas no se mueven');
await como('authenticated', U.team);
for (const [nombre, x, y] of [['encima del escenario', 400, 50], ['pegada al escenario (margen)', 300, 90], ['encima de los baños', 60, 50], ['encima de la barra', 750, 300]]) {
  r = await mover(evMie.id, [{ key: 'M6', x, y }]); ok(/mesa_sobre_estructura/.test(r.err || ''), `rechaza una mesa ${nombre}`);
}
r = await mover(evMie.id, [{ key: 'M6', x: 400, y: 300 }]); ok(r.n === 1, 'la PISTA no es estructura: ahí sí se puede poner una mesa');
r = await mover(evMie.id, [{ key: 'M6', x: 400, y: 150 }]); ok(r.n === 1, 'justo fuera del margen del escenario sí se puede');
await su(`update venue_event_tables set status = 'sold', sold_via = 'manager', buyer_name = 'Alicia' where event_id = $1 and table_key = 'M1'`, [evMie.id]);
await su(`update venue_event_tables set status = 'held', held_until = now() + interval '10 minutes', hold_token = gen_random_uuid() where event_id = $1 and table_key = 'M2'`, [evMie.id]);
await su(`update venue_event_tables set status = 'held', held_until = now() - interval '1 minute', hold_token = gen_random_uuid() where event_id = $1 and table_key = 'M3'`, [evMie.id]);
await su(`update venue_event_tables set status = 'reserved', buyer_name = 'Bob' where event_id = $1 and table_key = 'M4'`, [evMie.id]);
await como('authenticated', U.team);
r = await mover(evMie.id, [{ key: 'M1', x: 200, y: 300 }]); ok(/mesa_no_se_puede_mover/.test(r.err || ''), 'una mesa VENDIDA no se mueve');
r = await mover(evMie.id, [{ key: 'M2', x: 200, y: 300 }]); ok(/mesa_no_se_puede_mover/.test(r.err || ''), 'una mesa con alguien PAGANDO no se mueve');
r = await mover(evMie.id, [{ key: 'M3', x: 200, y: 300 }]); ok(r.n === 1, 'la espera VENCIDA cuenta como libre: sí se mueve');
r = await mover(evMie.id, [{ key: 'M4', x: 200, y: 340 }]); ok(r.n === 1, 'una mesa apartada (no vendida) sí se mueve');
const antes = await posicion(evMie.id, 'M5');
r = await mover(evMie.id, [{ key: 'M5', x: 500, y: 250 }, { key: 'M1', x: 1, y: 1 }]); ok(r.err && (await posicion(evMie.id, 'M5')).x === antes.x, 'TODO O NADA: si una de las mesas no se puede mover, ninguna se mueve');

console.log('\n▶ Validación del movimiento');
for (const [nombre, mv] of [['no es lista', { key: 'M5', x: 1, y: 1 }], ['lista vacía', []], ['fuera del plano (x)', [{ key: 'M5', x: 801, y: 100 }]], ['fuera del plano (y)', [{ key: 'M5', x: 100, y: -1 }]],
  ['sin clave', [{ x: 1, y: 1 }]], ['coordenada como texto', [{ key: 'M5', x: '100', y: 100 }]], ['clave repetida', [{ key: 'M5', x: 300, y: 300 }, { key: 'M5', x: 320, y: 300 }]],
  ['41 mesas', Array.from({ length: 41 }, (_, i) => ({ key: 'M' + i, x: 100, y: 100 }))]]) {
  r = await mover(evMie.id, mv); ok(/movimiento_invalido/.test(r.err || ''), `rechaza: ${nombre}`);
}
r = await mover(evMie.id, [{ key: 'ZZ', x: 100, y: 100 }]); ok(/mesa_no_existe/.test(r.err || ''), 'una mesa que no existe en el evento');
r = await mover('00000000-0000-0000-0000-00000000ffff', [{ key: 'M5', x: 1, y: 1 }]); ok(/evento_no_existe/.test(r.err || ''), 'evento inexistente');
await su(`update venue_events set layout = '{}'::jsonb where id = $1`, [evEspera.id]);
r = await mover(evEspera.id, [{ key: 'M5', x: 100, y: 100 }]); ok(/sin_plano/.test(r.err || ''), 'un evento sin plano → sin_plano');

console.log('\n▶ Vender / apartar / liberar varias mesas de golpe');
const sets = async (ev, keys, acc, nombre, nota) => { try { return { n: (await db.query(`select public.venue_staff_set_tables($1, $2::text[], $3, $4, $5) n`, [ev, keys, acc, nombre, nota || null])).rows[0].n }; } catch (e) { return { err: String(e.message) }; } };
const estados = async (ev) => Object.fromEntries((await su(`select table_key, status, buyer_name, reservation_name, sold_via from venue_event_tables where event_id = $1`, [ev])).map((x) => [x.table_key, x]));
await como('authenticated', U.team);
r = await sets(evJue.id, ['M1', 'M2', 'M3'], 'sell', 'Grupo de Carla', 'cumpleaños 20 personas');
let e = await estados(evJue.id);
ok(r.n === 3 && ['M1', 'M2', 'M3'].every((k) => e[k].status === 'sold' && e[k].buyer_name === 'Grupo de Carla' && e[k].sold_via === 'manager'), 'vende 3 mesas con un solo nombre (venta a mano)');
ok(e.M4.status === 'available', 'las demás mesas no se tocan');
r = await sets(evJue.id, ['M4', 'M1'], 'sell', 'Otro', null); e = await estados(evJue.id);
ok(/mesa_no_disponible/.test(r.err || '') && e.M4.status === 'available', 'TODO O NADA: si una ya está vendida, no se vende ninguna del grupo');
r = await sets(evJue.id, ['M4', 'M5'], 'sell', '  ', null); ok(/falta_nombre_de_quien_renta/.test(r.err || ''), 'vender exige el nombre de quien renta');
r = await sets(evJue.id, ['M4', 'M5'], 'reserve', 'Mesa de Dani', null); e = await estados(evJue.id);
ok(r.n === 2 && e.M4.status === 'reserved' && e.M5.status === 'reserved', 'apartar un grupo');
r = await sets(evJue.id, ['M4', 'M5'], 'release', null, null); e = await estados(evJue.id);
ok(r.n === 2 && e.M4.status === 'available' && e.M5.status === 'available', 'liberar un grupo');
r = await sets(evJue.id, ['M1', 'M2', 'M3'], 'release', null, null); e = await estados(evJue.id); ok(r.n === 3 && e.M1.status === 'available', 'liberar la venta a mano de un grupo');
r = await sets(evJue.id, [], 'sell', 'X', null); ok(/grupo_invalido/.test(r.err || ''), 'grupo vacío');
r = await sets(evJue.id, ['M1', 'M1'], 'sell', 'X', null); ok(/grupo_invalido/.test(r.err || ''), 'claves repetidas');
r = await sets(evJue.id, Array.from({ length: 41 }, (_, i) => 'M' + i), 'sell', 'X', null); ok(/grupo_invalido/.test(r.err || ''), 'más de 40 mesas');
r = await sets(evJue.id, ['M1', 'M2'], 'regalar', 'X', null); ok(/accion_invalida/.test(r.err || ''), 'acción desconocida');
await como('authenticated', U.ajeno); r = await sets(evJue.id, ['M1'], 'sell', 'X', null); ok(/no_autorizado/.test(r.err || ''), 'el dueño de OTRO local no puede vender');
await como('anon', ''); r = await sets(evJue.id, ['M1'], 'sell', 'X', null); ok(/permission denied/.test(r.err || ''), 'sin sesión: permiso denegado');

console.log('\n▶ Planos dibujados en el editor (figuras y tamaño propio)');
const PLANO2 = { maps: [{ id: 'sala', label: 'Sala grande', custom: true, room: { w: 1200, h: 800 }, focal: { x: 600, y: 60 }, fixed: [], zones: [{ name: 'Mesas', maxD: 9999, price: 0 }],
  shapes: [{ id: 'esc', k: 'stage', shape: 'rect', x: 600, y: 60, w: 300, h: 80 }, { id: 'par', k: 'wall', x1: 300, y1: 300, x2: 300, y2: 700, th: 8 }, { id: 'col', k: 'shape', sub: 'ellipse', x: 800, y: 400, w: 80, h: 80, bloquea: true },
    { id: 'dec', k: 'shape', sub: 'rect', x: 900, y: 600, w: 100, h: 100 }, { id: 'pis', k: 'zone', sub: 'pista', x: 600, y: 450, w: 200, h: 200 }],
  tables: [1, 2, 3].map((n) => ({ id: 'G' + n, t: 'round', x: 400 + n * 80, y: 200, seats: 4 })) }],
  tables: [1, 2, 3].map((n) => ({ key: 'G' + n, label: 'G' + n, seats: 4, zone: 'Mesas', price_cents: 10000 })) };
const [evGrande] = await su(`insert into venue_events (room_id, title, event_date, status) values ($1, 'Sala grande', current_date + 9, 'announced') returning id`, [room.id]);
await su(`update venue_rooms set layout = $2::jsonb where id = $1`, [room.id, JSON.stringify(PLANO2)]);
await como('authenticated', U.owner); await db.query(`select public.venue_event_open_tables($1)`, [evGrande.id]); await como('authenticated', U.team);
r = await mover(evGrande.id, [{ key: 'G1', x: 1100, y: 700 }]); ok(r.n === 1, 'un plano de 1200 × 800 admite mesas hasta su borde (1100, 700)');
r = await mover(evGrande.id, [{ key: 'G2', x: 1201, y: 700 }]); ok(/movimiento_invalido/.test(r.err || ''), 'pero no más allá de SU tamaño (x = 1201)');
r = await mover(evGrande.id, [{ key: 'G2', x: 1000, y: 801 }]); ok(/movimiento_invalido/.test(r.err || ''), 'ni más abajo (y = 801)');
r = await mover(evGrande.id, [{ key: 'G2', x: 600, y: 60 }]); ok(/mesa_sobre_estructura/.test(r.err || ''), 'el escenario dibujado en el editor también bloquea');
r = await mover(evGrande.id, [{ key: 'G2', x: 310, y: 500 }]); ok(/mesa_sobre_estructura/.test(r.err || ''), 'una pared dibujada bloquea (también por su grosor)');
r = await mover(evGrande.id, [{ key: 'G2', x: 800, y: 440 }]); ok(/mesa_sobre_estructura/.test(r.err || ''), 'una figura marcada «bloquea» bloquea (elipse)');
r = await mover(evGrande.id, [{ key: 'G2', x: 900, y: 600 }]); ok(r.n === 1, 'una figura sin «bloquea» no bloquea');
r = await mover(evGrande.id, [{ key: 'G3', x: 600, y: 450 }]); ok(r.n === 1, 'la pista dibujada no bloquea');
r = await mover(evGrande.id, [{ key: 'G3', x: 600, y: 110 }]); ok(/mesa_sobre_estructura/.test(r.err || ''), 'margen de 22 px alrededor del escenario dibujado');

console.log(`\n${fallidas ? '❌' : '✅'} ${pasadas} pasaron, ${fallidas} fallaron`);
process.exit(fallidas ? 1 : 0);
