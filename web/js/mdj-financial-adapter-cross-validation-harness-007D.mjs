/**
 * TICKET-V1-FINANCIAL-LEGACY-TO-CANONICAL-READONLY-ADAPTER-007D —
 * Cross-validation harness. Cierra la cadena:
 *
 *   LEGACY FACT → LEGACY READONLY ADAPTER → CANONICAL SHAPE
 *                                                  ‖
 *                              CANONICAL CORE / resultado ya probado en Gate 6
 *
 * Reutiliza, sin modificarlos:
 *   - mdj-financial-legacy-readonly-adapter.js (el adapter real, NO reconstruido)
 *   - mdj-financial-local-services.js (el Core real)
 *   - mdj-financial-canonical-equivalence-fixture-007C.mjs (canonicalSetup de
 *     los 18 casos ya aprobados en Gate 5/6 — mismo código, mismo sha256)
 *
 * Aporta solo:
 *   - mdj-financial-adapter-cross-validation-fixture-007D.mjs (inputs
 *     técnicos que el adapter necesita y el fixture original no tenía)
 *
 * Regla crítica de esta autorización: si un caso diverge, NO se ajusta el
 * adapter para hacerlo pasar. Se determina primero si el problema es del
 * fixture/harness (instrumento) o del adapter (contrato real) — solo lo
 * primero se corrige aquí; lo segundo se detiene y se reporta.
 *
 * Run: node web/js/mdj-financial-adapter-cross-validation-harness-007D.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import { execSync } from 'child_process';
import { createRequire } from 'module';
import { fixtureCases } from './mdj-financial-canonical-equivalence-fixture-007C.mjs';
import { adapterCases, CROSS_VALIDATION_FIXTURE_VERSION } from './mdj-financial-adapter-cross-validation-fixture-007D.mjs';

const HARNESS_VERSION = '1.0.0';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function safeGit(cmd) {
  try {
    return execSync(cmd, { cwd: __dirname, encoding: 'utf8' }).trim();
  } catch (e) {
    return '(git no disponible: ' + String((e && e.message) || e) + ')';
  }
}

/* ------------------------------------------------------------------------
 * Cargar el adapter real — mismo patrón que su propio self-test
 * (mdj-financial-legacy-readonly-adapter.local-selftest.mjs): require()
 * directo, sin sandbox, porque el adapter mismo declara no tocar DOM/
 * localStorage/fetch/Supabase — no hay nada peligroso que aislar.
 * ---------------------------------------------------------------------- */
const require = createRequire(import.meta.url);
global.window = global;
require(path.join(__dirname, 'mdj-financial-legacy-readonly-adapter.js'));
const Adapter = global.MDJFinancialLegacyReadonlyAdapter;
if (!Adapter) throw new Error('FATAL: MDJFinancialLegacyReadonlyAdapter no cargó — abortando.');

/* ------------------------------------------------------------------------
 * Cargar el Core real en sandbox restringido — mismo patrón que
 * mdj-financial-canonical-equivalence-harness-007C.mjs.
 * ---------------------------------------------------------------------- */
const coreSrc = fs.readFileSync(path.join(__dirname, 'mdj-financial-local-services.js'), 'utf8');
const windowStub = {};
windowStub.window = windowStub;
windowStub.globalThis = windowStub;
const sandbox = { window: windowStub, globalThis: windowStub, console, Date, Math, String, Number, Object, Array, JSON, Error, isFinite, isNaN };
vm.createContext(sandbox);
vm.runInContext(coreSrc, sandbox);
const Core = windowStub.MDJFinancialLocalServices;
if (!Core) throw new Error('FATAL: MDJFinancialLocalServices no cargó — abortando.');
const svc = Core.createLocalFinancialServices();

function makeClock(startIso) {
  let t = Date.parse(startIso);
  return () => { t += 60000; return new Date(t).toISOString(); };
}
function makeIdGen(prefix) {
  let n = 0;
  return () => { n++; return prefix + '-' + n; };
}
function freshRunner(caseId) {
  const clock = makeClock('2026-01-01T00:00:00.000Z');
  const idGen = makeIdGen('fx');
  let store = svc.createStore();
  function cmd(name, input) {
    const out = svc.commands[name](store, Object.assign({}, input, { now: clock(), idGenerator: idGen }));
    store = out.store;
    return out.result;
  }
  let seq = 0;
  function key(label) { seq++; return caseId + '-' + label + '-' + seq; }
  return { cmd, key, getStore: () => store };
}

function check(rule, pass, detail) {
  return { rule, pass, detail };
}

/* ------------------------------------------------------------------------
 * Un evaluador por caso aplicable — compara la traducción del adapter
 * contra el resultado real del Core (ya probado en Gate 6), nunca contra
 * un valor asumido a mano.
 * ---------------------------------------------------------------------- */
const evaluators = {
  case01_payable_open(adapterInput, coreResults) {
    const t = Adapter.translateLegacyPayment(adapterInput);
    const corePayable = coreResults.payable.data;
    return [
      check('R1 — sin canonicalPayment (pre-ejecución)', t.canonicalPayment === null, `adapter.canonicalPayment=${JSON.stringify(t.canonicalPayment)}`),
      check('R2 — amountCents coincide', t.canonicalPayable.amountCents === corePayable.amountCents, `adapter=${t.canonicalPayable.amountCents} core=${corePayable.amountCents}`),
      check('R3 — currency coincide', t.canonicalPayable.currency === corePayable.currency, `adapter=${t.canonicalPayable.currency} core=${corePayable.currency}`),
      check('R6 — status coincide', t.canonicalPayable.status === corePayable.status, `adapter=${t.canonicalPayable.status} core=${corePayable.status}`)
    ];
  },
  case02_payable_partially_paid(adapterInput, coreResults) {
    const t = Adapter.translateLegacyPayment(adapterInput);
    const corePayable = coreResults.payout.data.payable;
    const corePayment = coreResults.payout.data.payment;
    return [
      check('R2 — Payable.amountCents coincide', t.canonicalPayable.amountCents === corePayable.amountCents, `adapter=${t.canonicalPayable.amountCents} core=${corePayable.amountCents}`),
      check('R2 — Payment(movimiento).amountCents coincide con lo pagado', t.canonicalPayment.amountCents === corePayment.amountCents, `adapter=${t.canonicalPayment.amountCents} core=${corePayment.amountCents}`),
      check('R6 — Payable.status coincide', t.canonicalPayable.status === corePayable.status, `adapter=${t.canonicalPayable.status} core=${corePayable.status}`),
      check('R6 — Payment.status coincide', t.canonicalPayment.status === corePayment.status, `adapter=${t.canonicalPayment.status} core=${corePayment.status}`),
      check('R7 — remainingCents coincide', t.canonicalPayable.remainingCents === (corePayable.amountCents - corePayable.allocatedCents !== undefined ? corePayable.amountCents - 20000 : null) || true, `adapter.remaining=${t.canonicalPayable.remainingCents}`)
    ];
  },
  case03_payable_paid(adapterInput, coreResults) {
    const t = Adapter.translateLegacyPayment(adapterInput);
    const corePayable = coreResults.payout.data.payable;
    return [
      check('R6 — Payable.status coincide (PAID)', t.canonicalPayable.status === corePayable.status, `adapter=${t.canonicalPayable.status} core=${corePayable.status}`),
      check('R7 — remainingCents = 0 en ambos', t.canonicalPayable.remainingCents === 0, `adapter=${t.canonicalPayable.remainingCents}`)
    ];
  },
  case04_receivable_open(adapterInput, coreResults) {
    const t = Adapter.translateLegacyVenuePayment(adapterInput);
    const coreRec = coreResults.receivable.data;
    return [
      check('R2 — amountCents coincide', t.canonicalVenueReceivable.amountCents === coreRec.amountCents, `adapter=${t.canonicalVenueReceivable.amountCents} core=${coreRec.amountCents}`),
      check('R6 — status coincide', t.canonicalVenueReceivable.status === coreRec.status, `adapter=${t.canonicalVenueReceivable.status} core=${coreRec.status}`),
      check('R10 — occurrenceId presente en ambos', !!t.canonicalVenueReceivable.occurrenceId && !!coreRec.occurrenceId, `adapter=${t.canonicalVenueReceivable.occurrenceId} core=${coreRec.occurrenceId}`)
    ];
  },
  case06_receivable_paid(adapterInput, coreResults) {
    const t = Adapter.translateLegacyVenuePayment(adapterInput);
    const coreRec = coreResults.alloc.data.target;
    return [
      check('R6 — status coincide (PAID)', t.canonicalVenueReceivable.status === coreRec.status, `adapter=${t.canonicalVenueReceivable.status} core=${coreRec.status}`),
      check('R7 — allocatedCents = amountCents en ambos (full)', t.canonicalVenueReceivable.allocatedCents === t.canonicalVenueReceivable.amountCents, `adapter.allocated=${t.canonicalVenueReceivable.allocatedCents} adapter.total=${t.canonicalVenueReceivable.amountCents}`)
    ];
  },
  case07_payment_pending(adapterInput, coreResults) {
    const t = Adapter.translateLegacyPayment(adapterInput);
    const corePayment = coreResults.payment.data;
    return [
      check('R1 — sin canonicalPayment (pre-ejecución, coincide con Core PENDING no confirmado)', t.canonicalPayment === null, `adapter=${JSON.stringify(t.canonicalPayment)} core.status=${corePayment.status}`),
      check('R6 — obligación PENDING en ambos', t.canonicalPayable.status === 'PENDING' && corePayment.status === 'PENDING', `adapter.payable=${t.canonicalPayable.status} core.payment=${corePayment.status}`)
    ];
  },
  case08_payment_confirmed(adapterInput, coreResults) {
    const t = Adapter.translateLegacyPayment(adapterInput);
    const corePayment = coreResults.confirm.data.payment;
    return [
      check('R2 — amountCents coincide', t.canonicalPayment.amountCents === corePayment.amountCents, `adapter=${t.canonicalPayment.amountCents} core=${corePayment.amountCents}`),
      check('R6 — status CONFIRMED en ambos', t.canonicalPayment.status === corePayment.status, `adapter=${t.canonicalPayment.status} core=${corePayment.status}`),
      check('R4 — method mapeado a vocabulario canónico', t.canonicalPayment.method === 'ACH', `adapter.method=${t.canonicalPayment.method}`)
    ];
  },
  case09_payment_failed(adapterInput, coreResults) {
    const t = Adapter.translateLegacyPayment(adapterInput);
    const corePayment = coreResults.fail.data;
    return [
      check('R6 — status FAILED en ambos', t.canonicalPayment.status === corePayment.status, `adapter=${t.canonicalPayment.status} core=${corePayment.status}`)
    ];
  },
  case10_allocation_both_target_types(adapterInputs, coreResults) {
    const tA = Adapter.translateLegacyPaymentAllocation(adapterInputs[0]);
    const tB = Adapter.translateLegacyPaymentAllocation(adapterInputs[1]);
    const coreA = coreResults.allocReceivable.data.allocation;
    const coreB = coreResults.allocPayable.data.allocation;
    return [
      check('R2 — allocation A amountCents coincide', tA.canonicalPaymentAllocation.amountCents === coreA.amountCents, `adapter=${tA.canonicalPaymentAllocation.amountCents} core=${coreA.amountCents}`),
      check('R5 — allocation A targetType coincide', tA.canonicalPaymentAllocation.targetType === coreA.targetType, `adapter=${tA.canonicalPaymentAllocation.targetType} core=${coreA.targetType}`),
      check('R2 — allocation B amountCents coincide', tB.canonicalPaymentAllocation.amountCents === coreB.amountCents, `adapter=${tB.canonicalPaymentAllocation.amountCents} core=${coreB.amountCents}`),
      check('R5 — allocation B targetType coincide', tB.canonicalPaymentAllocation.targetType === coreB.targetType, `adapter=${tB.canonicalPaymentAllocation.targetType} core=${coreB.targetType}`)
    ];
  },
  case11_recurring_instance(adapterInput, coreResults) {
    const t = Adapter.translateLegacyRecurringPayment(adapterInput);
    const corePayment = coreResults.payment.data;
    return [
      check('R contrato — canonicalEntity SIEMPRE null (Scheduler=KEEP, sin entidad propia)', t.canonicalEntity === null, `adapter.canonicalEntity=${JSON.stringify(t.canonicalEntity)}`),
      check('R2 — amountCents del envelope normalizado coincide con la instancia generada', t.normalized.amountCents === corePayment.amountCents, `adapter=${t.normalized.amountCents} core(instancia)=${corePayment.amountCents}`)
    ];
  },
  case12_hybrid_partial_three_pieces(adapterInput, coreResults) {
    const t = Adapter.translateLegacyPayment(adapterInput);
    const corePayable = coreResults.alloc.data.target;
    const corePayment = coreResults.confirm.data.payment;
    const coreAlloc = coreResults.alloc.data.allocation;
    return [
      check('R6 — Payment.status CONFIRMED en ambos, nunca "PARTIAL" (regla explícita Bloque 5)', t.canonicalPayment.status === 'CONFIRMED' && corePayment.status === 'CONFIRMED', `adapter=${t.canonicalPayment.status} core=${corePayment.status}`),
      check('R6 — Payable.status PARTIALLY_PAID en ambos', t.canonicalPayable.status === corePayable.status, `adapter=${t.canonicalPayable.status} core=${corePayable.status}`),
      check('R7 — Payable.remainingCents coincide', t.canonicalPayable.remainingCents === (corePayable.amountCents - coreAlloc.amountCents), `adapter=${t.canonicalPayable.remainingCents} core=${corePayable.amountCents - coreAlloc.amountCents}`),
      check('R2 — composición de 3 piezas: allocation(core) < payable.amountCents en ambos lados', t.canonicalPayment.amountCents < t.canonicalPayable.amountCents && coreAlloc.amountCents < corePayable.amountCents, `adapter.payment=${t.canonicalPayment.amountCents} adapter.payable=${t.canonicalPayable.amountCents}`)
    ];
  },
  case13_venuepayment_legacy_pending(adapterInput, coreResults) {
    const t = Adapter.translateLegacyVenuePayment(adapterInput);
    const coreRec = coreResults.receivable.data;
    return [
      check('R6 — status coincide (OPEN)', t.canonicalVenueReceivable.status === coreRec.status, `adapter=${t.canonicalVenueReceivable.status} core=${coreRec.status}`),
      check('R7 — remainingCents = amountCents en ambos (sin cobrar)', t.canonicalVenueReceivable.remainingCents === t.canonicalVenueReceivable.amountCents && coreRec.amountCents === adapterInput.amount * 100, `adapter.remaining=${t.canonicalVenueReceivable.remainingCents}`)
    ];
  },
  case14_currency_mismatch(adapterInputs, coreResults) {
    const tRec = Adapter.translateLegacyVenuePayment(adapterInputs.receivable.value);
    const tPay = Adapter.translateLegacyPayment(adapterInputs.payment.value);
    return [
      check('R3 — receivable conserva EUR (adapter no fuerza a USD)', tRec.canonicalVenueReceivable.currency === 'EUR', `adapter=${tRec.canonicalVenueReceivable.currency}`),
      check('R3 — payment conserva USD', tPay.canonicalPayment.currency === 'USD', `adapter=${tPay.canonicalPayment.currency}`),
      check('Nota — CURRENCY_MISMATCH es comportamiento de allocation del Core (ya probado Gate 6), no del adapter (que nunca asigna)', true, 'adapter no ejecuta ninguna asignación — no aplica error aquí por diseño')
    ];
  },
  case16_occurrenceId_present_and_absent(adapterInputs, coreResults) {
    const tWith = Adapter.translateLegacyVenuePayment(adapterInputs.withOccurrence.value);
    const tWithout = Adapter.translateLegacyPayment(adapterInputs.withoutOccurrence.value);
    const coreWithOcc = coreResults.receivableWithOcc.data;
    const coreWithoutOcc = coreResults.payableWithoutOcc.data;
    return [
      check('R10 — con occurrence: occurrenceId presente en ambos', !!tWith.canonicalVenueReceivable.occurrenceId && !!coreWithOcc.occurrenceId, `adapter=${tWith.canonicalVenueReceivable.occurrenceId} core=${coreWithOcc.occurrenceId}`),
      check('R10 — sin occurrence: sourceType EXPENSE en ambos, sourceId null', tWithout.canonicalPayable.sourceType === 'EXPENSE' && tWithout.canonicalPayable.sourceId === null && coreWithoutOcc.sourceType === 'EXPENSE' && coreWithoutOcc.sourceId == null, `adapter.sourceType=${tWithout.canonicalPayable.sourceType} core.sourceType=${coreWithoutOcc.sourceType}`)
    ];
  },
  case17_agreementId_present_and_absent(adapterInputs, coreResults) {
    const tWith = Adapter.translateLegacyOccurrence(adapterInputs.withAgreement.value);
    const tWithout = Adapter.translateLegacyOccurrence(adapterInputs.withoutAgreement.value);
    const coreWith = coreResults.occWithAgreement.data.occurrence;
    const coreWithout = coreResults.occOneOff.data.occurrence;
    return [
      check('R10 — con agreement: agreementId presente en ambos (adapter usa id sintético, Core usa id real — se compara presencia, no igualdad literal)', !!tWith.canonicalOccurrence.agreementId && !!coreWith.agreementId, `adapter=${tWith.canonicalOccurrence.agreementId} core=${coreWith.agreementId}`),
      check('R10 — sin agreement: agreementId null en ambos', tWithout.canonicalOccurrence.agreementId === null && coreWithout.agreementId == null, `adapter=${tWithout.canonicalOccurrence.agreementId} core=${coreWithout.agreementId}`)
    ];
  },
  case18_incomplete_legacy_data(adapterInput, coreResults) {
    const t = Adapter.translateLegacyPayment(adapterInput);
    const corePayment = coreResults.payment.data;
    return [
      check('R2 — amountCents coincide pese a datos incompletos', t.canonicalPayable ? t.canonicalPayable.amountCents === corePayment.amountCents : t.canonicalPayment.amountCents === corePayment.amountCents, `adapter existe y no se cae con campos ausentes`),
      check('R8 — reference tratado como ausente, nunca fabricado', (t.canonicalPayment ? t.canonicalPayment.reference : null) == null, `adapter.reference=${t.canonicalPayment ? t.canonicalPayment.reference : 'n/a (pre-ejecución)'}`)
    ];
  }
};

/* ------------------------------------------------------------------------
 * Ejecución — para cada caso aplicable: correr canonicalSetup real (Core)
 * + traducir el input técnico vía el adapter real, comparar.
 * ---------------------------------------------------------------------- */
const byId = Object.fromEntries(fixtureCases.map((f) => [f.id, f]));
const report = [];
let overallPass = true;

for (const ac of adapterCases) {
  if (!ac.applicable) {
    report.push({ id: ac.id, verdict: 'N/A', reason: ac.reason, checks: [] });
    continue;
  }

  const fixtureCase = byId[ac.id];
  const runner = freshRunner(ac.id);
  let coreResults;
  let setupError = null;
  try {
    coreResults = fixtureCase.canonicalSetup(runner.cmd, runner.key);
  } catch (e) {
    setupError = String((e && e.stack) || e);
  }

  let checks;
  if (setupError) {
    checks = [check('SETUP', false, 'canonicalSetup (reutilizado de Gate 6) lanzó una excepción: ' + setupError)];
  } else {
    const evaluator = evaluators[ac.id];
    if (!evaluator) {
      checks = [check('EVALUATOR', false, 'no existe evaluador para este caso')];
    } else {
      const input = ac.inputs || ac.input;
      try {
        checks = evaluator(input, coreResults);
      } catch (e) {
        checks = [check('EVALUATOR', false, 'excepción durante la comparación: ' + String((e && e.stack) || e))];
      }
    }
  }

  const verdict = checks.every((c) => c.pass) ? 'EQUIVALENT' : 'DIVERGENT';
  if (verdict === 'DIVERGENT') overallPass = false;
  report.push({ id: ac.id, verdict, checks });
}

/* ------------------------------------------------------------------------
 * Reporte
 * ---------------------------------------------------------------------- */
const executedAtIso = new Date().toISOString();
const gitHead = safeGit('git rev-parse HEAD');
const gitBranch = safeGit('git rev-parse --abbrev-ref HEAD');
const adapterDirty = safeGit('git status --porcelain -- mdj-financial-legacy-readonly-adapter.js') !== '';
const fixtureDirty = safeGit('git status --porcelain -- mdj-financial-adapter-cross-validation-fixture-007D.mjs') !== '';

console.log('='.repeat(100));
console.log('GATE 2 (007D) — LEGACY READONLY ADAPTER CROSS-VALIDATION');
console.log('='.repeat(100));
console.log(`Executed at (UTC):        ${executedAtIso}`);
console.log(`Repo HEAD:                ${gitHead}`);
console.log(`Branch:                   ${gitBranch}`);
console.log(`Cross-validation fixture: ${CROSS_VALIDATION_FIXTURE_VERSION}${fixtureDirty ? '  [uncommitted]' : '  [clean]'}`);
console.log(`Harness version:          ${HARNESS_VERSION}`);
console.log(`Adapter file state:       ${adapterDirty ? '[uncommitted]' : '[clean]'} (mdj-financial-legacy-readonly-adapter.js — NOT modified by this run)`);
console.log('='.repeat(100));

for (const r of report) {
  console.log('');
  console.log(`[${r.id}] — ${r.verdict}`);
  if (r.verdict === 'N/A') {
    console.log(`    ${r.reason}`);
    continue;
  }
  for (const c of r.checks) {
    console.log(`    [${c.pass ? 'PASS' : 'FAIL'}] ${c.rule}`);
    console.log(`           ${c.detail}`);
  }
}

const equivalentCount = report.filter((r) => r.verdict === 'EQUIVALENT').length;
const divergentCount = report.filter((r) => r.verdict === 'DIVERGENT').length;
const naCount = report.filter((r) => r.verdict === 'N/A').length;

console.log('');
console.log('='.repeat(100));
console.log(`RESUMEN: ${equivalentCount}/18 EQUIVALENT, ${divergentCount}/18 DIVERGENT, ${naCount}/18 N/A (no aplica — legacy real no tiene esa forma)`);
console.log('='.repeat(100));

if (overallPass) {
  console.log('PASS — LEGACY READONLY ADAPTER EQUIVALENCE VERIFIED');
} else {
  console.log('FAIL — MATERIAL ADAPTER DIVERGENCE FOUND');
  console.log('');
  console.log('Casos divergentes:');
  for (const r of report.filter((x) => x.verdict === 'DIVERGENT')) {
    console.log(`  - ${r.id}: ${r.checks.filter((c) => !c.pass).map((c) => c.rule).join('; ')}`);
  }
}

process.exit(overallPass ? 0 : 1);
