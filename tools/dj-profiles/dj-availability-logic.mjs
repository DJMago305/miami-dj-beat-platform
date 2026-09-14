#!/usr/bin/env node
// tools/dj-profiles/dj-availability-logic.mjs — espejo puro en JS de la
// decisión tri-state que implementa la función SQL
// public.check_dj_availability() (ver supabase/migrations/
// 20260913120000_check_dj_availability_rpc.sql, que la migración lleva
// documentada línea por línea con el MISMO razonamiento que este archivo).
//
// Por qué existe un espejo en JS de una función que en producción corre en
// Postgres: la lógica de fondo (¿hay overlap real? ¿el status excluye la
// fila? ¿hay suficiente dato para decidir?) es lógica pura, sin dependencia
// de red ni de Supabase — así que se puede (y se debe) probar con
// `node --test`, sin aplicar la migración a ninguna base. Si algún día el
// SQL diverge de este archivo, es una regresión de esta ticket, no algo
// nuevo — por eso los comentarios de la migración citan a este archivo y
// viceversa.
//
// ═══ LA REGLA CENTRAL DE ESTE TICKET (léase antes de tocar nada aquí) ══════
// dj_events tiene 0 filas hoy y ningún camino de código conocido escribe en
// ella (Fase 3 de este ticket queda solo DISEÑADA, no construida). Eso
// significa que "no encontramos ningún conflicto" HOY es indistinguible de
// "de verdad no hay conflicto" — dj_events simplemente no tiene todavía la
// cobertura para probar lo segundo. Por eso la tercera rama de la decisión
// NUNCA es 'AVAILABLE': es 'REQUIRES_CONFIRMATION'. El día en que exista un
// escritor real de dj_events (Fase 3) y la tabla tenga cobertura genuina,
// esa MISMA rama podría honestamente convertirse en 'AVAILABLE' — pero ese
// día no es hoy, y fabricar esa confianza ahora sería exactamente el tipo de
// falso positivo ("el DJ está libre") que este ticket existe para prevenir.

/** @typedef {'AVAILABLE'|'NOT_AVAILABLE'|'REQUIRES_CONFIRMATION'} AvailabilityStatus */

const CANCELLED_STATUSES = new Set(['cancelled', 'canceled']);

/**
 * ¿Este status de dj_events excluye la fila de la comparación de conflicto?
 * Ambas grafías en inglés ('cancelled' británico, 'canceled' americano) —
 * exactamente las dos que ya excluye get_recommended_djs() (referencia, no
 * se llama directo — ver §24 del ticket). dj_events está vacía hoy: no hay
 * datos reales para inferir un tercer valor de status, así que no se
 * inventa ninguno.
 */
export function isCancelledStatus(status) {
  return CANCELLED_STATUSES.has(String(status || '').trim().toLowerCase());
}

/**
 * ¿[aStart,aEnd) se solapa con [bStart,bEnd)? Mismos minutos-desde-medianoche
 * en ambos lados (ver toMinutes) — la función que llama a esta ya garantizó
 * que ambos eventos caen en el mismo event_date antes de invocarla.
 */
function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * 'HH:MM' o 'HH:MM:SS' → minutos desde medianoche. Devuelve null si el valor
 * no es un horario bien formado (input ausente/corrupto) — la función que
 * llama a esta debe tratar null como "no se puede comparar con seguridad",
 * nunca como 0.
 */
export function toMinutes(hhmm) {
  if (typeof hhmm !== 'string') return null;
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (!Number.isInteger(h) || !Number.isInteger(mi) || h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/**
 * Decide el tri-state de disponibilidad — espejo puro de check_dj_availability().
 *
 * @param {object} input
 * @param {boolean|null|undefined} input.profileAvailable — dj_profiles.available (flag global).
 * @param {object} input.requested — { eventDate: 'YYYY-MM-DD', startTime: 'HH:MM', endTime: 'HH:MM' }.
 * @param {Array<object>} input.events — filas de dj_events YA acotadas a este dj_user_id
 *   (el WHERE dj_user_id=... vive en el SQL; esta función no conoce identidad de DJ,
 *   solo recibe las filas candidatas — así se prueba la lógica de conflicto aislada
 *   de la lógica de identificadores, que el ticket prohíbe unificar/reinterpretar — §8).
 *   Cada fila: { eventDate, startTime, endTime, status }.
 * @returns {AvailabilityStatus}
 */
export function decideAvailability({ profileAvailable, requested, events }) {
  // §4 — el flag global es definitivo y no depende de ningún dato de fecha.
  // Se evalúa PRIMERO y corta corto: un DJ con available=false es
  // NOT_AVAILABLE sin importar qué diga (o no diga) dj_events.
  if (profileAvailable === false) return 'NOT_AVAILABLE';

  const reqDate = requested && typeof requested.eventDate === 'string' ? requested.eventDate.trim() : '';
  const reqStartMin = toMinutes(requested && requested.startTime);
  const reqEndMin = toMinutes(requested && requested.endTime);

  // §5-6 — sin fecha o sin un rango horario válido y completo, no hay base
  // para calcular overlap. Nunca se trata "no tengo la hora" como "entonces
  // no hay conflicto, entonces disponible".
  if (!reqDate || reqStartMin === null || reqEndMin === null || reqStartMin >= reqEndMin) {
    return 'REQUIRES_CONFIRMATION';
  }

  const candidates = Array.isArray(events) ? events : [];
  let ambiguous = false;

  for (const ev of candidates) {
    if (!ev || ev.eventDate !== reqDate) continue;
    if (isCancelledStatus(ev.status)) continue; // §5-6 — cancelado/canceled nunca bloquea.

    const evStartMin = toMinutes(ev.startTime);
    const evEndMin = toMinutes(ev.endTime);

    if (evStartMin === null || evEndMin === null) {
      // Fila real, misma fecha, no cancelada, pero sin horario utilizable
      // (ver §7 — columnas time/timestamp ambiguas caen aquí también si el
      // llamador no pudo normalizarlas). No se puede probar overlap, así
      // que TAMPOCO se puede descartar — se marca ambigua y se sigue
      // revisando el resto: una fila ambigua no debe esconder un conflicto
      // real que sí aparezca en otra fila.
      ambiguous = true;
      continue;
    }

    if (intervalsOverlap(reqStartMin, reqEndMin, evStartMin, evEndMin)) {
      // Conflicto real, definitivo, con datos completos → NOT_AVAILABLE
      // gana sobre cualquier ambigüedad encontrada antes en el loop.
      return 'NOT_AVAILABLE';
    }
    // Misma fecha, no cancelado, pero rango horario que NO se solapa — no
    // bloquea por sí solo (requisito de prueba #3 del ticket).
  }

  // Ninguna fila produjo un conflicto definitivo. Con o sin filas ambiguas,
  // esto NUNCA es 'AVAILABLE' — ver la nota central arriba: dj_events sin
  // cobertura genuina (hoy: 0 filas, sin escritor) no puede honestamente
  // demostrar que el DJ está libre, solo que no encontramos un conflicto
  // registrado. La distinción entre "cobertura ambigua" (`ambiguous`) y
  // "cobertura vacía" no cambia el resultado hoy — ambas caen a
  // REQUIRES_CONFIRMATION — pero se conserva la señal separada porque una
  // futura Fase 3 (escritor real de dj_events) podría querer diferenciar
  // "sin datos" de "datos incompletos" en su propia lógica de confianza.
  void ambiguous;
  return 'REQUIRES_CONFIRMATION';
}
