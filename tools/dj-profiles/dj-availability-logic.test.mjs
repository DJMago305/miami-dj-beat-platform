#!/usr/bin/env node
// tools/dj-profiles/dj-availability-logic.test.mjs — pruebas de la lógica
// PURA de decideAvailability() (espejo en JS de check_dj_availability()).
// Cero red, cero Supabase — exactamente lo que pide §33 del ticket para la
// parte de la decisión que sí se puede probar sin base de datos.
//
//   node --test tools/dj-profiles/dj-availability-logic.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { decideAvailability, isCancelledStatus, toMinutes } from "./dj-availability-logic.mjs";

const REQ = { eventDate: "2026-12-31", startTime: "20:00", endTime: "23:00" };

test("1 · available=false global → NOT_AVAILABLE, corto-circuito, sin importar la fecha", () => {
  const r = decideAvailability({ profileAvailable: false, requested: REQ, events: [] });
  assert.equal(r, "NOT_AVAILABLE");
});

test("1b · available=false gana aunque exista un evento que NO chocaría por horario", () => {
  const r = decideAvailability({
    profileAvailable: false,
    requested: REQ,
    events: [{ eventDate: "2026-12-31", startTime: "09:00", endTime: "10:00", status: "confirmed" }],
  });
  assert.equal(r, "NOT_AVAILABLE");
});

test("2 · evento real con overlap genuino de intervalo → NOT_AVAILABLE", () => {
  const r = decideAvailability({
    profileAvailable: true,
    requested: REQ, // 20:00–23:00
    events: [{ eventDate: "2026-12-31", startTime: "19:00", endTime: "21:00", status: "confirmed" }],
  });
  assert.equal(r, "NOT_AVAILABLE");
});

test("2b · overlap en el borde exacto (fin pedido == inicio existente) NO cuenta como choque ([start,end) semántica)", () => {
  const r = decideAvailability({
    profileAvailable: true,
    requested: REQ, // termina 23:00
    events: [{ eventDate: "2026-12-31", startTime: "23:00", endTime: "23:30", status: "confirmed" }],
  });
  assert.notEqual(r, "NOT_AVAILABLE");
});

test("3 · mismo día, intervalo que NO se solapa → no bloquea automáticamente (no es NOT_AVAILABLE)", () => {
  const r = decideAvailability({
    profileAvailable: true,
    requested: REQ, // 20:00–23:00
    events: [{ eventDate: "2026-12-31", startTime: "10:00", endTime: "12:00", status: "confirmed" }],
  });
  assert.notEqual(r, "NOT_AVAILABLE");
  // Regla central §0-1: tampoco se vuelve AVAILABLE solo porque este evento no chocó.
  assert.equal(r, "REQUIRES_CONFIRMATION");
});

test("4 · evento cancelado (grafía 'cancelled') que SÍ se solaparía → no bloquea", () => {
  const r = decideAvailability({
    profileAvailable: true,
    requested: REQ,
    events: [{ eventDate: "2026-12-31", startTime: "20:30", endTime: "22:00", status: "cancelled" }],
  });
  assert.notEqual(r, "NOT_AVAILABLE");
});

test("4b · evento cancelado (grafía americana 'canceled', mayúsculas mezcladas) → no bloquea", () => {
  const r = decideAvailability({
    profileAvailable: true,
    requested: REQ,
    events: [{ eventDate: "2026-12-31", startTime: "20:30", endTime: "22:00", status: "Canceled" }],
  });
  assert.notEqual(r, "NOT_AVAILABLE");
});

test("5 · sin cobertura (dj_events vacío hoy: 0 filas reales) → REQUIRES_CONFIRMATION, NUNCA AVAILABLE", () => {
  const r = decideAvailability({ profileAvailable: true, requested: REQ, events: [] });
  assert.equal(r, "REQUIRES_CONFIRMATION");
  assert.notEqual(r, "AVAILABLE");
});

test("5b · un conflicto real en OTRA fecha no afecta la decisión de la fecha pedida (sigue REQUIRES_CONFIRMATION)", () => {
  const r = decideAvailability({
    profileAvailable: true,
    requested: REQ,
    events: [{ eventDate: "2026-01-01", startTime: "20:00", endTime: "23:00", status: "confirmed" }],
  });
  assert.equal(r, "REQUIRES_CONFIRMATION");
});

test("6 · sin fecha/hora solicitada (input incompleto) → REQUIRES_CONFIRMATION, nunca se asume 'sin conflicto'", () => {
  assert.equal(decideAvailability({ profileAvailable: true, requested: {}, events: [] }), "REQUIRES_CONFIRMATION");
  assert.equal(
    decideAvailability({ profileAvailable: true, requested: { eventDate: "2026-12-31" }, events: [] }),
    "REQUIRES_CONFIRMATION"
  );
});

test("6b · start >= end (rango inválido) → REQUIRES_CONFIRMATION, no lanza excepción", () => {
  const r = decideAvailability({
    profileAvailable: true,
    requested: { eventDate: "2026-12-31", startTime: "22:00", endTime: "20:00" },
    events: [],
  });
  assert.equal(r, "REQUIRES_CONFIRMATION");
});

test("7 · fila real, misma fecha, no cancelada, pero SIN horario utilizable → ambigua, no se ignora silenciosamente (sigue REQUIRES_CONFIRMATION, nunca AVAILABLE)", () => {
  const r = decideAvailability({
    profileAvailable: true,
    requested: REQ,
    events: [{ eventDate: "2026-12-31", startTime: null, endTime: null, status: "confirmed" }],
  });
  assert.equal(r, "REQUIRES_CONFIRMATION");
});

test("7b · una fila ambigua NO esconde un conflicto real que sí aparece en otra fila del mismo día", () => {
  const r = decideAvailability({
    profileAvailable: true,
    requested: REQ,
    events: [
      { eventDate: "2026-12-31", startTime: null, endTime: null, status: "confirmed" },
      { eventDate: "2026-12-31", startTime: "21:00", endTime: "22:00", status: "confirmed" },
    ],
  });
  assert.equal(r, "NOT_AVAILABLE");
});

test("20 · entrada adversarial (events no es array, requested es null) falla seguro, no lanza", () => {
  assert.doesNotThrow(() => {
    const r = decideAvailability({ profileAvailable: true, requested: null, events: "not-an-array" });
    assert.equal(r, "REQUIRES_CONFIRMATION");
  });
});

test("20b · horario mal formado ('25:99', texto arbitrario) se trata como ausente, no como 0:00", () => {
  assert.equal(toMinutes("25:99"), null);
  assert.equal(toMinutes("no-es-hora"), null);
  assert.equal(toMinutes(undefined), null);
  assert.equal(toMinutes("09:30"), 570);
  assert.equal(toMinutes("09:30:00"), 570);
});

test("isCancelledStatus — solo las 2 grafías reales, nada inventado", () => {
  assert.equal(isCancelledStatus("cancelled"), true);
  assert.equal(isCancelledStatus("CANCELED"), true);
  assert.equal(isCancelledStatus("confirmed"), false);
  assert.equal(isCancelledStatus(""), false);
  assert.equal(isCancelledStatus(null), false);
  assert.equal(isCancelledStatus("cancelled-ish"), false); // no substring matching, exacto tras trim/lower
});
