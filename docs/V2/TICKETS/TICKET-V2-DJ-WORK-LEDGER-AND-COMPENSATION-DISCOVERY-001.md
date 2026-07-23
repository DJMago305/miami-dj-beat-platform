# TICKET-V2-DJ-WORK-LEDGER-AND-COMPENSATION-DISCOVERY-001

## Work Ledger — Performer Work, Compensation & OFTL Bridge (Documentation Only)

| Campo | Valor |
|-------|-------|
| Ticket | V2 DJ Work Ledger & Compensation Discovery |
| Estado | **DOCUMENTADO — PENDIENTE DE REVISIÓN Y APROBACIÓN PO** |
| Fase | **DWL discovery** — modelo operativo · **sin implementación** |
| Módulo conceptual | **Work Ledger (DWL)** |
| Entidad principal recomendada | **`WorkRecord`** (genérico performer/talent — ver §6) |
| Parent OFTL | `TICKET-V2-OFTL-DATA-CONTRACTS-001.md` · DC-1 · DC-2 discovery |
| Rama baseline | `plan/v2-phase-4-api-client` |
| HEAD baseline | `ad49ec9511b8f7a7ef1af2042b8847decc8b529c` |
| Fecha discovery | 2026-07-23 |
| Modo | **Documentación únicamente** — cero código · cero registros reales |

---

## 0. Declaración operativa

Este ticket **no autoriza**:

- TypeScript, runtime, Supabase, migraciones, providers, repositories, adapters, servicios, UI, tests;
- captura de trabajos históricos reales, obligaciones, pagos ni transacciones;
- modificar Eventos, Staff Portal, Artist Portal, Cash Flow, DC-1, DC-2, Notification Center;
- staging, commit, push, PR, merge, deploy.

**Estado exitoso:** discovery documentado · **SIN CÓDIGO** · commit local autorizado PO · OFTL / NC / Cash Flow / portales sin tocar.

---

## 1. Objetivo

Diseñar conceptualmente un **registro canónico del trabajo realmente realizado** por un DJ, artista, talento contratado o proveedor de servicio artístico/técnico — y su relación con **compensación**, **obligaciones OFTL**, **pagos**, **allocations** y **proyección Cash Flow**, sin confundir operación con finanzas ni identidad administrativa con identidad artística.

---

## 2. Baseline Git

| Check | Valor esperado | Resultado |
|-------|----------------|-----------|
| Rama | `plan/v2-phase-4-api-client` | ✓ |
| HEAD | `ad49ec9511b8f7a7ef1af2042b8847decc8b529c` | ✓ |
| Working tree | Limpio | ✓ |

---

## 3. Documentos de referencia leídos

| Documento | Rol |
|-----------|-----|
| `docs/V2/MIAMIDJBEAT-PROYECTO-CONSTITUCION.md` | Gobernanza V2 |
| `docs/V2/MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md` | Protocolo PO |
| `docs/workflow-control.md` | Sin commit/deploy sin autorización |
| `docs/AGENT-MEMORY.md` | Tiers · roles · legal name vs stage name |
| `docs/V2/README.md` | Mapa V2 |
| `TICKET-V2-ARTIST-CASH-FLOW-MANUAL-TRANSACTION-LEDGER-DISCOVERY-001.md` | OFTL · obligations · UC artist payout |
| `TICKET-V2-OFTL-DATA-CONTRACTS-001.md` | Cadena canonical finance |
| `TICKET-V2-OFTL-DC-1-CORE-FINANCIAL-CONTRACTS-001.md` | FinancialObligation · Transaction · Leg |
| `TICKET-V2-OFTL-DC-2-PAYMENT-ALLOCATION-DISCOVERY-001.md` | Allocation · métricas · Cash Flow projection |

**Referencia no modificada:** contratos eventos · asignaciones artistas · operaciones Staff · perfiles Artist · roles Owner / Manager / Seller / Artist.

---

## 4. Problema que debe resolver

### 4.1 ¿Por qué no basta con evento, asignación, factura, pago o transacción?

| Artefacto existente | Qué captura | Qué **no** prueba |
|---------------------|-------------|-------------------|
| **Event** | Compromiso comercial / producción | Que alguien **trabajó** X sets el día Y |
| **ArtistAssignment** | Intención de roster | Asistencia real · cobertura · horas · sets completados |
| **Invoice / lead billing** | Cobro al cliente | Compensación artística acordada vs margen empresa |
| **OwnerFinancialTransaction** | Pago/cobro ejecutado | Derecho a compensación **antes** del pago |
| **FinancialObligation** | Dinero debido | Evidencia operativa del trabajo que originó la deuda |

Se requiere evidencia operativa de que una persona o agrupación:

- fue asignada · **trabajó** (o no-show) · realizó uno o varios sets;
- cubrió a otro artista · cumplió total o parcialmente;
- generó **ingreso atribuido** para Miami DJ Beat (distinto de compensación);
- obtuvo **derecho a compensación** (distinto de pago ejecutado);
- fue pagada o continúa **pendiente** — trazable hacia OFTL.

---

## 5. Separación de conceptos

| Concepto | Responsabilidad única | No es |
|----------|----------------------|-------|
| **Event** | Contexto comercial/producción del engagement | Prueba de sets ni pago |
| **ArtistAssignment** | Roster planificado: quién debía actuar | Work completed · compensación final |
| **`WorkRecord`** | Evidencia operativa: trabajo realizado o fallido | Factura · pago · obligación · transacción · allocation · proyección CF |
| **CompensationCalculation** | Derivación de monto acordado/calculado | Pago ejecutado |
| **CompensationRecord** | Snapshot acordado/aprobado de compensación | Cash paid |
| **FinancialObligation** | Dinero debido (OFTL-C-001) | Evidencia de performance |
| **OwnerFinancialTransaction** | Pago/cobro ejecutado (OFTL-C-002) | Trabajo realizado |
| **PaymentAllocation** | Imputación pago → obligación (OFTL-C-004) | Creación de work |
| **Cash Flow Projection** | Lectura/consolidación | Fuente canónica · writer |

**`WorkRecord` no representa:** factura · pago ejecutado · `FinancialObligation` · `OwnerFinancialTransaction` · `PaymentAllocation` · proyección Cash Flow.

**Regla:** Payment Allocation **no** crea trabajo. Work Ledger **no** marca pagos sin evidencia OFTL.

---

## 6. Nombre conceptual recomendado

| Opción | Veredicto discovery |
|--------|---------------------|
| `DJWorkRecord` | Demasiado estrecho — excluye MC, orquesta, técnico, proveedor |
| **`WorkRecord`** | **Recomendado** — entidad canónica genérica |
| Módulo | **Work Ledger (DWL)** — ticket mantiene prefijo DJ por alcance PO inicial |

**Alcance por `WorkRole` / `ProfessionalRole`:** DJ · cantante · orquesta · MC · bailarín · proveedor · técnico · talento contratado — **sin** duplicar entidades por tipo.

Contratos futuros posibles (no implementar): `WorkRecord` · `WorkSession` (sets) · `CompensationRecord` · `RevenueAttribution` — **no** un monolito único obligatorio (§9).

---

## 7. Roles múltiples de una misma persona

Una persona puede actuar como Owner · Manager · Seller · DJ · Artist · proveedor · técnico.

**Regla:** la compensación registra el **rol bajo el cual fue generada**.

| Identidad | Ejemplo | Tratamiento financiero |
|-----------|---------|------------------------|
| Gerardo A. Valle como **Owner** | Retiro · utilidades · reembolso préstamo | **No** mezclar con honorario artístico |
| **DJMago305** como perfil artístico | Work · compensación artística | Work Ledger + OFTL obligation |
| Gerardo como **Seller** | Comisión venta | Contrato/comisión separado |

**Prohibido mezclar:** honorario artístico · comisión venta · salario · distribución utilidades · retiro Owner · reembolso · gasto personal — cada categoría = tratamiento financiero separado (tickets futuros).

---

## 8. Modelo conceptual (sin TypeScript)

| Tipo conceptual | Propósito |
|-----------------|-----------|
| `WorkRecordId` | Identificador canónico del hecho de trabajo |
| `ArtistAssignmentId` | Referencia al roster planificado |
| `EventEngagementId` | Vínculo evento + venue + engagement (futuro si distinto de event_id) |
| `WorkRole` / `ProfessionalRole` | DJ · MC · vendor · etc. |
| `WorkRecordStatus` | Lifecycle del registro operativo |
| `AttendanceStatus` | Presente · tardío · parcial · no-show |
| `PerformanceStatus` | Completado · parcial · cancelado · sustituido |
| `CompensationBasis` | FIXED_SESSION · HOURLY · PER_SET · DAILY · PER_EVENT · GRATUITY_WAIVED · PENDING_DETERMINATION |
| `CompensationCalculationStatus` | DRAFT · CALCULATED · APPROVED · SUPERSEDED · REVERSED |
| `CompensationRecord` | Snapshot compensación acordada/aprobada |
| `RevenueAttribution` | Ingreso bruto atribuido a MDJB por engagement (≠ compensación) |
| `WorkEvidenceReference` | Contrato · email · check-in · staff note · media |
| `WorkAuditMetadata` | JSON-safe audit trail |

---

## 9. Campos conceptuales — análisis de responsabilidades

**No** afirmar que todos los campos viven en un solo contrato. Separación sugerida:

### 9.1 `WorkRecord` (hecho operativo)

`work_record_id` · `event_id` · `venue_id` · **`artist_profile_id`** (obligatorio — §25) · `user_id` opcional · `display_name_snapshot` · `professional_role` · `assignment_id` · `scheduled_date` · `actual_start_at` · `actual_end_at` · `timezone` · `scheduled_sets` · `completed_sets` · `session_count` · `coverage_reason` · `covered_artist_id` · `work_status` · `attendance_status` · `performance_status` · `source_reference` · `evidence_reference` · `notes` · `created_by` · `approved_by` · `approved_at` · audit metadata.

### 9.2 `RevenueAttribution` (ingreso empresarial — separado)

`gross_revenue_attributed` · moneda · método de atribución · referencia factura/lead · **no** implica compensación del performer.

### 9.3 `CompensationRecord` (derecho económico — separado)

`compensation_amount` · `compensation_currency` · `compensation_basis` · `compensation_status` · `obligation_id` futuro (link OFTL) · beneficiary refs (§25).

---

## 10. Sets y sesiones

El modelo **debe** soportar conceptualmente:

| Escenario | Soporte |
|-----------|---------|
| Sesión simple | 1 session · 1 set |
| Dos sets mismo día | 2 sets · tarifa total **o** independiente |
| Jornada diurna + nocturna | 2 sessions · timezone explícito |
| Múltiples venues mismo día | N work records o N sessions |
| Cobertura parcial / último minuto | `coverage_reason` · `covered_artist_id` |
| Horas adicionales | basis HOURLY · metadata |
| Tarifas | fija sesión · hora · set · diaria · evento · gratuidad autorizada · **pendiente determinación** |

**No** implementar motor de cálculo en este ticket.

---

## 11. Ingreso empresarial vs compensación artística

**Principio obligatorio:**

```
Ingreso facturado/recibido por Miami DJ Beat  ≠  Compensación del DJ/artista
```

Ejemplo conceptual: MDJB factura **$855** al cliente. El artista puede tener derecho a **$855 · $500 · $250 · otro · $0 temporal · pendiente aprobación**.

La diferencia puede ser: margen · equipos · producción · comisión · personal · seguros · transporte · impuestos · gastos operativos · compensaciones adicionales.

**Cadena conceptual (no equivalencias):**

| Capa | Concepto | ≠ |
|------|----------|---|
| Empresa | Ingresos Miami DJ Beat | Revenue attribution |
| Operativo | Revenue attribution | Compensation earned |
| Financiero | Compensation earned | Financial obligation |
| Ejecución | Financial obligation | Cash paid |
| Owner personal | Cash paid | Owner draw · profit distribution · reimbursement · seller commission |

**No** definir tratamiento fiscal/contable definitivo en este discovery.

---

## 12. Owner actuando como DJ

Cuando el Owner realiza trabajo artístico:

| Regla | Detalle |
|-------|---------|
| Ingreso inicial | Pertenece a **Miami DJ Beat** (revenue attribution) |
| Work Record | Pertenece al perfil **DJMago305** — no a cuenta Owner (§25) |
| Compensación artística | Puede quedar **pendiente** — no pagar no elimina obligación conceptual |
| Separación | **No** confundir con retiro Owner · utilidades · reembolso · préstamo |
| Clasificación legal | **Decisión contable/fiscal futura** — no afirmar obligación legal de pagarse a sí mismo |

Ver §25.8 autoaprobación · §17 DWL-UC-13 · UC-19…21.

---

## 13. Flujo futuro con OFTL

```
Event
    ↓
ArtistAssignment
    ↓
WorkRecord (+ WorkSession / sets)
    ↓
CompensationCalculation → CompensationRecord
    ↓
FinancialObligation          (OFTL-C-001 — puede originarse aquí)
    ↓
OwnerFinancialTransaction    (OFTL-C-002)
    ↓
PaymentAllocation            (OFTL-C-004)
    ↓
Cash Flow Projection         (read — CFMovement futuro)
```

**Work Record puede originar** una obligación futura · **no es** transacción ni pago.

---

## 14. Transparencia financiera y métricas

**Principio:** cada dominio produce **métricas independientes**. Cash Flow **consolida y proyecta**. Cash Flow **no modifica** Work Records.

### 14.1 Métricas Work Ledger (conceptuales — no implementar)

| Métrica | Descripción |
|---------|-------------|
| `sessions_scheduled` | Sesiones planificadas |
| `sessions_completed` | Completadas |
| `sessions_cancelled` | Canceladas |
| `sets_completed` | Sets realizados |
| `hours_worked` | Horas (basis HOURLY) |
| `gross_revenue_attributed` | Ingreso MDJB atribuido |
| `compensation_earned` | Derecho acordado/aprobado |
| `compensation_pending` | Earned − obligation/paid policy |
| `compensation_paid` | Respaldado por OFTL payment + allocation |
| `compensation_reversed` | Correcciones append-only |
| `venue_revenue` | Agregado por venue |
| `artist_revenue` | Atribución performer (≠ margen) |
| `coverage_count` | Coberturas registradas |

### 14.2 Métricas OFTL y Cash Flow

OFTL produce métricas canónicas financieras (DC-1/DC-2 §13). Cash Flow **consume** proyecciones autorizadas · **no** fusiona identidades Owner/DJMago305 (§25.9).

---

## 15. Prevención de doble conteo

| Regla | Detalle |
|-------|---------|
| Revenue attribution | **No** crea segundo ingreso canónico |
| Compensation earned | **≠** cash paid |
| Obligation created | **≠** cash paid |
| Transaction POSTED | **≠** bank settlement |
| Allocation | **No** dinero nuevo (DC-2 §13.12) |
| Cash Flow | **No** dinero nuevo |
| Dos sets · tarifa única | **No** dos pagos si acuerdo fue monto total |
| Cobertura | **No** duplicar evento principal |
| Owner como DJ | **No** gasto artístico + owner draw mismo monto sin contratos separados |

---

## 16. Trazabilidad

Toda cifra futura debe rastrearse a: evento · venue · asignación · artista · rol · fecha · set/sesión · tarifa acordada · cálculo · aprobación · obligación · pago · allocation · evidencia · actor del cambio.

Campos futuros (documentar necesidad): `person_id` · `user_account_id` · `artist_profile_id` · `professional_identity_id` · `beneficiary_party_id` · `approved_by_user_id` · `created_by_user_id` · `source_reference` · audit · `correlation_id` · `causation_id` · `calculation_version` · `generated_at`.

---

## 17. Casos de uso DWL-UC-01 … DWL-UC-26

| ID | Escenario |
|----|-----------|
| **DWL-UC-01** | DJ asignado y trabajo completado |
| **DWL-UC-02** | DJ cubre a otro DJ |
| **DWL-UC-03** | Dos sets bajo tarifa total |
| **DWL-UC-04** | Dos sets con tarifas independientes |
| **DWL-UC-05** | Jornada diurna y nocturna |
| **DWL-UC-06** | Dos venues el mismo día |
| **DWL-UC-07** | Trabajo parcial |
| **DWL-UC-08** | No-show |
| **DWL-UC-09** | Evento cancelado antes del trabajo |
| **DWL-UC-10** | Compensación fija por sesión |
| **DWL-UC-11** | Compensación por hora |
| **DWL-UC-12** | Compensación pendiente de aprobación |
| **DWL-UC-13** | Owner actuando como DJ sin pago inmediato |
| **DWL-UC-14** | Ingreso empresarial mayor que compensación artística |
| **DWL-UC-15** | Compensación revertida o corregida |
| **DWL-UC-16** | Artista sin cuenta de usuario |
| **DWL-UC-17** | Agrupación con varios integrantes |
| **DWL-UC-18** | Proveedor o técnico no artístico |
| **DWL-UC-19** | Owner: cuenta Staff separada de perfil artístico |
| **DWL-UC-20** | Owner actúa como DJ — registro en DJMago305 |
| **DWL-UC-21** | Cuenta Staff aprueba trabajo de perfil vinculado misma persona |
| **DWL-UC-22** | Artista con perfil profesional sin cuenta de acceso |
| **DWL-UC-23** | Una cuenta administra varios perfiles artísticos |
| **DWL-UC-24** | Agrupación: perfil artístico ≠ beneficiario financiero |
| **DWL-UC-25** | Cambio de beneficiario sin alterar historial artístico |
| **DWL-UC-26** | Métricas Artist Profile separadas de métricas empresariales |

---

## 18. Ejemplos operativos anonimizados

Modelo conceptual — **no** registrar fechas exactas · datos bancarios · métodos de pago · documentos fiscales · datos privados · transacciones reales.

| Ejemplo | Work | Compensación |
|---------|------|----------------|
| **DJ A** cubre un viernes | 1 session · coverage | $250 acordado |
| **DJ B** jueves + sábado | 2 sessions | $250 c/u |
| **DJ C** viernes + domingo | 2 sessions | $250 c/u |
| **DJ B** domingo 2 sets | 2 sets · **tarifa total** | $500 total (no 2×$250) |
| **Owner/DJMago305** evento corporativo | Work en perfil DJMago305 | Revenue MDJB $855 · compensación artística **pendiente** |

---

## 19. Dependencias

### 19.1 Depende conceptualmente de

Event · Venue · Artist Profile · Artist Assignment · Staff authorization · OFTL `FinancialObligation` futuro (bridge DWL-RM-08).

### 19.2 No depende directamente de

PaymentAllocation · BankSettlement · Reconciliation · Notification provider · Cash Flow runtime · Supabase · UI.

---

## 20. Impact analysis

| Componente existente | Relación Work Ledger | ¿Modificado este ticket? | Riesgo futuro | Gate |
|----------------------|---------------------|--------------------------|---------------|------|
| DC-1 OFTL contracts | Obligation bridge target | **No** | Bajo | PO + DWL-RM-08 |
| DC-2 Allocation discovery | Downstream imputación | **No** | Medio doble conteo | DC-2 rules |
| Notification Center | Eventos post-obligation | **No** | Bajo | NC-DC |
| Staff Operations | Aprobación work | **No** | Medio fraude | DWL-RM-06 |
| Artist Portal | MY WORK futuro | **No** | Privacidad | DWL-RM-07 |
| Cash Flow runtime | Proyección read | **No** | Alto si writer | DWL-RM-09 |
| Events / assignments V1 | Fuente planificación | **No** | Legacy drift | Bridge ticket |
| `leads.dj_agreed_payout_usd` | Legacy obligation hint | **No** | Duplicidad | Migración PO |

**Confirmado:** DC-1 · DC-2 · NC · Staff · Artist · Cash Flow · runtime — **sin modificación** en este ticket.

---

## 21. Riesgos

### 21.1 Riesgos operativos generales

| ID | Riesgo |
|----|--------|
| R-DWL-01 | Trabajo registrado dos veces |
| R-DWL-02 | Cobertura duplicada |
| R-DWL-03 | Tarifa total interpretada por set |
| R-DWL-04 | Ingreso confundido con compensación |
| R-DWL-05 | Compensación confundida con pago |
| R-DWL-06 | Owner compensation confundida con owner draw |
| R-DWL-07 | Edición retroactiva sin auditoría |
| R-DWL-08 | No-show marcado como completado |
| R-DWL-09 | Evidencia insuficiente |
| R-DWL-10 | Fechas / timezones incorrectos |
| R-DWL-11 | Artista sin perfil |
| R-DWL-12 | Artista con varios roles |
| R-DWL-13 | Agrupaciones · varios beneficiarios |
| R-DWL-14 | Impuestos / clasificación laboral |
| R-DWL-15 | Fraude |
| R-DWL-16 | Conflicto de aprobación |
| R-DWL-17 | Métricas distintas entre portales |
| R-DWL-18 | Doble conteo hacia Cash Flow |

### 21.2 Riesgos identidad (§25)

| ID | Riesgo |
|----|--------|
| R-DWL-IDENTITY-01 | Confundir cuenta Owner con perfil DJMago305 |
| R-DWL-IDENTITY-02 | Trabajos artísticos en identidad Staff incorrecta |
| R-DWL-IDENTITY-03 | Compensación artística mezclada con owner draw |
| R-DWL-IDENTITY-04 | Autoaprobación sin trazabilidad reforzada |
| R-DWL-IDENTITY-05 | Margen empresarial visible en perfil artista |
| R-DWL-IDENTITY-06 | Artist Profile = beneficiario financiero automático |
| R-DWL-IDENTITY-07 | Cuenta administra varios perfiles sin autorización |
| R-DWL-IDENTITY-08 | Historial perdido al cambiar cuenta/beneficiario |
| R-DWL-IDENTITY-09 | Métricas empresariales mezcladas con personales |
| R-DWL-IDENTITY-10 | Mismo trabajo duplicado Staff Account + Artist Profile |

---

## 22. Supervisión legal, contable y fiscal

**ESTADO LEGAL:**

**ARQUITECTURA TÉCNICA — PENDIENTE DE REVISIÓN LEGAL PROFESIONAL**

**ESTADO CONTABLE:**

**MODELO CONCEPTUAL — PENDIENTE DE REVISIÓN CONTABLE PROFESIONAL**

**ESTADO FISCAL:**

**CLASIFICACIONES Y COMPENSACIONES — PENDIENTES DE REVISIÓN FISCAL PROFESIONAL**

**No afirmar:** clasificación definitiva empleado/contratista · tratamiento fiscal Owner · deducibilidad · payroll · retención · reporting fiscal · cumplimiento garantizado · legalmente aprobado.

**Gates futuros:** revisión legal · contable · fiscal · privacidad · seguridad · auditoría · retención · permisos por rol · exposición datos financieros · exportaciones · evidencia.

---

## 23. Roadmap futuro

| ID | Entregable |
|----|------------|
| **DWL-RM-01** | Data Contracts (`WorkRecord`, sessions, compensation) |
| **DWL-RM-02** | Guards e invariantes |
| **DWL-RM-03** | Compensation calculation contracts |
| **DWL-RM-04** | Tests unitarios |
| **DWL-RM-05** | Provider in-memory |
| **DWL-RM-06** | Staff review workflow |
| **DWL-RM-07** | Artist work history (MY WORK / PERFORMANCE HISTORY) |
| **DWL-RM-08** | OFTL obligation bridge |
| **DWL-RM-09** | Cash Flow projection bridge (read-only) |
| **DWL-RM-10** | Notification domain events |
| **DWL-RM-11** | Persistence append-only |
| **DWL-RM-12** | Supabase + RLS (zona roja PO) |
| **DWL-RM-13** | Reports y exportación |
| **DWL-RM-14** | Captura histórica controlada (§24) |

---

## 24. Captura histórica futura (no implementar)

**Los trabajos históricos reales NO se registran en este ticket.** Este discovery solo documenta el flujo futuro autorizado.

Flujo documental para trabajos anteriores:

1. Crear draft Work Record.
2. Fecha exacta + timezone.
3. Seleccionar venue.
4. Seleccionar artista o referencia segura (perfil · sin cuenta).
5. Indicar sesiones / sets.
6. Registrar ingreso empresarial (RevenueAttribution).
7. Registrar compensación acordada (CompensationRecord).
8. Adjuntar / referenciar evidencia.
9. Revisar duplicados.
10. Aprobar por Owner (conflict rules §25.8).
11. Crear `FinancialObligation` si corresponde (OFTL bridge).
12. Registrar pago **solo** con evidencia OFTL.
13. Proyectar métricas a Cash Flow (read).
14. Conservar audit trail append-only.

---

## 25. Separación cuenta, persona y perfil artístico

### 25.1 Person ≠ User Account ≠ Staff Account ≠ Artist Profile ≠ Professional Identity ≠ Beneficiary Party

| Entidad | Representa |
|---------|------------|
| **Person** | Individuo legal/natural |
| **User Account** | Login · sesión |
| **Staff Account** | Permisos Owner/Manager/Seller |
| **Artist Profile** | Identidad profesional pública (p. ej. DJMago305) |
| **Professional Identity** | Marca escénica · historial · métricas artísticas |
| **Beneficiary Party** | Receptor contractual/fiscal del pago (puede ≠ performer profile) |

**Reglas de persistencia:** una **User Account** puede administrar **varios** Artist Profiles · un **Artist Profile** puede continuar existiendo aunque cambie la cuenta que lo administra · historial artístico **no** depende de mantener la misma cuenta login.

**No** asumir `artist_profile_id` = `payee_id` / `beneficiary_party_id`.

**Caso obligatorio — Gerardo A. Valle (persona):**

1. **Cuenta Staff Owner** — permisos administrativos · aprobaciones · administración · acceso financiero global · gestión empresarial.
2. **Perfil artístico DJMago305** — identidad artística · trabajos · sets · sesiones · venues · compensación artística · métricas · documentos · reviews · reputación · disponibilidad.

Vinculados de forma **segura** · **no** la misma entidad funcional. Ingreso empresarial **no** se convierte automáticamente en compensación DJ · compensación DJ **no** se convierte en owner draw · compensación puede quedar **pendiente** · **no** doble pago.

### 25.2 Regla de pertenencia de Work Records

Todo Work Record se vincula al **perfil profesional** que realizó el trabajo:

- DJ Ary → perfil DJ Ary · DJ Solitario → perfil DJ Solitario · DJ Yuyo → perfil DJ Yuyo · Gerardo como DJ → **DJMago305**.

**Prohibido** vincular trabajo artístico directamente al perfil Staff/Owner cuando existe Artist Profile.

Staff/Owner **puede:** crear drafts · revisar · aprobar · corregir auditado · evidencia · autorizar compensaciones — **no** es propietario artístico del Work Record.

### 25.3 Visibilidad futura en Artist Profile

Sección conceptual futura: **MY WORK** · **PERFORMANCE HISTORY** · **WORK & EARNINGS** (nombre PO posterior).

Puede mostrar según permisos: fecha · venue · evento · rol · sessions · sets · estado · compensación earned/pending/paid · evidencia · notas · documentos · métricas acumuladas.

**No** implementar UI en este ticket.

### 25.4 Privacidad y permisos (conceptual)

**Artista ve:** propios Work Records · compensación autorizada · estado pago · documentos · métricas personales.

**Artista NO ve:** margen empresarial · compensación de otros · costos internos · comisiones Staff · datos financieros clientes · banca interna · métricas globales privadas MDJB.

**Staff autorizado** ve adicional según Owner · Manager · Seller · Finance · Legal · relación evento. **No** definir permisos runtime.

### 25.5 Identidad del beneficiario

Distinguir: persona que trabajó · perfil artístico · cuenta login · **beneficiario financiero** · receptor pago · entidad fiscal/contrato.

**No** asumir `artist_profile_id` = `payee_id` (orquesta · LLC · representante — UC-24).

### 25.6 Owner actuando como artista

| Regla | Detalle |
|-------|---------|
| Work Record | Perfil **DJMago305** |
| Aprobación | Puede cuenta Owner |
| Revenue | Miami DJ Beat |
| Compensación | Perfil profesional / beneficiario autorizado · puede pendiente |
| Prohibido | Owner draw automático · doble compensación |
| Auditoría | Separar actor aprobador vs artista |

**Conflicto autoaprobación (R-DWL-IDENTITY-04):** la misma persona puede ser Owner aprobador y artista beneficiado. Futuras reglas documentadas — **reason code** · evidencia adicional · auditoría reforzada · posible doble confirmación · revisión contable · **registro del actor** · **historial inmutable** de cambios. **No** implementar runtime en este ticket.

### 25.7 Métricas por perfil artístico

Por perfil: `total_sessions_completed` · `total_sets_completed` · `total_events_completed` · `total_venues_worked` · `gross_revenue_attributed` · `compensation_earned/pending/paid/reversed` · `coverage_count` · `cancellation_count` · `no_show_count`.

**Separadas de:** métricas Owner administrativas · ingresos empresa · owner draws · utilidades · ventas · comisiones · reembolsos.

### 25.8 Trazabilidad de identidad

Campos futuros: `person_id` · `user_account_id` · `artist_profile_id` · `professional_identity_id` · `beneficiary_party_id` · `approved_by_user_id` · `created_by_user_id` · `source_reference` · audit metadata.

---

## 26. Control de riesgo de regresiones

| Área | ¿Modificado? |
|------|--------------|
| DC-1 · DC-2 · NC · Cash Flow · portales | **No** |
| Runtime · Supabase | **No** |

**RIESGO FUNCIONAL DIRECTO:**

**NULO EN RUNTIME, PORQUE EL ENTREGABLE ES EXCLUSIVAMENTE DOCUMENTACIÓN.**

**RIESGO ARQUITECTÓNICO:**

**CONTROLADO MEDIANTE FUTUROS GATES DEL PRODUCT OWNER, VALIDACIÓN TÉCNICA, SEGURIDAD, PRIVACIDAD, REVISIÓN CONTABLE, FISCAL Y LEGAL ANTES DE IMPLEMENTACIÓN.**

No afirmar riesgo cero absoluto.

---

## 27. Criterios de aceptación (discovery)

- [x] Trabajo ≠ ingreso ≠ compensación ≠ pago (§4–5, §11)
- [x] `WorkRecord` genérico recomendado · roles múltiples (§6–7)
- [x] Separación Event / Assignment / Work / Compensation / OFTL / CF (§5, §13)
- [x] Sets · coberturas · multi-venue · tarifas (§10)
- [x] Owner como DJ · DJMago305 (§12, §25)
- [x] Métricas independientes · CF no writer (§14–15)
- [x] Trazabilidad (§16)
- [x] DWL-UC-01…26 (§17)
- [x] Ejemplos anonimizados (§18)
- [x] Account ≠ Artist Profile (§25)
- [x] Riesgos R-DWL + R-DWL-IDENTITY (§21)
- [x] Legal · contable · fiscal gates (§22)
- [x] Roadmap DWL-RM-01…14 (§23)
- [x] Captura histórica documentada (§24)
- [x] Sin TypeScript · sin registros reales
- [x] Commit local discovery autorizado PO
- [ ] Aprobación arquitectónica final PO (pendiente)

**No aprobar si:** trabajo = ingreso · compensación earned = pagada automáticamente · owner draw mezclado · CF = SSOT · sin trazabilidad/doble conteo · sin multi-set/cobertura/artista sin cuenta · sin gates legal/contable/fiscal · Account = Artist Profile.

---

## 28. Confirmación final

| Afirmación | Estado |
|------------|--------|
| Discovery documentado | ✓ |
| Registros financieros reales | ✗ |
| Obligaciones / pagos creados | ✗ |
| Código · tests · UI · runtime | ✗ |
| DC-1 · DC-2 · NC · Cash Flow · Staff · Artist | Sin modificar |
| Commit local | Autorizado PO · ver post-commit |
| Push remoto | ✗ |

**Estado post-commit autorizado:**

**WORK LEDGER & COMPENSATION DISCOVERY — DOCUMENTADO Y COMMITTED LOCALMENTE**

**PENDIENTE DE:** aprobación arquitectónica PO · revisión contable · fiscal · legal · seguridad y privacidad · data contracts · implementación · captura histórica controlada · integración OFTL · integración Cash Flow · validación visual · release V2.

No marcar: IMPLEMENTADO · PRODUCTION READY · LEGALMENTE APROBADO · FISCALMENTE APROBADO · RELEASED · DEPLOYED.

---

*Documento canónico Work Ledger V2. Implementación requiere ticket + autorización PO separada.*
