// TICKET-V1-FINANCIAL-LEGACY-CANONICAL-EQUIVALENCE-HARNESS-007E
//
// Runs every scenario in mdj-financial-equivalence-fixture.js through the
// Legacy Readonly Adapter (007D) and compares the result against the
// independently-authored `expected` canonical fact for that scenario,
// using the equivalence rules fixed in 007C Bloque 5: comparison is by
// financial fact (hecho financiero, importe, moneda, dirección, obligación
// asociada, estado económico, saldo restante, idempotencia, trazabilidad,
// occurrenceId/agreementId cuando exista) — never byte-for-byte structural
// equality, and never a comparator that re-derives the adapter's own logic.
//
// This script NEVER calls recordPayment/confirmPayment/failPayment/
// allocatePayment/reconcilePayment/voidPayable/voidReceivable, never
// touches localStorage/Supabase/any store, and never persists anything —
// it only reads the fixture, calls the adapter's pure translate*
// functions, and compares plain objects in memory.

import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
global.window = global;
require(path.join(process.cwd(), 'web/js/mdj-financial-legacy-readonly-adapter.js'));
require(path.join(process.cwd(), 'web/js/mdj-financial-equivalence-fixture.js'));

const Adapter = global.MDJFinancialLegacyReadonlyAdapter;
const SCENARIOS = global.MDJFinancialEquivalenceFixture.SCENARIOS;

function fieldsMatch(actual, expectedFields) {
  const divergences = [];
  if (expectedFields === null || expectedFields === undefined) {
    if (actual !== null && actual !== undefined) {
      divergences.push('expected null/absent but adapter produced a value');
    }
    return divergences;
  }
  if (actual === null || actual === undefined) {
    divergences.push('expected a value but adapter produced null/absent');
    return divergences;
  }
  Object.keys(expectedFields).forEach((key) => {
    const expectedValue = expectedFields[key];
    const actualValue = actual[key];
    if (actualValue !== expectedValue) {
      divergences.push(`field "${key}": expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`);
    }
  });
  return divergences;
}

function unmappedDiff(actualUnmapped, expectedUnmappedFields) {
  const actualSet = new Set((actualUnmapped || []).map((u) => u.field));
  const expectedSet = new Set(expectedUnmappedFields || []);
  const missing = [...expectedSet].filter((f) => !actualSet.has(f)); // expected but not flagged -> divergence
  const unexpected = [...actualSet].filter((f) => !expectedSet.has(f)); // flagged but not anticipated -> divergence
  const matched = [...expectedSet].filter((f) => actualSet.has(f));
  return { missing, unexpected, matched };
}

function traceabilityOk(actual, legacy, idField) {
  if (!actual) return [];
  const divergences = [];
  if (actual.sourceLegacyId !== legacy.id) {
    divergences.push(`sourceLegacyId mismatch: expected "${legacy.id}", got "${JSON.stringify(actual.sourceLegacyId)}"`);
  }
  if (idField && typeof actual.id === 'string' && actual.id.indexOf('legacy:') !== 0) {
    divergences.push(`id "${actual.id}" is not a synthetic legacy: id — risk of colliding with a real canonical-store id`);
  }
  return divergences;
}

function runPaymentScenario(scenario) {
  const res = Adapter.translateLegacyPayment(scenario.legacy);
  let divergences = [];

  divergences = divergences.concat(fieldsMatch(res.canonicalPayment, scenario.expected.canonicalPayment).map((d) => 'canonicalPayment.' + d));
  divergences = divergences.concat(fieldsMatch(res.canonicalPayable, scenario.expected.canonicalPayable).map((d) => 'canonicalPayable.' + d));
  divergences = divergences.concat(traceabilityOk(res.canonicalPayment, scenario.legacy).map((d) => 'canonicalPayment.' + d));
  divergences = divergences.concat(traceabilityOk(res.canonicalPayable, scenario.legacy).map((d) => 'canonicalPayable.' + d));

  const unmapped = unmappedDiff(res.unmapped, scenario.expectedUnmappedFields);
  if (unmapped.missing.length) divergences.push('UNMAPPED_MISSING: expected fields not flagged: ' + unmapped.missing.join(', '));
  if (unmapped.unexpected.length) divergences.push('UNMAPPED_UNEXPECTED: fields flagged that were not anticipated: ' + unmapped.unexpected.join(', '));

  return { divergences, unmapped, raw: res };
}

function runVenuePaymentScenario(scenario) {
  const res = Adapter.translateLegacyVenuePayment(scenario.legacy);
  let divergences = fieldsMatch(res.canonicalVenueReceivable, scenario.expected.canonicalVenueReceivable).map((d) => 'canonicalVenueReceivable.' + d);
  divergences = divergences.concat(traceabilityOk(res.canonicalVenueReceivable, scenario.legacy).map((d) => 'canonicalVenueReceivable.' + d));

  const unmapped = unmappedDiff(res.unmapped, scenario.expectedUnmappedFields);
  if (unmapped.missing.length) divergences.push('UNMAPPED_MISSING: ' + unmapped.missing.join(', '));
  if (unmapped.unexpected.length) divergences.push('UNMAPPED_UNEXPECTED: ' + unmapped.unexpected.join(', '));

  return { divergences, unmapped, raw: res };
}

function runRecurringScenario(scenario) {
  const res = Adapter.translateLegacyRecurringPayment(scenario.legacy);
  let divergences = [];
  if (res.canonicalEntity !== scenario.expected.canonicalEntity) {
    divergences.push(`canonicalEntity: expected ${JSON.stringify(scenario.expected.canonicalEntity)}, got ${JSON.stringify(res.canonicalEntity)}`);
  }
  if (scenario.expected.normalizedAmountCents !== undefined && (!res.normalized || res.normalized.amountCents !== scenario.expected.normalizedAmountCents)) {
    divergences.push(`normalized.amountCents: expected ${scenario.expected.normalizedAmountCents}, got ${res.normalized && res.normalized.amountCents}`);
  }
  if (res.normalized && res.normalized.sourceLegacyId !== scenario.legacy.id) {
    divergences.push('normalized.sourceLegacyId mismatch');
  }

  const unmapped = unmappedDiff(res.unmapped, scenario.expectedUnmappedFields);
  if (unmapped.missing.length) divergences.push('UNMAPPED_MISSING: ' + unmapped.missing.join(', '));
  if (unmapped.unexpected.length) divergences.push('UNMAPPED_UNEXPECTED: ' + unmapped.unexpected.join(', '));

  return { divergences, unmapped, raw: res };
}

function runAllocationScenario(scenario) {
  const res = Adapter.translateLegacyPaymentAllocation(scenario.legacy);
  let divergences = fieldsMatch(res.canonicalPaymentAllocation, scenario.expected.canonicalPaymentAllocation).map((d) => 'canonicalPaymentAllocation.' + d);
  divergences = divergences.concat(traceabilityOk(res.canonicalPaymentAllocation, scenario.legacy).map((d) => 'canonicalPaymentAllocation.' + d));

  if (scenario.idempotencyCheck) {
    const replay = Adapter.translateLegacyPaymentAllocation(scenario.legacy);
    if (replay.canonicalPaymentAllocation.idempotencyKey !== res.canonicalPaymentAllocation.idempotencyKey) {
      divergences.push('IDEMPOTENCY_LOST: repeated translation of the same legacy allocation produced a different idempotencyKey');
    }
    if (!res.canonicalPaymentAllocation.idempotencyKey) {
      divergences.push('IDEMPOTENCY_LOST: idempotencyKey is empty/null');
    }
  }

  const unmapped = unmappedDiff(res.unmapped, scenario.expectedUnmappedFields);
  if (unmapped.missing.length) divergences.push('UNMAPPED_MISSING: ' + unmapped.missing.join(', '));
  if (unmapped.unexpected.length) divergences.push('UNMAPPED_UNEXPECTED: ' + unmapped.unexpected.join(', '));

  return { divergences, unmapped, raw: res };
}

const RUNNERS = {
  payment: runPaymentScenario,
  venuePayment: runVenuePaymentScenario,
  recurring: runRecurringScenario,
  allocation: runAllocationScenario
};

const results = [];

SCENARIOS.forEach((scenario) => {
  if (scenario.legacy === null) {
    results.push({
      scenario,
      verdict: 'NO_LEGACY_SOURCE',
      divergences: [],
      reason: scenario.noLegacySourceReason || 'NO_LEGACY_SOURCE (reason not documented — fixture defect)'
    });
    return;
  }

  const runner = RUNNERS[scenario.kind];
  if (!runner) {
    results.push({ scenario, verdict: 'DIVERGENT', divergences: [`unknown scenario kind "${scenario.kind}"`] });
    return;
  }

  const { divergences, unmapped } = runner(scenario);
  const hasUnmappedIntent = (scenario.expectedUnmappedFields || []).length > 0;
  const verdict = divergences.length > 0 ? 'DIVERGENT' : (hasUnmappedIntent ? 'UNMAPPED_LEGITIMATE' : 'EQUIVALENT');
  results.push({ scenario, verdict, divergences, unmapped });
});

/* ---------------------------------------------------------------------
 * Report
 * ------------------------------------------------------------------- */
console.log('=== TICKET-V1-FINANCIAL-LEGACY-CANONICAL-EQUIVALENCE-HARNESS-007E ===\n');

results.forEach((r) => {
  const label = `[${String(r.scenario.id).padStart(2, '0')}] ${r.scenario.name}`;
  console.log(`${r.verdict === 'DIVERGENT' ? 'FAIL' : 'PASS'}  ${label}  -> ${r.verdict}`);
  if (r.verdict === 'NO_LEGACY_SOURCE') {
    console.log('        ' + r.reason);
  }
  if (r.divergences && r.divergences.length) {
    r.divergences.forEach((d) => console.log('        DIVERGENCE: ' + d));
  }
});

const equivalentPass = results.filter((r) => r.verdict === 'EQUIVALENT' || r.verdict === 'UNMAPPED_LEGITIMATE').length;
const equivalentFail = results.filter((r) => r.verdict === 'DIVERGENT').length;
const noLegacySource = results.filter((r) => r.verdict === 'NO_LEGACY_SOURCE').length;

let unmappedExpectedCount = 0;
let unmappedUnexpectedCount = 0;
results.forEach((r) => {
  if (r.unmapped) {
    unmappedExpectedCount += r.unmapped.matched.length;
    unmappedUnexpectedCount += r.unmapped.unexpected.length;
  }
});

console.log('\n=== RESUMEN ===');
console.log(`Equivalencias PASS: ${equivalentPass} / ${results.length}`);
console.log(`Equivalencias FAIL: ${equivalentFail} / ${results.length}`);
console.log(`NO_LEGACY_SOURCE (coverage gaps legítimos, no contados como PASS ni FAIL): ${noLegacySource}`);
console.log(`UNMAPPED esperados (campos anticipados y correctamente señalizados): ${unmappedExpectedCount}`);
console.log(`UNMAPPED inesperados (campos señalizados sin anticipar — señal de divergencia): ${unmappedUnexpectedCount}`);
console.log(`Cobertura total: ${results.length} / ${SCENARIOS.length} escenarios ejecutados (20 requeridos por el ticket)`);

const overallFail = equivalentFail > 0 || unmappedUnexpectedCount > 0;
console.log('\n' + (overallFail ? 'RESULT: FAIL' : 'RESULT: ALL EQUIVALENCES VERIFIED'));
process.exit(overallFail ? 1 : 0);
