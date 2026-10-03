// Prueba de supabase/scripts/20261003_sala_mesas_inventario_por_evento.sql en un Postgres REAL embebido (PGlite), sin tocar producción.
// Reproduce los roles de Supabase (anon / authenticated / service_role), auth.uid() y las funciones de permisos del local
// (venue_role / can_sell_venue / can_manage_venue_layout, copiadas tal cual de producción), carga el SQL y verifica:
// permisos por rol, anti-sobreventa (todo o nada), vencimiento de reservas, independencia entre eventos y lo que ve el público.
//
// Uso:   npm i --no-save @electric-sql/pglite     (una vez, en cualquier carpeta)
//        PGLITE_FROM=/ruta/donde/instalaste/package.json node supabase/tests/sala_mesas_inventario.test.mjs
// Limitación honesta: es UNA conexión; la carrera «dos compradores a la vez» se prueba en secuencia (el segundo ve lo que dejó el
// primero), que es exactamente el caso que el UPDATE atómico resuelve. Postgres serializa los UPDATE de la misma fila.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require_ = createRequire(process.env.PGLITE_FROM || import.meta.url);
const { PGlite } = require_('@electric-sql/pglite');
const here = dirname(fileURLToPath(import.meta.url));
const MIGRACION = readFileSync(join(here, '..', 'scripts', '20261003_sala_mesas_inventario_por_evento.sql'), 'utf8');

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

console.log('\n▶ Aplicando la migración…');
await db.exec(MIGRACION);
console.log('  ✔ la migración corre sin errores');
await db.exec(MIGRACION);
console.log('  ✔ y vuelve a correr (idempotente)');

console.log('\n▶ 1. Mapa de la sala y apertura de ventas: permisos por rol');
await como('authenticated', U.team);
ok(await falla(`select public.venue_room_set_layout($1, $2::jsonb)`, [room.id, JSON.stringify(MAPA)], 'no_autorizado'), 'EQUIPO no puede fijar el mapa de la sala');
await como('authenticated', U.ajeno);
ok(await falla(`select public.venue_room_set_layout($1, $2::jsonb)`, [room.id, JSON.stringify(MAPA)], 'no_autorizado'), 'el dueño de OTRO local no puede fijar este mapa');
await como('anon');
ok(await falla(`select public.venue_room_set_layout($1, $2::jsonb)`, [room.id, JSON.stringify(MAPA)], 'permission denied'), 'ANÓNIMO no puede ni llamar a fijar el mapa');
await como('authenticated', U.manager);
await db.query(`select public.venue_room_set_layout($1, $2::jsonb)`, [room.id, JSON.stringify(MAPA)]);
ok((await su(`select jsonb_array_length(layout->'tables') n from venue_rooms where id=$1`, [room.id]))[0].n === 4, 'MANAGER fija el mapa (4 mesas)');
await como('authenticated', U.team);
ok(await falla(`select public.venue_event_open_tables($1)`, [evMie.id], 'no_autorizado'), 'EQUIPO no puede abrir la venta de mesas');
await como('anon');
ok(await falla(`select public.venue_event_open_tables($1)`, [evMie.id], 'permission denied'), 'ANÓNIMO no puede abrir la venta de mesas');
await como('authenticated', U.owner);
ok((await q(`select public.venue_event_open_tables($1) n`, [evMie.id]))[0].n === 4, 'DUEÑO abre la venta del miércoles: 4 filas creadas');
ok((await q(`select public.venue_event_open_tables($1) n`, [evMie.id]))[0].n === 0, 'abrir otra vez no duplica (0 filas nuevas)');
await como('authenticated', U.admin);
ok((await q(`select public.venue_event_open_tables($1) n`, [evJue.id]))[0].n === 4, 'ADMIN de la plataforma abre la venta del jueves');
await como(null);
await db.query(`update venue_rooms set layout='{}' where id=$1`, [room.id]);
await como('authenticated', U.owner);
ok(await falla(`select public.venue_event_open_tables($1)`, [evEspera.id], 'sin_mapa'), 'sin mapa en la sala ni en el evento → «sin_mapa»');
await como(null);
await db.query(`update venue_rooms set layout=$2::jsonb where id=$1`, [room.id, JSON.stringify(MAPA)]);
await como('authenticated', U.owner);
ok(await falla(`select public.venue_room_set_layout($1, '[1]'::jsonb)`, [room.id], 'mapa_invalido'), 'un mapa que no es objeto se rechaza');
const dup = { tables: [{ key: 'A', seats: 4, price_cents: 100 }, { key: 'A', seats: 4, price_cents: 100 }] };
await como(null); await db.query(`update venue_events set layout=$2::jsonb where id=$1`, [evEspera.id, JSON.stringify(dup)]); await como('authenticated', U.owner);
ok(await falla(`select public.venue_event_open_tables($1)`, [evEspera.id], 'mapa_invalido'), 'llaves repetidas → «mapa_invalido»');

console.log('\n▶ 2. Lo que ve el público (sin sesión)');
await como('anon');
const pub = await q(`select * from public.venue_event_tables_public($1)`, [evMie.id]);
ok(pub.length === 4 && pub.every(r => r.available === true), 'anónimo ve las 4 mesas del miércoles, todas libres');
ok(!('buyer_name' in pub[0]) && !('status' in pub[0]) && !('hold_token' in pub[0]), 'sin nombres, estado interno ni tokens');
ok((await q(`select count(*) n from public.venue_event_tables_public($1)`, [evEspera.id]))[0].n === '0' || (await q(`select count(*) n from public.venue_event_tables_public($1)`, [evEspera.id]))[0].n === 0, 'evento sin venta abierta → no muestra nada');
ok(await falla(`select * from public.venue_event_tables`, [], 'permission denied'), 'anónimo NO puede leer la tabla de inventario directo');

console.log('\n▶ 3. Reserva temporal: solo service_role, todo o nada');
await como('anon');
ok(await falla(`select * from public.venue_event_hold_tables($1, array['M1'])`, [evMie.id], 'permission denied'), 'anónimo NO puede tomar reservas directo');
await como('authenticated', U.owner);
ok(await falla(`select * from public.venue_event_hold_tables($1, array['M1'])`, [evMie.id], 'permission denied'), 'ni siquiera el dueño: solo las Edge Functions');
await como('service_role');
const A = (await q(`select * from public.venue_event_hold_tables($1, array['M1','M2'])`, [evMie.id]))[0];
ok(A.total_cents === 80000 && A.keys.length === 2, 'comprador A toma M1+M2: total 800.00 desde la base');
const B = '11111111-1111-1111-1111-111111111111';
ok(await falla(`select * from public.venue_event_hold_tables($1, array['M2','M3'], $2)`, [evMie.id, B], 'mesa_no_disponible'), 'comprador B pide M2+M3: M2 ya está tomada → se rechaza');
await como(null);
ok((await q(`select status from venue_event_tables where event_id=$1 and table_key='M3'`, [evMie.id]))[0].status === 'available', 'TODO O NADA: M3 quedó libre (B no se llevó media orden)');
await como('service_role');
const B2 = (await q(`select * from public.venue_event_hold_tables($1, array['M3','M4'], $2)`, [evMie.id, B]))[0];
ok(B2.total_cents === 40000, 'B toma M3+M4 (libres): total 400.00');
ok(await falla(`select * from public.venue_event_hold_tables($1, array['M1'], $2)`, [evMie.id, B], 'mesa_no_disponible'), 'B no puede quedarse además con M1 (de A)');
await como('anon');
const pub2 = await q(`select table_key, available from public.venue_event_tables_public($1) order by 1`, [evMie.id]);
ok(pub2.every(r => r.available === false), 'el público ve las 4 como no disponibles mientras están en espera');
await como('service_role');
const A2 = (await q(`select * from public.venue_event_hold_tables($1, array['M1'], $2)`, [evMie.id, A.hold_token]))[0];
ok(A2.keys.length === 1, 'A cambia de idea y se queda solo con M1');
ok((await q(`select count(*) n from public.venue_event_hold_tables($1, array['M2'], gen_random_uuid())`, [evMie.id]))[0].n == 1, '…y M2 quedó libre para otra persona');
ok(await falla(`select * from public.venue_event_hold_tables($1, array[]::text[])`, [evMie.id], 'sin_mesas'), 'sin mesas → «sin_mesas»');
ok(await falla(`select * from public.venue_event_hold_tables($1, array['M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11','M12','M13'])`, [evMie.id], 'demasiadas_mesas'), 'más de 12 mesas por pedido → rechazado');
ok(await falla(`select * from public.venue_event_hold_tables($1, array['M1'])`, [evPasado.id], 'evento_sin_venta_de_mesas'), 'evento pasado / sin venta abierta → rechazado');

console.log('\n▶ 3b. Tope por IP (contra quien quiera acaparar la sala)');
await su(`update venue_event_tables set status='available', held_until=null, hold_token=null, hold_ip=null where event_id=$1 and status='held'`, [evMie.id]);
await como('service_role');
const IP = (await q(`select * from public.venue_event_hold_tables($1, array['M1','M2'], null, 35, '203.0.113.7')`, [evMie.id]))[0];
ok(IP.keys.length === 2, 'una IP aparta 2 mesas');
await su(`update venue_event_tables set hold_ip='203.0.113.7' where event_id=$1 and status='held'`, [evMie.id]);
await como('service_role');
await db.query(`select * from public.venue_event_hold_tables($1, array['M3'], gen_random_uuid(), 35, '198.51.100.9')`, [evMie.id]);
ok((await q(`select count(*) n from public.venue_event_hold_tables($1, array['M4'], gen_random_uuid(), 35, '198.51.100.9')`, [evMie.id]))[0].n == 1, 'otra IP aparta sin problema');
await su(`update venue_event_tables set status='available', held_until=null, hold_token=null, hold_ip=null where event_id=$1`, [evMie.id]);
await su(`update venue_event_tables set status='held', held_until=now()+interval '30 minutes', hold_token=gen_random_uuid(), hold_ip='203.0.113.7' where event_id=$1 and table_key in ('M1','M2','M3','M4')`, [evJue.id]);
await como('service_role');
const muchas = Array.from({ length: 10 }, (_, i) => 'Z' + i);
await su(`insert into venue_event_tables (event_id, table_key, label, price_cents) select $1, k, k, 100 from unnest($2::text[]) k`, [evMie.id, muchas]);
await como('service_role');
ok(await falla(`select * from public.venue_event_hold_tables($1, $2::text[], null, 35, '203.0.113.7')`, [evMie.id, muchas], 'demasiados_apartados'), 'la misma IP no pasa de 12 mesas apartadas (4 en otro evento + 10 = 14)');
ok((await q(`select count(*) n from public.venue_event_hold_tables($1, $2::text[], null, 35, '203.0.113.7')`, [evMie.id, muchas.slice(0, 8)]))[0].n == 1, '…pero 8 más (12 en total) sí');
await su(`delete from venue_event_tables where event_id=$1 and table_key like 'Z%'`, [evMie.id]);
await su(`update venue_event_tables set status='available', held_until=null, hold_token=null, hold_ip=null where status='held'`);
await como('service_role');
ok((await q(`select public.venue_event_release_tables(hold_token) n from public.venue_event_hold_tables($1, array['M1'], null, 35, '1.1.1.1')`, [evMie.id]))[0].n === 1 && (await su(`select count(*) n from venue_event_tables where hold_ip is not null`))[0].n == 0, 'al liberar se borra la IP guardada');

console.log('\n▶ 4. Vencimiento: una espera vencida se puede tomar');
await como(null);
await db.query(`update venue_event_tables set held_until = now() - interval '1 minute' where event_id=$1 and hold_token=$2`, [evMie.id, A.hold_token]);
await como('anon');
ok((await q(`select available from public.venue_event_tables_public($1) where table_key='M1'`, [evMie.id]))[0].available === true, 'la espera vencida de M1 aparece libre para el público');
await como('service_role');
const C = (await q(`select * from public.venue_event_hold_tables($1, array['M1'], gen_random_uuid())`, [evMie.id]))[0];
ok(C.keys[0] === 'M1' && C.hold_token !== A.hold_token, 'otro comprador toma M1 tras vencer la espera de A');
ok((await q(`select public.venue_event_release_tables($1) n`, [C.hold_token]))[0].n === 1, 'liberar por token devuelve la mesa');

console.log('\n▶ 5. Confirmar la venta tras el pago (webhook)');
await su(`update venue_event_tables set status='available', held_until=null, hold_token=null where event_id=$1 and status='held'`, [evMie.id]);   // se vencen las esperas de las pruebas anteriores
await como('service_role');
const P = (await q(`select * from public.venue_event_hold_tables($1, array['M1','M2'])`, [evMie.id]))[0];
const [orden] = await q(`insert into venue_ticket_orders (event_id, stripe_session_id, total_cents) values ($1, 'cs_test_1', 80000) returning id`, [evMie.id]);
ok(await falla(`select public.venue_event_confirm_tables($1, $2, '  ')`, [P.hold_token, orden.id], 'falta_nombre_de_quien_renta'), 'sin el nombre de quien renta no se confirma');
ok((await q(`select public.venue_event_confirm_tables($1, $2, 'Alicia', 'Team Alicia') n`, [P.hold_token, orden.id]))[0].n === 2, 'confirma 2 mesas vendidas');
ok((await q(`select public.venue_event_confirm_tables($1, $2, 'Alicia') n`, [P.hold_token, orden.id]))[0].n === 0, 'confirmar dos veces no vende de más (idempotente)');
await como(null);
const vend = await q(`select table_key, status, sold_via, buyer_name, reservation_name, order_id from venue_event_tables where event_id=$1 and status='sold' order by 1`, [evMie.id]);
ok(vend.length === 2 && vend.every(r => r.sold_via === 'online' && r.buyer_name === 'Alicia' && r.reservation_name === 'Team Alicia' && r.order_id === orden.id), 'quedan vendidas en línea, con nombre, reserva y pedido');
await como('service_role');
ok(await falla(`select * from public.venue_event_hold_tables($1, array['M1'])`, [evMie.id], 'mesa_no_disponible'), 'una mesa vendida no se puede volver a tomar');

console.log('\n▶ 6. REGLA DEL PO: cada evento vende por separado');
const J = (await q(`select * from public.venue_event_hold_tables($1, array['M1','M2'])`, [evJue.id]))[0];
ok(J.total_cents === 80000, 'la MISMA mesa M1+M2 se puede tomar el jueves aunque el miércoles esté vendida');
const [ordenJ] = await q(`insert into venue_ticket_orders (event_id, stripe_session_id, total_cents) values ($1, 'cs_test_2', 80000) returning id`, [evJue.id]);
await db.query(`select public.venue_event_confirm_tables($1, $2, 'Beto')`, [J.hold_token, ordenJ.id]);
await como(null);
const porEvento = await q(`select e.title, t.table_key, t.buyer_name from venue_event_tables t join venue_events e on e.id=t.event_id where t.table_key='M1' order by e.title`);
ok(porEvento.length === 2 && porEvento.find(r => r.title === 'Noche de Salsa').buyer_name === 'Alicia' && porEvento.find(r => r.title === 'One Hit Wonder').buyer_name === 'Beto', 'M1 vendida a Alicia el miércoles y a Beto el jueves, marcadas por separado');
await como('anon');
ok((await q(`select count(*) filter (where available) n from public.venue_event_tables_public($1)`, [evMie.id]))[0].n == 2, 'miércoles: quedan 2 libres (M3, M4)');
ok((await q(`select count(*) filter (where available) n from public.venue_event_tables_public($1)`, [evJue.id]))[0].n == 2, 'jueves: también 2 libres, con su propio historial');

console.log('\n▶ 7. Staff del local (dueño, manager y equipo)');
await como('authenticated', U.team);
ok((await q(`select count(*) n from public.venue_event_tables`))[0].n == 8, 'EQUIPO ve el inventario de su local (8 filas: 2 eventos)');
ok((await q(`select public.venue_staff_set_table($1, 'M3', 'reserve', 'Familia Pérez') r`, [evMie.id]))[0].r === 'reserved', 'EQUIPO aparta M3 el miércoles');
ok(await falla(`select public.venue_staff_set_table($1, 'M3', 'sell', 'X')`, [evMie.id]) === false, 'EQUIPO puede vender a mano una mesa apartada');
await como('authenticated', U.manager);
ok(await falla(`select public.venue_staff_set_table($1, 'M1', 'release')`, [evMie.id], 'vendida_en_linea_requiere_reembolso'), 'una mesa vendida EN LÍNEA no se libera a la ligera (requiere reembolso)');
ok(await falla(`select public.venue_staff_set_table($1, 'M4', 'sell', '')`, [evMie.id], 'falta_nombre_de_quien_renta'), 'vender a mano exige el nombre de quien renta');
ok((await q(`select public.venue_staff_set_table($1, 'M4', 'sell', 'Carlos', 'efectivo') r`, [evMie.id]))[0].r === 'sold', 'MANAGER vende M4 a mano');
await como(null);
ok((await q(`select sold_via from venue_event_tables where event_id=$1 and table_key='M4'`, [evMie.id]))[0].sold_via === 'manager', 'queda marcada como vendida por el manager');
await como('authenticated', U.manager);
ok((await q(`select public.venue_staff_set_table($1, 'M4', 'release') r`, [evMie.id]))[0].r === 'available', 'una venta a mano sí se puede liberar');
await como('authenticated', U.ajeno);
ok(await falla(`select public.venue_staff_set_table($1, 'M4', 'reserve', 'X')`, [evMie.id], 'no_autorizado'), 'el staff de OTRO local no puede tocar estas mesas');
ok((await q(`select count(*) n from public.venue_event_tables`))[0].n == 0, '…ni siquiera las ve (RLS)');
await como('anon');
ok(await falla(`select public.venue_staff_set_table($1, 'M4', 'reserve', 'X')`, [evMie.id], 'permission denied'), 'anónimo no puede apartar mesas');
await como('authenticated', U.admin);
ok((await q(`select public.venue_staff_set_table($1, 'M4', 'reserve', 'Plataforma') r`, [evMie.id]))[0].r === 'reserved', 'ADMIN de la plataforma también puede');
await como('authenticated', U.owner);
ok(await falla(`select public.venue_staff_set_table($1, 'M4', 'borrar')`, [evMie.id], 'accion_invalida'), 'acción desconocida → rechazada');
ok(await falla(`insert into public.venue_event_tables (event_id, table_key, label, price_cents) values ($1, 'X1', 'X1', 1)`, [evMie.id], 'permission denied'), 'nadie escribe directo en la tabla (ni el dueño)');
await como('anon');
ok((await q(`select available from public.venue_event_tables_public($1) where table_key='M3'`, [evMie.id]))[0].available === false, 'una mesa apartada se ve «no disponible» para el público (sin decir quién)');

console.log('\n▶ 8. El mapa de ejemplo del repo (20261003_OPCIONAL_mapa_de_ejemplo_mojitos.sql) es válido');
const ejemplo = readFileSync(join(here, '..', 'scripts', '20261003_OPCIONAL_mapa_de_ejemplo_mojitos.sql'), 'utf8').match(/\$mapa\$([\s\S]*?)\$mapa\$/)[1];
const [roomEj] = await su(`insert into venue_rooms (venue_id, slug, name) values ($1, 'ejemplo', 'Sala de ejemplo') returning id`, [venue.id]);
const [evEj] = await su(`insert into venue_events (room_id, title, event_date, status) values ($1, 'Evento de ejemplo', current_date + 9, 'announced') returning id`, [roomEj.id]);
await como('authenticated', U.owner);
await db.query(`select public.venue_room_set_layout($1, $2::jsonb)`, [roomEj.id, ejemplo]);
ok((await q(`select public.venue_event_open_tables($1) n`, [evEj.id]))[0].n === 36, 'el dueño abre la venta con el mapa de ejemplo: 36 mesas (3 mapas)');
const claves = await su(`select table_key, price_cents, seats, zone_name from venue_event_tables where event_id=$1`, [evEj.id]);
ok(claves.every(r => Number.isInteger(r.price_cents) && r.price_cents > 0 && r.seats > 0 && r.zone_name), 'todas con precio entero en centavos, sillas y zona');
ok(new Set(claves.map(r => r.table_key)).size === 36, 'llaves únicas entre los 3 mapas (M…, R…, S…)');
const geo = JSON.parse(ejemplo).maps;
ok(geo.length === 3 && geo.every(m => m.tables.every(tb => claves.some(c => c.table_key === tb.id))), 'cada mesa dibujada en los planos existe en el inventario (la página las pinta por esa llave)');
await como(null);
console.log(`\n${fallidas === 0 ? '✅' : '❌'} ${pasadas} pruebas pasadas, ${fallidas} fallidas`);
process.exit(fallidas === 0 ? 0 : 1);
