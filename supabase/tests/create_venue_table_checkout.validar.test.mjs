// Prueba de la validación de entradas de supabase/functions/create-venue-table-checkout/index.ts (función validarCuerpo).
// Extrae la función del código real (sin copiarla), le quita los tipos de TypeScript y la ejecuta.
//   node supabase/tests/create_venue_table_checkout.validar.test.mjs        (Node 22.13+)
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'functions', 'create-venue-table-checkout', 'index.ts'), 'utf8');
const trozo = src.match(/export function validarCuerpo[\s\S]*?\n}\n/)[0].replace('export function', 'function');
const validarCuerpo = new Function(stripTypeScriptTypes(trozo) + '; return validarCuerpo;')();
let ok = 0, mal = 0;
const t = (n, c) => { c ? ok++ : mal++; console.log(c ? '  ✔' : '  ✘ FALLA:', n); };
const EV = '57da9a05-3968-45c2-8b21-fe22752db152';
const base = { event_id: EV, table_keys: ['M1', 'M2'], renter_name: 'Alicia Pérez' };
let r = validarCuerpo(base);
t('caso válido mínimo (solo nombre de quien renta)', !('error' in r) && r.keys.length === 2 && r.reservationName === '' && r.holdToken === null);
r = validarCuerpo({ ...base, reservation_name: '  Team   Alicia ', customer_email: 'a@b.co' });
t('reserva y correo opcionales, espacios normalizados', r.reservationName === 'Team Alicia' && r.email === 'a@b.co');
t('sin nombre → falta_nombre_de_quien_renta', (validarCuerpo({ ...base, renter_name: ' ' })).error === 'falta_nombre_de_quien_renta');
t('nombre de 1 letra → rechazado', (validarCuerpo({ ...base, renter_name: 'A' })).error === 'falta_nombre_de_quien_renta');
t('nombre larguísimo → rechazado', (validarCuerpo({ ...base, renter_name: 'x'.repeat(81) })).error === 'nombre_demasiado_largo');
t('evento que no es uuid → evento_invalido', (validarCuerpo({ ...base, event_id: "1' or 1=1" })).error === 'evento_invalido');
t('sin mesas → sin_mesas', (validarCuerpo({ ...base, table_keys: [] })).error === 'sin_mesas');
t('mesas repetidas se colapsan', (validarCuerpo({ ...base, table_keys: ['M1', 'M1', ' M1 '] })).keys.length === 1);
t('13 mesas → demasiadas_mesas', (validarCuerpo({ ...base, table_keys: Array.from({ length: 13 }, (_, i) => 'M' + i) })).error === 'demasiadas_mesas');
t('llave con coma (rompería la metadata) → mesa_invalida', (validarCuerpo({ ...base, table_keys: ['M1,M2'] })).error === 'mesa_invalida');
t('correo mal formado → correo_invalido', (validarCuerpo({ ...base, customer_email: 'nope' })).error === 'correo_invalido');
t('token que no es uuid → token_invalido', (validarCuerpo({ ...base, hold_token: 'abc' })).error === 'token_invalido');
t('token uuid válido se acepta', (validarCuerpo({ ...base, hold_token: EV })).holdToken === EV);
console.log(`\n${mal === 0 ? '✅' : '❌'} ${ok} pruebas pasadas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
