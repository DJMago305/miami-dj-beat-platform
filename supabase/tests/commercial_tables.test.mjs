// Prueba de la lógica pura de web/js/commercial-tables.js (pantalla de mesas del staff): estados, resumen, búsqueda, plano automático.
//   node supabase/tests/commercial_tables.test.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const core = createRequire(import.meta.url)(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'web', 'js', 'commercial-tables.js'));
let ok = 0, mal = 0; const t = (n, c) => { c ? ok++ : mal++; console.log(c ? '  ✔' : '  ✘ FALLA:', n); };
const AHORA = Date.parse('2026-10-07T20:00:00Z'), futuro = '2026-10-07T20:30:00Z', pasado = '2026-10-07T19:00:00Z';
const fila = (o) => Object.assign({ table_key: 'M1', label: 'M1', seats: 4, zone_name: 'Zona 1', price_cents: 40000, status: 'available', sold_via: null, buyer_name: null, reservation_name: null, note: null }, o);

console.log('▶ estados');
t('disponible', core.estadoDe(fila({}), AHORA) === 'available');
t('en pago (espera vigente)', core.estadoDe(fila({ status: 'held', held_until: futuro }), AHORA) === 'held');
t('espera VENCIDA cuenta como libre', core.estadoDe(fila({ status: 'held', held_until: pasado }), AHORA) === 'available');
t('apartada por el staff', core.estadoDe(fila({ status: 'reserved' }), AHORA) === 'reserved');
t('vendida en línea', core.estadoDe(fila({ status: 'sold', sold_via: 'online' }), AHORA) === 'sold_online');
t('vendida a mano', core.estadoDe(fila({ status: 'sold', sold_via: 'manager' }), AHORA) === 'sold_manager');

console.log('▶ resumen');
const rows = [fila({ table_key: 'M1' }), fila({ table_key: 'M2', status: 'held', held_until: futuro }), fila({ table_key: 'M3', status: 'held', held_until: pasado }),
  fila({ table_key: 'M4', status: 'reserved' }), fila({ table_key: 'M5', status: 'sold', sold_via: 'online', price_cents: 25000 }), fila({ table_key: 'M6', status: 'sold', sold_via: 'manager', price_cents: 15000 })];
const r = core.resumen(rows, AHORA);
t('conteos: 2 libres (una por espera vencida), 1 en pago, 1 apartada, 1 en línea, 1 a mano', r.counts.available === 2 && r.counts.held === 1 && r.counts.reserved === 1 && r.counts.sold_online === 1 && r.counts.sold_manager === 1);
t('dinero vendido separado en línea / a mano (lo apartado y en pago NO cuenta)', r.cents.online === 25000 && r.cents.manager === 15000 && r.vendidas === 2);
t('formato de dinero', core.dinero(25000) === '$250' && core.dinero(12550) === '$125.50' && core.dinero(0) === '$0');

console.log('▶ búsqueda (la puerta: «¿dónde está Alicia?»)');
const con = [fila({ table_key: 'M4', label: 'M4', status: 'sold', sold_via: 'online', buyer_name: 'Alicia Pérez', reservation_name: 'Team Alicia' }),
  fila({ table_key: 'M5', label: 'M5', status: 'reserved', buyer_name: 'Familia Núñez', note: 'cumpleaños' }), fila({ table_key: 'M6', label: 'M6' })];
t('sin texto: solo las que NO están libres', core.buscar(con, '', AHORA).length === 2);
t('por reserva, sin importar mayúsculas ni acentos', core.buscar(con, 'TEAM alicia', AHORA).length === 1 && core.buscar(con, 'perez', AHORA)[0].table_key === 'M4');
t('por nota y por mesa', core.buscar(con, 'cumple', AHORA)[0].table_key === 'M5' && core.buscar(con, 'm5', AHORA).length === 1);
t('una mesa libre nunca aparece, aunque coincida', core.buscar(con, 'M6', AHORA).length === 0);

console.log('▶ plano automático (cuando el evento no trae geometría)');
const maps = core.mapsDe({}, [fila({ table_key: 'M10' }), fila({ table_key: 'M2' }), fila({ table_key: 'M1' })]);
t('un mapa «auto» con todas las mesas, ordenadas M1, M2, M10', maps.length === 1 && maps[0].tables.map(x => x.id).join() === 'M1,M2,M10');
const celdas = core.gridMaps(Array.from({ length: 14 }, (_, i) => fila({ table_key: 'T' + i })))[0].tables.map(x => x.x + ',' + x.y);
t('sin encimarse: 14 mesas, 14 posiciones distintas', new Set(celdas).size === 14);
t('con geometría del evento usa SUS mapas', core.mapsDe({ maps: [{ id: 'sala', label: 'Sala', tables: [] }, { id: 'rec', label: 'Recepción', tables: [] }] }, []).length === 2);

console.log('▶ quién puede abrir la venta');
t('dueño y manager sí; equipo no', core.puedeAbrirVenta('owner') && core.puedeAbrirVenta('manager') && !core.puedeAbrirVenta('team') && !core.puedeAbrirVenta(undefined));
console.log(`\n${mal === 0 ? '✅' : '❌'} ${ok} pruebas pasadas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
