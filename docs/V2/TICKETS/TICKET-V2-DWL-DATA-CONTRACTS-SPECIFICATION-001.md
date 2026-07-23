# TICKET-V2-DWL-DATA-CONTRACTS-SPECIFICATION-001

## Work Ledger Data Contracts — Specification Only (Documentation First)

| Campo | Valor |
|-------|-------|
| Ticket | V2 Work Ledger — Data Contracts Specification |
| Estado | **SPECIFICATION ONLY — DOCUMENTADO — PENDIENTE DE REVISIÓN Y APROBACIÓN PO** |
| Fase | **DWL-SPEC (DC-0)** — gobierna implementación TypeScript futura |
| Parent discovery | `TICKET-V2-DJ-WORK-LEDGER-AND-COMPENSATION-DISCOVERY-001.md` |
| Parent finance | `TICKET-V2-OFTL-DATA-CONTRACTS-001.md` · DC-1 · DC-2 discovery |
| Rama baseline | `plan/v2-phase-4-api-client` |
| HEAD baseline | `b584f9e46ca964cf7ade73d5ca1ad82050185e4d` |
| Fecha spec | 2026-07-23 |
| Ubicación objetivo futura | `MiamiDJBeat-MigracionV2/shared/services/work-ledger/contracts/` |
| Modo | **Documentación únicamente** — cero código |

---

## 0. Declaración operativa

Este ticket **no autoriza**:

- TypeScript, runtime, Supabase, migraciones, providers, repositories, adapters, servicios, UI, tests;
- captura de trabajos históricos reales, obligaciones, pagos;
- modificar perfiles, portales, OFTL, Cash Flow, Notification Center, discovery DWL committed;
- staging, commit, push, PR, merge, deploy;
- iniciar **DWL-DC-1** ni implementación de contratos.

**Estado exitoso:** especificación escrita · **un solo archivo nuevo** · **SIN CÓDIGO** · **SIN COMMIT** · esperar revisión PO.

---

## 1. Objetivo

Definir la **especificación por fases** de Data Contracts del módulo **Work Ledger & Compensation** — traduciendo el discovery aprobado en inventario de contratos, clasificación, dependency matrix, invariantes, métricas, idempotencia, versionado e implementación futura **sin escribir interfaces TypeScript**.

Los contratos futuros deben:

- tratar **`WorkRecord`** como **raíz operativa canónica** del dominio DWL;
- preservar **Person ≠ UserAccount ≠ StaffAccount ≠ ArtistProfile ≠ ProfessionalIdentity ≠ BeneficiaryParty**;
- separar **trabajo · compensación · ingreso atribuido · OFTL · Cash Flow**;
- desacoplar **Notification Center** y **Cash Flow** como lectores/proyectores — no writers;
- ser implementables siguiendo patrón `legal/contracts/` y `finance/contracts/`.

---

## 2. Alcance (este ticket)

| # | Entregable |
|---|------------|
| 1 | Este documento (único artefacto autorizado) |
| 2 | Inventario DWL-C-001…015 con clasificación |
| 3 | Responsabilidad única por contrato (§9) |
| 4 | Orden DWL-DC-1…9 (§10) |
| 5 | Dependency chain + matrix (§11–12) |
| 6 | Invariantes DWL-INV-01…15 · idempotencia · versionado |
| 7 | Métricas · privacidad · Owner/DJMago305 · agrupaciones |
| 8 | Riesgos · impact analysis · roadmap · criterios |

---

## 3. Fuera de alcance

| Item | Fase futura |
|------|-------------|
| Archivos `.ts` | DWL-DC-1+ |
| In-memory provider | DWL-SPEC-RM-12 |
| Supabase DDL / RLS | DWL-SPEC-RM-14 |
| Staff / Artist portal UI | DWL-SPEC-RM-13 |
| Captura histórica real | DWL-SPEC-RM-15 |
| Reparto compensación entre integrantes de agrupación | Contrato/fase posterior PO |
| Algoritmos definitivos de cálculo | DWL-DC-4+ |
| Propiedades TS definitivas | Reservado implementación |

---

## 4. Dependencias documentales

| Documento | Rol |
|-----------|-----|
| `TICKET-V2-DJ-WORK-LEDGER-AND-COMPENSATION-DISCOVERY-001.md` | Ley operativa DWL |
| `TICKET-V2-OFTL-DATA-CONTRACTS-001.md` | Puente financiero canónico |
| `TICKET-V2-OFTL-DC-1-CORE-FINANCIAL-CONTRACTS-001.md` | Obligation · Transaction · Leg |
| `TICKET-V2-OFTL-DC-2-PAYMENT-ALLOCATION-DISCOVERY-001.md` | Allocation · métricas CF |
| `TICKET-V2-NOTIFICATION-CENTER-DISCOVERY-001.md` | Eventos desacoplados |
| `MiamiDJBeat-MigracionV2/shared/services/legal/contracts/` | Patrón estructural (solo lectura) |
| `MiamiDJBeat-MigracionV2/shared/services/finance/contracts/` | Patrón OFTL (solo lectura) |

---

## 5. Baseline Git

| Check | Valor | Resultado |
|-------|-------|-----------|
| Rama | `plan/v2-phase-4-api-client` | ✓ |
| HEAD | `b584f9e46ca964cf7ade73d5ca1ad82050185e4d` | ✓ |
| Working tree | Limpio | ✓ |

---

## 6. Principio de identidad (obligatorio)

| Entidad | Rol |
|---------|-----|
| **Person** | Individuo legal/natural |
| **UserAccount** | Login · sesión |
| **StaffAccount** | Permisos Owner/Manager/Seller |
| **ArtistProfile** | Identidad profesional pública |
| **ProfessionalIdentity** | Marca escénica · historial artístico |
| **BeneficiaryParty** | Receptor contractual/fiscal del pago |

**Caso obligatorio — Gerardo A. Valle:** cuenta **Owner** + perfil **DJMago305** vinculados de forma segura **sin fusionar**. Trabajo artístico de Gerardo → **`artist_profile_id` = DJMago305** · `created_by` / `approved_by` puede ser cuenta Owner · **StaffAccount no es propietario artístico** del Work Record.

---

## 7. Inventario de contratos candidatos

**Regla:** no define propiedades TypeScript — solo responsabilidad, clasificación y fase.

| ID | Contrato | Clasificación | Fase | Notas |
|----|----------|---------------|------|-------|
| **DWL-C-001** | **`WorkRecord`** | **Core** | DWL-DC-1 | Raíz operativa canónica |
| **DWL-C-002** | **`WorkSession`** | **Core** | DWL-DC-1 | Sesión concreta dentro del record |
| **DWL-C-003** | **`WorkSet`** | **Supporting** | DWL-DC-2 | Solo cuando set ≠ session granularity |
| **DWL-C-004** | **`WorkAssignmentReference`** | **Core** | DWL-DC-1 | FK estable a roster planificado |
| **DWL-C-005** | **`WorkCoverageRecord`** | **Supporting** | DWL-DC-2 | Cobertura / sustitución |
| **DWL-C-006** | **`WorkEvidenceRecord`** | **Supporting** | DWL-DC-3 | Evidencia operativa |
| **DWL-C-007** | **`RevenueAttributionRecord`** | **Supporting** (analítico) | DWL-DC-5 | Atribución ingreso — **no** crea dinero |
| **DWL-C-008** | **`CompensationCalculation`** | **Supporting** | DWL-DC-4 | Cálculo pre-aprobación |
| **DWL-C-009** | **`CompensationRecord`** | **Core** (compensación) | DWL-DC-4 | Snapshot aprobado/pendiente |
| **DWL-C-010** | **`WorkApprovalRecord`** | **Supporting** | DWL-DC-3 | Aprobación / rechazo / corrección |
| **DWL-C-011** | **`ProfessionalIdentityReference`** | **Core** (identidad) | DWL-DC-1 / DC-6 | Perfil bajo el cual se trabajó |
| **DWL-C-012** | **`BeneficiaryPartyReference`** | **Supporting** | DWL-DC-6 | Payee ≠ performer profile |
| **DWL-C-013** | **`WorkMetricsSnapshot`** | **Projection** | DWL-DC-7 | Métricas versionadas — no SSOT |
| **DWL-C-014** | **`WorkLedgerDomainEvent`** | **Integration** | DWL-DC-9 | Outbox source futuro |
| **DWL-C-015** | **`WorkLedgerOFTLBridgeRequest`** | **Integration** | DWL-DC-8 | Solicitud idempotente → Obligation |

**Aplazados explícitos:** reparto multi-integrante agrupación · split compensation lines · JSON Schema export · Supabase.

---

## 8. Clasificación resumida

| Tipo | Contratos |
|------|-----------|
| **Core** | WorkRecord · WorkSession · WorkAssignmentReference · ProfessionalIdentityReference (DC-1) · CompensationRecord (core subdominio compensación, DC-4) |
| **Supporting** | WorkSet · WorkCoverageRecord · WorkEvidenceRecord · RevenueAttributionRecord · CompensationCalculation · WorkApprovalRecord · BeneficiaryPartyReference |
| **Projection** | WorkMetricsSnapshot |
| **Integration** | WorkLedgerDomainEvent · WorkLedgerOFTLBridgeRequest |

---

## 9. Responsabilidad única por contrato

Columnas abreviadas — detalle completo en discovery §4–25.

| ID | Propósito | Dominio | SSOT | Escritores futuros | Lectores futuros | Idempotencia | Fase |
|----|-----------|---------|------|-------------------|------------------|--------------|------|
| **C-001** | Hecho trabajo realizado/fallido | DWL | **Sí** | Staff workflow · Owner approve | Artist portal · reports · OFTL bridge | `work_record_id` + source key | DC-1 |
| **C-002** | Una sesión (turno/venue slice) | DWL | **Sí** | Mismo bounded write | Metrics · compensation basis | record + session seq | DC-1 |
| **C-003** | Set granular dentro de session | DWL | **Sí** | Staff | Hourly/per-set calc | session + set seq | DC-2 |
| **C-004** | Link a ArtistAssignment | DWL | Ref | Import from events | Audit | assignment_id | DC-1 |
| **C-005** | Cobertura / reemplazo | DWL | **Sí** | Staff | Coverage metrics | coverage key | DC-2 |
| **C-006** | Evidencia (doc, note, media ref) | DWL | **Sí** | Staff · Owner | Legal · audit | evidence hash/ref | DC-3 |
| **C-007** | Ingreso atribuido analítico MDJB | DWL | **Sí** (analítico) | Staff/Owner | CF projection · Owner reports | event+profile+version | DC-5 |
| **C-008** | Monto calculado pre-approve | DWL | Derivado | Calc engine (future) | Approval UI | calc run id | DC-4 |
| **C-009** | Compensación acordada/aprobada | DWL | **Sí** (comp) | Approved write | OFTL bridge · Artist | compensation id + version | DC-4 |
| **C-010** | Decisión aprobación | DWL | **Sí** | Approver staff | Audit · auto-approval rules | approval event id | DC-3 |
| **C-011** | Snapshot identidad profesional | DWL | Ref snapshot | Work write | All readers | profile_id + snapshot ver | DC-1 |
| **C-012** | Beneficiario pago | DWL | Ref | Finance staff | OFTL obligation payload | beneficiary ref id | DC-6 |
| **C-013** | Snapshot métricas | DWL | **No** (projection) | Metrics job | Portals · CF | calc_version + as_of | DC-7 |
| **C-014** | Evento dominio | DWL | Outbox | Post-commit | NC · analytics | event idempotency key | DC-9 |
| **C-015** | Pedido crear Obligation | DWL→OFTL | Request | Bridge service | OFTL writer | bridge idempotency key | DC-8 |

**Datos prohibidos en Core Work:** números de cuenta bancaria · tokens pago · clasificación fiscal definitiva · montos float canónicos · mezcla owner draw.

**Compatibilidad hacia atrás:** `schemaVersion` literal en cada contrato · migraciones additive-only.

---

## 10. Orden de implementación propuesto

| Fase | Nombre | Contratos | Objetivo |
|------|--------|-----------|----------|
| **DWL-DC-1** | Core Work Contracts | C-001 · C-002 · C-004 · C-011 · enums estados · IDs · guards mínimos | Base TS `work-ledger/contracts/` |
| **DWL-DC-2** | Sets and Coverage | C-003 · C-005 | Multi-set · cobertura sin doble compensación |
| **DWL-DC-3** | Evidence and Approval | C-006 · C-010 | Evidencia · auto-aprobación audit |
| **DWL-DC-4** | Compensation Foundation | C-008 · C-009 · CompensationBasis/Status enums | Earned ≠ paid |
| **DWL-DC-5** | Revenue Attribution | C-007 | Ingreso analítico ≠ compensación |
| **DWL-DC-6** | Identity and Beneficiary Bridge | C-012 · refinar C-011 | Payee ≠ profile · artista sin cuenta |
| **DWL-DC-7** | Metrics Projection | C-013 | Snapshots versionados |
| **DWL-DC-8** | OFTL Bridge | C-015 | Idempotent Obligation creation |
| **DWL-DC-9** | Domain Events | C-014 | NC integration desacoplada |

**Justificación:** Core operativo antes de compensación; compensación antes de puente OFTL; métricas y eventos después de hechos estables.

**Paralelo posible:** DC-5 (revenue) ∥ DC-6 (beneficiary) tras DC-4 · NC (DC-9) ∥ CF projection consumers.

---

## 11. Dependency chain

```
ArtistAssignment                    (dominio Eventos — externo DWL)
        ↓
WorkRecord                          (DWL-C-001 — raíz)
        ↓
WorkSession                         (DWL-C-002)
        ↓
WorkSet                             (DWL-C-003 — opcional)
        ↓
WorkEvidenceRecord                  (DWL-C-006 — opcional pero recomendado)
        ↓
CompensationCalculation             (DWL-C-008)
        ↓
CompensationRecord                  (DWL-C-009)
        ↓
WorkLedgerOFTLBridgeRequest         (DWL-C-015)
        ↓
FinancialObligation                 (OFTL-C-001 — dominio finance)
        ↓
OwnerFinancialTransaction           (OFTL-C-002)
        ↓
PaymentAllocation                   (OFTL-C-004)
        ↓
Cash Flow Projection                (read — CFMovement futuro)
```

**Ramas opcionales:** WorkCoverageRecord (C-005) colgando de WorkRecord · RevenueAttributionRecord (C-007) paralelo analítico · WorkApprovalRecord (C-010) en path a CompensationRecord · WorkMetricsSnapshot (C-013) derivado · WorkLedgerDomainEvent (C-014) post-commit.

**Aclaración:** WorkRecord **puede existir** sin CompensationRecord · CompensationRecord **requiere** WorkRecord · OFTL Bridge **requiere** CompensationRecord aprobado (policy futura).

---

## 12. Dependency Matrix

| Contrato | Depende de | Bloquea | Paralelo | SSOT | Consumidor | Riesgo | Fase |
|----------|------------|---------|----------|------|------------|--------|------|
| WorkRecord | Assignment ref · Event · ArtistProfile | Todo DWL | — | **Sí** | Sessions · comp · metrics | Identidad | DC-1 |
| WorkSession | WorkRecord | Sets · hourly calc | DC-2 | **Sí** | Metrics | Tarifa duplicada | DC-1 |
| WorkSet | WorkSession | Per-set comp | — | **Sí** | Calc | 2 sets = 2 pays | DC-2 |
| WorkCoverageRecord | WorkRecord · Assignment | Coverage KPI | DC-2 | **Sí** | Reports | Duplicar evento | DC-2 |
| WorkEvidenceRecord | WorkRecord | Approval | DC-3 | **Sí** | Legal · audit | Insuficiente | DC-3 |
| CompensationCalculation | WorkRecord (+ sessions) | CompensationRecord | DC-4 | Derivado | Approval | Algoritmo | DC-4 |
| CompensationRecord | Calculation · WorkRecord | OFTL bridge | DC-8 | **Sí** (comp) | Artist · OFTL | Confundir con pago | DC-4 |
| RevenueAttributionRecord | Event · WorkRecord opcional | — | DC-5 | Analítico | CF · Owner | Segundo ingreso | DC-5 |
| WorkApprovalRecord | WorkRecord · Compensation | Bridge | — | **Sí** | Audit | Auto-approval | DC-3 |
| ProfessionalIdentityReference | ArtistProfile | — | DC-1 | Ref | All | Owner=profile | DC-1 |
| BeneficiaryPartyReference | CompensationRecord | OFTL payload | DC-6 | Ref | Finance | payee=profile | DC-6 |
| WorkMetricsSnapshot | Core aggregates | — | DC-7 | **No** | Portals | Stale metrics | DC-7 |
| WorkLedgerOFTLBridgeRequest | CompensationRecord approved | Obligation | DC-8 | Request | OFTL | Doble obligation | DC-8 |
| WorkLedgerDomainEvent | Post-commit writes | — | DC-9 | Outbox | NC | — | DC-9 |

**No bloquean DWL:** Cash Flow · Notification Center · Supabase · UI portales (consumidores futuros).

---

## 13. WorkRecord core (conceptual)

Campos analizados — **no** afirmación de monolito único.

**WorkRecord representa (SSOT operativo):** quién trabajó · bajo qué perfil · para qué evento · en qué venue · fecha · rol · estado · asignación · auditoría.

**WorkRecord no representa:** pago · transacción · obligación financiera · allocation · settlement · Cash Flow · notificación.

| Campo | Obligatorio DC-1 | Notas |
|-------|------------------|-------|
| `work_record_id` | Sí | Nominal ID |
| `event_id` | Sí | Contexto |
| `venue_id` | Sí | Ubicación |
| `assignment_id` | Opcional | C-004 cuando exista |
| `artist_profile_id` | **Sí** | DWL-INV-01 · DJMago305 para Owner-DJ |
| `professional_identity_id` | Recomendado | C-011 snapshot |
| `work_role` | Sí | DJ · MC · vendor… |
| `scheduled_date` | Sí | ISO date |
| `timezone` | Sí | IANA string |
| `work_status` | Sí | Enum lifecycle |
| `attendance_status` | Sí | incl. no-show |
| `performance_status` | Sí | partial · complete |
| `source_reference` | Sí | Provenance |
| `created_by` | Sí | UserAccount — puede ser Owner |
| `audit_metadata` | Sí | JSON-safe |
| `schema_version` | Sí | Literal `1` futuro |

Timestamps · notes · beneficiary refs → contratos satélite o fases posteriores.

---

## 14. WorkSession vs WorkSet

| Usar **WorkSession** cuando… | Usar **WorkSet** cuando… |
|------------------------------|---------------------------|
| Una aparición en venue/turno | Tarifa **por set** distinta |
| Jornada diurna vs nocturna = 2 sessions | Mismo session · 2 sets facturados separadamente |
| Tarifa **global** cubre todos los sets del session | Necesidad contable/operativa por set |
| Múltiples venues = **N WorkRecords** o N sessions | Descanso/extension dentro del mismo session |

**Anti-duplicación (DWL-INV-07):** tarifa global (`FLAT_PACKAGE` / `PER_EVENT`) → **una** CompensationRecord por paquete · **no** una por set automáticamente.

**Extensión horaria:** metadata en session · basis `HOURLY` en C-008 — no segundo WorkRecord por hora extra salvo policy PO.

---

## 15. Compensation foundation (conceptual)

### 15.1 Enums / tipos auxiliares (futuro — no TS aquí)

| Tipo | Valores conceptuales |
|------|---------------------|
| **CompensationBasis** | FIXED_SESSION · HOURLY · PER_SET · DAILY · PER_EVENT · FLAT_PACKAGE · GRATUITY_WAIVED · PENDING_DETERMINATION |
| **CompensationCalculationStatus** | DRAFT · CALCULATED · SUPERSEDED · INVALIDATED |
| **CompensationRecordStatus** | PENDING_APPROVAL · APPROVED · PARTIALLY_APPROVED · REJECTED · REVERSED · SUPERSEDED |
| **CompensationAdjustmentReason** | CORRECTION · COVERAGE_ADJUSTMENT · OWNER_OVERRIDE · POLICY_CHANGE · REVERSAL |
| **CompensationApprovalContext** | approver_user_id · capability_snapshot · auto_approval_flag · reason_code |

**No** fijar algoritmos definitivos ni reglas fiscales.

---

## 16. Separación financiera

| Contrato | Regla |
|----------|-------|
| **RevenueAttributionRecord** | Atribución analítica · **no crea dinero** · **no** duplica transacción financiera · **no** representa factura ni pago · **no** modifica Cash Flow · **no** sustituye facturación OFTL |
| **CompensationCalculation** | Resultado intermedio · **no** pago |
| **CompensationRecord** | Derecho aprobado/pendiente · **puede originar** bridge → Obligation |
| **FinancialObligation** | Canónica **OFTL** |
| **PaymentAllocation** | **No** crea trabajo ni compensación |
| **Cash Flow** | **No** crea ninguno de estos hechos · **no** writer |

---

## 17. Owner / DJMago305 (especificación)

| Regla | Detalle |
|-------|---------|
| WorkRecord Gerardo como DJ | `artist_profile_id` → **DJMago305** |
| `professional_identity_id` | Representa DJMago305 |
| `created_by` / `approved_by` | Puede ser cuenta Owner |
| `beneficiary_party_id` | **Puede ser distinto** (C-012) |
| Autoaprobación | `WorkApprovalRecord` + `auto_approval_flag` + reason · R-DWL-IDENTITY-04 |
| Prohibido | Owner draw automático · mezclar compensación artística con utilidades |
| Métricas | DJMago305 **≠** métricas administrativas Owner |

---

## 18. Artista sin cuenta

Contratos deben soportar:

- **ArtistProfile** sin **UserAccount**;
- trabajo histórico ligado al perfil;
- administración por Staff;
- vínculo posterior de cuenta **sin** perder historial (DWL-INV-12);
- **BeneficiaryParty** separado.

Campos futuros: `artist_profile_id` obligatorio · `user_account_id` opcional.

---

## 19. Agrupaciones

| Escenario | Spec |
|-----------|------|
| Orquesta · perfil único | Un `artist_profile_id` · integrantes metadata futura |
| Varios integrantes | **Fase futura** — split compensation |
| Representante · LLC | `beneficiary_party_id` ≠ `artist_profile_id` |
| Cambio representante | Nuevo beneficiary · historial artístico inmutable |

**DWL-DC-1…4:** no implementar reparto entre integrantes.

---

## 20. Métricas independientes

| Métrica | Productor | Fuente canónica | Fórmula futura (orientativa) | Consumidor | Riesgo doble conteo | Artist | Staff | Owner |
|---------|-----------|-----------------|------------------------------|------------|---------------------|--------|-------|-------|
| sessions_scheduled | Assignment + WorkRecord | C-001 draft | count assignments linked | Portal | Bajo | Own | Yes | Yes |
| sessions_completed | WorkSession | C-002 | status=complete | Artist KPI | Medio | Own | Yes | Yes |
| sessions_cancelled | WorkRecord | C-001 | cancelled | Reports | Bajo | Own | Yes | Yes |
| sets_completed | WorkSet / session | C-002/003 | sum sets | Artist | Medio | Own | Yes | Yes |
| hours_worked | WorkSession | C-002 | HOURLY duration | Comp calc | Medio | Own | Yes | Yes |
| events_completed | WorkRecord | C-001 | distinct events | Profile | Bajo | Own | Yes | Yes |
| venues_worked | WorkRecord | C-001 | distinct venues | Profile | Bajo | Own | Yes | Yes |
| coverage_count | WorkCoverageRecord | C-005 | count | Staff | Bajo | Own | Yes | Yes |
| gross_revenue_attributed | RevenueAttributionRecord | C-007 | sum attribution | CF read | **Alto** vs OFTL revenue | **No** margin | Yes | Yes |
| compensation_earned | CompensationRecord | C-009 | approved amounts | Artist · OFTL bridge | **Alto** vs paid | Own | Yes | Yes |
| compensation_pending | CompensationRecord + OFTL | C-009 + obligation | earned − paid | Artist | Medio | Own | Yes | Yes |
| compensation_paid | OFTL allocation | Finance | paid via OFTL | Artist | **Alto** if double with earned | Own | Yes | Yes |
| compensation_reversed | CompensationRecord | C-009 | reversed rows | Audit | Medio | Own | Yes | Yes |
| no_show_count | WorkRecord | C-001 | attendance=no_show | Staff | Bajo | Own | Yes | Yes |

**Productor de proyección agregada:** C-013 WorkMetricsSnapshot (no SSOT).

**Reglas C-013 (WorkMetricsSnapshot):** proyección versionada · **no** SSOT · reconstruible desde fuentes canónicas · conserva referencias al origen · **no** modifica WorkRecord · CompensationRecord · OFTL.

---

## 21. Privacidad (conceptual)

| Rol | Visible |
|-----|---------|
| **Artist** | Propios Work Records · sessions · sets · compensación autorizada · estado · métricas personales · documentos propios |
| **Artist — prohibido** | Margen empresarial · pagos terceros · costos internos · comisiones Staff · datos bancarios internos · métricas globales MDJB · compensación otros · fiscal terceros |
| **Staff autorizado** | Según Owner · Manager · Seller · Finance · Legal · relación evento |
| **Owner** | Visibilidad empresarial completa según política futura |

**No** implementar permisos runtime en esta spec.

---

## 22. Invariantes

| ID | Regla |
|----|-------|
| **DWL-INV-01** | Todo WorkRecord pertenece a un **ArtistProfile** profesional |
| **DWL-INV-02** | StaffAccount **no** sustituye ArtistProfile |
| **DWL-INV-03** | Artista del record **no** se deduce **solo** del usuario autenticado |
| **DWL-INV-04** | WorkRecord **no** representa un pago |
| **DWL-INV-05** | Compensation earned **≠** compensation paid |
| **DWL-INV-06** | Revenue attribution **no** crea ingreso adicional |
| **DWL-INV-07** | Dos sets bajo tarifa global **no** crean dos compensaciones automáticas |
| **DWL-INV-08** | Toda cobertura referencia trabajo/asignación reemplazada |
| **DWL-INV-09** | Toda corrección conserva audit trail append-only |
| **DWL-INV-10** | No duplicar WorkRecord para el mismo hecho operativo |
| **DWL-INV-11** | BeneficiaryParty **no** se deduce automáticamente del ArtistProfile |
| **DWL-INV-12** | Cambio de beneficiario **no** altera historial de trabajo |
| **DWL-INV-13** | Solo una compensación **activa** por cálculo aprobado (salvo versionado explícito) |
| **DWL-INV-14** | Creación Obligation vía bridge **idempotente** |
| **DWL-INV-15** | Cash Flow **no** modifica Work Ledger |

---

## 23. Idempotencia (claves futuras — formato no definitivo)

| Operación | Clave conceptual |
|-----------|------------------|
| Crear WorkRecord | `source_system` + `source_record_id` · o hash(event+profile+date+role) |
| Crear WorkSession | `work_record_id` + `session_sequence` |
| Crear WorkSet | `work_session_id` + `set_sequence` |
| CompensationRecord | `work_record_id` + `compensation_version` + basis key |
| OFTL Bridge | `compensation_record_id` + `bridge_intent` |
| FinancialObligation (vía bridge) | misma clave bridge · dedupe en writer OFTL |
| Domain event | `deduplication_key` alineado NC discovery |
| Metrics snapshot | `artist_profile_id` + `calculation_version` + `as_of` |

---

## 24. Versionado

| Mecanismo | Uso |
|-----------|-----|
| `schemaVersion` | Evolución contrato JSON |
| `calculationVersion` / `calculation_version` | Algoritmo métricas / comp (nombre conceptual) |
| `superseded_record_id` | Reemplazo auditado |
| `correction_reason` | CompensationAdjustmentReason |
| `effective_at` | Timestamp efectividad |
| `original_reference` | Cadena reversión |
| Historial inmutable | Append-only · **sin** edición silenciosa |

---

## 25. Riesgos

| ID | Riesgo |
|----|--------|
| R-DWL-SPEC-01 | Contratos demasiado amplios / monolito WorkRecord |
| R-DWL-SPEC-02 | Duplicidad WorkRecord / session |
| R-DWL-SPEC-03 | Mezcla identidad cuenta/perfil |
| R-DWL-SPEC-04 | Mezcla perfil/beneficiario |
| R-DWL-SPEC-05 | Doble compensación (sets · coverage) |
| R-DWL-SPEC-06 | Doble obligación OFTL |
| R-DWL-SPEC-07 | Métricas inconsistentes entre portales |
| R-DWL-SPEC-08 | Autoaprobación Owner/DJMago305 |
| R-DWL-SPEC-09 | Historial perdido al cambiar cuenta |
| R-DWL-SPEC-10 | Tarifa por set mal interpretada |
| R-DWL-SPEC-11 | Compensation confundida con pago |
| R-DWL-SPEC-12 | Revenue Attribution confundido con ingreso |
| R-DWL-SPEC-13 | Cash Flow como escritor |
| R-DWL-SPEC-14 | Exposición indebida margen a artista |
| R-DWL-SPEC-15 | Agrupaciones mal modeladas |
| R-DWL-SPEC-16 | Artista sin cuenta sin trazabilidad |
| R-DWL-SPEC-17 | Versionado insuficiente |
| R-DWL-SPEC-18 | Migraciones futuras breaking |
| R-DWL-SPEC-19 | Cambio taxonomías sin bridge |

*(Ver también R-DWL-* y R-DWL-IDENTITY-* en discovery §21.)*

---

## 26. Impact analysis

| Componente | Relación | Modificado este ticket | Gate futuro |
|------------|----------|------------------------|-------------|
| Artist Profile | FK target C-011 | **No** | DWL-DC-1 |
| Staff Account | Writer/approver | **No** | DWL-DC-3 |
| Event / Assignment | Upstream refs | **No** | Events ticket |
| OFTL DC-1 / DC-2 | Downstream finance | **No** | DWL-DC-8 |
| Payment Allocation | Downstream | **No** | OFTL |
| Cash Flow | Read projection | **No** | DWL-DC-7/9 |
| Notification Center | Domain events | **No** | DWL-DC-9 |
| Legal Center | Evidence refs | **No** | DWL-DC-3 |
| Supabase | Persistence | **No** | DWL-SPEC-RM-14 |
| UI portales | Consumers | **No** | DWL-SPEC-RM-13 |
| DWL discovery doc | Parent | **No** | — |
| Runtime | — | **No** | — |

**RIESGO FUNCIONAL DIRECTO:**

**NULO EN RUNTIME, PORQUE EL CAMBIO ES EXCLUSIVAMENTE DOCUMENTAL.**

**RIESGO ARQUITECTÓNICO:**

**CONTROLADO MEDIANTE GATES FUTUROS DEL PRODUCT OWNER, VALIDACIÓN TÉCNICA, SEGURIDAD, PRIVACIDAD, REVISIÓN CONTABLE, FISCAL Y LEGAL ANTES DE IMPLEMENTACIÓN.**

---

## 27. Supervisión legal, contable y fiscal

**ESTADO LEGAL:**

**ARQUITECTURA TÉCNICA — PENDIENTE DE REVISIÓN LEGAL PROFESIONAL**

**ESTADO CONTABLE:**

**CONTRATOS CONCEPTUALES — PENDIENTES DE REVISIÓN CONTABLE PROFESIONAL**

**ESTADO FISCAL:**

**COMPENSACIONES Y BENEFICIARIOS — PENDIENTES DE REVISIÓN FISCAL PROFESIONAL**

**No afirmar:** empleado/contratista definitivo · tratamiento fiscal Owner · payroll · reporting fiscal · deducibilidad · cumplimiento garantizado · legalmente aprobado.

---

## 28. Roadmap post-especificación

| ID | Entregable |
|----|------------|
| **DWL-SPEC-RM-01** | Revisión PO esta spec |
| **DWL-SPEC-RM-02** | DWL-DC-1 Core Work Contracts TS |
| **DWL-SPEC-RM-03** | Tests DC-1 |
| **DWL-SPEC-RM-04** | DWL-DC-2 Sets and Coverage |
| **DWL-SPEC-RM-05** | DWL-DC-3 Evidence and Approval |
| **DWL-SPEC-RM-06** | DWL-DC-4 Compensation Foundation |
| **DWL-SPEC-RM-07** | DWL-DC-5 Revenue Attribution |
| **DWL-SPEC-RM-08** | DWL-DC-6 Identity and Beneficiary Bridge |
| **DWL-SPEC-RM-09** | DWL-DC-7 Metrics Projection |
| **DWL-SPEC-RM-10** | DWL-DC-8 OFTL Bridge |
| **DWL-SPEC-RM-11** | DWL-DC-9 Domain Events |
| **DWL-SPEC-RM-12** | In-memory Provider |
| **DWL-SPEC-RM-13** | Portal Integration |
| **DWL-SPEC-RM-14** | Persistence Supabase |
| **DWL-SPEC-RM-15** | Historical Capture |

---

## 29. Criterios de aceptación (spec)

- [x] WorkRecord = raíz operativa
- [x] Account ≠ ArtistProfile · DJMago305 ≠ Owner account
- [x] BeneficiaryParty no deducido de profile
- [x] CompensationRecord ≠ pago · Revenue ≠ ingreso nuevo
- [x] OFTL canónico financiero · CF no writer
- [x] Orden DWL-DC-1…9 · Dependency Matrix
- [x] Invariantes DWL-INV-01…15
- [x] Idempotencia · versionado · privacidad
- [x] Gates legal · contable · fiscal
- [x] Sin TypeScript
- [x] Commit local documental (sin push)
- [ ] Aprobación PO spec (pendiente)

**No aprobar si:** falla cualquier ítem anterior.

---

## 30. Confirmación final

| Afirmación | Estado |
|------------|--------|
| Spec documentada | ✓ |
| Commit local | ✓ |
| Push / PR / merge / deploy | ✗ |
| Código · tests · registros reales | ✗ |

**Estado:**

**TICKET-V2-DWL-DATA-CONTRACTS-SPECIFICATION-001 — DOCUMENTADO Y COMMITTED LOCALMENTE — PENDIENTE DE APROBACIÓN ARQUITECTÓNICA FINAL PO**

No marcar: IMPLEMENTADO · PRODUCTION READY · LEGALMENTE APROBADO · FISCALMENTE APROBADO · RELEASED.

No iniciar DWL-DC-1 · no capturar trabajos históricos · no crear obligaciones · no registrar pagos.

---

*Especificación canónica Work Ledger Data Contracts V2. Implementación requiere ticket + autorización PO separada.*
