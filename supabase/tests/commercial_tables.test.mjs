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

console.log('▶ archivo de mapa (validarMapa: mismas reglas que la base)');
const buena = { maps: [{ id: 'sala' }], tables: [{ key: 'M1', seats: 4, zone: 'Zona 1', price_cents: 40000 }, { key: 'M2', seats: 6, zone: 'Zona 1', price_cents: 40000 }, { key: 'M3', price_cents: 15000 }] };
let v = core.validarMapa(JSON.stringify(buena));
t('mapa bueno: válido, 3 mesas, 14 sillas (la que no trae «seats» cuenta 4)', v.ok && v.mesas === 3 && v.sillas === 14);
t('resumen por zona y rango de precios', v.zonas.length === 2 && v.zonas[0].mesas === 2 && v.precioMin === 15000 && v.precioMax === 40000);
t('trae «maps» → sin aviso de plano de muestra', v.avisos.length === 0);
t('sin «maps» → avisa que la página pública usa el plano de muestra', core.validarMapa({ tables: [{ key: 'A1', price_cents: 100 }] }).avisos.length === 1);
t('acepta una lista de mesas sola', core.validarMapa([{ key: 'A1', price_cents: 100 }]).ok);
t('JSON roto', !core.validarMapa('{no es json').ok);
t('sin «tables»', !core.validarMapa({ maps: [] }).ok && !core.validarMapa(null).ok);
t('llave vacía, repetida o larga', !core.validarMapa({ tables: [{ key: ' ', price_cents: 1 }] }).ok && !core.validarMapa({ tables: [{ key: 'M1', price_cents: 1 }, { key: 'M1', price_cents: 1 }] }).ok && !core.validarMapa({ tables: [{ key: 'x'.repeat(21), price_cents: 1 }] }).ok);
t('precio: negativo, decimal, texto, absurdo, ausente', [-1, 1.5, '100', 1000001, undefined].every((pc) => !core.validarMapa({ tables: [{ key: 'M1', price_cents: pc }] }).ok));
t('sillas: 0, 41, texto', [0, 41, 'cuatro'].every((n) => !core.validarMapa({ tables: [{ key: 'M1', price_cents: 1, seats: n }] }).ok));
t('«maps» que no es lista', !core.validarMapa({ maps: {}, tables: [{ key: 'M1', price_cents: 1 }] }).ok);
t('0 mesas y 301 mesas', !core.validarMapa({ tables: [] }).ok && !core.validarMapa({ tables: Array.from({ length: 301 }, (_, i) => ({ key: 'T' + i, price_cents: 1 })) }).ok);
t('300 mesas sí', core.validarMapa({ tables: Array.from({ length: 300 }, (_, i) => ({ key: 'T' + i, price_cents: 1 })) }).ok);
t('un mapa malo no entrega layout para enviar', core.validarMapa({ tables: [] }).layout === null && v.layout !== null);

console.log('▶ editor del plano (+ / − / mover)');
t('siguiente clave: M1, y salta las usadas', core.siguienteClave({}) === 'M1' && core.siguienteClave({ M1: 1, M2: 1, M4: 1 }) === 'M3');
t('ajustar a la cuadrícula de 10 px y dentro del plano', core.ajustar(133, 26, 774) === 130 && core.ajustar(-50, 26, 774) === 26 && core.ajustar(9999, 26, 774) === 774);
const ocupadas = [{ x: 100, y: 160 }, { x: 170, y: 160 }];
const libre = core.lugarLibre(ocupadas);
t('una mesa nueva no cae encima de otra', ocupadas.every((m) => Math.abs(m.x - libre.x) >= 56 || Math.abs(m.y - libre.y) >= 56));
t('plano vacío trae escenario y una zona (la página pública exige zonas)', core.planoVacio().focal.rect.length === 4 && core.planoVacio().zones.length === 1 && core.planoVacio().tables.length === 0);
const plano = core.planoVacio(); plano.tables.push({ id: 'M1', t: 'round', x: 200, y: 200, seats: 4 }, { id: 'A7', t: 'rect', x: 400, y: 300, w: 108, h: 54, seats: 8 });
const lay = core.construirMapa({ otraClave: 'se conserva' }, [plano], { M1: { label: 'M1', seats: 4, zone: 'Zona 1', price_cents: 40000 }, A7: { label: 'Mesa A7', seats: 10, zone: 'Zona 2', price_cents: 25000 } });
t('construirMapa: inventario con la clave del dibujo, sillas de los datos y precio en centavos', lay.tables.length === 2 && lay.tables[1].key === 'A7' && lay.tables[1].seats === 10 && lay.tables[1].price_cents === 25000 && lay.tables[1].label === 'Mesa A7');
t('construirMapa: el dibujo conserva forma, posición y tamaño; las sillas se sincronizan', lay.maps[0].tables[1].t === 'rect' && lay.maps[0].tables[1].w === 108 && lay.maps[0].tables[1].x === 400 && lay.maps[0].tables[1].seats === 10);
t('construirMapa: conserva claves ajenas y no toca el plano de origen', lay.otraClave === 'se conserva' && plano.tables[1].seats === 8);
t('construirMapa → validarMapa: el resultado es enviable', core.validarMapa(lay).ok && core.validarMapa(lay).avisos.length === 0);
t('construirMapa rellena foco/zonas/fijos si faltan (la página pública los usa siempre)', (() => { const m = core.construirMapa({}, [{ id: 'x', tables: [{ id: 'M1', t: 'round', x: 1, y: 1 }] }], { M1: { seats: 4, zone: 'Z', price_cents: 5 } }).maps[0]; return m.focal && Array.isArray(m.fixed) && m.zones.length === 1; })());
t('quitar una mesa: ya no aparece en el inventario', (() => { const pl = core.planoVacio(); pl.tables.push({ id: 'M1', t: 'round', x: 1, y: 1 }); return core.construirMapa({}, [pl], { M1: { seats: 4, zone: 'Z', price_cents: 5 } }).tables.length === 1 && core.construirMapa({}, [core.planoVacio()], {}).tables.length === 0; })());

console.log('▶ armar grupo (juntar mesas y venderlas)');
const gr = [fila({ table_key: 'M1', seats: 8, price_cents: 40000 }), fila({ table_key: 'M2', seats: 8, price_cents: 40000 }), fila({ table_key: 'M3', seats: 4, price_cents: 25000 }),
  fila({ table_key: 'M4', status: 'sold', sold_via: 'online' }), fila({ table_key: 'M5', status: 'held', held_until: futuro }), fila({ table_key: 'M6', status: 'held', held_until: pasado }), fila({ table_key: 'M7', status: 'reserved', seats: 6, price_cents: 25000 })];
t('movible: libre, apartada y espera vencida sí; vendida o en pago no', core.movible(gr[0], AHORA) && core.movible(gr[6], AHORA) && core.movible(gr[5], AHORA) && !core.movible(gr[3], AHORA) && !core.movible(gr[4], AHORA));
let g1 = core.grupoResumen(gr, ['M1', 'M2', 'M3'], AHORA);
t('grupo de 3 mesas: 20 sillas y total de lista $1050', g1.mesas === 3 && g1.sillas === 20 && g1.cents === 105000 && g1.ocupadas.length === 0);
g1 = core.grupoResumen(gr, ['M1', 'M4', 'M5', 'ZZ'], AHORA);
t('una vendida, una en pago y una que no existe quedan fuera y se avisan', g1.mesas === 1 && g1.ocupadas.join() === 'M4,M5,ZZ');
t('un grupo vacío suma cero', core.grupoResumen(gr, [], AHORA).mesas === 0);
const mp = { focal: { rect: [280, 24, 240, 56], label: 'ESCENARIO / DJ' }, fixed: [{ r: [20, 24, 90, 56], l: 'BAÑOS', k: 'bano' }, { r: [345, 255, 110, 110], l: 'PISTA' }, { r: [722, 100, 58, 390], l: 'BARRA', k: 'barra' }] };
t('no se puede poner una mesa sobre el escenario (devuelve su nombre)', core.bloqueaEstructura(mp, 400, 50) === 'ESCENARIO / DJ');
t('ni pegada al escenario (margen de 22 px)', core.bloqueaEstructura(mp, 300, 90) === 'ESCENARIO / DJ' && core.bloqueaEstructura(mp, 300, 150) === null);
t('ni sobre los baños ni sobre la barra', core.bloqueaEstructura(mp, 60, 50) === 'BAÑOS' && core.bloqueaEstructura(mp, 750, 300) === 'BARRA');
t('la pista NO es estructura: ahí se puede poner una mesa', core.bloqueaEstructura(mp, 400, 300) === null);
t('sin foco ni fijos no bloquea nada', core.bloqueaEstructura({}, 400, 50) === null && core.bloqueaEstructura(null, 1, 1) === null);
t('reglas del cliente = reglas de la base: borde exacto con margen', core.bloqueaEstructura(mp, 520 + 22, 80 + 22) === 'ESCENARIO / DJ' && core.bloqueaEstructura(mp, 520 + 23, 80 + 23) === null);

console.log('▶ quién puede abrir la venta');
t('dueño y manager sí; equipo no', core.puedeAbrirVenta('owner') && core.puedeAbrirVenta('manager') && !core.puedeAbrirVenta('team') && !core.puedeAbrirVenta(undefined));
console.log(`\n${mal === 0 ? '✅' : '❌'} ${ok} pruebas pasadas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
