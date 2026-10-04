// Prueba de supabase/scripts/20261003_fijar_mapa_de_la_sala.sql (venue_room_set_layout) en un Postgres REAL embebido (PGlite), sin tocar producción.
// Uso:   npm i --no-save @electric-sql/pglite
//        PGLITE_FROM=/ruta/donde/instalaste/package.json node supabase/tests/fijar_mapa_sala.test.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require_ = createRequire(process.env.PGLITE_FROM || import.meta.url);
const { PGlite } = require_('@electric-sql/pglite');
const here = dirname(fileURLToPath(import.meta.url));
const SQL = readFileSync(join(here, '..', 'scripts', '20261003_fijar_mapa_de_la_sala.sql'), 'utf8');
process.on('unhandledRejection', (e) => { console.error('\n❌ Error inesperado:', e && e.message ? e.message : e); process.exit(2); });
const db = new PGlite();
const U = { owner: '00000000-0000-0000-0000-0000000000a1', manager: '00000000-0000-0000-0000-0000000000a2', team: '00000000-0000-0000-0000-0000000000a3',
            admin: '00000000-0000-0000-0000-0000000000c1', ajeno: '00000000-0000-0000-0000-0000000000d1' };
let pasadas = 0, fallidas = 0;
const ok = (c, m) => { if (c) { pasadas++; console.log('  ✔', m); } else { fallidas++; console.log('  ✘ FALLA:', m); } };
async function como(role, uid) { await db.exec('reset role'); if (role) await db.exec(`set role ${role}`); await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid || '']); }
async function su(sql, params) { await db.exec('reset role'); return (await db.query(sql, params)).rows; }
async function llama(layout, room) { try { const r = await db.query('select public.venue_room_set_layout($1, $2::jsonb) as n', [room, JSON.stringify(layout)]); return { n: r.rows[0].n }; } catch (e) { return { err: String(e.message) }; } }

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create table dj_profiles (user_id uuid, role text);
  create table venues (id uuid primary key default gen_random_uuid(), slug text, name text);
  create table venue_rooms (id uuid primary key default gen_random_uuid(), venue_id uuid not null references venues(id), slug text, name text,
                            layout jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());
  create table venue_events (id uuid primary key default gen_random_uuid(), room_id uuid references venue_rooms(id), layout jsonb not null default '{}'::jsonb);
  create table venue_staff (venue_id uuid not null, user_id uuid not null, role text not null, primary key (venue_id, user_id));
  create function public.is_platform_admin(p_uid uuid) returns boolean language sql stable security definer set search_path to 'public'
    as $$ select exists (select 1 from public.dj_profiles d where d.user_id = p_uid and lower(trim(coalesce(d.role, ''))) in ('admin', 'owner')) $$;
  create function public.venue_role(p_venue_id uuid) returns text language sql stable security definer set search_path to 'public'
    as $$ select role from public.venue_staff where venue_id = p_venue_id and user_id = auth.uid() $$;
  create function public.can_manage_venue_layout(p_venue_id uuid) returns boolean language sql stable security definer set search_path to 'public'
    as $$ select coalesce(public.venue_role(p_venue_id) in ('owner', 'manager'), false) $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on all functions in schema public to authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`);
const [v] = await su(`insert into venues (slug, name) values ('mojitos-calle-8', 'Mojitos') returning id`);
const [v2] = await su(`insert into venues (slug, name) values ('otro', 'Otro') returning id`);
const [room] = await su(`insert into venue_rooms (venue_id, slug, name) values ($1, 'sala-principal', 'Sala') returning id`, [v.id]);
const [roomAjena] = await su(`insert into venue_rooms (venue_id, slug, name) values ($1, 'sala', 'Sala') returning id`, [v2.id]);
await db.query(`insert into venue_staff values ($1,$2,'owner'),($1,$3,'manager'),($1,$4,'team'),($5,$6,'owner')`, [v.id, U.owner, U.manager, U.team, v2.id, U.ajeno]);
await db.query(`insert into dj_profiles values ($1, 'admin')`, [U.admin]);
const [ev] = await su(`insert into venue_events (room_id, layout) values ($1, $2::jsonb) returning id`, [room.id, JSON.stringify({ tables: [{ key: 'VIEJA', price_cents: 1 }] })]);

console.log('\n▶ Camino de actualización: producción ya tiene la versión simple (devolvía void)');
await db.exec(`create function public.venue_room_set_layout(p_room_id uuid, p_layout jsonb) returns void language plpgsql security definer set search_path to 'public' as $$
  begin update public.venue_rooms set layout = p_layout where id = p_room_id; end $$;`);
let rVieja = null; try { await db.exec(`create or replace function public.venue_room_set_layout(p_room_id uuid, p_layout jsonb) returns integer language sql as 'select 1'`); } catch (e) { rVieja = String(e.message); }
ok(/cannot change return type/.test(rVieja || ''), 'reproduce el error de producción: CREATE OR REPLACE no puede cambiar void → integer');
console.log('\n▶ Aplicando el SQL…');
await db.exec(SQL); console.log('  ✔ corre sin errores'); await db.exec(SQL); console.log('  ✔ y vuelve a correr (idempotente)');

const MAPA = { maps: [{ id: 'sala', label: 'Sala principal' }], tables: [
  { key: 'M1', label: 'M1', seats: 4, zone: 'Zona 1', price_cents: 40000 }, { key: 'M2', seats: 6, zone: 'Zona 2', price_cents: 25000 }, { key: 'M3', price_cents: 0 } ] };

console.log('\n▶ Quién puede');
await como('authenticated', U.owner);   let r = await llama(MAPA, room.id);   ok(r.n === 3, 'el dueño fija el mapa (devuelve 3 mesas)');
const [g] = await su(`select layout from venue_rooms where id = $1`, [room.id]);
ok(g.layout.tables.length === 3 && g.layout.maps[0].id === 'sala', 'queda guardado, y la geometría («maps») se conserva tal cual');
await como('authenticated', U.manager); r = await llama({ tables: [{ key: 'A1', seats: 2, price_cents: 5000 }] }, room.id); ok(r.n === 1, 'el manager también puede');
await como('authenticated', U.admin);   r = await llama(MAPA, room.id);   ok(r.n === 3, 'el admin de la plataforma también puede');
await como('authenticated', U.team);    r = await llama(MAPA, room.id);   ok(/no_autorizado/.test(r.err || ''), 'el equipo NO puede');
await como('authenticated', U.ajeno);   r = await llama(MAPA, room.id);   ok(/no_autorizado/.test(r.err || ''), 'el dueño de OTRO local NO puede');
await como('authenticated', U.owner);   r = await llama(MAPA, roomAjena.id); ok(/no_autorizado/.test(r.err || ''), 'el dueño no puede tocar la sala de otro local');
await como('anon', '');                 r = await llama(MAPA, room.id);   ok(/permission denied/.test(r.err || ''), 'sin sesión: permiso denegado');
await como('authenticated', U.owner);   r = await llama(MAPA, '00000000-0000-0000-0000-00000000ffff'); ok(/sala_no_existe/.test(r.err || ''), 'sala inexistente → sala_no_existe');

console.log('\n▶ Validación (todo o nada: un mapa malo no cambia nada)');
await su(`update venue_rooms set layout = $2::jsonb where id = $1`, [room.id, JSON.stringify(MAPA)]);
await como('authenticated', U.owner);
const malos = [
  ['sin "tables"', { maps: [] }], ['"tables" vacío', { tables: [] }], ['no es objeto', [1, 2]], ['null', null],
  ['llave vacía', { tables: [{ key: '  ', price_cents: 1 }] }], ['llave repetida', { tables: [{ key: 'M1', price_cents: 1 }, { key: 'M1', price_cents: 2 }] }],
  ['llave demasiado larga', { tables: [{ key: 'x'.repeat(21), price_cents: 1 }] }], ['llave numérica', { tables: [{ key: 7, price_cents: 1 }] }],
  ['sin precio', { tables: [{ key: 'M1' }] }], ['precio negativo', { tables: [{ key: 'M1', price_cents: -1 }] }], ['precio con decimales', { tables: [{ key: 'M1', price_cents: 10.5 }] }],
  ['precio como texto', { tables: [{ key: 'M1', price_cents: '100' }] }], ['precio absurdo', { tables: [{ key: 'M1', price_cents: 1000001 }] }],
  ['0 sillas', { tables: [{ key: 'M1', price_cents: 1, seats: 0 }] }], ['41 sillas', { tables: [{ key: 'M1', price_cents: 1, seats: 41 }] }], ['sillas como texto', { tables: [{ key: 'M1', price_cents: 1, seats: 'cuatro' }] }],
  ['"maps" no es lista', { maps: { id: 'sala' }, tables: [{ key: 'M1', price_cents: 1 }] }],
  ['una mesa no es objeto', { tables: ['M1'] }], ['301 mesas', { tables: Array.from({ length: 301 }, (_, i) => ({ key: 'T' + i, price_cents: 1 })) }],
];
for (const [nombre, mapa] of malos) { r = await llama(mapa, room.id); ok(/mapa_invalido/.test(r.err || ''), `rechaza: ${nombre}`); }
const [intacto] = await su(`select layout = $2::jsonb as igual from venue_rooms where id = $1`, [room.id, JSON.stringify(MAPA)]);   // jsonb reordena claves: se compara como jsonb, no como texto
ok(intacto.igual === true, 'después de todos los rechazos el mapa guardado sigue intacto');
r = await llama({ tables: Array.from({ length: 300 }, (_, i) => ({ key: 'T' + i, price_cents: 1 })) }, room.id); ok(r.n === 300, 'acepta el máximo (300 mesas)');
r = await llama({ tables: [{ key: 'M1', price_cents: 1000000, seats: 40 }] }, room.id); ok(r.n === 1, 'acepta los límites exactos (precio 1000000, 40 sillas)');

console.log('\n▶ Eventos');
const [ev2] = await su(`select layout from venue_events where id = $1`, [ev.id]);
ok(ev2.layout.tables[0].key === 'VIEJA', 'el evento que ya tenía su copia NO cambia al fijar la plantilla de la sala');

console.log(`\n${fallidas ? '❌' : '✅'} ${pasadas} pasaron, ${fallidas} fallaron`);
process.exit(fallidas ? 1 : 0);
