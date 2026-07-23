# TICKET-V1-PROFILE-RECONCILIATION-PLAN-001

**MIAMI DJ BEAT — Planificación controlada de reconciliación de perfiles**

| Campo | Valor |
|-------|--------|
| **Estado** | **PLANNING ONLY** |
| **Tipo** | V1 · Profile reconciliation · documentación |
| **Product Owner** | Gerardo A. Valle |
| **Autorización runtime / datos** | **NO AUTORIZADA** |
| **Ubicación** | `docs/tickets/` (convención V1 del repositorio) |
| **Relacionado** | TICKET-V1-PROFILE-READONLY-DATA-INSPECTION-001 · TICKET-V1-PROFILE-ONBOARDING-UX-FIX-001 · TICKET-V1-JOBS-EMPLOYMENT-ACCOUNT-INTENT-FIX-001 · TICKET-V1-PROFILE-DATA-RECONCILIATION-001 (discovery) · TICKET-V1-PROFILE-CLASSIFICATION-AUDIT-001 |

---

## 1. Contexto

Entre junio y julio de 2026 se corrigieron los flujos de alta V1 que podían crear cuentas artísticas o de cliente **sin intención explícita** (default silencioso `talent`, Employment sin checkbox, re-derivación URL en `auth.js`).

Commits de protección futura (ya en repo):

| Hash | Mensaje |
|------|---------|
| `a787220` | `feat(auth): improve onboarding account intent selection` |
| `07785ae` | `feat(jobs): improve employment account intent flow` |

Una **inspección read-only remota** (`cc1969c`, ticket READONLY-DATA-INSPECTION-001) sobre el proyecto Supabase `hkuvuqupbxwkiykxvqdr` documentó la distribución actual de 15 usuarios auth (Q15):

| Bucket | Cantidad |
|--------|----------:|
| ARTIST_ONLY | 6 |
| CLIENT_ONLY | 3 |
| DUAL | 4 |
| MISSING | 2 |

**Conclusión previa confirmada:** el CRM refleja correctamente las filas persistidas. La deuda identificada es **`HISTORICAL SIGNUP INTENT MISALIGNMENT`** — no corrupción del CRM ni fallo del flujo ya corregido.

Este ticket **solo** define cómo reconciliar de forma segura en el futuro. **No ejecuta** reconciliación.

---

## 2. Problema

Existen usuarios cuyo **estado persistido** (`client_profiles` / `dj_profiles` / JWT / MDJB) puede no coincidir con la **intención real de negocio** al momento del alta, por fallos históricos del flujo de signup.

Riesgos si se reconcilia sin plan:

| Riesgo | Consecuencia |
|--------|--------------|
| Crear `dj_profiles` sobre un cliente legítimo | Portal artista, roster, CRM DJ incorrectos |
| Crear `client_profiles` sobre un artista activo | Clasificación buyer, pérdida de nav/performer |
| Eliminar filas con actividad comercial | Pérdida de leads, invoices, historial |
| Confiar solo en JWT `user_type` | Metadata de signup errónea perpetúa el error |
| Batch masivo sin snapshot | Rollback imposible o parcial |
| Tratar DUAL como error | Owner/staff legítimo degradado |

---

## 3. Objetivo

Producir una estrategia **segura, reversible y auditable** para un ticket futuro de reconciliación que responda:

1. Fuente de verdad para intención real.
2. Significado exacto de cada estado operativo.
3. Casos elegibles para automatización determinística.
4. Casos que exigen revisión humana.
5. Datos que **nunca** deben inferirse sin evidencia.
6. Procedimiento de dry-run (diseño).
7. Validación pre-escritura.
8. Rollback.
9. Prevención de duplicados y pérdida de información.
10. Coherencia Auth ↔ perfiles ↔ CRM ↔ portales.

---

## 4. Fuera de alcance (este ticket)

| Prohibido en este ticket | Estado |
|--------------------------|--------|
| INSERT / UPDATE / DELETE / UPSERT remoto | **No ejecutado** |
| Modificar `auth.users` o metadata JWT | **No autorizado** |
| Migraciones, RLS, Edge Functions | **No tocado** |
| Runtime (`web/`, `client/`, `supabase/`) | **No tocado** |
| Dry-run remoto ejecutado | **No ejecutado** |
| Reconciliación aplicada | **No ejecutada** |
| Commit / push / PR / deploy | **Según gates del ticket** |

---

## 5. Baseline Git

Verificado al inicio de este ticket:

```text
git branch --show-current  → plan/v2-phase-4-api-client
git rev-parse --short HEAD → 8903b75
git log -1 --oneline       → 8903b75 docs: record end-of-day status for 2026-07-23
git status --short         → (vacío)
```

Commits relevantes de la sesión anterior:

| Hash | Mensaje |
|------|---------|
| `a787220` | `feat(auth): improve onboarding account intent selection` |
| `07785ae` | `feat(jobs): improve employment account intent flow` |
| `cc1969c` | `docs(profile): record read-only inspection findings` |
| `8903b75` | `docs: record end-of-day status for 2026-07-23` |

---

## 6. Evidencia existente (documentada — sin nueva consulta remota)

| Fuente | Contenido útil |
|--------|----------------|
| `docs/tickets/TICKET-V1-PROFILE-READONLY-DATA-INSPECTION-001.md` | Q15, Ary, Aron, MISSING emails, DUAL list, limitaciones pooler |
| `docs/NOTA-DIARIA-2026-07-23.md` | Resumen operativo del día |
| `docs/tickets/TICKET-V1-PROFILE-ONBOARDING-UX-FIX-001.md` | Causa histórica default `talent` |
| `docs/tickets/TICKET-V1-JOBS-EMPLOYMENT-ACCOUNT-INTENT-FIX-001.md` | Employment sin ack; H-01 |
| `docs/AGENT-MEMORY.md` | **DB wins over JWT**; dual row → performer |
| `docs/V2/PROFILE-TAXONOMY.md` | Client / Artist / Staff subtipos; MDJB suffix C/A/S/M |

**Inspección remota previa:** `supabase db query --linked`, proyecto `hkuvuqupbxwkiykxvqdr`, **solo SELECT**. Ningún dato modificado.

Consultas pendientes para futura pasada read-only (no bloquean este plan): detalle Q6, export Q1, Q13, Q14, `identity_audit_contradictions.sql`.

---

## 7. Definiciones de estados operativos (Q15 / inventario)

Estados derivados de **presencia de filas** en Postgres (no de intención de negocio):

### CLIENT_ONLY

Usuario con fila en `client_profiles` y **sin** fila en `dj_profiles`.

| Aspecto | Comportamiento V1 esperado |
|---------|----------------------------|
| CRM | Aparece como cliente / buyer |
| Portal | Client portal; nav buyer |
| MDJB típico | Suffix **C** |
| JWT frecuente | `user_type: client` |
| Puede ser | Estado **legítimo** o **desalineación histórica** |

### ARTIST_ONLY

Usuario con fila en `dj_profiles` y **sin** fila en `client_profiles`.

| Aspecto | Comportamiento V1 esperado |
|---------|----------------------------|
| CRM | Aparece como DJ / artista |
| Portal | Artist profile / dashboard |
| MDJB típico | Suffix **A** (performer) |
| JWT frecuente | `user_type: talent` |
| Puede ser | Estado **legítimo** o **desalineación histórica** |

### DUAL

Usuario con filas en **ambas** tablas (`client_profiles` ∧ `dj_profiles`).

| Aspecto | Comportamiento V1 esperado |
|---------|----------------------------|
| Clasificación runtime | **`mdj-identity.js`:** si `dj_profiles` existe → `principal: performer` (no buyer) |
| CRM | Puede aparecer en ambos contextos según vista |
| Casos documentados | owner/Gerardo, DJMago305, DJYuyo, Alexander Reyes |
| Puede ser | **Legítimo** (owner, uso real dual) — **no** auto-etiquetar como error |

### MISSING

Usuario en `auth.users` **sin** fila en `client_profiles` **ni** en `dj_profiles`.

| Aspecto | Comportamiento V1 esperado |
|---------|----------------------------|
| CRM | Sin perfil recuperable |
| Documentados | `perezshakira97@gmail.com`, `gerardoa4@hotmail.com` (JWT `client`) |
| Riesgo | Alta ambigüedad; nunca auto-provisionar sin evidencia |

---

## 8. Subcategorías de planificación (solo documentales)

Evaluación: **útiles** para el proceso futuro. **No** implementar en runtime ni DB en este ticket.

| Subcategoría | Criterio propuesto |
|--------------|-------------------|
| `VALID_CLIENT_ONLY` | Estado CLIENT_ONLY + evidencia CONFIRMED de intención cliente |
| `VALID_ARTIST_ONLY` | Estado ARTIST_ONLY + evidencia CONFIRMED de intención artista |
| `VALID_DUAL` | Estado DUAL + evidencia CONFIRMED de uso dual o owner legítimo |
| `SUSPECT_CLIENT_ONLY` | CLIENT_ONLY pero señales débiles de intención artista (PO memory, sin confirmación) |
| `SUSPECT_ARTIST_ONLY` | ARTIST_ONLY pero señales débiles de intención cliente |
| `MISSING_INTENT_KNOWN` | MISSING + evidencia HIGH de intención (p. ej. PO + actividad) |
| `MISSING_INTENT_UNKNOWN` | MISSING sin señales suficientes |
| `MANUAL_REVIEW_REQUIRED` | CONFIDENCE ≤ AMBIGUOUS o riesgo HIGH |
| `NO_ACTION_REQUIRED` | Estado alineado con intención CONFIRMED |

---

## 9. Fuente de verdad propuesta

**Principio:** no existe una sola tabla absoluta. La reconciliación debe usar una **jerarquía de evidencia** con decisión humana en conflictos.

### Orden de precedencia (de mayor a menor autoridad)

| Rank | Fuente | Uso |
|------|--------|-----|
| E1 | **Confirmación escrita PO** para `user_id` + acción concreta | Autoriza candidato en Approved Set |
| E2 | **Confirmación directa del usuario** (email, ticket, formulario firmado) | Igual o refuerzo de E1 |
| E3 | **Evidencia manual documentada** (notas CRM, contrato, onboarding telefónico) | HIGH si fechada y trazable |
| E4 | **Actividad comercial persistida** | `leads`, `invoices`, bookings, `event_builder_orders`, contratos — dominio client vs artist |
| E5 | **Employment / Jobs** | Envío `#employment-form`, `dj_profiles.status = PENDING_REVIEW`, timestamps |
| E6 | **Filas de perfil existentes** | `client_profiles.*`, `dj_profiles.*`, `stage_name`, `is_commercial`, `role` staff |
| E7 | **MDJB** (`mdjb_account_ids`) | Suffix C/A/S/M — señal fuerte de canal de alta, no intención futura |
| E8 | **Timestamps de creación** | Orden relativo client vs dj vs auth |
| E9 | **JWT / `auth.users` metadata** (`user_type`) | **Señal débil** — refleja signup histórico, puede estar wrong |
| E10 | **Expectativa PO no documentada** | **No válida** para escritura — solo dispara revisión |

### Reglas de oro

| # | Regla |
|---|-------|
| R-01 | **DB wins over JWT** para clasificación runtime actual (Constitución / AGENT-MEMORY). |
| R-02 | Reconciliación **cambia DB** solo con E1/E2 (+ dry-run aprobado). |
| R-03 | JWT solo se alinea **después** de perfiles correctos, en ticket Auth separado si aplica. |
| R-04 | **Nunca inferir** intención dual solo porque existen ambas filas. |
| R-05 | **Nunca eliminar** fila con FKs o actividad comercial sin inventario explícito y rollback. |
| R-06 | Owner/staff (`dj_profiles.role` ∈ admin|owner|manager|seller) → **MANUAL_REVIEW** obligatoria. |

---

## 10. Jerarquía de evidencia — niveles de confianza

| Nivel | Definición | Acción permitida en ejecución futura |
|-------|------------|--------------------------------------|
| **CONFIRMED** | E1 o E2 + coherencia con estado o acción propuesta | Elegible para Approved Candidate Set |
| **HIGH_CONFIDENCE** | ≥2 fuentes E3–E7 alineadas, sin conflicto | Dry-run automático; revisión PO por lote |
| **AMBIGUOUS** | Señales mixtas o solo E9/E10 | **MANUAL_REVIEW_REQUIRED** — sin escritura |
| **CONFLICTING** | Actividad client y artist contradictoria | **MANUAL_REVIEW_REQUIRED** — posible DUAL legítimo |
| **UNKNOWN** | MISSING o sin señales E3–E8 | **MANUAL_REVIEW_REQUIRED** — sin auto-create |

### Automatización vs humano

| Automatizable (determinístico) | Requiere humano |
|-------------------------------|-----------------|
| Clasificar Q15 bucket desde SELECT | Interpretar intención con AMBIGUOUS |
| Detectar JWT ≠ filas (Q6/Q7) | Decidir corrección |
| Marcar `NO_ACTION` si CONFIRMED + alineado | Aprobar CREATE/ARCHIVE por usuario |
| Generar reporte dry-run | Aprobar cada lote de escritura |
| Validar idempotencia (ya reconciliado) | Casos owner/DUAL/staff |

---

## 11. Matriz de decisión

Leyenda de **acción recomendada** (solo planificación):

| Código | Significado |
|--------|-------------|
| `NO_ACTION` | Mantener estado; documentar validez |
| `CREATE_CLIENT_PROFILE` | Provisionar `client_profiles` (futuro, con snapshot) |
| `CREATE_DJ_PROFILE` | Provisionar `dj_profiles` (futuro, con snapshot) |
| `ALIGN_JWT_METADATA` | Ticket Auth separado post-perfiles |
| `SPLIT_REVIEW` | Evaluar si DUAL debe reducirse (raro; alto riesgo) |
| `DEFER` | Esperar evidencia E1/E2 |
| `OMIT` | Excluir del lote; riesgo inaceptable |

### CLIENT_ONLY

| Intención | Evidencia típica | Confianza | Acción | Manual | Riesgo | Rollback | Resultado esperado |
|-----------|------------------|-----------|--------|--------|--------|----------|-------------------|
| Cliente | Bookings/leads como buyer; PO confirma | CONFIRMED | `NO_ACTION` | No | Bajo | N/A | CRM cliente correcto |
| Artista | Employment enviado; PO confirma artista | CONFIRMED | `CREATE_DJ_PROFILE` | Sí | Medio | Snapshot + delete dj si rollback | Artist portal + CRM DJ |
| Dual | PO confirma contrata y ofrece servicios | CONFIRMED | `CREATE_DJ_PROFILE` | Sí | Medio | Snapshot ambas tablas | DUAL legítimo |
| Desconocida | Solo JWT client | UNKNOWN | `DEFER` | Sí | Medio | N/A | Sin escritura |

**Notas CLIENT_ONLY + artista:** clasificar como **desalineación histórica** si PO confirma; caso **Ary** cae aquí hasta E1/E2.

### ARTIST_ONLY

| Intención | Evidencia típica | Confianza | Acción | Manual | Riesgo | Rollback | Resultado esperado |
|-----------|------------------|-----------|--------|--------|--------|----------|-------------------|
| Artista | Roster, dj ACTIVE, sin actividad client | CONFIRMED / HIGH | `NO_ACTION` | No | Bajo | N/A | CRM DJ correcto |
| Cliente | Solo compras; PO confirma cliente | CONFIRMED | `CREATE_CLIENT_PROFILE` | Sí | **Alto** | Snapshot dj + soft archive policy | Buyer portal — **no borrar dj sin inventario** |
| Dual | Actividad en ambos dominios | CONFIRMED | `CREATE_CLIENT_PROFILE` | Sí | Alto | Snapshot | DUAL |
| Desconocida | Solo JWT talent | UNKNOWN | `DEFER` | Sí | Medio | N/A | Sin escritura |

**Notas ARTIST_ONLY + cliente:** caso **Aron** — **SUSPECT** hasta evidencia; crear client sin revisar dj es **peligroso**.

### DUAL

| Intención | Evidencia típica | Confianza | Acción | Manual | Riesgo | Rollback | Resultado esperado |
|-----------|------------------|-----------|--------|--------|--------|----------|-------------------|
| Dual | Owner o uso real dual documentado | CONFIRMED | `NO_ACTION` | Sí (owner) | Bajo | N/A | Mantener performer principal |
| Cliente | Cliente accidental + dj vacío | HIGH (raro) | `SPLIT_REVIEW` | Sí | **Crítico** | Snapshot completo | Casi nunca auto |
| Artista | Client row huérfana | HIGH (raro) | `SPLIT_REVIEW` | Sí | **Crítico** | Snapshot | Casi nunca auto |
| Desconocida | 4 usuarios Q2 | AMBIGUOUS | `DEFER` | Sí | Alto | N/A | Inventario actividad primero |

**Regla DUAL:** tratar como **estado legítimo por defecto** hasta evidencia en contra.

### MISSING

| Intención | Evidencia típica | Confianza | Acción | Manual | Riesgo | Rollback | Resultado esperado |
|-----------|------------------|-----------|--------|--------|--------|----------|-------------------|
| Cliente | PO + JWT client + sin dj activity | CONFIRMED | `CREATE_CLIENT_PROFILE` | Sí | Medio | Snapshot auth + new row ids | Client portal |
| Artista | Employment + PO | CONFIRMED | `CREATE_DJ_PROFILE` | Sí | Medio | Snapshot | Artist onboarding |
| Dual | PO confirma ambos | CONFIRMED | Secuencia: client → dj | Sí | Alto | Snapshot | DUAL |
| Desconocida | 2 emails Q3 | UNKNOWN | `DEFER` | Sí | Medio | N/A | Contactar usuario |

### Clasificación transversal de filas

| Situación | Etiqueta |
|-----------|----------|
| Estado = intención CONFIRMED | **Estado legítimo** |
| PO memory ≠ filas, sin E1/E2 | **Desalineación histórica** (información insuficiente) |
| MISSING / sin E3–E8 | **Información insuficiente** |
| JWT ≠ filas (Q6) | **Conflicto entre señales** |
| CREATE sobre fila con invoices/leads | **Caso potencialmente peligroso** |

---

## 12. Estrategia dry-run (diseño — no ejecutada)

### Objetivo del dry-run futuro

Producir un **reporte comparable** sin INSERT/UPDATE/DELETE, exportable para revisión PO.

### Fases del dry-run (read-only)

| Paso | Actividad |
|------|-----------|
| DR-1 | Inventario Q15 + Q1 export + Q6 detalle + actividad comercial por `user_id` |
| DR-2 | Snapshot lógico (JSON/CSV) de filas actuales — **copia read-only**, no backup de servicio |
| DR-3 | Motor de clasificación determinística → bucket + subcategoría |
| DR-4 | Aplicar matriz §11 con evidencias disponibles |
| DR-5 | Generar candidatos con exclusión automática de riesgo CRÍTICO sin E1 |
| DR-6 | Resumen de impacto: cuántos CREATE, cuántos NO_ACTION, cuántos DEFER |

### Schema de reporte propuesto (por fila)

| Campo | Descripción |
|-------|-------------|
| `user_id` | UUID auth |
| `email` | auth email |
| `current_state` | CLIENT_ONLY \| ARTIST_ONLY \| DUAL \| MISSING |
| `inferred_intent` | client \| artist \| dual \| unknown |
| `confidence` | CONFIRMED … UNKNOWN |
| `evidence` | Lista codificada E1–E10 |
| `proposed_action` | Código §11 |
| `requires_manual_review` | boolean |
| `risk_level` | low \| medium \| high \| critical |
| `rollback_reference` | ID de snapshot lote (vacío en dry-run) |
| `notes` | Texto libre audit |

### Casos omitidos automáticamente del candidato write

- `confidence` = UNKNOWN o CONFLICTING sin E1
- `risk_level` = critical sin aprobación individual PO
- Staff roles sin revisión management
- Filas con actividad comercial no inventariada

**Este ticket no ejecuta DR-1..DR-6.** Requiere ticket futuro `TICKET-V1-PROFILE-RECONCILIATION-DRY-RUN-001`.

---

## 13. Proceso de revisión humana

| Gate | Responsable | Entregable |
|------|-------------|------------|
| HR-1 | Agente / técnico | Reporte dry-run completo |
| HR-2 | PO | Marca fila a fila: APPROVE / REJECT / DEFER |
| HR-3 | PO | Firma escrita en ticket de ejecución con lista exacta `user_id` |
| HR-4 | Técnico | Matriz before/after por usuario aprobado |
| HR-5 | PO | OK para lote F (máx. N usuarios por lote — propuesta N≤3) |

Usuarios **obligatorios** en HR-2: Ary, Aron, 2 MISSING, 4 DUAL, 2 Q6 pendientes.

---

## 14. Estrategia futura de ejecución (por etapas)

| Fase | Nombre | Escritura | Descripción |
|------|--------|-----------|-------------|
| **A** | Inventory | No | SELECT completo + actividad comercial |
| **B** | Classification | No | Subcategorías + confianza |
| **C** | Manual Review | No | PO aprueba/rechaza candidatos |
| **D** | Approved Candidate Set | No | Lista congelada `user_id` + acción |
| **E** | Backup/Snapshot | No* | Export filas afectadas + metadata (*solo lectura export) |
| **F** | Controlled Write | **Sí** | Ticket independiente; transacción por usuario cuando posible |
| **G** | Post-write Verification | No | SELECT verificación + CRM smoke |
| **H** | Product Owner Validation | No | PO confirma UX portal/CRM |
| **I** | Closure | No | Documentación + cierre ticket |

### Requisitos toda escritura F

- Ticket independiente con IDs explícitos
- Dry-run aprobado en HR-5
- Snapshot E exportado y referenciado
- Aprobación expresa PO (E1)
- Idempotencia (§17)
- Audit log por lote (§18)
- Rollback probado en staging o dry-run de restore
- Validación G antes del siguiente lote

---

## 15. Controles de idempotencia

| Control | Descripción |
|---------|-------------|
| ID-1 | Tabla documental `reconciliation_run` (futuro) con `run_id`, ticket, timestamp |
| ID-2 | Por `user_id`: si acción ya aplicada con mismo `run_id` → skip |
| ID-3 | CREATE: verificar ausencia de fila antes de INSERT |
| ID-4 | No repetir CREATE si fila existe (evitar duplicados) |
| ID-5 | Marcar fila reconciliada en audit log — **no** borrar historial |
| ID-6 | Scripts con modo `--dry-run` obligatorio por defecto |

---

## 16. Backup y snapshot

| Elemento | Contenido mínimo |
|----------|------------------|
| Por usuario | `user_id`, email, JSON `client_profiles`, JSON `dj_profiles`, JWT metadata (read), MDJB |
| Por lote | `batch_id`, ticket, actor, timestamp UTC |
| Actividad | Count leads/invoices/orders vinculados |
| Almacenamiento | Artefacto en repo `docs/audits/` o storage privado — **sin secrets** |

Snapshot es **prerrequisito** de fase F. Sin snapshot → no escritura.

---

## 17. Rollback

### Principios

- **No eliminación irreversible** como primera opción
- Preferir: reversión por INSERT inverso documentado, soft flags, restauración desde snapshot
- Lotes pequeños; PO aprueba entre lotes

### Registro por usuario (plantilla)

| Campo | Ejemplo |
|-------|---------|
| `user_id` | UUID |
| `batch_id` | RECON-2026-XX-001-B1 |
| `ticket` | TICKET-V1-PROFILE-RECONCILIATION-EXEC-001 |
| `timestamp_utc` | ISO-8601 |
| `actor` | staff uid / proceso |
| `before` | Snapshot JSON |
| `after` | Snapshot JSON post-write |
| `records_created` | `{ "dj_profiles": "uuid" }` o vacío |
| `links_modified` | FKs, MDJB triggers |
| `restore_procedure` | SQL/script read-only diseñado — ejecutar solo en ticket rollback |
| `verify_after_restore` | SELECT Q15 + portal check |

### Escenarios

| Acción original | Rollback propuesto |
|-----------------|-------------------|
| `CREATE_CLIENT_PROFILE` | DELETE fila nueva **solo si** sin FKs; si hay FKs → MANUAL |
| `CREATE_DJ_PROFILE` | DELETE fila nueva **solo si** sin roster/leads; si hay → MANUAL |
| `ALIGN_JWT_METADATA` | Restaurar metadata desde snapshot Auth |
| Error mid-batch | Abort resto del lote; rollback usuarios ya escritos del lote |

---

## 18. Validación posterior (fase G)

| Check | Método |
|-------|--------|
| Q15 reclasificación | SELECT read-only |
| CRM lista correcta | Smoke PO admin |
| Portal buyer vs performer | Login test cuentas afectadas |
| MDJB suffix coherente | SELECT `mdjb_account_ids` |
| JWT vs DB | `identity_audit_contradictions.sql` cuando disponible |
| Sin regresión nav | Locked files no tocados en ticket exec |

---

## 19. Riesgos

| ID | Riesgo | Mitigación |
|----|--------|------------|
| RK-1 | Crear dj sobre cliente activo | E1 + inventario leads; lote ≤3 |
| RK-2 | Romper performer nav al crear client | Verificar `mdj-identity` rules post-write |
| RK-3 | Owner tratado como error | Excluir staff de auto |
| RK-4 | JWT “arreglado” antes que DB | R-03: perfiles primero |
| RK-5 | Pooler circuit breaker | Espaciar queries; export offline |
| RK-6 | PO memory como única evidencia | E10 explícitamente inválida para write |
| RK-7 | Duplicados MDJB | Respetar triggers; idempotencia |
| RK-8 | Pérdida histórica Employment | Nunca DELETE dj con PENDING_REVIEW history |

---

## 20. Casos especiales

| Caso | Tratamiento |
|------|-------------|
| **Staff** (owner/manager/seller/admin) | MANUAL_REVIEW; probable `NO_ACTION` |
| **Q6** JWT client + dj_profiles (2 users) | Inventario actividad; posible JWT stale — no auto-fix JWT solo |
| **Q8 EMPTY_DJ = 0** | No aplicar heurística stage_name vacío |
| **Typo nombre** (Ary Productons) | Corrección copy = ticket separado; no mezclar con intent |
| **VIP / commercial client** | Revisar `is_commercial` antes CREATE |
| **PENDING_REVIEW dj** | Señal fuerte de employment histórico |

---

## 21. Tratamiento propuesto — Ary DJ Productions (planificación únicamente)

| Campo | Valor documentado |
|-------|-------------------|
| `user_id` | `741a2a8a-138a-4c5b-9ed2-6e9e522c07f6` |
| Email | `yunielaryam1984@gmail.com` |
| **Estado observado** | **CLIENT_ONLY** |
| CRM | Coherente con filas |
| Clasificación deuda | `HISTORICAL SIGNUP INTENT MISALIGNMENT` (expectativa PO no confirmada como E1) |

### No asumir

- **No** asumir automáticamente que requiere perfil artístico.
- **No** asumir que el estado actual es incorrecto sin confirmación.

### Evidencia adicional necesaria (futuro dry-run)

| Evidencia | Propósito |
|-----------|-----------|
| E1 PO: “debe ser artista” o “permanece cliente” | Desbloquea acción |
| E2 confirmación usuario | Refuerzo |
| Employment / Jobs submission history | Señal artista |
| Leads/bookings como buyer | Señal cliente |
| Timestamps auth vs client_profiles | Orden de alta |

### Propuesta preliminar (sin ejecutar)

| Escenario | Confianza | Acción | Manual |
|-----------|-----------|--------|--------|
| PO confirma **cliente** | CONFIRMED | `NO_ACTION` | No |
| PO confirma **artista** | CONFIRMED | `CREATE_DJ_PROFILE` | Sí |
| Sin E1/E2 | AMBIGUOUS | `DEFER` | Sí |

**Subcategoría actual:** `SUSPECT_CLIENT_ONLY` (expectativa PO documentada en inspección, **no** CONFIRMED para reconciliación).

---

## 22. Tratamiento propuesto — Aron Rosso (planificación únicamente)

| Campo | Valor documentado |
|-------|-------------------|
| `user_id` | `4bf2cf75-9e4f-49b0-8b30-b8b0a9986da4` |
| Email | `aron.rosso@icloud.com` |
| **Estado observado** | **ARTIST_ONLY** (`dj_profiles` ACTIVE, `stage_name` poblado) |
| CRM | Coherente con filas |
| Clasificación deuda | `HISTORICAL SIGNUP INTENT MISALIGNMENT` |

### No asumir

- **No** asumir automáticamente que requiere perfil de cliente.
- **No** asumir que debe eliminarse o degradarse el perfil artístico.

### Evidencia adicional necesaria

| Evidencia | Propósito |
|-----------|-----------|
| E1 PO + E2 usuario | Intención definitiva |
| Actividad solo como buyer (leads/invoices) | Señal cliente |
| Roster / dashboard artist usage | Señal artista legítimo |
| Origen alta (employment vs login client) | Contexto histórico |

### Propuesta preliminar (sin ejecutar)

| Escenario | Confianza | Acción | Manual |
|-----------|-----------|--------|--------|
| PO confirma **artista** | CONFIRMED | `NO_ACTION` | No |
| PO confirma **cliente** | CONFIRMED | `CREATE_CLIENT_PROFILE` + revisión performer nav | Sí — **riesgo alto** |
| Sin E1/E2 | AMBIGUOUS | `DEFER` | Sí |

**Subcategoría actual:** `SUSPECT_ARTIST_ONLY`.

**Advertencia:** `CREATE_CLIENT_PROFILE` sobre artista ACTIVE altera `mdj-identity` (performer gana sobre buyer si dj existe — regla actual). Planificar UX explícitamente en ticket de ejecución.

---

## 23. Criterios de aceptación (este ticket de planificación)

| # | Criterio | Estado |
|---|----------|--------|
| AC-1 | Baseline Git verificado | ✓ |
| AC-2 | Documentación previa leída | ✓ |
| AC-3 | Cuatro estados definidos | ✓ §7 |
| AC-4 | Fuente de verdad propuesta | ✓ §9 |
| AC-5 | Jerarquía de evidencia | ✓ §9–10 |
| AC-6 | Matriz de decisión completa | ✓ §11 |
| AC-7 | Dry-run diseñado | ✓ §12 |
| AC-8 | Rollback diseñado | ✓ §17 |
| AC-9 | Ambiguos → revisión humana | ✓ §10, §13 |
| AC-10 | Ary y Aron sin intención presumida | ✓ §21–22 |
| AC-11 | Sin código modificado | ✓ |
| AC-12 | Sin datos modificados | ✓ |
| AC-13 | Declaración explícita no-escritura | ✓ §28 |

---

## 24. Gates de aprobación (cadena futura)

| Orden | Gate | Aprobador |
|-------|------|-----------|
| G0 | Este plan PLANNING ONLY | PO revisa este documento |
| G1 | Ticket DRY-RUN autorizado | PO frase explícita en ticket |
| G2 | Reporte dry-run aprobado | PO HR-2/HR-5 |
| G3 | Ticket EXEC con lista `user_id` | PO + Arquitecto |
| G4 | Cada lote F | PO entre lotes |
| G5 | Cierre I | PO |

Sin G0 → no G1. Sin G2 → no F.

---

## 25. Próximo ticket recomendado

**TICKET-V1-PROFILE-RECONCILIATION-DRY-RUN-001**

| Campo | Valor |
|-------|--------|
| Alcance | Ejecutar DR-1..DR-6 read-only remoto |
| Autorización | Requiere PO tras aprobar este plan |
| Escritura | **Prohibida** |
| Entregable | CSV/JSON reporte §12 + recomendaciones HR-2 |

Ticket subsiguiente (no abrir aún): **TICKET-V1-PROFILE-RECONCILIATION-EXEC-001** — solo tras G2/G3.

---

## 26. Relación Auth · perfiles · CRM · portales

```
auth.users (JWT user_type — señal débil)
       │
       ├── client_profiles ──► Client portal / buyer nav / MDJB-C
       │
       └── dj_profiles ──────► Artist portal / performer / CRM DJ / MDJB-A
                │
                └── role staff ──► Staff portal / MDJB-S|M (MANUAL_REVIEW)
```

Post-reconciliación futura:

1. Ajustar filas perfil (fuente operativa CRM).
2. Verificar triggers MDJB / snapshots RPC si aplica.
3. JWT/metadata en ticket Auth **después**, si sigue contradiciendo.
4. Validar `mdjClassifyPlatformIdentity` en browser con cuentas de prueba PO.

---

## 27. Preguntas abiertas para PO

| # | Pregunta |
|---|----------|
| Q-PO-1 | ¿Ary debe permanecer CLIENT_ONLY o convertirse en artista? (E1) |
| Q-PO-2 | ¿Aron debe permanecer ARTIST_ONLY o añadir client? (E1) |
| Q-PO-3 | ¿Los 4 DUAL son legítimos excepto casos específicos? |
| Q-PO-4 | ¿Política para 2 MISSING: contacto usuario vs create bajo PO? |
| Q-PO-5 | ¿Tamaño máximo de lote F (propuesto 3)? |
| Q-PO-6 | ¿Autorizar pasada read-only Q6/Q1/Q13/Q14 antes del dry-run? |

---

## 28. Declaración explícita — sin modificación de datos

**Este ticket es PLANNING ONLY.**

| Afirmación | Verdad |
|------------|--------|
| ¿Se modificaron perfiles en Postgres? | **NO** |
| ¿Se ejecutó INSERT/UPDATE/DELETE/UPSERT? | **NO** |
| ¿Se consultó Supabase en esta pasada? | **NO** (evidencia = documentación existente) |
| ¿Se ejecutó reconciliación? | **NO** |
| ¿Se migró o alteró RLS/Auth/Edge? | **NO** |
| ¿Se modificó código fuente? | **NO** |
| ¿Se requiere ticket futuro + aprobación PO para cualquier escritura? | **SÍ** |

---

## 29. Cierre del ticket de planificación

| Item | Estado |
|------|--------|
| Plan documentado | COMPLETE (pendiente revisión PO) |
| Dry-run | NOT EXECUTED |
| Reconciliación | NOT AUTHORIZED |
| Commit | **Esperar aprobación PO** |

**Fin del documento — TICKET-V1-PROFILE-RECONCILIATION-PLAN-001**
