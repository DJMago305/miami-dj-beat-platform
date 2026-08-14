# Motor BFI — Fase 0: Inventario de módulos a traer
**Miami DJ Beat LLC · Business Financial Intelligence**

> **Qué es esto:** el inventario PRECISO de qué módulos financieros traer del worktree
> `MiamiDJBeat-V1-offline-payment` hacia el proyecto principal, **y en qué orden.**
> **Regla:** una sola dirección (traer HACIA aquí, nunca al revés). **Nada se ejecuta ni
> se mueve todavía** — cada paso requiere autorización individual del PO.
> **Fecha:** 2026-08-14 · Orden basado en el §20 del doc canónico de arquitectura.

---

## Fuente del orden

El propio doc `docs/architecture/MIAMI-DJ-BEAT-V1-CANONICAL-FINANCIAL-ARCHITECTURE.md`
define en **§20** el orden de implementación (15 pasos) y en **§21** los 10 gates
obligatorios antes de tocar el `accounting-module.js` legacy. Este inventario mapea
cada archivo real a ese orden.

---

## Inventario completo (18 módulos + 3 migraciones)

Estado: **🟠 solo en offline** (candidato a traer) · **🟢 ya en el principal** (no traer).

### Grupo A — Núcleo canónico del motor  · TRAER PRIMERO
Orden interno por dependencia (§20 pasos 2–5):

| # | Módulo | Líneas | §20 | Rol |
|---|---|---|---|---|
| 1 | `mdj-financial-legacy-readonly-adapter.js` | 665 | 2 | Lee el legacy sin escribir — base para comparar. |
| 2 | `mdj-financial-local-services.js` | **1.225** | 3 | **EL MOTOR** — comandos idempotentes, allocations, balances, reconciliación. |
| 3 | `mdj-financial-domain-events.js` | 573 | 4–5 | Contrato de eventos de dominio + outbox. |
| 4 | `mdj-financial-projection-sync.js` | 90 | 5 | Proyecciones (read-models) desde los eventos. |
| 5 | `mdj-financial-canonical-shadow-writer.js` | 1.107 | 5–12 | Escribe el modelo canónico en paralelo (bridge). **Depende de #1 y #2.** |
| 6 | `mdj-accounting-financial-runtime.js` | 107 | — | Runtime contable que orquesta el motor. |

Todos 🟠 solo en offline. Cada uno trae su `.local-selftest.mjs`.

### Grupo B — Validación / equivalencia  · TRAER CON EL NÚCLEO
Son el arnés que PRUEBA que el modelo nuevo == el legacy (§20 pasos 6–9):

| Módulo | Líneas | §20 | Rol |
|---|---|---|---|
| `mdj-financial-equivalence-fixture.js` | 350 | 8 | Fixture de equivalencia. |
| `mdj-financial-equivalence-harness.mjs` | 213 | 9 | Arnés de equivalencia. |
| `mdj-financial-canonical-equivalence-fixture-007C.mjs` | 677 | 9 | Fixture equivalencia canónica (T007C). |
| `mdj-financial-canonical-equivalence-harness-007C.mjs` | 426 | 9 | Arnés canónico (T007C). |
| `mdj-financial-adapter-cross-validation-fixture-007D.mjs` | 415 | 9 | Fixture cross-validation adapter (T007D). |
| `mdj-financial-adapter-cross-validation-harness-007D.mjs` | 354 | 9 | Arnés cross-validation (T007D). |
| `fixtures/mdj-financial-legacy-adapter.synthetic.json` | 70 | 8 | Fixture anonimizado. |

### Grupo C — Puente legacy / migración  · TRAER DESPUÉS DEL NÚCLEO
Para el export/import y el corte (§20 paso 12, §19 bridge):

| Módulo | Líneas | §20 | Rol |
|---|---|---|---|
| `mdj-financial-legacy-adapter.js` | 1.054 | 2/12 | Adapter read/write del legacy (vs. el readonly). |
| `mdj-financial-legacy-import-bridge.js` | 1.046 | 12 | Export/import local del legacy al modelo nuevo. |
| `mdj-accounting-ar-visual-validation.js` | 266 | — | Validación visual de cuentas por cobrar. |

### Grupo D — Persistencia (migraciones)  · TRAER + APLICAR SOLO CON AUTORIZACIÓN DEL GATE
| Migración | §20 | Rol |
|---|---|---|
| `20260804230000_canonical_financial_architecture_v1_ddl.sql` (13 tablas) | 13 | Esquema canónico. **"NOT AUTHORIZED for remote apply".** |
| `20260802154200_canonical_talent_taxonomy_v1.sql` | — | Taxonomía de talento (Artist Matrix). |
| `20260724143000_staff_record_lead_offline_payment.sql` | — | Registro de pago offline. |
| `docs/architecture/MIAMI-DJ-BEAT-V1-CANONICAL-FINANCIAL-ARCHITECTURE.md` | 1 | Contrato/fuente de verdad — traer como referencia. |

### Grupo E — El legacy  · NO TRAER COMO MOTOR (es lo que el nuevo reemplaza)
| Módulo | Líneas | Tratamiento |
|---|---|---|
| `accounting-module.js` | **16.875** | Módulo contable legacy que lee `localStorage`. Protegido por los **10 gates de §21**. NO se trae para usar: se **inventaría** (§20 paso 10) y se **valida equivalencia** contra él. Tocarlo = feature-flagged, acotado, reversible, con los 10 gates aprobados. |

### Ya en el principal — NO traer
`client-account.js` · `mdj-account-forms.js` · y las funciones de pago (stripe / checkout / webhook / tips / billing-portal) ya están en `miami-dj-beat-platform`.

---

## Orden de traída (secuencia accionable)

```
0.  Doc de arquitectura canónica            (referencia — traer primero)
1.  legacy-readonly-adapter                 (Grupo A #1)
2.  local-services  ← EL MOTOR              (Grupo A #2)
3.  domain-events                           (Grupo A #3)
4.  projection-sync                         (Grupo A #4)
5.  canonical-shadow-writer                 (Grupo A #5, depende de 1+2)
6.  accounting-financial-runtime            (Grupo A #6)
    ── correr los .local-selftest de cada uno: verde antes de seguir ──
7.  fixtures + harnesses de equivalencia    (Grupo B) → EVIDENCIA de que nuevo == legacy
8.  legacy-adapter + import-bridge          (Grupo C, migración/corte)
9.  DDL + taxonomy + offline-payment (SQL)  (Grupo D — SOLO diseño hasta el gate del PO)
10. accounting-module.js                    (Grupo E — NO traer; inventariar + 10 gates §21)
```

---

## Gates §21 antes de tocar `accounting-module.js` (paso 10)

1. Contrato técnico local ✅ (el doc) · 2. Legacy adapter readonly · 3. Servicios locales aislados ·
4. Tests unitarios · 5. Fixture anonimizado validado · 6. Evidencia de equivalencia ·
7. Inventario exacto de funciones a modificar · 8. Rollback local definido ·
9. Confirmación de un solo agente escritor (decisión PO) · 10. Localhost validado por el PO.

**No autoriza:** migración Supabase, SQL remoto, borrar `localStorage`, dual-write,
tocar Producción, refactor amplio. Feature-flagged, acotado, reversible.

---

## Resumen para decidir

- **Traer ya (bajo riesgo, es todo local/in-memory + tests):** Grupos **A + B** — el motor + su evidencia. Nada toca datos reales ni producción.
- **Traer después (migración):** Grupo **C**.
- **Traer pero NO aplicar sin tu OK:** Grupo **D** (la DDL — es el gate).
- **NO traer:** Grupo **E** (`accounting-module.js` legacy) hasta cumplir los 10 gates; y lo que ya está en el principal.

> Este inventario **no ejecuta ni mueve nada.** Es el mapa. El primer movimiento real
> (traer Grupo A) requiere tu autorización explícita.
