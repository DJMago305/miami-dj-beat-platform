# TICKET-V2-DWL-DC-2-SETS-AND-COVERAGE-DISCOVERY-001

## Work Set & Coverage — Discovery + Architectural Specification (Documentation Only)

| Campo | Valor |
|-------|-------|
| Ticket | V2 Work Ledger — DC-2 Sets and Coverage Discovery |
| Estado | **DOCUMENTADO — PENDIENTE DE REVISIÓN Y APROBACIÓN ARQUITECTÓNICA PO** |
| Fase | **DWL-DC-2 discovery** — especificación conceptual · **sin implementación** |
| Contratos objetivo | **DWL-C-003** `WorkSet` · **DWL-C-005** `WorkCoverageRecord` |
| Parent specification | `docs/V2/TICKETS/TICKET-V2-DWL-DATA-CONTRACTS-SPECIFICATION-001.md` |
| Parent discovery | `docs/V2/TICKETS/TICKET-V2-DJ-WORK-LEDGER-AND-COMPENSATION-DISCOVERY-001.md` |
| Prerequisite implementado | `docs/V2/TICKETS/TICKET-V2-DWL-DC-1-CORE-WORK-CONTRACTS-001.md` (C-001/002/004/011) |
| Rama baseline | `plan/v2-phase-4-api-client` |
| HEAD baseline | `8e52458afde4d3e5d2afeb2abd4b93fcb8851908` |
| Fecha discovery | 2026-07-23 |
| Modo | **Documentación únicamente** — cero código |

---

## 0. Declaración operativa

Este ticket **no autoriza**:

- TypeScript, tests, runtime, Supabase, migraciones, providers, repositories, adapters;
- modificar DWL-DC-1 committed, OFTL, Cash Flow, Notification Center, portales, perfiles;
- crear WorkSet o WorkCoverageRecord en runtime · captura histórica · compensación · evidencia · aprobación;
- staging, commit, push, PR, merge, deploy;
- role switching · impersonation · owner-as-artist mode · sesión híbrida Staff/Artist.

**Estado exitoso:** discovery documentado · **un solo archivo nuevo** · **SIN CÓDIGO** · **SIN COMMIT** · esperar revisión PO.

---

## 1. Autorización PO

Documentación-only discovery para frontera contractual **WorkSet** y **WorkCoverageRecord** antes de autorizar implementación TS posterior.

---

## 2. Baseline Git

| Check | Valor | Resultado |
|-------|-------|-----------|
| Rama | `plan/v2-phase-4-api-client` | ✓ |
| HEAD | `8e52458afde4d3e5d2afeb2abd4b93fcb8851908` | ✓ |
| Working tree (creación) | Limpio en HEAD | ✓ |
| Working tree (audit) | Solo `??` este ticket | ✓ |
| DWL-DC-1 committed | `feat(v2-operations): add work ledger core contracts` | ✓ |

---

## 3. Objetivo

Definir con precisión la futura frontera de **DWL-C-003 WorkSet** y **DWL-C-005 WorkCoverageRecord**: reglas de granularidad, cobertura, sustitución, anti-duplicación, identidad, métricas proyectadas e idempotencia — **sin implementar contratos**.

Producir decisiones suficientes para que un ticket posterior `TICKET-V2-DWL-DC-2-SETS-AND-COVERAGE-IMPLEMENTATION-001` ejecute sin improvisar reglas críticas.

---

## 4. Alcance

| # | Entregable |
|---|------------|
| 1 | Este documento (único artefacto) |
| 2 | Regla decisional WorkSession vs WorkSet |
| 3 | Modelos tarifa global / por set / mixto |
| 4 | Diseño candidato WorkSet + WorkCoverageRecord |
| 5 | Modelo recomendado anti-WorkRecord duplicado |
| 6 | Taxonomías cobertura · estados · precedencia no-show/replaced/partial |
| 7 | 12 use cases DC2-UC-01…12 |
| 8 | Invariantes DWL-DC2-INV-01…18 + OWNER-01…05 |
| 9 | Métricas futuras · privacidad · idempotencia · supersession |
| 10 | Matriz dependencias · riesgos · roadmap · impact analysis |

---

## 5. Fuera de alcance

| Item | Fase futura |
|------|-------------|
| Archivos `.ts` | Implementación DC-2 |
| CompensationCalculation / Record | DWL-DC-4 |
| WorkEvidenceRecord / WorkApprovalRecord | DWL-DC-3 |
| WorkMetricsSnapshot runtime | DWL-DC-7 |
| OFTL Bridge · Domain Events | DC-8/9 |
| Role switching · impersonation · UI portal | **Prohibido — no DWL** |
| Algoritmos de cálculo tarifa | DC-4+ |

---

## 6. Documentos leídos

| Documento | Rol |
|-----------|-----|
| `docs/V2/MIAMIDJBEAT-PROYECTO-CONSTITUCION.md` | Gobernanza V2 |
| `docs/V2/MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md` | Protocolo PO |
| `docs/workflow-control.md` | Sin commit/deploy sin autorización |
| `docs/AGENT-MEMORY.md` | Tiers · zonas rojas |
| `docs/V2/README.md` | Mapa módulos V2 |
| `TICKET-V2-DJ-WORK-LEDGER-AND-COMPENSATION-DISCOVERY-001.md` | UC-02…08 · sets · cobertura |
| `TICKET-V2-DWL-DATA-CONTRACTS-SPECIFICATION-001.md` | C-003/005 · §14 · DWL-INV-07/08 |
| `TICKET-V2-DWL-DC-1-CORE-WORK-CONTRACTS-001.md` | Contratos base implementados |
| `TICKET-V2-OFTL-DC-2-PAYMENT-ALLOCATION-DISCOVERY-001.md` | Patrón profundidad analítica (solo forma) |

---

## 7. Contexto arquitectónico

```
Event
  ↓
ArtistAssignment
  ↓
WorkRecord                    (DWL-C-001 — raíz operativa SSOT)
  ↓
WorkSession                   (DWL-C-002)
  ↓
WorkSet                       (DWL-C-003 — opcional)
```

**Rama cobertura (cuando aplica sustitución):**

```
ArtistAssignment original
  ↓
WorkRecord operativo
  ↓
WorkCoverageRecord            (DWL-C-005)
  ↓
ProfessionalIdentity / ArtistProfile del performer real
```

**Ninguno representa:** compensación · factura · pago · obligación · transacción · Cash Flow · notificación entregada.

**Principio SSOT:** WorkRecord permanece hecho operativo canónico. WorkSet subdivide tiempo dentro de session. WorkCoverageRecord registra quién realizó qué intervalo cuando difiere de la asignación original — **sin borrar** asignación ni identidad original.

**Alineación DC-1 (sin modificar contratos committed):** `WorkRecord` · `WorkSession` · `WorkAssignmentReference` · `ProfessionalIdentityReference` permanecen como en `MiamiDJBeat-MigracionV2/shared/services/work-ledger/contracts/`. DC-2 **extiende** con C-003 y C-005 colgando de session/record — **no** reemplaza tipos DC-1 · **no** introduce `sessionIds[]` en WorkRecord.

### 7.1 Tres dominios operativos (no fusionar)

| Dominio | Identificadores | Rol |
|---------|-----------------|-----|
| **A — Autoría administrativa** | `createdByUserId` · `auditMetadata.createdByUserId` | Quién creó/administró el registro (Owner · Manager · Seller Staff) |
| **B — Ejecución profesional** | `artistProfileId` · `professionalIdentityId` · snapshots C-011 | Quién fue asignado y/o quién **realizó** el trabajo bajo qué identidad profesional |
| **C — Derecho económico futuro** | Beneficiary · Compensation · Commission · Owner entitlement (DC-4+) | Quién **podría** recibir compensación/atribución económica por capacidad — **no implementar en DC-2** |

Relacionados · **nunca** inferidos automáticamente entre sí. WorkSet y WorkCoverageRecord registran hechos operativos del dominio **B** · no crean dominio **C**.

### 7.2 Trabajo realizado ≠ economía

```
Trabajo realizado (WorkRecord / Session / Set / Coverage)
        ≠
Compensación acordada (DC-4)
        ≠
Obligación financiera (OFTL)
        ≠
Pago realizado (OFTL)
        ≠
Cash Flow projection (read)
```

Ningún contrato DC-2 crea automáticamente compensaciones · facturas · pagos · comisiones · owner draws · revenue · entradas Cash Flow · obligaciones.

---

## 8. WorkSession vs WorkSet

### 8.1 Definiciones

| Entidad | Representa |
|---------|------------|
| **WorkSession** | Turno operativo continuo: aparición en venue · bloque horario contractual · jornada (brunch vs night) · unidad mínima cuando **no** se requiere granularidad por set |
| **WorkSet** | Subdivisión **opcional** de una WorkSession cuando la operación o la futura compensación requiere distinguir sets discretos dentro del mismo turno |

### 8.2 Regla decisional reproducible (DWL-DC2-RULE-SET-01)

**Crear WorkSet solo si al menos una condición es verdadera:**

1. Existe acuerdo o necesidad operativa de **contar sets por separado** (tarifa por set · reporte por set · KPI por set).
2. El Assignment o contrato comercial declara **N sets explícitos** dentro de una session.
3. Futura compensación (DC-4) requerirá scope `WORK_SET` para uno o más sets — **no** para todos los casos.

**Prohibido crear WorkSet si:**

- Solo hay un bloque continuo sin sets comerciales distintos.
- El motivo es métrica inflada (una canción = un set).
- Descanso corto dentro del mismo set acordado.
- Pausa técnica sin cambio de unidad contractual.
- Cambio de género musical sin cambio de tarifa/set comercial.
- Conveniencia de UI sin respaldo en Assignment o acuerdo.

### 8.3 Preguntas centrales — respuestas

| # | Pregunta | Decisión |
|---|----------|----------|
| 1 | ¿Qué es WorkSession? | Turno/periodo operativo en venue (ver §8.1) |
| 2 | ¿Qué es WorkSet? | Subdivisión opcional dentro de session |
| 3 | ¿Cuándo basta session? | Bloque continuo · tarifa global · sin sets comerciales |
| 4 | ¿Cuándo uno+ sets? | Tarifa por set · N sets explícitos · scope compensación por set |
| 5 | ¿Granularidad artificial? | **Prohibida** (§27 anti-patterns) |
| 6 | ¿Descanso crea set? | **No** salvo acuerdo explícito de sets separados |
| 7 | ¿Pausa técnica crea set? | **No** |
| 8 | ¿Cambio género crea set? | **No** por sí solo |
| 9 | ¿Cambio escenario? | **No** set automático; puede ser metadata en set existente |
| 10 | ¿Cambio venue? | **Nueva WorkSession** o **Nuevo WorkRecord** — ver §11 |
| 11 | ¿Jornada diurna + nocturna? | Ver §11 — **no** decidir solo por UI |
| 12 | ¿Evitar doble SSOT temporal? | Session = contenedor de tiempo; Set = slice **dentro** de session; **no** duplicar mismos timestamps en ambos como SSOT paralelo |

### 8.4 Anti-confusión temporal

- Timestamps canónicos del turno → **WorkSession** (`scheduledStartAt` / `scheduledEndAt` / actuals).
- WorkSet referencia **intervalo dentro** de la session · no redefine el turno completo salvo set = session entera (caso degenerado: **preferir cero sets**).
- Métrica `hours_worked` futura → primaria desde **WorkSession**; sets no suman horas duplicadas.

---

## 9. WorkSet — contrato candidato (NON-IMPLEMENTATION CONTRACT SHAPE)

### 9.1 Propósito

Registrar un set discreto dentro de una WorkSession para operación, trazabilidad y futura referencia de compensación por scope — **sin montos ni tarifas**.

### 9.2 SSOT

**Sí** para hecho “set realizado” · **No** para compensación · **No** para métricas agregadas (proyección).

### 9.3 Campos candidatos

| Campo | Clasificación | Notas |
|-------|---------------|-------|
| `workSetId` | **Requerido** | Nominal ID futuro |
| `workSessionId` | **Requerido** | FK branded |
| `workRecordId` | **Recomendado denormalizado** | Facilita queries · debe coincidir con session padre |
| `sequence` | **Requerido** | Entero positivo seguro · único por session |
| `label` | Opcional | Etiqueta operativa corta |
| `scheduledStartAt` | **Requerido** | ISO string · ⊆ intervalo session |
| `scheduledEndAt` | **Requerido** | ISO string |
| `actualStartAt` | Opcional | ISO string |
| `actualEndAt` | Opcional | ISO string |
| `setStatus` | **Requerido** | Enum candidato alineado session/set |
| `setType` | Opcional | MAIN · OPENING · CLOSING · EXTENSION · OTHER |
| `venueId` | Opcional | Solo si set ocurre en sub-venue/stage distinto **dentro** misma session |
| `stageReference` | Opcional | String opaco escenario |
| `performedByProfessionalIdentity` | **Requerido si cobertura parcial por set** | Ref C-011 snapshot |
| `performedByArtistProfileId` | **Requerido si performer ≠ record default** | Ref explícita |
| `notes` | Opcional | Controladas · sin datos sensibles |
| `sourceReference` | **Requerido** | Provenance |
| `auditMetadata` | **Requerido** | Patrón DC-1 |
| `schemaVersion` | **Requerido** | Literal |

### 9.4 Campos prohibidos

`amount` · `rate` · `fee` · `currency` · `compensationBasis` · `compensationScope` · `revenue` · `payment` · `obligationId` · `invoice` · `beneficiary` · `ownerDraw` · evidencia binaria · diagnóstico médico.

### 9.5 Relaciones

WorkSet → WorkSession (N:1) · WorkSet → WorkRecord (N:1 indirecto) · WorkCoverageRecord puede apuntar scope → WorkSet.

### 9.6 Idempotencia conceptual

Clave: `workSessionId` + `setSequence` + `sourceReference` · corrección → supersession (§24).

---

## 10. Tarifa global vs tarifa por set

### 10.1 MODELO A — Tarifa global (FLAT_PACKAGE / PER_EVENT sobre record o session)

**Ejemplo:** 2 sets · compensación total pactada **$500**.

| Correcto | Incorrecto |
|----------|------------|
| 2 WorkSets operativos | 2 WorkSets × $500 = $1000 |
| 1 base compensación futura scope `WORK_RECORD` o `WORK_SESSION` | Métrica sets_completed × tarifa |
| Métricas de sets **no** multiplican earnings | Auto-crear 2 CompensationRecords |

**Regla (alineada DWL-INV-07):** múltiples WorkSets **no** crean automáticamente múltiples compensaciones.

### 10.2 MODELO B — Tarifa por set (PER_SET)

**Ejemplo:** Set 1 **$250** · Set 2 **$300** · total **$550**.

| Correcto | Incorrecto |
|----------|------------|
| 2 WorkSets | 1 set invisible con total $550 sin desglose |
| 2 componentes compensación futuros scope `WORK_SET` + refs explícitas | Tarifa global implícita |
| Suma documentada en DC-4 | WorkSet contiene montos |

### 10.3 MODELO C — Mixto (base global + set extraordinario)

**Permitido solo con gate PO explícito en DC-4.**

| Componente | Scope futuro |
|------------|--------------|
| Base session/record | `WORK_SESSION` o `WORK_RECORD` |
| Set extra acordado | `WORK_SET` adicional |

**Gate anti-doble-conteo:** el set extraordinario debe declararse **add-on** · no re-incluir base · documentar en `CompensationBasis` futuro · revisión contable antes producción.

### 10.4 Necesidad futura — CompensationScope (no implementar en DC-2)

Valores conceptuales documentados para DC-4:

- `WORK_RECORD`
- `WORK_SESSION`
- `WORK_SET`
- `COVERAGE`
- `OTHER_APPROVED_SCOPE`

WorkSet **referencia** scope · **no** almacena dinero.

---

## 11. Jornadas múltiples · venues · medianoche

### 11.1 Criterios de decisión (DWL-DC2-RULE-JOURNEY-01)

| Factor | Preferencia |
|--------|-------------|
| **Un Assignment comercial único** cubre brunch + night mismo venue | **1 WorkRecord** · **2 WorkSessions** |
| **Dos Assignments** comerciales distintos | **2 WorkRecords** (o 1 record por Assignment según producto PO) |
| **Dos venues** mismo día | **N WorkRecords** (preferido) **o** N sessions mismo record si Assignment único multi-venue — **requiere PO si ambiguo** |
| **Cambio artista entre jornadas** | WorkCoverageRecord por jornada afectada |
| **Tarifa global día completo** | 2 sessions · 0-N sets · **1** compensación scope record/session |
| **Tarifas independientes por jornada** | 2 sessions · compensación scope session (futuro) |
| **Cruza medianoche** | Una session con timezone IANA explícita · **no** dividir por calendario solo |

### 11.2 Ejemplo brunch + night (DC2-UC-05)

- Brunch 12:00–16:00 · Night 22:00–02:00 · mismo evento comercial.
- **Decisión recomendada:** 1 WorkRecord · 2 WorkSessions · sets solo si comercialmente declarados por session.
- **No** 2 WorkRecords salvo Assignments separados.

---

## 12. WorkCoverageRecord — contrato candidato (NON-IMPLEMENTATION CONTRACT SHAPE)

### 12.1 Propósito

Registro canónico de cobertura · sustitución · reemplazo · takeover parcial/total · emergencia · relevo — preservando identidad original y performer real.

### 12.2 SSOT

**Sí** para hecho de cobertura · **No** para pago · **No** para borrar Assignment.

### 12.3 Campos candidatos

| Campo | Clasificación | Notas |
|-------|---------------|-------|
| `workCoverageRecordId` | **Requerido** | Nominal ID |
| `workRecordId` | **Requerido** | Raíz operativa |
| `coverageType` | **Requerido** | Taxonomía §13 |
| `coverageStatus` | **Requerido** | Taxonomía §13 |
| `coverageScope` | **Requerido** | Union discriminada §18 |
| `coveredArtistProfileId` | **Requerido** | Artista **asignado originalmente** |
| `coveredProfessionalIdentityId` | **Requerido** | Identidad original asignada |
| `coveringArtistProfileId` | **Requerido** | Quién **realizó** el trabajo |
| `coveringProfessionalIdentityId` | **Requerido** | Identidad profesional performer real |
| `effectiveStartAt` | **Requerido** | ISO string |
| `effectiveEndAt` | **Requerido** | ISO string · parcial permitido |
| `reasonCode` | **Requerido** | Código controlado · no texto libre médico |
| `reasonNotes` | Opcional | Interno · minimizado |
| `authorizationContext` | Opcional DC-3 | Quién autorizó · provisional |
| `sourceReference` | **Requerido** | Provenance |
| `auditMetadata` | **Requerido** | Patrón DC-1 |
| `schemaVersion` | **Requerido** | Literal |
| `supersedesCoverageRecordId` | Opcional | Supersession §24 |

### 12.4 Campos prohibidos

Montos · tarifas · obligation · transaction · bank · tax ID · diagnóstico médico · evidencia binaria · tokens · chat logs · owner draw.

### 12.5 Semántica WorkRecord.artistProfileId bajo cobertura

**Decisión (Modelo 1 · alineada DC-1):**

| Campo | Semántica en cobertura |
|-------|------------------------|
| `WorkRecord.artistProfileId` | Artista **originalmente asignado** al engagement (desde Assignment) — **no** se sobrescribe con el sustituto |
| `WorkRecord.professionalIdentity` | Snapshot identidad **asignada original** al capturar el record |
| `WorkCoverageRecord.covering*` | Performer que **realizó** el intervalo |
| Performance credit · métricas de ejecución | Atribuidas al **covering** profile/identity vía CoverageRecord (y set-level refs si aplica) |

Evita sobrescribir artista original en WorkRecord · evita WorkRecord duplicado · coherente con `assignmentReference.artistProfileId`.

### 12.6 Caso obligatorio — DJ A → DJ B viernes (DC2-UC-02)

| Elemento | Conservar |
|----------|-----------|
| Assignment original | Intacto · referenciado |
| WorkRecord | **Uno** · raíz del engagement |
| WorkRecord.artistProfileId | DJ A (asignado — **sin sobrescribir**) |
| coveredArtistProfileId | DJ A (identidad original asignada) |
| coveringArtistProfileId | DJ B (performer real) |
| Intervalo | Viernes turno completo o parcial explícito |
| Performance credit | DJ B · **no** DJ A |
| Assignment history DJ A | Muestra asignación · no performance inventada |
| Compensación futura | Separable por performer · **no** registrar ahora |

---

## 13. Coverage types and statuses

### 13.1 CoverageType (candidatos)

| Valor | Uso |
|-------|-----|
| `FULL_REPLACEMENT` | Sustituto realiza 100% del scope |
| `PARTIAL_COVERAGE` | Intervalo parcial |
| `EMERGENCY_COVERAGE` | Último minuto sin plan previo |
| `PLANNED_SUBSTITUTION` | Relevo acordado anticipadamente |
| `LATE_TAKEOVER` | Sustituto inicia · original llega tarde |
| `EARLY_RELIEF` | Original relevado antes de fin |
| `SHARED_COVERAGE` | Dos performers en intervalos/roles distintos |
| `OTHER` | Requiere reasonCode explícito |

### 13.2 CoverageStatus (candidatos)

| Valor | Uso |
|-------|-----|
| `PLANNED` | Registrado · no confirmado operativamente |
| `CONFIRMED` | Confirmado pre-evento |
| `IN_PROGRESS` | Cobertura activa |
| `COMPLETED` | Intervalo realizado |
| `CANCELLED` | Cobertura no ocurrió |
| `DISPUTED` | Conflicto · requiere evidencia DC-3 |
| `SUPERSEDED` | Reemplazado por corrección |

**CoverageType ≠ CoverageStatus** — tipo describe naturaleza · status describe lifecycle.

---

## 14. No-show / replacement / partial — precedencia

### 14.1 Tabla de pertenencia de estados

| Situación | WorkRecord | WorkSession | WorkSet | WorkCoverageRecord |
|-----------|------------|-------------|---------|-------------------|
| No-show sin reemplazo | `attendanceStatus=ABSENT` · `workStatus=NO_SHOW` | `NO_SHOW` | n/a | opcional registro intento |
| No-show + reemplazo total | original attendance ABSENT | session performer mixto vía coverage | sets según performer | `FULL_REPLACEMENT` |
| Trabajo parcial original | `PARTIALLY_COMPLETED` | `PARTIAL` | opcional | `PARTIAL_COVERAGE` si otro completa |
| Reemplazo completo | `performanceStatus=REPLACED` | según scope | según scope | `FULL_REPLACEMENT` |
| Relevo por retraso | mixed | mixed intervals | opcional | `LATE_TAKEOVER` |

### 14.2 Reglas de coherencia

- **DWL-DC2-INV-10:** `NO_SHOW` **≠** automáticamente `FULL_REPLACEMENT` — requiere CoverageRecord explícito.
- **DWL-DC2-INV-11:** `REPLACED` requiere evidencia operacional futura (DC-3) · no inferencia silenciosa desde status alone.
- `PARTIALLY_COMPLETED` (record) describe resultado agregado · `PARTIAL_COVERAGE` (coverage type) describe sustitución · **no** duplicar semántica en un solo campo.

---

## 15. Duplicate prevention — modelo recomendado

### 15.1 Modelos analizados

| Modelo | Descripción |
|--------|-------------|
| **Modelo 1** | **Un WorkRecord principal** + WorkCoverageRecord(s) indicando quién realizó cada intervalo |
| **Modelo 2** | WorkRecords separados por performer vinculados por cobertura |

### 15.2 Decisión recomendada — **Modelo 1**

**Justificación:**

| Criterio | Modelo 1 |
|----------|----------|
| SSOT engagement | Un record por hecho comercial/evento-asignación |
| Auditoría | Assignment + coverage trail claro |
| Anti-triplicación | Evita record original + record sustituto + coverage redundante |
| Métricas | Performance atribuida vía coverage + set/session performer refs |
| Compensación futura | Scope por coverage/performer sin duplicar record |
| Alineación spec | WorkRecord = raíz · C-005 cuelga de record |

**Modelo 2** reservado solo si PO autoriza explícitamente engagements multi-performer como records separados (no default DC-2).

### 15.4 Criterios estrictos para WorkRecords separados (Modelo 2 — excepcional)

Solo permitido cuando **todas** aplican:

1. **Assignments comerciales independientes** (contratos/obligaciones operativas distintas).
2. **Scopes no superpuestos** temporalmente ni comercialmente.
3. **Eventos o engagements profesionalmente distintos** (no el mismo hecho operativo).
4. **Trabajos bajo identidades profesionales distintas** con obligaciones separadas.
5. Vínculo explícito entre records (referencia cruzada futura) — **no** duplicar + Coverage redundante.

**Prohibido:** record del original + record idéntico del sustituto + CoverageRecord para el **mismo** hecho operativo.

### 15.5 Reglas anti-duplicación WorkRecord

1. **Un WorkRecord por** `(assignmentReference, scheduled operational fact)` salvo supersession explícita.
2. Cobertura **no** crea segundo WorkRecord para el mismo engagement.
3. Sustituto recibe crédito via `coveringArtistProfileId` en CoverageRecord (y set-level performer refs si aplica).
4. Idempotencia impide segundo CoverageRecord activo mismo scope + intervalo + par identidades.

---

## 16. Professional history attribution

| Historial | Contenido |
|-----------|-----------|
| **Assignment History** | Original asignado · fechas · estado roster |
| **Performance History** | Trabajo **realizado** · atribuido a performer real vía coverage/set/session |
| **Compensation History** | DC-4+ · separado · no mezclar con performance |

**Artista original:** conserva assignment · **no** recibe crédito performance no realizado · puede ver cobertura relevante (§22).

**Artista sustituto:** crédito por intervalo realizado · **no** hereda assignment original como suyo.

**Principio:** intervalos no se cuentan dos veces en métricas de tiempo.

---

## 17. Separación estricta Owner / DJMago305

### 17.1 Principio absoluto

| Entidad | Rol |
|---------|-----|
| Cuenta Staff/Owner (Gerardo A. Valle) | Administración · autoría de registro · **no** identidad artística |
| Artist Profile **DJMago305** | Trabajo artístico · performance · historial profesional |
| ProfessionalIdentity **DJMago305** | Marca escénica · snapshot en contratos |

**No existe:** cambio de rol Owner→DJ · selector Owner→DJ · impersonation · modo “actuar como artista” · context switching en misma sesión · sesión híbrida Staff/Artist · login compartido.

### 17.2 Flujo correcto (producto)

**Ejemplo canónico — Owner asigna · DJMago305 ejecuta:**

1. Owner (cuenta Staff) crea o asigna una orden a **Artist Profile DJMago305**.
2. `createdByUserId` = cuenta Owner · `artistProfileId` en WorkRecord = **DJMago305** (asignado) · **sin** inferir desde sesión Owner.
3. DJMago305 inicia sesión con **su propia cuenta artística** (correo/acceso separados).
4. DJMago305 acepta y realiza el trabajo bajo **`professionalIdentityId` = DJMago305** explícito.
5. El registro conserva: autoría admin (Owner) · asignación/ejecución (DJMago305) · **sin** transición de identidad entre cuentas.

**Reglas generales:**

1. Gerardo accede portal **Staff/Owner** con cuenta Owner.
2. Administra operaciones autorizadas — **no** representa artísticamente a DJMago305 desde ese portal.
3. Para funciones/historial/trabajo artístico DJMago305 → **logout Owner** · **login cuenta/portal independiente DJMago305**.
4. Operación admin desde Owner puede tener `createdByUserId` = cuenta Owner.
5. Trabajo artístico requiere **`artistProfileId` = DJMago305** · **`professionalIdentityId` = DJMago305** explícitos.
6. Coexistencia en un registro = autoría admin + atribución profesional · **≠** Owner se convirtió en DJ.
7. `createdByUserId` **no** determina `artistProfileId` · `artistProfileId` **no** determina `createdByUserId`.

### 17.3 Inferencias prohibidas

WorkRecord · WorkSet · WorkCoverageRecord **nunca** infieren DJMago305 desde:

- rol Owner · sesión Owner · `createdByUserId` · permisos Staff · nombre legal Gerardo · propiedad empresa.

### 17.4 Caso cobertura — DJMago305 cubre a otro artista

| Campo | Valor |
|-------|-------|
| `createdByUserId` | Puede ser cuenta Owner (autoría admin) |
| `coveredArtistProfileId` | Artista originalmente asignado |
| `coveringArtistProfileId` | **DJMago305** |
| `coveringProfessionalIdentityId` | Identidad **DJMago305** |
| Cuenta Owner | **No sustituye** ningún identificador artístico |

Gestión operativa desde contexto autorizado correspondiente — **sin** impersonation desde portal Owner.

### 17.5 Invariantes Owner (obligatorios)

| ID | Regla |
|----|-------|
| **DWL-DC2-INV-OWNER-01** | Cuenta Staff/Owner **no** se convierte en Artist Profile por cambio de rol en portal |
| **DWL-DC2-INV-OWNER-02** | Acceso Owner y acceso DJMago305 = **contextos de autenticación separados** |
| **DWL-DC2-INV-OWNER-03** | `createdByUserId` = autoría administrativa · **no** identidad artística |
| **DWL-DC2-INV-OWNER-04** | Atribución profesional **siempre** requiere `ArtistProfileId` + `ProfessionalIdentityId` explícitos |
| **DWL-DC2-INV-OWNER-05** | Ningún contrato DWL habilita impersonation · role switching · acting-as |

### 17.6 Separación económica por capacidad (Owner · Manager/Seller · Artist)

Aunque una misma persona física participe en varias capacidades, cada capacidad conserva **rol económico futuro independiente**:

| Capacidad | Rol operativo DC-2 | Derecho económico futuro (DC-4+) | Consolidación automática |
|-----------|-------------------|----------------------------------|--------------------------|
| **Owner** | Administra · autoría admin · atribución empresarial futura | Owner entitlement / revenue attribution | **Prohibida** |
| **Manager / Seller (Staff)** | Gestiona · vende · autoría admin en registros Staff | Commission / compensación Staff | **Prohibida** |
| **Artist / DJ (ej. DJMago305)** | Ejecuta trabajo · performance · coverage | Compensación artística / beneficiary performer | **Prohibida** |

WorkSet y WorkCoverageRecord registran hechos del dominio **B** · **no** deciden ni fusionan líneas del dominio **C**. No implementar Compensation · Beneficiary · Commission · Owner Distribution en DC-2.

### 17.7 ProfessionalIdentityReference (C-011) — snapshot operativo

`ProfessionalIdentityReference` permanece **snapshot operativo** de bajo qué capacidad profesional se realizó el trabajo. **No es:**

- cuenta de usuario · login · rol Staff · email de autenticación · permiso · session context · beneficiary económico automático.

Describe capacidad (DJ · MC · técnico · cantante · coordinador) · **no** determina por sí sola quién recibe dinero (dominio **C** · DC-4+).

---

## 18. Cardinalidades

```
1 WorkRecord → 1..N WorkSessions
1 WorkSession → 0..N WorkSets
1 WorkRecord → 0..N WorkCoverageRecords
1 WorkCoverageRecord → 1 coverageScope (exactamente uno)
```

### 18.1 coverageScope — union discriminada (candidata · no implementar)

| Variante | Apunta a |
|----------|----------|
| `WORK_RECORD_SCOPE` | Record completo |
| `WORK_SESSION_SCOPE` | `workSessionId` |
| `WORK_SET_SCOPE` | `workSetId` |
| `TIME_RANGE_SCOPE` | Intervalo explícito dentro record/session |

**DWL-DC2-INV-07:** cobertura parcial **requiere** scope explícito · no inferir.

---

## 19. Invariantes DWL-DC2

| ID | Regla |
|----|-------|
| **DWL-DC2-INV-01** | WorkSet siempre pertenece a una WorkSession |
| **DWL-DC2-INV-02** | WorkSet es opcional · no crear sin necesidad de granularidad |
| **DWL-DC2-INV-03** | Crear WorkSets **no** genera compensaciones automáticamente |
| **DWL-DC2-INV-04** | Suma métricas sets **≠** earnings automáticamente |
| **DWL-DC2-INV-05** | Toda cobertura conserva artista original **y** performer real |
| **DWL-DC2-INV-06** | CoverageRecord **no** borra Assignment original |
| **DWL-DC2-INV-07** | Cobertura parcial requiere scope explícito |
| **DWL-DC2-INV-08** | No atribuir performance a quien no realizó el trabajo |
| **DWL-DC2-INV-09** | No registrar mismo intervalo realizado dos veces |
| **DWL-DC2-INV-10** | NO_SHOW **≠** FULL_REPLACEMENT automático |
| **DWL-DC2-INV-11** | REPLACED requiere evidencia futura · no inferencia silenciosa |
| **DWL-DC2-INV-12** | WorkCoverageRecord **no** representa pago |
| **DWL-DC2-INV-13** | WorkSet **no** representa compensación |
| **DWL-DC2-INV-14** | Owner account **no** sustituye Artist Profile |
| **DWL-DC2-INV-15** | Cash Flow **nunca** se modifica desde WorkSet/Coverage |
| **DWL-DC2-INV-16** | Métricas reconstruibles desde fuentes operativas |
| **DWL-DC2-INV-17** | Correcciones vía supersession append-only |
| **DWL-DC2-INV-18** | Datos sensibles minimizados |
| **DWL-DC2-INV-OWNER-01…05** | Ver §17.5 |

---

## 20. Use cases DC2-UC-01 … DC2-UC-12

| ID | Escenario | Decisión resumida |
|----|-----------|-------------------|
| **DC2-UC-01** | Una session sin sets | 1 session · 0 sets · tarifa scope session/record |
| **DC2-UC-02** | DJ A asignado · DJ B cubre viernes | Modelo 1 · Coverage FULL · covered=A covering=B · WorkRecord.artistProfileId=A |
| **DC2-UC-03** | 2 sets · tarifa global $500 | 2 sets · 1 compensación futura · no $500×2 |
| **DC2-UC-04** | 2 sets · tarifas $250 + $300 | 2 sets · 2 scopes WORK_SET futuros |
| **DC2-UC-05** | Jornada diurna + nocturna | 1 record · 2 sessions · sets solo si comercial |
| **DC2-UC-06** | Cobertura parcial | A primer intervalo · B resto · PARTIAL_COVERAGE |
| **DC2-UC-07** | No-show + reemplazo total | Record NO_SHOW + Coverage COMPLETED · no inferencia |
| **DC2-UC-08** | Relevo por retraso | LATE_TAKEOVER · intervalos explícitos |
| **DC2-UC-09** | Cobertura compartida | SHARED_COVERAGE · roles/intervalos distintos |
| **DC2-UC-10** | Owner actúa como DJ | createdBy=Owner · artistProfile=DJMago305 · login separado |
| **DC2-UC-11** | Misma persona DJ + MC | Identidades profesionales separadas · sets/sessions por rol si aplica |
| **DC2-UC-12** | Corrección coverage | Supersede · no borrar · DISPUTED→SUPERSEDED |

### 20.1 Múltiples roles — regla decisional

Una misma persona física puede participar con identidades profesionales distintas (DJ · MC · técnico · cantante · coordinador). **No fusionar** trabajos por pertenecer a la misma persona.

| Cambio | Criterio | Acción recomendada |
|--------|----------|-------------------|
| Mismo engagement · mismo intervalo · **misma** obligación operativa | Rol auxiliar dentro del mismo bloque | Misma WorkSession · identidad profesional explícita en snapshot/coverage si el rol cambia dentro del intervalo |
| **Obligación operativa distinta** (DJ set vs MC hosting como unidades comerciales) | Assignment/contract declara unidades separadas | WorkSession separada y/o WorkSet por unidad · **no** nuevo WorkRecord salvo §15.4 |
| Cobertura de rol específico | Solo parte del scope | WorkCoverageRecord con scope explícito (session/set/time range) |

Decisión basada en **obligación operativa y estructura existente** — **no** en identidad física · **no** nuevos perfiles ni autenticación.

---

## 21. Métricas futuras (proyección — no SSOT)

| Métrica | Definición | Fuente canónica | Riesgo doble conteo |
|---------|------------|-----------------|---------------------|
| `sets_scheduled` | Sets planificados | Assignment + WorkSet draft | Medio |
| `sets_completed` | Sets completados | WorkSet status | **Alto** vs session hours |
| `sets_partial` | Sets parciales | WorkSet | Medio |
| `sessions_with_multiple_sets` | Sessions con ≥2 sets | WorkSet aggregate | Bajo |
| `coverage_count` | Coberturas registradas | WorkCoverageRecord | Bajo |
| `full_replacement_count` | FULL_REPLACEMENT | WorkCoverageRecord | Medio |
| `partial_coverage_count` | PARTIAL | WorkCoverageRecord | Medio |
| `emergency_coverage_count` | EMERGENCY | WorkCoverageRecord | Bajo |
| `covered_minutes` | Minutos bajo cobertura | Coverage interval | **Alto** vs performed |
| `performed_minutes` | Minutos realizados | Session/Set actuals | **Alto** |
| `no_show_count` | No-shows | WorkRecord attendance | Bajo |
| `replacement_rate` | Ratio coberturas/eventos | Proyección | Medio |

**WorkMetricsSnapshot (C-013):** proyección versionada · reconstruible · **no** modifica WorkSet/Coverage/Record.

---

## 22. Privacy and sensitive data

### 22.1 Visibilidad futura (conceptual)

| Rol | Visible |
|-----|---------|
| **Owner** | Completo operativo · razones internas · ambas identidades |
| **Manager** | Amplio · según permisos |
| **Seller** | Limitado · razones sensibles opcionales |
| **Artist original** | Assignment · cobertura relevante · **no** datos privados sustituto innecesarios |
| **Artist sustituto** | Trabajo realizado · **no** datos privados original innecesarios |
| **Client** | Continuidad servicio · **no** conflictos internos · **no** finanzas |
| **Public profile** | Historial aprobado · **sin** médico · **sin** disputas |

### 22.2 Minimización

WorkCoverageRecord **no** contiene: diagnóstico médico · bank · tax ID · tokens · chat · evidencia binaria · notas disciplinarias extensas. Usar `reasonCode` controlado.

---

## 23. Idempotencia

Clave lógica conceptual (no hash · no persistence):

```
workRecordId
+ coverageScope key
+ coveredProfessionalIdentityId
+ coveringProfessionalIdentityId
+ effectiveStartAt + effectiveEndAt
+ sourceReference
+ active/superseded state
```

**WorkSet:** `workSessionId` + `sequence` + `sourceReference`.

Actualización: **supersede** o **reject duplicate** · **no** edición silenciosa.

---

## 24. Versioning and supersession

| Mecanismo | Clasificación |
|-----------|---------------|
| `schemaVersion` | Requerido contrato |
| `supersedesCoverageRecordId` | Requerido en correcciones |
| `correctionReason` | Requerido en supersession |
| `correctedAt` / `correctedByUserId` | Requerido |
| `active` vs `superseded` | Derivado de status |
| Borrado destructivo | **Prohibido** como estrategia principal |

---

## 25. Dependency matrix

| Contrato / fase | Depende de | Bloquea | SSOT | Notas |
|-----------------|------------|---------|------|-------|
| WorkSet | WorkSessionId · WorkRecord indirecto | Métricas · comp scope | **Sí** (set) | DC-2 |
| WorkCoverageRecord | WorkRecordId · identities · scope | Comp · metrics | **Sí** (coverage) | DC-2 |
| WorkSession (DC-1) | WorkRecord | WorkSet | **Sí** | Prerequisite |
| Compensation (DC-4) | WorkRecord/Session/Set/Coverage refs | OFTL | Futuro | No DC-2 |
| Evidence (DC-3) | Coverage disputed | Approval | Futuro | — |
| Supabase / UI / NC / CF | — | — | — | **No bloquean** DC-2 |

---

## 26. Future phase dependencies

| Fase | Depende de decisiones DC-2 |
|------|----------------------------|
| **DC-3** Evidence & Approval | DISPUTED coverage · provisional coverage · authorizationContext |
| **DC-4** Compensation | CompensationScope · Modelo A/B/C · set vs session basis |
| **DC-5** Revenue | Independiente · no mezclar sets |
| **DC-7** Metrics | sets_* · coverage_* proyecciones |
| **DC-8** OFTL Bridge | No desde Set/Coverage directamente |
| **DC-9** Domain Events | Post-commit coverage/set writes |

**Bloqueado hasta DC-3:** auto-aprobación cobertura · evidencia mínima REPLACED.

**Bloqueado hasta DC-4:** montos · PER_SET vs FLAT_PACKAGE enforcement runtime.

---

## 27. Anti-patterns (prohibidos)

- WorkSet por canción · sets para inflar métricas · tarifa global × N sets.
- Sobrescribir artista original con sustituto en WorkRecord.
- Performance completa a ambos artistas.
- `createdByUserId` como artista · Owner como ProfessionalIdentity.
- Obligation desde Coverage · editar Cash Flow desde Set.
- Métricas como SSOT · borrar Coverage corregido.
- Diagnóstico médico en reason · WorkRecord duplicado sin regla.
- UI state como SSOT · inferir reemplazo solo desde NO_SHOW.
- Coverage resuelve disputa financiera automáticamente.
- **Role switching · impersonation · owner-as-artist mode · sesión híbrida.**

---

## 28. Risks

| ID | Riesgo | Impacto | Prob. | Mitigación | Fase | Block |
|----|--------|---------|-------|------------|------|-------|
| **R-DWL-DC2-01** | Doble compensación multi-set | Alto | Med | DWL-INV-07 · CompensationScope | DC-4 | Y |
| **R-DWL-DC2-02** | WorkRecord duplicado cobertura | Alto | Med | Modelo 1 | DC-2 | Y |
| **R-DWL-DC2-03** | Crédito incorrecto artista original | Alto | Med | INV-08 · coverage refs | DC-2 | Y |
| **R-DWL-DC2-04** | Doble intervalo temporal | Alto | Med | INV-09 · scope | DC-2 | Y |
| **R-DWL-DC2-05** | Confusión Session/Set | Med | Alta | RULE-SET-01 | DC-2 | Y |
| **R-DWL-DC2-06** | Métricas infladas | Med | Med | Proyección only | DC-7 | N |
| **R-DWL-DC2-07** | Estados contradictorios | Med | Med | Tabla §14 | DC-2 | Y |
| **R-DWL-DC2-08** | Cobertura no autorizada | Alto | Med | DC-3 approval | DC-3 | N |
| **R-DWL-DC2-09** | Datos sensibles en reason | Alto | Baja | reasonCode | DC-2 | Y |
| **R-DWL-DC2-10** | Corrección destructiva | Alto | Baja | Supersession | DC-2 | Y |
| **R-DWL-DC2-11** | Owner/Artist fusion | Alto | Med | OWNER-01…05 | DC-2 | Y |
| **R-DWL-DC2-12** | Scope ambiguo | Alto | Med | Union scope | DC-2 | Y |
| **R-DWL-DC2-13** | Medianoche/timezone | Med | Med | IANA · session bounds | DC-2 | N |
| **R-DWL-DC2-14** | Refs externas locales | Bajo | Alta | Events module futuro | Post | N |
| **R-DWL-DC2-15** | Acoplamiento compensación prematuro | Med | Med | No money in DC-2 | DC-4 | N |

---

## 29. Open questions

| ID | Pregunta | Clasificación |
|----|----------|---------------|
| **OQ-01** | ¿Assignment único multi-venue = 1 o N WorkRecords? | REQUIRES PO DECISION |
| **OQ-02** | ¿Modelo C mixto permitido en producto? | REQUIRES PO DECISION |
| **OQ-03** | ¿SHARED_COVERAGE formaliza equipos permanentes? | NON-BLOCKING |
| **OQ-04** | ¿Provisional coverage sin approval hasta DC-3? | BLOCKING FOR DC-3 · not DC-2 |
| **OQ-05** | Reglas sustitución contractual legal | REQUIRES LEGAL REVIEW |
| **OQ-06** | Tratamiento contable PER_SET vs FLAT | REQUIRES ACCOUNTING REVIEW |
| **OQ-07** | Clasificación fiscal performers sustitutos | REQUIRES TAX REVIEW |
| **OQ-08** | UX registro cobertura móvil | REQUIRES UX REVIEW |

---

## 30. Implementation roadmap (futuro — no autorizar)

Ticket propuesto: **`TICKET-V2-DWL-DC-2-SETS-AND-COVERAGE-IMPLEMENTATION-001`**

Alcance conceptual TS:

- `WorkSetId` · `WorkCoverageRecordId` branded
- Enums: `SetStatus` · `SetType` · `CoverageType` · `CoverageStatus` · `CoverageScope` union
- Entidades C-003 · C-005
- Guards: set sequence · scope validity · coverage interval ⊆ session/record
- Barrels · tests ≥40 casos
- Ticket documental implementación

**No iniciar** hasta aprobación PO de este discovery.

---

## 31. Acceptance criteria (discovery)

- [x] WorkSession vs WorkSet definido · regla decisional
- [x] WorkSet opcional · anti-granularidad artificial
- [x] Tarifa global / por set / mixto con gates
- [x] Cobertura total y parcial · Modelo 1 recomendado
- [x] Artista original ≠ sustituto · historial separado
- [x] Anti-duplicación WorkRecord · anti-doble intervalo · anti-doble compensación (conceptual)
- [x] No-show / replaced / partial precedencia
- [x] Owner/DJMago305 · OWNER-01…05 · separación económica Owner/Manager-Seller/Artist · **sin impersonation**
- [x] Tres dominios A/B/C · ProfessionalIdentity snapshot · **sin autenticación**
- [x] Métricas proyección · privacidad · idempotencia · supersession
- [x] Cardinalidades · 18+ invariantes · 12 DC2-UC · anti-patterns · matrix · 15 riesgos · roadmap
- [x] Impact analysis · gates legal/contable/fiscal
- [x] Documentación only · sin TypeScript · sin commit
- [ ] Aprobación arquitectónica PO (pendiente)

---

## 32. Legal, accounting, tax gates

**ESTADO LEGAL:**

DISCOVERY TÉCNICO — PENDIENTE DE REVISIÓN LEGAL PROFESIONAL CUANDO EXISTAN REGLAS CONTRACTUALES DE SUSTITUCIÓN, RESPONSABILIDAD O EVIDENCIA.

**ESTADO CONTABLE:**

SIN IMPLEMENTACIÓN CONTABLE. REGLAS TARIFA GLOBAL/POR SET DEFINEN PREVENCIÓN DOBLE CONTEO PARA FASE FUTURA.

**ESTADO FISCAL:**

SIN CLASIFICACIONES FISCALES. NO DETERMINA EMPLEADO · CONTRATISTA · PAYROLL · OWNER DRAW · TRATAMIENTO TRIBUTARIO.

No afirmar aprobación profesional · cumplimiento garantizado · production ready.

---

## 33. Impact analysis

| Componente | Modificado |
|------------|------------|
| DWL parent discovery | **No** |
| DWL specification | **No** |
| DWL-DC-1 TypeScript | **No** |
| OFTL · Cash Flow · NC | **No** |
| Artist Profile · Staff · Events runtime | **No** |
| Supabase · V1 | **No** |

**RIESGO FUNCIONAL DIRECTO:**

NULO EN RUNTIME, PORQUE EL TICKET CREA EXCLUSIVAMENTE DOCUMENTACIÓN.

**RIESGO ARQUITECTÓNICO:**

CONTROLADO MEDIANTE DEFINICIÓN PREVIA DE CARDINALIDAD, IDENTIDAD, COBERTURA, ANTIDUPLICACIÓN, SEPARACIÓN OWNER/DJMago305, PRIVACIDAD Y GATES DEL PRODUCT OWNER.

---

## 34. Confirmación final

| Afirmación | Estado |
|------------|--------|
| Discovery documentado | ✓ |
| Código · tests · runtime | ✗ |
| Commit · push | ✗ |
| Impersonation / role switching | **Prohibido · documentado** |

**Estado:**

**TICKET-V2-DWL-DC-2-SETS-AND-COVERAGE-DISCOVERY-001 — DOCUMENTADO — PENDIENTE DE REVISIÓN Y APROBACIÓN ARQUITECTÓNICA PO**

No marcar: IMPLEMENTADO · FINALIZADO · PRODUCTION READY · LEGALMENTE APROBADO · RELEASED · DEPLOYED.

No iniciar implementación DC-2 · no modificar DWL-DC-1.

---

*Discovery canónico Work Ledger DC-2 Sets & Coverage. Implementación requiere ticket + autorización PO separada.*
