// Prueba de supabase/scripts/20261003_mesas_armar_grupo.sql («Armar grupo»: mover mesas del evento + vender/apartar varias de golpe) en un Postgres
// REAL embebido (PGlite), con el esquema, roles y permisos del local copiados de la prueba de inventario. Sin tocar producción.
// Uso:   npm i --no-save @electric-sql/pglite
//        PGLITE_FROM=/ruta/donde/instalaste/package.json node supabase/tests/mesas_armar_grupo.test.mjs
// Prueba de ÁREAS DE UN EVENTO (supabase/scripts/20261004_evento_areas.sql): Mojitos no es un bloque (sala principal, VIP, terraza); casi siempre se venden juntas y en una
// ocasión especial se cierra una. Postgres REAL embebido (PGlite) con el esquema, roles y permisos del local. Sin tocar producción.
// Uso:   npm i --no-save @electric-sql/pglite
//        PGLITE_FROM=/ruta/donde/instalaste/package.json node supabase/tests/evento_areas.test.mjs
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
const AREAS = readFileSync(join(here, '..', 'scripts', '20261004_evento_areas.sql'), 'utf8');

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



console.log('\n▶ Aplicando el inventario, «armar grupo», figuras y áreas…');
await db.exec(MIGRACION); await db.exec(GRUPO); await db.exec(FORMAS);
await db.exec(AREAS); console.log('  ✔ corre sin errores');
await db.exec(AREAS); console.log('  ✔ y vuelve a correr (idempotente)');
await db.exec(MIGRACION); console.log('  ✔ y volver a correr el script de inventario (que trae la misma versión) no rompe nada');
ok((await su(`select count(*)::int n from pg_proc where proname = 'venue_event_open_tables'`))[0].n === 1, 'queda UNA sola función venue_event_open_tables (sin la sobrecarga ambigua)');

// Mojitos: sala principal (M1..M4), VIP (V1, V2) y terraza (T1, T2); una sola sala con tres planos
const plano = (id, label, ids, x0) => ({ id, label, focal: { x: 400, y: 52 }, fixed: [], zones: [{ name: 'Mesas', maxD: 9999, price: 0 }], shapes: [], tables: ids.map((k, i) => ({ id: k, t: 'round', x: x0 + i * 90, y: 300, seats: 4 })) });
const meta = (k, price) => ({ key: k, label: k, seats: 4, zone: 'Zona', price_cents: price });
const LAYOUT = { maps: [plano('sala', 'Sala principal', ['M1', 'M2', 'M3', 'M4'], 100), plano('vip', 'VIP', ['V1', 'V2'], 150), plano('terraza', 'Terraza', ['T1', 'T2'], 200)],
  tables: [meta('M1', 10000), meta('M2', 10000), meta('M3', 10000), meta('M4', 10000), meta('V1', 30000), meta('V2', 30000), meta('T1', 8000), meta('T2', 8000)] };
const [mojitos] = await su(`insert into venue_rooms (venue_id, slug, name, layout) values ($1, 'mojitos', 'Mojitos', $2::jsonb) returning id`, [venue.id, JSON.stringify(LAYOUT)]);
const nuevoEvento = async (t) => (await su(`insert into venue_events (room_id, title, event_date, status) values ($1, $2, current_date + 6, 'announced') returning id`, [mojitos.id, t]))[0].id;
const abrir = async (ev, maps) => { try { return { n: (await db.query(`select public.venue_event_open_tables($1, $2::text[]) n`, [ev, maps])).rows[0].n }; } catch (e) { return { err: String(e.message) }; } };
const claves = async (ev) => (await su(`select table_key from venue_event_tables where event_id = $1 order by table_key`, [ev])).map((x) => x.table_key).join(',');
const mapasDe = async (ev) => (await su(`select string_agg(m ->> 'id', ',' order by m ->> 'id') ids from venue_events e, jsonb_array_elements(e.layout -> 'maps') m where e.id = $1`, [ev]))[0].ids;

console.log('\n▶ Lo habitual: se venden todas las áreas juntas');
const evTodo = await nuevoEvento('Sábado normal');
await como('authenticated', U.owner);
let r = await abrir(evTodo, null); ok(r.n === 8, 'sin elegir áreas (null) se abren las 8 mesas de los tres planos');
await como(null); ok((await claves(evTodo)) === 'M1,M2,M3,M4,T1,T2,V1,V2' && (await mapasDe(evTodo)) === 'sala,terraza,vip', 'el evento tiene los tres planos');
await como('authenticated', U.owner);
r = await db.query(`select public.venue_event_open_tables($1) n`, [(await nuevoEvento('Llamada antigua'))]); ok(r.rows[0].n === 8, 'llamar con un solo argumento (como la pantalla antigua) sigue funcionando');

console.log('\n▶ Ocasión especial: se cierra un área (el VIP, separado por una pared)');
const evSinVip = await nuevoEvento('Sábado con el VIP cerrado');
r = await abrir(evSinVip, ['sala', 'terraza']); ok(r.n === 6, 'se abren solo sala y terraza: 6 mesas');
await como(null); ok((await claves(evSinVip)) === 'M1,M2,M3,M4,T1,T2' && (await mapasDe(evSinVip)) === 'sala,terraza', 'el VIP no existe en ese evento (ni sus mesas ni su plano)');
const [pub] = await su(`select count(*)::int n from public.venue_event_tables_public($1)`, [evSinVip]); ok(pub.n === 6, 'lo que ve el público: 6 mesas, ninguna del VIP');
await como('authenticated', U.owner);
const evSoloVip = await nuevoEvento('Evento privado en el VIP');
r = await abrir(evSoloVip, ['vip']); ok(r.n === 2, 'un evento solo del VIP abre únicamente sus 2 mesas');
await como(null); ok((await claves(evSoloVip)) === 'V1,V2', 'y nada más');
const dos = await (async () => { await como('authenticated', U.owner); return abrir(await nuevoEvento('Dos áreas'), ['terraza', 'vip']); })(); ok(dos.n === 4, 'se pueden elegir dos áreas cualesquiera (terraza + VIP: 4 mesas)');

console.log('\n▶ Cambiar las áreas después de abrir la venta');
await como('authenticated', U.owner);
r = await abrir(evTodo, ['sala', 'terraza']); await como(null);
ok(r.n === 0 && (await claves(evTodo)) === 'M1,M2,M3,M4,T1,T2' && (await mapasDe(evTodo)) === 'sala,terraza', 'cerrar el VIP en un evento ya abierto y sin ventas: se quitan sus mesas libres y su plano');
await como('authenticated', U.owner);
r = await abrir(evTodo, ['sala', 'terraza', 'vip']); await como(null);
ok(r.n === 2 && (await claves(evTodo)) === 'M1,M2,M3,M4,T1,T2,V1,V2' && (await mapasDe(evTodo)) === 'sala,terraza,vip', 'volver a abrir el VIP: regresan sus mesas y su plano (se copian de la sala)');
// las mesas vendidas protegen su área
await su(`update venue_event_tables set status = 'sold', sold_via = 'manager', buyer_name = 'Carla' where event_id = $1 and table_key = 'V1'`, [evTodo]);
await como('authenticated', U.owner);
r = await abrir(evTodo, ['sala', 'terraza']); ok(/area_con_ventas/.test(r.err || ''), 'cerrar el VIP con una mesa VENDIDA se rechaza (area_con_ventas)');
await como(null); ok((await claves(evTodo)) === 'M1,M2,M3,M4,T1,T2,V1,V2' && (await mapasDe(evTodo)) === 'sala,terraza,vip', 'y no se tocó nada (todo o nada)');
await su(`update venue_event_tables set status = 'available', sold_via = null, buyer_name = null where event_id = $1 and table_key = 'V1'`, [evTodo]);
await su(`update venue_event_tables set status = 'reserved', buyer_name = 'Bob' where event_id = $1 and table_key = 'V2'`, [evTodo]);
await como('authenticated', U.owner); r = await abrir(evTodo, ['sala', 'terraza']); ok(/area_con_ventas/.test(r.err || ''), 'tampoco con una mesa apartada');
await su(`update venue_event_tables set status = 'held', held_until = now() + interval '10 minutes', hold_token = gen_random_uuid(), buyer_name = null where event_id = $1 and table_key = 'V2'`, [evTodo]);
await como('authenticated', U.owner); r = await abrir(evTodo, ['sala', 'terraza']); ok(/area_con_ventas/.test(r.err || ''), 'ni con un cliente pagando en ese momento');
await su(`update venue_event_tables set status = 'held', held_until = now() - interval '1 minute' where event_id = $1 and table_key = 'V2'`, [evTodo]);
await como('authenticated', U.owner); r = await abrir(evTodo, ['sala', 'terraza']); ok(r.n === 0, 'una espera vencida cuenta como libre: ahí sí se puede cerrar');
await como(null); ok((await claves(evTodo)) === 'M1,M2,M3,M4,T1,T2', 'quedó cerrado el VIP');

console.log('\n▶ Lo que se movió con «Armar grupo» se conserva');
await como('authenticated', U.team);
await db.query(`select public.venue_event_move_tables($1, $2::jsonb)`, [evTodo, JSON.stringify([{ key: 'M1', x: 410, y: 400 }])]);
await como('authenticated', U.owner); await abrir(evTodo, ['sala', 'vip']); await como(null);
const [mov] = await su(`select (t ->> 'x')::int x, (t ->> 'y')::int y from venue_events e, jsonb_array_elements(e.layout -> 'maps' -> 0 -> 'tables') t where e.id = $1 and t ->> 'id' = 'M1'`, [evTodo]);
ok(mov.x === 410 && mov.y === 400, 'cambiar de áreas no deshace las mesas que ya se movieron del área que se queda');
ok((await claves(evTodo)) === 'M1,M2,M3,M4,V1,V2' && (await mapasDe(evTodo)) === 'sala,vip', 'y se cambió terraza por VIP (la terraza no tenía ventas)');

console.log('\n▶ La terraza es pública y siempre está abierta (plano marcado «siempre»)');
const LAYOUT2 = { maps: [plano('sala', 'Sala principal', ['M1', 'M2', 'M3', 'M4'], 100), plano('vip', 'VIP', ['V1', 'V2'], 150), { ...plano('terraza', 'Terraza', ['T1', 'T2'], 200), siempre: true }], tables: LAYOUT.tables };
const [mojitos2] = await su(`insert into venue_rooms (venue_id, slug, name, layout) values ($1, 'mojitos-2', 'Mojitos 2', $2::jsonb) returning id`, [venue.id, JSON.stringify(LAYOUT2)]);
const nuevoEv2 = async (t) => (await su(`insert into venue_events (room_id, title, event_date, status) values ($1, $2, current_date + 8, 'announced') returning id`, [mojitos2.id, t]))[0].id;
await como('authenticated', U.owner);
const e1 = await nuevoEv2('VIP separado'); r = await abrir(e1, ['sala']); await como(null);
ok(r.n === 6 && (await claves(e1)) === 'M1,M2,M3,M4,T1,T2' && (await mapasDe(e1)) === 'sala,terraza', 'se elige solo la sala principal: la terraza entra igual (siempre abierta); el VIP no');
await como('authenticated', U.owner);
const e2 = await nuevoEv2('Solo VIP'); r = await abrir(e2, ['vip']); await como(null);
ok((await claves(e2)) === 'T1,T2,V1,V2' && (await mapasDe(e2)) === 'terraza,vip', 'un evento solo del VIP también lleva la terraza');
await como('authenticated', U.owner);
r = await abrir(e1, ['sala', 'terraza', 'vip']); await como(null);
ok((await claves(e1)) === 'M1,M2,M3,M4,T1,T2,V1,V2', 'abrir todas las áreas sigue funcionando');
await su(`update venue_event_tables set status = 'sold', sold_via = 'manager', buyer_name = 'Dani' where event_id = $1 and table_key = 'T1'`, [e1]);
await como('authenticated', U.owner);
r = await abrir(e1, ['sala', 'vip']); await como(null);
ok(r.n === 0 && (await claves(e1)) === 'M1,M2,M3,M4,T1,T2,V1,V2', 'intentar cerrar la terraza no la cierra, aunque tenga una venta (no hay forma de quitarla)');

console.log('\n▶ Áreas DIBUJADAS en un solo plano (como Mojitos: salón, VIP, terraza siempre abierta, mesas fuera de área)');
const tab = (k, x, y, area) => ({ id: k, t: 'round', x, y, seats: 4, ...(area ? { area } : {}) });
const planoUnico = { id: 'mojitos', label: 'Mojitos', focal: { x: 400, y: 52 }, fixed: [], zones: [{ name: 'Mesas', maxD: 9999, price: 0 }], shapes: [],
  tables: [tab('S1', 100, 100), tab('S2', 200, 100), tab('V1', 100, 300), tab('V2', 200, 300), tab('T1', 100, 450), tab('T2', 200, 450), tab('F1', 700, 250)] };
const metaA = (k, area, price) => ({ key: k, label: k, seats: 4, zone: 'Z', price_cents: price, ...(area ? { area } : {}) });
const LAYOUT3 = { maps: [planoUnico], areas: [{ id: 'salon', label: 'Salón principal' }, { id: 'vip', label: 'VIP' }, { id: 'terraza', label: 'Terraza', siempre: true }],
  tables: [metaA('S1', 'salon', 10000), metaA('S2', 'salon', 10000), metaA('V1', 'vip', 30000), metaA('V2', 'vip', 30000), metaA('T1', 'terraza', 8000), metaA('T2', 'terraza', 8000), metaA('F1', null, 5000)] };
const [mojitos3] = await su(`insert into venue_rooms (venue_id, slug, name, layout) values ($1, 'mojitos-3', 'Mojitos 3', $2::jsonb) returning id`, [venue.id, JSON.stringify(LAYOUT3)]);
const nuevoEv3 = async (t) => (await su(`insert into venue_events (room_id, title, event_date, status) values ($1, $2, current_date + 10, 'announced') returning id`, [mojitos3.id, t]))[0].id;
const geoDe = async (ev) => (await su(`select string_agg(t ->> 'id', ',' order by t ->> 'id') ids from venue_events e, jsonb_array_elements(e.layout -> 'maps' -> 0 -> 'tables') t where e.id = $1`, [ev]))[0].ids;
await como('authenticated', U.owner);
const a1 = await nuevoEv3('Normal'); r = await abrir(a1, null); await como(null);
ok(r.n === 7 && (await claves(a1)) === 'F1,S1,S2,T1,T2,V1,V2', 'sin elegir áreas se venden las 7 mesas (también la que está fuera de toda área)');
await como('authenticated', U.owner);
const a2 = await nuevoEv3('VIP cerrado'); r = await abrir(a2, ['salon']); await como(null);
ok(r.n === 5 && (await claves(a2)) === 'F1,S1,S2,T1,T2', 'solo el salón: el VIP se cierra; la terraza (siempre) y la mesa fuera de área se quedan');
ok((await geoDe(a2)) === 'F1,S1,S2,T1,T2', 'y el dibujo del evento tampoco trae las mesas del VIP (el contorno del VIP sigue dibujado)');
await como('authenticated', U.owner);
const a3 = await nuevoEv3('Solo VIP'); r = await abrir(a3, ['vip']); await como(null);
ok((await claves(a3)) === 'F1,T1,T2,V1,V2', 'un evento solo del VIP: sus mesas + la terraza + la mesa fuera de área; sin el salón');
await como('authenticated', U.owner);
r = await abrir(a2, ['salon', 'vip']); await como(null);
ok(r.n === 2 && (await claves(a2)) === 'F1,S1,S2,T1,T2,V1,V2' && (await geoDe(a2)) === 'F1,S1,S2,T1,T2,V1,V2', 'volver a abrir el VIP: regresan sus mesas y su lugar en el dibujo (de la sala)');
await su(`update venue_event_tables set status = 'sold', sold_via = 'manager', buyer_name = 'Carla' where event_id = $1 and table_key = 'V1'`, [a2]);
await como('authenticated', U.owner); r = await abrir(a2, ['salon']); ok(/area_con_ventas/.test(r.err || ''), 'cerrar el VIP con una mesa vendida se rechaza');
await su(`update venue_event_tables set status = 'available', sold_via = null, buyer_name = null where event_id = $1 and table_key = 'V1'`, [a2]);
await como('authenticated', U.owner); r = await abrir(a2, ['salon']); await como(null);
ok(r.n === 0 && (await claves(a2)) === 'F1,S1,S2,T1,T2', 'sin ventas se cierra bien');
await como('authenticated', U.team);
await db.query(`select public.venue_event_move_tables($1, $2::jsonb)`, [a2, JSON.stringify([{ key: 'S1', x: 410, y: 130 }])]);
await como('authenticated', U.owner); await abrir(a2, ['salon', 'vip']); await como(null);
const [mov3] = await su(`select (t ->> 'x')::int x from venue_events e, jsonb_array_elements(e.layout -> 'maps' -> 0 -> 'tables') t where e.id = $1 and t ->> 'id' = 'S1'`, [a2]);
ok(mov3.x === 410, 'las mesas movidas con «Armar grupo» conservan su lugar al cambiar de áreas');
await como('authenticated', U.owner);
r = await abrir(a2, ['salon', 'cocina']); ok(/areas_invalidas/.test(r.err || ''), 'un área que no está en el catálogo (la cocina no es de venta) se rechaza');
r = await abrir(a2, ['terraza']); ok(r.n === 0, 'elegir solo la terraza (siempre abierta) deja solo la terraza y la mesa fuera de área');
await como(null); ok((await claves(a2)) === 'F1,T1,T2', 'y el evento queda con esas 3 mesas');

console.log('\n▶ Validación y permisos');
const evV = await nuevoEvento('Validación'); await como('authenticated', U.owner);
for (const [n, mp] of [['un área que no existe', ['sala', 'azotea']], ['lista vacía', []], ['áreas repetidas', ['sala', 'sala']], ['más de 12', Array.from({ length: 13 }, (_, i) => 'a' + i)], ['un nulo en la lista', ['sala', null]]]) {
  r = await abrir(evV, mp); ok(/areas_invalidas/.test(r.err || ''), `rechaza: ${n}`);
}
await como(null); ok((await claves(evV)) === '', 'después de los rechazos el evento no abrió nada');
await como('authenticated', U.team); r = await abrir(evV, ['sala']); ok(/no_autorizado/.test(r.err || ''), 'el equipo no puede abrir ni cambiar áreas');
await como('authenticated', U.manager); r = await abrir(evV, ['sala']); ok(r.n === 4, 'el manager sí');
await como('authenticated', U.admin); r = await abrir(evV, ['sala', 'terraza']); ok(r.n === 2, 'el admin de la plataforma sí');
await como('authenticated', U.ajeno); r = await abrir(evV, ['sala']); ok(/no_autorizado/.test(r.err || ''), 'el dueño de OTRO local no');
await como('anon', ''); r = await abrir(evV, ['sala']); ok(/permission denied/.test(r.err || ''), 'sin sesión: permiso denegado');
await como(null);
await su(`update venue_rooms set layout = $2::jsonb where id = $1`, [mojitos.id, JSON.stringify({ tables: LAYOUT.tables })]);
const evSinMapas = await nuevoEvento('Sala sin planos'); await como('authenticated', U.owner);
r = await abrir(evSinMapas, ['sala']); ok(/areas_invalidas/.test(r.err || ''), 'una sala sin planos dibujados no admite elegir áreas');
r = await abrir(evSinMapas, null); ok(r.n === 8, 'pero sin elegir áreas abre normal (sala solo con mesas)');

console.log(`\n${fallidas ? '❌' : '✅'} ${pasadas} pasaron, ${fallidas} fallaron`);
process.exit(fallidas ? 1 : 0);
