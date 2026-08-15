/**
 * TICKET-V1-FINANCIAL-CANONICAL-ALIGNMENT-PREINTEGRATION-GATES-007C — Gate 6
 * Equivalence Harness, construido exactamente según el plan del Bloque 6
 * de 007C, ejecutado contra el fixture de 18 casos del Gate 5
 * (mdj-financial-canonical-equivalence-fixture-007C.mjs).
 *
 * Qué hace:
 *   1. Carga mdj-financial-local-services.js SIN MODIFICARLO, en un sandbox
 *      restringido (mismo patrón que mdj-financial-local-services.local-selftest.mjs
 *      — sin document/localStorage/fetch/navigator).
 *   2. Para cada caso del fixture, ejecuta canonicalSetup(cmd, key) contra
 *      una tienda (store) fresca y aislada — nunca comparte estado entre
 *      casos.
 *   3. Extrae los hechos canónicos reales del store resultante (balances,
 *      estados, ledger entries) — nunca asume, siempre lee el store real.
 *   4. Compara esos hechos reales contra legacyFact + expected del fixture,
 *      aplicando los 10 criterios de equivalencia del Bloque 5 de 007C.
 *   5. Emite un veredicto EQUIVALENT/DIVERGENT por caso, con la regla
 *      exacta que falló si hay divergencia — nunca continúa silenciosamente.
 *
 * Qué NO hace (restricciones del ticket de autorización):
 *   - NO carga ni ejecuta accounting-module.js.
 *   - NO construye el Legacy Readonly Adapter (eso es Gate 2, fuera de
 *     alcance de esta autorización).
 *   - NO escribe a localStorage, Supabase, ni ningún store real.
 *   - NO modifica mdj-financial-local-services.js.
 *
 * VERSIONADO — cambiar HARNESS_VERSION en cualquier PR que modifique un
 * evaluador existente, RULES, o el runner. Estampada en cada corrida junto
 * a FIXTURE_VERSION (importada, no duplicada) — la pareja de versiones es
 * lo que identifica exactamente qué se corrió, para poder repetir la
 * misma prueba dentro de seis meses aunque ambos archivos hayan cambiado
 * de contenido para entonces.
 *
 * Run: node web/js/mdj-financial-canonical-equivalence-harness-007C.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import { execSync } from 'child_process';
import { fixtureCases, FIXTURE_VERSION } from './mdj-financial-canonical-equivalence-fixture-007C.mjs';

const HARNESS_VERSION = '1.0.0';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modPath = path.join(__dirname, 'mdj-financial-local-services.js');
const src = fs.readFileSync(modPath, 'utf8');

function safeGit(cmd) {
  try {
    return execSync(cmd, { cwd: __dirname, encoding: 'utf8' }).trim();
  } catch (e) {
    return '(git no disponible: ' + String((e && e.message) || e) + ')';
  }
}

/* Sandbox idéntico al de mdj-financial-local-services.local-selftest.mjs —
 * cualquier acceso a document/localStorage/fetch lanza. */
const windowStub = {};
windowStub.window = windowStub;
windowStub.globalThis = windowStub;
const sandbox = {
  window: windowStub,
  globalThis: windowStub,
  console,
  Date, Math, String, Number, Object, Array, JSON, Error, isFinite, isNaN
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const Mod = windowStub.MDJFinancialLocalServices;
if (!Mod) throw new Error('FATAL: MDJFinancialLocalServices no cargó en el sandbox — abortando, no se puede validar nada.');
const svc = Mod.createLocalFinancialServices();

/* ------------------------------------------------------------------------
 * Runner por caso — store fresca, clock determinístico, idGen determinístico.
 * ---------------------------------------------------------------------- */
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
  const log = [];
  function cmd(name, input) {
    const fullInput = Object.assign({}, input, { now: clock(), idGenerator: idGen });
    const out = svc.commands[name](store, fullInput);
    store = out.store;
    log.push({ cmd: name, ok: out.result.ok, errorCode: out.result.errorCode || null });
    return out.result;
  }
  let seq = 0;
  function key(label) { seq++; return caseId + '-' + label + '-' + seq; }
  return { cmd, key, getStore: () => store, log };
}

/* ------------------------------------------------------------------------
 * Criterios de equivalencia — Bloque 5 de 007C, 10 puntos. Cada checker
 * devuelve { rule, pass, detail }.
 * ---------------------------------------------------------------------- */
const RULES = {
  R1_FACT: 'R1 — Hecho financiero (que el movimiento/obligación existe)',
  R2_AMOUNT: 'R2 — Importe (mismo valor, normalizado a centavos)',
  R3_CURRENCY: 'R3 — Moneda (idéntica tras normalización)',
  R4_DIRECTION: 'R4 — Dirección (INFLOW/OUTFLOW)',
  R5_OBLIGATION: 'R5 — Obligación asociada (Payable/VenueReceivable o surrogate)',
  R6_STATE: 'R6 — Estado económico (por significado, no por nombre)',
  R7_BALANCE: 'R7 — Saldo restante (mismo cálculo en ambos lados)',
  R8_TRACE: 'R8 — Trazabilidad (mismas referencias, aunque difieran los nombres de campo)',
  R9_IDEMPOTENCY: 'R9 — Idempotencia (misma clave lógica → mismo resultado)',
  R10_LINK: 'R10 — Occurrence/Agreement (mismo vínculo operativo, cuando exista en ambos lados)'
};

function check(rule, pass, detail) {
  return { rule, pass, detail };
}

/* ------------------------------------------------------------------------
 * Un evaluador dedicado por caso (Bloque 6: "un comparador dedicado por
 * tipo de hecho, nunca un deepEqual genérico" — las formas nunca son
 * idénticas por diseño).
 * ---------------------------------------------------------------------- */
const evaluators = {
  case01_payable_open(fixture, r, store) {
    const p = r.payable.data;
    const balance = svc.queries.getPayableBalance(store, p.id);
    const legacyCents = Math.round(fixture.legacyFact.amount * 100);
    return [
      check(RULES.R1_FACT, r.payable.ok === true, 'createPayable debe tener éxito'),
      check(RULES.R2_AMOUNT, p.amountCents === fixture.expected.amountCents && p.amountCents === legacyCents,
        `canónico=${p.amountCents} legacy=${legacyCents} esperado=${fixture.expected.amountCents}`),
      check(RULES.R3_CURRENCY, p.currency === fixture.expected.currency && p.currency === fixture.legacyFact.currency,
        `canónico=${p.currency} legacy=${fixture.legacyFact.currency}`),
      check(RULES.R6_STATE, p.status === 'PENDING', `status canónico=${p.status} (legacy 'pending' → OPEN/PENDING)`),
      check(RULES.R7_BALANCE, balance === fixture.expected.remainingCents, `balance=${balance} esperado=${fixture.expected.remainingCents}`)
    ];
  },

  case02_payable_partially_paid(fixture, r, store) {
    const p = r.payout.data.payable;
    const balance = svc.queries.getPayableBalance(store, p.id);
    const legacyPaid = Math.round(fixture.legacyFact.paidAmount * 100);
    const legacyRemaining = Math.round((fixture.legacyFact.amount - fixture.legacyFact.paidAmount) * 100);
    return [
      check(RULES.R1_FACT, r.payout.ok === true, 'recordOwnerPayout debe tener éxito'),
      check(RULES.R2_AMOUNT, r.payout.data.payment.amountCents === legacyPaid, `pago canónico=${r.payout.data.payment.amountCents} legacy.paidAmount=${legacyPaid}`),
      check(RULES.R6_STATE, p.status === 'PARTIALLY_PAID', `status canónico=${p.status} (legacy 'partial' → PARTIALLY_PAID)`),
      check(RULES.R7_BALANCE, balance === legacyRemaining && balance === fixture.expected.remainingCents,
        `balance=${balance} legacy.remaining=${legacyRemaining} esperado=${fixture.expected.remainingCents}`)
    ];
  },

  case03_payable_paid(fixture, r, store) {
    const p = r.payout.data.payable;
    const balance = svc.queries.getPayableBalance(store, p.id);
    return [
      check(RULES.R1_FACT, r.payout.ok === true, 'recordOwnerPayout debe tener éxito'),
      check(RULES.R6_STATE, p.status === 'PAID', `status canónico=${p.status} (legacy 'paid' → PAID)`),
      check(RULES.R7_BALANCE, balance === 0 && balance === fixture.expected.remainingCents, `balance=${balance} esperado=0`)
    ];
  },

  case04_receivable_open(fixture, r, store) {
    const rec = r.receivable.data;
    const balance = svc.queries.getReceivableBalance(store, rec.id);
    const legacyCents = Math.round(fixture.legacyFact.amount * 100);
    return [
      check(RULES.R1_FACT, r.receivable.ok === true, 'createVenueReceivable debe tener éxito'),
      check(RULES.R2_AMOUNT, rec.amountCents === legacyCents, `canónico=${rec.amountCents} legacy=${legacyCents}`),
      check(RULES.R6_STATE, rec.status === 'OPEN', `status canónico=${rec.status} (legacy 'pending' → OPEN)`),
      check(RULES.R7_BALANCE, balance === fixture.expected.remainingCents, `balance=${balance} esperado=${fixture.expected.remainingCents}`),
      check(RULES.R10_LINK, !!rec.occurrenceId, 'receivable debe llevar occurrenceId')
    ];
  },

  case05_receivable_partially_collected(fixture, r, store) {
    const rec = r.alloc.data.target;
    const balance = svc.queries.getReceivableBalance(store, rec.id);
    const legacyRemaining = Math.round((fixture.legacyFact.amount - fixture.legacyFact.receivedAmount) * 100);
    return [
      check(RULES.R1_FACT, r.alloc.ok === true, 'allocatePayment debe tener éxito'),
      check(RULES.R4_DIRECTION, r.payment.data.direction === 'INFLOW', 'cobro de venue debe ser INFLOW'),
      check(RULES.R6_STATE, rec.status === 'PARTIALLY_PAID', `status canónico=${rec.status} (legacy 'partially_received' → PARTIALLY_PAID)`),
      check(RULES.R7_BALANCE, balance === legacyRemaining && balance === fixture.expected.remainingCents,
        `balance=${balance} legacy.remaining=${legacyRemaining}`)
    ];
  },

  case06_receivable_paid(fixture, r, store) {
    const rec = r.alloc.data.target;
    const balance = svc.queries.getReceivableBalance(store, rec.id);
    return [
      check(RULES.R6_STATE, rec.status === 'PAID', `status canónico=${rec.status} (legacy 'received' → PAID)`),
      check(RULES.R7_BALANCE, balance === 0, `balance=${balance} esperado=0`)
    ];
  },

  case07_payment_pending(fixture, r, store) {
    const p = r.payment.data;
    const eff = svc.queries.getPaymentEffectiveStatus(store, p.id);
    const legacyCents = Math.round(fixture.legacyFact.amount * 100);
    return [
      check(RULES.R1_FACT, r.payment.ok === true, 'recordPayment debe tener éxito'),
      check(RULES.R2_AMOUNT, p.amountCents === legacyCents, `canónico=${p.amountCents} legacy=${legacyCents}`),
      check(RULES.R6_STATE, eff === 'PENDING', `estado efectivo=${eff} (legacy 'scheduled' → PENDING, no confirmado)`)
    ];
  },

  case08_payment_confirmed(fixture, r, store) {
    const p = r.confirm.data.payment;
    const eff = svc.queries.getPaymentEffectiveStatus(store, p.id);
    const ledgerCountBefore = 0;
    const ledgerCountAfter = store.ownerLedgerEntries.length;
    return [
      check(RULES.R1_FACT, r.confirm.ok === true, 'confirmPayment debe tener éxito'),
      check(RULES.R6_STATE, eff === 'CONFIRMED', `estado efectivo=${eff} (legacy 'paid' → CONFIRMED)`),
      check(RULES.R8_TRACE, ledgerCountAfter > ledgerCountBefore, `OwnerLedgerEntry generado: ${ledgerCountAfter} entradas (esperado >=1)`)
    ];
  },

  case09_payment_failed(fixture, r, store) {
    const p = r.fail.data;
    const eff = svc.queries.getPaymentEffectiveStatus(store, p.id);
    return [
      check(RULES.R1_FACT, r.fail.ok === true, 'failPayment debe tener éxito'),
      check(RULES.R6_STATE, eff === 'FAILED', `estado efectivo=${eff} (legacy 'failed' → FAILED)`)
    ];
  },

  case10_allocation_both_target_types(fixture, r, store) {
    const a = r.allocReceivable.data.allocation;
    const b = r.allocPayable.data.allocation;
    return [
      check(RULES.R1_FACT, r.allocReceivable.ok === true && r.allocPayable.ok === true, 'ambas allocations deben tener éxito'),
      check(RULES.R2_AMOUNT, a.amountCents === fixture.expected.allocationA.amountCents, `alloc A=${a.amountCents} esperado=${fixture.expected.allocationA.amountCents}`),
      check(RULES.R2_AMOUNT, b.amountCents === fixture.expected.allocationB.amountCents, `alloc B=${b.amountCents} esperado=${fixture.expected.allocationB.amountCents}`),
      check(RULES.R5_OBLIGATION, a.targetType === 'VENUE_RECEIVABLE', `targetType A=${a.targetType}`),
      check(RULES.R5_OBLIGATION, b.targetType === 'PAYABLE', `targetType B=${b.targetType}`)
    ];
  },

  case11_recurring_instance(fixture, r, store) {
    const p = r.payment.data;
    const legacyCents = Math.round(fixture.legacyFact.generatedInstance.amount * 100);
    return [
      check(RULES.R1_FACT, r.payment.ok === true, 'la instancia generada debe materializarse como Payment normal'),
      check(RULES.R2_AMOUNT, p.amountCents === legacyCents, `canónico=${p.amountCents} legacy.instancia=${legacyCents}`),
      check(RULES.R6_STATE, true, 'el motor de recurrencia (Scheduler) no tiene entidad canónica propia — KEEP por diseño, 007C Bloque 2. Solo se compara la instancia generada.')
    ];
  },

  case12_hybrid_partial_three_pieces(fixture, r, store) {
    const payable = r.alloc.data.target;
    const payment = r.confirm.data.payment;
    const alloc = r.alloc.data.allocation;
    const balance = svc.queries.getPayableBalance(store, payable.id);
    const eff = svc.queries.getPaymentEffectiveStatus(store, payment.id);
    return [
      check(RULES.R1_FACT, r.alloc.ok === true, 'las 3 piezas (Payable+Payment+Allocation) deben existir'),
      check(RULES.R6_STATE, eff === 'CONFIRMED', `Payment.effectiveStatus=${eff} — NUNCA "PARTIAL" (no existe en el Core, regla explícita Bloque 5)`),
      check(RULES.R6_STATE, payable.status === fixture.expected.payableEconomicState, `Payable.status=${payable.status} esperado=${fixture.expected.payableEconomicState}`),
      check(RULES.R7_BALANCE, balance === fixture.expected.payableRemainingCents, `balance=${balance} esperado=${fixture.expected.payableRemainingCents}`),
      check(RULES.R2_AMOUNT, alloc.amountCents < payable.amountCents, `allocation(${alloc.amountCents}) < payable.amountCents(${payable.amountCents}) — composición de 3 piezas, no 1:1`)
    ];
  },

  case13_venuepayment_legacy_pending(fixture, r, store) {
    const rec = r.receivable.data;
    const balance = svc.queries.getReceivableBalance(store, rec.id);
    return [
      check(RULES.R6_STATE, rec.status === 'OPEN', `status canónico=${rec.status} (legacy venuePayment 'pending' → VenueReceivable OPEN)`),
      check(RULES.R7_BALANCE, balance === fixture.expected.remainingCents, `balance=${balance} esperado=${fixture.expected.remainingCents}`)
    ];
  },

  case14_currency_mismatch(fixture, r, store) {
    const res = r.allocAttempt;
    return [
      check(RULES.R3_CURRENCY, res.ok === false && res.errorCode === 'CURRENCY_MISMATCH',
        `ok=${res.ok} errorCode=${res.errorCode} — el Core SÍ bloquea moneda mixta en la asignación (comportamiento propio, no derivado de legacy)`)
    ];
  },

  case15_idempotency_replay(fixture, r, store) {
    const paymentsCount = store.payments.length;
    return [
      check(RULES.R9_IDEMPOTENCY, r.first.ok === true && r.first.idempotentReplay === false, 'primera llamada debe crear la entidad'),
      check(RULES.R9_IDEMPOTENCY, r.second.ok === true && r.second.idempotentReplay === true, 'segunda llamada (misma key+payload) debe ser replay, no una entidad nueva'),
      check(RULES.R9_IDEMPOTENCY, paymentsCount === 1, `store.payments.length=${paymentsCount} — debe ser 1, nunca 2`)
    ];
  },

  case16_occurrenceId_present_and_absent(fixture, r, store) {
    const withOcc = r.receivableWithOcc.data;
    const withoutOcc = r.payableWithoutOcc.data;
    return [
      check(RULES.R10_LINK, !!withOcc.occurrenceId, 'receivable con occurrence debe llevar occurrenceId'),
      check(RULES.R10_LINK, withoutOcc.sourceType === 'EXPENSE' && withoutOcc.sourceId == null,
        `payable sin occurrence: sourceType=${withoutOcc.sourceType} sourceId=${withoutOcc.sourceId} — null explícito, nunca inferido`)
    ];
  },

  case17_agreementId_present_and_absent(fixture, r, store) {
    const withAgr = r.occWithAgreement.data.occurrence;
    const withoutAgr = r.occOneOff.data.occurrence;
    return [
      check(RULES.R10_LINK, withAgr.agreementId === r.agreement.data.id, `occurrence con agreement: agreementId=${withAgr.agreementId}`),
      check(RULES.R10_LINK, withoutAgr.agreementId == null, `occurrence one-off: agreementId=${withoutAgr.agreementId} — null explícito (cobertura puntual, ya documentada como no conectada en runtime real)`)
    ];
  },

  case18_incomplete_legacy_data(fixture, r, store) {
    const p = r.payment.data;
    const unallocated = svc.queries.getUnallocatedPaymentAmount(store, p.id);
    return [
      check(RULES.R1_FACT, r.payment.ok === true, 'recordPayment debe tener éxito incluso con datos legacy incompletos'),
      check(RULES.R2_AMOUNT, unallocated === p.amountCents, `sin allocations, no asignado=${unallocated} debe igualar el monto total (paidAmount ausente tratado como 0 en ambos lados)`),
      check(RULES.R8_TRACE, p.reference === undefined || p.reference === null, `reference canónico=${JSON.stringify(p.reference)} — ausente, nunca fabricado`)
    ];
  }
};

/* ------------------------------------------------------------------------
 * Ejecución
 * ---------------------------------------------------------------------- */
const report = [];
let overallPass = true;

for (const fixture of fixtureCases) {
  const runner = freshRunner(fixture.id);
  let results;
  let setupError = null;
  try {
    results = fixture.canonicalSetup(runner.cmd, runner.key);
  } catch (e) {
    setupError = String((e && e.stack) || e);
  }

  let checks = [];
  if (setupError) {
    checks = [check('SETUP', false, 'canonicalSetup lanzó una excepción: ' + setupError)];
  } else {
    const evaluator = evaluators[fixture.id];
    if (!evaluator) {
      checks = [check('EVALUATOR', false, 'no existe evaluador para este caso — FALLA POR DISEÑO, no se asume PASS')];
    } else {
      try {
        checks = evaluator(fixture, results, runner.getStore());
      } catch (e) {
        checks = [check('EVALUATOR', false, 'el evaluador lanzó una excepción: ' + String((e && e.stack) || e))];
      }
    }
  }

  const caseVerdict = checks.every((c) => c.pass) ? 'EQUIVALENT' : 'DIVERGENT';
  if (caseVerdict === 'DIVERGENT') overallPass = false;

  report.push({
    id: fixture.id,
    bloque4Case: fixture.bloque4Case,
    title: fixture.title,
    verdict: caseVerdict,
    checks,
    commandLog: runner.log
  });
}

/* ------------------------------------------------------------------------
 * Reporte
 * ---------------------------------------------------------------------- */
const executedAtIso = new Date().toISOString();
const gitHead = safeGit('git rev-parse HEAD');
const gitBranch = safeGit('git rev-parse --abbrev-ref HEAD');
const fixtureDirty = safeGit('git status --porcelain -- mdj-financial-canonical-equivalence-fixture-007C.mjs') !== '';
const harnessDirty = safeGit('git status --porcelain -- mdj-financial-canonical-equivalence-harness-007C.mjs') !== '';
const coreDirty = safeGit('git status --porcelain -- mdj-financial-local-services.js') !== '';

console.log('='.repeat(100));
console.log('GATE 6 — EQUIVALENCE HARNESS — TICKET-V1-FINANCIAL-CANONICAL-ALIGNMENT-PREINTEGRATION-GATES-007C');
console.log('='.repeat(100));
console.log(`Executed at (UTC):     ${executedAtIso}`);
console.log(`Repo HEAD:             ${gitHead}${coreDirty ? '  [WARNING: mdj-financial-local-services.js has uncommitted changes]' : ''}`);
console.log(`Branch:                ${gitBranch}`);
console.log(`Fixture version:       ${FIXTURE_VERSION}${fixtureDirty ? '  [uncommitted]' : '  [clean]'}`);
console.log(`Harness version:       ${HARNESS_VERSION}${harnessDirty ? '  [uncommitted]' : '  [clean]'}`);
console.log('='.repeat(100));

for (const r of report) {
  console.log('');
  console.log(`[Caso ${String(r.bloque4Case).padStart(2, '0')}] ${r.id} — ${r.title}`);
  console.log(`  Veredicto: ${r.verdict}`);
  for (const c of r.checks) {
    const mark = c.pass ? 'PASS' : 'FAIL';
    console.log(`    [${mark}] ${c.rule}`);
    console.log(`           ${c.detail}`);
  }
}

const equivalentCount = report.filter((r) => r.verdict === 'EQUIVALENT').length;
const divergentCount = report.filter((r) => r.verdict === 'DIVERGENT').length;

console.log('');
console.log('='.repeat(100));
console.log(`RESUMEN: ${equivalentCount}/${report.length} EQUIVALENT, ${divergentCount}/${report.length} DIVERGENT`);
console.log('='.repeat(100));

if (overallPass) {
  console.log('PASS — FIXTURE MATERIALIZED / CANONICAL EQUIVALENCE VERIFIED');
} else {
  console.log('FAIL — MATERIAL EQUIVALENCE GAP FOUND');
  console.log('');
  console.log('Casos divergentes:');
  for (const r of report.filter((x) => x.verdict === 'DIVERGENT')) {
    console.log(`  - [Caso ${r.bloque4Case}] ${r.id}: ${r.checks.filter((c) => !c.pass).map((c) => c.rule).join('; ')}`);
  }
}

process.exit(overallPass ? 0 : 1);
